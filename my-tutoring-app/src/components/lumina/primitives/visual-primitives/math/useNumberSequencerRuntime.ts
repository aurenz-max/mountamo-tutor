'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JudgedScriptRun } from '../../../hooks/useJudgedScriptRunner';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import { heardNumber } from '../../../components/live-activity/runtime/liveScaffolds';
import { NUMBER_SEQUENCER_MODES } from './numberSequencerModes';
import { askFor, sequencerScaffoldsFor, type SequencerItem, type SequencerScaffold } from './numberSequencerScript';

/**
 * Number sequencer's live-runtime adapter (di-runner family, ten-frame shape).
 *
 * The runner asks, judges and advances, so NO `advance` and NO `retry` are
 * advertised: a tutor clock beside the runner's is the defect the judged family
 * exists to prevent, and the runner's own correction line is what re-arms a wrong
 * item. `point` is withheld because the only interactive targets belong to
 * `order-cards`, where the tap IS the answer gesture — moving a card for the child
 * would be answering.
 *
 * NO SUPPORT DETOUR. `LiveRuntimeSurface` can draw exactly one shape: a row of
 * counters with a subtract / make-ten / count sentence. A number train teaches the
 * COUNT SEQUENCE, and a row of counters cannot state a sequencing relationship
 * truthfully — an `order-cards` or `decade-fill` example drawn as counters would be
 * a pedagogical lie the runtime does not catch. `supportArtifacts` is therefore
 * empty and `request_support` is never offered. `suspension` is still wired,
 * because a learner stop quiesces the runner through it.
 *
 * Every mode keeps its re-ask and its reminders: this primitive has no timed
 * stimulus, so there is no perceptual family to silence.
 */

/** Derived from the mode definitions, never restated: the catalog eval mode per challenge type. */
const EVAL_MODE_FOR_TYPE: Record<string, string> = Object.fromEntries(
  NUMBER_SEQUENCER_MODES.flatMap(mode => mode.challengeTypes.map(type => [type, mode.evalMode])));

export const sequencerEvalMode = (item: SequencerItem | null | undefined, fallback = 'default') =>
  (item && EVAL_MODE_FOR_TYPE[item.challengeType]) || fallback;

export function useNumberSequencerRuntime({ runner, instanceId, objectiveId, planItemId, evalMode, placed }: {
  runner: JudgedScriptRun<SequencerItem>;
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  /** The cards on the train right now, in the child's order. Routes the order-cards aids. */
  placed: number[];
}) {
  const latest = useRef({ runner, placed });
  latest.current = { runner, placed };
  // The aid currently painted, or null. A misstep aid is one level more assistance
  // than the method reminder, because it names the misstep.
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<SequencerScaffold | null>(null);

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId, objectiveId: objectiveId || 'number-sequencer-practice',
    planItemId: planItemId || instanceId, primitiveId: 'number-sequencer', evalMode,
    adapter: {
      getTutorState: () => {
        const { runner, placed } = latest.current;
        const state = runner.runtimeControls.getState(), item = state.item;
        return {
          itemId: item?.id ?? 'ready',
          phase: state.suspended ? 'help' : state.stage,
          task: item ? askFor(item) : 'Start the number train lesson',
          completed: state.stage === 'done',
          evidence: {
            attemptNumber: state.attempts, correctness: state.correctness,
            recentResponses: state.heard
              ? [{ response: state.heard, source: 'speech' as const, recognition: 'clear' as const }] : [],
          },
          // Task identity and the child's own work only. R8 keeps generated answers,
          // the sequence and wrongIndex out of general tutor context.
          demand: {
            kind: item?.challengeType ?? 'ready',
            response: item?.answerKind ?? 'voice',
            direction: item?.direction ?? '',
            cardsPlaced: placed.length,
            placedOrder: placed.join(','),
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
        // A committed arrangement owns its verdict; replaying a settled gesture on
        // return is not certified on this family either.
        return s.running && !s.suspended
          && !(s.item?.answerKind === 'gesture' && s.stage === 'judging');
      },
      getAffordances: () => {
        const s = latest.current.runner.runtimeControls.getState();
        if (!s.running || s.suspended) return [];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' }, responseSpeech: 'runner',
          description: 'Ask this same number train again; the runner speaks the question. '
            + 'Nothing on the train is cleared, reordered or filled in.',
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
        const evidence = { heard: heardNumber(s.heard), placed: latest.current.placed };
        for (const scaffold of sequencerScaffoldsFor(s.item, evidence)) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.item!);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this reminder, for when ${scaffold.when}: "${text}". `
              + 'This does not move a card, fill a space or reorder the train, and it never says the answer.',
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
  const placedKey = placed.join(',');
  useEffect(() => {
    changed();
    if (runner.stage === 'done') runtime?.requestCompletion();
  }, [changed, runtime, runner.currentIndex, runner.stage, runner.suspended, corrections, attempts, placedKey, hint]);
  useEffect(() => { shown.current = null; setHint(null); }, [runner.currentIndex]);
  return runtime ? hint : null;
}
