# In-item support levers: number-line jump pilot, then rollout

Date: 2026-09-27 · Executor: `/add-support-tiers` (with `/add-live-tutor-tools` for the shared runtime piece) · Design: `src/components/lumina/docs/SUPPORT_LEVERS_BRIEF.md`

## Why this exists

When a learner fails the item the manifest chose, the primitive should have a lever the tutor or JEV can pull on that item, so the learner gets part of it right and then finishes the full item. Today no primitive has one: on number-line, fraction-circles, rhyme-studio and ten-frame, the tutor's only in-item move is `begin_help`, which records help and changes nothing on screen.

## User rulings (2026-09-26 and 09-27), do not reopen

1. Know in advance why learners fail each primitive, and build levers for it into the primitive. No scripted tutor responses.
2. Two kinds of lever, one skill: **help** (the representation shows or does more) and **simplify** (the same task, one step simpler in shape, built by code). Structural difficulty is a subset of support; `/add-structural-difficulty` is retired.
3. The manifest's choice of primitive and eval mode is right; levers make that item teachable. No within-mode β, rungs or routing.
4. A missing prerequisite is acted on at the end of a lesson, in the next lesson (a Lesson Builder fill mode), never as an in-moment detour. The detour is parked on the local branch `park/la15-prerequisite-detour` (`e4855c3b`).
5. Detour work is ungraded; a fresh parent item checks transfer (handoff 17, ruling 1). The simpler item of a simplify lever falls under this.

## State at handoff

- `/add-support-tiers` rewritten to the two-lever design; a ten-frame dry run found 8 doc defects, all fixed. The second dry-run round has not run: this pilot is it. Report any place the skill was wrong.
- The number-line range defect is fixed (`qa/eval-reports/number-line-display-range-2026-09-27.md`): jump items no longer fall off the displayed line (0 of 48 in real draws), and the journey driver now refuses content a lesson would refuse.
- Check `git status` first: the rewrite, the range fix and these docs may still be uncommitted in the working tree. Commit them with `/ship` before editing the same files.

## Phase A: the pilot (this session)

Primitive: `number-line`, mode `jump` (contract: `docs/contracts/number-line.md`). Run `/add-support-tiers` on it. The failure inventory and gap table are already drafted in the brief's audit section; start from them.

**1. Fix the jump leak first (it is a lever defect on this item).** The easy tier's worked arc has an arrowhead at the landing (`NumberLine.tsx:946-948, 1196-1206`), which states the answer. The easy tier's pulled help lever must not do this.

**2. Build the shared lever mechanism once**, under `/add-live-tutor-tools` rules. It changes shared code, so run the Counting Board and Shape Sorter regressions, and the full `components/live-activity` suite:
- the scene publishes `levers` (`id`, `kind`, `when`, `does`, `carrier`, `pulled`) and a synchronous `pullLever(id)`; `useTeachingWorkspace` offers a tutor operation `pull_lever { lever }` that validates, calls `session.assist()`, and commits;
- the attempt record carries the lever that was pulled (`TeachingAttempt` in `TeachingSession.ts` has no field for it today);
- a simplify lever can put a simpler item in front of the learner and return to the original. `TeachingSession` fixes its item ids at construction (`TeachingSession.ts:50`), so this needs a designed change: the simpler item is ungraded and never advances the session;
- the scene fact names which levers are pulled, without stating the answer;
- the runtime and the backend name no primitive. Levers are declared by the component and adapter.

**3. Build the number-line levers:**
- help: **numbered hops on the learner's own arc**, from the start, one hop at a time. The LA-15 demonstration already draws unit hops with labels (`demo/demoContract.ts`, `demo/DemonstrationView.tsx`); reuse the drawing, not the component. Leak rule: never draw to or past the landing.
- simplify: **one operation instead of two** on a chained (hard) jump, and **a smaller change** on a single jump, built by code from the current item. Leak rule: never the learner's own start and change, and the answer is recomputed.
- Record the lever on the next attempt: `jumpResponses` already logs `arcShown`, so extend that.

**4. Fix the harness gap the bench depends on.** A journey can report PASS without the correct answer being credited (the 2026-09-26 number-line run). The lever journey must assert the credit.

## The live bench (the gate for Phase B)

Add a `--lever` journey to `backend/tests/tutor_live/run_live_runtime.py`, beside `--demonstration`, driven through `liveJourneySpec.ts`. The learner gives a wrong answer and then says they are stuck, without naming a tool. Run `--runs 3 --lesson-entry --lever` on a jump item, plus one `--audio` run. It passes when, in every run, all of these hold:

1. **The tutor pulls a lever unprompted,** from the wrong answer and the stuck turn. Record which lever it pulled.
2. **The screen changes before the tutor describes it.** The visible receipt comes before the narration; read the transcript.
3. **Nothing leaks.** No frame and no scene fact states the landing.
4. **The attempt after the pull is recorded as assisted,** with the lever named.
5. **The learner reaches the full item and answers it correctly.** Only that unaided answer is credited; a simplify item's work is not.
6. **The lesson continues normally afterwards.**

Also run the misconception and oracle suites for number-line, and file a HUMAN-CHECKS row (next free ID is #171) for a browser sitting. A JSDOM pass is not a human pass.

Report: `qa/eval-reports/number-line-levers-<date>.md`, with the bench transcripts summarized and the raw JSON kept. Update the brief's status, `PRIMITIVE_LIFECYCLE.md` (the L3 detection signal becomes real), and the skill's "Status" note (the lever mechanism now exists; name its real symbols and line numbers).

## Phase B onwards: rollout (only after the bench passes)

> **UNBLOCKED 09-27:** handoff 19 slices 1-4 landed. B1, B2 done. Next is a class (A2 number manipulatives), gated per primitive by vitest; Live is 1-2 runs for the class after it passes (user 09-27). Order: `WORKSTREAMS.md` Phase 3.

Once the gate passes and the user has seen the report, set this as the session goal. Run one primitive at a time: never a workflow sweep. Each primitive goes through `/add-support-tiers` end to end, and each one's live bench (the same six checks) must pass before the next starts.

| Phase | Primitive | Why this order | Known first steps |
|---|---|---|---|
| B1 | `ten-frame` | Manipulative, K–2; a lever table already drafted by the dry run | Start from the ten-frame appendix in the brief; `present` already exists for subitize  **BENCH PASSED 09-27:** all six checks met in every run that started, text and audio (`tutor-reports/ten-frame-levers-2026-09-27/lb8-final-*`, `lb10-audio.json`) |
| B2 | `fraction-circles` | The clearest "missing degree of freedom" case | Fix the identify easy-tier caption leak first (`/eval-fix`); run `/primitive-contract` (no contract doc exists) |
| C1 | `rhyme-studio` | First literacy and first pre-reader case: every lever needs a voice carrier | Run `/primitive-contract` first; levers act on a model pair outside the item (a rime highlight answers recognition); check the stale `aiDirectives` |
| C2 | one primitive of a different archetype, chosen with the user | Tests that the design holds outside math manipulatives | Pick from the diagnosis log (`logs/demonstrations/`) where real diagnoses recur |

After each phase: update the brief's audit table, the primitive's contract, and `WORKSTREAMS.md`. Stop and report to the user at the end of each phase letter (B, C). If a primitive shows the shared mechanism is wrong, fix it once in the shared layer and re-bench the earlier adopters; do not fork per primitive.

## Open defects to know about (queue them; not in the pilot unless named above)

From the brief's defect table:
- number-line topic fidelity: tens topics get hops of 1–5, and "starting at 5 to 9" is not enforced (`/topic-fidelity`);
- rhyme-studio: the K tiers do nothing, and `remediationMove` is never read;
- the number-line tool-lab `runtimeHint` is set and never rendered;
- rhyme-studio's β jumps 2.5 from identification to production (`/lumina-densify-primitives`).

## Gotchas

- **A backend edit kills a running drive.** Editing any file under `backend/`, including the harness, reloads uvicorn and closes the drive with ws 1012. Wait for the reload before driving.
- **Some runs fail at lesson start.** The Live model sometimes never speaks its lesson opening. That is a session-start issue, not this work; rerun the drive, and record how many runs failed that way.
- **`run_live_runtime.py` and `liveJourneySpec.ts` are shared with other sessions.** Stage only your own hunks.
- **Read the frames and transcripts yourself.** Past bench judges missed leaks that a person reading the output caught.
