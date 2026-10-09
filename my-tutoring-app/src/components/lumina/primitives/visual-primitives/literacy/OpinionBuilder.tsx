'use client';

/**
 * OpinionBuilder — opinion writing on the shared tutor/JEV teaching workspace only (OB-7L, following R12: the older
 * modes join the live tutor; one path). Two surfaces, one per payload shape:
 *   - OREO and CER (the writing modes): `WritingStagesSurface` with the `oreo` / `cer` steps. The learner writes the
 *     answer one sentence per step; code checks length, blanks and repeats, and the shared literacy judge checks each
 *     sentence makes sense and does its step's job. This replaced a scripted builder that credited any non-empty field.
 *   - `build_opinion` (open build): `OpinionBuildSurface`, cards for either side ordered into an OREO answer.
 * An unbound mount shows the shared "needs the tutor" card.
 */
import React from 'react';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { OpinionBuilderMetrics } from '../../../evaluation/types';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import OpinionBuildSurface from './OpinionBuildSurface';
import WritingStagesSurface from './WritingStagesSurface';
import { opinionWritingPayload, type OpinionItem } from './opinionBuild';

export interface OpinionBuilderData {
  title: string;
  gradeLevel: string;
  framework: 'oreo' | 'cer';
  /** The opinion/argument question. */
  prompt: string;

  /** Starters per step (a help lever shows them; one with a trailing ... is the simplify lever's practice). */
  scaffold: {
    claimLabel: string;
    claimStarters: string[];
    reasonLabel: string;
    reasonStarters: string[];
    reasonCount: number;
    conclusionLabel: string;
    conclusionStarters: string[];
    linkingWords: string[];
    counterArgumentEnabled: boolean;
    counterArgumentStarters?: string[];
  };

  supportTier?: 'easy' | 'medium' | 'hard';
  /** `build_opinion` (open build): the card surface runs the session from `opinions`. */
  task?: 'opinion_build';
  opinions?: OpinionItem[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OpinionBuilderMetrics>) => void;
}

interface OpinionBuilderProps {
  data: OpinionBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

export { opinionWritingPayload };

/** One mount, one shape: the open build's cards, or the writing steps. */
function OpinionBuilderSurface(props: OpinionBuilderProps) {
  const { data } = props;
  return data.task === 'opinion_build'
    ? <OpinionBuildSurface {...props} data={{ ...data, task: 'opinion_build', opinions: data.opinions ?? [] } as never} />
    : <WritingStagesSurface {...props} primitiveId="opinion-builder"
        data={{ ...opinionWritingPayload(data), title: data.title, gradeLevel: data.gradeLevel, supportTier: data.supportTier, instanceId: data.instanceId,
          skillId: data.skillId, subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
          onEvaluationSubmit: data.onEvaluationSubmit as never }} />;
}

const OpinionBuilder = withWorkspaceOnly<OpinionBuilderProps>('opinion-builder', OpinionBuilderSurface, props => props.data.title);

export default OpinionBuilder;
