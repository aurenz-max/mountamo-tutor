# Eval Report: phoneme-explorer — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| isolate | FAIL | 2 (CRITICAL) |
| blend | FAIL | 1 (CRITICAL) |
| segment | PASS | — |
| manipulate | FAIL | 3 (CRITICAL) |

## Issues

### isolate — All choices are placeholder "???"
- **Severity:** CRITICAL
- **What's broken:** Gemini returned empty/null choices. The `validateChoices()` fallback replaces them with `{word:"???", emoji:"❓"}` placeholders. Student sees 4 identical "???" buttons — impossible to answer.
- **Data:** All 5 challenges have `choices: [{word:"???"}...]`
- **Fix in:** GENERATOR — validateChoices fallback masks failures silently; needs retry or meaningful fallback

### isolate — exampleWord/exampleEmoji are defaults for all challenges
- **Severity:** CRITICAL
- **What's broken:** All challenges have `exampleWord: "word"` and `exampleEmoji: "🔤"` — Gemini didn't populate these fields. Student sees generic "word 🔤" which provides no useful phoneme example.
- **Data:** `exampleWord: "word", exampleEmoji: "🔤"` across all 5 challenges
- **Fix in:** GENERATOR — field-level fallback defaults are too generic

### blend — Wrong correct answer for challenge c3
- **Severity:** CRITICAL
- **What's broken:** Phonemes are /p/ /e/ /n/ = "pen", but "ten" is marked correct instead. "pen" is not even among the choices. Student literally cannot select the correct answer.
- **Data:** `phonemeSequence: ["p","e","n"], correct answer: "ten", choices: ["hen","ten","men","den"]`
- **Fix in:** GENERATOR — no post-generation validation that blended phonemes match correct choice

### manipulate — All choices are placeholder "???"
- **Severity:** CRITICAL
- **What's broken:** Same issue as isolate mode. Gemini produced malformed output, validateChoices replaced everything with "???" placeholders. All 4 buttons show identical "???".
- **Data:** All 5 challenges have `choices: [{word:"???"}...]`
- **Fix in:** GENERATOR — same root cause as isolate

### manipulate — Generic operationDescription for all challenges
- **Severity:** CRITICAL
- **What's broken:** All challenges have `operationDescription: "Change a sound in the word"` — no specific instruction about which phoneme to change. Even with populated choices, the challenge would be unsolvable.
- **Data:** `operationDescription: "Change a sound in the word"` across all 5
- **Fix in:** GENERATOR — fallback is too vague

### manipulate — Gemini chain-of-thought leaked into JSON fields
- **Severity:** CRITICAL
- **What's broken:** `targetWord` and `originalWord` fields contain hundreds of characters of Gemini reasoning text instead of single words. Would render as visible garbage in UI.
- **Data:** Fields contain LLM reasoning like "bun. (Implied result after substitution...)"
- **Fix in:** GENERATOR — schema too complex for gemini-flash-lite-latest; model dumps reasoning into string fields
