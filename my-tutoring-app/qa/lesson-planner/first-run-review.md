# First planner run — 2026-09-06

Artifact: [readable plan](runs/direct-attribute-comparison-2026-09-06T04-08-33-450Z-79a367ec.md), [full input/output](runs/direct-attribute-comparison-2026-09-06T04-08-33-450Z-79a367ec.json).

One Gemini call took 5,601 ms (API only, not hydration or end-to-end lesson latency). The plan estimates 15 student minutes: curator-brief (2), foundation-explorer (4), length-lab/compare (4), compare-objects/compare_two (5). Structural checks passed. Five deterministic validator/input tests also passed. This is a single sample, not a speed or quality benchmark.

## What this demonstrates

- The standalone runner can load the real catalog and existing Gemini client without a dev server, persist exact inputs/settings and produce a readable plan.
- The result includes context and explanation alongside specific practice tools, rather than only repeated assessment activities.
- It reports partial/unmet evidence requirements instead of claiming the selected tools fully achieve the objective.

## What still needs judgment

- `supported_investigation` is assigned to looking at already-aligned bars and selecting a relationship. That is guided observation/practice, not the child conducting the comparison. The requirement is too loosely defined to prevent role-label substitution. Add a short observable meaning to each contribution before treating declared coverage as useful.
- Application is another collection of comparison questions with fresh pictures. Fresh examples support generalization, but the plan does not yet establish meaningful use in a new situation. Decide what application must mean for this pattern.
- FoundationExplorer's proposed exact diagrams and checkpoint behavior are generator requests, not verified generated content. The run did not hydrate this experience.
- Some gap rationales overclaim: the model asserts that the components have no telemetry separating support levels. That was not established by our supplied source notes. It also treats manipulating the balance as necessary for the narrower `compares_weights_using_observable_evidence` label, although interpreting a balance provides observable evidence. Separate observable interpretation from setup/manipulation in the requirement definitions.
- Minutes are model estimates, not observed session times. The prompt contained 21,376 characters; one 5.6-second response does not establish a reliable latency distribution.

## Next decision

Review the four experiences with the user: keep/fix/cut and whether this feels complete. Then tighten contribution/evidence definitions (without forcing particular primitive IDs), run a fresh sample, and affirm the planning contract. The current baseline A/B and hydration adapters remain deliberately unimplemented until that review, as agreed. Candidate recall is not being tested yet: the 13-primitive shortlist was manually curated.
