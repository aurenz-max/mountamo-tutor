# Counting board — live runtime adoption, 2026-09-17

Third primitive in the `/lumina/live-activity` host, after TenFrame and Number Line.
Counting board is the **second judged-runner adoption**: the runner asks, judges the
spoken number and advances, and the tutor's executable actions are a re-ask, a text
reminder and one prepared example with return.

## Supported actions

| Action | Scope | What the child sees | Evidence |
|---|---|---|---|
| `replay` (`responseSpeech: 'runner'`) | every kind outside the quick-look family | the runner re-speaks this board's own ask; nothing is cleared or recounted | `CountingBoard.runtime.test.tsx` "re-asks the same board on replay"; the demand is byte-identical before and after |
| `scaffold`, routed (+ per-strategy `-1` fade) | each mode's method reminder, plus the misstep aids whose evidence fits | a line above the board (`data-runtime-hint`) that the tutor also speaks | routing cases in `CountingBoard.runtime.test.tsx`; live: 2 taps on a board of 5 offered `touch-each-one` **and** `one-touch-each` |
| `request_support` + `return` | `count_all`, `group_count`, `count_on` (`count`), `take_away` (`subtract`), `add_more` (`make-ten`) | one row of counters with the operation's sentence; the board and every tap come back | 4/4 live runs; counted work identical across the detour |

## Unavailable actions, and why

| Withheld | Reason |
|---|---|
| `advance` | The judged runner owns progression. `LIVE_ADAPTERS['counting-board'].canAdvance` is `false`, which the Python envelope validator requires for `teachingOwner: 'di-runner'`. |
| `retry` | There is no learner-facing clear. The runner's `onCorrectionRetry` re-arms a wrong item in-band, so a tutor "clear" would be a second correction path. |
| `point` | On every counted mode the tap **is** the answer gesture. Pip's targets are a projection, not an action channel. |
| everything, on `subitize` (K) and `subitize_perceptual` (Pre-K) | `canYieldForHelp()` is false. The K flash is a stimulus the runner's gate owns, and the Pre-K item is number-free by contract R5 while every sentence this renderer draws carries numerals. |
| the detour only, on `recount_moved` | Holding the number across the move is the task; a hidden board destroys it. Its re-ask and conservation reminder stay. |
| the detour only, on `compare` and `give_me_n` | One row of counters cannot state two groups, or a set handed over. An invented rendering here would be a pedagogical lie the runtime does not catch. |

## Machine evidence

- `CountingBoard.runtime.test.tsx` — 18 cases on the real component, real runner, real
  `LiveLessonRuntime`, real `RuntimeTransport` and the real rendering shell.
- 222 tests green across live-activity, the judged runner, NumberLine, TenFrame,
  CountingBoard and the counting-board DI script suite. `typecheck:lumina` 0.
- Driver: `scripts/primitive-runtime-driver.mjs counting-board` — real DOM clicks on
  drawn objects and the real handover button, not a reused TenFrame path.
- Re-driven 2026-09-18 through the collapsed harness
  (`run_live_runtime.py --primitive counting-board --startup`), which replaced the
  three per-primitive journeys. Same result; see the roadmap's harness-collapse section.

### Real model drives

| Journey | Runs | Result | Commands per run | Receipts |
|---|---|---|---|---|
| `count` @ Kindergarten, `--startup` | 3 | 3/3 PASS | `scaffold`, `request_support`, `return` | 3 visible |
| `take_away` @ Kindergarten, `--startup` | 1 | PASS | same | 3 visible |

Each run exercised the real `request_activity` → silent mount handoff, a wrong spoken
answer through the frontend speech reducer, the scripted correction, the reminder, the
prepared example, return, a correct answer, a second item and one settled completion
(`submissions == 1`). Raw event logs:
[count](counting-board-runtime-live-2026-09-17.json) ·
[take_away](counting-board-runtime-take-away-2026-09-17.json) ·
[payload](counting-board-runtime-payload-2026-09-17.json).

The `take_away` example drew `6 − 2 = 4` against a board whose own answer was `2` — a
nearby relationship, not the answer.

## The misstep inventory (2026-09-18)

The first version of this adoption shipped **one generic reminder per mode**, which
answers only the most common misstep and leaves the rest to the DI correction — a
line that states the answer and fires identically however the child was wrong.
Replaced with a per-mode inventory in `countingBoardScript.ts`, routed on the
evidence the adapter already publishes:

| Mode | Method reminder (always) | Misstep aids, offered only when the evidence fits |
|---|---|---|
| `count_all` | `touch-each-one` | taps ≠ board → `one-touch-each`; all touched but a different number said → `last-number-tells-how-many`; answered with nothing touched → `start-by-touching` |
| `count_on` | `keep-going-from` | said the visible-only count → `dont-start-at-one`; off by one → `next-number-after` |
| `take_away` | `count-what-stayed` | said the number removed → `not-the-ones-you-took`; said the start → `take-them-off-first` |
| `add_more` | `count-all-of-them` | said the number added → `not-just-the-new-ones`; said the start → `count-the-new-ones-too` |
| `compare` | `count-both-groups` | named the smaller group → `the-group-with-more`; named the total → `one-group-not-all` |
| `give_me_n` | `count-as-you-give` | too many handed over → `stop-at-the-number`; too few → `keep-going-to-the-number` |
| `group_count` | `count-each-group` | stopped after one group → `every-group-not-one` |
| `recount_moved` | `moving-does-not-change` | none — the board blocks recounting, so the method reminder is the only aid |
| `subitize`, `subitize_perceptual` | none | the perceptual family advertises nothing |

Levels: method reminder 1, misstep aid 2. No aid states the answer, swept in a test
against each item's own target as digit and number word. The tutor **speaks** the
description, so at K the aid reaches a pre-reader by voice and the painted panel is
for the adult — every line is written to be sayable as it stands.

Missteps deliberately left to another lane: an established misconception across
items stays with `countingBoardRemediation.ts`; which aids exist at a difficulty tier
stays with `/add-support-tiers`; the answer re-model stays with the DI correction.

Live routing evidence: with two taps on a board of five, the runtime offered
`touch-each-one` (fade) and `one-touch-each`, and the tutor took the method reminder.

## Two findings worth carrying forward

**The runtime's `canYieldForHelp` gates every affordance, not just the detour.**
While the runner owns the turn, `LiveLessonRuntime.blockedReason()` returns
"Runner owns the teaching turn" and `offers()` returns `[]` whenever that predicate is
false. A first pass here withheld `recount_moved` from `canYieldForHelp` to protect the
detour and silently lost its re-ask and its reminder as well. The detour is withheld
through `supportArtifacts`; `canYieldForHelp` answers "may the tutor act here at all".
TenFrame does not surface this because its two exclusion sets happen to be identical.

**The model may open and close the example inside one turn.** In 2 of the first 3 runs
the tutor called `request_support` and `return` roughly two seconds apart without
handing the learner a turn between them. That is permitted autonomy, not a wrong grade,
but a journey that reads the saved work from the *next* tutor turn never sees it. The
harness now captures the saved demand when the support command commits and records an
`autonomous_return` event. Any later judged-family journey should be written the same way.

## A correction I had to make to this report

The 2026-09-17 runs claimed "return with the two real taps preserved". **That
assertion passed vacuously.** The journey tapped before the wrong answer, and the DI
correction restores a clean working surface, so by the time the detour opened the
board held nothing — `saved` was `counted: 0` and the return comparison was empty
against empty. It proved the detour did not INVENT work; it proved nothing about
preserving any.

The journey now places the work after the correction and records whether the
preserved state was non-empty. Re-driven 2026-09-18: `counted: 2` survived the
detour, `vacuous: false`. The claim is now backed by what it says it is.

## Observed limitations

- The driver never passes `runtimePlanItemId`, so the planned `[CB_COMPLETE]` closing cue
  is covered by the component test only, never by a live drive. TenFrame has the same gap.
- Coverage by mode, corrected 2026-09-18 (the first version of this report said
  "8 of 10 have component coverage", which was wrong in both directions):

  | | Modes |
  |---|---|
  | Live model drive **and** component test | `count`, `take_away` |
  | Component test only | `subitize`, `subitize_perceptual`, `count_on`, `compare`, `give_me_n`, `recount_moved`, `add_more`, `group` |
  | Neither | none |

  `group` (`group_count`) originally had **neither**: it existed only in the test
  file's fixture helper and was never mounted, so it shipped advertising a detour no
  test had opened. It now has its own cases and the advertised-set check is
  `it.each` over every kind the counter surface can state. Live model coverage is
  still 2 of 10.
- No `--runs 3` gate has been run for a **planned** counting-board lesson, and neither
  planned activity order has been driven with three families enabled.
- G1–G3 stay open. The standalone closing line ("See you next time!") is still the
  primitive's own completion speech, which is exactly G2; a planned lesson replaces it.
- JSDOM paint is a paint *opportunity*, not proof a person saw anything. Audio, playback
  and microphone are simulated throughout.

## Not closed here

Browser acceptance and microphone acceptance, reported separately and closed only by a
human sitting — tracked as HUMAN-CHECKS #167. This journey certifies counting board's
own advertised actions in `count` and `take_away`; it certifies neither the combined
planned lesson nor the other eight modes.

## Next bounded session

One primitive, as before. `number-bond` or `place-value-chart` are the next judged-runner
math candidates; both are registered DI ports with contract docs. Before widening further,
the more valuable pull is the combined planned-lesson drive across all three mounted
families, which is what G1–G3 actually need.
