# Census: media-player — 2026-07-16 (contract derivation run)

9 manifest-only topic-traces (POST `/api/lumina/topic-trace`, `manifestOnly:true`) run for
`/primitive-contract media-player --census` (reader-fit BACKLOG #9a Step 1). Raw JSON in the
session scratchpad (`census-out/*.json`); this file is the durable tally.

## Batch and results

| Lesson (topic) | Grade | media-player routed? | Curator intent (when routed) |
|---|---|---|---|
| 2D shapes match/name | K | — | |
| Community helpers roles | K | — | (was ✓ in the 07-14 census — routing is probabilistic at K) |
| Compare groups to 5 | K | — | |
| CVC short 'a' decode | K | — | |
| Needs vs wants | K | **✓** | "A 3-segment narrated lesson. Segment 1: Why we need food… Segment 2: shelter…" — difficulty `easy`, pin `null` |
| Rhyme identify (spoken) | K | — | |
| SS001-05-c Independence Day origins (listen + answer) | 1 | **✓** | "Generate a 3-segment narrated story for 1st graders… colonies → new country → …" — `easy`, pin `null` |
| SS004-05-c invention impact (listen + answer) | 1 | **✓** | "3-segment narrated story about Thomas Edison… life before → invention → change" — `easy`, pin `null` |
| Water cycle stages | 3 | — | catalog claims "grades 3+" is its home; the manifest did NOT pick it there |

## Findings

1. **K routing is real but occasional (1/6 fresh; 2/6 on 2026-07-14).** The curator uses
   media-player at K as the *narrated "why" explainer* beat. The catalog's "Best for grades 3+"
   constraint is not honored by routing and diverges from observed demand.
2. **The Grade-1 narrated-listening identity is the strongest live consumer (2/2).** Both authored
   social_studies homes (`SS001-05-c`, `SS004-05-c` — `target_primitive: media-player`, constraints
   "audio track; 3-4 multiple-choice questions") route it deterministically when their topic runs.
3. **Zero routing at grade 3** on a canonical process topic (water cycle) — the claimed 3+ band is
   not where its demand lives.
4. All hits: `difficulty: easy`, `targetEvalMode: null` (valid-null — the primitive has **no eval
   modes**, EVAL_TRACKER MP-3/SP-13).
