import type { NextFunction, Request, Response } from "express";
import { UserRole } from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError } from "../errors.js";
import { verifyAppToken } from "../utils/app-auth.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    return next(new AppError(401, "Missing bearer token"));
  }

  const payload = verifyAppToken(token);
  if (!payload) {
    return next(new AppError(401, "Invalid or expired session"));
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,role")
    .eq("id", payload.sub)
    .maybeSingle();

  if (profileError) return next(profileError);
  if (!profile) return next(new AppError(401, "Session profile no longer exists"));

  req.auth = { userId: profile.id, profileId: profile.id, email: profile.email, role: profile.role };
  return next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AppError(401, "Authentication required"));
    if (!roles.includes(req.auth.role)) {
      return next(new AppError(403, "Insufficient permissions"));
    }
    return next();
  };
}
