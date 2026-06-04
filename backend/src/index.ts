import cors from "cors";
import express from "express";
import { env } from "./config/env";
import chatRoutes from "./routes/chat.routes";

const app = express();

app.use(
  cors({
    origin: env.corsOrigins,
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: env.appName });
});

app.use("/api", chatRoutes);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`${env.appName} backend running on port ${env.port}`);
});
