'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JudgedScriptRun } from '../../../hooks/useJudgedScriptRunner';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import { heardNumber } from '../../../components/live-activity/runtime/liveScaffolds';
import { askFor, shapeScaffoldsFor, type ShapeScaffold, type ShapeSorterItem } from './shapeSorterScript';

/**
 * Shape sorter's live-runtime adapter (di-runner family, ten-frame shape).
 *
 * The runner asks, judges and advances, so NO `advance` and NO `retry`: a tutor
 * clock beside the runner's is the defect the judged family exists to prevent,
 * and the correction line — not a tutor action — is what re-arms a wrong item.
 * `point` is withheld because the ask already RINGS the shape it means: a tutor
 * point would either repeat that ring or indicate a mat, which is the answer on
 * `sort`.
 *
 * NO SUPPORT DETOUR. `LiveRuntimeSurface` draws a row of identical counters and
 * states a total. Two of these modes are about FORM — what a shape is, which mat
 * it belongs on — and identical counters have no form to compare. The third,
 * `count`, counts a shape's own sides and corners rather than a set of separate
 * objects, so a row of counters would model the wrong thing. `supportArtifacts`
 * is empty and `request_support` is never offered. `suspension` is still wired,
 * because a learner stop quiesces the runner through it.
 */

export function useShapeSorterRuntime({ runner, instanceId, objectiveId, planItemId, evalMode }: {
  runner: JudgedScriptRun<ShapeSorterItem>;
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
}) {
  const latest = useRef({ runner });
  latest.current = { runner };
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<ShapeScaffold | null>(null);

  const evidenceNow = () => {
    const state = latest.current.runner.runtimeControls.getState();
    return { said: state.heard ? state.heard.toLowerCase() : null,
      saidNumber: heardNumber(state.heard), wrongNow: state.correctness === 'incorrect' };
  };

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId, objectiveId: objectiveId || 'shape-sorter-practice',
    planItemId: planItemId || instanceId, primitiveId: 'shape-sorter', evalMode,
    adapter: {
      getTutorState: () => {
        const state = latest.current.runner.runtimeControls.getState(), item = state.item;
        return {
          itemId: item?.id ?? 'ready',
          phase: state.suspended ? 'help' : state.stage,
          task: item ? askFor(item) : 'Start the shapes lesson',
          completed: state.stage === 'done',
          evidence: {
            attemptNumber: state.attempts, correctness: state.correctness,
            recentResponses: state.heard
              ? [{ response: state.heard, source: 'speech' as const, recognition: 'clear' as const }] : [],
          },
          // Task identity only. `shape` is the answer under `identify` and hands
          // the count away under `count`, so it is not published here, and
          // neither is `answer` or `countNumeral`.
          demand: {
            kind: item?.mode ?? 'ready',
            response: item?.answerKind ?? 'voice',
            drawnAsObject: item?.realObject ? 'yes' : 'no',
            matsNamed: item?.namesChoices ? 'yes' : 'no',
          },
          support: {
            level: shown.current ? (shown.current.matches ? 2 : 1) : 0,
            answerExposure: 'none' as const,
            ...(shown.current ? { instruction: shown.current.hint(item!) } : {}),
          },
        };
      },
      canYieldForHelp: () => {
        const s = latest.current.runner.runtimeControls.getState();
        return s.running && !s.suspended
          && !(s.item?.answerKind === 'gesture' && s.stage === 'judging');
      },
      getAffordances: () => {
        const s = latest.current.runner.runtimeControls.getState();
        if (!s.running || s.suspended) return [];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' }, responseSpeech: 'runner',
          description: 'Ask about this same shape again; the runner speaks the question. '
            + 'Nothing is sorted, moved, counted or revealed, and no new shape is ringed.',
          assistance: { level: 1, answerExposure: 'none' },
          execute: () => latest.current.runner.runtimeControls.replay(),
        }];
        // Fading is per strategy: only the aid actually painted offers its -1.
        if (shown.current) actions.push({
          action: { type: 'scaffold', strategyId: shown.current.strategyId, direction: -1 },
          description: 'Hide the reminder that is showing',
          assistance: { level: 0, answerExposure: 'none' },
          execute: () => { shown.current = null; setHint(null); return true; },
        });
        for (const scaffold of shapeScaffoldsFor(s.item, evidenceNow())) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.item!);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this reminder, for when ${scaffold.when}: "${text}". `
              + 'This does not sort, move, ring or count anything, and it never says the answer.',
            assistance: { level: scaffold.matches ? 2 : 1, answerExposure: 'none' },
            execute: () => { shown.current = scaffold; setHint(text); return true; },
          });
        }
        return actions;
      },
      suspension: {
        // The runner's own suspend clears the stillness timer, the stimulus arm and
        // every cue hold, which is every timer this primitive owns.
        suspend: () => latest.current.runner.runtimeControls.suspend(),
        resume: () => latest.current.runner.runtimeControls.resume(),
      },
    },
  }), [instanceId, objectiveId, planItemId, evalMode]);

  const { runtime, changed } = usePrimitiveRuntime(mount);
  useEffect(() => {
    // StrictMode replays registration while the same runner stays live.
    if (runtime && latest.current.runner.runtimeControls.getState().running) runtime.grantOwnership('runner');
  }, [runtime, mount]);
  const corrections = runtime ? runner.runtimeControls.getState().corrections : 0;
  const attempts = runtime ? runner.runtimeControls.getState().attempts : 0;
  useEffect(() => {
    changed();
    if (runner.stage === 'done') runtime?.requestCompletion();
  }, [changed, runtime, runner.currentIndex, runner.stage, runner.suspended, corrections, attempts, hint]);
  useEffect(() => { shown.current = null; setHint(null); }, [runner.currentIndex]);
  return runtime ? hint : null;
}
