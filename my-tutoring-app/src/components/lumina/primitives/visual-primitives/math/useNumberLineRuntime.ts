'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePrimitiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { CounterSupport, ExecutableAffordance, RuntimeMount } from '../../../components/live-activity/runtime/contract';
import type { NumberLineChallenge, NumberLineOperation } from './NumberLine';

const reminder = 'Find the starting mark. Count the spaces you move, one at a time.';

/** Only certify the simple subtraction lane that the counter renderer can teach. */
export function numberLineExample(challenge: NumberLineChallenge | null, operations: NumberLineOperation[]): CounterSupport[] {
  const op = operations[0];
  if (challenge?.type !== 'show_jump' || operations.length !== 1 || op?.type !== 'subtract'
      || !Number.isInteger(op.startValue) || !Number.isInteger(op.changeValue)
      || op.startValue < 2 || op.startValue > 20 || op.changeValue < 1 || op.changeValue >= op.startValue) return [];
  const total = op.startValue === 6 ? 7 : 6;
  const removed = total - 2 === op.startValue - op.changeValue ? 3 : 2;
  return [{ id: `example-${challenge.id}`, kind: 'counter-example', operation: 'subtract',
    title: 'See subtraction with another group', total, removed,
    altText: `Start with ${total} counters. Take away ${removed}, one at a time. ${total - removed} remain. On a number line, each counter taken away is one space back.`,
    answerExposure: 'partial', provenance: 'prepared' }];
}

interface Options {
  instanceId: string; objectiveId?: string; planItemId?: string; evalMode: string;
  challenge: NumberLineChallenge | null; operations: NumberLineOperation[];
  index: number; attempts: number; correct: boolean; incorrect: boolean; completed: boolean;
  points: number[]; endpoints: number[]; ordered: Map<number, number>;
  advance: () => void; clear: () => void; replay: () => boolean; cancelGesture: () => void;
}

export function useNumberLineRuntime(options: Options) {
  // Commands read committed React state, never a speculative render. flushSync is
  // used only by imperative command handlers, not by effects or render.
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const [hint, setHint] = useState(false);
  const hintRef = useRef(false), suspended = useRef(false), mounted = useRef(false);
  const commit = (change: () => void) => {
    if (!mounted.current || suspended.current) return false;
    flushSync(change);
    return true;
  };
  const mount = useMemo<RuntimeMount>(() => ({ instanceId: options.instanceId,
    planItemId: options.planItemId || options.instanceId, objectiveId: options.objectiveId || 'number-line-practice',
    primitiveId: 'number-line', evalMode: options.evalMode,
    adapter: {
      getTutorState: () => {
        const s = latest.current;
        return { itemId: s.challenge?.id ?? 'ready', task: s.challenge?.instruction ?? 'Explore the number line',
          phase: suspended.current ? 'help' : s.completed ? 'done' : s.correct ? 'checked' : 'responding', completed: s.completed,
          evidence: { attemptNumber: s.attempts + 1, correctness: s.correct ? 'correct' : s.incorrect ? 'incorrect' : 'unknown',
            recentResponses: [{ response: JSON.stringify({ points: s.points, endpoints: s.endpoints, ordered: Array.from(s.ordered) }),
              source: 'gesture', recognition: 'not-applicable' }] },
          demand: { challengeIndex: s.index, kind: s.challenge?.type ?? 'explore',
            points: JSON.stringify(s.points), endpoints: JSON.stringify(s.endpoints), ordered: JSON.stringify(Array.from(s.ordered)) },
          support: { level: hintRef.current ? 1 : 0, answerExposure: 'none', ...(hintRef.current ? { instruction: reminder } : {}) } };
      },
      getAffordances: () => {
        const s = latest.current;
        if (!mounted.current || suspended.current || !s.challenge || s.completed) return [];
        if (s.correct) return [{ action: { type: 'advance' }, description: 'Move to the next blank challenge after checked success',
          execute: () => commit(() => { hintRef.current = false; setHint(false); latest.current.advance(); }) }];
        const actions: ExecutableAffordance[] = [{ action: { type: 'replay' },
          description: `Focus the current instruction without changing work. After the visible receipt, read this exact instruction aloud: ${s.challenge.instruction}`,
          assistance: { level: 1, answerExposure: 'none' }, execute: () => mounted.current && !suspended.current && latest.current.replay() }];
        if (s.incorrect) actions.push({ action: { type: 'retry' }, description: 'Clear this incorrect response for another try; retain attempts and assistance',
          execute: () => commit(() => latest.current.clear()) });
        if (s.challenge.type === 'show_jump') actions.push({ action: { type: 'scaffold', strategyId: 'count-spaces', direction: hintRef.current ? -1 : 1 },
          description: hintRef.current ? 'Hide the spaces reminder' : `Show this text reminder: "${reminder}". No points or answers are placed.`,
          assistance: { level: hintRef.current ? 0 : 1, answerExposure: 'none' },
          execute: () => commit(() => { hintRef.current = !hintRef.current; setHint(hintRef.current); }) });
        return actions;
      },
      suspension: {
        suspend: () => { suspended.current = true; latest.current.cancelGesture(); },
        resume: () => { suspended.current = false; },
      },
      get supportArtifacts() {
        const s = latest.current;
        return s.correct || s.completed ? [] : numberLineExample(s.challenge, s.operations);
      },
    },
  }), [options.instanceId, options.objectiveId, options.planItemId, options.evalMode]);
  // Layout cleanup refuses stale controls before passive unregister runs.
  useLayoutEffect(() => { mounted.current = true; suspended.current = false; return () => { mounted.current = false; suspended.current = true; }; }, [mount]);
  const { runtime, changed } = usePrimitiveRuntime(mount);
  useLayoutEffect(() => { changed(); });
  useEffect(() => { if (options.completed) runtime?.requestCompletion(); }, [runtime, options.completed]);
  useEffect(() => { hintRef.current = false; setHint(false); }, [options.index]);
  return runtime && hint ? reminder : null;
}
