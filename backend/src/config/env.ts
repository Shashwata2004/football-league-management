import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  IDENTITY_HMAC_SECRET: z.string().min(32),
  APP_JWT_SECRET: z.string().min(32).optional(),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export const env = envSchema.parse(process.env);

export const appJwtSecret = env.APP_JWT_SECRET ?? env.IDENTITY_HMAC_SECRET;
