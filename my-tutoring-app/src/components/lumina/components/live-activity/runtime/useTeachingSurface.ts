'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useLiveRuntimeActive, usePrimitiveRuntime } from './LiveRuntimeContext';
import type { ExecutableAffordance, RuntimeMount } from './contract';

/**
 * An UNGRADED teaching surface on the live runtime (user ruling 2026-09-24, adaptation-investigator):
 * the tutor teaches from what is on screen, and nothing the learner says or taps is graded.
 *
 * What it keeps from `useTeachingWorkspace`: one scoped mount, truthful scene facts, a tutor action
 * that validates every target before changing anything and acknowledges only a synchronous commit,
 * and the learner packet (signals and the learner-turn observation ride on `progression: 'learner'`).
 * What it drops: items, attempts, verdicts and the outcome observer. There is nothing to commit, so
 * no observer runs and no tool records or advances; the learner's own Done completes the surface.
 * No evaluation is submitted: a practice record is not mastery evidence (TW-11).
 */
export interface TeachingSurfaceObject {
  id: string;
  label: string;
  /** Whether the learner can see this object's content now. A closed card is still listed, so the tutor can open it. */
  shown: boolean;
}
export interface TeachingSurfaceScene {
  /** What this surface teaches, in one sentence. Stable for the whole mount. */
  task: string;
  objects: TeachingSurfaceObject[];
  /** What is drawn and written, including closed cards' content: the tutor needs it to teach. Never a score. */
  facts: Record<string, string | number>;
  /** Ids the tutor has ringed, as drawn. */
  marked: string[];
  finished: boolean;
}
export interface TeachingSurfaceOptions {
  instanceId: string;
  primitiveId: string;
  objectiveId?: string;
  planItemId?: string;
  evalMode: string;
  /** Read at publish time from the primitive's committed refs, never from a pending render. */
  scene: () => TeachingSurfaceScene;
  /** Synchronous: open these objects and ring them; [] clears the rings and leaves cards open. */
  show: (ids: string[]) => void;
}
export interface TeachingSurface {
  /** Republish after the scene changes (a card opened by the learner, the picture arriving). */
  publish: () => void;
  /** The learner pressed Done. Completes the runtime once the scene reports `finished`. */
  finish: () => boolean;
  /**
   * The learner opened something themselves (`what`, e.g. "The Trait card"). A pre-reader cannot read
   * what just opened, so the tutor is told, as host-written facts: not learner words, no prescribed reply.
   * A tutor's own show never calls this.
   */
  learnerOpened: (what: string) => void;
}

export function useTeachingSurface(options: TeachingSurfaceOptions): TeachingSurface {
  const ai = useLuminaAIContext();
  const aiRef = useRef(ai); aiRef.current = ai;
  const active = useLiveRuntimeActive();
  const activeRef = useRef(active); activeRef.current = active;
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const mounted = useRef(false);
  const itemId = `${options.instanceId}:teach`;
  const commit = (fn: () => void) => {
    if (!mounted.current || !activeRef.current) return false;
    flushSync(fn);
    return true;
  };
  const mount = useMemo<RuntimeMount>(() => ({ instanceId: options.instanceId,
    objectiveId: options.objectiveId || options.primitiveId + '-practice', planItemId: options.planItemId || options.instanceId,
    primitiveId: options.primitiveId, evalMode: options.evalMode,
    adapter: {
      getTutorState: () => {
        const s = latest.current.scene();
        return { itemId, phase: s.finished ? 'completed' : 'teaching', task: s.task, completed: s.finished,
          evidence: { attemptNumber: 0, correctness: 'unknown', recentResponses: [] },
          demand: { ...s.facts, response: 'none: nothing here is graded', presentation: 'ready' },
          support: { level: 0, answerExposure: 'none' },
          workspace: { progression: 'learner', demonstration: s.marked, lastResponse: null, attempts: [],
            objects: s.objects.map(o => ({ id: o.id, label: o.label, selected: false, group: o.shown ? 'open' : 'closed' })) } };
      },
      getAffordances: () => {
        const s = latest.current.scene();
        if (!mounted.current || !activeRef.current || s.finished) return [];
        const show: ExecutableAffordance = { action: { type: 'workspace', operation: 'show' },
          description: 'Open cards or objects for the learner and ring them. Supply targets from workspace.objects; a closed '
            + 'one opens, and [] clears the rings without closing anything. Teaching, not a learner answer.',
          execute: input => {
            if (!Array.isArray(input?.targets)) return 'show needs targets: ids from workspace.objects, or [] to clear the rings.';
            const known = latest.current.scene().objects.map(o => o.id);
            const unknown = input.targets.filter(id => !known.includes(id));
            if (unknown.length) return `Not in workspace.objects: ${unknown.join(', ')}. Use ids listed there.`;
            return commit(() => latest.current.show(input.targets!));
          } };
        return [show];
      },
    },
  }), [options.instanceId, options.primitiveId, options.objectiveId, options.planItemId, options.evalMode, itemId]);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, [mount]);
  const { runtime, changed } = usePrimitiveRuntime(mount);
  return {
    publish: () => { if (activeRef.current) changed(); },
    finish: () => {
      if (!mounted.current || !runtime || !latest.current.scene().finished) return false;
      changed();
      return runtime.requestCompletion();
    },
    learnerOpened: what => {
      if (!mounted.current || !activeRef.current) return;
      changed();
      aiRef.current.sendText(`The learner opened ${what} themselves. Respond using the current workspace.`,
        { scripted: false, author: 'host' });
    },
  };
}

/** The scripted side of `withWorkspaceController` for a teaching surface: outside a live runtime there is none. */
export const useNoTeachingSurface = (_options: TeachingSurfaceOptions): TeachingSurface | null => null;
