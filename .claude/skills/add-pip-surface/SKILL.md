---
name: add-pip-surface
description: >-
  Add or repair Pip's shared-surface interaction in a Lumina primitive, so Pip
  joins the primitive's workspace and looks at, points at, receives, or
  celebrates from the activity's own phases and the child's actions — with no
  tutor session required. Use when an existing primitive should share its
  workspace with Pip, for one primitive or a batch; new primitives get this at
  birth in /primitive Phase 2d, which follows this skill. Not for
  LLM-driven animation, tutor speech or hints (/add-tutoring-scaffold), or the
  judged spoken loop (/add-di-loop).
argument-hint: "<primitive-id> [more ids...] — e.g. ten-frame"
---

# Add Pip Surface

Make Pip share the learner's workspace for the primitive(s) in `$ARGUMENTS`, driven only by what happens inside each primitive.

**Outcome:** the primitive publishes a surface (dock, visible targets, pose derived from its phases); Pip's single body appears in that dock as soon as the surface engages — in the helper and in a lesson, with or without a tutor session; Pip's gestures never disclose an answer, advance the runner, or grade; phase tests and a layout drive show it.

## How Pip attaches (the canonical path)

**Primitive events → pure pose policy → surface store → one actor.** No step waits for a Gemini session.

- **Activation is event-driven** (`pip/PipSurfaceStore.ts`): the first surface to register gets Pip; after that, whichever surface's pose last changed into a non-idle phase (a start, a touch, a check, a cue) claims it. Hosts add claims — the lesson's focused section (`ManifestOrderRenderer`) and the tutor's active block (`LuminaAIProvider`) — but neither is a gate. A claim on a block with no surface parks Pip on its perch.
- **Tutor speech is an input, not a precondition.** It can put a surface into `introducing` (and so trigger a point); without a session there is simply no spoken cue. Classic primitives count speech only when `activePrimitiveId === instanceId` and it began on the current item (`useSpeechScope`).
- **Publishing needs no dependency list.** `usePipSurface(build)` re-runs the builder after every commit; the store ignores an unchanged surface, so passing an inline builder cannot loop.

Never gate a surface, the companion, or a test on `isConnected`.

## Source of truth

Under `my-tutoring-app/src/components/lumina/` — read before editing; search by symbol if moved.

- `pip/README.md` — model, per-primitive target table. Read first.
- `pip/PipSurfaceStore.ts`, `pip/PipSurfaceContext.tsx` — `PipPose`, activation, `usePipSurface`, `usePipTargets`.
- `pip/pipPhasePose.ts` — shared phase gate (celebrate only a confirmed item; neutral before start and over the previous item's audio tail; drop invisible targets). `pip/useSpeechScope.ts` for classic primitives.
- `pip/PipSurfaceActor.tsx`, `components/CuratorCompanion.tsx` — geometry, ring vs region outline, the single body.
- Reference integrations, one per family:

| Family | Reference | Phase inputs |
| --- | --- | --- |
| Judged, spoken answer | `SortingStation.tsx` | `useJudgedScriptRunner` |
| Judged, hands answer | `NumberSequencer.tsx` (order-cards), `CountingBoard.tsx` | runner + child touches, `receive` while judging |
| Classic, synchronous check | `ComparisonBuilder.tsx` | own check state + `useSpeechScope` |
| Classic, async check | `NumberTracer.tsx` | own check state; `receive` while evaluating |

Tests to copy: `pip/<Primitive>.surface.test.tsx`, `pip/PipSurfaceStore.test.ts`, `pip/MathPrimitivesTester.surface.test.tsx`.

**Contract first.** Read `docs/contracts/<primitive-id>.md` if it exists (`/primitive-contract --check` guards the edit). Pip wiring must not change learning behavior, support tiers, eval modes, or attempt gates.

**Shared working tree.** Other sessions may be editing the same primitive. Re-read a file immediately before patching it; many files are CRLF, so patch with the Edit tool or normalize line endings in scripts.

## Teaching contract

Before wiring, write down per eval mode: what the child must do independently, which objects Pip may attend to, and when a gesture would disclose an answer.

- **Point** only during this item's cue or correction, and only at WHERE the child works — a gap, a named card, the start of a line, a slot row, a whole workspace. Never at something that could be the answer.
- **If every tappable thing is an answer choice** (groups, numerals, trays, name buttons, tiles), point only at the region containing them.
- **Point at a single object only when the ask already names it or the screen already marks it** (a highlighted gap, the card the tutor named, a marked place). If a support tier withdraws that mark, Pip does not put it back.
- **Look** follows the child's own touch/focus, scoped to the current item (`usePipTargets`), or the cue target on a spoken item.
- **Receive** only while a hands answer (arrangement, split, drawing, order) is being judged. It never moves, accepts, or submits anything.
- **Celebrate** only a confirmed result or a held reveal — never a tap or the end of speech.
- **Hidden, covered, or removed objects are never published**, even when code knows where they are.
- **Dock placement:** between the cue target and the answer surfaces, so a pointer to the cue never crosses a choice. A region target (over 140px or elongated) gets an outline with no connector line; only small objects get a ring and line.

## Phase 1 — Implement (per primitive; batch by family)

1. **Policy** — `pip/<primitiveId>PipPose.ts`: extend `PipPhaseGate`, decide `cueId` / `attendId` / `handover` per mode, return `pipPhasePose(state, attention)`. Keep it pure; no timers.
2. **Targets** — `const pip = usePipTargets(currentItem?.id ?? null, <existing attempt gate>)`. Attach `ref={pip.ref('id')}` and `data-pip-object="id"` to each eligible element; call `pip.look('id')` in the child's existing handlers (pointer/focus/click), never replacing them; call `pip.clear()` where the primitive resets an item.
3. **Publish** — `const pipStore = usePipSurface(() => { … })` with an inline builder: return `null` without a dock, item, or once finished; otherwise `{ instanceId, scopeId: item.id, label, dock: pip.dock.current, targets: pip.targets(visibleIds?), pose }`. Pass `visibleIds` when some registered elements are hidden.
4. **Dock** — `{pipStore && <div ref={pip.dock} data-pip-dock={instanceId} className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}` at the position the teaching contract requires.
5. **Classic primitives only** — `tutorSpeaking = isAudioPlaying && activePrimitiveId === instanceId`; `cueMatchesItem = !tutorSpeaking || useSpeechScope(item.id, tutorSpeaking)`.

## Phase 2 — Host

Nothing to connect. Check only:
- The helper's `case '<primitive-id>'` in `components/MathPrimitivesTester.tsx` (or `LanguageArtsPrimitivesTester.tsx`) passes the preview `instanceId` into `data` (several primitives were missing it); lessons get it from `ManifestOrderRenderer`. The DI Lab passes one for every pack.
- The primitive uses `data.instanceId` for evaluation, tutoring, and the surface alike.
- Primitives without a surface need no change; the companion's perch covers them.

## Phase 3 — Verify

Commands (absolute `cd`, see root `CLAUDE.md`):

```bash
cd "<abs>/my-tutoring-app" && npm test -- src/components/lumina/pip/ <the primitive's existing suites>
cd "<abs>/my-tutoring-app" && npm run typecheck:lumina        # must be 0
cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit   # count vs baseline
```

1. **Phase tests (the primary evidence)** — `pip/<Primitive>.surface.test.tsx`: mock `useJudgedScriptRunner` (or `useLuminaAI` for classic) into each phase and assert `store.getActive()?.pose` for: the cue per eval mode (including where Pip must NOT point), a child touch → `look`, a hands judgement → `receive`, a confirmed result → `celebrating`, an item change dropping the touch, hidden targets absent, unmount clearing the store. Classic: speech for another block is ignored. Runner mocks need `onItemOpened` called on item change when the primitive lays out its board there; evaluation mocks need `useEvaluationContext` if a feedback card renders.
2. **Attach test** — `pip/MathPrimitivesTester.surface.test.tsx` renders the real helper, companion, and actor with no session; it must stay green.
3. **Layout drive (real browser, no tutor)** — needs the dev server on :3000 (never start a second one; if nothing listens, start one) and the backend on :8000. Copy `scripts/pipdrive.mjs` and `scripts/summarize.mjs` from this skill into your scratchpad, `npm install playwright-core@1.52.0` there, then:
   ```bash
   node pipdrive.mjs "<Helper label>" "<Eval mode label or empty>" 1400 20 'wait:;click:[data-pip-object="…"]'
   node summarize.mjs <printed out dir>/log.json
   ```
   Expect `bodies=1 inDock=true anchor=true` before any start, `look` after touches, no `OVERLAP` / `PAGE-OVERFLOW-X`, and a new dock with one body after regeneration. Repeat at `760`. Literacy primitives live in the Language Arts helper: prefix the same command with `PIP_HELPER="Language Arts"`. DI primitives live in the Direct Instruction Lab, not the math helper: use `scripts/didrive.mjs "<family short label>" "<eval_mode_id>" …` with the same actions (start the run with `start`; click a `data-pip-object` first to scroll the primitive into the screenshot). To see pointer geometry, add `start;speak:3` (signs in with the test account and injects silent tutor audio); check the screenshot that the ring or outline sits on the intended target and no connector crosses an answer choice.

Pip Lab and `/lumina/pip-surface` demo the actor; they do not verify a primitive. State plainly what was not exercised (reduced motion, mouth timing against real speech, lesson scroll handoff).

## Finish

Report the supported primitives and modes with where Pip points and never points, how to try them in the helper, test and gate results, drive results, and limitations. Add the primitive to the table in `pip/README.md`. If the work belongs to a queued item, close it in its queue and `WORKSTREAMS.md` (`/pm`).
