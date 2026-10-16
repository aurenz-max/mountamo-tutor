# timeline-explorer W1 binding (ROLLOUT C34, R1 batch 4), 2026-10-16

**Shape P, three modes, all bound** (explore, order, connect). Levers in `../eval-reports/timeline-explorer-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
The old check did not test what the timeline taught. Gemini wrote every question, option and key (identify, date,
order, cause_effect), so a wrong key or a giveaway option shipped unchecked. The order check marked each card green or
red after the first try, which showed most of the order. The eval-mode pin only narrowed the model's question types.
The explore mode's description promised "timeline visible" during the questions, but the component hid it. The score
gave 30% for opening events.

Rebuilt so that Gemini writes only the timeline and code builds every item and key (`timelineExplorerWorkspace.ts`).
Each event now carries a `clue` (one sentence, none of its title's own words, no date) and a `ledTo` (a later event it
caused). The keys come from the events' `sortOrder` and `ledTo` links.
- **Reading first, on both paths.** The learner opens every event (date, description, impact, connection), then presses
  Begin the questions. While reading, the workspace publishes `readyForResponse: false` and a `reading` scene; the
  journey row opens the events first (`presentation !== 'ready'`, the planetary-explorer pattern).
- **identify** (explore, order): a clue; say or tap the event. easy 3 options, none next to it in time; medium 4; hard 4
  including its neighbours. A clue that names a word only its title has, or its year, is never asked (`clueLeaks`).
- **date** (connect): say or tap when an event happened (the year alone counts when spoken). Same structural tiers.
- **order** (order): cards with titles only, top marked Earliest. easy 3 spread out, medium 4, hard 5 consecutive.
  No per-position marks after a check.
- **cause_effect** (connect): match each cause to the event it led to. easy 2 links, medium 3, hard 3 plus an extra
  effect that happened before every cause. Link sets where an event is both a cause and an effect are avoided.
- **Generator**: one timeline call, regenerated once if clues leak or fewer than 3 links come back. `config.difficulty`
  (or `ctx.supportTier`) picks the tier. Legacy payloads rebuild code items from their events and challenge types.
- **Catalog**: description, constraints, affordances and the three mode descriptions rewritten to match. Mode ids and
  betas unchanged (`problem_type_registry.py` untouched).

identify and date are `speech` with `acceptsGesture` (J14), judged by `timelineExpectedAnswer` when spoken and by code
when tapped. order and cause_effect are gestures. Misses (`timelineMiss`; the spoken ids are the same): identify
`adjacent_event`, `distant_event`; date `adjacent_date`, `distant_date`; order `reversed`, `adjacent_swap`,
`two_swapped`, `one_moved`, `mixed_order`; cause_effect `used_extra`, `effect_before_cause`, `pairs_swapped`,
`mixed_links`.

## Rulings (closed 2026-10-16) (removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R6 model-written questions removed (follow-up `/topic-fidelity timeline-explorer` on `ledTo` written as a chain), R15 no per-card colouring, timeline as a lever, R18 accuracy-only score.
- **Model-written questions are gone**, including any "why did X happen" cause_effect pair that was not one event
  leading to another on the timeline. cause_effect now pairs event titles only.
- **Opening events earns no score.** A timeline with no buildable item (too few events) still submits 100 on the
  scripted path after reading, as before; every other score is accuracy only.
- **explore no longer shows the timeline during the questions** (the old component did not either); it comes back as
  the `show_timeline` help lever, recorded as assisted.
- **Order feedback no longer colours each card** after a wrong check.

## Gates
- `TimelineExplorer.workspace.test.tsx` 16/16 (every mode mounted on hand-built items, reading phase, spoken and
  tapped answers, levers, practice items, structural tiers, leak rules, legacy payloads).
- `pip/ExhibitWorkspaces.surface.test.tsx` (timeline-explorer still publishes nothing while reading),
  `lessonWorkspacePlan.test.ts`, `catalog/misses.test.ts`: 207 passed. `workspaceContract.test.tsx` filtered to the
  id: 13 passed.
- live-activity + core folders: 4216 passed, 1 failed (`LiveActivitySandbox.test.tsx` paint timing, under load; 9/9 when re-run alone).
- `typecheck:lumina`: 0 errors (whole Lumina surface, last run). Full `tsc` not run (the orchestrator runs it).
- Payloads `w1-payloads/timeline-explorer.{explore,order,connect}.json` (explore medium, order hard, connect hard,
  Grade 4, American independence). All three are real model content; clues passed the leak check on every event.
- Sweep J1-J14: 0 findings on the three payloads. The advisories ("scene facts contain the key") are the choice
  lists, which are on screen.

## Replay (gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 9 items x 5 samples, `--observe`; `replay/timeline-explorer-2026-10-16{,-r2..-r6}.json`)
Every miss, stuck, lever and credit reply was read on each run. Every empty reply was a 429 from the shared quota
(5, 7, 12, 7, 12, 4 per run), not tutor silence; r6 ran at `--concurrency 2`.
- **r1.** A date item on the first event: the before_after card said "Nothing on this timeline comes before it", and
  2/5 stuck replies asked "which date fits the very first event?", which is the earliest choice. The card now names
  only the neighbours that exist (`beforeAfterLines`, with a unit test that it never says nothing, first or last).
  Guidance: never say where an event falls in time.
- **r2.** 1/5 identify stuck reply restated a clue about delegates as "gathered together as a congress", a word from
  the key's title. Guidance: when restating a clue, never add a word from a choice's title.
- **r3.** 1/5 order lever reply said "take another look at those first two cards and see if you want to switch
  them" after an adjacent swap (the fix). Guidance: never say which card is out of place.
- **r4.** 1/5 order stuck reply named the swapped pair ("the Stamp Act compared to the Boston Massacre"); the tutor knows
  the history. Guidance: never name a card or a pair to look at.
- **r5, r6.** No reply states a key, names the clue's event, a neighbour, a pair to swap or a fix, or claims something
  off screen. Credit replies name the learner's own answer.

Shared lever doctrine (counted only): first-person lever narration ("I added descriptions", "I brought back the
timeline strip") 20/225 in r6; one "I pulled a lever" in r1, flagged by the automatic check.

## Undriven modes
None. The sweep taps identify and date, presses the Move buttons for order and the Cause/Effect buttons for
cause_effect; the workspace test drives a spoken identify answer.

## Open findings
- The model writes `ledTo` as a chain to the next event on every payload so far, so cause_effect mostly asks "which
  event came next" rather than why. Code avoids chained link sets; the prompt asks for at least 4 links. Needs a
  generation fix or a ruling on what cause_effect may ask. `/topic-fidelity`.
- `two_links` (cause_effect simplify) is never offered on these payloads: every link is on the item. Same cause.
- Needs a browser check of the reading strip, the order rows, the cause/effect columns and the lever panels (JSDOM only). `/eval-test`.
- No `docs/contracts/timeline-explorer.md`. The new requirements (code keys from `sortOrder` and `ledTo`, a clue never names its
  event, no date on any check card, reading before the questions) are recorded only here. `/primitive-contract`.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`.
- 429s from parallel agents blank 2-5% of replay samples; the replay does not retry them. `/add-live-tutor-tools` (replay harness).
