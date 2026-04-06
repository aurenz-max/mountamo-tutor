# Eval Report: race-track-lab

**Date:** 2026-04-05
**Component:** `RaceTrackLab.tsx`
**Generator:** `gemini-race-track-lab.ts`
**Eval Modes:** observe, predict, measure, calculate, graph

## QA Results

| Eval Mode | API Status | Challenges | G1 | G2 | G3 | G4 | G5 | Verdict |
|-----------|-----------|------------|----|----|----|----|----|---------|
| observe   | 200 (3.6s) | 4         | PASS | PASS | PASS | PASS | PASS | PASS |
| predict   | 200 (3.6s) | 4         | PASS | PASS | PASS | PASS | PASS | PASS |
| measure   | 200 (3.0s) | 4         | PASS | PASS | PASS | PASS | PASS | PASS |
| calculate | 200 (4.1s) | 4         | PASS | PASS | PASS | PASS | PASS | PASS |
| graph     | 200 (3.4s) | 4         | PASS | PASS | PASS | PASS | PASS | PASS |

## G1 -- Required Fields

All challenges across all 5 eval modes contain every required field:
- `id`, `type`, `instruction`, `racers` (2-4 entries each with name/emoji/speed/color), `trackLength`, `question`, `correctAnswer`, `distractor0`, `distractor1`, `hint`
- `timeLimit` present on all measure, calculate, and graph challenges (required per contract)
- Several challenges include optional `distractor2`

## G2 -- Flat-Field Reconstruction

Racers arrays are properly constructed objects (not flat fields). The generator uses a deterministic hybrid approach: racer templates and speeds are assigned locally, then merged with Gemini's text output. This guarantees correct racer structure regardless of LLM output quality.

## G3 -- Eval Mode Semantic Differentiation

Each eval mode maps to a unique `allowedChallengeTypes` value:
- observe: `["observe"]` -- watch race, identify winner
- predict: `["predict"]` -- predict winner from speed labels before race
- measure: `["measure"]` -- compare distances in fixed time
- calculate: `["calculate"]` -- compute speed = distance / time
- graph: `["graph"]` -- interpret position-time graph slopes

No overlap between modes. Content and question framing differ appropriately.

## G4 -- Answer Derivability

All 20 challenges (4 per mode) verified:

**observe (4/4):** Correct answer always names the racer with highest speed value.
**predict (4/4):** Correct answer always names the racer with highest speed value.
**measure (4/4):** Correct answer names racer who travels farthest (highest speed * timeLimit).
**calculate (4/4):** Numeric answers match speed = distance / time exactly (e.g., 9/3=3, 8/2=4).
**graph (4/4):** Correct answer names racer with steepest slope (highest speed).

Post-validation in the generator (`validateChallenge`) catches Gemini errors before they reach the component.

## G5 -- Fallback Quality

The `buildFallback()` function (lines 598-736) produces deterministic challenges per mode:

| Mode      | Fallback Challenges | Math Verified |
|-----------|-------------------|---------------|
| observe   | 2 (Rabbit vs Turtle; Cheetah vs Bicycle vs Snail) | Correct |
| predict   | 1 (Rabbit(4) vs Turtle(2)) | Correct |
| measure   | 1 (Car(4) vs Skateboard(2), t=3s, d=12 vs 6) | Correct |
| calculate | 1 (Horse(5) vs Penguin(3), 15/3=5) | Correct |
| graph     | 1 (Rocket(6) vs Train(3) vs Bicycle(4), steepest=Rocket) | Correct |

Edge case: if mode produces no challenges, a default observe challenge is appended. Verified.

## Architecture Notes

The generator uses a strong hybrid pattern:
1. **Deterministic:** Racer selection, speed assignment, and timeLimit calculation are done locally (no LLM involvement)
2. **Generative:** Gemini produces only text fields (instruction, question, answers, hints)
3. **Post-validation:** `validateChallenge()` rejects any challenge where the LLM answer contradicts the physics

This design makes racer array corruption (G2 failures) impossible and reduces answer derivability failures (G4) to near-zero.

## Verdict

**ALL PASS.** No fixes required. Generator and component are sync-correct across all 5 eval modes.
