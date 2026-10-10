# evidence-finder — support levers, 2026-10-09

## Failure inventory
No real-learner evidence (no demonstrations, misconception or tutor reports before today). Classes below.

| Mode | Failure | Class |
|---|---|---|
| all | highlights a sentence that is only about the topic, or an opinion (`not_evidence`) | documented (commonStruggles "opinion vs evidence"), synthetic (sweep) |
| all | stops before all the evidence is found (`missed_evidence`) | synthetic, inferred |
| match, evaluate (2 claims) | puts evidence under the other claim (`wrong_claim`) | synthetic (sweep) |
| evaluate | rates a sentence that only mentions the idea as Strong (`weak_as_strong`) | documented ("weak evidence: does this PROVE it or just mention it?") |
| evaluate | rates too strong / too weak / both (`rated_too_strong`, `rated_too_weak`, `mixed_ratings`) | inferred |
| all | "wrong section" (documented) | not observable by code: no paragraphs are drawn |

## Lever table (built)
| Item | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| find | `evidence_count`: boxes per claim, one per strong/moderate sentence, filled per highlight | help | missed_evidence, wrong_claim | `countLeaks`: refused when a claim has none, or when every sentence is proof |
| find | `proof_example`: a worked example on another topic (claim, proof, topic-only, opinion, each with why) | help | not_evidence, wrong_claim | `poolLeaks`: a pool topic the passage mentions is never used |
| find | `practice_passage`: four sentences on another topic, same claim count | simplify | all find misses | `practiceLeaks`: no session sentence or claim |
| rate | `strength_guide`: Strong / Moderate / Weak meanings, each with an other-topic example | help | all rate misses | `poolLeaks` |
| rate | `practice_ratings`: one strong and one weak sentence on another topic | simplify | all rate misses | `practiceLeaks` |

Carrier `shown` for all (G2-6 readers; the tutor may read them). Every lever acts on a model outside the passage, or
counts; none marks a sentence. Starting positions from `config.difficulty`: not built (the generator has no tier harness).

## Gates
- `typecheck:lumina`: 0.
- `evidenceFinderLevers.test.ts` + `EvidenceFinder.levers.workspace.test.tsx` + `EvidenceFinder.workspace.test.tsx`: 21/21.
- Journey sweep, 3 payloads: 0 findings J1-J13; lever inventory: every catalog miss answered on every mode, J12 0 gaps.
- `workspaceContract`, `misses`, `activityContract`, `lessonWorkspacePlan`, `LiteracyWorkspaces.surface`, `sourceControlBytes`:
  2953/2954 on the first run (sourceControlBytes failed once while a sibling was mid-edit; 1/1 on rerun, and my files
  have no control bytes).
- Tutor replay 3 x 5 (`replay/evidence-finder-2026-10-09-r2.json`): 0 misses on every check, `no_change_before_receipt`
  0/15. Read by hand: lever replies describe the example or the boxes after the pull, name no passage sentence; match
  replies say how many boxes each claim has (allowed). One stuck reply pulled `practice_passage` and `proof_example` in
  the same turn. Rate levers are not in the replay (first item only).

## Failures with no lever
- "wrong section" (documented): the passage is drawn as one block with no paragraphs, so there is no section to point at.
