# PRD: Adaptive Session — JIT Manifest for TikTok-Speed Learning

**Status:** In Progress — Phases 1-2 implemented, iterating
**Date:** 2026-04-03
**Priority:** Critical — this is the core product experience
**Scope:** Frontend only. The backend is dumb. It sends skill specs; the manifest does the rest.

---

## 0. Current Status (2026-04-03)

### What's built

| Component | Status | Notes |
|-----------|--------|-------|
| **SessionKernel** (state machine) | Done | Infinite-scroll prefetch pattern, `useSyncExternalStore` subscription. Handles all phase transitions. |
| **Decision engine** (`decisionEngine.ts`) | Done | All 6 actions: `continue`, `switch-representation`, `insert-example`, `early-exit`, `extend-offer`, `end-session`. Priority-ordered, deterministic, ~0ms. |
| **Streaming manifest** (Phase 1) | Done | 1-item initial hydrate + background prefetch. Session history fed into subsequent manifest calls. Latency hidden by overlap. |
| **Early exit + extension** (Phase 2) | Done | 3 consecutive high scores (≥90) across 2+ batches → celebration → summary. Extension offered when queue empty + streak. |
| **Representation switching** (Phase 3) | Done | 2 failures on same skill → "Let's try a different approach" transition → re-manifest with exclusion list. Scaffolding drops by 1. |
| **Worked examples** (Phase 4) | Done | 2 consecutive failures → "Let me show you how" transition → example item. Max 2 per session. Post-example retry at easier mode. |
| **Transition animations** | Done | 3 types: `switch` (rotate), `example` (pulse), `celebration` (confetti). 2.5s duration masks hydration latency. |
| **Session summary** | Done | Skill bars (solid/growing/new!), adaptive message, stats row (items, duration, switches, examples). |
| **Debug panel** | Done | Score bars, decision log, latency log, session history, prefetch status. Toggle via dot button in header. |
| **Skip/Next button** | Done | Advances to next item without scoring. For dev iteration speed. |
| **Adaptive scaffolding** | Done | Score ≥90 → mode up; score <60 → mode down. Integrated into decision flow. |

### Key thresholds (in `constants.ts`)

| Threshold | Value | Purpose |
|-----------|-------|---------|
| HIGH_SCORE | 90 | Mastery / early exit trigger |
| FAILURE_SCORE | 60 | Intervention trigger (switch/example) |
| EXTENSION_STREAK | 80 | "Keep going?" prompt |
| EARLY_EXIT_STREAK | 3 | Consecutive high scores needed |
| MIN_ITEMS | 3 | Minimum before early exit allowed |
| MAX_ITEMS | 10 | Hard session cap |
| MAX_WORKED_EXAMPLES | 2 | Per session |
| SCAFFOLDING_DROP_ON_SWITCH | 1 | Mode reduction on rep switch |

### Architecture

```
PulseAdaptiveSession.tsx (UI shell — phases, setup, transitions)
        ↓
useAdaptiveSession.ts (thin React hook, useSyncExternalStore)
        ↓
SessionKernel.ts (state machine — queue, prefetch, handler dispatch)
        ↓
decisionEngine.ts (pure function — priority-ordered rules)
        ↓
constants.ts (tunable thresholds)
```

### Next steps

1. **Wire to backend Pulse API** — Currently runs standalone with Gemini-generated content. Needs to accept `PulseItemSpec[]` from `assemble_session()` and submit `AdaptiveSessionResult` on completion. The `PulseSession.tsx` (original) already has this wiring; need to merge.
2. **Backend `AdaptiveSessionResult` endpoint** — Extend the existing result submission to accept the `decisions` array, `representationSwitches`, `workedExamplesInserted`, `earlyExit`, and `extensionAccepted` fields.
3. **Threshold tuning** — Run pulse-agent synthetic sessions across student profiles. Validate: do session lengths cluster naturally? Is the struggle cap triggering at the right rate (<20%)?
4. **Cross-subject confidence boost (v2)** — Insert a "win" from a different subject when struggling. Design hook exists (queue is just an array).
5. **Primitive effectiveness table (v2)** — Aggregate rep-switch data into `{skill, primitive_A_success, primitive_B_success}` for manifest preference signals.
6. **Sound design** — Celebration chime, redirect tone, teaching tone. Critical for K-3 engagement.
7. **Offline fallback** — If hydration fails mid-session, degrade to pre-hydrated items from initial batch.

---

## 1. The Insight

The backend already knows what to teach and how hard. IRT is solid. The pulse engine picks good items. But the *session itself* is static — 6 items generated upfront, played in order, no deviation. The student is on rails.

A real tutor doesn't work that way. A real tutor:
- Watches you solve the first problem, then adjusts the second one
- Switches to a different visual when you're not getting it
- Shows you a worked example after two failures instead of a third attempt
- Stops early when you've clearly mastered it
- Gives you one more when you're on a streak

All of these are **manifest-layer decisions**. The backend doesn't need to change. The manifest already has the live primitive catalog, the difficulty context, and the session history. It just needs to be called *reactively* instead of *once*.

---

## 2. The Flywheel

### Cross-session flywheel (what we have today)
```
Student does session → IRT updates θ/σ → next session is better calibrated → repeat
```
Slow. Once per session. The student doesn't feel it.

### Intra-session flywheel (what this PRD adds)
```
Student does item 1
    ↓
Result feeds into manifest call for item 2
    ↓
Item 2 is better targeted (right primitive, right difficulty)
    ↓
Student succeeds or fails with cleaner signal
    ↓
Decision engine adapts (switch, example, exit, continue)
    ↓
Student does item 3 — which couldn't have been predicted at session start
    ↓
Session ends when mastery is demonstrated, not when a counter hits 6
```

The student *feels* this flywheel. "It gave me something different when I was stuck" is a moment they remember. "It let me stop early because I got it" is a moment they tell their parent about.

### Data flywheel (free backend intelligence)

The adaptive session generates **primitive effectiveness data** as a byproduct — the backend gets smarter for free without any new backend code:

**Representation effectiveness per skill.** If `fraction-circles` fails and `fraction-bar` succeeds for the same skill for 40% of students — that's signal. Over time the manifest learns which primitive is the *first-choice* for each skill, not because we hand-mapped it in curriculum, but because the data showed it. Future manifest calls: "For this skill, `fraction-bar` has 73% first-attempt success vs `fraction-circles` at 52% — prefer `fraction-bar`."

**Worked example insertion rate per skill.** If skill X triggers worked examples in 60% of sessions, that skill has a teaching gap — maybe it needs a new primitive entirely, or the existing ones need a lower-scaffolding eval mode. This is a **curriculum quality signal** — it tells you where to build next.

**Early exit rate as IRT calibration signal.** If students consistently exit early on a set of skills, the IRT difficulty estimates might be too low. If they never exit early, estimates might be too high. Free calibration data.

**Extension acceptance as engagement signal.** 80% accept "keep going?" → you're ending too early. 5% accept → you're ending right. This tunes session length dynamically across the user base without picking a magic number.

---

## 3. Current Flow (Static)

```
Backend: assemble_session() → 6 PulseItemSpecs (fixed)
    ↓
Frontend: generatePulseManifest(all 6 items) → full manifest (fixed)
    ↓
Student: item 1 → item 2 → item 3 → item 4 → item 5 → item 6 → done
```

Every student sees the same 6 items in the same order regardless of how they perform. The IRT scoring happens *after* the session to update state for the *next* session.

---

## 4. Proposed Flow (Adaptive)

```
Backend: assemble_session() → 6 PulseItemSpecs (initial queue)
    ↓
Frontend: generatePulseManifest(items[0:2]) → manifest for first 2 items
    ↓
Student completes item 1 → evaluate result locally
    ↓
Decision engine (frontend, ~0ms):
  ├─ Scored 9+? → mark skill confident, maybe skip similar item
  ├─ Scored <5 twice? → insert worked example or switch representation
  ├─ 3 correct streak? → probe: pull next item from further ahead in queue
  └─ Default → continue to item 2
    ↓
Student completes item 2 → evaluate result locally
    ↓
generatePulseManifest(next 1-2 items, informed by results so far)
    ↓
...repeat until session goal met (mastery or time)
    ↓
Session Summary Screen (IRT growth + decisions made)
    ↓
Batch submit: all results + all decisions → backend processes IRT/gates/leapfrog
```

The key shift: **the manifest is called in small batches, reactively, with results from prior items as context.**

---

## 5. Four JIT Capabilities

### 5.1 Streaming Manifest (Generate-as-you-go)

**What:** Instead of one `generatePulseManifest(6 items)` call, make 2-3 calls of 1-2 items each, feeding results back in.

**Why:** The manifest already accepts `sessionHistory` (primitives used + scores). Today this only includes cross-session history. By feeding *current session results* into each subsequent call, Gemini naturally avoids repeating what worked and doubles down on what didn't.

**Implementation:**

```ts
// New: StreamingSessionManager
class StreamingSessionManager {
  private itemQueue: PulseManifestItemInput[];  // from backend
  private results: ItemResult[];
  private hydrated: HydratedItem[];             // ready to render
  private cursor: number = 0;

  // Pre-hydrate first 2 items immediately
  async start(items: PulseManifestItemInput[]) {
    this.itemQueue = items;
    this.hydrated = await this.hydrateNext(2);
  }

  // After each completion, decide what to hydrate next
  async onItemComplete(result: ItemResult) {
    this.results.push(result);
    const decision = this.decide(result);

    if (decision.action === 'continue') {
      // Hydrate next item from queue with updated context
      this.hydrateNext(1, { sessionResults: this.results });
    } else if (decision.action === 'switch-representation') {
      // Re-manifest same skill with different primitive
      this.hydrateAlternate(decision.failedSkill, decision.excludePrimitive);
    } else if (decision.action === 'insert-example') {
      // Inject worked example before retry
      this.insertWorkedExample(decision.skill);
    } else if (decision.action === 'early-exit') {
      // Student has demonstrated mastery — end session
      this.endSession('mastery');
    }
  }

  // Hydrate next N items from the queue
  private async hydrateNext(count: number, context?: SessionContext) {
    const nextItems = this.itemQueue.slice(this.cursor, this.cursor + count);
    this.cursor += count;
    return generatePulseManifest(nextItems, gradeLevel, callbacks, {
      sessionHistory: this.results.map(r => ({
        componentId: r.primitiveId,
        difficulty: r.difficulty,
        score: r.score
      })),
      ...context
    });
  }
}
```

**Latency management:** Hydrate item N+1 while student works on item N. A K-3 student spends 60-90 seconds per item. Gemini Flash Lite returns in 1-2 seconds for 1-2 items. The student never waits.

**The edge case — representation switch:** Student fails, decision engine says "switch primitive." That's a new manifest + hydrate call (~2-3 seconds). Solution: the "Let's try a different way" transition animation IS the loading state. Student reads the message, new primitive is ready.

**Manifest call budget:** 3-4 Gemini calls per session (2 items each) instead of 1 call for 6 items. Total token cost is similar. Latency is hidden by overlap.

---

### 5.2 Representation Switching

**What:** When a student fails the same skill twice on the same primitive, re-manifest with a different primitive for the same skill.

**Why:** A student who doesn't understand fractions via `fraction-circles` might click immediately with `fraction-bar`. The CRA progression (Concrete → Representational → Abstract) should happen within a session, not just across sessions.

**Decision rule:**
```ts
function shouldSwitchRepresentation(results: ItemResult[]): SwitchDecision | null {
  // Find skills attempted 2+ times with scores < 6
  const failedSkills = groupBySkill(results)
    .filter(group => group.length >= 2 && group.every(r => r.score < 6));

  for (const group of failedSkills) {
    const usedPrimitives = group.map(r => r.primitiveId);
    return {
      action: 'switch-representation',
      failedSkill: group[0].skillId,
      excludePrimitive: usedPrimitives,
      // Manifest will pick a different primitive from catalog
      // because excludePrimitive is added to the diversity context
    };
  }
  return null;
}
```

**Manifest integration:** Add an `excludePrimitives` field to the manifest options. The diversity context builder already handles "AVOID these overused primitives" — extend it to include "MUST NOT use these primitives for skill X."

**Scaffolding fallback:** If switching representation, also drop scaffolding mode by 1 (e.g., mode 3 → mode 2). The student needs more support, not just a different view.

---

### 5.3 Dynamic Worked Examples

**What:** After 2 consecutive failures on the same skill, inject an `annotated-example` primitive before the next attempt.

**Why:** This is what a good tutor does — "Let me show you one first." The student sees a step-by-step worked solution, then tries again. The current flow just keeps asking the same type of question at the same difficulty.

**Decision rule:**
```ts
function shouldInsertExample(results: ItemResult[]): ExampleDecision | null {
  const recent = results.slice(-2);
  if (recent.length < 2) return null;

  // Two consecutive failures on same skill
  if (recent[0].skillId === recent[1].skillId &&
      recent[0].score < 6 && recent[1].score < 6) {
    return {
      action: 'insert-example',
      skill: recent[0].skillId,
      description: recent[0].skillDescription,
      // Don't consume a queue slot — this is an insertion
    };
  }
  return null;
}
```

**Manifest call:** Generate a single-item manifest with `componentId: 'annotated-example'` forced, intent derived from the failed skill. This is a teaching moment, not an assessment — no scoring.

**After the example:** Retry the skill at scaffolding mode -1 (easier). If the student passes, continue. If they fail again, mark the skill for next-session review and move on. Don't let a student fail the same thing 4 times in one session — that's demoralizing.

**Max insertions per session:** 2 worked examples. More than that and the session becomes a lecture, not practice.

---

### 5.4 Early Exit / Extension

**What:** End the session early when the student has demonstrated mastery, or extend it when they're on a streak.

**Why:** Fixed session lengths are an authoring-time assumption. A student who scores 10, 10, 10 on three items doesn't need three more. A student who's on fire and wants to keep going shouldn't be stopped at 6.

**Early exit rules:**
```ts
function shouldEndEarly(results: ItemResult[]): boolean {
  if (results.length < 3) return false;

  // 3 consecutive scores >= 9 across different skills
  const recent = results.slice(-3);
  const allHigh = recent.every(r => r.score >= 9);
  const differentSkills = new Set(recent.map(r => r.skillId)).size >= 2;

  return allHigh && differentSkills;
}
```

**Extension rules:**
```ts
function shouldExtend(results: ItemResult[], queueLength: number): boolean {
  if (results.length < queueLength) return false; // not at end yet

  // Student completed all items and last 2 were high scores
  const recent = results.slice(-2);
  const onStreak = recent.every(r => r.score >= 8);

  return onStreak; // offer "Keep going?" prompt
}
```

**UX for early exit:** Don't just stop. Show a celebration moment: "You crushed it! 3 for 3. Session complete." with a confetti animation and the session summary. Make early exit feel like an achievement, not a truncation.

**UX for extension:** "You're on fire! Want to keep going?" with a clear opt-out. Generate 2 more items from the next skills in the curriculum. Never force extension.

**Session length bounds:** Minimum 3 items (enough signal). Maximum 10 items (attention span). These are soft — the student can always quit.

---

## 6. Session Summary Screen

Every session ends with a student-facing summary that doubles as the IRT data submission to the backend.

### What the student sees

```
┌──────────────────────────────────────────────┐
│                                              │
│  Today's Session                             │
│                                              │
│  ★ Fractions       ████████░░  growing  (+2) │
│  ★ Place Value     ██████████  solid         │
│  ○ Measurement     ████░░░░░░  new!          │
│                                              │
│  You're getting stronger at fractions —      │
│  keep it up!                                 │
│                                              │
│  3 items · 4 minutes · 2 skills leveled up   │
│                                              │
│  [Done]                   [Keep Going?]      │
└──────────────────────────────────────────────┘
```

**Design principles:**
- Bars show relative strength, not absolute scores. A kid doesn't need to know θ = 2.3.
- "+2" means "you improved" — delta from session start, not a raw number.
- "growing / solid / new!" labels map to IRT state: low-σ-high-θ = solid, improving-θ = growing, first-attempt = new.
- The message is generated: pick the skill with the most improvement and compliment it.
- If early exit triggered: "You crushed it!" replaces the generic message. Confetti animation.
- "Keep Going?" only appears if extension rules fire (last 2 scores >= 8).

### What the parent sees (over-shoulder legibility)

This screen IS the parent view. A parent glancing at the screen understands:
- What subjects their child worked on
- Whether they're improving
- How long the session was
- Whether the child is engaged (extension offered = yes)

No separate parent dashboard needed for alpha. This screen does the job.

### What the backend receives

On session end, one batch payload:

```ts
interface AdaptiveSessionResult {
  sessionId: string;
  items: ItemResult[];              // scores, primitives used, time per item
  decisions: SessionDecision[];     // every decision the engine made

  // New signal the backend doesn't get today:
  representationSwitches: Array<{
    skillId: string;
    failedPrimitive: string;
    succeededPrimitive: string | null;  // null if still failed after switch
  }>;
  workedExamplesInserted: string[];     // skill IDs that needed examples
  earlyExit: boolean;
  extensionAccepted: boolean | null;    // null if not offered
  sessionDuration: number;              // actual wall-clock time
  itemCount: number;                    // actual items completed (may differ from queue size)
}
```

The backend processes this batch: IRT θ/σ updates for each item, gate checks, leapfrog detection. Same as today, just all at once instead of one-by-one.

**Future use (not in v1):** Aggregate `representationSwitches` across students to build a primitive effectiveness table. Aggregate `workedExamplesInserted` to identify curriculum gaps. These are analytics queries, not real-time features.

---

## 7. The Decision Engine

All four capabilities feed into a single decision function called after each item completion:

```ts
interface SessionDecision {
  action: 'continue' | 'switch-representation' | 'insert-example' | 'early-exit' | 'extend-offer';
  // action-specific fields...
}

function decideNext(results: ItemResult[], queue: PulseManifestItemInput[]): SessionDecision {
  // Priority order matters — check most impactful first

  // 1. Early exit? (3 consecutive high scores, different skills)
  if (shouldEndEarly(results)) {
    return { action: 'early-exit' };
  }

  // 2. Need a worked example? (2 consecutive failures, same skill)
  const example = shouldInsertExample(results);
  if (example) return example;

  // 3. Need representation switch? (2+ failures, same skill, same primitive type)
  const switchRep = shouldSwitchRepresentation(results);
  if (switchRep) return switchRep;

  // 4. At end of queue — offer extension?
  if (results.length >= queue.length && shouldExtend(results, queue.length)) {
    return { action: 'extend-offer' };
  }

  // 5. Default: continue to next item
  return { action: 'continue' };
}
```

This is ~50 lines of deterministic logic. No LLM. No backend call. Runs in 0ms on the client. The intelligence is in the *rules*, not in a model.

---

## 8. Product Decisions

### D1: What is a "session"?

**Decision:** A session is a variable-length learning burst. Not a fixed block.

If early exit means 3 items and extension means 10, "sessions per day" is meaningless. Track **items per day** and **time per day** instead. A "session" is "the time between opening and closing the app."

**Implication:** Session length becomes a metric to observe, not a parameter to set. The decision engine finds the natural length for each student on each day.

**How to test:** Run 20 synthetic sessions with varied score patterns. Measure: do session lengths cluster naturally (e.g., struggling students at 5-6 items, strong students at 3-4)? If all sessions are the same length, the decision engine isn't working.

### D2: The struggle cap

**Decision:** Maximum 3 attempts on the same skill per session. After that, move on.

Flow for a struggling skill:
1. Attempt 1: fail → continue (might be a fluke)
2. Attempt 2: fail → insert worked example (teaching moment)
3. Attempt 3 (post-example, easier mode): fail → mark for next session, move on

Never let a student fail the same thing 4+ times in one sitting. Demoralization is the single biggest risk in adaptive learning. A student who feels stupid will close the app and not come back.

**How to test:** Create a "deliberate failure" test profile in pulse-agent. Score 2/10 on a specific skill repeatedly. Verify: the system moves on after 3 attempts, the skill appears in the next session's queue, the student never sees the same skill a 4th time.

### D3: Should sessions cross subjects?

**Decision:** Not in v1. But design the decision engine to support it in v2.

The case for cross-subject: "You're struggling with fractions — let's do a quick geometry win to rebuild confidence, then come back to fractions." This is what good tutors do. It breaks the frustration spiral.

The case against (for now): The backend assembles per-subject queues. Cross-subject would require either (a) the frontend merging two subject queues, or (b) the backend returning a multi-subject queue. Both add complexity.

**v1:** Single-subject sessions. If a student is struggling, the decision engine uses representation switching and worked examples within the subject.

**v2 design hook:** The `StreamingSessionManager` accepts a `queue: PulseManifestItemInput[]`. Nothing stops that queue from containing items from multiple subjects. The decision engine doesn't check subject. The extension rule could pull from a different subject's queue. Leave the door open.

**How to test (v2):** Manually construct a mixed-subject queue. Run through the decision engine. Verify no assumptions break.

### D4: Latency budget

**Decision:** 2-item batches with prefetch. Transition animations absorb edge-case latency.

| Approach | Latency between items | Adaptiveness | Status |
|----------|----------------------|-------------|--------|
| Batch all 6 upfront | Zero | Zero mid-session | Current |
| **Batch 2, prefetch next** | **Zero if prefetch wins** | **Adapts every 2 items** | **Proposed** |
| Generate 1 at a time | Risk of gap | Fully adaptive | Too slow |

K-3 students spend 60-90 seconds per item. Gemini Flash Lite returns 1-2 items in 1-2 seconds. Prefetch has 58+ seconds of headroom. The student never waits.

**The edge case:** Representation switch or worked example insertion. These are unplanned manifest calls — no prefetch headroom. Solution: each has a natural 2-3 second transition animation ("Let's try a different way" / "Let me show you one") that IS the loading state. The animation is pedagogically valuable (it resets the student's mental state) and technically necessary (it hides latency). Win-win.

**How to test:** Add latency logging to `StreamingSessionManager`. Measure time between "student clicks Next" and "next item is interactive." Target: <500ms for prefetched items, <3s for switches/examples (hidden by animation).

### D5: IRT summary — what level of detail?

**Decision:** Student-facing summary uses relative language ("growing", "solid", "new!"), not numbers. The raw IRT data is in the backend payload, not on screen.

A 6-year-old doesn't need to see θ = 2.3 or "Gate 2." They need to see:
- Which skills they worked on (names, not IDs)
- Whether they got better (delta, not absolute)
- A compliment (generated from the highest-improvement skill)

The parent looking over their shoulder gets the same view — and it's enough. "Oh, they're growing in fractions and solid in place value."

**What NOT to show:** Percentages, scores, gates, Greek letters. These are backend concepts. The student sees progress bars and words.

**How to test:** Show the summary screen to a non-technical adult. Ask: "What did this child work on today? Are they doing well?" If they can answer both questions in 5 seconds, the screen works.

### D6: When to build this vs more primitives?

**Decision:** Build 2-3 more gap primitives first (TimeSequencer, SpatialScene, EquationBuilder), then Phase 1-2 of adaptive session.

Rationale: The adaptive session makes *existing* primitives work 3x harder. But it can't adapt if there's only one primitive for a skill (no representation to switch to). The gap primitives add the density that makes adaptation meaningful.

**Sequence:**
1. ~~CoinCounter~~ (done)
2. ~~TimeSequencer + SpatialScene~~ (done)
3. ~~**Phase 1: Streaming manifest**~~ (done)
4. ~~**Phase 2: Decision engine + early exit**~~ (done)
5. ~~**Phase 3: Representation switching**~~ (done)
6. ~~**Phase 4: Worked examples**~~ (done)
7. ~~**Session summary screen**~~ (done)
8. **Backend integration** — Wire `PulseAdaptiveSession` to backend `assemble_session()` + result submission
9. **Threshold tuning** — Run pulse-agent synthetic sessions, validate session length distribution
10. EquationBuilder (close G1-2 gap)

---

## 9. What Doesn't Change

| Layer | Changes? | Notes |
|-------|----------|-------|
| Backend pulse engine | **No** | Still assembles item queue, still processes results |
| IRT calibration | **No** | Still updates θ/σ after each result |
| Mastery gates | **No** | Still derives gates from IRT state |
| Leapfrog | **No** | Still runs on result submission |
| Manifest generator | **Minor** | Add `excludePrimitives` option, support 1-2 item batches |
| Item hydration | **Refactor** | Move from batch-all to streaming with prefetch |
| Session component | **Refactor** | Replace linear item list with decision-engine loop |
| Backend API | **One new field** | Accept `AdaptiveSessionResult` on session complete |

The backend remains dumb. It provides the skill queue and processes results. All session intelligence lives in the frontend decision engine + manifest.

---

## 10. UX Moments

The decision engine creates specific UX moments that need design:

| Moment | Trigger | UX | Duration |
|--------|---------|-----|----------|
| **"You crushed it!"** | Early exit (3 high scores) | Confetti, session summary, "Come back tomorrow" | 3s animation → summary |
| **"Let's try a different way"** | Representation switch | Brief transition card + new primitive loads | 2-3s (hides hydration) |
| **"Let me show you one"** | Worked example insertion | Annotated example with "Watch this" framing, then "Now you try" | 2-3s intro (hides hydration) |
| **"Keep going?"** | Extension offer | Opt-in prompt after completing queue on a streak | Student-paced |
| **"Great progress!"** | Normal session end | Summary screen with growth bars | Student-paced |

Each moment should feel like a *tutor decision*, not a system state change. The language is first-person: "Let me show you" not "The system will now display."

**Sound design matters.** A celebration chime on early exit. A gentle "hmm, let's try this" tone on representation switch. A warm "here's how" tone on worked example. These are what make a 6-year-old feel like they're being tutored, not tested.

---

## 11. Implementation Phases & Testing

### Phase 1: Streaming Manifest (the foundation) — DONE

Implemented as `SessionKernel.ts` with an infinite-scroll prefetch pattern. 1-item initial hydrate, background prefetch of next item while student works. Session history fed into subsequent manifest calls via `getSessionHistory()`.

**Files:**
- `pulse/adaptiveEngine/SessionKernel.ts` — state machine with prefetch queue
- `pulse/adaptiveEngine/useAdaptiveSession.ts` — React hook (useSyncExternalStore)
- `pulse/PulseAdaptiveSession.tsx` — UI shell

**Verified:**
- [x] No loading spinners between items (prefetch wins the race)
- [x] Manifest calls happen in background (console logs confirm)
- [x] Session history context passed to subsequent manifest calls
- [ ] Latency between items < 500ms — needs measurement with real student traffic
- [ ] Session resume (localStorage) — not yet implemented

### Phase 2: Decision Engine + Early Exit — DONE

Implemented as `decisionEngine.ts`. Pure function, priority-ordered, all 6 actions. Early exit requires 3 consecutive scores ≥90 across 2+ manifest batches (proxy for skill diversity since we don't have backend skill IDs in standalone mode).

**Files:**
- `pulse/adaptiveEngine/decisionEngine.ts` — `decideNext()` + `adaptScaffoldingMode()`
- `pulse/adaptiveEngine/constants.ts` — tunable thresholds

**Verified:**
- [x] 3 high scores across different batches → early exit with celebration
- [x] 3 high scores same batch → no early exit (batch diversity check)
- [x] Below threshold → no early exit
- [x] Extension offered when queue empty + streak
- [x] Accept/decline extension flows work
- [ ] Score 10/10/10 on the SAME skill → no early exit — need backend skill IDs to test properly

### Phase 3: Representation Switching — DONE

2 failures (score <60) triggers switch. Session history + exclusion list sent to manifest to force different primitive. Scaffolding drops by 1. "Let's try a different approach" transition (2.5s) masks hydration.

**Verified:**
- [x] 2 failures → transition animation → different primitive loads
- [x] Scaffolding mode drops on switch
- [x] Transition animation plays ~2.5s
- [ ] Excluded primitives list grows correctly — needs more testing
- [ ] Replacement teaches SAME skill — needs backend skill IDs

### Phase 4: Dynamic Worked Examples — DONE

2 consecutive failures → "Let me show you how" transition → example at easier mode. Max 2 per session. Scaffolding drops by 1 on example insertion.

**Verified:**
- [x] 2 consecutive failures → example inserted
- [x] Max 2 examples per session enforced
- [x] "Let me show you how" animation plays
- [ ] Example is NOT scored — needs verification (currently all items go through `completeItem`)
- [ ] Post-example retry at easier mode — needs verification

### Phase 5: Session Summary Screen — DONE

Skill bars grouped by manifest batch (proxy for sub-topic). Labels: solid (≥85), growing, new!. Adaptive message based on overall performance. Stats row: items, duration, switches, examples.

**Files:**
- `pulse/AdaptiveSessionSummary.tsx`

**Verified:**
- [x] Growth bars render with color coding
- [x] Labels map to score ranges
- [x] Adaptive message varies by performance
- [x] Stats row shows item count, duration, switches, examples
- [ ] "Keep Going?" button on early exit — wired but needs UX polish
- [ ] Backend submission of `AdaptiveSessionResult` — not yet wired

### Integration Test: Full Adaptive Journey

After all phases, run end-to-end scenarios:

**Scenario A: "The Gifted Student"**
- Scores 9+ on everything → early exit after 3 items → celebration → short summary

**Scenario B: "The Struggling Student"**
- Fails fractions twice → worked example → retry at easier mode → passes → continues
- Fails measurement twice → representation switch → tries different primitive → passes

**Scenario C: "The Streaker"**
- Completes 6 items, all 8+ → extension offered → accepts → 2 more items → finishes strong

**Scenario D: "The Stuck Student"**
- Fails same skill 3 times (including post-example retry) → system moves on → skill in next session queue
- Never sees 4th attempt on same skill

**Scenario E: "The Mixed Bag"**
- Some high, some low, one switch, no examples → normal session length → summary shows varied growth

---

## 12. Metrics

| Metric | What it measures | Target | How to test |
|--------|-----------------|--------|-------------|
| Items-to-mastery | How many items before early exit | Lower = more efficient | Compare across student profiles |
| Prefetch hit rate | % of items ready when student finishes prior item | >95% | Latency logs |
| Representation switch success | Score improvement after switching primitive | >60% improve on retry | A/B: switch vs same primitive |
| Worked example effectiveness | Score improvement after example | >70% pass on retry | Before/after comparison |
| Extension acceptance rate | % of students who opt into more items | 30-50% | If <10%, end point is too late; if >70%, too early |
| Session completion rate | % of sessions not abandoned mid-stream | >90% | Track quit events |
| Struggle cap triggers | % of sessions where a student hits 3-attempt cap | <20% | If higher, IRT difficulty is miscalibrated |
| Time-per-item variance | Whether items are appropriately paced | Low variance = good calibration | Std dev of time across items |
| Session length distribution | Natural clustering of session lengths | Bimodal: ~3 items (mastery) and ~5-6 items (learning) | Histogram across all sessions |

---

## 13. What This Replaces

This PRD replaces the need for:
- Backend session mid-course corrections (the backend stays dumb)
- Pre-stored difficulty ladders in curriculum (the manifest adapts in real-time)
- Fixed session sizes (3-10 items, adaptive)
- "Smart" backend item reordering (the frontend reorders based on results)
- Separate parent dashboard (the summary screen IS the parent view)

The backend's job: pick skills, provide IRT state, process results.
The frontend's job: everything else.

---

## 14. Open Questions for Iteration

1. **Score thresholds.** Early exit at >= 9, struggle at < 6, extension at >= 8. These are starting guesses. After 50 real sessions, revisit: are students exiting too early? Too late? Are we switching too aggressively?

2. **Cross-subject confidence boost (v2).** When a student is spiraling on fractions, insert a geometry win from a different subject queue. Breaks the frustration loop. Requires multi-subject queue assembly. Design hook is already there (queue is just an array).

3. **Primitive effectiveness table (v2).** Aggregate representation switch data: `{skill, primitive_A_success_rate, primitive_B_success_rate}`. Feed this into the manifest as a preference signal. The curriculum learns which primitives work best — from data, not from hand-mapping.

4. **Sound design.** Each UX moment needs a distinct audio cue. Celebration chime (early exit), gentle redirect tone (switch), warm teaching tone (example), achievement tone (summary). These matter more than visuals for a 6-year-old's engagement.

5. **Offline / poor connectivity.** JIT requires network. If hydration fails mid-session, fallback to pre-hydrated items from the initial batch. Degrade gracefully — a static session is better than a broken one.
