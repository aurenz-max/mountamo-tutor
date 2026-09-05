# Add Affordances — What Does This Block Demand of the Child?

Tag ONE primitive's catalog entry with the facts the curator needs to place it well
and the Lesson Bench needs to score it — who reads it, where it sits on the
concrete → pictorial → symbolic ladder, how much reading the child's own path needs,
what the child produces to answer, which rung it serves, typical minutes, and how
often it may appear. Grade ranges are deliberately NOT a field.

**Outcome:** the primitive's `affordances` block (and per-mode overrides where modes
differ) is filled from evidence, the consistency test passes, and the A/B shows the
tag changed selection in the intended direction without costing supply. Nothing is
ever removed from the catalog — an untagged primitive renders exactly as before.

**Arguments:** `/add-affordances <primitive-id> [<primitive-id> ...]`
- `/add-affordances number-line` — tag one primitive
- `/add-affordances --coverage` — print the ledger (`scripts/affordance-coverage.mjs`)
- `/add-affordances --ab` — run the A/B only (`scripts/affordance-ab.mjs`)

## Why affordances and not grade bands (read before filling anything)

User ruling 2026-08-07, reaffirmed 2026-09-04: a grade floor removes the primitive
along with the demand, and shrinks supply at the band with the least content. The
reasons a block fails a five-year-old are DEMANDS — reading load, answer modality,
audience, symbol-before-concrete — and each is a fact about the primitive that holds
at every grade. The first Lesson Bench labels all looked like grade problems and none
was: take-home in a K lesson = audience (an adult reads it); knowledge-check at K =
answer commit (spoken, then forced to tap); hundreds-chart opening a K count-objects
block = representation order. Framework + rationale:
`service/manifest/catalog/affordances.ts`.

## The fields — and where each value COMES FROM

Values are derived, never authored. If the source doesn't exist yet, leave the field
out: absent = unknown, and the tag simply omits it. A guessed value is worse than a
gap because the Bench scores against it.

| Field | Values | Source of truth | If no source |
|---|---|---|---|
| `audience` | `student` (default) · `caregiver` | Who reads the block. Home activities, parent notes → `caregiver`. | omit (= student) |
| `representation` | `concrete` (objects the child acts on) · `pictorial` (pictures) · `symbolic` (numerals, words, grids) — one or a list | The component's stage: what is on screen. Eval-mode descriptions often say it outright ("Concrete manipulative", "Pictorial recognition", "Transitional symbolic"). | omit |
| `reader` | `none` · `emerging` · `developing` — the reading the child's OWN path needs AFTER read-aloud is accounted for | A reader-fit verdict: READY @ PRE → `none`; READY @ EMERGING (not PRE) → `emerging`; **WRONG-BAND @ PRE whose stated cause is a text-only answer surface → `developing`** (the verdict names the demand — how-it-works); a contract line like knowledge-check R2 counts; **a shipped judged-loop port → `none`** (the runner owns every cue and the port's live gate proved it — di-math-facts, di-dice-roll, number-bond). `qa/reader-fit/<id>-*.md`, `docs/contracts/<id>.md`. | **omit** — never infer from "it has a tutor" alone |
| `answers` | `spoken` · `tap` · `build` · `manipulate` · `type` — list | The component's commit path. A judged pack (`audioInput`) already derives `spoken`; declare it anyway when the entry declares `answers`. Number-tracer traces → `manipulate`; MCQ → `tap`; counters placed → `build`. | omit |
| `role` | `introduce` · `visualize` · `apply` · `assess` — one or a list | The curator's phase ladder. Exposition → `introduce`; a tool you watch/explore → `visualize`; practice → `apply`; a check → `assess`. | omit |
| `minutes` | integer | Typical time on one block. DI packs ~5, drills 3–4, a home activity 10. | omit |
| `maxPerLesson` | integer | The prose constraint that already says it ("Typically one per exhibit", "Max 1 per page"). | omit |

**Per-mode overrides** (`evalModes[].affordances`, only `representation` / `reader` /
`answers`): fill when modes genuinely differ — ten-frame `build` is hands, `subitize`
is spoken; addition-subtraction-scene `act_out` is manipulate, `solve_story` is spoken.
The curator sees the primitive-level union; the Bench scores the resolved mode.

## Procedure

1. **Read the entry and its evidence.** Catalog entry, `docs/contracts/<id>.md` if it
   exists, the newest `qa/reader-fit/<id>-*.md`, the component's commit path (what
   fires the answer). Ten minutes, not an audit.
2. **Fill the block** right after `constraints:` (or `description:`), e.g.
   ```ts
   affordances: { representation: 'concrete', reader: 'none', answers: ['spoken', 'build'], role: ['visualize', 'apply'], minutes: 5 },
   ```
   Add mode overrides after the `evalMode:` line of any mode that differs.
3. **Gates:**
   ```bash
   cd "<abs>/my-tutoring-app"
   node node_modules/vitest/vitest.mjs run src/components/lumina/service/manifest/catalog/affordances.test.ts
   npm run typecheck:lumina
   ```
   The test rejects out-of-enum values, a judged pack whose `answers` omits `spoken`,
   a spoken answer without a tutoring scaffold, a caregiver block that assesses, and
   a mode override naming a mode the primitive lacks.
4. **A/B when the tag could move selection** (a new `audience`, `reader`, or
   `representation` on a primitive the curator picks often):
   ```bash
   node scripts/affordance-ab.mjs --runs 2            # dev server on :3000
   node scripts/affordance-ab.mjs --topics my.json    # [{topic, gradeLevel}]
   ```
   It fixes objectives per topic, runs `affordances=off` vs `on` manifest-only, and
   writes `qa/lesson-bench/ab/affordances-<stamp>.md`. **Ship only if the per-grade
   `lost under ON` column is empty** (supply held) and the intended signal moved
   (symOpen at K down, caregiver misplaced 0, readsAbove at K down). A plausible
   per-lesson rationale is not a policy — the resolver stage buried two of those.
5. **Record.** One line in `qa/lesson-bench/BACKLOG.md`'s log with the A/B file. No
   report; the A/B markdown IS the report.

## What this skill never does

- Add a grade floor, a `minGrade`, or any field that makes a primitive unselectable.
- Guess `reader`. The only sources are a reader-fit verdict or a contract requirement.
- Filter the catalog in code. The only code that acts on an affordance is an assembly
  transform that ADDS capability (read-aloud, spoken commit) — queued separately.
- Re-order blocks. `role` and `representation` are facts the curator reads; a second
  reorder pass was measured and rejected twice (`resolveLessonEvalModes.ts` header).

## Rollout state — COMPLETE, 201/201 tagged (2026-09-05); default ON since 2026-09-04

Pilot (11, 2026-09-04 morning): counting-board, ten-frame, addition-subtraction-scene,
number-sequencer, number-tracer, hundreds-chart, fast-fact, knowledge-check, take-home-activity,
concept-card-grid, di-spoken-practice. Batch 1 (13): foundation-explorer, number-line, number-bond,
comparison-builder, comparison-panel, coin-counter, array-grid, skip-counting-runner, base-ten-blocks,
regrouping-workbench, annotated-example, di-dice-roll, curator-brief. Batch 2 (5): equation-builder,
pattern-builder, how-it-works, di-math-facts, strategy-picker. Post-batch-2 individual adds (9,
2026-09-05 morning, item 15/17): the four K reader-fit closes (number-tracer, number-sequencer,
hundreds-chart, fast-fact re-audited) plus the K-literacy-frontier four (phoneme-explorer,
letter-sound-link, word-sorter, sorting-station) and di-letter-sounds/di-word-reading. **Full-registry
sweep (163, 2026-09-05 afternoon):** every remaining catalog file — astronomy, biology, calendar,
chemistry, core, engineering, history, literacy, math, media, physics, assessment — tagged in one pass
via ten domain-parallel agents, each grounded in on-disk reader-fit verdicts/contracts where they
existed and otherwise omitting `reader` rather than guessing. `qa/lesson-bench/BACKLOG.md` item 13
(full-sweep entry) has the per-domain breakdown.

The pilot A/B (`qa/lesson-bench/ab/affordances-2026-09-04-12-15.md`) found that at 11/198 the tag
was a **salience lever** — every primitive lost under ON was untagged. After the two batches the
`--runs 3` A/Bs (`…-14-41.md`, `…-14-49.md`) showed untagged picks ≈ 0 under both arms and every
OFF→ON loss smaller than the OFF-vs-OFF floor (2-3 primitives per grade at n=3), so
`AFFORDANCE_TAGS_DEFAULT = true` (`catalog/affordances.ts`). **How to read a future A/B:** run it
with `--against <previous .json>`; ship on the pooled-loss column and the untagged column, never on
a single run's "lost under ON" (that column is noise at n=3). `qa/lesson-bench/BACKLOG.md` item 13.
**The full-registry sweep has not yet had its own A/B** — item 13's gate was only validated up to
29/201; item 18 queues one `--runs 3` pass over the existing topic set to confirm the same floor
holds at 100% coverage before treating the tags as fully trustworthy signal at scale.

`node scripts/affordance-coverage.mjs` now prints 0 untagged. There is no more pull queue — this
skill's future invocations are for a NEW primitive born after this sweep (tag it at birth, per
`/primitive`'s own checklist) or for correcting a tag that evidence later contradicts, not for
sweeping the catalog again.
