# Eval Report: poetry-lab — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| analysis | FAIL | 1 (CRITICAL) |
| composition | FAIL | 1 CRITICAL, 1 HIGH |

## Issues

### analysis — Figurative language indices are wrong
- **Severity:** CRITICAL
- **What's broken:** `startIndex`/`endIndex` values in `figurativeInstances` don't match the actual `text` within the poem. E.g., index 69-83 yields `"ere logic and "` instead of `"The tiny ones march"`. Clickable highlight regions land on wrong text, making the figurative language identification phase unsolvable.
- **Data:** All 3 figurativeInstances have wrong startIndex/endIndex
- **Fix in:** GENERATOR — post-process with `poem.indexOf(inst.text)` to recompute indices, or switch to line-based identification

### composition — Missing templateConstraints / wrong line count
- **Severity:** CRITICAL
- **What's broken:** Generator returns no `templateConstraints`, so `lineCount` defaults to 3 (component line 105). But the prompt instructs students to write a four-line poem. Student gets 3 input fields for a 4-line assignment — impossible to complete.
- **Data:** `templateConstraints: undefined`, `compositionPrompt` says "four-line poem"
- **Fix in:** GENERATOR — schema must require templateConstraints with lineCount for composition mode

### composition — No syllable/rhyme validation without constraints
- **Severity:** HIGH
- **What's broken:** Without `syllablesPerLine` and `rhymePattern`, validation is skipped. Score becomes binary (85 or 30) with no meaningful assessment of composition quality described in the prompt.
- **Data:** Missing `syllablesPerLine`, `rhymePattern` in templateConstraints
- **Fix in:** GENERATOR — include syllablesPerLine and rhymePattern in templateConstraints
