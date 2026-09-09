# Eval Report: oral-sentence-studio — 2026-09-09

## Results

| Run | Eval Mode | Status | Challenges | Unique scene signatures | Primary / fallback |
|---|---|---|---:|---:|---:|
| 1 | `describe_scene` | PASS | 3 | 3 | 3 / 0 |
| 2 | `describe_scene` | PASS | 3 | 3 | 3 / 0 |
| 3 | `describe_scene` | PASS | 3 | 3 | 3 / 0 |

## Contract checks

- **G1 required fields:** PASS — 9/9 challenges had non-empty `id`, `type`, all four emoji/label pairs, `sceneTitle`, private `sceneMeaning`, exactly two target words/meanings, and exactly three accepted sentences.
- **G2 flat reconstruction:** PASS — all 9 payloads reconstructed 2-word and 3-sentence tuples without missing entries.
- **G3 mode differentiation:** N/A — this L0 primitive has one core challenge type.
- **G4 answer derivability / semantic anchors:** PASS — all 27 private examples used both target words, were distinct complete sentences, and named an actor/action/object anchor from the visible scene. The component keeps the scene and words visible and does not reveal a model sentence until feedback.
- **G5 fallback quality/source:** PASS after repair — 0/9 post-fix challenges matched the explicit fallback bank. The fallback bank itself remains askable and scene-distinct.
- **Session shape:** PASS — every run contained exactly three challenges and three distinct normalized scene signatures.

## Fixes applied during QA

1. Tightened `challengeAskable` so a setting-only memorized sentence cannot qualify as a scene-description anchor; an accepted sentence must name the pictured actor, action, or object.
2. Added that constraint to the generation prompt and allowed two bounded retries before the explicit fallback bank. The pre-fix sample used fallbacks for 3/9 challenges; the post-fix sample used 0/9.

Focused verification: 2 test files / 9 tests passed; Lumina typecheck passed with 0 errors.

## Harness note

The requested URL without `evalMode` was called three times, but this route returns the discovery index unless both `componentId` and `evalMode` are present. The three data-bearing runs therefore used `&evalMode=describe_scene`. Because the catalog has no L1 `evalModes` entry yet, the generic harness reported `No eval mode in catalog (skipped validation)`; the G1–G5 checks above were performed directly against `fullData` and the component/script contract.
