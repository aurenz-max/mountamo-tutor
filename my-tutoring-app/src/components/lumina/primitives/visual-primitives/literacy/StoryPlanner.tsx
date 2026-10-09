'use client';

/**
 * StoryPlanner — story planning on the shared tutor/JEV teaching workspace only (OB-7L, following R12: the older modes
 * join the live tutor; one path). `StorySurface` runs every mode. K-1 taps one picture per card and orders the story's
 * events (the tutor reads everything; nothing to read or type). Grade 2+ writes each planning card, judged for
 * answering its question for this story. This replaced a planner that scored grade 2+ cards by text length. An
 * unbound mount shows the shared "needs the tutor" card.
 */
import React from 'react';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { StoryPlannerMetrics } from '../../../evaluation/types';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import StorySurface from './StorySurface';

export { splitPictureOption, shuffleArcEvents } from './storySteps';

export interface StoryElement {
  elementId: string;
  label: string;                     // "Character", "Setting", "Problem", etc.
  prompt: string;                    // "Who is your main character? Describe them."
  required: boolean;
  /** K-1 only. Emoji-prefixed picture options ("🐶 A puppy"); every one is a fair creative pick, never a quiz. */
  choices?: string[];
}

export interface StoryPlannerData {
  title: string;
  gradeLevel: string;
  writingPrompt: string;
  elements: StoryElement[];
  storyArcLabels: string[];
  conflictTypes?: string[];
  dialoguePrompt?: string;
  /** K-1 only. One emoji-prefixed event per arc step IN STORY ORDER: the answer key, never the board order. */
  arcEvents?: string[];
  planningFocus?: 'story_structure' | 'character_setting' | 'conflict_resolution' | 'theme_craft';

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryPlannerMetrics>) => void;
}

interface StoryPlannerProps {
  data: StoryPlannerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

function StoryPlannerSurface(props: StoryPlannerProps) {
  return <StorySurface {...props} data={props.data as never} />;
}

const StoryPlanner = withWorkspaceOnly<StoryPlannerProps>('story-planner', StoryPlannerSurface, props => props.data.title);

export default StoryPlanner;
