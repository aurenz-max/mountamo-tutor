# number-sequencer — Support-Tier Difficulty Sweep (Step 2c)

Date: 2026-06-14 · topic="Counting to 20" · grade="grade 1" · dev @ localhost:3000
Modes swept: count_from, before_after, order_cards, fill_missing, decade_fill (each easy + hard) + 1 no-difficulty baseline on count_from. All 11 calls HTTP 200, status=pass, 5 challenges each. No errors/empties.

## Result: PASS (no CRITICAL, no HIGH)

### Step A — ground truth
- `resolveSupportStructure` read. Per-mode easy→hard levers confirmed:
  - CPA/perception: easy = dot+line ON; medium = line only; hard = both OFF. decade-fill: dots always OFF (symbolic), line easy/medium ON, hard OFF.
  - structuralCount: count-from 3→4→5, order-cards 3→4→6, fill-missing 1→2→3, decade-fill 1→2→3, before-after fixed 1 (thin axis, leans on CPA + instruction prose).
  - decade-fill hard: `crossHundredBoundary=true` (designed structural lever — straddle a hundreds boundary).
- Component (`NumberSequencer.tsx`): `showDotArrays` gates `<DotArray>`, `showNumberLine` gates the line reference, `supportTier` drives `tutorRevealPolicy` (mode-aware, withholds strategy at hard). Decade-fill renders full hundred-chart rangeMin→rangeMax — the leak surface; mitigated by non-adjacent gaps.
- Magnitude prose: STRIPPED from the tier path. grep("smaller|larger|DIFFICULTY LEVEL") → 2 hits, both benign: (a) line 159 "A larger SET to order" = card-count/structural, not number size; (b) line 366 "Before/after with larger numbers" lives inside the `!evalConstraint` (no-eval-mode) grade-band fallback block, never reached on a pinned mode. No "DIFFICULTY LEVEL" prose anywhere. Cleanup complete.

### Step C — assertions
1. **Scaffold flips — PASS.** Every easy: dot+line=true (decade easy: dot=false by design, line=true). Every hard: dot=false, line=false. Never identical easy↔hard.
2. **Structural lever moves — PASS.** count-from slots 3→5, order-cards cards 3→6, fill-missing blanks 1→3, decade-fill missing decades 1→3. before-after holds 1 (designed). All grow easy→hard.
3. **Magnitude invariance — PASS.** count-from / before-after / order-cards / fill-missing all stay 1–20 at both tiers (no inflation). decade-fill: easy 0–60, hard reaches 100–160 — this is the DESIGNED `crossHundredBoundary` structural lever (decade→hundred transition), not numeric difficulty inflation; the mode is intrinsically decade-scaled (>20) regardless of tier. No same-band number was simply enlarged to add difficulty.
4. **Contract / no leak — PASS.** `correctAnswers.length == null-count` at every tier for fill-missing/before-after/decade-fill (count-from/order-cards use countInputs/cards, n/a — sized off correctAnswers.length, intact). decade-fill gaps are non-adjacent at every tier (easy 1 gap; hard nulls at positions 1,3,5 with a visible decade between each) — visible decades never reveal the missing ones.
5. **Null-tier no-op — PASS.** count_from baseline: `supportTier=undefined`, dot=true, line=true (grade-1 defaults), structural counts left to LLM (3/4/5/4 mixed). Tier machinery did not fire.

### Observation (not a tier defect, pre-existing)
decade_fill_hard challenges [3]/[4] have `rangeMax`=100 clamped by the grade-1 validator while the sequence/answers run to 120/160. The decade-fill chart render only draws rangeMin→rangeMax, so values past rangeMax won't appear in the grid (the cross-hundred decades the lever intends would be partially off-chart). Contract (correctAnswers↔nulls) still holds; this is a range-field vs sequence mismatch in the hundred-chart render path, independent of the support-tier work. Flagging for awareness; no code touched.
