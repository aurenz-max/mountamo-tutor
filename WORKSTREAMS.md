# Workstreams — Portfolio Index

The single orientation surface for all Lumina workstreams. Any session answering
"what's next?" starts HERE, not in memory or individual queues.

**Rules:** WIP limit = 2 ACTIVE streams + 1 DELEGATED lane. Everything else is
PARKED with a trusted-as-of date — act on a parked stream's queue only after
re-verifying its claims against EVAL_TRACKER + git. Maintained by `/pm`
(reconcile → update → propose); every session that closes work updates the owning
queue AND this file's "last touched" in the same slice.

| State | Meaning |
|---|---|
| ACTIVE | being worked now; queue is trusted |
| DELEGATED | handed to another session/agent; check its report before touching |
| PARKED | intentionally idle; queue trusted only as of the noted date |
| BLOCKED | waiting on a named dependency |

## ACTIVE

### 1. Reader-fit K queue — last touched 2026-07-16
- **Queue:** `my-tutoring-app/qa/reader-fit/BACKLOG.md` (top = next).
- **Executor skills:** `/reader-fit [--fix]`, `/eval-fix`, `/tutor-test`
- **Re-prioritized by Pulse walk 2026-07-16 (user):** two live K-math findings jump ahead of the
  supply-side #9a–#9d tail. **(a) comparison-builder #2b** chrome band-gate is now PEDAGOGY-CRITICAL —
  the K screen still shows "Left: 3 / Right: 5" count badges that hand the child the answer (rule-#1
  violation), plus a one_more_less scaffold that's silent on "one less". **(b) NEW item 11** —
  addition-subtraction-scene `act_out` promises "drag the frogs out" but only offers a number-tile
  proxy; K must enact the scene (direct-manipulation-first). Two systemic generalizations seeded
  (direct-manipulation for act/build scenes; on-demand "🔊 Read me" replay across eval modes).
  Verified & struck: HUMAN-CHECKS #2 (knowledge-check @ PRE) + #6 (deep-dive @ PRE) — user Pulse-confirmed.
  **Paste-able handoff prompts for all three findings:** `my-tutoring-app/qa/HANDOFF-reader-fit-pulse-2026-07-16.md`.
  **Explainer-tail #9b–#9d handoff (concept-card-grid / comparison-panel / flashcard-deck):**
  `my-tutoring-app/qa/HANDOFF-reader-fit-explainer-tail-2026-07-16.md`.
- **In flight 2026-07-16 (parallel sessions):** #9a delegated (own workstream). **#9b concept-card-grid /
  #9c comparison-panel / #9d flashcard-deck — ALL THREE READY @ PRE 2026-07-16** (ctx-native generator
  refactor + `gradeLevel` stamp + code-attached emoji + catalog PRE-READER directive + component band-gate;
  typecheck:lumina 0, full suite 799/799, new jsdom 15/15, eval-test + tutor-probe PASS at K). Residual =
  Tier-3 live `--lesson` + pixel → HUMAN-CHECKS #27/#28/#29. Reports: `qa/reader-fit/{comparison-panel,
  concept-card-grid,flashcard-deck}-PRE-2026-07-16.md`. **The K explainer tail now drains.**
  **#2b comparison-builder — 3 Pulse priorities DONE 2026-07-16** — (1) K chrome band-gate kills the
  "Left: 3 / Right: 5" count-leak + hides counter/mode-tabs/grade+type badges at K (group pictures +
  "=" kept); (2) one_more_less symmetry — component `voiceOtherOneMoreLess` silent `[DISAMBIGUATE]` +
  catalog ORIENT rewrite, **live `--lesson --runs 3` decrement spoken 3/3**; (3) persistent 🔊
  `ReadMeButton` shared helper (first instance of the systemic replay item). Contract-first:
  `docs/contracts/comparison-builder.md` derived, edit COMPATIBLE (no fork). Verified tsc 0-new +
  typecheck:lumina 0 + jsdom 12/12 + full suite 790/790 + tutor-test Tier-1/2 pass. Report:
  `qa/reader-fit/comparison-builder-PRE-2b-2026-07-16.md`. **2b TAIL still open** (Audit-C rule-5
  feedback-on-object; per-mode picture passes for compare_numbers/order/one_more_less). Uncommitted
  (shares catalog/math.ts + ComparisonBuilder with parallel edits — coordinated `/ship`). Pixel →
  HUMAN-CHECKS #26.
  **#11 addition-subtraction-scene `act_out` @ K DONE + USER-CONFIRMED LIVE 2026-07-16** — TRUE direct
  manipulation (seed startCount → tap-add/remove → auto-judge on the enacted count); fork by band+mode
  (solve_story tiles + create_story build + Grade-1 count model all preserved); deterministic
  tap-accurate instruction. **Two same-day browser-reported follow-ons, both fixed:** (a) scene objects
  were unclickable — SVG `<g>` had no hit area; added a transparent hit-target `<circle pointerEvents:all>`
  (real-browser proof via playwright-core + Chrome; jsdom is blind to this — memory
  `svg-g-unclickable-jsdom-blind`); (b) `solve_story` "count the bunnies" was inert — added a tap-to-count
  aid (ordinal badges in tap order + highlight, result-unknown only; tiles still answer). Verified vitest
  **7/7** + eval-test @ K + **live `--lesson` 3/3** + **user browser check (full session 100%, Act Out +
  Solve Story)** → HUMAN-CHECKS #25/#26 struck to Done. Contract + changelog:
  `docs/contracts/addition-subtraction-scene.md`. Report: `qa/reader-fit/addition-subtraction-scene-item11-2026-07-16.md`.
  Working tree NOT committed (parallel #2b/#9a edits share catalog/math.ts + ComparisonBuilder in
  flight) — a coordinated `/ship` folds the reader-fit slices.
  **#9a Step 1 (contract) DONE 2026-07-16, then PROMOTED (user-approved) to its own ACTIVE
  workstream** — see stream 2 below; #9a is no longer in this queue (reader-fit tail = #9b–#9d + 2b
  tail + #11 residuals).
  Multiple reader-fit sessions live — shared files (BACKLOG, WORKSTREAMS, catalog, `run_tutor_live.py`,
  EVAL_TRACKER) will collide; each session re-reads before editing and commits its primitive + its
  strike in a tight slice.
- **Direct-manipulation census DONE 2026-07-16** (the item-11 session's sibling audit swept ~60 math
  primitives — that IS the census of record, do not re-sweep). Findings promoted to discrete fix
  items: **#12 ten-frame make-ten** (STRONG proxy, do first), **#13 counting-board subitize** (display
  fix), + coin-counter `count-like` gap to confirm. Execution handoff (ten-frame first):
  `my-tutoring-app/qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`.
- **Now:** **#9 explainer tail — pilot + fact-file DONE 2026-07-15**, tail reconciled. The
  "same shape → one pattern" premise held for only 1 of 5: pilot **foundation-explorer @ PRE
  READY** (live `--lesson` 3/3) + a reusable **`PreReaderSelfCheck` helper** extracted; **fact-file
  @ PRE READY** via the helper (jsdom 6/6, eval-test K 2/2, live queued). The other four are NOT
  the same shape (no MCQ / true-false gate / no grade threading / no tutoring block) and are queued
  as **BACKLOG #9a media-player** (now a **REIMAGINING** per user pivot 2026-07-16 — contract-first
  via `/primitive-contract`, then re-build across K/EMERGING/ESTABLISHED reading modalities inspired
  by deep-dive/interactive-passage; supersedes the old band-gate plan), **#9b concept-card-grid** /
  **#9c comparison-panel** / **#9d flashcard-deck** (bespoke: read-aloud-on-flip / picture-T-F +
  ctx-native generator refactors + grade threading). #2b comparison-builder remaining still DEFERRED
  to K-stage. (#10 word-workout+word-flip, #8 rhyme-studio, #7 phonics-blender, #1e sorting-station
  all **DONE 2026-07-15**.)
- **Milestone (after #9a–#9d + #2b close, the K queue drains):** re-run the topic-trace census at
  grade 1 (EMERGING) to re-seed the queue at the next band. #10 was the last *demand-side*
  (census-routed) K item; the explainer tail (#9a–#9d) is the remaining supply-side text-surface work.

### 2. media-player reimagining — last touched 2026-07-16
- **Queue:** `my-tutoring-app/qa/media-player-reimagining/BACKLOG.md` (charter = the 3-band
  modality map; top = next).
- **Executor skills:** `/primitive-contract --check`, `/add-eval-modes`, `/eval-test`,
  `/reader-fit`, `/curriculum-fit`, `/tutor-test`
- **Promoted from reader-fit #9a 2026-07-16 (user-approved)** after the Step-1 contract showed a
  small, clean blast radius. Contract: `docs/contracts/media-player.md` (CONFLICTED — C1's
  resolution IS this stream; every edit reads it first). Thesis: rebuild band by band
  (PRE `listen_and_look` / EMERGING `listen_for_details` / ESTABLISHED `story_analysis`) and give
  the catalog a deep-dive-grade identity so the manifest routes it on merit. Key demand: the two
  authored G1 SS listening homes + the PHANTOM `listen-and-respond` LA subskills (unserved) +
  LA003 G2 recount family (probe MATCH 0.774).
- **Now:** **B1 DONE 2026-07-16, runtime-verified + USER BROWSER-CONFIRMED** — 3 eval modes live
  (curator pins `listen_and_look` @ K + `listen_for_details` @ G1 on first post-rewrite traces,
  both valid); PRE `PreReaderSelfCheck` band; MP-1/MP-2/MP-3 all cleared; eval-test 3/3 bands +
  jsdom 4/4 + suite 804/804 + typecheck:lumina 0. **Tester refactored (full-width primitive +
  canonical-grade/eval-mode controls) and the K PRE render user-verified in browser 2026-07-16.**
  Uncommitted (rides the coordinated multi-session `/ship`). Next pull = B2 (EMERGING polish) or
  B4 `/tutor-test` probe; live `--lesson` @ K still queued (B5 — live tutor beats, not covered by
  the tester).

### 3. Direct Instruction module (bench-first) — last touched 2026-07-16
- **Queue:** `my-tutoring-app/qa/HANDOFF-di-bench-2026-07-16.md` (charter + gates; graduate to a
  BACKLOG file if the bench passes).
- **Executor skills:** (bench phase) human browser run → HUMAN-CHECKS #30; (if GO) `/primitive`,
  `/add-spoken-judge`, `/add-voice-control`, `/eval-test`
- **User-pulled 2026-07-16.** Thesis: Lumina has every DI instrument (model-first phase machines,
  spoken-judge ladder, FSRS-style subskill scheduler) but no DI *conductor* — and the judge→tutor
  link is too loose (free-text bracket tags, no ordering guarantee). Before building any DI
  primitive, validate I-do/we-do/you-do FROM THE TUTOR'S PERSPECTIVE on a bench.
- **DONE 2026-07-16 (this slice, code-complete, uncommitted):** **Direct Instruction Bench** —
  dev panel (`di-bench`, home card 🎯) welding the Azure→Gemini spoken-word ladder on top of the
  Gemini Live tutor. Deterministic beat engine (model→guide→test→verify/correct, max-2 corrections,
  delayed retest at gap 3), mic gated on the `isAudioPlaying` true→false drain edge (never
  transcript-idleness), script-executor persona installed via a new `PrimitiveContext.tutoring`
  override seam in `LuminaAIContext` (no catalog pollution), per-beat instrumentation (cue→audio ms,
  audio ms, verbatim fidelity %, judge engine/latency, response ms), scripted vs informed modes,
  editable judge-reference per item (the isolated-phoneme bench question), Copy-run-JSON export.
  `typecheck:lumina` 0 errors; full tsc 0 NEW vs baseline.
- **Now:** human bench run (HUMAN-CHECKS #30 — needs mic + backend). Decision gates in the handoff:
  phoneme judgeability, script fidelity, loop latency, informed-mode DI compliance. GO → PRD the DI
  Lesson composite + item-grain scheduler; NO-GO on phonemes only → start DI with whole-word strands.
- **WIP note:** this makes 3 ACTIVE — over the 2+1 limit. Deliberate user pull; the stream is thin
  (next action is a single human sitting). Recommend: either park it right after the bench run
  verdict, or park media-player B1 until the DI go/no-go lands.

*(SP-27 Tutoring Context Integrity PARKED 2026-07-16 by user — see PARKED table. WIP = 3 ACTIVE
after the user-pulled DI bench stream — over the limit, flagged in stream 3's WIP note.)*

## DELEGATED

*(none — lane 3 closed 2026-07-15, folded to the PARKED contracts stream below.)*

> **WIP note (`/pm` reconcile 2026-07-16):** working tree **CLEAN** — everything the prior note
> flagged as uncommitted is now committed. `ddf5a5f` landed the **contracts baseline `--check ×2`**
> slice; `e05c109` landed **knowledge-check one-at-a-time pacing + excavator-arm L2 scaffold**
> (and the DropZone Batch-4 / kit-roadmap files). Portfolio is **1 ACTIVE + 0 DELEGATED** after SP-27
was parked 2026-07-16 (below) — reader-fit runs solo, well under WIP.
> The `e05c109` work was opportunistic (K-stage pacing polish + an engineering-sim scaffold), NOT
> the top of either ACTIVE queue — the next *queued* pull is reader-fit **#9a media-player @ PRE**.
> Residuals now human-only: browser spot-checks HUMAN-CHECKS #2–#24 (nine new since last sitting:
> #12–#20, #22–#24); fact-file live `--lesson` still queued (mechanism proven); phonics
> tap-pronounce runtime verification (reader-fit BACKLOG #7 follow-up, `/tutor-test`).

## PARKED (trusted-as-of date; re-verify before acting)

| Stream | Queue / doc | Next action | As of |
|---|---|---|---|
| SP-27 Tutoring Context Integrity | `docs/PRD_TUTORING_CONTEXT_INTEGRITY.md` + sweep `qa/tutor-reports/sweep-2026-07-14.md` | **PARKED 2026-07-16 (deliberate, single-stream focus on reader-fit).** Resume at Phase 0: harden `scaffoldAudit.ts` (invalid-syntax + studentPrompts coverage + fingerprints), **re-run the now-stale sweep** (comparison-builder edits since), cut the monotonic baseline, add the Vitest + report-only runtime gates. NOT urgent — failures cluster in physics/advanced-math sims students aren't routed to; K primitives are already green. **Carry-forward HIGH — RESOLVED 2026-07-16 (UNCOMMITTED, slice on its own):** the `fast-fact` spoken answer-leak (`scaffoldingLevels.level3` interpolated `{{correctAnswer}}` then said "try again") is FIXED — level3 rewritten answer-free in `catalog/core.ts`; Tier-1 audit re-run confirms the `answer-leak-in-scaffold` finding cleared (fast-fact HIGH→WARN; only a pre-existing `indirect-script` level2 copy nit remains). `correctAnswer` retained in taskDescription/RUNTIME STATE for tutor-reference (allowed). This was the single audibly-harmful SP-27 defect; the rest of the stream stays parked. | 07-16 |
| Primitive contracts | `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` | **3 contracts** derived (media-player added 2026-07-16 via reader-fit #9a Step 1 — first CONFLICTED contract) + **baseline `--check` ×2 PASSED 07-15** (first guard exercise: both COMPATIBLE, 20/20 requirements hold at runtime; ss R8 amended for precision — object window is prompt+tier-conditioned, bin cap is the hard clamp; reports in `qa/primitive-contracts/`). Next = #3 **foundation-explorer** derivation BEFORE the reader-fit #9 shared-PRE-pattern fix pass (its files are already in flight in the working tree), then #2 knowledge-check (before `true_false @ PRE` lands) | 07-15 |
| Misconception loop | memory `project_misconception-loop` | Phase 3A | 07-12 |
| Literacy eval-modes densification | memory `project_literacy-evalmodes-densification` | tree is CLEAN (no longer uncommitted — /ship step moot); remaining = `/eval-test` the 6 task-identity ladders to confirm they draw, then close | 07-15 |
| Flash-lite truncation hardening | memory `project_flash-lite-truncation-template` | ~50-gen sweep | 07-06 |
| LuminaReadAloud 🔊 sweep | `qa/HANDOFF_read-aloud-sweep.md` | pilot browser-VERIFIED 07-15 (user); remaining = 🔊 sweep across the other hand-rolled read-aloud surfaces | 07-15 |
| Lumina kit roadmap | `docs/DROPZONE_MIGRATION_PRD.md` + memory `project_lumina-kit-motion-roadmap` | motion tokens + LuminaDropZone COMMITTED (e17679f, e450cb0). DropZone Batch 1 (+2) are CODE-COMPLETE (◐ browser spot-checks pending, PRD tracks them) — "next = B1" was STALE. **DropZone Batch-3 tail CODE-COMPLETE 2026-07-15** (10 migrated + 3 triaged; typecheck:lumina clean; browser spot-checks → HUMAN-CHECKS #13/#14; uncommitted). Next = Batch-4 triage or LuminaCompletionScreen (106 hand-rolled 🎉 blocks). PRD §2 rulings settled | 07-15 |
| Curriculum authoring | memory (K-5 archive) | G5 Science + G5 Social Studies; GK phonics starvation | 07-09 |
| Analytics/snapshot residue | memory | snapshot `--all` + commit; metrics grade-join `--apply` | 07-08 |

**Absorbed:** tutor-test fix campaign (46/130 FAIL) → SP-27. Orphaned tutoring
configs (distribution-explorer, dot-plot) → SP-27 Phase 2/3.

## CLOSED (verified 2026-07-14; reopen deliberately, not by accident)
- **Grade-fidelity sweep close-out** (2026-07-15) — **committed** (`7cb5e5f`). 4/4 tasks closed
  via runtime probe: daily-session grade threading verified HONORED; 11/11 probe-sweep HONORED;
  `gradeToBand`+`buildGradeLine` extracted to `scopeContext.ts`; and a real 6-gen phonics dead
  lever fixed via `clampGradeToK2`. Report: `qa/topic-fidelity/grade-fidelity-closeout-2026-07-15.md`.
  Residual: none.
- **reader-fit 1e sorting-station @ PRE** (2026-07-15) — **committed** (`7cb5e5f`). READY @ PRE for
  `sort_one` + `odd_one_out`; other four modes floored to Grade 1+. jsdom 6/6 + live `--lesson` 3/3.
  Residual = pixel look (HUMAN-CHECKS #12). Report: `qa/reader-fit/sorting-station-PRE-2026-07-15.md`.
- **DropZone Batch-3 tail** (2026-07-15) — code **committed** (`7cb5e5f`). 10 migrated onto
  LuminaDropZone + 3 triaged decorative; `typecheck:lumina` clean. Residual = browser spot-checks
  (HUMAN-CHECKS #13/#14). Next kit move (Batch-4 triage / LuminaCompletionScreen) tracked under the
  PARKED Lumina-kit-roadmap row. Handoff: `qa/HANDOFF-dropzone-batch3-2026-07-15.md`.
- **DeepDive block scaffolding + curator-brief PRE scaffold** (2026-07-15) —
  **user-confirmed live**. BlockTutorHelp + tap-to-explore + the full K-eligible
  PRE read-aloud palette (prose/key-facts/MC/mini-sim/pull-quote/diagram) and
  curator-brief `[READ_SECTION]` auto-narrate all committed (tree clean) and
  behaving in a live lesson. Residual (minor, non-blocking): no jsdom tests yet
  for the new mini-sim/pull-quote/diagram preReader branches; the "toggle-as-core-
  control PREDICT block at PRE" ergonomics question stays a watch-item.
- **K-stage presentation mode (MVP)** (2026-07-15) — **user-confirmed in browser**:
  on-rails one-section rail, wordless arrow advance, `[SECTION_START]` narration
  work. The stream's browser gate is closed. NOTE: per-primitive internal chrome
  (counters/steppers inside components) is a SEPARATE ongoing backlog item — keep
  recording Audit-C chrome FAILs under the BACKLOG systemic entry; the stage only
  removes lesson-level chrome.
- **Gemini Live resumption** (2026-07-15) — **user-confirmed live**. The 1008
  session-duration abort is fixed via `context_window_compression` +
  `SessionResumptionConfig` + GoAway-driven transparent reconnect
  (`backend/app/api/endpoints/lumina_tutor.py`, `LuminaAIContext.tsx`). Memory's
  "NOT runtime-tested live yet / uncommitted" was the last stale caveat — the
  code is committed (tree clean) and the user verified the live behavior.
- **Opus generator-fix lane** (2026-07-15) — all three delegated tasks landed and
  are committed: shape-tracer SHT-1 (code-placed geometry, 4/4 runtime-verified),
  word-workout vowel-scope binding, phoneme-explorer initial-sound routing, plus
  word-flip routing. Residual = PRE band-audit for word-workout/word-flip, which
  lives in the reader-fit queue as **item 10** (not a delegated task). Optional
  2b-P2 chrome band-gate is tracked as reader-fit **item 2b**. Nothing lane-specific
  remains.
- **Pulse Agent v2** — Phases 1–3 + v2.1 + v2.2 SHIPPED, committed AND pushed
  (cb058b9/ecac549/5a5f7d3; main in sync with origin — "push pending" was stale).
  Phase 4 (close-out delta + generation-context) is **optional per PRD §D** —
  reopen only if that delta becomes needed. Residual worth keeping: the
  gate/selector disagreement on student 1004 COUNT001-01-D the harness surfaced.
- **Voice control (knowledge-check pilot)** — TF + MCQ wiring COMMITTED
  (edeadeb); LetterSpotter has NO voice wiring **by ruling** (unbenched
  letter-name homophone class — that's a standing decision, not pending work;
  reopens only if a Voice Studio letter-name bench is built). Sole residual =
  2-min human mic smoke → HUMAN-CHECKS #11. Platform follow-up noted in memory:
  global single-mic lock before any MCQ voice sweep.

## Standing hygiene
- Human-only verification debt lives in `my-tutoring-app/qa/HUMAN-CHECKS.md` — burn
  down in one browser sitting, not per-stream archaeology.
- Uncommitted surface: keep it to ONE stream's worth; `/ship` slices as streams
  close work. Shared files (EVAL_TRACKER, BACKLOG, run_tutor_live.py) commit in
  their own slice to reduce cross-session collisions.
