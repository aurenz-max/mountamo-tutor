'use client';

/**
 * Pip on a bound workspace, with no wiring in the primitive (2026-10-18). Everything Pip's pose needs is a fact the
 * workspace runner already holds — the item on screen, whether it is solved, whether the session is running — plus
 * whether the tutor is speaking about this instance, which `tutorSpeakingFor` defines once. So the runner publishes
 * Pip itself (`useRunnerPip`, called by `useWorkspaceProgressFor`), and the primitive only marks its layout:
 *
 *   <PipDock />                         where the dock goes (above the workspace, below the instruction)
 *   <PipWorkspace>…answer surface…</PipWorkspace>   the region Pip outlines and watches for touches
 *
 * `withWorkspaceOnly` provides the slot (`pipSlot.tsx`). A primitive that renders neither marker publishes nothing, so a family that
 * still wires Pip by hand (`useWorkspacePipSurface`) is unaffected until it moves (ratchet in boss.test.ts).
 */
import React, { useContext, type ReactNode } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useWorkspacePipSurface } from './useWorkspacePipSurface';
import { PipSlotContext } from './pipSlot';

/** Whether the tutor's audio belongs to this instance. In a lesson several blocks are mounted and only the active one
 *  is spoken about; outside a lesson (practice, the live sandbox) the one bound activity is. */
export function tutorSpeakingFor(ai: { isAudioPlaying?: boolean; sessionMode?: string; activePrimitiveId?: string | null },
  instanceId: string): boolean {
  return !!ai.isAudioPlaying && (ai.sessionMode !== 'lesson' || ai.activePrimitiveId === instanceId);
}

/** The runner's facts that decide Pip's pose on the open item. */
export interface RunnerPipFacts {
  instanceId: string;
  itemId: string | null;
  running: boolean;
  solved: boolean;
}

/**
 * Publishes Pip from the runner's state into the slot. Called once per bound surface by the workspace controller;
 * with no slot (an unbound or legacy mount) it publishes nothing.
 */
export function useRunnerPip({ instanceId, itemId, running, solved }: RunnerPipFacts) {
  const slot = useContext(PipSlotContext);
  const ai = useLuminaAIContext();
  const live = !!slot && running;
  const handles = useWorkspacePipSurface({
    instanceId, scopeId: live ? itemId : null, label: 'The activity', solved, running,
    tutorSpeaking: tutorSpeakingFor(ai, instanceId),
  });
  // Read by the markers below in the same render: they are children of the surface that called this.
  if (slot) slot.current = { ...handles, live };
}

/** Where Pip's dock sits. Renders nothing outside a bound workspace or once the session is done. */
export function PipDock() {
  const handles = useContext(PipSlotContext)?.current;
  return handles?.store && handles.live ? <div {...handles.dock} /> : null;
}

/** The answer surface Pip outlines and watches. Outside a bound workspace it is a plain wrapper. */
export function PipWorkspace({ children, className }: { children: ReactNode; className?: string }) {
  const handles = useContext(PipSlotContext)?.current;
  return handles ? <div {...handles.workspace} className={className}>{children}</div> : <div className={className}>{children}</div>;
}
