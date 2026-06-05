import { env } from "../config/env";
import { fetchWithTimeout } from "./http";
import { AudioInput } from "./types";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const buildPrompt = (): string =>
  [
    "Transcribe the audio accurately.",
    "Return only the transcription text.",
    "If the audio is in Spanish, answer in Spanish.",
    "Do not add explanations or summaries.",
  ].join(" ");

export const transcribeAudio = async (audio: AudioInput): Promise<string> => {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_KEY_MISSING");
  }

  const url = `${GEMINI_URL}/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
  const payload = {
    systemInstruction: {
      parts: [{ text: "You are a highly accurate speech-to-text transcription engine." }],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: audio.mimeType,
              data: audio.data,
            },
          },
          { text: buildPrompt() },
        ],
      },
    ],
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
    throw new Error(`GEMINI_TRANSCRIBE_FAILED_${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("GEMINI_TRANSCRIBE_EMPTY");
  }

  return text;
};
