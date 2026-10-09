'use client';

/**
 * ParagraphArchitect — informative, narrative and opinion paragraphs, on the shared tutor/JEV teaching workspace only
 * (R12, user ruling 2026-10-08: the older modes join the live tutor; one path). Two surfaces, one per payload shape:
 *   - the writing modes (informational, narrative, opinion): `WritingStagesSurface`. The learner writes the paragraph
 *     one sentence per step; code checks length, blanks and repeats, and the shared literacy judge checks each sentence
 *     makes sense and does its step's job. This replaced a scripted hamburger UI that credited any non-empty field.
 *   - `build_paragraph` (open build): `ParagraphBuildSurface`, sentence cards ordered into a paragraph.
 * An unbound mount shows the shared "needs the tutor" card.
 */
import React from 'react';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import ParagraphBuildSurface from './ParagraphBuildSurface';
import WritingStagesSurface from './WritingStagesSurface';
import type { ParagraphItem } from './paragraphBuild';

export interface ParagraphArchitectData {
  title: string;
  paragraphType: 'informational' | 'narrative' | 'opinion';
  gradeLevel: string;
  topic: string;

  // Sentence starters per step (a help lever shows them; one with a blank is the simplify lever's practice).
  topicSentenceFrames: string[];
  detailSentenceFrames: string[];
  concludingSentenceFrames: string[];
  linkingWords: string[];

  /** Generated with the frames; never shown (it is this topic's answer). */
  modelParagraph?: {
    topicSentence: string;
    detailSentences: string[];
    concludingSentence: string;
  };

  supportTier?: 'easy' | 'medium' | 'hard';
  /** `build_paragraph` (open build): the card surface runs the session from `paragraphs`. */
  task?: 'paragraph_build';
  paragraphs?: ParagraphItem[];

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvaluationSubmit?: (result: any) => void;
}

interface ParagraphArchitectProps {
  data: ParagraphArchitectData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

/** One mount, one shape: the open build's cards, or the writing steps. */
function ParagraphArchitectSurface(props: ParagraphArchitectProps) {
  return props.data.task === 'paragraph_build'
    ? <ParagraphBuildSurface {...props} data={{ ...props.data, task: 'paragraph_build', paragraphs: props.data.paragraphs ?? [] } as never} />
    : <WritingStagesSurface {...props} data={props.data} />;
}

const ParagraphArchitect = withWorkspaceOnly<ParagraphArchitectProps>('paragraph-architect', ParagraphArchitectSurface,
  props => props.data.title);

export default ParagraphArchitect;
