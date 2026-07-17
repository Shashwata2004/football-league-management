import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./errors.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { fanRouter } from "./routes/fan.js";
import { managerRouter } from "./routes/manager.js";
import { publicRouter } from "./routes/public.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = new Set([
        env.FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000"
      ]);
      if (allowed.has(origin)) return callback(null, true);
      try {
        const url = new URL(origin);
        const isLocalDevHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
        const isDevPort = Number(url.port) >= 3000 && Number(url.port) <= 3010;
        if (isLocalDevHost && isDevPort) return callback(null, true);
      } catch {
        return callback(null, false);
      }
      return callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(authRouter);
app.use("/public", publicRouter);
app.use("/fan", fanRouter);
app.use("/manager", managerRouter);
app.use("/admin", adminRouter);
app.use(errorHandler);

export default app;
