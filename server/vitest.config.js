import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    setupFiles: ['./test/helpers.js'],
    pool: 'forks',
    testTimeout: 10000
  }
});
