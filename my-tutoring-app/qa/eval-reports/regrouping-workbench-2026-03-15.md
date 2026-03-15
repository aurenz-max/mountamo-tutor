# Eval Test Report: regrouping-workbench
**Date:** 2026-03-15
**Topic:** Regrouping (carry/borrow) arithmetic | **Grade:** 1-2
**Tester:** Claude Code `/eval-test` (manual validation by user)

## Summary

| Eval Mode | Status | Critical | High | Medium | Low |
|-----------|--------|----------|------|--------|-----|
| add_no_regroup (Tier 1) | PASS | 0 | 0 | 0 | 0 |
| subtract_no_regroup (Tier 2) | ISSUES FOUND | 1 | 1 | 0 | 0 |
| add_regroup (Tier 3) | FAIL | 2 | 1 | 0 | 0 |
| subtract_regroup (Tier 4) | PASS | 0 | 0 | 0 | 0 |

**Overall:** 2 of 4 modes passed | 5 issues found

---

## add_no_regroup (Tier 1) — PASS

No issues found. All problems generated correctly with no carrying required.

---

## subtract_no_regroup (Tier 2) — ISSUES FOUND

**Generated:** 4 challenges, types: [subtract_no_regroup], all correct answers verified
- 58 - 24 = 34, 76 - 31 = 45, 99 - 45 = 54, 48 - 16 = 32

### Issues

1. **[Interaction Flow / State Management]** State bleed on re-generation (Tier 1 -> Tier 2)
   - Data: When switching eval modes without a full page reload, `useChallengeProgress` hook retains stale state from prior generation
   - Component: `useChallengeProgress` at [RegroupingWorkbench.tsx:184-195](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/RegroupingWorkbench.tsx#L184-L195) — `currentIndex`, `results`, and `isComplete` carry over from previous data
   - Student experience: Workbench shows "Problem 4/4" in a completed state with no inputs. Student cannot proceed without a full page reload.
   - Severity: CRITICAL — completely blocks the student

2. **[Contract Mismatch / Data Staleness]** Word problem context doesn't update between problems
   - Data: `wordProblemContext.story` is a single string on the top-level data object, not per-challenge
   - Component: [RegroupingWorkbench.tsx:616-619](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/RegroupingWorkbench.tsx#L616-L619) renders `wordProblemContext.story` statically for all challenges
   - Student experience: Problem 1's word problem (e.g., "A builder had 58 colorful blocks...") stays visible for Problems 2-4 even though the numbers change. The story context becomes numerically wrong.
   - Severity: HIGH — pedagogically confusing, mismatched numbers undermine the word problem's purpose

### Recommendation
- **Bug 1 fix:** `useChallengeProgress` hook needs to reset when `challenges` array identity changes (new data prop). Add a `useEffect` that resets state when `challenges` reference changes, or key the component on `data` identity.
  - File: `my-tutoring-app/src/components/lumina/hooks/useChallengeProgress.ts`
  - Fix type: COMPONENT
  - Effort: SMALL (< 30 min)

- **Bug 2 fix:** Either (A) move `wordProblemContext` into each challenge object so each problem has its own story, or (B) have the generator create a generic story that references "some items" without specific numbers, or (C) template the story with operand placeholders that update per-challenge.
  - File: `my-tutoring-app/src/components/lumina/service/math/gemini-regrouping-workbench.ts` (generator prompt + schema) AND `RegroupingWorkbench.tsx` (component if option A)
  - Fix type: GENERATOR + COMPONENT
  - Effort: MEDIUM (1-2 hrs)

---

## add_regroup (Tier 3) — FAIL

**Generated:** 3 challenges, types: [add_regroup]
- 49 + 35 = 84, 67 + 85 = 152, 128 + 194 = 322

```json
{
  "operation": "addition",
  "maxPlace": "tens",
  "gradeBand": "1-2",
  "challenges": [
    { "problem": "49 + 35", "requiresRegrouping": true, "regroupCount": 1 },
    { "problem": "67 + 85", "requiresRegrouping": true, "regroupCount": 1 },
    { "problem": "128 + 194", "requiresRegrouping": true, "regroupCount": 2 }
  ]
}
```

### Issues

1. **[UI Capacity Overflow]** AI generates out-of-scope problems — 3-digit addends and results for a Grades 1-2 / `maxPlace='tens'` workbench
   - Data: Problems 2 and 3 produce results exceeding 2 digits (67+85=152, 128+194=322). Problem 3 uses 3-digit addends entirely outside the grade band.
   - Component: The `places` memo at [RegroupingWorkbench.tsx:161-179](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/RegroupingWorkbench.tsx#L161-L179) dynamically expands columns to fit the answer, but this creates cascading layout issues (see Bug 4).
   - Student experience: Grade 1-2 students face 3-digit arithmetic they haven't learned. The workbench morphs from a 2-column to 3-column layout mid-session.
   - Severity: CRITICAL — pedagogically inappropriate content for the grade band; assessment validity compromised

2. **[UI Capacity Overflow]** Column layout mutates mid-session
   - Data: Problem 1 needs 2 columns (49+35=84), Problem 2 needs 3 columns (67+85=152)
   - Component: The `places` memo computes max digits across ALL challenges upfront, so even Problem 1 displays with 3 columns showing leading zeros: "0 4 9 + 0 3 5"
   - Student experience: Grade 1-2 students see leading zeros in the written algorithm — pedagogically confusing. The column count is inconsistent with `maxPlace='tens'`.
   - Severity: CRITICAL — leading zeros in arithmetic are a known source of confusion for early learners

3. **[UI Capacity Overflow]** Answer input mismatch when result exceeds `maxPlace`
   - Data: 67 + 85 = 152 but `maxPlace='tens'` implies 2 input boxes
   - Component: Although the dynamic `places` expansion at [line 161](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/RegroupingWorkbench.tsx#L161) adds a 3rd box, the `maxLength={1}` constraint on inputs at [line 766](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/RegroupingWorkbench.tsx#L766) means students can only enter single digits per box. For the tens column showing "15", a student would need to enter "15" in one box (blocked by maxLength=1) or split across boxes in a non-obvious way.
   - Student experience: Error message says "Your answer is 52, but the correct answer is 152" — student has no discoverable way to enter 152. Must enter "15" in tens box which violates the single-digit-per-column mental model.
   - Severity: HIGH — creates an impossible-to-solve state for students following the taught algorithm

### Recommendation
- **Bugs 1-3 root cause fix:** Add hard constraints to the generator prompt for `add_regroup` when `gradeBand='1-2'`:
  - Both addends must be 2-digit numbers (10-49 range recommended)
  - Sum must stay <= 99 (guarantees only ones-to-tens carry, which is the Tier 3 skill)
  - Add post-generation validation: reject any challenge where the sum >= 100 when `maxPlace='tens'`
  - File: `my-tutoring-app/src/components/lumina/service/math/gemini-regrouping-workbench.ts`
  - Fix type: GENERATOR (prompt constraints + post-validation)
  - Effort: SMALL (< 30 min)

- **Defense-in-depth (component):** The `places` memo should NOT expand beyond `maxPlace`. If a challenge produces a result that doesn't fit, the component should either skip that challenge or show an error — not silently add columns.
  - File: `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/RegroupingWorkbench.tsx`
  - Fix type: COMPONENT
  - Effort: SMALL (< 30 min)

---

## subtract_regroup (Tier 4) — PASS

**Generated:** 4 challenges, types: [subtract_regroup], all correct answers verified
- 73 - 28 = 45, 105 - 37 = 68, 341 - 156 = 185, 500 - 143 = 357

No issues found. The double-borrow visualization (two "Borrow" buttons, red-highlighted zeros in base-ten blocks) worked well and scaled correctly from 2-digit to 3-digit problems. The 3-column layout was consistent throughout because all problems involved 3-digit numbers.

---

## Product Decisions Required

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Word problem context is per-data, not per-challenge. Should it be per-challenge? | A) Move `wordProblemContext` into each challenge object (schema change, generator change, component change) B) Make the top-level story generic enough to cover all challenges ("A student is solving addition problems...") C) Disable word problems for multi-challenge sessions | Option A for best pedagogy — each problem deserves its own contextual story. Option B as a quick interim fix. |
| 2 | Should the component enforce `maxPlace` as a hard cap, or continue expanding columns dynamically? | A) Hard cap — reject/clamp problems that overflow (safer, simpler) B) Dynamic expansion — but suppress leading zeros and handle gracefully C) Let generator be the sole guard and trust it | Option A — the component should never show more columns than `maxPlace` specifies. Generator constraints prevent overflow, component enforces as defense-in-depth. |
| 3 | Tier 4 (subtract_regroup) generated 3-digit problems for a Grade 1-2 workbench. Is this intended? | A) Tier 4 is explicitly advanced — allow 3-digit for top-performing G1-2 students B) Cap Tier 4 at 2-digit for G1-2, use 3-digit only for G3-4 C) Split into separate eval modes: subtract_regroup_2digit and subtract_regroup_3digit | Option B — keep grade-band constraints consistent across all tiers. Students needing 3-digit subtraction should be assessed at the G3-4 level. |
