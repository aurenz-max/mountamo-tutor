# Reader-Fit Backlog

Working queue for `/reader-fit`. Top = next. Seeded 2026-07-13 from two live
user-observed K-lesson failures + the 2026-07-12 cognitive-load audit.
Re-seeded 2026-07-14 demand-side from the K topic-trace census (6 real K
subskills × LA/Math/SS; reports in `qa/topic-traces/k-*-2026-07-14.md`).

## Queue

### 2b. comparison-builder @ PRE — remaining slices (after 2026-07-16 fix) — **3 top priorities DONE 2026-07-16; tail (rule-5 + per-mode picture passes) still open**
Scaffold P1–P3 + component P1 (compare_groups tap-the-side) shipped 07-14; the three
Pulse-walk priorities (chrome band-gate, one_less symmetry, 🔊 Read-me) shipped 07-16.
Report: `qa/reader-fit/comparison-builder-PRE-2b-2026-07-16.md`. Contract:
`docs/contracts/comparison-builder.md` (edit assessed COMPATIBLE, no fork).
- ~~**Component P2 (chrome band-gate) — PEDAGOGY-CRITICAL.**~~ **DONE 2026-07-16.** At
  `gradeBand==='K'` (`isK`) the "Left: N / Right: N" count badges (the rule-#1 leak), the
  "Challenge 1 of N" counter, the mode tabs, and the "Kindergarten"/type badges are all hidden.
  Group pictures + middle "=" (answer surface, contract R1) kept. jsdom band tests: chrome
  absent@K, present@grade-1 control.
- ~~**one_more_less scaffold asymmetry.**~~ **DONE 2026-07-16.** Symmetric on both layers:
  component `voiceOtherOneMoreLess` fires a silent `[DISAMBIGUATE]` voicing the OTHER part after
  the child answers one (latched, answer-free); catalog ORIENT rewritten to voice "one less"
  identically to "one more". **Live `--lesson --runs 3` — decrement spoken 3/3.**
- ~~**On-demand instruction replay (generalizes).**~~ **DONE 2026-07-16.** Shared
  `primitives/shared/ReadMeButton.tsx` (thin `LuminaReadAloud` wrapper) rendered at K in the
  prompt row, SAME position across all four modes; re-voices instruction + answer-free ask.
  First instance of the systemic 🔊-Read-me item below.
- **Audit-C rule 5 (feedback on the object) — STILL OPEN:** wrong answer is still a text card +
  generic beep — make the tapped group flash/shake instead of a text card at K.
- **Other eval modes at PRE:** one_more_less (up to 21 number cells — rule 4 load),
  compare_numbers (< > = symbol reading), order (direction badge text) — each needs
  its own tap/picture-primary + disambiguate pass. (The bespoke live journey now
  supports all four types via `disambiguate_groups` — reuse it when fixing them.)
- ~~Behavioral confirm of the tutor beat~~ **DONE 2026-07-14** — live `--lesson` 3/3 PASS.

### 12. ten-frame `make_ten` @ K — direct-manipulation proxy (from the 2026-07-16 sibling audit)
Promoted from the "Direct-manipulation-first" systemic note (the census is done — see that note
for evidence). `make_ten` judges from a `counterCount + ___ = total` stepper (`TenFrame.tsx`
~923–947, `checkMakeTenAnswer` ~:461), NOT from the frame — though the K frame is seeded and the
empty cells are tappable (`handleCellClick` ~:308). **Fix (fork by mode+band, item-11 template):**
at K `make_ten`, empty cells become the tap-to-fill answer surface, auto-judge on the filled count,
stepper+Check removed at K; `subitize` (flash/hide → number legit) + `count_all` + Grade-1+ UI all
unchanged. Contract-first (`docs/contracts/ten-frame.md`). Executor: `/reader-fit --fix ten-frame`.
Full prompt: `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md` (Task 1). Reference: item 11.

### 13. counting-board `subitize` @ K — subitize DISPLAY fix (from the 2026-07-16 sibling audit)
Promoted from the systemic note. NOT a manipulation swap: the K `subitize` stepper
(`CountingBoard.tsx` ~1120–1144, judged ~:547) sits over objects that stay VISIBLE + tap-countable,
but genuine subitizing needs them to flash-then-hide. **Fix:** make K `subitize` flash/hide the
objects (mirror ten-frame subitize) → the number answer becomes legit; do NOT convert to
tap-counting (wrong skill). `count_all` unchanged; `count-on` is Grade-1 → EMERGING re-audit, not
here. Contract-first (`docs/contracts/counting-board.md`). Executor: `/reader-fit --fix counting-board`.
Full prompt: `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md` (Task 2). Reference: item 11.

### 9a. media-player — **PROMOTED to its own workstream 2026-07-16 (user-approved) — no longer worked from this queue**
Step 1 (contract) closed here; Steps 2–3 live in
`qa/media-player-reimagining/BACKLOG.md` (WORKSTREAMS ACTIVE stream 2). The historical item
below is kept for the record; do NOT pull it from this queue.

### ~~9a (historical)~~ media-player — REIMAGINE as a multi-band reading primitive (inspired by deep-dive / interactive-passage) — **user pivot 2026-07-16**
**This SUPERSEDES the prior "picture-primary knowledgeCheck band-gate (helper fits)" plan.** User
call 2026-07-16: media-player was an early ambitious primitive; now that deep-dive and
interactive-passage exist, its segment + per-segment-MCQ design comes up short as a *reading*
surface. A narrow PRE band-gate would polish a primitive whose overall design is the real gap.
The play is a reimagining, not a `--fix`.
- **Step 1 — contract FIRST — ✅ DONE 2026-07-16** (`/primitive-contract media-player --census`).
  Contract: `docs/contracts/media-player.md` (status **CONFLICTED** — C1 open by design, resolution
  = this reimagining). Census: `qa/topic-traces/media-player-census-2026-07-16.md`. **Blast radius
  is SMALL and clean:** live consumers = 2 authored G1 social_studies listening subskills
  (SS001-05-c/SS004-05-c, route 2/2, constraints literally describe the current shape) + occasional
  K explainer routing (1/6 fresh, 2/6 on 07-14) + tutor narration (sweep PASS) + 1 calibration doc
  (2 obs, β 2.9, single `default` identity — cheap to migrate). **Zero G3 routing** — "grades 3+"
  is fiction. **Step-2 fuel:** curriculum-fit probe found the LA listening-comprehension family at
  every band (K scattered 0.731 main-idea-after-listening; **G1 0.767 `LA007-06-a`/`LA007-01-a` —
  authored to the PHANTOM `listen-and-respond`, i.e. unserved real demand**; G2 **MATCH 0.774**
  LA003 recount/evidence family). Keep-true list = contract R1–R7 (narrated segment walkthrough,
  Gemini-Live narration beats + contextKeys, checks answerable from narration alone, no answer
  leak, 3-attempt reveal+skip, single MediaPlayerMetrics submission, on-demand visuals); R8 grade
  handling is the sanctioned rebuild zone. MP-1/MP-2/MP-3 (title echo / CTA fold / no evalModes)
  must clear in the rebuild. Boundary (contract G5): don't absorb read-aloud-studio (production),
  decodable-reader (decoding), interactive-passage (text reading).
- **Step 2 — modality map across bands:** define the reading modalities media-player should serve at
  **K (PRE)**, **EMERGING (grade 1)**, and **ESTABLISHED (grade 2+)** — e.g. PRE = read-aloud +
  picture-primary comprehension check; EMERGING = read-along with light decoding + tap comprehension;
  ESTABLISHED = richer interactive segments (annotate/predict/evidence) in the deep-dive spirit.
  Borrow proven capabilities from deep-dive + interactive-passage rather than re-inventing (their
  PRE read-aloud palette, picture-primary MCQ, block model). Cross-check `/curriculum-fit` so the
  reimagined modes have real homes.
- **Step 3 — build the new capabilities, band by band:** treat like the reimaginings family
  (hydraulics/dump-truck/excavator template, but reading-focused). New/rebuilt eval modes via
  `/primitive` layers + `/add-eval-modes`; **fork on any contract conflict** (eval-mode split → band
  gate → config axis → variant) — never edit in place over a requirement Step 1 surfaced. Close each
  band with `/eval-test` + `/reader-fit` (PRE first, the observed K demand). The old
  `PreReaderSelfCheck` helper still applies to whatever ends up as a PRE picture-MCQ.
- **Preserved from the old plan (still true, feed into Step 2):** per-segment `knowledgeCheck.options`
  + `correctOptionIndex`; script + KC already auto-narrated (`[READ_ALOUD]`/`[READ_KNOWLEDGE_CHECK]`);
  generator reads `inferGradeLevel(ctx.gradeContext)` and should move to `ctx.grade` + stamp
  `gradeLevel`; catalog `constraints` say "grades 3+" but census routes it at K — the band floor is
  wrong and must be reconciled in the reimagining. **Scope note:** this is a heavier slice than the
  rest of the tail (#9b–#9d) — it may warrant promotion to its own short workstream once Step 1's
  contract shows the blast radius. Executors: `/primitive-contract` → `/curriculum-fit` → `/primitive`
  / `/add-eval-modes` → `/eval-test` + `/reader-fit`.

### 9b / 9c / 9d — explainer-tail bespoke — **ALL THREE READY @ PRE 2026-07-16 (see Done).**
concept-card-grid (9b), comparison-panel (9c), flashcard-deck (9d) all shipped their PRE
band-gate + ctx-native generator refactor + catalog PRE-READER directive. Residual for each =
Tier-3 live `--lesson` + pixel (→ HUMAN-CHECKS). With #9b–#9d closed, the K explainer tail drains.

### Lesson-mode sweeps (after pilots 1–2 prove the loop)
- `/reader-fit --lesson "Count to tell the number of objects — up to 5" kindergarten`
  (the observed lesson)
- One K addition/subtraction lesson end-to-end.
- DONE demand-side via topic-trace census 2026-07-14 (6 K subskills, LA/Math/SS):
  reports `qa/topic-traces/k-*-2026-07-14.md`. Re-run the census at grade 1
  (EMERGING) once the K queue drains.

## Systemic items (accumulate evidence, don't fix per-primitive)
- **Direct-manipulation-first for K "act out / build" scenes (seeded 2026-07-16).** Where a K
  story text promises a physical action ("drag them away", "add more", "put them in"), the K
  interaction MUST be that manipulation — the child enacts the scene and the answer is *derived
  from what they built/removed*, never entered via a number/text proxy. Ref user ruling
  `direct-manipulation-first`. First instance = addition-subtraction-scene `act_out` (item 11)
  — **CLOSED 2026-07-16** (see Done; the seed→tap-add/remove→auto-judge template + the
  deterministic tap-accurate instruction are the reusable pattern for the rest of this class).
  - **Sibling audit 2026-07-16** (Explore sweep of all ~60 `visual-primitives/math/` primitives;
    candidates for the SAME read-then-tap-a-number proxy over a manipulable scene, recorded NOT fixed):
    - **STRONG — `ten-frame` make-ten phase.** `TenFrame.tsx:923–947` renders a make-ten stepper
      (`counterCount + ___ = totalCells`, +/- over `makeTenInput`), judged in `checkMakeTenAnswer`
      (`:461`) from the stepper — NOT from the frame. The K ten-frame is seeded with `counterCount`
      counters and shows empty cells the child can physically tap to fill (`handleCellClick:308`
      only blocks taps during the *subitize* answer phase), but those taps don't drive the judged
      answer. Make-ten (K.OA.4) should be enacted by placing counters into the empty cells and
      auto-judged on the filled count. (The *subitize* phase in the same file is NOT an instance —
      counters are flashed then hidden, so a number answer is correct there.) Executor when picked:
      `/reader-fit --fix ten-frame PRE` — reuse item-11's seed→tap-fill→auto-judge template.
    - **POSSIBLE — `counting-board` subitize phase.** `CountingBoard.tsx:1120–1144` (stepper "How
      many do you see?", judged `:547`) sits over a countable scene that is NEVER flashed/hidden
      (objects stay visible) and IS tap-countable in the sibling `count_all` phase
      (`handleObjectTap:476`, answer = `countedObjects.size` — the good pattern). Subitizing argues
      for a number answer, but because the objects are fully visible + demonstrably tappable, decide
      whether K subitize should flash/hide (like ten-frame) or accept enacted taps. Its `count-on`
      phase (`:1146–1173`, judged `:609`) is the same defect but is a **Grade-1** challenge type
      (catalog `:2032`) — just above the K band; note for the EMERGING re-audit.
    - **NOT instances (checked + cleared):** number-bond (missing-part/fact-family are pure-symbol —
      `BondDiagram` draws pips only when counters are passed, which those modes don't; decompose uses
      tap-to-place = good), compare-objects (`type=number` is Grade-1 `non_standard` measurement; K is
      object tapping), length-lab (`TilingWorkspace` derives from `placedUnits` = good), ordinal-line
      (tap the character = manipulation), sorting-station (tap IS the manipulation). Pure
      symbol/equation, place-value, geometry, and upper-grade primitives are out of scope.
    - **PROMOTED to discrete fix items 2026-07-16** (user durability call): ten-frame make-ten →
      **item 12**, counting-board subitize (display fix) → **item 13**. coin-counter `count-like` =
      the one un-swept gap → confirm/clear as Task 3. Execution handoff (ten-frame first):
      `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`. The sibling audit above IS the census
      of record — do NOT re-sweep.
- **On-demand instruction replay across K eval modes (seeded 2026-07-16).** Every K math primitive
  should expose a persistent LuminaReadAloud "🔊 Read me" that repeats the current
  instruction/question, in a CONSISTENT position across all of that primitive's eval modes (so a
  struggling non-reader can always re-hear the ask). **First instance BUILT 2026-07-16 on
  comparison-builder (item 2b)** — the shared carrier is `primitives/shared/ReadMeButton.tsx`
  (`buildReadMeMessage` + `<ReadMeButton>`, a thin `LuminaReadAloud` wrapper; student-initiated →
  non-silent). The pattern is now proven; **generalize** by dropping `<ReadMeButton>` into the
  prompt row of the other K math primitives (gate on the primitive's `isPreReaderGrade`/K signal,
  route `onAskTutor` to a non-silent `sendText`, supply an answer-free per-mode `ask`).

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
- **9b / 9c / 9d. Explainer-tail bespoke @ PRE — ALL THREE READY (2026-07-16).** The three
  explainer-tail surfaces that did NOT fit the fact-file MCQ helper (each bespoke). Shared pattern:
  ctx-native generator refactor (read `ctx.grade`) + stamp `gradeLevel` + code-attached flat emoji
  (dodges the flash-lite nested-array footgun) + a catalog PRE-READER READ-ALOUD `aiDirective`
  (overrides the lesson one-sentence cap) + a component `isPreReaderGrade(data.gradeLevel)` band-gate.
  Reports: `concept-card-grid-PRE-2026-07-16.md`, `comparison-panel-PRE-2026-07-16.md`,
  `flashcard-deck-PRE-2026-07-16.md`.
  - **9c comparison-panel** — the boolean gate renders as a **picture true/false** (👍/👎) via the
    shared `PreReaderSelfCheck` (a boolean gate IS a 2-option self-check), tap=choose, statement
    read aloud on view + 🔊; chrome hidden (Option A/B, VS, "Comprehension Check N of M", synthesis
    prose → spoken). `{{#if}}` handlebars check = clean.
  - **9b concept-card-grid** — emoji card FACE (`cardEmoji`) + **read-aloud-on-flip**
    (`[CARD_READ_ALOUD]` reads name+definition+curiosity note); chrome hidden ("Exhibit 0N", "Flip
    to Analyze", section labels, el.type badge, "Return to Artifact"). New PRE-READER directive.
  - **9d flashcard-deck** (largest) — **authored a whole NEW catalog `tutoring` block** (there was
    none) + wired `useLuminaAI` in the component (was none). Emoji face, auto-start, `[FLASHCARD_SHOWN]`
    voices the term, `[FLASHCARD_READ_ALOUD]` reads the card on flip, 🔊 replay, deck capped to 6 at K,
    chrome hidden (counter/dots/"Click to Reveal"/sublabels), wordless 🎉 summary.
  - Verified (all three): `typecheck:lumina` **0**; **full vitest suite 799/799**; new jsdom suites
    **15/15** (`ComparisonPanel`/`ConceptCard`/`FlashcardDeck.reader-fit.test.tsx`); eval-test @ K
    (each stamps `gradeLevel:'K'` + distinct picturable emojis, ≤12w copy); tutor-test `--probe` @ K
    **PASS 0 findings** (directives resolve, 0 `(not set)`, no `{{#if}}`).
  - Residual (each): Tier-3 live `--lesson` behavioral confirmation (needs a bespoke journey in
    `run_tutor_live.py` + backend) + pixel look → **HUMAN-CHECKS**. Mechanism = the proven
    cap-overriding catalog directive carrier (foundation-explorer / fact-file / knowledge-check).
- **11. addition-subtraction-scene @ K — `act_out` TRUE direct manipulation, READY + USER-CONFIRMED LIVE (2026-07-16).**
  Report: `addition-subtraction-scene-item11-2026-07-16.md`. The 2026-07-16 Pulse finding: subtraction
  `act_out` promised "drag them out of the scene" but the only interaction was a `NumberTileRow` (a
  proxy number). Fixed as a **fork by band + mode** (contract-first: `docs/contracts/addition-subtraction-scene.md`
  derived first).
  - **COMPONENT:** at `gradeBand==='K'`, `act_out` seeds the scene with the story's `startCount`; the
    child taps ＋ to bring `changeCount` more in (addition) or taps objects to send them away
    (subtraction); auto-judges the instant the enacted count equals `resultCount` (reuses the
    create-story build machinery). No `NumberTileRow`/Check at K `act_out`. **Grade 1 `act_out`
    untouched** (count-the-scene); `solve_story` keeps tiles (1b); `create_story` keeps its build (1b).
  - **GENERATOR:** de-"drag"-ed the promptDoc + a **deterministic code-owned** K `act_out` instruction
    ("Tap to bring N more X in!" / "Tap N X to send them away!") so the spoken `{{instruction}}`
    DISAMBIGUATE beat always matches the tap UI. Names `changeCount` only, never `resultCount`.
  - **CATALOG:** description reconciled; `act_out` evalMode desc was ALREADY "Manipulate objects in
    scene" — restored, not changed. **No schema change** — `start/change/result` already model the scene.
  - Verified: touched files tsc 0; **vitest jsdom 5/5**; eval-test @ K (4 tap-accurate `act_out`
    challenges, no leak); **live `--lesson --runs 3` 3/3 CONFIRMED** (story read aloud + tap
    instruction voiced + ORIENT restates the tap action), report
    `qa/tutor-reports/addition-subtraction-scene-live-lesson-2026-07-16.md`.
  - Residual: pixel/feel of the ＋ control + tap-remove → HUMAN-CHECKS. Sibling K scene primitives
    with the same proxy → recorded under the systemic "direct-manipulation-first" item.
- **9. Explainer tail @ PRE — pilot foundation-explorer READY + shared helper + fact-file
  swept; tail reconciled (2026-07-15).** Report: `explainer-tail-PRE-2026-07-15.md`.
  - **Pilot `foundation-explorer` @ PRE — READY** (PRIMITIVE-GAP + SCAFFOLD-GAP → fixed).
    CATALOG PRE-READER READ-ALOUD `aiDirective` (definition + question + every option
    verbatim, answer-free, overrides one-sentence cap); COMPONENT `isPreReaderGrade`
    band-gate (one concept at a time, auto-advance, prose→"🔊 Read to me", self-check via
    the new shared `PreReaderSelfCheck`, chrome hidden); GENERATOR K prompt (≤12w question,
    picturable options, no phantom/leak) + required distinct `optionEmojis` + `gradeLevel`
    stamp. Verified: tsc 0-new + `typecheck:lumina` 0; **jsdom 6/6**
    (`FoundationExplorer.reader-fit.test.tsx`); eval-test @ K **3/3** draws (emojis
    complete+distinct, q≤9w, correctIndex varies); **live `--lesson --runs 3` 3/3** (bespoke
    `build_foundation_explorer_journey`) — definition + question + every option read aloud,
    survives the cap (`qa/tutor-reports/foundation-explorer-live-lesson-2026-07-15.md`).
  - **Shared helper `primitives/shared/PreReaderSelfCheck.tsx`** — the reusable PRE MCQ
    self-check (`useAutoReadOnView` + `buildSelfCheckReadAloud` + `<PreReaderSelfCheck>`:
    emoji-primary, tap=choose, auto-read + 🔊, eliminate-until-correct, eyes-free RECOVER).
  - **Swept `fact-file` @ PRE — READY (pending live).** Helper swap: CATALOG
    `[FACTCHECK_READ_ALOUD]`/`[FACTCHECK_RETRY]` directive; COMPONENT PRE render bypasses the
    text tab-exploration gate + presents self-checks via `PreReaderSelfCheck`; GENERATOR flat
    `option*Emoji` (sidesteps flash-lite nested-array drop) + `gradeLevel` stamp. Verified:
    tsc 0-new + `typecheck:lumina` 0; **jsdom 6/6** (`FactFile.reader-fit.test.tsx`); full
    suite **773/773**; eval-test @ K **2/2** (emojis complete+distinct, q≤8w). Live `--lesson`
    queued (mechanism = the proven pilot directive).
  - **Tail reconciled — NOT one shape** (5-agent structural map). Only fact-file fit the
    MCQ helper. Deferred as distinct items with their (different) treatments: **#9a
    media-player** (helper fits; heavier), **#9b concept-card-grid** / **#9c comparison-panel**
    / **#9d flashcard-deck** (bespoke: no MCQ; need ctx-native generator refactors + grade
    threading; flashcard-deck needs a whole catalog `tutoring` block). User scope call: fact-file
    only this slice. take-home-activity band-exempt (parent-facing).
  - Residuals → HUMAN-CHECKS (emoji-grid pixel look, both primitives) + K-stage systemic
    (PhaseSummaryPanel / results % ledgers). foundation-explorer stall answer-leak (observational).
- **10. word-workout + word-flip @ PRE — audit + `--fix`, both READY (2026-07-15).**
  The PRE band audit that stayed open after the 07-14 scope/routing fixes (those NOT
  re-touched). Report: `word-workout-word-flip-PRE-2026-07-15.md`.
  - **word-workout: SCAFFOLD-GAP + PRIMITIVE-GAP → READY** for `real_vs_nonsense` /
    `picture_match` / `word_chains` (the K CVC census route); **`sentence_reading` =
    WRONG-BAND at PRE → floored to Grade 1+** (connected-text decoding, decodable-reader
    precedent; catalog `constraints` band-floor). Fixes: GENERATOR stamps `gradeLevel`
    (`resolvePreReaderGradeKey`); COMPONENT `isPreReaderGrade` band-gate (header chrome +
    **"Vowels: a" scope-leak label** + counter + progress hidden; per-mode instruction
    sentences hidden; text feedback card hidden; PRE `[ACTIVITY_START]` voices the per-mode
    play action answer-free; real grade → `useLuminaAI`); CATALOG **PRE-READER HOW TO PLAY**
    `aiDirective` (durable cap-overriding ORIENT). **live `--lesson --runs 3` 3/3 PASS**
    (bespoke `build_word_workout_journey`): tutor voiced "Read each word out loud…" every
    run, survived the one-sentence cap, never read the chain words for the child.
  - **word-flip: band decision = NOT WRONG-BAND → HONORED core, chrome PRIMITIVE-GAP fixed
    → READY.** The 07-14 "likely floor to G1+" hypothesis was WRONG: plural_s is a genuine
    K oral-grammar skill (regular plurals ≈ L.K.1.c), the catalog claims K, and it is the
    reader-fit skill's OWN PRE reference model (`SKILL.md:70`, voice-first counted-picture
    frame). Flooring would delete a legitimate K primitive. Fix = COMPONENT `isPreReaderGrade`
    band-gate (counter/tally/progress/mode badge/voice-toggle + start-screen badge + consent
    essay hidden; frame + mic + chips + start buttons remain) + CATALOG new `tutoring` block
    with a **PRE-READER ORIENT** `aiDirective` (was NO tutoring block). tutor-test --probe
    pass, 0 findings.
  - Verified: tsc 0-new + `typecheck:lumina` 0; **jsdom WordWorkout 9/9 + WordFlip 7/7**
    (chrome hidden at K, present at Grade-1 control; ORIENT answer-free); literacy 38/38;
    intent-contract 1/1. Live report: `qa/tutor-reports/word-workout-live-lesson-2026-07-15.md`.
  - Residuals: pixel → HUMAN-CHECKS #17 (word-workout) / #18 (word-flip); PhaseSummaryPanel
    ledgers → K-stage systemic; word-flip live run = optional belt-and-suspenders.
- **8. rhyme-studio @ PRE — audit + `--fix`, READY (2026-07-15).** Overall
  PRIMITIVE-GAP + SCAFFOLD-GAP → **READY @ PRE for recognition + identification**
  (the two K census routes); production floored to Grade 1+ (WRONG-BAND at PRE — Tier 4,
  word-bank distractors can't be pictured). Three layers, one loop:
  - **CATALOG (RF-1, scaffold gap):** PRE-READER READ-ALOUD `aiDirective` — on
    `[ACTIVITY_START]`/`[PHASE_TRANSITION]`/switch at Grade K, SAY both words (recognition)
    or target + every option (identification) and ASK the rhyme question, answer-free,
    overriding the one-sentence cap; `comparisonWord`+`optionWords` added to `contextKeys`
    and forwarded from the component bag (were absent — no durable directive could name them).
  - **COMPONENT (RF-2, primitive gap):** `isPreReaderGrade` band-gate — emoji-primary word
    cards (word → caption), recognition answers become a big 👍/👎 icon, identification tiles
    emoji-primary, question sentences hidden (tutor voices them), text feedback card hidden
    (ring + SFX + spoken carry it), chrome hidden (title/Grade/mode badges, counter, "N correct"
    ledger, progress bar, start paragraph), Next/Finish → wordless ▶/🎉. tap=choose already held.
  - **GENERATOR (RF-3, primitive gap + reliability):** flash-lite **silently drops the nested
    `options` array when also asked for emojis** (confirmed: grade-1 no-emoji → options present;
    K emoji-ask → 9/9 empty-option fallbacks). Fix: constrain K word choice to a curated
    picturable menu (`K_RHYME_FAMILIES`, ≥3/family, injected into the prompt) and attach the
    depicting emoji **deterministically in post-process** (`kEmojiFor`; ⭐ only on a menu miss);
    production floored out of the K mix. eval-test @ K: 9/9 identification real distinct emojis,
    0 fallback, 0 rhyme-logic errors.
  - Verified: tsc 808/808 (0 new) + `typecheck:lumina` 0; **jsdom 6/6**
    (`RhymeStudio.reader-fit.test.tsx`); tutor-test `--probe` — `comparisonWord`/`optionWords`
    resolve `by component`, no new findings; **live `--lesson --runs 3` PASS both K routes**
    (bespoke `build_rhyme_studio_journey`): recognition 3/3 ("cat … hat. Do these words rhyme?"),
    identification 3/3 ("Listen to 'cat'. The options are 'hat' or 'pig'. Which one rhymes?") —
    words + question voiced every run, surviving the one-sentence cap. Reports:
    `qa/reader-fit/rhyme-studio-PRE-2026-07-15.md`; live
    `qa/tutor-reports/rhyme-studio-live-lesson-2026-07-15.md` (recognition) +
    `…-identification-2026-07-15.md`.
  - Cross-check: does NOT duplicate poetry-lab `rhyme_hunt` @ K (different primitive/route;
    `project_poetry-lab-rf-fix-rhyme-hunt`). Grade-fidelity `clampGradeToK2` pin (`7cb5e5f`) intact.
  - Residuals → K-stage systemic: PhaseSummaryPanel % ledger. Pixel look → HUMAN-CHECKS.
    Scaffold `scaffoldingLevels` stacked-questions WARN (pre-existing, non-blocking).
- **7. phonics-blender @ PRE — audit + `--fix`, READY (2026-07-15).** Overall
  PRIMITIVE-GAP + minor SCAFFOLD-GAP → **READY @ PRE for `cvc`** (the only K-band
  eval mode; cvce_blend/digraph/advanced are Grade 1-2 by the catalog + the
  `clampGradeToK2` pin, not re-touched). Two findings, one loop:
  - **CATALOG (RF-1, scaffold gap):** PRE-READER HOW TO PLAY `aiDirective` — voices
    a play action (tap the sounds → put them in order → say the word) at
    `[ACTIVITY_START]`/`[PHASE_TO_BUILD]` at Grade K, answer-free, overriding the
    lesson one-sentence cap. STIMULUS was already spoken on tap via
    `[PRONOUNCE_SOUND]` (per-tap, un-capped) → only ORIENT needed the durable carrier.
  - **COMPONENT (RF-2, primitive gap):** K band-gate (`isPreReaderGrade`) — tiles
    **letter-primary** (was `/k/` slash notation, rule 6), phase stepper + word
    counter + Grade/pattern/phase badges hidden (rule 7), instruction labels hidden
    (tutor voices them), text feedback card hidden (slot flash + SFX + spoken hint
    carry it, rule 5), Clear dropped (tap a placed tile to remove). Arranging the
    sounds stays a multi-part construction → **Check kept** (rule 2). Reader grades
    unchanged.
  - Verified: tsc 808/808 (0 new) + `typecheck:lumina` 0; **jsdom 7/7**
    (`PhonicsBlender.reader-fit.test.tsx`); eval-test `cvc` @ K pass (emoji present);
    tutor-test `--probe` 0 findings; **live `--lesson` 3/3 PASS** (bespoke
    `build_phonics_blender_journey`) — tap/listen action + word voiced at
    activity-start, "put the sounds in order" at build, next word named on advance,
    all surviving the one-sentence cap. Report:
    `qa/reader-fit/phonics-blender-PRE-2026-07-15.md`; live:
    `qa/tutor-reports/phonics-blender-live-lesson-2026-07-15.md`.
  - Residuals → K-stage systemic: PhaseSummaryPanel ledger + "Ready to Build!"/
    "Blend!"/"Say it!" button labels. Pixel look → HUMAN-CHECKS. Grade-fidelity
    `clampGradeToK2` pin (`7cb5e5f`) left intact.
  - **Follow-up (queued by contract derivation 2026-07-15, executor `/tutor-test`):**
    the component emits `[PRONOUNCE_SOUND]` on tap but the catalog `PRONUNCIATION
    COMMANDS` directive (`literacy.ts:221`) triggers on `[PRONOUNCE]` — a tag-prefix
    mismatch. STIMULUS-on-tap is jsdom-verified (the emit) but **unverified at
    runtime** (Gemini's spoken response), because the live-lesson runs never tapped a
    tile. Add a tap-pronounce beat to the bespoke journey / probe to confirm the
    tutor actually speaks the sound on tap. Low risk (the message body is
    self-executing) but a real latent smell. Do NOT rename the tag in place without a
    `/primitive-contract phonics-blender --check` run — it touches every reader
    grade's audio path (contract R2).
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
