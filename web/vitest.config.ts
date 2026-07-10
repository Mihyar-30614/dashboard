import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@config": path.resolve(__dirname, "../config"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(__dirname, "../tests/setup/web-setup.ts")],
    globals: false,
    include: [path.resolve(__dirname, "../tests/web/**/*.{test,spec}.{ts,tsx}")],
  },
});
