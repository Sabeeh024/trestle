"use client";

import { useEffect, useState } from "react";
import { useT } from "next-i18next/client";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { applyTheme, readThemeChoice, saveThemeChoice, type ThemeChoice } from "@/lib/theme";

const options = [
  { value: "system", icon: MonitorIcon },
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
] as const;

export function ThemeSwitcher() {
  const { t } = useT("app");
  const [choice, setChoice] = useState<ThemeChoice>("system");

  // The saved choice lives in a cookie that the head script reads before first paint, so it is read here
  // after mount rather than during render, which keeps the server and client markup identical.
  useEffect(() => setChoice(readThemeChoice()), []);

  // While on "system", follow the operating system if it changes.
  useEffect(() => {
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  function select(next: ThemeChoice) {
    setChoice(next);
    saveThemeChoice(next);
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.appearance.title")}
      className="inline-flex gap-1 self-start rounded-md bg-muted p-1"
    >
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => select(value)}
          className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm ${
            choice === value
              ? "bg-background font-semibold text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Icon className="size-4" />
          {t(`settings.appearance.${value}`)}
        </button>
      ))}
    </div>
  );
}
