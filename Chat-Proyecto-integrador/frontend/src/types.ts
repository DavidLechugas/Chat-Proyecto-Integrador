export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  source?: ChatResponse["source"];
};

export type ChatResponse = {
  reply: string;
  source: "local" | "gemini" | "openrouter";
};
