/**
 * Test stub for the `server-only` package.
 *
 * `server-only` exists to make Next.js throw if a server-only module is imported
 * into a Client Component. Its default export throws when imported outside the
 * React Server condition — which is exactly what a plain Node/vitest run is. The
 * registry's `geminiClient.ts` does `import 'server-only'`, so loading the
 * generator registry under vitest would throw before any test runs.
 *
 * vitest.config.ts aliases `server-only` → this no-op so the intent-contract
 * regression test (PRD §6.5) can load the real registry off the production import
 * graph. This is test-wiring only; it does not change runtime behavior.
 */
export {};
