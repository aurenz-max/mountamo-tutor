'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JudgedScriptRun } from '../../../hooks/useJudgedScriptRunner';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import { askFor, ordinalScaffoldsFor, saidOrdinal, type OrdinalLineItem, type OrdinalScaffold }
  from './ordinalLineScript';

/**
 * Ordinal line's live-runtime adapter (di-runner family, ten-frame shape).
 *
 * The runner asks, judges and advances, so NO `advance` and NO `retry`: a tutor
 * clock beside the runner's is the defect the judged family exists to prevent,
 * and `correctionFor` — not a tutor action — is what re-arms a wrong item.
 * `point` is withheld for a reason particular to THIS primitive: pointing at a
 * place in the line IS the answer on `identify`, `relative_position` and
 * `build_sequence`, so a tutor point would not assist the task, it would perform it.
 *
 * NO SUPPORT DETOUR, on any mode. `LiveRuntimeSurface` draws one row of counters
 * with a subtract / make-ten / count sentence — a CARDINAL statement, how many.
 * Every mode here teaches ORDINAL position, which is which place in a line, and a
 * row of counters cannot state that relationship. `supportArtifacts` is therefore
 * empty and `request_support` is never offered. `suspension` is still wired,
 * because a learner stop quiesces the runner through it.
 *
 * `match` is the one mode that keeps its re-ask and loses its misstep aids: it is
 * a reading task, and a text reminder cannot help a child read the very card the
 * question is about. Its method reminder stays, because "say out loud what the
 * card says" is the method, not the answer.
 */

export function useOrdinalLineRuntime({ runner, instanceId, objectiveId, planItemId, evalMode, placedOrder }: {
  runner: JudgedScriptRun<OrdinalLineItem>;
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  /** build_sequence: the names in the line right now, in the child's order. */
  placedOrder: readonly string[];
}) {
  const latest = useRef({ runner, placedOrder });
  latest.current = { runner, placedOrder };
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<OrdinalScaffold | null>(null);

  const evidenceNow = () => {
    const { runner, placedOrder } = latest.current;
    const said = runner.runtimeControls.getState().heard;
    return { said: said ? said.toLowerCase() : null, saidPosition: saidOrdinal(said), placed: placedOrder };
  };

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId, objectiveId: objectiveId || 'ordinal-line-practice',
    planItemId: planItemId || instanceId, primitiveId: 'ordinal-line', evalMode,
    adapter: {
      getTutorState: () => {
        const { runner, placedOrder } = latest.current;
        const state = runner.runtimeControls.getState(), item = state.item;
        return {
          itemId: item?.id ?? 'ready',
          phase: state.suspended ? 'help' : state.stage,
          task: item ? askFor(item) : 'Start the ordinal line lesson',
          completed: state.stage === 'done',
          evidence: {
            attemptNumber: state.attempts, correctness: state.correctness,
            recentResponses: state.heard
              ? [{ response: state.heard, source: 'speech' as const, recognition: 'clear' as const }] : [],
          },
          // Task identity plus the child's own work. `answerText`, `answerOrder`
          // and the story's mapping stay out of general tutor context.
          demand: {
            kind: item?.kind ?? 'ready',
            response: item?.answerKind ?? 'voice',
            direction: item?.direction ?? '',
            lineLength: item?.lineNames.length ?? 0,
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
        // A committed line owns its verdict; replaying a settled gesture on
        // return is not certified on this family either.
        return s.running && !s.suspended
          && !(s.item?.answerKind === 'gesture' && s.stage === 'judging');
      },
      getAffordances: () => {
        const s = latest.current.runner.runtimeControls.getState();
        if (!s.running || s.suspended) return [];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' }, responseSpeech: 'runner',
          description: 'Ask this same line again; the runner speaks the question. '
            + 'Nobody is moved, placed or highlighted, and the story is not changed.',
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
        for (const scaffold of ordinalScaffoldsFor(s.item, evidenceNow())) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.item!);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this reminder, for when ${scaffold.when}: "${text}". `
              + 'This does not move, place or highlight anybody, and it never says the answer.',
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
