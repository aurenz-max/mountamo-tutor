# `/primitive-contract sorting-station --check` — 2026-08-18

**Edit under guard:** the DI judged-loop port (`/add-di-loop`), all seven eval modes.
**Verdict: COMPATIBLE** — two requirements RE-BASED onto what they protected, one preserved
under active risk, one deliberately left alone. No fork needed; no requirement ablated.

## Why the guard ran

`docs/contracts/sorting-station.md` exists and the edit is a whole-file component rewrite plus a
generator and catalog change — the widest possible blast radius on this primitive. Two requirements
(R6, R7) pin CONTROLS the DI doctrine deletes, and one conflict (C3) explicitly pre-warns the edit
this slice looks like from the outside.

## Requirement-by-requirement

| Req | Zone touched | Outcome |
|---|---|---|
| R1 taught-rule stability | generator (prompt + gates) | **HOLDS.** The sort axis still comes from `sortingAttribute`; nothing in the port selects or rotates it. `sort_variety`'s exemption is untouched. Live probe: axis constant within each challenge across all 7 modes. |
| R2 intent binding | generator | **HOLDS.** `buildSortingObjectiveSection` untouched. Probe drew on-intent content for all 7 modes (needs/wants, living/nonliving, community helpers, states of matter). |
| R3 K band floor | catalog | **UNMOVED, DELIBERATELY.** See below. |
| R4 PRE picture-primary | component (rewritten) | **PRESERVED** — the live regression risk. See below. |
| R5 read-aloud STIMULUS beat | catalog `aiDirectives` | **SUPERSEDED IN KIND, stronger.** See below. |
| R6 odd-one-out selection integrity | component | **RE-BASED.** See below. |
| R7 Check retained | component | **RE-BASED.** See below. |
| R8 grade-capped structure | generator | **HOLDS.** Object windows (K 4–6 / G1 5–8) and bin caps (K ≤3 / G1 ≤4) untouched. The session cap is a SELECTION layered on top, never a change to what is generated. |
| R9 mode purity | generator | **HOLDS.** Per-mode sub-generators untouched; probe pinned each mode and got homogeneous types. |
| R10 count_compare numeric scope | generator + new gate | **HOLDS AND TIGHTENS.** Counts now additionally must land in the benched 1–20 spoken range, and a group that would be EMPTY is dropped rather than asked (zero has no benched spoken form). |

## The three that needed a ruling

### R7 — "sort-family keeps its explicit Check button" → RE-BASED

R7's property: *"auto-submit applies ONLY to atomic single-tap tasks. Sort-family challenges are
multi-part construction and keep the explicit Check even at K — decluttering must not remove the
commit-your-work step."* C3 adds: *"the tempting over-general edit is exactly what a future declutter
pass would reach for."*

**This is not that pass, and the distinction is load-bearing.** R7 protects the COMMIT STEP for
multi-part construction. The judged loop does not remove the commit — it removes the *multi-part
construction*. One object is now one atomic judged turn, and its commit is the child's spoken answer
plus the tutor's verdict. Nothing grades partial work; nothing auto-submits an unfinished board,
because there is no board state to finish. The protection R7 names is satisfied structurally, and the
button it names is obsolete because the thing it guarded no longer exists.

Pinned in `SortingStation.reader-fit.test.tsx` (`describe('R7 re-based …')`): no Check control at
either band, and every sort item classified as an atomic voice turn.

### R6 — "odd-one-out is tap = choose, a wrong tap must not latch" → RE-BASED

Same shape. The child now SAYS which card does not belong, so there is no tap to latch, no
auto-submit to fire once, and no wrong selection to clear. Pinned as the absence of a tappable card
plus the item's voice classification.

### R4 — PRE picture-primary presentation → PRESERVED (the real risk)

A whole-file rewrite is exactly how a band-gated presentation gets silently dropped. Preserved
verbatim in spirit: at K the trays render `bucketEmoji` (colour-coded circle fallback) with the word
as a small caption, cards are emoji-primary and enlarged, and adult chrome (progress dots, mode
badges, description, helper prose) is hidden. `isPreReader` remains the single gate and the Grade 1
control half is pinned in the same suite, so nothing leaks across.

**One deliberate change at BOTH bands:** the printed instruction is gone. The tutor speaks the ask,
so a printed copy would let a reader skip listening and is unreadable to everyone else. This
strengthens R5 rather than weakening R4.

### R5 — the STIMULUS beat → superseded in kind, and made stronger

The click-era `aiDirectives` block ("SAY THE SORT OUT LOUD AND NAME EVERY BIN FIRST") existed to stop
a pre-reader being stranded by an improvised tutor turn. Under the judged loop the scripted ask does
this **by construction** — every sort ask names its groups aloud, and the K band floor forces that at
every support tier (`isPreReader` beats `namesSortCriterion: false`). The directive was rewritten
rather than deleted, and `contextKeys` moved to the family's `['challengeType','stimulus']`, so the
`{{instruction}}`/`{{categories}}` keys R5 warned could "render SILENT" no longer exist to break.

## R3 — the band floor, and why this slice did NOT move it

The port's whole payoff is that five of seven modes are floored to Grade 1+ for reasons that are
MEDIA, not cognition — the contract's own G2 says *"what exceeds a pre-reader is the medium, not the
cognition."* The spoken port removes that medium.

**The floor still did not move**, because G2 also says the path is *"a band gate on the instruction
channel … THEN a reader-fit re-audit of the mode at PRE. **Not** a simple unflooring — the floor stays
until the audit passes."* Shipping the medium is what makes that audit possible; it is not the audit.
K keeps `sort_one` + `odd_one_out`, both now sequential and spoken. Pinned by a test asserting the
BAND FLOOR text and the five "Grade 1+ ONLY" mode descriptions survive.

**This is now the top follow-up** — `/reader-fit sorting-station`, closing G2 and G3(a).

## Content faults the guard surfaced (not requirement violations — bugs the spoken ask exposed)

1. `showCounts` printed the answer to every count ask (pixel leak; fixed per-item).
2. The compare ask contained its own answer by construction (re-shaped to take a group label).
3. A prompt contradiction had silently killed `sort_attribute`'s metacognitive choice — objects
   carried one attribute, so the chooser had nothing to choose. This would have shown a one-button
   chooser in the click era too; it is a pre-existing defect nobody had reason to look for.
4. `pick_rule`'s correct spoken answer was the word "category" (fixed via `spokenAxisName`).

Two of these live in the generator and two in the component; none contradicts a requirement.

## Evidence

- Live 7-probe real-pipeline run, one per eval mode: **27/27 challenges kept, 0 drops, 69 judged
  items, `checkPackGates` clean**.
- Headless judged drives: `sort_one` plain ×2 (20/20 refused, 20/20 affirmed) and signature ×2
  (20/20); `two_attributes` 8/8; `count_compare` 9/9; `odd_one_out` 4/4. Cap drill 0 HIGH.
- `typecheck:lumina` 0 · full `tsc` 803 with zero errors in touched files · own suites 59/59 + 13/13
  · full vitest 3969 passed (1 failure belongs to the concurrent sentence-analyzer lane).
- Not verified: any browser run. R4's pixel-level look rides HUMAN-CHECKS #12 as before; the port's
  own mic row is #112 (renumbered by `/pm` 2026-08-18 — it collided with sentence-analyzer's #106).
