# Reader-Fit Backlog

Working queue for `/reader-fit`. Top = next. Seeded 2026-07-13 from two live
user-observed K-lesson failures + the 2026-07-12 cognitive-load audit.

## Queue

### 1c. poetry-lab — user-observed 2026-07-14, AUDITED (report: `poetry-lab-PRE-2026-07-14.md`)
Live K lesson ("Little Cat's Big Adventure") shipped with no mood options, dead Next
button, no read-aloud. Audit: **WRONG-BAND at PRE** + band-independent CRITICAL
generator bug. Tracker rows RF-1..RF-4 (poetry-lab). Fix slices, in order:
- **GENERATOR (RF-1, breaks ALL grades):** per-mode required fields in the
  eval-mode-forked schema (analysis requires poem/poemLines/correctMood/moodOptions/
  rhymeScheme/rhymeSchemeOptions, omits templateType/composition fields; vice-versa
  for composition). 4/4 draws currently missing the mood cluster → phase-1 deadlock.
- **COMPONENT (RF-2):** skip phases whose data is absent (mood without options,
  figurative without instances — K mandates zero instances, so the phase-2 gate
  `foundFigurative.size === 0` is unsatisfiable by design).
- **QA (RF-2):** eval-test false-passed the broken draw — add mode-required content
  contract (moodOptions non-empty, correctMood ∈ moodOptions, offsets slice-verified);
  `/oracle-test` candidate.
- **ROUTING (RF-3):** strip phantom "TTS read-aloud" sentence + K claims from catalog
  description/constraints; band-floor analysis grade 2+, composition grade 3+.
- **SCAFFOLD (RF-4):** /add-tutoring-scaffold (no tutoring block, no useLuminaAI) —
  needed at its TRUE band too (grade 2-3 poem is load-bearing text, no spoken twin).
- **REBUILD (optional, K coverage):** nursery-rhyme rhyme-pair tapper instrument —
  tutor says two words (or plays the rhyme), child taps the picture that rhymes /
  taps whether they rhyme. Assessment hides in the tapping; zero text. Only build if
  K "identify rhyming words" demand isn't already served (word-flip/phoneme family).

### 2b. comparison-builder @ PRE — remaining slices (after 2026-07-14 fix)
Scaffold P1–P3 + component P1 (compare_groups tap-the-side) shipped; see Done.
Next priorities:
- **Component P2 (chrome band-gate):** at `gradeBand==='K'` hide mode tabs, "1/N"
  counter, "Kindergarten"/type badges, and the "Left: N / Right: N" count badges
  (the count badges also partially leak the answer). Coordinate with K-stage.
- **Audit-C rule 5 (feedback on the object):** wrong answer is still a text card +
  generic beep — make the tapped group flash/shake instead of a text card at K.
- **Other eval modes at PRE:** one_more_less (up to 21 number cells — rule 4 load),
  compare_numbers (< > = symbol reading), order (direction badge text) — each needs
  its own tap/picture-primary + disambiguate pass. (The bespoke live journey now
  supports all four types via `disambiguate_groups` — reuse it when fixing them.)
- ~~Behavioral confirm of the tutor beat~~ **DONE 2026-07-14** — live `--lesson` 3/3 PASS.

### 6. letter-sound-link @ PRE — audit rank 4
Two-tap select protocol explained in 10px text.

### 7. phonics-blender @ PRE — audit rank 5
3-phase stepper, 4+ labeled-button taps/word; strong tutor speech already —
Audit C is the main event.

### Lesson-mode sweeps (after pilots 1–2 prove the loop)
- `/reader-fit --lesson "Count to tell the number of objects — up to 5" kindergarten`
  (the observed lesson)
- One K addition/subtraction lesson end-to-end.

## Systemic items (accumulate evidence, don't fix per-primitive)
- **K-stage presentation mode — MVP BUILT 2026-07-13** (`KindergartenStage.tsx`,
  gated in `LessonScreen.tsx` via `kindergartenMode.ts`; auto-on for K lessons,
  Ctrl+Alt+K override). On-rails one-section-at-a-time with animated frame flow,
  wordless arrow advance gated on section completion, tutor `[SECTION_START]`
  narration. NOT yet browser-verified. Still open: per-PRIMITIVE internal chrome
  (counters/steppers inside components) is untouched — keep recording Audit-C
  chrome FAILs here; the stage removes lesson-level chrome only.
- **Scaffold authoring rule** for ADDING_TUTORING_SCAFFOLD.md: every scaffold
  for a K-1-claiming primitive must include the STIMULUS beat (read load-bearing
  text aloud) and the DISAMBIGUATE beat (enact the question). Propose the doc
  edit after pilots 1–2 confirm the pattern.

## Done
- **deep-dive @ PRE — audit + `--fix`, READY pending live** (2026-07-14, user-observed
  K goats lesson: text-only Quick Quiz + unreadable "Read this section" button).
  Report: `deep-dive-PRE-2026-07-14.md`. Was PRIMITIVE-GAP + SCAFFOLD-GAP.
  - CATALOG: PRE-READER READ-ALOUD aiDirective ([QUIZ_READ_ALOUD]/[BLOCK_READ_ALOUD]
    word-for-word, overrides lesson one-sentence cap; [FACT_EXPLORE] reads card text
    first at PRE; [QUIZ_RETRY] answer-free hint). Probe: renders, 0 findings.
  - COMPONENT: `isPreReaderGrade` band-gate — quiz auto-reads itself on first view
    (IntersectionObserver once) + 🔊 replay, picture-primary options (optionEmojis),
    tap=choose, spoken retry hint + spoken explanation, chrome hidden (counts,
    attempts, protocol text). Prose → one big "🔊 Read to me". 7/7 jsdom tests
    (`MultipleChoiceBlock.test.tsx`). **TU-5 closed en route** (12 onAskTutor
    forwards made silent).
  - GENERATOR: PRE palette (prompt + code-owned gate strips fill-in-blank/data-table/
    timeline/compare-contrast/perspectives/hypothesis-lab at K); MC emoji options
    required at K (all-or-nothing ship), ≤12w question / 1-4w options; key-facts one
    short sentence; prose exactly 2 short spoken-style paragraphs. Verified across
    3 K draws + 1 G4 regression draw (G4 unchanged, no emojis).
  - Follow-ups: live `--lesson` 3-run confirmation (needs bespoke deep-dive journey),
    browser glance, mini-sim prediction + diagram-label text at PRE if K draws start
    including them.
- **4b. word-sorter @ PRE — `--fix` complete, READY** (2026-07-14). Report (loop log):
  `word-sorter-PRE-2026-07-14.md`. All 4 slices shipped + verified:
  - CATALOG: aiDirectives ORIENT+STIMULUS beats; scaffold reworded eyes-free —
    tutor-test fail→**pass (0 findings)**; closes RF-1/RF-2 **and TU-3**.
  - COMPONENT: K staged-word presentation (tap-bucket=choose, `[WORD_STAGED]`/
    `[WORD_TAP]` spoken, bucket-flash feedback, chrome hidden) — 6/6 jsdom
    behavioral tests (`WordSorter.test.tsx`) + user browser check (RF-3).
  - GENERATOR: emojis required at K + bucketEmoji field — 15/15 fresh challenges
    full coverage (RF-4). ROUTING: match_pairs floored Grade 1+ (RF-5).
  - **Live `--lesson` 3/3 PASS** (zero confirmed findings; bespoke journey added to
    the harness): `qa/tutor-reports/word-sorter-live-lesson-2026-07-14.md`.
  - Residuals → K-stage systemic item: PhaseSummaryPanel ledger, "Next Challenge"
    text button. G1/EMERGING follow-up: match_pairs words not spoken on tap.
- **3. decodable-reader @ PRE/EMERGING — audit + `--fix`, READY** (2026-07-14).
  Report: `decodable-reader-PRE-2026-07-14.md`. Was WRONG-BAND at PRE (connected-text
  decoding is not a K skill) + PRIMITIVE-GAP + SCAFFOLD-GAP at EMERGING. Per user call:
  built a NEW in-primitive read-along mode rather than band-floor + external rebuild.
  - **PRE served by a new `read_along` eval mode** (Tier 0, β 0.5, K floor): the tutor
    reads the whole passage aloud (component `[READ_ALONG_START]` + catalog directive
    that overrides the lesson one-sentence cap), child answers a **picture** question.
    Generator forces K + a tiny 2-3 sentence passage + picturable question; stamps
    `readingMode` (renamed from `mode` — collided with eval-test's challenge-type
    field auto-detection, flipping status to fail).
  - **SCAFFOLD-GAP FIXED:** the comprehension question + every answer choice are now
    READ ALOUD (new catalog `aiDirectives` + `comprehensionChoices` forwarded into the
    bag; passage stays student-decoded in decode mode, by design). ORIENT beat on open.
  - **PRIMITIVE-GAP FIXED (K-1 band-gate):** single tap=choose **picture** options
    (generator requires a distinct `emoji` per option), no typing, no phoneme notation,
    chrome hidden (stepper/legend/counter/score-ledger/badges), larger warm passage,
    auto-finish review. Gr2+ decode UI unchanged.
  - **Generator reliability (user Q on orchestration):** kept the single call — schema
    is complex but essential (per-word tagging IS the interaction surface); hardened
    with `maxOutputTokens` + 2-attempt retry + short-passage prompt caps. NO orchestrator.
    `maxItems` bounds rejected by this @google/genai version (400) → caps live in prompt.
  - Verified: tsc clean; eval-test all modes `pass` (read_along→K tiny passage picturable
    options; literal/main_idea unaffected; distinct emoji 3/3 draws); tutor-test `--probe`
    pass 0 findings, all keys resolve from component; **live `--lesson` read_along 3/3
    clean** — passage + question + every choice read aloud, eyes-free ORIENT. Harness
    gained `build_decodable_reader_journey` (registered). Report:
    `qa/tutor-reports/decodable-reader-live-lesson-2026-07-14.md`.
  - Follow-ups: tap=choose click behavior wants a human browser glance (render+data
    verified, click not exercised headlessly); manifest routing K→read_along relies on
    the catalog `constraints` band-floor note — verify the resolver prefers it at K.
- **5. cvc-speller @ PRE — audit + `--fix`, READY** (2026-07-14). Report:
  `cvc-speller-PRE-2026-07-14.md`. All slices shipped same day: catalog
  SAY-THE-WORD `aiDirectives` beat (live `--lesson` 3/3: word said at the
  greeting/switch); struggle #3 + production invite eyes-free; bank tier-capped
  (union bug had defeated the distractor lever), Clear removed, one tap-ladder
  audio button, emoji-only cue → 11 elements; `short-a` slug + IPA leaks closed
  (generator title sanitizer caught a live IPA title immediately). **Bonus
  CRITICAL found by the new jsdom test (RF-6): evaluation was NEVER submitted**
  (session-end gates on `allChallengesComplete` made Finish unreachable) — fixed,
  regression-tested; sweep other `useChallengeProgress` consumers.
  `CvcSpeller.reader-fit.test.tsx` 4/4; suite 760/760. Live note (pre-existing,
  1/3): tutor spoke "[PRIMITIVE SWITCH]" aloud — harness TAG_SYNTAX_RE patched to
  catch spaced tags; root cause = lesson switch prompt (backend follow-up).
  - Audit-C chrome evidence (for K-stage): title, vowel/task badges, "1/N"
    counter, progress dots, begin/middle/end micro-labels, PhaseSummaryPanel
    percentage ledger remain in the child's field.
- **1b. addition-subtraction-scene @ PRE — typing + create_story** (2026-07-14,
  `--fix`). Report: `addition-subtraction-scene-PRE-1b-2026-07-14.md`.
  - **PRIMITIVE-GAP (rule 6/2) FIXED:** act-out + solve-story at K now answer via a
    tappable `NumberTileRow` (0…maxNumber, tap=choose, no keyboard, no Check). Grade 1
    keeps input.
  - **create_story REBUILT K-capable** (per user call: extend the primitive, don't
    ban the mode). At K it's a construction-judged "build the story" production task —
    add objects up to resultCount (addition) / remove down to it (subtraction),
    auto-judges, tutor reads the equation aloud (new `orientLineForChallenge`). The
    first-pass generator band-floor was **reverted** (generator `git diff` clean).
    Catalog create_story description updated ("build the scene… pre-reader capable").
    Grade-1 picker→builder is a queued follow-up (hollow there too).
  - Verified: tsc + typecheck:lumina 0-err; eval-test @ K (tile-answer-complete +
    build-ready data); tutor-test `--probe` pass 0 findings; **first Lumina component
    behavioral test** (`AdditionSubtractionScene.reader-fit.test.tsx`, jsdom) 3/3 —
    number-tile tap, add-build, remove-build all auto-complete. Full suite 745/745.
    Pixel-level visual still wants a human browser glance.
  - Infra: vitest.config gained `@vitejs/plugin-react` (declared devDep), `@` alias,
    and `.test.tsx` include so component behavioral tests run under `npm test`.
  - Chrome findings (mode tabs, counter, badges, ten-frame toggle) unchanged → K-stage
    systemic item.
- **2. comparison-builder @ PRE — scaffold P1–P3 + component P1** (2026-07-14, `--fix`).
  Report: `comparison-builder-PRE-2026-07-14.md`. Was PRIMITIVE-GAP + SCAFFOLD-GAP.
  - **Scaffold (catalog `math.ts`) — READY (probe-verified):** added the ORIENT+
    DISAMBIGUATE `aiDirectives` beat (read the question aloud + NAME the specific
    comparison per challenge type; overrides the lesson one-sentence cap; answer-free);
    rewrote `level3` answer-free (killed the `{{correctAnswer}}` spoken leak, TU-family);
    flattened `taskDescription`+`level2` (removed all `{{#if}}` handlebars). tutor-test
    `--probe` now `pass`, 0 findings, no literal handlebars.
  - **Component (`ComparisonBuilder.tsx`) P1 — READY (behaviorally verified):** at
    `gradeBand==='K'` the two group PICTURES + a middle `=` are the tappable answer
    surface (tap=choose, picture-primary) — no "More/Fewer/The Same" text buttons, no
    Check button. `checkCompareGroups(answerArg)` refactor evaluates the tapped side
    without a state-flush race. `ComparisonBuilder.reader-fit.test.tsx` 5/5 (jsdom);
    full suite 750/750; tsc + typecheck:lumina clean.
  - **Tutor beat live-confirmed:** Tier-3 `run_tutor_live.py --lesson --runs 3` (new
    bespoke `comparison-builder` journey + `--eval-mode` passthrough) → **3/3 PASS**,
    0 findings; the tutor reads the question + names the choice at every challenge
    start and in the lesson greeting (survives the one-sentence cap). Report
    `qa/tutor-reports/comparison-builder-live-lesson-2026-07-14.md`.
  - Remaining → item **2b**: component P2 chrome band-gate, rule-5 feedback-on-object,
    the other three eval modes. Pixel glance of the SVG still wants a human browser look.
- **4. word-sorter @ PRE — audit** (2026-07-14, no `--fix`). Report:
  `word-sorter-PRE-2026-07-14.md`. Overall **PRIMITIVE-GAP**; all 3 modes fail
  ORIENT/STIMULUS/DISAMBIGUATE/RECOVER; Audit C 6/8 FAIL (two-tap, text-primary,
  8-13 elements, "N wrong" badge, chrome). match_pairs @ PRE = WRONG-BAND (text
  rhyme-matching). Scaffold confirmed broken via probe: `{{currentWord}}`/
  `{{correctCategory}}` → `(not set)`, `[word]` literal, hardcoded noun/verb hints
  wrong for non-grammar sorts. Fix slices queued as item 4b.
  - Audit-C chrome evidence (for K-stage): "1 / 3" counter badge, "N wrong" amber
    badge, challenge-type badge, description paragraph, WORDS/MATCHES column
    headers, PhaseSummaryPanel score ledger — all in the child's field.
- **1. addition-subtraction-scene @ PRE — STIMULUS + ORIENT** (2026-07-13,
  `--fix`). Report: `addition-subtraction-scene-PRE-2026-07-13.md`. Made read-aloud
  a mandatory catalog `aiDirectives` beat (overrides the lesson one-sentence cap);
  fixed `{{instruction}}`→`(not set)` by forwarding `instruction` into the
  component bag. Verified: tutor-test `pass` (0 findings); lesson-mode live 3/3 read
  the full story verbatim. Chrome/typing follow-ups → item 1b. Harness gained a
  bespoke journey + `--lesson` flag + `stimulus-not-read` oracle.
  - Audit-C chrome evidence (for K-stage): `LuminaModeTabs`, `LuminaChallengeCounter`,
    "Kindergarten"/operation `LuminaBadge`, ten-frame toggle all sit in the child's
    field — per-primitive internal chrome the stage MVP does not yet remove.
