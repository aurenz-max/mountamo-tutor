# Shape Sorter's remaining siblings on the teaching workspace: count, sort, find_real_object

`identify` was the second workspace adopter ([2026-09-19 report](shape-sorter-teaching-2026-09-19.md)).
This slice adds its three siblings — `count`, `find_real_object` (challenge type
`identify-real-object`) and `sort` — so every catalog mode of `shape-sorter` now
binds the shared tutor/JEV teaching workspace, closing the item named in
[07-census.md](../live-runtime-handoffs/07-census.md)'s deletion-blockers table
("Sibling modes on a part-migrated primitive").

## What changed

- `shapeSorterDomain.ts`: `SHAPE_SORTER_WORKSPACE_MODES` now lists all four catalog
  eval modes (`identify`, `find_real_object`, `count`, `sort`), not just `identify`.
  `workspaceAssignment` and `workspaceScene` — previously naming-only — now branch on
  mode. Each publishes only what is actually drawn: `count` and a real-object
  `identify` show one object alone (no comparison pool, matching the standalone's
  `renderCountStage`/`renderRealObjectStage`); plain `identify` and `sort` show the
  ringed pool; `sort` additionally publishes the printed mats as their own
  demonstrable objects (`mat-0`, `mat-1`, …), since the standalone drill's mats are
  labelled at every tier, not withheld.
- `ShapeSorterTeaching.tsx`: rewritten (full-file replacement, per the React-editing
  rule) to render all four modes from one component — the gold-ringed pool, the
  single large counted shape with optional corner-hint dots, the single real-object
  figure, and the sort mats with a live read of which groups the session has already
  credited (from the session's own attempt history, not a local click map). Per-mode
  accuracy in the submitted metrics is now computed from the actual per-item scores
  instead of the old hardcoded `countAccuracy: 0, sortAccuracy: 0`.
- `shapeSorterLive.ts`: `validateShapeSorterData` now accepts all four challenge
  types (previously only `identify`), gating `identify-real-object` shapes to a known
  table id and disallowing real-object fields on every other type. `copy.lessons`,
  `guidance` and `lessonStart` cover all four modes; `lessonStart` moved onto the
  shared `workspaceLessonStart` helper other multi-mode adopters use.
- `liveJourneySpec.ts`: the shape-sorter journey's `inputsFor` was hardcoded to a
  three-shape-name wrong-answer list, which only made sense for `identify`. It now
  uses the shared `spokenWorkspaceInputs` helper with `shapeSorterHarnessAnswers`
  (already defined in the domain for the DI-era judging contract), the same pattern
  `--trains`/`--letters`/`--words` use.
- `scripts/learner-intent-probe.mjs` and `scripts/tutor-verdict-probe.mjs`: the
  `--shapes` case set was `identify`-only. Both now carry `count`, `sort` and
  `find_real_object` cases and item fixtures, built from the same domain functions
  the component calls.

## Tests

- New `ShapeSorterTeaching.test.tsx` (real `ShapeSorter`, real `TeachingSession`,
  real `LiveLessonRuntime`, real transport and rendering shell — no mounted test
  previously existed for this primitive's workspace path at all, not even for
  `identify`). 21 cases across all four modes: per-mode advertised affordances, what
  each mode actually renders (single object vs. pool vs. mats), that no scene fact
  ever states a learner response, that the published assignment/scene match
  `workspaceAssignment`/`workspaceScene` exactly (the same contract the verdict
  probe replays), TW-2 (hold vs. advance), TW-4/8/9 (demonstrate marks a shape or a
  mat without an attempt, an unknown mat id is refused, clearing a mark keeps the
  help history), TW-3 (speech is context until a tutor verdict commits it), stale
  response-id refusal, one full observed-and-completed run, stop-refuses-everything,
  and the registry row (modes/guidance/copy/validate).
- `ShapeSorter.runtime.test.tsx` (the standalone drill, unaffected — it never sets
  `runtimeEvalMode`, so `pinBindsWorkspace` always routes it to the scripted
  controller) still passes unchanged: 144 tests across the 8 directly touched files.
- Updated three tests that asserted the old partial-binding state as a *feature*:
  `withTeachingWorkspace.test.tsx` (shape-sorter was the worked example of a family
  that binds only `identify`; it now uses a synthetic modes list for that mechanism
  test, since no real family is partially bound any more), `activityContract.test.ts`
  (`modes` now lists all four; `count`/`sort`/`find_real_object` requests no longer
  throw), and a stale comment in `lessonWorkspacePlan.test.ts` (the assertion itself
  was unaffected — it fails for content mismatch either way — only the reason changed).
- Full suite: `typecheck:lumina` 0; full `tsc --noEmit` 770, unchanged from the
  recorded pre-slice baseline; **566 test files / 7193 tests pass** (3 files / 10
  tests skipped, pre-existing), including the entire `src/components/lumina` tree.

## Real-model verification

Frontend `:3000` and backend `:8000` were started for this slice (`TYPESAFE_API_KEY`
present). All results below are real Gemini/TypeSafe calls, not mocked decisions.

**Learner-intent probe** ([raw](shape-sorter-learner-intent-2026-09-22.json)):
87/90 passed, **0 false help/stop requests** across all four modes and 3 repetitions.
The 3 failures are one case (`sort`'s "I am done sorting") missing the 0.8 stop
threshold at 0.66-0.69 every rep — the identical shape to the already-recorded
`--trains` known miss ("I am done with the train", 0.68): a missed request, not a
false one, and the measured risk (false requests) stays 0.

**Tutor-verdict (JEV whole-assignment) probe** ([raw](shape-sorter-jev-2026-09-22.json),
[post-fix raw](shape-sorter-jev-2026-09-22-post-fix.json)): 91/96, then 92/96 after
one domain-guidance change (below). Every failure is an under-confident *refusal* of
a correct answer (verdict/transition probability 0.7-0.9, under the 0.9 acceptance
gate) — never a false accept of a wrong one. This is the same **sub-threshold-
affirmation family finding (LA-13)** already recorded for di-letter-sounds (0.83-0.89),
di-word-reading (0.86) and di-math-facts (0.94-0.96): a short, single-clause factual
credit line scores lower than a longer, more expressive one. It now has two more data
points: shape-sorter's `count` (0.58-0.71 on "Yes, this shape has six sides.") and
`sort` (0.82-0.89 on "Yes, this triangle belongs with the 3 sides group."). This is
shared-criterion evidence, not a defect in this slice's domain code, and per the
skill's Standing Authority section a threshold/criterion change is a framework
correction requiring the wider before/after sweep — out of scope for a mode adoption.

**One in-scope domain fix, tried and kept.** `sort`'s mat labels ("3 sides", "4
sides", "Curved", "Straight") are, by construction, the same words a natural
intermediate strategy question would use ("how many sides?", "curved or straight?").
Connected audio runs (below) showed the tutor sometimes crediting the *side count or
property* without stating that this also names the *group*, which the observer then
(correctly, per TW-2) reads as an unresolved sub-step. Added one fact to `sort`'s
scene (`workspaceScene`, `shapeSorterDomain.ts`) stating plainly that the mat label
**is** the shape's own property/count, so stating it already answers the assignment.
Measured before (1/3 on the core `group` case) and after (2/3): a real but partial
improvement, kept because it is free and correct as a task-meaning fact (TW-10), not
claimed as a fix for the shared threshold issue.

**Connected `--audio` journeys**, synthetic learner PCM through Gemini Live, real
provider transcription, real JEV, real mounted component/runtime/transport:

| Mode | Runs | Result |
|---|---|---|
| `count` | 1/1 | PASS — full help/demonstrate/wrong/correct/transfer sequence, settled completion. [Evidence](shape-sorter-workspace-count-2026-09-22.json). |
| `find_real_object` | 1/1 | PASS — full 5-item session (egg→oval, window→square, kite→diamond, door→rectangle, clock→circle), settled completion. [Evidence](shape-sorter-workspace-realobject-2026-09-22.json). |
| `sort` | 0/5 | FAIL every run, both before and after the guidance fix above. [Evidence: pre-fix run 1](shape-sorter-workspace-sort-2026-09-22.json), [pre-fix runs 2-3](shape-sorter-workspace-sort-retry-2026-09-22.json), [post-fix runs 4-5](shape-sorter-workspace-sort-postfix-2026-09-22.json). |

Every `sort` failure was the LA-13 shape above: a real, correct tutor credit that the
observer under-confidently refused, so the scripted journey ran out of turns before a
confident advance. One run in the retry pair *did* fully pass its first item (0.98/0.94
confidence, clean advance) and failed only on its second — so the mechanism works;
the miss rate is the shared-criterion issue, concentrated on this mode because its
group vocabulary overlaps the natural sub-step vocabulary. **`sort` is mechanically
correct (mats render and update, demonstrate marks a shape or a mat, retry/correction
work, `count`/`identify` items in the same session behave normally) but is NOT
connected-journey-verified at the rate the other three modes are.** Treat it as the
next LA-13 domain, not as broken plumbing.

## Remaining scope

- LA-13 (sub-threshold affirmation) now has evidence from six domains
  (di-letter-sounds, di-word-reading, di-math-facts, letter-sound-link, and now
  shape-sorter `count`/`sort`). The next pull on that shared criterion should include
  these two new cases.
- Human browser/mic acceptance for `count`, `find_real_object` and `sort` remains
  open under [HUMAN-CHECKS #167](../HUMAN-CHECKS.md); `identify`'s human sitting was
  already open and stays open. JSDOM paint and synthetic audio are not that check.
- The Counting Board demonstration miss recorded in the second-adopter report is
  untouched and still open.
