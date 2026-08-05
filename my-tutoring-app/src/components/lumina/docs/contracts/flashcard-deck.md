# Contract: flashcard-deck

- **Derived:** 2026-08-05 · evidence window: G1 census 2026-08-01 + K census 2026-07-14 + reader-fit #9d (2026-07-16) + personalization trace 2026-06-11 + authored map (live backend) + git to 2026-03
- **Component:** `primitives/FlashcardDeck.tsx` · **Generator:** `service/flashcard-deck/gemini-flashcard.ts` · **Catalog:** `service/manifest/catalog/media.ts:133`
- **Status:** COMPATIBLE WITH A CONSTRAINT-PRESENCE FORK (reader-fit 14l) · C2 RESOLVED by ruling

Derived as the contract-first step of reader-fit **14l** (final-assessment scope/count
binding). Channel [3] (authored map) returned **zero** flashcard-deck rows across all
365 mappings in LANGUAGE_ARTS/SOCIAL_STUDIES/MATHEMATICS/SCIENCE — this primitive has
**no authored long-tail consumers at all**; every consumer is manifest-emergent, and
predominantly the lesson's **finalAssessment slot**. Channel [4] (calibration)
unavailable this run (`/api/calibration/items` → 403 Forbidden — same limitation as the
number-line 2026-08-03 and coin-counter 2026-07-25 runs). Channel [1] = the two saved
censuses (not re-run).

Note the generator filename: the BACKLOG and both censuses name `gemini-flashcard-deck.ts`,
which **does not exist**. The generator is `service/flashcard-deck/gemini-flashcard.ts`.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| **K PRE band — explainer tail #9d** (the largest single investment in this primitive: authored the catalog `tutoring` block from nothing + wired `useLuminaAI`) | reader-fit [2] | `qa/reader-fit/flashcard-deck-PRE-2026-07-16.md` · `FlashcardDeck.reader-fit.test.tsx` 5/5 | 2026-07-16 |
| **G1 EMERGING census — `SS004-05-c` invention-listening finalAssessment** (the 14l failure: 10 review cards requested → 15 announced, expanded to Internet/medicine/patent/prototype) | census [1] | `qa/topic-traces/g1-invention-listening-2026-08-01.md:16,20-24` | 2026-08-01 |
| **K census — community-helpers finalAssessment** (same class, milder: "recall all four helpers taught" → 15 cards across 8+ helper types) | census [1] | `qa/topic-traces/k-community-helpers-2026-07-14.md:19,26-29` | 2026-07-14 |
| **Personalization engine — finalAssessment slot** (flashcard-deck is the chosen final assessment in baseline AND the `challenging` variant; the `easy` variant swaps to knowledge-check) | trace [2] | `qa/topic-traces/personalization-ab-counting-2026-06-11.md:24` | 2026-06-11 |
| **Generic reader-grade study decks** (open topic study, no requested count — all grade levels per catalog) | catalog + code | `media.ts:134-135` · `gemini-flashcard.ts:81` | live |
| **Live tutor loop** (`[FLASHCARD_SHOWN]` / `[FLASHCARD_READ_ALOUD]` / `[DECK_COMPLETE]`; 7 contextKeys resolving from `aiPrimitiveData`) | tutor-test [2] | `qa/reader-fit/flashcard-deck-PRE-2026-07-16.md:52-54` (probe PASS, 0 findings) | 2026-07-16 |
| **Open human check** — row 29, K emoji face + read-aloud + new tutor block (live `--lesson` + pixel residual) | HUMAN-CHECKS | `qa/HUMAN-CHECKS.md:112` | open |
| Authored map [3] | — | zero rows in all 4 subjects (365 mappings inverted 2026-08-05) | n/a |

Real-usage channel [4]: unknown (403), not zero.

## Requirements

### R1 — PRE (K) deck shape · OBSERVED
- **Property:** at canonical grade K the deck is capped at **6 cards**; every card carries a
  distinct `cardEmoji` (the card FACE — a non-reader cannot read the term) with a `⭐`
  fallback so no card is faceless; `term` is 1-3 concrete picturable words; `definition` is
  one spoken sentence ≤12 words; `category` is one simple word; abstract terms, formulas,
  dates and technical vocabulary are excluded. `data.gradeLevel` is stamped `'K'` — the
  component's entire PRE presentation (`isPreReaderGrade(data.gradeLevel)`,
  `FlashcardDeck.tsx:30`) hangs off that stamp.
- **Demanded by:** K PRE band (#9d); K community-helpers census; HUMAN-CHECKS row 29.
- **Evidence:** `qa/reader-fit/flashcard-deck-PRE-2026-07-16.md:22-27,50-51`; `gemini-flashcard.ts:87-99,146-148,163`; jsdom suite 5/5.
- **Probe:** eval-test `componentId=flashcard-deck&evalMode=study&grade=K&gradeLevel=kindergarten&topic=Farm Animals` → `gradeLevel:'K'`, exactly ≤6 cards, every `cardEmoji` present and distinct, every definition ≤12 words.

### R2 — Generic study-deck default · OBSERVED
- **Property:** with **no** requested count and no review framing, a reader-grade deck keeps
  its legacy behavior: `defaultCount` 15, coverage of key terms/concepts/facts, grouping by
  sub-category, and progression from basic to more advanced. This is the open-study identity
  the catalog advertises; it must not be clamped to review semantics.
- **Demanded by:** generic reader-grade study decks (all grades); catalog `constraints`.
- **Evidence:** `gemini-flashcard.ts:81,105-110`; `media.ts:135` ("Typically generates 12-20 cards per deck").
- **Probe:** eval-test `grade=5&topic=Photosynthesis` with **no** `intent` → ~15 cards, no error, category grouping intact.

### R3 — Card payload shape for the component · OBSERVED
- **Property:** every card yields `id`, `term`, `definition`, `category` (non-empty; `category`
  defaults to `'General'`). `cardEmoji` is present at K and optional elsewhere. The deck yields
  `title` and `description`. `data.cards` is read directly into component state
  (`FlashcardDeck.tsx:33,39,43`), so a deck of length 0 breaks the primitive.
- **Demanded by:** every consumer; the component itself.
- **Evidence:** `gemini-flashcard.ts:140-164`; `FlashcardDeck.tsx:29-43`.
- **Probe:** any eval-test run → all four fields non-empty on every card; `cards.length ≥ 1`.

### R4 — Tutor scaffold key resolution · OBSERVED
- **Property:** the seven catalog `contextKeys` (`title`, `term`, `definition`, `category`,
  `cardIndex`, `totalCards`, `isFlipped`) resolve from the component's `aiPrimitiveData` — not
  generator-only — and the three directives fire on their tags. The PRE-READER READ-ALOUD
  directive explicitly overrides the lesson one-sentence cap. `totalCards` reflects the deck
  actually rendered, so any post-parse card-count change must flow through to the tutor.
- **Demanded by:** K PRE band; live tutor loop.
- **Evidence:** `media.ts:136-177`; `qa/reader-fit/flashcard-deck-PRE-2026-07-16.md:52-54` (tutor-test probe PASS, 0 findings, 0 `(not set)`, no `{{#if}}`).
- **Probe:** `GET /api/lumina/tutor-test?componentId=flashcard-deck&probe=1&gradeLevel=kindergarten` → 0 findings, 0 `(not set)`, PRE-READER + both flashcard tags present in the injection.

### R5 — Review intents must not introduce untaught material · OBSERVED (**violated until 2026-08-05 — the 14l edit zone**)
- **Property:** when the component intent frames the deck as a **review of material the lesson
  already taught**, every card's term must come from that taught material. Introducing new
  vocabulary silently converts a review into an introduction — the deck is the lesson's final
  assessment, so untaught terms are assessed-but-never-taught.
- **Demanded by:** G1 invention-listening census; K community-helpers census; personalization finalAssessment slot.
- **Evidence:** failure `g1-invention-listening-2026-08-01.md:22` (`patent`, `prototype`, `Internet`, `medicine` on a light-bulb narration); failure `k-community-helpers-2026-07-14.md:27` (15 cards over 8+ helper types against 4 taught); mechanism = `ctx.intent` landing only as a weak parenthetical `(focus on: …)` at `gemini-flashcard.ts:101` while rules `:105-110` actively invite expansion ("Cover key terms…", "Progress from basic to more advanced concepts").
- **Probe:** eval-test with the census intent → every term traceable to the enumerated taught concepts; `patent`/`prototype`/`Internet` absent.

### R6 — An explicitly requested card count is honored · OBSERVED (**violated until 2026-08-05 — the 14l edit zone**)
- **Property:** when the lesson asks for N cards, the deck contains exactly N. The request
  arrives in **intent prose**, never as `config.cardCount` — no manifest producer stamps that
  field anywhere in the repo (whole-repo grep 2026-08-05: the only `cardCount` writers are this
  generator's own local config and an unrelated concept-cards log line), so reading `rawConfig`
  alone can never satisfy this requirement.
- **Demanded by:** G1 invention-listening census (asked 10, got 15); K community-helpers census.
- **Evidence:** `g1-invention-listening-2026-08-01.md:22`; mechanism `gemini-flashcard.ts:81,83` (`defaultCount = isPreReader ? 6 : 15`; `rawConfig.cardCount || defaultCount`).
- **Probe:** eval-test with an intent requesting 10 cards at grade 1 → `cards.length === 10`.

### R7 — Canonical grade first, prose fallback kept · OBSERVED (partial until 2026-08-05)
- **Property:** grade decisions read canonical `ctx.grade`; `ctx.gradeContext` prose is fallback
  only. Today `resolvePreReaderGradeKey` (`:56-62`) does this correctly **but only forks K** —
  every non-K grade falls through to a generic prompt steered solely by `gradeContext` prose, so
  Grade 1 and Grade 5 receive identical vocabulary guidance. This is the 14m memo applied to the
  reader-grade path.
- **Demanded by:** G1 census (Grade-1 review vocabulary must be age-bounded); the 14m systemic class.
- **Evidence:** `gemini-flashcard.ts:56-62,101-116`; class + template `qa/reader-fit/BACKLOG.md` 14m.
- **Probe:** eval-test `grade=1` vs `grade=5` on the same topic → grade-1 vocabulary demonstrably simpler; **no `grade` param** → legacy prose path unchanged.

### R8 — Band load rules are caps, lesson intent is not capped · OBSERVED
- **Property:** the K 6-card cap is a **band LOAD rule** (a 15-card rote drill is past the K
  attention span), and it stands. Beyond it, no hardcoded ceiling may sit below what the lesson
  asks for: a lesson that legitimately requests 12 cards gets 12. New caps introduced by a fix
  are bugs, not safety.
- **Demanded by:** K PRE band (the cap); every requesting consumer (the non-cap).
- **Evidence:** `qa/reader-fit/flashcard-deck-PRE-2026-07-16.md:22-27`; ruling [[trust-intent-over-hardcoded-caps]]; handoff `qa/HANDOFF-reader-fit-14l-flashcard-deck-2026-08-05.md:87-89`.
- **Probe:** intent requesting 12 at grade 3 → 12 cards; the same intent at K → 6 (cap wins, by C2).

### R9 — Unbounded `cards` schema array · OBSERVED (house-rule violation; **the 14l edit zone**)
- **Property:** the response schema's `cards` array carries no `minItems`/`maxItems`
  (`gemini-flashcard.ts:18-46`), so nothing but prose constrains deck length — the standing house
  rule is that ALL schema arrays are bounded. Note this SDK types `minItems`/`maxItems` as
  **strings** (`knowledge-check` precedent, `gemini-knowledge-check.ts:666-667`).
- **Demanded by:** [[flash-lite-truncation-template]] house rule; R6 (a bound is the enforcement surface for the count).
- **Evidence:** `gemini-flashcard.ts:15-49`; precedent `gemini-knowledge-check.ts:666-667,1013`.
- **Probe:** inspect the built schema → `cards.minItems`/`maxItems` present and equal to the resolved count.

## Conflicts

### C1 — R2 generic 15-default vs R6 requested-count binding — **RESOLVED via constraint-presence fork (2026-08-05)**
Both consumers are right. An open topic-study deck has no requested count and must keep the
legacy 15-card exploratory identity (R2); a lesson that *asks* for 10 review cards must get
exactly 10 (R6). Binding every deck to review semantics would destroy the open-study identity
the catalog advertises and the manifest routes on. Resolution is exactly 14j's shape
(`docs/contracts/annotated-example.md` R1): strict count/scope binding applies **only when a
request is actually present** in the scope text; absent a request, the legacy path is untouched
byte-for-byte. Detection is a structured resolver, never a regex over intent prose.

### C2 — R1 K 6-card cap vs R6 requested count at K — **RESOLVED by ruling (2026-08-05): the band cap wins at PRE**
If a K lesson requests 10 cards, R1 (6) and R6 (10) contradict. Ruling: **the K cap holds.** It
is a developmental load rule about a 5-year-old's attention span, not a convenience ceiling, and
it was ratified by the #9d PRE audit. This is narrow and deliberate: it applies at canonical
grade K only, and R8 continues to forbid any *new* cap at any other grade. The requested count
still binds the SCOPE at K (R5) even when it cannot bind the COUNT.

## Catalog projection

- **description:** faithful as of 2026-08-05 — the flip/self-rate/recall identity is accurate and
  is what the curator routes on.
- **constraints:** the sentence *"Typically generates 12-20 cards per deck"* is **routing prose
  describing the open-study default, NOT a requirement** (ruling, 14l). It is nonetheless a
  padding invitation and is already false at K (6). Proposed sharpening — current:
  `"… Typically generates 12-20 cards per deck. Ideal for review, test prep, or building fluency. …"`
  → proposed:
  `"… Generates about 12-20 cards for open study, fewer for young learners; when a lesson asks for a specific number of cards or a review of material already taught, the deck honors that exactly. Ideal for review, test prep, or building fluency. …"`
  Rationale: keeps the routing signal (deck size class) while removing the padding invitation and
  telling the curator the review contract exists. Prose-only; no new catalog fields.
- **evalModes:** none declared (the primitive has a single flip/self-rate identity). No deltas.
- **tutor projection:** unchanged — R4 keys and the three directives stay as authored in #9d.

## Changelog

- 2026-08-05 — derived (initial), as contract-first step of reader-fit 14l. 9 requirements
  (all OBSERVED; R5/R6/R9 violated at derivation, R7 partial), 2 conflicts (C1 resolved via
  constraint-presence fork, C2 resolved by ruling). Channel [3] zero rows; channel [4]
  unavailable (403).
- 2026-08-05 — reader-fit 14l shipped: a structured temperature-0 request resolver
  (`resolveDeckRequest.ts`) reads the count + review framing + taught concepts out of intent
  prose; a review prompt fork forbids untaught vocabulary; the `cards` schema array is bound to
  the resolved count and sliced in code; `buildGradeLine(ctx.grade)` threads canonical grade.
  R5/R6/R9 satisfied, R7 satisfied for the reader-grade path. C1 and C2 both closed. `--check`
  **COMPATIBLE** — R1 (live + jsdom 5/5), R2 (generic control), R3, R4 (tutor probe 0 findings),
  R7, R8 all re-probed. Catalog `constraints` projection APPLIED (padding invitation removed).
  Report: `qa/primitive-contracts/flashcard-deck-check-2026-08-05.md` ·
  `qa/reader-fit/flashcard-deck-14l-2026-08-05.md`.
