'use client';

/**
 * SentenceBuilder — sentence building on the shared tutor/JEV teaching workspace only (R12, user ruling 2026-10-08:
 * the older modes join the live tutor; one path). Two surfaces, one per payload shape:
 *   - the tile modes (simple, compound, complex, compound-complex): `SentenceOrderSurface`. The learner orders ALL the
 *     given tiles into one sentence; a listed order passes in code and an unlisted well-formed one goes to the shared
 *     sentence judge. This replaced a scripted UI whose explore phase banked only the missing tile and whose ask line
 *     printed the sentence itself.
 *   - `build_sentence` (open build): `SentenceBuildSurface`, a question or telling sentence from word tiles.
 * An unbound mount shows the shared "needs the tutor" card.
 */
import React from 'react';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { SentenceBuilderMetrics } from '../../../evaluation/types';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import SentenceBuildSurface from './SentenceBuildSurface';
import SentenceOrderSurface from './SentenceOrderSurface';
import type { SentenceItem } from './sentenceBuild';

export interface SentenceBuilderData {
  title: string;
  gradeLevel: string;
  sentenceType: 'simple' | 'compound' | 'complex' | 'compound-complex';
  /** `build_sentence` (open build): the word-tile surface runs the session from `sentences`; `challenges` is empty. */
  task?: 'sentence_build';
  sentences?: SentenceItem[];

  /** Each is a sentence to order from its tiles. `targetMeaning` is the generator's note; it is never printed. */
  challenges: Array<{
    id: string;
    targetMeaning: string;
    tiles: Array<{
      id: string;
      text: string;
      role: 'subject' | 'predicate' | 'object' | 'modifier' | 'conjunction' | 'punctuation';
    }>;
    validArrangements: string[][];
    hint?: string;
  }>;

  roleColors: Record<string, string>;
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SentenceBuilderMetrics>) => void;
}

interface SentenceBuilderProps {
  data: SentenceBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

/** One mount, one shape: the open build's word tiles, or the tile-order modes. */
function SentenceBuilderSurface(props: SentenceBuilderProps) {
  return props.data.task === 'sentence_build'
    ? <SentenceBuildSurface {...props} data={{ ...props.data, task: 'sentence_build', sentences: props.data.sentences ?? [] } as never} />
    : <SentenceOrderSurface {...props} data={props.data as never} />;
}

const SentenceBuilder = withWorkspaceOnly<SentenceBuilderProps>('sentence-builder', SentenceBuilderSurface,
  props => props.data.title);

export default SentenceBuilder;
