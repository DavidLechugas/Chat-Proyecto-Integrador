import { ChatMessage, ChatResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/chat";
const MAX_MESSAGE = 600;
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_CONTENT = 1000;

export class ChatApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const sanitizeHistory = (history: ChatMessage[]): ChatMessage[] =>
  history
    .filter((item) => (item.role === "user" || item.role === "assistant") && item.content.trim().length > 0)
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_HISTORY_CONTENT),
    }));

export const sendChatMessage = async (
  message: string,
  history: ChatMessage[],
): Promise<ChatResponse> => {
  const cleanMessage = message.trim().slice(0, MAX_MESSAGE);
  const cleanHistory = sanitizeHistory(history);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: cleanMessage, history: cleanHistory }),
  });

  if (!response.ok) {
    throw new ChatApiError(response.status, "CHAT_REQUEST_FAILED");
  }

  return (await response.json()) as ChatResponse;
};
