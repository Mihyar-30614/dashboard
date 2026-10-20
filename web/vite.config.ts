import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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

export default defineConfig({
  plugins: [react(), inlineTouchIcon()],
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
