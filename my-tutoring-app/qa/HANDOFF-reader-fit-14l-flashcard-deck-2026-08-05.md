# HANDOFF — Reader-fit 14l: flashcard-deck final-assessment scope/count binding

Paste-able execution prompt. Authored `/pm` 2026-08-05; every anchor below was
re-verified against the working tree at HEAD `1b3e2db` on that date. Executor:
`/reader-fit --fix flashcard-deck` (single session, serial — no Workflow
fan-out; user token ruling 2026-08-05).

## The prompt

Run reader-fit 14l: make flashcard-deck honor a requested review scope. Queue
entry: `qa/reader-fit/BACKLOG.md` §14l ("flashcard-deck final-assessment
expansion — 1/42"). Census evidence:
`qa/topic-traces/g1-invention-listening-2026-08-01.md` — on the published
`SS004-05-c` Grade-1 lesson ("Listen to a short narration about an invention
and explain how it changed life for people"), the final-assessment deck was
asked for **10 simple review cards about the narrated light-bulb lesson** and
instead announced **15 cards** and expanded into **Internet, medicine, patent,
prototype** — untaught vocabulary. Broken link: GENERATOR. This repeats the K
census card-padding class that #9d fixed for PRE only.

### Anchor corrections (the queue text is wrong about the file)

- The BACKLOG and census both name `gemini-flashcard-deck.ts`. **No such file.**
  The generator is
  `src/components/lumina/service/flashcard-deck/gemini-flashcard.ts`.
- Registration (already ctx-native):
  `service/registry/generators/mediaGenerators.ts:29`
  `registerContextGenerator('flashcard-deck', …)`.
- Catalog entry: `service/manifest/catalog/media.ts:133` — the `tutoring` block
  authored in #9d lives here. Note its `constraints` prose says "Typically
  generates 12-20 cards per deck" — the catalog itself invites padding; decide
  in-contract whether that sentence is a requirement or stale routing prose.

### Line-exact mechanism read (verified 2026-08-05)

All in `gemini-flashcard.ts`:

1. **Count** — `:81` `defaultCount = isPreReader ? 6 : 15`; `:83`
   `cardCount: rawConfig.cardCount || defaultCount`. The census request ("10
   simple review cards") arrived in **intent prose**, not `rawConfig.cardCount`,
   so a non-K deck defaults to 15. That is the "announces 15" mechanism.
   **Probe, don't assume** ([[value-origin-not-code-touch]]): first check
   whether the manifest/final-assessment path can ever stamp `cardCount` config
   — if it can, the schema-level fix is to have it stamped upstream; if the
   count only ever exists in intent prose, use the 14h template (ONE
   temperature-0 structured Flash-Lite resolver extracting
   `{requestedCount, taughtConcepts[]}` from topic+intent, called only when the
   intent looks like a bounded review — never regex; see
   `qa/reader-fit/number-sequencer-14h-2026-08-04.md`).
2. **Scope** — `:84` `focusArea: ctx.intent || rawConfig.focusArea` lands the
   intent as a weak parenthetical `(focus on: …)` at `:101`, and the numbered
   prompt rules (`:105-110`) then instruct "Cover key terms, concepts, and
   important facts" and "Progress from basic to more advanced concepts" —
   actively inviting expansion beyond taught material. That is the
   patent/prototype mechanism. Fix shape = the science-sweep conditional
   intentFocus pattern: under a review/taught-concepts intent, the prompt must
   say review ONLY the enumerated taught concepts and forbid introducing new
   terms; the "progress to more advanced" rule must not apply.
3. **Unbounded schema array** — `:15-49` `cards` has no `minItems`/`maxItems`.
   Bind both to the resolved `cardCount` (house rule: bound ALL schema arrays —
   [[flash-lite-truncation-template]]; model here is `gemini-3-flash-preview`
   at `:122`, the rule still applies), and slice to `cardCount` post-parse in
   code (code builds structure).
4. **Grade** — `resolvePreReaderGradeKey` (`:56`) forks K only; Grade 1 gets
   the generic prompt with `gradeContext` prose. `ctx.grade` is available;
   thread it canonical-first with the prose fallback kept (the 14m pattern) so
   G1 review vocabulary is age-bounded.

### Contract-first is REQUIRED

`docs/contracts/flashcard-deck.md` does **not** exist (12 contracts do; not
this one). Derive it via `/primitive-contract flashcard-deck` BEFORE editing,
then run `--check` after. Consumers the contract must protect:

- **The #9d PRE fork** (`qa/reader-fit/flashcard-deck-PRE-2026-07-16.md`): K
  cap of 6 cards, required distinct `cardEmoji` + ⭐ fallback (`:146-148`),
  PRE prompt block (`:92-99`), `gradeLevel` stamp (`:163`), the catalog
  tutoring block with `[FLASHCARD_SHOWN]` / `[FLASHCARD_READ_ALOUD]` /
  `[DECK_COMPLETE]` directives, and the component band-gate
  (`FlashcardDeck.tsx`; jsdom suite `FlashcardDeck.reader-fit.test.tsx` 5/5
  must stay green).
- **Generic reader-grade study decks**: open topic-study intents with no
  requested count keep today's behavior (the 15-default / catalog 12-20 claim).
  Bind count/scope ONLY when a request is present — the constraint-presence
  fork, exactly 14j's shape (`docs/contracts/annotated-example.md` R1). Never
  clamp every deck to review semantics.
- [[trust-intent-over-hardcoded-caps]] interplay: the K 6-card cap is a band
  LOAD rule — keep it. Do not add any new cap below lesson intent; if a lesson
  legitimately asks for 12, honor 12.

### Gates (close it the house way)

- Contract derived; post-edit `--check` COMPATIBLE.
- Focused vitest with revert-bite non-vacuity; `typecheck:lumina` 0; global tsc
  0 NEW vs baseline; full suite ≥ 1,569 passing.
- Real-Gemini probes: (a) replay the exact census topic at G1 with the 10-card
  review intent — deck emits exactly 10 cards, terms drawn from the taught
  concepts, no untaught vocabulary; (b) a no-request generic-topic control —
  legacy behavior preserved; (c) a K PRE control — 6-card cap + distinct
  emojis unchanged.
- Same-slice bookkeeping: strike 14l in `qa/reader-fit/BACKLOG.md`, add the
  EVAL_TRACKER row/resolution, write
  `qa/reader-fit/flashcard-deck-14l-<date>.md`, update the WORKSTREAMS
  reader-fit "last touched". Generator-only ⇒ no new human row expected; if
  `FlashcardDeck.tsx` changes, open a HUMAN-CHECKS row (next free ID = 63).
- Shared multi-session files (BACKLOG, EVAL_TRACKER, WORKSTREAMS,
  HUMAN-CHECKS): re-read from disk before editing.

After 14l closes, the EMERGING demand queue's census findings are fully
drained except the DI-owned `di-math-facts counting_next` half of 14g —
re-check the BACKLOG §14 pull order before assuming the next item.
