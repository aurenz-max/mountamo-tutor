# Birth Certificate — di-word-reading (2026-07-22)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core mode.
DI family primitive #2: a separate content pack over the committed judged-loop
engine (`useJudgedSpeechLoop` → `judgedLoopModel` + `useLiveVoiceTurns`); NO
hooks/ file touched; di-letter-sounds pack files FROZEN and untouched. Built
from `qa/di/HANDOFF-di-word-reading.md`.

- Core task identity: `read_word` — read one printed word aloud (blend-and-read
  for decodable CVC; whole-word recall for sight words).
- Generator fork: A (pool service) — curated word menu owned in code (30 CVC
  across all five short vowels + 8 sight words); Gemini emits only
  `{title, description, targetWords[]}` with `targetWords` enum-locked to the
  menu; graphemes/emoji/wordType/asrAliases attached in code. Vowel scope
  (`resolveScopedVowels` mirror) and sight scope are code-enforced over the
  model's selection. Fallback ladder: selection → objective-text scan → scoped
  pool → starter set (sam, pig, sun, the).
- Cue script: HAND-AUTHORED `diWordReadingScript.ts` — DISTAR model→guide→test
  with two branches (CVC sound-out "sss-aaa-mmm… sam" / sight whole-word);
  in-band judging contract written STRICT on near-neighbours (sun/son,
  red/read); `DI_WORD_READING_TUTORING` block ships at birth (DI family
  departure: the judging contract IS the mechanism).
- Tutor cue tags wired: [DI_ITEM], [DI_MOVE_ON], [DI_COMPLETE] (judged-loop
  shape, not the generic sendText tags).
- Answer-leak audit: the answer IS the printed word → stage renders the printed
  word ONLY; no picture/emoji/audio pre-cue before the read (differs from
  letter-sounds, where the emoji is a safe keyword support). Reward emoji only
  post-affirmation + completion recap; sight words carry no emoji (just
  affirm). Generator prompt+schema forbid target words in title/description
  (verified across 4 eval-test runs).
- Design gate (Phase 2):
  1. Direct manipulation — pass: the learning object is the printed word and
     the student's own spoken read of it (open-mic production); no proxy
     controls.
  2. Living simulation — chosen exception (DI family doctrine): the Live tutor
     exchange IS the interaction surface; the engine loop is the "simulation".
  3. Production over recognition — pass: pure spoken production, no options.
  4. No visible timers — pass: responseMs captured silently per outcome.
  5. No answer-leak by layout — pass: printed-word-only stage (see audit).
- Standing DI gates:
  1. Bench-first — **WAIVED by user ruling 2026-07-22** (modality validated via
     letter-sounds bench + live loop; bench set stays wired in di-bench).
     Near-neighbour over-affirmation stress DEFERRED to the live-loop human
     check (HUMAN-CHECKS #43). Judging contract written strict to compensate.
  2. Sentinel-collision — ✓ engine defaults (affirm "Yes" / correct "My turn");
     no script line opens with either outside the two branches. NOTE: the
     handoff §4's classic DISTAR model opener "My turn. I'll sound it out…"
     was deliberately re-worded to "I'll sound it out…" — the classic opener
     IS the correction sentinel (same adaptation letter-sounds made).
  3. Correction-opener directive — ✓ in the tutoring block ("EVERY correction
     re-models the word … and begins with 'My turn'") and in every correction
     line (re-model + re-elicit).
  4. Lifecycle — /primitive ✓, /curriculum-fit ✓ (below), /eval-test ✓×4
     (`qa/eval-reports/di-word-reading-2026-07-22.md`). Open-mic doctrine: no
     force-mutes from the primitive.
- Curriculum home: **MATCH @ G1** — LA001-01 "Short and Long Vowel Decoding"
  (0.800, 3/5 coherent; LA001-07 "Sight Words" also top-5). K = ABSTAIN
  (diffuse) but top-1 IS the right concept ("Decode CVC words with Short 'a'"
  @ 0.819) — the K curriculum splits CVC work across sibling families
  (vote-splitting, not a gap). `qa/curriculum-fit/di-word-reading-2026-07-22.md`.
- Verification state: typecheck:lumina 0 errors; tsc — 0 errors in all touched
  files; eval-test 4/4 PASS. **Live loop NOT yet exercised — HUMAN-CHECKS #43
  is the real L0 gate** (same as letter-sounds #36); L0 is not "fully
  runtime-verified" until it's struck.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| ✓ | `/add-eval-modes` | L1 eval-dense | **DONE 2026-08-04** — added `cvc_reading` (β2.0), preserved `read_word` (β2.5), added `sight_word` (β3.0) and `word_reading_review` (β3.5) in catalog + backend. Fork-A single/blend/mixed paths build and interleave the code-owned pools; mixed covers all four identities, review keeps up to two focus anchors then guarantees CVC-family + sight breadth at the default window. 12/12 focused tests; live pinned/blend/mixed sweep PASS. Report: `qa/eval-reports/di-word-reading-evalmodes-2026-08-04.md`. |
| ✓ | `/add-tutoring-scaffold` | L2 tutored | **DONE 2026-08-03** — block moved into `catalog/di.ts` `tutoring:`, the last pack to leave a script-local block. Shipped: `{{challengeType}}`, contextKeys `challengeType`/`word`/`wordType`/`words` (the birth-cert candidates `word` + `wordType`; `challenges` became the generator's flat `words` summary, and per-word outcome was dropped as loop state the tutor already hears), 5 observed `commonStruggles`, component `updateContext` sync, and one new never-preview directive clause (the word list is now visible in RUNTIME STATE). The 5th candidate key `graphemes`/sound-out was dropped by design — absent on every sight word, derived rather than generated, and already in the `[DI_ITEM]` cue verbatim. Cue lines + `correctionLine` untouched. `/tutor-test` Tier 1 **0 HIGH** + Tier 2 × 3 shapes, 0 `(not set)`. The shared lesson-mode wiring this row named was already solved by di-letter-sounds' L2 (07-23) and needed no re-solving. Report: `qa/tutor-reports/di-word-reading-2026-08-03.md`. |
| 3 | `/add-support-tiers` | L3 tiered | Withdrawal candidates intrinsic to the interaction: drop the GUIDE ("Together:") step at higher tiers (model→test only), then drop the sound-out MODEL for taught patterns (cold "What word?" reads — DISTAR's own progression). |
| 4 | `/add-structural-difficulty` | L4 shaped | (requires L3) Structural lever = word structure: CVC → CVCC/CCVC blends → digraphs → multisyllable. **Each new word shape is a NEW spoken-response class → bench (or live-stress) first, per standing gate 1.** |
| 5 | `/add-sound` | L5 polished | Engine owns the audio channel; candidates limited to local earcons on affirm/recap (spoken-cue timing doctrine — cue on first audio frame). |
| 6 | `/add-voice-control` | L5 polished | N/A as a layer — the primitive is voice-native at birth (open mic via the judged-loop engine; LuminaMicListener orb). |
| ✓ | `/eval-test di-word-reading` | QA loop | Run after EVERY layer lands (`/eval-fix` for findings). |

## Carried gaps (inherited knowingly, not silently)

- Lesson-mode connection (see follow-up #2) — standalone tester self-connects;
  a real lesson currently re-derives the subskill via the runtime Gemini
  mapper (letter-sounds' 07-21 run landed on LA001-01-a — which happens to BE
  word-reading's G1 home, but the mechanism is still wrong for this pack's
  objectives).
- `subject_for_domain('di')` — DI packs curriculum-probe only with an explicit
  `--domain literacy`.
- Watch-items from the engine-gate run: resync + no-verdict timeout still not
  observed live; try to trigger both in the #43 sitting.

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
