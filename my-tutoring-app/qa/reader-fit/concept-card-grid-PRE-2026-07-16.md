# Reader Fit: concept-card-grid @ PRE — 2026-07-16

Modes audited: (flip-to-read explainer — NO self-check) | Probes: eval-test ✓ tutor-test --probe ✓ | live --lesson ✗ (residual)

Source: BACKLOG item **9b** (explainer-tail bespoke). `PreReaderSelfCheck` does NOT
apply — there is no MCQ; it is a flip-to-read card (`definition` / `curiosityNote` /
`timelineContext` prose; `originStory` / `subheading` generated-but-unrendered).

## Audit (pre-fix)
- **Audit A:** card FACE = an AI-generated abstract image + "Exhibit 0N" + "Flip to
  Analyze →" + timelineContext (all text/chrome the non-reader can't read); back =
  definition + component breakdown + curiosity note prose with "Overview" /
  "Component Breakdown" / el.type badge chrome. The definition/curiosity note were
  UNCOVERED (only silent `[CARD_FLIPPED]` "briefly introduce" — no read-aloud).
- **Audit B:** ORIENT weak; STIMULUS ✗ (card text not read word-for-word at K; the
  cap drops a soft component clause); no picture-primary face.
- **Audit C:** rules 1/3/7 FAIL — text face, prose back, "Exhibit 0N"/section-label
  chrome in the child's field.

**Overall (pre-fix): PRIMITIVE-GAP + SCAFFOLD-GAP.**

## Fix — the layers (one loop)
- **GENERATOR (ctx-native refactor + PRE + emoji).** `generateConceptCards` now takes
  the typed `GenerationContext` (was positional `(topic, gradeContext, config)`); a
  local `resolvePreReaderGradeKey(ctx)` resolves the band from `ctx.grade` and **stamps
  each card's `gradeLevel`** + a **flat `cardEmoji`** (the pre-reader card face; flat
  field + ⭐ code fallback → dodges the flash-lite nested-array emoji footgun). At K a
  PRE-READER block constrains the prompt: title 1-3w concrete, `cardEmoji` REQUIRED &
  distinct, definition ≤12w, curiosity note ≤12w, ≤2 short conceptElements.
- **REGISTRATION** (`coreGenerators.ts`): `generateConceptCards(ctx)`.
- **COMPONENT** (`ConceptCard.tsx`): `preReader = isPreReaderGrade(data.gradeLevel)`.
  At K the FACE is a big **emoji** (`cardEmoji`) + title + a wordless 👆 tap cue (the AI
  image fetch is skipped); flipping fires **`[CARD_READ_ALOUD]`** (silent background
  trigger) so the tutor reads name → definition → curiosity note aloud, and the back
  carries a 🔊 replay (`stopPropagation` so it doesn't close the card). Chrome hidden
  at K: "Exhibit 0N" badge, "Context"/timelineContext, "Flip to Analyze →", "Overview"
  / "Component Breakdown" labels, el.type badge, "Return to Artifact". Tap-to-flip
  (tap = choose) unchanged. Reader grades untouched.
- **CATALOG** (`core.ts`): new **PRE-READER READ-ALOUD (kindergarten)** `aiDirective`
  on the concept-card-grid tutoring block — `[CARD_READ_ALOUD]` reads name + definition
  + curiosity note word-for-word, **overrides the one-sentence cap**, answer-free, and
  invites tapping the next picture card. (Was `CARD EXPLORATION` / `CARD RETURNED` only.)

## Verification
- **tsc**: `typecheck:lumina` **0 errors**; no NEW full-tsc errors vs baseline.
- **jsdom**: `ConceptCard.reader-fit.test.tsx` **4/4** — emoji face + title, chrome
  hidden; flip fires the read-aloud (definition + curiosity note); 🔊 replays without
  closing the card; reader-grade control keeps Exhibit chrome + fires `[CARD_FLIPPED]`
  (not the read-aloud).
- **eval-test @ K** (topic "Farm Animals"): 3 cards, `gradeLevel:'K'`, distinct
  depicting emojis 🐄 🐖 🐓, 1-word titles, definitions 11w, concrete curiosity notes.
- **tutor-test --probe @ K**: audit **PASS, 0 findings**; PRE-READER directive +
  `[CARD_READ_ALOUD]` present in the injection; **0 `(not set)`**, no `{{#if}}`.

**Overall: READY @ PRE (pending live).** Residual: Tier-3 live `--lesson`
confirmation (bespoke journey + backend) → **browser/live check** → HUMAN-CHECKS;
pixel look of the emoji face → HUMAN-CHECKS.
