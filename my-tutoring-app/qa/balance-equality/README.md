# Historical equality pilot

The full progression now supersedes this pilot: see [current balance workshop notes](../balance-workshop/README.md). In particular, equality_hard now asks for a second composition, and all other modes use the new weight workshop. The verification and mode descriptions below document the earlier revision.

# Balance weights: match, compose, infer

Try Math Primitives Tester > Balance Scale > **Equality - Balance and Add**, or the larger-weights equality mode. Both `equality` and `equality_hard` use the new flow; algebra modes retain their existing interaction.

## Student flow

1. A single unnumbered block sits on the left. All blocks share a cross-section and use the same height-per-weight scale, so size is proportional to weight.
2. Tap numbered 1, 2, 3 or 5 weights to add them to the right. Tap a placed block to remove it; undo and clear support exploration. Watch the scale tilt.
3. An exact balance held for 900 ms automatically commits the hand step. Further edits cancel a pending match. Unbalanced exploration is not a failed attempt.
4. The exact chosen blocks move into an addition row below the scale using shared layout animation (respects reduced motion). The right-pan caption preserves the relationship to the balanced comparison.
5. Say the sum of the chosen weights. No typed answer and no prefilled total.
6. The total is then visible beside the addition. The tutor asks: "Since the scales are balanced, what weight is the left side?" It waits for a separate spoken response.

The numeric target comes from the established generator pool's `variableValue`; legacy equation blocks are not displayed in this interaction. Source equation compatibility is retained for existing generator consumers. This replaces the previous removal/isolation pilot. Its historical `easy.json`, `medium.json`, and `hard.json` fixtures describe that earlier interaction; current fixtures are named `equality-*.json` and `equality_hard-*.json`.

## Evidence and scoring

Exploratory moves are stored without counting them as attempts. The spoken sum and left-weight inference have separate outcomes. Per-challenge score takes the lower of those two outcomes, so a correct inference cannot erase an unsuccessful addition answer. The hand match is recorded as interaction evidence, not a third arithmetic assessment. Mode identity remains `equality` or `equality_hard`; student work is versioned `match-compose-infer-di-v2`. No claim of calibrated difficulty for the redesigned interaction is made.

## Verification

- Seven focused suites: **65 tests passed**. Covers exact weighted arithmetic, all targets 1-20, block identities/bounds, overshooting and removal, transient-match cancellation, duplicate commits, undo/clear, chosen-block preservation, separate sum/inference stages, fresh-response cue contract, per-mode audio/evaluation routing, generation, and shared runner/lesson voice policies.
- Six production generation sessions (both modes at easy/medium/hard): **18 targets / 54 script steps**, no contract issues.
- TypeScript: zero diagnostics in Lumina and the modified AI context; repository-wide checking still encounters existing errors elsewhere.
- Reproduce generation from `my-tutoring-app`: `node scripts/balance-equality-probe.mjs --run`.

## Live acceptance remaining

Browser animation appearance and microphone turn timing require a live drive; they are not certified by the mocked-runner UI tests.

- Place 3 + 2 against a weight of 5; watch tilt, then the automatic handoff and block-gathering animation. Confirm the same chosen values are shown without the total.
- Briefly reach balance, then add/remove another weight before settling; the first match must not advance.
- Say the total, then answer the separate left-weight question. Confirm the tutor does not recycle the earlier utterance as the inference answer.
- Try an incorrect sum, an incorrect left-weight answer, silence, and a help question.
- Advance to another target and repeat in an assembled lesson, including `equality_hard` (the mode in the user's 2026-09-11-234633 session).
