# Contract: evidence-finder

- **Derived:** 2026-10-09 (workspace W1 binding + levers, batch C21; no earlier contract)
- **Component:** `primitives/visual-primitives/literacy/EvidenceFinder.tsx` · **Domain:** `literacy/evidenceFinderWorkspace.ts` ·
  **Levers:** `literacy/evidenceFinderLevers.ts` · **Generator:** `service/literacy/gemini-evidence-finder.ts` ·
  **Catalog:** `service/manifest/catalog/literacy.ts`
- **Modes:** `locate_evidence` (1 claim) · `match_evidence_to_claim` (2 claims) · `evaluate_evidence_strength` (CER on).

## Requirements

### R1 — every phase is the activity's own check · OBSERVED
One passage, one or two checked items: `find` (every mode) and `rate` (when `cerEnabled`). `findCorrect`: no
non-evidence highlighted, each highlight under its own claim (`claimOf`), every strong or moderate evidence sentence
highlighted; a weak one is optional. `rateCorrect`: every evidence sentence rated exactly its `evidenceStrength`.
The same find check runs on the scripted path (before 2026-10-09 any one evidence sentence passed, so highlighting every
sentence passed). On the workspace each check commits through `commitCheck` with `evidenceFinderMiss`; the runtime
owns progression. Probe: `EvidenceFinder.workspace.test.tsx`, journey sweep J1-J13.

### R2 — nothing on screen or in the packet gives an answer away · OBSERVED
The scene lists sentences in passage order and claims as printed; no `isEvidence`, `claimIndex` or strength reaches
the tutor. A wrong check's screen text names the kind of slip (`MISS_FEEDBACK`), never a sentence or rating.

### R3 — generated content can be checked · OBSERVED (2026-10-09)
`claimIndex` is required in the schema (-1 for non-evidence, stripped in code; claim 0 forced on a one-claim passage):
optional, flash-lite dropped it on every sentence of a two-claim passage. `validateEvidenceFinderData` refuses a
passage with no evidence, all evidence, a two-claim evidence sentence with no claim, or a CER passage missing a strength.

### R4 — scripted path · OBSERVED (vitest), needs a browser check
Outside a live runtime: find → evaluate (rates what was highlighted) → reason (CER, grade 4+) → one submission.
Finish no longer submits a stale empty record (it was a `useCallback` closed over the first render).

### R5 — levers never mark a sentence of the passage · OBSERVED (2026-10-09)
Workspace only, state keyed by item. find: `evidence_count` (help; boxes per claim, one per strong/moderate sentence,
filled per highlight; refused by `countLeaks` when a claim has none), `proof_example` (help; a worked example on a
pool topic the passage never mentions, `poolLeaks`), `practice_passage` (simplify; four sentences, same claim count).
rate: `strength_guide` (help; Strong/Moderate/Weak with pool-topic examples), `practice_ratings` (simplify; one strong,
one weak). Practice is `<item>~simpler`, ungraded, never the session's text (`practiceLeaks`); Try again keeps it; the
full item returns blank. Probe: `evidenceFinderLevers.test.ts`, `EvidenceFinder.levers.workspace.test.tsx`, J12/J13.

## Open
- **G1** — the CER reasoning box (evaluate_evidence_strength) is open writing with no check and no bounded answer: it
  stays on the scripted path; on the workspace that mode checks find + rate only. Needs an evidence contract (ROLLOUT
  OPEN row precedent).
- **G2** — the check trusts the generator's evidence and strength labels; a mislabeled sentence becomes a false miss
  (locate payload 10-09: "Farmers often keep beehives near their fields to help pollinate their crops" tagged not
  evidence). → `/oracle-test`.
