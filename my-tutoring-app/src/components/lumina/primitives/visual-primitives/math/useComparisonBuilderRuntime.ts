'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';
import { comparisonContrastFor, ownNumbers } from './comparisonBuilderExample';
import { comparisonScaffoldsFor, type ComparisonScaffold } from './comparisonBuilderScaffolds';

/**
 * Comparison builder's live-runtime adapter (TUTOR-LED family, number-line shape).
 *
 * No judged runner owns this primitive, so the tutor may hold the clock: after a
 * checked success it may `advance`, and after a checked failure it may `retry`,
 * both by calling the learner's own handlers so grading and progression stay
 * exactly where they already live. Commands commit through `flushSync` at the
 * imperative boundary and read committed state from a layout-effect ref.
 *
 * `point` is withheld. On every mode here the tap IS the answer: tapping a group,
 * a comparison symbol, an ordering slot or a number-line step is the response the
 * component grades, so a tutor point would not assist the task, it would perform it.
 *
 * THE DETOUR IS A CONTRAST PAIR, NOT A ROW. `LiveRuntimeSurface`'s counter row
 * states HOW MANY; comparison is a relationship BETWEEN two collections, and a
 * `total − removed` sentence would teach subtraction beside a comparison task.
 * `supportArtifacts` therefore prepares the surface's second shape — two rows
 * stacked with their unpartnered tail ringed — on every mode a pair can state
 * (`comparisonBuilderExample.ts`), and nothing on `order`. `suspension` clears the
 * flash timers synchronously, which is what makes the detour returnable.
 */

export interface ComparisonRuntimeOptions {
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  challenge: ComparisonBuilderChallenge | null;
  index: number;
  attempts: number;
  correct: boolean;
  incorrect: boolean;
  completed: boolean;
  /** The comparison word or symbol currently chosen. */
  selected: string | null;
  ordered: readonly number[];
  oneMore: number | null;
  oneLess: number | null;
  /** The learner's own handlers. Nothing here re-implements grading or progression. */
  advance: () => void;
  clear: () => void;
  replay: () => boolean;
  /** Clears every flash timer this component owns. Synchronous or it is not suspension. */
  cancelFlashes: () => void;
  /** The teaching workspace owns this mount instead: register nothing and never request completion. */
  disabled?: boolean;
}

export function useComparisonBuilderRuntime(options: ComparisonRuntimeOptions) {
  // Commands read COMMITTED React state, never a speculative render.
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<ComparisonScaffold | null>(null);
  const suspended = useRef(false), mounted = useRef(false);
  const commit = (change: () => void) => {
    if (!mounted.current || suspended.current) return false;
    flushSync(change);
    return true;
  };

  const evidenceNow = () => {
    const s = latest.current;
    return { wrongNow: s.incorrect, selected: s.selected, ordered: s.ordered,
      oneMore: s.oneMore, oneLess: s.oneLess };
  };

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId: options.instanceId,
    planItemId: options.planItemId || options.instanceId,
    objectiveId: options.objectiveId || 'comparison-builder-practice',
    primitiveId: 'comparison-builder', evalMode: options.evalMode,
    adapter: {
      getTutorState: () => {
        const s = latest.current;
        return {
          itemId: s.challenge?.id ?? 'ready',
          task: s.challenge?.instruction ?? 'Start comparing',
          phase: suspended.current ? 'help' : s.completed ? 'done' : s.correct ? 'checked' : 'responding',
          completed: s.completed,
          evidence: {
            attemptNumber: s.attempts + 1,
            correctness: s.correct ? 'correct' : s.incorrect ? 'incorrect' : 'unknown',
            recentResponses: [{ response: JSON.stringify({ selected: s.selected, ordered: s.ordered,
              oneMore: s.oneMore, oneLess: s.oneLess }), source: 'gesture', recognition: 'not-applicable' }],
          },
          // The child's own response and the task identity. `correctAnswer`,
          // `correctSymbol` and the sorted arrangement are the answer and stay out.
          demand: {
            challengeIndex: s.index,
            kind: s.challenge?.type ?? 'compare',
            direction: s.challenge?.direction ?? '',
            selected: s.selected ?? '',
            placed: s.ordered.join(','),
          },
          support: {
            level: shown.current ? (shown.current.matches ? 2 : 1) : 0,
            answerExposure: 'none',
            ...(shown.current ? { instruction: shown.current.hint(s.challenge!) } : {}),
          },
        };
      },
      getAffordances: () => {
        const s = latest.current;
        if (!mounted.current || suspended.current || !s.challenge || s.completed) return [];
        if (s.correct) return [{
          action: { type: 'advance' },
          description: 'Move to the next comparison after a checked success. The workspace is cleared for fresh work.',
          execute: () => commit(() => { shown.current = null; setHint(null); latest.current.advance(); }),
        }];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' },
          description: 'Focus the current instruction without changing the response. After the visible receipt, '
            + `read this exact instruction aloud: ${s.challenge.instruction}`,
          assistance: { level: 1, answerExposure: 'none' },
          execute: () => mounted.current && !suspended.current && latest.current.replay(),
        }];
        if (s.incorrect) actions.push({
          action: { type: 'retry' },
          description: 'Clear this incorrect response for another try on the same comparison; '
            + 'attempts and assistance are kept',
          execute: () => commit(() => latest.current.clear()),
        });
        // Fading is per strategy: only the aid actually painted offers its -1.
        if (shown.current) actions.push({
          action: { type: 'scaffold', strategyId: shown.current.strategyId, direction: -1 },
          description: 'Hide the reminder that is showing',
          assistance: { level: 0, answerExposure: 'none' },
          execute: () => commit(() => { shown.current = null; setHint(null); }),
        });
        for (const scaffold of comparisonScaffoldsFor(s.challenge, evidenceNow())) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.challenge);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this text reminder, for when ${scaffold.when}: "${text}". `
              + 'Nothing is selected, moved or counted for the child, and it never says the answer.',
            assistance: { level: scaffold.matches ? 2 : 1, answerExposure: 'none' },
            execute: () => commit(() => { shown.current = scaffold; setHint(text); }),
          });
        }
        return actions;
      },
      suspension: {
        suspend: () => { suspended.current = true; latest.current.cancelFlashes(); },
        resume: () => { suspended.current = false; },
      },
      // Per item, from the CURRENT challenge: the pair must avoid this item's own
      // numbers, so it cannot be prepared once at mount.
      get supportArtifacts() {
        const s = latest.current;
        return s.challenge && !s.completed ? comparisonContrastFor(s.challenge) : [];
      },
      // A generated picture must compare a DIFFERENT pair: any of this item's own numbers in
      // the description means the tutor is drawing the task, which is the answer on every mode.
      drawsTask: counts => {
        const c = latest.current.challenge;
        return !c || ownNumbers(c).some(n => counts.includes(n));
      },
    },
  }), [options.instanceId, options.objectiveId, options.planItemId, options.evalMode]);

  // Layout cleanup refuses stale controls before the passive unregister runs.
  useLayoutEffect(() => {
    mounted.current = true; suspended.current = false;
    return () => { mounted.current = false; suspended.current = true; };
  }, [mount]);
  const { runtime, changed } = usePrimitiveRuntime(options.disabled ? null : mount);
  useLayoutEffect(() => { changed(); });
  useEffect(() => { if (options.completed && !options.disabled) runtime?.requestCompletion(); },
    [runtime, options.completed, options.disabled]);
  useEffect(() => { shown.current = null; setHint(null); }, [options.index]);
  return runtime ? hint : null;
}
