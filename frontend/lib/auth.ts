"use client";

import type { ProfileDto } from "@flms/shared";
import { clearResponseCache } from "./request-cache";

const tokenKey = "flms_token";
const profileKey = "flms_profile";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenKey);
}

export function saveAuth(token: string, profile: ProfileDto) {
  clearResponseCache();
  window.localStorage.setItem(tokenKey, token);
  window.localStorage.setItem(profileKey, JSON.stringify(profile));
}

export function clearAuth() {
  clearResponseCache();
  window.localStorage.removeItem(tokenKey);
  window.localStorage.removeItem(profileKey);
}

export function getStoredProfile(): ProfileDto | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(profileKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProfileDto;
  } catch {
    return null;
  }
}
