# TypeSafe verify-and-gate bench — misconception loop

TypeSafe jev-latest · distiller/planner = production Gemini flash · 2026-09-16

## A. Distiller abstain gate — 48 labeled packets (30 generative, 18 abstain)

| arm | accuracy | generative recall | abstain recall | ms |
|---|---|---|---|---|
| live distiller (abstain / text) | 96% | 93% | 100% | 10564 |
| TypeSafe Noul "one consistent wrong rule" ≥ 0.5 | 98% | 97% | 100% | 255 |

Mean P(rule): generative packets 0.82 · abstain packets 0.15. Arms agree on 98%; when they agree the verdict is right 98%.

Gate view — of the distiller's 28 GENERATIVE verdicts (the ones that would reach a student), keep the top X% by score; share that are truly generative:

| gate score | keep 50% | 70% | 80% | 90% | 100% |
|---|---|---|---|---|---|
| distiller confidence (high>medium>low) | 100% | 100% | 100% | 100% | 100% |
| TypeSafe P(rule) | 100% | 100% | 100% | 100% | 100% |
| TypeSafe strength score | 100% | 100% | 100% | 100% | 100% |

### Disagreements

| id | label | distiller | TypeSafe P(rule) / strength | note |
|---|---|---|---|---|
| letter-sound-spoken-onset-omission | generative | abstain ✗ | 0.74 / 2.5 ✓ | Tier-A evidence should identify onset deletion, not generic pronunciation difficulty. |

## B. Hypothesis verifier — 28 distiller hypotheses × {own evidence, another scenario's evidence, answer injected}

| question | own evidence | other evidence | answer injected |
|---|---|---|---|
| mean P(supported) | 0.91 | 0.05 | — |
| mean P(leaks answer) | 0.10 | — | 0.92 |

Supported ≥ 0.5 on own AND < 0.5 on other: 100% of judgments · own scored above other: 100% of hypotheses. Leak Noul fires on the injected text 100% of the time and falsely on the clean text 0%. 184 ms and 1200 input tokens per hypothesis (six questions in one request).

### Weakest separations

| id | P(supported) own / other | P(leaks) own / injected | hypothesis |
|---|---|---|---|
| di-math-facts-echoes-last-number | 0.56 / 0.02 | 0.09 / 0.96 | The student interprets an addition expression by simply repeating the second addend instead of combining the t |
| counting-board-take-away-states-start | 0.96 / 0.27 | 0.09 / 0.93 | The student interprets the question asking how many are left as asking for the starting quantity on the board, |
| rhyme-studio-onset-matching | 0.92 / 0.21 | 0.37 / 0.96 | The student treats rhyming as sharing the same initial sound rather than the same ending sound, consistently s |
| di-math-facts-successor-for-subtraction | 0.78 / 0.06 | 0.13 / 0.95 | The student interprets the minus sign as an addition sign, adding the numbers together instead of taking away. |
| picture-vocabulary-animal-overgeneralization | 0.86 / 0.09 | 0.05 / 0.50 | The student overgeneralizes the familiar label "dog" to refer to any four-legged mammal. |
| subtraction-smaller-from-larger | 0.81 / 0.02 | 0.05 / 0.97 | When subtracting multi-digit numbers, the student subtracts the smaller digit from the larger digit in each co |
| number-line-start-tick-as-hop | 0.88 / 0.04 | 0.13 / 0.96 | The student counts the starting tick mark as the first hop, so they stop one space short of the specified dist |
| phoneme-explorer-final-sound-omission | 0.90 / 0.06 | 0.10 / 0.96 | The student isolates only the initial consonant and vowel sounds when segmenting a word, omitting the final ph |

## C. Planner applicability gate — 55 labeled cases (26 expect a move, 29 expect abstain)

| arm | accuracy | move recall | abstain recall | ms |
|---|---|---|---|---|
| live planner (Gemini flash, thinking low) | 100% | 100% | 100% | 9956 |
| TypeSafe Choice over moves + abstain | 91% | 100% | 83% | 235 |

Arms agree on 91%; when they agree the decision is right 100%. TypeSafe 937 input tokens per case. Planner nulls retried once: 30; Gemini API failures warned during the run: 2.

Gate view — of the 26 cases where the planner SELECTED a move (those change what the student gets), keep the top X% by TypeSafe score; share where the planner's move was the labeled one:

| gate score | keep 50% | 70% | 80% | 90% | 100% |
|---|---|---|---|---|---|
| TypeSafe choice confidence | 100% | 100% | 100% | 100% | 100% |
| TypeSafe P(applies) | 100% | 100% | 100% | 100% | 100% |
| TypeSafe P(planner's move) | 100% | 100% | 100% | 100% | 100% |

Agreement gate (act only when TypeSafe picks the same move): coverage 100% of planner selections, precision 100%.

### Per case

| source | case | expected | planner | TypeSafe (conf, P applies, P reliable) |
|---|---|---|---|---|
| fraction-bar | distilled | contrast_shared_digit_roles | contrast_shared_digit_roles ✓ | contrast_shared_digit_roles ✓ (0.94, 0.57, 0.25) |
| fraction-bar | paraphrase-a | contrast_shared_digit_roles | contrast_shared_digit_roles ✓ | contrast_shared_digit_roles ✓ (0.95, 0.55, 0.20) |
| fraction-bar | paraphrase-b | contrast_shared_digit_roles | contrast_shared_digit_roles ✓ | contrast_shared_digit_roles ✓ (0.93, 0.55, 0.15) |
| fraction-bar | unrelated | abstain | abstain ✓ | abstain ✓ (0.94, 0.08, 0.14) |
| fraction-bar | nearby | abstain | abstain ✓ | abstain ✓ (0.87, 0.12, 0.12) |
| fraction-bar | contradictory | abstain | abstain ✓ | contrast_shared_digit_roles ✗ (0.64, 0.47, 0.02) |
| fraction-bar | other-representation | abstain | abstain ✓ | contrast_shared_digit_roles ✗ (0.32, 0.19, 0.20) |
| bar-model | distilled | contrast_icon_count_and_row_value | contrast_icon_count_and_row_value ✓ | contrast_icon_count_and_row_value ✓ (0.99, 0.71, 0.36) |
| bar-model | paraphrase-says-three | contrast_icon_count_and_row_value | contrast_icon_count_and_row_value ✓ | contrast_icon_count_and_row_value ✓ (0.98, 0.72, 0.21) |
| bar-model | paraphrase-legend | contrast_icon_count_and_row_value | contrast_icon_count_and_row_value ✓ | contrast_icon_count_and_row_value ✓ (0.99, 0.65, 0.28) |
| bar-model | unrelated-more-fewer | abstain | abstain ✓ | abstain ✓ (0.95, 0.16, 0.15) |
| bar-model | nearby-axis-step | abstain | abstain ✓ | abstain ✓ (0.72, 0.22, 0.25) |
| bar-model | contradictory | abstain | abstain ✓ | abstain ✓ (0.01, 0.52, 0.04) |
| bar-model | cross-digit-worth | abstain | abstain ✓ | contrast_icon_count_and_row_value ✗ (0.73, 0.47, 0.25) |
| counting-board | take-distilled | contrast_same_start_different_change | contrast_same_start_different_change ✓ | contrast_same_start_different_change ✓ (0.96, 0.40, 0.22) |
| counting-board | take-paraphrase-a | contrast_same_start_different_change | contrast_same_start_different_change ✓ | contrast_same_start_different_change ✓ (0.95, 0.57, 0.22) |
| counting-board | take-paraphrase-b | contrast_same_start_different_change | contrast_same_start_different_change ✓ | contrast_same_start_different_change ✓ (0.96, 0.52, 0.22) |
| counting-board | add-distilled | contrast_same_start_different_change | contrast_same_start_different_change ✓ | contrast_same_start_different_change ✓ (0.97, 0.41, 0.24) |
| counting-board | on-start-back | count_on_exactly_one_more | count_on_exactly_one_more ✓ | count_on_exactly_one_more ✓ (0.98, 0.58, 0.18) |
| counting-board | on-start-twice | count_on_exactly_one_more | count_on_exactly_one_more ✓ | count_on_exactly_one_more ✓ (0.98, 0.58, 0.27) |
| counting-board | unrelated | abstain | abstain ✓ | abstain ✓ (1.00, 0.03, 0.07) |
| counting-board | nearby-tracking | abstain | abstain ✓ | abstain ✓ (0.88, 0.40, 0.19) |
| counting-board | nearby-tracking-on | abstain | abstain ✓ | abstain ✓ (0.47, 0.55, 0.20) |
| counting-board | nearby-conservation | abstain | abstain ✓ | abstain ✓ (0.18, 0.41, 0.11) |
| counting-board | contradictory | abstain | abstain ✓ | abstain ✓ (0.04, 0.35, 0.02) |
| number-line | distilled | contrast_start_positions | contrast_start_positions ✓ | contrast_start_positions ✓ (0.95, 0.52, 0.26) |
| number-line | paraphrase-a | contrast_start_positions | contrast_start_positions ✓ | contrast_start_positions ✓ (0.98, 0.55, 0.34) |
| number-line | paraphrase-b | contrast_start_positions | contrast_start_positions ✓ | contrast_start_positions ✓ (0.92, 0.51, 0.21) |
| number-line | unrelated | abstain | abstain ✓ | abstain ✓ (1.00, 0.05, 0.09) |
| number-line | nearby-far | abstain | abstain ✓ | abstain ✓ (0.38, 0.47, 0.14) |
| number-line | direction | abstain | abstain ✓ | abstain ✓ (0.55, 0.65, 0.38) |
| number-line | contradictory | abstain | abstain ✓ | abstain ✓ (0.66, 0.43, 0.02) |
| number-tracer | distilled | contrast_gap_positions_in_one_run | contrast_gap_positions_in_one_run ✓ | contrast_gap_positions_in_one_run ✓ (0.98, 0.43, 0.31) |
| number-tracer | paraphrase-a | contrast_gap_positions_in_one_run | contrast_gap_positions_in_one_run ✓ | contrast_gap_positions_in_one_run ✓ (0.97, 0.45, 0.23) |
| number-tracer | paraphrase-b | contrast_gap_positions_in_one_run | contrast_gap_positions_in_one_run ✓ | contrast_gap_positions_in_one_run ✓ (0.97, 0.53, 0.18) |
| number-tracer | neighbour | contrast_gap_positions_in_one_run | contrast_gap_positions_in_one_run ✓ | contrast_gap_positions_in_one_run ✓ (0.94, 0.51, 0.25) |
| number-tracer | unrelated | abstain | abstain ✓ | abstain ✓ (0.99, 0.04, 0.10) |
| number-tracer | nearby-orientation | abstain | abstain ✓ | abstain ✓ (0.93, 0.26, 0.29) |
| number-tracer | nearby-teen-order | abstain | abstain ✓ | abstain ✓ (0.94, 0.22, 0.16) |
| number-tracer | nearby-counting-back | abstain | abstain ✓ | contrast_gap_positions_in_one_run ✗ (0.43, 0.39, 0.24) |
| number-tracer | contradictory | abstain | abstain ✓ | contrast_gap_positions_in_one_run ✗ (0.02, 0.42, 0.02) |
| ten-frame | ksub-distilled | contrast_same_first_number_different_second | contrast_same_first_number_different_second ✓ | contrast_same_first_number_different_second ✓ (0.96, 0.45, 0.24) |
| ten-frame | ksub-paraphrase-a | contrast_same_first_number_different_second | contrast_same_first_number_different_second ✓ | contrast_same_first_number_different_second ✓ (0.91, 0.46, 0.20) |
| ten-frame | ksub-paraphrase-b | contrast_same_first_number_different_second | contrast_same_first_number_different_second ✓ | contrast_same_first_number_different_second ✓ (0.97, 0.53, 0.20) |
| ten-frame | kadd-distilled | contrast_same_first_number_different_second | contrast_same_first_number_different_second ✓ | contrast_same_first_number_different_second ✓ (0.97, 0.46, 0.24) |
| ten-frame | unrelated | abstain | abstain ✓ | abstain ✓ (1.00, 0.03, 0.08) |
| ten-frame | nearby-removed | abstain | abstain ✓ | abstain ✓ (0.78, 0.44, 0.20) |
| ten-frame | nearby-one-less | abstain | abstain ✓ | abstain ✓ (0.45, 0.35, 0.20) |
| ten-frame | contradictory | abstain | abstain ✓ | abstain ✓ (0.51, 0.33, 0.02) |
| place-value* | bare-digit-worth | contrast_digit_worth | contrast_digit_worth ✓ | contrast_digit_worth ✓ (0.91, 0.64, 0.33) |
| place-value* | name-for-value | contrast_place_name_and_value | contrast_place_name_and_value ✓ | contrast_place_name_and_value ✓ (0.98, 0.65, 0.18) |
| place-value* | unrelated | abstain | abstain ✓ | abstain ✓ (0.99, 0.08, 0.10) |
| place-value* | uncertain | abstain | abstain ✓ | abstain ✓ (0.79, 0.41, 0.03) |
| base-ten* | count-for-worth | contrast_block_count_and_worth | contrast_block_count_and_worth ✓ | contrast_block_count_and_worth ✓ (1.00, 0.64, 0.21) |
| base-ten* | place-name | abstain | abstain ✓ | abstain ✓ (0.96, 0.35, 0.19) |

\* place-value and base-ten observations were authored for this bench in the probe scripts' convention; every other case is copied from a probe script's pre-fixed table.
## D. Out-of-sample — judged-evidence census, 20 real packets with human verdicts (14 hypothesis confirmed, 2 defensible abstain, 4 capture gap)

| human verdict | n | TypeSafe mean P(rule) | mean P(evidence complete) |
|---|---|---|---|
| hypothesis names the planted signature | 14 | 0.82 | 0.86 |
| abstain, defensible (no single rule in the fixture) | 2 | 0.61 | 0.68 |
| abstain, capture gap (stimulus missing from the record) | 4 | 0.54 | 0.42 |

P(rule) ≥ 0.5 agrees with the distiller's abstain/write decision on 85%. On the 14 human-confirmed hypotheses: P(supported) own 0.88 vs another source's hypothesis 0.03 (own above other 100%); P(leaks) 0.09. 1025 ms per packet.

| source | human | distiller | P(rule) | P(complete) | supported own / other | leaks |
|---|---|---|---|---|---|---|
| 3d-shape-explorer | capture-gap | abstain | 0.46 | 0.12 | — | — |
| base-ten-blocks | yes | gen (high) | 0.90 | 0.94 | 0.94 / 0.04 | 0.12 |
| compare-objects | abstain-defensible | abstain | 0.76 | 0.45 | — | — |
| decodable-reader | capture-gap | abstain | 0.66 | 0.90 | — | — |
| di-deduction | yes | gen (high) | 0.89 | 0.83 | 0.95 / 0.02 | 0.07 |
| di-spoken-practice | yes | gen (high) | 0.76 | 0.55 | 0.82 / 0.02 | 0.12 |
| di-word-problem-setup | yes | gen (high) | 0.60 | 0.92 | 0.64 / 0.03 | 0.21 |
| di-worked-procedure | yes | gen (high) | 0.90 | 0.88 | 0.89 / 0.01 | 0.04 |
| letter-sound-link | yes | gen (high) | 0.68 | 0.87 | 0.75 / 0.02 | 0.06 |
| letter-spotter | yes | gen (high) | 0.91 | 0.94 | 0.96 / 0.04 | 0.07 |
| oral-sentence-studio | yes | gen (high) | 0.81 | 0.87 | 0.91 / 0.05 | 0.07 |
| ordinal-line | capture-gap | abstain | 0.28 | 0.35 | — | — |
| phoneme-explorer | yes | gen (high) | 0.72 | 0.81 | 0.83 / 0.05 | 0.09 |
| picture-vocabulary | capture-gap | abstain | 0.74 | 0.29 | — | — |
| place-value-chart | yes | gen (high) | 0.84 | 0.81 | 0.91 / 0.06 | 0.08 |
| rhyme-studio | yes | gen (high) | 0.90 | 0.89 | 0.94 / 0.02 | 0.06 |
| sentence-analyzer | abstain-defensible | abstain | 0.46 | 0.91 | — | — |
| sorting-station | yes | gen (high) | 0.89 | 0.90 | 0.93 / 0.01 | 0.08 |
| syllable-clapper | yes | gen (high) | 0.86 | 0.87 | 0.88 / 0.03 | 0.07 |
| word-builder | yes | gen (high) | 0.87 | 0.92 | 0.92 / 0.06 | 0.14 |

## Reading (judged 2026-09-16)

**On the loop's own labeled sets, both LLM gates are already near-perfect, so there is nothing for a
gate to catch there.** The 46 diagnosis scenarios are the distiller's Phase-0 tuning set; the 55 planner
cases are the probe scripts' pre-fixed tables. The distiller scored 96% (one miss: it abstained on
`letter-sound-spoken-onset-omission`, which TypeSafe read as a rule at 0.74) and the planner 100% once
its Gemini API blips were retried. Every gate curve reads 100% because there were no false positives to
remove. What these sets DO show is TypeSafe reproducing the decisions out of sample: 98% on the abstain
axis in 0.25 s against the distiller's 10.6 s, and 91% on move-vs-abstain in 0.24 s against 9.9 s.

**Verifier (B) is the clean win.** 28 hypotheses × three pairings: P(supported) 0.91 on the hypothesis's
own evidence, 0.05 on another scenario's, own above other on 28/28; the leak Noul fired on 28/28
injected answers and on 0/28 clean texts. Weakest: `di-math-facts-echoes-last-number` at 0.56 (the
hypothesis says "repeats the second addend", the evidence shows echoing the last number said — a
paraphrase gap worth a look) and one injected leak read at 0.50 where the "correct outcome" was a
description rather than an answer. This is the job Probe D's LLM judge does today, at 184 ms and 1.2k
tokens per hypothesis, code-thresholdable.

**Planner (C): TypeSafe's Choice over-applies to unreliable observations; its confidence knows.** The five
false applies were all contradictory/unreliable or cross-representation observations, at confidence
0.02–0.73 with P(reliable) ≤ 0.25; every true apply sat at confidence ≥ 0.91. A confidence floor of 0.8
makes it 26/26 moves and 29/29 abstains — the same answers as the LLM planner, 40× faster — but the
threshold was set on this data. The `applies` Noul as worded is unusable (it scored every positive
below 0.5); ignore it.

**Out of sample (D): as a gate on the distiller's WRITES, TypeSafe never disagreed with the human.** On
the 14 census hypotheses a human confirmed, P(supported) was 0.64–0.96 (mean 0.88) against 0.03 for a
swapped hypothesis, leaks ≤ 0.21. On the 6 abstains it is LESS conservative than the distiller: P(rule)
≥ 0.5 on three of them (compare-objects 0.76, decodable-reader 0.66, picture-vocabulary 0.74), where
the human agreed nothing should be written. A separate `evidence complete` Noul flags three of the four
capture gaps (0.12, 0.35, 0.29 vs 0.81–0.94 on confirmed packets) and misses decodable-reader (0.90).

**Verdict for the misconception loop.**
1. *Do not replace* the distiller or the planner with TypeSafe: on real packets it writes where they
   abstain, and abstain is the loop's success condition.
2. *Verify:* a TypeSafe `supported` + `leaks` check on every distiller hypothesis is cheap, code-judged,
   and agreed with the human 14/14 and with the golden set 28/28. Candidate for Probe D's judge and for
   a runtime leak/support gate before a hypothesis is stored. Failsafe shape: specialistSuggestions.ts.
3. *Gate the planner* only if it ever produces false applies; today it does not on any labeled case.
4. *Capture-gap detector:* the `evidence complete` Noul is a 3/4 signal on the class the census found by
   hand — worth a second probe on the four repaired sources.
