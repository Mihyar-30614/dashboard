import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// iOS 27's Add to Home Screen sheet loads the touch icon with its own loader, which
// shows a letter tile for a network URL even when the PNG returns 200. A data: URI loads.
function inlineTouchIcon(): Plugin {
  return {
    name: "dashboard-inline-touch-icon",
    transformIndexHtml(html) {
      const png = readFileSync(path.resolve(__dirname, "public/apple-touch-icon.png"));
      return html.replace("__APPLE_TOUCH_ICON__", `data:image/png;base64,${png.toString("base64")}`);
    },
  };
}

// Light-theme --bg token from src/theme.css.
const BG = "#f4f1ea";

export default defineConfig({
  plugins: [
    react(),
    inlineTouchIcon(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      // globPatterns below already picks the icons up from public/.
      includeManifestIcons: false,
      manifest: {
        id: "/",
        name: "Observatory · Apps Dashboard",
        short_name: "Observatory",
        description: "Self-hosted operations dashboard for app health, traffic, and KPIs.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: BG,
        background_color: BG,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        // Precache the app shell only. /api/* is live, authenticated data: never cached,
        // and never answered with the shell.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@config": path.resolve(__dirname, "../config"),
    },
  },
  server: {
    port: 4210,
    proxy: { "/api": "http://localhost:4110" },
  },
  build: { outDir: "dist" },
});
