import { env } from "../config/env";
import { Message } from "./types";
import { SYSTEM_PROMPT } from "./prompt";
import { fetchWithTimeout } from "./http";

export const askOpenRouter = async (
  userMessage: string,
  history: Message[],
): Promise<string> => {
  if (!env.openRouterApiKey) {
    throw new Error("OPENROUTER_KEY_MISSING");
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];

  const response = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.corsOrigins[0] ?? "http://localhost:5173",
        "X-Title": env.appName,
      },
      body: JSON.stringify({
        model: env.openRouterModel,
        messages,
        temperature: 0.4,
      }),
    },
    env.requestTimeoutMs,
  );

  if (!response.ok) {
    throw new Error(`OPENROUTER_REQUEST_FAILED_${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OPENROUTER_EMPTY_RESPONSE");
  }

  return text;
};
