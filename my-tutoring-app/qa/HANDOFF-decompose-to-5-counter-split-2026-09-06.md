# Handoff — a counters-based "split into two groups" assessment for K decomposition

> ## ✅ EXECUTED 2026-09-06 — candidate (A), homed on `ten-frame`
>
> Built as a new `split` challenge type behind a new `decompose` eval mode (β 2.0). The frame opens
> with the whole group on it, all red; taps FLIP a counter red↔yellow and never add or remove one,
> so the total cannot drift and the only thing measured is where the line between the groups falls.
> Commits on stillness like `build`; the verdict is code-computed (`correct` / `empty_part` /
> `repeat`) and a per-total session ledger makes "a DIFFERENT way" a real demand rather than a
> restatement. Contract **R9** in `docs/contracts/ten-frame.md`; ledger entry at
> `qa/lesson-bench/BACKLOG.md` item 29(a).
>
> **Two corrections to this document, for whoever reads it next:**
>
> 1. **"(A) … doesn't require a live tutor session" is WRONG, and it was the main cost argument
>    against (B).** `CountingBoard.tsx` and `TenFrame.tsx` both open *"DI modality. The Live tutor
>    owns the clock in every mode"* and both already run `useJudgedScriptRunner`. All three
>    candidates were equally DI-bound. The real argument for (A) is that it creates supply where (B)
>    only re-routes to a primitive that was already there.
> 2. **`ten-frame` was the right home for reasons this document nearly found.** It correctly warns
>    that `twoColorMode` is a static positional pre-colouring and not a split mechanic — true, and
>    it stayed that way. But `showOptions.allowFlip` and the `TenFrameMetrics` field
>    `twoColorDecompositionsExplored` (hardcoded to `0` since it was written) were both already
>    sitting in the primitive describing this exact mode. `split` does not reuse `twoColorMode`; it
>    is the mode those two fields were waiting for.
>
> **Still open, and NOT closed by this build:** the `/lesson-coverage confirm` re-judge (step 4
> below — the build is verified, the re-judge is not), a real-browser drive (HUMAN-CHECKS **#138**),
> and **obj2's "using drawings" demand, which `split` does not touch at all** — the freeform-drawing
> `/curriculum-fit` sweep this document flags is still owed, and with it the question of whether
> obj2 is asking for supply that does not exist.

**For:** a fresh session running `/curriculum-fit number-bond` (or `counting-board`/`ten-frame`),
then `/add-eval-modes` on whichever primitive the curriculum-fit read names as the home.
**Opened:** 2026-09-06, routed from `qa/lesson-bench/BACKLOG.md` item 29(a).
**Confirmed twice, independent draws** (same topic, different generation) — this is a catalog
supply gap, not a one-off prompt miss. `strategy-picker`'s SELECTION half of item 29 (29(b)) is
already fixed in a separate slice — this handoff is SUPPLY only, don't fold the two back together.

## The gap, precisely

Topic: **"Decompose numbers up to 5 into pairs in multiple ways, using objects and drawings"**
(kindergarten). Objective 1: **"Model how to split a group of up to 5 objects into two smaller
groups using counters."** Two fresh `topic-trace?package=true` draws both land the same way:

- `…-decompose-numbers-up-to-5-into-pairs-in-multiple-20260906034411-uqnm.json`: `TAUGHT_NOT_ASSESSED`
  [CRITICAL] — `counting-board[count]` and `ten-frame[build]` were the only obj1 blocks; the judge's
  note: *"obj1-counting-board only tests simple 1:1 counting, and obj1-ten-frame only asks to place
  N counters on a frame."*
- `…-decomposing-numbers-up-to-5-into-number-pairs-20260906041244-66ol.json`: `ASSESSED_INDIRECTLY`
  [WARNING] — same two blocks, same `off_target_assessment`: *"Blocks obj1-counting-board-concrete
  and obj1-ten-frame-counters evaluate 1:1 counting and single-set building rather than decomposing
  collections."*

Both blocks' own generated **titles** already claim decompose framing the schema can't deliver —
*"Decompose the Apples!"*, *"Splitting Numbers up to 5... Practice splitting totals up to 5 into
two parts using counters on a 5-grid frame"* — while the actual `challenges[].type` on both draws
is plain `count_all` / `build`. The generator is doing its best with a schema that has no split
challenge type; this is not a prompt-wording bug.

## What's already true about the catalog (read before designing anything)

**`counting-board`** (`gemini-counting-board.ts`) — `ChallengeType` is exactly `count_all |
subitize | subitize_perceptual | count_on | group_count | compare`. `compare`'s "two groups side
by side" and `group_count`'s "groups" arrangement both come from `generateGroupPositions`
([CountingBoard.tsx:245](../src/components/lumina/primitives/visual-primitives/math/CountingBoard.tsx#L245)),
a pure LAYOUT function — it visually clusters a pre-set `count`/`groupSize` into piles for
display. There is no per-object interaction that lets a child choose which pile an object joins;
the only tap handler on this primitive increments/decrements a "counted" set (`count_all`'s
one-purpose interaction). **A split/decompose challenge type does not exist and nothing here is a
near-miss for it** — it would be new schema (`ChallengeType` + `CHALLENGE_TYPE_DOCS` entry, per
`/add-eval-modes`'s Phase 3) AND a new interaction (tap-to-assign-pile), not a config change.

**`ten-frame`** (`gemini-ten-frame.ts`) — `ChallengeType` is exactly `build | subitize | make_ten |
add | subtract`. The schema DOES carry a `twoColorMode` object (`color1Count`/`color2Count`/
`color1`/`color2`) and [TenFrame.tsx:538-545](../src/components/lumina/primitives/visual-primitives/math/TenFrame.tsx#L538)
does render it — **but only as a static, POSITIONAL pre-coloring** (`index < color1Count ? color1
: color2`), used today only in the K prompt guidance's decorative "3 red + 4 yellow = 7" build
challenges. It is never wired to an eval mode, never validated, and the tap handler
([TenFrame.tsx](../src/components/lumina/primitives/visual-primitives/math/TenFrame.tsx) around the
`filledCells` toggle) only adds/removes a counter from the frame — it does not let the student
choose a counter's color/group. **This looked like a ready-made split mechanic; it is not** — don't
assume `twoColorMode` gets you most of the way there without adding real per-counter group-choice
interaction first.

**`number-bond[decompose]`** is the ONLY primitive in the catalog with a genuine split-into-two-
groups interaction: the child drags/taps counters into two part-circles
([NumberBond.tsx:676](../src/components/lumina/primitives/visual-primitives/math/NumberBond.tsx#L676),
`addCounter('left' | 'right')`), the pair is validated in code, and the docblock is explicit this
is a **HANDS gesture, closing on stillness, not a spoken turn** — the catalog `constraints` string's
microphone requirement ("Requires a microphone: the missing-part answer is spoken...") reads on
first pass like it covers the whole primitive, but the component docblock
([NumberBond.tsx:1-18](../src/components/lumina/primitives/visual-primitives/math/NumberBond.tsx#L1))
narrows it to `missing-part` specifically — `decompose` never asks the child to speak. That said,
the file's own header states **"NumberBond — DI modality. The Live tutor owns the clock in every
mode"** — so even the silent `decompose` gesture still runs inside the DI/Live-tutor runner, i.e.
it is not currently reachable as a plain tap-only block the way `counting-board`/`ten-frame` are
outside a DI port. `showCounters: false` (seen in both draws' obj2 config) only hides the dot
overlay on the circles — it is a display toggle, **not** a drawing/sketch mode; there is no
freeform drawing surface anywhere in `number-bond`, and (as far as this handoff checked) no K math
primitive in the catalog has one — that's worth a `/curriculum-fit` sweep of its own before
assuming obj2's "drawings" demand is solvable at all with the current primitive set.

## What to build — three candidates, not a spec

**(A) A new interactive split mode on `counting-board` or `ten-frame`.** Closest match to obj1's
exact wording ("using counters," no mic implied) and doesn't require a live tutor session. Needs:
a new `ChallengeType` (e.g. `split`) + `CHALLENGE_TYPE_DOCS` entry + catalog `evalModes[]` entry +
constraint wiring (`/add-eval-modes`'s standard path) — AND a genuinely new interaction (tap a
counter to toggle which of two piles it's in; commit when `pileA + pileB === total` and both > 0).
This is real component work, not a generator-only change; budget for it accordingly.

**(B) Route obj1 to `number-bond[decompose]` too**, accepting its DI/Live-tutor dependency. Cheaper
if the manifest can assign the same primitive to two objectives in one lesson (check the curator/
`resolveLessonEvalModes.ts` for a one-instance-per-primitive dedup rule before assuming this is
free) — and it still leaves obj2's drawings demand unaddressed, since number-bond has no drawing
capability. This only closes obj1; obj2 needs its own answer either way.

**(C) A ruling that the two objectives should collapse into one.** If no K primitive can ever
satisfy "using drawings" for decomposition (per the sweep noted above), the two-objective split
itself may be asking for supply that doesn't exist and isn't cheap to build — that's a call for the
user, not something to design around silently. Route to `qa/HUMAN-CHECKS.md` if (A) and (B) both
turn out to be more than a pilot-sized slice.

## Explicitly NOT in scope

The same fresh 66ol draw also hit a `generation_failure` on `obj3-di-spoken-partners` (empty
`items`, "explain the different ways a number can be made using two parts") — an open-ended verbal
EXPLANATION shape, the same class already flagged at `qa/lesson-bench/BACKLOG.md` item 21(c) and
explicitly scoped OUT of the sibling `di-spoken-practice` comparative handoff
([HANDOFF-di-spoken-practice-comparative-2026-09-06.md](HANDOFF-di-spoken-practice-comparative-2026-09-06.md)).
Don't fold it in here; name it if it comes up and move on.

## Verification (pilot-then-sweep, CLAUDE.md Verification Doctrine)

1. `tsc` baseline first — check `qa/lesson-bench/BACKLOG.md` for the current count (770 as of
   2026-09-06) before comparing.
2. Whichever candidate is chosen, unit-test the new challenge type / interaction before touching
   the live generator (existing `__tests__` pattern next to the component, e.g.
   `CountingBoard.test.tsx` / `TenFrame.test.tsx` / `NumberBond.test.tsx`).
3. **Pilot on this exact topic first** — regenerate "Decompose numbers up to 5 into pairs in
   multiple ways, using objects and drawings" @ kindergarten fresh ×3 via `topic-trace`, source=
   script, before sweeping any pattern to other primitives.
4. `/lesson-coverage confirm` on a fresh draw: obj1 should move off `TAUGHT_NOT_ASSESSED`/
   `ASSESSED_INDIRECTLY` toward `ASSESSED_SUFFICIENTLY`, and `off_target_assessment` on
   `obj1-counting-board`/`obj1-ten-frame` should disappear.
5. A `build-stream` drive (headless recipe: `project_headless-chrome-drive-recipe` memory) before
   calling the fix student-verified, per CLAUDE.md's Verification Doctrine — a schema/generator
   change is not "done" on `tsc` alone.

## Files

| File | Role |
|---|---|
| [gemini-counting-board.ts](../src/components/lumina/service/math/gemini-counting-board.ts) | `ChallengeType`, `CHALLENGE_TYPE_DOCS`, schema — candidate (A) home |
| [CountingBoard.tsx](../src/components/lumina/primitives/visual-primitives/math/CountingBoard.tsx) | `generateGroupPositions` (layout-only), tap handler — where a new pile-assignment interaction would live |
| [gemini-ten-frame.ts](../src/components/lumina/service/math/gemini-ten-frame.ts) | `ChallengeType`, `CHALLENGE_TYPE_DOCS`, dormant `twoColorMode` schema field — candidate (A) alt home |
| [TenFrame.tsx](../src/components/lumina/primitives/visual-primitives/math/TenFrame.tsx) | `colorForCell` (positional, not interactive), `filledCells` toggle |
| [NumberBond.tsx](../src/components/lumina/primitives/visual-primitives/math/NumberBond.tsx) | `decompose` gesture interaction (the ONLY real split mechanic today), docblock on mic scope |
| `math.ts` catalog entries for `counting-board` / `ten-frame` / `number-bond` | `evalModes[]`, `constraints`, `affordances` — where a new mode gets registered |
| `qa/lesson-bench/packages/kindergarten-decompose-numbers-up-to-5-into-pairs-in-multiple-20260906034411-uqnm.json` + `…decomposing-numbers-up-to-5-into-number-pairs-20260906041244-66ol.json` | Both frozen pre-fix draws |
| `qa/lesson-coverage/evals.jsonl` | Both judge rows; grep the package ids above for full evidence |
