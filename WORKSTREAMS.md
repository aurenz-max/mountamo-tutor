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

### 1. Reader-fit K queue — TOP PRIORITY (user, 2026-07-16) — last touched **2026-07-25** (Task 3 closed; **demand-side K queue DRAINED**)
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
  `qa/reader-fit/comparison-builder-PRE-2b-2026-07-16.md`. Head **Committed `39f2543`** (pixel → HUMAN-CHECKS #26).
  **2b TAIL DONE 2026-07-20** — Audit-C rule-5 feedback-on-object (text card hidden at K, wrong tap shakes the
  touched object) + per-mode PRE picture passes (compare_numbers → tap the bigger numeral + `=`, no `<>` /
  alligator / Check; order → wordless graduated-bar direction; one_more_less → 5-cell window + wordless ⬆/⬇ +
  tap=choose). Band+mode fork (builds contract G1). Verified jsdom 25/25, full 857/857, typecheck:lumina 0,
  eval-test @ K 3/3, contract `--check` COMPATIBLE. Report: `qa/reader-fit/comparison-builder-PRE-2b-tail-2026-07-20.md`.
  Residual: live `--lesson` + pixel → HUMAN-CHECKS #35. **comparison-builder #2b now FULLY RESOLVED.**
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
  **Committed `39f2543`** (folded into the coordinated reader-fit slice).
  **#9a Step 1 (contract) DONE 2026-07-16, then PROMOTED (user-approved) to its own workstream,
  now PARKED 2026-07-16 (B1 shipped)** — see the PARKED media-player row; #9a is no longer in this
  queue (reader-fit tail = #9b–#9d + 2b tail + #11 residuals).
  Multiple reader-fit sessions live — shared files (BACKLOG, WORKSTREAMS, catalog, `run_tutor_live.py`,
  EVAL_TRACKER) will collide; each session re-reads before editing and commits its primitive + its
  strike in a tight slice.
- **Direct-manipulation census DONE 2026-07-16** (the item-11 session's sibling audit swept ~60 math
  primitives — that IS the census of record, do not re-sweep). Findings promoted to discrete fix
  items. **#12 ten-frame make-ten DONE 2026-07-16** — contract-first K band+mode fork: fixed seed →
  tap empty cells → auto-judge the enacted complement; stepper/Check removed only at K. K build +
  flash/hide subitize and Grade 1–2 make-ten preserved. Browser follow-on fixed: make-ten → add now
  clears the completed frame before operate begins. Verified jsdom 5/5, full suite 810/810,
  typecheck:lumina 0, eval-test 4/4 modes; report `qa/reader-fit/ten-frame-item12-2026-07-16.md`;
  pixel/real-click → HUMAN-CHECKS #31. **#13 counting-board subitize DONE 2026-07-20** —
  contract-first flash-then-hide DISPLAY fork (K band+mode: objects render only during the flash,
  stepper/Check gated behind the hide, `handleObjectTap` no-op so the scene can't be tap-counted);
  count_all @ K + Grade-1 subitize + Pre-K perceptual all unchanged; no generator/schema/catalog
  change. Verified jsdom 3/3, full suite 844/844, typecheck:lumina 0, eval-test @ K PASS (content
  unchanged). Contract `docs/contracts/counting-board.md` (R4); report
  `qa/reader-fit/counting-board-item13-2026-07-20.md`; pixel → HUMAN-CHECKS #34. **Next =
  coin-counter `count-like` confirm/clear (Task 3).** Execution handoff:
  `my-tutoring-app/qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`.
- **Now (2026-07-25): Task 3 CLOSED — the demand-side K queue is DRAINED. Next = re-run the
  topic-trace census at GRADE 1 (EMERGING) to re-seed the band, and it already has its first item.**
  **coin-counter `count-like` @ K — VERDICT PROXY (CLEARED=false), FIXED.** K now enacts the count:
  tap each coin, a badge stamps the **running skip-count total** (5→10→15) in tap order, auto-judge
  when every coin is counted exactly once, no number input and no Check at K; a re-tap is a rejected
  double-count that shakes the object, so the path is failable rather than a walk-through. Fork is
  **band+mode**; Grade 1+ and every `count-mixed` card are byte-identical (`git diff` = **160
  insertions, 0 deletions**). Contract derived first (none existed): `docs/contracts/coin-counter.md`
  — 10 requirements, C1 resolved, 6 gaps; `--check` **COMPATIBLE**. Verified tsc **0-new** (all 803
  pre-existing errors sit outside `components/lumina/`) + typecheck:lumina 0 + jsdom **9/9** with
  **both non-vacuity probes failing the right tests** + full vitest **930/930** + real-Gemini
  eval-test **6/6 @K, 6/6 count-like @G1, 6/6 count-mixed @G2** + a **real-Chrome mouse-click probe**
  (tap→5¢→10¢, double-tap holds at 10¢, →15¢, 0 inputs/0 Check, no page errors). Report:
  `qa/reader-fit/coin-counter-task3-2026-07-25.md`. Pixel/feel → HUMAN-CHECKS **#52**.
  - **Two rulings recorded.** (1) *Split mechanism:* the generator now **stamps
    `countMode:'like'|'mixed'` from `targetEvalMode`**; inspecting `displayedCoins` for a single
    denomination was REJECTED because the generator rejects multi-type sets for count-like but has
    **no converse rule** — a G2 count-mixed card drawing three dimes would have silently flipped
    into K's enacted mode and ablated a live consumer. (2) *`showCoinValues` on like coins:*
    **legitimate recognition aid, NOT a rule-#1 leak — kept default-true.** The denomination is the
    skip-count INTERVAL (an input); the total is never printed; coin-value recall is a different
    subskill (`MEAS001-07-b`→knowledge-check); and `identify` already hides values because there the
    value IS the answer. Narrow exception queued (G4: a one-coin card prints its own total).
  - **PREMISE CORRECTION — `count-like` is a GRADE 1 skill, and its Grade-1 consumer STILL has the
    proxy.** The census found the only authored consumer is **`MEAS001-07-c` @ Grade 1** ("Focus:
    Skip counting and summation… single-denomination sets"), and live routing confirms Grade 1.
    **There is no K money subskill in the curriculum at all** — the strand is G1 `MEAS001-07` + G2
    `MEAS002-05`; the K `MEAS001-07-A…F` sharing that stem is **"Time Durations"**.
    `PRIMITIVE_GAPS.md` GAP-007 mislabels them "MATHEMATICS (K)" — the likely origin of the K
    framing. **K is still reachable** (a K topic-driven money lesson routes `identify`→`count-like`),
    so the fork is live code — but the PRIMARY consumer is Grade 1. Not widened unilaterally: Grade 1
    carries β1.5 item history and changing its interaction deserves its own slice. → **gap G1, the
    first item for the EMERGING census.**
  - **Other gaps opened:** **G2** `resolveGradeBand` parses `ctx.gradeContext` PROSE (which
    `GenerationContext` explicitly forbids) so **Grades 2–3 are unreachable** and G2 money lessons
    silently run as Grade 1 (`/topic-fidelity`); **G3** K chrome (grade badge / "1/2" counter / phase
    badge) is not band-gated and the instruction has no 🔊 — surfaced by the pixel check, the same
    class comparison-builder fixed in #2b; **G5** count fallback is a MIXED set; **G6** the catalog
    advertises a K band the curriculum lacks.
  - *Superseded (kept for the record — the handoff that drove this):*
  **`qa/HANDOFF-reader-fit-coin-counter-2026-07-25.md`.** The 07-16 prompt was written blind and
  misnames the target (`count-like` is a CATALOG eval mode, `catalog/math.ts:3613` β1.5; the
  component challenge type is `'count'`, `CoinCounter.tsx:39`, shared with `count-mixed` β2.5 — a
  session grepping the component for "count-like" finds nothing). The new handoff carries a
  completed line-exact read whose **indicated verdict is PROXY, not clear**: `renderCountChallenge`
  (`:632`) renders coins via `renderCoinGroup` → `<CoinVisual disabled />` (`:599`, no `onClick`)
  and takes the answer as a typed `LuminaInput type="number"` (`:640`) behind a Check button
  (`:928`/`:931`) — so K is compute-then-type over an inert coin set, the item-11/12 shape. It also
  names the two rulings the session must record (count-like vs count-mixed can't be told apart by
  `challenge.type`; `showCoinValues` default-true on LIKE coins = aid or rule-#1 leak?) and makes
  **contract-first REQUIRED** (no `docs/contracts/coin-counter.md`; 6 eval modes span K–3, and
  Grade-2/3 `count-mixed` shares the render path). Closing this **drains the demand-side K queue** →
  milestone: re-run the topic-trace census at grade 1 (EMERGING).
  *Prior framing, kept for the record:* #13 closed; **2b tail closed 2026-07-20** (see the #2b
  row above). Remaining pull = **Task 3 — coin-counter `count-like` confirm/clear** (the last
  un-swept direct-manipulation candidate from the 07-16 sibling census). **Confirmed genuinely open** —
  `CoinCounter.tsx` has a `gradeBand` prop but NO `isK` fork anywhere (it only picks the grade
  LABEL at line 321/844), so the K `count-like` interaction has never been band-gated or
  direct-manipulation-audited. It is a READ-then-verdict task (~30 min), not a build: enacted count
  → record CLEARED under the systemic note; stepper/number-pad over a manipulable coin set → promote
  a new BACKLOG item with the item-11 fix direction. No source edit unless it's a confirmed proxy.
  Then, with the demand-side K queue drained, re-run the topic-trace census at grade 1 (EMERGING) to
  re-seed the band.
  **Stale line removed 2026-07-24:** the "uncommitted `CountingBoard.tsx` + contract + QA docs"
  note was true on 07-20 and is now false — that sibling slice SHIPPED (tree carries no reader-fit
  files; the only uncommitted surface is DI).
- **History (#9 explainer tail):** pilot + fact-file DONE 2026-07-15, tail reconciled. The
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

### 2. Direct Instruction primitive family (graduated from bench) — last touched **2026-07-25** (di-sentence-reading BORN L0 → live-verified → L1, one day; BACKLOG item 2 struck)
- **Queue:** `my-tutoring-app/qa/di/BACKLOG.md` — **GRADUATED 2026-07-20** (bench passed its
  architecture gate across 4 live runs; user call: DI = a new primitive FAMILY alongside
  core/math/literacy, first set custom-made). Old charter `qa/HANDOFF-di-bench-2026-07-16.md`
  is historical.
- **Executor skills:** `/primitive` (L0 birth per pack) + `/curriculum-fit` + `/eval-test` +
  `/tutor-test`; bench sitting per NEW response class before wiring (standing gate in the BACKLOG).
- **User-pulled 2026-07-16.** Test one turn controller over one Gemini Live audio session: exact
  I-do/we-do/you-do scripts, Live input/output transcription, and an asynchronous Flash-Lite JSON
  report that alone authorizes advance/retry.
- **DONE 2026-07-16 (POC slice):** **Direct Instruction Bench** (`di-bench`, home card 🎯).
  Shared Lumina owns only Live transport plus a generic ordered `structured_state_update` channel.
  `backend/app/services/di_turn_reducer.py` owns the DI schema, transcript aliases, and Flash-Lite
  reduction. `diBenchModel.ts` owns report parsing and authority (fresh aligned `match` advances;
  retry/unclear stays). `diScript.ts` owns exact pedagogy/cues; the panel owns orchestration and
  Copy-run-JSON diagnostics. The abandoned Azure phoneme/warm clip-judge branch was removed from
  shared production files. `typecheck:lumina` 0 errors; focused tests 11 frontend + 7 backend.
- **SUPERSEDED same-day (2026-07-16, live-judged pivot):** the Flash-Lite reducer was DELETED after
  run 1 of the live-judged rewrite PASSED (`qa/eval-reports/di-bench-live-judged-2026-07-16.md`).
  Live now judges in-band via sentinel openers ("Yes," / "My turn."); `diBenchModel.ts` classifies
  and alone advances; Gemini auto-VAD off, local amplitude VAD = turn authority (runs 3–4 tuned).
- **DONE 2026-07-18 (open-mic slice, user ruling: no force-mutes from the primitive):** echo gate
  removed from the bench VAD (speaking over the tutor = native barge-in); backend forwards Gemini
  `server_content.interrupted` → `ai_interrupted`, `LuminaAIContext` flushes playback on it (tutor
  audibly stops — generic transport, benefits all Live surfaces); cue pacing re-entrant (cues fire
  only into silence, held cues re-fire on audio-fall/voice-close/verdict edges); echo telemetry
  (`turnsOverTutorAudio`). tsc 0 new, vitest 12/12, py_compile OK. NOT live-exercised.
- **RUN 2026-07-19 (first open-mic live run): PASS on the full scripted loop** — 4/4 items affirmed,
  exact script fidelity, 4 clean VAD bracket pairs, **0 phantom turns**, cue cadence held; the Live
  judge affirmed a sustained /s/ from AUDIO while ASR wrote "Shh." (the architecture's thesis,
  demonstrated). Report: `qa/di-bench/run-2026-07-19-open-mic.md`. **Barge-in and speaker-echo were
  NOT triggered in this run** (no `ai_interrupted` in the backend log) — HUMAN-CHECKS #30 narrowed
  to that ~2-min probe.
- **PROBE RUN 2026-07-19 (run 2, run JSON): barge-in + echo EXERCISED, #30 STRUCK.** Barge-in
  verified end-to-end (deliberate talk-over interrupted + judged; /sss/ over tutor audio affirmed
  from audio). Echo leakage = 1 blip (peak 0.033 vs threshold 0.025) that chopped a cue line.
  **Three findings promoted to build inputs** (`qa/di-bench/run-2026-07-19-open-mic-probe.md`):
  **DI-1 (BUG)** — a sentinel verdict with no transcript-backed attempt is silently dropped →
  bench/model desync → model self-advanced (read bracketed cue aloud) → wrong-item credit; engine
  must anchor attempts to LOCAL voice-turn close, bind unanchored verdicts to the last unmatched
  voice turn, resync via re-cue after N off-script. **DI-2** — dual threshold: turn-open bar during
  tutor audio ≈ 2× silence bar (echo 0.033 vs real speech ≥0.068); calibration beat measures both
  floors. **DI-3** — ignore attempts until the first cue begins.
- **SHIPPED 2026-07-19:** open-mic slice + run reports committed `6635877` (+ QA docs `10b17d9`);
  main pushed & in sync.
- **Extraction step 1 DONE + RUNTIME-VERIFIED 2026-07-20, committed `4af21b6` (#32 struck):**
  `hooks/voiceTurnMachine.ts` (pure turn authority, DI-2 dual threshold, vitest 7/7 incl. the
  probe-run echo regression) + `hooks/useLiveVoiceTurns.ts` (activity brackets, ambient/echo EMA
  floors) + bench as pilot consumer. **User live run PASS**
  (`qa/di-bench/run-2026-07-20-hook-parity.md`): 4/4 items, **0 unanchored verdicts, 0 echo-opened
  turns** (floors 0.0008/0.0082 vs 0.05 barge-in bar — ~6× margin), barge-ins interrupted + judged,
  response times improved (1706/1192ms vs probe 2986/1882ms). New engine input from the run:
  a mid-cue attempt can consume a cue FRAGMENT as its verdict (benign off-script) — verdict
  classification must only consume tutor output that begins a NEW turn after the attempt closed.
- **Extraction step 2 CODE-COMPLETE 2026-07-20 (uncommitted):** the judged-loop engine.
  `hooks/judgedLoopModel.ts` (pure reducer: voice-anchored attempts DI-1 — attempts exist at LOCAL
  voice-turn close, transcripts only annotate; sentence-scoped sentinel scanning — fixes the
  mid-cue-fragment misread; off-script only on sentence+quiet; DI-3 arming; no-verdict timeout 8s;
  resync emission after 2 misses; vitest 13/13, every case traced to a live-run shape) +
  `hooks/useJudgedSpeechLoop.ts` (conversation feed, tutor-quiet clock, tick, cue queue with
  verify-beat + fire-into-silence; disable keeps the queued closing cue, clearQueuedCue for abrupt
  stops) + bench rewritten as pilot consumer (owns only DI pedagogy: script, progression policy,
  alias cross-check, run log; `classifyTutorJudgment` deleted from diBenchModel — collision test now
  runs against engine DI_SENTINELS). typecheck:lumina 0, full suite 844/844.
- **Step 2 RUNTIME-VERIFIED 2026-07-21 + COMMITTED (#33 struck):** user run PASS
  (`qa/di-bench/run-2026-07-21-engine-gate.md`) — 4/4, 0 unanchored, and the crown jewel: the
  probe run's transcript-loss failure RECURRED live (voice turn, no transcript, "Yes, sss.") and
  the voice-anchored attempt absorbed it — judged, advanced, no desync. Off-script-at-quiet
  exercised (tutor re-modeled without the "My turn" opener; engine stayed correctly). Resync/
  timeout unit-covered, not yet observed live (watch-items). Primitive note: tutoring directive
  should remind that EVERY correction begins "My turn:" (model dropped it on a re-correction).
- **DONE 2026-07-20 — `di-letter-sounds` BORN L0** (BACKLOG item 1 struck). First custom-made pack
  over the committed engine stack: new family `primitives/visual-primitives/direct-instruction/`
  (`DiLetterSounds.tsx` + hand-authored `diLetterSoundsScript.ts`), `catalog/di.ts`,
  `service/direct-instruction/gemini-di-letter-sounds.ts` (Fork A menu-scoped generator, no
  hardcoded items), `registry/generators/diGenerators.ts`, evaluation metrics + a
  `direct-instruction-tester` dev panel. typecheck:lumina PASS; eval-test PASS ×3 (topic fidelity
  confirmed); curriculum-fit MATCH (K LA Letter-Sound Correspondence, 0.788 — the starved GK band).
  Birth cert + 6-layer follow-up queue: `qa/eval-reports/di-letter-sounds-birth.md`. **Live loop
  UNVERIFIED through the primitive → HUMAN-CHECKS #36** (engine 4 runs PASS). Two L0 gaps to
  `/add-tutoring-scaffold`: lesson-mode connect needs `manual_activity`+DI-tutoring through the
  shared session; add `subject_for_domain('di')→LANGUAGE_ARTS` to the retrieval matcher.
- **LIVE LOOP VERIFIED 2026-07-21 (HUMAN-CHECKS #36 STRUCK):** user drove `direct-instruction-tester`
  with a real mic — **PASS end-to-end through the primitive**, and the backend log confirms the FULL
  data loop fired on submit (curriculum resolve → score 9.2/correct → competency + calibration
  item_beta=2.96 θ=4.71 P=0.92 + mastery lifecycle + +38 XP). **di-letter-sounds L0 is now fully
  runtime-verified; its lifecycle ladder is UNBLOCKED.** Watch-item (not a defect): the standalone
  submission mapped to LA001-01-a "Decode short vowel CVC words" (runtime Gemini re-mapper), not the
  birth-cert home "Letter-Sound Correspondence" — expected under the L0 lesson-mode gap; raises the
  priority of `/add-tutoring-scaffold` carrying the objective's subskill instead of re-deriving.
- **DONE 2026-07-21 — di-word-reading bench set WIRED (BACKLOG item 2 in progress).** The single-word
  response class is a standing-gate-1 bench sitting before `/primitive`; the bench already models
  `kind: 'word'` end-to-end, so this was content + a set toggle, no engine work. Added
  `WORD_READING_PROBE_ITEMS` (10: sam·mat·pig·dog·sun·red·cup + sight the·see·go; near-neighbours
  matt/son/read/sea left in to stress over-affirmation) + `BENCH_SETS` registry in `diScript.ts`,
  and a **Letter sounds ⇄ Word reading** set toggle in `DirectInstructionBench.tsx` (letter-sounds
  set untouched). typecheck:lumina PASS. **Probe sitting PENDING → HUMAN-CHECKS #41** (mic run).
  Gate: judge reliable on lone words → `/primitive`; over-affirms neighbours → log the failure class.
- **DONE 2026-07-22 — di-letter-sounds L1 eval-modes (birth-cert follow-up #1 struck).** 3-mode
  ladder, task identities all within the benched continuant response class: `letter_sound` (β1.5,
  base focused cluster), `letter_sound_review` (β2.5, cumulative mixed-set — anchors the recent
  focus then broadens across the menu so it isn't a copy of the base cluster), `first_sound_in_word`
  (β3.5, onset isolation from a spoken word; continuant keywords only, NEW hand-authored DISTAR cue
  lines + picture/word stage so the lone grapheme never leaks the onset). Fork A: `resolveEvalModes`
  routes intent→mode, code builds+stamps `challengeType` (no Gemini enum to constrain); the mixed
  path interleaves all three modes staggered so it never stacks one keyword (SP-21). Wired
  `catalog/di.ts` evalModes + backend `problem_type_registry.py` (β mirrored) + metrics union +
  eval-test validator reads `challengeType` + tester mode selector. Verified: real-Gemini eval-test
  PASS ×4 (each pinned mode single-type; onset drops vowels; mixed = 3-type interleave) + keepable
  oracle `gemini-di-letter-sounds.test.ts` (4/4); typecheck:lumina clean of this work. **New onset
  live-tutor wording UNVERIFIED live → HUMAN-CHECKS #42.** Ladder next = `/add-tutoring-scaffold` (L2,
  birth-cert follow-up #2: move DI block into catalog `tutoring:` + wire the lesson-mode connect gap).
  Report: `my-tutoring-app/qa/eval-reports/di-letter-sounds-evalmodes-2026-07-22.md`.
- **DONE 2026-07-22 — `di-word-reading` BORN L0 (BACKLOG item 2 struck).** Second custom-made pack
  over the committed engine (separate pack; letter-sounds files untouched; no hooks/ change):
  `DiWordReading.tsx` + hand-authored `diWordReadingScript.ts` (DISTAR two-branch cues — CVC
  sound-out "sss-aaa-mmm… sam" / sight whole-word; STRICT near-neighbour judging contract; handoff's
  classic "My turn." model opener re-worded to "I'll sound it out…" — sentinel collision) +
  `gemini-di-word-reading.ts` (Fork A: 30-CVC-by-vowel + 8-sight menu in code, Gemini enum-selects,
  vowel/sight scope CODE-enforced) + full registrations (catalog single `read_word` β2.5, backend β,
  metrics, registry, ComponentId) + a **Letter Sounds ⇄ Word Reading primitive picker** in the
  direct-instruction-tester (no cloned tester). Answer-leak inversion honored: printed word ONLY
  before the read; emoji = post-affirmation reward; sight words just affirm. **Standing gate 1
  (bench sitting #41) WAIVED by user ruling 2026-07-22** — near-neighbour stress folded into the
  live-loop check. typecheck:lumina 0; eval-test PASS ×4 (named/generic/sight/short-a scope);
  curriculum-fit **MATCH @ G1 LA001-01** (K = diffuse vote-splitting across sibling CVC families,
  not a gap). Birth cert + 6-layer queue: `qa/eval-reports/di-word-reading-birth.md`. **Live loop
  NOT yet driven → HUMAN-CHECKS #43 is the real L0 gate** (mirror of #36; also carries the
  near-neighbour stress + resync/timeout watch-items).
- **DONE 2026-07-23 — di-letter-sounds L2 tutoring scaffold + FAMILY lesson-mode wiring
  (birth-cert follow-up #2 struck; both carried L0 gaps CLOSED).** DI tutoring block moved to
  `catalog/di.ts` `tutoring:` (+contextKeys challengeType/letter/keyword/letters, +3
  commonStruggles; sentinel-collision re-checked). Shared wiring, benefits the whole family: new
  `ComponentDefinition.audioInput` — both DI packs declare `{manual_activity:true}` in the catalog;
  `connectLesson` scans the manifest and opens the shared Gemini session with it (audio config is
  connect-time-fixed); `switch_primitive` carries tutoring + audio_input; standalone connect falls
  back to the catalog (component's explicit passes removed). Subskill carry comes free in lesson
  mode (ManifestOrderRenderer injection) — ends the 07-21 re-map watch-item.
  `subject_for_domain('di')→LANGUAGE_ARTS` added (REVISIT at di-math-facts). Generator grew a flat
  `letters` field; component syncs per-item RUNTIME STATE via silent updateContext. Verified:
  typecheck:lumina 0; tutor-test Tier 1 PASS (0 HIGH) + Tier 2 probe PASS (0 `(not set)`) —
  `qa/tutor-reports/di-letter-sounds-2026-07-23.md`. **Lesson-mode live loop → HUMAN-CHECKS #45**
  (incl. the mixed-lesson trade-off: DI-bearing lessons run manual VAD session-wide, non-DI chat
  turns won't open). **Committed `2e5814a` 2026-07-23** (L0 word-reading + L1 letter-sounds modes +
  L2 scaffold/lesson-mode wiring + useVoiceViewportGate all in one commit; tree clean).
- **#42 + #43 VERIFIED LIVE 2026-07-23/24 (both struck).** User mic runs: word-reading (sam·mat·cat·hat
  all read+affirmed, printed-word-only stage) + letter-sounds onset + mixed (SP-21 interleave m·s·f·s).
  User verdict: "a true awesome Lumina-native modality." Tester mode-switch kickoff bug fixed
  (`DirectInstructionPrimitivesTester` remounts the pack per Generate via `runKey` — components kick off
  a mic gesture and don't reset on new data; a lesson gives each objective a fresh instance so it's a
  tester-only artifact). typecheck:lumina 0; **needs the same mode-switch glance to confirm live.**
- **PHASE SET 2026-07-24 (user): "more DI packs" — content density within DI** (voice-transport
  unification stays PARKED; not this phase). WIP unchanged (reader-fit TOP + DI).
- **#46 math-facts probe sitting PASSED 2026-07-24 (struck; user: "worked great!").** Number words
  judged reliably from audio: 3/3 affirmed, aliasAgree 3/3 (ASR wrote WORDS — digit aliases never
  needed), 0 unanchored/phantom/echo-opened, commit lag ~933ms CONSTANT → silent response-time viable
  as the fluency signal. Carried to the primitive's L0 live loop (mirror of #41→#43): fact correction
  branch never fired (3/10 items, all correct) + homophone stress. Sentinel gate 2 resolved: engine
  defaults kept. Report + run JSON: `qa/di-bench/run-2026-07-24-math-facts-probe.md`. (Probe wiring
  `8e30a52`; ship-prereq slices `ec6d16e` ledger-gate fix — DI gens were the last legacy registrations,
  context-native migration now 100% — + `7283ef5` tester runKey + `d99ad29` charter/reconcile.)
- **#3 di-math-facts — BORN L0 2026-07-24 (BACKLOG item 3 STRUCK; the first custom-made set is
  complete: three packs at L0+).** Third DI pack, first MATH pack — `DiMathFacts.tsx` +
  hand-authored `diMathFactsScript.ts` (bench-proven #46 cue wording; strict on a different number,
  permissive on th-fronting/counting-up) + `gemini-di-math-facts.ts` (Fork A code-owned fact pool,
  scope code-enforced named→make-10→doubles→within-N→grade default, wrapper leak-guard) + full
  registration (catalog `answer_fact` β2.0 + audioInput, registerContextGenerator, metrics union
  incl. silent `meanResponseMs` fluency signal, backend registry, tester picker). Verified:
  typecheck:lumina 0; vitest 915/915; backend pytest = HEAD baseline (0 new); real-Gemini eval-test
  **PASS 6/6** (30 challenges programmatically recomputed); curriculum-fit **MATCH ×2** (K OPS001-03
  fluency-within-5 0.785 / G1 OPS001-01 addition-within-10 0.830). EVAL_TRACKER row added
  (358/375). Birth cert + ladder queue: `qa/eval-reports/di-math-facts-birth.md` (L1 candidates
  counting_next / fact_review / subtraction_fact — all still number words, the benched class, so no
  new bench sitting gates the ladder).
  **L0 gate NOT closed: the live loop has never been driven → HUMAN-CHECKS #48**, carrying three
  named stresses — (a) the fact CORRECTION branch ("My turn: …") has never been heard live (the #46
  bench sitting was all-correct) + the live half of the sentinel-opener judgment, (b)
  homophone/over-affirmation stress (one/won, two/too, four/for, eight/ate), (c) the submit must
  attribute to MATHEMATICS (OPS001), which is what exercises the new subject override at runtime.
- **DONE 2026-07-24 — di-math-facts L1 eval-modes (birth-cert follow-up #1 struck).** User chose the
  FULL birth-cert ladder: `counting_next` (β1.5) / `answer_fact` (β2.0, L0 unchanged) /
  `fact_review` (β2.5) / `subtraction_fact` (β3.0). **Standing gate 1 satisfied with NO new bench
  sitting** — every mode answers with a spoken NUMBER WORD, the class benched in #46. The
  bench-proven L0 cue wording survives byte-for-byte: the L0 lines were already phrased around
  `it.problem`, so all four skills read through the same proven sentences ("three minus one is two",
  "the number after five is six") — the ONLY type-aware line is the counting DIRECTION in the
  judging contract (subtraction counts back, not up). Fork A held (code owns pools/answers/aliases,
  stamps `challengeType`); new code-built `solvedDisplay` so the post-affirmation reward is right per
  skill ("5 → 6", not "5 → ? = 6"). Catalog description/constraints widened WITH a routing boundary
  ("use a dedicated counting primitive when counting itself is the objective") so the pack doesn't
  poach counting-board/number-line territory. Verified: real-Gemini eval-test **PASS ×8** (4 pinned
  single-type + mixed = all-four interleave (SP-21) + curated blend), **40/40 challenges recomputed
  correct**, and `/topic-trace` on a real K subtraction topic routed manifest →
  **`subtraction_fact`** end-to-end — intent routing was NEWLY live (with one mode the resolver
  short-circuits to mixed, so this path had never run for this pack). typecheck:lumina 0; full tsc
  0-new (1021 pre-existing legacy); vitest **915/915**. One design gap caught by the run and closed:
  `fact_review` on a doubles objective drew ZERO doubles — anchors now hold for any scope.
  EVAL_TRACKER 361/378. **The 3 NEW modes' cue wording is UNVERIFIED live → HUMAN-CHECKS #49, which
  folds into #48 (one mic sitting closes both).** Report:
  `qa/eval-reports/di-math-facts-evalmodes-2026-07-24.md`. Deferred by design: G3
  `multiplication_fact` (needs its own curriculum-fit + grade gate) and missing-addend (L4).
- **DONE 2026-07-25 — di-math-facts L2 tutoring scaffold (birth-cert follow-up #2 struck; the pack is
  now L2 one day after birth).** `DI_MATH_FACTS_TUTORING` moved from `diMathFactsScript.ts` into
  `catalog/di.ts` `tutoring:`, so both connect paths (standalone fallback + lesson
  auth/`switch_primitive`) resolve it from the single source of truth. **No transport work needed** —
  di-letter-sounds' 07-23 L2 slice already built the family lesson-mode wiring, which is exactly the
  leverage that slice was for. The bench-proven cue lines + `judgingContract` are untouched,
  byte-for-byte. Added AT this layer (the L0 block had none of it): `contextKeys`
  (challengeType/display/problem/facts — **stimulus side only**; `answerWord`/`solvedDisplay` stay
  out because the tutor already gets the answer inside the `[DI_ITEM]` contract and RUNTIME STATE is
  echoed far more loosely than a scripted line), 4 `commonStruggles`, and one NUMBER WORDS clause
  aimed at the #48 homophone stress (judging is by SOUND, so a homophone of the TARGET number is the
  target — "won"/one, "too"/two, "for"/four, "ate"/eight; the "a DIFFERENT number is always wrong"
  rule is untouched). Component drops its local `tutoring:` arg and gains an `updateContext` effect
  (silent channel, never perturbs the judged loop); generator attaches the flat `facts` summary so
  RUNTIME STATE is populated from the first auth-time prompt (mirrors letter-sounds' `letters`).
  Verified: tsc **0 Lumina-surface errors**; `/tutor-test di-math-facts` **0 HIGH** — 2 WARNs that
  are the DI family's SHAPE, not defects (`data-bag-unparsed`: DI connects via
  `ctx.connect`/`updateContext`, not a `useLuminaAI` bag the auditor can parse; `no-sendtext-moments`:
  DI cues ride `[DI_ITEM]`/`[DI_MOVE_ON]`/`[DI_COMPLETE]` through the judged-loop engine, so the
  tutor cannot go silent) — di-letter-sounds carries the identical pair. Tier-2 probe on TWO modes
  (`answer_fact` @ K, `subtraction_fact` @ G1) shows all 4 keys resolving with real values, **no
  `(not set)`, no answer in RUNTIME STATE**. Report: `qa/tutor-reports/di-math-facts-2026-07-25.md`.
  **Tier-3 rides #48/#49** — the new struggle/homophone copy is exercised by the same mic sitting
  that drives the correction branch, so no new human gate was created.
- **L0 LIVE GATE CLOSED 2026-07-25 (user mic run — "worked great!") — di-math-facts is now
  runtime-verified at L0 + L1 + L2.** `subtraction_fact` / "subtraction within 5": **5/5 affirmed**
  + recap. One sitting closed three layers: the judged loop end-to-end (no desync/stall/phantom),
  the reworked reward beat (audio-edge pacing holds live — not flagged as dragging or clipping),
  and the **first live run of the catalog-resolved L2 scaffold** — the tutor held the scripted lines
  across 5 items, so the 4 added `commonStruggles` did NOT loosen it into chattiness (the named risk
  of adding them). `subtraction_fact` cue wording + code-built `solvedDisplay` confirmed live (#49b).
  HUMAN-CHECKS **#48 struck**. **Residual: third consecutive ALL-CORRECT sitting** — the correction
  branch has still never been heard, the L2 homophone clause has never been exercised, and the
  MATHEMATICS submit attribution is unconfirmed; all three need a deliberately WRONG answer →
  new HUMAN-CHECKS **#50**. Report: `qa/eval-reports/di-math-facts-live-2026-07-25.md`.
- **DONE 2026-07-25 — di-math-facts reward beat (user browser check, same session as L2).** The stage
  showed the NEXT problem while the LAST answer's equation sat in a chip below it — two facts at once,
  overload at K. Fixed in two halves: the completed equation now REPLACES the printed problem in the
  big slot (never stacks under it), and `advance()` is deferred to a reward beat instead of firing at
  verdict time. **The beat is edge-driven, not timed** — the engine already sends the next `[DI_ITEM]`
  cue 400ms after the tutor's audio falls (`VERIFY_BEAT_MS`), so the visual rides that same falling
  edge and the swap lands exactly when the tutor stops talking about this fact (900ms floor, 3s cap,
  and `attempt-open`/`resync` flush the beat so a resolved fact is never up while the child answers
  the next one). Verified: new jsdom suite `DiMathFacts.reward-beat.test.tsx` **6/6**, non-vacuity
  probed (reverting the deferred advance fails 2 of them, reverting the in-place render fails a 3rd);
  full vitest **921/921**; tsc 0 Lumina errors. **The FEEL still needs the mic — HUMAN-CHECKS #48
  updated**, since its old text described the behavior this replaced. Reinforces the July
  retrospective's antipattern #1: the 07-24 answer-leak fix was tsc-and-eval-green and still shipped a
  UX regression that only a human at the browser could see.
- **STANDING GATE 1 PASSED 2026-07-25 (user mic sitting — "this worked so well!") —
  `di-sentence-reading` is CLEARED FOR `/primitive`, and it is now the stream's top pull.**
  10/10 items, 10 affirmed / 3 corrected / **0 off-script / 0 unanchored**. **The make-or-break
  answered YES 2/2:** two deliberate one-word OMISSIONS inside 6- and 7-word sentences ("big",
  "red") were both caught and corrected, both retries affirmed — omission is the hardest error class
  to hear, and a rubber-stamp there would have killed the pack. **Whole-sentence correction is
  settled** (learner self-repaired on the first retry both times → word-targeting, and its
  off-script risk, is unnecessary). **Restating affirm stays** (~2-3s against a ~15-17s cycle whose
  dominant term is learner think-time, 8-11s — tutor talk is not the bottleneck for connected text).
  **One ship-blocking finding, cheap:** a read sentence splits into TWO voice turns (3
  supersessions) because `silenceCloseMs: 500` is tuned for one-word answers — a mid-sentence pause
  is part of the response. It broke the alias cross-check (BOTH alias disagreements trace to the
  split, not judge error) and nulled `responseMs` on second fragments; the pack passes ~1100ms via
  `useJudgedSpeechLoop({ voice: { config } })` and the family default stays 500ms. Scope confirmed
  3-8 words, no ceiling found. Residual → HUMAN-CHECKS **#53** (short end unstressed; item 1
  transcribed "the car" yet affirmed — ASR artifact or false affirm, unresolved). Report:
  `qa/di-bench/run-2026-07-25-sentence-reading-probe.md`.
- **Context for the above — QUEUE REOPENED 2026-07-25 (user phase call: "can we turn
  read-aloud-studio into a DI-style primitive?") — 4th pack = `di-sentence-reading`.** Ruling: **fork,
  do NOT convert.** `read-aloud-studio` is live (3 eval modes accuracy/expression/dialogue with
  calibrated βs, `supportsEvaluation`, a `problem_type_registry` row) so the manifest can route to it
  today; rewriting its modality in place would silently change what those eval modes MEAN and
  invalidate their calibration — the contract-first fork-on-conflict case. The new pack takes judged
  short-sentence accuracy at G1-2; read-aloud-studio keeps passages, WPM, and expression/dialogue for
  older readers, where self-assessment is defensible. **Why it's worth a pack:** read-aloud-studio's
  own catalog says *"Student self-assessment only, no AI speech grading"* — it has a mic, records,
  tracks WPM, and judges nothing, so it produces no evidence the IRT model can use. This is
  `feedback_production-modality-roadmap` exactly. **Standing gate 1 honored:** connected text is the
  family's biggest response-class jump (every benched class so far is a SHORT production judged
  whole), so it benched before wiring — `kind: 'sentence'` + a 10-item `Sentence reading` probe
  (3→8-word ladder, word-reading vocabulary carried over, one-word-error stress: hen/pen, hat/hut,
  a repeated phrase where omission is easy). The sentence branch gets its OWN judging criteria: the
  generic "reasonably close for a kindergartener" is right for one short production and WRONG for
  connected text, where "close" rubber-stamps the dropped word fluency exists to catch. Bench tests
  **22/22**, tsc 0 Lumina errors. **The sitting (HUMAN-CHECKS #51) decides three things:** (a) can
  Live detect a ONE-WORD error in a 5-8 word utterance — make-or-break; (b) whole-sentence correction
  vs. word-targeted (which costs off-script risk); (c) does the restating affirm drag at sentence
  length. `/primitive` only after it passes.
- **DONE 2026-07-25 — `di-sentence-reading` BORN L0 (BACKLOG item 2 STRUCK). Fourth DI pack, the
  family's first CONNECTED TEXT pack, and the first born on a gate cleared the same day.**
  `DiSentenceReading.tsx` + hand-authored `diSentenceReadingScript.ts` — **every spoken line is
  byte-for-byte the bench's proven `kind:'sentence'` branch**, so all three sitting rulings ship
  intact: whole-sentence correction (no word-targeting and its off-script risk), the restating
  affirm kept, 3-8 word scope. `gemini-di-sentence-reading.ts` is Fork A over a **37-sentence
  code-owned decodable menu** (vocabulary carried from the word-reading menu so a miss is
  attributable to connected text, not new words; a model-written "sentence for a first grader"
  would be undecodable and turn every miss into a content bug). Full registration incl. catalog
  `read_sentence` β3.0 + `audioInput` + the L0 `tutoring:` block, backend β mirror, and a tester
  **Sentence Reading** picker with a per-pack `defaultGrade` (the tester had been sending
  kindergarten for every pack).
  **The ship-blocking bench finding landed in the same slice:** `silenceCloseMs` **1100ms**
  pack-level — a mid-sentence pause is part of one response, not the end of it. The family default
  stays 500ms; the three short-response packs are untouched.
  Verified: `typecheck:lumina` **0**; full tsc **0 Lumina-surface errors** (805 pre-existing, all in
  the legacy graveyard); vitest **936/936**; real-Gemini eval-test **PASS ×11** with every check
  programmatic — wordCount recomputed from text, benched ceiling, sentinel safety, wrapper leak,
  teaching order, vowel purity (`qa/eval-reports/di-sentence-reading-2026-07-25.md`);
  curriculum-fit **MATCH ×2** — G1 `LA003-01` Oral Reading Accuracy 0.824 (its top subskill,
  *"self-correct reading miscues by re-reading"*, is a near-verbatim statement of the judging
  contract) and G2 `LA001-05` Reading Fluency 0.807, **whose sibling subskills are
  read-aloud-studio's self-assessment territory — independent confirmation of the fork ruling**
  (`qa/curriculum-fit/di-sentence-reading-2026-07-25.md`). EVAL_TRACKER 362/379.
  **One real issue found + fixed by QA:** phonics scope was vowel OVERLAP, not purity — a "short a"
  objective was served "Sam has a red cup." (a/e/u). The pool now prefers vowel-SUBSET sentences and
  widens only if pure cannot fill the session; all five vowels now serve pure sets. (Automated
  checks had passed — this one only surfaced by reading the content.)
  **Departure worth knowing:** the tutoring block ships in the CATALOG at birth rather than the
  script (as the two older reading packs did), because di-letter-sounds' L2 slice already built the
  family lesson-mode wiring that resolves both connect paths from there — so lesson mode works day
  one. L2 still owns `contextKeys` / `commonStruggles` / RUNTIME STATE sync.
  Birth cert + 6-layer queue: `qa/eval-reports/di-sentence-reading-birth.md`.
- **L0 LIVE GATE CLOSED 2026-07-25 (user mic run — "it worked fantastically!") — the pack was born
  and runtime-verified the SAME DAY, a family first.** 4/4 affirmed, session completed + submitted,
  recap all-emerald. One sitting closed three things: the judged loop end-to-end through THIS
  component (its `applyVerdict` → `recordResult` → `advance` path, cue builders, and generator had
  never run together with a real mic), **the reward beat at SENTENCE length** — the named pacing
  risk, since the affirm restates the WHOLE sentence (~2-3s), well past what the 900ms floor / 3.5s
  cap were tuned against, and it neither dragged nor clipped — and the one-sentence stage invariant
  (the exact failure di-math-facts shipped and had to fix a day earlier).
  **Residuals are now both QUANTITATIVE, not behavioural → HUMAN-CHECKS #54:** (a) the
  `silenceCloseMs: 1100` fix has no numeric proof — the run did not visibly break, but its evidence
  (0 attempt-supersessions / non-null `responseMs` / `aliasMatch` true) lives in the `[DI eval]`
  console payload, not the UI; (b) the SHORT end (#53) and the correction branch stayed dark —
  **the fourth consecutive all-correct DI sitting through a primitive**, with `[DI_MOVE_ON]` still
  never fired in ANY pack. Note the difference from math-facts' equivalent gap: the sentence
  correction WORDING is bench-proven (3 corrections incl. the 2 deliberate omissions), so what is
  untested is only the COMPONENT's retry-in-place branch and 2-correction cap. Report:
  `qa/eval-reports/di-sentence-reading-live-2026-07-25.md`.
- **DONE 2026-07-25 — di-sentence-reading L1 eval-modes (birth-cert follow-up #1 struck). The pack
  went BORN → LIVE-VERIFIED → L1 in a single day.** Full 4-mode ladder: `decodable_sentence` (β2.5)
  / `read_sentence` (β3.0, L0 unchanged) / `sentence_review` (β3.5) / `sight_phrase_sentence` (β4.0).
  Standing gate 1 satisfied with **no new bench sitting** (every mode is the same response class) and
  — unlike di-math-facts, which needed one type-aware line — this ladder shipped with **ZERO new
  spoken copy**: the L0 script was already phrased around `it.text`, so all four skills read through
  the bench-proven sentences byte for byte. **Identities, not tiers:** `decodable_sentence` and
  `read_sentence` have different curriculum homes at different grades, and `decodable_sentence` gives
  the pack the **K home the birth's fit probe abstained on**. Verified: typecheck:lumina 0; full tsc
  0 Lumina-surface errors (803 pre-existing); vitest 936/936; backend β rows mirror the catalog;
  real-Gemini eval-test **10/10 clean** with per-mode **POOL** assertions rather than type stamps
  (all four modes render identically, so the route's own validator passes trivially) — incl. **mixed
  yielding all four types (SP-21)**. `/topic-trace` closed the routing path the tester structurally
  cannot reach: a sight-word objective → `sight_phrase_sentence` end-to-end, **newly live** (with one
  mode the resolver short-circuits). **Found + fixed in QA: `sentence_review` never broadened** — a
  short-a review returned 4/4 short-a, the base mode relabelled, because the model's picks (drawn
  from the focused prompt menu) crowded out the wide pool. **di-math-facts' `fact_review` bug in
  mirror image** — theirs drew zero focus items and lost the thread; this drew nothing else and lost
  the breadth; both are the same underlying question caught from opposite sides. Reports:
  `qa/eval-reports/di-sentence-reading-evalmodes-2026-07-25.md`,
  `qa/topic-traces/reading-sentences-with-sight-words-2026-07-25.md`. EVAL_TRACKER 365/382.
  **L1 VERIFIED LIVE the same day (user mic run on `sight_phrase_sentence` — "these are so good!");
  HUMAN-CHECKS #54(c) struck.** 4/4 affirmed, all four sentences from the sight-heavy pool → the mode
  means at runtime what the catalog claims, and the bench-proven cue lines carried a vocabulary
  (see/go/you/my/and) no prior sitting had spoken, which was the last plausible place for the ladder
  to have disturbed proven speech. **So di-sentence-reading is runtime-verified at BOTH L0 and L1 on
  its birth day** — a family first (letter-sounds took 1 day to its L0 gate, word-reading 1, math-facts 1).
- **DONE 2026-07-25 — di-sentence-reading L2 tutoring scaffold (birth-cert follow-up #2 struck). The
  pack ran L0 → live → L1 → live → L2 in ONE day.** Because it already shipped its catalog
  `tutoring:` block at birth (the deliberate departure — di-letter-sounds' L2 had already built the
  family lesson-mode wiring), L2 added precisely the omitted half: `contextKeys`
  (challengeType/text/wordCount/sentences), the **`{{challengeType}}` placeholder those keys make
  safe** (an unfilled `{{key}}` renders SILENTLY, so it could not ship before its key), 5
  `commonStruggles` drawn from behaviour actually observed in the bench sitting + both live runs, a
  generator `sentences` summary, and the component `updateContext` sync. Bench-proven aiDirectives,
  cue lines, and judging contract untouched byte-for-byte. **Sibling difference recorded:**
  di-math-facts keeps its ANSWER out of RUNTIME STATE; that reasoning does not transfer here, since
  the printed sentence is stimulus and target both — nothing is withheld. Verified: typecheck:lumina
  0; vitest 936/936; `/tutor-test` **0 HIGH** with the same 2 structural WARNs both siblings carry;
  **Tier-2 probe clean on 3 modes** (`probe.findings: []`, all keys real, and the `sentences` summary
  tracks the pinned mode's pool — proof L1 and L2 did not drift). The 5 `(not set)` strings are
  confined to `staticPromptPreview`, which by construction has no content to fill. **Tier 3 rides
  #54** — three of the five struggles only fire on a MISS, so the deliberately-wrong read exercises
  them; watch that 5 struggles don't loosen the scripted tutor into chattiness (math-facts cleared
  this with 4). Report: `qa/tutor-reports/di-sentence-reading-2026-07-25.md`.
- **DONE 2026-07-25 — di-sentence-reading L3 support tiers (birth-cert follow-up #3 struck). The pack
  ran L0 → L1 → L2 → L3 on its birth day.** Fits NONE of the skill's six archetypes (live-judged
  spoken production) and has **zero `showOptions`**, so the whole ladder is modality #2
  instruction-as-scaffold — the AngleWorkshop case. The sub-steps were already there: **DISTAR's
  model→guide→test IS a scaffold ladder.** easy = model+guide+test / medium = model+test / hard =
  **cold read**. In the SCRIPT (`leadInFor`), never a UI flag, exactly as the birth cert specified.
  **`hard` closes the answer-leak caveat the birth audit could not resolve** — the model line speaks
  the sentence before the child reads it (legitimate DI instruction, but an ECHO ROUTE); at hard the
  sentence never enters the block the tutor may speak. Never withdrawn at any tier: the printed
  sentence, the correction's re-model (gate 3), the restating affirm (bench (c)), the judging
  contract. **Tutor second-channel hole found + fixed:** L2's own `scaffoldingLevels` level 1 would
  have re-read the withheld sentence at hard. **Deliberate departure — no `tierSection` in the
  prompt:** under Fork A the model only picks sentence ids, so a tier line could only nudge CONTENT =
  structural difficulty by the back door. Verified: typecheck:lumina 0; full tsc 0 Lumina-surface;
  vitest **949/949**; new suite 13/13 with **non-vacuity proven** (5 fail when reverted). **A bad
  assertion of mine was caught in QA** — diffing content across tiers to prove "numbers never change"
  cannot work, since a same-tier control returned three different sets; the rule is established
  structurally instead. That control also **retires the L0 convergent-selection note** (L1's
  selection path introduced real variety). Report:
  `qa/eval-reports/di-sentence-reading-support-tiers-2026-07-25.md`.
- **DONE 2026-07-25 — contrastive correction (user ruling), di-sentence-reading + di-math-facts.**
  The first live correction run in ANY DI pack overturned the sentence pack's bench finding (b):
  a reader read "Mom got THE pot" **three times** against an identical whole-sentence re-model,
  because a re-model gives the learner nothing to diff their own words against. The bench's
  evidence for (b) was n=2, both OMISSIONS with first-retry self-repair — a SUBSTITUTION with no
  self-repair had never been seen. Corrections now NAME the error and contrast it
  (`My turn: not ⟨what they said⟩ — <correct form> Your turn. <ask>`), audio only, no screen
  change (user scope call). The sitting's stated blocker was inspected and does not hold —
  sentinels match OPENERS only (`matchesOpener`), so a mid-line slot carries zero engine risk;
  `correctionLine` survives byte-for-byte as the nothing-to-contrast fallback. Math also carries
  the user-named **echo misconception** (answering "2 + 1" with "one"). Verified typecheck:lumina 0,
  vitest **964/964**, new `diCorrectionContrast.test.ts` 15/15 (filled AND unfilled contrast lines
  still classify as `corrected`). **UNBENCHED per the family rule → HUMAN-CHECKS #55, riding the
  same mic run as #54/#50(a).** letter-sounds + word-reading still carry the old re-model — port
  only after #55.
- **Next pull (2026-07-25):** di-sentence-reading **`/add-structural-difficulty` (L4)** — now
  unblocked; the axis is already built and measured (sentence LENGTH, carried as `wordCount` +
  `meanSentenceWords`), with one hard constraint: the **8-word benched ceiling is not a difficulty
  knob** — raising it needs a new bench sitting, not an L4 decision. Ladder alternative: **di-math-facts
  `/add-support-tiers` (L3)** is the
  natural continuation — the birth cert already specifies the fade (easy = model+guide+test, medium =
  model+test, hard = test-only cold), and it lives in the SCRIPT/cue builder as a per-tier cue
  variant, never a UI flag; alternatives are di-word-reading catalog `tutoring:` move (L2) or
  di-letter-sounds `/add-support-tiers` (L3). A **fifth** pack is a user phase call — the fourth
  (di-sentence-reading) is born, and note a "counting sequence" pack is no longer a candidate at all
  since `counting_next` absorbed that step; the remaining benched-class gap is blends.
  **Nearest human gates, in leverage order: #54** (di-sentence-reading L0 — the newest and only
  un-driven pack, and the one carrying an engine-parameter change), then **#50** (a deliberately
  WRONG math-facts answer: the correction branch has never been heard in ANY pack across four
  sittings) + **#49(a)/(c)**, then **#45** (DI in a real K lesson). #48 is struck.
- **`subject_for_domain('di')` REVISIT — RESOLVED AND NOW COMMITTED (`/pm` 2026-07-25 correction of
  its own 07-24 note).** The 07-24 line called this "resolved in the working tree (uncommitted)";
  that is now stale — `curriculum_retrieval_service.py` (`_PRIMITIVE_TO_SUBJECT`
  `di-math-facts → MATHEMATICS` + `subject_for_primitive()`, per-primitive override wins and the
  domain default falls through), `curriculum_mapping_service.subject_for_primitive()` and
  `submission_service` (passing `ctx.primitive_type`) all shipped in **`7be0883`**; the working tree
  carries none of them. The DI family can span subjects without splitting the domain. The ONLY
  uncommitted backend file is `problem_type_registry.py` (the L1 β mirror, part of the DI slice).
  **Still unverified at runtime** — a math-facts submission must be seen resolving to MATHEMATICS
  before this is called done; that check is HUMAN-CHECKS #48(c), same sitting as the data-loop trace
  that closed #36.
- **REGISTER GAP CLOSED (`/pm` 2026-07-24): the DI family was invisible in `qa/EVAL_TRACKER.md`.**
  Two shipped, eval-tested packs (di-letter-sounds 3 modes, di-word-reading 1 mode) had passing
  eval-tests with reports on disk but no dashboard row — so the tracker under-reported the portfolio
  and a session reading it would not know DI primitives existed. Backfilled from the committed
  reports (no re-run): totals 353/370 → **357/374**, 0 new open issues. Standing correction recorded
  in the tracker: a DI `/primitive` / `/add-eval-modes` run writes its row like any other primitive.
  `di-math-facts`'s row is owned by the in-flight session and lands with its birth cert.
- **Still open (not blocking the phase): HUMAN-CHECKS #45** — DI in a real K lesson (L2 lesson-mode
  behavior + the mixed-lesson VAD trade-off measurement). Worth running opportunistically; it's the
  evidence that would later justify un-parking voice-transport.
- **WIP note:** the 07-16 "proof-of-concept, not a build" framing is RETIRED (user call
  2026-07-20) — the bench proved the architecture; DI is now a build stream. ACTIVE = reader-fit
  (top) + DI = **2 ACTIVE, within the 2+1 limit.**

*(SP-27 Tutoring Context Integrity + media-player reimagining + voice-transport unification all
PARKED — see PARKED table. WIP = **2 ACTIVE + 0 DELEGATED** (reader-fit TOP-PRIORITY + DI family),
within the 2+1 limit as re-verified 2026-07-24; DI is the only lane with activity since 07-21.)*

## DELEGATED

*(none — lane 3 closed 2026-07-15, folded to the PARKED contracts stream below.)*

> **WIP note (`/pm` reconcile 2026-07-25 — supersedes the 07-24 note):** HEAD `19874c5`, main.
> Portfolio = **2 ACTIVE + 0 DELEGATED** — **within the 2+1 limit**, but still only ONE lane moving.
>
> **Uncommitted surface is `/ship`-READY and spans TWO concerns — slice it.**
> (a) **DI slice** — di-math-facts L1 eval-modes + L2 tutoring scaffold: the pack files
> (`DiMathFacts.tsx`, `diMathFactsScript.ts`, `gemini-di-math-facts.ts`), `catalog/di.ts`,
> `diGenerators.ts`, `evaluation/types.ts`, the tester, backend `problem_type_registry.py`, plus the
> two new QA reports and the register updates (EVAL_TRACKER 361/378, HUMAN-CHECKS #48/#49, DI
> BACKLOG, WORKSTREAMS, birth cert). Both layers are verified per doctrine (real-Gemini eval-test
> ×8 with 40/40 recomputed; `/tutor-test` 0 HIGH + Tier-2 on two modes; tsc/vitest green) — the
> only thing outstanding is the LIVE mic sitting, which is queued human debt, not a ship blocker.
> (b) **Docs slice** — root `CLAUDE.md` trimmed (PM + UI/Styling sections compressed, Development
> Commands dropped), the UI-kit rules extracted to a NEW untracked
> `my-tutoring-app/src/components/lumina/CLAUDE.md`, and `.claude/skills/pm/SKILL.md` gaining the
> Portfolio-model section. **These two files must ship TOGETHER** — the trimmed root CLAUDE.md
> already points at the lumina CLAUDE.md, so committing (a) without (b) leaves a dangling pointer.
> (c) **Flag, don't ship blind:** `.claude/settings.local.json` REMOVES four allow-entries
> (`Bash(*)`, `Glob`, `Grep`, `Read`), leaving only `Read(**)`. If that narrowing wasn't deliberate,
> revert it rather than letting it ride a slice.
>
> **Reader-fit (TOP PRIORITY by user designation 2026-07-16) is now 5 days idle** — last touched
> 2026-07-20, while DI ran 07-21→07-25 on a user-set phase ("more DI packs"). Unchanged WIP tension:
> the designation and the phase point at different lanes. Not auto-parked — the user's call. Its
> next pull (coin-counter Task 3) was verified genuinely open on 07-24 and nothing has touched
> `CoinCounter.tsx` since, so resuming still costs no re-derivation.
> **Human-only residuals:** HUMAN-CHECKS #3–#49 (next free ID **50**); the nearest DI gates (#48 +
> #49) close in ONE mic sitting and are the L0/L1/L2 gate for the whole math-facts pack; phonics
> tap-pronounce runtime verification (reader-fit BACKLOG #7 follow-up, `/tutor-test`).

## PARKED (trusted-as-of date; re-verify before acting)

| Stream | Queue / doc | Next action | As of |
|---|---|---|---|
| Voice transport unification | `my-tutoring-app/qa/voice-transport/CHARTER.md` | **NEW 2026-07-23 (user direction).** Promote the DI-proven client-side turn authority (`voiceTurnMachine`/`useLiveVoiceTurns`) from DI-private mode to Lumina's SESSION-WIDE voice transport, so students can talk to the tutor throughout a lesson and verbally refer back to prior sections. Dissolves the DI mixed-lesson manual-VAD trade-off (L2 wiring 07-23, HUMAN-CHECKS #45 measures the interim). Phases: calibration beat → lesson-level turn authority (DI becomes a consumer) → contextual close-timing + viewport claim → refer-back Tier-3 journey beats (the raised live-testing bar). Charter has the evidence base + watch-items. Pull only when a WIP slot opens. | 07-23 |
| media-player reimagining | `qa/media-player-reimagining/BACKLOG.md` + `docs/contracts/media-player.md` | **PARKED 2026-07-16 (user — B1 shipped & browser-confirmed, `39f2543`).** B1 done: 3 eval modes live (PRE `listen_and_look` / EMERGING `listen_for_details` / ESTABLISHED `story_analysis`), MP-1/2/3 cleared, PRE band + tester refactor user-verified. Resume at **B2 (EMERGING polish)** or B4 `/tutor-test` probe; **B5 live `--lesson` @ K still queued** (live tutor beats, not tester-covered). Contract is CONFLICTED — C1's resolution IS this stream; read it first on resume. | 07-16 |
| SP-27 Tutoring Context Integrity | `docs/PRD_TUTORING_CONTEXT_INTEGRITY.md` + sweep `qa/tutor-reports/sweep-2026-07-14.md` | **PARKED 2026-07-16 (deliberate, single-stream focus on reader-fit).** Resume at Phase 0: harden `scaffoldAudit.ts` (invalid-syntax + studentPrompts coverage + fingerprints), **re-run the now-stale sweep** (comparison-builder edits since), cut the monotonic baseline, add the Vitest + report-only runtime gates. NOT urgent — failures cluster in physics/advanced-math sims students aren't routed to; K primitives are already green. **Carry-forward HIGH — RESOLVED + COMMITTED 2026-07-16 (`39f2543`):** the `fast-fact` spoken answer-leak (`scaffoldingLevels.level3` interpolated `{{correctAnswer}}` then said "try again") is FIXED — level3 rewritten answer-free in `catalog/core.ts`; Tier-1 audit re-run confirms the `answer-leak-in-scaffold` finding cleared (fast-fact HIGH→WARN; only a pre-existing `indirect-script` level2 copy nit remains). `correctAnswer` retained in taskDescription/RUNTIME STATE for tutor-reference (allowed). This was the single audibly-harmful SP-27 defect; the rest of the stream stays parked. | 07-16 |
| Primitive contracts | `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` | **7 contracts on disk** (newest: counting-board 2026-07-20 via reader-fit #13; ten-frame 2026-07-16 via #12; media-player 2026-07-16 via #9a Step 1 — the CONFLICTED one) + **baseline `--check` ×2 PASSED 07-15** (first guard exercise: both COMPATIBLE, 20/20 requirements hold at runtime; ss R8 amended for precision — object window is prompt+tier-conditioned, bin cap is the hard clamp; reports in `qa/primitive-contracts/`). Next = #3 **foundation-explorer** derivation, then #2 knowledge-check (before `true_false @ PRE` lands). *(`/pm` 2026-07-25: the old "its files are already in flight in the working tree" caveat is STALE — the #9 explainer-tail work shipped; the tree is DI-only.)* | 07-15 |
| Engineering tutoring-scaffold wiring | `my-tutoring-app/qa/engineering-tutoring-scaffold/BACKLOG.md` | **NEW 2026-07-21 (user).** Bring engineering primitives to L2 (`/add-tutoring-scaffold`). **Phase A** = 12 primitives with NO `useLuminaAI` tutor channel (machine-profile, dump-truck-loader, bridge-builder, tower-stacker, gear-train-builder, pulley-system-builder, lever-lab, ramp-lab, wheel-axle-explorer, shape-strength-tester, foundation-builder, blueprint-canvas) — wiring the channel also unlocks read-aloud there (finishes the 07-21 sweep). Pilot A1 machine-profile end-to-end + live-verify BEFORE sweeping A2–A12. **Phase B** = `/tutor-test` the 12 that already have the channel for L2 *sufficiency* (not just presence). Executors: `/add-tutoring-scaffold` → `/tutor-test` → `/reader-fit --fix`. | 07-21 |
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
