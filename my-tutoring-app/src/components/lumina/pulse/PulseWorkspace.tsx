'use client';

import React, { useEffect, useMemo } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { WorkspaceHostProvider, WorkspaceSection, useLessonWorkspace, workspaceConnectionInfo } from '../components/live-activity/LessonWorkspace';
import type { LessonWorkspaceItem } from '../components/live-activity/lessonWorkspacePlan';
import { CuratorCompanion } from '../components/CuratorCompanion';

interface PulseWorkspaceProps {
  binding: LessonWorkspaceItem;
  /** The generated payload, which the tutor receives with the family's guidance. */
  data: Record<string, unknown>;
  sessionId: string;
  topic: string;
  gradeLevel: string;
  children: React.ReactNode;
}

/**
 * One Pulse item on the teaching workspace: its own runtime, its own Live session, and the
 * lesson's tutor face. Mount it keyed by the item. Leaving the item unmounts the scope, which
 * closes the transport and disconnects the session, so a late observer result has no path to
 * the next item's runtime.
 *
 * A session per item rather than one per run: an unbound Pulse item keeps its own per-item tutor
 * (AIHelper connects standalone on mount), and a run-wide lesson session would switch those items
 * onto the lesson path. Pulse items are independent skills, so no conversation is lost between them.
 */
export function PulseWorkspace({ binding, data, sessionId, topic, gradeLevel, children }: PulseWorkspaceProps) {
  const items = useMemo(() => new Map([[binding.instanceId, binding]]), [binding]);
  return <WorkspaceHostProvider scope="pulse" items={items} initialActiveId={binding.instanceId}>
    <PulseTutorSession binding={binding} data={data} sessionId={sessionId} topic={topic} gradeLevel={gradeLevel} />
    <WorkspaceSection instanceId={binding.instanceId}>{children}</WorkspaceSection>
    {/* Connection state and the reconnect control: the surface stays disabled until the tutor is
        connected, and this is what tells the learner why. */}
    <CuratorCompanion />
  </WorkspaceHostProvider>;
}

/** Opens the item's lesson-mode session with the runtime packet, as `LessonAIBootstrap` does. */
function PulseTutorSession({ binding, data, sessionId, topic, gradeLevel }: Omit<PulseWorkspaceProps, 'children'>) {
  const ai = useLuminaAIContext();
  const host = useLessonWorkspace();
  useEffect(() => {
    void ai.connectLesson(workspaceConnectionInfo({ exhibit_id: sessionId, topic, grade_level: gradeLevel,
      firstPrimitive: { primitive_type: binding.primitiveId, instance_id: binding.instanceId, primitive_data: data,
        exhibit_id: sessionId, topic, grade_level: gradeLevel } }, host));
    return () => ai.disconnect();
    // The scope is keyed by the item, so this runs once per item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
