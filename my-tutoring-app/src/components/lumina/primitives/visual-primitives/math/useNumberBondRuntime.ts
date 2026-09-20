'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JudgedScriptRun } from '../../../hooks/useJudgedScriptRunner';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { CounterSupport, ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import { heardNumber } from '../../../components/live-activity/runtime/liveScaffolds';
import { askFor, bondScaffoldsFor, onesOf, type BondScaffold, type NumberBondItem, type NumberBondKind }
  from './numberBondScript';

/**
 * Number bond's live-runtime adapter (di-runner family, ten-frame shape).
 *
 * The runner asks, judges and advances, so NO `advance` and NO `retry`: a tutor
 * clock beside the runner's is the defect the judged family exists to prevent,
 * and `correctionFor` — not a tutor action — is what re-arms a wrong item.
 * `point` is withheld because on every hand mode the tap IS the answer gesture:
 * moving a counter into a part, or a tile into a slot, would be answering.
 *
 * THREE GATES, NOT ONE. `canYieldForHelp` silences the WHOLE action set while the
 * runner owns the turn, so it answers "may the tutor act here at all" — here, only
 * a committed gesture awaiting its verdict. Whether a mode may open a DETOUR is a
 * separate gate, `supportArtifacts`, and `getAffordances` withholds one action at a
 * time. The tile modes need the middle one: `fact-family` and `build-equation` keep
 * their re-ask and their reminders, but get no worked example, because the counter
 * surface can draw a part-part-whole FACT and cannot draw the act of WRITING a
 * number sentence, which is what those modes measure.
 */

const NO_DETOUR: readonly NumberBondKind[] = ['fact-family', 'build-equation'];

/**
 * A prepared NEARBY bond — never this item's own numbers. The surface draws
 * `total` counters with the first `removed` as `+` placeholders and the sentence
 * `a + b = total`, which is exactly part-and-part-make-whole, so `make-ten` is
 * the honest operation for every bond mode that gets an example at all.
 */
export function numberBondExample(item: NumberBondItem): CounterSupport[] {
  const base = { id: `example-${item.id}`, kind: 'counter-example' as const, operation: 'make-ten' as const,
    provenance: 'prepared' as const, answerExposure: 'partial' as const };
  if (item.kind === 'ten-and-ones') {
    // A nearby teen, split the way this mode teaches: a full ten and the rest.
    const total = onesOf(item.whole) === 3 ? 14 : 13;
    return [{ ...base, title: 'Break another teen number', total, removed: total - 10,
      altText: `${total - (total - 10)} counters are already placed. Add ${total - 10} more to make ${total}.` }];
  }
  // A nearby whole, and a second part that is not this item's own answer.
  const total = item.whole === 5 ? 6 : 5;
  const removed = item.answer === 2 ? 3 : 2;
  return [{ ...base, title: 'Make another whole from two parts', total, removed,
    altText: `${total - removed} counters are already placed. Add ${removed} more to make ${total}.` }];
}

export function useNumberBondRuntime({ runner, instanceId, objectiveId, planItemId, evalMode,
  leftCount, rightCount, foundPairs, tiles, builtSentences }: {
  runner: JudgedScriptRun<NumberBondItem>;
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  /** Counters currently in each part. Routes the decompose and ten-and-ones aids. */
  leftCount: number;
  rightCount: number;
  /** decompose: the ways already banked for this challenge. */
  foundPairs: readonly (readonly [number, number])[];
  /** The equation tiles in the slots, in order. */
  tiles: readonly string[];
  /** fact-family: the number sentences already banked. */
  builtSentences: readonly string[];
}) {
  const latest = useRef({ runner, leftCount, rightCount, foundPairs, tiles, builtSentences });
  latest.current = { runner, leftCount, rightCount, foundPairs, tiles, builtSentences };
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<BondScaffold | null>(null);

  const evidenceNow = () => {
    const { runner, leftCount, rightCount, foundPairs, tiles, builtSentences } = latest.current;
    const state = runner.runtimeControls.getState();
    return { heard: heardNumber(state.heard), left: leftCount, right: rightCount,
      waysFound: foundPairs, tiles, builtSentences, wrongNow: state.correctness === 'incorrect' };
  };

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId, objectiveId: objectiveId || 'number-bond-practice',
    planItemId: planItemId || instanceId, primitiveId: 'number-bond', evalMode,
    adapter: {
      getTutorState: () => {
        const { runner, leftCount, rightCount, foundPairs, tiles } = latest.current;
        const state = runner.runtimeControls.getState(), item = state.item;
        return {
          itemId: item?.id ?? 'ready',
          phase: state.suspended ? 'help' : state.stage,
          task: item ? askFor(item) : 'Start the number bond lesson',
          completed: state.stage === 'done',
          evidence: {
            attemptNumber: state.attempts, correctness: state.correctness,
            recentResponses: state.heard
              ? [{ response: state.heard, source: 'speech' as const, recognition: 'clear' as const }] : [],
          },
          // Task identity plus the child's own work. The whole is public — every ask
          // states it — but the missing part and the accept set are not published here.
          demand: {
            kind: item?.kind ?? 'ready',
            response: item?.answerKind ?? 'voice',
            phaseOfItem: item?.interactionPhase ?? item?.splitPhase ?? '',
            leftPart: leftCount, rightPart: rightCount,
            waysFound: foundPairs.length,
            sentence: tiles.join(' '),
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
        // A committed split, action or sentence owns its verdict; replaying a
        // settled gesture on return is not certified on this family either.
        return s.running && !s.suspended
          && !(s.item?.answerKind === 'gesture' && s.stage === 'judging');
      },
      getAffordances: () => {
        const s = latest.current.runner.runtimeControls.getState();
        if (!s.running || s.suspended) return [];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' }, responseSpeech: 'runner',
          description: 'Ask this same bond again; the runner speaks the question. '
            + 'No counter, tile or part is cleared, moved or filled in.',
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
        for (const scaffold of bondScaffoldsFor(s.item, evidenceNow())) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.item!);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this reminder, for when ${scaffold.when}: "${text}". `
              + 'This does not move a counter or a tile, and it never says the answer.',
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
      get supportArtifacts() {
        const s = latest.current.runner.runtimeControls.getState();
        return s.running && s.item && !NO_DETOUR.includes(s.item.kind) ? numberBondExample(s.item) : [];
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
  const tileKey = tiles.join(' ');
  useEffect(() => {
    changed();
    if (runner.stage === 'done') runtime?.requestCompletion();
  }, [changed, runtime, runner.currentIndex, runner.stage, runner.suspended, corrections, attempts,
    leftCount, rightCount, foundPairs.length, tileKey, builtSentences.length, hint]);
  useEffect(() => { shown.current = null; setHint(null); }, [runner.currentIndex]);
  return runtime ? hint : null;
}
