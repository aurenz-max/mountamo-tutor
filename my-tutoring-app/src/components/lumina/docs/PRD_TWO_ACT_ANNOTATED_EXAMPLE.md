# PRD: Two-Act AnnotatedExample — Watch, Then Try

> **Status:** Draft
> **Created:** 2026-04-28
> **Domain:** AnnotatedExample primitive
> **Dependencies:** Existing — `AnnotatedExample`, `WhiteboardCanvas`, Gemini Vision, challenger pipeline (untouched)

---

## Problem Statement

Today the AnnotatedExample primitive teaches one way: it shows the canonical solution with annotation layers and gates selected steps behind MCQ/text predictions. The student's role is *recognition* — pick the right next move from a choice set, type a short answer, watch the canonical reveal.

That's a real teaching event, but it's not the whole loop. The student never *produces* the solve themselves. After watching an expert work `2x + 5 = 7 → 2x = 2 → x = 1`, the next learning event should be the student doing it independently with a blank page in front of them. Today they have to leave the primitive to do that — open ScratchPad, copy the problem over, lose the connection to the worked example.

The earlier draft (`PRD_CHALLENGE_MODE_LIVE_SCRATCH.md`, now superseded) tried to bolt a handwriting surface onto individual challenge gates. The design space wouldn't accept it: a per-transition gate is a single-token slot, but handwriting wants multi-line derivations. The mismatch produced a Frankenstein.

The right shape is two distinct acts of the same lesson.

---

## The Design: Two-Act Lesson

### Act 1 — Watch
The existing AnnotatedExample, unchanged. Canonical walkthrough with annotation layers. Per-transition and step-level challenges from the challenger pipeline stay exactly as they are — they're the prediction gates that keep the student engaged *while* watching, not a substitute for doing.

### Act 2 — Now You Try
A full-screen takeover. The canonical solution is hidden. The student gets the problem statement, a canvas, and a transcription rail. They reproduce the solve themselves. When they press Done, the system transcribes their work, compares it against the canonical, and reveals both side-by-side with per-line tags.

The mental model: **"first let me show you, then you show me."**

The annotated example becomes the answer key the student compares against after their attempt — not just a thing to read.

---

## Goals

1. **Make student-produced derivations a first-class learning event** in the AnnotatedExample primitive, without leaving the primitive.
2. **Reuse Act 1 unchanged.** The existing watch-mode primitive — including all challenger-stage-4 gates — keeps working exactly as it does today.
3. **Use the canonical solution as the gold-standard for comparison.** No new "challenge mode" content authoring; the canonical IS the rubric.
4. **Recognize mathematically-equivalent paths as correct.** A student who multiplies by ½ first and an expert who subtracts 5 first both reach `x = 1`. Both are right.
5. **Cite annotation layers in feedback.** When the student errs, the explanation references the misconception annotation that already exists for that step.

### Non-goals (v1)

- Live coach intervention bubbles mid-write. Deferred to v2 once the watch→try→compare loop is real.
- Voice/audio coaching.
- Scoring or mastery signal. Challenge mode is formative; final compare returns a label, not a grade.
- Stroke-level intervention.
- Per-challenge `responseMode` modality picker. Modality is a property of the *act*, not of individual challenges.

---

## Design Principles

1. **Two acts, one lesson.** Watch and Try share the same problem and the same canonical solution. The student moves between them via a top-level mode toggle, not by completing some hidden criterion.

2. **Act 1 is untouched.** Zero changes to `StepContentRenderer`, the challenger pipeline, or any existing challenge gating. Watch mode looks and behaves identically to today.

3. **Done is always available.** The student can commit at any point — including with an empty canvas. An empty Done skips the compare call and reveals the canonical with no penalty. Challenge mode is formative.

4. **The transcription rail is not the response surface — the canvas is.** The rail is a read-only window into how the LLM is reading the work. The student doesn't edit KaTeX; they edit strokes. The rail teaches the formal notation by showing handwriting becoming "real" math.

5. **Equivalence over similarity.** The compare judge is told to evaluate *correctness*, not *match-to-canonical*. Different valid paths get ✓.

6. **Graceful degradation.** Vision call fails → show the canonical reveal anyway with a note ("Couldn't read your work clearly"). Try mode is additive; the student is never stuck.

---

## Student-Facing Loop

1. AnnotatedExample loads in **Watch** mode (default). Existing primitive renders. Student walks through, hits prediction gates, sees the canonical.
2. At any point the student can press **"Now you try."** Full-screen takeover slides in.
3. Try-mode surface (Layout B):
   - **Top bar (~48px):** problem statement on the left, "Show me again" button (returns to Watch without losing canvas state) and close (X) on the right.
   - **Center (~70% width):** canvas, full available height. Pen / eraser / clear / undo.
   - **Right rail (~320px):** transcription column. As the student writes, each parsed line appears as KaTeX. Read-only.
   - **Bottom-right of the canvas:** Done button.
4. Student writes. Every 1.5s of stroke inactivity, a snapshot fires to `transcribeWork`. The rail updates with the latest parsed lines.
5. Student presses Done. `compareWork` runs once. The full-screen surface transitions to the **Reveal** view.
6. Reveal view:
   - **Top:** the student's transcribed solution as a clean KaTeX chain. Each line tagged inline: ✓ match, ≡ equivalent, ⚠ divergent, ✗ error, + extra.
   - **Below:** the canonical AnnotatedExample renders in compact mode (collapsed to summary; expandable to full annotation layers).
   - **Optional comparison band:** side-by-side alignment view, toggleable.
   - **Verdict label:** `correct | incorrect-but-progressing | incorrect`. Not a grade.
7. Close X returns to Watch mode. Canvas state persists if the student reopens Try.

---

## Architecture

### Mode toggle on `AnnotatedExample`

```ts
type Mode = 'watch' | 'try';
```

`AnnotatedExample.tsx` adds a tab control near the existing view-mode tabs. Watch mode mounts the existing render path verbatim. Try mode mounts a new `TryItYourself` component as a fixed-position full-screen surface (the existing Watch render stays mounted underneath, hidden, so canvas state and watch progress survive switching).

### `TryItYourself.tsx` (new)

Owns:
- Full-screen layout (top bar + canvas + rail + Done button).
- A `WhiteboardCanvas` instance sized to fill available space (≥800×600 typical).
- The `useTranscription` hook (debounced snapshot → transcribed lines).
- Done flow: calls `compareWork`, transitions to Reveal view.
- Reveal view: tagged student transcription + canonical (compact-mode AnnotatedExample) + optional comparison band.

Props:
```ts
interface TryItYourselfProps {
  data: RichAnnotatedExampleData;  // same data Watch mode receives
  onClose: () => void;
  onReturnToWatch: () => void;
}
```

### `useTranscription.ts` (new)

```ts
interface TranscribedLine {
  index: number;
  latex: string;
  confidence: number;
}

interface UseTranscriptionResult {
  lines: TranscribedLine[];
  isTranscribing: boolean;
  lastError: string | null;
  forceSnapshot: () => Promise<void>;
}

function useTranscription(opts: {
  exportImage: () => string;     // from WhiteboardCanvas ref
  strokeCount: number;            // changes trigger debounce
  enabled: boolean;
  debounceMs?: number;            // default 1500
}): UseTranscriptionResult;
```

Debounces snapshot calls on stroke-count changes. Exposes a `forceSnapshot` so Done can flush before `compareWork` runs.

### `SolutionComparison.tsx` (new)

The optional reveal-view band. Renders two columns: student transcription on the left, canonical chain on the right, with alignment lines and per-line tags. Hidden by default behind a "Compare side-by-side" toggle so the basic reveal stays uncluttered.

### `service/annotated-example/judge.ts` (new)

Two server-side functions, both Gemini Vision via the existing `ai` client.

```ts
async function transcribeWork(input: {
  imageBase64: string;
  problemStatement: string;
}): Promise<{
  lines: Array<{ latex: string; confidence: number }>;
}>;

async function compareWork(input: {
  imageBase64: string;            // final canvas snapshot
  problemStatement: string;
  canonicalChain: string[];       // KaTeX expressions in order, derived from data.steps
  annotations: StepAnnotations[]; // per-step annotation layers from Watch
}): Promise<ComparisonResult>;

interface ComparisonResult {
  studentLines: Array<{
    latex: string;
    tag: 'match' | 'equivalent' | 'divergent' | 'error' | 'extra';
    rationale: string;            // one sentence; cites misconception when relevant
    canonicalIndex: number | null; // alignment to canonical chain, null for extras
  }>;
  verdict: 'correct' | 'incorrect-but-progressing' | 'incorrect';
  summary: string;                // one paragraph for the reveal-view header
}
```

The compare prompt is opinionated:
- Evaluate **correctness**, not similarity to canonical.
- Mathematically equivalent steps are tagged `equivalent`, not `divergent`.
- Cite annotation layers (especially `misconceptions`) when explaining `error` tags.
- An incomplete-but-correct derivation gets `incorrect-but-progressing` (no errors, but doesn't reach the goal).

### `app/api/lumina/route.ts`

Two new actions:
- `transcribeWork` → `transcribeWork()` from `judge.ts`
- `compareWork` → `compareWork()` from `judge.ts`

### Challenger pipeline

**Untouched.** Stage 4 keeps emitting per-transition and step-level challenges for Act 1. The original PRD's `responseMode` field is not added. `LiveScratchChallenge.tsx` and `useLiveJudge.ts` from that PRD are not created.

---

## Building the Canonical Chain

`compareWork` needs the canonical solution as a flat ordered list of KaTeX expressions. Most of this comes free from the existing data:

- **Algebra steps** contribute `from.latex` (first transition only) followed by each transition's `to.latex` in order.
- **Non-algebra steps** contribute their step-level summary line — for table cells, the highlighted cell value; for graph-sketch, the key feature value; for case-split, the chosen case's `result`. A helper in `judge.ts` flattens `RichExampleStep[] → string[]`.

Steps that don't contribute a line to a derivation chain (pure narrative diagrams, verification restatements) are skipped. The flattener lives next to `judge.ts` so the canonical extraction is testable in isolation.

---

## Pedagogical Guardrails

1. **No false positives on equivalent paths.** The compare prompt MUST tag `2x + 5 = 7 → 5 + 2x = 7 → 2x = 2` as equivalent to the canonical even though the first step reorders rather than subtracts. Test this explicitly during prompt iteration.

2. **No coaching during write in v1.** The transcription rail updates silently. No bubbles, no warnings, no green pulses. The reveal is the teaching moment.

3. **Empty Done is allowed.** A student who presses Done with no strokes gets the canonical reveal with `verdict: 'incorrect'` and a summary line ("Looks like you didn't get a chance to work it out — here's how the expert solves it"). No compare call, no judge cost.

4. **Low-confidence transcription degrades visibly.** When `confidence < 0.7`, render the line greyed out in the rail. If the final compare receives a snapshot with mostly low-confidence lines, surface that in the reveal ("Some of your work was hard to read clearly — try writing larger or with more contrast next time") and skip the per-line tags.

5. **Reveal compact mode is collapsible.** The canonical AnnotatedExample below the student's transcription defaults to collapsed (titles only) so the student's work stays the focus. They can expand to full Watch-mode rendering for any step they want to study.

---

## Rollout

### Phase 1 — Mode toggle + Try shell (1 PR)
- Add `mode: 'watch' | 'try'` to `AnnotatedExample.tsx` with tab control.
- Stub `TryItYourself.tsx`: full-screen surface with top bar, canvas, empty rail, Done button. Done returns to Watch immediately (no compare call yet).
- Verify Watch mode behavior is unchanged (existing tests / manual walkthrough).

This phase ships the navigation shell without any judge cost. Lets us validate the full-screen layout and mode-switching ergonomics before building the LLM integration.

### Phase 2 — Transcription rail (1 PR)
- Build `useTranscription` hook with debounced snapshot + Gemini Vision call.
- Add `transcribeWork` API action and `transcribeWork()` in `judge.ts`.
- Wire the rail to render transcribed lines as KaTeX with confidence-based styling.
- Iterate the transcription prompt against handwritten samples.

### Phase 3 — Compare + Reveal view (1 PR)
- Build canonical-chain flattener.
- Add `compareWork` API action and `compareWork()` in `judge.ts`.
- Build Reveal view with tagged student transcription + compact canonical render.
- Iterate the compare prompt against equivalent-path test cases (the false-positive guardrail).

### Phase 4 — Comparison band + polish (1 PR)
- `SolutionComparison.tsx` side-by-side alignment view.
- Reveal-mode "expand canonical step" affordances.
- Empty-Done handling, low-confidence handling.
- Persist canvas state across mode switches.

### Phase 5 — Live coach (deferred)
- Mid-write coaching bubbles. Builds on Phase 2's transcription pipeline.
- Only worth doing once Phase 2-4 demonstrates the loop is pedagogically valuable.

---

## Files Affected

### Phase 1
| File | Change |
|------|--------|
| `primitives/AnnotatedExample.tsx` | Add mode tabs + mount `TryItYourself` when `mode='try'` |
| `primitives/annotated-example/TryItYourself.tsx` | NEW — Phase 1 shell |

### Phase 2
| File | Change |
|------|--------|
| `primitives/annotated-example/TryItYourself.tsx` | Wire transcription rail |
| `primitives/annotated-example/useTranscription.ts` | NEW — debounce hook |
| `service/annotated-example/judge.ts` | NEW — `transcribeWork` |
| `app/api/lumina/route.ts` | Add `transcribeWork` action |

### Phase 3
| File | Change |
|------|--------|
| `primitives/annotated-example/TryItYourself.tsx` | Wire compare flow + Reveal view |
| `service/annotated-example/judge.ts` | Add `compareWork` + canonical flattener |
| `app/api/lumina/route.ts` | Add `compareWork` action |

### Phase 4
| File | Change |
|------|--------|
| `primitives/annotated-example/SolutionComparison.tsx` | NEW — side-by-side band |
| `primitives/annotated-example/TryItYourself.tsx` | Reveal polish, empty-Done, low-confidence |

---

## Open Questions

1. **Where should "Now you try" live in the UI?** Options: a third tab next to Step-by-Step / Full Solution; a prominent button below the last step; a floating action button. Lean toward the tab — discoverability matters and "Try" is a peer mode of "Watch," not a sub-action.

2. **Canvas persistence across mode switches.** Should re-entering Try wipe the canvas or restore it? Defaulting to restore — the student may want to keep working after a quick "Show me again" check.

3. **Should the canonical reveal be ordered by student lines or by canonical order?** When the student takes a different valid path, aligning to canonical order forces backwards-reading. Lean toward: student-line order is primary, canonical chain shown alongside with arrows.

4. **Streaming `compareWork`?** The compare call could take 5-10s with Gemini reasoning. Streaming the verdict + summary first while alignments arrive would feel faster. Defer to Phase 4 if it's a problem.

5. **What about non-derivation problems?** If the canonical chain is e.g. one diagram step + verification, there's nothing to "derive." Should Try mode disable itself, or accept any work as valid? Lean toward: Try mode is hidden when the canonical has no algebra steps. Watch-only examples exist.

6. **Mobile / touch.** WhiteboardCanvas already supports touch, but the full-screen layout assumes desktop proportions. Phase 4 needs a responsive layout pass; for v1 we can require desktop.

---

## Feature: End-to-End Try-It Loop (Phases A–D)

> **Status:** Proposed — supersedes the ad-hoc "Done returns to Watch" placeholder shipped in Phase 2.
> **Motivation:** Today the student finishes their work on the canvas, presses Done, and is dumped back to Watch with no acknowledgement. The transcription rail clearly shows they reached `x = 6`, the canonical agrees, and yet the system stays silent. The loop has no closure. This feature wires Phases B–D end-to-end so a single Try-It session has a verdict, a side-by-side reveal, and a clear next-action.

### Problem with the current placeholder

`handleDone` calls `onReturnToWatch()` and nothing else. There's no judgment, no comparison, no acknowledgement that the student got it right. The infrastructure exists — `useTranscription` produces structured KaTeX lines, `sibling.payload.data.steps` is the canonical solution — but nothing connects them. Each new piece of the loop has been added one step at a time, which is why the experience feels piecemeal.

### The four phases as one unified flow

```
┌─ Phase A: SOLVE ─┐  ┌─ Phase B: JUDGE ─┐  ┌─ Phase C: REVEAL ─┐  ┌─ Phase D: NEXT ─┐
│ Canvas + live    │→ │ Spinner overlay   │→ │ Side-by-side      │→ │ "New problem" / │
│ transcription    │  │ Compare student   │  │ student work vs   │  │ "Show me again"/│
│ Done = enabled   │  │ work vs canonical │  │ canonical steps,  │  │ "Done for now"  │
│ once strokes>0   │  │ via Gemini judge  │  │ verdict banner    │  │                 │
└──────────────────┘  └───────────────────┘  └───────────────────┘  └─────────────────┘
```

### Phase A — Solve (refinement of existing)

- Canvas + transcription rail. Already working.
- **Done gating:** require `strokes.length > 0`, not just `canvasReady`. Empty-canvas Done is a footgun — a judge call on an empty image returns nonsense.
- **Final-snapshot flush:** Done awaits `forceSnapshot()` from `useTranscription` before transitioning to Phase B, so the judge sees the latest stroke, not a stale debounced one.
- **Cancellable mid-write:** Close button stays available throughout; Show me again returns to Watch with strokes preserved (re-entering Try restores them).

### Phase B — Judge (NEW)

A single Gemini call that evaluates the student's transcribed work against the canonical solution.

**Server-side** — extend [`service/annotated-example/judge.ts`](../service/annotated-example/judge.ts) (currently only contains `transcribeWork`) with `compareWork`:

```ts
export interface CompareWorkInput {
  problemStatement: string;
  canonicalSteps: RichExampleStep[];   // from sibling.payload.data.steps
  transcribedLines: TranscribedLine[];  // from useTranscription's output
}

export interface JudgeVerdict {
  verdict: 'correct' | 'partial' | 'incorrect';
  finalAnswer: string;                 // student's final answer, normalized
  canonicalAnswer: string;             // expected final answer
  summary: string;                     // 1–2 sentences shown in the verdict banner
  stepAnalysis: Array<{
    studentLine: string;               // KaTeX
    matchedCanonicalStep: number | null;  // index into canonicalSteps, or null if extra/error
    status: 'aligned' | 'shortcut' | 'error' | 'extra';
    note?: string;                     // short per-line explanation when status ≠ aligned
  }>;
}
```

The prompt feeds Gemini the problem, the canonical step prose (titles + algebra `from`/`to` + narrative annotation), and the student's transcribed lines, and asks for the verdict + per-line alignment. Mathematically-equivalent paths get `aligned` even if the order differs (per goal 4). Misconceptions cite the canonical step's `misconceptions` annotation when relevant (per goal 5).

**API** — add `compareWork` action in [`api/lumina/route.ts`](../../app/api/lumina/route.ts) that delegates to the service.

**Loading state** — Phase B renders an overlay over the canvas (canvas hidden, not unmounted, so a back-out preserves strokes). Cancel button returns to Phase A.

### Phase C — Reveal (NEW)

A new component, `RevealView`, replaces the canvas surface in the body slot once the verdict resolves.

**Layout:**
- **Verdict banner** at top: emerald (correct) / amber (partial) / rose (incorrect) Lumina-themed card with the icon, summary sentence, and final answer comparison (`Your answer: x = 6` · `Expected: x = 6`).
- **Two-column comparison** below:
  - **Left — "Your work":** the transcribed lines rendered as KaTeX, each with a status pill (✓ aligned / ↗ shortcut / ⚠ error / + extra) and the optional `note`.
  - **Right — "Worked solution":** the sibling's `steps[]` rendered with the existing `RichStepCard` from [`AnnotatedExample.tsx`](../primitives/AnnotatedExample.tsx). All annotation layers default-on so the misconception/strategy notes are visible alongside the student's attempt. No challenger gates (sibling generation already runs with `skipChallenger=true`).
- **Footer CTAs (Phase D entry):** `Try a new problem` · `Show me again` · `Done for now`.

`RichStepCard` is currently inlined inside `AnnotatedExample.tsx`; this feature extracts it to `primitives/annotated-example/RichStepCard.tsx` so both Watch mode and Reveal mode can import it without circular deps.

### Phase D — Next-action

Not a separate render phase, but the conceptual close-out — the footer CTAs in Phase C. Three terminal actions:

1. **Try a new problem** — resets canvas, regenerates a fresh sibling, re-enters Phase A. The reused worked-example is the same; only the sibling problem changes.
2. **Show me again** — returns to Watch (existing behavior). Strokes preserved if the student re-enters Try.
3. **Done for now** — closes the Try-It overlay entirely (existing `onClose`).

### State machine

Replace the current ad-hoc `SiblingState` + ambient `strokes`/`lines`/`mode` state with a single discriminated union that drives every render branch:

```ts
type TryItPhase =
  | { kind: 'generating-sibling' }
  | { kind: 'solving';    sibling: SiblingPayload }
  | { kind: 'judging';    sibling: SiblingPayload; snapshot: TranscribedLine[] }
  | { kind: 'reveal';     sibling: SiblingPayload; snapshot: TranscribedLine[]; verdict: JudgeVerdict }
  | { kind: 'sibling-error'; message: string }
  | { kind: 'judge-error';   sibling: SiblingPayload; message: string };
```

Transitions:

| From → To | Trigger |
|---|---|
| `(initial)` → `generating-sibling` | mount |
| `generating-sibling` → `solving` | sibling fetch resolves |
| `generating-sibling` → `sibling-error` | sibling fetch fails (retryable) |
| `solving` → `judging` | Done click (after `forceSnapshot()`) |
| `judging` → `reveal` | judge resolves |
| `judging` → `judge-error` | judge fails (retryable, returns to `solving` with strokes intact) |
| `judging` → `solving` | Cancel during judge |
| `reveal` → `generating-sibling` | "Try a new problem" (canvas reset) |
| `reveal` → `solving` | "Try again" (canvas preserved) — *deferred to v2* |

Eliminating the implicit `sibling.status` + `mode` + `strokes` state surfaces makes every UI region a function of `tryItPhase`.

### Acceptance criteria

1. Pressing Done on a non-empty canvas transitions to Phase B and shows a "Checking your work…" overlay within 100ms.
2. Phase B never blocks longer than the judge call; cancelling returns to Phase A with strokes preserved.
3. The verdict banner correctly classifies `correct` for the canonical solve (`x = 6` for `3x − 7 = 11`) and for a mathematically-equivalent alternate path.
4. Per-line status pills appear on every transcribed line; `error` lines include a 1-sentence `note`.
5. "Try a new problem" generates a *different* sibling problem (different surface numbers), not the same one.
6. Re-entering Try mode after "Show me again" lands in Phase A with strokes preserved (assuming the sibling is the same).
7. An empty canvas cannot reach Phase B.
8. Judge failure is recoverable — student returns to Phase A and can retry without re-doing their work.

### Files touched

| File | Change |
|---|---|
| `service/annotated-example/judge.ts` | ADD `compareWork` next to existing `transcribeWork` |
| `app/api/lumina/route.ts` | ADD `compareWork` action |
| `primitives/annotated-example/RichStepCard.tsx` | NEW — extracted from `AnnotatedExample.tsx` |
| `primitives/AnnotatedExample.tsx` | Import `RichStepCard` from new module (no behavior change) |
| `primitives/annotated-example/RevealView.tsx` | NEW — verdict banner + two-column comparison |
| `primitives/annotated-example/TryItYourself.tsx` | Switch to `tryItPhase` reducer; add Phase B overlay; swap to `RevealView` on `kind: 'reveal'`; force-flush transcription on Done |
| `primitives/annotated-example/useTranscription.ts` | No change — `forceSnapshot` already exists |

### Out of scope (defer to a follow-up)

- **Streaming verdicts.** If the judge call exceeds ~5s, stream the verdict + summary first while alignments arrive. Profile after v1.
- **"Try again" with strokes preserved.** Listed in the state-machine table but deferred — v1 ships with "Try a new problem" (resets) and "Done for now" (closes) as the only two reveal-state exits.
- **Hint-instead-of-reveal.** Some students want a nudge, not the full canonical. Possible v2 once we see how often students retry vs move on.
- **Mastery signal emission.** Goal explicitly excludes scoring; the verdict is formative feedback only. Adding telemetry hooks is a separate concern.

---

## Feature: Live Step-by-Step Review (Mid-Solve Coaching)

> **Status:** Proposed — extends the End-to-End Try-It Loop with continuous progress tracking *during* Phase A (Solve), not only at Phase B (Judge).
> **Motivation:** The end-of-solve verdict in Phase B is a single moment of truth — it's accurate, but it leaves the student silent the whole time they're working. A student who got step 1 right has no signal that they're on track until they hit Done. A student who went off the rails three lines ago wastes time chasing the wrong path. The transcription rail sees every line as the student writes it; the canonical is already on the server. We have everything we need to coach mid-solve.

### What it should feel like

```
Student writes: 3x = 18           → "✓ Step 2 of 4 — added 7 to both sides. Now isolate x."
Student writes: x = 6             → "✓ Step 3 of 4 — divided both sides by 3. One more: verify."
Student writes: 3(6) − 7 = 11     → "✓ Step 4 of 4 — solution verified. Press Done when ready."

(off-track example)
Student writes: 3x = 4            → "Hmm — check the sign on the 7. Adding moves it to the other side
                                     as +7, not −7. Try again from 3x − 7 = 11."
```

The rail is no longer just a transcription mirror — it's a turn-by-turn navigator. Every committed line gets a verdict, a step counter (`step k of N`), and either a forward nudge or graceful redirect.

### Two-model architecture

The current `transcribeWork` model handles handwriting → KaTeX. That's a *vision* problem; making it also do *step alignment + coaching* would couple two different concerns into one prompt and bloat its latency on every snapshot.

Split into two model calls per snapshot:

1. **Transcriber** (existing — `gemini-flash-lite-latest` in `judge.ts`, vision). Output: `TranscribedLine[]` — one KaTeX line per visible row of work. **No semantic interpretation.**
2. **Step Reviewer** (NEW — `gemini-flash-lite-latest`, text-only, no vision). Input: the canonical `RichExampleStep[]`, the latest `TranscribedLine[]`, and the prior review state. Output: `LiveReviewState`. Runs only when transcription returns *new* lines, not on every keystroke.

The text-only Step Reviewer runs faster and cheaper than asking the vision model to also reason about correctness. It also lets us iterate on the coaching prompt independently of the handwriting prompt.

### `LiveReviewState` shape

```ts
export interface LiveReviewState {
  /** Total canonical steps the reviewer expects. Pulled from sibling.steps.length. */
  totalSteps: number;
  /** Highest canonical step the student has demonstrably reached. 0 = no progress yet. */
  completedSteps: number;
  /** Per-line review for every transcribed line so far. */
  lineReviews: Array<{
    studentLine: string;          // the KaTeX from the transcription rail
    /** Canonical step this line satisfies, if any. Null = off-track or filler. */
    matchedStep: number | null;
    status: 'on-track' | 'shortcut' | 'off-track' | 'filler';
    /**
     * Short coaching message (1 sentence). For on-track: confirmation + next move.
     * For off-track: graceful redirect — references what to check, never reveals the answer.
     * For shortcut: acknowledges the alternate path. For filler: silent (no message).
     */
    message?: string;
  }>;
  /** When all steps are complete — primes the Done button with a "ready" badge. */
  allStepsComplete: boolean;
}
```

The reviewer's prompt enforces the coaching tone explicitly: never reveal the next answer, always frame redirects around what to *re-examine* rather than what to *do*, and treat mathematically-equivalent paths as `on-track` (not `off-track` and not `shortcut` — `shortcut` is reserved for when the student skips ahead by combining two canonical steps into one).

### When the reviewer runs

- **Trigger:** every time `useTranscription` produces a new `TranscribedLine[]` whose length is greater than the previously-reviewed length, or whose final line's KaTeX changed.
- **Debounce:** the same 1500ms inactivity debounce that drives transcription — the reviewer piggybacks on the same snapshot loop, no extra timer.
- **Concurrency:** generation-counter discipline (same pattern as `useTranscription`) so a slow review can't overwrite a newer one.
- **Graceful skip:** if the transcriber returned the same line set as last time, skip the reviewer call entirely. Prevents thrash on canvas pan/zoom.

### UI changes

**Transcription rail (existing column on the right):** each transcribed line gets:
- A status pill on the left edge: ✓ `on-track`, ↗ `shortcut`, ⚠ `off-track`, ` ` `filler` (no pill).
- A subtle background tint matching the pill color.
- The reviewer's coaching message rendered below the KaTeX in a small, italic, slate-400 line. Off-track messages get amber accent.

**Header strip (NEW, above the canvas toolbar):** a thin progress band:
```
Now you try:  Step 2 of 4 ✓ ✓ · ·       [right-aligned status: "On track — next isolate x"]
```
- N pills, k filled — gives the "step 2 of 4 done" the user asked for.
- Single-line status text on the right reflects `lineReviews[last].message` for `on-track`, or the off-track redirect.
- When `allStepsComplete`, the band turns emerald and reads "All steps complete — press Done when ready."

**Done button:** gains a subtle emerald pulse when `allStepsComplete === true` to signal the student they've reached the answer. Pressing Done still goes through Phase B (judge) — the live reviewer is a heuristic; the judge is the authoritative verdict.

### Graceful off-track handling

The reviewer's most important job is to keep an off-track student from spiralling. Three rules baked into the prompt:

1. **Never reveal the next answer.** Off-track messages refer to the prior canonical step, never the upcoming one. "Check the sign on the 7" — not "you should have written `3x = 18`."
2. **Acknowledge what's right.** If the student got steps 1–2 and went off on step 3, the message confirms steps 1–2 ("you isolated the variable correctly") before redirecting on step 3.
3. **One redirect, then silence.** If the student writes three more off-track lines, the reviewer doesn't pile on — only the first line gets a coaching message; subsequent off-track lines render with the ⚠ pill but no new text. Avoids nagging.

### Relationship to Phase B (final verdict)

The live reviewer and the final judge are **independent**. The live reviewer is fast, heuristic, and per-line; it can be wrong without breaking the experience. The judge in Phase B is the authoritative verdict that drives Phase C. If they disagree (live reviewer said off-track but the judge says correct because the final answer matches), the judge wins. The student sees the judge's verdict in the reveal banner — the live coaching is scaffolding, not assessment.

This separation is why we can run the live reviewer on `gemini-flash-lite-latest` (cheap, fast, occasionally wrong) without compromising the verdict accuracy.

### State machine integration

The `tryItPhase` discriminated union from the End-to-End Try-It Loop section gains a sub-state inside `solving`:

```ts
| { kind: 'solving';
    sibling: SiblingPayload;
    review: LiveReviewState | null;     // null until first review call returns
    reviewing: boolean;                  // true while a review call is in flight
  }
```

Phase B (`judging`) and Phase C (`reveal`) consume the *final* `LiveReviewState` if it exists, but don't depend on it — the judge re-evaluates from scratch.

### Acceptance criteria

1. After the first canonical-aligned line is written, the progress band updates to "Step 1 of N" within ~2s of stroke inactivity.
2. An off-track line surfaces a redirect message that references what to *re-check*, never what to *write next*.
3. Mathematically-equivalent alternate paths get `on-track`, not `off-track`. (Same goal-4 invariant as the Phase B judge.)
4. The reviewer never runs when transcription returned no new lines.
5. The reviewer's verdict is *advisory* — pressing Done at any time still triggers Phase B with full judge authority.
6. Three consecutive off-track lines produce one coaching message, not three.
7. Live review failures degrade silently — the rail keeps transcribing, the progress band hides, and the student can still press Done.
8. When all canonical steps are confirmed, the Done button gains a visible "ready" affordance within one snapshot cycle.

### Files touched

| File | Change |
|---|---|
| `service/annotated-example/judge.ts` | ADD `reviewProgress` next to `transcribeWork` and `compareWork` |
| `app/api/lumina/route.ts` | ADD `reviewProgress` action |
| `primitives/annotated-example/useTranscription.ts` | EXTEND — invoke `reviewProgress` after each successful transcription that yields new lines; expose `liveReview` and `isReviewing` |
| `primitives/annotated-example/TryItYourself.tsx` | ADD progress band above canvas toolbar; tint transcription-rail lines per `lineReviews[i].status`; pulse Done on `allStepsComplete` |

### Out of scope (defer)

- **Stroke-level intervention** (e.g. wiggling the bad term in red on the canvas itself). Listed as a non-goal in the parent PRD; this feature stays in the rail + progress band, not on the canvas.
- **Voice/audio coaching.** Same non-goal as the parent PRD.
- **Adapting the canonical to the student's chosen path.** If the student takes an alternate route, the reviewer recognizes it as `on-track` but the progress band still shows the canonical's N steps. v2 could re-anchor.
- **Hint escalation.** If the student stays off-track for >30s, do we show progressively bigger nudges? Defer until we see real student traces.

---

## Feature: Hint Stack — Pull-able Scaffolding from the Canonical

> **Status:** Proposed addendum — closes the scaffolding-parity gap with Act 1.
> **Motivation:** Act 1 surfaces five annotation layers (steps, strategy, misconceptions, connections, narrative) as togglable scaffolding the student can lean on while watching. Act 2 as drafted offers *zero* student-pulled scaffolding during the solve — the canonical's annotations, already authored as gold-standard pedagogical content, sit unused until the post-Done reveal. Either Act 2 is meaningfully scaffolded (parity with Act 1) or it's a worksheet with a verdict at the end. The Live Reviewer is post-hoc per-line correction, not preemptive support — students who *know* they're stuck need a way to ask, not a system that only speaks after they've made the mistake.

### What it should feel like

A persistent rail-foot strip below the transcription column with three pull-able hint buttons, each tied to one of the canonical's annotation layers:

```
┌─ Transcription rail ──────────────┐
│  Line 1: 3x − 7 = 11    ✓ on-track│
│  Line 2: 3x = 4         ⚠ off     │
│       ↳ check the sign on the 7   │
│                                    │
│  ────────────────────────────────  │
│  Need a nudge?                     │
│  [💡 Strategy]  [⚠ Watch out for] │
│  [🔗 Connections]                  │
└────────────────────────────────────┘
```

Each button reveals the corresponding annotation from the *next-uncompleted canonical step* (driven by `LiveReviewState.completedSteps`). Pulls are logged but don't end the attempt — the student keeps writing on the canvas, and the judge in Phase B still runs against their final work.

### Three hint tiers, mapped to canonical layers

The annotations Act 1 already authors are reused verbatim — no new authoring surface, no new content pipeline. Each hint tier maps 1:1 to an existing annotation layer:

1. **💡 Strategy** — surfaces `step.annotations.strategy` for the next-uncompleted canonical step. The lightest hint: *"think about isolating the variable first."* Doesn't reveal the answer.
2. **⚠ Watch out for** — surfaces `step.annotations.misconceptions`. The medium hint: *"Students often forget to apply the operation to both sides."* Anti-pattern callout, not the move itself.
3. **🔗 Connections** — surfaces `step.annotations.connections`. The conceptual hint: *"This is the same balancing principle from one-step equations."* Frames the move in prior knowledge.

`narrative` and `steps` annotations are excluded — narrative restates the step and `steps` is the operation itself; either would leak the answer.

### `HintState` shape

```ts
export interface HintRecord {
  /** Which canonical step this hint was pulled for. */
  stepIndex: number;
  /** Which annotation layer was surfaced. */
  layer: 'strategy' | 'misconceptions' | 'connections';
  /** The annotation text shown — pinned at pull time so a sibling regen doesn't change history. */
  text: string;
  /** Wall-clock when pulled, for telemetry. */
  pulledAt: number;
}

export interface HintState {
  /** Every hint pulled this attempt, in order. */
  history: HintRecord[];
  /** Layers already pulled for the current next-uncompleted step. Prevents thrashing. */
  pulledForCurrentStep: Set<'strategy' | 'misconceptions' | 'connections'>;
}
```

The `pulledForCurrentStep` set resets when `completedSteps` advances — pulling Strategy on step 3, then writing step 3, then pulling Strategy on step 4 is the natural pattern.

### Anti-cascade rules

The hint stack must not become a "click all three for the answer" exploit. Three rules:

1. **One layer per step at a time.** After pulling Strategy for step k, the Strategy button is disabled (greyed) until `completedSteps` advances past k. Pulling Misconceptions and Connections for the same step is allowed — they're different angles.

2. **Hints reveal next-uncompleted, not last-attempted.** If the student wrote line 1 correctly (step 1) and is stuck on line 2, the hint reveals step 2's annotations. The reviewer's `completedSteps` is the source of truth — if it's wrong, the student gets a slightly off-target hint, but never an answer-leak.

3. **Hint history surfaces in the reveal.** Phase C's verdict banner shows hints used: *"3 hints used: Strategy (step 2), Watch out (step 3), Connections (step 3)."* This is informational, not punitive — but it primes the Phase D "Try a new problem" sibling at slightly higher difficulty (see IRT addendum below).

### UI integration

**Transcription rail extension (existing column):** the hint stack lives at the bottom of the rail, below the transcribed lines, separated by a divider. It's always visible — the student doesn't have to discover it through a menu.

**Pulled hint rendering:** when a hint is pulled, it appears as a Lumina-themed card *inside the rail*, above the hint stack and below the transcribed lines, color-coded to its layer:
- Strategy → emerald accent (`bg-emerald-500/10 border-emerald-400/30`)
- Misconceptions → amber accent (`bg-amber-500/10 border-amber-400/30`)
- Connections → cyan accent (`bg-cyan-500/10 border-cyan-400/30`)

A small "Hint for step 2" caption tags it to its anchor. Hints stay rendered for the rest of the attempt — the rail becomes a layered scaffolding artifact alongside the transcription.

**Disabled affordance:** when a button is disabled (annotation missing for that step, or already pulled for the current step), it renders at 40% opacity with a tooltip explaining why.

### State machine integration

Extends the `solving` sub-state from the End-to-End Try-It Loop:

```ts
| { kind: 'solving';
    sibling: SiblingPayload;
    review: LiveReviewState | null;
    reviewing: boolean;
    hints: HintState;
  }
```

Phase B (`judging`) and Phase C (`reveal`) consume `hints.history` for the verdict banner display and difficulty-bump logic.

### Acceptance criteria

1. With a canonical step that has all three annotations, all three hint buttons are enabled before any pull.
2. Pulling Strategy disables the Strategy button until the reviewer advances `completedSteps`.
3. A pulled hint card appears in the rail with the correct layer color and "Hint for step k" caption.
4. Pulled hints persist through the rest of the attempt and surface in Phase C's verdict banner.
5. Hint buttons disable gracefully when the canonical step lacks that annotation layer (no empty card on click).
6. Hint pulls do NOT trigger a new transcription or reviewer call — they're a UI-only state change.
7. The hint stack is hidden during `judging` and `reveal` phases (it only makes sense while solving).

### Files touched

| File | Change |
|---|---|
| `primitives/annotated-example/HintStack.tsx` | NEW — three buttons + pulled-hint cards, consumes `HintState` |
| `primitives/annotated-example/TryItYourself.tsx` | Add `hints` to `solving` state; render `HintStack` at rail foot; pass pulled history to `RevealView` |
| `primitives/annotated-example/RevealView.tsx` | Display hint history in verdict banner |

### Out of scope (defer)

- **Hint cost ramping.** Pulling Strategy is free; pulling Misconceptions costs more; pulling Connections costs most. Defer until we see whether students self-regulate without it.
- **Auto-revealed hints after sustained off-track.** The PRD's parent feature already lists this — the hint stack is the pull-only complement. Auto-reveal stays deferred.
- **Author-time hint authoring.** All hint content reuses the canonical's annotation layers — no new authoring surface. If a step lacks a layer, the button disables. This is the v1 contract.

---

## Feature: Multi-Modal Try-It — Response Surfaces Beyond the Canvas

> **Status:** Proposed addendum — closes the modality-parity gap with Act 1.
> **Motivation:** Act 1 renders five step types — algebra, table, graph-sketch, case-split, diagram — each with its own visual primitive and prediction-gate strategy. Act 2 as drafted offers exactly one response surface: a handwriting canvas with KaTeX transcription. The PRD's Open Question #5 punts on this gap explicitly: *"Try mode is hidden when the canonical has no algebra steps."* That means for any worked example whose canonical solution is graph-sketch-driven, table-driven, or case-split-driven, **Act 2 does not exist**. That's not parity — that's "Try-It is available for one of five modalities." The student is told "now you try" only on derivation problems and silently dropped everywhere else.

### What it should feel like

When the canonical is a graph-sketch problem, "Now you try" opens an interactive graphing canvas with the same coordinate system Act 1 used, a sketch tool, and a "feature labels" panel — the student plots their answer, labels intercepts, and presses Done. When the canonical is a table problem, Try mode opens an empty table with the row/column headers preserved and the student fills it in. The response surface is **a property of the canonical step's content type**, not a fixed handwriting canvas.

The mental model from the parent PRD — *"first let me show you, then you show me"* — applies to every step type, not just algebra. The student does the same kind of work the canonical does, just with the answer hidden.

### Per-step-type response surfaces

For each step type Act 1 supports, define an Act 2 response surface that mirrors its visual primitive. The surface is rendered inside `TryItYourself`'s body slot, replacing or augmenting the handwriting canvas based on the canonical's `step.content.type`.

| Canonical step type | Watch surface (Act 1) | Try surface (Act 2) | Response captured |
|---|---|---|---|
| `algebra` | KaTeX transition chain with annotation layers | **Handwriting canvas + transcription rail** (current) | `TranscribedLine[]` from vision |
| `table` | Filled table with highlighted cells | **Empty table** with same headers, fillable cells, KaTeX-aware inputs | `Record<rowKey, Record<colKey, string>>` |
| `graph-sketch` | Annotated curve on coord grid | **Interactive graph editor** — plot points, draw curve, label features | `{ points: Point[]; curve: Path; labels: Label[] }` |
| `case-split` | All cases shown with chosen highlighted | **Case picker + per-case work surface** — pick the case, do the work | `{ chosenCaseId: string; work: TranscribedLine[] }` |
| `diagram` | Static diagram with annotations | **Labeling surface** — drag labels to features, draw construction lines | `{ labels: Array<{ id; position; text }> }` |

The handwriting canvas isn't replaced — it remains the algebra surface. What changes is that *non-algebra* canonicals get type-appropriate Try surfaces instead of being dropped.

### Mixed-modality canonicals

Most canonicals have ≥2 step types — e.g. an algebra derivation followed by a verification graph, or a case-split followed by per-case algebra. Try mode handles this with a **step-by-step Try-It loop** rather than one monolithic surface:

```
Canonical: [algebra, algebra, graph-sketch, algebra]
Try mode:  Step 1 → handwriting canvas (algebra)
           Step 2 → handwriting canvas (algebra) — same canvas, continued
           Step 3 → graph editor pops in (graph-sketch)
           Step 4 → handwriting canvas resumes (algebra)
```

Each step transition triggers a "ready to commit step k?" prompt before advancing — the student isn't forced to commit step-by-step (they can write all four steps on the same canvas if the modalities allow), but when modalities differ, the surface swap is the natural commit boundary.

### Response surface registry

Each step type registers its Act 2 response surface, mirroring how `StepContentRenderer` registers Watch surfaces. New file:

```ts
// primitives/annotated-example/try-surfaces/registry.ts

export interface TryResponseSurface<TContent extends StepContent, TResponse> {
  /** The canonical step type this surface handles. */
  contentType: TContent['type'];

  /** Renders the empty/seeded surface for the student to fill in. */
  Component: React.FC<{
    content: TContent;
    response: TResponse | null;
    onResponseChange: (response: TResponse) => void;
    onCommit: () => void;
  }>;

  /** Compares student response to canonical for the judge. Returns per-field tags. */
  compare(canonical: TContent, response: TResponse): SurfaceCompareResult;

  /** Empty/initial response for a fresh attempt. */
  emptyResponse(content: TContent): TResponse;
}

export const TRY_SURFACES: Record<string, TryResponseSurface<StepContent, unknown>> = {
  algebra: AlgebraHandwritingSurface,
  table: TableFillSurface,
  'graph-sketch': GraphEditorSurface,
  'case-split': CaseSplitSurface,
  diagram: DiagramLabelSurface,
};
```

The judge's `compareWork` extends from "compare a single transcribed-lines array against canonical chain" to "compare a per-step response array against the canonical's per-step content." Each surface contributes a `compare` function for its modality — algebra uses the existing vision-based equivalence judge, table uses cell-by-cell match, graph-sketch uses geometric proximity + label-presence checks, etc.

### `MultiModalResponse` shape

```ts
export interface StepResponse {
  /** Which canonical step this is the response to. */
  stepIndex: number;
  /** Discriminator matches the canonical step's content type. */
  type: 'algebra' | 'table' | 'graph-sketch' | 'case-split' | 'diagram';
  /** Modality-specific response payload. */
  payload: AlgebraResponse | TableResponse | GraphResponse | CaseSplitResponse | DiagramResponse;
  /** Whether the student has explicitly committed this step. */
  committed: boolean;
}

export type MultiModalResponse = StepResponse[];
```

Replaces `TranscribedLine[]` as the input to Phase B. The judge consumes the full array and emits per-step verdicts (existing `stepAnalysis` shape generalizes — `studentLine` becomes `studentResponseSummary`).

### State machine integration

The `solving` sub-state generalizes:

```ts
| { kind: 'solving';
    sibling: SiblingPayload;
    /** Per-step response, indexed by canonical step. */
    responses: MultiModalResponse;
    /** Which step the student is currently working on. Drives surface choice. */
    activeStepIndex: number;
    review: LiveReviewState | null;
    reviewing: boolean;
    hints: HintState;
  }
```

The `activeStepIndex` advances when the student commits a step (or when the Live Reviewer detects step k+1 was started). Surface swap is driven entirely by `canonical.steps[activeStepIndex].content.type`.

### Sibling generator implications

The sibling generator already preserves step-type structure (sibling.ts goal: "same step structure as the original"). Multi-modal Try-It makes this guarantee load-bearing — if the canonical has a graph-sketch step, the sibling MUST also produce a graph-sketch step, or the student's modality changes mid-loop. Add a sibling-validation pass that checks `sibling.steps.map(s => s.content.type)` matches `original.steps.map(s => s.content.type)`; on mismatch, regenerate (or fail closed to "Watch only").

### Phased rollout

The full multi-modal landscape is large — five surfaces, a registry, a judge generalization. Phase as follows:

**M1 — Algebra surface formalization.** Refactor the current handwriting canvas into the registry as `AlgebraHandwritingSurface`. No behavior change. Establishes the registry shape.

**M2 — Table surface.** Smallest non-algebra surface. Empty table with KaTeX-aware cells; cell-by-cell compare in the judge. Unblocks ~20% of canonicals (rough estimate — needs catalog audit).

**M3 — Graph-sketch surface.** Reuse `canvas-2d` primitives from `visual-primitives/math/canvas-2d`. Sketch tool, point-plot, label-drag. Geometric-proximity compare.

**M4 — Case-split surface.** Picker + per-case sub-surface (recursive — each case body is itself one of M1–M3).

**M5 — Diagram surface.** Last because diagrams are the most authoring-variable. Labeling + construction-line drawing.

**M6 — Mixed-modality flow.** Step-by-step commit boundaries, surface swaps, per-step verdicts. Builds on M1–M5 being individually solid.

### Acceptance criteria

1. A worked example whose canonical is purely graph-sketch shows a graph editor in Try mode, not a handwriting canvas. (M3)
2. A worked example with mixed step types swaps surfaces at commit boundaries. (M6)
3. The sibling generator never produces a sibling whose step types differ from the original — failure mode is documented and falls back to Watch-only.
4. Each surface's `compare` function emits per-field tags consumable by `RevealView`'s side-by-side panel.
5. The Hint Stack (parent addendum) works across all surfaces — the canonical's annotation layers are surface-agnostic.
6. The Live Reviewer's `completedSteps` advances based on per-surface commit, not just transcription line count.

### Files touched

| File | Change |
|---|---|
| `primitives/annotated-example/try-surfaces/registry.ts` | NEW — surface registry shape |
| `primitives/annotated-example/try-surfaces/AlgebraHandwritingSurface.tsx` | NEW — extracted from current `TryItYourself` body |
| `primitives/annotated-example/try-surfaces/TableFillSurface.tsx` | NEW (M2) |
| `primitives/annotated-example/try-surfaces/GraphEditorSurface.tsx` | NEW (M3) |
| `primitives/annotated-example/try-surfaces/CaseSplitSurface.tsx` | NEW (M4) |
| `primitives/annotated-example/try-surfaces/DiagramLabelSurface.tsx` | NEW (M5) |
| `primitives/annotated-example/TryItYourself.tsx` | Render via registry; track per-step responses; surface-swap on commit |
| `service/annotated-example/judge.ts` | Generalize `compareWork` to consume `MultiModalResponse` and dispatch per-surface compares |
| `service/annotated-example/sibling.ts` | Add step-type-structure validation pass |

### Out of scope (defer)

- **Authoring new step types.** This addendum only covers the five Act 1 already supports. New step types are a separate track.
- **Cross-surface hints.** The hint stack is per-step; a hint that says "you'll need this graph for the next algebra step" is v3.
- **Surface-level eval modes.** Each surface could theoretically have IRT-tied difficulty parameters (cell count for tables, point-count for graphs). Defer until single-modality eval modes land for Act 2 (see IRT addendum).

---

## Feature: IRT Mastery Loop — Adaptive Difficulty for Act 2

> **Status:** Proposed addendum — closes the curriculum-integration gap with Act 1 and the broader ADAPT model.
> **Motivation:** The parent PRD's non-goals list says: *"No scoring or mastery signal. Challenge mode is formative; final compare returns a label, not a grade."* That non-goal is incompatible with how Lumina's adaptive engine works. Per project memory, the ADAPT model uses primitive P(correct) for theta updates and the ⓘ 4-gate mastery progression. A primitive that emits no signal is invisible to the curriculum engine — and Act 2 as drafted is exactly that. Worse, the sibling generator produces *same-difficulty* problems, so a student who solves five in a row is still on the same rung; a student who misses three is still on the same rung. The loop has no adaptation. This is the inverse of what Act 2 should be: where Act 1 measures via prediction gates, Act 2 should measure via **production**, which is a much stronger signal of mastery.

### What it should feel like

After a Try-It attempt completes, the verdict drives two things: a P(correct) update on the student's mastery profile for the underlying skill, and a difficulty bump for the next sibling. After two successive `correct` verdicts, the next "Try a new problem" produces a sibling at a higher difficulty rung. After two `incorrect`-verdict attempts, the next sibling steps down. The student feels the loop respond to their performance — they aren't grinding equivalent variants.

The verdict banner in Phase C surfaces this transparently: *"Two solid solves in a row — let's step it up."* or *"Let's try one closer in. You'll get this."* No grade, no percent — the rung name (e.g. "Approaching"), the direction of change, and the reason.

### Difficulty as a primitive contract, not a hand-tuned parameter

Per project memory's pure-IRT principle, difficulty is *not* a hand-coded urgency multiplier. It's a property of the sibling's IRT calibration — `b` parameter (item difficulty), `a` parameter (discrimination), `c` parameter (guessing floor). The sibling generator already author + hydrates problems; this addendum extends it to hit a target `b` band rather than implicit "same as original."

```ts
export interface SiblingDifficultySpec {
  /** Target item difficulty (theta). Negative = easier than canonical, positive = harder. */
  targetB: number;
  /** The skill's typical b-distribution, sampled from the calibration store. */
  skillBDistribution: { mean: number; std: number };
}
```

The sibling-author prompt receives `targetB` as a structural directive: *"Author a sibling whose canonical solve has approximately this b-difficulty (current item is at b=X, target is b=Y). Use coefficient size, sign-handling complexity, and step count to land in the target band."* Calibration is live — every Try-It attempt's verdict updates the catalog's b-estimate for that sibling.

### `MasterySignal` shape

Emitted on Phase C transition, consumed by the existing curriculum/ADAPT engine.

```ts
export interface MasterySignal {
  /** Skill ID this attempt targets — pulled from the original worked example's manifest. */
  skillId: string;
  /** Underlying primitive that produced the signal. Always 'annotated-example' here. */
  primitiveId: 'annotated-example';
  /** Sibling's IRT parameters at the time of attempt. */
  itemParams: { b: number; a: number; c: number };
  /** Verdict-derived correctness score in [0, 1]. */
  pCorrect: number;
  /** Hints used (from Hint Stack addendum). Each hint reduces effective pCorrect by a calibrated amount. */
  hintsUsed: HintRecord[];
  /** Wall-clock duration from Phase A start to Done. */
  durationMs: number;
  /** Whether the Live Reviewer flagged off-track lines mid-solve. */
  hadOffTrackLines: boolean;
}
```

Verdict → `pCorrect` mapping (initial calibration, refined over time):
- `correct` with no hints, no off-track: `1.0`
- `correct` with hints or off-track: scaled down by hint count and off-track count
- `partial` (some steps right, some wrong): `0.5`
- `incorrect`: `0.1` (not zero — attempting still produces a small signal)

The signal lands in the existing mastery pipeline — the curriculum engine uses it for theta updates and 4-gate progression. **No new heuristic multipliers** (per memory's pure-IRT principle): the verdict + IRT params + hint count are the signal; the engine does the rest.

### Difficulty bump policy

The "Try a new problem" CTA in Phase D consults a small policy module to choose the next sibling's `targetB`:

```ts
function nextTargetB(history: AttemptHistory, currentB: number, skill: SkillProfile): number {
  const recent = history.lastN(3);
  const correctStreak = recent.takeWhile(a => a.verdict === 'correct').length;
  const incorrectStreak = recent.takeWhile(a => a.verdict === 'incorrect').length;

  if (correctStreak >= 2) return currentB + skill.bStep;       // ramp up
  if (incorrectStreak >= 2) return currentB - skill.bStep;     // ramp down
  return currentB;                                              // hold
}
```

`skill.bStep` is calibrated per-skill — typically 0.5 to 1.0 theta units, reflecting the spacing of the skill's item bank. The policy is intentionally simple: **two-of-N adaptive**, no Bayesian update on the policy itself. The Bayesian work happens in the underlying mastery engine; this is just the next-item selector.

### `attemptHistory` persistence

Try-It attempts persist per (student, skill) so the difficulty-bump policy has memory across sessions:

```ts
export interface AttemptRecord {
  signal: MasterySignal;
  verdict: 'correct' | 'partial' | 'incorrect';
  attemptedAt: number;
  siblingProblemStatement: string;  // for student-visible "you've seen this before" check
}

export interface AttemptHistory {
  studentId: string;
  skillId: string;
  records: AttemptRecord[];
  /** Most recent siblingB; the next attempt's targetB derives from this. */
  currentB: number;
}
```

Stored in Firestore under `students/{uid}/tryItHistory/{skillId}`. Read on Try-mode mount, written on every Phase C transition. Idempotent on attempt-id; replays cleanly on session resume.

### Verdict banner — adaptive messaging

Phase C's verdict banner gains a difficulty-trajectory line below the existing summary:

```
✅ Correct.
Two solid solves in a row — your next problem will be a step harder. (b: 0.3 → 0.8)

[Try a new problem]   [Show me again]   [Done for now]
```

The b-delta is shown numerically only in dev mode; in production it's the rung name (Approaching → On-track → Mastery, mapped from b-bands). The student sees direction of change, never a raw theta.

### Acceptance criteria

1. After two successive `correct` verdicts on the same skill, the next sibling's `targetB` is greater than the previous attempt's by `skill.bStep`.
2. After two successive `incorrect` verdicts, the next sibling's `targetB` is lower by `skill.bStep`.
3. A `MasterySignal` is emitted to the curriculum pipeline on every Phase C transition, including for `incorrect` and `partial` verdicts.
4. Hints used reduce `pCorrect` deterministically — same verdict + same hint count produces the same signal.
5. The verdict banner displays the rung name and direction of change (not raw theta) in production.
6. `AttemptHistory` survives a page reload — re-entering Try mode for a known skill picks up at the right `currentB`.
7. The sibling generator never produces a problem outside the skill's authored b-distribution (capped at distribution.mean ± 2σ).

### Files touched

| File | Change |
|---|---|
| `service/annotated-example/sibling.ts` | Accept `targetB`; pass to author prompt as difficulty directive |
| `service/annotated-example/judge.ts` | Emit `MasterySignal` alongside `JudgeVerdict` from `compareWork` |
| `service/annotated-example/difficulty-policy.ts` | NEW — `nextTargetB` selector |
| `service/annotated-example/attempt-history.ts` | NEW — Firestore read/write for `AttemptHistory` |
| `app/api/lumina/route.ts` | New `recordAttempt` action; extend `compareWork` response |
| `primitives/annotated-example/RevealView.tsx` | Render rung name + direction in verdict banner |
| `primitives/annotated-example/TryItYourself.tsx` | Pass `currentB` to sibling generator; consume `nextTargetB` on "Try a new problem" |
| `backend/.../mastery_lifecycle.py` | Accept `MasterySignal` from annotated-example primitive (consumer side) |

### Out of scope (defer)

- **Per-student `a` and `c` calibration.** Initial `a`/`c` come from the skill's catalog priors; per-student refinement is a separate track in the broader IRT calibration work.
- **Cross-skill spillover.** A student who masters two-step linear equations should see a P(correct) bump on three-step too. The curriculum engine handles this; the primitive doesn't.
- **Hint-cost calibration.** Initial mapping of hint count → `pCorrect` discount uses static weights. Live calibration of hint cost is v2.
- **Difficulty floors and ceilings tied to grade level.** The current bump policy can drift outside grade band over time; a guardrail clamping `targetB` to the grade's b-range belongs here but is deferred to the second iteration.
