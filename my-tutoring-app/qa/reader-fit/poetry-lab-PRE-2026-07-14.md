# Reader Fit: poetry-lab @ PRE — 2026-07-14

Modes audited: analysis (composition assessed from source — typing-gated, no draw needed)
Probes: eval-test ✓ (3× K + 1× grade-3 contrast) | tutor-test --probe ✓ (`no-scaffold`) | live standalone ✗ (blocked — see F1) | live --lesson ✗ (blocked)

Trigger: user-observed live K lesson ("Little Cat's Big Adventure", obj1-nursery-rhyme) —
no mood options rendered, Next button dead, no read-aloud, no completable task.

## Headline

**The user's screenshot is reproducible 4/4 draws at EVERY grade, not just K.** The
generator's schema requires only `title`/`gradeLevel`/`mode`; flash-lite drops
`correctMood`/`moodOptions`/`figurativeInstances` every draw (K ×3, grade-3 ×1), the
mood phase renders zero option buttons, and `Next` is `disabled={!selectedMood}` →
**hard deadlock at phase 1, all bands**. eval-test reports `status: pass` because the
route's validation only counts challenge types — a false-pass class.

Even with perfect content, K deadlocks again at phase 2: the K grade note mandates
"NO figurative language" but the figurative phase gate is
`disabled={foundFigurative.size === 0}` — unsatisfiable with zero instances.

## Audit A — text census (worst case = the actual 4/4 draw shape)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| Poem text (4 lines) | generated | Load-bearing (the stimulus) | none — component has NO audio path despite catalog claiming "TTS read-aloud with expressive prosody" | UNCOVERED |
| "What mood or feeling does this poem create?" | component | Load-bearing (the question) | none | UNCOVERED |
| moodOptions word buttons (happy/sleepy/…) | generated | Load-bearing (answer surface is words, no pictures) | none | UNCOVERED — and MISSING 4/4 draws |
| "Next: Find Figurative Language" / "Back" / "Review" / "Submit" | component | Load-bearing protocol | none | UNCOVERED |
| "Tap the figurative language in the poem (N to find)" | component | Load-bearing protocol | none | UNCOVERED |
| "What is the rhyme scheme?" + `AABB`/`ABAB` option chips | component + generated | Load-bearing; abstract letter notation | none (and unspeakable at PRE) | UNCOVERED |
| "Found: N / M" counter | component | Adult chrome | — | rule 7 |
| Stepper labels (mood/figurative/rhyme/review), Grade/mode/template badges | component | Decorative chrome | — | rule 7 (and the template badge is WRONG — see F1) |
| Review stat grid (Mood / Figurative / Rhyme panels) | component | Load-bearing at review | none | UNCOVERED |
| Composition: `compositionPrompt`, `LuminaInput` lines, syllable `N/M` chips | component | Load-bearing + typing | none | UNCOVERED + rule 6 |

## Audit B — sufficiency contract

tutor-test: `"poetry-lab" has no tutoring block — it runs on the generic tutor (L0/L1)`.
There is no scaffold to audit; every column fails by absence. The component also never
calls useLuminaAI / sendText — no moments exist for a scaffold to fire.

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| analysis | ✗ | ✗ (poem never read aloud; the catalog's TTS claim is phantom) | ✗ | ✗ (nothing until Review; then a text stat grid) | ✗ |
| composition | ✗ | ✗ | ✗ | ✗ (syllable chips = quantitative text) | ✗ |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio instruction channel | FAIL | Zero audio anywhere in the component |
| 2 Tap = choose | FAIL | Every phase is select-then-read-"Next" protocol; 4-phase stepper |
| 3 Pictures are the answer surface | FAIL | Word buttons (mood), letter-notation chips (rhyme), tap-spans in running text (figurative) |
| 4 One thing / ≤5 elements | FAIL | Poem + 3-4 options + Back/Next simultaneously; figurative = N spans + counter + 2 buttons |
| 5 Feedback on the object, instant | FAIL | No per-answer feedback at all; score computed silently at Submit |
| 6 No typing | FAIL | Composition mode is `LuminaInput` free-text lines |
| 7 No adult chrome | FAIL | Stepper, Found-counter, badges, review stat grid, syllable `N/M` chips |
| 8 Assessment in mechanics | FAIL | Quiz-shaped MC + checklist through and through |

## Findings

**F1 — GENERATOR (HIGH, ALL grades): analysis draws ship without their required fields.**
`poetryLabSchema.required = ["title","gradeLevel","mode"]` while the per-mode REQUIRED
fields live only in prompt prose (`CHALLENGE_TYPE_DOCS`) — flash-lite ignores prose-only
requirements ([[flash-lite-truncation-template]] class). 4/4 draws missing
correctMood/moodOptions/figurativeInstances; `templateType` (a composition-only field)
leaks into every analysis draw, rendering a wrong badge ("Free-Verse" on an AABB
nursery rhyme). Fix: the generator already forks the schema per eval mode via
`constrainChallengeTypeEnum` — make the analysis variant REQUIRE
poem/poemLines/correctMood/moodOptions/rhymeScheme/rhymeSchemeOptions and OMIT
templateType/compositionPrompt/templateConstraints (and vice-versa for composition);
keep figurativeInstances optional (K mandates none) but bound it. → GENERATOR

**F2 — EVAL-TEST ORACLE (HIGH): false-pass.** The route validated this draw as
`status:"pass"` — it checks challenge types only, not mode-required fields. A
content-contract check (analysis ⇒ moodOptions non-empty ∧ correctMood ∈ moodOptions ∧
rhymeScheme ∈ rhymeSchemeOptions; offsets slice-verified) belongs in the eval-test
validator / a ContentOracle. → QA HARNESS

**F3 — COMPONENT (HIGH, ALL grades): unsatisfiable phase gates.**
Phase 1: zero moodOptions renders zero buttons and `Next` never enables ([PoetryLab.tsx:343](../../src/components/lumina/primitives/visual-primitives/literacy/PoetryLab.tsx)).
Phase 2: `disabled={foundFigurative.size === 0}` is impossible when
figurativeInstances is empty — which the K grade note REQUIRES ("NO figurative
language"). Fix: skip/auto-pass phases whose data is absent (mood without options,
figurative without instances), so the flow degrades to the phases the content
actually supports. → COMPONENT

**F4 — WRONG-BAND (overall verdict at PRE): analysis+composition cannot serve K by design.**
The K promise exists only in prose (catalog: "Perfect for grades K-6 … at K this means
nursery rhymes and identifying rhyming words"; generator K note: "Task = hear and
identify the rhyming words") — but the component has NO hear-and-identify-rhymes task.
Its analysis flow is silent-read poem → mood vocabulary words → tap figurative language
in running text → abstract AABB notation: a grades-2/3+ task identity (β 3.5 says so).
Composition is typing (β 6.0). The description also claims "TTS read-aloud with
expressive prosody" — **no audio code exists**; that phantom claim is what sells it
into K manifests. Fix: strip the phantom TTS sentence + K claims from
description/constraints; band-floor `analysis` at grade 2+ and `composition` at
grade 3+ (or 2+ with the acrostic/finish-the-rhyme templates). If K rhyme coverage is
wanted, that is a REBUILD-queue instrument (nursery-rhyme rhyme-pair tapper: hear two
words, tap if they rhyme / tap the picture that rhymes), not a fix to this component.
→ CATALOG (routing) + BACKLOG

**F5 — SCAFFOLD-GAP (HIGH even after band-flooring): no tutoring block, no moments.**
Orphaned to the generic tutor ([[orphaned-tutoring-configs]] class). At its true band
(grades 2-3, DEVELOPING) the poem is still load-bearing text needing a spoken twin and
the AABB notation still needs enacting. Needs `/add-tutoring-scaffold` with the
STIMULUS beat in catalog `aiDirectives` (lesson-cap-proof), plus useLuminaAI + phase
sendText moments in the component. → CATALOG + COMPONENT

**Overall: WRONG-BAND** (at PRE) — compounded by band-independent HIGH generator (F1)
and component-deadlock (F3) bugs that currently break the primitive at EVERY grade.
The live K failure was F1+F4 stacking: a primitive that shouldn't have been routed to
K, receiving content that would have deadlocked any grade.

Findings → fix layer: F1 GENERATOR · F2 QA HARNESS · F3 COMPONENT · F4 CATALOG
routing (+ optional REBUILD instrument) · F5 CATALOG+COMPONENT scaffold.
Suggested fix order: F1+F3 together (unbreaks all grades), F4 (stops K routing),
then F2, then F5.

## Fix status — 2026-07-14 (same day, /eval-fix)

- **F1 RESOLVED (GENERATOR).** `gemini-poetry-lab.ts` rewritten as a per-mode
  dispatcher: dedicated `analysisSchema`/`compositionSchema` with real `required`
  lists and no cross-mode fields (templateType leak impossible by construction).
  Offsets are no longer requested from the LLM — recomputed via `indexOf` (also
  closes legacy PL-1); `correctMood`/`rhymeScheme` membership guaranteed in
  post-process; template constraints derived from `templateType` (PL-2/PL-3).
  Verified: analysis ×3 grade-3 + ×1 K, composition ×1 — all fields present,
  offsets slice-verified. K draw = 4-line AABB nursery rhyme, figurativeInstances=[].
- **F3 RESOLVED (COMPONENT).** Phases whose data is absent are skipped
  (`computeAnalysisPhases`); scoring normalizes over present phases. K flow is
  now mood→rhyme→review. tsc-clean + K data path verified; **needs a browser
  drive of a K analysis lesson** before "verified" in full.
- **F4 RESOLVED — INTERIM (CATALOG).** Phantom TTS sentence + K claims stripped;
  re-banded analysis 2-6 / composition 3-6, explicit NOT-for-K-1. Product
  decision (user, 2026-07-14): rather than a separate rebuild instrument, K
  returns via a `rhyme_hunt` eval mode inside poetry-lab (Gemini Live reads the
  poem via a catalog `aiDirectives` STIMULUS beat; student taps the rhyming
  pair; feedback on the object + spoken twin) — built together with F5.
- **F2 OPEN** — tracked as PL-4 in EVAL_TRACKER (poetry-lab ContentOracle).
- **F5 OPEN** — next up with `rhyme_hunt` (`/add-tutoring-scaffold` + new mode).
