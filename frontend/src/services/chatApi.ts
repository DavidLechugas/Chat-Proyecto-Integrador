import { AudioInput, ChatImageInput, ChatMessage, ChatResponse, TranscriptResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/chat$/, "") ?? "http://localhost:3000/api";
const API_URL = `${API_BASE_URL}/chat`;
const TRANSCRIBE_URL = `${API_BASE_URL}/transcribe`;
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
  image?: ChatImageInput,
): Promise<ChatResponse> => {
  const cleanMessage = message.trim().slice(0, MAX_MESSAGE);
  const cleanHistory = sanitizeHistory(history);
  const cleanImage =
    image && image.data.trim().length > 0
      ? {
          mimeType: image.mimeType,
          data: image.data.trim(),
        }
      : undefined;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: cleanMessage, history: cleanHistory, image: cleanImage }),
  });

  if (!response.ok) {
    throw new ChatApiError(response.status, "CHAT_REQUEST_FAILED");
  }

  return (await response.json()) as ChatResponse;
};

export const transcribeAudio = async (audio: AudioInput): Promise<TranscriptResponse> => {
  const response = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio }),
  });

  if (!response.ok) {
    throw new ChatApiError(response.status, "TRANSCRIBE_REQUEST_FAILED");
  }

  return (await response.json()) as TranscriptResponse;
};
