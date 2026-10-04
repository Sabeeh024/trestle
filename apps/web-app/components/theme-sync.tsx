"use client";

import { useEffect } from "react";

import { applyTheme, readThemeChoice } from "@/lib/theme";

// The head script only runs on a full page load. Switching language changes the [lng] segment, which
// mounts a new root layout and a fresh <html> without the "dark" class, so re-apply the saved choice.
export function ThemeSync() {
  useEffect(() => applyTheme(readThemeChoice()), []);
  return null;
}
