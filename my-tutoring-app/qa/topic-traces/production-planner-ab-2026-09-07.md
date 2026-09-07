# Topic trace: production versus experimental curriculum planner

Kindergarten, five fixed curriculum objectives, two fresh builds per arm. Real manifest/resolver and component generators were called directly through the same services as topic-trace. Full comparative findings and exact artifacts are in [the production comparison](../lesson-planner/production-ab/REVIEW.md).

| Objective/primitive | Observed scope loss | Broken link | Investigation target |
|---|---|---|---|
| Sixth–tenth / ordinal-line | Generated lines still stop at fifth in both arms | GENERATOR; K cap conflicts with requested target | ordinal-line grade/window handling and task capability contract |
| Represent 16–19 / base-ten-blocks | Experimental target sequence 3,8,12,18; production example 18,19,13,11 | GENERATOR; exact objective survives in config | base-ten target selection/scope binding |
| Decompose 16–19 / knowledge-check | Prompt asks “What number is this?” for glyph 16, expects “sixteen,” despite decomposition successCriteria | GENERATOR / generated assessment task | knowledge-check task planning and objective fidelity |
| Teen equations / application | Experimental addition-subtraction-scene generated 4+2=6 | GENERATOR / task scope | addition-subtraction-scene range contract |

Confirmed example chains are documented in the comparison report and its `scopeSamples` fields. No production repair was attempted. These are observed scope/task drops, not claims about a child's developmental ceiling.
