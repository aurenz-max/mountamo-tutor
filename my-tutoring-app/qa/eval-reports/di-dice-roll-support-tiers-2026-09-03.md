# Support-Tier Promotion Report: di-dice-roll — 2026-09-03

## Outcome

`di-dice-roll` is promoted to **L3 tiered**. `config.difficulty` now controls how much strategy support appears after an incorrect or missing spoken answer, while every first attempt remains answer-free and every die, relation, total, scoring rule, and eval-mode identity stays unchanged.

The primitive is a manipulative/quantity task with a DI-native live tutor. Its useful L3 lever is instruction-as-scaffold in two synchronized channels: the visible retry status and the tutor's exact correction branch.

| Eval mode | Easy | Medium | Hard |
|---|---|---|---|
| `count_pips` | Touch each dot once while counting | Brief careful-count reminder | Re-model, then immediately re-ask |
| `compare_dice` | Count each die and match amounts | Brief dot-pattern comparison reminder | Re-model, then immediately re-ask |
| `sum_two_dice` | Count the left die, then count on across the right | Brief count-all reminder | Re-model, then immediately re-ask |

The correction still begins with `My turn`, states the correct answer after an attempt, and re-elicits at every tier. Hard withdraws only the added strategy sentence; it does not weaken remediation or alter judging.

## Implementation

- The generator strictly normalizes `easy | medium | hard`; absent or unknown values preserve the pre-L3 payload.
- A valid tier is stamped on every challenge from that challenge's own mode, including curated blends and mixed sessions.
- The code-owned local pools remain the only source of dice values. Support tiering does not affect face selection, pair selection, relations, totals, answer words, aliases, or challenge counts.
- `retryPrompt()` supplies the answer-free visible scaffold, while the same challenge `supportTier` controls the exact spoken correction strategy.
- Runtime tutor context now includes only `challengeType`, `supportTier`, and the answer-free interaction description. Catalog guidance explicitly forbids supplementing a hard item with easier-tier help.
- No retired numeric-difficulty wiring existed and none was added.

## Verification

| Gate | Result |
|---|---|
| Focused Vitest | **28/28 passed** across generator, eval-mode, judged-script, tier propagation, and strategy-withdrawal contracts |
| Lumina typecheck | **0 errors** (`npm run typecheck:lumina`) |
| Repository-wide TypeScript | Existing red baseline remains; **0 diagnostics** reference Dice Roll files or the DI catalog |
| Live `/api/lumina/eval-test` tier sweep | **9/9 passed**: all three eval modes × easy/medium/hard |

Every live draw returned five challenges of the pinned type with the requested tier on every item. G1 required fields passed; G2 is not applicable; G3 mode differentiation remained intact; G4 answer derivability passed for all comparison relations and sums; G5 retained the existing safe wrapper and local-pool fallbacks.

Focused controlled-value tests also generated the same four two-dice items at all three tiers and confirmed byte-equivalent task type, die values, second values, and spoken answers. Only `supportTier` and its downstream help wording changed.

## Remaining human gate

The live generator path is exercised, but a person still needs to run one microphone/Tutor sitting and deliberately answer incorrectly at easy, medium, and hard to hear the correction fade and confirm the visible retry message changes in the browser.

## Next lifecycle step

`/add-structural-difficulty` remains L4. It should find honest within-mode perceptual structure without using support tier to inflate die values or switch among `count_pips`, `compare_dice`, and `sum_two_dice`, which are already distinct eval modes.
