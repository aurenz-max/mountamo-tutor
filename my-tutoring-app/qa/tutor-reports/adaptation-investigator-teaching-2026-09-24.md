# adaptation-investigator: ungraded teaching surface, 2026-09-24

**Why.** User ruling after a morning K–1 session on "pink flowers": this primitive should be purely
teaching, with no What-Ifs and no grading. The session log (`backend/logs/lumina-sessions/2026-09-24-113655-lumina-tutor-974b0b2dcad9.jsonl`,
08:45–10:48) shows the tutor was never given the primitive's content. The switch message said
"No specific scaffolding instructions for this primitive type", and all six tutor replies were
general lines about pink flowers attracting pollinators. The generator also collapsed every grade to
the 5–6 band.

## What shipped (working tree, not committed)

| Layer | Change |
|---|---|
| Catalog type | `teachingWorkspace.ungraded?: true` |
| Binding rule | `pinBindsWorkspace`: an ungraded family binds unpinned content only (`UNGRADED_MODE = 'mixed'`) |
| Adapter | `workspaceAdapter` gives an ungraded family `modes: ['mixed']` and `TEACHING_DOCTRINE` (691 chars) instead of `WORKSPACE_DOCTRINE`; `teachingOpening` counts `totalSteps` |
| Runtime | `progression: 'observer' \| 'learner'`; learner signals and the learner-turn observation ride on either; the outcome observer stays `observer`-only |
| New hook | `runtime/useTeachingSurface.ts`: scene, one `show` tool, `finish`, `learnerOpened` |
| Primitive | Tutor path: picture draws itself, cards start closed, tutor rings (purple, `data-tutor-ring`), What-Ifs hidden, Done, no submission. Standalone path unchanged |
| Generator | Sixth copy of the biology prose-grade defect fixed (`adaptationBand`): Grade 1 now generates `2-4`, before it was `5-6` |
| Harness | `teaching_surface` program in `run_live_runtime.py` (turn loop lifted to `workspace_turn`); journey row `execution: 'teaching'`; driver exposes `getComputedStyle` (Radix); `tutor-test` route serves `&live=1` content for workspace families without a tutoring block |

## Checks

- `AdaptationInvestigator.workspace.test.tsx` 5/5. `components/live-activity` + biology: 508/508, including the generic W1 contract on the saved payload (`w1-payloads/adaptation-investigator.mixed.json`).
- `typecheck:lumina` 0; full tsc 770 (baseline 770).
- Connected journeys (real Gemini Live, `--lesson-entry`, saved Grade 1 pink-flower payload): **2/3 PASS**. Run 3 lost the provider twice (`session_resuming` at 35 s and 66 s, right after a visible `show`) and timed out. That was the provider, not this code.
- Earlier runs found two defects, both fixed. (1) The driver crashed on mount (`getComputedStyle`). (2) When the learner tapped a card open, nothing reached the tutor, which stayed silent, so a card opened by a pre-reader went unexplained. The tutor now receives one host-authored fact per card the learner opens.

## What the tutor did (passing runs)

It opened on the picture ("What do you notice about its petals?"). It answered the learner's
questions and asked a reasoning question back ("Why do you think the flower wants to be seen?"). It
used `show` on The Trait card with a visible receipt in every run. When the learner opened The
Environment card, it explained it ("full of green leaves, which makes it hard for little helpers to
spot the sweet treats"). No run recorded an attempt, submitted anything or voiced a verdict.

## Not verified

- Browser and microphone with a real child: HUMAN-CHECKS #167. JSDOM and typed learner turns are not acceptance.
- A spoken learner channel (`--audio`) was not run. Nothing is graded, so it would test transcription only.
- Whether the lesson shell's Next behaves well after Done in `LessonScreen`: completion goes through the same `requestCompletion` path as other workspace families, but this was not driven in the lesson host.
