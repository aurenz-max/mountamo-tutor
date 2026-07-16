# Reader Fit: addition-subtraction-scene @ PRE (item 11) — 2026-07-16

**Status: READY — USER-CONFIRMED LIVE 2026-07-16** (full K session 100%: Act Out + Solve Story).

Mode audited: `act_out` @ K (direct-manipulation gap) | Probes: eval-test ✓ · vitest jsdom 7/7 ✓ · live `--lesson --runs 3` ✓ · real-browser hit-test proof ✓ · user browser check ✓ · contract-first ✓ (`docs/contracts/addition-subtraction-scene.md`)

Observed in the 2026-07-16 Pulse walk: subtraction `act_out` read *"…2 frogs hop away — **Drag them out of the scene**"* but the child could not drag/remove the frogs — the only interaction was a `NumberTileRow` ("How many frogs are there now? 0–5"). The instruction promised a manipulation the primitive didn't provide; the number was a **proxy** for an enactment. User ruling (`direct-manipulation-first`): **K learns by doing** — the removal/addition must BE the interaction, with the count *derived from the enacted scene*.

## Audit B — sufficiency contract (before → after)

| Beat | Before (1b tap-a-number) | After (item 11 direct manipulation) |
|---|---|---|
| ORIENT | tutor voiced "tell me how many" (a count-and-report ask) | tutor voices the TAP action: "tap the ducks to bring them in" / "tap the frogs to send them away" (live 3/3) |
| STIMULUS | story read aloud (item 1, intact) | story read aloud verbatim, unchanged (live 3/3) |
| DISAMBIGUATE | absent — "drag" copy contradicted the number-tile UI | instruction is deterministic + tap-accurate, names `changeCount` (story-public), never `resultCount` |
| FEEDBACK | correct/incorrect on a proxy number | scene reaching `resultCount` IS the confirmation + SFX + spoken recap |
| RECOVER | — | add "＋" control lets the child undo an over-remove; tap-to-remove undoes an over-add |

## Audit C — band contract (the fix)

| Rule | Before | After |
|---|---|---|
| 2 tap=choose | number tile (atomic, ok) | tap object / tap ＋ — the enactment IS the answer, no Check |
| 6 no-typing | ok (1b removed keyboard) | ok, and no proxy number at all |
| 8 instrument-over-quiz | **FAIL** — a quiz ("how many now?") bolted onto a scene | **PASS** — the assessment hides in the mechanics (remove `changeCount`, observe the count) |
| copy↔interaction | **FAIL** — "drag them out" over a number pad | **PASS** — "Tap N to send them away!" matches the tap-remove UI |

**Overall: READY** — K `act_out` is now true direct manipulation; the count is derived, not entered.

## What changed (fork by band + mode — see contract changelog)

- **Component** `AdditionSubtractionScene.tsx`: at `gradeBand==='K'`, `act_out` seeds the scene with the story's `startCount`; the child taps ＋ to bring `changeCount` more in (addition) or taps objects to send them away (subtraction); `handleBuildProgress` auto-judges the instant the enacted count equals `resultCount` (reuses the create-story build machinery). No `NumberTileRow`, no Check button at K `act_out`. **Grade 1 `act_out` is untouched** (count-the-scene + type-the-answer). `solve_story` K keeps its number tiles (1b), `create_story` keeps its build task (1b).
- **Generator** `gemini-addition-subtraction-scene.ts`: `act_out` promptDoc de-"drag"-ed; a **deterministic code-owned instruction** for K `act_out` ("Tap to bring N more X in!" / "Tap N X to send them away!") so the tutor's spoken `{{instruction}}` DISAMBIGUATE beat always matches the tap interaction, independent of the LLM. Names only `changeCount`, never `resultCount`.
- **Catalog** `math.ts`: description reconciled ("act out stories by adding and taking away objects (tapping to bring more in or send some away)"). The `act_out` evalMode description was ALREADY "Manipulate objects in scene" — the pre-item-11 implementation had betrayed it; this restores it. No evalMode/schema change.
- **No schema change was needed** — `act_out` challenges already carry `startCount`/`changeCount`/`resultCount`, enough to seed the scene and auto-judge on the enacted count. (The BACKLOG hypothesised a schema change; the data model already supported it.)

## Verification

- **tsc:** touched files 0 errors (project-local binary; the one `typecheck:lumina` error is in `ComparisonBuilder.tsx` — concurrent item-2b work, not this slice).
- **vitest jsdom 5/5** (`AdditionSubtractionScene.reader-fit.test.tsx`): K `act_out` subtraction seeds startCount + tap-remove auto-completes (no input, no Check); K `act_out` addition seeds startCount + ＋ auto-completes; K `solve_story` number-tile tap completes (1b preserved); create_story add/remove builds (1b preserved).
- **eval-test @ K** (`Add and subtract within 5`): 4 `act_out` challenges, every instruction tap-accurate + operation-matched, `changeCount` named / `resultCount` withheld, arithmetic sound, all ≤ maxNumber 5.
- **live `--lesson --runs 3` (act_out) 3/3 CONFIRMED**: story read aloud verbatim + tap instruction voiced + ORIENT restates the tap action every run. Report: `qa/tutor-reports/addition-subtraction-scene-live-lesson-2026-07-16.md`.

## Runtime fix — scene objects were unclickable in a real browser (user-reported, same day)

The user tapped a frog in K subtraction `act_out` and nothing happened. Root cause: each scene
object is an SVG `<g onClick>` whose only always-painted child is a `<text>` emoji with
`pointer-events:none` — and a `<g>` paints nothing of its own, so it has **no hit area**. The tap
landed on empty space. jsdom's `fireEvent.click` dispatches straight to the `<g>`, so every jsdom
test "passed" — this class of bug is invisible to jsdom (no real hit-testing). It also affected
create_story tap-to-remove (HUMAN-CHECK #4, never browser-confirmed), but item 11 made scene-tap the
*primary* subtraction interaction, so it surfaced immediately.

**Fix:** each object now carries a transparent hit-target `<circle r=OBJ_SIZE/2+4>` with
`pointerEvents:'all'` as its first child (finger-sized tappable area); the highlight circle is
pinned `pointer-events:none`.

**Verified in a REAL browser** (playwright-core + system Chrome, minimal SVG repro of both variants):
old `<g>`+`pointer-events:none` text → **0** hits on a direct glyph click (unclickable, reproduces
the report); transparent-hit-circle variant → **2** hits including an off-glyph click within the
radius. jsdom guard added (each object `<g>` must contain a hit `<circle>`); vitest 5/5.

## Follow-on — solve_story "count the bunnies" tap-to-count aid (user-requested, same day)

The user noted that `solve_story`'s instruction ("Count the bunnies to see how many there are in
total!") invited tapping the bunnies, but tapping was inert (the answer only comes from the number
tiles). Rather than convert `solve_story` to manipulation (it is deliberately the *count-and-report*
identity, contract R3), we added a **tap-to-count aid** mirroring counting-board: tapping each object
tags it with a running ordinal (1,2,3… in **tap order** — `tappedObjects` is now an ordered array,
not a Set, so no renumbering) + a highlight ring; the child then still **selects** the total from the
tiles. One-to-one correspondence + cardinality (K.CC.4).

- **Correctness gate:** enabled only when `unknownPosition === 'result'` (the visible scene count IS
  the answer). For hide-the-change / hide-the-start it stays inert — counting the scene would mislead.
- Answer surface unchanged (tiles). Not a leak — the running count IS the taught counting method.
- Verified: tsc clean; vitest **6/6** (new test: tapping a bunny adds a highlight, tile still answers).

## Residuals

- Pixel/feel of the amber ＋ control + tap-to-remove animation → HUMAN-CHECKS (headless can't judge look).
- Sibling K scene primitives with the same read-then-tap-a-number proxy → recorded under the BACKLOG "direct-manipulation-first" systemic item (audited, not fixed here).
