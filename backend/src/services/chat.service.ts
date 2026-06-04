import { askGemini } from "./gemini.service";
import { findLocalAnswer } from "./localKnowledge.service";
import { askOpenRouter } from "./openrouter.service";
import { env } from "../config/env";
import { ChatResult, Message } from "./types";

const LOCAL_FALLBACK =
  "No pude consultar IA en este momento. Puedo orientarte si me dices la pieza o el sintoma principal, por ejemplo: bujia, bateria, frenos o moto que no enciende.";

const logProviderFailure = (provider: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`[MecaBot] ${provider} failed: ${message}`);
};

const askGeminiWithFallback = async (userMessage: string, history: Message[]) => {
  try {
    return await askGemini(userMessage, history);
  } catch (error) {
    if (env.geminiFallbackModel === env.geminiModel) {
      throw error;
    }
    return askGemini(userMessage, history, env.geminiFallbackModel);
  }
};

const providerOrder = (): Array<"gemini" | "openrouter"> => {
  if (env.aiProvider === "gemini") {
    return ["gemini", "openrouter"];
  }

  if (env.aiProvider === "openrouter") {
    return ["openrouter", "gemini"];
  }

  return [];
};

export const resolveChat = async (
  userMessage: string,
  history: Message[],
): Promise<ChatResult> => {
  const local = findLocalAnswer(userMessage, history);
  if (local) {
    return { reply: local, source: "local" };
  }

  for (const provider of providerOrder()) {
    try {
      if (provider === "gemini") {
        const geminiReply = await askGeminiWithFallback(userMessage, history);
        return { reply: geminiReply, source: "gemini" };
      }

      const openRouterReply = await askOpenRouter(userMessage, history);
      return { reply: openRouterReply, source: "openrouter" };
    } catch (error) {
      logProviderFailure(provider, error);
    }
  }

  return { reply: LOCAL_FALLBACK, source: "local" };
};
