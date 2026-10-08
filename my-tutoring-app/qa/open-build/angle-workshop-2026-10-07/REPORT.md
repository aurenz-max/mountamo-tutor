# angle-workshop — workspace binding + `make_angle` open build, 2026-10-07

## Step 1: binding (W1, minimal; modelled on coin-counter and equation-builder)
- `AngleWorkshop.tsx` → `AngleWorkshopSurface` through `withWorkspaceController`; the scripted path keeps
  `useScriptedProgress`.
- Every Check commits through `progress.commitCheck`. On the workspace path: legacy `useLuminaAI` off, `sendText`
  cues send nothing, Next Problem hidden, inputs closed while a checked answer waits, submission only under an
  evaluation provider.
- Fixed: on the classic modes the per-item reset ran after the advance and superseded the receipt (J7 on 5
  payloads); a fresh item now clears its inputs in the advance's own render.
- `angleWorkshopWorkspace.ts`: assignment (gesture, no key), scene (the figure in words, never the measure or the
  relationship), `describeAngleWork`, the build judge, harness inputs. Adapter `angleWorkshopLive.ts`; catalog
  `teachingWorkspace` for Grades 4–8 with guidance, `levers: true`, misses, `unanswered: { make_angle: ['not_opened'] }`;
  journey row for every mode. No contract doc exists.

## Step 2: `make_angle`
- The learner turns a ray from a fixed ray on an empty svg (`AngleBuildScene.tsx`): drag, or Open wider / Close in
  (5° steps), Start over, then "I'm done!".
- Asks: acute, right, obtuse, straight, "bigger than a right angle but smaller than a straight angle", and from
  grade 5 a degree range ("between 40° and 60°").
- Judge (code): right 87–93; acute 5–86; obtuse 94–176; straight 177–180; range inclusive, no tolerance. Below 5°
  there is no angle yet.
- Misses name the kind made: `not_opened`, `made_acute`, `made_right`, `made_obtuse`, `made_straight`,
  `below_range`, `above_range`. On-screen words after a miss never name that kind or its degrees.
- No stillness; Try again keeps the build and verdict; a new item or practice opens at 0°.
- Levers bare: `corner_marker` (dashed square corner and straight line), `protractor` (unmarked scale),
  `coarser_class` (simplify: bigger/smaller than a right angle, ungraded). `not_opened` has no lever, by decision.
- Generator: code owns every ask; model writes title and description. Grade ≤ 4 kinds only; grade ≥ 5 three kinds
  plus two ranges; a kind named in topic/intent comes first.
- Catalog β 1.6 (measure + 0.1), `answers: ['build']`; backend prior 1.6; one catalog description sentence so the
  manifest finds this mode for grade 4–6 angle lessons.
- Oracle: the ask names the judged kind or range, ranges sane, no degree measure in narration or hint, asks spread.
- Watcher skipped: a single ray has one property, its opening, which is the skill; a line describing it would hint
  the kind, and one that does not adds nothing.
- Degrees to the tutor: the scene publishes `openingDegrees` as a number (`openingDegrees 0 → 45 → 30` tested). Any
  honest description reveals the kind, and publishing nothing would leave the tutor blind and `workHistory` empty.
  The degrees are not on the learner's screen; guidance says never say the degrees or the kind or which way to
  turn, and ask the learner to compare with a square corner or a straight line.

## Gates (worktree; merged and re-gated in main)
- `AngleWorkshop.workspace.test.tsx` 21/21 (every mode binds; per mode no key, miss reopens, right answer submits
  once; judge boundaries each side; drag mapping; workHistory; Try again; levers; simplify; adapter refusals).
- live-activity 35 files, 2270 pass; sweep clean on 6 payloads; make_angle 5/5 misses named; J8, J9 hold.
- Oracle, pip and catalog: 39 files, 784 pass. `typecheck:lumina` 0; full tsc 770, none in touched files.
- Real generation (3 make_angle lessons + one per classic mode): 0 oracle violations; adapter accepted all.

About 835 production lines (59 removed), 222 test lines, an 80-line probe.

## Not verified / rulings
- No browser drive (touch/mouse drag, phone width, lever drawings). No replay or Live; whether the tutor keeps
  "never say the degrees" waits for the class gate. Classic modes name no misses and have no levers yet (minimal W1).
- Rulings: (1) `openingDegrees` to the tutor with a guidance prohibition, vs nothing; (2) tolerances (right ±3°,
  straight ≥ 177°, 5° minimum); (3) the description sentence extending angle-workshop to grades 4–6 in the manifest.
