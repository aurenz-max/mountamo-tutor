# Reader Fit: addition-subtraction-scene @ PRE — 1b (typing + create-story) — 2026-07-14

Modes audited: act_out, solve_story (PRIMITIVE-GAP fix) · create_story (rebuilt K-capable)
Probes: eval-test ✓ · tutor-test --probe ✓ · **behavioral vitest (jsdom) 3/3 ✓**
Band: PRE (catalog claims "ESSENTIAL for Kindergarten")

Backlog item **1b** — the two follow-ups left open by the 2026-07-13 STIMULUS+ORIENT
slice. Both fixed with `--fix`. Per the user's direction, create_story was **rebuilt
to serve K** rather than routed away from it (the primitive is the product).

## Finding 1 — Typing at PRE (PRIMITIVE-GAP, Audit C rule 6 / rule 2) → FIXED

`act-out` and `solve-story` answered via a numeric `<LuminaInput>` — a pre-reader
had to TYPE the numeral (rule 6) through a tap→type→Check protocol (rule 2).

**Fix layer: COMPONENT band-gate (Tier 2).** At `gradeBand === 'K'`, act-out and
solve-story render a `NumberTileRow` (0…maxNumber as big tappable tiles). Tapping a
tile IS the atomic answer — it calls the check handler with the tapped value; no
keyboard, no separate Check button (`isTapChooseCount` suppresses it). Grade 1 keeps
the keyboard + Check (EMERGING can type).

- Answer-complete: K content is `maxNumber: 5`; all observed act-out result counts
  and solve-story targets fall in 0–5, so the 0…5 tile row covers every answer
  (eval-test act_out/solve_story @ K both pass).

## Finding 2 — create_story unusable at PRE → REBUILT K-capable (not banned)

The original create_story showed the equation as raw text and **accepted any
scene+object selection as correct** — a pedagogy hole at every grade, and unreadable
at K. First pass shipped a generator band-floor (route create_story away from K);
on the user's call that was **reverted** in favor of making the primitive serve K.

**Fix layer: COMPONENT rebuild (Tier 2) — a pre-reader production task.** At K,
create_story becomes "**build the story**": the tutor reads the equation aloud, and
the child constructs the scene by placing/removing objects, **judged by construction**:
- Addition (join): scene starts empty; child taps "＋ add a 🦆" up to `resultCount`.
  A two-step narration fires at the start→change boundary ("now 2 more come!").
- Subtraction (separate): scene pre-fills with `startCount` objects; child taps
  objects to send them away down to `resultCount`.
- Completion auto-judges the instant the scene holds exactly `resultCount` — tap =
  choose, no Check button (`isBuildStory`). The build ACTION is the answer, so a
  pre-reader produces the story instead of authoring text.
- STIMULUS: create_story has empty `storyText`; a new `orientLineForChallenge`
  helper makes the `[ACTIVITY_START]`/`[NEXT_ITEM]` beats read the EQUATION aloud
  and cue the build (no cold-start on an unread empty string).
- Catalog: create_story eval-mode description updated from "Write story…" to
  "Represent a given equation as a story by BUILDING the scene… Pre-reader capable."
  so the resolver routes it to K confidently.

Grade 1 keeps the existing scene+object picker (rebuild piloted at K first;
Grade-1 picker→builder is a queued follow-up — it's hollow there too).

Generator UNCHANGED (band-floor reverted; `git diff` clean). create_story @ K now
generates real create-story challenges with counts ≤ 5 (verified via eval-test).

## Audit C — band contract (PRE) delta vs 2026-07-13

| Rule | Was | Now |
|---|---|---|
| 2 Tap = choose | FAIL (act-out tap→type→Check) | **PASS** for K count + build modes (tap = answer, no Check) |
| 6 No typing | FAIL (numeric input) | **PASS** at K (number tiles + build task; Grade 1 keeps input) |
| 8 Assessment hides in mechanics | PARTIAL (create-story accepted anything) | **PASS** at K (build is construction-judged) |
| 7 No adult chrome | FAIL (tabs/counter/badges/toggle) | unchanged → **K-stage systemic item** |

## Overall: PRIMITIVE-GAP FIXED · create_story REBUILT K-capable

Verification (Verification Doctrine — exercised at runtime, not just tsc):
- tsc + `typecheck:lumina` — 0 errors in the touched surface.
- eval-test @ K: act_out / solve_story pass (tile-answer-complete); create_story
  generates valid build-ready create-story data (counts ≤ 5, operation + equation).
- tutor-test `--probe` @ K: `pass`, 0 findings (no scaffold regression / leak).
- **Behavioral vitest (jsdom, testing-library) — 3/3 pass**, driving the real
  component logic (external hooks mocked):
  1. act-out @ K: no `input[type=number]`; tapping tile "3" completes the challenge.
  2. create_story addition @ K: no Check button; three "add" taps auto-complete
     (not complete at two).
  3. create_story subtraction @ K: scene pre-fills 4 objects; two removals reach
     result 2 and auto-complete.
- ⚠️ **Pixel-level visual** (toy-tile look, layout) still wants a human browser
  glance — MathPrimitivesTester → addition-subtraction-scene → act_out / create_story
  @ K. Behavior is proven; only the appearance is unconfirmed.

## Loop log

| # | Change | Type check | Runtime check | Result |
|---|---|---|---|---|
| 1 | Component: `NumberTileRow` band-gated act-out/solve-story at K; handlers take explicit value; Check suppressed | tsc 0 new · lumina ✓ | eval-test pass, tile-answer-complete; vitest tap→complete ✓ | rule 6 & 2 **PASS** |
| 2a | Generator band-floor for create_story@K | tsc 0 new | eval-test downgrade confirmed | **reverted** on user call |
| 2b | Component: create_story rebuilt as construction-judged "build the story" at K (add/remove, auto-judge, equation read-aloud); catalog desc updated | tsc 0 new · lumina ✓ | eval-test build-ready data; vitest add-build + remove-build auto-complete ✓; tutor-test pass | create_story **K-capable (verified)** |

Harness asset: first Lumina **component behavioral test** (`*.test.tsx`, jsdom via a
`@vitest-environment` header). vitest.config gained `@vitejs/plugin-react` (declared
devDep), the `@` path alias, and `.test.tsx` include — full suite 745/745 green.
