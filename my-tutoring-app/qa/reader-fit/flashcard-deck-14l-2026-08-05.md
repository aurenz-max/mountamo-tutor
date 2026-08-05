# Reader-fit 14l — flashcard-deck final-assessment scope/count binding — 2026-08-05

**Verdict: CLOSED.** Both census failures are fixed and runtime-verified.

- A requested review count binds: the Grade-1 light-bulb replay emits **exactly 10** cards
  (was 15) and every term is drawn from the narrated lesson.
- Untaught vocabulary is gone: no `patent`, `prototype`, `Internet`, or `medicine`.
- The **K census instance closed as a rider** — the community-helpers replay stays on the
  four taught helpers instead of padding to 8+ helper types.
- Generic open-study decks are byte-identically legacy (15 cards, category grouping,
  basic→advanced progression).
- The #9d PRE fork is untouched: 6-card cap, distinct emoji faces, ⭐ fallback, scaffold.

Contract-first artifact: `src/components/lumina/docs/contracts/flashcard-deck.md`
(9 requirements, 2 conflicts). Edit-guard: `qa/primitive-contracts/flashcard-deck-check-2026-08-05.md`
— **COMPATIBLE**.

## The mechanism (what actually produced the failure)

The census asked for "10 simple review cards" in **intent prose**. Three independent
mechanisms then conspired:

1. **Count** — `config.cardCount` is never stamped by any manifest producer (whole-repo
   grep: the only writers were this generator's own local config), so `rawConfig.cardCount
   || defaultCount` always fell through to 15 at reader grades.
2. **Scope** — `ctx.intent` landed only as a weak parenthetical `(focus on: …)`, while the
   numbered rules said "Cover key terms, concepts, and important facts" and "Progress from
   basic to more advanced concepts" — actively inviting expansion past taught material.
3. **Schema** — the `cards` array had no `minItems`/`maxItems`, so nothing but prose
   constrained deck length.

The catalog's own `constraints` ("Typically generates 12-20 cards per deck") compounded it.

## The fix

- **New `service/flashcard-deck/resolveDeckRequest.ts`** — the 14h template on a non-numeric
  axis. ONE temperature-0 structured flash-lite call turns topic+objective+intent into
  `{requestedCount, isReview, taughtConcepts[]}`. Never a regex over intent prose. Fires only
  when scope actually carries intent/objective text; reports absence honestly; returns null on
  any failure so a resolver outage degrades to exactly today's behavior.
- **Constraint-presence fork** (contract C1, 14j's shape) — strict count/scope binding applies
  ONLY when a request is present. No request ⇒ the legacy open-study prompt is unchanged.
- **Review prompt fork** — under a review scope with enumerable taught concepts, rules 1 and 5
  invert ("Cover ONLY the taught concepts listed below" / "Stay at the level the lesson
  taught"), and a TAUGHT CONCEPTS block forbids introducing any term not in the list. Code
  compares `cardCount` to the concept count so the model gets a concrete instruction: more
  cards than concepts ⇒ **revisit from different angles**, never pad with new material.
- **Bounded schema + slice** — `cards` gets `minItems`/`maxItems` = the resolved count (this
  SDK types them as STRINGS), and code slices post-parse. Code owns the structure.
- **Canonical grade threading** (14m pattern) — `buildGradeLine(ctx.grade)` adds the exact-grade
  line; prose fallback kept, so a no-grade call is unchanged.
- **Catalog projection APPLIED** — the `constraints` padding invitation is replaced with prose
  that states the review contract. Ruled in-contract as routing prose, not a requirement.

## Band ruling (contract C2)

At canonical grade K the **6-card cap wins over a requested count**. It is a developmental
load rule ratified by the #9d PRE audit, not a convenience ceiling. This is deliberately
narrow: at every other grade the lesson's request is law and no hardcoded ceiling may sit
below it ([[trust-intent-over-hardcoded-caps]]). The requested SCOPE still binds at K even
where the COUNT cannot — probe C shows exactly that.

## Real-Gemini probes (live dev server)

| Probe | Setup | Result |
|---|---|---|
| **A — census replay** | G1, topic "How the light bulb changed life for people", intent requesting 10 review cards | **10 cards** (was 15), `gradeLevel:'1'`; every term light-bulb scoped (what it is, what came before, working/reading/playing after dark, safety, why it matters); **zero** untaught vocab |
| **B — generic control** | G5 "Photosynthesis", **no** intent | **15 cards**, 9 sub-categories, Photosynthesis→Chlorophyll→Chloroplast→…→Formula progression, no emoji at reader grade — legacy preserved |
| **C — K PRE control** | K "Community helpers", intent requesting 10 review cards | **6 cards** (cap wins), `gradeLevel:'K'`, 6/6 distinct emojis, 0 missing, max definition **10 words**; stayed on the four taught helpers — the K census instance, fixed |
| **R4 — tutor scaffold** | `tutor-test --probe` @ K | status pass, **0 findings**, 7/7 contextKeys resolve from `component`, 0 `(not set)`, no `{{#if}}`, all three tags + PRE-READER directive present |

## Gates

- Focused **20/20** (`gemini-flashcard.reader-fit-14l.test.ts`), with a **revert-bite**: against
  the pre-fix generator **10 fail / 10 pass** — the 10 failures are exactly the new-behavior
  assertions, the 10 passes are the legacy/no-regression controls and resolver unit tests, which
  is the correct signature for a non-vacuous constraint-presence fork.
- `typecheck:lumina` **0**; global tsc **803** = baseline, **0 NEW**.
- Full Vitest **1,589/1,589** (139 files) — 1,569 baseline + 20 new.
- #9d jsdom band gate `FlashcardDeck.reader-fit.test.tsx` **5/5**.

## Residual

`FlashcardDeck.tsx` was **not** touched, so no new HUMAN-CHECKS row is opened. The existing
open row **#29** (flashcard-deck @ K live `--lesson` + pixel) still covers this primitive and
is unaffected by a generator-only change.

One observation, not a defect: when cards outnumber taught concepts the model revisits a
concept by adjectival restatement ("Brave Firefighter", "Kind Doctor" alongside "Firefighter",
"Doctor"). That is the instructed behavior — review from another angle rather than new
vocabulary — and it is band-appropriate at K. If a future consumer wants distinct question
framings instead, that is an eval-mode concern, not a scope bug.
