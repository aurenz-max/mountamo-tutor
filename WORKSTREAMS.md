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

### 1. Reader-fit K queue — TOP PRIORITY (user, 2026-07-16) — last touched 2026-07-20
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
- **Now (per `/pm` 2026-07-20):** #13 closed; **2b tail closed 2026-07-20** (see the #2b row above).
  Remaining pull = **Task 3 — coin-counter `count-like` confirm/clear** (the last un-swept
  direct-manipulation candidate from the 07-16 sibling census; full prompt =
  `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md` Task 3). Then, with the demand-side K queue
  drained, re-run the topic-trace census at grade 1 (EMERGING) to re-seed the band.
  Uncommitted (a sibling #13 session): `CountingBoard.tsx` + its jsdom test +
  `docs/contracts/counting-board.md` + QA docs — `/ship` when ready (separate slice from this 2b-tail one).
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

### 2. Direct Instruction primitive family (graduated from bench) — last touched 2026-07-23
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
  turns won't open). Uncommitted.
- **Now (two live pulls, either order):** (a) **human mic sittings: HUMAN-CHECKS #45** (DI in a
  real K lesson — the L2 behavior gate + mixed-lesson trade-off probe) **+ #43** (di-word-reading
  live loop — the real L0 gate) **+ #42** (letter-sounds onset wording); #41 bench sitting is
  optional (no longer blocking). (b) climb the ladder — next rung `/add-support-tiers
  di-letter-sounds` (L3, birth-cert follow-up #3) or di-word-reading's own catalog `tutoring:`
  move (its L2; shared wiring already in place). Item 3 di-math-facts stays gated on a
  number-words bench probe (watch sentinel collision with natural "Yes!").
- **WIP note:** the 07-16 "proof-of-concept, not a build" framing is RETIRED (user call
  2026-07-20) — the bench proved the architecture; DI is now a build stream. ACTIVE = reader-fit
  (top) + DI = **2 ACTIVE, within the 2+1 limit.**

*(SP-27 Tutoring Context Integrity + media-player reimagining both PARKED — see PARKED table.
WIP = **2 ACTIVE** (reader-fit TOP-PRIORITY + DI bench), within the 2+1 limit as of 2026-07-16.)*

## DELEGATED

*(none — lane 3 closed 2026-07-15, folded to the PARKED contracts stream below.)*

> **WIP note (`/pm` reconcile 2026-07-19 — supersedes the 07-16 SECOND PASS):** the 07-16 two-stream
> uncommitted batch has SHIPPED — ten-frame #12 in `9999880`, DI live-judged/open-mic in `6635877`,
> QA-doc reconcile in `10b17d9`; main pushed & in sync. The only uncommitted surface today is
> **single-stream (DI bench): extraction step 1** — `hooks/voiceTurnMachine.ts` +
> `hooks/useLiveVoiceTurns.ts` + the bench refactor, **deliberately held** pending its runtime gate
> (HUMAN-CHECKS **#32**, one browser/mic sitting), plus this WORKSTREAMS/HUMAN-CHECKS reconcile
> (shared QA docs — commit in their own slice per standing hygiene).
>
> Portfolio = **2 ACTIVE + 0 DELEGATED** (reader-fit TOP + DI bench) — **within the 2+1 limit**.
> Reader-fit is 3 days idle but user-designated TOP PRIORITY → resume at #13, don't park.
> Residuals human-only: HUMAN-CHECKS #3–#32; phonics tap-pronounce runtime verification
> (reader-fit BACKLOG #7 follow-up, `/tutor-test`).

## PARKED (trusted-as-of date; re-verify before acting)

| Stream | Queue / doc | Next action | As of |
|---|---|---|---|
| media-player reimagining | `qa/media-player-reimagining/BACKLOG.md` + `docs/contracts/media-player.md` | **PARKED 2026-07-16 (user — B1 shipped & browser-confirmed, `39f2543`).** B1 done: 3 eval modes live (PRE `listen_and_look` / EMERGING `listen_for_details` / ESTABLISHED `story_analysis`), MP-1/2/3 cleared, PRE band + tester refactor user-verified. Resume at **B2 (EMERGING polish)** or B4 `/tutor-test` probe; **B5 live `--lesson` @ K still queued** (live tutor beats, not tester-covered). Contract is CONFLICTED — C1's resolution IS this stream; read it first on resume. | 07-16 |
| SP-27 Tutoring Context Integrity | `docs/PRD_TUTORING_CONTEXT_INTEGRITY.md` + sweep `qa/tutor-reports/sweep-2026-07-14.md` | **PARKED 2026-07-16 (deliberate, single-stream focus on reader-fit).** Resume at Phase 0: harden `scaffoldAudit.ts` (invalid-syntax + studentPrompts coverage + fingerprints), **re-run the now-stale sweep** (comparison-builder edits since), cut the monotonic baseline, add the Vitest + report-only runtime gates. NOT urgent — failures cluster in physics/advanced-math sims students aren't routed to; K primitives are already green. **Carry-forward HIGH — RESOLVED + COMMITTED 2026-07-16 (`39f2543`):** the `fast-fact` spoken answer-leak (`scaffoldingLevels.level3` interpolated `{{correctAnswer}}` then said "try again") is FIXED — level3 rewritten answer-free in `catalog/core.ts`; Tier-1 audit re-run confirms the `answer-leak-in-scaffold` finding cleared (fast-fact HIGH→WARN; only a pre-existing `indirect-script` level2 copy nit remains). `correctAnswer` retained in taskDescription/RUNTIME STATE for tutor-reference (allowed). This was the single audibly-harmful SP-27 defect; the rest of the stream stays parked. | 07-16 |
| Primitive contracts | `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` | **7 contracts on disk** (newest: counting-board 2026-07-20 via reader-fit #13; ten-frame 2026-07-16 via #12; media-player 2026-07-16 via #9a Step 1 — the CONFLICTED one) + **baseline `--check` ×2 PASSED 07-15** (first guard exercise: both COMPATIBLE, 20/20 requirements hold at runtime; ss R8 amended for precision — object window is prompt+tier-conditioned, bin cap is the hard clamp; reports in `qa/primitive-contracts/`). Next = #3 **foundation-explorer** derivation BEFORE the reader-fit #9 shared-PRE-pattern fix pass (its files are already in flight in the working tree), then #2 knowledge-check (before `true_false @ PRE` lands) | 07-15 |
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
