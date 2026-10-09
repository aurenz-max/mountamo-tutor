'use client';

/**
 * FigurativeLanguageFinder — figures of speech on the shared tutor/JEV teaching workspace only (OB-7L, following R12:
 * the older modes join the live tutor; one path). `FigurativeSurface` runs every mode: find a figure and name it (any
 * figure, any order), say what tagged phrases really mean, and, in `build_figurative`, write your own figures. This
 * replaced a three-phase UI whose "translate" step compared the learner's words to a stored meaning. An unbound mount
 * shows the shared "needs the tutor" card.
 */
import React from 'react';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { FigurativeLanguageFinderMetrics } from '../../../evaluation/types';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import FigurativeSurface from './FigurativeSurface';
import type { FigMake } from './figurativeSteps';

export type FigurativeType = 'simile' | 'metaphor' | 'personification' | 'hyperbole' | 'idiom' | 'alliteration' | 'onomatopoeia' | 'imagery';

export interface FigurativeInstance {
  instanceId: string;
  /** The figurative phrase as it appears in the passage. */
  text: string;
  startIndex: number;
  endIndex: number;
  type: FigurativeType;
  /** What it means in plain words. For an idiom the generator writes the word-for-word reading, so it is never a key. */
  literalMeaning: string;
  explanation: string;
}

export interface FigurativeLanguageFinderData {
  title: string;
  gradeLevel: string;
  passage: string;
  instances: FigurativeInstance[];
  /** The phrases whose meaning the learner writes (2-3). */
  translateInstanceIds: string[];
  /** The kinds a learner can name. */
  availableTypes: FigurativeType[];
  /** Support-tier fields stamped by the generator. Only `classifyTypeChoices` is read: a tighter menu that still holds
   *  every tagged type. The surface marks nothing before it is found, at every tier. */
  prehighlightInstances?: boolean;
  classifyTypeChoices?: FigurativeType[];
  nameStrategyInHints?: boolean;
  /** `build_figurative` (open build): the learner writes one figure per `makes` item. */
  task?: 'figurative_build';
  makes?: FigMake[];

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FigurativeLanguageFinderMetrics>) => void;
}

interface FigurativeLanguageFinderProps {
  data: FigurativeLanguageFinderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

function FigurativeLanguageFinderSurface(props: FigurativeLanguageFinderProps) {
  return <FigurativeSurface {...props} data={props.data as never} />;
}

const FigurativeLanguageFinder = withWorkspaceOnly<FigurativeLanguageFinderProps>('figurative-language-finder',
  FigurativeLanguageFinderSurface, props => props.data.title);

export default FigurativeLanguageFinder;
