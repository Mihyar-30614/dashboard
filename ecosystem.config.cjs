module.exports = {
  apps: [{
    name: 'dashboard',
    script: 'server/index.js',
    cwd: __dirname,
    env: { NODE_ENV: 'production', PORT: 4010 },
    max_memory_restart: '300M',
    log_file: 'logs/dashboard.log',
    time: true
  }]
};
