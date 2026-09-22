'use client';

/**
 * DiSentenceReading — the DI family's connected-text pack: the child reads a
 * printed sentence OUT LOUD, every word in order, and the Live tutor teaches it
 * on the shared tutor/JEV workspace (`DiSentenceReadingTeaching`).
 *
 * WHY THIS PACK EXISTS: `read-aloud-studio` owns G1-6 read-aloud but judges
 * nothing ("student self-assessment only"), so it produces no evidence the IRT
 * model can use, and a beginning reader cannot self-assess their own accuracy.
 * This pack takes judged short-sentence accuracy at G1-2 as a fork, so
 * read-aloud-studio's calibrated eval modes keep meaning what they mean.
 *
 * The scripted DISTAR drill that used to run when no live runtime was mounted
 * was deleted in LA-14 S5 (qa/live-runtime-handoffs/13-delete-di-scripted-drills.md).
 * What it taught that is task structure rather than control protocol lives in
 * `diSentenceReadingDomain`; an unbound mount renders a visible "needs the tutor"
 * state (`DiTeachingStage`).
 */

import type React from 'react';
import type { PrimitiveEvaluationResult, DiSentenceReadingMetrics } from '../../../evaluation/types';
import type { DiSentenceReadingChallenge, DiSentenceReadingChallengeType } from './diSentenceReadingDomain';
import DiSentenceReadingTeaching from './DiSentenceReadingTeaching';

export type { DiSentenceReadingChallenge, DiSentenceReadingChallengeType } from './diSentenceReadingDomain';

export interface DiSentenceReadingData {
  title: string;
  description: string;
  /** 3-6 printed sentences. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiSentenceReadingChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiSentenceReadingChallengeType;
  /** Flat "The cat sat. | I see a pig." item-set summary, attached by the
   *  generator for the tutoring scaffold's RUNTIME STATE (catalog contextKey
   *  `sentences`). The printed sentence is both stimulus and target, and is
   *  already on the child's screen, so there is nothing to withhold. */
  sentences?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiSentenceReadingMetrics>) => void;
}

export interface DiSentenceReadingProps {
  data: DiSentenceReadingData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
export const DiSentenceReading: React.FC<DiSentenceReadingProps> = DiSentenceReadingTeaching;

export default DiSentenceReading;
