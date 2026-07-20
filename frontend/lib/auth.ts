"use client";

import type { ProfileDto } from "@flms/shared";
import { clearResponseCache } from "./request-cache";

const tokenKey = "flms_token";
const profileKey = "flms_profile";

// Auth is stored in sessionStorage (not localStorage) so each browser tab keeps
// its own independent session. This lets a user run an admin panel in one tab
// and a manager panel in another without the two logins overwriting each
// other's token. The tradeoff: a brand-new tab (or a reopened tab) does not
// inherit an existing session and must log in again.
function authStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function getAuthToken() {
  return authStore()?.getItem(tokenKey) ?? null;
}

export function saveAuth(token: string, profile: ProfileDto) {
  clearResponseCache();
  const store = authStore();
  if (!store) return;
  store.setItem(tokenKey, token);
  store.setItem(profileKey, JSON.stringify(profile));
}

export function clearAuth() {
  clearResponseCache();
  const store = authStore();
  if (!store) return;
  store.removeItem(tokenKey);
  store.removeItem(profileKey);
}

export function getStoredProfile(): ProfileDto | null {
  const raw = authStore()?.getItem(profileKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProfileDto;
  } catch {
    return null;
  }
}

// Update the cached profile in place (e.g. after the user edits their name) so
// the header/avatar reflect the change without forcing a re-login.
export function updateStoredProfile(profile: ProfileDto) {
  authStore()?.setItem(profileKey, JSON.stringify(profile));
}
