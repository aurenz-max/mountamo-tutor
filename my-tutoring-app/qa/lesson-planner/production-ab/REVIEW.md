# Production comparison: promising coverage signal, insufficient case for replacement

The experimental planner is not a solid overall improvement yet. It produced stronger automated coverage on one repeatable objective and one additional disputed pass, but planning was slower, generation was about twice as slow at the median, and shared generator failures prevented most lessons in both arms from meeting the target.

## Results

Twenty fresh lessons: five supplied curriculum objectives, two builds per arm, kindergarten. Both arms used the same frozen brief and exact supplied objective per case, and the same real generation, assembly, coverage and scoring functions.

| Measure | Established pipeline | Experimental planner |
|---|---:|---:|
| Lessons generated and packaged | 10/10 | 10/10 |
| Missing/error generator payloads | 0 | 0 |
| Median planning time | 4.46 s | 8.33 s |
| Median time through all content generation | 17.19 s | 35.91 s |
| Median student blocks, excluding brief/caregiver | 3.5 | 5 |
| Median summed catalog activity minutes | 15.5 | 22.5 |
| Sufficiently assessed, common-objective automated judge | 0/10 | 3/10 |

Catalog minutes are estimates, not observed child time. Experimental requested 15 minutes, but production exposes no equivalent duration argument; the actual generated session sizes were not matched. Timing excludes shared brief generation and offline QA; per-run `withSharedBriefMs` includes the brief cost. Both arms hydrate components in parallel, with two lessons concurrently active. This measures completion of all content, including caregiver blocks, not first paint or time to the first playable block.

### Coverage by objective

| Objective | Production, two runs | Experimental, two runs |
|---|---|---|
| Recognize and name first–fifth | Indirect / indirect | Sufficient / sufficient |
| Extend to sixth–tenth | Insufficient / insufficient | Insufficient / taught but not assessed |
| Represent 16–19 with manipulatives | Insufficient / insufficient | Insufficient / insufficient |
| Decompose 16–19 using visual models | Insufficient / insufficient | Insufficient / sufficient* |
| Compose/decompose 11–19 with equations | Insufficient / insufficient | Insufficient / insufficient |

*The third experimental pass needs human review. The evaluator credits fast-fact as direct visual decomposition, but inspected items ask “Which one shows ten and six extra?” with symbolic choices `10 + 6`, `10 + 5`, `10 + 7`. They do not themselves show an unpartitioned sixteen-object collection, and the prompt already supplies the parts. The final knowledge check asks only numeral names. The automated pass is preserved, but should not be treated as established mastery evidence.

## What improved

For first–fifth, production selected an explanatory block, ordinal-line/identify, a caregiver activity and a final knowledge check in both samples. The experimental planner selected explanation plus build_sequence, identify, sequence_story and a final check. The extra story mode elicits ordinal words, whereas K identify elicits the character's name. This is a concrete example of useful task selection, not merely a nicer rationale. It is still confounded with giving the child more activities and more estimated time.

## What remained broken after real generation

1. **Ordinal scope still collapses.** Sixth-through-tenth intents produced ordinal-line payloads with `maxPosition: 5` in both arms. One experimental lesson had no aligned assessment at all; others' final checks sampled only a small part of sixth–tenth. This is now observed output, not just a catalog-based prediction.
2. **Teen ranges drift.** In experimental package `lesson-1d2212be-6b4`, `exp-3-investigate` carries the exact 16–19 objective but its base-ten challenges target **3, 8, 12, 18**. Production package `lesson-fec275fd-515` targets **18, 19, 13, 11** in its base-ten block. Richer planning text did not enforce the requested range downstream.
3. **Closing checks change the task.** In experimental decomposition package `lesson-49711ea9-10d`, `exp-assess-check#problems[0]` asks **“What number is this?”**, shows glyph **16**, and expects **“sixteen”**. Its successCriteria still contains the full decomposition objective. Correct metadata labels therefore coexist with the wrong assessed action. Similar numeral-naming substitutions appear in production and in teen equation lessons.
4. **Completeness is inconsistent.** The equation-builder blocks can generate relevant teen equations, but both arms leave holes under the coverage judge's requirement to cover the entire named range. Extra components sometimes remain below scope: one experimental application generated `4 + 2 = 6` for a teen-equation objective.
5. **Slower components matter.** The slowest experimental blocks included custom-visual at 63.0, 50.1 and 46.7 seconds, foundation-explorer at 51.6 seconds, and annotated-example at 29.9 seconds. A shorter candidate list or fewer orchestration calls does not guarantee faster completion when selection changes which generators run.

These observations do not establish that every below-range item is pedagogically useless; it may be a prerequisite. They show that such items cannot be credited as performance on the specified target range. The exact intent/config/payload chain is preserved for review.

## Fairness and instrument limitations

Production is the unmodified workspace implementation of `generateExhibitManifestStreaming`, including its batched eval-mode resolver, followed by `generateComponentContent`. Experimental is semantic discovery plus the existing mode-card objective planner, compiled into the native manifest and passed through the same enrichment and hydration functions. The adapter preserves repeated instances, selected modes, intent, learner action and support; it does not invent item counts or turn evidence claims into verified behavior. It preserves invalid plan declarations for analysis while rejecting unrepresentable component/mode bindings.

This tests the two implementations as configured, not an isolated retrieval ablation. Production retains its default generation settings; experimental uses its prior temperature/output settings. Actual planner responses reported `gemini-3.8-flash`; production's resolver reported `gemini-3.5-flash-lite`. API inputs, returned model versions and timing are recorded. API transport timeouts were 120 seconds in both arms. No production source was edited.

All ten production manifests emitted synthetic objective IDs rather than the supplied ID. The raw coverage digest consequently listed two targets for one curriculum objective. Raw packages and verdicts are preserved. A separate evaluation-only view normalizes IDs and target text to the one supplied objective in both arms, without changing generated content or activity order. The table above uses that common-objective evaluation. This sensitivity check prevents a bookkeeping mismatch from manufacturing the coverage difference, but itself involves a fresh stochastic judge call.

One raw production coverage call failed after timeout/schema fallback; all 20 common-objective evaluations completed. No common-objective verdict discarded invented evidence citations. Valid citations establish that an item exists, not that its content deserves the evaluator's pedagogical credit. The scorer also leaves several visual, accessibility, sequencing and quality checks unjudged. The judge treats omitted values from an explicit range as coverage holes; its sufficiency categories are instrument readings, not demonstrated learning outcomes or a claim that production teaches nothing.

No browser playback, child interaction, or human blind ratings were completed. Replayable packages with arm labels and stored machine ratings withheld are ready in the [masked review set](first-controlled-run/BLIND-REVIEW.md). This is a small, deliberately demanding curriculum sample; open-topic discovery wins were not tested against production here.

## Decision

Keep production as the default. Retain the experimental planner as a harness and preserve the useful first–fifth mode-selection example. Before replacement, fix or resolve the observed objective-to-task and task-to-payload mismatches, then rerun these frozen cases with comparable lesson size. A broader production comparison on open topics can test the specialist-discovery advantage separately. Neither the 3/10 score nor the longer lesson structure is enough to justify a swap now.

Artifacts: [all results](first-controlled-run/RESULTS.md), [metrics](first-controlled-run/metrics.json), [full structured summary and scope samples](first-controlled-run/summary.json), [protocol/source hashes](first-controlled-run/protocol.json). Records contain exact API prompts, manifests, payloads, raw and normalized verdicts. All 19 focused harness tests pass; all ten pairs share the same frozen fixture hash.
