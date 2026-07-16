# --check: phonics-blender — BASELINE run — 2026-07-15

- **Mode:** baseline (no pending edit to the contracted files). Companion to the sorting-station
  baseline check run the same day; validates every OBSERVED requirement's probe as of today.
- **Contract:** `docs/contracts/phonics-blender.md` (derived 2026-07-15)
- **Verdict:** **COMPATIBLE** — 10/10 requirements hold. Zero code changes. The R2 live-tap
  caveat stays QUEUED (unchanged — this run does not close it; see R2 row).
- **Working tree at run time:** NOT clean — carries the reader-fit #9 lane
  (foundation-explorer + `primitives/shared/PreReaderSelfCheck.tsx` etc.). **None of
  phonics-blender's files (component / generator / `catalog/literacy.ts`) are touched**, so the
  baseline is valid. Probes ran against the live dev server.

## Probe inventory

- 13 eval-test route draws: grade ladder unpinned ×3 (unknown-mode trick per the grade-fidelity
  close-out methodology), 4 modes pinned ×2, intent-bias ×2. All words code-judged.
- jsdom: `PhonicsBlender.reader-fit.test.tsx` (7 tests) — part of a 15/15 vitest pass.
- `tutor-test?componentId=phonics-blender&probe=1&gradeLevel=kindergarten` (Tier-2 scaffold audit).

## Per-requirement results

| Req | Result | Evidence |
|---|---|---|
| R1 PRE how-to-play ORIENT carrier | **PASS (probe tier)** | scaffold audit 0 findings; PRE HOW-TO-PLAY directive present in assembled prompt; PRONOUNCE commands present; no unresolved `{{…}}`. Live half: same-day live 3/3 (`qa/tutor-reports/phonics-blender-live-lesson-2026-07-15.md`) cited, not re-run |
| R2 per-tap STIMULUS spoken | **PASS (emit half)** | jsdom: tap fires exactly one `[PRONOUNCE_SOUND]`. **Live-tap Gemini response remains QUEUED** (reader-fit BACKLOG, executor `/tutor-test`) — unchanged by this run; the `[PRONOUNCE_SOUND]` vs `[PRONOUNCE]` tag-prefix caveat stands |
| R3 K band-gate presentation | **PASS** | jsdom: K letter-primary, chrome/labels/`/k/` hidden; G1 full chrome, no leakage |
| R4 Check retained at K | **PASS** | jsdom: K build phase keeps Check, drops Clear; G1 Clear returns |
| R5 grade ladder | **PASS (exact)** | unpinned draws: K → `cvc`/K, G1 → `blend`/1, G2 → `r-controlled`/2 — precisely the close-out's confirmation line |
| R6 phoneme concatenation | **PASS 63/63** | every word across all 13 draws: `phonemes[].letters` join === `targetWord` (prompt-enforced, oracle-verified) |
| R7 cvce silent-e | **PASS** | both `cvce_blend` draws: silent-e own phoneme (`letters:'e'`, `sound:'//'`), no underscore notation, no irregular-list words |
| R8 one emoji per word | **PASS 63/63** | every generated word carries an emoji; jsdom renders it at K |
| R9 mode purity | **PASS 8/8** | each of 4 modes pinned ×2 → `patternType` inside the mode's allowed challenge types |
| R10 intent leans words, never accuracy | **PASS** | fixed cvc @ K: intent "animal words" → cat/dog/pig/hen/bug; "food words" → jam/ham/bun/fig; R6/R7 held on all of them |

## Observations (non-findings)

- `pb-r10-food` drew 4 words where draws usually carry 5 — no contract property demands a count;
  noted only as a flash-lite-truncation-adjacent data point ([[flash-lite-truncation-template]]).
- R10's "topic" lever and R5's grade lever both behaved with `intent`/`grade` passed through the
  eval-test taps — consistent with the contract's origin claims ([[value-origin-not-code-touch]]:
  verified by probe, not grep).

## Register updates in this slice
- Contract changelog line appended (no property text changes needed).
- `BACKLOG.md` Done entry; WORKSTREAMS parked-row note.
