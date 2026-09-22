'use client';

/**
 * DiLetterSounds — the first Direct Instruction primitive: the child says the
 * sound a printed letter makes (or the first sound of a word), out loud, and the
 * Live tutor teaches it on the shared tutor/JEV workspace
 * (`DiLetterSoundsTeaching`).
 *
 * The scripted DISTAR drill that used to run when no live runtime was mounted
 * was deleted in LA-14 S5 (qa/live-runtime-handoffs/13-delete-di-scripted-drills.md).
 * The DISTAR content that is task structure (the keyword route, the elicitation
 * fork, the clipped-stop ruling, the block on letter NAMES) lives in
 * `diLetterSoundsDomain`; an unbound mount renders a visible "needs the tutor"
 * state (`DiTeachingStage`).
 */

import type React from 'react';
import type { PrimitiveEvaluationResult, DiLetterSoundsMetrics } from '../../../evaluation/types';
import type { DiLetterSoundChallenge, DiLetterSoundChallengeType } from './diLetterSoundsDomain';
import DiLetterSoundsTeaching from './DiLetterSoundsTeaching';

export type { DiLetterSoundChallenge, DiLetterSoundChallengeType, DiLetterSoundsSupportTier } from './diLetterSoundsDomain';

export interface DiLetterSoundsData {
  title: string;
  description: string;
  /** Letter-sound items, up to `DI_LETTER_SOUNDS_MAX_ITEMS` for a named review
   *  set. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiLetterSoundChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiLetterSoundChallengeType;
  /** Flat "m, s, f" item-set summary, attached by the generator for the
   *  tutoring scaffold's RUNTIME STATE (catalog contextKey `letters`). */
  letters?: string;
  gradeLevel?: string;
  /** Letters the OBJECTIVE names that the session's modes cannot ask.
   *  Reported by the generator, never silently dropped. */
  unaskableLetters?: string[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiLetterSoundsMetrics>) => void;
}

export interface DiLetterSoundsProps {
  data: DiLetterSoundsData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
export const DiLetterSounds: React.FC<DiLetterSoundsProps> = DiLetterSoundsTeaching;

export default DiLetterSounds;
