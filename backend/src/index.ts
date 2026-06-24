import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./errors.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { managerRouter } from "./routes/manager.js";
import { publicRouter } from "./routes/public.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(authRouter);
app.use("/public", publicRouter);
app.use("/manager", managerRouter);
app.use("/admin", adminRouter);
app.use(errorHandler);

app.listen(env.BACKEND_PORT, () => {
  console.log(`Backend listening on http://localhost:${env.BACKEND_PORT}`);
});
