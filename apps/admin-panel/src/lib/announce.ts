import { useSyncExternalStore } from "react";

// Tells screen-reader users what just happened when the page changes without moving focus: "Alex Kim deleted",
// "3 users suspended". Sighted users see the row disappear; without this, nothing says so to anyone else.

let state = { message: "" };
const listeners = new Set<() => void>();

function set(message: string) {
  state = { message };
  listeners.forEach((listener) => listener());
}

/** Announces `message` politely. Safe to call from anywhere (event handlers, mutation callbacks). */
export function announce(message: string) {
  // A live region only speaks when its text *changes*, so clear it first; that also lets the same message repeat.
  set("");
  setTimeout(() => set(message), 60);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The current announcement, for the <Announcer /> component. */
export function useAnnouncement() {
  return useSyncExternalStore(subscribe, () => state, () => state).message;
}

/** Moves focus to the page heading. Used after something the person was focused on is gone (a deleted row). */
export function focusPageTitle() {
  // After the next paint, so it runs after React has removed what was deleted (and after the side panel has
  // handed focus back), which would otherwise undo it.
  requestAnimationFrame(() => document.getElementById("page-title")?.focus({ preventScroll: true }));
}
