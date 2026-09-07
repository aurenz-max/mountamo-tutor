/**
 * service/insets — the ONE shared inset module (KC redesign P0, 2026-09-05).
 * Schema + author guidance, plain-text serialization for blind LLM callers,
 * per-type answer-leak rules, and the code-owned builders for the K-first
 * stimulus insets. Renderers live in
 * `primitives/problem-primitives/insets/` (routed by `InsetRenderer`).
 */
export {
  type AuthorableInsetType,
  isAuthorableInsetType,
  getInsetGeminiSchema,
  getInsetSchema,
  buildInsetPromptGuidance,
  buildInsetPrompt,
} from './insetSchema';
export {
  serializeInsetForPrompt,
  spokenNumberSentence,
  spokenArrangement,
  spokenGlyphCard,
} from './serialize';
export { findInsetAnswerLeaks, type InsetLeakContext } from './leaks';
export {
  buildNumberSentence,
  buildArrangement,
  buildGlyphCard,
  tokenIdForSymbol,
  resultOf,
  remainingOf,
  shapeOutlinePoints,
  MINUS, PLUS, EQUALS, BLANK,
  type Operator,
  type NumberSentenceSpec,
  type ArrangementSpec,
  type GlyphCardSpec,
} from './build';
