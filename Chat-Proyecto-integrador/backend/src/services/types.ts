export type ChatSource = "local" | "gemini" | "openrouter";

export type ChatResult = {
  reply: string;
  source: ChatSource;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
};
