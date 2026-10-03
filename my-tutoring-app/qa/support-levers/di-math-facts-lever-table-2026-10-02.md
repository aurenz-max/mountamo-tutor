# di-math-facts: failure inventory and lever table (2026-10-02)

`/add-support-tiers` Phases 1-2, the DI pilot. Confirmed by the user 2026-10-02 and BUILT: `qa/eval-reports/di-math-facts-levers-2026-10-02.md`.

**User rulings 2026-10-02:** (1) DI families get in-item levers. (2) DI's correction is a
**parallel-item model lever**: the tutor models a different fact, with its answer, then asks the
learner's item again. It is recorded as help, and the learner's own item is never modelled or answered.

## Why DI needs levers now

The scripted "my turn" correction was deleted in LA-14 S5 (`DiTeachingStage.tsx` docblock). On the
bound path the tutor gets `tutoring: null` (`adapterContract.ts:158`) and follows `WORKSPACE_DOCTRINE`
("after a mistake, never say the answer"). After a miss its only tools are `begin_help` (words) and
`demonstrate` (outline the whole problem or a printed term).

## Phase 1: failure inventory

Evidence: **no observed-real.** Synthetic = the `spoken_miss` ids (`mathFactSpokenMisses`, wired
09-28, 0 FP in the 3630-sample sweep). Documented = catalog `teachingWorkspace.misses` and
`commonStruggles`. `logs/demonstrations` has no di-math-facts entries; the 07-25 Live report never
drove a wrong answer. There is no `docs/contracts/di-math-facts.md` yet (Phase 3 derives it).

| Mode (β) | Misses (all synthetic + documented) |
|---|---|
| name_numeral (1.5) | recited_sequence, look_alike_numeral (6/9), teen_decade_swap, off-by |
| counting_next (1.5) | said_printed, said_before, said_two_after, decade_rollover, teen_decade_swap, off-by |
| answer_fact (2.0), fact_review (2.5) | said_addend, teen_decade_swap, off-by |
| subtraction_fact (3.0) | said_start, said_change, added_instead, teen_decade_swap, off-by |

off-by = one_short, one_over, short_by_more, over_by_more.

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all five | every miss; the only lever for teen_decade_swap, decade_rollover, look_alike_numeral | `model_fact`: a small card beside the problem shows a **different** item of the same mode, solved ("1 + 1 = 2"). The tutor says it ("My turn: one plus one is two"), then asks the learner's item again | help | both | The model is never the item, its turnaround, or an item with the same answer; it shares no printed number with the item; its answer is not within 1 of the item's answer. For counting_next, its printed number is at least 2 from the item's. `does` forbids applying the model to the item ("so three plus two is…") | no (on-item modelling via the `support` fact only) | picker + leak check, model card render |
| answer_fact, fact_review | said_addend, one_short, one_over, short_by_more, over_by_more | `dot_model`: a dots under the first number, b dots under the second, in separate rows of five | help | shown | Never a combined group, a total, or a numeral under the dots | no | render + scene fact |
| subtraction_fact | said_start, said_change, added_instead, off-by | `take_away_dots`: a dots, the last b crossed out | help | shown | Never counts or labels what is left | no | render + scene fact |
| counting_next | said_printed, said_before, said_two_after, off-by | `number_path`: the two numbers before the printed one, then it, then an empty box ("5 6 7 □") | help | shown | Never prints a number above the printed one | no | render + scene fact |
| answer_fact, fact_review | said_addend, off-by | `smaller_fact`: same first number + 1 (or a smaller first number when b is already 1); ungraded practice, then back to the full item | simplify | shown + voiced | Not the item, its turnaround, or the same answer | builder exists at generation only | runtime builder |
| subtraction_fact | said_start, said_change, added_instead | `take_one_away`: same start − 1 | simplify | shown + voiced | Same as above; result ≥ 0 | no | runtime builder |
| counting_next | decade_rollover | `inside_decade`: the number after a number in the same decade that does not end in 9, at least 2 from the printed one | simplify | shown + voiced | Its answer is not the item's answer | no | runtime builder |
| name_numeral | teen_decade_swap (on 10+) | `single_digit`: a one-digit numeral; refused below 10 | simplify | shown + voiced | Not the item's numeral, never 6 when the item is 9 or 9 when it is 6 | no | runtime builder |

### Rejected and no-lever rows

- **name_numeral dots.** Dots beside the numeral turn naming into counting, and a counted answer is
  the `recited_sequence` miss. That crosses the mode's defining property, so `model_fact` is the
  only help lever here.
- **teen_decade_swap on the item** ("1 ten and 4"). Any split of the item's answer prints the
  answer, so the swap is answered only by `model_fact` with a teen model of another number.
- **decade_rollover on the item.** A decade path ("10 20 30 □") prints the next decade.

## Phase 6: starting positions (no generator change)

Each item already carries `supportTier`, which sets where its levers start:

| Tier | Starts pulled | Replaces today's `support` fact |
|---|---|---|
| easy | `model_fact` | "the fact may be modelled and said together before the learner answers" |
| medium | none | "the fact may be modelled once before the learner answers" |
| hard | none | "answer it cold" (unchanged) |

**Finding: the easy and medium facts conflict with ruling (2).** They license the tutor to say the
learner's own fact and its answer before a try. The slice rewrites them, and the catalog guidance
line "The support fact says how much you may model before they answer", in the same change.

## Build plan (Phases 3-7)

1. `/primitive-contract di-math-facts` (none exists), then `--check` on the edit.
2. **Shared, once for 9 of the 10 families:** `DiTeachingStage` takes optional `levers`,
   `pullLever` and `practice` from its pack and publishes them on `workspace.current`, with the
   `LEVER_DOCTRINE` guidance flag. di-word-problem-setup wires its own `useTeachingWorkspace`.
3. `diMathFactsLevers.ts`: declarations with `answers`, the model picker, leak rules, and the four
   builders. Then the render branches in `DiMathFactsTeaching.tsx`.
4. Verification: `it.each` over miss → `nextLever`, leak rules over every item in the saved
   payloads, builders over many random items, a mounted pull test, J1-J9, a text replay
   (`--samples 5`). No Live run: the DI class gate waits until all 37 DI modes have levers.
