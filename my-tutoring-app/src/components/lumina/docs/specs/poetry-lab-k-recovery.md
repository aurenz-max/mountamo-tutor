# Spec: Poetry Lab K Recovery — rhyme_hunt + Tutoring Scaffold (RF-4) + ContentOracle (PL-4)

**Status:** Draft — 2026-07-14
**Owner:** poetry-lab
**Prereqs shipped 2026-07-14:** per-mode generator dispatcher (RF-1/PL-1/PL-2/PL-3), component phase-skipping (RF-2), catalog interim band-floor (RF-3). See `qa/reader-fit/poetry-lab-PRE-2026-07-14.md` §Fix status.

## Why (one paragraph)

The manifest routed poetry-lab into a live K lesson because the catalog claimed "TTS read-aloud… at K this means nursery rhymes and identifying rhyming words" — a claim with no wiring behind it: the live tutor never sees catalog descriptions, only a primitive's `tutoring` block, and poetry-lab has none. Product ruling (user, 2026-07-14): the manifest's *choice* was right — poem-based rhyme work belongs in K — so instead of exiling poetry-lab from K, we make the claim true. Three work items, in build order:

1. **rhyme_hunt** — a K-1 eval mode whose task identity is *hear the poem, tap the two words that rhyme* (β ~1.5).
2. **RF-4** — the tutoring scaffold that makes the poem audible (catalog `aiDirectives` STIMULUS beat + component moments).
3. **PL-4** — a poetry-lab ContentOracle so the eval-test harness can detect the RF-1 failure class the generator now prevents.

The catalog K claim is restored **only** when items 1+2 both land and the original failing flow (live K lesson, obj1-nursery-rhyme class) has been driven successfully.

---

## Work Item 1 — `rhyme_hunt` eval mode (K-1)

### Task identity

Phonological rhyme identification delivered aurally. The student hears a nursery-style stanza read by the tutor, then taps the **two** line-ending words that rhyme from the candidate chips. This is a *listening* task wearing a poem — the printed text is ambience, not load-bearing (PRE band contract rule: pictures/audio are the answer surface, never print).

### Catalog

```ts
{ evalMode: 'rhyme_hunt', label: 'Rhyme Hunt (Tier 1)', beta: 1.5, scaffoldingMode: 1,
  challengeTypes: ['rhyme_hunt'],
  description: 'Hear a short poem read aloud, then tap the pair of words that rhyme.' }
```

- Description/constraints: add "rhyme_hunt: grades K-1 (audio-first, no reading required)" alongside the existing analysis 2-6 / composition 3-6 banding. The K sentence returns to the description **in the same PR that ships the scaffold**, not before.
- `mode` root field value must equal the challengeType string (`'rhyme_hunt'`) — the eval-test route counts types from it (decodable-reader gotcha: never introduce a *different* root field named `mode`; poetry-lab's existing alignment is load-bearing).

### Content shape (generator)

New `rhymeHuntSchema` + sub-generator branch in the existing dispatcher (`gemini-poetry-lab.ts`). One invocation = one mode; still no parallel orchestration.

```
rounds: 3-4 (mastery-over-demo: never a single instance)
per round:
  poemLines: 4 lines, 3-6 simple words each, structured ABCB —
             EXACTLY ONE rhyming pair among the four line-ending words
  candidates: the 4 line-ending words, each { word, emoji }
  rhymeWordA, rhymeWordB: the answer pair, as TEXT (never positional indices — SP-25)
```

**Why ABCB, not AABB:** an AABB stanza contains *two* valid rhyme pairs — "tap the pair that rhymes" becomes ambiguous. Exactly one pair per round is a hard content contract.

**Post-process (derive over validate):**
- Derive candidate list = last word of each line (strip punctuation, lowercase-normalize). Reject the round if `rhymeWordA`/`rhymeWordB` are not both members (never fabricate; log rejection count).
- Emoji required per candidate at K (word-sorter RF-4 lesson: schema-optional emojis = K draws ship without pictures → make them REQUIRED in the schema).
- Vocabulary: concrete, sayable, CVC-heavy words; exclusion list for irregular spellings is unnecessary (the judge is the code-checked pair, not phonetics) but the prompt should demand *loud, obvious* rhymes (cat/hat class).
- Bound the rounds array. Note: string-form `minItems`/`maxItems` passed 5/5 on poetry-lab 2026-07-14, but decodable-reader hit 400s on `maxItems` with this @google/genai version — if the new schema 400s, move bounds to the prompt and cap in post-process.

**What code does NOT check:** whether the pair *truly* rhymes phonetically. Suffix-matching rhyme validators are the RS-3/RS-4 false-negative trap (SP-7). Structural contracts in code; rhyme quality stays agent-judged (`/eval-test`).

### Component (PoetryLab.tsx)

New top-level render path beside analysis/composition (`mode === 'rhyme_hunt'`), PRE band contract throughout:

- **Surface:** poem panel (lines rendered, serif, ambient) + 4 large candidate chips (word + emoji) below. Nothing else. ≤5 interactive elements; no stepper, no Found-counter, no badges, no Back/Next protocol.
- **Interaction — tap = choose:** tap two chips → judge immediately. Correct pair: both chips glow + pair-connect animation + `SoundManager` success earcon → auto-advance to next round after a beat. Wrong: gentle shake + reset selection, feedback on the object, instant (no modal, no text banner).
- **Round progression:** subtle progress dots (not an `N/M` counter — adult chrome). Rounds from `data.rounds`; per-round state reset must clear every ref/latch (spoken-primitive auto-advance footgun).
- **Evaluation:** `usePrimitiveEvaluation`, submit once after the final round: `score = firstTryCorrect / totalRounds`, success ≥ 50%. Extend `PoetryLabMetrics` with `mode: 'rhyme_hunt'`, `roundsTotal`, `roundsFirstTry` (evaluation/types.ts).
- **No typing, no voice in v1.** Voice selection of the rhyming word is a natural `/add-voice-control` follow-up but is explicitly out of scope (letter/word homophone benching concerns; LuminaVoiceTarget later).

### Multi-phase hooks

Use `useChallengeProgress` / `usePhaseResults` (lumina/hooks/) for round state rather than hand-rolled counters.

---

## Work Item 2 — RF-4: Tutoring scaffold (CATALOG + COMPONENT)

The scaffold is what makes rhyme_hunt playable by a non-reader and un-orphans poetry-lab from the generic tutor. Built with `/add-tutoring-scaffold`; verified with `/tutor-test`.

### Catalog `tutoring` block

- **taskDescription** (rhyme_hunt-aware, mode-branched): "You are the rhyme coach for '{{title}}' at Grade {{gradeLevel}}. Mode: {{mode}}. Round {{currentRound}} of {{roundsTotal}}. The poem for this round is: {{roundPoem}}. The candidate ending words are {{candidateWords}}. The rhyming pair is {{rhymeWordA}}/{{rhymeWordB}} — this is the ANSWER the student must discover by EAR. NEVER name the pair outright; stretch word endings so the student hears it."
- **contextKeys:** `title, gradeLevel, mode, currentRound, roundsTotal, roundPoem, candidateWords, rhymeWordA, rhymeWordB, attempts, firstTryCorrect` — every key must be emitted by the component's `primitiveData` (SP-27: a key the component never emits leaves the tutor silently context-blind; `/tutor-test` gates this).
- **aiDirectives beats** (the lesson-cap-proof channel — a read-aloud that lives only in component sendText is droppable; ratified reader-fit rule):
  - **ORIENT:** greet + frame once: "We're going to listen to a little poem and find the two words that rhyme."
  - **STIMULUS:** read `{{roundPoem}}` aloud slowly with prosody, *emphasizing the line-ending words*. This beat is the entire reason the mode works — Gemini Live is the voice (there is no TTS path in this architecture, and none should be added).
  - **DISAMBIGUATE:** define the protocol in ear-terms: "Rhyming words sound the same at the end — like cat… hat. Tap the two words that rhyme."
  - **RECOVER:** on a miss, stretch endings: "Listen: duuuck… suuun. Do those endings match? Try two words whose endings sound the same."

### Component moments (`useLuminaAI` + `sendText`)

All tagged sends use `{ silent: true }` (TU-5: non-silent tagged sends record as user turns and claim focus).

| Moment | Fires | Tutor behavior |
|---|---|---|
| `[ACTIVITY_START]` | mount | ORIENT + STIMULUS for round 1 |
| `[ROUND_START]` | each new round | STIMULUS: read this round's poem |
| `[RHYME_MISS]` | wrong pair tapped | RECOVER, stretch the tapped words' endings |
| `[RHYME_CORRECT]` | correct pair, **first round + comeback + final only** | brief celebrate (quiet-by-default: frame once, silent per-round, celebrate first-voice/comeback/finish) |
| `[ACTIVITY_COMPLETE]` | evaluation submitted | closing celebrate |

`updateContext` on round change only — never per-tap (SP-12 flood).

### Analysis-mode beats (secondary, same block)

At its true band (grades 2-3, DEVELOPING) the poem is still load-bearing text: add a STIMULUS beat offering to read the poem on request, and a DISAMBIGUATE beat that *enacts* AABB notation ("the first two lines end with rhyming sounds — that's A and A…"). Do not block rhyme_hunt shipping on polishing these.

### Verification

1. `/tutor-test poetry-lab` — deterministic L2 gate: every `{{key}}` resolves (broken keys render silent), directives present, no-scaffold probe now passes.
2. Tier-3 live harness (`--runs 2`, K journey): confirm the tutor actually reads the poem on ROUND_START, no answer leak (leak = ASSERTIVE sentences naming the pair), no interrogation cadence.
3. Live `--lesson` drive of a K nursery-rhyme lesson — the original user-observed failing flow. **This is the gate for restoring the catalog K claim.**

---

## Work Item 3 — PL-4: poetry-lab ContentOracle (QA HARNESS)

The eval-test route validated the RF-1 broken draws as `pass` because it counts challenge types only. The generator now enforces the contracts by construction; the oracle exists so a *regression* of this class is caught by code, in CI (`/oracle-test` pattern: independent check vs shipped data, no LLM judge).

### Registry entry

`ContentOracle` for `poetry-lab`, keyed per eval mode. Note: poetry-lab uses `evalModes` (not `supportsEvaluation`-only), so it counts in the oracle coverage denominator — no biology-style hidden-primitive gotcha.

### Contracts (all code-checkable, no phonetics)

**analysis:**
- `poemLines` non-empty; `poem === poemLines.join('\n')`
- `moodOptions.length` 3-4 ∧ `correctMood ∈ moodOptions` (case-insensitive)
- `rhymeSchemeOptions` non-empty ∧ `rhymeScheme ∈ rhymeSchemeOptions`
- every figurative instance slice-verifies: `poem.slice(startIndex, endIndex) === text`; instances non-overlapping, sorted
- NO composition fields present (`templateType`, `compositionPrompt`, `templateConstraints` all absent)

**composition:**
- `compositionPrompt` non-empty; `templateType` present; `templateConstraints.lineCount ≥ 1`
- template-derived invariants: haiku ⇒ `syllablesPerLine` [5,7,5] ∧ lineCount 3; limerick ⇒ rhymePattern AABBA ∧ [8,8,5,5,8]; sonnet-intro ⇒ ABAB ∧ 4; acrostic ⇒ `acrosticWord` present ∧ `lineCount === acrosticWord.length`
- NO analysis fields present

**rhyme_hunt:**
- `rounds.length ≥ 3`
- per round: 4 poemLines; 4 candidates each with non-empty `word` AND `emoji`; `rhymeWordA`/`rhymeWordB` are BOTH members of the derived line-ending set; exactly one declared pair; candidates deduped
- structural only — whether the pair rhymes stays agent-judged (`/eval-test`); a suffix-matching rhyme check is explicitly forbidden (SP-7 / RS-3-RS-4 false-negative class)

### Verification

`/oracle-test poetry-lab` green across all three modes × 3 draws; add to the CI oracle list. Then deliberately break one contract locally (comment out `ensureAnswerInOptions`) and confirm the oracle FAILS — an oracle that can't fail is decoration.

---

## Definition of done (whole spec)

- [ ] rhyme_hunt: eval-test 3× at K — every draw satisfies the rhyme_hunt contracts; jsdom behavioral test or browser drive of the tap-pair loop
- [ ] `/tutor-test poetry-lab` passes; live harness confirms poem read aloud + no answer leak (2/2 runs)
- [ ] Live K lesson drive (nursery-rhyme objective) completes end-to-end by ear: no reading required to orient, act, or recover
- [ ] Reader-fit re-audit at PRE: Audit C rules 1-8 re-scored for rhyme_hunt (target: all PASS; the 2026-07-14 report scored 0/8)
- [ ] `/oracle-test` green ×3 modes, and proven able to fail
- [ ] Catalog K claim restored in the same change that ships 1+2; `qa/reader-fit/poetry-lab-PRE-2026-07-14.md` and EVAL_TRACKER (RF-4, PL-4 rows) updated
- [ ] `typecheck:lumina` 0 errors throughout

## Out of scope

- Voice answer selection (`/add-voice-control`) — natural v2, blocked on nothing but sequencing
- Composition-mode K coverage ("finish-the-rhyme" typing variant) — typing is banned at PRE; would need its own instrument design
- Support tiers / structural difficulty for rhyme_hunt (`/add-support-tiers`, `/add-structural-difficulty`) — later lifecycle layers
