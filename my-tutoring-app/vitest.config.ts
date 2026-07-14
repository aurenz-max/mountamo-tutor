import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * vitest config for the intent-contract regression suite (PRD §6.5) and future
 * unit tests of the generation pipeline. These are pure-module tests — no DOM.
 */
export default defineConfig({
  // React plugin transforms JSX/TSX for component behavioral tests (.test.tsx).
  // (rolldown-vite's SSR path can't parse raw JSX, and the esbuild option is ignored
  // under rolldown, so a plugin is required.) Pure-module .test.ts files contain no
  // JSX, so it's a no-op for them.
  plugins: [react()],
  test: {
    environment: 'node',
    // .ts = pure-module tests (node env, the default). .tsx = component behavioral
    // tests, which opt into jsdom per-file via a `// @vitest-environment jsdom` header.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      // Mirror the Next.js `@/*` → `./src/*` path alias so component tests can
      // resolve UI-kit and lib imports.
      '@': path.resolve(__dirname, './src'),
      // Neutralize the `server-only` import guard so the generator registry can be
      // loaded off the production import graph under Node. See the stub for why.
      'server-only': path.resolve(__dirname, './vitest.stubs/server-only.ts'),
    },
  },
});
