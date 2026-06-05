import { env } from "../config/env";
import { ImageInput, Message } from "./types";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchWithTimeout } from "./http";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: ImageInput["mimeType"];
        data: string;
      };
    };

type GeminiContentItem = {
  role: "user" | "model";
  parts: GeminiPart[];
};

const buildContents = (history: Message[], userMessage: string, image?: ImageInput) => {
  const items: GeminiContentItem[] = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const parts: GeminiPart[] = [];

  if (image) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }

  parts.push({ text: userMessage });
  items.push({ role: "user", parts });
  return items;
};

export const askGemini = async (
  userMessage: string,
  history: Message[],
  model = env.geminiModel,
  image?: ImageInput,
): Promise<string> => {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_KEY_MISSING");
  }

  const url = `${GEMINI_URL}/${model}:generateContent?key=${env.geminiApiKey}`;
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: buildContents(history, userMessage, image),
  };

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    env.requestTimeoutMs,
  );

  if (!response.ok) {
    throw new Error(`GEMINI_REQUEST_FAILED_${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("GEMINI_EMPTY_RESPONSE");
  }

  return text;
};
