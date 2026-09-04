# Eval Report: di-dice-roll — 2026-09-02

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| `count_pips` | PASS | — |

## Evidence

- The real `GET /api/lumina/eval-test` route passed on three fresh runs at `count_pips` after an unrelated transient bundle error cleared. The runtime registry selected `generateDiDiceRoll`: each response had the registered root contract and code-owned `didr-*` challenge IDs.
- Every run returned five challenges. Values were `[4,3,6,2,1]`, `[1,6,2,4,3]`, and `[1,6,2,5,3]`: each run was unique within-session and included both low faces (1–3) and high faces (4–6).
- `catalogMeta: null` and the route's `challengeCount: 0` mean catalog validation was intentionally skipped because this L0 primitive has no `evalModes` yet. `fullData.challenges` contained five valid instances on every run.
- Focused Vitest: 2 files passed, 11 tests passed (`gemini-di-dice-roll.test.ts` and `diDiceRollScript.test.ts`). No live microphone or Tutor semantic drive was attempted.

## Generator ↔ Component Gates

| Gate | Verdict | Evidence |
|------|---------|----------|
| G1 required fields | PASS | Every generated challenge had non-empty `id`, `challengeType`, `sides`, `value`, `spokenAnswer`, `asrAliases`, `action`, `answerKind`, and `responseClass`; values matched the fields consumed by `DiDiceRoll`, its script pack, and the judged runner. |
| G2 flat reconstruction | N/A | No flattened aliases or reconstructed arrays are used. |
| G3 semantic/derived-field audit | N/A | This is a single-mode L0 primitive, so there is no cross-mode differentiation to compare; it also has no denominator/total field family. |
| G4 answer derivability | PASS | For all 15 live items, the visible six-sided pip face was `value`, `spokenAnswer` was the matching word, and `asrAliases` contained both that word and `String(value)`. The focused generator test also covers all faces one through six. |
| G5 fallbacks | PASS | Invalid controlled values fall back as a unit to the valid unique local pool; leaking Gemini chrome falls back as a pair to `Dice Time` / `Roll the die, look at the dots, and answer out loud!`; Gemini errors retain those initialized defaults. All challenge answers remain code-derived from finalized values. |

## Answer-Safety and Contract Notes

- Generated title/description chrome contained no die-face digit or number word in any live run. The generator's leak guard rejects digits and the answer words one through six.
- Before affirmation, the component renders only the pip stimulus and answer-free prompts/status. Its button and die ARIA labels deliberately omit the exact value. The numeral and number word appear visually only in the affirmed reward state.
- The component contract is aligned: root `challengeType` is `count_pips`; each challenge is a six-sided voice item using `number_word_to_20`; animation lands on the already-finalized `value` and does not generate or score a result.
