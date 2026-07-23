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
- **di-letter-sounds L2 tutoring scaffold + FAMILY lesson-mode wiring (2026-07-23,
  birth-cert follow-up #2 struck).** DI tutoring block moved from
  `diLetterSoundsScript.ts` into `catalog/di.ts` `tutoring:` (single source of
  truth; +contextKeys challengeType/letter/keyword/letters, +3 commonStruggles
  from birth QA; sentinel-collision re-checked on the new copy). The two carried
  L0 gaps CLOSED for the whole family: (a) **lesson-mode connect** — new
  `ComponentDefinition.audioInput` (types.ts); both DI packs declare
  `{ manual_activity: true }`; `connectLesson` scans the manifest and opens the
  shared Gemini session with it (audio config is connect-time-fixed);
  `switch_primitive` carries `tutoring` + `audio_input`; standalone `connect`
  falls back to the catalog for both — DiLetterSounds dropped its explicit
  passes. Subskill carry comes free in lesson mode (ManifestOrderRenderer
  injection → usePrimitiveEvaluation), ending the 07-21 Gemini re-map watch-item.
  (b) **`subject_for_domain('di') → LANGUAGE_ARTS`** in the retrieval matcher
  (REVISIT at di-math-facts birth — family will span subjects). Generator grew a
  flat `letters` summary field so the auth-time prompt resolves; component syncs
  per-item RUNTIME STATE via silent `updateContext`. Verified: typecheck:lumina 0;
  tutor-test Tier 1 PASS (0 HIGH; 2 WARNs structural to the engine pattern) +
  Tier 2 probe PASS (0 `(not set)`): `qa/tutor-reports/di-letter-sounds-2026-07-23.md`.
  **Live lesson-mode loop NOT driven → HUMAN-CHECKS #45** (incl. the named
  trade-off: a DI-bearing lesson runs manual VAD session-wide, so non-DI chat
  turns in a MIXED lesson won't open). di-word-reading's own catalog `tutoring:`
  move stays its L2 item; the shared wiring is already in place for it.
- **#2 di-word-reading — BORN L0 (2026-07-22).** Second DI pack over the
  committed engine — separate content pack, letter-sounds files untouched, NO
  hooks/ change. `DiWordReading.tsx` + hand-authored `diWordReadingScript.ts`
  (DISTAR two-branch cues: CVC sound-out "sss-aaa-mmm… sam" / sight whole-word;
  STRICT near-neighbour judging contract) + `gemini-di-word-reading.ts` (Fork A:
  30-CVC-by-vowel + 8-sight menu in code, Gemini enum-selects words,
  graphemes/emoji/aliases attached in code, vowel + sight scope CODE-enforced) +
  registrations (catalog/di.ts single `read_word` mode β2.5, diGenerators,
  metrics union, primitiveRegistry, ComponentId, backend problem_type_registry)
  + direct-instruction-tester grew a **Letter Sounds ⇄ Word Reading primitive
  picker** (no cloned tester). Answer-leak rule inverted vs letter-sounds
  honored: printed word ONLY before the read; emoji = post-affirmation reward.
  Sentinel note: handoff §4's classic "My turn." model opener re-worded to
  "I'll sound it out…" (collision with the correction sentinel). **Standing
  gate 1 (bench sitting #41) WAIVED by user ruling 2026-07-22** — near-neighbour
  stress folded into the live-loop check. typecheck:lumina 0; eval-test PASS ×4
  (named words honored / generic → CVC spread + 1 sight / sight-scoped → sight
  set only / "short a" → hard vowel scope). Curriculum-fit: **MATCH @ G1
  LA001-01** (0.800; LA001-07 Sight Words in top-5); K diffuse-abstain =
  vote-splitting across sibling CVC families (top-1 0.819 IS the right
  concept), not a gap. Birth cert + follow-up queue:
  `qa/eval-reports/di-word-reading-birth.md`; eval report
  `qa/eval-reports/di-word-reading-2026-07-22.md`; fit report
  `qa/curriculum-fit/di-word-reading-2026-07-22.md`. **Live loop NOT yet
  driven — HUMAN-CHECKS #43 is the real L0 gate** (mirror of #36); shared
  lesson-mode connect + `subject_for_domain('di')` gaps carried to the family
  `/add-tutoring-scaffold` item, not re-solved.
- **#1 di-letter-sounds — BORN L0 (2026-07-20).** First DI primitive, first
  engine consumer. New family: `primitives/visual-primitives/direct-instruction/`
  (`DiLetterSounds.tsx` + hand-authored `diLetterSoundsScript.ts`), `catalog/di.ts`,
  `service/direct-instruction/gemini-di-letter-sounds.ts` (Fork A menu-scoped:
  curated continuant + short-vowel menu; Gemini picks target letters from the
  objective, code attaches spoken/keyword/emoji), `registry/generators/diGenerators.ts`.
  Standing gates met: sentinel-collision ✓ (engine defaults, no line opens with a
  sentinel), correction re-model/opener directive ✓ (in tutoring block + script).
  typecheck:lumina PASS; eval-test PASS ×3 (topic fidelity: named letters honored,
  generic → starter spread, vowels → keyword elicitation). Curriculum-fit: MATCH
  (K LANGUAGE_ARTS Letter-Sound Correspondence, top-1 0.788 — the starved GK band).
  Birth cert + follow-up queue: `qa/eval-reports/di-letter-sounds-birth.md`. **Live
  loop VERIFIED end-to-end 2026-07-21 (HUMAN-CHECKS #36 struck)** — user mic run PASS
  through the primitive; full data loop fired on submit (curriculum resolve → score
  9.2 → competency/calibration/mastery/+38 XP). **L0 fully runtime-verified; ladder
  UNBLOCKED (`/add-eval-modes` next).** Two known L0 gaps carried to
  `/add-tutoring-scaffold`: lesson-mode connect needs `manual_activity`+DI-tutoring
  through the shared session (the 07-21 run confirmed the standalone tester re-maps
  the subskill via Gemini — landed on CVC-decode LA001-01-a, not the letter-sound
  home; the lesson path must carry the objective's subskill instead); add
  `subject_for_domain('di')→LANGUAGE_ARTS` to the retrieval matcher.
- Engine stack steps 1–3 groundwork (bench POC → live-judged pivot → open-mic →
  extraction 1 `4af21b6` → engine `bc2d303`), runs 2026-07-19..21 all PASS.
  History lives in WORKSTREAMS (DI stream) + `qa/di-bench/` reports.
