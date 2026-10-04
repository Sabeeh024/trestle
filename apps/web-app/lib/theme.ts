export const THEME_COOKIE = "theme";

export type ThemeChoice = "system" | "light" | "dark";

// Runs in <head> before the first paint, so a dark-mode visitor never sees a light flash. It mirrors
// applyTheme below: an explicit choice wins, otherwise the operating system's preference.
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var d=m?m[1]==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export function readThemeChoice(): ThemeChoice {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`));
  return match ? (match[1] as ThemeChoice) : "system";
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<() => void>();

// The cookie is the source of truth; this lets React subscribe to it (see useThemeChoice).
export function subscribeToTheme(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function saveThemeChoice(choice: ThemeChoice) {
  document.cookie =
    choice === "system"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((listener) => listener());
}
