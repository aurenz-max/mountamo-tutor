'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JudgedScriptRun } from '../../../hooks/useJudgedScriptRunner';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { CounterSupport, ExecutableAffordance, RuntimeMount, StepSequenceSupport } from '../../../components/live-activity/runtime/contract';
import { askFor, type TenFrameItem } from './tenFrameScript';

function hintFor(item?: TenFrameItem | null) {
  return item?.kind === 'make_ten' ? 'Look at the empty spaces. Count each empty space once.'
    : item?.kind === 'subtract' ? 'Move away one counter at a time. Count the counters that stay.'
      : 'Place one counter at a time. Touch each counter once as you count.';
}

/** Prepared nearby example; never replace or solve the unfinished item. */
export function tenFrameExample(item: TenFrameItem): Array<CounterSupport | StepSequenceSupport> {
  if (item.kind === 'make_ten') {
    // Making ten is a PROCESS (see what is there, count the gaps, fill them), so it is
    // explained in steps on a different frame rather than shown as one finished row.
    const shown = item.shown === 6 ? 4 : 6, more = item.capacity - shown;
    return [{ id: `example-${item.id}`, kind: 'step-sequence', title: 'Fill another frame, step by step',
      frames: [
        { segments: [{ count: shown, tone: 'plain' }, { count: more, tone: 'empty' }], caption: `${shown} counters are on the frame.` },
        { segments: [{ count: shown, tone: 'plain' }, { count: more, tone: 'marked' }], caption: `Count the empty spaces. There are ${more}.` },
        { segments: [{ count: shown, tone: 'plain' }, { count: more, tone: 'added' }], caption: `${shown} and ${more} make ${item.capacity}.` },
      ],
      altText: `Three steps on a frame of ${item.capacity} spaces. Step 1: ${shown} counters are on the frame. `
        + `Step 2: the ${more} empty spaces are counted. Step 3: ${more} more counters fill them, so ${shown} and ${more} make ${item.capacity}.`,
      provenance: 'prepared', answerExposure: 'partial' }];
  }
  if (item.kind === 'subtract') {
    const total = item.shown === 7 ? 6 : 7;
    const removed = total - 2 === item.answer ? 3 : 2;
    return [{ id: `example-${item.id}`, kind: 'counter-example', operation: 'subtract', title: 'Try taking away with counters',
      total, removed, altText: `Start with ${total} counters. Cross out ${removed}. ${total - removed} remain.`,
      provenance: 'prepared', answerExposure: 'partial' }];
  }
  if (item.kind === 'build') {
    const total = item.answer === 4 ? 3 : 4;
    return [{ id: `example-${item.id}`, kind: 'counter-example', operation: 'count', title: 'Build another group',
      total, removed: 0, altText: `Place one counter at a time. Count each counter once to build ${total}.`,
      provenance: 'prepared', answerExposure: 'partial' }];
  }
  return [];
}

export function useTenFrameRuntime({ runner, instanceId, objectiveId, planItemId, evalMode, filledCells, flippedCells, cancelPresentation }: {
  runner: JudgedScriptRun<TenFrameItem>; instanceId: string; objectiveId?: string; planItemId?: string;
  evalMode: string; filledCells: Set<number>; flippedCells: Set<number>;
  cancelPresentation: () => void;
}) {
  const latest = useRef({ runner, filledCells, flippedCells, cancelPresentation }); latest.current = { runner, filledCells, flippedCells, cancelPresentation };
  const [hint, setHint] = useState(false);
  const hintRef = useRef(false);
  const mount = useMemo<RuntimeMount>(() => ({ instanceId, objectiveId: objectiveId || 'ten-frame-practice',
    planItemId: planItemId || instanceId, primitiveId: 'ten-frame', evalMode,
    adapter: {
      getTutorState: () => {
        const { runner, filledCells, flippedCells } = latest.current;
        const state = runner.runtimeControls.getState(), item = state.item;
        return { itemId: item?.id ?? 'ready', phase: state.suspended ? 'help' : state.stage,
          task: item ? askFor(item) : 'Start the ten-frame lesson', completed: state.stage === 'done',
          evidence: { attemptNumber: state.attempts, correctness: state.correctness,
            recentResponses: state.heard ? [{ response: state.heard, source: 'speech', recognition: 'clear' }] : [] },
          demand: { kind: item?.kind ?? 'ready', response: item?.answerKind ?? 'voice',
            filledCells: Array.from(filledCells).sort((a,b) => a-b).join(','), flippedCells: Array.from(flippedCells).sort((a,b) => a-b).join(',') },
          // The task's own quantities as data: what the tutor diagnoses from, and what a
          // composed move is priced against. Never the answer.
          ...(item ? { values: { onFrame: item.shown, frameSize: item.capacity } } : {}),
          support: { level: hintRef.current ? 1 : 0, answerExposure: 'none',
            ...(hintRef.current ? { instruction: hintFor(item) } : {}) } };
      },
      canYieldForHelp: () => {
        const s = latest.current.runner.runtimeControls.getState();
        return s.running && !s.suspended && s.item?.kind !== 'subitize'
          // A committed gesture owns its verdict. Mid-build support is safe;
          // replaying a fully committed gesture on return is not certified yet.
          && !(s.item?.answerKind === 'gesture' && s.stage === 'judging');
      },
      getAffordances: () => {
        const s = latest.current.runner.runtimeControls.getState();
        if (!s.running || s.suspended || s.item?.kind === 'subitize') return [];
        const actions: ExecutableAffordance[] = [{ action: { type: 'replay' }, responseSpeech: 'runner', description: 'Repeat this task with the same frame; the runner speaks the question',
          assistance: { level: 1, answerExposure: 'none' }, execute: () => latest.current.runner.runtimeControls.replay() }];
        if (s.item && ['make_ten', 'subtract', 'build'].includes(s.item.kind)) actions.push({
          action: { type: 'scaffold', strategyId: 'one-counter-at-a-time', direction: hintRef.current ? -1 : 1 },
          description: hintRef.current ? 'Hide the counting reminder' : `Show this text reminder: "${hintFor(s.item)}". This does not highlight or move counters.`,
          assistance: { level: hintRef.current ? 0 : 1, answerExposure: 'none' },
          execute: () => { hintRef.current = !hintRef.current; setHint(hintRef.current); return true; },
        });
        return actions;
      },
      suspension: { suspend: () => { latest.current.cancelPresentation(); latest.current.runner.runtimeControls.suspend(); }, resume: () => latest.current.runner.runtimeControls.resume() },
      get supportArtifacts() {
        const s = latest.current.runner.runtimeControls.getState();
        return s.running && s.item ? tenFrameExample(s.item) : [];
      },
      // What this workspace draws, and the other models a support may use for the same
      // quantity. `counters` is what the built shapes draw; `fingers` and `story-objects`
      // are reachable only by a drawn picture. `ten-frame` is absent by design: the
      // 2026-09-18 failure was a second ten frame beside a child stuck on a ten frame.
      representation: 'ten-frame',
      alternateRepresentations: ['counters', 'fingers', 'story-objects'],
      // A support's numbers must be NEARBY: they may show neither this item's answer nor
      // the count already on this frame, since either one drawn on a ten frame shows the other.
      drawsTask: counts => {
        const item = latest.current.runner.runtimeControls.getState().item;
        return !item || counts.includes(item.answer) || (item.shown > 0 && counts.includes(item.shown));
      },
    },
  }), [instanceId, objectiveId, planItemId, evalMode]);
  const { runtime, changed } = usePrimitiveRuntime(mount);
  useEffect(() => {
    // StrictMode replays registration while the same runner remains live.
    // Restore its ownership only if its prior speech holds have settled.
    if (runtime && latest.current.runner.runtimeControls.getState().running) runtime.grantOwnership('runner');
  }, [runtime, mount]);
  const corrections = runtime ? runner.runtimeControls.getState().corrections : 0;
  const attempts = runtime ? runner.runtimeControls.getState().attempts : 0;
  useEffect(() => {
    changed();
    if (runner.stage === 'done') runtime?.requestCompletion();
  }, [changed, runtime, runner.currentIndex, runner.stage, runner.suspended, corrections, attempts, filledCells, flippedCells, hint]);
  useEffect(() => { hintRef.current = false; setHint(false); }, [runner.currentIndex]);
  return runtime && hint ? hintFor(runner.currentItem) : null;
}
