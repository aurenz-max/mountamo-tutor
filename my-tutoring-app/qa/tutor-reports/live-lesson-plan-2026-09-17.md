# Live lesson phase 1 (LA-02/LA-03): stopped at the clean slice

Roadmap: `src/components/lumina/docs/LIVE_LESSON_ROADMAP.md`. User ruling 2026-09-17: stop phase 1 here,
undo the loop compensations, record the contract gaps. Mic acceptance: **pending**.

## Hypothesis

A saved lesson (curator brief → manifest → resolved modes → generated content) can run in the live sandbox as an
ordered plan, with a tutor-led number line and the ten-frame DI runner in one session, and nothing regenerated.

## What stays

- `livePlan.ts` projects a Lesson Bench package's objective blocks (all, or chosen ones) into plan items that keep
  objective, resolved `targetEvalMode`, intent, content and package provenance. A component is listed as unavailable
  with its reason: no adapter, no content, no pin, a pin missing from the catalog, content outside the mode's catalog
  `challengeTypes`, or failed adapter validation. Of the 61 saved packages (labeled copies excluded), 21 project to at least one live item.
  The Grade 1 add/subtract package gives `ten-frame:operate` (obj1) → `number-line:jump` (obj3).
- `LIVE_ADAPTERS` (validator, initial tutor state, teaching owner) replaces the per-primitive switches.
- `start_plan_item(itemId)` mounts prepared content. The browser mounts only the next unfinished item. The tutor is
  told item identities only (id, primitive, title, mode, objective), never content.
- Completion is the primitive's own `onEvaluationSubmit` (no EvaluationProvider, so no writes). The browser sends
  `plan_item_complete`; the bridge relays it once as an `item_complete` receipt.
- Sandbox package picker, objective filter, progress list. Harness `backend/tests/tutor_live/run_live_lesson_plan.py`
  (+ `--reverse`) with fixture `scripts/live-lesson-plan-fixture.mjs`.

## Reverted (loop compensations)

Each hid a frontend message sent at the wrong time or in the wrong mode (roadmap gaps G1–G3):
dropping NumberLine's `[ALL_COMPLETE]` in plan mode; holding the receipt until the next spoken turn ended; a silent
final `advance_activity` receipt; refusing `start_plan_item` until the receipt was delivered; taking the floor on
model speech in sandbox sessions.

## Evidence

Gates: frontend vitest 25/25 (sandbox, plan, contract, TenFrame live start, NumberLine jump); backend
`test_live_*.py` 21/21 and `test_lumina_tutor_session_units.py` 55/55; `typecheck:lumina` 0; full tsc 770 (baseline).

Live model drives: real backend + Gemini Live; browser receipts, DI cues (production strings) and text answers
simulated. **The saved drives ran on intermediate bridge code** (receipt held until the next spoken turn), since
reverted; they show the gaps, not the final relay.

| File | Result |
|---|---|
| `live-lesson-plan-first-drive-2026-09-16.json` | DI 5/5 items verbatim, handoff OK. Stalled on the last number-line challenge: the tutor closed and never called `advance_activity` (G2). |
| `live-lesson-plan-2026-09-16.json` runs 1–2 | Clean: DI closing → one transition → number line → one closing. |
| same, run 3 | The tutor started item-2 right after the last DI affirmation; closing line and transition lost (G1, G3). |
| `live-lesson-plan-reversed-2026-09-17.json` (synthetic order) | The DI opening cue cut off the tutor's transition (`ai_interrupted`); an extra closing sentence after the DI closing (G2, G3). |

Held in all 5: first call `start_plan_item(item-1)` with no greeting; DI asks and corrections verbatim; number-line
intros and hints never stated the landing number; `advance_activity` only after a correct answer.

Browser (`live-lesson-plan-browser-2026-09-17.json`): real Chromium, page, backend and Live; silent fake mic, no
speech. 18/18: package loads and projects; connect sends identities only; item-1 starts; the real TenFrame mounts
and its receipt carries the plan item; no generation request; `activity_ready`; DI opening cue sent and spoken
verbatim with no tutor speech before it; progress list; objective filter mounts the real NumberLine alone and the
intro omits the answer. Not covered: completion → next item (needs spoken answers).

Harness notes: Chrome's default fake mic beep holds a manual-VAD turn open and the tutor never answers
`[LESSON_START]`; use `--use-file-for-fake-audio-capture` with a silent WAV. A later batch ran against a uvicorn
whose `--reload` printed "Reloading..." and never restarted; it was discarded.

## Good / bad

Good: prepared content starts in about 1.5 s with no generation wait; the DI runner is unchanged and verbatim.
Bad: completion and handoff are not predictable (3 of 5 drives). Product: ten-frame's closing "See you next time!
... the activity is over" is wrong in the middle of a lesson.

## Keep / change / stop

**Stop** phase 1 at this slice. **Keep** projection, adapters, prepared mounts. **Change** completion and ownership
handoff at the source, as LA-04 inputs G1–G3. Next: LA-01 baseline, then LA-04.
