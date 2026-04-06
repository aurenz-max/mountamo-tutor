# Eval Report: push-pull-arena

**Date:** 2026-04-05
**Component:** `push-pull-arena`
**Generator:** `gemini-push-pull-arena.ts`
**Eval modes tested:** observe, predict, compare, design

---

## QA Results

| Eval Mode | API Status | Challenges | G1 | G2 | G3 | G4 | G5 | Verdict |
|-----------|-----------|------------|----|----|----|----|----|----|
| observe   | PASS (4.5s) | 4 | PASS | PASS (post-fix) | PASS | PASS | PASS | PASS |
| predict   | PASS (4.3s) | 4 | PASS | PASS (post-fix) | PASS | PASS | PASS | PASS |
| compare   | PASS (4.2s) | 4 | PASS | PASS (post-fix) | PASS | PASS | PASS | PASS |
| design    | PASS (4.3s) | 4 | PASS | PASS (post-fix) | PASS | PASS | PASS | PASS |

---

## Issue Found & Fixed

### G2 CRITICAL: Object name/emoji mismatch between instruction text and rendered object

**Problem:** The Gemini schema did not include `objectName` or `object2Name` fields. Gemini would write instruction text referencing objects by name (e.g., "Push the toy car"), but the post-processor resolved objects from the OBJECT_LIBRARY solely by weight. Since multiple objects share the same weight (e.g., Soccer Ball=2kg, Toy Car=2kg), the rendered object could differ from what the instruction described.

**Examples (pre-fix):**
- observe c1: instruction says "toy car" but objectName resolved to "Soccer Ball" (both weight 2)
- compare c2: instruction says "watermelon" but objectName resolved to "Backpack"
- compare c3: instruction says "toy car" but objectName resolved to "Book"

**Fix applied to `gemini-push-pull-arena.ts`:**
1. Added `objectName` and `object2Name` to the Gemini schema with enumerated valid names
2. Added `objectName` to the schema's required fields
3. Updated prompt to list all available objects with exact names and weights, instructing Gemini to use consistent names
4. Updated `pickObject()` to accept an optional `name` parameter and prefer name-based lookup over weight-based
5. Updated post-processor calls to pass Gemini's `objectName` / `object2Name` to `pickObject()`

**Verification:** All four eval modes re-tested after fix. Object names in instruction text now consistently match the objectName/objectEmoji rendered by the component.

---

## G1 - Required Fields (all modes PASS)

All challenges across all modes include every required field per the contract:
- Common: id, type, instruction, surface, objectName, objectWeight, objectEmoji, correctAnswer, distractor0, distractor1, hint
- observe/predict: pushStrength (1-10), pushDirection ('push'|'pull')
- compare: object2Name, object2Weight, object2Emoji, pushStrength, pushDirection
- design: goalDescription, pushStrength, pushDirection

## G3 - Eval Mode Semantic Differentiation (PASS)

- observe: All challenges type="observe" -- hands-on exploration questions
- predict: All challenges type="predict" -- prediction-before-simulation questions
- compare: All challenges type="compare" -- side-by-side comparison questions
- design: All challenges type="design" -- goal-directed force design questions

## G4 - Answer Derivability (PASS)

Correct answers relate to physics concepts:
- observe: Answers about movement direction, speed, and whether objects move
- predict: Answers require reasoning about weight + surface + force strength
- compare: Answers require comparing weight or surface friction effects
- design: Answers require selecting appropriate force magnitude for goals

## G5 - Fallback Quality Audit (PASS)

Fallback expressions reviewed:
- `c.objectWeight || 3` -- safe default for missing weight
- `c.hint || 'Think about...'` -- safe generic hint
- `c.pushStrength || 5` -- reasonable mid-range default
- `c.pushDirection === 'pull' ? 'pull' : 'push'` -- defaults to push, safe
- `c.goalDescription || 'Move the object across the arena'` -- reasonable default
- compare fallback uses `pickContrastingPair()` for missing object2 -- produces pedagogically sound light vs heavy pairing
- Full fallback function `buildFallback()` produces valid, well-structured challenges for each mode
