# knowledge-check --check, 2026-09-29 (handoff 25 levers)

**Verdict: COMPATIBLE.** The edit serves the new lever consumer (R10-R12). Other consumers' probes:

| Req | What could break | Probe run | Result |
|---|---|---|---|
| R1 keys resolve | the `distance` field on options; cue fields | saved-payload tests (15 payloads), `KnowledgeCheck.workspace.test.tsx` | pass; `correctOptionId` untouched |
| R2 K picture menu | cue/drop render on the K surface | `recall.science-k` / `recall.social-k` payloads in the sweep; K options keep emoji | pass |
| R3/R4 grade and Bloom | prompt additions | 12 Flash generations across 4 modes, G1-2 | option counts and lengths unchanged by the edit; 6/12 were already unbuildable (finding below) |
| R7 `::pN` bridges | none touched | `KnowledgeCheck.workspace.test.tsx` "completion submits once per problem" | pass |
| R9 atomic evidence | schema additions in the same call | generator unchanged apart from two optional fields and one enum | pass (typecheck:lumina 0) |

Finding outside this edit (existing): 6 of 12 single-problem G1-2 generations build no judged item (stem over
`MAX_PROMPT_WORDS` = 24, or the key word is in the stem of a "which word in this sentence" question), so the set runs as the
tap flow with no tutor and no levers. Filed with the report.
