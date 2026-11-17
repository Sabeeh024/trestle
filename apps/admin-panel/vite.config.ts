import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { headersFile, securityHeaders } from "./security-headers";

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL ?? "http://localhost:4000";

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "emit-security-headers",
        generateBundle() {
          this.emitFile({ type: "asset", fileName: "_headers", source: headersFile(apiUrl) });
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    preview: { headers: { ...securityHeaders(apiUrl) } },
  };
});
