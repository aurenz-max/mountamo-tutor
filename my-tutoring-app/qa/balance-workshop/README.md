# Balance-scale touch and voice progression

All six homogeneous evaluation modes now use scripted hand and voice turns. Try the named mode in Math Primitives Tester > Balance Scale.

| Mode | Experience | Student work |
| --- | --- | --- |
| equality | Balance and Add | Match an unnumbered proportional weight, add the chosen blocks aloud, infer the left weight. |
| equality_hard | Make It Another Way | Build a match, say its total, build a genuinely different multiset of weights, say that total, infer the common weight. |
| one_step | Complete the Load | Add weights to a known starting load until balanced; say the added weight and the missing part. |
| one_step_hard | Share the Weight | Distribute individual units among identical opaque parcels; say each group's weight and one parcel's weight. |
| two_step_intro | Unpack and Share | Independently set aside known weight from both pans, name the remaining combined weight, then distribute units equally and infer one parcel's weight. |
| two_step | Build the Equation | The same physical transformations create equation lines. Alternate challenges ask the student to demonstrate subtraction and division instructions. A final spoken explanation connects equal groups to x. |

Known weight blocks use proportional dimensions. Sealed parcels all have the same exterior size regardless of their contents. A parcel in a grouping well corresponds to one parcel in the balanced comparison above it.

## Interaction contract

- An exact hand solution held for 900 ms advances automatically through the shared judged runner. Additional edits cancel pending matches. Exploration is not an incorrect attempt.
- Overshooting, uneven groups, and one-sided removal are allowed. The scale or grouping scene provides feedback. Undo and reset are scoped to the current hand step.
- Every right-side unit keeps a stable identity. A unit is in the pool, set aside, or in exactly one parcel group. No units are created or destroyed by sharing. Set-aside units cannot be distributed accidentally.
- Tap a unit and then its parcel group, drag a unit to a group, or tap a parcel well to place the next available unit. Tap a grouped unit to return it to the pool.
- Addition rows preserve the student's actual chosen blocks. Reordering the same values does not count as another combination.
- Spoken quantity turns require a fresh utterance, even when the next question has the same numeric answer. No typed answer is required.
- The equation notebook adds transformation lines only after corresponding physical actions. It withholds the numeric value of x until after the group-weight turn. The equation explanation is coaching evidence.
- Capped hand turns use an explicitly attributed tutor demonstration. That attribution is retained in student work.

## Generation and student-data contract

Existing evaluation mode IDs and source equation schemas are preserved. The workshop derives parcel count, known weight, target, and total from the existing code-built equation pool and validates the equation. Complete-the-load generation now always has a positive starting weight. Another-way generation has a target of at least two so a second composition exists.

Modes retain their existing adaptive IDs/priors; this implementation does not claim that the redesigned tasks' difficulty has been empirically calibrated. Student work is versioned `weight-workshop-di-v1` (basic equality retains `match-compose-infer-di-v2`). Each numeric stage has its own outcome. The challenge score is the minimum of those spoken quantity outcomes; exploration and the advanced explanation do not inflate it. All submissions use the existing evaluation hook.

Mode-specific manual audio is declared for all six modes. Homogeneous hydrated challenge types control both routing and audio. Unsupported mixed payloads retain the legacy fallback; the generator emits homogeneous sessions.

## Verification

- **97 tests passed across 10 focused suites.** Includes immutable arithmetic and weight conservation, every generated mode's solvability, reference constructions, alternate compositions, explicit modeled fallbacks, response-class validation, drag/tap behavior, uneven groups, undo/reset, settled-match cancellation, per-stage state, equation reveal gating, independent spoken outcomes, mode preservation, generated data/audio routing, and shared runner/lesson voice policy.
- **18 real generated sessions, 54 challenges, 225 script steps**, covering all six modes at easy/medium/hard. No content-contract issues. JSON artifacts and generation trace are beside this file.
- The source equations still satisfy the existing selection/answer-variety regression tests.
- Full repository typechecking has existing errors outside Lumina; the active Lumina surface and modified AI context are checked separately from those diagnostics.

Regenerate fixtures from `my-tutoring-app` with `node scripts/balance-equality-probe.mjs --run`. This calls the production generator, validates script packs and deterministic constructions, and does not submit student data or simulate microphone recognition.

## Live acceptance still required

Automated component tests mock the judged runner; they do not certify browser animation or live speech judging.

1. Complete a load with two differently sized blocks, then say the added weight and answer the missing-part question separately.
2. Share units into uneven groups, return one, and repair the distribution. Try both tap and drag, plus a touch device. Confirm selected-unit behavior and no duplicate/lost units.
3. Set known weight aside on only one pan, observe tilt, restore it, and then complete equal removal. Ensure set-aside units stay out of parcel groups.
4. Build one combination, then try it in a different order. It must not advance. Build a different combination and answer again.
5. In the advanced mode, inspect the equation transitions and the next challenge's reverse instruction. Confirm the spoken explanation is coached without erasing a failed quantity response.
6. Test silence, help questions, wrong numbers, correction caps, consecutive same-number answers, subsequent challenges, and assembled-lesson entry/switching.
