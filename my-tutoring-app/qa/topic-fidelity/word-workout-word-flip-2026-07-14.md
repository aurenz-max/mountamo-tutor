# Topic Fidelity: word-workout + word-flip — 2026-07-14

Handoff Task 3 (`qa/reader-fit/HANDOFF-opus-2026-07-14.md`), BACKLOG item **10**.
Source: `qa/topic-traces/k-cvc-short-a-2026-07-14.md`, topic "Decode CVC words with
short 'a' (e.g., cat, map, van)" (K).

## word-workout — FIDELITY BUG (vowel scope) → FIXED + VERIFIED

**Diagnosis.** word-workout IS the right primitive for CVC decoding, but had no
vowel-scope binding. `masteredVowels` defaulted to all five vowels
(`config?.masteredVowels || ["a","e","i","o","u"]`), so a "short a" objective produced
chains wandering across e/i/o/u (census: cat→bat→bad→**bed**, sit/tip/top/rot/bug/tug)
and the returned data stamped `masteredVowels: [a,e,i,o,u]`. The existing
`validateWordChain` post-process enforced the one-letter-change rule but never the
vowel scope.

**Fix** (`gemini-word-workout.ts`, mirrors cvc-speller's `resolveCvcVowelFocus` +
deterministic sanitizer):
1. `resolveScopedVowels(ctx.scope, intent)` — parses the short vowel(s) named by
   topic/objective/intent (`/short[\s-]*['’]?\s*([aeiou])\b/`), or `null` if
   vowel-generic. Precedence: topic scope > manifest `masteredVowels` > all-five default.
   `masteredVowels` (prompt + returned data) now reflects the scope.
2. Prompt binding: `buildScopePromptSection(ctx.scope)` prepended + a HARD VOWEL SCOPE
   line ("change onset/coda, never the vowel") when scoped.
3. Deterministic post-parse sanitizer (`sanitizeVowelScope`): drops any challenge whose
   graded words leave the vowel scope — word-chains (whole chain), real-vs-nonsense
   (both words), picture-match (target + distractors), sentence-reading (the decodable
   `cvcWords`; sight words exempt). Emptied mode → per-vowel scoped fallback (every
   fallback word sits on the target vowel).

**Verification (runtime, dev :3001).** `eval-test?componentId=word-workout&evalMode=word_chains&gradeLevel=kindergarten`,
short-a topic, 3 draws:

| Draw | masteredVowels | Chains | On-vowel? |
|------|----------------|--------|-----------|
| 1 | ['a'] | cat→bat→bad→sad · map→tap→tan→fan · van→man→mad→pad · hat→mat→max→wax · ram→dam→dad→sad | 15/15 short-a |
| 2 | ['a'] | cat→bat→bad→dad · map→lap→lad→sad · pan→can→cat→fat · tag→lag→lap→tap · ram→dam→dad→mad | 15/15 short-a |
| 3 | ['a'] | cat→bat→bad→sad · map→tap→tan→fan · van→pan→pat→rat · had→mad→mat→fat · cab→tab→tag→rag | 15/15 short-a |

Regression (no vowel named, grade 1 "Read and build CVC words with any short vowel"):
`masteredVowels=[a,e,i,o,u]`, chains span all five vowels → **unconstrained** (scoping
only fires on a named vowel). Verdict: **FIDELITY BUG → fixed at the scope-binding tier.**

## word-flip — WRONG PRIMITIVE (routing) → FIXED + VERIFIED

**Diagnosis.** word-flip is a K-1 **grammar** primitive (regular -s plurals, spoken).
The manifest mis-routed it into a decoding objective; the census draw was plural_s with
"cloud" (a valid plural noun, but not K-decodable CVC — decodability isn't word-flip's
job). This is routing drift, not a generator bug: forcing CVC nouns would corrupt the
plural game and it's still the wrong primitive for decoding.

**Fix** (catalog routing lever, `manifest/catalog/literacy.ts`): word-flip description
now leads with "GRAMMAR / oral-language game … NOT a phonics or decoding primitive (never
select for CVC-decoding, letter-sound, blending, or spelling objectives; route those to
cvc-speller / word-workout / phonics-blender)"; constraints reinforce "GRAMMAR objectives
only." No generator/schema change (kept the slice small, per handoff).

**Verification (runtime, dev :3001).** `topic-trace?…&manifestOnly=true`, CVC short-a
topic, 3 runs — word-flip **not selected** in any:

| Run | Selected (decoding primitives) | word-flip? |
|-----|--------------------------------|-----------|
| 1 | phoneme-explorer, letter-sound-link, phonics-blender, cvc-speller, word-workout, decodable-reader, knowledge-check | not selected |
| 2 | picture-vocabulary, phoneme-explorer, phonics-blender, word-workout, decodable-reader, cvc-speller, sound-swap, knowledge-check | not selected |
| 3 | letter-sound-link, cvc-speller, phonics-blender, word-workout ×2, decodable-reader, sound-swap, knowledge-check | not selected |

Pre-fix the census manifest included word-flip here. (phoneme-explorer appearing is
correct — initial-sound awareness is legitimately part of a decoding lesson, and Task 2
made it honestly initial-sound.)

## Checks

- `npm run typecheck:lumina` → 0 errors.
- `npx vitest run` → 56 files / **726 tests pass** (incl. the intent-consumption
  contract — both generators still consume `ctx.intent`/`ctx.scope`).
- Full-repo `tsc` unchanged: only the pre-existing legacy `WebSocketService.ts` baseline
  errors; edits were lumina-only.

**Verdict:** word-workout FIXED + VERIFIED (scope binding); word-flip FIXED + VERIFIED
(routing). PRE audit for both still open (reader-fit backlog).
