# Pulse Engine Stagnation Issue

**Date identified:** 2026-03-22
**Identified via:** Pulse Agent — Gifted Grace profile (15 sessions, --graph)

## Problem

A gifted student scoring 9-10 on everything gets stuck in a 6-item loop after session 1. In 15 sessions (90 items), she touches only 7/163 skills and 12/163 subskills (4.3% coverage). The engine serves trivial items with P(correct)=0.99 and near-zero information value for 14 consecutive sessions.

## Evidence

### Session timeline shows flatline after session 1

| Session | Leapfrogs | Gate Advances | Skills in State | New skills inferred |
|---------|-----------|---------------|-----------------|---------------------|
| 1       | 6         | 0             | 17              | 17                  |
| 2       | 2         | 4             | 23              | 6                   |
| 3-15    | 2 each    | 0             | 23              | **0 each**          |

### Same 6 items served every session (sessions 2-15)

| Slot | Subskill | Band | P(correct) | Info | Notes |
|------|----------|------|------------|------|-------|
| 1 | GEOM001-01-B | current | 0.988-0.990 | 0.025-0.031 (negligible) | Trivial busywork |
| 2 | GEOM001-01-D | current | 0.988-0.990 | 0.025-0.030 (negligible) | Trivial busywork |
| 3 | GEOM001-01-C | current | 0.988-0.990 | 0.025-0.030 (negligible) | Trivial busywork |
| 4 | TIME001-02-D | frontier | 0.51-0.96 | varies | Same probe 14x in a row |
| 5 | GEOM001-02-C | current | 0.978-0.986 | 0.036-0.054 (negligible) | Trivial busywork |
| 6 | MEAS001-02-D | frontier | 0.56-0.95 | varies | Same probe 14x in a row |

GEOM001-01 alone consumed **48% of all items** (43/90).

### Leapfrog counter is misleading

34 "leapfrogs" fired, but sessions 3-15 each inferred **0 new skills**. The engine re-probes TIME001-02-D and MEAS001-02-D every session, they pass every time, but they're already owned — so the leapfrog fires but does nothing.

## Root Causes

### 1. Frontier probe selection doesn't exclude already-probed/owned skills

The probe selection algorithm picks the same 2 frontier candidates every session. There are 108 frontier candidates available, but the midpoint/depth targeting logic converges on the same nodes. Once a frontier probe passes and the skill is seeded, it should be excluded from future probe selection — but it isn't.

**Where to look:** `pulse_engine.py` — probe candidate selection, midpoint calculation, and the filter that determines which skills are eligible for frontier probing.

### 2. Gate retest window blocks all current-band progression

GEOM001-01-B/C/D cleared Gate 1 in session 2 and are waiting for the 3-day retest window. The engine has no other current-band items to serve (everything else is at G0 with no lesson evals), so it keeps re-serving these Gate 1 items despite P(correct)=0.99 and negligible information.

The engine should either:
- Skip trivial current items (P > 0.95 and Info < threshold) and replace with more frontier probes
- Serve different current-band items from the 23 seeded skills instead of fixating on the same 4

**Where to look:** `pulse_engine.py` — current band item selection, how it picks which subskills to serve from the current pool.

### 3. No variety/rotation mechanism

There is no mechanism to ensure the engine explores different parts of the graph across sessions. A gifted student should be traversing the DAG breadth-first at high speed, not depth-stuck on 2 skills.

## Impact

- **Student experience:** A gifted child would be bored to tears. 48% of their work is items they have a 99% chance of answering correctly. Zero challenge, zero growth.
- **Adaptive claim is hollow:** The system claims to be adaptive but serves identical sessions regardless of performance. A static worksheet would provide more variety.
- **Graph coverage:** At this rate (6 new skills per 15 sessions), it would take ~400 sessions to cover the 163-subskill graph. For a student scoring 9+, that's absurd.

## Steady Sam gate failure (related)

Steady Sam (scores 7-8) had 0 gate advances in 20 sessions. P(correct) stuck at ~0.22 vs 0.7 threshold because item betas are high from the shared calibration pool. This is the inverse problem: mid-range students can't clear gates because the IRT model underestimates them relative to the calibrated item difficulty. Same stagnation, different mechanism.

## Proposed Fix Areas

1. **Frontier probe rotation:** Exclude skills already probed/owned from frontier candidate pool. Force variety across sessions.
2. **Trivial item detection:** If a current-band item has P(correct) > 0.95 and Info < 0.05, stop serving it. Replace with frontier probes or untouched current-band skills.
3. **Current band breadth:** When selecting current-band items, prefer untouched subskills within seeded skills over re-serving the same subskills.
4. **Leapfrog deduplication:** Don't count re-probing an already-owned skill as a leapfrog. The counter should reflect actual new skill discovery.
5. **Gate acceleration for high-theta students:** Consider whether the calendar-based retest window should be shortened or bypassed when theta is far above the gate threshold.
