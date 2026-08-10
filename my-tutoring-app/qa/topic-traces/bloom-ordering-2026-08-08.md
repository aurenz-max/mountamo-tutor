# Curator-brief Bloom ordering — 2026-08-08

Layer A of the primitive-selection work. Objectives are **taught in the order the
curator brief emits them**, so an inverted sequence means the lesson applies a
skill before teaching the concept it rests on.

Harness: `npm run audit:bloom-order -- <port> <label> 3` (8 K-2 topics x 3 runs,
`manifestOnly=true`, no generators).

## Result

| | ordered | inversions |
|---|---|---|
| baseline | 20/24 (83%) | 4 |
| after | 24/24 (100%) | 0 |

All 4 baseline inversions were **one shape** — a conceptual `explain` objective
appended after `apply`:

```
identify(1) → apply(3) → explain(2)      counting to 10
identify(1) → apply(3) → explain(2)      addition within 5   (x2)
identify(1) → apply(3) → explain(2)      skip counting by 5s and 10s
```

Every 2-objective lesson was already ordered. The defect only appears on the
3-objective shape, where the conceptual objective lands last instead of second.
After the fix the dominant 3-objective shape is `identify → explain → apply`.

## Root cause

`gemini-curator-brief.ts` asked for "Progress from lower to higher Bloom's levels
**when appropriate**" and then listed the verb categories in an order that is not
Bloom order and carries no level numbers:

```
identify, explain, create, analyze, compare, apply, evaluate
   1         2       6       4        2       3       5
```

`create` (the highest level) sat third and `apply` sixth. The model was asked to
rank by a scale the prompt never gave it.

## Fix

Verb categories re-listed lowest→highest with explicit `(n)` levels; the ordering
guidance hardened from "when appropriate" to a rule; the observed trailing-`explain`
trap named directly; and a PREREQUISITE OVERRIDE added for same-level pairs where
one objective's concept is required to perform another.

## End-to-end confirmation — the reported lesson

"counting to 10" now emits:

```
[identify] Bloom 1  Identify numbers from 1 to 10 in order
[explain]  Bloom 2  Explain that the last number counted tells the total amount in a group
[apply]    Bloom 3  Apply counting skills to find the total of up to 10 objects
```

Cardinality precedes counting-groups — previously it landed third, after the
counting objective that depends on it. All components in scope, hundreds-chart
`gridMax: 10`.

## Residual — not addressed by Layer A

- `sorting-station` still resolves `sort_one` (classification) under a counting
  objective. Mode-fit, not ordering → Layer B/C.
- The curator emits 2-3 objectives though the schema asks for "3-4".
- Within-objective component order is still unordered by cognitive demand; the
  catalog has no Bloom field on `ComponentDefinition` or `EvalModeDefinition`
  (192 primitives / 541 modes untagged). That is Layer B.
