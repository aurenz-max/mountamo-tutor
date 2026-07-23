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
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder candidates (from handoff): `cvc_reading` (decodable only, vowel-banded), `sight_word` (irregular high-frequency), `word_reading_review` (mixed spaced set). Menu + scope machinery already support all three; catalog/backend currently carry the single `read_word` (β 2.5). |
| 2 | `/add-tutoring-scaffold` | L2 tutored | SHARED DI-family item — do not re-solve per pack: lesson-mode connect (shared session opened with `manual_activity` + the DI tutoring block; carry the objective's subskill through `switchPrimitive` instead of the runtime Gemini re-mapper). contextKeys candidates: `word`, `wordType`, `challenges`, per-word outcome. Also shared: `subject_for_domain('di')→LANGUAGE_ARTS` in the retrieval matcher. |
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
