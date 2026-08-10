# Manifest within-block ordering A/B — modality-first — 2026-08-08

**Verdict: arm B REJECTED. The manifest's within-block rule is not the next lever, and
the fix that worked one layer up does NOT port down.**

Design: curator brief **held constant** — objectives generated once per topic and passed
to every run of both arms — so the arms differ by the manifest prompt and manifest
sampling only. Both arms scored on the same absolute rubric as `audit:order`, 12 topics
× 3 runs × 2 arms = 72 lessons.

```
npm run audit:order -- <port> 3 A,B
```

---

## Arms

**A (HEAD)** — the phase ladder:
```
Phase 1 (Introduce): Explain core vocabulary/concepts…
Phase 2 (Visualize): Demonstrate with an interactive or visual tool
Phase 3 (Apply):     Practice or applications
```

**B** — modality-first: the student meets the THING before the words about it. The
manipulative / simulation / audio activity opens the block; exposition supports it and
never precedes it; expository openers allowed only for purely informational objectives
with no specialist primitive.

## Result

| | arm A (HEAD) | arm B |
|---|---|---|
| mean sequence score | **4.03/5** | 3.75/5 |
| wrong opening activity | **14%** | 17% |
| symbol before the concrete | 19% | 19% |
| dependency violations | **47%** | 61% |
| **exposition opens the block** | 50% | **17%** |
| math | **3.67** | 3.13 (dep-violations 53% → 80%) |
| phonics | **3.78** | 3.44 (bad opener 44% → 67%) |
| science | 5.00 | 4.83 |
| engineering (CONTROL) | 4.33 | **4.67** (dep-violations 67% → 33%) |

**The mechanism worked and the outcome still got worse.** Exposition-first fell from 50%
to 17% — arm B did precisely what it was written to do — and the lesson quality dropped.

## Why — and it is the useful part

Within a block, an explainer is frequently the **prerequisite** for the manipulative, not
a symbol standing in for a thing. The judge, on arm B's shapes lessons:

> *"A3 introduces the core vocabulary and definitions for each shape, which should be
> presented before students are asked to search for and sort them."*
> *"A4 requires students to count sides and corners before A5 introduces and defines what
> 'side' and 'corner' mean."*

```
shapes and their attributes   A: foundation-explorer (5,5,2)   B: di-shapes (3,3,3)
```

The objective-layer fix ranks **prerequisite above concrete-before-symbol**, and it needed
to — the CVC case proved it there. Arm B made modality-first *absolute* and reproduced
exactly that error one layer down. The concrete-before-symbol principle is real at the
objective layer, where the two objectives are alternative *representations of the same
content*. Inside a block the components are usually *stages of one teaching move*, and
"define the term, then use it" is a dependency, not an abstraction the child can skip.

## The second finding: some "manifest defects" were objective-order artifacts

Named as manifest targets in the previous analysis, re-measured after the brief fix:

```
the phases of the moon   A: deep-dive    (5,5,5)   B: image-comparison (5,5,5)
rhyming words            A: media-player (5,5,5)   B: rhyme-studio     (4,5,5)
```

`deep-dive` opening the moon lesson scores **5/5**. It was only ever bad while the
objectives were bad. Changing it is churn. **Attributing a symptom to the layer it
appears in, before the upstream layer is fixed, over-counts the downstream layer** —
that is what produced the "7 manifest-owned failures" estimate.

## What is actually left

Two topics fail at 2/5 under BOTH arms, every run — not an ordering problem:

```
place value to 100                  A: 2,2,3    B: 2,2,2
reading sentences with sight words  A: 3,2,3    B: 2,2,3
```

Content / primitive-selection, one topic at a time — `/topic-fidelity` or `/reader-fit`.
Do not reopen ordering for them.

`dependency violations` sits at 47% even on arm A and has never been examined. It may be
the judge being maximalist about within-block prerequisites rather than a real defect.
Look before treating it as a target.

## Status

Arm B stays in the tree gated OFF (`experiment.manifestArm`), like the rejected
`evalModeArm: 'B'` — production runs HEAD. Kept because the arm switch is what makes the
manifest prompt measurable at all, and the next person will otherwise re-propose
modality-first from the same evidence that suggested it here.

## Method note

Holding the brief constant is what made this measurable — and it only became a valid
design AFTER the objective-order bug was fixed. The earlier `order-ab` study failed
precisely because both arms shared a broken upstream stage. **Fix upstream, re-measure,
then A/B downstream.** In the other order, the downstream A/B measures the upstream bug.
