// tokens.ts is a thin resolver over the W3C Design Tokens source files in ../tokens/*.json.
// Do not hand-edit values here — edit the JSON files and this module recomputes automatically.
// Format reference: https://design-tokens.github.io/community-group/format/

import primitivesJson from "../tokens/primitives.json";
import semanticLightJson from "../tokens/semantic.light.json";
import semanticDarkJson from "../tokens/semantic.dark.json";

type TokenNode = { $value: unknown; $type?: string; $description?: string } | { [key: string]: TokenNode };

function isTokenLeaf(node: unknown): node is { $value: unknown } {
  return typeof node === "object" && node !== null && "$value" in node;
}

// Strips $value/$type wrappers, returning plain nested values (e.g. { blue: { 500: "#3b82f6" } }).
function extractValues(node: TokenNode): unknown {
  if (isTokenLeaf(node)) return node.$value;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    out[key] = extractValues(value as TokenNode);
  }
  return out;
}

// Resolves a W3C alias reference like "{color.blue.600}" against the extracted primitives tree.
function resolveAlias(value: unknown, primitives: Record<string, unknown>): unknown {
  if (typeof value !== "string") return value;
  const match = value.match(/^\{(.+)\}$/);
  if (!match) return value;

  const path = match[1].split(".");
  let current: unknown = primitives;
  for (const segment of path) {
    if (typeof current !== "object" || current === null) {
      throw new Error(`Token alias "${value}" could not be resolved — no primitive at "${path.join(".")}"`);
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

// Walks a semantic token tree, resolving every leaf's alias against primitives.
function resolveSemantic(node: TokenNode, primitives: Record<string, unknown>): unknown {
  if (isTokenLeaf(node)) return resolveAlias(node.$value, primitives);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    out[key] = resolveSemantic(value as TokenNode, primitives);
  }
  return out;
}

const primitives = extractValues(primitivesJson as TokenNode) as {
  color: {
    purple: Record<string, string>;
    green: Record<string, string>;
    amber: Record<string, string>;
    red: Record<string, string>;
    categorical: Record<string, { light: string; dark: string }>;
  };
  spacing: Record<string, string>;
  radius: Record<string, string>;
  fontSize: Record<string, string>;
  fontWeight: Record<string, string>;
  fontFamily: Record<string, string[]>;
  breakpoints: Record<string, string>;
  lineHeight: Record<string, string>;
  zIndex: Record<string, string>;
};

type SemanticColors = {
  background: { DEFAULT: string; subtle: string; muted: string };
  text: { primary: string; secondary: string; disabled: string; inverse: string };
  border: { DEFAULT: string; strong: string };
  action: { primary: string; primaryHover: string; primaryText: string };
  feedback: {
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
    danger: string;
    dangerBg: string;
  };
};

const semanticLight = resolveSemantic(semanticLightJson as TokenNode, primitives) as SemanticColors;
const semanticDark = resolveSemantic(semanticDarkJson as TokenNode, primitives) as SemanticColors;

// ---- EXPORTED TOKEN SET ----
// Same shape as before the W3C migration — consumers (Tailwind preset, generate-theme.ts,
// ui-native) do not need to change.

export const tokens = {
  primitive: {
    colors: primitives.color,
    spacing: primitives.spacing,
    radius: primitives.radius,
    fontSize: primitives.fontSize,
    fontWeight: primitives.fontWeight,
    fontFamily: primitives.fontFamily,
    breakpoints: primitives.breakpoints,
    lineHeight: primitives.lineHeight,
    zIndex: primitives.zIndex,
  },
  semantic: {
    light: semanticLight,
    dark: semanticDark,
  },
};

export type Tokens = typeof tokens;
export type ThemeMode = "light" | "dark";
