# Eval Report: story-ribbon — 2026-09-08 (birth, L0)

Kindergarten Language Arts oral-storytelling primitive from the design-studio Story Ribbon concept. Core task `tell_connected_account`: arrange three mixed picture moments, then produce one connected spoken account covering all three in chronological order.

## Generation

The live endpoint was exercised six times with `evalMode=tell_connected_account` (18 challenges / 54 events total). L0 intentionally has no catalog `evalModes[]`, so the endpoint reports `challengeCount: 0` and skips its catalog-mode validator; the payloads were inspected against the component contract directly.

Independent QA found a **CRITICAL G4 defect** in the first three runs: 2/9 challenges contained a visible cue whose pictured meaning differed from the hidden sentence used by the judge (a “Happy puppy reunion” paired with returning a bear; a fallen feather paired with finding a bird). The generator now chooses from a controlled picture-key vocabulary and rejects any event unless the same cue anchor occurs in both its visible label and hidden model sentence. The post-fix three-run sample produced 9/9 complete challenges and 27/27 aligned event triples, with no fallback use.

QA also found a fallback ID collision when an early generation slot failed but a later slot survived. Fallback filling now selects the first unoccupied slot ID; a regression test covers the sparse-slot case.

## G1–G5 sync check after fixes

- **G1 required fields:** 9/9 challenges had id, type, title, character, setting, and exactly three events with unique IDs and orders `[0,1,2]`. PASS.
- **G2 flat reconstruction:** 13 flat fields reconstruct into three populated event objects. PASS.
- **G3:** N/A at L0; one challenge type only.
- **G4 answer derivability:** controlled emoji, visible label, and hidden judged sentence share a literal event anchor; model sentences remain hidden until verdict. 27/27 post-fix events passed. PASS.
- **G5 fallback quality:** 0/9 post-fix challenges used fallback. Four explicit familiar stories are available only after reject + retry; fallback use is logged and disclosed in the activity description. Sparse-slot IDs are unique by construction and test. PASS.

## Answer-leak audit

Picture cards expose only an emoji and a short, time-neutral noun phrase. The chronological answer is not encoded by initial layout because every ribbon starts deliberately out of order. Hidden model sentences render only after an affirm verdict. The prompt asks for the whole story without supplying conjugated answers, and the judge accepts paraphrase, child grammar, and any tense while requiring all three event meanings in order.

## Verification

- `storyRibbonScript.test.ts`, `gemini-story-ribbon.shape.test.ts`, and `judgedScriptContract.test.ts`: **43/43 passed**.
- `npm run typecheck:lumina`: **0 errors**.
- Live post-fix generation: **3/3 endpoint runs passed**, 9 challenges, 27 aligned event cues, 0 fallbacks.
- Browser/microphone interaction remains a human acceptance check; automated QA does not prove card layout, acoustics, or real-child speech recognition.

No unresolved CRITICAL or HIGH generator-contract finding remains in the tested L0 scope.
