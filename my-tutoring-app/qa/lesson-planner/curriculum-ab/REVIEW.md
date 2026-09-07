# Curriculum objective pilot: ordinals and teen numbers

All 13 supplied objectives were tested separately in 26 live plans, with kindergarten retained as the user requested. Both retrieval methods found every expected specialist. The dominant failures were selecting compatible tasks and honestly describing their evidence, not finding the primitive.

| Measure | Lexical | Semantic |
|---|---:|---:|
| Expected candidate occurrences found | 19/19 | 19/19 |
| Structurally valid plans | 13/13 | 11/13 |
| Median online latency | 8,321 ms | 8,483 ms |
| Median query embedding latency | 0 ms | 272 ms |
| Plans reporting evidence gaps | 10/13 | 12/13 |
| Plans exceeding 15 minutes | 2/13 | 1/13 |

There is no demonstrated semantic retrieval advantage on this small curriculum set. Unlike “sea otters,” these objective texts already contain the vocabulary used in the catalog. Every pair used the same source fixture, 201-entry catalog, generation model (`gemini-3.8-flash`) and prompt template. One sample per arm is insufficient to compare stochastic planning quality. The 162 ms median difference is not an isolated estimate of embedding overhead.

## What was tested

The new `objective` pipeline uses the exact objective text for discovery, preserves its ID, and makes one composition call with the retrieved full capability/mode cards. It does not generate or rewrite an open-topic learning arc. Both arms retain the existing shortlist algorithm and general teaching/assessment pool. This compares lexical versus semantic discovery, not a hybrid retriever or production manifest generation.

The learner is K/non-reader; sessions target 15 minutes. Original objective text is verbatim. Local IDs and two evidence criteria per objective are tester-authored, not externally sourced curriculum IDs. Expected candidates are report-only labels: ordinal-line for ordinal objectives; base-ten-blocks plus ten-frame for the first five teen objectives; base-ten-blocks plus number-bond for equations. They measure consideration, including relevant-but-incompatible tools, not required final selection. Equation-builder was not included in that minimal expectation set, so recall is not exhaustive.

## Objective-by-objective findings

| Supplied objective | Observed selection and limitation |
|---|---|
| Recognize/name first–fifth | Both select ordinal-line build_sequence, identify and sequence_story. They acknowledge that K identify produces a character name, not an ordinal word. Semantic estimates 18 minutes. A claim that no K mode produces ordinals is too broad: match and sequence_story do. |
| Match first–fifth to 1st–5th | Both select ordinal-line/match. This reads a symbol aloud; it does not offer a word-to-symbol matching grid. Audio-supported correspondence may satisfy the learning aim; lack of independent printed-word reading is not automatically a curriculum gap. |
| Daily routines/story sequences | Lexical includes time-sequencer/sequence-3 and how-it-works/guided. Semantic relies more heavily on ordinal-line. Its requests to turn character-position stories into event-order tasks need verification. Event ordering and a character's rank are different evidence. |
| Extend to sixth–tenth | Both select ordinal-line for beyond-fifth tasks despite the K cap. Semantic explicitly assumes an “intent override.” No such override was established by this tester. Both structural validations pass. |
| Before/after an ordinal | Both select ordinal-line/relative_position and acknowledge that its response is a character name, rather than an ordinal such as “third.” This is useful positional evidence but does not establish the same expressive response. |
| Create/complete first–tenth | Both report that the full span is unsupported by their K ordinal-line choices and use shorter sequences. This is an honest partial plan, not a fulfilled objective. Do not confuse the four-clue limit with a four-position capacity. |
| Real-world ordinal problems | Both use ordinal-line/sequence_story; semantic also includes relative_position and knowledge-check/apply. Neither reports a gap. Generated problems still need inspection to distinguish recalling explicitly stated positions from reasoning about novel constraints. |
| Identify ten ones within 11–19 | Lexical uses base-ten build/read. Semantic requests teen quantities through ten-frame/build, counting-board/group and addition-subtraction-scene/act_out despite catalog grade/range constraints. It also invents `freeform_drawing_evidence`, causing structural failure. “Objects or drawings” does not require freeform drawing. |
| Represent 11–15 | Semantic rejects ten-frame and number-bond on K range grounds, then uses base-ten/build_number and counting-board/count_on. It acknowledges rod-versus-loose-ones limitations, but counting-board declares count-on under Grade 1. Final recognition is not independent manipulation. |
| Represent 16–19 | Semantic again rejects ten-frame on K grounds and uses base-ten build/read plus knowledge check. Building standard tens/ones and reading a supplied partition provide useful but different evidence from grouping ten individual ones. |
| Decompose 11–15 | Semantic selects base-ten build/read, fast-fact/apply and knowledge-check/apply; it explicitly reports that building and recognizing a partition only partially support breaking apart a presented whole. The lexical plan reports no gap; that is not proof of full coverage. |
| Decompose 16–19 | Semantic selects ten-frame/decompose with a double-frame intent, contradicting both the K constraint and the mode's enforced single-frame behavior. It also fails structural application bindings. This contrasts directly with its correct rejection of ten-frame for 11–15. |
| Equations for 11–19 | Semantic selects equation-builder/build-simple alongside base-ten blocks, fast fact and knowledge check. This is a useful distinct task, but its catalog reader demand is developing; independent K access is not established. The reported absence of freehand equation writing overstates the objective, which permits equations built from tiles. |

## Source-confirmed boundaries

- **Ordinal-line:** the K setup caps maxPosition at five; the source also clamps the inferred question window to the grade maximum. Changing lesson prose alone is not evidence that a sixth-through-tenth K lesson can execute. See [generator](../../../src/components/lumina/service/math/gemini-ordinal-line.ts:495). The response-direction differences are explicit in [mode descriptions](../../../src/components/lumina/service/manifest/catalog/math.ts:3504) and [script implementation](../../../src/components/lumina/primitives/visual-primitives/math/ordinalLineScript.ts). These are product constraints, not claims that kindergarten children cannot learn these objectives.
- **Ten-frame:** K double-frame output is changed to single, and decompose/split is pinned to single again after configuration overrides. A proposed double-frame teen split contradicts the implemented mode. See [generator](../../../src/components/lumina/service/math/gemini-ten-frame.ts:577) and its final mode guard at line 683. Explicit build configuration behavior requires separate verification; this review does not claim every possible configuration path is impossible.
- **Number-bond:** wholes are capped at five for K and ten overall, and K strips equation-building/fact-family challenges. It is a relevant discovery candidate but cannot simply be assigned 14 = 10 + 4 through intent. See [generator](../../../src/components/lumina/service/math/gemini-number-bond.ts:536).
- **Base-ten-blocks:** build_number validates standard place-value form. Regroup validates that at least one trade occurred and total value was conserved; it does not independently assert that the child isolated exactly ten individual ones. These tasks can contribute instruction, but their grading is not equivalent to the target grouping evidence. See [component](../../../src/components/lumina/primitives/visual-primitives/math/BaseTenBlocks.tsx:510).
- **Equation-builder:** its catalog explicitly records developing reading demand despite K–2 applicability. Tile construction need not be rejected, but accessible instruction must be verified. See [catalog](../../../src/components/lumina/service/manifest/catalog/math.ts:4840).

## Implications for the planner and tester

Discovery worked on these labels. The next missing layer is an explicit compatibility check on the selected task: requested range versus supported range, learner response versus required performance, and what the grader actually establishes. Rich prose and eval-mode descriptions were already in context; they were applied inconsistently.

Preparation should therefore record source-verified task limits and evidence contracts alongside discovery cards. A deterministic check can reject an unsupported range or flag a response mismatch before final composition. It should preserve useful partial instruction, rather than treating an assessment limitation as a reason to discard an entire primitive. A generic visual remains a possible explanation, but cannot acquire a judged manipulative interface through its intent text.

The tester also needs stricter separation of required performances from reviewer cautions. Its ordinal-symbol criteria introduced cardinal/ordinal discrimination as supporting evidence, and the routine criteria warned about event-order versus line-position substitution. Some plans turned those cautions into extra student requirements. Likewise, neither freehand writing nor unaided reading was required by the source objectives. More self-reported gaps is not automatically more honest coverage.

Preserve all failures as baseline cases. Do not infer a new-primitive requirement from these runs alone: capability corrections, accessible existing modes, or more precise evidence bindings may address some gaps. Nothing was hydrated, no live child interaction was tested, and no production primitive or manifest was changed.

Validation: 17 focused Node tests passed, including preservation of the authoritative curriculum objective during retrieval. All 13 pairs passed fixture/catalog/model identity checks. See [full selections and artifacts](RESULTS.md), [structured results](summary.json), and [metrics](metrics.json).
