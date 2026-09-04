# Lesson Bench — queue

**What it is.** A whole ASSEMBLED lesson, scored against a curriculum item, replayed
byte-for-byte in the real app so a human rates the identical artifact the machine rated.
The unit of work is a **Lesson Package** (`service/qa/lessonBench/lessonPackage.ts`):
manifest + full curator brief + every generated block + `scores` (machine) + `human`.
The rubric roster (`LESSON_BENCH_CHECKS`, G1–G6 gates + Q1–Q8 checks + 1–5 holistic
anchors) is ONE vocabulary for both judges — that is what makes agreement measurable.

**How to use it today (shipped 2026-09-03).**
1. Produce: `GET /api/lumina/topic-trace?topic=<t>&gradeLevel=<g>&package=true`
   (images kept, componentId filter ignored) → save the response's `package` field as
   `qa/lesson-bench/packages/<id>.json`. Grade strings are the pipeline's lowercase set
   (`kindergarten`, `elementary`, …) — see item 5.
2. Drop it on the **Lesson Bench** dev panel (home → dev cards) → **Play this lesson**.
   Replay goes through `useExhibitSession.generate({ replay })` — the one launch verb —
   and the production assembly step (`service/exhibitAssembly.ts`). Nothing regenerates.
   The live tutor connects at mount exactly as in production; the first sitting's
   client run id is `<package>-<mint>` so the backend session ledger and DI run log join.
3. Rate in the rail the way a teacher would: ONE score for the lesson, **keep / fix / cut**
   per block, plain-language reasons only when something is off ("Doesn't belong in this
   lesson", "Symbols before the real thing"). Check ids never appear; every reason carries
   its check id underneath (`BLOCK_REASONS` / `LESSON_REASONS`), and `humanCheckSignals()`
   renders the label in the machine's vocabulary block-for-block. Autosaves to localStorage
   per package id; **Download labeled JSON** writes the package back with `human` filled —
   that file is the calibration row.

**Why the human is not "on top of" the eval but part of it.** The LLM judge (Tier B) is
trusted per check only where it agrees with these hand labels ≥80% on ~20 packages. The
order audit (`qa/topic-traces/order-audit-2026-08-08.md`) skipped that step and its phonics
number was partly the judge arguing with itself.

---

## Queue (top = pull next)

### 1. 🔎 **HUMAN — browser check of the shipped surface.** HUMAN-CHECKS **#125**.
Drop `packages/*.json` on the panel → Play → rail appears over the lesson → rate → Download.
Then a DI package (any spoken port, e.g. a `matter-explorer` lesson) with the mic: confirm the
tutor opens from the replayed block and the session ledger's `session-init.client_run_id`
starts with the package id. Not drivable headlessly — machine gates only (typecheck 0, vitest
5/5 new + 4464 suite, route probe produced 7/7 blocks). Executor: the user.

### 2. **Persistence endpoint** — `POST /api/lesson-bench/labels`, a sibling of
`backend/app/api/endpoints/di_run_logs.py` (same slug + size cap), writing
`backend/logs/lesson-bench/<package>-<runId>-label.json`. The rail's Download stays as the
offline path. Backend ships WITH its consumer (the rail's Save button) in the same slice.
Executor: direct edit.

### 3. **Tier A code-judged scorer** — `scripts/lesson-bench.mjs`: for each package in a
frozen set, fill `scores.gates/checks` from manifest + catalog + curriculum, no LLM:
G1 band, G4 mode-exists, G5 density (≥3 distinct problems per scored mode), G6 modality,
Q5 ramp (betas), Q6 variety, Q7 evidence, plus the G3 leak grep. Append rows
`{runId, gitSha, packageId, checkId, score}` to `qa/lesson-bench/scoreboard.jsonl`; a
`--diff <runA> <runB>` prints per-check deltas per subject with the control row. Bucket rule:
any gate 0 → BROKEN; all gates + 8/8 checks + holistic ≥4×3 → CLEAN; else RUNNABLE.
Executor: direct build, then `/topic-trace --bench` wraps it.

### 4. **Frozen set v1** — 40 subskills (K–3 × math, reading × 5: 2 concrete, 2 symbolic,
1 procedural per cell) + 5 engineering controls, pulled ONCE from the published curriculum
with Title/Focus/Examples/Constraints text, as `qa/lesson-bench/set-v1.json`. Needs the
backend up (`/api/curriculum`). Executor: `/curriculum` read + hand pick.

### 5. **FINDING (from the first probe, 2026-09-03)** — `gradeLevel=Kindergarten` (capitalised)
produced a manifest labelled **`elementary (grades 1-5)`** with a `hundreds-chart` block,
while the eval-mode resolver log said `(Kindergarten)`. The lowercase `kindergarten` request
is the control (package 2 in `packages/`): its manifest is labelled `Kindergarten`, so the
label drift IS casing — the trace route should normalise before the brief. But BOTH packages
put a **`hundreds-chart`** block (a grid of written numerals) in a K "count objects" lesson —
the exact origin lesson of `order-audit-2026-08-08.md`, resurfacing at the primitive-selection
layer. First real bench finding; rate it in the rail, then `/topic-trace`.

### 6. **DI beat-level rail** — when the replayed block is a judged-loop port, the rail
offers the CURRENT item + beat and the existing names (`di-correction-verbatim-repeat`,
read-preamble-aloud, and the run-log flags `unanchored` / `phantom` / `no-verdict` /
`superseded`) so a beat label joins the DI run log on `runId + itemId`. Needs the runner
to expose item/beat to the registry (`lessonBenchSession`). Executor: `/add-di-loop` owner.

### 7. **Tier B LLM judge** — absolute 1–5 with `HOLISTIC_ANCHORS`, three runs, every
deduction cites `{instanceId, checkId}` or is discarded; calibrated against the hand labels
from item 1 before any number is reported. Never flash-lite. Executor: after items 3 + 4.

### 8. ✅ **CLOSED 2026-09-03 (same day)** — every `counting-board` challenge showed **5 objects** in a
"count to 10" lesson. Fix: the `config.count` object-count override is gone from
`gemini-counting-board.ts` (and the "Suggested starting count" prompt hint with it). Runtime probe via
`topic-trace?componentId=counting-board` on the same topic: manifest still stamped `count: 5`, challenges
came back 4/6/5/7/8/9/10 with line/scattered/circle/groups. **After-package for the scoreboard pair:** `packages/kindergarten-counting-objects-to-10-20260904013634-pgr5.json` (10 blocks, counting-board 4/6/5/8/7/9/10 butterflies, tier easy → all `line` by design; manifest still stamped `count: 5`). Rate it in the rail against `…hxav`. The same sitting surfaced the ten-frame
greeting turn → `qa/di/BACKLOG.md` item 30 (shipped) + HUMAN-CHECKS #128. Original finding: NOT the bench: the package
data itself carries `count: 5` on all 7 challenges and replay is byte-faithful. Cause is in the
generator: the manifest stamps `config.count` = "number of problems to generate"
(`gemini-manifest.ts:182/265`; ten-frame got the same `count: 5` and emitted 7 varied targets), but
`gemini-counting-board.ts:736-738` applies `config.count` as the per-challenge OBJECT count override,
clobbering every count to 5 and re-forcing `targetAnswer`; the prompt also feeds it in as "Suggested
starting count". Production lessons take the same path (`generateComponentContent`). Side effect: the
easy tier forces `arrangement: 'line'` after the LLM wrote "circle"/"scattered" narration — text and
board disagree. Executor: direct edit (drop the `config.count` override, or read it as instance count),
then `/eval-test counting-board` on the same topic. Contract: `docs/contracts/counting-board.md`.

### 9. **FINDING (sitting `de90b50f9e1b`, 2026-09-04) — a replayed K package renders on the SCROLL
layout, not the Kindergarten stage.** `resolveKindergartenStage` accepts an `objectiveGrade` only when
it is literally `K`, and the package stamps `kindergarten`; the band fallback reads App's selector
(`elementary` unless the home screen was set), which the replay never overrides from the package. Two
consequences: the sitting exercised the grade-1+ layout for a K lesson, and that layout keeps every
block mounted — which is exactly the condition for `qa/di/BACKLOG.md` **item 31** (a judged run the
student scrolled away from keeps the shared-turn hold; the DI block went deaf). Fix shape: derive
`gradeLevel` for the layout from `pkg.manifest.gradeLevel` on replay, and/or let
`resolveKindergartenStage` run `isPreReaderGrade` over `objectiveGrades` too. Executor: direct edit,
then re-drive #125 on rails. Until then a K package is a faithful probe of the SCROLL layout only.

### 10. **FINDING (sitting `ee232274f4c2`, 2026-09-04) — at the END of a replayed lesson the tutor read
a `[PRIMITIVE SWITCH]` aloud that no client ever sent, then answered a hallucinated Spanish transcript
in Spanish.** Not the bench: the knowledge-check switch was held for a pack opener that never came,
and two one-frame mic blips were handed to Gemini as whole turns. `qa/di/BACKLOG.md` **item 32**
(three levers, client first). While it is open, a bench sitting that ends on the knowledge-check
without tapping its orb will reproduce it; rate the lesson before that point.

---

## Log

- **2026-09-03 — SHIPPED the replay + rail.** `service/exhibitAssembly.ts` (assembly
  extracted from `geminiService.buildCompleteExhibitFromManifest` phase 3, now shared),
  `service/qa/lessonBench/{lessonPackage,lessonBenchSession}.ts` (+5 tests),
  `components/{LessonBenchPanel,LessonBenchRail}.tsx`, `useExhibitSession.generate({replay})`,
  `DevPanelRouter` + `IdleScreen` card, `topic-trace?package=true`. Gates: typecheck:lumina 0,
  vitest 260 files / 4464 pass. Runtime: route probe on the dev server produced a 7/7-block
  K counting package (`packages/`). Browser drive NOT done → item 1.
  **User drove it the same day**: drop → play → rail rendered ✅ — and rejected the rail's first
  form ("answer leak? subskill fidelity? what do these even mean? … just feels like buttons").
  Rebuilt teacher-shaped: lesson score + keep/fix/cut per block + plain-language reasons that
  map onto check ids underneath. Their read of the K counting package: "wow this is great,
  maybe only don't like take home activity" → holistic 4–5, one block cut. Calibration row #1.
  Footgun hit on the way: a second `next dev` on the same `.next` dir 500s every page with
  `TypeError: Cannot read properties of undefined (reading 'call')` inside an untouched
  file — it is cache contention, not code; use the server already on :3000.
