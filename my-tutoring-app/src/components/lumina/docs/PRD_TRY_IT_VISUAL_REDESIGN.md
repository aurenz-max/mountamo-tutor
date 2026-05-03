# Visual Update Plan: Making Try-It Feel Like a Studio, Not a Chat

> **Author:** PM perspective
> **Status:** Draft for review
> **Created:** 2026-05-02
> **Domain:** AnnotatedExample Try-It surface (Act 2)
> **Premise:** The loop works. The *vibe* doesn't. Right now Try-It reads as "canvas + sidebar + verdict modal" — the same skeleton as a coding assistant or a chatbot with a scratch area. We need it to feel like a craft tool: the student's work is the centerpiece, the system is ambient, and feedback shows up *in the medium of the work itself*, not in chat-bubble adjacent UI.

---

## 1. Diagnosis — why it feels chatbot-y

Six concrete signals from the current screenshots:

1. **The transcription rail is geographically disconnected from the canvas.** The student writes on the left, their "real" work appears as KaTeX 320px to the right. It's a separate column with its own header, like a chat log. The visual relationship to the strokes is zero.

2. **Coaching is text in a sidebar.** "On track — next isolate x" lives in a thin band the student has to refocus to read. It's not on their work.

3. **Status pills are tiny pill-shaped badges.** Generic UI vocabulary. Could be from any SaaS dashboard. They're informational, not pedagogical — they don't *mean anything visually*.

4. **The reveal is a two-column grid.** Symmetric, dense, scrollable. Reads as a diff view. The verdict banner is the only emotional moment — and it's a card.

5. **The canonical solution column dominates the reveal.** Five annotation layers stacked vertically with colored left borders. This is the same density as Watch mode — fine for studying, wrong for "you just did the work, here's what stood out."

6. **No persistent identity for the student's solve.** Their three lines could be anyone's three lines. There's no celebration of *their* attempt as an artifact.

The throughline: **every piece of feedback has been parked in a UI region adjacent to the work, instead of attached to it.**

---

## 2. Design principles for the redesign

1. **The canvas IS the document.** Strokes are the primary medium. Everything that happens during Try-It either confirms what's on the canvas or annotates it — never replaces it.

2. **Feedback lives where the eye already is.** If the student just wrote line 2, the response should appear *next to line 2*, not in a sidebar 320px away.

3. **Status is structural, not informational.** "Aligned" / "off-track" should change the *form* of what's displayed (a step number bubble, a connector line, a parallel timeline), not just append a pill.

4. **The reveal is a duet, not a diff.** Side-by-side comparison reads as adversarial. The student did the work; the canonical confirms or corrects. Visual hierarchy should make the student's solve the protagonist.

5. **Moments deserve moments.** Reaching all canonical steps, getting `correct`, hitting a streak — these are the emotional beats of learning. They each deserve a beat of motion or color, not just a state change.

---

## 3. The plan — five visual moves

### Move 1: Collapse the rail into the canvas margin

**Today:** 320px right rail, full-height, separate column.
**Future:** A narrow "transcription gutter" — 120-160px — pinned to the *right edge of the canvas*, sharing its background. Each transcribed line sits horizontally adjacent to the strokes that produced it (line 1 of KaTeX rendered at the vertical position of the first stroke cluster, line 2 next to the second cluster, etc.).

Think Google Docs comment threads, except it's the student's own work being mirrored. Lines aren't "in a list" — they're *floating beside the strokes that authored them*, like marginalia.

**Implementation note:** the canvas already has stroke-cluster spatial data. The transcribe call already returns ordered KaTeX. We just need a "vertical anchor" estimate per line — the y-centroid of the strokes that contributed to it. Backing off to a stacked list when anchoring fails is fine.

**Status pills** (✓ ↗ ⚠) move from "left edge of pill row" to "left edge of the gutter at that line's anchor y" — they read as track markers along the side of the canvas, not as decorations on a chat log entry.

### Move 2: Replace the progress band with a "step ledger" along the canvas top edge

**Today:** Progress band — a strip with `Now you try · Step 2 of 4 · ●●○○ · headline`.
**Future:** A horizontal step ledger spanning the top of the canvas. Each canonical step is a *named slot* — "Isolate the variable", "Solve for x", "Verify" — rendered as a thin horizontal lozenge. As the student's work satisfies a step, that slot fills with a soft animated wash of the step's annotation color (emerald for steps, violet for strategy moments).

This solves three problems simultaneously:
- The student sees the *shape of the solve* before they start (preview without spoiling — names, not work).
- Each step has identity ("I'm working on 'Isolate the variable'") instead of just an ordinal.
- Filled slots are a public progress signal that's part of the workspace, not a separate band.

The headline ("On track — keep going") moves from right-aligned text to a single-line caption *under the active slot*, ambient and soft.

### Move 3: Coaching messages become canvas overlays, not rail text

**Today:** Off-track / on-track messages render as italic text inside the rail line card.
**Future:** Coaching messages render as **soft floating callouts** anchored to the relevant region of the canvas:

- **On-track confirmation**: a thin emerald arc + small badge near the bottom-right of the strokes that earned it. Fades after 3s — leaves a subtle persistent emerald outline on those strokes.
- **Off-track redirect**: a coral pin attached to the strokes in question, with a one-line message and a "Got it" dismiss. Doesn't block, doesn't cover. The pin's leader line points back to the relevant prior canonical step's slot in the step ledger (Move 2) — making "what to re-check" *visually navigable*.
- **Shortcut acknowledgment**: a cyan ribbon spanning two slots in the step ledger, signalling "you collapsed these two".

These callouts persist on the canvas across the rest of the solve. The student's work *accumulates annotations* — the canvas becomes a richer artifact as they go. This is the single biggest "tool, not chatbot" move.

### Move 4: The reveal becomes a "score sheet" framed around the student's solve

**Today:** Verdict banner at top, two-column comparison below, canonical right column overwhelms with five annotation layers.
**Future:** A narrative-shaped reveal:

**Hero:** the student's transcribed lines, rendered LARGE and centered — their solve is the protagonist. Each line's status is shown as a *visual property of the line itself*: aligned lines render in clean white KaTeX with a subtle emerald underglow; off-track lines render with the relevant token tinted coral; shortcut lines have a cyan vertical bar to their left spanning multiple "implied" steps. No pills, no notes attached as separate text. The status *is* the formatting.

**Below the hero, a single "what the rubric would say" inline annotation per line** — not a sidebar, not a column. Inline. Italic. Slate-400. Cites misconception when relevant.

**Beneath the hero, an "expand the worked solution" affordance** — collapsed by default. Tapping it reveals the canonical with annotation layers, but as a *secondary read*, not a parallel column. The student studies it if they want; it doesn't compete with their solve for visual attention.

**Verdict moment:** the verdict word — "Correct", "Almost", "Not yet" — appears as a **large serif word** floating above the hero, with a single sentence summary. No card, no border, no badge. The typography itself is the verdict. Animate it in with motion.

This kills the diff-view feel and replaces it with: *"Here's what you did. Here's what stood out about it. Here's the rubric if you want to study."*

### Move 5: A persistent "session shape" across attempts

**Today:** Each Try-It is amnesiac. New problem → blank canvas → repeat.
**Future:** A small **session strip** at the very bottom of the surface (24-32px). One filled bubble per attempt this session — green/amber/red dot per verdict, with the problem statement on hover. Resets on close. Across "Try a new problem" cycles, the strip grows.

This is tiny but it signals: *you're in a practice session, not answering a one-off question*. Adds rhythm and continuity without forcing a structure. Reuses zero existing data — purely client-side visual memory.

---

## 4. Polish layer (across all moves)

**Typography**: KaTeX renders are currently uniform size everywhere. In the new reveal, the student's solve should be 1.5–2x larger than the canonical column. Hierarchy via *scale*, not just position.

**Motion**: today the only animation is `motion.div` opacity fade-in. Add:
- Step ledger slots: smooth color wash on completion (300ms ease-out)
- Off-track pin: gentle horizontal shake on first appearance, then settle
- Verdict word: a 1s reveal — letters cascade in from below
- Done button when all-steps-complete: not a pulse (currently shouty), but a soft emerald *breath* — slow expand/contract, calm

**Color semantics**: codify and reuse. Emerald = aligned/correct. Cyan = shortcut/connection. Rose = error/off-track. Amber = partial/low-confidence. Violet = strategy. Apply consistently across canvas annotations, step ledger, rail, reveal hero. Don't introduce new colors per surface.

**Sound (optional, later)**: the on-track confirmation could have a single warm tone (1 note, ~300ms). The all-steps-complete moment could have a small two-note rise. Sound is a powerful "this is a tool, not a webpage" signal — but only if it's tasteful and mutable.

---

## 5. What this unlocks (PM-facing rationale)

| Move | Student feeling shift | Strategic upside |
|------|----------------------|------------------|
| 1. Margin gutter | "My work is the document" | Unblocks multi-modal Try-It — graph editor and table surfaces also get a margin gutter, free pattern reuse |
| 2. Step ledger | "I see the shape of what I'm doing" | Anchors the Hint Stack — hint buttons live *under their step's slot*, not in a generic stack |
| 3. Canvas overlays | "The system is paying attention to *my work*" | Removes the chatbot ceiling — feedback density can grow without becoming sidebar bloat |
| 4. Hero reveal | "What I made matters" | Differentiates the brand. Every adaptive learning tool has a verdict modal. None have a hero reveal. |
| 5. Session strip | "I'm in flow, not in a transaction" | Sets up streak/spaced-practice mechanics later without dedicated UI |

---

## 6. Phased rollout

**V1 — Hero reveal + verdict typography (1 PR).** Highest perceived-quality lift, contained scope, no canvas changes. Replaces the current two-column reveal.

**V2 — Step ledger (1 PR).** Replaces the progress band. Introduces the "named slot" pattern. Drives downstream coupling for hints.

**V3 — Margin gutter (1 PR).** Refactors the rail into a canvas-anchored gutter. Largest visual lift, biggest layout change. Likely reveals edge cases worth iterating on.

**V4 — Canvas overlays (1 PR).** Off-track pins, on-track outlines, shortcut ribbons. Builds on V3's anchoring infrastructure.

**V5 — Polish (1 PR).** Motion, typography scale, color codification, optional sound.

**V6+ — Session strip, hint slot integration, multi-modal margin gutters.**

---

## 7. Risks

1. **Spatial anchoring (Move 1, 3) depends on stroke-to-line correspondence the transcriber doesn't currently emit.** Mitigation: y-centroid heuristic + graceful fallback to stacked list. We don't need perfect, just close.
2. **The hero reveal (Move 4) inverts a familiar pattern (diff view).** Some students may want the side-by-side. Mitigation: one toggle in V5, not V1.
3. **Canvas overlays (Move 3) could clutter long solves.** Mitigation: auto-fade old confirmations, cap pins at 3, "clear annotations" affordance.
4. **Effort.** This is 4-6 weeks of frontend work. Don't ship it instead of the IRT loop or Hint Stack — ship it *alongside* (the moves are independent enough to interleave).

---

## 8. Recommendation

Ship in this order: **V1 (hero reveal) first**, because it's the single biggest "this isn't a chatbot" signal and it's contained. Then **V2 (step ledger)** because it's the prerequisite for the Hint Stack to land cleanly. Then evaluate — if the perceived-quality jump is enough, V3-V6 can be paced with feature work; if not, prioritize V3 (margin gutter) next as the next big UX move.
