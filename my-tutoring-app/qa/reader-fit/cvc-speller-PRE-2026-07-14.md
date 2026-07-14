# Reader Fit: cvc-speller @ PRE — 2026-07-14

Modes audited: fill_vowel, spell_word (backlog focus), word_sort (all three claimed
at K via "ESSENTIAL for K-1 phonics encoding") | Probes: eval-test ✓ (3 modes,
grade=K, real draws) tutor-test --probe ✓ (status: **pass**, 0 findings, all 8
template vars component-resolved) | live: not run — audit-only invocation; the
lesson-mode STIMULUS/ORIENT risk below is structural (no aiDirectives beat) and
flagged for `--lesson` live confirmation when `--fix` runs.

Backlog item 5 (audit rank 3 from the 2026-07-12 cognitive-load audit). Invoked
without `--fix` — audit only.

## Phase 0 — artifacts

- Component: `src/components/lumina/primitives/visual-primitives/literacy/CvcSpeller.tsx`
- Generator: `src/components/lumina/service/literacy/gemini-cvc-speller.ts` (support tiers + structural difficulty wired)
- Catalog: `src/components/lumina/service/manifest/catalog/literacy.ts` (~line 841)
- Real K draws: spell_word 4 challenges (sat/mat/pat/tap, 6-letter bank);
  fill_vowel 5 challenges (2 vowel options each); word_sort 6 challenges
  (short-a vs short-e buckets). word_sort title came back **"Sort the Short
  Sounds: /æ/ or /ɛ/?"** — IPA in a child-facing title.
- Worst-case spell_word bank: targets(3) ∪ distractors(≤5 at hard tier) ∪
  `availableLetters`(6 observed) → **8-9 tappable letter tiles**, 13-16 total
  interactive elements on screen.

This primitive is the strongest of the literacy-audit set on the audio channel:
the word stimulus is spoken unprompted at start ([ACTIVITY_START]), auto-replayed
per challenge ([SAY_WORD]), replayable (Hear It), each placed letter's phoneme is
echoed ([CONFIRM_SOUND]), every wrong attempt gets a component-enacted progressive
spoken hint, and there's a judge-confirmed spoken-production beat. The gaps are
protocol orientation, the lesson-mode droppability of the intro, element overload,
and chrome — not the pedagogical core.

## Audit A — text census

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Check Spelling" button | spell_word — gates ALL evaluation | Load-bearing (protocol) | None — [ACTIVITY_START] never scripts the protocol (tap letters → boxes → tap check); no catalog beat | **UNCOVERED** |
| "Your turn — say the word!" + mic labels (`Say "sat"!`) | Production beat CTA after solve | Load-bearing for the beat (skippable) | None — [SPELLING_CORRECT]/[ANSWER_CORRECT]/[SORT_CORRECT] never invite the student to say the word; mic orb is semi-pictographic | **UNCOVERED** (weak) |
| "Stretch It" 🐌 button | Audio controls (all modes) | Load-bearing (the key self-serve scaffold) | Snail icon not self-evident; catalog struggle #3 tells the child to **"Use the Stretch button"** — requires reading a label to reach an audio scaffold | **UNCOVERED** |
| "Hear It" + speaker button | Audio controls | Load-bearing (replay) | Speaker icon is pictographic; auto-play covers the main path | COVERED (icon) |
| Letter tiles (bank + slots) | Answer surface | Content — letters ARE the encoding task at K phonics; sanctioned | [CONFIRM_SOUND] speaks each placed letter's phoneme | COVERED |
| "Which vowel sound do you hear in the middle?" | fill_vowel, text-sm | Load-bearing (the question) | Enacted only AFTER a wrong attempt ([FILL_VOWEL_WRONG]); intro *may* state it but no script guarantees it | **UNCOVERED pre-error** |
| "Which vowel sound do you hear? Sort into the right bucket!" | word_sort, text-sm | Load-bearing (the question) | Same — [SORT_WRONG_L1] enacts post-error only | **UNCOVERED pre-error** |
| Bucket chip `short-a` / `short-e` | word_sort bucket, 10px | Dev slug in the child's field ([CvcSpeller.tsx:1139](../../src/components/lumina/primitives/visual-primitives/literacy/CvcSpeller.tsx#L1139)); also interpolated into feedback text ("goes in the short-a bucket!") and into SPOKEN lines via `${correctBucket}` in [SORT_CORRECT]/[SORT_REVEAL] — tutor reads "short-a" aloud | — | **LEAK — remove** |
| "Clear" button | spell_word | Supportive (slot-tap also clears, but that affordance is invisible) | None | UNCOVERED (supportive) |
| `imageDescription` sentence ("A person sitting down on a rug") | Picture-cue panel, italic sm | Decorative at PRE (emoji carries the cue) | Not spoken | Noise — drop at PRE |
| begin/middle/end 10px slot labels | Under Elkonin boxes | Supportive | Struggle #2 enacts "first sound → first box" spoken | COVERED-ish |
| Keyword captions "apple"/"egg" (10px) | fill_vowel options, bucket captions | Supportive | Spoken in every contrast line post-error | COVERED post-error |
| Success/error feedback cards (incl. generator `commonErrors.feedback`) | LuminaFeedbackCard | Load-bearing correction | Every path pairs a spoken sendText ([SPELLING_HINT_L1/L2], [VOWEL_CONFUSION], reveals) | COVERED |
| Title, "Short A (/ă/)" badge, task-type badge, "1 / 4" counter, progress dots, PhaseSummaryPanel ("You got 3 out of 4 correct!") | Chrome | Decorative/adult; IPA notation in badge; quantitative score prose at end | [ALL_COMPLETE] spoken | rule-7 offenders (Audit C) |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| spell_word | **PARTIAL** — [ACTIVITY_START] fires unprompted and names the task, but no script enacts the protocol (fill boxes, tap check); intro is a component sendText only → droppable under the lesson one-sentence cap | **PASS standalone** ([ACTIVITY_START] says word 1, [SAY_WORD] auto-plays 2+, Hear It, [CONFIRM_SOUND] echo) / **AT RISK in lesson** for word 1 — no catalog aiDirectives beat | PASS — slot cursor auto-advances in phoneme order; struggle #2 enacts box mapping | PASS — SFX + slot shake/bounce + spoken hint on every wrong attempt | **PARTIAL** — L1/L2/L3 escalation is component-enacted (excellent), but struggle #3 says "Use the Stretch button" (not eyes-free), production-beat invite unspoken, slot-clear affordance invisible |
| fill_vowel | **PARTIAL** (same lesson-droppability) | PASS / AT RISK word 1 (same) | **PARTIAL** — "which sound in the MIDDLE?" is text-only until the first error | PASS | PASS — auto contrast lines + max-attempt reveal, all spoken |
| word_sort | **PARTIAL** (same) | PASS / AT RISK word 1 (same; + dedicated speaker button) | **PARTIAL** — bucket question text-only pre-error; bucket identity = letter + unreadable caption + dev slug | PASS | PASS-ish — L1/L2 + reveal enacted; spoken lines interpolate the `short-a` slug |

Note (support-tier consistency, LOW): the manual Stretch button escalates on
`currentAttempts` and at press 3 speaks "The letter is ${vowel}" regardless of
`supportTier: 'hard'` whose policy says never reveal — the button bypasses the
tier posture the sendText prompts otherwise carry.

## Audit C — band contract (PRE)

Judged on the RENDERED spell_word worst case (hard-tier bank):

| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1. Audio is the instruction channel | **PARTIAL FAIL** | Word stimulus is genuinely audio-first (best in the audit set), but the Check gate, production-beat invite, and Stretch access are text/discovery-only |
| 2. Tap = choose | PASS (with note) | 3-slot construction legitimately keeps an explicit confirm; slot-cursor auto-advance covers the happy path; tap-filled-slot-to-clear is an invisible protocol |
| 3. Pictures are the answer surface | PASS (sanctioned) | Letters ARE the encoding task at K; emoji cue shown by default. `imageDescription` sentence is text noise at PRE |
| 4. One thing per screen, ≤5 elements | **FAIL** | spell_word: 3 slots + 6-9 bank tiles + Clear + Check + Hear It + Stretch It = **13-16**. fill_vowel (4) and word_sort (5) pass |
| 5. Feedback on the touched object | PASS | Shake/bounce on slots, SFX, instant; text card is supplementary |
| 6. No typing / no notation-only | PASS | Tile selection isn't typing; IPA appears in chrome but audio always carries the sound |
| 7. No adult chrome | **FAIL** | "Short A (/ă/)" badge (IPA), task-type badge, "1 / 4" counter, title, progress dots, imageDescription, begin/middle/end micro-labels, `short-a` bucket slug, PhaseSummaryPanel percentage ledger |
| 8. Assessment hides in mechanics | PASS | Encoding by construction + judge-confirmed spoken production; metrics (vowel/consonant accuracy, stretch count) tracked silently |

**Overall: PRIMITIVE-GAP** — the audio-first Elkonin core is sound and the spoken
scaffold ladder is the reference model for component-enacted escalation; what
fails PRE is element overload (rule 4), adult chrome + dev-slug/IPA leaks (rule
7), and a scaffold whose ORIENT/STIMULUS beats live only in droppable component
sendTexts.

Findings → fix layer:

1. **SCAFFOLD-GAP (HIGH, all modes) → CATALOG.** No `aiDirectives` ORIENT/STIMULUS
   beat: the intro + first-word say-aloud live only in the component
   [ACTIVITY_START] sendText, which the lesson `[PRIMITIVE SWITCH]`/greeting
   one-sentence cap can drop (addition-subtraction-scene precedent — 6/6
   standalone pass, lesson fail). Add a catalog beat: "Saying the target word
   aloud IS your greeting (overrides any one-sentence cap); then tell the student
   in child terms to tap the letters for each sound and tap the green check" +
   per-mode question line (fill_vowel: "which sound is in the MIDDLE?";
   word_sort: name both buckets aloud). Confirm with `run_tutor_live.py
   --component cvc-speller --lesson --runs 3`.
2. **SCAFFOLD-GAP (HIGH) → CATALOG + COMPONENT sendText.** Eyes-free recovery
   gaps: reword struggle #3 (never "Use the Stretch button" — the tutor should
   just stretch the word itself); add the spoken production invite to
   [SPELLING_CORRECT]/[ANSWER_CORRECT]/[SORT_CORRECT] ("…then invite the student
   to say the whole word out loud").
3. **PRIMITIVE-GAP (HIGH) → COMPONENT.** spell_word element overload at PRE:
   band-gate (`gradeLevel === 'K'` / gradeBand) — hide Clear (slot-tap clears),
   collapse Hear It/Stretch It into the single speaker affordance (progressive
   stretch already auto-escalates via attempts), drop `imageDescription` text
   (emoji only), and rely on the generator's easy-tier `distractorLevel: 'clean'`
   cap for bank size at PRE.
4. **PRIMITIVE-GAP (HIGH) → COMPONENT (+ GENERATOR title constraint).** Dev-slug
   + IPA leaks: delete the `{bucket}` slug span ([CvcSpeller.tsx:1139](../../src/components/lumina/primitives/visual-primitives/literacy/CvcSpeller.tsx#L1139)); stop
   interpolating `correctBucket` into child-facing feedback and spoken lines
   (pass the vowel letter/keyword instead); strip IPA from the vowel badge at
   PRE; generator prompt: child-facing `title` must contain no slash-notation
   (word_sort draw shipped "/æ/ or /ɛ/?").
5. **Chrome (record to K-stage systemic item, partial local fix).** Badges,
   counter, progress dots, title, begin/middle/end labels, PhaseSummaryPanel
   percentages — same per-primitive internal chrome class as
   addition-subtraction-scene; band-gate what's cheap in slice 3, accumulate the
   rest as K-stage evidence.
6. **LOW → COMPONENT.** Stretch-button L3 reveal ("The letter is A") ignores the
   hard-tier no-reveal posture; gate the manual escalation ladder on supportTier.

## `--fix` loop log (2026-07-14, same day)

| Iter | Change | Layer | Verified by | Re-audit |
|---|---|---|---|---|
| 1 | `aiDirectives` "PRE-READER ORIENT + SAY-THE-WORD BEAT" — say `{{targetWord}}` twice as the greeting (explicitly overrides the lesson one-sentence cap), then a per-mode task line in child terms; reworded struggle #3 eyes-free (tutor stretches the word itself, never "find the Stretch button"); fixed the `[keyword]` literal in scaffoldingLevels.level2 | CATALOG | tutor-test probe `pass` 0 findings; directive renders in the static prompt with `targetWord` component-resolved | Audit B ORIENT/RECOVER → PASS on paper |
| 2 | Spoken production invite appended to `[SPELLING_CORRECT]`/`[ANSWER_CORRECT]`/`[SORT_CORRECT]` (mic-gated via `micSupportedRef`) | COMPONENT | jsdom behavioral test asserts the invite string in the success sendText | Audit A "Your turn" → COVERED |
| 3 | Letter bank = targets + tiered distractors only; `availableLetters` tops up to a floor of 5 (the old full union defeated the support-tier distractor cap); Clear button removed (slot-tap clears); Hear It + Stretch It collapsed to ONE audio button (tap 1 = hear, taps 2+ = existing stretch ladder, `stretchUsed` metric preserved); imageDescription sentence → emoji-only cue (a11y label); word-sort inner speaker button removed | COMPONENT | jsdom test: bank excludes overflow letters, no Clear/Stretch buttons, exactly one Hear It, audio tap ladder `[REPEAT_WORD]`→`[STRETCH_WORD]`, no imageDescription text | Audit C rule 4: spell-word 13-16 → **11** (default tier) / 10 (clean tier); bank is the manipulative — recorded as best-achievable without destroying task identity |
| 4 | Dev-slug + IPA leaks: bucket `short-a` span deleted; `correctBucket` no longer interpolated into child-facing feedback or spoken `[SORT_*]` lines (vowel + keyword instead); `VOWEL_LABELS` badge IPA stripped ("Short A"); generator title schema constraint + deterministic sanitizer (strips `/æ/`-style notation and `short-a` slugs) | COMPONENT + GENERATOR | jsdom test: no `short-a` in the rendered field or `[SORT_CORRECT]`; live draw's title came back sanitizer-corrected ("Short A Word Fun!") — the model DID emit notation again and the sanitizer caught it | Audit A slug leak → CLOSED |
| 5 | **Discovered-during-fix (new, CRITICAL): evaluation never submitted.** `useChallengeProgress.isComplete` flips when the LAST result is recorded, and every session-end render gate used `!allChallengesComplete` — hiding the feedback card, the production mic beat, and Finish on the final word, making `handleNextWord` (the only `submitEvaluation` call site) unreachable. Regates session-end UI on `hasSubmittedEvaluation` (`sessionDone`): final word now shows feedback + mic beat; Finish/skip/spoken word submits, then the summary renders | COMPONENT | jsdom test: final-word flow — success feedback + "Your turn" visible, Skip to finish → summary + `[ALL_COMPLETE]` + `submitResult` called exactly once | New behavioral test locks it |
| 6 | Live lesson-mode confirmation: new `cvc-speller` journey in `run_tutor_live.py` (replays post-fix `[ACTIVITY_START]`/`[SAY_WORD]`/hint/success; `must_include` word + ORIENT oracles) | HARNESS | `--component cvc-speller --lesson --runs 3` — **result pending, see below** | — |

Gates: `typecheck:lumina` 0 errors; full vitest suite 760/760 (4 new CvcSpeller
reader-fit tests + 1 extended); tutor-test probe pass; fresh eval-test draw pass.

Post-fix Audit C (spell-word): rules 1, 2, 3, 5, 6, 8 PASS; rule 4 PARTIAL
(11 interactive elements — 3 Elkonin slots + 6-tile bank + Check + one audio
button; the slot/bank surface IS the manipulative, floor reached); rule 7
remaining chrome (title, badges, counter, dots, begin/middle/end labels,
PhaseSummaryPanel) stays recorded under the K-stage systemic item.

## Live lesson-mode confirmation (RF-1 gate)

`run_tutor_live.py --component cvc-speller --lesson --runs 3` — **PASS, exit 0,
zero confirmed findings** (report: `qa/tutor-reports/cvc-speller-live-lesson-2026-07-14.md`).

- STIMULUS at the lesson greeting/switch: word said 3/3 (run 2: *"The word is
  sat. sat. Which sound do you hear in the middle?"* — the aiDirective beat
  working as designed, exactly where the old sendText-only carrier was droppable).
- STIMULUS on advance: "mat. mat." 3/3. ORIENT (task in child terms) 3/3.
- Production invite delivered 3/3 ("Can you say the whole word for me?").
- Two 1/3 `stimulus-not-read` notes are oracle artifacts, not failures: the tutor
  voiced the word in STRETCHED/SEGMENTED form ("s-a-a-a-t", "S-a-t... yes!"),
  which doesn't string-match "sat". Correct phonics pedagogy; a phoneme-tolerant
  matcher would be a harness nicety, not a fix.
- Real note (1/3, pre-existing, backend class): run 2's tutor spoke
  "[PRIMITIVE SWITCH]" ALOUD at activity_start. The harness `TAG_SYNTAX_RE`
  missed it (space inside the tag) — oracle patched this session so future runs
  flag it. Root cause lives in the lesson switch prompt (`lumina_tutor.py`), not
  this primitive; left open as a tutor-infrastructure follow-up.

**Final verdict: READY** (PRE, all three modes) — with rule 4 recorded as
best-achievable (11 elements, manipulative floor) and rule-7 chrome accumulated
to the K-stage systemic item. Not browser-eyeballed — the single audio button +
emoji-only cue merit a human glance in the literacy tester.
