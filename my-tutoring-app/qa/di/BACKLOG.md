# Direct Instruction — Primitive Family Backlog

Working queue for the DI primitive family. Top = next. Graduated 2026-07-20 from
`qa/HANDOFF-di-bench-2026-07-16.md` per its own gate ("graduate to a BACKLOG file
if the bench passes") — the bench passed: open-mic run, probe run, hook-parity
run, engine-gate run all PASS (`qa/di-bench/run-2026-07-*.md`). User call
2026-07-20: DI becomes a **new primitive family** alongside core/math/literacy,
first set custom-made.

## Architecture (settled — do not re-litigate per item)

The engine stack is committed and runtime-verified; primitives are CONTENT PACKS
over it:

- `hooks/voiceTurnMachine.ts` + `hooks/useLiveVoiceTurns.ts` — open-mic turn
  authority (DI-2 dual barge-in threshold). Generic.
- `hooks/judgedLoopModel.ts` + `hooks/useJudgedSpeechLoop.ts` — live-judged
  call-response loop (voice-anchored attempts DI-1, arming DI-3,
  sentence-scoped sentinel verdicts, resync). Generic; sentinels parameterized.
- The Live tutor judges the AUDIO in-band per the cue's judging contract; the
  sentinel scan only reads which branch it took. Word-matching is the reporting
  channel, not the judge (proven: /s/ affirmed from audio over a "Shh." ASR).
- Bench (`di-bench` home card 🎯) stays the modality's measurement harness —
  every new response class benches there BEFORE a primitive wires it.

**"Custom-made" means:** cue scripts, judging contracts, sentinels, and
progression policy are HAND-AUTHORED per primitive (exact wording is the
pedagogy — DISTAR discipline). Item CONTENT is generator-scoped per objective:
curated speakable/picturable item menus injected into the prompt, attachments
made in code (rhyme-studio K pattern; scope-context contract). No
`DEFAULT_ITEMS`-style hardcoded content ships in a primitive.

**Registration:** new `primitives/direct-instruction/` family dir + new
`service/manifest/catalog/di.ts` catalog section. Entry through the normal
manifest/lesson path — catalog entries + eval modes, NO new launch surface
(lesson-entry principle). Response time captured silently; no visible timers.

## Standing gates (every DI primitive)

1. **Bench-first per response class:** a new class of expected spoken response
   (number words, blends, sight words…) gets a ~30-min bench sitting with a
   hand-rolled item list before any primitive wiring. Letter NAMES remain
   BLOCKED (LetterSpotter homophone ruling — needs a Voice Studio bench first).
2. **Sentinel-collision check:** the script contract ("never begin any other
   sentence with <affirm>/<correct>") must be re-verified per domain script —
   pick collision-free openers where the domain phrasing fights it (math tutors
   want to say "Yes!"). Engine sentinels are configurable per pack.
3. **Correction-opener directive:** the tutoring block must remind that EVERY
   correction begins with the correct sentinel (engine-gate run: model dropped
   "My turn:" on a re-correction).
4. Standard lifecycle: `/primitive` L0 birth + `/curriculum-fit` (every mode
   needs a curriculum home) + `/eval-test`; `/tutor-test` probe for the
   directive block. Open-mic doctrine holds: no force-mutes from the primitive.

## Queue

### 1. di-letter-sounds — first primitive (the benched class)
Continuous letter sounds + keyword elicitation — exactly what four bench runs
verified. Port the script SHAPE from `di-bench/diScript.ts` (model/guide/test/
verify/correction lines, judging contract); replace `DEFAULT_ITEMS` with a
generator that scopes a curated letter-sound menu to the objective (target
letters from the subskill; emoji/keyword attached in code). Curriculum home:
K phonics — the STARVED GK band (GK LA graph repair memory: phonics
under-served), so `/curriculum-fit` should find real unmet demand. Scope
exclusions: letter names (blocked), digraphs/blends (bench first, later item).
Executor: `/primitive` (L0) with the engine as the interaction core.

### 2. di-word-reading — CVC / sight words
"What word?" over decodable CVC + high-frequency words ("sam" was bench item 4,
affirmed). Menu-scoped to the phonics pattern in the objective (reuse the CVC
scope machinery from word-workout's `resolveScopedVowels` family). Bench probe
first: a 10-item word list sitting to confirm judge reliability on single words
at K pace. Executor: bench probe → `/primitive`.

### 3. di-math-facts — counting + addition facts (K-1 first)
"What is 2 plus 1?" call-response over fact families; multiplication is the
G3 variant later. GATED on the math-facts bench probe (new response class:
number words — likely ASR-easy, unbenched). Silent response-time capture is the
fluency signal (no-timer ruling). Sentinel choice needs care (gate 2: "Yes"
collides with natural math-tutor affirmations — consider distinct openers).
Executor: bench probe → `/primitive`.

## Watch-items (from the engine-gate run)
- Resync + no-verdict timeout are unit-covered but not yet observed live —
  first primitive's live runs should try to trigger both.
- Echo blip class: floors readout margin was ~6× in the hook-parity run; keep
  the floors readout available in primitive dev builds.

## Done
- Engine stack steps 1–3 groundwork (bench POC → live-judged pivot → open-mic →
  extraction 1 `4af21b6` → engine `bc2d303`), runs 2026-07-19..21 all PASS.
  History lives in WORKSTREAMS (DI stream) + `qa/di-bench/` reports.
