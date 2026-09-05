# HANDOFF — Lesson Bench: from labels to a closed loop

**Status (updated 2026-09-04, afternoon):** affordance framework SHIPPED **and the loop SHIPPED** — Tier A scorer,
`/lesson-bench` (score / triage / rerun), item 12 parent card, item 14 Q9. Everything still UNCOMMITTED. **Read §8 first;**
§§1–7 are the morning state.
**Queue:** `qa/lesson-bench/BACKLOG.md` items 2–4 and 11–14; `qa/di/BACKLOG.md` item 23 (the K knowledge-check note).
**Skill:** `.claude/skills/add-affordances/SKILL.md` (exists, tested). `/lesson-bench` now exists — `.claude/skills/lesson-bench/SKILL.md` (§8).
**Scope date:** 2026-09-04. Session context: the user labeled one K package, asked whether the harness was a modality on `/topic-trace` or `/topic-fidelity` (neither), then rejected grade-band selection rules in favour of registry metadata. Rulings below are theirs.

## Paste-ready executor prompt

```text
Read qa/HANDOFF-lesson-bench-loop-2026-09-04.md, then build the Lesson Bench loop as ONE slice:

1. Tier A scorer (qa/lesson-bench/BACKLOG.md item 3, narrowed): scripts/lesson-bench.mjs fills
   `scores.gates/checks` on a package for the code-judgeable checks only — G1 band, G6 modality,
   Q8 text load, Q6 variety, Q3 concrete-before-symbol, plus lesson minutes for `too-long`
   (item 14) — reading `resolveAffordances()` from catalog/affordances.ts and the package's own
   manifest/blocks. No LLM. Append {runId, gitSha, packageId, checkId, score} rows to
   qa/lesson-bench/scoreboard.jsonl. Run it on the three packages in qa/lesson-bench/packages/
   and print machine-vs-human agreement for the labeled one (…pgr5.labeled.json).
2. Triage verb: .claude/skills/lesson-bench/SKILL.md with produce / triage / rerun. `triage`
   reads a labeled package and, for every block marked fix/cut and every lessonReason, names the
   LAYER (SELECTION → catalog/manifest prompt · MODE → resolveLessonEvalModes · CONTENT →
   /topic-fidelity or /eval-fix · COMPONENT → /reader-fit or /add-di-loop · TUTOR →
   qa/di/BACKLOG.md) and writes a queue entry with that executor. `rerun` regenerates the same
   topic+grade (topic-trace?package=true), runs the scorer, and diffs against the labeled
   package so the human re-rates only changed blocks.
3. Item 12 (small, closes a real label): caregiver blocks out of the child's stream — in
   service/exhibitAssembly.ts / flattenManifest.ts, place `resolveAffordances(def).audience ===
   'caregiver'` blocks after the final assessment as a parent card at EVERY grade. Never drop them.

Rulings you must not relitigate: no grade floors, no minGrade, no catalog filtering in code
(feedback_make-age-friendly-not-band-floor, reaffirmed 2026-09-04). The only code that acts on
an affordance ADDS capability. Never guess `reader`. Keep AFFORDANCE_TAGS_DEFAULT = false until
item 13's gate passes. Gates: node node_modules/vitest/vitest.mjs run <files>; node
node_modules/typescript/bin/tsc --noEmit (baseline 802 repo-wide, lumina 0 for this slice's
files); a runtime probe of every flow you call fixed. Close in the BACKLOG + WORKSTREAMS row.
```

---

## 1. Where the tree is right now

Branch `ship/2026-08-10-judged-loop`. **Nothing from this session is committed.** Two sets of
uncommitted work share the tree — do not ship them together:

| This session (lesson bench / affordances) | Another session (3D-shape DI port, has its own handoff) |
|---|---|
| `src/components/lumina/types.ts` (+49) | `primitives/visual-primitives/math/ThreeDShapeExplorer.tsx` |
| `service/manifest/catalog/affordances.ts` (new) + `.test.ts` (new) | `primitives/visual-primitives/math/threeDShapeExplorerScript.ts` (new, **8 tsc errors**: Set / iterator spreads) |
| `service/manifest/catalog/{math,core,assessment,di}.ts` (+25 lines: tags only) | `service/math/gemini-3d-shape-explorer.ts` |
| `service/manifest/gemini-manifest.ts` (+33) | `qa/HANDOFF-di-3d-shape-explorer-2026-09-04.md` |
| `src/app/api/lumina/topic-trace/route.ts` (+44) | |
| `scripts/affordance-ab.mjs`, `scripts/affordance-coverage.mjs` (new) | |
| `qa/lesson-bench/ab/affordances-2026-09-04-12-15.{md,json}` (new) | |
| `qa/lesson-bench/BACKLOG.md`, `qa/di/BACKLOG.md`, `WORKSTREAMS.md` | |
| `.claude/skills/add-affordances/SKILL.md` (new) | |

Also in the tree from before this session (not mine, untouched): `qa/EVAL_TRACKER.md`,
`qa/HUMAN-CHECKS.md`, `qa/di/BACKLOG.md` earlier edits, `qa/eval-reports/fast-fact-2026-09-02.md`,
the staged lesson-bench files (`LessonBenchPanel/Rail`, `lessonBench/*`, `exhibitAssembly.ts`).
`/ship` will need to slice by hub file; the catalog files are shared hubs.

## 2. What shipped, and the gates that ran

**Affordance framework** — the registry metadata the user chose over grade bands.
- `ComponentDefinition.affordances` / `EvalModeDefinition.affordances`: audience (student |
  caregiver), representation (concrete | pictorial | symbolic), reader (none | emerging |
  developing — the child's OWN reading after read-aloud), answers (spoken | tap | build |
  manipulate | type), role (introduce | visualize | apply | assess), minutes, maxPerLesson.
  Absent = unknown, renders nothing.
- `catalog/affordances.ts`: `resolveAffordances(def, evalMode?)` (derives `spoken` from
  `audioInput`, applies per-mode overrides), `renderAffordanceTag` (`{for: caregiver · shows:
  concrete · reads: none · answers: spoken+build · role: apply · ~5 min · max 1/lesson}`),
  `AFFORDANCE_LEGEND` (facts, never bans), `AFFORDANCE_TAGS_DEFAULT = false`.
- Curator prompt: tag appended to each TAGGED catalog line + legend, behind
  `ManifestPromptOptions.affordanceTags`. Untagged lines byte-identical.
- `topic-trace`: `affordances=on|off` (omit → default), response echoes the effective value
  and a `selection[]` row per block (componentId, instanceId, objectiveId, isFinalAssessment,
  targetEvalMode, difficulty, resolved affordances) — a manifest-only run is scoreable with no
  catalog import.
- Pilot tags (11): counting-board, ten-frame, addition-subtraction-scene (with per-mode
  overrides), number-sequencer, number-tracer, hundreds-chart, fast-fact, knowledge-check,
  take-home-activity (`audience: caregiver`), concept-card-grid, di-spoken-practice. `reader`
  was set ONLY where a reader-fit verdict or contract line exists (counting-board, ten-frame,
  addition-subtraction-scene, knowledge-check R2, concept-card-grid, di-spoken-practice);
  number-sequencer / number-tracer / fast-fact / hundreds-chart have no PRE verdict → omitted.

**Gates that ran:** vitest `affordances.test.ts` 10/10 + flattenManifest + lessonPackage (23
total); tsc 802 repo-wide = baseline, **0 in this slice's files** (the 8 new lumina errors are
all `threeDShapeExplorerScript.ts`); route smoke: K trace with tags on returned selection rows
with resolved tags; K trace with no param echoed `affordanceTags: false`.

## 3. The A/B finding — read before touching the default

`qa/lesson-bench/ab/affordances-2026-09-04-12-15.md` — 4 topics (2 K, 2 elementary), fixed
objectives per topic, 2 runs per arm, OFF (lines as before) vs ON (tags + legend).

| | result |
|---|---|
| supply per grade (union of primitives) | K 13 → 13, elementary 12 → 13 — held in COUNT |
| composition | every primitive LOST under ON was UNTAGGED (foundation-explorer, number-line, coin-counter, comparison-panel); untagged blocks at K 1.5 → 0 |
| symbolic openers at K | 1 → 1 (no movement; obj2 in both arms was a numeral-recognition objective, symbolic is the point) |
| caregiver (take-home) at K | 1.0 → 1.0 per lesson, misplaced 0 (placed last, as the legend asks — but still IN the child's stream) |
| readsAbove | 0 everywhere (no tagged primitive claims reader > none) |
| minutes | K counting lesson 43–46 min of tagged blocks — the `too-long` number |
| noise | one OFF run returned a Next 404 page mid-batch (dev-server recompile); OFF#1 vs OFF#2 differ as much as OFF vs ON — use `--runs 3` |

**Reading:** at 11/198 the tag is a salience lever, not a demand signal. That is the ablation
the user was worried about, in a different shape — so the default is OFF and traces opt in.
Item 13 is the gate to flip it: fill the untagged primitives the pilot lessons reached for
(foundation-explorer, number-line, number-bond, comparison-builder, comparison-panel,
coin-counter, array-grid, skip-counting-runner, base-ten-blocks, regrouping-workbench,
annotated-example, di-dice-roll, curator-brief), re-run `--runs 3`, flip when "lost under
ON" is empty at both grades.

## 4. The user's two labels, re-routed (this is the point of the whole thing)

The labeled package is `qa/lesson-bench/packages/kindergarten-counting-objects-to-10-20260904013634-pgr5.labeled.json`
(holistic 5, 8 keep, 1 cut, 1 fix). Neither finding was a grade problem:

| label | what it actually is | where it lives now | executor |
|---|---|---|---|
| take-home-activity **cut**, "too-much-reading" | AUDIENCE: an adult reads it; the tag alone leaves it in every K lesson | lesson-bench item 12 — render caregiver blocks after the final assessment as a parent card, every grade | direct edit in `exhibitAssembly.ts` / `flattenManifest.ts`, then one Bench sitting |
| knowledge-check **fix**, "says the answer, then has to click too" | COMMIT path: the spoken verdict did not commit; first find whether the judged set fell to taps (all-or-nothing gate: every problem judged AND a mic) | `qa/di/BACKLOG.md` item 23, OPEN note dated 2026-09-04 | `/add-di-loop knowledge-check` contract check (R2) |

Third, from the earlier probe (item 5): hundreds-chart opening a K count-objects block is a
REPRESENTATION-order miss (Q3), and its own catalog line says it is good for K — not a ban.

## 5. What is still open, in pull order

1. **Tier A scorer** (item 3, narrowed to the code-judgeable checks the tags enable) — `scores`
   is null in the labeled package; the human label has no machine half to calibrate against.
2. **`/lesson-bench` skill: produce / triage / rerun** — nothing consumes a label yet. This
   session routed the two labels by hand; the verb is the loop.
3. **Item 12** — small; closes the take-home label for real.
4. **Item 13** coverage rollout (`/add-affordances`, `node scripts/affordance-coverage.mjs`
   is the ledger) → re-A/B → flip default.
5. **Frozen set** (item 4) — one topic cannot show a trend.
6. HUMAN #125 (browser drive of the rail) and #128/#129 remain the user's.

## 6. Commands that work in THIS environment (node_modules/.bin is unreliable)

```bash
cd "c:/Users/xbox3/claude web tutor/my-tutoring-app"
# dev server: PROBE FIRST with a long timeout — a cold server takes >5s to answer
curl -s -m 120 -o /dev/null -w "%{http_code}" http://localhost:3000/api/lumina/topic-trace
# tests / types without .bin shims
node node_modules/vitest/vitest.mjs run src/components/lumina/service/manifest/catalog/affordances.test.ts
node node_modules/typescript/bin/tsc --noEmit | grep -c "error TS"      # 802 baseline
# affordance probes (server on :3000)
node scripts/affordance-coverage.mjs                # untagged ledger (--tagged for the other list)
node scripts/affordance-ab.mjs --runs 3             # OFF vs ON, writes qa/lesson-bench/ab/
curl -s -X POST localhost:3000/api/lumina/topic-trace -H 'content-type: application/json' \
  -d '{"topic":"Counting objects to 10","gradeLevel":"kindergarten","manifestOnly":true,"affordances":true}'
# a Bench package (full pipeline, images kept)
curl -s "localhost:3000/api/lumina/topic-trace?topic=Counting%20objects%20to%2010&gradeLevel=kindergarten&package=true"
```

**Env footgun hit mid-slice (memory `second-next-dev-corrupts-cache` updated):** a second
`next dev -p 3000` died on EADDRINUSE and wiped `node_modules/.bin` + packages
(`@google/genai` among them). `npm install --no-audit --no-fund` restored it in 18s; the
surviving server had to be restarted (`taskkill /PID <listener> /T /F`, then
`Start-Process npm.cmd run dev -- -p 3000`). Windows Python prints need
`sys.stdout.reconfigure(encoding='utf-8')`; Git-Bash `/tmp` is not Python's `/tmp` — use
the scratchpad path.

## 7. Memory written this session

- `project_affordance-framework.md` (new) — what/why/A/B finding/how to apply.
- `feedback_second-next-dev-corrupts-cache.md` (updated) — the node_modules form.
- `MEMORY.md` — one pointer line under "Primitives — eval modes, generators".

## 8. Continued 2026-09-04 (afternoon) — what the executor prompt produced

**Shipped (all uncommitted, on top of §1's tree):**
- `service/qa/lessonBench/lessonBenchScorer.ts` (+ `.test.ts`, 13 tests) — Tier A scorer (G1 reader axis · G4 ·
  G6 K-2 literacy · Q3 · Q6 + maxPerLesson · Q7 · Q8 · Q9), `machineVsHuman`, `triageLabel` (reason → layer →
  executor → queue; `TUTOR_NOTE` keyword routing for reason-less notes).
- `scripts/lesson-bench.mjs` — `score | triage | rerun | diff`; loads the TS scorer + LIVE catalog through vite's
  module runner (no tsx/esbuild in this repo; memory `vite-module-runner-for-ts-scripts`). `--no-write` keeps package
  files untouched. Scoreboard `qa/lesson-bench/scoreboard.jsonl` (80 rows, 3 runs @ `1a591c80`).
- `.claude/skills/lesson-bench/SKILL.md` — produce / score / triage / rerun + the three scorer rules.
- `lessonPackage.ts` — `Q9 Length` check, `too-long → Q9`, `scores.unknowns` + `scores.evidence` (optional).
- Item 12: `exhibitAssembly.ts` (`partitionCaregiverBlocks`, `isCaregiverBlock`; caregiver blocks after the final,
  stamped `audience`) + `types.ts` (`OrderedComponent.audience`) + `ManifestOrderRenderer.tsx` (parent-card frame in
  `OrderedSection`) + `KindergartenStage.tsx` (rails skip caregiver) + `LessonScreen.tsx` (parent cards after the
  finish) + `exhibitAssembly.test.ts` (5).
- Packages: every `packages/*.json` now carries `scores`; `…t93c.json` + `.rerun.md` are the rerun of `…pgr5` (carried
  keeps pre-filled; take-home + knowledge-check on the RE-RATE list). `qa/lesson-bench/triage/…pgr5-2026-09-04.md` is
  the triage output.

**Gates that ran:** vitest 36/36 (bench set + assembly + affordances) · tsc **802 = baseline**, 0 in this slice's files
· `score` on all five packages · `triage` on `…pgr5` · `rerun` end-to-end against :3000 · headless Chrome drove the
replayed `…t93c` (scroll layout: take-home LAST, after the knowledge-check, inside the "For a grown-up" frame; no
generation POSTs). NOT driven: the K-stage path and phone width → HUMAN-CHECKS **#132**.

**Calibration finding #1 (read before touching Q3):** the first scorer failed Q3 on `number-tracer` opening
"Match the written numbers 1-10 to groups" — the user had KEPT that block at holistic 5. An objective whose TARGET is
notation opens on symbols by definition, so `NOTATION_OBJECTIVE` (objective text) turns that Q3 into an `unknown`
with the objective quoted. Agreement on `…pgr5` went 6/8 → 7/8; the remaining disagreement is Q8 on the take-home,
which item 12 answers by placement (re-rate, not a scorer bug). Stated side effect: the item-5 `hundreds-chart`
finding is now Q3-unknown as well ("Identify written numbers 1-10" targets notation).

**Open, in pull order (queue is authority):** item 13 coverage → re-A/B → flip default · item 15 reader verdicts for
number-tracer / number-sequencer / fast-fact / hundreds-chart (Q8 is blind to them at K) · item 16 bare band → no
canonical grade · item 4 frozen set · #125 + #132 sittings · `/ship` by hub file (§1's two lanes still share the tree;
`threeDShapeExplorerScript.ts` still owns the 8 lumina tsc errors inside the 802).

### 8b. Item 13 closed (same afternoon)

18 more `/add-affordances` tags (29/201; ledger regex fixed so `comparison-builder` counts), two `--runs 3` A/Bs
(`ab/affordances-2026-09-04-14-41.md`, `…-14-49.md`), `--against` added to the A/B script for the OFF-vs-OFF floor,
**`AFFORDANCE_TAGS_DEFAULT = true`**. Reader rules added to the skill: WRONG-BAND @ PRE with a text-only answer surface →
`reads: developing` (how-it-works); a shipped judged-loop port → `reads: none`. Bench side effects: Q9 cap 35→40 (the ninth
tag on `…pgr5` pushed it to 38 known minutes at holistic 5), a real Q3 catch on `…ybwp` (annotated-example opens a concrete
counting objective). Gates: consistency 10/10 · typecheck:lumina 0 · route smoke. Uncommitted, same two lanes in the tree.
