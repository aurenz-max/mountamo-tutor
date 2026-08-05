# `--check`: flashcard-deck — 2026-08-05 (reader-fit 14l)

**Verdict: COMPATIBLE** (via the constraint-presence fork, contract C1; C2 resolved by ruling).

Contract: `src/components/lumina/docs/contracts/flashcard-deck.md` (derived same day, 9
requirements, 2 conflicts). Edit served the **G1 invention-listening finalAssessment**
consumer; every OBSERVED requirement of every OTHER consumer was re-probed below.

## Edit surface

| File | Change |
|---|---|
| `service/flashcard-deck/resolveDeckRequest.ts` | NEW — temperature-0 structured request resolver |
| `service/flashcard-deck/gemini-flashcard.ts` | count fork, review prompt fork, bounded schema, post-parse slice, canonical grade line |
| `service/manifest/catalog/media.ts:135` | `constraints` prose projection (padding invitation removed) |
| `service/flashcard-deck/gemini-flashcard.reader-fit-14l.test.ts` | NEW — 20 focused tests |

`git diff` on the generator shows **0 deletions of consumer-visible behavior**: the PRE block,
emoji handling, ⭐ fallback, `gradeLevel` stamp, title/description, and error path are carried
forward verbatim.

## Other-consumer probes

| Req | Consumer (not the edit's) | Probe | Result |
|---|---|---|---|
| **R1** | K PRE band (#9d) | eval-test `grade=K&gradeLevel=kindergarten`, topic "Community helpers" | **PASS** — 6 cards, `gradeLevel:'K'`, 6/6 distinct emojis, 0 missing, max definition 10 words, 1-3 word concrete terms |
| **R1** | K PRE band (component half) | jsdom `FlashcardDeck.reader-fit.test.tsx` | **PASS 5/5** — auto-start, emoji face, chrome hidden, flip read-aloud, 🔊 replay, wordless 🎉, reader-grade control |
| **R2** | generic reader-grade study decks | eval-test `grade=5`, topic "Photosynthesis", **no intent** | **PASS** — 15 cards, 9 sub-categories, basic→advanced progression, no emoji; resolver never called (no scope text ⇒ no call, no cost) |
| **R3** | every consumer + the component | all three live draws | **PASS** — `term`/`definition`/`category` non-empty on 31/31 cards; `title`/`description` present; no zero-length deck |
| **R4** | live tutor loop | `tutor-test?componentId=flashcard-deck&probe=1&gradeLevel=kindergarten` | **PASS** — status pass, 0 findings, 7/7 contextKeys `resolvedBy: component`, 0 `(not set)`, 0 `{{#if}}`, `[FLASHCARD_SHOWN]`/`[FLASHCARD_READ_ALOUD]`/`[DECK_COMPLETE]` + PRE-READER directive present. `totalCards` still derives from the rendered deck, so the post-parse slice flows through |
| **R7** | 14m systemic class | focused tests: `grade='1'` ⇒ exact-grade line; `grade` absent ⇒ no line | **PASS** — prose fallback preserved |
| **R8** | requesting consumers at reader grades | focused test: request 18 at grade 3 | **PASS** — 18 cards, schema bound `'18'`; out-of-window resolver values are treated as UNRESOLVED (default stands) rather than clamped, so no hidden cap was introduced |

## Requirements moved

- **R5** (review scope) — violated → **satisfied**. Probe A: zero untaught vocabulary on the
  exact census topic. Probe C: the K census instance also closed.
- **R6** (requested count) — violated → **satisfied**. Probe A: exactly 10.
- **R9** (unbounded schema array) — violated → **satisfied**. `minItems`/`maxItems` bound to the
  resolved count on every call.
- **R7** — partial → **satisfied** for the reader-grade path.

## Conflicts

- **C1** (generic default vs requested count) — **RESOLVED via constraint-presence fork.** Probe B
  is the standing no-regression control.
- **C2** (K 6-cap vs requested count at K) — **RESOLVED by ruling: the band cap wins at PRE.**
  Probe C confirms 6 cards from a requested 10, with the review SCOPE still bound.

## Catalog projection — APPLIED

`media.ts:135` `constraints`. Ruled in-contract: "Typically generates 12-20 cards per deck" is
**routing prose, not a requirement** — but it was a padding invitation and already false at K (6).
Replaced with prose that keeps the deck-size routing signal and states the review contract.
Prose-only; no new catalog fields; `description` untouched. Verified `typecheck:lumina` 0 after.

## Gates

Focused 20/20 (revert-bite: 10 fail against the pre-fix generator, 10 legacy controls hold) ·
full Vitest 1,589/1,589 · `typecheck:lumina` 0 · global tsc 803 = baseline, 0 NEW.
