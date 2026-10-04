import { useSyncExternalStore } from "react";

// The signed-in user's token. It is kept in localStorage so a refresh or a second tab stays signed in,
// which means page scripts can read it; that is the usual trade-off for a single-page app, and the
// reason the web app, which has a server, keeps its token in an httpOnly cookie instead.
const KEY = "trestle-admin-token";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
  notify();
}

export function clearToken() {
  localStorage.removeItem(KEY);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current token, re-rendering when it changes here or in another tab. */
export function useToken() {
  return useSyncExternalStore(subscribe, getToken, () => null);
}
