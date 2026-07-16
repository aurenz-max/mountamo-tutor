# Reader Fit: explainer tail @ PRE — 2026-07-15 (BACKLOG #9)

The "text-primary explainer with a text-option check" family — **foundation-explorer**
(pilot), concept-card-grid, comparison-panel, fact-file, flashcard-deck, media-player —
all teach with prose then gate a section behind a small self-check whose OPTIONS are
full text phrases a non-reader can neither decode nor (often) not-answer-leak. Same shape
→ one shared PRE treatment, factored out and proven on the pilot before the sweep.

Pilot probes: eval-test ✓ (3 K draws) · tutor-test scaffold ✓ · **live `--lesson` ✓ (3/3)**

## Shared helper (extracted during the pilot, exercised by it)

`primitives/shared/PreReaderSelfCheck.tsx` — the reusable PRE self-check for this
family, mirroring how deep-dive (`MultipleChoiceBlock`) and knowledge-check
(`MultipleChoiceProblem`) each solved it bespoke:

- `useAutoReadOnView(enabled, onRead)` — fires the read-aloud ONCE when the check first
  scrolls ≥40% into view (IntersectionObserver, ref-guarded; these primitives stack many
  sections in one scroll, so mount-time firing would read every check at once).
- `buildSelfCheckReadAloud({ question, options, intro?, label?, tag? })` — the standard
  answer-free spoken STIMULUS body (read the intro prose, then the question, then every
  option slowly with its letter, then ask which they pick).
- `<PreReaderSelfCheck>` — emoji-primary 2-col option grid, **tap = choose** (no Check),
  auto-read + 🔊 replay, feedback on the touched tile (eliminate-until-correct — gentlest
  for K, no forced answer reveal), eyes-free spoken RECOVER hint on a wrong tap.
  Orchestration (which section, advance, scoring) stays with the parent.

The read-aloud SCRIPT is parent-supplied (only the parent knows the section prose to read
first) and enacted by each primitive's catalog **PRE-READER READ-ALOUD** `aiDirective`, so
it survives the lesson-mode one-sentence cap (the deep-dive/knowledge-check pattern).

## Pilot — foundation-explorer @ PRE

Census: routed in 4/6 K lessons; text-primary — per-concept `selfCheck.prompt` + 3
full-sentence text `options` at K (wrong modality + reading load + answer-leak in the
option text). No `docs/contracts/foundation-explorer.md` existed; change is additive
(new PRE band-gate branch + optional `optionEmojis`/`gradeLevel` fields), no existing
reader-grade requirement altered — contract derivation deferred (additive, low blast).

### Audit (pre-fix)
- **Audit A (text census):** `selfCheck.prompt` (load-bearing, no spoken twin →
  UNCOVERED), 3 `selfCheck.options` full phrases (load-bearing, never read → UNCOVERED,
  sometimes answer-leaking e.g. "the triangle in the middle" → Fulcrum), `briefDefinition`
  + `inContext` prose (supportive→load-bearing, only visible as text), chrome (verb badge,
  "N/N mastered" ledger, "Self-Check" header, "1 / N" position, concept tabs, objective
  panel, Ask-Lumina text buttons).
- **Audit B (sufficiency):** ORIENT partial (`[CONCEPT_SELECTED]` teaches but doesn't read
  the check); **STIMULUS FAIL** (question + options never spoken; no catalog directive to
  override the lesson cap); DISAMBIGUATE FAIL; FEEDBACK partial; RECOVER ok-ish (hint on
  miss, silent).
- **Audit C (band contract):** rules 1/2(already tap)/3/7 FAIL — text options, chrome.
- **Overall: PRIMITIVE-GAP + SCAFFOLD-GAP** (interaction core sound; band-gate + read-aloud
  fixes it). Not REBUILD, not WRONG-BAND — foundation-explorer is an IDENTIFY primitive and
  K is a real band for it.

### Fix loop (--fix) — three layers, one loop

| # | Layer | Change | Verification |
|---|---|---|---|
| 1 | CATALOG `core.ts` | New **PRE-READER READ-ALOUD** `aiDirective` (front of foundation-explorer's `aiDirectives`): on `[CONCEPT_READ_ALOUD]`/`[SELFCHECK_READ_ALOUD]` read the definition + example + question + EVERY option verbatim, answer-free, **overriding the one-sentence cap**; `[SELFCHECK_RETRY]` = answer-free spoken hint | tutor-test scaffold keys resolve; live directive fires (below) |
| 2 | COMPONENT `FoundationExplorer.tsx` | `isPreReaderGrade(data.gradeLevel)` band-gate → dedicated PRE render: diagram (picture) kept, text spotlight caption dropped; one concept at a time (auto-advance on correct — no text tab nav needed); prose collapsed to a "🔊 Read to me"; self-check via `<PreReaderSelfCheck>` (emoji-primary, tap=choose, auto-read + 🔊); chrome hidden (verb badge, progress ledger, "Self-Check" header, position "N/N", tabs, objective panel, Ask-Lumina). Reader render unchanged. Shared `recordConceptPass` extracted (reader + PRE both call it) | tsc 0-new + `typecheck:lumina` 0; **jsdom `FoundationExplorer.reader-fit.test.tsx` 6/6** |
| 3 | GENERATOR `gemini-foundation-explorer.ts` | `resolvePreReaderGradeKey(ctx)` (→'K' only when confidently K); at K a PRE prompt block: ≤12-word spoken question, 1-4-word picturable options, no phantom-visual reference, no answer-leak, short spoken-style definition/scenario; `selfCheck.optionEmojis` required (schema + prompt); post-process keeps emojis only if all-present-and-DISTINCT (else `undefined` → ⭐ fallback); stamps `data.gradeLevel` | **eval-test @ K 3/3 draws** (plant/sentence/insect): `gradeLevel:'K'`, all emojis present + distinct, questions 7-9w, defs ≤11w, `correctIndex` varies, no phantom/leak |

### Runtime verification (the pilot gate)
- tsc 0 new errors vs baseline + `npm run typecheck:lumina` **0 errors**.
- `FoundationExplorer.reader-fit.test.tsx` **6/6** (emoji-primary options + chrome hidden;
  auto-read once on first view carrying definition + question + every option; 🔊 replay;
  tap=choose passes the concept; wrong tap → eyes-free hint, answer-free, no pass; reader
  grade keeps Self-Check header + text options + never auto-reads).
- eval-test @ K, 3 topics — every draw `gradeLevel:'K'`, all `optionEmojis` present +
  distinct, question ≤9w, definition ≤11w, `correctIndex` varies, no phantom-visual
  reference, no answer-leak.
- **live `run_tutor_live.py --component foundation-explorer --lesson --runs 3` @ K
  (bespoke `build_foundation_explorer_journey`) — 3/3:** the tutor read the definition
  ("Roots grow in the dirt and drink water. Roots stay in the dark ground.") + the question
  ("Which part of the plant grows under the dirt?") + **every option** ("A) The roots;
  B) The stem; C) The leaf") aloud in the `concept_read_aloud` beat all 3 runs — the
  read-aloud **survives the lesson one-sentence cap**. No `stimulus-not-read`. Only finding:
  question-stacking WARN [2/3] (style, non-blocking). Report:
  `qa/tutor-reports/foundation-explorer-live-lesson-2026-07-15.md`.

**Overall pilot: READY @ PRE.**

### Pilot residuals
- Tutor answer-leak-on-STALL (observational): in 1/3 the `[CONTEXT UPDATE]` stall response
  said "…that's our answer" while pointing at roots. It's on a stall (not the answer-free
  retry beat) and quiet-by-default; minor. The retry directive itself is answer-free.
- Emoji content polish: some draws lean on approximate/positional emojis (🥕 for a root,
  🔵🟢🔴 for insect head/thorax/abdomen) — picturable + distinct, structure guarded; polish.
- `PhaseSummaryPanel` % ledger on the completion screen → K-stage systemic chrome residual.
- Pixel/browser glance of the emoji grid + 🔊 buttons → HUMAN-CHECKS.

## Sweep reconciliation — the tail is NOT one shape

Rolling the pilot to the other five began with a per-primitive structural map (5 parallel
agents). Finding: **BACKLOG #9's "same shape → one shared pattern" premise holds for only
one of the remaining five.** The shared `PreReaderSelfCheck` helper is an MCQ picture-grid;
only primitives with a **text-option multiple-choice self-check** can use it.

| Primitive | Census | Self-check shape | Grade threading | Verdict |
|---|---|---|---|---|
| **fact-file** | routed K | MCQ `selfChecks[].options: string[]` + `correctIndex` | generator ctx-native (`gradeToBand(ctx.grade)`) | **SWEPT — READY (below)** |
| media-player | 2/6 | MCQ `segments[].knowledgeCheck.options: string[]` + `correctOptionIndex`; script+KC already auto-narrated | ctx-native (uses `gradeContext`, not `ctx.grade`) | **QUEUED** — helper fits; heavier (per-segment, RadioGroup+Submit, catalog says "grades 3+") |
| concept-card-grid | 3/6 | **no self-check** — flip-to-read prose (`definition`/`curiosityNote`/`originStory`) | positional generator `(topic, gradeContext, config)`, **no ctx**, nothing threaded to component | **QUEUED — bespoke** (read-aloud-on-flip + emoji-primary card + grade plumbing) |
| comparison-panel | 2/6 | gate is **true/false boolean** (`gates[].correctAnswer: boolean`), not MCQ | positional generator, no ctx, no grade to component | **QUEUED — bespoke** (picture T/F gate + read-aloud + grade plumbing) |
| flashcard-deck | K batch | **no self-check** — flip + self-rate; **no catalog `tutoring` block at all** | no grade threading; generator reads `gradeContext` not `ctx.grade` | **QUEUED — bespoke** (read-aloud-on-flip + emoji field + whole tutoring block + grade plumbing) |

Per the reader-fit "route the finding where it belongs" rule + pilot-then-sweep + "don't
force a pattern where it doesn't fit," the four non-`fact-file` members are **queued as
distinct BACKLOG items with their (different) treatments**, not rushed as unverified
bespoke rebuilds. User scope decision 2026-07-15: **fact-file only this slice; queue the
rest.**

## Swept — fact-file @ PRE

Census: text-primary explainer; the K route gated a tab-explored profile behind a
graded MCQ whose `selfChecks[].options` were full text phrases (unreadable at K) with a
select-then-Submit protocol, `difficulty` badge, "Question N of M" + tab chrome. Generator
already ctx-native (`gradeToBand`), so the fix is the clean helper swap.

| # | Layer | Change | Verification |
|---|---|---|---|
| 1 | CATALOG `core.ts` | **PRE-READER READ-ALOUD** `aiDirective` on fact-file: `[FACTCHECK_READ_ALOUD]` reads the question + every option verbatim, answer-free, overriding the one-sentence cap; `[FACTCHECK_RETRY]` = answer-free hint | typecheck; jsdom read-aloud content assertions |
| 2 | COMPONENT `FactFile.tsx` | `isPreReaderGrade(data.gradeLevel)` → dedicated PRE render: **bypasses the text tab-exploration + "explore to unlock" gate** (unreadable at K; the tutor voices the facts), presents each self-check via `<PreReaderSelfCheck>` (emoji-primary, tap=choose, auto-read + 🔊), auto-advances on pass; adult chrome (title/category/tabs/counters/stat labels/difficulty badge) hidden; `renderResults` (LuminaScoreRing) kept. `handlePreCheckPass` records first-try mastery + submits (exploration credited full — the tab bypass is by design, so no exploration penalty). Reader render unchanged | tsc 0-new + `typecheck:lumina` 0; **jsdom `FactFile.reader-fit.test.tsx` 6/6**; full suite **773/773** |
| 3 | GENERATOR `gemini-fact-file.ts` | at K (`isPreReader` from `ctx.grade`/`gradeContext`): PRE self-check prompt rules (≤12-word question, 1-4-word picturable options, no phantom/leak) + **flat `option0Emoji…option3Emoji`** schema fields (flat, not a nested array → sidesteps the flash-lite nested-array-emoji drop); `validateFactFileData(raw, {isPreReader, gradeLevel})` keeps `optionEmojis` only when all-present-and-distinct (else ⭐ fallback) + stamps `data.gradeLevel` | **eval-test @ K 2/2 draws** (sharks/moon): `gradeLevel:'K'`, all `optionEmojis` complete + distinct (flash-lite reliable with flat fields), questions ≤8w, `correctIndex` varies |

**Overall fact-file: READY @ PRE** (component + generator + scaffold), **pending a live
`--lesson` confirmation** — the read-aloud uses the identical catalog-directive mechanism
proven live 3/3 on the pilot (and on knowledge-check/word-sorter/…), so this is
*should-work — needs the live lesson check* per doctrine, not verified-live.

### fact-file residuals
- **Live `--lesson` 3-run confirmation** not yet run (would need a bespoke fact-file journey
  in `run_tutor_live.py`). Queued.
- `renderResults` LuminaScoreRing % is a picture (fine); the "N/N sections explored" line
  there is text chrome → K-stage systemic.
- Pixel/browser glance of the emoji grid → HUMAN-CHECKS.

## Queued (deferred — distinct BACKLOG items, see BACKLOG #9a-#9d)
- **media-player @ PRE** — helper fits the per-segment `knowledgeCheck`; band-gate the
  RadioGroup→tap=choose + emoji options + PRE read-aloud (script + KC already auto-narrated).
- **concept-card-grid @ PRE** — bespoke: no self-check; read-aloud-on-flip + emoji-primary
  card; generator needs a ctx-native refactor + grade threading to the component.
- **comparison-panel @ PRE** — bespoke: picture true/false gate + read-aloud; generator
  ctx-native refactor + grade threading.
- **flashcard-deck @ PRE** — bespoke: read-aloud-on-flip + per-card emoji field + a NEW
  catalog `tutoring` block (it has none) + grade threading.

## Skipped (band-exempt)
- **take-home-activity** — routed 2/6 but parent-facing by design; not a child-completion
  surface. No PRE treatment.
