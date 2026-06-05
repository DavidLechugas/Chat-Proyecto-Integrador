import cors from "cors";
import express from "express";
import { env } from "./config/env";
import chatRoutes from "./routes/chat.routes";

const app = express();

const isLocalOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.corsOrigins.includes(origin) || isLocalOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
  }),
);
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: env.appName });
});

app.use("/api", chatRoutes);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`${env.appName} backend running on port ${env.port}`);
});
