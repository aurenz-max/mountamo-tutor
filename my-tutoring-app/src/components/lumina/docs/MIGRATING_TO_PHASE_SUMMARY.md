# Migrating a Primitive to PhaseSummaryPanel

A step-by-step recipe for adding `PhaseSummaryPanel` to an existing multi-phase primitive. No research required — just follow the steps.

**Time:** ~15 minutes per primitive.

**Prerequisites:** The primitive must have a `challenges` array and track per-challenge results. If it only has a single submit (no per-challenge loop), this pattern doesn't apply.

---

## Step 0: Identify the 4 Things You Need

Open the primitive and find these. Every multi-phase primitive has them — they just look slightly different in each one.

| What to find | What it looks like | Example (BalanceScale) |
|---|---|---|
| **Challenges array** | `const challenges = ...` or `data.challenges` | `data.challenges` |
| **Challenge type field** | A field on each challenge that identifies the phase | `challenge.type` (e.g. `'solve'`, `'verify'`) |
| **Three state variables** | `useState` for index, attempts, results | See below |
| **Advance function** | Sets next index, resets attempts | `advanceToNextChallenge` |

The three state variables always look like this:

```tsx
// FIND THESE THREE — they'll be replaced
const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
const [challengeResults, setChallengeResults] = useState<Array<{...}>>([]);
const [currentAttempts, setCurrentAttempts] = useState(0);
```

---

## Step 1: Add Imports

Add these three imports at the top of the file:

```tsx
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
```

Also add `submittedResult` and `elapsedMs` to your `usePrimitiveEvaluation` destructure if they aren't already there:

```tsx
const {
  submitResult: submitEvaluation,
  hasSubmitted: hasSubmittedEvaluation,
  submittedResult,   // ← add
  elapsedMs,         // ← add
} = usePrimitiveEvaluation<YourMetrics>({ ... });
```

---

## Step 2: Define Phase Config

Add a constant **outside** the component that maps each challenge type to a display label, icon, and color:

```tsx
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  solve:    { label: 'Solve',    icon: '🧮', accentColor: 'purple' },
  verify:   { label: 'Verify',   icon: '✅', accentColor: 'emerald' },
  extend:   { label: 'Extend',   icon: '🚀', accentColor: 'blue' },
};
```

The keys must match whatever `challenge.type` (or equivalent field) returns. Look at the challenges array to see what values exist.

**Available accent colors:** `'purple' | 'blue' | 'emerald' | 'amber' | 'cyan' | 'pink' | 'orange'`

---

## Step 3: Replace the Three State Variables

Delete the three `useState` lines and replace with `useChallengeProgress`:

```diff
- const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
- const [challengeResults, setChallengeResults] = useState<Array<{...}>>([]);
- const [currentAttempts, setCurrentAttempts] = useState(0);

+ const {
+   currentIndex: currentChallengeIndex,
+   currentAttempts,
+   results: challengeResults,
+   isComplete: allChallengesComplete,
+   recordResult,
+   incrementAttempts,
+   advance: advanceProgress,
+ } = useChallengeProgress({
+   challenges,
+   getChallengeId: (ch) => ch.id,
+ });
```

Then add `usePhaseResults` right after:

```tsx
const phaseResults = usePhaseResults({
  challenges,
  results: challengeResults,
  isComplete: allChallengesComplete,
  getChallengeType: (ch) => ch.type,  // ← must match your phase config keys
  phaseConfig: PHASE_TYPE_CONFIG,
});
```

**If your primitive scores per-challenge** (not just correct/incorrect), add a custom scorer:

```tsx
const phaseResults = usePhaseResults({
  // ...same as above, plus:
  getScore: (rs) => Math.round(
    rs.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / rs.length
  ),
});
```

---

## Step 4: Replace State Mutations

Search the file for every usage of the old setters and replace them:

### 4a: Increment attempts

```diff
- setCurrentAttempts(a => a + 1);
+ incrementAttempts();
```

### 4b: Record a result

```diff
- setChallengeResults(prev => [...prev, {
-   correct: true,
-   steps: userSteps.length,
-   attempts: currentAttempts + 1,
- }]);

+ recordResult({
+   challengeId: currentChallenge.id,
+   correct: true,
+   attempts: currentAttempts + 1,
+   // Any extras you want (they're passed through via index signature):
+   steps: userSteps.length,
+ });
```

**Important:** `recordResult` requires a `challengeId` string. If your challenges don't have an `id` field, you can use an index-based ID:

```tsx
getChallengeId: (ch, index) => `challenge-${index}`
// or
getChallengeId: (ch) => ch.id ?? `${ch.type}-${ch.targetValue}`
```

### 4c: Advance to next challenge

Replace your manual advance function. The old pattern looks like this:

```tsx
// OLD
const advanceToNextChallenge = () => {
  const nextIdx = currentChallengeIndex + 1;
  if (nextIdx >= challenges.length) {
    // all done — submit evaluation
    return;
  }
  setCurrentChallengeIndex(nextIdx);
  setCurrentAttempts(0);
  // reset domain state...
};
```

Replace with:

```tsx
// NEW
const advanceToNextChallenge = useCallback(() => {
  if (!advanceProgress()) {
    // All challenges done — submit evaluation here
    // (see Step 5 for the AI message)
    return;
  }
  // advanceProgress() already incremented index and reset attempts.
  // Just reset your domain-specific state:
  setFeedback('');
  setMyInput('');
  // etc.
}, [advanceProgress, /* your deps */]);
```

### 4d: Completion check

Replace any manual completion logic:

```diff
- const allComplete = challenges.length > 0
-   && challengeResults.filter(r => r.correct).length >= challenges.length;

+ // Already provided by the hook:
+ // allChallengesComplete
```

---

## Step 5: Add AI Phase Summary (Optional but Recommended)

Inside the `if (!advanceProgress())` block (the "all done" path), use `phaseResults` for the AI message:

```tsx
if (!advanceProgress()) {
  // Build phase score string for AI
  const phaseScoreStr = phaseResults
    .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
    .join(', ');
  const overallPct = Math.round(
    challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0)
    / challenges.length
  );

  sendText(
    `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
    + `Give encouraging phase-specific feedback.`,
    { silent: true }
  );

  // ... existing evaluation submit logic ...
  return;
}
```

---

## Step 6: Compute Overall Score

Add a `localOverallScore` memo for the panel to use as fallback:

```tsx
const localOverallScore = useMemo(() => {
  if (!allChallengesComplete || challenges.length === 0) return 0;
  const correct = challengeResults.filter(r => r.correct).length;
  return Math.round((correct / challenges.length) * 100);
}, [allChallengesComplete, challenges, challengeResults]);
```

---

## Step 7: Render PhaseSummaryPanel

Add this at the bottom of your `<CardContent>`, after any existing "all complete" message:

```tsx
{allChallengesComplete && phaseResults.length > 0 && (
  <PhaseSummaryPanel
    phases={phaseResults}
    overallScore={submittedResult?.score ?? localOverallScore}
    durationMs={elapsedMs}
    heading="Challenge Complete!"
    celebrationMessage={`You completed all ${challenges.length} challenges!`}
    className="mt-4"
  />
)}
```

You can remove any existing manual "results" UI that the panel replaces (e.g. a simple "X / Y correct" text).

---

## Quick Checklist

After migration, verify:

- [ ] No remaining `setCurrentChallengeIndex` / `setCurrentAttempts` / `setChallengeResults` calls
- [ ] `recordResult` is called with `challengeId` on every correct answer
- [ ] `incrementAttempts` is called on every check (correct or not)
- [ ] `advanceProgress()` is the only way to move to the next challenge
- [ ] `allChallengesComplete` replaces any manual completion check
- [ ] `PhaseSummaryPanel` renders when `allChallengesComplete && phaseResults.length > 0`
- [ ] `npx tsc --noEmit` passes (grep for your component name in the output)

---

## Common Gotchas

**"My challenges don't have a `type` field."**
Use whatever field distinguishes phases. If all challenges are the same type, you can use a single-phase config and still get the summary panel — it'll just show one phase row.

**"My challenges don't have an `id` field."**
Generate one in `getChallengeId`: `(ch, i) => ch.id ?? \`challenge-\${i}\``

Note: `getChallengeId` doesn't actually receive an index parameter. Instead, ensure your challenges have unique IDs, or add them when building the array: `challenges.map((ch, i) => ({ ...ch, id: ch.id ?? \`ch-\${i}\` }))`.

**"I have phases that aren't in the challenges array."**
For example, PercentBar has Explore/Practice/Apply but the data comes as separate fields, not a flat array. Solution: build a unified challenges array in a `useMemo` that combines all phases, each with a `type` field:

```tsx
const challenges = useMemo(() => [
  { id: 'explore-0', type: 'explore', ...exploreData },
  ...practiceQuestions.map((pq, i) => ({ id: `practice-${i}`, type: 'practice', ...pq })),
  { id: 'apply-0', type: 'apply', ...applyData },
], [exploreData, practiceQuestions, applyData]);
```

**"I'm getting double results."**
Make sure `recordResult` is only called once per correct answer, not on every attempt. The hook uses `challengeId` to deduplicate, but calling it on incorrect attempts with `correct: false` will create entries you don't want.

**"`phaseResults` is always empty."**
It only computes when `isComplete` is true. Check that `allChallengesComplete` is actually becoming true — this requires that `results.length >= challenges.length`.

---

## Unmigrated Primitives

These 18 primitives still use manual `setChallengeResults` / `setCurrentChallengeIndex` / `setCurrentAttempts`:

**Math:** BalanceScale, BaseTenBlocks, MeasurementTools, RegroupingWorkbench, ShapeBuilder, SkipCountingRunner

**Chemistry:** EquationBalancer, EnergyOfReactions, MatterExplorer, MixingAndDissolving, PhExplorer, ReactionLab, SafetyLab, StatesOfMatter

**Engineering:** VehicleComparisonLab

**Literacy:** ContextCluesDetective, SentenceBuilder

**Biology:** DnaExplorer

---

## Reference Implementations

Already migrated — use these as examples:

| Primitive | Notable pattern |
|---|---|
| [CountingBoard.tsx](../primitives/visual-primitives/math/CountingBoard.tsx) | Multiple challenge types (`count_all`, `subitize`, `group_count`, `count_on`), domain-specific extras (`oneToOne`) in results |
| [TenFrame.tsx](../primitives/visual-primitives/math/TenFrame.tsx) | Four phase types with distinct interactions per phase |
| [NumberLine.tsx](../primitives/visual-primitives/math/NumberLine.tsx) | Custom accuracy-based scoring via `getScore` |
| [PercentBar.tsx](../primitives/visual-primitives/math/PercentBar.tsx) | Unified challenges array built from separate Explore/Practice/Apply data fields |
| [FunctionMachine.tsx](../primitives/visual-primitives/math/FunctionMachine.tsx) | Rule discovery + prediction phases |
