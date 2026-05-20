# Eval Report: hundreds-chart — 2026-05-19

## Results

| Eval Mode          | Status   | Challenges | Issues |
|--------------------|----------|------------|--------|
| highlight_sequence | PASS     | 4          | —      |
| complete_sequence  | PASS     | 4          | —      |
| identify_pattern   | PASS     | 4          | —      |
| find_skip_value    | PASS     | 4          | —      |

Workstream 1 prompt-floor sweep verified — all 4 modes now produce 4-6 challenges (previously 3-4). Relaxed skipValue-uniqueness constraint works: grade-2 challenges using the 3-skip pool [2, 5, 10] correctly cycle without invalid output.

## Notes — Fixed 2026-05-19

All three SP-17 issues (HC-1, HC-2, HC-3) resolved by a single structural change rather than a sanitizer or post-validator:

**Fix:** Removed `instruction` from the Gemini schema entirely. The `instruction` field is now generated deterministically inside [`buildChallenge`](../../src/components/lumina/service/math/gemini-hundreds-chart.ts#L172) via [`buildInstruction(type, skipValue)`](../../src/components/lumina/service/math/gemini-hundreds-chart.ts#L93), matching how `correctCells`/`givenCells`/`options` are already derived. Gemini still provides `title`, `description`, and per-challenge `hint` — none of which make structural claims about cells.

**Why this approach over a sanitizer:** A first pass added regex+phrase-list checks to detect "next three", "first two rows", "starting from one", etc. That defense-in-depth is brittle (number words slip past digit checks; benign phrases like "from the highlighted cells" risk false positives) and grows every time Gemini finds a new way to violate. Eliminating the schema field structurally removes the bug class — no validator can produce false negatives if no LLM input exists.

**Trade-off:** Instructions are now uniform per challenge type rather than topic-flavored. Topic personality lives in `title`/`description`. For a primitive whose instruction must reference exact cell counts and start positions, clarity beats variety.

## Original Issues (resolved)

### HC-1 — complete_sequence: "next three" mismatches full-sequence check (CRITICAL)
Every challenge instruction said "Tap the **next three** numbers in the sequence..." but the component's check required the student to select all cells in `correctCells - givenCells` (47 cells for skip=2). Fixed: deterministic instruction now says "The first 3 numbers are highlighted. Tap all the remaining numbers in the pattern up to 100."

### HC-2 — highlight_sequence: "first two rows" mismatches full-sequence check (CRITICAL)
C3 instruction said "Tap on every even number you see in the first two rows" while `correctCells` held all 50 evens from 2-100. Fixed: deterministic instruction now says "Tap every number in the skip-counting-by-Ns pattern, all the way to 100." — no scope qualifiers possible.

### HC-3 — find_skip_value: instruction numbers don't match visible cells (HIGH)
C4 instruction said "these numbers: 12, 14, 16, 18" but `givenCells = [2,4,6,8]`. Fixed: deterministic instruction now says "Look at the highlighted numbers. What is the skip value (how much is added each step)?" — no digit lists possible.

## Verification

All 4 modes re-tested 2026-05-19:
- TypeScript compiles cleanly (no hundreds-chart errors)
- Each mode returns 4 challenges, all with `status: pass`
- G4 (answer derivability) verified: every instruction's structural claim matches the deterministic cell data — cannot drift, ever
