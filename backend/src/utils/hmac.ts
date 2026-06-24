import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function hashIdentityNumber(raw: string) {
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  return createHmac("sha256", env.IDENTITY_HMAC_SECRET).update(normalized).digest("hex");
}

export function identityLast4(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-4);
}

export function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
