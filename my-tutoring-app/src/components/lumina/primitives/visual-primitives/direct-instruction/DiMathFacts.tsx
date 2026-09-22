'use client';

/**
 * DiMathFacts — DI family primitive #3: the child sees a printed problem
 * ("2 + 1", "5 →", a bare numeral) and says the answer's number word out loud,
 * and the Live tutor teaches it on the shared tutor/JEV workspace
 * (`DiMathFactsTeaching`).
 *
 * ANSWER-LEAK RULE: the stage shows the PRINTED PROBLEM ONLY — the answer never
 * appears before the child says it. The completed equation renders only after a
 * COMMITTED correct answer and in the recap for solved facts.
 *
 * The scripted DISTAR drill that used to run when no live runtime was mounted
 * was deleted in LA-14 S5 (qa/live-runtime-handoffs/13-delete-di-scripted-drills.md).
 * It also shipped a Tier-A misconception packet and silent per-fact response
 * timing; the workspace path reports neither yet (queued for
 * /add-misconception-loop). What it taught that is task structure lives in
 * `diMathFactsDomain`; an unbound mount renders a visible "needs the tutor"
 * state (`DiTeachingStage`).
 */

import type React from 'react';
import type { PrimitiveEvaluationResult, DiMathFactsMetrics } from '../../../evaluation/types';
import type { DiMathFactsChallenge, DiMathFactsChallengeType } from './diMathFactsDomain';
import DiMathFactsTeaching from './DiMathFactsTeaching';

export type { DiMathFactsChallenge, DiMathFactsChallengeType, DiMathFactsSupportTier } from './diMathFactsDomain';

export interface DiMathFactsData {
  title: string;
  description: string;
  /** Printed facts. REQUIRED. Built by the scoped fact pool. */
  challenges: DiMathFactsChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiMathFactsChallengeType;
  /** Flat "2 + 1, 3 + 1" item-set summary (printed problems only, never the
   *  answers), attached by the generator for the tutoring scaffold's RUNTIME
   *  STATE (catalog contextKey `facts`). */
  facts?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiMathFactsMetrics>) => void;
}

export interface DiMathFactsProps {
  data: DiMathFactsData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
export const DiMathFacts: React.FC<DiMathFactsProps> = DiMathFactsTeaching;

export default DiMathFacts;
