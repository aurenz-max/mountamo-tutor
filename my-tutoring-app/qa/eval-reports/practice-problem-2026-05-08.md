# Eval Report: practice-problem — 2026-05-08

## Results
| Eval Mode      | Status | Issues |
|----------------|--------|--------|
| derive_easy    | PASS   | —      |
| derive_medium  | PASS   | —      |
| derive_hard    | PASS   | —      |

## Per-Mode Detail

| Eval Mode      | API Status | Steps | G1 | G3 | G4 | G5 | Verdict |
|----------------|------------|-------|----|----|----|----|---------|
| derive_easy    | pass       | 2     | OK | OK | OK | OK | PASS    |
| derive_medium  | pass       | 3     | OK | OK | OK | OK | PASS    |
| derive_hard    | pass       | 4     | OK | OK | OK | OK | PASS    |

## G1-G5 Sync Check: ALL PASS

- **G1 (Required fields):** All three responses have non-empty `title`, `subject`, `problem.statement`, `solutionStrategy`. Each step has `id`, non-empty `title`, populated `content` (algebra or diagram type), and all four annotation layers (`steps`, `strategy`, `misconceptions`, `connections`) as non-empty strings. `difficulty` and `evalMode` match the requested eval mode in all three. `problem.equations` is omitted in all three responses, but that field is `equations?: string[]` (optional) per the `ProblemStatement` type definition — the problems supply structured `inset` blocks (equation-setup or number-line) instead, which the component renders via `InsetRenderer`. Acceptable.
- **G2:** N/A per task instructions.
- **G3 (Semantic differentiation):** Step counts land in the contract-specified bands (easy=2, medium=3, hard=4 — within 2-3, 3-5, 4-6 respectively). Hard adds explicit isolate + verify steps that easy collapses into one transition. See "Notes" for a caveat on problem-difficulty differentiation.
- **G4 (Answer derivability):** All canonical solutions chain logically. Easy: $3+(5\times s)=28 \to 5s+3=28 \to 5s=25 \to s=5$. Medium: $12-7=5$, verified $5+7=12$. Hard: $2p+5=13 \to 2p=8 \to p=4$, verified $2(4)+5=13$. KaTeX `from`/`to` strings are well-formed throughout.
- **G5 (Fallback quality):** Generator throws on every missing required field (title, subject, problem statement, solutionStrategy, steps < 2, missing step title/content/annotations, incomplete annotation layers). The only `??`/`||` fallback is on the *input-side* eval-mode default (`'derive_medium'` if requested mode is invalid), which is appropriate. No silent default substitution on output fields. Reference design preserved.

## Timing
- derive_easy:   44.4s
- derive_medium: 36.1s
- derive_hard:   50.3s

These match the task's 30-90s expectation for the heaviest LLM chain in the codebase.

## Notes

### Difficulty differentiation observation (G3 caveat — not a blocker)
The hard problem ($2p + 5 = 13$, solve for $p$) is mathematically nearly identical to the easy problem ($5s + 3 = 28$, solve for $s$). Both are one-variable linear equations of the form $ax + b = c$. The catalog description for `derive_hard` calls for "strategy choice (substitution, case split, identity selection)" — none of which are required to solve $2p + 5 = 13$. The hard mode's differentiation manifests as more granular step decomposition (4 steps vs. 2) and explicit verification, not as a more challenging problem.

This is an **upstream-pipeline issue** in the AnnotatedExample orchestrator/planner (which authors the actual problem from the intent string), not in the practice-problem generator wrapper. The generator forwards a strong, specific intent ("requires strategy choice...non-obvious move...stretch problem") but the orchestrator chose a routine linear equation. Per task instructions, NOT fixing this in the AnnotatedExample pipeline — escalating instead.

Step-count differentiation does work correctly, and the contract bands (easy 2-3, medium 3-5, hard 4-6) are all satisfied, so G3 is marked PASS. But the user may want to investigate whether the orchestrator's planner is honoring the intent's complexity steering or flattening it.

### Hard mode redundancy
Step 1 of the hard response contains the entire derivation in one step (two transitions), and steps 2-3 then re-derive the same transitions individually. The final answer is consistent and the verification step is correct, but the structure has cosmetic redundancy. This is again upstream (planner-level) and doesn't affect rendering or pedagogy in a blocking way.

### Topics tested (test harness routing)
- easy: "Solving for Sticker Costs" — Algebra
- medium: "Finding a Mystery Number on a Number Line" — Number Sense
- hard: "Finding the Weight of Apples" — Number Sense

The eval-test harness chose different topics for each mode, which limits direct apples-to-apples difficulty comparison. The intra-mode shape and required-fields verification is unaffected.

### Generator code quality
`gemini-practice-problem.ts` is a clean wrapper. Validation is exhaustive and throws on every required-field violation. The shape narrowing (dropping tryProblems / solverDebug / interactive, adding difficulty / evalMode / gradeLevel) is mechanical and correct. No fixes needed in the generator.
