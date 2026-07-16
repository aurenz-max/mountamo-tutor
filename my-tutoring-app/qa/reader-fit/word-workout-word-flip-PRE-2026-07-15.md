# Reader Fit: word-workout + word-flip @ PRE — 2026-07-15

BACKLOG item **#10** (the K-queue drain). The scope-binding + routing slices were
FIXED + VERIFIED 2026-07-14 (`qa/topic-fidelity/word-workout-word-flip-2026-07-14.md`
— `resolveScopedVowels`/`sanitizeVowelScope` in word-workout; grammar-not-decode
routing lead for word-flip). This slice is the **PRE band audit** that stayed open —
NOT re-touching either of those.

Modes audited: word-workout {real_vs_nonsense, picture_match, word_chains, sentence_reading};
word-flip {plural_s}
Probes: eval-test ✓ (both) · tutor-test --probe ✓ (both) · jsdom ✓ (both) ·
live --lesson --runs 3 ✓ (word-workout)

---

## word-workout — SCAFFOLD-GAP + PRIMITIVE-GAP → **READY @ PRE** (sentence_reading floored)

The K CVC census routes word-workout in **word_chains** (`k-cvc-short-a-2026-07-14`).
Content already scoped correctly (masteredVowels=['a'], 15/15 on-vowel — verified in
the 07-14 fidelity report; re-confirmed here). The **interaction** was the gap.

### Audit A — text census
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Which is a real word?" / "Which picture matches this word?" / "Read each word as it changes" | mode instruction `<p>` | Load-bearing | none (was text-only) | UNCOVERED → **fixed** (hidden at K; tutor voices via ORIENT directive) |
| "Vowels: a" | header badge | Load-bearing (also **leaks the scope**) | — | **fixed** (hidden at K) |
| title / mode badge / "1 / N" counter / progress bar | header chrome | Decorative | — | **fixed** (hidden at K) |
| "Correct! That's a real word!" / "Try again! Sound out both words." | feedback card | Load-bearing (carries correction) | SFX + choice ring/shake | **fixed** (card hidden at K; SFX + ring carry it) |
| CVC words in chains (cat/bat/bad) | chain rows | Load-bearing STIMULUS | shown on screen; child decodes them (that is the task) | COVERED by design (decode-automaticity; not read *for* the child) |
| target-word + emoji options (picture_match) | mode body | picture-primary already | LuminaReadAloud on the word | COVERED |

### Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| real_vs_nonsense | ✓ (new PRE directive: "tap the one that is a REAL word") | ✓ words shown; hearable via LuminaReadAloud | ✓ names the task | ✓ SFX + ring | ✓ scaffold hints eyes-free |
| picture_match | ✓ ("tap the PICTURE that matches") | ✓ word stimulus + emoji options | ✓ | ✓ | ✓ |
| word_chains | ✓ ("read each word out loud… one letter changes") — **live-confirmed 3/3** | ✓ chain shown (decoded, not read for the child) | ✓ | ✓ SFX + celebrate | ✓ |
| sentence_reading | — | — | — | — | — → **WRONG-BAND, floored** |

Before: ORIENT lived only in a component `[ACTIVITY_START]` sendText (droppable under
the lesson one-sentence cap) and the catalog had only a **reactive** PRONUNCIATION
directive. Fixed with a durable catalog **PRE-READER HOW TO PLAY** `aiDirective` that
voices the per-mode play action at Grade K, overriding the cap.

### Audit C — band contract
| Rule | PASS/FAIL (at K, post-fix) | Note |
|---|---|---|
| 1 audio instruction channel | PASS | instruction text hidden; tutor voices it |
| 2 tap = choose, no Check | PASS | real/nonsense + picture = single tap; word_chains = voice/tap-advance; no keyboard, no Check |
| 3 pictures answer surface | PASS (picture_match) / inherent-text (real_vs_nonsense, word_chains) | decode discrimination can't be pictured; voice/tap primary |
| 4 one thing / ≤5 elements | PASS | ≤ a few per screen |
| 5 feedback on the object | PASS | SFX + choice ring/shake; text card hidden |
| 6 no typing / no notation | PASS | none |
| 7 no adult chrome | PASS (component-local) | title/mode badge/**vowel label**/counter/progress hidden; PhaseSummaryPanel → K-stage systemic |
| 8 assessment in mechanics | PASS-ish | decode + tap/say |

**Overall: READY @ PRE** for real_vs_nonsense / picture_match / word_chains;
**sentence_reading = WRONG-BAND at PRE → floored to Grade 1+** (connected-text
decoding is not a K skill — the decodable-reader precedent; band floor added to the
catalog `constraints`).

Fix layers:
- **GENERATOR** (`gemini-word-workout.ts`): `resolvePreReaderGradeKey(ctx)` stamps
  `gradeLevel` into `WordWorkoutData` (both single- and multi-mode returns).
- **COMPONENT** (`WordWorkout.tsx`): `isPreReaderGrade(data.gradeLevel)` band-gate —
  header chrome + vowel label + counter + progress hidden; per-mode instruction
  sentences hidden; text feedback card hidden; PRE `[ACTIVITY_START]` voices the
  per-mode play action, answer-free; real grade threaded into `useLuminaAI`.
- **CATALOG** (`literacy.ts`): PRE-READER HOW TO PLAY `aiDirective` (durable ORIENT
  carrier, per-mode, cap-overriding, answer-free) + `sentence_reading` band-floor note.

---

## word-flip — band decision: **NOT WRONG-BAND** → HONORED core, PRIMITIVE-GAP (chrome) fixed → **READY @ PRE**

**The 07-14 hypothesis was "likely floor to Grade 1+." The audit says otherwise:**
word-flip is a genuine **Kindergarten oral-grammar** skill (regular -s plurals ≈
L.K.1.c "form regular plural nouns orally"), the catalog explicitly claims K
("ESSENTIAL for Kindergarten Language Arts grammar… so pre-readers can play"), and
it is the reader-fit skill's **own PRE reference model** (`SKILL.md:70` — "WordFlip
(self-evident counted-picture frame, voice-first)"). Its interaction core — an
emoji-primary counted-picture frame + open mic (spoken production primary) + tap
chips (receptive net) + auto-advance — is already band-fit. **Flooring it would be
wrong**: it would delete a legitimate K grammar primitive and contradict the skill's
own doctrine. (The plural morpheme is orthographic/phonological — "dog" vs "dogs"
can't be pictured — so the text tap chips are inherent to the task, and the **voice**
path is the pre-reader path.)

The only real gap was **Audit C rule 7 (adult chrome)** — identical to every sibling
in this queue — plus a minor SCAFFOLD-GAP (ORIENT lived only in a component sendText;
the catalog had **no tutoring block** at all).

### Audit C — band contract (at K)
| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 audio instruction | PASS | frame self-evident; ORIENT voiced |
| 2 tap = choose, no Check | PASS | tap chip judges; spoken match auto-advances |
| 3 pictures answer surface | PASS (voice) / inherent-text (tap chips) | morpheme can't be pictured; voice-first |
| 4 one thing / ≤5 elements | PASS | one frame + 3 chips + mic |
| 5 feedback on object | PASS | SFX + chip ring/shake + frame reveal; text card hidden at K |
| 6 no typing / no notation | PASS | none |
| 7 no adult chrome | **was FAIL → fixed** | counter, correct/spoken tally, progress bar, mode badge, voice-toggle, start-screen "Word Flip" badge + voice-consent essay — all hidden at K (start buttons = the consent gesture, kept) |
| 8 assessment in mechanics | PASS | say / tap the plural |

### Audit B — sufficiency (plural_s)
ORIENT ✓ (new catalog **PRE-READER ORIENT** directive: teach the rule with an
example noun that is NOT on screen, then stay silent; overrides the cap; never say
the on-screen plural = leak law) · STIMULUS ✓ (counted picture, no text stimulus) ·
DISAMBIGUATE ✓ (one → many arrow + intro) · FEEDBACK ✓ (SFX + frame reveal) ·
RECOVER ✓ (reveal-on-3-misses + eyes-free scaffold levels). tutor-test --probe:
**pass, 0 findings**, PRE-READER ORIENT renders into the prompt, all contextKeys
resolve `by component`.

**Overall: READY @ PRE (HONORED core; chrome PRIMITIVE-GAP fixed).** NOT floored.

Fix layers:
- **COMPONENT** (`WordFlip.tsx`): `isPreReaderGrade(gradeLevel)` band-gate — header
  (title/mode badge/voice-toggle), counter + correct/spoken tally + progress bar,
  text feedback card, and start-screen badge + voice-consent essay all hidden at K;
  the counted-picture frame, mic, tap chips, and both start buttons remain.
- **CATALOG** (`literacy.ts`): new `tutoring` block with a PRE-READER ORIENT
  `aiDirective` (durable carrier) + eyes-free, answer-free scaffolding levels.

---

## Verification
- tsc: **808** errors (all legacy `WebSocketService.ts`; **0 new** vs the 809 baseline).
- `npm run typecheck:lumina`: **0 errors**.
- jsdom **WordWorkout.reader-fit.test.tsx 9/9** + **WordFlip.reader-fit.test.tsx 7/7**
  (chrome hidden at K, present at Grade 1 control; ORIENT answer-free; answer surface
  survives). Literacy suite 38/38; intent-consumption contract 1/1.
- eval-test @ K: word-workout stamps `gradeLevel:'K'`, masteredVowels=['a'] (scope
  intact); picture_match emoji-primary; word-flip clean emoji frame + chips.
- tutor-test --probe: both scaffolds resolve; PRE directives render into the prompt;
  word-flip **0 findings** (word-workout carries the pre-existing non-blocking
  stacked-questions WARN on level2).
- **live `--lesson --runs 3` (word-workout, word_chains): 3/3 PASS**, 0 confirmed
  findings — the tutor voiced the read/say play action every run ("Read each word out
  loud, watching one letter change to make a new word!"), survived the lesson
  one-sentence cap, and never read the chain words *for* the child. Bespoke
  `build_word_workout_journey` added to `run_tutor_live.py`. Report:
  `qa/tutor-reports/word-workout-live-lesson-2026-07-15.md`.

## Residuals
- **Pixel/browser** → HUMAN-CHECKS #17 (word-workout @ K) + #18 (word-flip @ K).
- **K-stage systemic**: word-workout PhaseSummaryPanel % ledger; word-flip
  PhaseSummaryPanel ledger — lesson-level chrome the K-stage removes, not per-primitive.
- **word-flip live**: probe-verified (scaffold resolves, ORIENT renders); a Gemini
  Live `--lesson` run is optional belt-and-suspenders (the component sends its own
  `[ACTIVITY_START]` independent of the catalog carrier). Lighter risk than
  word-workout — chrome-hiding + a durable ORIENT carrier only.
- The 07-14 scope-binding (`resolveScopedVowels`/`sanitizeVowelScope`) and grammar
  routing lead are intact — **not touched**.
