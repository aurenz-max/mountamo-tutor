/**
 * Inset Helpers — re-export shim. The implementation moved to the shared
 * `service/insets/` module (KC redesign P0, 2026-09-05; item 17 P1 debt). The
 * annotated-example pipeline keeps importing from here; new code should
 * import from `../insets` directly.
 */
export {
  type AuthorableInsetType,
  isAuthorableInsetType,
  getInsetGeminiSchema,
  buildInsetPromptGuidance,
  serializeInsetForPrompt,
} from '../insets';
