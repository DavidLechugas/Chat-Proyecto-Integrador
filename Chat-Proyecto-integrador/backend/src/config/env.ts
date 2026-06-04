import dotenv from "dotenv";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value: string | undefined, fallback: string[]): string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

const normalizeProvider = (value: string | undefined): "local" | "gemini" | "openrouter" => {
  if (value === "local" || value === "openrouter") {
    return value;
  }

  return "gemini";
};

export const env = {
  port: toNumber(process.env.PORT, 3000),
  appName: process.env.APP_NAME ?? "MecaBot",
  aiProvider: normalizeProvider(process.env.AI_PROVIDER),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  geminiFallbackModel:
    process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash-lite",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterModel: process.env.OPENROUTER_MODEL ?? "openrouter/free",
  requestTimeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 12000),
  corsOrigins: parseList(process.env.CORS_ORIGIN, [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
  ]),
};
