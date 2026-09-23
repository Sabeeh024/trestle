import type { Config } from "tailwindcss";
import { tokens } from "./tokens";

export const tailwindPreset: Partial<Config> = {
  darkMode: "class",
  theme: {
    screens: tokens.primitive.breakpoints,
    extend: {
      colors: {
        // raw primitives still available directly if ever needed (e.g. charts, one-offs)
        ...tokens.primitive.colors,

        // semantic tokens — these resolve via CSS variables, so they respond to
        // light/dark mode at runtime without a rebuild. Values for the variables
        // themselves are defined in globals.css (set up when we wire up apps/web-app).
        background: {
          DEFAULT: "hsl(var(--background))",
          subtle: "hsl(var(--background-subtle))",
          muted: "hsl(var(--background-muted))",
        },
        text: {
          primary: "hsl(var(--text-primary))",
          secondary: "hsl(var(--text-secondary))",
          disabled: "hsl(var(--text-disabled))",
          inverse: "hsl(var(--text-inverse))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          strong: "hsl(var(--border-strong))",
        },
        action: {
          primary: "hsl(var(--action-primary))",
          primaryHover: "hsl(var(--action-primary-hover))",
          primaryText: "hsl(var(--action-primary-text))",
        },
        feedback: {
          success: "hsl(var(--feedback-success))",
          successBg: "hsl(var(--feedback-success-bg))",
          warning: "hsl(var(--feedback-warning))",
          warningBg: "hsl(var(--feedback-warning-bg))",
          danger: "hsl(var(--feedback-danger))",
          dangerBg: "hsl(var(--feedback-danger-bg))",
        },
      },
      spacing: tokens.primitive.spacing,
      borderRadius: tokens.primitive.radius,
      fontSize: tokens.primitive.fontSize,
      fontWeight: tokens.primitive.fontWeight,
      fontFamily: tokens.primitive.fontFamily,
      lineHeight: tokens.primitive.lineHeight,
      boxShadow: tokens.primitive.shadow,
      zIndex: tokens.primitive.zIndex,
    },
  },
};

export default tailwindPreset;