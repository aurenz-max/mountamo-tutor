# Eval Report: vocabulary-explorer — 2026-07-06

Focused review of the intermittent **"Unterminated string in JSON"** crash the user
saw in the app. All three eval modes were also swept.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| explore   | PASS   | — (VE-5 FIXED 2026-07-07) |
| recall    | PASS   | — (VE-5 FIXED 2026-07-07) |
| apply     | PASS   | — (VE-5 FIXED 2026-07-07) |

Live runs (Ocean ecosystems / grade 4; Photosynthesis / grade 8): all three modes
generated, keyed correctly, honored their challenge-type constraints. The crash the
user reported is **intermittent** — it did not reproduce on these runs because it
only fires when flash-lite truncates its own output. The mechanism is confirmed by
code read, not by a repro this session.

## Issues

### all modes — VE-5: intermittent "Unterminated string in JSON" (truncated response, SP-6 family)
- **Severity:** CRITICAL (when it fires the generation throws and the primitive renders nothing) — but **intermittent / low frequency**.
- **What's broken:** [gemini-vocabulary-explorer.ts:558](../../src/components/lumina/service/core/gemini-vocabulary-explorer.ts#L558) does a single unguarded `const raw = JSON.parse(response.text)`. There is **no `maxOutputTokens` cap** and **no truncation detection**. When flash-lite runs long and hits its output-token ceiling (`finishReason: MAX_TOKENS`), `response.text` is a valid string but incomplete JSON — cut mid-string — so `JSON.parse` throws `SyntaxError: Unterminated string in JSON at position N`. The `catch` at :570 just re-throws, so the raw parser error surfaces to the app. This is the exact SP-6 signature already logged for **NT-1** (number-tracer) and **LSP-1** (letter-spotter, ~383 KB runaway → unterminated JSON).
- **Why this generator is prone to it:** the schema asks for **5–8 terms**, each with `word` + `pronunciation` + `partOfSpeech` + `definition` + `exampleSentence` + 3× `relatedWord` + `wordOrigin` + `imagePrompt`, **plus** 3–4 challenges with explanations. That is a large payload with no ceiling. It usually fits; on a verbose generation it doesn't, and truncates.
- **Aggravating dead-weight field:** `imagePrompt` is in the schema ([:116](../../src/components/lumina/service/core/gemini-vocabulary-explorer.ts#L116)) and requested in the prompt ([:517](../../src/components/lumina/service/core/gemini-vocabulary-explorer.ts#L517)), but the component **never renders it** — only the type is declared at [VocabularyExplorer.tsx:44](../../src/components/lumina/primitives/visual-primitives/core/VocabularyExplorer.tsx#L44), no render usage. Flash-lite spends output tokens authoring an image-generation prompt the student never sees. This is precisely the NT-1 `strokePaths` anti-pattern (dead field inflating truncation risk).
- **Known-and-deferred:** the VE-3 fix note (2026-06-25, EVAL_TRACKER line 413) explicitly says *"Truncated-JSON (SP-6) deferred."* — so this gap was documented and left open. The user just hit it.
- **Data:** intermittent; no captured payload this session. Signature: `SyntaxError: Unterminated string in JSON at position <N>` originating at `JSON.parse` (:558), with the underlying candidate `finishReason: MAX_TOKENS`.
- **Fix in:** GENERATOR

## Recommended fix (not applied — review only)

Three levers, cheapest first — the first two are near-free:

1. **Delete `imagePrompt`** from the schema (:116), the prompt (:517), and the type
   at VocabularyExplorer.tsx:44. It is never rendered; removing it is pure token
   savings with zero pedagogical loss. (NT-1 precedent: delete the dead field.)
2. **Add a `maxOutputTokens` cap** to the `generateContent` config (:550) sized to a
   full 8-term payload, so a runaway can't silently balloon.
3. **Make the parse truncation-aware + retry**, mirroring number-tracer
   ([gemini-number-tracer.ts:327-336](../../src/components/lumina/service/math/gemini-number-tracer.ts#L327-L336)):
   on `JSON.parse` failure, log `response.candidates?.[0]?.finishReason` and the text
   length, then retry once instead of throwing on the first cut. This generator is
   single-attempt today; number-tracer already loops `MAX_ATTEMPTS`.

Route through `/eval-fix` if you want it implemented.

## VE-5 FIXED — 2026-07-07 (`/eval-fix`)

All three levers applied, GENERATOR-side (`gemini-vocabulary-explorer.ts`) + one component type-only edit:

1. **Bounded the schema (root cause of the runaway).** Added `minItems`/`maxItems` to
   the `terms` (5–8) and `challenges` (3–4) arrays — as strings, per the `@google/genai`
   `Schema` type (`word-workout` precedent). Previously the arrays were unbounded, so
   "5–8 terms" lived only in a description string and nothing structurally stopped
   flash-lite from looping into the ~550 KB payload that truncated at `MAX_TOKENS`.
2. **`maxOutputTokens: 8192`** on the `generateContent` config — generous for a full
   8-term + 4-challenge payload, hard backstop against any residual runaway.
3. **Truncation-aware retry + degrade** (mirrors `gemini-number-tracer.ts:317-342`).
   `MAX_ATTEMPTS=2`; on parse failure logs `finishReason` + text length and retries once;
   on total failure passes `{}` to `validateVocabularyExplorerData` (which pads a
   renderable skeleton) instead of throwing a raw `SyntaxError` that would fail the whole
   `Promise.all` exhibit build.
4. **Deleted the dead `imagePrompt` field** from the schema, prompt, validate
   reconstruction, and the `VocabularyExplorerData` type — never rendered (NT-1 precedent).

**Verified:** project-local `tsc --noEmit` clean on touched files; all three eval modes
re-tested PASS (explore→match, recall→match/fill_blank, apply→fill_blank/context);
G-rule spot check — terms bounded to 5, challenges to 3, no `imagePrompt`, match challenge
well-formed. The intermittent truncation itself is not on-demand reproducible, but is now
structurally bounded and gracefully handled rather than thrown.

## Notes on the rest of the sweep
- VE-1/VE-4 (wrong answer key) confirmed still fixed — correct-by-construction: model
  emits `correctAnswer` + `distractor0/1/2`, code shuffles and derives `correctIndex`
  via `options.indexOf(correct)` (:411-412). No positional pointer to be wrong.
- VE-3 term-derived fallback still covers dropped flat fields (SP-14).
- `explore` correctly constrained to `match`; `apply` to `fill_blank`/`context`.
