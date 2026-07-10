import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: [path.resolve(__dirname, '../tests/server/**/*.test.js')],
    setupFiles: [path.resolve(__dirname, '../tests/setup/server-helpers.js')],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 10000,
  },
});
