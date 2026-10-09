# habitat-diorama levers: observe, connect (2026-10-08); predict, restore, defend (2026-10-09)

Class sweep (batch of 5); the user waived the table-confirm stop. build_habitat already had levers; predict, restore and defend are out of scope for this run.

## Failure inventory

| Mode | Failure | Evidence class |
|---|---|---|
| observe | names another choice on screen (`other_choice`) | observed-synthetic (journey plainWrong = signatureWrong), documented (catalog: "every animal eats every other", plants not seen as living) |
| connect | taps the one the start eats: reverse direction (`leads_to_start`) | documented (2026-08-21 drive: 5/5 items were inverted in content, which is the same confusion), observed-synthetic |
| connect | taps a living thing with no relationship to the start (`unconnected`) | observed-synthetic (journey wrong tap) |
| connect | taps one the start leads to by another kind (`other_kind_link`) | inferred |

No real-learner evidence for any of them. No demonstrations, tutor reports or remediation module exist for this primitive. Generated content was not re-audited here.

## Lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| observe | other_choice | `food_lines`: arrows for every relationship (the explore view's render) | help | shown | every relationship is drawn, none marked; refused when there are none or all touch the answer (`foodLinesLeak`) |
| observe | other_choice | `easier_clue`: ungraded observe, plain role clue, two choices, a living thing of another role | simplify | shown + voiced | the stuck answer is never the answer or a choice; the clue is not the stuck clue; only on 3+ choices (`easierObserveItem`, `simplerLeaks`) |
| connect | leads_to_start, other_kind_link | `direction_model`: model pair of two other pictures with the arrow the asked kind goes, caption above K-2 | help | shown (tutor voices for K-2) | neither picture is one a living thing on screen wears (`directionModel`) |
| connect | unconnected | `start_lines`: plain lines, no arrowheads, from the start to each partner | help | shown | only with 2+ partners, no direction or kind drawn (`startPartners`) |
| connect | unconnected, other_kind_link, leads_to_start | `easier_link`: ungraded connect from another start, plainer shape (predation first, then fewer partners) | simplify | shown | never starts at the stuck start, never touches the stuck answer, strictly plainer shape (`easierConnectItem`, `simplerLeaks`) |

No starting positions from `config.difficulty`: both modes start bare (as build_habitat does), so no generator change.

## Built

- `primitives/visual-primitives/biology/habitatDioramaLevers.ts` (new): declarations, leak rules, both builders, scene facts; `organismEmoji` moved here from the component.
- `HabitatDiorama.tsx`: lever publish/pull/endPractice for observe and connect, `food-lines` / `start-lines` svg, direction-model panel.
- catalog `biology.ts`: comment plus `unanswered: { observe: [], connect: [] }` (every miss has a lever).
- `liveJourneySpec.ts` habitat row: rebuilds `~simpler` items from their parent with the same builder.

## Tests

- `habitatDioramaLevers.test.ts`: 28 pass. Covers the leak rules, both builders over every stuck item in an 8-organism pond (with a check that the sweep is not vacuous), and miss → `nextLever`.
- `HabitatDiorama.levers.workspace.test.tsx`: 4 pass. Each pull changes the screen and the fact in one commit, the next attempt records the lever, a refused pull leaves the DOM byte-identical, and each simplify opens `~simpler` with `returnsTo`, then the full item comes back and is credited as assisted.
- All habitat tests: 9 files, 116 pass. `typecheck:lumina`: 0.
- Not run here: journey sweep and tutor replay (the batch step runs them), and no Live run.

## Part 2 (2026-10-09): predict, restore, defend

Same class sweep, table-confirm stop waived. No contract doc exists for habitat-diorama. No miss function was added: predict and defend already report `other_choice` (`habitatSpokenMisses`), restore reports `water_for_land` / `land_for_water` / `other_land_zone` (`habitatMiss`).

### Failure inventory

| Mode | Failure | Evidence class |
|---|---|---|
| predict | names another population on screen (`other_choice`): picks a visible population without tracing the change through the web | observed-synthetic (journey plainWrong), documented (harness `signatureWrong.why`) |
| predict | K-2 cannot read the change card, so does not know where the change starts | inferred (reader-fit) |
| restore | puts it in water when it lives on land, or the reverse, or the wrong land zone (`water_for_land`, `land_for_water`, `other_land_zone`) | observed-synthetic (journey wrong zone) |
| restore | the six zone buttons are words only; a pre-reader cannot tell them apart | inferred (reader-fit) |
| defend | says a true-looking card that does not back the claim (`other_choice`) | observed-synthetic, documented (harness `why`) |

No real-learner evidence. No demonstrations, tutor reports or remediation module for this primitive.

### Lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| predict | other_choice | `change_mark`: a ring around each living thing the change names | help | shown (tutor reads the change) | never rings the answer; refused when the change names nothing else (`changeMarks`) |
| predict | other_choice | `food_lines`: every relationship as an arrow | help | shown | observe's rule: all drawn, refused when every arrow touches the answer (`foodLinesLeak`) |
| predict | other_choice | `easier_change`: ungraded "Every X leaves the habitat", which population will increase; 2 choices: X's prey and a living thing 3+ links from X | simplify | shown + voiced | not the stuck answer, cause or change; foil not next to the prey or X (`easierPredictItem`, `simplerLeaks`) |
| restore | all three | `zone_pictures`: a picture on each of the six zone buttons | help | shown | all six alike, none marked |
| restore | all three | `its_partners`: rings around every living thing the missing one has a relationship with | help | shown | zones are not drawn on the habitat, so a ring names none; refused with no partner (`restorePartners`) |
| restore | all three | `body_clues`: up to 3 adaptations beside the missing one | help | shown text, voiced via fact | drops any adaptation with a zone or place word (`bodyClues`); refused when none is left |
| restore | — | no simplify | — | — | no other living thing carries a zone in the data; a two-zone copy of the stuck item is the stuck item |
| defend | other_choice | `card_pictures`: each card shows pictures of the living things it names | help | shown | refused when only the key would get pictures, or the key is the only card sharing a living thing with the claim (`cardPictures`) |
| defend | other_choice | `food_lines` (arrows are the visible evidence) | help | shown | all drawn; the answer is a card, so no arrow singles it out |
| defend | other_choice | `easier_claim`: ungraded "The X needs other living things for its food." with 2 cards: "The X eats the Y." / "The X lives in this habitat." | simplify | shown + voiced | X and Y are named nowhere in the stuck claim or cards; no shared card text (`easierDefendItem`, `simplerLeaks`) |

Per-item gaps (lesson a): a predict item whose change names only the answer, whose arrows all touch the answer, and whose web has no far foil has no lever. A defend item gets at least `food_lines` whenever the habitat has a relationship. Every restore item has `zone_pictures`. No starting positions from `config.difficulty` (no generator change).

### Built

- `habitatDioramaLevers.ts`: `namedIds`, `changeMarks`, `easierPredictItem`, `ZONE_PICTURES`, `restorePartners`, `bodyClues`, `cardPictures`, `easierDefendItem`, `easierItemFor`; declarations and scene facts for the three modes; `food_lines` extended to predict and defend.
- `HabitatDiorama.tsx`: lever block covers every non-build mode; `ringIds` on the scene; zone button pictures (buttons keep `aria-label` = zone name); body-clue list; card pictures.
- `liveJourneySpec.ts` habitat row: rebuilds any `~simpler` item with `easierItemFor`.
- catalog `biology.ts`: `unanswered` now lists all six modes empty.

### Tests

- `habitatDioramaLevers.test.ts`: 46 pass (18 new): each leak rule, both builders over every pond predation link (non-vacuous check), miss → `nextLever` per mode.
- `HabitatDiorama.levers.workspace.test.tsx`: 8 pass (4 new): predict ring and easier change; restore three helps (refused second pull leaves DOM and levers unchanged, place-word adaptation not shown); defend card pictures then easier claim; each simplify opens `~simpler` with `returnsTo`, then the full item returns blank and is credited as assisted.
- All biology tests: 16 files, 231 pass. Generator and script tests: 106 pass. `lessonWorkspacePlan.test.ts`: 14 pass. `typecheck:lumina`: 0.
- Not run: journey sweep, tutor replay, Live (batch step).

## Without levers

restore has no simplify lever (reason above). Every mode's catalog misses have at least one lever; the per-item gap for predict is listed above.
