"use client";

const ACCESS_TOKEN_KEY = "tokenmind.access_token";
const REFRESH_TOKEN_KEY = "tokenmind.refresh_token";

export interface StoredSession {
  accessToken: string | null;
  refreshToken: string | null;
}

export function readStoredSession(): StoredSession {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }

  return {
    accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function writeStoredSession(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
