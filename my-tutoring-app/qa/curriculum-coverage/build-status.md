# Design studio build queue

Implementation state is separate from the atlas's frozen curriculum coverage review. A built task does not automatically satisfy its curriculum objectives.

| Design / work item | State | Next work |
|---|---|---|
| Letter Workshop / `letter-writing` | Trace/copy/write practice built 2026-09-07; 52 references, stroke capture, preserved retries, mode routing, local-only copy/write feedback, mode-aware tutor scaffold, support tiers, and scoped structural difficulty | Verify full live coaching, manuscript templates, actual cue audio, and child/device tolerances; calibrate copy/write before adaptive submission. [Mode verification](../eval-reports/letter-workshop-modes-2026-09-07.md). [Birth and ordered queue](../eval-reports/letter-workshop-birth.md). |
| You & Me / `you-and-me` | Built 2026-09-07 (on `main` at `6a52b07c`): spoken I/you perspective sentences, `describe_action` / `describe_independent_action`, voice-judged via `useJudgedScriptRunner`; support tiers implemented, structural assessment found no within-mode lever | Real browser/microphone acceptance owed. [Birth](../eval-reports/you-and-me-birth.md). |
| Story Bridge / `story-bridge` | Built 2026-09-07 (L0 + L2, judged-loop gesture birth): two stories read aloud, tap the far-shore character who acted alike (`match_character`); 5 live draws, 14 script tests, headless DI drive PASS 3/3 refused + 3/3 affirmed, K fit MATCH | Browser/mic sitting owed; `/add-eval-modes` for settings, spoken alike/different, Venn, sequences (6 more requirements). [Birth](../eval-reports/story-bridge-birth.md) · [Eval](../eval-reports/story-bridge-2026-09-07.md). |
| Story Ribbon / `story-ribbon` | Built through L5 on 2026-09-08: pictorial three-event retelling; tense-open, present, future, past, and story-to-experience modes; tutor scaffold; support tiers; narrative-shape difficulty; procedural sound. Post-fix cues aligned 27/27; pinned, mixed, blended, tier and structural checks passed. | Human tablet/browser, microphone, privacy-decline, wrong-tense, and by-ear sound acceptance remains owed before adaptive mastery credit. [Birth](../eval-reports/story-ribbon-birth.md) · [Eval modes](../eval-reports/story-ribbon-evalmodes-2026-09-08.md) · [Tutor](../tutor-reports/story-ribbon-2026-09-08.md). |
| Other 8 studio designs | Proposed | Their original bounded first tasks remain in the studio. |

Open `/lumina` → Developer Tools → Language Arts to inspect the four built designs. Human touch/microphone/audio checks remain pending where noted above.

The atlas reads the structured twin of this table, `build-status.json` (design, work item, primitive, state, what was built / verified / still owed, reports). Update both in the same slice and rebuild with `node scripts/curriculum-coverage-artifact.mjs`.
