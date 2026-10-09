# cause-effect-chain: support levers (2026-10-08 class sweep, run 2026-10-09)

Skill: `/add-support-tiers`. Modes: identify_cause, build_chain, root_vs_proximate (none had levers). Phase 2 stop waived by the user for this sweep. No contract doc exists for this primitive (`docs/contracts/cause-effect-chain.md`); the constraints used are the catalog's own directives ("never name a card or a slot", a correction clears the whole board).

## Failure inventory

No real-learner evidence (no demonstrations, tutor reports or misconception runs for this primitive). Two saved payloads (build_chain, identify_cause); no root_vs_proximate payload.

| Mode | Failure | Evidence class | Miss id |
|---|---|---|---|
| identify_cause | says yes to an event because it is about the same story (a consequence) | documented (commonStruggles), synthetic (journey wrong answer) | `consequence_as_cause` |
| identify_cause | says yes to a background fact | documented (judging contract) | `background_as_cause` |
| identify_cause | says no to a real cause that is not the last or biggest | documented | `cause_denied` |
| build_chain | orders by story feel, not by what had to exist first | documented, synthetic (journey reverses the chain) | `reversed`, `two_swapped`, `other_order` |
| root_vs_proximate | names the other end of the chain | documented (signature miss) | `other_end` (new) |
| root_vs_proximate | names an event from the middle | inferred (journey's plain wrong) | `middle_event` (new) |

root_vs_proximate had no miss function: `causeEffectSpokenMisses` now names both, card by card, and the catalog lists them.

## Lever table

The cards are the answer in pieces, so no lever marks, moves or orders a learner's card. Help is an empty decomposition under the item's card, or a model chain from everyday life beside the item (`causeEffectModels.ts`, 6 hand-written chains). Simplify builds `<item>~simpler` from a model chain different from the one the help draws.

| Mode | Lever | Kind | Carrier | Answers | Leak rule |
|---|---|---|---|---|---|
| identify_cause | `two_tests`: two empty checks under the card ("Did it happen before the ending?", "Did the ending need it?") | help | both | all three | nothing is ever ticked |
| identify_cause | `role_model`: everyday ending + three cards tagged came-before-and-needed / happened-after / only-true-at-the-time | help | both | all three | `modelLeaks`: no model card shares 2+ words with any lesson card or ending |
| build_chain | `model_chain`: everyday chain drawn in order with arrows, beside the board | help | both | all three | `modelLeaks`; never touches the board |
| build_chain | `shorter_chain`: everyday chain with one card fewer to order (min 2), shown shuffled | simplify | shown | all three | `practiceLeaks`: own id, same kind, n-1 cards, not in causal order, no card reads as a lesson card |
| root_vs_proximate | `ends_model`: everyday chain drawn in order, first card tagged root, last tagged right before the ending | help | both | both | `modelLeaks` |
| root_vs_proximate | `ordered_chain`: same ask (root or proximate) on an everyday chain drawn in causal order, so only the end is left to pick | simplify | both | both | `practiceLeaks`: same ask and card count, in causal order, no card reads as a lesson card |

Per item: on all three saved lessons (two payloads + the generated fixture) every item gets both of its levers (unit test). Gaps by shape: identify_cause has no simplify (one card and a yes or no is already the plainest shape), and a two-card build_chain has no simplify (the generator writes 3 or 4 cards, so this does not occur on generated lessons); both keep their help levers, so no miss is left unanswered and the catalog `unanswered` map is unchanged.

Starting position (Phase 6): `supportTier: 'easy'` starts identify_cause with `two_tests` on screen. It is not offered as a lever and is not recorded on the attempt. The generator already stamps `supportTier`; it was not changed.

## Built

- `history/causeEffectChainLevers.ts` (new): lever declarations, `modelLeaks`, `practiceItem`, `practiceLeaks`, `practiceParent`, `leversOnScreen`, `startingLevers`.
- `history/causeEffectModels.ts` (new): the model chain pool.
- `history/causeEffectChainWorkspace.ts`: `other_end` / `middle_event` spoken misses for root_vs_proximate.
- `history/CauseEffectChain.tsx`: lever state keyed by item, the practice item in place of the session item (a retry on it rebuilds its own board, `onPracticeClosed` returns the full item empty), the three help renders and the in-order practice render, `levers` / `pullLever` / `endPractice` and an `onScreen` fact.
- Catalog `history.ts`: `misses.root_vs_proximate`.
- `liveJourneySpec.ts` row: a `~simpler` item is rebuilt from its parent with `practiceItem`.

Size: about 370 production lines including docblocks (levers module 199, pool 46, component about 110, workspace 22) against 323 test lines.

## Tests

- `causeEffectChainLevers.test.ts` (new): 36 pass. Pool gates (speakable, ear-separable at 3 and 4), per-item coverage on the saved lessons, each leak rule, both builders, the root misses, miss -> `nextLever` for every miss.
- `CauseEffectChain.levers.workspace.test.tsx` (new, mounted): 5 pass. A pull changes the screen and the fact in one commit; the next attempt records the lever; a refused pull leaves screen, levers and attempts unchanged; `shorter_chain` and `ordered_chain` open a practice item, a practice retry stays on the practice board, the full item comes back blank and is credited with the lever recorded; the easy starting position records nothing.
- Existing cause-effect-chain tests (workspace, script, DI script, generator shape and audit): all pass, 157/157 across 7 files including the new ones.
- `npm run typecheck:lumina`: 4 errors, none in these files (`calendarExplorerLevers.ts` x3, `sortingStationLevers.test.ts` x1, sibling sweeps mid-edit).

Not run (batch verify step owns them): journey sweep, tutor replay. No Live run.

## Left without levers

None of the declared misses. Shape gaps by item: identify_cause has no simplify, and a two-card build_chain (not generated) has no simplify; both have help levers.
