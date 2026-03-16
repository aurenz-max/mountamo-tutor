# Eval Report: sound-swap — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| addition | FAIL | 1 CRITICAL, 2 HIGH |
| deletion | FAIL | 1 CRITICAL |
| substitution | PASS | — |

## Issues

### addition — Vowel changes during phoneme "addition" (c6)
- **Severity:** CRITICAL
- **What's broken:** Adding /s/ to beginning of "on" (/ɑn/) should produce "son" (/sɑn/), not "sun" (/sʌn/). The vowel changes from /ɑ/ to /ʌ/, which is substitution not addition.
- **Data:** `originalWord: "on", addPhoneme: "/s/", resultWord: "sun"`
- **Fix in:** GENERATOR

### addition — /ɹ/ vs /r/ phoneme notation inconsistency (c8)
- **Severity:** HIGH
- **What's broken:** Generator uses IPA `/ɹ/` but component's DISTRACTOR_PHONEMES uses `/r/`. Both could appear as options, confusing the student.
- **Data:** `addPhoneme: "/ɹ/"` vs component constant `/r/`
- **Fix in:** GENERATOR — use `/r/` consistently

### addition — Non-word originals "un" and "ig" (c8, c9)
- **Severity:** HIGH
- **What's broken:** "un" and "ig" are not real English words. Students add a phoneme to produce a real word, but starting with a non-word is pedagogically confusing for K students.
- **Data:** `originalWord: "un"`, `originalWord: "ig"`
- **Fix in:** GENERATOR

### deletion — 5 of 9 result words are not real English words
- **Severity:** CRITICAL
- **What's broken:** Deleting initial phoneme from sun→"un", big→"ig", run→"un", pig→"ig", map→"ap". Catalog constraint says "All result words must be real words." Students identify nonsense syllables as the "answer."
- **Data:** `resultWord: "un", "ig", "un", "ig", "ap"` (5 of 9 challenges)
- **Fix in:** GENERATOR — select words where onset deletion produces real words (e.g., seat→eat, ball→all)
