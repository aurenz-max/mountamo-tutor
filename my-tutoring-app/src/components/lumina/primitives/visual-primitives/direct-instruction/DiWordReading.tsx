'use client';

/**
 * DiWordReading — DI family primitive #2: the child reads a printed word (a
 * decodable CVC word, or an irregular sight word recalled whole) out loud, and
 * the Live tutor teaches it on the shared tutor/JEV workspace
 * (`DiWordReadingTeaching`).
 *
 * ANSWER-LEAK RULE: decoding print IS the skill, so the stage shows the PRINTED
 * WORD ONLY — no picture, no emoji before the child reads. A challenge's emoji
 * appears only after a COMMITTED correct read (the teaching component's
 * reward trail) and in the completion recap.
 *
 * The scripted DISTAR drill that used to run when no live runtime was mounted
 * was deleted in LA-14 S5 (qa/live-runtime-handoffs/13-delete-di-scripted-drills.md).
 * What it taught that is task structure lives in `diWordReadingDomain`; an
 * unbound mount renders a visible "needs the tutor" state (`DiTeachingStage`).
 */

import type React from 'react';
import type { PrimitiveEvaluationResult, DiWordReadingMetrics } from '../../../evaluation/types';
import type { DiWordReadingChallenge, DiWordReadingChallengeType } from './diWordReadingDomain';
import DiWordReadingTeaching from './DiWordReadingTeaching';

export type { DiWordReadingChallenge, DiWordReadingChallengeType } from './diWordReadingDomain';

export interface DiWordReadingData {
  title: string;
  description: string;
  /** 3-6 printed-word items. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiWordReadingChallenge[];
  /** Representative session task identity (first item on blend/mixed paths). */
  challengeType: DiWordReadingChallengeType;
  /** Flat "sam, mat, cat, hat" item-set summary, attached by the generator for
   *  the tutoring scaffold's RUNTIME STATE (catalog contextKey `words`). The
   *  printed word IS the target and is already on the child's screen, but the
   *  list names words not yet shown, which the catalog's WORD READING directive
   *  covers with an explicit never-preview clause. */
  words?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiWordReadingMetrics>) => void;
}

export interface DiWordReadingProps {
  data: DiWordReadingData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
export const DiWordReading: React.FC<DiWordReadingProps> = DiWordReadingTeaching;

export default DiWordReading;
