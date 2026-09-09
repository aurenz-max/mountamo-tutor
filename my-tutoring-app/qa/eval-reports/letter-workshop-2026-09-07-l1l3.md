# Eval Report: letter-workshop — 2026-09-07 (L1 modes + L3 tiers, harness pass)

Formal `/eval-test` harness pass over the eval-mode ladder shipped since the
L0 report. Supersedes the tracker row's "no catalog eval-mode ladder" note.
Complements the narrative reports already on file
([modes](letter-workshop-modes-2026-09-07.md), [tiers](letter-workshop-tiers-2026-09-07.md))
rather than replacing them.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| trace     | PASS | — |
| copy      | PASS | — |
| write     | PASS | — |
| trace × easy/medium/hard | PASS | — |

No CRITICAL/HIGH issues found. All modes render through
`/api/lumina/eval-test` cleanly; the support-tier sweep matches the
catalog/contract table exactly.

## Checks run

- **Step 1 (API):** `componentId=letter-workshop` for `trace`/`copy`/`write`,
  no `&difficulty=`. Each returns 4 challenges, correct `challengeType`,
  correct `catalogMeta` (beta 1.5/3.5/5.0), no `supportTier`/`support`/
  `structure` fields — confirms the null-tier no-op.
- **Step 2b/2c analog — support-tier sweep:** `evalMode=trace`, topic
  "Uppercase alphabet practice", `difficulty=easy|medium|hard`.
  - Scaffold withdrawal (deterministic, code-set): easy
    `showStarts/showArrows/showLineLabels/showChecklist` all `true` → hard
    all `false`. Matches the tier table in
    [the contract](../../src/components/lumina/docs/contracts/letter-workshop.md).
  - Structural lever: easy `complexity:2` for all 4 challenges → hard
    `complexity:4` or `5`. Matches the declared band widths.
  - Variety: 4/4 distinct letters at both easy and hard (the band-widening
    fix from the tiers report holds under a fresh draw).
  - Magnitude invariance: complexity score only, no numeric magnitude to
    inflate — n/a for this primitive.
- **Rule G4 (answer derivability):** `write` mode omits the target letter
  from every visible field (`title`, `description`, `templateId` is present
  in JSON but never rendered pre-submission per the component and prior
  browser probe) — consistent with prior verification, not re-driven here.
- **Regression gates:** `npm run typecheck:lumina` → 0 errors.
  `npm test -- LetterWorkshop letterWorkshopDifficulty gemini-letter-workshop`
  → 252/252 passed (5 files), matching the 1,563-test suite figure in the
  tiers report for this narrower slice.

## Not re-driven here (see linked reports for evidence)

Browser mouse/click flows, tutor scaffold probes, cue playback lifecycle,
and the 1,000-scoped-pool stress sweep were already exercised and are not
repeated by this pass — this report only closes the gap where the formal
`/eval-test` API endpoint itself had not been curled against the current
3-mode + tier catalog entry.
