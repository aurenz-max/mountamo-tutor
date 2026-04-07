# Eval Report: compare-objects

**Date:** 2026-04-06
**Component:** `compare-objects`
**Generator:** `gemini-compare-objects.ts`
**Eval Modes Tested:** identify_attribute, compare_two, order_three, non_standard

## Results Summary

| Eval Mode          | API Status | Challenges | G1  | G2  | G3  | G4  | G5  | Verdict |
|--------------------|-----------|------------|-----|-----|-----|-----|-----|---------|
| identify_attribute | PASS      | 4          | PASS| PASS| PASS| PASS| PASS| PASS    |
| compare_two        | PASS      | 5          | PASS| PASS| PASS| PASS| PASS| PASS    |
| order_three        | PASS      | 4          | PASS| PASS| PASS| PASS| PASS| PASS    |
| non_standard       | PASS      | 4          | PASS| PASS| PASS| PASS| PASS| PASS    |

**Overall Verdict: ALL PASS**

## Rule Details

### G1 -- Required Fields

All eval modes produced challenges with every required field populated:

- **identify_attribute**: objects[] (2 items, each with name/visualSize/actualValue), attributeOptions[] (3 choices), correctAttribute, attribute, instruction, hint
- **compare_two**: objects[] (2 items), correctAnswer (matches an object name), comparisonWord, attribute, instruction, hint
- **order_three**: objects[] (3 items), correctAnswer (comma-separated ordered names), comparisonWord, attribute, instruction, hint
- **non_standard**: objects[0] (1 item), unitName, unitCount (positive integer), attribute="length", instruction, hint

### G2 -- Flat-Field Reconstruction

Generator uses flat Gemini schema (obj0Name, obj1Name, attrOption0, etc.) and reconstructs into proper arrays. All challenges across all modes had correctly populated arrays. 0% empty arrays.

### G3 -- Eval Mode Semantic Differentiation

Each eval mode produces only its own challenge type:
- identify_attribute -> typesFound: ["identify_attribute"]
- compare_two -> typesFound: ["compare_two"]
- order_three -> typesFound: ["order_three"]
- non_standard -> typesFound: ["non_standard"]

### G4 -- Answer Derivability

- **identify_attribute**: correctAttribute verified in attributeOptions for all 4 challenges
- **compare_two**: correctAnswer matches an object name in all 5 challenges; generator also validates actualValue consistency with comparisonWord direction (rejects if wrong)
- **order_three**: correctAnswer is deterministically derived by sorting objects by actualValue based on comparisonWord direction (computed in generator, not from Gemini)
- **non_standard**: unitCount is a positive integer (range-validated 1-20) in all 4 challenges

### G5 -- Fallback Quality

Generator uses reject-or-accept pattern (no silent defaults via `??` on data fields). Fallback challenges only fire when ALL Gemini challenges are rejected.

Fallback challenges reviewed:
- **identify_attribute fallback**: correctAttribute="length" in attributeOptions=["length","weight","capacity"]. VALID
- **compare_two fallback**: correctAnswer="jump rope" matches object name, actualValue 200 > 80 for comparisonWord="longer". VALID
- **order_three fallback**: correctAnswer="sunflower, tulip, daisy" matches descending sort (150, 60, 30) for comparisonWord="taller". VALID
- **non_standard fallback**: unitCount=5 (positive integer), unitName="paper clip", attribute="length". VALID

Only inline `??` usages are for eval-mode plumbing (not data fields):
- `evalConstraint?.allowedTypes ?? [all types]` -- runs all generators when unconstrained
- `allowedTypes[0] ?? 'compare_two'` -- selects fallback type

## Architecture Notes

The generator is well-structured with strong validation:
1. **Per-type schemas** prevent Gemini schema complexity issues (each schema is focused)
2. **Reconstruction functions** validate every field and reject invalid challenges (no silent defaults)
3. **Answer derivation** for order_three is computed from actualValues, not trusted from Gemini
4. **Logical consistency** checks for compare_two ensure correctAnswer aligns with comparisonWord direction and actualValues
5. **Sequential ID assignment** prevents duplicate IDs

No fixes needed.
