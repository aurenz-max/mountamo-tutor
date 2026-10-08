# Handoff: open build, next phase (wave 3+) — 2026-10-07

## 1. What this is

Build is a **modality**: the learner MAKES an example of the skill on an empty scene, many makes pass, and the
primitive's own code judges at "I'm done!". The tutor teaches from what was made. Waves 1 and 2 put that on ten
math primitives. The next phase takes it to non-math primitives, the engineering builders, and the remaining
gaps in the roadmap.

- Queue and rulings: `my-tutoring-app/qa/open-build/ROADMAP.md` (OB-0..OB-6, R1..R9). WORKSTREAMS Phase 4 row.
- The spec every build mode follows: `.claude/skills/add-eval-modes/references/build-mode.md` (executor `/add-eval-modes`;
  binding a legacy family first is `/add-live-tutor-tools`).
- Per-mode reports: `my-tutoring-app/qa/open-build/<primitive>-2026-10-07/REPORT.md`.

## 2. State — read before doing anything

**Waves 1 and 2 are NOT committed** (about 180 paths in the working tree, merged and gated). Ship them first with
`/ship`. Until then a parallel worktree starts from HEAD and cannot see any of it (wave 2 hit exactly this).

| Wave | Modes | Gates (merged tree) |
|---|---|---|
| 1 | coin-counter `show-amount`, base-ten `build_two_ways`, fraction-circles `build_equal`, equation-builder `make-n`, bar-model `make_graph` | `typecheck:lumina` 0 · Lumina vitest 780/783 files (3 load timeouts, pass alone) · full tsc 770 = baseline · backend registry has all modes |
| 2 | array-grid `make_array`, fraction-bar `build_equal`, polygon-area-builder `build_area`, angle-workshop `make_angle`, shape-builder `make_shape` — all five also newly bound to the workspace (W1) | same run |

Every mode: empty start; "I'm done!" commit (no `armStillness`); Try again keeps the build; the made quantity
published as NUMERIC scene facts (so the shared `workHistory` records self-corrections); levers bare at start;
code owns every target; catalog `answers: ['build']`.

Shared changes the next phase inherits:
- The tutor side is automatic on the workspace: the pause fact (`WORK_PAUSE_MS`), `demand.workHistory`, plain-fact
  verdicts, and the doctrine rules (credit how they got there; when told they stopped, invite the next step, never
  do it). Evidence in `build-mode.md` § "The tutor during a build".
- Build watcher: fraction words added to the number filter; optional `neverSay` word list (prompt + code filter).
- `GUIDANCE_MAX` / `OFFER_GUIDANCE_MAX` = 4000 (our own bound, not a model limit).

## 3. Verification debt (carry forward, do not re-derive)

- **Browser:** 3 of 10 driven headless (coin-counter, bar-model, base-ten; `qa/open-build/browser-drive-2026-10-07/`,
  scripts re-runnable). The other 7 are jsdom-only. Findings: base-ten +/− buttons 28 px, coin-counter tray coins
  ~28 px (the only way to remove a coin) — below 44 px; fix in the families' next slice.
- **Live:** none of the ten has had its tutor wording run. Each rides its family's next class Live gate (paid; user approves).
- **Rulings R1–R9** (ROADMAP): stillness auto-submit on 13 families (R1); watcher voice (R2); target's own cut fails
  (R3); build modes in unpinned sessions (R4/R7); turned array / holed shape (R5); angle degrees to the tutor (R6);
  shape-builder no model call (R8); fraction-bar step misses (R9). None blocks wave 3.

## 4. Next phase

| Order | Item | Notes |
|---|---|---|
| 0 | `/ship` waves 1+2 | Then fork worktrees from the new HEAD |
| 1 | **OB-3L literacy**, exactly as planned in ROADMAP § "Literacy wave (OB-3L)": L0 shared word judge (`judgeWordBuild`: structural checks in code, then Jev typed questions with code-owned thresholds, flash-latest fallback), then the word-builder `build_affix` pilot alone, driven in the running app, before the L2-L7 sweep | User ruling 10-07: no code word list (R10 withdrawn); literacy builds are judged by a model reading the build against the ask, like open-builder. R11 (word-builder grade-2 floor) is owed before L1. Pilot-then-sweep: stop after L1 if the tile row or the judge is wrong for children |
| 1b | **OB-3S science**: habitat-diorama "a habitat the frog survives in", food-web "a 4-link chain to a hawk", molecule "any molecule with a double bond" | Code can judge all three (needs set, graph, valence); independent of L0, so it can run in parallel with the literacy pilot. Bind legacy families first |
| 2 | **OB-4** engineering design builders (bridge, tower, gear, pulley, blueprint) onto the build layer | Already open; they need "I'm done!", the watcher and the workspace |
| 3 | **OB-5** text-only families publish numbers (coin cents done; open-builder, sequencers) | So `workHistory` works |
| 4 | **OB-6** modality coverage matrix (skill × `answers`) with `/lumina-portfolio` | Finds skills with no build mode; the catalog `answers` field is the modality axis |

## 5. How to run a wave (what worked, what bit)

1. Ship first; launch one `isolation: "worktree"` agent per primitive, background, ≤ 5 at a time.
2. Prompt each with: worktree setup (`git merge --ff-only` to the branch; node_modules junction created AND removed
   before finishing — a leftover junction lets worktree cleanup delete the shared install); no commit, no dev
   server, no paid Live; follow `build-mode.md` step by step; contract-first; the hard requirements above; the gate
   list (vitest, `typecheck:lumina` 0, full tsc no new errors, live-activity suite, journey sweep on a saved payload,
   one real generator run checked by the oracle, real watcher lines); final message = full report text.
   The wave-1/2 prompts are in this session's history and in the per-mode reports' structure.
3. **Subagents cannot write `.md` report files** (the harness blocks it). The coordinator saves `REPORT.md` from the
   hand-back.
4. **Merge** with `qa/open-build/tools/merge_wt.py <worktree>`: new files copied, changed files 3-way merged against
   HEAD with line endings normalized. Hub files conflict on adjacent additions: `catalog/math.ts` (duplicate
   imports), `liveJourneySpec.ts` (rows and imports — a keep-both resolution once dropped a closing `},`),
   `activityContract.ts`, `lessonWorkspacePlan.test.ts` (the sorted bound-family list). Re-run `typecheck:lumina`
   after every merge.
5. Full-suite vitest under load times out a few tests; re-run failures alone before calling them real.
6. Browser drive: `qa/open-build/browser-drive-2026-10-07/open.mjs` opens any Math tester mode headless; generate
   at 1400 px, then check phone width by squeezing the primitive's card to 360 px (the tester page is not responsive).
