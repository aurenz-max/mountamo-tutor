# Birth certificate — `di-word-problem-setup` — 2026-09-10

The third "DI for Older Learners" pack (design brief 2026-09-07, concept 4;
handoff `qa/HANDOFF-di-word-problem-setup-2026-09-07.md`), and the family's first
math pack that MIXES hands and voice inside one problem. User ruling 2026-09-10:
*"build di-word-problem-setup next with the big_number step as the hybrid pilot."*

## L0 record

| Field | Value |
|---|---|
| Core task identity | Connecting Math Concepts number family for one-unknown addition/subtraction stories: PLACE the big number at the arrowhead (hands), SAY the family (voice), say add/subtract, work it |
| Fork | A — code-owned pool. `diWordProblemPlan.ts` builds every story (9 frames: comparison ×3, change ×4, part-whole ×2), the numbers, the family and the answer; Gemini emits only THEMES (two names, a plural noun, a gain/loss verb pair) plus an answer-free title/description |
| Answer kinds | `big_number` = `gesture` (`manipulation`, verdict computed in code by `bigNumberVerdictCue`); `classify` / `operation` = `closed_set_choice`; `family` = NEW class `equation_statement` (accepted-build-ahead); `solve` = `number_word_to_20` (`number_word_to_120` past 20) |
| Eval modes (β mirrors `problem_type_registry.py`) | `find_big_number` 2.5 (place + work) · `build_family` 3.5 (place + family + operation + work) · `classify_and_build` 4.5 (name the kind first) |
| Cue tags | `[WPS_ITEM]` `[WPS_BIG]` `[WPS_MOVE_ON]` `[WPS_HEAR]` `[WPS_COMPLETE]` |
| Answer-leak audit | The ask never names the big number, the family or the answer; the story is the only exempt span (plus the classify/operation menus); the answer word is refused if any token of it appears in the story (hyphens split); every quantity ≥ 2; the two printed numbers are distinct and neither equals the answer |
| Scribe | Nothing drawn before it is affirmed: the chip locks at the arrowhead, the family slots fill, the sign and working line appear, the box fills, the bar model grows; a move-on draws the step CARRIED (dim amber) |
| Curriculum home | `/curriculum-fit` — see below |

## Why the hybrid is at the pack level, not inside one item

The runner already supports gesture items (`answerKind: 'gesture'`, the stillness
close, the bracket hold) and voice items. This pack sequences them inside one
story — hands for POSITION (which amount is the whole), voice for the FAMILY —
which is the user's 2026-08-13 ruling exactly (tap only for position/form/build).
A within-item "do, then say" (open the mic after the stillness close) was NOT
built: it would touch the shared runner and the Python harness for no
pedagogical gain over the sequenced form, where the child places, hears the
verdict, and then says the family with the placement on screen.

## Machine evidence (2026-09-10)

- `npm run typecheck:lumina` → **0**.
- `diWordProblemPlan.test.ts` 18/18 · `diWordProblemScript.test.ts` 26/26 ·
  `DiWordProblemSetup.stage.test.tsx` 10/10 (placement arms stillness, the commit
  hands the runner the `[WPS_BIG]` cue with the match computed in code, remove
  clears, correction retry clears, judging deadens the board, affirmation locks
  the chip / hides the bank / draws the bar model, family affirmation fills the
  slots, a move-on carries the placement dim). Contract + drive-plan suites
  193/193; direct-instruction folder + components 400/400.
- `scripts/affordance-coverage.mjs`: entry tagged (`reader: 'developing'`,
  `answers: ['spoken', 'manipulate']`).
- Live generation via `/api/lumina/tutor-test?componentId=di-word-problem-setup&probe=1&di=1`,
  one draw per mode: `build_family` G2 within 20 → 3 stories / 12 items ·
  `find_big_number` G1 → 3 / 6 · `classify_and_build` G3 "within 100" → 3 / 15
  (`number_word_to_120` on the solve steps). **0 drops, `packGateIssues: []`**
  in all three. Themes seen: marbles / shells / stickers / apples; Sam, Leo, Mia,
  Ben, Zoe, Max; "gave away / give away", "bought / buy". Every story and cue read
  by eye.
- Two content fixes from the eye-read, both in the plan, both re-gated: answers
  of ONE ("sixteen of the seventeen", "nine fewer than ten") broke every plural
  in the answer sentence and were trivial → every quantity ≥ 2; the change-story
  labels "at the start" / "now" made the affirmation ambiguous ("the big number
  is at the start") → "what Sam started with" / "what Sam has now" / "what Sam
  gave away".

## Headless drives (`run_tutor_live.py --component di-word-problem-setup`)

All on a fresh `build_family` G2 draw (3 stories / 12 items: 3 hands, 9 spoken;
0 drops, `packGateIssues: []`), TEXT answers — the judge's semantics, never the mic.

| Drive | Result | Report |
|---|---|---|
| `--di` plain | **PASS, no findings.** 40 beats. Hands-hold SILENT 3/3 (0 audio bytes); every wrong placement drew the scripted correction and every right placement the affirmation (3/3 + 3/3); every spoken step refused the plain wrong and affirmed the right (9/9 + 9/9); the complete line closed the run. | `qa/tutor-reports/di-word-problem-setup-live-di-plain-2026-09-10.md` |
| `--di-wrong signature` | **PASS, no findings.** A second fresh draw (comparison:difference, change:loss_change, part_whole:part — three subtraction families). The upside-down family ("fourteen plus five equals box") drew the `misplaced` branch 3/3 ("My turn: the big number goes last, after equals…"); the story-verb operation ("add") refused 3/3; the wrong-way number (19 for 14−5, 27 for 16−11) refused 3/3; "the biggest number I see" placement corrected 3/3. Note: on the comparison story the judge answered a bare "add" with the contrast branch rather than the from-the-story branch — the contract reserves that branch for an answer that gives the story's word as its reason, and the plain drive's comparison story did draw it ("My turn: the story says more, but the family decides"). | `qa/tutor-reports/di-word-problem-setup-live-di-signature-2026-09-10.md` |
| `--di-cap` | **PASS with WARNs.** A third fresh draw. The first spoken item (a family) was drilled wrong three times; the move-on CARRIED the family verbatim into the next ask ("Good try. Three plus box equals thirteen. Do you add or subtract?") and the rest of the session ran clean (11/11 both directions). The 2 WARNs are `di-correction-verbatim-repeat` — item 30's family-wide shape (the same correction word for word on the second and third try), a doctrine call the handoff put out of scope. | `qa/tutor-reports/di-word-problem-setup-live-di-plain-cap-2026-09-10.md` |
| `--di-bench` (the `equation_statement` key, 7 stimuli / 57 probes) | **Class gate PASS — zero false affirmations in every refuse bucket**: `big-number-misplaced` 6/6, `operation-not-family` 4/4, `family-incomplete` 6/6, `echo` 2/2, `wrong-verdict` 4/4, `wrong-number` 2/2, `off-task` 14/14; `valid-canonical` 7/7, `valid-paraphrase` 11/11. **1 missed valid** (the report's HIGH): the hesitant fragmented family "um, twelve… and then eight… is, box" drew the incomplete branch. Fix: the accept clause now states a family said in pieces with "um" / "and then" / "is" between the parts is whole, with the item's own fragmented form as the example. The WARNs are item 30's verbatim-repeat shape. | `qa/tutor-reports/di-word-problem-setup-live-di-bench-2026-09-10.md` |
| `--di-bench-item wpsb-cmp-big-family` (after the clause fix) | **PASS — 12/12 agreed, 0 missed valid, zero false affirmations.** "um, twelve… and then eight… is, box" AFFIRMED; `big-number-misplaced` 2/2, `family-incomplete` 2/2, `echo` 1/1, `off-task` 2/2 still refused. (The first attempt died with ws 1012 — a concurrent session saved a backend file and uvicorn reloaded mid-drive; the relaunch is the record.) | `qa/tutor-reports/di-word-problem-setup-live-di-bench-wpsb-cmp-big-family-2026-09-10.md` |

Full `tsc --noEmit`: 771 errors against the last recorded baseline of 770; no error line names
a file from this slice, and `typecheck:lumina` is 0 — the extra one is in the concurrent
sessions' uncommitted work, not confirmed by bisection.

## Curriculum fit (`/curriculum-fit di-word-problem-setup`, 2026-09-10)

Report: `qa/curriculum-fit/di-word-problem-setup-2026-09-10.md`. G1 `find_big_number` **MATCH**
(`OPS001-07-b` 0.818 5/5) — an honest home the pack over-serves. G2 `build_family`: the honest
homes exist (`OPS002-01-c` "by selecting the correct operation", `OPS002-02-c` "distinguish
take-away and compare prompts" — the only G1–4 subskills whose stated act IS setup) but rank
3–4 behind the G2 two-step subskills. G3 `classify_and_build`: **curriculum gap** — no
one-step addition/subtraction word-problem subskill is published at G3. G4: wrong-fit.

Two attribution defects found and fixed in this slice: (a) no `_PRIMITIVE_TO_SUBJECT`
override — a live G3 session scoped to LANGUAGE_ARTS; `di-worked-procedure` and
`di-word-problem-setup` → MATHEMATICS with a test; (b) `metrics.evalMode` absent on all three
older-learner packs → `eval_mode: 'default'`; added. The eval-mode descriptions now say
"one-step addition or subtraction word problem".

## Follow-up queue

| Layer | Item | Executor |
|---|---|---|
| L5 sitting | `equation_statement` class sitting on a fresh draw; the mic/eyes row | user |
| L3 | `medium` vs `hard` identical (only `easy` re-reads the story) | `/add-support-tiers` |
| L4 | two-step stories; three-quantity part-whole; multiplication families | `/add-structural-difficulty` |
| L1 | `unrelated`-style distractor quantity (a fourth chip that belongs to no slot) | `/add-eval-modes` |
| runner | within-item "do, then say" (mic opens after the stillness close) — only if a pack needs the SAME item to carry both | `/add-di-loop` |
