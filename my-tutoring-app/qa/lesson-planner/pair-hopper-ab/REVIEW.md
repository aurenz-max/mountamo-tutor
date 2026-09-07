# Exact task bindings: faster planning, provisional coverage improvement

Twenty generated lessons completed: five fixed kindergarten curriculum objectives, two repetitions per arm. The experimental arm used the actual production manifest prompt and settings, replacing the catalog with retrieved primitive-mode tasks and eliminating the separate lesson mode resolver. Production application code was not changed. All recorded source hashes remained unchanged during the run.

| Measure | Production | Pair hopper |
|---|---:|---:|
| Completed lessons | 10/10 | 10/10 |
| Median planning model calls | 2 | 1 |
| Median planning input tokens | 51,359 | 9,898 |
| Median planning, excluding index loading/building | 4.59 s | 3.35 s |
| Median planning, including index work | 4.59 s | 3.57 s |
| Median planning + content generation | 14.99 s | 13.30 s |
| Median student blocks | 3 | 4 |
| Median catalog duration estimate | 14 min | 17 min |
| Generated block failures | 0 | 0 |
| Common-objective automated coverage passes | 0/10 | 3/10 |

Planning input tokens fell about 81%; planning excluding index work fell about 27%. These are small-sample observed medians, not service-level guarantees or total-cost estimates. Planning used `gemini-3.8-flash` in both arms; production's separate resolver used `gemini-3.5-flash-lite`. The first pair-index build took 4.78 seconds. Both arms retained identical production structure instructions, but their actual lesson sizes differed.

All 42 experimental activity bindings compiled to an exact retrieved primitive-mode pair or declared-mode-free default. This validates selection-to-config identity, not downstream task correctness. The hopper reduced 645 catalog task variants to 33–34 candidates per objective.

## What improved

The experiment removes one planning model call without requiring a different manifest model. Exact task IDs prevent an independent later selector from changing the selected mode. Fast-fact tasks also contributed meaningful coverage: both equation lessons passed the common-objective judge, with teen-number equation matching and missing-part questions. One decomposition lesson passed because its base-ten builder covered all four requested numbers, 16–19.

The passing packages are [decomposition](first-controlled-run/packages/lesson-cb05e6ed-511.json), [equations, repeat 1](first-controlled-run/packages/lesson-18678ad3-db0.json), and [equations, repeat 2](first-controlled-run/packages/lesson-efab8d73-1d9.json). Their closing knowledge checks still asked for numeral names. Automated practice coverage is not proof of a well-aligned full lesson or mastery assessment.

## Remaining failures

1. **Flat pair retrieval can exclude an appropriate specialist.** For teen equations, `equation-builder/build-simple` ranked 26th overall and was absent from both hoppers; even its highest-ranked mode, `rewrite`, ranked 21st. Production selected `build-simple` in both repetitions. Multiple variants from other families consumed the specialist pool. The experimental equation lessons found useful alternatives, so absence alone does not prove those lessons were worse, but the planner could not consider this relevant option. Rankings and selected cards are in [the first equation record](first-controlled-run/records/lesson-18678ad3-db0.json).
2. **Having the correct mode in context does not ensure its selection.** All five ordinal-line modes were retrieved for ordinal naming, but neither lesson selected `sequence_story`. Both naming lessons were judged indirect on the common target. Exact binding removes a later decision, not the need to reason about what the learner must demonstrate.
3. **Constraints remain advisory.** The sixth-through-tenth hopper lesson selected ordinal-line modes whose generated payload retained `maxPosition: 5`. See [repeat 1](first-controlled-run/records/lesson-1ffe1e49-5ee.json).
4. **Generators can violate the objective after valid selection.** In [teen representation, repeat 1](first-controlled-run/records/lesson-10106ebf-a46.json), `ten-frame/build` produced a single-frame target of 5; `base-ten-blocks/build_number` produced 11, 18, 17, 20 for a 16–19 objective. Production also had range drift. Exact mode configuration does not enforce numeric scope.

## Interpretation and next experiment

Keep exact primitive-mode IDs as the final selection unit. Change retrieval to preserve primitive-family recall before expanding and ranking modes, with a separate pool for explanation and assessment tasks. Test that against this frozen flat-pair run rather than silently increasing the cutoff until examples pass.

Add explicit requirement-to-capability checks before manifest selection and generated-scope checks afterward. An incompatible grade/range should become a visible capability gap or a supported alternative, not an intent string requesting unsupported behavior. These checks should distinguish task recognition, construction and explanation, and preserve complete lesson coverage without forcing an arbitrary primitive count.

This experiment changes retrieval and joint selection together, and restricts the experimental arm to single modes while production allows blends/mixed modes. It does not isolate these effects or establish generalization to the earlier open-ended topics. One raw coverage call failed in the experimental arm; all 20 separate common-objective judgments completed. Both arms produced synthetic objective IDs, so the common-objective evaluation normalized identity only and preserved original content and raw verdicts. Human playback remains outstanding.

See [per-run results](first-controlled-run/RESULTS.md), [timing and binding metrics](first-controlled-run/pair-metrics.json), [masked replay packages](first-controlled-run/BLIND-REVIEW.md), and [protocol and run commands](README.md). Four focused tests passed for binding compilation, invalid identities, closing-task restrictions and preservation of production prompt settings.
