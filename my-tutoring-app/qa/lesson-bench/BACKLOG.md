# Lesson Bench — queue

> **Paused by user request (2026-09-07):** manifest self-evaluation, coverage-judge iteration, and synthetic lesson journeys. `/lesson-coverage` and `/lesson-journey` are retired; instructions and open items below are historical, not an active pull queue. Preserve evidence and independent primitive fixes; resume this workflow only on explicit request.

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

**Why the human is not "on top of" the eval but part of it.** The coverage judge (item 19 — the ONLY LLM
judge; item 7's Tier B retired into it) is trusted per check only where it agrees with these hand labels ≥80% on ~20 packages. The
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

### 7. ✅ **RETIRED 2026-09-05 — superseded by item 19.** The objective-coverage judge IS Tier B: it decides Q4
per objective with categories instead of a 1–5, validates every citation in code, and `lesson-bench.mjs score` now
merges its verdict off the package (`coverage`) so the agreement table scores Q4 (19b shipped). The ≥80% hand-label
rule survives as 19(a) `calibrate`. No second LLM judge gets built beside it; G2 G3 G5 Q1 Q2 Q5 stay human-only until
a labeled set argues otherwise. ~~Original: absolute 1–5 with `HOLISTIC_ANCHORS`, three runs, every deduction cites
`{instanceId, checkId}` or is discarded; calibrated against the hand labels from item 1 before any number is reported.~~

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

### 17. **Journey campaign (`/lesson-journey`) — phonics-starter, first closed loop 2026-09-05.** Runs:
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
**INSTRUMENT FIX 2026-09-05 PM (calibration, found by the phonics-2 re-judge).** The judge cited obj2’s 13 items by their CONTENT id (`dils-1-m` …) not the digest pointer (`obj2-di-continuous-production#challenges[0]`), so the validator discarded all 13 correct citations and FALSELY zeroed a fully-covered objective. Fix: `digest.ts` now builds `evidenceAliases` (an item’s own id → its pointer, ambiguous ids dropped) and `normalizeObjective` resolves a cited id through it, deduping on the pointer; the prompt names both citable forms. Re-judged the FROZEN phonics-2 package: obj2 0 → 13 items, ASSESSED_SUFFICIENTLY, coverage 0.5 → 0.75. Tests: alias digest + validator cases, 26/26 mocked; typecheck:lumina 0; full tsc 802. **This is the calibration lane (19a) doing its job — a judge miss caught and fixed before any gate trusted the number.**

**RESIDUAL, routed not fixed — phonics-2/3 obj1 (the letter-sound IDENTIFICATION objective) still WARNs, legitimately.** Two real signals, neither a missing production surface: (a) obj1 and obj2 are near-duplicate objectives (both “produce the sound for each of the 13/19 cumulative letters”); the manifest gave the full-set di block to obj2, leaving obj1’s own blocks (see-hear 6 letters + final check) short of the whole set — a CURRICULUM objective-design question (should one group emit two near-identical objectives?), not a generator fix. (b) `letter-spotter[find_it]` sits on a letter-SOUND objective but tests letterform/letter-name recognition — off-target for that objective; a manifest PRIMITIVE-SELECTION signal (a sound objective should prefer a sound-producing block). Both honor “affordances are facts not floors” / “the manifest resolves live”, so neither becomes a curator rule. Executor: `/curriculum-author` for (a) [decide if the two objectives are distinct], `/lesson-bench journey` + manifest-selection review for (b). The CROSS-SESSION breadth of a 19-letter set (mastery inferred across sessions) remains the student-data-loop item.

**FIX SHIPPED 2026-09-05 PM (both defects the replication found).** (1) *Stops had no production surface.* di-letter-sounds and letter-sound-link now admit the eight stops of Groups 1-3 (t p c k h d g b) as CLIPPED sounds (`articulation: 'clipped'`): the judge accepts the clipped release, a schwa, or the keyword onset, and refuses the letter NAME (user ruling: keyword-onset production is evidence of a stop). Standing gate 1 narrowed from “no stops” to “no affricates/glides/clusters (j w y x qu)”; the voice speaks slash notation, which reads correctly for an ASCII consonant. (2) *Review sets were cut to the manifest count.* A named cumulative set is now drilled ONCE EACH up to `SET_COVERAGE_CAP` (20), never `min(count, len)` — the 13/19-letter review letters were vanishing. A scoped mixed session assigns each named letter once, onset only to continuants. **Confirmed on fresh generation** (`replicate-2026-09-05-postfix/`, `lesson-coverage-replicate.mjs truth`): every named letter of all three groups now has a production item, judge+truth AGREE — no gap, phonics-1 PASSES both objectives. Gates: 264/264 on the touched suites, typecheck:lumina 0, full tsc 802 = baseline. Live: **HUMAN-CHECKS #133**. **Residual, cross-session (fix #3, student-data-loop lane, NOT this slice):** a 19-letter cumulative set still cannot be mastered in one K session — mastery must be inferred across sessions with the planner rotating by least-evidence, and the judge’s set rule then reads over a sequence. This is why phonics-2/3 still WARN on obj1 (recognition across the whole set) even with production complete.

**Replicated on FRESH generation 2026-09-05 PM** (`scripts/lesson-coverage-replicate.mjs generate|truth`, packages + verdicts in `qa/lesson-coverage/replicate-2026-09-05/`): the judge and a deterministic per-letter count AGREE 3/3 — no production item for **t p** (phonics-1, 6-set), **a t i p c k e h r d** (phonics-2, 13-set; a t i p in NO primitive), **t i p n c k e h r d g u b** (phonics-3, 19-set; 8 letters in no primitive). The judge named every missing letter, missed none, called no objective SUFFICIENT; `content_guard` cited at the `unaskableLetters` blocks each time. So item 17(a) (stops) AND the set-vs-session-size gap are now machine-detected on every run, not just the frozen 12:43 packages.
**(b) SHIPPED 2026-09-05 PM — Q4 merged into the scorer.** `scoreLessonPackage` reads `pkg.coverage` through `coverageToLessonBenchSignals`
(first non-final block per objective cited; no verdict → `unknowns`, never a fail; `evidence.coverageJudge` carries status/coverage/model/source);
`score` prints the judge line; 3 scorer tests. **(a) first calibration row, same slice:** `eval --write --source calibrate` on `…pgr5.labeled` (26 s) →
judge PASS 1.00, 3/3 sufficient (obj3 `taught=false` yet 11 fast-fact items — INFO), rater holistic 5 with no `missing` → **Q4 agrees; 8/9 overall**
(the miss is item 12's parent-card Q8). Three `off_target_assessment` constraints on the same package (ten-frame for obj2; number-tracer and
number-sequencer for obj3) corroborate item 20's numeral-naming supply gap from a second lesson. **n=1 of ~20.** Skill split in the same slice:
`/lesson-coverage` owns one lesson (produce · judge · score · rate · route · rerun · confirm · calibrate, ONE routing table for judge rows and
rail labels); `/lesson-journey` owns a sequence; the `/lesson-bench` skill is gone (this queue, the packages dir and `scripts/lesson-bench.mjs` keep their names).
**Owed, in pull order:** (a) calibrate — ~19 more labeled packages, each a sitting (produce → judge → play → rate → score); (c) persistence
endpoint beside `di_run_logs.py` once the app runs where the disk is not local (item 2's shape); (d) Phase 2 defect spec → smallest
patch → re-eval (1 attempt), only after (a) agrees. No gate before (a). Executor: `/lesson-coverage` (report · diagnose · route · confirm · calibrate).

- **2026-09-06 — instrument health from the rhyming pass.** 11/69 rows carry `usedSchemaFallback`; only 2 of the 11 store a reason (both `coverage eval timed out after 45000ms`, one of them the user's live build-stream lesson `…o2cg`, total latency 57s; the loose-JSON retry then PASSED 1.00). The other 9 have `usedSchemaFallback: true` with no `schemaError` — the sink drops the reason on the non-timeout path, so the fallback mix (schema 400 vs truncation vs timeout) is unknowable from the ledger. Executor: `sink.ts` / `evaluateLessonCoverage.ts` — persist the caught error text on every fallback; then read the mix before touching `COVERAGE_EVAL_TIMEOUT_MS`. Not a lesson defect; not a threshold change.

### 20. ✅ **SHIPPED 2026-09-05 — `di-math-facts[name_numeral]`, the supply answer. MATH OPENS THE COVERAGE JUDGE — first MATHEMATICS row ever in `evals.jsonl` (all 20 prior rows were LANGUAGE_ARTS/phonics); numeral recognition/naming has no direct catalog eval mode.** Row: `kindergarten-counting-objects-to-10-20260905174750-c71j` (fresh `topic-trace?package=true` generation, source=script, `/lesson-coverage` ad hoc run — not build-stream, not a fixture). **WARN, coverage 0.75, 1/2 objectives sufficient:**
obj1 "Count a group of up to 10 real objects by touching them one by one" → **ASSESSED_SUFFICIENTLY** (9 items: counting-board 7 + final-counting-check 2).
obj2 "Recognize and name the written numbers 1 through 10 in order" → **ASSESSED_INDIRECTLY [WARNING]**. The manifest picked three components for it — `number-tracer[trace]` (handwriting production, and only digits 1–5 of the 5 sampled — `insufficient_items`), `hundreds-chart[highlight_sequence]` (tap cells on an already-ordered row), `number-sequencer[before_after]` (type the neighbour of a given number) — and the judge cited **two** `off_target_assessment` constraints: both proxy a neighbour skill (motor tracing, position-tapping, sequencing) instead of recognizing/naming a shown numeral. Checked the catalog directly: none of number-tracer's 4 modes (trace/copy/write/sequence), hundreds-chart's 4 (highlight_sequence/complete_pattern/describe_pattern/determine_interval), or number-sequencer's 4 (count_from/before_after/order_cards/fill_missing) is a receptive/expressive numeral-ID task — this is a **SUPPLY gap**, not a manifest miss (manifest-passes-generator-works doctrine holds; there is nothing for a generator fix to read here).
Layer: supply (catalog eval-mode). **Ruled (same session, 2026-09-05): DI, not tap** — a tap-to-select fix (e.g. a new `hundreds-chart` mode) assesses *recognize*, not *name*; the objective's verb is expressive, so this is spoken-first DI territory (`feedback_di-spoken-first-not-tap`). Home: a new `name_numeral` mode on **`di-math-facts`** (not a new primitive — it already carries the K/G1 spoken number-word judging engine `counting_next` uses). Execution-ready handoff with line-exact anchors across all 3 files + the backend registry: **`qa/HANDOFF-di-math-facts-name-numeral-2026-09-05.md`**. Open question the handoff does NOT resolve: `di-math-facts`'s own catalog description carves out "a dedicated counting primitive" for when counting itself is the objective — numeral naming may belong there instead; default in the handoff is the mode-on-di-math-facts path unless overridden.
Superseded by the above: `number-tracer`'s secondary 1–5-of-9 sampling gap (still real, but moot once obj2 routes to `di-math-facts[name_numeral]` instead of `number-tracer[trace]`).
Gate once the mode ships: `/lesson-coverage confirm qa/lesson-bench/packages/kindergarten-counting-objects-to-10-20260905174750-c71j.json` before/after + fresh generation ×3 (handoff's Gates section has the full list, including the `resolveTextScope` regex fix this objective's phrasing needs — "1 through 10" does not match the existing `within`-pattern).
**n=1** — replicate on 2–3 more K numeral-recognition/naming topics (or a `/lesson-journey`-style sweep) before treating this as a class rather than one row (prevalence doctrine).

**SHIPPED 2026-09-05 PM (the handoff, executed — plus one defect the handoff could not have known about).** `name_numeral` is the pack's fifth identity: one printed numeral on the stage, the child says its name aloud, the Live tutor judges the number word. Reuses the whole `counting_next` engine (numeral→word builder, ASR alias table, DISTAR model→guide→test, support tiers). β 1.5 in both the catalog and `problem_type_registry.py`, tied with `counting_next` at the ladder floor. **Three defects closed, not one:**
1. *Scope.* `resolveTextScope` had no `through` alternative, so "1 through 10" pinned nothing and fell to the K grade default — a naming session silently capped at 1-5. Regex extended; every pre-existing ask parses byte-identically.
2. *Tier.* The L4 operand-boundary shape, left applied, clamps `easy` to a maximum of five — the SAME 1-5 cap through a second door. `name_numeral` is now excluded from the operand axis outright (it has no crossing concept), reported honestly in the build log rather than faked.
3. *Session length — found by the judge, not the handoff.* The first post-fix rerun scored obj2 **ASSESSED_INSUFFICIENTLY**: right task, but the pack's five-item default assessed half a ten-numeral objective ("3, 5, 6, 7 and 8 are omitted from direct oral naming assessment"). A fact objective names a SPACE to sample; a naming objective names its whole TARGET SET. A single-mode naming session with no caller-pinned count is now sized from its pool (`NAMING_SESSION_MAX` 10); an explicit `challengeCount` and any blended session are untouched. Above ten it samples and the log says so.
Also gated OFF for this mode: the judging contract's "or after counting up to it" route (you do not count to a number's NAME) and its echo warning — on a bare-numeral stimulus "a number straight out of the problem" IS the correct answer, so leaving it in told the tutor to treat the target production as a common error.
**Before / after** (same frozen objectives + brief, `topic-trace?package=true` → `lesson-coverage eval`):

| Run | obj2 verdict | coverage | obj2 components the manifest picked |
|---|---|---|---|
| `…174750-c71j` (item-20 row, HEAD) | ASSESSED_INDIRECTLY [WARNING] | 0.75 | number-tracer[trace], hundreds-chart[highlight_sequence], number-sequencer[before_after] |
| `…184528-w95f` (mode only, 5 items) | ASSESSED_INSUFFICIENTLY [WARNING] | 0.75 | hundreds-chart, **di-math-facts[name_numeral]**, number-sequencer |
| `…184926-4cz9` (mode + length) | **ASSESSED_SUFFICIENTLY** | **1.00** | hundreds-chart, number-sequencer, **di-math-facts[name_numeral]** |
| `…185311-bpey` (fresh ×2) | **ASSESSED_SUFFICIENTLY** | **1.00** | number-line, number-sequencer, **di-math-facts[name_numeral]** |
| `…185330-0yod` (fresh ×3) | **ASSESSED_SUFFICIENTLY** | **1.00** | hundreds-chart, **di-math-facts[name_numeral]**, number-sequencer |

Selection AND resolution both land unpinned in 3/3 fresh generations — the catalog description change is what makes the curator reach for the pack at all, so both layers were verified together, never selection alone. Gates: new focused suite `gemini-di-math-facts.name-numeral.test.ts`, full `npm test` 271 files / 4670 tests, `typecheck:lumina` 0, tsc 802 = baseline (0 new). Live: `run_tutor_live.py --lesson --runs 3 --eval-mode name_numeral` **PASS, no findings**, answer withheld 3/3 (`qa/tutor-reports/di-math-facts-live-lesson-2026-09-05.md`). **HUMAN-CHECKS #134** owns the two ear questions (does a ten-item block hold a five-year-old; one run's improvised deflection offered a COUNTING hint on a naming task).
**The open scope question resolved itself as the handoff's default:** the mode lives on `di-math-facts`, and the "use a dedicated counting primitive when COUNTING ITSELF is the objective" carve-out was narrowed in `constraints` rather than contradicted — naming a written numeral has no counting in it. Not a user ruling; overturn cheaply if wanted (the number-word table and DI script pattern port to a separate pack unchanged).
**Still open from this item: the n=1 line above.** One row is not a class; the replication above is 3 runs of the SAME topic, not 3 topics.

### 18. **Affordance registry now 100% tagged (201/201, 2026-09-05) — run the scale-up A/B before trusting it broadly.**
Item 13 validated the gate at 24-29/201 against an OFF-vs-OFF churn floor of 2-3 primitives/grade at n=3; going from
there straight to full coverage in one sweep is untested at this scale. Run `node scripts/affordance-ab.mjs --runs 3`
across the existing topic set (make sure it still includes the K-literacy topic from item 17, not just math) and read
it against the item-13/17 floors: ship (no action needed, tags already live) if `lost under ON` stays inside the
established churn floor and `untagged` reads ≈0 in both arms; if a real loss appears, it now has 163 new candidates to
implicate instead of a handful. Executor: `/add-affordances --ab`.

### 21. **`kindergarten-addition` first pass (2026-09-05, `/lesson-coverage`) — three findings, one fixed in-slice.** Row:
`kindergarten-addition-20260905190456-xr70` (fresh `topic-trace?package=true`, source=script). Judge: **WARN, coverage 0.67, 1/3 sufficient.**
obj1 "combine two groups to find the total" → ASSESSED_SUFFICIENTLY (13 items). obj2 "identify the plus sign (+) and equal
sign (=)" → ASSESSED_INSUFFICIENTLY — `di-spoken-practice[read_aloud]` (`obj2-symbol-spotter`) asked all 5 items about "+" and
never "=", `insufficient_items`. obj3 "explain how putting things together makes a bigger number" → ASSESSED_INSUFFICIENTLY,
2× `off_target_assessment` (`number-line[jump]` drills backward subtraction hops, `di-math-facts[answer_fact]` drills fact
retrieval — neither touches the "bigger number" concept; only 1 item, `final-assessment-addition#problems[2]`, is on-target).
Scorer: **BROKEN** — `G1`/`Q8` fail (`equation-builder[build-simple]` declares `reads: developing`, i.e. the child must read
alone, at the pre-reader K band), `Q9` fails (known-block minutes 47 vs the 40min pre-reader cap, 10/10 blocks tagged).

**(a) + (b) — DSP-1/DSP-2 resolved 2026-09-05.** Reviewed source-token targets, code-owned coverage, and visual naming delivery replace the prompt-only patch. Final original-objective probes 3/3; automatic lesson routing 7/7; saved full-manifest selection plus production registry hydration covers both symbols. No new full-lesson or microphone sitting. DSP-3 (generic arithmetic range) remains in the primitive tracker. [Evidence and failed passes](../eval-reports/di-spoken-practice-2026-09-05.md).

**(c) content/mode, routed.** obj3's "explain … bigger number" is a conceptual/verbal objective; the manifest reached for
computation-fluency and number-line blocks instead of anything that argues FOR the concept. `comparison-panel`'s own gates
(`obj3-start-vs-end`) already probe exactly this misconception ("putting groups together makes a smaller number" → false)
but aren't picked up as assessment evidence by the digest — worth checking whether that's a digest gap (gates uncounted) or
a real SUPPLY gap (no K primitive assesses "explain why" outside a gated teach block) before deciding the fix. Executor:
open `comparison-panel`'s digest mapping first; `/curriculum-fit` if it's genuinely supply.

**(d) SELECTION, routed to `/reader-fit`/`/add-affordances`.** `equation-builder[build-simple]` is tagged `reads: developing`
and got selected into a pre-reader K lesson (G1/Q8 fail) — either the tag is wrong for this mode or the curator ignored it;
check the affordance tag against the mode's actual read demand. Same lesson also blew the pre-reader minutes cap (Q9, 47/40)
across 10 blocks for a 3-objective lesson — a lesson-length/block-count issue independent of the above three.
Gate before (c) or (d) count as done: `/lesson-coverage confirm` on a fresh generation that lands back on the touched block.

### 22. **`kindergarten-shapes` pass (2026-09-05, `/lesson-coverage`) — one INSTRUMENT bug and one CONTENT bug found and fixed in-slice; two findings routed.**
Row 1: `kindergarten-shapes-20260905194513-99mt` (fresh `topic-trace?package=true`, source=script). First judge: **WARN,
coverage 0.83, 2/3 sufficient** — obj1 "find shapes hidden in real-world objects" `ASSESSED_INSUFFICIENTLY`, claiming the
`media-player[listen_and_look]` shape-hunt story "omits squares, rectangles, triangles" and only covers circles.

**(a) INSTRUMENT — FIXED.** Opened the digest at the cited pointer: the story's 3 segments (clock=circle,
window=square, pizza=triangle) each carry their own `knowledgeCheck`, but `digest.ts`'s `ITEM_KEYS` had no `segments`
entry, so `media-player`'s segments fell into the generic `fields` flatten, capped at 700 chars — the judge literally
never saw segment 2/3 past the cutoff. This is a general risk for ANY multi-segment `media-player` block (a primitive
the catalog calls "ESSENTIAL for oral comprehension... from K up"), not just this lesson. Fix: added `'segments'` to
`ITEM_KEYS` in [digest.ts](../../src/components/lumina/service/qa/lessonCoverage/digest.ts) so each segment itemizes
with its own citable `#segments[i]` pointer, like `challenges`/`problems`. Verified: re-`eval --no-persist` on the
SAME frozen package flipped **WARN → PASS, coverage 1.00, 3/3 sufficient**, evidence now citing all 3 segments by id.
Regression-locked: [digest.test.ts](../../src/components/lumina/service/qa/lessonCoverage/digest.test.ts) (4/4).
Audited `formula-card`/`interactive-passage`'s other `segments` fields before landing — neither carries a per-segment
question, so itemizing them is inert (no false-positive risk). `sections`-nested per-section `inlineQuestion` on
`interactive-passage` is a SIBLING risk (same shape, different key) — not fixed here, queued below.

**(b) CONTENT/GENERATOR — FIXED.** The re-judge surfaced a REAL bug underneath the instrument fix: `generation_failure`
on `obj2-tracer-finger-draw` — all 4 `shape-tracer[trace]` challenges had `targetShape: 'triangle'` despite instructions
reading "Trace the circle/square/rectangle/triangle...". Root cause in
[gemini-shape-tracer.ts](../../src/components/lumina/service/math/gemini-shape-tracer.ts): the structural-difficulty
axis (`applyStructuralShape`, from the committed structural-difficulty campaign) maps `(mode, tier, gradeBand)` to
ONE canonical shape and unconditionally overwrites every challenge of that mode to it — correct for a same-shape
progression session, but it silently collapsed a NAMED-SET session (obj2's "identify circle/square/triangle/rectangle")
onto one shape, erasing the exact coverage the objective exists to teach. Classic axis-conflict-in-place
(CLAUDE.md "Contract-first edits"): a later lever edited an earlier requirement without forking. Fix: `typesWithNamedSetVariety()`
detects when ≥2 challenges of the same type already name distinct shapes pre-reshape and skips axis-2 reshaping for
that type (axis-1 scaffolding withdrawal still applies). Verified live: 2/2 fresh `topic-trace` generations now show
`targetShape` matching every instruction (triangle/square/rectangle/circle, no collapse). tsc: 0 new errors (775 total,
neither touched file appears). Vitest: 79/79 (lessonBench + lessonCoverage + exhibitAssembly) + 4/4 new digest test.

**(c) Q9 SOFTENED TO ADVISORY-ONLY — 2026-09-05, user correction.** This item originally routed a Q9 "length overage"
(99mt 48/40 min, `…3lbq` 42/40 min, both 9/9 blocks known) as a SELECTION-layer defect worth a class. **User pushback,
and it was right:** `minutes` sums each block's catalog "typical minutes" tag — a per-primitive estimate authored once,
not this generation's actual play time — and `LENGTH_CAP_MINUTES` is explicitly commented in the scorer as *"Starting
points, not doctrine... Recalibrate against labels, never against a feeling,"* set from exactly ONE labeled lesson.
Comparing an estimate to a provisional guess and citing it as a ✗ misrepresented its authority. Fixed at the mechanism:
[lessonBenchScorer.ts](../../src/components/lumina/service/qa/lessonBench/lessonBenchScorer.ts) Q9 no longer sets
`checks.Q9` at all (was `cite(...)` → hard 0; now `unknown(...)` only when over the guide, silent otherwise) — it can
never render ✗ in the header, never fail a bucket, never score in `machineVsHuman` agreement (an absent check reads as
`machine: null`, same treatment Q4 already gets with no coverage verdict). `LESSON_BENCH_CHECKS`' Q9 `passesWhen` and
the file docblock updated to say so. Tests updated: 3 assertions in `lessonBenchScorer.test.ts` that expected a hard
Q9 pass/fail now expect `undefined` + an `unknowns` note; vitest 83/83, tsc 775 (baseline, 0 new). Verified live:
`score` on both shapes packages now prints `? Q9 lesson: ... — advisory, not a fail` and no `Q9` in the checks header.
**The underlying signal is not deleted** — both packages' estimates still sit ~2-8 min over the guide, and item 21(d)
flagged the same shape on `kindergarten-addition` (47/40) — so a real pre-reader density question may still exist.
It just no longer speaks with more authority than the numbers behind it warrant. If it recurs enough to investigate,
that's a `/topic-trace` brief-density question or a `qa/HUMAN-CHECKS.md` sitting, not a scorer citation.

### 23. **`kindergarten` — first CVC-decoding pass, 2 draws (2026-09-05, `/lesson-coverage`).** Topic:
"Decoding CVC words with short a" — the subskill right after the Alphabet/Letter-Sound Correspondence
progression in the published K Language Arts sequence (unit `Phonics & Word Recognition`), i.e. "kindergarten
literacy after phonics." Rows: `kindergarten-decoding-cvc-words-with-short-a-20260905200116-rw3p` (3 objectives,
WARN, coverage 0.83, 2/3 sufficient) and `…-20260905200636-7ngg` (fresh draw, 2 objectives, WARN, coverage 0.75,
1/2 sufficient). Both fresh `topic-trace?package=true`, source=script.

**MODE/SUPPLY gap — 2/2 draws, not yet fixed.** Both packages produced an objective shaped "listen to /
identify the short 'a' sound in spoken words" (medial-vowel auditory awareness), and BOTH times the manifest's
dedicated block for it came back `off_target_assessment`: `phoneme-explorer[isolate]` (both draws) and
`di-letter-sounds` (second draw) generated INITIAL-CONSONANT items (m, h, f, s / C, M, B, P, H) instead of the
medial short-a vowel. Checked the catalog directly, not just the generator: `phoneme-explorer`'s own description
says "beginning/INITIAL-sound focus, NOT for [rhyme/ending]" and its `isolate` mode doc is explicit —
"BEGINNING-sound only" — and `di-letter-sounds`'s modes are grapheme→phoneme production, not
medial-sound-in-a-spoken-word identification. **This is a SUPPLY gap, not a manifest miss**
(`feedback_manifest-passes-generator-works` holds — there is nothing for a generator fix to read; no catalog
primitive/mode currently tests "hear a CVC word, identify its medial vowel" for K). Both draws left the
objective at 1 valid item in the final knowledge-check, short of `MIN_SUFFICIENT_ASSESSMENT_ITEMS`.
**SUPPLY SHIPPED 2026-09-05 — `phoneme-explorer[medial]`, the fifth mode.** Shape ruled by the user:
a minimal-pair CHOICE answered aloud, NOT "say the middle sound" — producing a bare vowel is an unbenched
response class, and a menu keeps the item on the already-benched `short_spoken_word` judge. The tutor SAYS a
CVC word (never printed — a child who can read "cat" and "hat" matches the letter `a` on sight and never
hears a vowel; picture + tap-to-hear carry it, segment's rule), four cards stay on screen unmarked, and the
child SAYS the one with the same middle sound. β 2.0 between isolate (1.5) and blend (2.5), backend prior
added. The ask NEVER names the vowel — extracting it from the stimulus IS the skill; the vowel is spoken only
in the DISTAR correction, where the answer is already earned.
Two things beyond the mode itself:
- **The generator moved off the pin-only `resolveEvalModeConstraint` to `resolveEvalModes`.** Pin-only was
  half a fix: an objective arriving WITHOUT a pin fell through to mixed, which spends 1 of 5 items on the
  mode the objective asked for — the same 1-item shortfall this finding is about.
- **The medial MENU IS BUILT IN CODE from a curated bank, not by the model.** Three prompt iterations could
  not stop flash-lite inventing a word to finish a rhyming set ("rom" for rim/rum, "ren"/"rin" for ran/run,
  "mep" for map/mop): 8 of 20 cards on the first pass, still 4 of 15 with an explicit real-words rule AND a
  word bank IN the prompt. It matters here more than elsewhere because a pre-reader's access to a card is its
  PICTURE — "dag" shipped as 🎒, "rud" as 🪵, so the child sees a backpack and hears a non-word. The model
  now authors only the stimulus + its vowel; code fills all four cards (rime-match preferred, so "cat" pulls
  hat/hot/hut/hit and "dog" pulls "log"), seeded from the STIMULUS so one item id keeps one menu for IRT.

Verified at runtime, real Gemini, `scripts/probe-phoneme-medial.mjs` (evidence:
`qa/eval-reports/phoneme-medial-probe-2026-09-05.json`): the lesson-level selector now pins medial for this
exact objective (`∅` → `isolate|medial`); pinned, unpinned-intent-only and hard-tier draws each produce 5/5
medial items surviving every build gate, with the ask never naming the vowel, the stimulus never on a card,
all four cards real words across four distinct vowels, and the hard tier withdrawing enumeration so the child
READS the menu. tsc 770 = baseline, literacy vitest 1267 pass (6 new medial cases in
`PhonemeExplorer.di-script.test.ts`).

**GATE CLEARED 2026-09-06 — `/lesson-coverage confirm` on both rows, before/after + fresh ×3 each.** Before:
both frozen packages re-judge IDENTICAL to their stored verdict (`rw3p` WARN/0.83, `7ngg` WARN/0.75 — judge is
stable, not the variable). After: **6/6 fresh `rerun` draws PASS, coverage 1.00, obj1 ASSESSED_SUFFICIENTLY** —
every draw routed `phoneme-explorer[medial]` for obj1 (the router pin landed) and every draw cleared
`MIN_SUFFICIENT_ASSESSMENT_ITEMS` (items=2 to 6). The SUPPLY gap is closed: this objective shape no longer WARNs.
Two residuals surfaced across the 6 draws, filed as item 27 (not blocking — margin was thin on 2/6 draws, exactly
at the 2-item floor). Packages: `…-20260906014922-xbby`, `…-20260906015020-eprf`, `…-20260906015113-5dhw` (from
`rw3p`); `…-20260906015203-8zzk`, `…-20260906015357-r8wt`, `…-20260906015521-bewv` (from `7ngg`).

**CONTENT fix — SHIPPED same session, independent of the gap above.** The first draw's final knowledge-check
also had its OWN bug: problem index 4 (tagged `obj3`, "read a CVC word to discover the secret word") was a
near-duplicate of problem index 0 (tagged `obj1`, "identify the short a sound") — same stem ("Which word has
the short a sound?"), same correct answer (cat), 2 of 3 identical options — so obj1 effectively had only 1
non-duplicated item and obj3's own reading/decoding angle went untested. Root cause: `generateKnowledgeCheck`'s
orchestrator (`gemini-knowledge-check-orchestrator.ts`) receives all lesson objective texts and is told to "tag
every problem" and "spread coverage," but had no rule requiring briefs tagged to DIFFERENT objectives to
actually test different tasks. Fix: added an explicit cross-objective-distinctness instruction to
`buildOrchestratorPrompt` (compare every pair of briefs across objectives before finalizing; rewrite one if two
would read as the same question with different words). tsc 775, 0 new (prompt-string-only edit, no type
changes touched). **Not yet confirmed** — the second draw only carried 2 objectives and didn't reproduce the
cross-objective scenario, so the fix has not been observed catching a real duplicate yet. Needs 1-2 more fresh
draws of a 3-objective CVC topic to confirm before calling it closed.

**(d) MODE, routed — "compare shapes directly" has no assessment surface.** Recurring across independent judge calls:
99mt's SECOND judge call (post-fix, `--write`) flipped obj3 to `ASSESSED_INSUFFICIENTLY` ("only 1 item directly asks
students to compare... sorter and builder blocks test isolated side counting or construction rather than comparative
evaluation"), and the independently-generated `…3lbq` package hit the same `off_target_assessment` on
`obj3-sorter-sides-corners` for the identical reason. `comparison-panel` is present in both lessons (`introduce+visualize`
role) but is never wired as an `apply`/assess block — no catalog primitive here has an eval mode that asks the student
to actively compare two GIVEN shapes' sides/corners (as opposed to counting one shape's own attributes, per
`shape-sorter[count]`/`shape-builder[build]`). Executor: `/add-eval-modes shape-sorter` (a `compare` mode judging two
shapes at once) or `/add-eval-modes comparison-panel` if it should own its own check. Gate: `/lesson-coverage confirm`
on a fresh generation once a mode exists.

Packages: `kindergarten-shapes-20260905194513-99mt.json`, `kindergarten-shapes-20260905195307-3lbq.json`.

### 24. **`kindergarten-subtraction` first pass (2026-09-05, `/lesson-coverage`) — mirrors item 21's addition pass; two findings routed, one already-known dup.** Row:
`kindergarten-subtraction-for-kindergarten-20260905202425-mb4f` (fresh `topic-trace?package=true`, source=script). Judge:
**WARN, coverage 0.75, 1/2 sufficient.** obj1 "demonstrate taking away objects to see what remains" → `ASSESSED_SUFFICIENTLY`
(12 items across subtraction-scene, ten-frame, final assessment). obj2 "identify the minus sign and the equals sign" →
`ASSESSED_INSUFFICIENTLY` — same 2-element-set shape as item 21's addition obj2 ("+"/"="): direct assessment
(`final-assessment-subtraction#problems[2,3]`) tested the minus sign twice, the equals sign zero times; separately,
`obj2-di-math-facts[subtraction_fact]` was `off_target_assessment` — it drills computing/vocalizing the difference
("4 - 0" → "four"), not identifying either sign. Scorer: **BROKEN** — same `G1`/`Q8` fail as item 21(d)
(`equation-builder[build-simple]` declares `reads: developing` at pre-reader K).

**(a) CONTENT, routed — `knowledge-check` named-set under-sampling, filed as `EVAL_TRACKER` KC-1.** Opened the package:
the shared final-assessment generator (`gemini-knowledge-check.ts`, every subject routes through it) has no lever
ensuring an objective's named 2-element set gets both elements covered — same defect shape as DSP-1, but DSP-1's fix
was scoped to one K-band DI primitive; `knowledge-check` is shared across the whole catalog, so this was NOT patched
in-slice (unvetted prompt edit here risks every other objective's assessment). Executor `/eval-fix knowledge-check` or
`/topic-fidelity knowledge-check`.

**(b) ✅ FIXED 2026-09-05 — SELECTION: `di-math-facts[subtraction_fact]` mis-selected, `EVAL_TRACKER` DIMF-1, diagnosed
against DSP-2 in [HANDOFF-dimf1-dsp2-symbol-identify-2026-09-05.md](../HANDOFF-dimf1-dsp2-symbol-identify-2026-09-05.md).**
Same SYMPTOM as DSP-2 (item 21) — a compute/production mode fighting a symbol-identify objective — but the handoff's
full diagnosis found a DIFFERENT MECHANISM: `di-math-facts` has no mode at all that identifies a printed sign (unlike
DSP-2, where a correct sibling mode existed and was passed over), so this is a catalog `description`/`constraints` gap
one stage before the resolver, not the 2nd resolver-mis-rank data point DSP-2 asked for. Fix is narrow (one primitive's
own catalog entry, `di.ts:312-313`), NOT the shared resolver — do not fold into DSP-2 without a cleaner 3rd instance. **Executed:** sign-identification exclusion added to `di-math-facts` `description` + `constraints`; headless resolver ×3 on the frozen manifest confirmed H2 (3/3 `subtraction_fact`, rationale echoes the curator intent, no correct candidate existed); curator draws selecting `di-math-facts` under obj2: before 1/4, after 0/3 (intermittent to begin with — consistent with, not proof of); fresh after-fix package `kindergarten-subtraction-20260905220159-e1b7` judge **PASS 1.00**, obj2 `ASSESSED_SUFFICIENTLY` 7 items, both signs; frozen `…mb4f` re-judged WARN 0.75 (judge stable). Scorer on the new package: BROKEN on G1/Q8 only = (c) below. (a) KC-1 stays open — one draw covering "=" is not a fix.

**(c) already known, no new entry — G1/Q8 equation-builder.** Same `reads: developing` @ PRE finding as item 21(d),
already queued at `qa/reader-fit/BACKLOG.md` item 20a with a standing user ruling (age-friendly fix, never a band
floor) — not re-filed here.

Gate before (a)/(b) count as done: `/lesson-coverage confirm` on this package + the addition package (item 21) once
either lands, since both cite the same class. Package: `kindergarten-subtraction-for-kindergarten-20260905202425-mb4f.json`.

### 25. **KNOWLEDGE-CHECK REDESIGN — design handoff, 2026-09-05 (user: "KC is showing we need a redesign, I'm seeing it come up all over the place").** [HANDOFF-knowledge-check-redesign-2026-09-05.md](../HANDOFF-knowledge-check-redesign-2026-09-05.md). Census of 38 judged lessons / 78 objectives / 20 packages: KC sized 1.3–2.5 items per objective against a ≥2 rule (0 KC items on 40 objectives); 5/5 objectives with KC as the ONLY surface were `ASSESSED_INSUFFICIENTLY`; named-set drop ×5 (KC-1 class); 5 `off_target_assessment` (recognition for production objectives, all phonics); **79/79 K problems are MC/TF**; the K palette forbids any on-screen stimulus. Three structural gaps: count-driven plan, no stimulus channel at K, pick-from-N kinds. Design: set-sized plan in code (`namedSet` from DSP-1), five K-first stimulus insets (`number-sentence`, `arrangement`, `glyph-card`, `picture-scene`, `spoken-cue`), nine production kinds mapped from the objective verb (`say_it`, `point_to`, `how_many`, `yes_no`, `which_one`, `read_it`, `sort_one`, `which_reason`, `build_it`), Bloom modes demoted to difficulty within a kind. Phases P0–P5 with runtime gates; pilot on K subtraction. Executors: P0/P1 direct edit (contract-first), P2/P4 `/add-di-loop knowledge-check` (= di item 23 slice 3), P3 `/eval-fix knowledge-check`, P5 `/lesson-journey`. Three user decisions listed in §10 (KC `minutes`, `point_to` vs `say_it` at K, kinds as eval modes). Supersedes the KC-1 prompt-patch route.

- **2026-09-05 (night) — P0–P3 BUILT (working tree), pilot confirmed on K subtraction; P4/P5 open.** Report: [eval-reports/knowledge-check-redesign-2026-09-05.md](../eval-reports/knowledge-check-redesign-2026-09-05.md). Two corrections to the handoff on the way in: `namedSet` is a NEW lexical extractor (DSP-1's is a model plan + review), and the kinds needed a `ProblemType 'production'` DATA type with a fallback menu so a no-mic device still works. Shipped: `service/insets/` (one module, item 17 P1 debt closed), insets `number-sentence` / `arrangement` (incl. two `groups`) / `glyph-card` (shapes from the di-shapes exemplar table), kinds `say_it` / `point_to` / `how_many` in the script + `KnowledgeCheck.tsx` + `ProductionProblem.tsx`, set-sized plan skeleton (`knowledgeCheckPlan.ts`, ≥2 per objective, one per named element, K budget 8), code-only `productionGenerator.ts`, orchestrator `problemCount` per legacy objective, oracle `checkProduction`, R2 FORKED in the contract. **Coverage judge before→after on the five KC-only packages:** `…e1b7` PASS→PASS (0 model calls), `…mb4f` WARN 0.75→**PASS 1.00** (obj2 both signs, KC-1 closed), `…99mt` obj2 kc 1→4 (all four shapes) but obj3 compare still INSUFFICIENT, `…xr70` obj2 INSUFFICIENT→**SUFFICIENT** (+ and =) but obj3 explain TAUGHT_NOT_ASSESSED, `…rw3p` (legacy-only control) obj1 INSUFFICIENT→SUFFICIENT PASS 1.00. The two still-open are exactly the P4 kinds (`which_reason`, `which_one` over two cards). Gates: tsc 770 = baseline, `typecheck:lumina` 0, vitest 4770 + new suites. §10: `minutes` NOT raised (budget 8, delta logged); `point_to` at K / `say_it` at G1 built; kinds-as-eval-modes deferred. Owed: mic **#135**, headless `--di` drive, P4, P5, then re-judge 26(a) explain rows.

- **2026-09-06 evidence (rhyming pass, item 28) — the 7th final-KC `off_target_assessment` row, and the first for a CREATE verb.** `kindergarten-rhyming-20260906033528-p5m6` `final-rhyme-check` declares obj3 "Create your own fun rhyming words" and emits 5 MC + 1 TF recognition items (two of them the same stem, "Which word rhymes with cat?"). The plan has no kind for open production judged by RULE ("say any word that rhymes with X"); `say_it` today is glyph-card naming only. Fold into P4 as a rule-judged `say_it` variant (expected = a rime family, the judge accepts any real word in it — exactly what `rhyme-studio[production]` already does), or route CREATE verbs to the primitive that owns the production surface and let the KC carry recognition only. Same class across the 7 rows: phonics ×4 (grapheme→phoneme production), counting ×1, equal-sign explain ×1, rhyming create ×1. Cosmetic, not a bug: all five MC problems share the Gemini id `mc_1` — `knowledgeCheckScript.ts` keys items by problem index, so nothing collides at runtime.

- **2026-09-05 (evening) — two skills split by AXIS, and Q4 joined the scoreboard.** `/lesson-bench` → `/lesson-journey`
  (sequence only); the per-lesson verbs (produce · judge · score · rate · route · rerun · confirm · calibrate) now live in
  `/lesson-coverage` behind ONE routing table (judge signal + rail reason → layer → executor). Item 7 retired into 19.
  Code: `lessonBenchScorer.ts` merges `pkg.coverage` → Q4 (19b), `score` prints the judge line, 3 tests. Gates: vitest 79/79
  (bench + coverage + assembly), tsc **802** vs baseline 802, `score --no-write` on all 5 packages (Q4 unknown where no verdict),
  then the REAL run — `eval --write --source calibrate` on `…pgr5.labeled` (26 s, judge PASS 1.00) + `score` → Q4 scored,
  agreement 8/9, 9 scoreboard rows. First calibration row banked in item 19.
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

### 26. **GRADE 1 MATH OPENS — `/lesson-coverage sweep` across 5 units, 10 fresh packages (2026-09-05).** Topics picked
one per unit from the live curriculum tree (`/curriculum Mathematics --grade 1`: OPS001/NBT001/MEAS001/GEOM001/PTRN001)
for primitive variety, all `gradeLevel=1st grade` (regrouping resolved to Grade 2 — see (e)). Packages:
`grade-1-addition-within-10-using-ten-frames-…kbg3`, `1st-grade-add-to-and-take-from-word-problems-within-20-…xr3w`,
`1st-grade-understanding-the-equal-sign-with-balance-scales-…ah5w`, `1st-grade-counting-to-120-on-a-hundreds-chart-…x2yo`,
`grade-1-tens-and-ones-place-value-with-base-ten-blocks-…vhjy`, `grade-2-adding-two-digit-numbers-within-100-with-regroup-…j2q2`,
`1st-grade-telling-time-to-the-hour-and-half-hour-…1i72`, `grade-1-identifying-and-counting-coins-…3w6h`,
`grade-1-partitioning-shapes-into-halves-and-fourths-…imq9`, `grade-1-repeating-and-growing-patterns-…f00i`.
All 10 judged WARN (0 fail), coverage 0.67–0.83, `source=lesson-coverage-sweep`. Grade 1 in `evals.jsonl` goes 0→10 rows.

**(a) ROUTED 2026-09-07 → `qa/di/BACKLOG.md` item 36 — the "explain" verb is unassessable in grade-1 math, 10/10 lessons.** Every one of
the 10 curator briefs wrote a third objective with an `explain`/`describe` verb ("explain what the equal sign means",
"explain how regrouping works", "describe the number patterns…", "explain why pieces must be the exact same size"…),
and in **all 10**, that objective landed `ASSESSED_INDIRECTLY` or `ASSESSED_INSUFFICIENTLY` — zero reached
`ASSESSED_SUFFICIENTLY`. The assessing blocks are consistently MC/true-false recognition (`equation-builder[true-false]`,
`knowledge-check`) or a primitive that tests the adjacent skill instead (sorting equal/unequal shares, setting a clock,
computing a sum) — never an item that requires the student to produce an explanation. This is the SUPPLY gap the routing
table names directly ("a K–2 production verb needs a SPOKEN mode → `/add-di-loop`"), and it is not scattered — it is
the SAME third-objective shape on every single draw. Executor: `/add-di-loop` scoped to whichever primitive the curator
already reaches for on explain-verb math objectives (see (b) — it's usually `di-spoken-practice`, and it's already
failing outright rather than under-assessing).

**(b) ROUTED 2026-09-07 → `qa/di/BACKLOG.md` item 36 (merged with (a), same root cause) — `di-spoken-practice` returns an empty item list on an "explain the rule/meaning"
prompt, 2/10 lessons (`obj2-spoken-practice` in the equal-sign package, `obj3-speak-the-rule` in the patterns
package).** Both blocks generated zero items with a note that "no matching practice is available" — the curator made
the doctrinally-correct choice (spoken production for a K-2 explain verb) and the generator declined to produce
anything, silently degrading (a) to MC/TF fallback. This looks like a different symptom than the in-flight
`gemini-di-spoken-practice.test.ts` work (named-target ownership / plan-mode conflicts / glyph ownership) — that
diff doesn't touch abstract "explain the rule" prompts with no concrete named target to plan around. **Check for
overlap with `qa/eval-reports/di-spoken-practice-2026-09-05-retest-v2.json` before starting** — it may already be
mid-diagnosis. Executor: `/eval-fix di-spoken-practice` on a plan step that has no closed named-set target to name.

**(a)+(b) ✅ CLOSED 2026-09-07 via `qa/di/BACKLOG.md` item 36 — `di-spoken-practice[explain_concept]`, the first open-proposition mode (`concept_statement` BENCHED, [run record](../di-bench/run-2026-09-07-concept-statement.md)).** Confirm, before/after: **same package** — `…ah5w` obj2 `ASSESSED_INDIRECTLY` n=3 + `generation_failure`, `…f00i` obj3 `INDIRECTLY` n=1 + `generation_failure`, both reproduced unchanged on re-judge (control ✓). **Fresh generation** (`topic-trace?package=true`, judged `--source confirm`, scored): 9 fresh packages carrying 10 explain-pinned spoken blocks — **6 shipped items, and all 6 objectives landed `ASSESSED_SUFFICIENTLY`**: `…g2e0` obj2 n=5 · `…02j5` obj2 n=5 (lesson PASS 1.00) · `…2k01` obj2 n=6 · `…0ic5` obj3 n=5 (PASS 1.00) · `…gckl` obj3 n=4 · `…fkyc` obj2 n=9 (PASS 1.00). The 4 empties (`…i08t`, `…di3p` — pre-fix "equal" anchor leak; `…xpnk`, `…57wg` — draw variance, both re-draw non-empty) keep their objective `INDIRECTLY`/`INSUFFICIENTLY` with `generation_failure`, i.e. exactly the before state — the mode never makes a lesson worse. Fresh-draw yield is the residual (di item 36 (1)). Note the curator's briefs vary per draw: `…b4i5` wrote obj2 as "balanced or not balanced" (pinned `compare_choice`, refused — separable-menu drop) and `…dip9` obj3 as "create your own pattern and explain it"; neither is this mode's shape (di 36 (2)). `evals.jsonl` +11 rows `source=confirm`; the explain-verb census now has its first non-DI-bespoke `SUFFICIENT` rows.

**(c) CONTENT, not yet routed — Q3 order fail, `annotated-example` opens a fresh objective directly on symbols,
6/10 lessons** (`…kbg3` obj2, `…xr3w` obj3, `…j2q2` obj3, `…1i72` obj2, `…3w6h` obj3, `…f00i` obj3 — all cite
"annotated-example opens obj*N* on symbols before any concrete or pictorial block"). Two more lessons hit the same
Q3 shape via a different opening block (`…ah5w` obj3 via `equation-builder[true-false]`, `…x2yo` obj1 via
`number-line[jump]`) — 8/10 total, but `annotated-example` alone accounts for 6. One package (`…vhjy` obj3) hit the
NOTATION_OBJECTIVE exemption correctly (the objective's target IS digit notation) — the scorer is not over-firing,
the curator really is placing worked/symbolic examples as an objective's FIRST block on this topic set. This is a
SELECTION/ASSEMBLY-layer ordering gap distinct from the already-tracked `AE-1..AE-4` (redundant solve steps inside
one annotated-example) — no existing `EVAL_TRACKER` entry covers placement order. Executor: trace whether
`annotated-example`'s catalog affordances (`representation`) or the curator prompt constrain it to a non-opening
slot; if not, that's the fix (same shape as the number-tracer/hundreds-chart NOTATION_OBJECTIVE precedent in item 13
— confirm before filing as a defect vs. an objective that's legitimately notation-first).

**(d) ✅ FIXED 2026-09-05 — CONTENT: `base-ten-blocks` had no deterministic number range for ad-hoc/free-topic
lessons, so it asked the model to self-select a grade band from prose.** Root cause traced in
`gemini-base-ten-blocks.ts`: when the curator supplies a `numberRange` (curriculum-launched lessons), the prompt
takes a reliable path — "INFER GRADE BAND FROM RANGE" — because the range is already a concrete number list. When
the curator supplies none (every ad-hoc `/lesson-coverage`/`/eval-test`/`/topic-trace` call), the prompt instead
showed K-1 **and** 2-3 **and** 4-5 bands together as a menu and asked `gemini-flash-lite-latest` to pick one from
the loose `${gradeContext}` prose — with no binding to the already-resolved `ctx.grade`. Confirmed at n=4 pre-fix
draws on `"Tens and ones place value with base ten blocks"` / grade 1: 2/4 `base-ten-blocks` blocks (one `build`,
one `decompose`) landed in the 2-3 band (905/801/503/505; 204/503/107/308 — all zero-tens 3-digit numbers) while
2/4 stayed correctly 2-digit. **Fix:** `defaultRangeForGrade(ctx.grade)` derives the K-1/2-3/4-5 range from the
already-canonical grade whenever the curator gives none, feeding the SAME reliable "INFER GRADE BAND FROM RANGE"
path curriculum-launched lessons already use (`gemini-base-ten-blocks.ts` — new function + `effectiveNumberRange`
threaded through `promptPlaces` and `createNumberPool`). **Verified:** 6 fresh draws post-fix (10 `base-ten-blocks`
blocks across `build`, `decompose`, `regroup` modes) — 100% landed within the grade-1 range (11-20), 0 off-band vs.
2/4 before. `/lesson-coverage eval` + `score` on one fresh draw (`…3clk`): WARN 0.67, no `off_target_assessment` on
any base-ten-blocks block (the remaining WARN is (a)'s explain-verb class + a new single-repro obj1
grouping-vs-decomposing direction mismatch, not filed — n=1). Gates: existing generator test 7/7, tsc 0 new errors
on the file, `lessonBench`+`lessonCoverage`+`exhibitAssembly` vitest 79/79. **Open question, NOT fixed here:** the
`decompose` mode was still selected for a grade-1 lesson even though the generator's own doc comments scope
`decompose` to grades 4-5 — a MODE-layer question (should this eval mode even be reachable at grade 1?) distinct
from the number-range bug just closed. Numbers-wise it's now grade-1-safe regardless; worth a `/curriculum-fit` or
`/add-eval-modes` look if `decompose` keeps showing up on K-2 draws.

**(e) INSTRUMENT/PIPELINE, single repro, needs a decision before a fix — ad-hoc `topic-trace` gradeLevel can drift
under the caller.** `…j2q2` was requested with `gradeLevel=1st grade` (`provenance.generationRequest.gradeLevel`
confirms it) but the manifest came back `gradeLevel: "Grade 2"` (`provenance.gradeLevel`, `manifest.gradeLevel`) —
Gemini's manifest schema has an ungated, `required` `gradeLevel: STRING` field
(`service/manifest/gemini-manifest.ts:198`) that the model is free to re-decide from the topic's apparent difficulty,
and `flattenManifest.ts:70` (`lessonGrade = objectives.find(o => o.grade)?.grade ?? manifest.gradeLevel`) trusts that
self-authored value as the per-objective grade fallback whenever objectives aren't curriculum-launched (true for
every ad-hoc `/lesson-coverage`, `/eval-test`, and `/topic-trace` QA call, and for any production path that hits
`useObjectives` without `preBuiltObjectives`). Net effect: the ENTIRE lesson silently generated at `ctx.grade==='2'`
instead of the requested `'1'`. **Not a one-line fix without a ruling**: when the caller passes a vague band
(`elementary`, the query-param default) letting Gemini refine to a precise grade is plausibly a feature, not a bug —
the fix needs to distinguish "caller gave a precise grade-shaped string" (always win) from "caller gave a band"
(Gemini may refine). File to `qa/HUMAN-CHECKS.md` or scope as `/eval-fix` on `gemini-manifest.ts` + `flattenManifest.ts`
once that distinction is ruled on. Blast radius not yet audited beyond these two call sites.

**(f) Noise, not filed — single-repro off-target drift, one each, no class yet:** `ten-frame` (`twoColorMode`
disabled defeats a "combine two groups" addition objective, `…kbg3`), `hundreds-chart` (defaults to skip-counting
instead of row/column location, `…x2yo`), `number-line` (jumps of +4 instead of counting by ones, `…x2yo`),
`place-value-chart` (tests digit-ID instead of the assigned addition-modeling objective, `…j2q2`). Each is a single
row — per the report doctrine, not yet a class. Watch for repeats on the next grade-1 math draw before routing.

Gate before (a)-(d) count as fixed: `/lesson-coverage confirm` on the cited package + a fresh draw ×3 per this
skill's `rerun` mechanics. (e) needs the grade-precision ruling first.

### 27. **Two residuals surfaced confirming item 23's `phoneme-explorer[medial]` supply fix, 6/6 fresh draws
(2026-09-06, `/lesson-coverage confirm`).** Neither blocked the PASS verdict (obj1 still cleared
`MIN_SUFFICIENT_ASSESSMENT_ITEMS` on every draw), but both repeated enough across the 6 draws to be a class,
not noise.

**(a) MODE — the medial menu doesn't lock to the objective's named vowel.** 4/6 draws had `phoneme-explorer`
generate its 5 challenges across MULTIPLE vowels (1 on short 'a', the other 4 drifting to /e/,/i/,/o/,/u/)
even though the objective names ONE target ("identify the short 'a' sound"). Judge flagged
`off_target_assessment` on it every time this happened. It never dropped the objective below WARN because the
knowledge-check supplies 1-2 backup items, but one draw (`…8zzk`) landed at EXACTLY 2 on-target items —
zero margin above the floor, and a schema-fallback retry on that same eval call (45s timeout) means the
verdict there is less trustworthy than the other 5. The other 2/6 draws (`…5dhw`, `…r8wt`) locked all 5
items to short 'a' cleanly — so this is intermittent generation, not structural. Executor: read
`phonemeExplorerScript.ts`'s medial-menu builder — the stimulus-selection step likely samples a random
vowel per challenge instead of pinning the objective's target vowel when one is named; `/eval-fix
phoneme-explorer` once that mechanism is confirmed.

**(b) SELECTION/MODE — `di-letter-sounds[first_sound_in_word]`/`[letter_sound]` still gets pinned onto a
medial-vowel objective it structurally cannot pass.** 4/6 draws kept a `di-letter-sounds` block on obj1
alongside `phoneme-explorer[medial]`, and every one of those 4 came back `off_target_assessment` or (new
signal, `…bewv`) `primitive_limitation`: *"required continuant onsets for first_sound_in_word, leading to
items testing m, s, f, and r instead of short /a/"* — i.e. the mode is CONSTITUTIONALLY initial-consonant-only
(per its own catalog description, cited in item 23), so pinning it to a medial-vowel objective can never
produce an on-target item; it just sits in the lesson as inert padding the judge always dings. Executor:
`resolveEvalModes.ts` — this objective shape should route ONLY to `phoneme-explorer[medial]` (+ optionally
`isolate` for a consonant sub-target), never to `di-letter-sounds`, for a "listen and identify vowel" verb.

Packages: the 6 confirm-run drops under item 23's gate-cleared note above. Gate:
`/lesson-coverage confirm` again on whichever package the fix lands on, watching specifically for
`off_target_assessment`/`primitive_limitation` on obj1 to disappear.

### 28. **`kindergarten rhyming` first pass (2026-09-06, `/lesson-coverage`) — coverage PASSES 3/3 on both fresh draws AND the user's live lesson; one tag fact fixed in-slice (Q3), two form findings routed, one residual.**
Rows: `kindergarten-rhyming-20260906033528-p5m6` (script), `kindergarten-rhyming-fun-with-words-20260906034157-t872` (lesson-coverage-skill),
`kindergarten-language-arts-rhyme-recognition-production-20260906033544-o2cg` (build-stream — the user's own drive; "this is such a good media player").
Judge: 3× PASS 1.00, every objective `ASSESSED_SUFFICIENTLY` (p5m6 13/17/9 items; t872 15/11/9; o2cg 8/13/9). rhyme-studio's spoken trio carries the
lesson — recognition (yes/no), identification (say the rhyme), production (9 open oral items = obj3 "create") — with media-player / poetry-lab / KC as extra evidence.

Scorer on p5m6, before → after: `G6 ✗ Q3 ✗ Q8 ?` → `G6 ✗ Q3 ✓ Q8 ?`.
- **Fixed in slice (a tag that was not a fact).** `rhyme-studio[production]` carried `representation: 'symbolic'`, but `RhymeStudio.tsx` renders the target's
  emoji always and its picture at PRE (`showWordImage = isPreReader || …`), so the block is picture-first. Q3 therefore read the ONLY block of obj3 as a
  symbols-first opener. Tag → `['pictorial', 'symbolic']` (`catalog/literacy.ts`, rationale docblock). Same package re-scored: Q3 fail → pass, judge untouched
  (Q4 never reads tags). Fresh t872: Q3 ✓. Agreement table: no labeled package contains rhyme-studio, so no human/machine row moved. Gates: vitest **107/107**
  (bench + coverage + assembly + rhyme-studio + affordances), full tsc **770 = baseline** (0 new).
- **Routed.** (a) G6 `poetry-lab[rhyme_hunt]` tap-only in K literacy — 2/2 fresh + o2cg → `qa/di/BACKLOG.md` **item 33** (`/add-di-loop poetry-lab`, closed_set_choice).
  (b) G6 `media-player[listen_and_look]` tap-only + Q8 unknown (no reader verdict by design) → `qa/media-player-reimagining/BACKLOG.md` evidence under Queue;
  B5 owns the ruling (spoken PRE answer vs a listening-comprehension exception to G6). (c) final-KC `off_target_assessment` for a CREATE verb → item 25 evidence
  (7th row of that class; rule-judged `say_it` is the P4 shape). (d) judge fallback bookkeeping (9/11 fallbacks store no reason) → item 19 note.
- **Residual (one row, not a class).** t872 `generation_failure` on `obj2-word-sorter-rhyme` (`word-sorter[binary_sort]`, count 6, "sort spoken words into a
  rhyming family vs not"); the judge still found obj2 sufficient elsewhere. A re-probe with `componentId=word-sorter` did not select the block, so the reason is
  unrecorded. Executor when it repeats: `/topic-fidelity word-sorter` on "rhyming" @ kindergarten, binary_sort.
- **Not a bug.** All five KC multiple-choice problems share the Gemini id `mc_1`; `knowledgeCheckScript.ts` keys items by problem index, so nothing collides.

### 29. **`kindergarten-decompose-numbers-up-to-5` first pass (2026-09-06, `/lesson-coverage`) — a SUPPLY gap (no counter-based split primitive) and a SELECTION mismatch (strategy-picker read as decomposition), both routed.**
Row: `kindergarten-decompose-numbers-up-to-5-into-pairs-in-multiple-20260906034411-uqnm` (fresh `topic-trace?package=true`, source=script). Judge: **FAIL, coverage 0.50, 1/3 sufficient, BLOCKING.**

obj1 "model splitting a group of ≤5 objects into two smaller groups using counters" → `TAUGHT_NOT_ASSESSED` [CRITICAL], `off_target_assessment`: `counting-board[count]` only runs `count_all` challenges (touch-and-count one line of objects) and `ten-frame[build]` only asks to place N counters on the frame — neither ever asks the child to split a group into two parts. obj2 "show different ways to break the same number into pairs using drawings" → `ASSESSED_INSUFFICIENTLY` [WARNING]: `strategy-picker[guided]` generated ADDITION-strategy problems (2+2, 1+4; `assignedStrategy` `draw-objects`/`counting-on`) — it teaches strategies for solving a sum, never mentions pairs, so it's off-target entirely; `number-bond[decompose]` DOES find all pairs for 3/4/5 (`allPairs`) but renders on-screen counters (`showCounters: true`), not student-produced drawings — judge flagged `primitive_limitation`, "no freeform drawing response mechanism." obj3 "describe how two smaller groups make up the total" → `ASSESSED_SUFFICIENTLY` (8 items, di-spoken-practice + knowledge-check).

**(a) SUPPLY — BUILT 2026-09-06, `ten-frame[decompose]`. Re-judge owed.**

_Original routing, kept because its catalog reading is still the grounding:_

**(a-orig) SUPPLY, routed — handoff written.** The only catalog primitive that assesses "decompose a
number ≤5 into all pairs" is `number-bond[decompose]`. Neither `counting-board` (modes `count`/
`subitize`/`subitize_perceptual`/`count_on`/`group`/`compare`, confirmed against its contract) nor
`ten-frame` (modes `build`/`subitize`/`make_ten`/`operate`, confirmed against its contract) has a
split-into-two-groups eval mode — and `ten-frame`'s `twoColorMode` schema field, which looked like
a ready-made split mechanic, turned out on inspection to be a static POSITIONAL pre-coloring, not
an interactive per-counter group choice (`TenFrame.tsx:538`); `counting-board`'s `compare`/
`group_count` "two groups" arrangement is the same — layout only, no group-assignment interaction
anywhere in either primitive. `number-bond[decompose]`'s drag-to-two-circles gesture is the only
real split mechanic that exists, and it runs inside the DI/Live-tutor loop even though the child
doesn't speak. Full grounding, three candidate designs, and files-to-touch:
[HANDOFF-decompose-to-5-counter-split-2026-09-06.md](../HANDOFF-decompose-to-5-counter-split-2026-09-06.md).
Executor: `/curriculum-fit number-bond` first (per the handoff), then `/add-eval-modes` on
whichever primitive it names.

**RESOLUTION (2026-09-06).** Handoff candidate **(A)**, homed on **`ten-frame`** — a new `split`
challenge type behind a new `decompose` eval mode (β 2.0, backend registry updated to match).
Chosen over `counting-board` because the objective says "using counters", because `allowFlip` and
the `twoColorDecompositionsExplored` metric were both already sitting in ten-frame unused, and
because `build` had already proved a placement can be judged in-band. Not (B): routing obj1 to
`number-bond[decompose]` adds no supply and leaves obj2 open. Not (C): (A) came in pilot-sized.

**One correction to the handoff's own reasoning, worth carrying forward:** it argues (A) is cheaper
than (B) because counting-board/ten-frame need no live tutor session while number-bond does. That
is stale — `CountingBoard.tsx` and `TenFrame.tsx` both open "DI modality. The Live tutor owns the
clock in every mode" and both run `useJudgedScriptRunner`. All three candidates were equally
DI-bound; the real argument for (A) was supply, not modality.

**The mechanic.** The frame opens with the whole group already on it, all red; taps FLIP a counter
red↔yellow and never add or remove one, so the total cannot drift and the only variable is where
the line between the groups falls (the two-colour counter, in software). Commits on stillness like
`build`. The verdict is computed in code and handed to the tutor as a ruling: `correct` /
`empty_part` (flipped all or none — the signature miss) / `repeat`.

**The session is the unit, which is new for this family.** "In more than one way" is not assessable
from one item however well judged, so the component keeps a per-total ledger of pairs the child has
produced; a later item on the same total that repeats one is corrected, and the rule stands down
once that total's ways are exhausted. Ordinal 1 asks "a way", later ones ask "a DIFFERENT way".

**Verified:** `typecheck:lumina` 0 · tsc **770 = baseline** · full suite **4817/4817** · 47 pack
cases + 25 stage cases · **3/3 live generator draws** on this item's own topic
(`scripts/probe-ten-frame-split.mjs`, evidence `qa/eval-reports/ten-frame-split-2026-09-06.json`),
each returning 6 split challenges with totals {3:2, 4:2, 5:2} — every total repeated, none beyond
its ways · an unpinned intent probe routed this item's exact obj1 text to `decompose` while
`build`/`make_ten` controls did not drift. Contract: **R9** in `docs/contracts/ten-frame.md`.

**⚠ A test in this slice was briefly VACUOUS and it is worth knowing why:** a shell round-trip
turned the `\b` word boundaries in the new pair-leak regex into literal backspace bytes, so the
assertion passed against a string that did contain the banned word. Caught by the live probe
failing where the unit test did not. Both are fixed and the helper carries the note.

**STILL OWED (do not read this item as fully closed):**
- `/lesson-coverage confirm` on `…-20260906034411-uqnm` — obj1 should leave `TAUGHT_NOT_ASSESSED`.
  This is the gate below and it has NOT been run; the build is verified, the re-judge is not.
- Fresh ×3 on the topic, per the gate.
- A real-browser drive. The jsdom stage tests exercise flip / stillness commit / ledger / reveal,
  but not paint, hit targets or the live tutor's voice → HUMAN-CHECKS.
- obj2's "using drawings" demand is UNTOUCHED. `split` closes obj1 only. No K math primitive has a
  freeform drawing surface, which is the `/curriculum-fit` sweep the handoff flagged and the
  question of whether obj2 is asking for supply that does not exist.

**(b) SELECTION — FIXED in-slice, confirmed 2/2 fresh.** `strategy-picker`'s catalog `description`
in `math.ts` reworded to state it solves a FIXED addition/subtraction equation and explicitly
"NOT a decomposition primitive... For 'show different ways to break a number into pairs,' use
number-bond[decompose] instead." Verified: two independent fresh `topic-trace?package=true` draws
on the same topic post-fix (`…-decomposing-numbers-up-to-5-into-number-pairs-20260906041244-66ol`
and the confirm run above it) both selected `number-bond[decompose]` directly for obj2 —
`strategy-picker` no longer appears in the block set at all. tsc **770 = baseline** (0 new). A
third fresh draw is owed once the dev server (down mid-session) is back up. The 66ol confirm run
also resurfaced the SUPPLY gap (a) identically (`ASSESSED_INDIRECTLY`, same `off_target_assessment`
on `counting-board`/`ten-frame`) — expected, (a) is unfixed — plus one unrelated residual: obj3's
`di-spoken-practice` block generated `items: []` for an open-ended "explain the pairs" prompt, the
same already-flagged class at item 21(c) (open-ended verbal explanation) — not a new finding, not
folded into this item.

Gate: `/lesson-coverage confirm` on this package before/after (a), plus fresh ×3 —
**UNRUN as of 2026-09-06; (a) is built and machine-verified, not yet re-judged.**

### 30. **`kindergarten-compare-attributes` first pass (2026-09-05, `/lesson-coverage`) — a CONTENT bug fixed in-slice on fresh generation; two findings routed.**
Row 1: `kindergarten-compare-and-describe-objects-attributes-longer-s-20260906034421-3rvk` (fresh
`topic-trace?package=true`, topic "Compare and describe objects' attributes (longer/shorter,
heavier/lighter) using direct observation and manipulation"). Judge: **WARN, coverage 0.67, 1/3
sufficient.** obj1 (length comparison) → ASSESSED_SUFFICIENTLY. obj2 (heavier/lighter by hand) →
ASSESSED_INDIRECTLY. obj3 (describe with the four words) → ASSESSED_INSUFFICIENTLY, `notes`: "heavier
and lighter are never sorted or produced." `off_target_assessment @final-assessment-attributes:
includes counting tasks (prod_how_many_12 and prod_how_many_11) unrelated to measurement attributes."

**(a) CONTENT — FIXED.** Opened `final-assessment-attributes#problems[0..1]`: two `how_many`
production items (count the fish, count the bears) carrying obj1's `successCriteria` verbatim
("Compare two real objects side-by-side to show which one is longer or shorter") — a pure
counting item mislabeled as comparison evidence. Traced to `kindForObjective()` in
[knowledgeCheckPlan.ts](../../src/components/lumina/service/knowledge-check/knowledgeCheckPlan.ts):
obj1's text contains "show" (matches `DEMONSTRATE_RE`) and "objects" (matches `OBJECTS_RE`), so the
demonstrate+objects catch-all fired and forced a `how_many` production kind on a comparison
objective that has no count/combine language at all — it should have fallen through to `null`
(legacy MC/TF, which IS what correctly happened for obj2/obj3's true_false comparison items).
Fix: added `COMPARE_ATTRIBUTE_RE` (compare/longer/shorter/taller/heavier/lighter/bigger/smaller/
larger/wider/narrower) and guarded the count/combine/demonstrate+objects branch on it, so an
attribute-comparison objective always falls to legacy regardless of incidental verb overlap.
Regression test added (`knowledgeCheckPlan.test.ts`, the exact 3rvk obj1 text) — 12/12 pass.
**Verified on FRESH generation** (`…-20260906035023-wxyu`, same topic+grade, independent draw):
the re-judged final assessment (`measurement-review-check`) now carries only on-target MC/TF
comparison items (longer/heavier/lighter); `off_target_assessment` on the final assessment is
GONE. Remaining WARN (coverage 0.67, obj2/obj3 `ASSESSED_INDIRECTLY`) is the two findings below,
present on BOTH the pre-fix and post-fix draws — confirmed real, not fixed by (a). Gates: `tsc`
770 = baseline (0 new), touched suite 12/12, `lessonBench`+`lessonCoverage`+`exhibitAssembly`
79/79.

**(b) SELECTION, routed.** `balance-scale` was picked for obj2 (heavier/lighter by hand) on BOTH
draws (`obj2-balance-scale-explore`, `obj2-balance-scale-intro`) and both times generated missing-
addend algebra ("Find the mystery number that makes both sides balance") — nothing to do with
weight. The component (`BalanceScale.tsx`) has zero weight-comparison concept; the catalog
description ([math.ts:1111-1114](../../src/components/lumina/service/manifest/catalog/math.ts))
calls it "ESSENTIAL for pre-algebra and algebra," K-2 mode is "concrete, mystery number" — a
numeric equation primitive, not a physical-weight one. The curator appears to be matching on the
literal word "balance" (as in a balance/seesaw for weighing) rather than the catalog's actual
function — same failure shape as item 29(b) (strategy-picker's "draw" matching "drawings"). This
lesson already has the correct primitive for weight (`compare-objects[compare_two]`,
`obj2-compare-objects-weight`), so balance-scale is pure noise here, not a supply gap. Executor:
sharpen `balance-scale`'s catalog `description` in `math.ts` to rule out weight/physical-object
comparison explicitly (direct edit, no fork) — then `/lesson-coverage confirm` fresh ×3 that it
stops being selected for attribute-comparison objectives. Aggregate report shows only 2 prior
`balance-scale` rows (avg cov 0.75); watch for recurrence before treating this as systemic.

**(c) SUPPLY + ruling, routed.** `di-spoken-practice` generated **0 items** for obj3's "describe
with your own words" slot on BOTH draws (`obj3-spoken-attribute-description`,
`obj3-spoken-explanation`) — a correct refusal, not a crash: `spokenPracticePlan.ts`'s task enum
(`visual_naming` / `read_aloud` / `say_answer` / `count_and_say` / `unsupported`) and the
generic-pack item schema (ONE `stimulusText`/`stimulusEmoji` per item) have no shape for a
comparative descriptive utterance about TWO observed objects — the honest-empty path
([gemini-di-spoken-practice.ts:563-569](../../src/components/lumina/service/direct-instruction/gemini-di-spoken-practice.ts))
is pedagogy-over-runnability working as designed, but it leaves obj3 with no production evidence
for the named vocabulary set. Aggregate report: di-spoken-practice already the primitive with the
worst hit rate in the whole `evals.jsonl` set (9 rows, 4 fail / 4 warn, avg cov 0.72) — this is
the SAME class, not a new one. Executor: `qa/di/BACKLOG.md` (owns spoken-modality supply gaps) —
a two-stimulus comparative `say_answer` shape needs its own eval-mode design, not a same-push
patch. Separately, `⚠ primitive_limitation @obj2-compare-objects-weight` / `@obj2-spoken-compare-
weight` on both draws ("screen-based primitives cannot verify physical hefting") is a product-
scope question — is a visual/verbal proxy acceptable evidence for a hands-on K standard, or does
it require the take-home/parent-observed surface as the ONLY valid evidence? → `qa/HUMAN-CHECKS.md`
ruling, not a code fix.

**(c) SUPPLY — CLOSED 2026-09-06.** `di-spoken-practice[compare_choice]` shipped (qa/di item 34;
[report](../eval-reports/di-spoken-practice-compare-choice-2026-09-06.md)): code owns the menu
extracted from the objective, the model writes the object pairs, and a session that asks three of
four named words ships nothing. Confirmed on BOTH frozen packages with a fresh slot spliced in —
**3rvk obj3 `ASSESSED_INSUFFICIENTLY` → `ASSESSED_SUFFICIENTLY`, lesson coverage 0.67 → 0.83**
(1/3 → 2/3 sufficient). **wxyu obj3 loses its `generation_failure` (evidence 6→8) but stays
`ASSESSED_INDIRECTLY`, and the judge says why: its verb is EXPLAIN ("in your own words"), so
closed-set selection is not the evidence it needs.** That is the handoff's out-of-scope line drawn
by the judge, not asserted — the explain shape stays with item **21(c)**. Selection verified too:
both manifests, stripped of pins, route obj3 to `compare_choice` through the real
`resolveLessonEvalModes`. Gates: tsc 770 = baseline, `typecheck:lumina` 0, vitest 570/570, live
probe 9/9. Owed: **mic #137**; NOT swept (no other `evals.jsonl` row converted — pilot-then-sweep).

Gate: (b) `balance-scale` catalog sharpening is the remaining open half of item 30 — `/lesson-coverage
confirm` fresh ×3 that it stops being selected for attribute-comparison objectives.

### 31. ✅ **SELECTION — SHIPPED 2026-09-07 (first `/lesson-coverage produce` on 1st-grade literacy, package `…l5no`) — `fast-fact[recognize]` duplicated an already-spoken primitive tap-only.** Package `1st-grade-decoding-words-with-consonant-blends-and-digraph-20260907031147-l5no`: obj1 ("Listen to and identify special sounds made by letter teams like sh, ch, th, and bl") got BOTH `phoneme-explorer[isolate]` (already Live-DI, `answers: ['spoken']`, requires mic — exactly this objective's shape) AND `fast-fact[recognize]` (a second, tap-only 4-way picture-cue block assessing the same digraphs). Bench G6 correctly flagged the tap-only block; **first-pass routing misdiagnosed it as a SUPPLY gap** (queued `/add-di-loop fast-fact` at `qa/di/BACKLOG.md` item 35) **before checking whether an existing catalog primitive already covered the objective spoken — it did.** `phoneme-explorer`'s own catalog description says "ESSENTIAL for K-2 literacy" and explicitly owns beginning/medial-sound identification; porting fast-fact would have built a second DI surface for ground already held. Corrected diagnosis: SELECTION — the resolver had no catalog signal telling it fast-fact is the wrong tool once a spoken-native primitive already claims the objective. **Fix:** one constraint line added to `fast-fact`'s catalog entry ([core.ts:364](../../src/components/lumina/service/manifest/catalog/core.ts)) — "NOT for a K-2 Language Arts beginning/middle-sound identification objective — phoneme-explorer already owns that ground answered ALOUD," leaving fast-fact's other K-2 LA automaticity use (sight words, vocabulary) untouched. **Confirmed same-day, ONE fresh draw** (`grade-1-decoding-words-with-consonant-blends-and-digraph-20260907032728-6i2p`, same topic+grade): fast-fact no longer appears anywhere in the package; bench **G6 ✓**. `qa/di/BACKLOG.md` item 35 retracted as mis-routed — see that file's history. Gates: tsc 770 = baseline (0 new). **Not swept ×3** (pilot-then-sweep; one fresh draw only) and no other `evals.jsonl` row checked for the same fast-fact-vs-DI-primitive collision shape — that sweep is the residual, not this item.

### 32. **MODE, opened same package — `phoneme-explorer[blend]` + `sound-swap[addition]` were pinned for an ISOLATE objective.** Same fresh draw (`…6i2p`): obj1's real ask is "Listen to and identify individual sounds in spoken words **before seeing the letters**" — `phoneme-explorer` has an `isolate` mode built for exactly this ("Sound Match, Tier 1") — but the resolver pinned `blend` instead, and additionally selected the distinct `sound-swap` primitive, which tested CVC phoneme addition **with the printed word visible** (judge: `off_target_assessment` ×2, "tested blending rather than isolation… tested CVC phoneme addition with text shown"). Coverage dropped to `ASSESSED_INSUFFICIENTLY` (only 1 final-check item touches real isolation). Layer: MODE (the eval-mode pin) compounded by SELECTION (`sound-swap` printing the word contradicts phoneme-explorer's own "never printed" doctrine for this objective shape — worth checking whether `sound-swap` should be excluded from beginning-sound isolation objectives the same way item 31 excluded fast-fact). Executor: trace `resolveLessonEvalModes.ts`'s pin for this objective text against `phoneme-explorer`'s `evalModes[].description` (isolate vs blend vs manipulate) — sharpen the description the resolver reads, or the resolver's verb matching. Gate: `/lesson-coverage confirm` on `…6i2p` after the fix, obj1 category improves past `ASSESSED_INSUFFICIENTLY`; not yet diagnosed further (one draw only).
