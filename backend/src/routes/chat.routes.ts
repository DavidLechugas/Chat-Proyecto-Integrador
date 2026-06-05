import { Router } from "express";
import { z } from "zod";
import { resolveChat } from "../services/chat.service";
import { transcribeAudio } from "../services/transcribe.service";

const router = Router();

const imageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z
    .string()
    .min(32, "La imagen es demasiado corta")
    .max(15_000_000, "La imagen es demasiado grande"),
});

const audioSchema = z.object({
  mimeType: z.string().regex(/^audio\//, "El audio debe tener un tipo válido"),
  data: z
    .string()
    .min(32, "El audio es demasiado corto")
    .max(25_000_000, "El audio es demasiado grande"),
});

const chatSchema = z.object({
  message: z.string().trim().max(600, "El mensaje es demasiado largo").default(""),
  image: imageSchema.optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1200),
      }),
    )
    .max(20)
    .default([]),
}).refine((data) => data.message.length > 0 || Boolean(data.image), {
  message: "Debes enviar texto o una imagen",
  path: ["message"],
});

const transcribeSchema = z.object({
  audio: audioSchema,
});

router.post("/chat", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Solicitud invalida",
      details: parsed.error.issues.map((issue) => issue.message),
    });
  }

  try {
    const { message, history, image } = parsed.data;
    const result = await resolveChat(message, history, image);
    return res.json(result);
  } catch {
    return res.status(500).json({
      error: "Error procesando la solicitud",
    });
  }
});

router.post("/transcribe", async (req, res) => {
  const parsed = transcribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Solicitud invalida",
      details: parsed.error.issues.map((issue) => issue.message),
    });
  }

  try {
    const { audio } = parsed.data;
    const transcript = await transcribeAudio(audio);
    return res.json({ transcript });
  } catch {
    return res.status(500).json({
      error: "Error transcribiendo el audio",
    });
  }
});

export default router;
