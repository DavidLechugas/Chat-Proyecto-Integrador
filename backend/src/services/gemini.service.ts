import { env } from "../config/env";
import { Message } from "./types";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchWithTimeout } from "./http";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const buildContents = (history: Message[], userMessage: string) => {
  const items = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  items.push({ role: "user", parts: [{ text: userMessage }] });
  return items;
};

export const askGemini = async (
  userMessage: string,
  history: Message[],
  model = env.geminiModel,
): Promise<string> => {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_KEY_MISSING");
  }

  const url = `${GEMINI_URL}/${model}:generateContent?key=${env.geminiApiKey}`;
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: buildContents(history, userMessage),
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
