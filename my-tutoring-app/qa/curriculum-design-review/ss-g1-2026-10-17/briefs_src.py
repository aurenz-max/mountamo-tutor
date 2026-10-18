"""Build briefs for the Social Studies grade 1 design review (authored review content)."""

BRIEFS = {
'1-same-and-different-two-lives.md': ('Same and different: two children, two celebrations', ['SS005-03-c', 'SS005-04-d', 'sibling SS005-03-a', 'sibling SS005-03-b'], """
## Curriculum

- **SS005-03-c** (Similarities and Differences): "Read a short story about a child from another country and identify two traits that are the same as your life and two that are different. ... Constraints: Passage under 150 words; utilize a simple checklist for identifying similarities and differences."
- **SS005-04-d** (Celebrations Around the World): "Compare two celebrations that serve similar purposes, such as New Year festivals or harvest holidays, by analyzing their similarities and differences. Focus: Understanding that different cultures often share similar functional holidays. Examples: Thanksgiving vs. Chuseok (harvest), January 1st vs. Chinese New Year (new start)."
- Siblings with the same learner action: SS005-03-a (sort traits into same/different) and SS005-03-b (things all people share / things that make people unique).

## Learning goal and gap

A first grader should see that people in another place share many things with them (eating with family, going to school, playing) and differ in others (language, clothes, festivals). They should also see that two cultures' holidays can serve the same purpose (giving thanks for the harvest, starting a new year) even when they look different.

Current tools do not ask the child to make that sort:
- knowledge-check gives one multiple-choice item per draw with no multi-select, so "pick two same and two different" cannot be asked. Its key must be fixed, so "same as your life" can only be keyed by assuming the child's life. The probe keyed "Eating with family" as the trait the reader shares with Kenji.
- story-bridge has a Venn tap mode (venn_place) checked in code. But it is locked to two five-sentence stories with three paired characters, and it compares what characters did, not what the celebrations are for. The say_alike probe ignored the topic and compared "Morning at Home" with "Park Playtime".
- comparison-panel shows two cards side by side with two true/false gates. It has no grade 1 rules: gates must be "answerable only by reading the content".

Recommendation: a new interaction, or a mode on an existing comparison primitive if the implementing session finds one that already holds two subjects and a three-region sort. The implementing session decides which.

## Essential behaviour

- The child meets two subjects through pictures and short narrated text, readable or heard at a grade 1 level: two children's days in two places, or two celebrations with the same purpose.
- The child places 4-6 features into "both", "only A" and "only B". Each feature is a picture with a short label and a voiced caption.
- For celebrations, the child also names the shared purpose ("both say thank you for food") from choices that are all plausible purposes.
- A "your life" step is welcome as reflection: "Do you do this too?" It earns no credit, because the key cannot know the child's life.
- No feature label repeats its region's name, and no picture appears in both a feature and a region header.

## Worked example

Mei in Korea at Chuseok, and Sam in the United States at Thanksgiving. Features: family meal (both), rice cakes called songpyeon (Mei), turkey (Sam), visiting grandparents (both), autumn (both), bowing to ancestors (Mei). Shared purpose: giving thanks for the harvest.

A plausible misconception: putting "family meal" under only one subject because the foods differ, which is the confusion the objective targets. The tutor can point at both tables.

## Evidence of success

- Independent: places fresh features for a new pair correctly, and picks the shared purpose for a pair not seen before.
- Supported practice: the same task with a narrated hint or a feature already placed.
- No credit: the "your life" reflection, tapping through, or placements made after the answer is shown.
- Uncertainty: some features truly sit in "both" for some families and not others (food, clothing). Prefer features that are defining facts of each celebration or place over lifestyle generalisations, and avoid stereotypes ("children in Japan wear kimonos" is a festival practice, not daily life).

## Constraints and open questions

- Grade 1 reading: short labels, every label voiced, pictures carry the content.
- Cultural accuracy matters more here than in most primitives. The implementing session should decide whether pairs come from a reviewed code list (as the literacy word library does) or are model-written with a check.
- Open: whether one primitive should serve both "two children" and "two celebrations", or the first only with celebrations as a mode.

## Handoff

Inspect current repository guidance (`/primitive`, the catalog, story-bridge and comparison-panel) and related capabilities, then follow your own design and build process and deliver a working capability with verification. Schema, architecture, naming and build order are yours to choose.
"""),

'2-spatial-scene-near-far.md': ('spatial-scene: near and far', ['SS003-06-a', 'SS003-06-c'], """
## Curriculum

**SS003-06-a** (Location and Spatial Thinking): "Students practice positional vocabulary by reading definitions and seeing visual examples of spatial relationships. Focus: Mastering words like above, below, next to, between, near, far. ... Constraints: 6 words, visual illustrations for each, fill-in-the-blank practice."

## Gap

spatial-scene covers four of the six words: above, below, next to (identify, place) and between (place_between).

Near and far are not supported. The supported word list is fixed in code (`service/math/spatial-scene/resolvePrepositionScope.ts:65-67`). Words outside it that a lesson names are logged as unsupported and dropped (`gemini-spatial-scene.ts:1336-1344`).

vocabulary-explorer accepts any words but shows text cards with no pictures, so it is not a substitute for the visual examples the objective asks for.

## Missing learner action

Judge distance relative to a reference object. Which thing is near the house, and which is far from it? Put the ball near the tree.

## Evidence wanted

- Tap or say "near"/"far" for a target and reference object.
- Place an object near or far, checked in code like the other words.
- Contrasting pairs in one scene (one object near and one far from the same reference) so the child compares distance, not position.

## Example

A 3x3 grid with the house in a corner. The dog is in the next cell; the tree is in the opposite corner. "Is the dog near or far from the house?" Then: "Put the ball far from the house."

## Constraints

- The rule must be unambiguous on a small grid: near means an adjacent cell, far means at least two cells away, and the middle distance is never asked. The implementing session may decide whether a larger grid is needed.
- Keep the code-owned answer key and the existing distractor rule (one true option among four).
- Follow the existing scope rule: the words join the lesson's set when the objective names them.

## Handoff

Read the spatial-scene contract (`docs/contracts/spatial-scene.md` if present; `/primitive-contract` otherwise) before editing, then use `/add-eval-modes` or extend the word scope as you judge best, with `/eval-test` to close.
"""),

'3-map-and-compass.md': ('Map and compass: places and directions on a simple map', ['SS003-06-c', 'unit SS003 Geography'], """
## Curriculum

**SS003-06-c** (Location and Spatial Thinking): "Students engage in a conversation with the AI tutor to describe a scene using spatial and cardinal direction terms. Focus: Oral practice of spatial reasoning. Examples: Describe the school, Where is the park?, What is near the store?, What is north of the house?, Is the cat above the bed?. Constraints: AI-led conversation, student must use at least two positional or cardinal words in responses, 3-5 minute session."

## Learning goal and gap

A first grader should locate places on a simple map and describe where one place is relative to another, using positional words (near, next to, between) and the four cardinal directions.

No primitive teaches this (source check of the full catalog, 2026-10-17):
- **No map:** spatial-scene is a 3x3 grid of ten fixed emoji objects with a random theme (classroom, farm, park and so on). There is no town, school or map option.
- **No cardinal words:** spatial-scene's spoken mode, describe_scene, judges only left of, right of, in front of and behind, one relation per turn, in four scenes fixed in code.
- **Cardinal words only as sun and shadows:** light-shadow-lab is the only primitive that answers with cardinal words.
- **No direction map:** airplane-diorama's flight plan shows a map but asks for hop counts.

## Essential behaviour

- A simple picture map (a neighbourhood or a school) with a compass rose and 5-8 labelled places.
- The child finds a place from a direction clue ("the park is north of the school"), and says or taps which place is in a given direction from another.
- The child describes the location of a place in their own words. Credit requires the right place, a correct direction or positional word, and the reference place. This is the "at least two words" requirement, judged against relations computed from the map.
- Directions are read from the compass rose, not assumed to be "up". Some maps could be rotated, which the implementing session may decide to leave for a harder level.

## Worked example

A map with School in the centre, Park to the north, Store to the east, and Library next to the Store.

- "What is east of the school?" Answer: the Store.
- "Tell me where the library is." Credited: "The library is next to the store" or "The library is east of the school." Not credited: "It's over there" (no reference place) or "The library is north of the school" (wrong relation).

A plausible misconception: calling north "up" on a map rotated so north points sideways.

## Evidence of success

- Independent: correct relations on a new map, spoken or tapped, without the compass rose highlighted.
- Supported practice: the compass rose highlighted, or a sentence frame ("The ___ is ___ of the ___").
- No credit: direction words with no reference place, or a correct word about the wrong place.
- Uncertainty: places that are diagonal (north-east) should not be asked about with a four-direction word.

## Constraints and open questions

- Speech needs a microphone and the live tutor; every task should also have a tap path.
- Spoken credit must come from relations computed from the map's layout, not from the model's own reading of the picture.
- Open: whether this extends spatial-scene (a map theme, a compass and larger grids) or is a new primitive. spatial-scene's 3x3 grid and fixed object list suggest a new primitive, but the implementing session should judge after reading it.

## Handoff

Inspect current repository guidance (`/primitive`, spatial-scene, light-shadow-lab) and related capabilities, then follow your own design and build process and deliver a working capability with verification. Schema, architecture, naming and build order are yours.
"""),

'4-timeline-builder-my-life.md': ('timeline-builder: a life timeline by age', ['SS004-02-a', 'sibling SS004-02-b'], """
## Curriculum

- **SS004-02-a** (Personal Timelines): "Follow a step-by-step interactive guide to learn how to create a timeline of your life events. Focus: Understanding the components of a chronological timeline. Examples: Pick events, order events, add dates, ... label years, identify sequence. Constraints: Use 4 clear steps, keep text short, require simple confirmation actions."
- Sibling SS004-02-b: "Arrange a series of important life milestones in the correct chronological order on a visual timeline."

## Gap

The child reads how a timeline is made, but never makes one:
- how-it-works (sequence) turned the topic into four steps (pick events, order them, add dates, draw the line) and asked the child to order those steps. "Draw the line" could just as well come first.
- timeline-explorer (order) presented the four steps themselves as timeline events dated "First Step" to "Fourth Step".
- timeline-builder has the right interaction (place event cards on a scaled time axis), but its modes are daily, yearly (months) and historical (decades).

## Missing learner action

Build a life timeline: place milestones of a child's life on an axis labelled by age (born, 1, 2, ... 6) or year, then answer a question that reads it ("What happened before you started school?").

## Evidence wanted

- Places 4-5 milestones in order on an age axis, checked in code against each milestone's age.
- Reads a finished life timeline (before/after, how many years between).
- The steps of making a timeline appear as the child does them (pick, order, add the age, read), not as a list to memorise.

## Example

A story child, Ava: born (age 0), first steps (age 1), first word (age 1-2), started preschool (age 4), lost first tooth (age 6). Ava's events are placed on 0-6. Question: "What did Ava do before she started preschool?"

A misconception to catch: ordering by how important an event feels rather than by age.

## Constraints

- Use a story child with stated ages, not the student's own life, for anything that earns credit. The student's own timeline can be an ungraded step.
- Milestone ages vary across children (first steps, first word). Keep ages stated on each card, or use milestones with a fixed order (born before started school), so the key is not a developmental claim.
- The current yearly mode prints the month in every card's description (`gemini-timeline-builder.ts:319`, TimelineBuilder.tsx:693-697). Decide on purpose whether the age is shown on the card.

## Handoff

Read the timeline-builder contract if present (`/primitive-contract` otherwise), then add the mode with `/add-eval-modes` or another route you judge better, and close with `/eval-test`.
"""),

'5-spend-my-coins-choices.md': ('Spend my coins: choices, trade-offs and reasons', ['SS002-02-c', 'SS002-02-a', 'sibling SS002-02-b'], """
## Curriculum

- **SS002-02-c** (Making Choices): "Select the best choice in a scenario with limited resources and provide the reason for the trade-off. Examples: buying a healthy snack vs a sugary treat, picking a school supply vs a toy with limited money. Constraints: Provide 3 choice options, maintain consistent tone, ensure reasoning is easy to map to the scenario."
- **SS002-02-a**: "Interact with a diagram that explains how limited resources force us to make choices and experience trade-offs ... Examples: having 5 dollars to buy a book OR a puzzle, having time for soccer practice OR music lessons."
- Sibling SS002-02-b: "identify the opportunity cost of the choice made."

## Learning goal and gap

A first grader should understand three things:
- When you have only so much money or time, you cannot have everything.
- Choosing one thing means giving up another (the trade-off).
- A choice can be explained by what you need or want.

No primitive lets the child make a limited-resource choice and give a reason (catalog source check, 2026-10-17):
- **The only budget tasks are elsewhere:** rocket-builder on_budget and mission-planner assist_tradeoff are rocket and space-route tasks, graded from grade 2-3 up.
- **knowledge-check keys a "right" choice and puts the reason in the options:** the probe asked "You have one coin, so which snack should you buy?" with "Apple, gives good energy" as the key. That tests a health rule, not trade-off reasoning, and the reason is chosen from a list rather than given.
- **di-spoken-practice gave no items:** explain_concept returned an empty session for this objective (tracker DSP-SS1).

## Essential behaviour

- The child has a small, visible budget (coins, or time blocks), sees 2-3 priced choices, and cannot afford all of them.
- The child chooses. When the child's values could reasonably differ, no choice is marked wrong.
- The child names what they gave up (code-checked against the items not bought) and says why they chose (spoken or chosen from reasons; judged on whether the reason connects to a need, want or the limit).
- Need-versus-want questions with a right answer ("you need a pencil for school today") are a separate, keyed task. Don't mix them with free choices.
- Time can be the resource as well as money (soccer or music at the same time).

## Worked example

Five coins. Book: 5 coins. Puzzle: 5 coins. Sticker: 1 coin. The child picks the puzzle.
- "What did you give up?" Credited: "the book". "Why?" Credited: "I like puzzles more" or "I already have lots of books". Not credited: "because" (no reason) or "the sticker" (they could still afford the sticker).

A plausible misconception: thinking they can buy both because each item costs less than the coins they started with.

## Evidence of success

- Independent: names the trade-off for a new choice set, and gives a reason tied to the situation.
- Supported practice: the unaffordable combination is shown crossed out, or a sentence frame is given ("I chose ___ because ___").
- No credit: the choice alone, a reason that only repeats the item's name, or a "healthiest" choice judged by a hidden rule.
- Uncertainty: a reason that is true but unrelated to the limit ("puzzles are blue"). The implementing session decides whether that earns partial credit.

## Constraints and open questions

- Grade 1 money: whole coins, totals up to 10, no change-making (coin-counter keeps K-1 at identifying and counting coins).
- Avoid moralising the choice: the curriculum's healthy-snack example works as a need/want task, not as the only correct trade-off.
- Open: whether the "diagram" introduction for SS002-02-a should be part of this primitive or stay with foundation-explorer.

## Handoff

Inspect current repository guidance (`/primitive`, coin-counter, rocket-builder on_budget) and related capabilities, then follow your own design and build process and deliver a working capability with verification. Schema, architecture, naming and build order are yours.
"""),
}
