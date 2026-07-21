# Contract check: comparison-builder — 2026-07-20 (item 2b tail)

**Edit served consumer:** K PRE band (reader-fit item 2b tail) — rule-5
feedback-on-object + per-mode PRE picture passes (compare_numbers / order /
one_more_less). **Verdict: COMPATIBLE.** The edit is a band+mode fork keyed on
`gradeBand==='K'` (never on support tier); it BUILDS gap G1.

## Blast radius touched

Component `ComparisonBuilder.tsx` (K render branches + wrong-flash state), catalog
`math.ts` aiDirective (compare-numbers ORIENT line). Generator untouched.

## Other-consumer requirement probes (post-edit)

| Req | Consumer (other) | Probe | Result |
|---|---|---|---|
| R1 compare-groups K tap surface | K PRE compare_groups | jsdom compare-groups 5/5 (no text buttons/Check @ K; tap side/`=` completes; wrong tap doesn't) | PASS — only a shake class added on wrong taps; surface unchanged |
| R2 tutor ORIENT/DISAMBIGUATE names the comparison | all K PRE modes | catalog directive still names the comparison answer-free; keys unchanged; reworded compare-numbers to "tap the bigger number" | PASS (probe: keys resolve; live confirmation = residual) |
| R3 no answer / `{{#if}}` in spoken lines | all consumers | grep the edited directive + new component sendText paths | PASS — no handlebars, no answer word added |
| R4 answer computed in generator | oracle, all | generator `git diff` clean; eval-test compare_numbers `correctSymbol` correct incl `=` | PASS |
| R5 support tier drives withdrawal (not band) | support-tier / structural-difficulty | new K gates key on `isK`, not tier; Grade-1 alligator/count-badge/target-marker/slot-hint tier levers intact | PASS — same rationale as the COMPATIBLE 07-16 chrome band-gate |
| R6 mastery + evaluation submit | oracle, misconception, IRT | jsdom completion reaches Next for compare_numbers/one_more_less K taps; full suite 857/857 | PASS |
| R7 grade band ceiling; instruction names no answer | oracle, grade-fidelity | generator untouched; eval-test 3 modes in band; `bandMax` only bounds the display window | PASS |

## Aggregate

- `typecheck:lumina`: **0 errors**
- `ComparisonBuilder.reader-fit.test.tsx`: **25/25**
- full vitest: **857/857**
- eval-test @ K (compare_numbers, one_more_less, order): **3/3 pass**, content in band

No REGRESSION, no CONFLICT. Contract changelog updated; G1 marked BUILT
(2026-07-20). Residual (not a blocker): live `--lesson` behavioral confirmation +
browser pixel → HUMAN-CHECKS #35.
