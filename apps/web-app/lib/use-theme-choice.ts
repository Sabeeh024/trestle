"use client";

import { useSyncExternalStore } from "react";

import { readThemeChoice, subscribeToTheme, type ThemeChoice } from "@/lib/theme";

// Server markup always renders "system"; on the client the saved cookie takes over after hydration.
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribeToTheme, readThemeChoice, () => "system");
}
