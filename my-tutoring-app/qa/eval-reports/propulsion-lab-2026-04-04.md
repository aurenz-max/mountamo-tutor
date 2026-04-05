# Eval Report: propulsion-lab — 2026-04-04

## Results
| Eval Mode | API Status | Challenges | Duration | Verdict |
|-----------|-----------|------------|----------|---------|
| predict | pass | 3 | 6460ms | PASS |
| observe | pass | 3 | 6042ms | PASS |
| experiment | pass | 3 | 7312ms | PASS |

## G1-G5 Sync Check

| Rule | Status | Notes |
|------|--------|-------|
| G1 — Required fields | PASS | All challenges have id, type, instruction, options[], correctOptionId, hint |
| G2 — Flat-field reconstruction | PASS | Options arrays properly reconstructed from option0-3 flat fields |
| G3 — Eval mode differentiation | PASS | Each mode produces only its target challenge type |
| G4 — Answer derivability | PASS | correctOptionId always present in options array |
| G5 — Fallback audit | FIXED | Silent fallbacks on correctOptionId and type replaced with reject-and-log validation |

## Fixes Applied
- **Generator validation hardened**: Replaced `correctOptionId || 'a'` and `type || 'predict'` silent fallbacks with strict validation that rejects challenges missing critical fields
- **Backend registry**: Added propulsion-lab eval mode betas to problem_type_registry.py (predict: -1.0, observe: 0.0, experiment: 1.0)

## Beta Values (catalog ↔ backend match)
| Eval Mode | Catalog Beta | Backend Beta | Match |
|-----------|-------------|-------------|-------|
| predict | -1.0 | -1.0 | ✓ |
| observe | 0.0 | 0.0 | ✓ |
| experiment | 1.0 | 1.0 | ✓ |
