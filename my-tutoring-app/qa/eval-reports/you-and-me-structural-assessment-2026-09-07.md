# You & Me structural difficulty assessment

Decision: support-only under the current two-mode contract. Structural difficulty was assessed, not implemented. No production behavior, mode priors or scoring changed.

The support-tier prerequisite is satisfied: the generator consumes normalized supportTier and applies resolveSupportStructure per challenge after fallback and role assignment. Review covered the generator, catalog modes, scene validation, spoken judging pack, support resolver and birth contract.

| Mode | Required structure at every tier | Available structural range |
|---|---|---|
| describe_action | One completed action, one actor, two named partners; choose I/you from the current speaking role | One actor-to-speaker relation per answer |
| describe_independent_action | The same relation plus a self word bound to that actor, expressing no help | One subject/self binding per answer |

No justified easy/medium/hard structural values were identified within these bounds. The existing visible and spoken support ladder remains meaningful.

Candidates considered:

- More actors or linked actions: the current contract has two participants, one actor and one action. Its validator excludes conjunctions and its judge evaluates one event. This would require a redesigned task and judging contract, beyond a generator-only tier change.
- Add reflexives to personal-pronoun hard items or omit them on independent-action easy items: crosses the registered mode boundary.
- Harder vocabulary, longer noun phrases or rarer verbs: increases incidental language demands without adding a perspective relation. No defensible monotonic structural ladder follows from word count.
- Change first-speaker order: both orders already occur within each mode, alongside balanced I/you turns. Making easy predictable would undermine the existing protection against answering by turn number.
- Delay paired turns or interleave scenes: with the complete named scene re-presented, this does not establish a harder per-item relation; hiding it would introduce memory demands and remove accessible scene information. Scheduling effects would need a separate design and validation.
- Similar names/emojis or hidden role labels: reduces stimulus clarity rather than adding relational structure. Support withdrawal already handles optional tracking aids.
- Require a justification: adds a scored response requirement outside both existing spoken-production contracts.

The add-structural-difficulty skill explicitly allows support-only primitives when no clean in-mode lever exists. This is a scoped design conclusion, not a claim that richer perspective-taking activities are impossible.

Verification: source/contract inspection only in this assessment. No code changed, so no new compile, builder stress test or generation sweep was needed. Prior support-tier evidence remains in [support verification](you-and-me-l3-2026-09-07.md); it is not evidence of a structural ladder.

Next: complete the outstanding browser/microphone acceptance using the current support tiers. Confirm role switches, correct and incorrect pronoun/self bindings, tier-aware help, replay, correction caps and final submission. A richer multi-event activity should begin with an explicit learning and judging contract if later desired.
