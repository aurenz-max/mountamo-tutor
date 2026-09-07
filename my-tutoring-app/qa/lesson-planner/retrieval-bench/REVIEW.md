# Retrieval design probes before changing models

All probes use `gemini-embedding-001`, 768 dimensions, `RETRIEVAL_DOCUMENT` for indexed text and `RETRIEVAL_QUERY` for queries, with cosine scoring. They reuse 22 previously explored inputs: nine open topics and 13 curriculum objectives. This is a regression set, not unseen generalization evidence.

| Search | Expected primitive-family recall | Three explicit mode probes |
|---|---:|---:|
| Flat primitive-mode descriptions | 36/37 | 2/3 |
| Family semantic + lexical rank fusion, bounded task expansion | 35/37 | 2/3 |
| Protected semantic families + complementary retrieval, all family modes | 36/37 | 3/3 |

The three mode probes are ordinal identify, ordinal sequence-story, and equation-builder/build-simple. They were declared before running these experiments but chosen from known failures. Candidate consideration labels do not establish grade compatibility or required lesson selection.

The first family method recovered hydraulics for excavators but lost both expected butterfly primitives. Unconditional rank fusion let weak lexical matches displace strong semantic matches. Its raw records remain in [family-v1](family-v1/summary.json).

The second method preserves eight strongest semantic specialist families, then adds two lexical and two fused complements, six semantic support families and the closing-assessment families. All modes are retained within those families. Existing fixture evidence requirements are separately embedded and used to annotate likely mode matches; these annotations do not certify capabilities. Family metadata is serialized once instead of repeated per mode.

That recovered `equation-builder/build-simple`, hydraulics and the butterfly candidates, but missed `habitat-diorama` for penguins. Overall family recall therefore did not improve. The larger mode pool is an intentional difference: median 66 tasks versus 34, while shared metadata reduced median candidate JSON size from 42,725 to 37,599 characters. Median retrieval wall time was 419 ms versus 202 ms; curriculum cases include a second batched query call for evidence requirements. These timings exclude lesson planning and generation and are not production service-level measurements.

See [v2 metrics](family-v2/metrics.json), [per-query summary](family-v2/summary.json), and [frozen queries and consideration labels](family-v2/protocol.json). The v2 runner is `scripts/lesson-planner-retrieval-bench-v2.mjs`; the original protocol's shared source list names the v1 runner, so the supplemental provenance file records the actual v2 runner hash.

## Proposed next retrieval experiment

Use capability-grounded teacher-language exemplars as an additional search view. Generate them offline from verified task behavior, grade-dependent response forms and scope constraints. Include close partial matches and unsupported cases in reranker/evaluation data. Do not infer new capabilities from synthetic phrasing, and do not let variants with more exemplars receive more votes merely because of their count.

Compare descriptions, exemplars, and their union using fixed candidate/token budgets and a held-out gold set. Rerank requirement-to-task coverage after retrieval, preserving multiple complementary matches. Retrieval score, chooser self-confidence and agreement are calibration features, not correctness gates. A calibrated policy must also check capability compatibility and generated content.

Google currently documents [Gemini Embedding 2](https://ai.google.dev/gemini-api/docs/embeddings) and [EmbeddingGemma](https://ai.google.dev/gemma/docs/embeddinggemma). Neither was benchmarked here. The first requires different task-prefix formatting from embedding-001; its multi-input aggregation also differs. EmbeddingGemma offers a local deployment option, not an established quality advantage on this task.
