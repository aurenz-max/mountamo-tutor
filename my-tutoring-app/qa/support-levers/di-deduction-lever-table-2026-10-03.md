# di-deduction: failure inventory and lever table (2026-10-03)

**DRAFT — awaiting user confirmation.** `/add-support-tiers` Phases 1-2 only. Nothing is built.
Rulings carried over (2026-10-02): DI gets in-item levers; DI's correction is a parallel-item model (a
different item, solved, beside the learner's; never the learner's item, its answer, or one step from it);
DI is spoken-first. Pack rulings kept (memory `project_di-deduction-pack`): the `cannot_tell` subject is
ANONYMOUS ("this animal"), the lookalike is named only in the reason; the truth review TRIMS entities and
never drops a rule. No lever below names a cannot_tell subject or touches a generated rule or entity.

## What makes this pack different

The answer is a verdict and a reason from the rule. On `conclude` the property printed on the rule card is
the answer by design; on `cannot_tell` the reason is the lookalike, which the key requires the child to
name. So help on the item may point at what is printed and show the answer's form, but never the
conclusion, a verdict, or a lookalike.

**Why the generated pool cannot supply a model or a practice case.** Every generated rule is a session
item: a single-mode session works each rule twice (`planCases`, `perShape` 2), a mixed one once per shape.
A model from another session rule hands over that rule's later cases. A model from the item's own rule
with a spare member ("A bee is an insect" beside "A beetle is an insect") has the same property as its
answer, which is one step from the item. So the model and the practice case come from a small
**hand-authored bank of true rules in code** (no LLM at runtime, no truth review needed, because each entry
is checked by hand once).

**Finding: legacy text modelled the child's own case.** The deleted scripted path's `modelOf(item)` and the
catalog `commonStruggles` responses ("model the reasoning with the counterexample, then hand the case
back") model THIS case. On the bound path the tutor gets `tutoring: null`, so they are stale rather than
live; the slice removes them with the guidance edit.

## Phase 1: failure inventory

Evidence: **no observed-real.** Observed-synthetic: the 2026-09-07 Live bench (67/67, zero false affirms;
affirmed-consequent 5/5, verdict-no-reason 8/8) and the signature run (2/2 `backwards_yes` refused), all
with scripted text answers; the W1 runtime payload runs of 09-26. Documented: the catalog miss lists
(`di.ts:1142`), `commonStruggles` (four) and the key text in `deductionKey`. `logs/demonstrations` has no
entries for this id. No `docs/contracts/di-deduction.md` (Phase 3 derives it). Saved payloads exist for all
three modes.

**Fix first (Phase 1 step 4): the saved cannot_tell payload is a false item.** `w1-payloads/
di-deduction.cannot_tell.json` has one rule, "All birds have feathers.", with the lookalike "pillow" and
kindNoun "animal". A pillow is not an animal, and in the world only birds have feathers, so "This animal has
feathers. Is it a bird?" → "yes" is TRUE. That is the failure the anonymous-subject ruling exists to
prevent. The truth review should have trimmed "pillow", after which the rule correctly builds no
cannot_tell case. The payload also holds a single case. Queue under `/eval-fix`: a lookalike must be a
kindNoun thing that truly has the property; regenerate the payload. Any lever measured on it now is
measured on a false item.

| Mode (β) | Failure | Class |
|---|---|---|
| conclude (2.5) | says the opposite: "it doesn't have six legs" (`said_negation`) | synthetic + documented (miss list) |
| conclude | reads the rule back (`read_rule_back`) | synthetic + documented (`commonStruggles`) |
| conclude | reads the case back (`read_case_back`) | synthetic + documented (miss list) |
| deny (3.5) | verdict yes, it is one (`said_member`) | synthetic + documented |
| deny | verdict can't tell (`said_cannot_tell`) | synthetic + documented |
| deny | a bare "no", or a reason not from the rule ("no, because it's a spider") (`verdict_without_reason`) | synthetic (bench 8/8) + documented |
| cannot_tell (4.5) | "yes, because it has six legs": runs the rule backwards (`backwards_yes`) | synthetic (bench 5/5, signature 2/2) + documented (the signature error) |
| cannot_tell | verdict no, with no reason about other things (`said_not_member`) | synthetic + documented |
| cannot_tell | a bare "can't tell" (`verdict_without_reason`) | synthetic + documented |
| all three | answers from world knowledge, not the rule ("no, it's a reptile") | documented (guidance, `deductionKey`); **no miss id** |
| all three | silent after the ask | documented; no lever (a waiting problem) |

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all three | every miss | `model_case`: a small card beside the two cards with a DIFFERENT rule from the code bank and a case of the same shape, solved with its reason. conclude: "All spiders have eight legs. A tarantula is a spider. So it has eight legs." deny: "... A crab does not have eight legs, so it is not a spider." cannot_tell: "This animal has eight legs. Can't tell: a scorpion has eight legs too, and it is not a spider." The tutor says it as "My turn", then asks the child's case | help | both (G2-5; the voice carries it, as it carries the rule and case) | The bank rule shares no content word with any session rule (category, plural, property, kindNoun, every entity), so it answers no case of the session; its subject is never the item's; a cannot_tell model keeps the anonymous subject and names its own lookalike only in the reason. `does` forbids applying the model to the child's rule ("so the bird…") and naming any lookalike of the child's rule. The model's verdict equals the item's by construction (open question 1) | no (the scripted correction modelled the child's own case; deleted in LA-14 S5) | hand-authored bank + picker + leak check + card render |
| conclude | read_rule_back, read_case_back | `answer_frame` (conclude form): under the cards, "A beetle ___." (the case's subject, then one empty box) | help | both (the tutor reads the frame) | Prints the item's subject and an empty box only; never the property, a negation, the category or "so" | no | render + scene fact |
| deny, cannot_tell | verdict_without_reason | `answer_frame` (verdict form): under the three verdict words, "[ ] because [ ]" with both boxes empty | help | both | Prints "because" and two empty boxes; lights no verdict word; no word of the rule, the case or a lookalike | no | render + scene fact |
| conclude, deny | conclude: said_negation; deny: said_member, said_cannot_tell | `shared_term`: lights, in one colour, the phrase the two cards share. conclude: the category ("insects" / "an insect"). deny: the rule's property and the case's whole negated property ("have six legs" / "does not have six legs") | help | shown | Lights whole phrases already printed on the two cards; draws no arrow, no "so", no verdict, no conclusion; on deny the negation is lit with its phrase, never left out | no (the cards are plain text) | render + scene fact |
| cannot_tell | backwards_yes, said_not_member | `counterexample_card`: an ungraded practice case from the bank (a different rule, anonymous subject) with a third card printing its lookalike fact ("A scorpion has eight legs. A scorpion is not a spider."). The child still says can't tell and why; then the full case returns, and only it is credited. One step less: the counterexample is given, not recalled | simplify | both | The bank rule shares no content word with any session rule; never the item's lookalike or any session lookalike; the practice subject is anonymous; the lookalike card belongs to the practice rule only | no | builder over the bank |

### Rejected and no-lever rows

- **conclude: no simplify lever.** It is the mode's floor (one rule, a named member). A yes/no check ("Does
  a beetle have six legs?") turns stating the conclusion into verifying one, which crosses the mode; another
  conclude case asks the same thing, not less.
- **deny: no simplify lever.** Dropping the reason crosses the mode (a verdict with its reason is the deny
  answer), and a conclude case is a different mode.
- **cannot_tell: no in-item help beyond `answer_frame`.** `shared_term` here would light the matching
  property, which is the cue that produces `backwards_yes`. Naming or picturing a lookalike is the reason
  itself. Showing "only" against the rule ("All birds…" vs "Only birds…") states the reason.
- **A model or practice case from the generated pool:** see "Why the generated pool cannot supply" above.
- **Answers from world knowledge:** no lever until it has a miss id; `model_case` covers it by `when` text
  ("using only the rule").
- **Silence:** no lever; the tutor waits.

## Phase 6: starting positions

Same as di-math-facts and di-dice-roll: easy (or no tier) starts with `model_case` on screen, not recorded
as a pull; medium and hard start with none. The existing easy behaviour (the rule re-read on every ask) is
the stimulus, not a lever, and stays. medium and hard remain identical, as the script's L3 note already
says; splitting them is not this skill's job (no within-mode β).

## Build notes

- **Fix first:** the cannot_tell content defect above (`/eval-fix`, `gemini-di-deduction.ts` truth review
  and lookalike gate), then regenerate `w1-payloads/di-deduction.cannot_tell.json`.
- **Shared stage:** `DiTeachingStage` has the `levers` prop and the practice item; nothing new. A practice
  item is a `DeductionItem` built from a bank rule (its own `ruleId`, so it has its own item id);
  `deductionAssignment` already builds its key and misses. The stimulus draws the third card when the
  practice item carries a counterexample. `ruleCounter` and the ledger read the session item, so the bank
  rule does not move the counter or enter the ledger.
- **The bank:** 6-8 hand-authored `DeductionRuleSpec`s passing `findRuleDefects`, each with a lookalike that
  is a kindNoun thing truly having the property (spiders / eight legs / scorpion; squares / four equal sides
  / rhombus; birds / lay eggs / turtle; fish / live in water / whale). A rule with no true lookalike
  (triangles / three sides) serves conclude and deny only. Unit test: every saved and bank-crossed session
  has a non-leaking model of each shape.
- **Miss lists:** present for all three modes. Missing: an id for answering from world knowledge (optional,
  `/add-live-tutor-tools`).
- **Catalog:** `levers: true`; add to the guidance that the model is `model_case`, a different rule, never
  this case (guidance is near the 2000-character cap); remove the stale `commonStruggles` responses that
  model the child's case.

## Open questions for the user

1. The model is the same mode, so its verdict always equals the item's ("can't tell" beside a can't-tell
   case). di-dice-roll forbade a compare model with the item's relation, because there the word was the
   whole answer. Here a bare verdict is a miss (`verdict_without_reason`) and the model's reason shares no
   word with the child's rule. Is the shared verdict acceptable?
2. Bank in code (off-topic: a spider model in a birds lesson) or one extra rule generated per session and
   truth-reviewed (on-topic, more schema and a generation-time cost)? The draft assumes the code bank.
