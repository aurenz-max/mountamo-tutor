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

### 3. ✅ **Tier A code-judged scorer — SHIPPED 2026-09-04 (narrowed to what the tags decide).** `scripts/lesson-bench.mjs score`
fills `scores.gates/checks` from manifest + live catalog + affordances (no LLM), appends `{runId, gitSha, packageId,
checkId, score}` to `scoreboard.jsonl`, prints machine-vs-human per check for a labeled package. Scored: G1 (reader
axis), G4 (catalog half), G6 (K-2 LITERACY only — math tap-only production is evidence), Q3, Q6 (+`maxPerLesson`), Q7, Q8,
Q9 (item 14). Three rules: absent tag = `unknowns`, never a fail · score the lesson the child PLAYS (caregiver blocks
partitioned as the assembly places them) · every deduction cites `{instanceId, checkId}`. Bucket: any gate 0 → BROKEN,
else RUNNABLE (CLEAN needs Tier B). Core: `service/qa/lessonBench/lessonBenchScorer.ts` (+13 tests). **Calibration
row #1 (`…pgr5`, holistic 5): 7/8 agree** — the one disagreement is Q8 on the take-home, which item 12 moved out of the
child's stream (re-rate via `rerun`). **Residual (Tier B / generator-specific, still item 7):** G2, G3 leak grep, G5
density, Q5 ramp, Q1, Q2, Q4, the "emitted by the generator" half of G4, the visible-timer half of G6. `--diff <runA>
<runB>` prints per-check deltas from the scoreboard.

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

### 11. ✅ **Affordance framework — SHIPPED 2026-09-04** (`/add-affordances`). `ComponentDefinition.affordances`
{audience, representation, reader, answers, role, minutes, maxPerLesson} + per-mode overrides (`evalModes[].affordances`);
`catalog/affordances.ts` resolves (derives `spoken` from `audioInput`) and renders a `{…}` tag on the catalog line + a
legend of facts, never bans; `topic-trace` returns `selection[]` rows with resolved affordances and takes
`affordances=on|off`; `scripts/affordance-ab.mjs` (supply per grade, symOpen, caregiver placement, readsAbove, minutes)
+ `scripts/affordance-coverage.mjs`. Pilot: 11 tagged (math 6 + fast-fact, knowledge-check, take-home-activity,
concept-card-grid, di-spoken-practice). Consistency vitest 10/10. **`AFFORDANCE_TAGS_DEFAULT = false`** — item 13.

### 12. ✅ **Caregiver blocks out of the child's stream — SHIPPED 2026-09-04.** `exhibitAssembly.ts` partitions
`resolveAffordances(def).audience === 'caregiver'` blocks after the final assessment, stamped `audience: 'caregiver'`
on the `OrderedComponent` — every grade, never dropped, the ONE assembly transform that acts on a tag (it adds a
placement). `OrderedSection` frames them as a parent card (amber `LuminaPanel`, "For a grown-up · after the lesson");
the K stage skips them on the rails and `LessonScreen` shows them after the finish check-mark. The scorer partitions
the same way. Gates: vitest 5 (assembly) + 36 (bench set), tsc 802 = baseline. **Runtime: headless Chrome drove the
replayed `…t93c` package — scroll layout, take-home LAST after the knowledge-check inside the frame, no generation
POSTs.** K-stage path + phone width = HUMAN-CHECKS **#132**. The `…pgr5` cut is therefore answered by placement, not by
removal; `rerun` marks it RE-RATE.

### 13. ✅ **Affordance rollout gate — CLOSED 2026-09-04, default flipped ON at 29/201.** Two `/add-affordances` batches (13 + 5:
every untagged primitive the pilot lessons and the first re-run reached for) and two `--runs 3` A/Bs
(`ab/affordances-2026-09-04-14-41.md`, `…-14-49.md`). The gate's literal form — "lost under ON" empty per run — is NOT meetable
at n=3: the OFF arms of the two runs differ from EACH OTHER by 2-3 primitives per grade (K lost 2 / gained 1, elementary lost 1 /
gained 3), so the run-to-run floor is larger than any OFF→ON loss (1-2). Read against that floor: **untagged blocks under both
arms ≈ 0** (the salience/ablation signature from the pilot is gone), **pooled over both runs elementary loses nothing and K loses
only `strategy-picker`** (2/6 OFF runs, 0/6 ON — since tagged), no primitive present in both OFF samples is missing from any ON
run, caregiver misplaced 0, K spoken blocks up (6.3→7.3 on addition). `AFFORDANCE_TAGS_DEFAULT = true`; traces can still force
`affordances=off`. The instrument now prints the floor itself: `node scripts/affordance-ab.mjs --against <prev.json>`. Revert =
one constant. Next coverage pull (untagged picks in the last run): `race-track-lab`, then the long tail via the ledger.

### 14. ✅ **`too-long` gets a number — SHIPPED 2026-09-04 with item 3.** `Q9 Length` joined `LESSON_BENCH_CHECKS`
and `LESSON_REASONS.too-long` carries `checkId: 'Q9'`. Known minutes of the CHILD'S stream vs `LENGTH_CAP_MINUTES`
(pre-reader 40 · K-2 45 · else 55): a floor, since untagged blocks add nothing. Caps are starting points — the first cut (35)
failed the labeled K lesson the moment its ninth block got a minutes tag (38 known), so the cap follows the label; the labeled
K lesson carries 34/35 known (+10 on the parent card) and was rated 5 without `too-long`. Recalibrate on labels.

### 15. ✅ **Reader verdicts for the four K primitives — CLOSED 2026-09-05.** Four `/reader-fit` PRE audits
(`qa/reader-fit/{number-tracer,number-sequencer,hundreds-chart,fast-fact}-PRE-2026-09-05.md`) → all four carry
`reader: 'none'`; `hundreds-chart[identify_pattern]` → `developing` (sentence options, a Grade 2-3 mode). Two of the
audits found real gaps and fixed them in the slice: **hundreds-chart** had no `[ACTIVITY_START]` and no ORIENT
directive, so challenge 1 of a K 1-10 board was text-only (component moment + catalog aiDirective added; live
`--lesson` 3/3 greetings now voice the instruction); **fast-fact** drew WORD options on every non-counting K topic
("Circle", "Yellow", 19/19) — generator now binds pre-reader options to numeral / letter / ONE emoji (after: 0/30
word options over 3 topics), the tutor says the question, glyph-only options render as big picture buttons.
number-sequencer's `answers` was wrong (`manipulate` → `type`; the fill modes are `<input type=number>`), corrected
with per-mode overrides. Leftovers that are not reading load → reader-fit BACKLOG 19a/b/c. Scorer: Q8 decided on
every K package; the only remaining Q8 unknown is `foundation-explorer`. A/B `ab/affordances-2026-09-05-11-45.md`.
*Was:* Q8 landed `unknown` on these four in every K package because the tag skill refuses to guess `reader`.

### 17. **LITERACY IS THE TAG FRONTIER — the A/B topic set was 100% math, so `untagged` read 0 in both arms while `literacy.ts` sat at 0% tagged (2026-09-05).** Fixed the instrument first: `scripts/affordance-ab.mjs` now carries a fifth topic, *"Identifying beginning sounds in words"* (kindergarten). It immediately read **untagged 3.5 (off) / 3.0 (on)** where every math topic reads 0 — the blind spot was the topic set, not the coverage number. The four primitives that K literacy topic actually reaches for were then tagged from sources already on disk (`ab/affordances-2026-09-05-12-23.md` names the queue):
- `phoneme-explorer` — picked in **4/4 runs, both arms**, often twice a lesson; the single biggest unknown in K literacy. No reader-fit report, but a shipped judged-loop port (port 6, 2026-08-11) that the user drove on 2026-08-12 → `reader: 'none'` by the standing DI rule.
- `letter-sound-link[keyword_match]` — picked in **4/4 runs**. READY @ PRE, live-confirmed.
- `word-sorter[binary_sort]` — 2/2 OFF runs. READY @ PRE for the sorts; `match_pairs` carries its own `reader: 'developing'` override, since its eval-mode description already says the word bank is read, not heard.
- `sorting-station[sort_one]` — READY @ PRE for `sort_one` / `odd_one_out`; the other five modes state their own Grade 1+ floors.

**What is NOT yet reached for, and therefore not yet queued:** `phonics-blender`, `rhyme-studio`, `cvc-speller`, `decodable-reader`, `poetry-lab`, `word-workout`/`word-flip`, `syllable-clapper`, `letter-spotter`, `picture-vocabulary`, `sound-swap`, `story-talk`, `interactive-book`. All have PRE verdicts on disk and would be cheap, but the standing rule is to tag what a package or an A/B reaches for — **add a second and third K literacy topic (rhyme, CVC blending, sight words) before tagging on spec.** That is the next slice of this item.

**Confirming A/B `ab/affordances-2026-09-05-12-30.md` (`--runs 2 --against …12-23.json`) — the tags did what they were added for.** On the literacy topic `untagged` went **3.5/3.0 → 0/0**. Per-grade supply held: K **19/19**, elementary **14 → 16**. The OFF-vs-OFF churn floor on this topic set is **5 primitives at K and 4 at elementary** (n=2, one seed per topic), and every "lost under ON" sits inside it — K `number-line`, `letter-sound-link`; elementary `pattern-builder`. **Pooled loss: elementary none, K `picture-vocabulary` only** — itself an untagged shipped DI port, so it was tagged in the same push from the port rule (port 5, user-driven 2026-08-11), which removes the one loss that could have been the salience effect rather than churn. `readsAbove` 0 at K in both arms across all three K topics; `caregiver misplaced` 0 everywhere.

**Finding worth keeping (2026-09-05):** `equation-builder` was tagged `reader: 'developing'` this same slice and the curator **still picked it in 4/4 runs at kindergarten, in both arms.** The tag is a fact, not a ban — exactly as designed — which means the fix for a K-hostile primitive has to be the primitive (reader-fit BACKLOG 20a), not the tag.

### 16. **FINDING (scorer, 2026-09-04) — a bare band never yields a canonical grade.** `gradeLevel=elementary` stamps
`objectiveGrade: 'elementary (grades 1-5)'`, which `normalizeObjectiveGrade` rejects, so a Grade-1 lesson produced
that way is scored as NOT K-2 (G6 literacy rule off, the "other" length cap). Curriculum-launched lessons carry the
canonical grade; topic-driven ones carry only the band. Cheap half: produce bench packages with a canonical grade
string and check the pipeline accepts it (`gradeLevel=Grade 1`). Executor: `/topic-trace` probe, then a route
normalisation if it does not.

### 17. **Journey campaign (`/lesson-bench journey`) — phonics-starter, first closed loop 2026-09-05.** Runs:
`journeys/runs/phonics-starter-2026-09-05T{11-37,12-27,12-44}*`; viewer = every run's `.html`
(`scripts/lib/lesson-journey-report.{mjs,html}`, published as an Artifact). **Fixed in-slice under the user's ruling
"the manifest passes the objective, the GENERATOR does the work" (memory `feedback_manifest-passes-generator-works`):**
`letterGroups.ts` gained `lettersNamedIn` / `letterGroupFromText` / `resolveObjectiveLetterGroup` /
`asksIndependentProduction`; `letter-sound-link` + `letter-spotter` derive the group from the objective (were hard-defaulting
to Group 1 at Group 2/3); `di-letter-sounds` drills the objective's named SET only (tier composition never evicts a named
letter, backfill never leaves the set), honors the manifest's `count` (was reading `challengeCount`), and reports
`unaskableLetters` (stops) instead of swapping in f/r/v; `di-word-reading` honors `count`; an "assess without first saying its
sound" objective withdraws the model line (`hard`) in di-letter-sounds and letter-sound-link whatever the manifest tier says.
**Runtime (`--generate --production --against …12-27`):** phonics-1 BLOCKED → INSUFFICIENT_EVIDENCE on 18/18 runs, 0 OUT_OF_SCOPE,
4 cold independent asks (s, a, i, n) where there were 0; letter-spotter/letter-sound-link at groups 1/2/3 as named. Gates: vitest
88/88 on the touched suites, typecheck:lumina 0, full tsc 802 = baseline.
**Same afternoon, second pass — adapters + audit flag.** `extract.ts` now reads letter-spotter (letterform by tap / letter name spoken),
phoneme-explorer isolate (onset, spoken), knowledge-check MC + true/false and fast-fact choice (onset / sound-recognition by tap via
`tapQuestionTarget`), and concept-card-grid as `EXPOSURE_ONLY` (known, uncredited, never a certification stop). `--waive-prerequisites`
runs every lesson from retained state for AUDIT (banner + reason line; a waived lesson can never ADVANCE). Run
`…12-54-18` on the 12-44 packages: **all 54 lesson-runs INSUFFICIENT_EVIDENCE, 0 BLOCKED, 0 unknown blocks in phonics-1/3, 1 in
phonics-2** (a knowledge-check true/false the reader could not parse). Independent items (fast): 15 / 18 / 27. What remains per lesson
is now exactly (a) stops never askable, (b) one cold ask per producible letter when the draw has one production block, and (c) at
Group 3 a 19-letter cumulative set vs 5-6-item sessions (i, e, o, u never asked). Gates: journey vitest 24/24, typecheck:lumina 0, tsc 802.

**Residuals, in pull order (each is a separate decision or a new adapter):**
- (a) **USER RULING — stops have no production surface.** t p c k h d g b are `unaskableLetters` in every phonics lesson: bench
  stop-consonant production as a new di-letter-sounds mode, or re-scope the contract so a stop is evidenced by `hear_see` +
  keyword production. The curriculum text asks for "a crisp /t/".
- (b) Contract vs supply: `minIndependentItems: 2` but a pinned see-hear session at Group 1 is ONE cold ask per letter (4
  producible letters). Either two production blocks per lesson or a `minIndependentItems: 1` scenario — a scenario decision.
- (c) Adapters (journey `extract.ts`): concept-card-grid, phoneme-explorer, knowledge-check, fast-fact, letter-spotter — today
  `NO_CONTENT_ADAPTER`; substantively they measure onset/letterform, so they would land as off-target, not evidence.
- (d) Production credits echoes: score 10/10 on modeled parts, gate 1 passed, selector "confirm at 0.985" while the evidence
  contract says INSUFFICIENT. Student-data-loop lane: a modeled item should submit as supported, not independent.
- (e) Journey viewer/extractor should read `unaskableLetters` from the generated data instead of the copied producible list.

### 19. ✅ **Objective-coverage eval SHIPPED in shadow (2026-09-05) — every assembled lesson is now judged "taught → assessed → enough to infer mastery?" per objective.**
`service/qa/lessonCoverage/` (digest · evaluator · shadow · sink · Q4 adapter), wired into `/api/lumina/build-stream` AFTER the
stream closes and into the `/api/lumina` build action; `evaluateLessonCoverage` action + `scripts/lesson-coverage.mjs eval|report|show`
for tooling; rows in `qa/lesson-coverage/evals.jsonl`; kill switch `LUMINA_COVERAGE_EVAL`. Judge `gemini-flash-latest`, evidence ids
validated in code (uncited credit withheld, unassessed = CRITICAL, SUFFICIENT needs ≥2 items). **Verified at runtime:** live suite 6/6
(five fixtures + the real phonics-1 package), and a real `build-stream` drive of phonics-1 produced a `source=build-stream` row 10.6 s
after the exhibit was delivered — obj1/obj2 `ASSESSED_INSUFFICIENTLY` (s a i n assessed, **t p never**), `content_guard` cited at
`obj1-di-sounds` and `obj2-sound-link` from `unaskableLetters` — item 17(a) found by the machine with no adapter. Finding kept:
`maxItems` in a `responseSchema` is INVALID_ARGUMENT on flash-latest (probed; removed), and `maxOutputTokens` is shared with thinking (4096 truncated the JSON mid-string; now 16384) — the row carries `meta.schemaError` so fallback rates stay diagnosable. Gates: vitest 24/24 mocked, typecheck:lumina 0,
full tsc = baseline.
**Owed, in pull order:** (a) calibrate against the hand labels before any number is reported — run `eval` over every labeled package
and compare Q4 citations via `coverageToLessonBenchSignals` + `machineVsHuman` (item 7's ≥80% rule applies); (b) let the Tier A scorer
merge the Q4 signal when a package carries `coverage` (one call in `lessonBenchScorer.ts`, adapter already written); (c) persistence
endpoint beside `di_run_logs.py` once the app runs where the disk is not local (item 2's shape); (d) Phase 2 defect spec → smallest
patch → re-eval (1 attempt), only after (a) agrees. No gate before (a). Executor: `/lesson-bench`.

### 18. **Affordance registry now 100% tagged (201/201, 2026-09-05) — run the scale-up A/B before trusting it broadly.**
Item 13 validated the gate at 24-29/201 against an OFF-vs-OFF churn floor of 2-3 primitives/grade at n=3; going from
there straight to full coverage in one sweep is untested at this scale. Run `node scripts/affordance-ab.mjs --runs 3`
across the existing topic set (make sure it still includes the K-literacy topic from item 17, not just math) and read
it against the item-13/17 floors: ship (no action needed, tags already live) if `lost under ON` stays inside the
established churn floor and `untagged` reads ≈0 in both arms; if a real loss appears, it now has 163 new candidates to
implicate instead of a handful. Executor: `/add-affordances --ab`.

- **2026-09-05 (afternoon) — journey loop closed once: generators read the objective.** See item 17. Viewer artifact:
  https://claude.ai/code/artifact/3e84064c-f4cd-4330-94a2-939d1850f434 (republished per run).
- **2026-09-05 — literacy opened (item 17) + the three K reader unknowns closed; tags 29 → 38/201.**
  Three parts. (1) **`reader` filled on the three tagged-but-reader-less K picks**: `foundation-explorer` → `none`
  (BACKLOG item 9's pilot verdict, READY @ PRE, live 3/3 — it was the last Q8 unknown on two of the three K packages);
  `curator-brief` → `none` and `equation-builder` → `developing`, each from a short `/reader-fit` written this slice
  (`qa/reader-fit/{curator-brief,equation-builder}-PRE-2026-09-05.md`) because neither had a verdict anywhere in the
  tree. equation-builder came back **WRONG-BAND @ PRE** and **no band floor was added** — the demand is recorded as
  the tag and the age-friendly fix is reader-fit BACKLOG 20a. (2) **Four DI packs tagged** — di-letter-sounds,
  di-word-reading, di-shapes, di-sentence-reading — `reader: 'none'` + `answers: ['spoken']` from the shipped-port
  rule; for the two print packs the derivation is written into the catalog comment (the DI script models the word /
  sentence aloud before the child is ever asked to read it, so the print is the objective, not a gate). (3) **Literacy
  opened**: a fifth A/B topic (*"Identifying beginning sounds in words"*, kindergarten) added to
  `scripts/affordance-ab.mjs`, which named the queue and then confirmed the fix — `phoneme-explorer` (4/4 runs),
  `letter-sound-link`, `word-sorter`, `sorting-station`, plus `picture-vocabulary` from the confirming run's pooled
  loss. Per-mode overrides where a report or an eval-mode description names its own demand: `word-sorter[match_pairs]`
  → `developing`, `letter-sound-link[hear_see]` → tap, `phoneme-explorer[segment]` → pictorial,
  `picture-vocabulary[receptive_match]` → tap.
  Gates: affordances vitest **10/10**, `typecheck:lumina` **0**, full tsc **802 = baseline**.
  A/Bs: `ab/affordances-2026-09-05-12-23.md` (named the queue: untagged 3.5/3.0 on literacy vs 0 on every math topic)
  and `ab/affordances-2026-09-05-12-30.md` (confirmed: untagged 0/0, K supply 19/19, elementary 14→16, every OFF→ON
  loss inside a 5-primitive churn floor).

- **2026-09-05 — item 15 CLOSED: four reader verdicts, two fixes, tags 29/201 (same count, four `reader` fields filled).**
  `/reader-fit` ×4 @ PRE from real K draws (eval-test at `grade=K`, tutor-test probes) — reading axis clean on all four
  once the gaps were closed; the verdicts also separated READING demand from the things that are not (typed numerals,
  adult chrome, a start gate), which went to reader-fit BACKLOG 19a–c instead of into the tag. Fixes: hundreds-chart
  ORIENT beat (component `[ACTIVITY_START]` + catalog directive; `run_tutor_live.py --lesson --runs 3` greeting voices
  the instruction 3/3 — the run also CONFIRMED `tag-syntax-spoken` 2/3 on the generic journey's orientation/answer
  beats, the tutor reciting the `[CURRENT STATE]` block, see the report); fast-fact pre-reader picture options
  (generator rule + say-the-question directives + large glyph buttons; 0/30 word options after vs 19/19 before).
  Gates: affordances + bench vitest 50/50, fast-fact/hundreds-chart suites, `typecheck:lumina` 0, full tsc **802 = baseline**,
  `lesson-bench score` on all 5 packages (Q8 unknowns for the four gone; `…pgr5` still 7/8 on the item-12 parent card).
  **A/B `ab/affordances-2026-09-05-11-45.md` (`--runs 2 --against …14-49.json`)**: supply K 14/14, elementary 18/18;
  untagged 0 both arms; readsAbove 0 at K; caregiver misplaced 0; symOpen at K 1→0 on counting. Pooled loss:
  elementary none, K `fast-fact` only — and fast-fact sits in the OFF-vs-OFF *gained* column (absent from the previous
  OFF sample), i.e. inside the churn floor. n=2, so read it as "nothing above the floor", not as proof.
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
- **2026-09-04 — affordances pilot.** **Handoff: `qa/HANDOFF-lesson-bench-loop-2026-09-04.md` — read it first.** Framework + 11 tags + A/B (item 11/13). Gates: tsc 802/802 repo-wide with
  lumina 0, vitest affordances 10/10 + flattenManifest, route smoke on a K trace (selection rows carry resolved tags).
  One OFF run returned a Next 404 page mid-batch (dev-server recompile), excluded from its arm's means. Side-quest: a
  second `next dev` against :3000 wiped `node_modules/.bin` and packages (`@google/genai` among them) → `npm install`
  restored, dev server restarted; the footgun memory now covers it.
- **2026-09-04 (afternoon) — the loop closed.** `/lesson-bench` (`.claude/skills/lesson-bench/SKILL.md`): score ·
  triage · rerun on `scripts/lesson-bench.mjs`, which loads the TS scorer + LIVE catalog through vite's module runner
  (one catalog, one `resolveAffordances`). Items 3 (narrowed), 12, 14 ✅; 15 + 16 opened. Gates: vitest 36/36 on the
  bench set + 5 assembly, tsc **802 = baseline**, scorer run on all packages (scores written, 80 scoreboard rows over
  three runs), triage on `…pgr5` routed both labels mechanically to the layers the handoff had routed by hand
  (take-home → ASSEMBLY/item 12; knowledge-check note → TUTOR/di item 23), `rerun` produced `…t93c` (selection
  differed at 7/9 slots — same-topic noise, as the A/B warned), headless Chrome verified the parent card on the
  replay. **Calibration finding #1:** the first scorer failed Q3 on `number-tracer` opening "Match the written numbers
  1-10 to groups" — a block the user KEPT at holistic 5. An objective whose target IS notation opens on symbols by
  definition → `NOTATION_OBJECTIVE` makes Q3 unknown (objective quoted) instead of a fail. Side effect, stated: the
  item-5 `hundreds-chart` finding ("Identify written numbers 1-10") is now Q3-unknown too; if it still bothers the
  rater it is a Q1 (lesson opener, Tier B) or a reader-load call (item 15), not an order call.
- **2026-09-04 (item 13, batch 1) — 13 more tags, A/B `ab/affordances-2026-09-04-14-41.md` (4 topics × 2 arms × 3 runs, 24/201 tagged).**
  Supply held in COUNT at both grades (K 16→16, elementary 18→18); elementary lost nothing; **K lost `strategy-picker`**
  (2/3 OFF runs → 0/3 ON) and `di-math-facts` slid 3→1 — both UNTAGGED, so the salience lever is still moving selection
  toward tagged lines. Gate NOT met → default stays OFF. Intended signals: elementary symOpen 1.3→0.7 (skip counting),
  caregiver misplaced 0 both arms, K symOpen 1→1 (the numeral objective, by design). Batch 2 = the five untagged
  primitives the curator still reached for (equation-builder ×9 runs, pattern-builder ×6, how-it-works ×6, di-math-facts
  ×4, strategy-picker ×2), then re-run. Side effects of batch 1 on the bench: Q9 cap recalibrated 35→40 (item 14 note),
  and a real Q3 catch on `…ybwp` (annotated-example opens a concrete counting objective).
- **2026-09-04 (item 13, batch 2 + flip) — 5 more tags (equation-builder, pattern-builder, how-it-works `reads: developing` from its
  WRONG-BAND verdict, di-math-facts, strategy-picker) → 29/201; A/B `ab/affordances-2026-09-04-14-49.md` read against the OFF-vs-OFF
  floor → default ON (item 13 has the numbers). Gates: consistency test 10/10, typecheck:lumina 0, route smoke (no param → `affordanceTags: true`).
- **2026-09-05 (item 13, full-registry sweep) — the remaining 163 primitives tagged in one pass → 201/201, the registry is DONE.**
  Ten domain-parallel `/add-affordances` agents (one per catalog file, math.ts and literacy.ts split in two given size), each
  pulling `reader` only from an on-disk reader-fit verdict or contract (never guessed): astronomy (11, mostly READY @ PRE →
  `none`, `telescope-simulator` WRONG-BAND → `developing`), biology (17, 6 from verdicts), chemistry (14, none — no reader-fit
  coverage exists for this domain, correctly omitted throughout), core (11), engineering (24, 12 from PRE-2026-07-21 reports →
  `developing` — read-aloud gap resolved but eyes-free-PRE still structurally out of reach), literacy (28 across two agents,
  heavy use of existing PRE verdicts for phonics-blender/cvc-speller/rhyme-studio/word-workout/word-flip/decodable-reader/
  story-planner/poetry-lab), math (44 across two agents, per-mode overrides added wherever a mode's own description showed a
  concrete→pictorial→symbolic shift, matching the number-line/base-ten-blocks precedent), and a misc batch (assessment,
  calendar, history, media, physics — `cause-effect-chain`/`era-explorer`/`push-pull-arena` picked up `reader: 'none'` as
  shipped judged-loop DI ports). Consolidated fix: 5 math.ts mode-overrides had wrongly declared `role` (primitive-only field,
  not valid on `EvalModeAffordances`) — stripped. Gates: `affordance-coverage.mjs` → 201 tagged / 0 untagged; consistency test
  10/10; typecheck 802 = baseline (0 new, all pre-existing/unrelated to catalog files). **A/B not yet run at this scale** — the
  item-13 gate was validated at 24-29/201; going straight to 100% is a much bigger jump than any prior batch. Recommend one
  `affordance-ab.mjs --runs 3` sanity pass before trusting the tags to move selection broadly (queue below).
