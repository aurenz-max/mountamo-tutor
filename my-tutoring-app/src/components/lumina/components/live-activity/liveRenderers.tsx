'use client';

/**
 * How an adopted family RENDERS inside the live host: the same component and the same
 * mount props an ordinary lesson gives a bound section (`workspaceMountProps`), looked up in
 * the primitive registry. Adding a family needs no row here.
 *
 * Kept out of `activityContract.ts` because that module is imported by the server route and
 * must stay free of React, and kept out of the sandbox so the sandbox's own tests can replace
 * every primitive with one mock.
 */
import React from 'react';
import type { NumberLineControls } from '../../primitives/visual-primitives/math/NumberLine';
import { PRIMITIVE_REGISTRY } from '../../config/primitiveRegistry';
import { LIVE_PRIMITIVE_IDS, type LivePrimitiveId } from './activityContract';

export type { NumberLineControls };

export interface MountProps {
  data: any;
  /** The host mounts without a mic-panel click, so a judged runner starts itself. */
  autoStart: boolean;
  planItemId?: string;
  /** The RESOLVED eval mode from the mount; never reconstructed from interactionMode. */
  evalMode: string;
  /** Read only by number-line's legacy tutor controls; every other family ignores it. */
  onControls: (controls: NumberLineControls | null) => void;
}

function renderLive(id: LivePrimitiveId, p: MountProps) {
  const Component = PRIMITIVE_REGISTRY[id].component;
  return <Component data={p.data} autoStart={p.autoStart} runtimePlanItemId={p.planItemId}
    runtimeEvalMode={p.evalMode} onControlsReady={p.onControls} />;
}

export const LIVE_RENDERERS = Object.fromEntries(LIVE_PRIMITIVE_IDS.map(id => [id, (p: MountProps) => renderLive(id, p)])) as
  Record<LivePrimitiveId, (p: MountProps) => React.ReactElement>;
