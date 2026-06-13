import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
