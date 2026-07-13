# Topic Fidelity: foundation-explorer — 2026-07-12

Scope/theme intended: the concepts must BE the specific parts/terms the assigned
objective (intent) names — not a free-associated topic.

## Diagnosis

The generator is `ctx`-based but was **not context-native**: it read the objective
off `ctx.raw` (`config.objectiveText` / `objectiveVerb` / `objectiveId`) and never
touched the canonical typed axes `ctx.intent` / `ctx.objective`. The canonical
intent-precedence chain (`config.intent → item.intent → item.title`) was therefore
bypassed. In production `flattenManifest` stamps `config.objectiveText`, so the
authored objective still landed — but the QA/eval-test path (which sets
`config.intent`, not `objectiveText`) was blind, and any manifest path lacking
`objectiveText` would silently drop the per-component focus.

| Probe (topic FIXED = "Science concepts", intent varies) | concepts (before) | verdict |
|---|---|---|
| intent = "three parts of a lever: fulcrum, load, effort" | Solid / Liquid / Gas | intent DROPPED |
| intent = "parts of a plant cell: nucleus, membrane, chloroplast" | Roots / Stem / Leaf | intent DROPPED |

Both wildly-different intents produced unrelated, LLM-free-associated content — the
generator ignored intent entirely and invented its own topic from the broad `topic`.

**Verdict:** FIDELITY BUG → fixed at Tier 1 (values are LLM-picked, so prompt
binding is the correct and sufficient fix — no Tier-2 resolver needed).

## Fix

Made the generator context-native in `gemini-foundation-explorer.ts`:
- `objectiveVerb` ← `ctx.objective.verb`; `specificFocus` ← `ctx.objective.text || ctx.intent || topic`; `objectiveId` ← `ctx.objective.id`.
- Prompt now states the broad topic AND a **SCOPE BINDING** block: "concepts MUST BE the specific parts named in the focus; do NOT substitute a different/broader topic."
- End-of-fn objective overrides now read `ctx.objective.*` (was `config.*`) so shipped data echoes the manifest's objective, not the LLM's invented one.

## Verification

| Check | Result |
|---|---|
| tsc (`./node_modules/.bin/tsc --noEmit`) | 807 errors — **unchanged from baseline 807** (no new) |
| intent = "…lever: fulcrum, load, effort" (after) | concepts = **Fulcrum / Load / Effort** — tracks |
| intent = "…plant cell: nucleus, membrane, chloroplast" (after) | concepts = **Nucleus / Cell Membrane / Chloroplast** — tracks |
| no-regression: topic-only "parts of a simple sentence", no intent | concepts = Subject / Predicate / Punctuation — sensible topic fallback |

**Change:** `gemini-foundation-explorer.ts` — read objective from `ctx.objective`/`ctx.intent`, bind concepts to the focus in the prompt.

## Follow-up

- Grade modality not yet audited: the generator uses `ctx.gradeContext` (band prose)
  and never reads `ctx.grade` (canonical curriculum grade). Run
  `/topic-fidelity foundation-explorer --grade` to check grade precision.
