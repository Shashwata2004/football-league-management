"use client";

import { getAuthToken } from "./auth";
import {
  clearResponseCache,
  currentCacheGeneration,
  getPendingRequest,
  readCachedResponse,
  setPendingRequest,
  writeCachedResponse,
} from "./request-cache";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const authenticatedCacheTtlMs = 60_000;
const publicCacheTtlMs = 90_000;

export type ApiRequestInit = RequestInit & {
  cachePolicy?: "default" | "reload" | "no-store";
  cacheTtlMs?: number;
};

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

export async function api<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return request<T>({
    path,
    init,
    headers,
    cacheScope: `authenticated:${token ?? "anonymous"}`,
    defaultCacheTtlMs: authenticatedCacheTtlMs,
  });
}

export async function publicApi<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  return request<T>({
    path,
    init,
    headers: new Headers(init.headers),
    cacheScope: "public",
    defaultCacheTtlMs: publicCacheTtlMs,
  });
}

async function request<T>({
  path,
  init,
  headers,
  cacheScope,
  defaultCacheTtlMs,
}: {
  path: string;
  init: ApiRequestInit;
  headers: Headers;
  cacheScope: string;
  defaultCacheTtlMs: number;
}): Promise<T> {
  const {
    cachePolicy = "default",
    cacheTtlMs = defaultCacheTtlMs,
    ...fetchInit
  } = init;
  const method = (fetchInit.method ?? "GET").toUpperCase();
  const cacheable = method === "GET" && cachePolicy !== "no-store" && !fetchInit.signal;
  const cacheKey = `${cacheScope}:${path}`;

  if (cacheable && cachePolicy !== "reload") {
    const cached = readCachedResponse<T>(cacheKey);
    if (cached !== undefined) return cached;
    const pending = getPendingRequest<T>(cacheKey);
    if (pending) return pending;
  }

  const requestGeneration = currentCacheGeneration();
  const pendingRequest = performRequest<T>(path, {
    ...fetchInit,
    method,
    headers,
  }).then((payload) => {
    if (cacheable) {
      writeCachedResponse(
        cacheKey,
        payload,
        cacheTtlMs,
        requestGeneration,
      );
    } else if (method !== "GET") {
      // Any successful mutation may affect multiple dashboard endpoints.
      // Clearing the small in-memory cache favours correctness over trying to
      // maintain a fragile endpoint dependency graph.
      clearResponseCache();
    }
    return payload;
  });

  if (cacheable) setPendingRequest(cacheKey, pendingRequest);
  return pendingRequest;
}

async function performRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      cache: "no-store",
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

export { clearResponseCache as clearApiCache } from "./request-cache";
