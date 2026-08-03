# Reader Fit: knowledge-check @ EMERGING (Grade 1) — 2026-08-02 (14f, --fix)

**Outcome: READY @ EMERGING.** The two census failures flipped: visual-symbol questions now
render the symbols they assess, and invention/change questions keep Grade-1 reading load while
using before/after evidence. K/PRE behavior is unchanged.

**Handoff:** `qa/HANDOFF-reader-fit-14f-knowledge-check-emerging-2026-08-01.md`  
**Contract:** `src/components/lumina/docs/contracts/knowledge-check.md`  
**Contract check:** `qa/primitive-contracts/knowledge-check-check-2026-08-02.md` — **COMPATIBLE**

## What changed

- The registry passes canonical `ctx.grade` as `preciseGrade`; Grade 1 no longer shares only the
  broad “elementary (grades 1–5)” realization rule.
- Both orchestrator and per-problem prompts give Grade 1 precedence over Bloom realization:
  one concept/reasoning move, one short clause, MCQ/TF stems ≤16 words, options ≤5 words.
- Response schemas bound the non-MCQ shapes too: one fill blank with a 3–4 word bank, two
  categorization buckets with 4–6 items, exactly three matching pairs, and 3–4 sequence steps.
- The plan supports two existing, bounded visual renderers: `object-collection` (three visible
  groups) and `comparison-panel` (two labeled scenes). Flat required response fields are rebuilt
  into the existing `VisualPrimitive` contract; absent/duplicate evidence rejects the item.
- A code-owned Grade-1 task gate covers maps/symbols/coins/shapes/diagrams and invention/change
  evidence. A text-column matching plan in that visual class becomes one visual MCQ; nonvisual
  siblings retain their planned types.
- K explicitly clears this new visual plan and keeps its existing emoji-option MCQ/read-aloud
  surface and MCQ/TF type floor. No component, voice, `::pN`, catalog, or attribution path changed.

## Real-model evidence

| Probe | Result |
|---|---|
| `/eval-test` Grade 1 `analyze`, invention/change | **PASS** — one 13-word MCQ stem, four short options, visible candle→lamp `comparison-panel`; catalog validation 1/1 |
| `/eval-test` Grade 1 map `mixed` | **PASS semantic probe** — visible tree/house/book `object-collection`; the endpoint correctly notes `mixed` has no single catalog row, so catalog type validation is N/A |
| `/eval-test` K `recall` regression | **PASS** — MCQ type floor, exactly three emoji choices, no Grade-1 visual panel |
| `/topic-trace` map-symbol census replay | **FLIPPED** — 10 KC items across routed + final checks; every picture/key-dependent item rendered symbols. The six-item final stayed mixed (MCQ/TF/fill-in), with nonvisual “purpose of a legend” items remaining text-based. |
| `/topic-trace` invention-listening census replay | **FLIPPED** — four-item final check used two concrete comparison panels plus one bounded fill-in and one short TF; no long text-only analysis/matching task |

The replay reports are `qa/topic-traces/g1-map-legends-14f-replay-2026-08-02.md` and
`qa/topic-traces/g1-invention-listening-14f-replay-2026-08-02.md`.

## Verification

| Gate | Result |
|---|---|
| focused reader-fit tests | **9/9** — precise grade, both visual shapes, missing-evidence rejection, visual matching guard, nonvisual sibling, exact G1 matching schema, K regression |
| contract-facing suites | **230/230** — reader-fit generator/component, manifest attribution, knowledge-check oracles |
| full Vitest | **1085/1085** (101 files) |
| `npm run typecheck:lumina` | **0 errors** |
| `/primitive-contract --check` | **COMPATIBLE** — R1–R9 preserved; G1/G2 built |

## Residuals

- **HUMAN-CHECKS #59:** pixel/feel of the three-symbol and before/after panels at a Grade-1
  viewport, plus the K visual regression glance.
- Contract G3 (`true_false` PRE surface parity) remains open and explicitly outside 14f.
- No image generation was added: the fix deliberately reuses deterministic, schema-backed
  visual primitives rather than URLs/base64 or prompt-only picture promises.
