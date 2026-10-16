# Difficulty is code-owned (Phase 8) — queue

Moved out of `WORKSTREAMS.md` 2026-10-15 (index over its size gate). Done rows and their
evidence are in `git log -p WORKSTREAMS.md` (through f9ee7e45) and the per-primitive reports.
Close a row here, in the same slice as the work.

## Math item spaces (`/add-item-space`)

State: 24 spaces, ~26 primitives wired (committed a8521991, 4495aeff, c9da7296, 5e75e1d0).
Reports: `2026-10-13/REPORT.md`, `2026-10-14/kc-subjects-REPORT.md`.

| # | Item | Executor | State |
|---|---|---|---|
| 8.1a | tape-diagram multi_step draws the intermediate and the answer as extra parts of one bar ("Total = 37" for 8 + 6 - 5); fix the diagram, then wire add-sub-20 two-step items | `/eval-fix` then `/add-item-space` | **DONE 10-16** — one part-whole bar per step (whole under the parts, step 2 starts from step 1's result, no chain total); code computes every intermediate; tiered K-2 draws add-sub-20 two-step items; oracle checks the chain. Probe `2026-10-16/td-multistep-g1.txt`, HUMAN-CHECKS #185 |
| 8.1b | Numbers converge with working tier levers: tape-diagram represent (4/6/5) and solve_part_whole (12/8/15 cookies), comparison-builder order | `/add-number-pool-service` | QUEUED 10-14 |
| 8.1c | knowledge-check offers non-math glyphs as far options on symbol questions ("十", "हू"); KC passes no scope to a space (two-digit compare objective drew 3 vs 14) — add `scopeOf` to compare spaces (pattern from 8.1m) | `/eval-fix` | QUEUED 10-14 |
| 8.1d | measurement-tools convert is in<->cm with 2.54 (decimal multiplication); 4.MD.A.1 is within one system. **Decided 10-15:** cross-system stays allowed; the objective's grade sets the units (4.MD/5.MD within one system, cross-system only when the objective asks, e.g. 6.RP.3d) | `/eval-fix` | QUEUED 10-15 |
| 8.1e | ratio-table missing_value header shows the scale factor (contract R2), doing 6.RP.3's step. **Decided 10-15:** hide the factor at every tier; the xm label becomes part of the `times_arrows` help lever. Tiers stay structural (whole factor, non-whole, unit rate below one), never support | `/primitive-contract ratio-table` fork, then `/add-support-tiers` | QUEUED 10-15 |
| 8.1f | percent-bar find_part / find_whole ask the other mode's question | `/eval-fix` | QUEUED 10-14 |
| 8.1g | fraction-bar `compare` names one fraction, does not compare. **Decided 10-15:** build a real compare (two bars; bigger, or < = >; easy same denominator, medium same numerator, hard unlike or vs 1/2, from the `fraction-compare` space) and rename today's mode to what it does so its lessons keep working | `/add-eval-modes fraction-bar` | QUEUED 10-15 |
| 8.1i | length-lab two_unit_compare: answer is the small unit on every item; lengths 6/8/10 at every tier | `/eval-fix` | QUEUED 10-14 |
| 8.1j | `compare-numbers` takes three-digit objectives (space is within 100) | `/add-item-space` | QUEUED 10-14 |
| 8.1n | fraction-bar `add_subtract`: ruling owed before wiring | user | QUEUED 10-14 |
| 8.1o | Full-suite load flakes: `compareNumbers.test.ts` (tier gaps), `areaModelItemSpace.test.ts`, `gemini-di-shapes.test.ts` fail in the full vitest run and pass alone (10-16, two runs, different subsets). Seed or widen the sampled assertions | `/eval-fix` | QUEUED 10-16 |
| 8.1o | Browser: off-multiple skip-counting-runner line; hundreds-chart count from 23 | user (HUMAN-CHECKS) | OWED |

## K-2 word spaces (`/add-word-space`)

State: library + service + 15 primitives BUILT and committed 99f464fa. Reports under
`../word-space-lab/2026-10-13/<primitive>/REPORT.md`.

| # | Item | Executor | State |
|---|---|---|---|
| 8.2q | **One browser sitting closes the word-space browser debt:** Language Arts tester, each of the 13 `DIFFICULTY_PRIMITIVES` x easy/medium/hard (phoneme-explorer, phonics-blender, cvc-speller, sound-swap, rhyme-studio, syllable-clapper, letter-sound-link, word-workout, letter-spotter, picture-vocabulary, word-sorter, word-flip, spelling-pattern-explorer, di-word-reading, di-sentence-reading) | user or `/run` | OWED |
| 8.2p | WS-R relation table (opposites, goes-with, scales), reviewed like the ratings; unblocks picture-vocabulary association/opposite/gradable_scale, word-sorter match_pairs | user + `/add-word-space` | QUEUED, needs the user |
| 8.2b | More rating review welcome on the review page (https://claude.ai/artifact/HXUusXVu2zBxzBz2oSkawY); re-run `build-lexicon.mjs`; flagged pictures: pickle, jam, cold-as-weather | user | open |
| 8.2-R | Rulings in reports: phoneme-explorer (3 decisions), rhyme-studio (library rhymes as production key?), word-workout (vowel-only nonsense pairs vs ear gate), di-word-reading (3), di-sentence-reading (bank live unreviewed? group-1 sentences) | user | owed |
| 8.2-C | Contracts owed: `/primitive-contract syllable-clapper`, `/primitive-contract spelling-pattern-explorer` | `/primitive-contract` | QUEUED |
| 8.2-L | decodable-reader ladder: Live sitting on windows above 8 words (`run_live_runtime.py --difficulty`) | user (paid) | OWED |
