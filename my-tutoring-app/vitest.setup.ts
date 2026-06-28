/**
 * vitest global setup — runs before any test module is imported.
 *
 * The generator registry transitively imports `geminiClient.ts`, which throws at
 * import time if `GEMINI_API_KEY` is unset. The intent-contract ledger test
 * (PRD §6.5) must load that registry to observe which generators are
 * context-native, but it never makes a Gemini call. Provide a dummy key so the
 * client constructs without network/env coupling. A real key in the environment
 * is left untouched.
 *
 * (The `server-only` import is neutralized separately via a resolve alias in
 * vitest.config.ts — see vitest.stubs/server-only.ts.)
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-vitest';
