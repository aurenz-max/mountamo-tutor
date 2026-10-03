# di-word-problem-setup: failure inventory and lever table (2026-10-03)

**BUILT 2026-10-03** (rulings R1-R10 as recommended): `qa/eval-reports/di-word-problem-setup-levers-2026-10-03.md`.
Rulings carried over: DI gets in-item levers; DI's correction is a parallel-item model (2026-10-02). This pack is the
hands + voice hybrid: the big amount (or the whole family) is PLACED with the story-part cards and checked in code;
the kind, the family, the operation and the answer are SAID. No lever changes which steps are placed or said.

## What an item is here

A session item is one STEP of a story (`diWordProblemScript.ts` `itemsFromProblems`). Steps per mode:
find_big_number = big_number (hands), solve. build_family = big_number (hands: all three cards), family, operation,
solve. classify_and_build = classify, then the build_family steps. The pack does NOT use `DiTeachingStage`: it runs
`useWorkspaceRunner` directly and publishes its own `workspace.current` (`DiWordProblemSetup.tsx:131-134`).

## Phase 1: failure inventory

Evidence: **no observed-real.** Synthetic = the placement check `wordProblemMiss` (code) and the `spoken_miss` ids
(`wordProblemSpokenMisses`; sweep `wired-all-2026-09-29.log`: find_big_number 38/38, build_family 20/20, 0 false
positives; classify_and_build not swept: no payload), and the 09-10 Live signature bench (12/12 refused,
`di-word-problem-setup-live-di-signature-2026-09-10.md`). Documented = catalog `commonStruggles` (biggest number in
the big slot, family said upside down, a subtraction sentence for the family, operation from the story's verb,
silence). `logs/demonstrations` has none. No `docs/contracts/di-word-problem-setup.md`.

| Mode (β) | Step | Failure (miss id) | Observed by | Class |
|---|---|---|---|---|
| all three | big_number | the unknown box in the big slot (`box_in_big`) | **code** (placement) | synthetic + documented |
| all three | big_number | a printed small amount in the big slot (`printed_small_in_big`) | **code** (placement) | synthetic + documented ("biggest number I see") |
| build_family, classify_and_build | family | the big number in a small slot (`big_in_small_slot`) | spoken | synthetic + documented |
| build_family, classify_and_build | family | a subtraction sentence (`subtraction_sentence`; subtraction frames only) | spoken | synthetic + documented |
| build_family, classify_and_build | operation | the other operation (`opposite_operation`) | spoken | synthetic + documented (verb cue) |
| all three | solve | the printed numbers combined the other way (`wrong_way`) | spoken | synthetic + documented |
| all three | solve | a number printed in the story (`said_story_number`) | spoken | synthetic |
| all three | solve | off by one or more (`one_short`, `one_over`, `short_by_more`, `over_by_more`) | spoken | synthetic |
| classify_and_build (4.5) | classify | the kind the scripted key calls the signature error (`signature_kind`) | spoken | synthetic (script key) + documented in the key |
| classify_and_build | classify | the third kind (`other_kind`) | spoken | synthetic |
| all three | any | silence after the ask | — | documented; no lever (a waiting problem) |

The family step reads a board the child has already built and the page has drawn, so `big_in_small_slot` there is
a misreading of what is on screen, not a second placement error.

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| find_big_number, build_family | every miss | `model_story`: a card beside the story with TWO short different stories, each solved through this mode's steps (big amount marked, family with its box, operation, answer). Exactly one has the box as its big amount (add), one has a printed big amount (subtract). The tutor reads one as "My turn", says which part is its big amount and why, then the other, then hands back the child's story | help | both | Neither model story uses the item's frame. No model number equals any of the item's three quantities; each model answer is not within 1 of the item's answer; `saysWords` over the model lines against the item's answer. Names and noun differ from the item's theme. One add and one subtract always, whatever the item is, so the card gives nothing by inversion. `does`: voice both stories, never only the one shaped like theirs, never say which card of theirs is big | no | picker over `planWordProblem` with code-owned model themes; card render |
| classify_and_build | every miss | `model_story` as above, with THREE stories, one per kind, each labelled with its kind; at least one add and one subtract | help | both | As above, plus: all three kinds always appear, so neither the child's kind nor an excluded kind can be read off the card | no | as above |
| all three | box_in_big, printed_small_in_big | `story_links`: tapping a story-part card underlines the sentence it comes from | help | shown | Marks only the sentence of the card the child taps. Never marks a card big or small, never orders cards by size, never draws the bar model before the placement is credited | no (the story is one string) | plan carries sentence spans per quantity; render |
| build_family, classify_and_build | big_in_small_slot, subtraction_sentence | `read_along`: a highlight moves left to right across the built family (slot, +, slot, =, slot) as the tutor or child reads | help | shown | Highlights positions already drawn; prints no value the board does not show; the box stays "?" | no | render |
| all three | wrong_way, said_story_number, off-by | `count_dots`: dots inside the bar model's known segments. Add: each known small amount as its own row of dots. Subtract: the big amount's dots with the known small amount's crossed out (the `dot_model` / `take_away_dots` shapes) | help | shown | Never a combined count, never labels what is left, nothing in the box segment. Refused above 20 | no (bars are proportional, no dots) | render + scene fact |
| all three | off-by | `within_ten`: the same frame with every amount at most 10 (no bridging ten); for a within-100 session, within 20. Ungraded solve step, then the full one | simplify | both | Same frame and step (mode floor: same setup, same operation). No amount shared with the item; answer not the item's answer. Refused when the item is already inside the band | builder exists at generation only (`drawNumbersFor` + `planWordProblem`) | runtime builder + practice render (earlier steps drawn as given) |

### Rejected and no-lever rows

- **A single model story.** Its operation is add or subtract. If it is chosen to differ from the item's, an
  inverting child reads the answer off it; if it matches, it hands it over. The pair (and the triple for classify)
  holds both, independent of the item. **Class finding:** di-dice-roll's compare_dice model always has the other
  relation for a left or right item, which an inverting child can read the same way (open question below).
- **big_number simplify (an easier story to place).** The answer is one of three cards, and the story's big status
  decides it: when the box is big, the answer IS the box card. A practice story with the item's status hands that
  over on return; one with the other status trains the miss it is meant to fix. No lever: `model_story` (both
  statuses) and `story_links` are the only levers.
- **Highlight the question, or label the box card.** The cards already show "?" on the unknown; it adds nothing.
- **Draw the bar model before the placement.** It shows the whole. The page draws it only after the credit, for
  this reason.
- **operation help on the item** (ring the box's slot label). "Box in the big slot → add" is the rule, so the ring
  is one step from the answer. The pair's two solved operations are the lever.
- **classify help on the item** (underline "more", "then", "in all"). The cue word maps to the kind, and taking
  the kind from a word is the signature error. **classify simplify:** a practice story's kind either equals the
  item's (handed over) or is one of its wrong answers (eliminated on return). No lever beyond the three-kind model.
- **family simplify.** The step reads a board already drawn; there is no smaller family in the mode.
- **Silence:** no lever.

## Phase 6: starting positions

| Tier | Starts on screen | Unchanged |
|---|---|---|
| easy | `model_story` (pair, or triple in classify_and_build); not recorded as a pull | every step's ask re-reads the story (a voice reading aid; it states no answer) |
| medium, hard | none | only the first step reads the story |

No tier is medium in this pack (`contextFor` defaults to `medium`). The generator's tier changes nothing
structural and stays as it is.

## Build notes

- **Lever module** `diWordProblemLevers.ts`: declarations with `answers`, the model picker, leak rules,
  `within_ten`, scene facts. The model is per STORY, so the easy card is the same across its steps. Runtime builders
  must not call `drawNumbersFor` or `shuffleWithPool`: they advance the module's shared xorshift seed. Enumerate
  number pairs through `planWordProblem` with two or three code-owned model themes that pass `themeUsable`.
- **Unit test must show** every frame × a dense grid of numbers (≤ 20 and ≤ 100) has a non-leaking pair and triple,
  the pair always holds one add and one subtract, the triple all three kinds, and `within_ten` never repeats an
  amount or the answer.
- **Lever plumbing, pack-local (no shared stage here):** lever state per session step and a practice item in the
  component, cleared on a new step and kept through a retry; `levers`, `pullLever` and `endPractice` on
  `workspace.current` beside `wordProblemScene`; an `onScreen` fact. `NumberLine.tsx` is the pattern for a
  `useWorkspaceRunner` primitive (`runner.practice`, `checkPractice`). The only practice item is a spoken solve
  step, so `commitBoard` needs no practice path.
- **Practice render:** the component derives every mark from `committed` step ids of the current problem. A
  `within_ten` solve step needs its story's earlier steps drawn as given (family built, sign, bar model) without
  being credited. This is the main render cost.
- **`story_links`** needs `WordProblemPlan` to carry the story as sentence spans with quantity ids. The templates
  already build it sentence by sentence; the change is mechanical.
- **Payloads:** find_big_number and build_family exist; **classify_and_build has none**, so the sweep, J9 and the
  replay cannot see the classify step or the triple. Make `w1-payloads/di-word-problem-setup.classify_and_build.json`
  (one Flash generation).
- **Catalog:** `levers: true`; guidance points to `model_story` and keeps "never say which part is the big amount".

### Open questions for the user

1. **Pair model instead of one parallel story.** The ruling says "a different item, solved"; this draft shows two
   (three in classify_and_build) so the binary operation and the big status cannot be read off by inversion.
2. **Inversion in the built di-dice-roll compare model.** Same class: should compare_dice show two solved pairs, one
   each side, instead of the other-relation pair?
3. **No simplify on the hands step** (reason above). The placed step is answered by help only.

### Shared-stage changes needed

None to `DiTeachingStage` (not used here). If the other non-stage DI packs follow, the lever/practice state could
move into a small hook shared with the stage; not needed for this slice.
