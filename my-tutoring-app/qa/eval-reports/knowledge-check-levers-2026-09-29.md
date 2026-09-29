# knowledge-check levers, 2026-09-29 (handoff 25)

Executor: `/primitive-contract` then `/add-support-tiers`. Scope: the closing check used in every subject.

## Result

- Two levers on closed-set choice items (`choice`, spoken; `choice_tap`, touched), in all four modes:
  - `cue_picture` (help, shown and voiced): a generated picture of what the question is about, shown beside the question.
  - `drop_far_choice` (simplify, on the item): greys out one wrong choice the learner has not picked. Numeric menus pick the one farthest from the key; text menus pick one the generator tagged `far`.
- Generator: every MCQ option now carries `distance` (`key` / `near` / `far`, a schema enum). At recall/apply/mixed the problem may also carry `cue {picture, shows}`.
- Sweep: all four modes show `levers`, no open misses (J9 green). Every other miss is catalog `unanswered`, with a reason.
- Production code: ~115 lines (`knowledgeCheckLevers.ts`, ~60 in `KnowledgeCheck.tsx`, ~30 in the generator/types/catalog). Tests: ~230 lines.

## Failure inventory and lever table

Evidence classes: no real-learner evidence exists for KC. Tap misses come from the miss function (observed-synthetic on the sweep). Spoken misses are documented (Part B `knowledgeCheckSpokenMisses`). Distractor quality is inferred.

| Item kind | Miss | Lever | Kind | Leak rule (code) |
|---|---|---|---|---|
| choice / choice_tap, text | `other_choice` | `cue_picture`, then `drop_far_choice` | help, simplify | cue: withheld if a picture equals an option emoji or appears in an option, if `shows` shares a word or word start with a choice (words in every choice exempt), if there are more than 3 pictures, or if the key is a number. drop: never the key, never a picked choice |
| choice / choice_tap, numeric | `one_less`, `one_more`, `other_number` | `drop_far_choice` | simplify | the farthest from the key goes; at least 2 untried choices remain |
| choice / match / sort | `two_choices` | unanswered | — | a hedge between the key and a near choice; greying a far one does not settle it |
| match / sort | `said_card_back` | unanswered | — | no answer was given; the tutor asks again |
| true_false | `opposite_verdict` | unanswered | — | a two-way judgement is already the smallest; a picture of the statement can show the verdict |
| point_to | `sign_token`, `other_number_token` | unanswered | — | `token_roles` (draft) not built in this handoff |
| blank | `other_bank_word` | unanswered | — | `shorter_bank` (draft) not built |
| how_many | `said_start`, `one_short`, `one_over`, `short_by_more`, `over_by_more` | unanswered | — | `group_in_fives` / `smaller_count` (draft) not built |

The ruling on removing a choice (09-27) holds: the pull records the lever, so the next attempt is assisted and `diagnosisEvidence.firstResponseScore` is 0. A spoken wrong answer does not say which choice it was, so every wrong attempt counts as one tried choice, including one not yet retried. So **a 3-choice menu (all K menus) offers the drop only before any wrong answer**. After a wrong answer, the only lever at K is the cue. There is no single-try item on the workspace path (`observerLever.ts`), so the "not on a single try" rule never applies.

## Measured

- **Near/far tag, 12 Flash generations** (4 modes × math "Adding within 20" G1, science "Plants" G2, literacy "Nouns and verbs" G2) plus 3 more after the prompt change (2 K). All 15 MCQs were tagged. Each had exactly one `far`, and each `far` is plausible as the one to rule out: "The" for "which word is the action verb", 2 for 7+5, "Only the toy car", "Turn on a flashlight".
- **Cue:** 4 of 7 recall/apply items got a cue in the first pass. None pictured a choice. Two added nothing (📖 "open book" and 🏡🌳 on grammar items). One (🪟 "sunny window") hinted at the key's reason ("…and sun"). Fixes: word-start matching in `cueLeak`, and the prompt now leaves the cue empty for word/sentence questions and for hints at why the answer is right. The re-probe gave literacy 0 cues, science 🪴 "a potted plant", K 🌱 "growing plant" for "which is living" and 🔥 "burning flames" for "puts out fires". **The cue's teaching value is modest:** it pictures the question's subject, which the question already names. That helps a weak reader more than a learner who misunderstands the concept.
- **Leak tests on saved payloads**, 15 files across math, science, literacy and social studies: no pulled lever shows or names the key.
- **Mounted pull test** (`KnowledgeCheck.levers.workspace.test.tsx`): the cue appears in the pull's commit. After a spoken wrong answer on 3 choices, no drop is offered. A touched 4-choice item greys out the farthest choice, which can't then be touched. The credit is `assisted` with the lever recorded.
- **Tutor replay** (text, `gemini-3.8-flash`, 9 payloads × 5): stuck and lever moments were 0/40 on every check, including "no change before receipt". The 8 `no_key_before_try` hits are the tutor reading the choice menu aloud ("Your choices are 4, 5, or 6"), which the guidance requires; the check misfires on menus. `qa/tutor-reports/replay/knowledge-check-2026-09-29.json`.
- Gates: `typecheck:lumina` 0; tsc 770 = baseline; KC vitest 105/105; journey sweep green for every KC payload. The one failing sweep row, `word-sorter.ternary_sort`, belongs to the concurrent literacy session's untracked payload.

## Findings

1. **KC-UB: half the G1-2 generations cannot run on the workspace (existing).** 6 of 12 single-problem generations build no judged item, so the set falls back to the tap flow, where there is no tutor and no levers. Causes: the question is over `MAX_PROMPT_WORDS` (24), which hit science apply/analyze/evaluate and math evaluate ("Look at the two plant pots…" scenario stems); or the key word is in the stem of a "which word in this sentence" question (literacy recall/apply, the class-11 gate). The fork is all-or-nothing per set, so one such problem sends a whole lesson's check to the tap flow. Executor: `/eval-fix` (G2+ stem bound in the generator, as G1 has; and a scoped exemption for quoted-sentence questions). The six payloads are kept in `qa/eval-reports/knowledge-check-levers-probe/` and feed the tag and leak tests.
2. **Scoring interaction (handoff 19 item 9b, not touched).** The shared `outcome.score` ignores `assisted`. So a lever pulled before the first try, followed by a right answer, scores 100 on KC's per-problem submission and counts in KC's `firstTryCount` metric. The runtime's `firstResponseScore` still scores it 0. This belongs to the 9b ruling, not to KC.
3. Replay check `no_key_before_try` flags a menu read aloud (see Measured). Owner: `replay_checks.py`.

## Not done

- Starting positions from `config.difficulty`: KC has no tier harness, and its per-problem `difficulty` is the model's own label, so no lever starts pulled.
- Live: knowledge-check is its own class. The Live pair waits until every mode is levered and handoff 21's readiness rule is met. All four modes now show levers on their measured items; the unlevered kinds are unanswered by decision.
- Browser check: HUMAN-CHECKS #178.

## Fix: KC-UB (`/eval-fix`, handoff 28 row 1), 2026-09-29

Finding 1 above is kept as the original evidence (6/12 unbuildable). What the fix found and changed:

- **Three causes, not two.** The stem cap and the quoted-sentence rule were confirmed on the six saved payloads. The first
  probe run found a third: `blankSpokenSentence` recognised `____`, `[blank]` and `{{blank}}` but not `[blank_N]`, the marker
  the generator's schema requires. So every generated `fill_in_blanks` problem built no item and sent its set to the tap flow.
- **Changes.** `knowledgeCheckScript.ts`: the gap regex takes `[blank_N]`; the class-11 stem check ignores a quoted span when
  that span contains every word of every option (`stemOutsideMenuQuote`), so "Which word in 'The dog barks.' is the verb?"
  builds, while a quote holding only the key, or the key named again outside the quote, still drops.
  `gemini-knowledge-check.ts`: at `elementary` other than Grade 1 (which keeps its 16-word rule), MCQ/TF/blank prompts carry a
  20-word read-aloud bound and forbid describing a picture the learner cannot see; `generateFromPlan` runs the real build
  gate (`itemsFromProblems`) on each K-5 problem and redraws once when the workspace could not ask it. Middle school and up
  are unchanged and still use the tap flow for long stems.
- **Probe** (`scripts/kc-spoken-stem-probe.mjs`, orchestrated sets of 3, Flash): 6 G2 cells (science analyze/evaluate/apply,
  math evaluate, literacy recall/apply) + G1 science analyze + G7 science analyze + K literacy recall.
  - Run 1 (stem bound + quote rule, before the blank fix): **5/9 sets** on the workspace; 4 redraws. Failures: two
    `[blank_1]` problems, one G1 sort with a 5-word group label ("What Plants Do Not Need"), G7 46-word stem (by design).
    `qa/eval-reports/knowledge-check-spoken-stem-probe-run1/`.
  - Run 2 (all changes): **9/9 sets**, 27/27 problems buildable, 1 redraw. Every G2 MCQ/TF stem 10-20 words.
    `qa/eval-reports/knowledge-check-spoken-stem-probe/`.
  - Both saved literacy payloads now build (vitest).
- **Still open (not KC-UB).** Two content defects seen in run 2 items, left for their owners: math evaluate G2 keyed "Make ten
  first by grouping 2 and 5 to get 7" (not a make-ten strategy) over a better distractor; science analyze G2 asks "Why is
  Plant A healthy…" with no picture of Plant A (R5; K-5 visuals are planned only at Grade 1). One run of 9 sets is supporting
  evidence, not a rate; the redraw is a single retry, so a problem that fails twice still sends its set to the tap flow.
