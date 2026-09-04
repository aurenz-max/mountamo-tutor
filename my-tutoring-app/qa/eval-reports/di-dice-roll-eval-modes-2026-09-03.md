# Eval-Mode Promotion Report: di-dice-roll — 2026-09-03

## Outcome

`di-dice-roll` is promoted from L0 to **L1 eval-dense** with three honest task identities on one DI-native dice stage.

| Eval mode | β | a | Task identity | Result |
|---|---:|---:|---|---|
| `count_pips` | 1.5 | 1.6 | Roll one die and say its visible quantity | PASS |
| `compare_dice` | 2.5 | 1.6 | Roll two dice and say left, right, or same | PASS |
| `sum_two_dice` | 3.5 | 1.6 | Roll two dice and say the combined total | PASS |

The ordering reflects a real change in cognitive load: identify one concrete quantity, coordinate two quantities relationally, then compose two quantities into a new total. The response classes were already benched by the DI family: `number_word_to_20` for count/sum and `short_spoken_word` for comparison.

## Implementation evidence

- The catalog is the mode source of truth and carries matching beta, discrimination, scaffolding-mode, challenge-type, label, and description values.
- The backend problem-type registry mirrors the beta ladder exactly. Its discrimination registry explicitly assigns `(a=1.6, c=0)` to all three live-judged spoken constructed responses.
- `resolveEvalModes` now controls the local Fork-A builders. A single pin produces one identity; a `|`-joined pin produces only that curated subset; `mixed` produces all three; an unpinned intent can resolve to one mode or a subset.
- Each challenge is a discriminated contract. The component renders one or two dice from that challenge's own `challengeType`, so the root `challengeType` is representative metadata only and cannot collapse a blended run.
- Gemini writes only answer-free title/description chrome. Code selects every face or pair and derives the comparison, total, number word, and aliases after finalization.

## Verification

| Gate | Result |
|---|---|
| Focused Vitest | **19/19 passed** across generator and judged-script contracts |
| Backend pytest | **3/3 passed** across calibration parity and mathematics subject routing |
| Lumina typecheck | **0 errors** |
| Real `/api/lumina/eval-test` registry path | **8/8 passed** |

The eight live generations covered `count_pips` once, `compare_dice` twice, `sum_two_dice` twice, `mixed` twice, and the curated `count_pips|sum_two_dice` blend once.

- Every pinned run contained exactly its catalog-allowed type and five challenges.
- The comparison draw included all three relations and every answer matched the finalized pair: examples included `5 vs 2 → left`, `3 vs 6 → right`, and `5 vs 5 → same`.
- The addition draw used valid faces, distinct totals across the run, and exact code-derived answers: examples included `4 + 1 → five`, `6 + 6 → twelve`, and `5 + 5 → ten`.
- A mixed draw contained `count_pips`, `compare_dice`, and `sum_two_dice` in one five-item run.
- The curated blend contained `count_pips` and `sum_two_dice` and no comparison item.

The eval-test route's catalog validator passed each of the three named modes. `mixed` and the `|`-joined blend are synthetic pin values rather than catalog rows, so the route intentionally reports validation skipped for those two; their `fullData.challenges` type sets were inspected directly and are covered by deterministic tests.

## Generator ↔ component gates

| Gate | Verdict | Evidence |
|---|---|---|
| G1 required fields | PASS | All modes provide the discriminant and fields consumed by the component and judged runner. Two-die modes require `secondValue`; comparison requires `comparison`; addition requires `total`. |
| G2 flat reconstruction | N/A | The generator returns the component's nested `challenges[]` contract directly. |
| G3 semantic differentiation | PASS | Modes change the task, stimulus count, response class where appropriate, prompt, correction strategy, summary label, and rendered stage—not merely wording. |
| G4 answer derivability | PASS | Count words derive from one face; comparison derives from the pair ordering; totals and total words derive from the finalized pair. The animation never owns scoring state. |
| G5 fallback integrity | PASS | Malformed controlled values/pairs fall back to valid local pools as a unit. Leaking or failed Gemini chrome falls back without changing code-owned challenges. Unknown pins fall back to genuine mixed practice. |

## Answer safety and DI contract

- Opening and steady asks name the action but not the current quantity, relation, or total. Script-contract tests cover all three identities and mixed transitions.
- Runtime tutor context contains only `challengeType` and an answer-free interaction description. It excludes face values, relations, totals, and number words.
- Correct answers appear in the private judging branches and may be spoken only after an attempt: affirmations start with `Yes`; corrections start with `My turn` and re-elicit the response.
- Before affirmation, screen and ARIA copy describe only dot patterns and the required action. Exact values and equations are reward-state content.

## Deliberate deferrals

The original concept's `match_quantity`, `make_number`, and `roll_until` ideas remain future task identities. They need distinct selection/building or repeated-trial state machines, not a superficial eval-mode label on the current voice-production loop.

## Remaining human gate

No browser-driven microphone/Tutor sitting was performed. The script pack, generator, registry, calibration, and live content route are verified, but child-speech recognition, spoken correction quality, two-dice touch ergonomics, and responsive visual polish still need one human DI drive.
