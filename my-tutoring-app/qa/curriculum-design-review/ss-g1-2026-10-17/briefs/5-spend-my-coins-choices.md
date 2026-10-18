# Spend my coins: choices, trade-offs and reasons

Curriculum IDs: SS002-02-c, SS002-02-a, sibling SS002-02-b (SOCIAL_STUDIES, grade 1). Source: design review ss-g1-2026-10-17.

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
