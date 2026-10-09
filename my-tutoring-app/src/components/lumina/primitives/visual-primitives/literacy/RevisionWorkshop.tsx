'use client';

/**
 * RevisionWorkshop — revising a draft on the shared tutor/JEV teaching workspace only (OB-7L, following R12: the older
 * modes join the live tutor; one path). `RevisionSurface` runs every skill: the learner types a revision of each target
 * sentence (code checks it changed and fits the skill's shape, then the shared writing judge checks it does the job),
 * or, for reorganize, orders the draft's sentences (checked in code). This replaced a pick-a-suggestion UI that showed
 * the model revision. An unbound mount shows the shared "needs the tutor" card.
 */
import React from 'react';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { RevisionWorkshopMetrics } from '../../../evaluation/types';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import RevisionSurface from './RevisionSurface';
import type { RevisionSkill, RevisionTarget } from './revisionSteps';

export type { RevisionSkill, RevisionTarget };

export interface RevisionWorkshopData {
  title: string;
  gradeLevel: string;
  revisionSkill: RevisionSkill;
  /** The full draft. For reorganize its sentences are out of order; `targets` hold the order that makes sense. */
  draft: string;
  /** One sentence to revise per target. `idealRevision` is the answer and is never shown. */
  targets: (RevisionTarget & { alternatives?: string[] })[];
  /** Within-mode support tier, stamped by the generator. Levers start bare at every tier. */
  supportTier?: 'easy' | 'medium' | 'hard';

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RevisionWorkshopMetrics>) => void;
}

interface RevisionWorkshopProps {
  data: RevisionWorkshopData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

function RevisionWorkshopSurface(props: RevisionWorkshopProps) {
  return <RevisionSurface {...props} data={props.data as never} />;
}

const RevisionWorkshop = withWorkspaceOnly<RevisionWorkshopProps>('revision-workshop', RevisionWorkshopSurface, props => props.data.title);

export default RevisionWorkshop;
