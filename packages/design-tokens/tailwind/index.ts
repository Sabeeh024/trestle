import type { Config } from "tailwindcss";
import { tokens } from "./tokens";

export const tailwindPreset: Partial<Config> = {
  darkMode: "class",
  theme: {
    screens: tokens.primitive.breakpoints,
    extend: {
      colors: {
        // raw primitives still available directly if ever needed (e.g. one-offs)
        ...tokens.primitive.colors,

        // semantic tokens — full color values held in CSS variables (see theme.css),
        // so they respond to light/dark mode at runtime without a rebuild.
        background: {
          DEFAULT: "var(--background)",
          subtle: "var(--background-subtle)",
          muted: "var(--background-muted)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          disabled: "var(--text-disabled)",
          inverse: "var(--text-inverse)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        action: {
          primary: "var(--action-primary)",
          primaryHover: "var(--action-primary-hover)",
          primaryText: "var(--action-primary-text)",
        },
        feedback: {
          success: "var(--feedback-success)",
          successBg: "var(--feedback-success-bg)",
          warning: "var(--feedback-warning)",
          warningBg: "var(--feedback-warning-bg)",
          danger: "var(--feedback-danger)",
          dangerBg: "var(--feedback-danger-bg)",
        },
      },
      spacing: tokens.primitive.spacing,
      borderRadius: tokens.primitive.radius,
      fontSize: tokens.primitive.fontSize,
      fontWeight: tokens.primitive.fontWeight,
      fontFamily: tokens.primitive.fontFamily,
      lineHeight: tokens.primitive.lineHeight,
      zIndex: tokens.primitive.zIndex,
    },
  },
};

export default tailwindPreset;
