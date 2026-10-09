# read-aloud-studio levers: expression (2026-10-08 class sweep, run 2026-10-09)

Scope: the `expression` eval mode (Phrase and Read: mark phrase plan -> cold first read -> tutor models the groups -> scored reread).

## What was actually wrong

Expression already declared the two help levers (`tracking_underline`, `sound_dots`) on its two read steps. The sweep still showed it as having no levers for three reasons:

1. The journey row threw on the phrase-plan step ("any phrase plan is accepted; undriven"). The drive stopped on item 1, so no expression lever was ever seen (baseline `J1-drivable`, handoff 24 SW-L2).
2. The catalog listed both expression misses as `unanswered`.
3. Expression had no simplify lever. On the reread, both help levers told the tutor "Nothing is said: do not read the line", but the reread's own ask has the tutor read the line as its model. The two instructions contradicted each other.

## Failure inventory

| Step | Failure | Evidence class |
|---|---|---|
| first_read, reread | a printed word read as another word (`word_swap`) | documented (catalog commonStruggles); code-emitted spoken miss (`readAloudSpokenMisses`) |
| first_read, reread | a printed word left out (`word_drop`) | documented; code-emitted spoken miss |
| reread | the line is too long to read back word for word after one model | inferred (same failure that accuracy's `short_line` answers) |
| mark | none: any plan is accepted and committed as page work | n/a |

There is no observed-real evidence. The demonstrations log has nothing for this primitive. The 09-29 expression runtime report only checked wiring.

## Lever table

| Step | Failure | Lever | Kind | Carrier | Leak rule | Before this run |
|---|---|---|---|---|---|---|
| first_read | word_swap, word_drop | `tracking_underline` | help | shown | cold read: nothing is said, the line is never read | yes |
| first_read | word_swap | `sound_dots` | help | shown | same | yes |
| reread | word_swap, word_drop | `tracking_underline`, `sound_dots` | help | shown | only the ask's one model is spoken; no other reading of the line | yes, but `does` forbade the model (fixed) |
| reread | word_swap, word_drop (too long) | `short_line` | simplify | shown + voiced | the practice line is three pool words that share no word with the passage (R3), and its stress word is cleared. The tutor models only the practice line and never reads the passage line during practice | no |
| mark | none | no lever | | | page work, never graded | |

Mode floor: the practice item is itself a reread with a model (the tutor reads it as one group, then the learner reads it back), which is the act expression scores. A practice line is not offered on the plan step or on the cold first read. A practice item there would skip the plan and the model, which would make it a different task.

Per-item coverage: on all 12 read items of the saved expression payload, `tracking_underline` answers both misses. On all 6 rereads, `short_line` is also offered (unit test over the payload).

## Changes

- `readAloudStudioLevers.ts`: `shortLine` builds a reread practice item (`<id>~simpler`, `modelGroups: [text]`, `stressWord` cleared). The reread help levers' `does` text now matches dialogue's ("say the line only as your model"). `short_line.does` on a reread stops the tutor from carrying the model over to the passage line.
- `ReadAloudStudio.tsx`: on a practice line, the parent's phrase marks are no longer applied to the practice words, and the "Your phrase plan" label is hidden.
- `literacy.ts` catalog: removed the `unanswered.expression` entry.
- `liveJourneySpec.ts` (read-aloud-studio row): the plan step is driven by tapping "Use my phrase plan" (it has no wrong input). A `~simpler` item is rebuilt from its parent with `shortLine`.
- `journey-sweep-baseline.json`: removed `read-aloud-studio.expression` `J1-drivable`. The sweep, filtered to this primitive's 3 payloads, now drives all 18 expression items with no findings. The inventory status changed from `none` to `levers`, with both misses answered.
- Tests: `readAloudStudioLevers.test.ts` (expression section on the saved expression payload, replacing an expression check that read accuracy lines) and 3 mounted cases in `ReadAloudStudio.levers.workspace.test.tsx`:
  - a pull draws the underline and adds the `levers_on_screen` fact in one commit, with nothing sent;
  - the attempt records the lever;
  - a refused pull leaves the screen, facts, levers and attempts unchanged;
  - `short_line` opens `line-1-reread~simpler` with no passage word on the screen or in the facts, then the reread comes back without marks and is credited.

## Results

- vitest: the 7 read-aloud-studio files plus `lessonWorkspacePlan.test.ts`, 89/89 passed. The sweep filtered with `-t read-aloud-studio` passed 3/3 payloads.
- `typecheck:lumina`: 0 errors in these files. The 2 errors reported are in `decodableReaderLevers.ts`, which a sibling agent owns.
- Not run: the full sweep, tutor replay and Live (the batch step owns these).

## Still open

- The phrase-plan step has no lever by design: it has no miss.
- Not in this scope: the catalog still lists every accuracy and dialogue miss as `unanswered`, even though levers answer all of them. The note dates from before spoken misses were emitted. Removing those entries is a one-line catalog edit plus the test pin.
