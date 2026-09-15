'use client';

import { useState } from 'react';
import { usePipSurface, usePipTargets } from './PipSurfaceContext';
import type { PipTarget } from './PipSurfaceStore';
import { useSpeechScope } from './useSpeechScope';
import { workspacePipPose } from './workspacePipPose';

export const PIP_DOCK_CLASS = 'mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2';

export interface WorkspacePipOptions {
  instanceId: string;
  /** The item on screen. `null` — no item, finished, or submitted — publishes nothing. */
  scopeId: string | null;
  label: string;
  /** This item's result is confirmed correct. */
  solved: boolean;
  /** The activity has started (default true). Before a Start button, Pip waits in the dock. */
  running?: boolean;
  /** The tutor's audio is playing and belongs to this instance
   *  (`isAudioPlaying && activePrimitiveId === instanceId`). */
  tutorSpeaking: boolean;
  /** A check of the child's work is in flight (async evaluators only). */
  checking?: boolean;
  /** What is being checked is something the child built, drew, or arranged. */
  handover?: boolean;
}

/** Pip's surface for a classic primitive, wired through the canonical path:
 * the primitive's own check state and the tutor's speech on this item become a
 * pose over one `workspace` target, plus the element the child last touched.
 *
 * Spread `workspace` onto the element that holds the child's answer surface and
 * render `<div {...dock} />` where the teaching contract puts the dock (above the
 * workspace, below the instruction). The touch listeners are capture-phase, so
 * the primitive's own handlers run unchanged.
 */
export function useWorkspacePipSurface(options: WorkspacePipOptions) {
  const { instanceId, scopeId, label, solved, running = true, tutorSpeaking, checking, handover } = options;
  const pip = usePipTargets(scopeId, false);
  const [touched, setTouched] = useState<{ scopeId: string; element: Element } | null>(null);
  const speechOnItem = useSpeechScope(scopeId, tutorSpeaking);

  const onTouch = (event: { target: EventTarget }) => {
    if (!scopeId || solved || !(event.target instanceof Element)) return;
    const workspace = pip.targets(['workspace'])[0]?.element;
    const element = event.target.closest('button, [role="button"], input, select, textarea, [draggable="true"]') ?? event.target;
    if (workspace?.contains(element)) setTouched({ scopeId, element });
  };

  const store = usePipSurface(() => {
    if (!pip.dock.current || !scopeId) return null;
    const targets: PipTarget[] = pip.targets(['workspace'], () => label);
    const workspace = targets[0]?.element;
    const element = touched?.scopeId === scopeId && touched.element.isConnected && workspace?.contains(touched.element)
      ? touched.element : null;
    const touch = !element ? 'none' : element === workspace ? 'workspace' : 'object';
    if (element && touch === 'object') targets.push({ id: 'touched', label: 'Your last touch', element });
    const pose = workspacePipPose({
      running, preparing: false, currentSolved: solved, revealHeld: false, judging: !!checking,
      tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnItem,
      visibleIds: targets.map((target) => target.id), touch, handover,
    });
    return { instanceId, scopeId, label, dock: pip.dock.current, targets, pose };
  });

  return {
    store,
    workspace: {
      ref: pip.ref('workspace'),
      'data-pip-object': 'workspace',
      onPointerDownCapture: onTouch,
      onFocusCapture: onTouch,
    },
    dock: { ref: pip.dock, 'data-pip-dock': instanceId, className: PIP_DOCK_CLASS },
  };
}
