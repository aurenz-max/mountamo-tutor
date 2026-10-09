# era-explorer levers (2026-10-08, class sweep)

`/add-support-tiers` on era-explorer's four spoken modes, which had no levers before. The user waived the Phase 2 confirmation for this sweep, so the lever table below was built without a separate review.

## Failure inventory

| Mode | Failure (miss id) | Evidence class |
|---|---|---|
| lens_id | names another lens (`other_lens`) | documented (catalog SIGNATURE, DI correction) |
| lens_id | names a thing from the sentence instead of a lens (`named_a_thing`) | documented (`commonStruggles`) |
| era_sort | picks back then / today / both wrongly (`said_back_then`, `said_today`, `said_both`) | documented + observed-synthetic (DI signature runs 09-03) |
| era_compare | picks the other past era or both (`said_earlier`, `said_later`, `said_both`) | documented |
| era_compare | says "today", which is not a choice (`said_today`) | documented (`commonStruggles`, SIGNATURE) |
| cause_of_change | picks a cause that did not make the change (`other_cause`) | documented + observed-synthetic |
| cause_of_change | says what changed instead of why (`said_what_changed`) | documented + observed-synthetic (`live-di-signature-cause_of_change-2026-09-03`) |

There is no real-learner evidence. There are no demonstrations, no misconception reports and no remediation module for this primitive. lens_id and era_compare had no miss functions and no saved payload. Both now have both: `eraSpokenMisses` was extended, and one generation call each produced `w1-payloads/era-explorer.lens_id.json` and `era-explorer.era_compare.json`.

## Lever table

| Mode | Lever | Kind | Carrier | Leak rule (code) | Answers |
|---|---|---|---|---|---|
| lens_id | `side_by_side`: all three era cards open together, each under its lens name | help | shown + voiced (read-aloud per card) | renders only what is already evidence. Nothing is marked, and the fact names all three lenses | other_lens, named_a_thing |
| lens_id | `on_the_card`: practice item `<id>~simpler`, a card sentence copied word for word, with the same three-lens menu | simplify | shown + voiced | `practiceLeaks`: not the item, same menu, the sentence is on its answer's card, it has no word of any lens name, and it reads as no statement or choice in the lesson | same |
| era_sort | `two_checks`: "Back then, in <era>?" / "Today, in your own life?", both empty | help | shown + voiced | `twoChecksFor` is built from the era names only, so it is identical for every answer. Nothing is ticked | said_back_then, said_today, said_both |
| era_compare | `two_checks`: "In <earlier>?" / "In <later>?", both empty | help | shown + voiced | same rule | said_earlier, said_later, said_both, said_today |
| cause_of_change | `model_change`: an everyday change, its cause, and a line that was true then but is not why, each tagged | help | shown + voiced | `modelLeaks`: no line of the model may share two content words with any statement or choice in the lesson. The `does` text forbids saying which of the learner's causes is like the model's cause | other_cause, said_what_changed |

**Simplify levers left out on purpose:**
- era_sort and era_compare: the three-bin menu is the mode's floor, because "both" is the continuity concept. Dropping a bin on the learner's own item would rule out an answer. Code also cannot write a past-era fact with a known answer for an arbitrary era.
- cause_of_change: one change with three causes is already the plainest form of the ask. The generated foils are already far-fetched, so a far-foil item would be no simpler.

**Per-item coverage:**
- Every checked miss has a help lever on every item of all four saved payloads plus the fixture. A unit test checks this for each item (the J12 shape).
- `on_the_card` exists on every built lens_id item of the saved payload.
- Where no free card sentence exists, no simplify lever is offered. A unit test checks this.
- Nothing goes to the catalog `unanswered` map.

**Starting positions (Phase 6):**
- `easy` starts `side_by_side` (lens_id) and `two_checks` (era_sort, era_compare).
- cause_of_change starts with nothing.
- A starting position is never recorded as a pull.

## Built

- `eraExplorerLevers.ts` (new): declarations, leak rules, `practiceItem`/`practiceParent`, `leversOnScreen`, `startingLevers`, and four hand-written change models (invention, rule, way to earn a living, invention).
- `eraExplorerWorkspace.ts`: lens_id and era_compare spoken misses.
- Catalog `misses`: all four modes. Guidance no longer says the tutor "cannot open cards", because a lever now does.
- `EraExplorer.tsx`:
  - lever state is keyed by item, and a practice item is shown in place of the session item;
  - `pullLever` and `endPractice`;
  - a side-by-side source card, the two-checks row and the model panel;
  - `onCorrectionRetry` keeps a practice item on screen, and `onPracticeClosed` clears it.
- `liveJourneySpec.ts` era row: rebuilds a `~simpler` item from its parent with the same builder.

## Tests

- `eraExplorerLevers.test.ts` (61): per-item coverage on 5 payloads, the on-screen fact never repeats the detail, `two_checks` gives the same text for every answer, the model leak rule, the practice builder and its leak rule (including a refused card sentence that contains "school"), the `nextLever` table, and starting positions.
- `eraSpokenMisses.test.ts`: lens_id and era_compare rows added.
- `EraExplorer.levers.workspace.test.tsx` (4):
  - one pull changes the screen and the scene fact in a single commit;
  - the next attempt records the lever;
  - a second pull is refused and the screen, levers, attempts and item stay the same;
  - `on_the_card` opens the practice item, a retry stays on it, the full item comes back and is credited with both levers recorded;
  - on easy, the start positions are not offered and nothing is recorded.
- All 11 history test files pass (210 tests). `typecheck:lumina` reports 0 errors.
- Filtered runs (era-explorer only): the journey sweep passes 4 of 4 and the W1 contract passes 17 of 17.

## Not done

- No tutor replay and no Live run; the batch verify step covers these.
- There is no `docs/contracts/era-explorer.md`. Phase 3 still needs one written with `/primitive-contract`.
