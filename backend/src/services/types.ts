export type ChatSource = "local" | "gemini" | "openrouter";

export type ChatResult = {
  reply: string;
  source: ChatSource;
};

export type ImageInput = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

export type AudioInput = {
  mimeType: string;
  data: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
};
