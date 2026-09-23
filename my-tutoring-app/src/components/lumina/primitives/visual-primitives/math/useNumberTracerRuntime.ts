'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import type { NumberTracerChallenge } from './NumberTracer';
import { tracerScaffoldsFor, type TracerScaffold } from './numberTracerScaffolds';

/**
 * Number tracer's live-runtime adapter (TUTOR-LED family, number-line shape).
 *
 * No judged runner owns this primitive, so the tutor may hold the clock: after a
 * checked success it may `advance`, and after a checked failure it may `retry`,
 * both by calling the learner's own handlers so grading and progression stay
 * exactly where they already live. Commands commit through `flushSync` at the
 * imperative boundary and read committed state from a layout-effect ref — a React
 * setter followed by a read of the old closure is not an acknowledgement.
 *
 * `point` is withheld: the canvas has no target with a real handler. The start
 * dot and the direction arrows are painted guides, not controls, and the only
 * pointer handlers on the surface are the drawing gesture itself — pointing
 * there would draw.
 *
 * NO SUPPORT DETOUR. `LiveRuntimeSurface` draws a row of counters with a
 * subtract / make-ten / count sentence. This primitive teaches how to FORM a
 * numeral with a pen; a quantity of counters cannot state a handwriting shape,
 * and an example that showed "5 counters" beside a child struggling to write a
 * five would be teaching the wrong thing entirely. `supportArtifacts` is empty
 * and `request_support` is never offered. `suspension` is still wired, because
 * it must end an in-progress stroke synchronously when the learner stops.
 */

export interface TracerRuntimeOptions {
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  challenge: NumberTracerChallenge | null;
  index: number;
  attempts: number;
  /** A check has been committed on this item. */
  checked: boolean;
  correct: boolean;
  incorrect: boolean;
  completed: boolean;
  score: number | null;
  strokeCount: number;
  guideStrokeCount: number;
  inkPoints: number;
  guidePoints: number;
  /** The learner's own handlers. Nothing here re-implements grading or progression. */
  advance: () => void;
  clear: () => void;
  replay: () => boolean;
  /** Ends any in-progress stroke synchronously. Suspension is synchronous or it is not suspension. */
  cancelStroke: () => void;
  /** The teaching workspace owns this mount instead: register nothing and never request completion. */
  disabled?: boolean;
}

export function useNumberTracerRuntime(options: TracerRuntimeOptions) {
  // Commands read COMMITTED React state, never a speculative render.
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const [hint, setHint] = useState<string | null>(null);
  const shown = useRef<TracerScaffold | null>(null);
  const suspended = useRef(false), mounted = useRef(false);
  const commit = (change: () => void) => {
    if (!mounted.current || suspended.current) return false;
    flushSync(change);
    return true;
  };

  const evidenceNow = () => {
    const s = latest.current;
    return { wrongNow: s.incorrect, strokeCount: s.strokeCount, guideStrokeCount: s.guideStrokeCount,
      inkPoints: s.inkPoints, guidePoints: s.guidePoints, score: s.score };
  };

  const mount = useMemo<RuntimeMount>(() => ({
    instanceId: options.instanceId,
    planItemId: options.planItemId || options.instanceId,
    objectiveId: options.objectiveId || 'number-tracer-practice',
    primitiveId: 'number-tracer', evalMode: options.evalMode,
    adapter: {
      getTutorState: () => {
        const s = latest.current;
        return {
          itemId: s.challenge?.id ?? 'ready',
          task: s.challenge?.instruction ?? 'Start writing numbers',
          phase: suspended.current ? 'help' : s.completed ? 'done' : s.checked ? 'checked' : 'writing',
          completed: s.completed,
          evidence: {
            attemptNumber: s.attempts + 1,
            correctness: s.correct ? 'correct' : s.incorrect ? 'incorrect' : 'unknown',
            recentResponses: [{ response: JSON.stringify({ strokes: s.strokeCount, ink: s.inkPoints, score: s.score }),
              source: 'gesture', recognition: 'not-applicable' }],
          },
          // What the child DREW, never the digit they were asked for: the target
          // numeral is the answer on every type this primitive asks.
          demand: {
            challengeIndex: s.index,
            kind: s.challenge?.type ?? 'trace',
            strokesDrawn: s.strokeCount,
            guideStrokes: s.guideStrokeCount,
            inkPoints: s.inkPoints,
            guidePoints: s.guidePoints,
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
          description: 'Move to the next writing challenge after a checked success. The canvas is cleared for fresh work.',
          execute: () => commit(() => { shown.current = null; setHint(null); latest.current.advance(); }),
        }];
        const actions: ExecutableAffordance[] = [{
          action: { type: 'replay' },
          description: 'Focus the current instruction without changing the drawing. After the visible receipt, '
            + `read this exact instruction aloud: ${s.challenge.instruction}`,
          assistance: { level: 1, answerExposure: 'none' },
          execute: () => mounted.current && !suspended.current && latest.current.replay(),
        }];
        if (s.incorrect) actions.push({
          action: { type: 'retry' },
          description: 'Clear this incorrect drawing for another try on the same number; attempts and assistance are kept',
          execute: () => commit(() => latest.current.clear()),
        });
        // Fading is per strategy: only the aid actually painted offers its -1.
        if (shown.current) actions.push({
          action: { type: 'scaffold', strategyId: shown.current.strategyId, direction: -1 },
          description: 'Hide the reminder that is showing',
          assistance: { level: 0, answerExposure: 'none' },
          execute: () => commit(() => { shown.current = null; setHint(null); }),
        });
        for (const scaffold of tracerScaffoldsFor(s.challenge, evidenceNow())) {
          if (shown.current?.strategyId === scaffold.strategyId) continue;
          const text = scaffold.hint(s.challenge);
          actions.push({
            action: { type: 'scaffold', strategyId: scaffold.strategyId, direction: 1 },
            // The tutor SPEAKS this, so `when` says what the aid is for and the
            // quoted line is sayable to a five-year-old exactly as written.
            description: `Show and say this text reminder, for when ${scaffold.when}: "${text}". `
              + 'Nothing is drawn, erased or traced for the child, and it never says the number.',
            assistance: { level: scaffold.matches ? 2 : 1, answerExposure: 'none' },
            execute: () => commit(() => { shown.current = scaffold; setHint(text); }),
          });
        }
        return actions;
      },
      suspension: {
        suspend: () => { suspended.current = true; latest.current.cancelStroke(); },
        resume: () => { suspended.current = false; },
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
  useEffect(() => { if (options.completed && !options.disabled) runtime?.requestCompletion(); }, [runtime, options.completed, options.disabled]);
  useEffect(() => { shown.current = null; setHint(null); }, [options.index]);
  return runtime ? hint : null;
}
