/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

type VercelConfig = {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

/**
 * Las cabeceras de seguridad viven en vercel.json (las aplica Vercel en producción).
 * Para probarlas en local (`npm run preview` y los tests e2e), `vite preview` sirve las
 * mismas, salvo las que solo tienen sentido con HTTPS.
 */
function previewHeaders(): Record<string, string> {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as VercelConfig;
  const global = vercel.headers.find((h) => h.source === "/(.*)")?.headers ?? [];
  return Object.fromEntries(
    global
      .filter((h) => h.key !== "Strict-Transport-Security")
      .map((h) => [h.key, h.value.replace("; upgrade-insecure-requests", "")]),
  );
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      // Registro del service worker desde un fichero propio (sin script inline, por la CSP).
      injectRegister: null,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "House Hub",
        short_name: "House Hub",
        description: "Las casas de la familia: llegar, irse, calendario, gastos y avisos.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f5f6f8",
        theme_color: "#1d4ed8",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  preview: { headers: previewHeaders() },
  build: { target: "es2022", sourcemap: false },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    testTimeout: 15000,
    // Los tests nunca usan el Supabase real aunque exista .env.local.
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  },
});
