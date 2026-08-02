# Birth Certificate — di-math-facts (2026-07-24)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core mode.
Third Direct Instruction family pack (after di-letter-sounds, di-word-reading);
separate content pack over the committed judged-loop engine — sibling pack files
untouched, NO hooks/ change.

- Core task identity: `answer_fact` (see one printed addition fact, say the answer
  as a number word; modeled → guided → tested, judged in-band from audio)
- Generator fork: **A — pool service** (`gemini-di-math-facts.ts`): code owns the
  fact pool, number words, and ASR aliases; Gemini emits ONLY the wrapper
  (title/description/factScope hint). Scope code-enforced from objective text
  (named facts → make-10 → doubles → within-N → grade default K=5/G1=10).
- Cue channel: DI cue tags `[DI_ITEM]` / `[DI_MOVE_ON]` / `[DI_COMPLETE]` via the
  judged-loop engine (NOT useLuminaAI sendText — the DI family's cue path). Script
  hand-authored in `diMathFactsScript.ts`; wording is BENCH-PROVEN (probe sitting
  2026-07-24, `qa/di-bench/run-2026-07-24-math-facts-probe.md`). Sentinels =
  engine defaults ("Yes"/"My turn"), probe-verified collision-safe.
- Tutoring block: `DI_MATH_FACTS_TUTORING` ships at birth from the script file
  (family's justified L0 departure — the generic tutor cannot hold the judging
  contract). Catalog `tutoring:` move is this pack's L2.
- Fluency signal: per-fact `responseMs` captured silently from the engine's
  attempt timing → `meanResponseMs` metric. NO visible timer (no-timer ruling).
- Answer-leak audit: stage shows the printed problem ONLY; completed equation
  ("2 + 1 = 3") renders post-affirmation only; recap shows equations only for
  affirmed facts (missed facts recap without the sum); generator leak-guard
  rejects any Gemini title/description containing a digit or number word;
  kicker text ("say the answer") never references the answer.
- Design gate (Phase 2): manipulation — pass: spoken production IS the
  interaction (open mic, no buttons between child and skill) / simulation —
  chosen exception per DI family doctrine: the living element is the judged
  dialogue with the Live tutor / production — pass: pure spoken production, no
  options / timer — pass: silent capture only / layout-leak — pass: sum gated
  behind affirmation everywhere.
- Curriculum home: **MATCH ×2** — K OPS001-03 "Fluently add and subtract within
  5" (0.785, 5/5 coherent); G1 OPS001-01 "Addition within 10" (0.830, 5/5).
  Load-bearing sibling fix: `subject_for_primitive` per-primitive override
  (di-math-facts → MATHEMATICS) in `curriculum_retrieval_service.py` +
  `curriculum_mapping_service.py` + `submission_service.py` — without it the DI
  domain default (LANGUAGE_ARTS) would have mis-scoped retrieval.
  Report: `qa/curriculum-fit/di-math-facts-2026-07-24.md`.
- QA: real-Gemini eval-test **PASS 6/6** across the scope matrix (within-5 /
  K-generic / make-ten / doubles / named facts / within-10 @ G1), verified
  programmatically (all 30 challenges recomputed). G1/G4/G5 clean, no fixes
  needed. Report: `qa/eval-reports/di-math-facts-2026-07-24.md`.
- **Live loop NOT yet driven — HUMAN-CHECKS #48 is the real L0 gate.** That
  sitting carries three named stresses: (a) the fact CORRECTION branch
  ("My turn: …") has NEVER been heard live (bench sitting was all-correct);
  (b) homophone/over-affirmation stress (one/won, two/too, four/for,
  eight/ate) — carried from #46; (c) the submit's data loop must attribute to
  MATHEMATICS (OPS001 family), exercising the new subject override at runtime.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder candidates: `counting_next` (say the number after N — counting sequence), `fact_review` (cumulative spaced mix of taught facts), `subtraction_fact` (within 10); G3 variant `multiplication_fact`. All answers remain number words — the BENCHED response class — so no new bench sitting is required for these rungs (standing gate 1 already satisfied). Mixed path (SP-21) applies once 2+ modes exist. |
| ✓ | `/add-tutoring-scaffold` | L2 tutored | **DONE 2026-07-25** — block moved into `catalog/di.ts` `tutoring:`; all four contextKeys (challengeType/display/problem/facts) shipped and probe-verified on two modes; all three candidate struggles shipped (+ a fourth: repeats the problem back); gate-3 correction-opener directive preserved verbatim; NUMBER WORDS gained the #48 homophone clause. `/tutor-test` 0 HIGH. Report: `qa/tutor-reports/di-math-facts-2026-07-25.md`. |
| ✓ | `/add-support-tiers` | L3 tiered | **DONE 2026-08-01** — exactly the fade specified here (easy = model+guide+test / medium = model+test / hard = cold test-only), composed in the SCRIPT (`leadInFor` + `coldAnswerGuard`), never a UI flag; `supportTier` contextKey + catalog audit (level 1 needed no rewording — it repeats the QUESTION, not the fact); tester gained the family tier selector. 14/14 new tests (non-vacuity: 5 fail on revert), 1041/1041 full, typecheck:lumina 0, 3/3 real-pipeline probes (hard pinned / medium blended / absent = pre-L3 byte-compatible). Live `hard` ear-check → HUMAN-CHECKS #50(d). Report: `qa/eval-reports/di-math-facts-support-tiers-2026-08-01.md`. |
| 4 | `/add-structural-difficulty` | L4 shaped | (requires L3) Structural axis: operand structure — within 5 → within 10 (crossing-five) → within 20 (crossing-ten); later a missing-addend shape ("2 + ? is 5") as a separate identity, not a tier. |
| 5 | `/add-sound` | L5 polished | Minimal by design — the modality is already audio-native (tutor voice). Candidates: soft equation-complete chime on affirm; recap fanfare. Nothing during listening (mic open). |
| — | `/add-voice-control` | L5 | N/A — the primitive IS voice-native (open-mic judged loop is the core interaction, not an added control layer). |
| ✓ | `/eval-test di-math-facts` | QA loop | Run after EVERY layer lands (`/eval-fix` for findings) — a layer only counts when eval-test passes at that layer. |

## Misconception Loop — scope ruling (2026-07-25, family-wide)

`misconceptionScope: 'primitive'` (declared in `catalog/di.ts`). PRD §5 rev-2
reserves `'skill'` for content-generic delivery vehicles; this pack is a
hand-authored DISTAR script for ONE response class, so the interaction model IS
the concept. Primitive scope also survives the standalone tester, where the
subskill is unreliable and `'skill'` would gate those runs out entirely.

The pack's misses now ship a **Tier-A `DiagnosisEvidence` packet** (the child's
transcript + the tutor's own judging sentence + earlier misses as
`priorAttempts`) as `submitResult`'s 6th arg. Because primitive scope keys on
the pack alone, each packet names its TASK IDENTITY inside `challengeSummary`
so the distilled sentence stays self-limiting across eval modes.

Gate: `/misconception-test di-math-facts` 2026-07-25 — Probe D 10/10,
Probe R CLOSED, **Probe G NOT-WIRED** (no DI generator consumes
`remediationFocus`; that is DI BACKLOG item 1, `/add-misconception-loop`).
Report: `qa/misconception/di-math-facts-2026-07-25.md`.
