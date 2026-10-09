# fast-fact — support levers, 2026-10-09

Modes: recognize (β2.5), recall (β3.5), apply (β5.0). One closed-set tap per item, any subject, untimed.

## Failure inventory

Evidence: no real-learner data (no demonstrations, misconception or remediation files for fast-fact). Synthetic = the
journey's scripted wrong taps on 5 payloads; documented = catalog `commonStruggles`.

| Mode | Failure (miss) | Class |
|---|---|---|
| recognize | miscounts a counting picture (`one_less`, `one_more`, `other_number`) | synthetic (counting payload) |
| all | another operation's result on a two-number stem (`wrong_operation`) | synthetic + inferred |
| all | a number slip on an arithmetic fact (`one_less`, `one_more`, `other_number`) | synthetic |
| all | another choice on a word/symbol menu (`other_choice`) | synthetic (elements payload); documented ("answers without reading carefully", "freezes") |

## Lever table (built)

| Lever | Kind | Modes / items | Answers | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| `spread_pictures` | help | a counting question over one repeated glyph, numeric key | one_less, one_more, other_number | shown | `spreadLeak`: boxes carry no numeral; fact never says how many |
| `count_model` | help | a sum, difference or product in the stem whose value is the key, at most 30 dots | wrong_operation, one_less, one_more, other_number | shown | `modelLeak`: no numeral, sum in two colors, never one group of the result; fact names only the stem's numbers |
| `drop_far_choice` | simplify (on the item, knowledge-check's lever, user ruling 09-27) | any menu with two untried choices left after the drop | all five | shown | `farChoice`: never the key, never a tapped choice, never leaves the answer alone |

Every mode has levers; no miss is listed `unanswered`. Simplify is the on-item drop, not a practice item: a drill
fact in an arbitrary subject has no code-built easier twin, and the LLM is not called at runtime.

**No lever:** a two-choice item (yes/no), and a three-choice item that is neither counting nor arithmetic once one
wrong choice has been tapped (the drop would leave only the answer). Not hit on the five saved payloads (all 4-choice
or counting); a payload with such an item would raise J12. A generated cue picture (knowledge-check's `cue_picture`)
would cover word items but needs a generator field and its own leak rule: queued below, not built.

Starting positions from `config.difficulty`: not built. The generator's tier already sets option count (3 easy, 4
medium/hard) and attempts; adding lever start positions would need per-challenge start fields.

## Gates

- `typecheck:lumina`: 0.
- `fastFactLevers.test.ts` 23/23 (leak rules per mode over 1-20 pictures and every a op b to 10; drop guard; miss then
  `nextLever` table). `FastFact.levers.workspace.test.tsx` 6/6 (commit changes screen and fact together, lever on the
  next attempt, refused pull changes nothing, three choices after a miss offer no drop, a new item starts clean).
  `FastFact.workspace.test.tsx` 9/9. All core fast-fact tests + pip: 57/57.
- Sweep + W1 contract + misses (`-t fast-fact`): 27/27; 5 payloads, 0 findings J1-J13, 50/50 checked misses named,
  J10/J11 records clean (clean 100, recover 67 with first-response 0). Unfiltered sweep + contract + misses +
  lessonWorkspacePlan + activityContract: 2821/2821.

## Tutor replay (5 payloads x 5 moments x 5 samples), `replay/fast-fact-2026-10-09-r3.json`

1 flag in 125: apply start `no_key_before_try`, the tutor reading the whole menu in words ("four, six, five, or seven");
a checker false positive (the menu rescore excuses digits, not number words). Stuck: the tutor pulls the item's lever
itself every time (count_model on sums, spread_pictures on counting, drop_far_choice on missing addend and element
symbols) and narrates only after the call (`no_change_before_receipt` 0/25). Lever replies describe the change and ask
the learner to count; none says a total. The W1 run's "its name starts with He-" did not recur (0/10 stuck/lever).

## Open

1. Word items with three or two choices have no lever after a miss: `/add-support-tiers` follow-up with a generator
   cue picture (`gemini-fast-fact.ts`) and a `cueLeak` rule, if the user wants it.
2. Replay checker: number words of an on-screen numeric menu count as a key leak (`replay_checks.py`, shared harness).
3. Browser check owed on the spread boxes and the dot model (jsdom only).
