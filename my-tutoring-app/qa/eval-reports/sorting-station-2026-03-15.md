# Eval Report: sorting-station — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| sort_one | FAIL | 2 |
| sort_attribute | PASS | — |
| count_compare | PASS | — |
| odd_one_out | PASS | — |
| two_attributes | PASS | — |
| tally_record | FAIL | 1 |

## Issues

### sort_one — Impossible challenge: only 1 category for 4 objects
- **Severity:** CRITICAL
- **What's broken:** Challenge `c4` has type `sort-by-one` but only 1 category (`Trucks Group`). The race car object (`out_2`, type=sports) has no valid bin. The check logic requires ALL objects placed correctly, making this challenge impossible to complete.
- **Data:** `categories.length = 1, objects.length = 4, unmatchable object = out_2 (type: sports)`
- **Fix in:** GENERATOR

### sort_one — Instruction/type mismatch on challenges c3 and c4
- **Severity:** HIGH
- **What's broken:** Generator produces challenges conceptually belonging to other modes (c3 asks "Which group has *more*?" = count-and-compare; c4 asks "odd one out") but tags them as `sort-by-one`. The component has no comparison or odd-one-out mechanic for this type, so the instruction misleads the student about what to do.
- **Data:** `c3.instruction contains "Which group has *more*", c4.instruction contains "ODD ONE OUT", both type = sort-by-one`
- **Fix in:** GENERATOR

### tally_record — Orphaned object due to label/rule mismatch
- **Severity:** HIGH
- **What's broken:** Challenge `c2` category "Insects & Amphibians" has rule `{type: insect}`, which excludes the frog (`obj8`, type=amphibian). The frog doesn't appear in any pre-sorted bin and vanishes from the display. Student can answer correctly from visible items, but having a disappearing object is confusing.
- **Data:** `category.label = "Insects & Amphibians", category.rule = {type: insect}, orphaned = obj8 (Green Frog, type: amphibian)`
- **Fix in:** GENERATOR
