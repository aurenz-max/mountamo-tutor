'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JudgedScriptRun } from '../../../hooks/useJudgedScriptRunner';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import { heardNumber } from '../../../components/live-activity/runtime/liveScaffolds';
import { askFor, placeValueScaffoldsFor, saidPlaceOf, type PlaceValueItem, type PlaceValueScaffold }
  from './placeValueScript';

/**
 * Place value chart's live-runtime adapter (di-runner family, ten-frame shape).
 *
 * The runner asks, judges and advances, so NO `advance` and NO `retry`: a tutor
 * clock beside the runner's is the defect the judged family exists to prevent,
 * and the correction line — not a tutor action — is what re-arms a wrong item.
 * `point` is withheld for a reason specific to this chart: indicating a column
 * IS the answer on `find_place`, and on `build_number` the columns are the
 * child's own writing surface.
 *
 * NO SUPPORT DETOUR. `LiveRuntimeSurface` draws a single row of counters and
 * states a total. Place value is about POSITION carrying magnitude — the same
 * digit worth a different amount in a different column — and a flat row of
 * identical counters has no positions to carry it. `supportArtifacts` is empty
 * and `request_support` is never offered. `suspension` is still wired, because
 * a learner stop quiesces the runner through it.
 */

export function usePlaceValueRuntime({ runner, instanceId, objectiveId, planItemId, evalMode, digitsByPlace }: {
  runner: JudgedScriptRun<PlaceValueItem>;
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  /** build_number: what the child has written, keyed by chart place. */
  digitsByPlace: Record<number, string>;
}) {
  const latest = useRef({ runner, digitsByPlace });
  latest.current = { runner, digitsByPlace };
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<PlaceValueScaffold | null>(null);

  const filledCount = () => Object.values(latest.current.digitsByPlace).filter(d => d !== '').length;

  const evidenceNow = () => {
    const state = latest.current.runner.runtimeControls.getState();
    return { said: state.heard ? state.heard.toLowerCase() : null,
      saidNumber: heardNumber(state.heard), saidPlace: saidPlaceOf(state.heard),
      columnsFilled: filledCount(), columnsNeeded: state.item?.chartPlaces.length ?? 0 };
  };

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId, objectiveId: objectiveId || 'place-value-practice',
    planItemId: planItemId || instanceId, primitiveId: 'place-value-chart', evalMode,
    adapter: {
      getTutorState: () => {
        const state = latest.current.runner.runtimeControls.getState(), item = state.item;
        return {
          itemId: item?.id ?? 'ready',
          phase: state.suspended ? 'help' : state.stage,
          task: item ? askFor(item) : 'Start the place value lesson',
          completed: state.stage === 'done',
          evidence: {
            attemptNumber: state.attempts, correctness: state.correctness,
            recentResponses: state.heard
              ? [{ response: state.heard, source: 'speech' as const, recognition: 'clear' as const }] : [],
          },
          // Task identity and how much of the chart is filled. `answerText`,
          // `expectedDigits` and the value of the glowing digit are answers.
          demand: {
            kind: item?.kind ?? 'ready',
            response: item?.answerKind ?? 'voice',
            columns: item?.chartPlaces.length ?? 0,
            columnsFilled: filledCount(),
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
        // A committed chart owns its verdict; replaying a settled gesture on
        // return is not certified on this family either.
        return s.running && !s.suspended
          && !(s.item?.answerKind === 'gesture' && s.stage === 'judging');
      },
      getAffordances: () => {
        const s = latest.current.runner.runtimeControls.getState();
        if (!s.running || s.suspended) return [];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' }, responseSpeech: 'runner',
          description: 'Ask this same chart again; the runner speaks the question. '
            + 'No digit is written, cleared or moved, and no column is highlighted.',
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
        for (const scaffold of placeValueScaffoldsFor(s.item, evidenceNow())) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.item!);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this reminder, for when ${scaffold.when}: "${text}". `
              + 'This does not write, move or highlight anything, and it never says the answer.',
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
  const digitsKey = Object.entries(digitsByPlace).map(([place, digit]) => `${place}:${digit}`).sort().join(',');
  useEffect(() => {
    changed();
    if (runner.stage === 'done') runtime?.requestCompletion();
  }, [changed, runtime, runner.currentIndex, runner.stage, runner.suspended, corrections, attempts, digitsKey, hint]);
  useEffect(() => { shown.current = null; setHint(null); }, [runner.currentIndex]);
  return runtime ? hint : null;
}
