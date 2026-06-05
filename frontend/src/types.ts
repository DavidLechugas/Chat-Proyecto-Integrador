export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  source?: ChatResponse["source"];
};

export type ChatImageInput = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

export type AudioInput = {
  mimeType: string;
  data: string;
};

export type ChatResponse = {
  reply: string;
  source: "local" | "gemini" | "openrouter";
};

export type TranscriptResponse = {
  transcript: string;
};
