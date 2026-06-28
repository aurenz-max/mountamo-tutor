import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * vitest config for the intent-contract regression suite (PRD §6.5) and future
 * unit tests of the generation pipeline. These are pure-module tests — no DOM.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      // Neutralize the `server-only` import guard so the generator registry can be
      // loaded off the production import graph under Node. See the stub for why.
      'server-only': path.resolve(__dirname, './vitest.stubs/server-only.ts'),
    },
  },
});
