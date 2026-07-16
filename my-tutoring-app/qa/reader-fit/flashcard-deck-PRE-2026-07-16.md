# Reader Fit: flashcard-deck @ PRE — 2026-07-16

Modes audited: (flip + self-rate study deck) | Probes: eval-test ✓ tutor-test --probe ✓ | live --lesson ✗ (residual)

Source: BACKLOG item **9d** (explainer-tail bespoke, LARGEST of the three). No
self-check — it is flip term/definition + a "Study Again" / "Got It" self-rate.
`PreReaderSelfCheck` does NOT apply. **The catalog entry had NO `tutoring` block at
all** — one had to be authored before any scaffold could reach the tutor.

## Audit (pre-fix)
- **Audit A:** front = the **term as text** + a category badge + "Click to Reveal";
  back = the **definition as text** + "Answer" label. Nothing spoken (no tutor block).
  A 15-card rote deck. All load-bearing text UNCOVERED.
- **Audit B:** no scaffold existed — ORIENT/STIMULUS/FEEDBACK/RECOVER all ✗.
- **Audit C:** rules 1/3/4/6/7 FAIL — text face, text back, 15-card load, "3/8"
  counter + progress dots + "Study Again"/"Got It"/"Left Arrow" sublabels + the
  ready-screen keyboard essay + the % accuracy ledger, all in the child's field.

**Overall (pre-fix): PRIMITIVE-GAP + SCAFFOLD-GAP (no scaffold).**

## Fix — the layers (one loop)
- **GENERATOR (`gemini-flashcard.ts`, already ctx-native).** Added a local
  `resolvePreReaderGradeKey(ctx)` → **stamps `data.gradeLevel`**; a **flat `cardEmoji`**
  per card (the pre-reader face; ⭐ fallback → dodges the flash-lite nested-array emoji
  footgun); **card count capped at 6 at K** (a 15-card drill is past the band's load +
  attention limits); a PRE-READER prompt block (term 1-3w concrete, `cardEmoji` REQUIRED
  & distinct, definition ≤12w spoken, simple category).
- **CATALOG (`media.ts`): AUTHORED a NEW `tutoring` block** (there was none) —
  taskDescription + contextKeys (`title`/`term`/`definition`/`category`/`cardIndex`/
  `totalCards`/`isFlipped`) + scaffoldingLevels + commonStruggles (incl. a pre-reader
  one) + two `aiDirectives`: **PRE-READER READ-ALOUD** (`[FLASHCARD_SHOWN]` voices the
  term on show; `[FLASHCARD_READ_ALOUD]` reads term → meaning word-for-word, **overrides
  the one-sentence cap**) and **DECK COMPLETE** (`[DECK_COMPLETE]` celebration).
- **COMPONENT (`FlashcardDeck.tsx`): wired `useLuminaAI` (was NONE)** + band-gate.
  At K: **auto-starts** (no text ready screen), the FACE is a big **emoji** (`cardEmoji`)
  + term + a wordless 👆 cue; a new card fires **`[FLASHCARD_SHOWN]`** (voices the term);
  flipping fires **`[FLASHCARD_READ_ALOUD]`** (silent trigger → the tutor reads the card);
  the back carries a 🔊 replay (`stopPropagation` so it doesn't close the card); the
  self-rate stays but its **text sublabels are hidden** (wordless X / ✓ icons); chrome
  hidden (category badge, "Click to Reveal", "Flip the card…", the N/M counter, progress
  dots); the summary is a wordless 🎉 + a ▶ replay (no % accuracy ledger). Reader grades:
  unchanged (ready screen, text faces, chrome, and no per-flip tutor chatter).

## Verification
- **tsc**: `typecheck:lumina` **0 errors**; **full vitest suite 799/799** (no regressions).
- **jsdom**: `FlashcardDeck.reader-fit.test.tsx` **5/5** — auto-start + emoji face +
  chrome hidden + term voiced on show; flip reads the card (term + meaning); 🔊 replays
  without closing; finishing lands on the wordless 🎉 (no accuracy ledger); reader-grade
  control keeps the ready screen + never voices.
- **eval-test @ K** (topic "Farm Animals"): deck `gradeLevel:'K'`, **6 cards** (capped),
  distinct emojis 🐄 🐖 🐑 🐓 🐎 🚜, 1-word terms, definitions 8w.
- **tutor-test --probe @ K**: audit **PASS, 0 findings** (first pass WARNed on a dead
  `[FLASHCARD_FLIPPED]` tag → removed); PRE-READER + `[FLASHCARD_SHOWN]`/
  `[FLASHCARD_READ_ALOUD]` present in the injection; **0 `(not set)`**, no `{{#if}}`.

**Overall: READY @ PRE (pending live).** Residual: Tier-3 live `--lesson` confirmation
(bespoke journey + backend) → **browser/live check** → HUMAN-CHECKS; pixel look of the
emoji face + wordless summary → HUMAN-CHECKS.
