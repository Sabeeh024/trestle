import type { Config } from "tailwindcss";
import { tailwindPreset } from "@trestle/design-tokens/tailwind";

const config: Config = {
  presets: [tailwindPreset],
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
