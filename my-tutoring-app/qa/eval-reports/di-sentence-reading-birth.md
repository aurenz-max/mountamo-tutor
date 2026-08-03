# Birth Certificate — di-sentence-reading (2026-07-25)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core mode.
Fourth DI pack, and the family's **first connected-text pack**. Separate content pack
over the committed engine: the letter-sounds / word-reading / math-facts files are
untouched, and `hooks/` was not modified.

- **Core task identity:** `read_sentence` (β3.0 — one rung above di-word-reading's
  `read_word` 2.5; a sentence adds tracking, phrasing, and the dropped-word error class
  a single word cannot have)
- **Generator fork:** **A** (pool service) — a curated 37-sentence menu owned in code;
  Gemini enum-selects ids and writes the wrapper only. Sentences are code-owned because a
  decodable sentence is a controlled-vocabulary artifact: a model asked to "write a
  sentence for a first grader" produces text this learner cannot decode, which would turn
  every miss into a content bug instead of a reading signal.
- **Cues wired:** `[DI_ITEM]` (model→guide→test + in-band judging contract),
  `[DI_MOVE_ON]` (corrections capped at 2), `[DI_COMPLETE]`. The DI family runs its
  pedagogy through the judged-loop engine's cue channel, not `sendText` moments.
- **Answer-leak audit:** walked the stage, the recap, the wrapper, and the connect
  payload. Decoding print IS the skill, so the printed sentence is both stimulus and
  target — nothing may picture or pre-speak it beyond the scripted model line, which is
  the instruction itself (the family's model→guide→test method; the measured production
  is the child's independent read at the TEST step, and L3's fade is where the model is
  withdrawn). **Gated:** reward emoji renders only after an affirmed read and is cleared
  on `attempt-open`; the reward is value-captured at verdict time so the stage can never
  print the NEXT sentence while the tutor is still restating the last one; the generator
  drops any title/description containing a 3-word run from a target sentence.
- **Design gate (Phase 2):**
  - *Direct manipulation* — **pass:** the voice IS the manipulation; no button or proxy
    stands between the child and the skill.
  - *Living simulation* — **pass:** the Live tutor is the interaction surface (family
    doctrine), responding to what the child actually said, judged from audio.
  - *Production over recognition* — **pass:** maximal production — connected speech from
    print, nothing to choose among.
  - *No visible timers* — **pass:** latency captured silently into `meanResponseMs`; the
    judging contract explicitly refuses to penalise slowness at L0 ("judge accuracy,
    never speed").
  - *No answer-leak by layout* — **pass:** see the audit above.
- **Curriculum home:** **MATCH ×2** — G1 `LA003-01 Oral Reading Accuracy` (0.824;
  top subskill is *"self-correct reading miscues by re-reading"*, a near-verbatim
  statement of the judging contract) and G2 `LA001-05 Reading Fluency` (0.807). K
  abstains diffuse, which is correct for a G1-2-scoped pack — though a K home does exist
  (*"Read CVC Words in Decodable Phrases & Sentences"*, 0.781) if it is ever widened.
  Report: `qa/curriculum-fit/di-sentence-reading-2026-07-25.md`.

## What the bench sitting bought (standing gate 1, PASSED 2026-07-25)

Every spoken line in `diSentenceReadingScript.ts` is **byte-for-byte** the bench's
`kind: 'sentence'` branch. The sitting settled three design questions with evidence, so
the birth guessed at none of them — do not re-litigate:

- **(a)** Live CAN hear a one-word error inside a 5-8 word utterance: **2/2** on
  deliberate single-word OMISSIONS (the hardest class — nothing wrong is said, something
  merely isn't). This is what makes the pack viable at all.
- **(b)** **Whole-sentence correction ships.** Word-targeted correction is the DISTAR
  ideal but needs the tutor to fill a variable the script cannot know — a direct threat
  to "speak exactly" and the sentinel discipline. The learner self-repaired on the first
  retry both times, so naming the word would have bought nothing.
- **(c)** **The restating affirm stays** ("Yes, that says …"): ~2-3s against a ~15-17s
  cycle whose dominant term is learner think-time (8-11s). Tutor talk is not the
  bottleneck for connected text; the child reading is.
- **Scope 3-8 words.** No reliability break appeared across the ladder, so 8 is a
  *proven ceiling, not an observed failure point*. Longer text is UNBENCHED and
  code-capped (`MAX_SENTENCE_WORDS`), including a final filter after every other rule.

**The ship-blocking finding landed in this slice** (bench finding 2): a child reading
connected text pauses mid-sentence, and the family default `silenceCloseMs: 500` (tuned
for one-word answers) split one read into two voice turns 3 times in 10 items — breaking
the alias cross-check and nulling `responseMs` on second fragments. This pack passes
**1100ms** via `useJudgedSpeechLoop({ voice: { config } })`. **The family default is
deliberately unchanged** — 500ms is right for the three short-response packs.

## Departures from the L0 default, and why

1. **The tutoring block ships in the CATALOG at birth, not the script.** The DI family's
   standing departure is that the tutoring block ships at birth at all (the mechanism IS
   the in-band judging contract — the generic tutor cannot run this primitive). This pack
   puts it in `catalog/di.ts` rather than the script, as the two older reading packs did,
   because di-letter-sounds' L2 slice already built the family lesson-mode wiring that
   resolves BOTH connect paths from the catalog. Shipping it there costs nothing and means
   lesson mode works on day one instead of waiting for L2. **L2 still has real work:**
   `contextKeys`, `commonStruggles`, and the RUNTIME STATE `updateContext` sync are
   deliberately absent — and no `{{placeholder}}` is used without a contextKey to fill it,
   since an unfilled key renders silently.
2. **Two metrics beyond the canonical nine.** `meanResponseMs` (family precedent; silent,
   never judged at L0) and **`meanSentenceWords`** — sentence length is this pack's
   structural-difficulty axis, so without it two sessions with identical accuracy are not
   comparable and L4 has nothing to modulate against.
3. **One unbenched addition, framing only:** the opening cue tells the tutor to begin with
   the quoted line, "no greeting, no introduction". This addresses the sitting's finding 5
   (the tutor prefixed an unscripted *"It's great to see you!"* before the scripted
   "Listen:", which `offScript: 0` did not catch because that counter classifies verdicts,
   not fidelity). No judged line was changed. The leak is family-wide; only this pack's
   opener was touched.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| ~~1~~ | ~~`/add-eval-modes`~~ | **L1 DONE 2026-07-25** | Shipped the FULL 4-mode ladder as specified — `decodable_sentence` β2.5 / `read_sentence` β3.0 (L0 unchanged) / `sentence_review` β3.5 / `sight_phrase_sentence` β4.0 — with **zero new spoken copy** (the L0 script was already phrased around `it.text`, so all four read through the bench-proven lines; no new sitting needed). `decodable_sentence` also gives the pack the **K home** the birth fit probe abstained on. `/topic-trace` confirmed a sight-word objective routes to `sight_phrase_sentence` end-to-end. The convergent-selection worry flagged below turned out to be the `sentence_review` bug — found and fixed in QA. Report: `di-sentence-reading-evalmodes-2026-07-25.md`. |
| ~~2~~ | ~~`/add-tutoring-scaffold`~~ | **L2 DONE 2026-07-25** | Added exactly what birth left out: `contextKeys` (challengeType/text/wordCount/sentences), the `{{challengeType}}` placeholder they make safe, 5 `commonStruggles` from the sitting + both live runs, the generator `sentences` summary, and the component `updateContext` sync. Bench-proven aiDirectives untouched. `/tutor-test` **0 HIGH** (2 WARNs = the DI family's shape, same pair as both siblings); Tier-2 probe clean on 3 modes, all keys real, `probe.findings: []`. Unlike the sibling packs NO key is withheld — the sentence is stimulus and target both. Report: `qa/tutor-reports/di-sentence-reading-2026-07-25.md`. Original candidates were: contextKeys `challengeType`, `text`, `wordCount`, plus a flat `sentences` summary field the generator must add (mirror math-facts' `facts` / letter-sounds' `letters`) — **stimulus side only**; there is no separate "answer" to withhold here, the sentence IS both. Struggles seen/expected: a mid-sentence pause read as a finished turn (now mitigated by `silenceCloseMs`, worth a struggle line anyway); dropping a small function word ("the", "a") — the exact class the sitting proved detectable; re-reading the whole sentence after a self-catch (must be AFFIRMED, not corrected); reading word-by-word without phrasing (accurate ⇒ correct at L0). Also add the standing gate-3 reminder that every correction begins "My turn:". |
| ~~3~~ | ~~`/add-support-tiers`~~ | **L3 DONE 2026-07-25** | Shipped exactly the predicted fade — easy = model+guide+test, medium = model+test, hard = cold read — as a cue variant in the SCRIPT (`leadInFor`), never a UI flag. **`hard` closes the answer-leak caveat recorded in this certificate**: no echo route survives when the tutor is given nothing to say but the ask. Zero `showOptions` meant the whole ladder is modality #2 (the AngleWorkshop case). Tutor second-channel hole found + fixed: L2's `scaffoldingLevels` level 1 would have re-read the withheld sentence. 13/13 new tests, 5 fail under the non-vacuity probe. Report: `di-sentence-reading-support-tiers-2026-07-25.md`. |
| ~~4~~ | ~~`/add-structural-difficulty`~~ | **L4 DONE 2026-08-03** | Shipped the word-count BAND lever exactly as shaped — easy [3,4] / medium [5,6] / hard [7,8] inside the session ceiling (`resolveProblemShape`, clamped; `rankByBand` enforces at selection; the **8-word benched ceiling held as a hard cap** — narrowed ceilings saturate honestly). Uniform across all four modes (same act; pool identity outranks the band). 7 menu additions give the hard band pool support in every mode. The other two shaped levers (sight-word density, vowel-mixing) were **deferred by design** — one lever per mode; revisit only if the length band proves too coarse. 17 new tests (9 fail on revert), live sweep 6/6. Report: `di-sentence-reading-structural-difficulty-2026-08-03.md`. |
| 5 | `/add-sound` | L5 polished | 2-4 candidate points: the reward-beat landing (when the read sentence turns emerald), the per-sentence advance, session complete. Keep it sparse — this pack's whole channel is audio, and any SFX competes with the tutor's voice. |
| 6 | `/add-voice-control` | L5 polished | **N/A / already native.** This is a spoken-production primitive whose entire interaction is an open mic through the judged-loop engine; there is no separate voice layer to add. Doctrine reference (quiet tutor, asymmetric grading) remains `/add-spoken-judge`. |
| ✓ | `/eval-test di-sentence-reading` | QA loop | Run after EVERY layer lands (`/eval-fix` for findings). Birth ran it 11× (`qa/eval-reports/di-sentence-reading-2026-07-25.md`). |

## L0 GATE NOT CLOSED — the live loop has never been driven

Mirror of #36 (letter-sounds), #43 (word-reading), #48 (math-facts): **the pack is
runtime-unverified through the primitive** → **HUMAN-CHECKS #54**. The engine and the
script wording are bench-proven, but this component, its generator, and the raised
`silenceCloseMs` have never run together with a real mic. The sitting must carry:

- **(a) The `silenceCloseMs: 1100` fix is the headline.** The bench sitting produced 3
  "attempt superseded" events at 500ms; a clean run should produce **zero**, with
  `aliasMatch` true on correct reads and `responseMs` non-null on every attempt. That
  triple is the fix's proof. If splits persist, raise toward 1400ms — do not lower the
  family default to compensate.
- **(b) The reward beat at sentence length.** The affirm restates the WHOLE sentence
  (~2-3s), far longer than the fact/word affirms the beat was tuned against, so the
  3.5s cap may bind where math-facts' 3.0s did not. Watch for the next sentence
  appearing while the tutor is still speaking (cap too tight) or a dead pause (floor too
  slow).
- **(c) The short end of the ladder — the sitting's own unresolved residual
  (HUMAN-CHECKS #53).** Both proven omission catches landed on 6- and 7-word items, and
  item 1 ("The cat sat.") transcribed as "the car" yet was affirmed — ASR artifact or a
  genuine false affirm, unresolvable from the log. A short sentence gives the judge less
  context to notice a swap, so it may be **harder** than the long ones. Drive a
  deliberate one-word error on a **3-4 word** sentence.
- **(d) The correction branch + the capped-correction move-on.** Family-wide, four
  consecutive sittings have been all-correct or near it; `[DI_MOVE_ON]` has never been
  heard live in any pack.
- **(e) LANGUAGE_ARTS attribution on submit** — should resolve via the domain default
  with no per-primitive override (contrast di-math-facts, which needed one).

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
