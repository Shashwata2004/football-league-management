import { Router } from "express";
import { z } from "zod";
import { RoleRequestStatus, UserRole } from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError, asyncHandler } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPassword, signAppToken, verifyPassword } from "../utils/app-auth.js";

export const authRouter = Router();

const signupSchema = z.object({
  full_name: z.string().trim().max(160).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value.includes("@") && value.endsWith(".com"), {
      message: "Use a demo email containing @ and ending with .com"
    }),
  password: z.string().min(4, "Password must be at least 4 characters")
});

const authModeSchema = z.enum(["admin", "manager", "fan", "user"]);

function authTarget(mode: z.infer<typeof authModeSchema>) {
  if (mode === "admin") return { table: "app_admins", role: UserRole.ADMIN, label: "admin" };
  if (mode === "manager") return { table: "app_managers", role: UserRole.MANAGER, label: "manager" };
  return { table: "app_users", role: UserRole.USER, label: "fan" };
}

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.extend({ mode: authModeSchema }).parse(req.body);
    if (input.mode === "admin") {
      throw new AppError(403, "Admin signup is disabled. Use the fixed seeded admin account.");
    }
    const { table, role, label } = authTarget(input.mode);
    const { data: existing, error: existingError } = await supabaseAdmin.from(table).select("id").eq("email", input.email).maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new AppError(409, `${label} account already exists`);

    const { data: account, error } = await supabaseAdmin
      .from(table)
      .insert({
        email: input.email,
        password_hash: hashPassword(input.password),
        full_name: input.full_name?.trim() || input.email.split("@")[0]
      })
      .select("id,email,full_name")
      .single();
    if (error) throw error;

    await ensureProfile(account.id, account.email, role, account.full_name);
    const token = signAppToken({ sub: account.id, email: account.email, role });
    res.status(201).json({ token, profile: { id: account.id, email: account.email, full_name: account.full_name, role } });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = signupSchema.extend({ mode: authModeSchema }).parse(req.body);
    const { table, role } = authTarget(input.mode);
    const { data: account, error } = await supabaseAdmin
      .from(table)
      .select("id,email,full_name,password_hash")
      .eq("email", input.email)
      .maybeSingle();
    if (error) throw error;
    if (!account || !verifyPassword(input.password, account.password_hash)) {
      throw new AppError(401, "Invalid email or password");
    }
    await ensureProfile(account.id, account.email, role, account.full_name);
    const token = signAppToken({ sub: account.id, email: account.email, role });
    res.json({ token, profile: { id: account.id, email: account.email, full_name: account.full_name, role } });
  })
);

authRouter.post(
  "/demo-signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const { data: existing } = await supabaseAdmin.from("app_users").select("id,email,full_name").eq("email", input.email).maybeSingle();
    if (existing) {
      const token = signAppToken({ sub: existing.id, email: existing.email, role: UserRole.USER });
      return res.json({ token, profile: { ...existing, role: UserRole.USER }, existed: true });
    }
    const { data: account, error } = await supabaseAdmin
      .from("app_users")
      .insert({
      email: input.email,
        password_hash: hashPassword(input.password),
        full_name: input.email.split("@")[0]
      })
      .select("id,email,full_name")
      .single();
    if (error) throw error;
    await ensureProfile(account.id, account.email, UserRole.USER, account.full_name);
    const token = signAppToken({ sub: account.id, email: account.email, role: UserRole.USER });
    res.status(201).json({ token, profile: { ...account, role: UserRole.USER }, existed: false });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", req.auth!.userId)
      .single();
    res.json({ profile: data });
  })
);

async function ensureProfile(userId: string, email: string, role: UserRole, fullName?: string | null) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, email, full_name: fullName ?? null, role }, { onConflict: "id" });
  if (error) throw error;
}

authRouter.post(
  "/role-requests/manager",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("role_requests")
      .insert({
        user_id: req.auth!.userId,
        requested_role: "MANAGER",
        status: RoleRequestStatus.PENDING,
        reason: req.body?.reason ?? null
      })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json({ role_request: data });
  })
);
