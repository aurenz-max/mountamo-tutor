# Birth Certificate — di-letter-sounds (2026-07-20)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core
mode. First primitive of the **Direct Instruction (DI) family** — a CONTENT PACK
over the committed judged-loop engine (`useJudgedSpeechLoop` → `judgedLoopModel`
+ `useLiveVoiceTurns`). The Live tutor IS the interaction surface.

- Core task identity: `letter_sound` (continuous letter sounds + short-vowel keyword elicitation)
- Generator fork: **A (menu-scoped pool service)** — Gemini selects target letters from a curated
  menu; spoken/keyword/emoji/elicitation/aliases attached in code (rhyme-studio K pattern)
- Family: new `primitives/visual-primitives/direct-instruction/` + new `catalog/di.ts` + new
  `service/direct-instruction/` + new `registry/generators/diGenerators.ts`
- Script: **hand-authored** `diLetterSoundsScript.ts` (model/guide/test/verify/correction cues +
  in-band judging contract + `DI_LETTER_SOUNDS_TUTORING`). Exact wording IS the pedagogy (DISTAR).
  Sentinels = engine defaults (affirm "Yes", correct "My turn") — collision-checked: no
  model/guide/test line opens with either sentinel. ✓ standing gate 2 & 3.
- sendText/cue tags wired: `[DI_ITEM]`, `[DI_MOVE_ON]`, `[DI_COMPLETE]` (via the engine's cue queue)
- Answer-leak audit: grapheme shown, SOUND produced — DISTAR model→guide→test means the tutor
  models the sound first, so the display is not a leak (the grapheme→phoneme mapping IS the skill).
- Curriculum home: **MATCH (healthy)** — K LANGUAGE_ARTS "Letter-Sound Correspondence" (top-1 0.788).
  Probe reads "diffuse" only because K phonics is a dense adjacent-skill cluster this primitive
  serves broadly. Report: `qa/curriculum-fit/di-letter-sounds-2026-07-20.md`.
- eval-test: PASS ×3 (objective-named letters honored exactly; generic → starter spread; vowels →
  keyword elicitation). Report: `qa/eval-reports/di-letter-sounds-2026-07-20.md`.
- typecheck:lumina: PASS (0 errors on the active surface).

## Design gate (Phase 2)
- **Direct manipulation:** pass — the student PRODUCES the sound with their voice (the learning
  object itself); the mic orb is the only control and it captures production, not selection.
- **Living simulation:** pass — the Live tutor call-response IS the explanation (model→guide→test→
  judge in-band); the component owns progression, Gemini owns the words.
- **Production over recognition:** pass — spoken production, judged from audio; no MC options.
- **No visible timer:** pass — response time captured silently in metrics; no countdown.
- **No answer-leak by layout:** pass — see audit above (DISTAR model precedes the test).

## Known L0 limitations (not defects — layered/followed up)
- **Lesson-mode connection:** self-connects Live only from an idle/standalone context (the tester).
  A real lesson's shared session must be opened with `manual_activity` + the DI tutoring block;
  `switchPrimitive` does not carry `audio_input` today. Verify via the tester until wired.
  (Follow-up below.)
- Live loop is UNVERIFIED end-to-end through this primitive → **HUMAN-CHECKS #36**. Engine itself
  has 4 bench runs PASS.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder candidates (all benched-class-safe): keep `letter_sound` as the base; a `letter_sound_review`/mixed-set spaced-review mode; a `first_sound_in_word` mode (isolate the onset of a spoken word). Do NOT add letter NAMES (blocked) or blends/digraphs (bench first). |
| 2 | `/add-tutoring-scaffold` | L2 tutored | The DI tutoring block already ships in the script (family exception). This layer instead moves it into the catalog `tutoring:` block + adds `contextKeys` (letters, currentLetter, keyword) + commonStruggles (adds /uh/ to a continuant; says the letter NAME; silent), AND wires the lesson-mode connection gap (open the shared session with `manual_activity` + DI tutoring via catalog; carry `audio_input` through `switchPrimitive`). |
| 3 | `/add-support-tiers` | L3 tiered | Withdrawable scaffolding intrinsic to the interaction: model repetitions (2→1→0), guide phase present/absent, keyword-picture shown/hidden, corrections cap (2→1). |
| 4 | `/add-structural-difficulty` | L4 shaped | (requires L3) Structural lever = item-set composition: continuants-only → +short vowels → visually/aurally confusable contrasts (m/n, f/v) in one set. |
| 5 | `/add-sound` | L5 polished | Candidate sound points: earcon on the tutor's "your turn" cue, a soft chime on affirm, a gentle re-try tone on correction. Keep quiet-by-default; no fluency timer sounds. |
| 6 | `/add-voice-control` | L5 polished | Already voice-native (open-mic production is the core). This layer only formalizes the answer/choice doctrine if a choice variant appears; push-to-talk fallback for noisy rooms. Doctrine ref: `/add-spoken-judge`. |
| ✓ | `/eval-test di-letter-sounds` | QA loop | Re-run after EVERY layer; `/tutor-test di-letter-sounds` for the directive block; the live loop gates on HUMAN-CHECKS #36 each layer. |

## Family follow-ups (DI backlog, not this primitive)
- Add `subject_for_domain('di') → LANGUAGE_ARTS` in the retrieval matcher so DI primitives
  probe/attribute without the `--domain literacy` workaround.
- Next DI items per `qa/di/BACKLOG.md`: (2) di-word-reading (bench probe first), (3) di-math-facts
  (number-words bench probe + sentinel-collision care).
