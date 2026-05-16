import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:5174", headless: true },
  webServer: [
    {
      command:
        "cd .. && NODE_ENV=test DB_NAME=dashboard_test POLLER=off npm run dev -w server",
      port: 4110,
      reuseExistingServer: true,
    },
    { command: "npm run dev", port: 5174, reuseExistingServer: true },
  ],
});
