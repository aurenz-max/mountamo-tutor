# Reader-Fit Backlog

Working queue for `/reader-fit`. Top = next. Seeded 2026-07-13 from two live
user-observed K-lesson failures + the 2026-07-12 cognitive-load audit.
Re-seeded 2026-07-14 demand-side from the K topic-trace census (6 real K
subskills × LA/Math/SS; reports in `qa/topic-traces/k-*-2026-07-14.md`).

## Queue

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

### 7. phonics-blender @ PRE — audit rank 5 (census: demand CONFIRMED, routed 2/6 K lessons)
3-phase stepper, 4+ labeled-button taps/word; strong tutor speech already —
Audit C is the main event.

### 8. rhyme-studio @ PRE — audit (census: routed 2× in the K rhyme lesson, never audited)
Core K literacy surface (recognition + identification modes drawn in one lesson).
Data looks band-plausible (image descriptions per word) — audit ORIENT/STIMULUS
(are targetWord/comparison words SPOKEN?), option modality, chrome.

### 9. Explainer tail @ PRE — text-primary "reading" surfaces routed at K (census)
Batch-audit candidates, ranked by census routing frequency: **foundation-explorer**
(4/6 lessons — selfCheck prompts + 3 full-sentence text options at K),
**concept-card-grid** (3/6 — originStory/curiosityNote prose walls),
**comparison-panel** (2/6 — points/synthesis paragraphs), **fact-file**,
**flashcard-deck** (term/definition text cards), **media-player** (text
knowledgeCheck options; script is narrated ✓). Common shape → probably one
shared pattern: deep-dive's PRE treatment (auto-read + 🔊 + picture-primary
checks). Audit foundation-explorer first, extract the pattern, sweep the rest.
(take-home-activity also routed 2/6 but is parent-facing by design — band-exempt.)

### 10. word-workout + word-flip — PRE audit remaining (scope/routing FIXED 2026-07-14)
Scope-binding + routing slices DONE (see Done). **Remaining:** neither audited at
PRE (reader-fit band judgment) — that stays in this queue.

### Lesson-mode sweeps (after pilots 1–2 prove the loop)
- `/reader-fit --lesson "Count to tell the number of objects — up to 5" kindergarten`
  (the observed lesson)
- One K addition/subtraction lesson end-to-end.
- DONE demand-side via topic-trace census 2026-07-14 (6 K subskills, LA/Math/SS):
  reports `qa/topic-traces/k-*-2026-07-14.md`. Re-run the census at grade 1
  (EMERGING) once the K queue drains.

## Systemic items (accumulate evidence, don't fix per-primitive)
- **K-stage presentation mode — MVP BUILT 2026-07-13** (`KindergartenStage.tsx`,
  gated in `LessonScreen.tsx` via `kindergartenMode.ts`; auto-on for K lessons,
  Ctrl+Alt+K override). On-rails one-section-at-a-time with animated frame flow,
  wordless arrow advance gated on section completion, tutor `[SECTION_START]`
  narration. **MVP browser-VERIFIED 2026-07-15 (user)** — the on-rails flow works.
  Still open: per-PRIMITIVE internal chrome
  (counters/steppers inside components) is untouched — keep recording Audit-C
  chrome FAILs here; the stage removes lesson-level chrome only.
- **Scaffold authoring rule** for ADDING_TUTORING_SCAFFOLD.md: every scaffold
  for a K-1-claiming primitive must include the STIMULUS beat (read load-bearing
  text aloud) and the DISAMBIGUATE beat (enact the question). Propose the doc
  edit after pilots 1–2 confirm the pattern.

## Done
- **1e. sorting-station @ PRE — presentation audit + fix loop, READY (2026-07-15).**
  Overall was PRIMITIVE-GAP + SCAFFOLD-GAP → **READY @ PRE for `sort_one` (THE K census route)
  and `odd_one_out`**; `sort_attribute`/`count_compare`/`two_attributes`/`tally_record` =
  **WRONG-BAND, floored to Grade 1+** (K still routes to the two picture-primary tap modes).
  Fixes: CATALOG `aiDirectives` ORIENT/STIMULUS/DISAMBIGUATE beat (name every bin + ask the
  sort, overrides the lesson one-sentence cap) + band-floor descriptions/constraints + dead
  `studentAnswer` key removed; COMPONENT K band-gate (picture-primary `bucketEmoji` bins with
  color-circle fallback, chrome hidden, odd_one_out tap=choose auto-submit) + `instruction`
  forwarded into the bag; GENERATOR `categoryEmojis`→`bucketEmoji`. Verified: tsc 0-new +
  `typecheck:lumina` 0-err; **jsdom 6/6** (`SortingStation.reader-fit.test.tsx`); eval-test
  re-probe (bins carry a picture) + tutor-test re-probe (directive resolves); **live `--lesson`
  3/3 CONFIRMED** (bespoke `build_sorting_station_journey` in `run_tutor_live.py`). Report:
  `qa/reader-fit/sorting-station-PRE-2026-07-15.md`; live: `qa/tutor-reports/sorting-station-live-lesson-2026-07-15.md`.
  Residuals → K-stage systemic: PhaseSummaryPanel ledger, "Next Challenge" text button. Pixel
  look → HUMAN-CHECKS. Generator objective-drift was already FIXED 2026-07-14 (not re-opened).
- **1f. shape-tracer — CRITICAL generator bug (wrong shape↔path), RESOLVED + RUNTIME-VERIFIED**
  (2026-07-14, Handoff Task 1; reconciled into Done by `/pm` 2026-07-15 — was a stale-open here
  while already struck in EVAL_TRACKER). SHT-1 fix: a deterministic `placeShape()` affine-transforms
  canonical `SHAPE_VERTICES` under LLM-chosen cosmetic knobs, so `targetShape`/instruction/`tracePath`
  agree by construction and a wrong vertex count is structurally impossible across trace/connect_dots/
  complete. Code lives in `service/math/gemini-shape-tracer.ts`; EVAL_TRACKER row = 4/4 modes
  runtime-verified. Report: `qa/eval-reports/shape-tracer-2026-07-14.md`.
- **10 (scope/routing). word-workout + word-flip — CVC scope binding + routing, FIXED + VERIFIED**
  (2026-07-14, Handoff Task 3). Report: `qa/topic-fidelity/word-workout-word-flip-2026-07-14.md`.
  word-workout was FIDELITY BUG (masteredVowels defaulted to all five → chains left the
  topic vowel): added `resolveScopedVowels` (topic/objective → target short vowel),
  `buildScopePromptSection` + hard vowel rule, and a deterministic `sanitizeVowelScope`
  post-parse filter with per-vowel scoped fallbacks. Verified: short-a 3/3 draws = 15/15
  on-vowel chains, masteredVowels=['a']; non-scoped grade-1 topic stays multi-vowel.
  word-flip was WRONG PRIMITIVE (grammar mis-routed to decoding) → catalog routing lead
  ("GRAMMAR … NOT phonics/decoding"); verified 3/3 CVC-decode manifest runs no longer
  select it. typecheck:lumina 0; vitest 726/726. **PRE audit for both still open** (item 10).
- **1g. phoneme-explorer — ending-sound fidelity, FIXED + VERIFIED (routing)** (2026-07-14,
  Handoff Task 2). Report: `qa/topic-fidelity/phoneme-explorer-2026-07-14.md`. Was a
  three-layer over-claim: catalog advertised "match initial/final sound", generator teased
  "or ends with" + grade-1/2 "final/medial", but the component hardcodes "starts with" and
  cannot render ending/medial tasks. Verdict WRONG PRIMITIVE for rhyme (rhyme-studio /
  poetry-lab already serve it) → routing fix: catalog + generator now say INITIAL/beginning
  sounds ONLY. **Verified:** regression 15/15 isolate draws honor the beginning sound;
  manifest 3/3 runs no longer select phoneme-explorer for the rhyme objective (routes to
  rhyme-studio + poetry-lab). typecheck:lumina 0 errors. Follow-up filed: a real
  final-phoneme isolation capability (position field + component copy + oracle) is a
  primitive-expansion slice, not done here. PRE audit still open (emoji choices present).
- **1d. knowledge-check @ PRE — K CENSUS TOP FINDING, all 5 slices RESOLVED, READY**
  (2026-07-14, `--fix`). Report: `knowledge-check-PRE-2026-07-14.md`. Was
  PRIMITIVE-GAP + SCAFFOLD-GAP: every K census draw was a text-primary MCQ
  (rhyme/shapes text options — wrong modality + answer-leak; questions referencing
  visuals the generator never produced; options never read aloud), two-tap Verify,
  adult "terminal" chrome. knowledge-check is a CONTAINER over per-type problem
  primitives; every K draw resolved to multiple_choice/true_false (the real K
  route). Fix, one loop, 5 layers:
  - **CATALOG:** PRE-READER READ-ALOUD `aiDirective` (`[QUIZ_READ_ALOUD]` reads the
    question + EVERY choice aloud, overrides one-sentence cap, answer-free;
    `[QUIZ_RETRY]` eyes-free hint); scaffoldingLevels enact the question (say it)
    not narrate; struggles eyes-free. tutor-test `--probe` warn→**pass, 0 findings**.
  - **GENERATOR:** emoji-required **picture-primary** MCQ at K (`emoji` on each
    option, required), `PRE_READER_MC_PALETTE` (≤12w question, NO phantom-visual
    reference, no answer-leak, picturable options), **K type-floor** to
    multiple_choice/true_false (matching/categorization/sequencing/fill_in_blanks =
    WRONG-BAND at PRE, coerced out; orchestrated + direct paths). `MultipleChoiceOption.emoji?`.
  - **COMPONENT:** `MultipleChoiceProblem` PRE render — emoji grid, **tap=choose**
    (no Verify), auto-read on first view (IntersectionObserver) + **🔊 replay**,
    feedback on the tapped object; `KnowledgeCheck` threads `preReader`+`onAskTutor`
    (non-silent sendText) and hides terminal header/counter/badges/AI-Helper/
    Scratch-Pad at K. jsdom `MultipleChoiceProblem.reader-fit.test.tsx` **6/6**;
    suite **787/787**; tsc + typecheck:lumina clean.
  - **QA ORACLE:** `option-modality` (emoji on every MCQ option at PRE) +
    `reader-fit` WRONG-BAND (non-MCQ/TF type at PRE) checks; oracle tests **211/211**.
  - **LIVE `--lesson` 3/3 PASS** (0 findings): bespoke `build_knowledge_check_journey`
    added to the harness; the tutor read "Which one is a circle? A… Square. B…
    Circle. C… Triangle." in the lesson greeting/`[PRIMITIVE SWITCH]` path all 3
    runs — the read-aloud survives the one-sentence cap. Report:
    `qa/tutor-reports/knowledge-check-live-lesson-2026-07-14.md`.
  - **Residuals (queued):** true_false @ PRE needs the same PRE read-aloud/chrome
    treatment (container already forwards the props; component has no PRE branch);
    MCQ retry glyph + suppress the text rationale card at K (polish, tutor speaks
    it); spot-check more count-type MCQ draws; pixel browser glance; EMERGING
    (grade 1) complex-type routing re-audit once the K queue drains.
- **1c. poetry-lab — ALL slices RESOLVED** (2026-07-14, via /eval-fix + follow-on
  sessions; EVAL_TRACKER rows RF-1..RF-4 + PL-1..PL-4 all struck). Generator =
  per-mode dispatcher (RF-1); component phase-skipping (RF-2); catalog phantom-TTS
  + K claims stripped (RF-3); **rhyme_hunt K mode + tutoring scaffold SHIPPED**
  (RF-4: catalog ORIENT/STIMULUS/DISAMBIGUATE/RECOVER directives, component reads
  every round via Gemini Live, tutor-test + probe 0 findings, K lesson journey 2/2
  clean); three-mode ContentOracle registered (PL-4, 0/9 flaky). **Census
  confirmation 2026-07-14:** the K rhyme topic-trace routed poetry-lab in
  rhyme_hunt mode and the draw met the spec (4 rounds, one rhyme pair, emoji
  candidates) — K demand is being served in the wild. Residual: candidate emoji
  quality (mat→🧘) is content-polish, oracle guards structure.
- **6. letter-sound-link @ PRE — audit + `--fix`, READY (live-confirmed 3/3)** (2026-07-14). Report:
  `letter-sound-link-PRE-2026-07-14.md`. Was PRIMITIVE-GAP + SCAFFOLD-GAP — a strong
  audio-discrimination core whose two-tap **audition-then-commit** protocol (a legitimate rule-2
  multi-part confirm) and production invite were gated behind **10px text, never spoken**. Fixed
  by band-gating the COMMUNICATION, not deleting the mechanic. All 4 layers, one loop:
  - **GENERATOR:** `resolvePreReaderGradeKey(ctx)` stamps `gradeLevel` into the data (K→'K',
    grade1→'1', no over-gating). New `LetterSoundLinkData.gradeLevel?` field.
  - **SCAFFOLD (catalog):** two `aiDirectives` — **HOW TO PLAY** (voice the protocol per mode,
    answer-free, overrides the lesson one-sentence cap = durable ORIENT carrier) + **THEIR TURN
    TO SAY IT** (spoken production invite). tutor-test `--probe` pass, 0 findings, keys resolved.
  - **COMPONENT (K band-gate):** 10px "tap to hear/choose" → wordless **ear→check** glyphs;
    footer/task/shared-sound sentences hidden; keyword hint = emoji only; chrome hidden
    (Group/mode badges, counter); real grade → `useLuminaAI` (was hardcoded 'K'). Two-tap KEPT.
    `LetterSoundLink.reader-fit.test.tsx` 4/4; full suite **781/781**; tsc/typecheck:lumina clean.
  - **Live `--lesson` 3/3 PASS** (0 findings; report `qa/tutor-reports/letter-sound-link-live-lesson-2026-07-14.md`):
    the HOW-TO-PLAY protocol is voiced in the greeting AND `[ACTIVITY_START]` ("Tap a bubble to hear
    it… tap it again to keep it!"), keyword said, "Now YOU say sun!" fires on correct, protocol
    re-enacted on advance — durable carrier survives the one-sentence cap. Bespoke
    `build_letter_sound_link_journey` added to `run_tutor_live.py` `JOURNEYS`. Enabled by launching
    the backend `--reload-dir app` (writes under `tests/` no longer restart it).
  - Follow-up: human browser glance at the ear→check glyphs (pixel-only). Audit-C chrome for
    K-stage: **PhaseSummaryPanel % ledger + progress bar**.
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
    verified, click not exercised headlessly); ~~manifest routing K→read_along relies on
    the catalog `constraints` band-floor note — verify the resolver prefers it at K~~
    **VERIFIED 2026-07-14** via the K CVC topic-trace census: the manifest intent
    explicitly instructed read_along for K and the draw generated a K read-along
    passage with emoji comprehension options (`qa/topic-traces/k-cvc-short-a-2026-07-14.md`).
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
