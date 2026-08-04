# Eval Report: number-sequencer — 2026-08-04

Reader-fit 14h · `/eval-fix` + `/topic-fidelity` · Grade 1.

## Results

| Eval mode | Before | After | Notes |
|---|---|---|---|
| `count_from` | PASS | PASS | Five `count-from` cards; K/G1/no-grade controls pass |
| `before_after` | PASS | PASS | Five `before-after` cards |
| `order_cards` | PASS | PASS | Five `order-cards` cards |
| `fill_missing` | PASS | PASS | Five `fill-missing` cards |
| `decade_fill` | false PASS | PASS | Before: 101–120 answers with `rangeMax:100` were unrenderable; after: local exact windows through 120 |
| `count_from|before_after` | FAIL | PASS | Before leaked all five types; after emits only the requested union |

## Resolved findings

### RF14H-1 — curated blend ignored · HIGH · SP-9

The generator used the legacy exact-key resolver, so `count_from|before_after` was
unknown and left the schema open. It now uses the shared blend-aware resolver,
enum-constrains the schema to the union, and post-filters disallowed types.

### RF14H-2 — Grade-1 120 scope was structurally unreachable · CRITICAL

The LLM produced 101–120 values but post-processing clamped `rangeMax` to 100.
The component therefore omitted correct-answer cells while eval-test false-passed.
The contract now permits scope-conditioned Grade-1 work through 120, resolves a
structured numeric window with one temperature-0 Flash Lite call when no explicit
range exists, rejects out-of-window cards, derives exact render/input windows, and
tops filtered sessions back up to the three-card mastery floor.

## G1–G5 synchronization

| Rule | Result |
|---|---|
| G1 required fields | PASS — all five modes produced five complete cards |
| G2 flat reconstruction | N/A — no flat indexed fields |
| G3 differentiation | PASS — single pins exact; curated blend contains only `count-from`/`before-after` |
| G4 answer derivability | PASS — every answer lies in its exact derived render window; oracle suite 19/19 within focused 24/24 |
| G5 fallback quality | PASS — rejected narrow-scope cards are logged and deterministically topped up in-range; live 1-card case recovered to 3 |

## Verification

- Real Gemini: all five modes PASS; exact 14h blend and exact `101, 102, _, 104` replay PASS.
- Topic/intent probes: 120 ×3, 20 ×3, generic ×3, intent-only 120 ×2, intent-only 20 ×2 — all track; all answers reachable.
- Grade controls: K → band K/max 10; Grade 1 → band 1/max 120; no-grade elementary fallback → band 1/max 90.
- Focused tests: 24/24.
- Full Vitest: 1406/1406.
- `typecheck:lumina`: 0 errors.
- Full TypeScript: 803 baseline before and after; 0 Lumina errors.
