'use client';

import React, { useMemo } from 'react';
import { getPrimitive } from '../../config/primitiveRegistry';
import { PulseWorkspace } from '../../pulse/PulseWorkspace';
import { workspaceMountProps } from './LessonWorkspace';
import { workspaceBinding } from './lessonWorkspacePlan';

/** The objective a tester item submits under; a tester has no curriculum objective. */
export const TESTER_OBJECTIVE = 'tester';

interface TesterWorkspaceProps {
  primitiveId: string;
  instanceId: string;
  /** The tester's chosen mode; `null` (Auto) binds as `mixed`, as an unpinned lesson section does. */
  evalMode: string | null;
  data: unknown;
  topic: string;
  gradeLevel: string;
  onEvaluationSubmit?: (result: any) => void;
  /** The tester's own render, used when the catalog does not bind this family. */
  children: React.ReactNode;
}

/**
 * A tester preview of a primitive whose family binds the teaching workspace renders what a lesson
 * renders: the registry component with the lesson's mount props, inside a one-item host with its
 * own Live session (the Pulse host). A tester never shows a retired scripted path for a bound family.
 */
export function TesterWorkspace({ primitiveId, instanceId, evalMode, data, topic, gradeLevel,
  onEvaluationSubmit, children }: TesterWorkspaceProps) {
  const binding = useMemo(() => workspaceBinding({ instanceId, primitiveId, pin: evalMode ?? undefined,
    objectiveIds: [TESTER_OBJECTIVE], data }), [instanceId, primitiveId, evalMode, data]);
  if (!binding) return <>{children}</>;
  const Component = getPrimitive(primitiveId as never)?.component as React.ComponentType<any> | undefined;
  if (!Component) return <>{children}</>;
  const payload = data as Record<string, unknown>;
  return <PulseWorkspace key={instanceId} binding={binding} data={payload} sessionId={instanceId}
    topic={topic} gradeLevel={gradeLevel}>
    <Component data={{ ...payload, instanceId, objectiveId: binding.objectiveId, onEvaluationSubmit }}
      {...workspaceMountProps(binding)} />
  </PulseWorkspace>;
}

/** Whether a tester preview binds the workspace, so the tester can drop its own tutor panel. */
export const testerBinds = (primitiveId: string, instanceId: string, evalMode: string | null, data: unknown) =>
  !!workspaceBinding({ instanceId, primitiveId, pin: evalMode ?? undefined, objectiveIds: [TESTER_OBJECTIVE], data });
