const path = require("path");
const root = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: "dashboard",
      script: "./server/index.js",
      cwd: root,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 4010,
      },
      env_production: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 4010,
        APP_ORIGIN: "https://dashboard.mihyarmas.com",
      },
      error_file: path.join(root, "logs", "pm2-error.log"),
      out_file: path.join(root, "logs", "pm2-out.log"),
      log_file: path.join(root, "logs", "pm2-combined.log"),
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,
    },
  ],
};
