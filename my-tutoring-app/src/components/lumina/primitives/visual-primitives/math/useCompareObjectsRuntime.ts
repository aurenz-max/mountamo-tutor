'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JudgedScriptRun } from '../../../hooks/useJudgedScriptRunner';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import { heardNumber } from '../../../components/live-activity/runtime/liveScaffolds';
import { askFor, compareScaffoldsFor, type CompareObjectsItem, type CompareScaffold }
  from './compareObjectsScript';

/**
 * Compare objects' live-runtime adapter (di-runner family, ten-frame shape).
 *
 * The runner asks, judges and advances, so NO `advance` and NO `retry`: a tutor
 * clock beside the runner's is the defect the judged family exists to prevent,
 * and the correction line — not a tutor action — is what re-arms a wrong item.
 * `point` is withheld because on `compare_two` and `order_three` indicating an
 * object IS the answer, and on `identify_attribute` there is nothing to point at
 * but the objects themselves.
 *
 * NO SUPPORT DETOUR. `LiveRuntimeSurface` draws one row of counters and states
 * HOW MANY. Every mode here compares a continuous attribute — length, height,
 * weight, capacity — which a count of discrete counters cannot express. Even
 * `non_standard`, which ends in a number, is about iterating a unit end to end
 * rather than counting a scattered set. `supportArtifacts` is empty and
 * `request_support` is never offered. `suspension` is still wired, because a
 * learner stop quiesces the runner through it.
 */

export function useCompareObjectsRuntime({ runner, instanceId, objectiveId, planItemId, evalMode, placedOrder }: {
  runner: JudgedScriptRun<CompareObjectsItem>;
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  /** order_three: the names currently placed, in the child's order. */
  placedOrder: readonly string[];
}) {
  const latest = useRef({ runner, placedOrder });
  latest.current = { runner, placedOrder };
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<CompareScaffold | null>(null);

  const evidenceNow = () => {
    const { runner, placedOrder } = latest.current;
    const state = runner.runtimeControls.getState();
    return { said: state.heard ? state.heard.toLowerCase() : null,
      saidNumber: heardNumber(state.heard), placed: placedOrder,
      wrongNow: state.correctness === 'incorrect' };
  };

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId, objectiveId: objectiveId || 'compare-objects-practice',
    planItemId: planItemId || instanceId, primitiveId: 'compare-objects', evalMode,
    adapter: {
      getTutorState: () => {
        const { runner, placedOrder } = latest.current;
        const state = runner.runtimeControls.getState(), item = state.item;
        return {
          itemId: item?.id ?? 'ready',
          phase: state.suspended ? 'help' : state.stage,
          task: item ? askFor(item) : 'Start the comparing lesson',
          completed: state.stage === 'done',
          evidence: {
            attemptNumber: state.attempts, correctness: state.correctness,
            recentResponses: state.heard
              ? [{ response: state.heard, source: 'speech' as const, recognition: 'clear' as const }] : [],
          },
          // Task identity plus the child's own work. `answerNames`, the attribute
          // on an identify ask and `unitCount` are answers and stay out.
          demand: {
            kind: item?.kind ?? 'ready',
            response: item?.answerKind ?? 'voice',
            objectsOnScreen: item?.objectNames.length ?? 0,
            placedOrder: placedOrder.join(','),
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
        // A committed arrangement owns its verdict; replaying a settled gesture
        // on return is not certified on this family either.
        return s.running && !s.suspended
          && !(s.item?.answerKind === 'gesture' && s.stage === 'judging');
      },
      getAffordances: () => {
        const s = latest.current.runner.runtimeControls.getState();
        if (!s.running || s.suspended) return [];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' }, responseSpeech: 'runner',
          description: 'Ask this same comparison again; the runner speaks the question. '
            + 'Nothing is moved, lined up, measured or revealed.',
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
        for (const scaffold of compareScaffoldsFor(s.item, evidenceNow())) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.item!);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this reminder, for when ${scaffold.when}: "${text}". `
              + 'This does not move, line up or measure anything, and it never says the answer.',
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
  const placedKey = placedOrder.join(',');
  useEffect(() => {
    changed();
    if (runner.stage === 'done') runtime?.requestCompletion();
  }, [changed, runtime, runner.currentIndex, runner.stage, runner.suspended, corrections, attempts, placedKey, hint]);
  useEffect(() => { shown.current = null; setHint(null); }, [runner.currentIndex]);
  return runtime ? hint : null;
}
