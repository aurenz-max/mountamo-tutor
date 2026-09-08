# Design studio build queue

Implementation state is separate from the atlas's frozen curriculum coverage review. A built tracing task does not automatically satisfy the four formation objectives.

| Design / work item | State | Next work |
|---|---|---|
| Letter Workshop / `letter-writing` | Trace/copy/write practice built 2026-09-07; 52 references, stroke capture, preserved retries, mode routing, local-only copy/write feedback, mode-aware tutor scaffold, support tiers, and scoped structural difficulty | Verify full live coaching, manuscript templates, actual cue audio, and child/device tolerances; calibrate copy/write before adaptive submission. [Mode verification](../eval-reports/letter-workshop-modes-2026-09-07.md). [Birth and ordered queue](../eval-reports/letter-workshop-birth.md). |
| You & Me / `you-and-me` | Built 2026-09-07 (on `main` at `6a52b07c`): spoken I/you perspective sentences, `describe_action` / `describe_independent_action`, voice-judged via `useJudgedScriptRunner`; support tiers implemented, structural assessment found no within-mode lever | Real browser/microphone acceptance owed. [Birth](../eval-reports/you-and-me-birth.md). |
| Story Bridge / `story-bridge` | Built 2026-09-07 (L0 + L2, judged-loop gesture birth): two stories read aloud, tap the far-shore character who acted alike (`match_character`); 5 live draws, 14 script tests, headless DI drive PASS 3/3 refused + 3/3 affirmed, K fit MATCH | Browser/mic sitting owed; `/add-eval-modes` for settings, spoken alike/different, Venn, sequences (6 more requirements). [Birth](../eval-reports/story-bridge-birth.md) · [Eval](../eval-reports/story-bridge-2026-09-07.md). |
| Other 9 studio designs | Proposed | Their original bounded first tasks remain in the studio. |

Open `/lumina` → Developer Tools → Language Arts → Writing → Letter Workshop. Live mouse QA passed; physical touch/stylus and live tutor audio are still pending.

The atlas reads the structured twin of this table, `build-status.json` (design, work item, primitive, state, what was built / verified / still owed, reports). Update both in the same slice and rebuild with `node scripts/curriculum-coverage-artifact.mjs`.
