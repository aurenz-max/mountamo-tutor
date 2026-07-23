# HANDOFF — di-word-reading (DI family primitive #2)

**Paste-able prompt for a fresh session.** Queue item: `qa/di/BACKLOG.md` item 2.
Executor: **bench probe → `/primitive`**. Everything below is the scope; the
skill runs the mechanics.

---

## 0. READ FIRST — what this is NOT

- **NOT an edit to `gemini-di-letter-sounds.ts`, `DiLetterSounds.tsx`, or
  `diLetterSoundsScript.ts`.** Those three files are FROZEN — they belong to the
  di-letter-sounds pack (L0 verified 2026-07-21, HUMAN-CHECKS #36). Contract-first
  rule: never edit a shipped pack to serve a new skill. di-word-reading is a
  **separate content pack over the same committed engine** — its own component,
  script, and generator, registered alongside letter-sounds.
- **NOT a new engine or launch surface.** The engine stack (`useJudgedSpeechLoop`
  → `judgedLoopModel` + `useLiveVoiceTurns`) is committed and generic. You add a
  pack; you touch NO `hooks/` file. Entry is the normal manifest/lesson path —
  catalog entry + eval mode, no new page/endpoint (lesson-entry principle).
- **NOT letter sounds.** The response class is a WHOLE SPOKEN WORD (blend-and-read),
  not a held phoneme. That is a NEW benched class → **gate 1 applies (bench first).**

## 1. GATE — do not write primitive files until the bench probe passes

Standing gate 1 (`qa/di/BACKLOG.md`): a new spoken-response class benches BEFORE
any primitive wiring. The bench set is already WIRED (2026-07-21):
`WORD_READING_PROBE_ITEMS` (10: sam·mat·pig·dog·sun·red·cup + sight the·see·go,
near-neighbours matt/son/read/sea left in to stress over-affirmation) + a
**Letter sounds ⇄ Word reading** toggle in `di-bench/DirectInstructionBench.tsx`.

**Run HUMAN-CHECKS #41 first** (Dev tools → `di-bench` → toggle to Word reading →
mic sitting). The gate:
- Judge reliable on lone words at K pace → proceed to `/primitive`.
- Over-affirms near-neighbours (reads "matt" as "mat", "son" as "sun") → STOP,
  log the failure class in the BACKLOG, and resolve the judging contract
  (tighter "sound it out THEN say it fast" model, aliases pruned) before building.

Whole words are usually *easier* for ASR than isolated phonemes, so this may pass
cleanly — but the in-band audio judge, not the transcript, is still the authority
(same architecture thesis as letter-sounds). Near-neighbour over-affirmation is
the one real risk; that is exactly what #41 stresses.

## 2. Scope of the primitive (once the gate is green)

**What it teaches:** DISTAR word reading — "What word?" over decodable CVC words
and high-frequency sight words. The child SEES a printed word and READS it aloud
(blend-and-say-fast for CVC; whole-word recall for sight words). The Live tutor
models → guides → tests → judges the spoken word in-band.

**Core L0 task identity (single mode — this is a birth, not a ladder):**
`read_word` — read one printed word aloud. Ladder candidates for a LATER
`/add-eval-modes` (do NOT build now): `cvc_reading` (decodable only) /
`sight_word` (irregular high-frequency) / `word_reading_review` (mixed spaced
set). Birth ships ONE mode; the birth cert queues the rest.

### Files to create (mirror the di-letter-sounds pack exactly)

| File | Role | Mirrors |
|---|---|---|
| `primitives/visual-primitives/direct-instruction/DiWordReading.tsx` | component: DI progression + printed-word display + evaluation; consumes `useJudgedSpeechLoop` | `DiLetterSounds.tsx` |
| `primitives/visual-primitives/direct-instruction/diWordReadingScript.ts` | HAND-AUTHORED cues + in-band judging contract + `DI_WORD_READING_TUTORING`; exports `DiWordReadingChallenge`/`...Type` | `diLetterSoundsScript.ts` |
| `service/direct-instruction/gemini-di-word-reading.ts` | **NEW** Fork-A menu-scoped generator (see §3) | `gemini-di-letter-sounds.ts` |

### Files to APPEND to (never rewrite; add one entry each)

| File | Add |
|---|---|
| `service/manifest/catalog/di.ts` | a second `ComponentDefinition` in `DI_CATALOG` for `di-word-reading` (leave di-letter-sounds untouched) |
| `service/registry/generators/diGenerators.ts` | a `registerGenerator('di-word-reading', …)` block below the letter-sounds one |
| `evaluation/types.ts` | `DiWordReadingMetrics` type |
| `evaluation/index.ts` | register the metrics/primitive |
| `config/primitiveRegistry.tsx` | register `DiWordReading` component |
| `components/DirectInstructionPrimitivesTester.tsx` | add a primitive picker (letter-sounds / word-reading) so the existing `direct-instruction-tester` panel drives both — do NOT clone a whole new tester |
| `backend/app/services/calibration/problem_type_registry.py` | β entry `"di-word-reading"` (mirror the letter-sounds β mapping) |

## 3. Generator discipline (Fork A — the settled DI pattern)

Copy the SHAPE of `gemini-di-letter-sounds.ts`:
- A curated **word menu owned in code** — CVC words grouped by vowel + a sight-word
  set. Each entry: `{ word, type: 'cvc'|'sight', graphemes?: string[] (for the
  sound-out model), asrAliases: string[] }`. Reuse word-workout's
  `resolveScopedVowels` family for the CVC vowel/pattern scoping.
- Gemini emits ONLY a wrapper: `{ title, description, targetWords[] }` where
  `targetWords` is an `enum` of the menu. Gemini SELECTS which words the objective
  is about (its phonics pattern / sight-word list); code attaches graphemes,
  aliases, challengeType. **No `DEFAULT_ITEMS` in the component; no per-item content
  from the LLM** (flash-lite drops nested arrays — memory
  `flash-lite-drops-nested-array-under-emoji-ask`).
- Same fallback ladder: model selection → scan objective text for menu words →
  starter set. Same `resolveEvalModes` call for the (eventual) mode router; at L0
  with one mode it resolves to `read_word`.

## 4. PEDAGOGY — the answer-leak trap that DIFFERS from letter-sounds

⚠️ **In letter-sounds the emoji (🌙 for m) is a keyword SUPPORT — safe, because the
answer is the SOUND, not "moon." In WORD READING the answer IS the printed word, so
an emoji beside "dog" HANDS the child the answer (rule #1 violation).**

- Display the **printed word only** — decoding print IS the skill. No picture, no
  audio pre-cue of the word before the child reads.
- An emoji/picture may appear ONLY as post-affirmation reward (after a correct
  read), never before. Sight words with no picture just affirm.
- Model phase for CVC = "My turn. I'll sound it out: sss-aaa-mmm… *sam*. Your turn.
  What word?" Sight words = "My turn. This word is *the*. Your turn. What word?"
  (irregular — recalled, not sounded out). Put both branches in the script.

## 5. Standing gates (every DI primitive — verify + note in birth cert)

1. **Bench-first** — §1 above (HUMAN-CHECKS #41). Blocking.
2. **Sentinel-collision** — engine defaults are affirm `"Yes"` / correct
   `"My turn"`. Re-verify NO word-reading script line opens with either. (Likely
   clean, same as letter-sounds — but word tutors sometimes open "Yes! …"; keep
   affirmations to the sentinel only.)
3. **Correction-opener directive** — the tutoring block must remind that EVERY
   correction begins "My turn:" (engine-gate run: the model dropped it on a
   re-correction).
4. **Standard lifecycle** — `/primitive` L0 birth + `/curriculum-fit` (the core
   mode needs a curriculum home — expect a K/G1 decodable-CVC or sight-word
   subskill; the GK/G1 phonics band is the starved frontier) + `/eval-test` ×3
   (named-word objective honored; generic → CVC starter spread; sight-word
   objective → sight set). Open-mic doctrine: no force-mutes from the primitive.

## 6. Verification (Verification Doctrine — runtime, not tsc-only)

- `cd my-tutoring-app && ./node_modules/.bin/tsc --noEmit` → 0 NEW vs baseline;
  `npm run typecheck:lumina` → 0.
- `/eval-test di-word-reading` ×3 (generator honors the objective's word scope).
- **Live loop through the primitive** = the real gate (the whole primitive IS the
  live loop; tsc/eval-test only exercise the generator — same as #36). Drive it
  via the `direct-instruction-tester` picker with a real mic; confirm model→guide→
  test→judge, affirm-advances / correct-re-elicits / 2-cap move-on, the printed
  word (no picture) displays, recap + `[DI eval]` submits, full data loop fires
  (curriculum resolve → score → competency/calibration/mastery/XP). File a NEW
  HUMAN-CHECKS row for it (like #36). Try to trigger a near-neighbour
  over-affirmation live.

## 7. Known follow-ups to CARRY (don't silently inherit letter-sounds' gaps)

- **Lesson-mode connection** — like di-letter-sounds, the pack will self-connect
  Live only from the standalone tester; a real lesson needs the shared session
  opened with `manual_activity` + the DI tutoring block, and the objective's
  subskill carried through `switchPrimitive` (else the runtime Gemini mapper
  re-derives it — di-letter-sounds' 07-21 run landed on CVC-decode LA001-01-a).
  This is the shared DI `/add-tutoring-scaffold` item — reference it, don't
  re-solve it here.
- **`subject_for_domain('di') → LANGUAGE_ARTS`** in the retrieval matcher (shared
  DI family follow-up; lets DI primitives curriculum-probe without `--domain`).

## 8. When done — close the slice (whoever closes work updates the queues)

- `qa/di/BACKLOG.md` item 2 → Done, with the birth-cert path + live-loop evidence.
- `WORKSTREAMS.md` DI stream → "Now" advances to item 3 di-math-facts (its own
  bench probe, sentinel-collision care: "Yes" collides with math-tutor affirmations).
- New HUMAN-CHECKS row struck once the live loop passes.
- Birth cert + 6-layer follow-up queue at `qa/eval-reports/di-word-reading-birth.md`.
- `/ship` the pack as its own slice (shared QA docs in a separate slice).
