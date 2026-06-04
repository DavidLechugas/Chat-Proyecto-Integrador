import { Router } from "express";
import { z } from "zod";
import { resolveChat } from "../services/chat.service";

const router = Router();

const chatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacio")
    .max(600, "El mensaje es demasiado largo"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1200),
      }),
    )
    .max(20)
    .default([]),
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
    const { message, history } = parsed.data;
    const result = await resolveChat(message, history);
    return res.json(result);
  } catch {
    return res.status(500).json({
      error: "Error procesando la solicitud",
    });
  }
});

export default router;
