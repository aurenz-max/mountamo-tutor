# Eval Report: formula-lab — 2026-08-23

## Final verdict

**PASS** — all three generated sessions and all 15 `predict-and-test` challenges satisfy G1–G5. No CRITICAL or HIGH generator/component contract failure was confirmed, so no source fix was made.

## Harness note

The required bare probe

`curl.exe -s "http://localhost:3000/api/lumina/eval-test?componentId=formula-lab"`

was run three times. Each call returned HTTP 200 and the 218,233-byte primitive catalog, because the route enters single-test mode only when both `componentId` and `evalMode` are present. Formula Lab is an L0-at-birth primitive with no catalog `evalModes`, so generated-data probes used `evalMode=predict-and-test`, its only challenge type. The generated responses consequently report `catalogMeta: null`, `challengeCount: 0`, and `No eval mode in catalog (skipped validation)` even though each `fullData.challenges` array contains exactly five challenges. The independent G1–G5 audit below does not rely on that skipped harness validation.

## Generated runs

| Run | Topic / grade | Response summary | Formula | Challenge audit | Status |
|---|---|---|---|---|---|
| 1 | Newton's second law / grade 8 | API `pass`; 1,605 ms; 1,903 bytes; longest string 136 chars | `a = F / m`; 2 variables; motion scene | 5/5 structurally valid; 5/5 outputs and directions recomputed correctly | PASS |
| 2 | Area of a triangle / grade 7 | API `pass`; 1,553 ms; 1,886 bytes; longest string 170 chars | `A = 0.5 * b * h`; 2 variables; geometry scene | 5/5 structurally valid; 5/5 outputs and directions recomputed correctly | PASS |
| 3 | Electrical power / grade 9 | API `pass`; 1,960 ms; 1,953 bytes; longest string 185 chars | `P = I^2 * R`; 2 variables; relationship scene | 5/5 structurally valid; 5/5 outputs and directions recomputed correctly | PASS |

## G1–G5 verdict

| Gate | Verdict | Evidence |
|---|---|---|
| G1 — required fields | PASS | Every session has nonempty `title`, `description`, `context`, `formulaLatex`, `expression`, `outputSymbol`, `outputName`, `outputUnit`, valid `sceneKind`, `challengeType: predict-and-test`, `gradeBand`, exactly 2 valid variables, and exactly 5 challenges. Every challenge has a unique ID, the required type, a matching input symbol, complete arrays, finite expected outputs, and a valid direction. |
| G2 — reconstruction arrays | PASS | The flattened Gemini wrapper reconstructed to 2/2 variables on every run. All 15 locally built `baselineValues` and `targetValues` arrays contain exactly 2 entries. No reconstructed array was empty or missing. |
| G3 — eval-mode differentiation | N/A | Formula Lab is at L0 birth and intentionally has one core `predict-and-test` task, with no catalog eval-mode ladder yet. |
| G4 — answer derivability | PASS | Independent arithmetic reproduced all 30 expected outputs within floating-point tolerance and all 15 directions. Exactly one array value changes per challenge, it always belongs to `changedVariableSymbol`, and all values remain inside the declared slider range. |
| G5 — fallback quality | PASS | Invalid/missing Gemini wrapper fields reject the wrapper as a unit. LLM failure, rejected wrapper, or an unfillable local pool routes to the complete `F = m * a` wrapper. The fallback then uses the same local challenge builder and validator; it throws rather than returning incomplete data if its pool cannot validate. Candidate-selection fallbacks choose only already evaluated, in-range candidates. No fallback fired in the three sampled responses. |

## G4 recomputation detail

| Run | Recomputed baseline → target outputs and direction |
|---|---|
| 1 | `11.111111 → 0.111111` decrease; `0.404762 → 17` increase; `1.961538 → 3.230769` increase; `3.230769 → 5.25` increase; `1.9375 → 0.0625` decrease |
| 2 | `108.75 → 75` decrease; `25.5 → 93.5` increase; `48.75 → 130` increase; `79.75 → 36.25` decrease; `58 → 40` decrease |
| 3 | `3100 → 1519` decrease; `89.59 → 202.3` increase; `2601 → 961` decrease; `289 → 202.3` decrease; `4116 → 807.24` decrease |

## Answer-leak audit

**PASS.** Before prediction lock, the living scene receives `revealed={false}` and labels the output hidden, while the numeric output stat renders `?`. Before target reach, `PredictionTrack` receives no `actualDirection`; the actual amber marker is provided only when `challengeDone` becomes true. The expected target output and `correctDirection` appear only in feedback after `completeChallenge` runs at the target. The visible target is the input value the student must manipulate toward, not the answer-bearing target output.

## Verification

- Required API probes: 3/3 HTTP 200 (bare URL returned catalog as described above).
- Generated-data probes: 3/3 API `status: pass` using `evalMode=predict-and-test`.
- `npm.cmd test -- src/components/lumina/primitives/visual-primitives/math/__tests__/formulaLabMath.test.ts`: 1 file passed, 4 tests passed.
- `npm.cmd run typecheck:lumina`: passed with 0 Lumina errors.

