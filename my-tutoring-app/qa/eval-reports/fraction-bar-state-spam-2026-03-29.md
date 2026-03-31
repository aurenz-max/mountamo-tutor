# Investigation Report: Gemini State Spam — fraction-bar (2026-03-29)

## Summary

Rapidly clicking partitions in the FractionBar build phase sends a burst of `update_context` messages to Gemini via WebSocket. Each click changes `shadedCount`, which triggers a context update. Although there is a 500ms client-side debounce, the architecture has multiple gaps that allow message flooding at normal interaction speed.

## The Problem

When a student clicks partition segments to shade/unshade them, Gemini "falls behind" — her audio responses become delayed, out of sync, or pile up. The root cause is that every state change becomes a WebSocket message to Gemini with zero backend-side rate limiting.

## Data Flow Trace

```
Student clicks partition
  → togglePartition() sets shadedCount (FractionBar.tsx:315-325)
  → aiPrimitiveData useMemo recomputes (includes shadedCount, line 113)
  → useLuminaAI useEffect fires (useLuminaAI.ts:173-188)
  → 500ms debounce timer starts
  → [if no click within 500ms] updateContext() sends WebSocket message
  → Backend lumina_tutor.py:582-604 receives update_context
  → Formats "[CONTEXT UPDATE] ... shadedCount: N"
  → Enqueues to text_queue (end_of_turn=False)
  → handle_text_to_gemini() sends to Gemini session via send_realtime_input()
  → Gemini absorbs — but each message adds context window pressure
```

## Root Causes

### 1. `shadedCount` in `aiPrimitiveData` triggers context updates on every click

**File:** [FractionBar.tsx:108-117](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/FractionBar.tsx#L108-L117)

```typescript
const aiPrimitiveData = useMemo(
  () => ({
    numerator,
    denominator,
    currentPhase,
    shadedCount,        // ← Changes on every partition click
    gradeLevel: gradeLevel || 'Grade 3',
  }),
  [numerator, denominator, currentPhase, shadedCount, gradeLevel],
);
```

Every click toggles `shadedCount`, which produces a new `aiPrimitiveData` object, which triggers the `useEffect` that calls `updateContext`. Gemini doesn't need to know `shadedCount` changed from 2→3→2→3 in rapid succession — it only needs the final value when the student submits.

### 2. 500ms debounce is insufficient for normal click pace

**File:** [useLuminaAI.ts:182-188](my-tutoring-app/src/components/lumina/hooks/useLuminaAI.ts#L182-L188)

The debounce cancels-and-restarts on each change, so rapid clicks within 500ms do coalesce. But at normal clicking speed (~700-1000ms between clicks), each click completes the debounce and sends a separate message. A student shading 5 partitions sends 5 context updates.

### 3. No backend-side throttling or batching

**File:** [lumina_tutor.py:582-604](backend/app/api/endpoints/lumina_tutor.py#L582-L604)

The backend handler puts every `update_context` message directly into the `text_queue` with no:
- Rate limiting
- Deduplication (same primitive, same state shape)
- Batching (coalesce multiple updates into one)
- Staleness check (skip if a newer update is already queued)

### 4. `handle_text_to_gemini` processes sequentially with no dropping

**File:** [lumina_tutor.py:679-701](backend/app/api/endpoints/lumina_tutor.py#L679-L701)

The consumer reads from the queue one-by-one and sends each to Gemini. If 5 context updates arrive in 3 seconds, all 5 are sent. Gemini must process each one, adding latency to any actual response it needs to deliver.

### 5. Dual-channel flooding: `sendText` + `updateContext` fire together

When `handleSubmitBuild()` runs (on an incorrect build attempt), it calls `sendText("[BUILD_INCORRECT]...")` at the exact same time that the `shadedCount` change triggers an `updateContext`. Gemini receives two messages nearly simultaneously — the explicit pedagogical event plus a redundant state snapshot.

## Scope: Which Primitives Are Affected?

Any primitive that includes rapidly-changing interactive state in its `aiPrimitiveData` is vulnerable. Quick audit:

| Primitive | Rapid-Change Field in aiPrimitiveData | Risk |
|-----------|---------------------------------------|------|
| **fraction-bar** | `shadedCount` (every partition click) | **HIGH** — confirmed by user |
| percent-bar | likely similar shading state | HIGH — needs verification |
| fraction-circles | sector shading state | MEDIUM — needs verification |
| counting-board | counter placement | MEDIUM |
| ten-frame | dot placement | MEDIUM |
| number-line | marker position (if dragging) | HIGH if drag events fire continuously |

## Recommended Fixes (not applied)

### Fix A: Remove `shadedCount` from `aiPrimitiveData` (simplest, fraction-bar only)

Gemini only needs the shading state when the student *submits*. The `[BUILD_INCORRECT]` and `[BUILD_CORRECT]` sendText calls already include the shaded count. Remove `shadedCount` from the useMemo:

```typescript
const aiPrimitiveData = useMemo(
  () => ({
    numerator,
    denominator,
    currentPhase,
    // shadedCount removed — sent explicitly in sendText on submit
    gradeLevel: gradeLevel || 'Grade 3',
  }),
  [numerator, denominator, currentPhase, gradeLevel],
);
```

**Effort:** Trivial. **Impact:** Eliminates 100% of partition-click spam for this primitive.

### Fix B: Backend-side rate limiter for `update_context` (systemic)

Add a per-session throttle in the backend handler. When a new `update_context` arrives within N ms of the previous one for the same session, replace the pending entry instead of enqueuing a new one:

```python
# Concept: replace-not-append for context updates
if not context_update_pending.empty():
    context_update_pending.get_nowait()  # discard stale
context_update_pending.put(new_state)
```

**Effort:** Moderate. **Impact:** Protects all primitives systemically.

### Fix C: Increase debounce or add interaction-aware gating in `useLuminaAI`

Options:
- Increase debounce from 500ms to 1500ms for `update_context` (simple but blunt)
- Add a "settling" heuristic: don't send until no state change for 2 seconds (smarter)
- Allow primitives to opt out of auto-context-sync and manage it manually

**Effort:** Low-Moderate. **Impact:** All primitives benefit.

### Recommendation

Apply **Fix A immediately** (fraction-bar specific, zero risk), then implement **Fix B** as a systemic safeguard for all current and future primitives.

## Classification

- **Severity:** HIGH
- **Category:** Performance / AI responsiveness
- **Fix in:** COMPONENT (Fix A) + BACKEND (Fix B)
- **Not a generator or eval issue** — this is an architecture concern in the real-time AI communication layer.
