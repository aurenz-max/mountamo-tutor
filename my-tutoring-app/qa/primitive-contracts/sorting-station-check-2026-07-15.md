# --check: sorting-station — BASELINE run — 2026-07-15

- **Mode:** baseline (no pending edit to the contracted files). First `--check` exercise of the
  contract system; establishes that every OBSERVED requirement's probe passes as of today and
  validates the probe recipes themselves.
- **Contract:** `docs/contracts/sorting-station.md` (derived 2026-07-15)
- **Verdict:** **COMPATIBLE** — 10/10 requirements hold at runtime. One contract-precision
  amendment applied to R8 (see Findings); no code changes made or needed.
- **Working tree at run time:** NOT clean — carries the reader-fit #9 lane in flight
  (`FoundationExplorer.tsx`, `gemini-foundation-explorer.ts`, `catalog/core.ts`, `types.ts`,
  `StoryMap.tsx`, `CompareContrastBlock.tsx`, new `primitives/shared/PreReaderSelfCheck.tsx`).
  **None of sorting-station's files (component / generator / `catalog/math.ts`) are touched**, so
  the baseline is valid for this contract. Probes ran against the live dev server (:3000/:8000 up).

## Probe inventory

- 24 eval-test route draws (real Gemini generations), saved probe JSONs judged code-side
  (concatenation of windows, mode purity, numeric scope) + semantically (intent tracking).
- jsdom: `SortingStation.reader-fit.test.tsx` + `gemini-sorting-station.test.ts` — part of a
  15/15 vitest pass.
- `tutor-test?componentId=sorting-station&probe=1&gradeLevel=kindergarten` (Tier-2 scaffold audit
  with real generated content).
- `topic-trace` POST (manifestOnly) at K objective "Sort objects by a single attribute…" for the
  resolver half of R3.

## Per-requirement results

| Req | Result | Evidence |
|---|---|---|
| R1 taught-rule stability | **PASS** | shapes ×3: `sortingAttribute=shape` on all 4 challenges each draw; needs-vs-wants: `category` on all 4, no perceptual drift |
| R2 intent binding | **PASS** | fixed topic "Community helpers": intent "sort tools by which helper uses them" → bins are helpers (Doctor/Police Officer, Mail Carrier/Firefighter…); intent "sort helpers by where they work" → bins are workplaces (Hospital/School, Fire Station/Police Station…) |
| R3 K band floor | **PASS (both halves)** | generator: 9 K-grade draws emitted only `sort-by-one`/`odd-one-out`; resolver: live K manifest pinned `targetEvalMode: sort_one` (curator prose: "the sort_one mode appropriate for pre-readers") |
| R4 PRE picture-primary | **PASS** | jsdom reader-fit suite green (K hides chrome, bucketEmoji present, G1 keeps chrome) |
| R5 read-aloud STIMULUS beat | **PASS** | scaffold audit 0 findings; `instruction`/`categories` contextKeys resolve from component (sample values present); "SAY THE SORT OUT LOUD AND NAME EVERY BIN" directive present in assembled probe prompt; no unresolved `{{…}}` |
| R6 odd-one-out selection integrity | **PASS** | jsdom (wrong tap clears; single auto-submit per selection, ref-latched) |
| R7 Check retained for multi-item | **PASS** | jsdom (K sort keeps Check; K odd-one-out auto-submits) |
| R8 grade-capped structure | **PASS on probe spec** + precision amendment | K easy: 4 obj / 2 bins / `showCounts=true`; G1 hard: 6 obj / 2 bins / `showCounts=false` — counts in window, support lever moved. See finding F1 |
| R9 mode purity | **PASS 12/12** | each of 6 modes pinned ×2 → challenge types homogeneous and in the mode's allowed list |
| R10 count_compare numeric scope | **PASS** | "up to 5" topic: group counts [[2,3],[3,1],[1,3],[2,3]] all ≤5. Discrimination note: the ≤10 draw stayed ≤4 per group — upward discrimination is structurally limited because the G1 object window (5–8 total) caps group sizes anyway; the bound-honoring half is what R10 protects and it held |

## Findings

### F1 — R8 prose overstated enforcement ("hard clamps") — contract amended, no code change
An extra untiered corroboration draw (`sort_attribute` @ G1, no `difficulty` param) produced
4-object challenges, below the 5–8 window floor. Mechanism (verified in
`gemini-sorting-station.ts`): `normalizeSupportTier()` is a STRICT lookup — with no valid
`config.difficulty` there is no tier, and `resolveProblemShape`'s window prompt line
("Use about N objects … do not exceed …") is **never emitted**. The object window is therefore
**tier-conditioned prompt guidance**, not a post-process clamp; only the **bin cap**
(`maxCategories`, K ≤3 / G1 ≤4) is hard-enforced in code. R8's own demanding consumer (the
support-tier/structural-difficulty engine) always passes a tier, and both tiered draws honored the
window — so no consumer-visible violation exists. R8's property text was amended to state the real
enforcement split. Candidate hardening (NOT queued as a demand — no consumer has hit it): clamp
object counts in post-process like bins.

## Register updates in this slice
- Contract R8 property amended + changelog line appended.
- `BACKLOG.md` Done entry; WORKSTREAMS parked-row note.
