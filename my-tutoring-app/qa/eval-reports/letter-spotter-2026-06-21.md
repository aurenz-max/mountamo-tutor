# Eval Report: letter-spotter — 2026-06-21

**Step 2c (Support-Tier / structural-difficulty sweep) — PARTIALLY BLOCKED.**
Sweep halted at the user's request: the generator intermittently emits a runaway
(~383 KB) response that fails `JSON.parse`, so the tier path could not be exercised
to completion. Flagged here as a brittle-schema finding to be addressed separately.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| name_it (baseline) | PASS | — (clean: 6 challenges, `name-it`, 2.2 s) |
| name_it (easy/hard) | FAIL | 1 (CRITICAL — runaway JSON / unterminated string) |
| find_it | NOT SWEPT | — (sweep halted) |
| match_it | NOT SWEPT | — (sweep halted) |

## Issues

### name_it — generator emits a ~383 KB runaway response that fails JSON.parse
- **Severity:** CRITICAL
- **What's broken:** `gemini-flash-lite-latest` occasionally produces a giant,
  unterminated JSON body that `JSON.parse(text)` at `gemini-letter-spotter.ts:566`
  cannot parse, so the call throws and the primitive ships nothing for that
  generation. The model appears to run a single string field to the output-token
  limit and gets truncated mid-string.
- **Data:** `SyntaxError: Unterminated string in JSON at position 383304 (line 13
  column 382990)` thrown from `generateLetterSpotter` (`:549`/`:566`). Observed on a
  `name_it` hard-tier call; the `name_it` **baseline** call succeeded
  (`status:"pass"`, 6 challenges) on the same server, so the failure is intermittent
  rather than a hard 100 % break.
- **NOT confirmed as a tier regression:** our Track-C diff (406 lines) does NOT touch
  the response schema or any array bounds (`git diff` grep for `maxItems`/`Type.ARRAY`/
  `schema` additions returned nothing), and the no-tier baseline parses fine. The
  runaway is a Flash-Lite stability / schema-robustness problem in this generator, not
  a change to the generated data shape. Whether the longer tiered prompt raises the
  failure *rate* was not measured (sweep halted before sampling).
- **Fix in:** GENERATOR (harden against truncation — e.g. cap the schema's string
  fields / array sizes, add a parse-retry-with-repair or a smaller `maxOutputTokens`
  guard, or simplify the schema per the CLAUDE.md "brittle schema → simplify
  proactively" rule). Tracked for separate follow-up.

## Tier wiring (static read — UNVERIFIED at runtime)
The axis-1/axis-2 code in `gemini-letter-spotter.ts` reads coherently
(`resolveProblemShape` → distractor-similarity far→near via `CONFUSABLE_CLUSTERS`,
`selectDistractorsBySimilarity`; `resolveSupportStructure` scaffold flips; per-challenge
application gated on `supportTier`; byte-identical no-tier path) and the offline builder
stress test passed 200 k runs at implementation time. None of the five Step-2c checks
could be confirmed against live generated data because of the parse failure above.
Re-sweep (all three modes, baseline/easy/hard) after the runaway-JSON fix.
