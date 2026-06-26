# Eval Report: vocabulary-explorer — 2026-06-25

Triggered by a user-reported failure: in a "Journey of a Water Droplet" fill-blank
challenge ("Which term describes water falling to Earth as rain, snow, or hail?"),
selecting **precipitation** (the correct answer) was marked WRONG and
**transpiration** was shown as correct.

## Results (after /eval-fix, 2026-06-25)

| Eval Mode | Challenge Types | Status | Issues |
|-----------|-----------------|--------|--------|
| explore   | match           | PASS   | — (VE-2 fixed) |
| recall    | match, fill_blank | PASS | — (VE-1, VE-3 fixed) |
| apply     | fill_blank, context | PASS | — (VE-1 fixed) |

All three modes re-verified PASS on the live eval-test endpoint. MC `correctIndex`
now spreads across positions (2/0/3/2 across a re-test sweep, never anchored to 0),
every MC has 4 distinct real options (no `Option A–D` placeholders), and derived
fallbacks honor the eval-mode's allowed challenge type.

Catalog eval modes are `explore` / `recall` / `apply` (in `catalog/core.ts`); the
challenge-type names (`fill_blank`, etc.) are NOT eval modes — passing one bypasses
catalog validation (`catalogMeta: null`).

## Issues

### VE-1 — `correctIndex` frequently points at the wrong option (answer-key mismatch)
- **Severity:** CRITICAL
- **What's broken:** Gemini emits a positional `correctIndex` for fill_blank / context /
  identify, and it is wrong in the majority of generations — almost always anchored to
  `0` regardless of where the right option actually sits. The component faithfully grades
  against this index, so the conceptually-correct answer is marked wrong. This is exactly
  the user's bug. The generator never validates `correctIndex`; it only range-clamps it
  (`gemini-vocabulary-explorer.ts:236-237`).
- **Observed (correct answer is identifiable from each `explanation`, which is reliable):**
  - default fill_blank: opts `[Evaporation, Condensation, Precipitation, Transpiration]`,
    `correctIndex=0`, but explanation names **Precipitation** (should be 2).
  - default identify "best definition for Transpiration": `correctIndex=0` ("Water turning
    into ice"), correct option is index **2** ("Water released into the air by plants").
  - recall ×4 fill_blank across two runs: all `correctIndex=0`, all wrong (answers were
    Precipitation=1 and Transpiration=2).
  - apply ×3 (fill_blank + context): all CORRECT (`correctIndex` 2/0/1) — the lone clean
    sample. The defect is stochastic; apply got lucky, it is not structurally safe.
- **Data:** `fill_blank: options=[…,Precipitation@2,…] correctIndex=0; explanation="Precipitation is the general term…"`
- **Fix in:** GENERATOR — stop trusting the LLM's positional index. Have Gemini emit the
  correct answer as TEXT (`correctAnswer` string) and compute `correctIndex` in
  post-process by matching it against `options[]` (knowledge-check already uses a stable
  `correctOptionId`; decodable-reader DR-1 adopted the same pattern). See SP-25.

### VE-2 — `match` challenges are trivially solvable by row alignment
- **Severity:** HIGH
- **What's broken:** The component renders the Terms column and the Definitions column in
  the SAME index order (`matchPairs[i].term` opposite `matchPairs[i].definition`), and
  grades a pair correct when `term index === definition index`
  (`VocabularyExplorer.tsx:338-339, 673-699`). So the correct answer is "match row 1 to
  row 1, row 2 to row 2, …" — a student can solve every match without reading anything.
  Defeats the assessment (pedagogy rule #1: not solvable from layout). Same family as SM-1.
- **Data:** definitions column is not shuffled; correctness check is positional identity.
- **Fix in:** COMPONENT — render definitions in a shuffled order with an index map back to
  the matching term, and grade against that map (not raw positional identity).

### VE-3 — recall `fill_blank` intermittently has no real options (flash-lite drops fields)
- **Severity:** HIGH
- **What's broken:** In one recall run both fill_blank challenges came back with
  `options=["Option A","Option B","Option C","Option D"]` — the generator's hardcoded
  fallback (`gemini-vocabulary-explorer.ts:229-234`) firing because Gemini omitted the
  `option0–option3` flat fields entirely (SP-14). The challenge is then unanswerable /
  meaningless and `correctIndex` falls back to 0. A separate Photosynthesis run produced
  truncated/unterminated JSON that threw in `JSON.parse` (SP-6, flash-lite robustness).
- **Data:** `options=['Option A','Option B','Option C','Option D'], correctIndex=0`
- **Fix in:** GENERATOR — after flat→structured reconstruction, reject any MC challenge
  missing real `option0–3` (don't fall back to placeholders); consider the orchestrator /
  required-field pattern used to close SP-14 on coin-counter, word-sorter, dot-plot.

## Resolution (/eval-fix, 2026-06-25)

- **VE-1 — FIXED (GENERATOR, POST-PROCESS-DERIVE).** Added a `correctAnswer` TEXT field to the
  challenge schema; the prompt now instructs Gemini to copy the correct option verbatim, and
  post-process derives `correctIndex = options.indexOf(correctAnswer)` (case-insensitive). The
  positional `correctIndex` is now a last-resort fallback only. This is the port of
  knowledge-check's `correctOptionId` pattern — correct by construction, no false negatives.
- **VE-3 — FIXED (GENERATOR, POST-PROCESS-DERIVE, SP-14).** When the flat `option0–3` fields are
  missing/empty, the generator no longer emits `Option A–D` placeholders. It derives a real,
  answerable challenge from the generated `terms` (always padded to ≥5) via
  `buildMcChallengeFromTerms` / `buildMatchChallengeFromTerms`. The pad-to-3 minimum uses the same
  builders, and all derived fallbacks honor the eval-mode's allowed challenge type (no off-type drift).
- **VE-2 — FIXED (COMPONENT, answer-leak/display).** The Definitions column now renders in a
  shuffled order (`shuffledDefOrder`, values are original pair indices). Grading is unchanged
  (`term i ↔ definition i`) because `matchedPairs` stores the original definition index — only the
  visual order changes, so row-alignment can no longer solve a match.

**Verification:** `tsc --noEmit` clean (1423 total, 0 in the two changed files, at baseline);
all 3 eval modes PASS with correct type constraints; G4 answer-derivability holds across a re-test sweep.

**Deferred (not addressed):** the secondary truncated/unterminated-JSON observation in VE-3
(`JSON.parse` throwing on a Photosynthesis run) is a Flash-Lite robustness issue (SP-6 family),
not a data-shape bug — out of scope for this targeted fix.
