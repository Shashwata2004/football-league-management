"use client";

import { getAuthToken } from "./auth";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function unreachableBackendMessage() {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiBaseUrl)) {
    return `Backend is not reachable at ${apiBaseUrl}. Start the complete workspace from the repository root with pnpm dev.`;
  }
  return "The application service is temporarily unavailable. Please try again shortly.";
}

function errorMessage(payload: { error?: string; details?: unknown }, status: number) {
  if (
    payload.details &&
    typeof payload.details === "object" &&
    "fieldErrors" in payload.details &&
    payload.details.fieldErrors &&
    typeof payload.details.fieldErrors === "object"
  ) {
    const messages = Object.entries(payload.details.fieldErrors)
      .flatMap(([field, errors]) => (Array.isArray(errors) ? errors.map((error) => `${field}: ${error}`) : []))
      .join("; ");
    if (messages) return messages;
  }
  return payload.error ?? `Request failed: ${status}`;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store"
    });
  } catch {
    throw new Error(unreachableBackendMessage());
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload, response.status));
  }
  return payload as T;
}

export async function publicApi<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  } catch {
    throw new Error(unreachableBackendMessage());
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(payload, response.status));
  return payload as T;
}
