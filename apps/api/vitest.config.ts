/**
 * TEST SETTINGS: tests run one file at a time against an in-memory MongoDB (tests/global-setup.ts),
 * with safe fake settings (tests/setup-env.ts). Run: npm test -w @bluenova/api. Guide: docs/TESTING.md.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup-env.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
