# Eval Report: story-bridge — L1 comparison modes (2026-09-09)

Story Bridge now retains one pair of two illustrated five-sentence read-alouds while assessing seven distinct Kindergarten comparison tasks. This is implementation and generator evidence, not a curriculum-coverage re-review.

## Modes and measurement priors

| Mode | Student response | β | a | Runtime pinned generation |
|---|---|---:|---:|---|
| `match_character` | tap one far-story character | 2.0 | 1.2 | pass, 3 items, no fallback |
| `match_setting` | pictured same/different tap | 2.0 | 1.0 | pass, 1 item, no fallback |
| `venn_place` | tap first/both/second Venn region | 2.5 | 1.8 | pass, 3 items, no fallback |
| `say_alike` | spoken defensible similarity | 3.0 | 1.6 | pass, 3 items, no fallback |
| `sequence_two` | tap paired beginning/middle/ending event | 3.0 | 1.4 | pass, 3 items; first draw fell back, three post-fix draws did not |
| `say_different` | spoken defensible contrast | 3.5 | 1.6 | pass, 3 items, no fallback |
| `main_idea_compare` | spoken main-idea comparison | 4.0 | 1.6 | pass, 1 item, no fallback |

Catalog β values match `backend/app/services/calibration/problem_type_registry.py`; discrimination values match `backend/app/config/discrimination_priors.py`.

## Contract evidence

- One Gemini flat-schema pair call authors two stories plus setting, main-idea, shared-character, unique-character, and event-picture evidence. Code assembles and schedules the challenges.
- `resolveEvalModes` handles explicit, resolved blend, and mixed paths. The root `challengeType` schema enum is constrained before generation. The explicit mixed runtime draw returned all seven types once, on one story pair, with no fallback.
- Both story references stay visible. Story text remains audio-only before a verdict. Every affirmed task reveals the relevant source excerpt from each story side by side.
- Spoken tasks use the benched `concept_statement` response class. Their judge contract accepts any age-appropriate defensible relationship grounded in both texts and explicitly refuses one-story-only responses as incomplete.
- Gesture tasks use code-owned answers. Character and event choices reshuffle; event cards combine character and event pictures so repeated action icons cannot create ambiguous cards.

## Automated verification

- `storyBridgeScript.test.ts`: 19/19.
- Catalog affordance checks plus Story Bridge tests: 29/29.
- All DI-script suites: 39 files / 1656 tests passed.
- `npm run typecheck:lumina`: 0 errors.
- Intent-consumption audit: 181/181 context-native generators passed.
- Project-wide `tsc --noEmit` remains red on the repository's existing non-Lumina baseline; the Lumina gate reports no errors.

## Still owed

- Human tablet/browser + microphone sitting for each new interaction surface: choice shuffle, event-card tap, Venn regions, spoken comparisons, evidence reveal, and hear-again.
- An unpinned `/topic-trace` draw to observe intent resolution in the full curator pipeline.
- Curriculum-coverage review before changing the seven requirement verdicts.
