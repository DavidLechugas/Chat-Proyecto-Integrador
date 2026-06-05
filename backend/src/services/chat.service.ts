import { askGemini } from "./gemini.service";
import { findLocalAnswer } from "./localKnowledge.service";
import { askOpenRouter } from "./openrouter.service";
import { env } from "../config/env";
import { ChatResult, ImageInput, Message } from "./types";

const LOCAL_FALLBACK =
  "No pude consultar IA en este momento. Puedo orientarte si me dices la pieza o el sintoma principal, por ejemplo: bujia, bateria, frenos o moto que no enciende.";

const logProviderFailure = (provider: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`[Juan Mecánico AI] ${provider} failed: ${message}`);
};

const askGeminiWithFallback = async (
  userMessage: string,
  history: Message[],
  image?: ImageInput,
) => {
  try {
    return await askGemini(userMessage, history, env.geminiModel, image);
  } catch (error) {
    if (env.geminiFallbackModel === env.geminiModel) {
      throw error;
    }
    return askGemini(userMessage, history, env.geminiFallbackModel, image);
  }
};

const providerOrder = (hasImage: boolean): Array<"gemini" | "openrouter"> => {
  if (hasImage) {
    return ["gemini"];
  }

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
  image?: ImageInput,
): Promise<ChatResult> => {
  if (!image) {
    const local = findLocalAnswer(userMessage, history);
    if (local) {
      return { reply: local, source: "local" };
    }
  }

  const effectiveMessage =
    userMessage.trim().length > 0
      ? userMessage
      : "Analiza la imagen adjunta y describe lo que ves.";

  for (const provider of providerOrder(Boolean(image))) {
    try {
      if (provider === "gemini") {
        const geminiReply = await askGeminiWithFallback(effectiveMessage, history, image);
        return { reply: geminiReply, source: "gemini" };
      }

      const openRouterReply = await askOpenRouter(effectiveMessage, history);
      return { reply: openRouterReply, source: "openrouter" };
    } catch (error) {
      logProviderFailure(provider, error);
    }
  }

  return {
    reply: image
      ? "Recibí la imagen, pero no pude analizarla ahora. Prueba con Gemini activo o vuelve a intentarlo con una foto más clara."
      : LOCAL_FALLBACK,
    source: "local",
  };
};
