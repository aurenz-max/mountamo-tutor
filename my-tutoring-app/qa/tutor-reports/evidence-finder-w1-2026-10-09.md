# evidence-finder — W1 workspace binding (batch C21, plain shape), 2026-10-09

## What is bound
| Mode | Items | Checked by code |
|---|---|---|
| locate_evidence | `find` | `findCorrect`: no non-evidence, every strong/moderate evidence sentence highlighted (weak optional) |
| match_evidence_to_claim | `find` | the same, plus each highlight under the claim it supports (`claimOf`) |
| evaluate_evidence_strength | `find`, `rate` | find as above; `rateCorrect`: every evidence sentence rated its `evidenceStrength` |

Misses (`evidenceFinderMiss`): find `not_evidence`, `wrong_claim`, `missed_evidence`; rate `weak_as_strong`,
`rated_too_strong`, `rated_too_weak`, `mixed_ratings`. Catalog `teachingWorkspace.misses` lists them per mode.

Not bound: the CER reasoning box (open writing, no check, no bounded answer). It stays on the scripted path; on the
workspace the evaluate mode is find + rate (contract G1). Undriven modes: none.

## Changes beyond the binding
- **Generator** (`gemini-evidence-finder.ts`): `claimIndex` required (-1 for non-evidence, stripped in code). The first
  match payload had no `claimIndex` on any sentence, so the match check had nothing to check; the regenerated one has it.
- **Scripted find check** now the same as the workspace's. Before, any one evidence sentence passed, so highlighting every
  sentence passed.
- **Scripted Finish** submitted a stale first-render record (empty highlights) through a memoized callback; fixed.
  Should work — needs a browser check on the scripted locate and evaluate flows.

## Gates
- `typecheck:lumina`: 0.
- `EvidenceFinder.workspace.test.tsx` + `LiteracyWorkspaces.surface.test.tsx`: 13/13.
- `workspaceContract`, `misses`, `activityContract`, `lessonWorkspacePlan`, `sourceControlBytes`: 2932/2932.
- Journey sweep, 3 payloads: 0 findings (J1-J11); misses named 4/4; records: clean 100, recover 67.
- Tutor replay 3 payloads x 5 samples (`replay/evidence-finder-2026-10-09.json`): 0 misses on every check. `replayKeys`
  is empty (reading the passage is allowed, and the strength words are the printed choices), so replies were read by
  hand: no reply named a sentence as evidence or a claim for one. Two stuck replies narrowed to "sentence 1 or sentence
  2" or asked which sentence describes the first step; teaching moves, not the key. The rate item is not recorded
  (the replay records the first item only).

## Open
- G1 CER reasoning has no check (OPEN-row work, evidence contract).
- G2 the check trusts the generator's labels; the locate payload tags a sentence that arguably proves the claim as not
  evidence. → `/oracle-test`.
