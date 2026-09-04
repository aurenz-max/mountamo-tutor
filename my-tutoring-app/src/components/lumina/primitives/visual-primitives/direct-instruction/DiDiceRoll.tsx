'use client';

/**
 * DiDiceRoll — a DI-native dice quantity, comparison, and addition primitive.
 *
 * The child starts the Live tutor, taps the die itself, watches a deterministic
 * controlled roll, and answers the current pip task aloud. The tutor's in-band
 * verdict advances the run. The finalized value lives in challenge data before
 * animation starts; intermediate faces are presentational and never announced.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaPanel,
  LuminaPrompt,
  motion,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type {
  DiDiceRollMetrics,
  PrimitiveEvaluationResult,
} from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';
import {
  completeCue,
  contextFor,
  diceValuesFor,
  itemCue,
  isTwoDiceChallenge,
  moveOnCue,
  retryPrompt,
  studentPrompt,
  type DiDiceRollChallenge,
  type DiDiceRollChallengeType,
  type DieValue,
} from './diDiceRollScript';

export type {
  DiDiceRollChallenge,
  DiDiceRollChallengeType,
  DiceComparison,
  DiDiceRollSupportTier,
  DieValue,
} from './diDiceRollScript';

export type DieSides = 6 | 8 | 10 | 12 | 20;

export interface DieProps {
  value: number;
  sides?: DieSides;
  representation?: 'pips' | 'numeral';
  size?: 'sm' | 'md' | 'lg';
  appearance?: 'rounded' | 'classic' | 'soft';
  rolling?: boolean;
  ariaLabel?: string;
  className?: string;
}

export interface DiDiceRollData {
  title: string;
  description: string;
  /** 3-6 controlled rolls. REQUIRED. Built by the local value/pair pools. */
  challenges: DiDiceRollChallenge[];
  /** Representative metadata; mixed sessions render from each challenge's type. */
  challengeType: DiDiceRollChallengeType;
  appearance?: DieProps['appearance'];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiDiceRollMetrics>) => void;
}

const PIP_POSITIONS: Record<number, ReadonlySet<number>> = {
  1: new Set([4]),
  2: new Set([0, 8]),
  3: new Set([0, 4, 8]),
  4: new Set([0, 2, 6, 8]),
  5: new Set([0, 2, 4, 6, 8]),
  6: new Set([0, 2, 3, 5, 6, 8]),
};

const DIE_SIZE: Record<NonNullable<DieProps['size']>, string> = {
  sm: 'h-16 w-16 p-2.5',
  md: 'h-24 w-24 p-4',
  lg: 'h-32 w-32 p-5',
};

const PIP_SIZE: Record<NonNullable<DieProps['size']>, string> = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-5 w-5',
};

const DIE_APPEARANCE: Record<NonNullable<DieProps['appearance']>, string> = {
  rounded: 'rounded-[1.75rem] border-2 border-violet-200/70 bg-white shadow-[0_10px_0_rgba(196,181,253,0.55),0_18px_35px_rgba(15,23,42,0.28)]',
  classic: 'rounded-2xl border-2 border-slate-300 bg-white shadow-[0_9px_0_rgba(148,163,184,0.45),0_16px_30px_rgba(15,23,42,0.25)]',
  soft: 'rounded-[2rem] border border-violet-200/50 bg-violet-50 shadow-[0_9px_0_rgba(196,181,253,0.42),0_16px_30px_rgba(15,23,42,0.22)]',
};

/** Reusable controlled visual. It never generates values or owns scoring. */
export const Die: React.FC<DieProps> = ({
  value,
  sides = 6,
  representation = 'pips',
  size = 'lg',
  appearance = 'rounded',
  rolling = false,
  ariaLabel = 'Die with a dot pattern',
  className = '',
}) => {
  const valid = Number.isInteger(value) && value >= 1 && value <= sides;
  const showPips = valid && representation === 'pips' && sides === 6;
  const occupied = showPips ? PIP_POSITIONS[value] : undefined;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`grid grid-cols-3 grid-rows-3 place-items-center text-4xl font-bold text-violet-700 transition-transform ${DIE_SIZE[size]} ${DIE_APPEARANCE[appearance]} ${rolling ? 'animate-bounce motion-reduce:animate-none' : ''} ${className}`}
    >
      {showPips
        ? Array.from({ length: 9 }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={occupied?.has(index)
                ? `${PIP_SIZE[size]} rounded-full bg-violet-600 shadow-sm`
                : PIP_SIZE[size]}
            />
          ))
        : (
            <span aria-hidden="true" className="col-span-3 row-span-3 self-center">
              {valid ? value : '?'}
            </span>
          )}
    </div>
  );
};

const rollFrames = (target: DieValue): DieValue[] => [
  ((target + 1) % 6 + 1) as DieValue,
  ((target + 3) % 6 + 1) as DieValue,
  ((target + 4) % 6 + 1) as DieValue,
  ((target + 2) % 6 + 1) as DieValue,
  target,
];

const ROLL_START_DELAY_MS = 60;
const ROLL_FRAME_MS = 90;

export const DiDiceRoll: React.FC<{ data: DiDiceRollData; index?: number }> = ({ data }) => {
  const items = data.challenges;
  const [displayedValues, setDisplayedValues] = useState<DieValue[] | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [reward, setReward] = useState<DiDiceRollChallenge | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearRollTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearRollTimers(), [clearRollTimers]);

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-dice-roll-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } =
    usePrimitiveEvaluation<DiDiceRollMetrics>({
      primitiveType: 'di-dice-roll',
      instanceId: resolvedInstanceId,
      skillId: data.skillId,
      subskillId: data.subskillId,
      objectiveId: data.objectiveId,
      exhibitId: data.exhibitId,
      componentIntent: data.componentIntent,
      objectiveText: data.objectiveText,
      onSubmit: data.onEvaluationSubmit,
    });

  const pack = useMemo<JudgedScriptPack<DiDiceRollChallenge>>(() => ({
    primitiveType: 'di-dice-roll',
    activityLine: 'live direct instruction dice counting, comparing, and adding',
    items,
    itemCue,
    moveOnCue,
    completeCue,
    contextFor,
    statusLines: {
      ready: (current) => studentPrompt(current),
      retry: retryPrompt,
      noVerdict: (current) => current.challengeType === 'compare_dice'
        ? 'One more time — left, right, or same?'
        : 'One more time — what is your number?',
      affirmedNext: 'Yes! Get ready to roll again.',
      done: 'Great dice work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge: item.challengeType === 'count_pips'
        ? `Direct Instruction dice quantity recognition — one die showed ${item.value} pips.`
        : item.challengeType === 'sum_two_dice'
          ? `Direct Instruction dice addition — the dice showed ${item.value} and ${item.secondValue} pips.`
          : `Direct Instruction quantity comparison — the left and right dice showed ${item.value} and ${item.secondValue} pips.`,
      expected: item.challengeType === 'compare_dice'
        ? `Say "${item.spokenAnswer}" to identify the larger side or equality.`
        : `Say the number word "${item.spokenAnswer}".`,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the spoken quantity wrong.',
    }),
  }), [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const timed = summary.outcomes.filter((outcome) => outcome.seconds != null);
    const meanResponseMs = timed.length
      ? Math.round(
          timed.reduce((sum, outcome) => sum + (outcome.seconds ?? 0) * 1000, 0)
          / timed.length,
        )
      : null;
    const metrics: DiDiceRollMetrics = {
      type: 'di-dice-roll',
      challengeType: items[0]?.challengeType ?? data.challengeType,
      challengeTypesTested: Array.from(new Set(items.map((challenge) => challenge.challengeType))),
      totalChallenges: summary.outcomes.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        summary.attemptsCount / Math.max(summary.outcomes.length, 1),
      meanResponseMs,
    };
    submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { outcomes: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [data.challengeType, items, submitResult]);

  const handleItemOpened = useCallback(() => {
    clearRollTimers();
    setDisplayedValues(null);
    setIsRolling(false);
  }, [clearRollTimers]);

  const runner = useJudgedScriptRunner<DiDiceRollChallenge>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: data.gradeLevel || 'kindergarten',
    exhibitId: data.exhibitId,
    onFinished: handleFinished,
    onItemOpened: handleItemOpened,
    onAffirmed: setReward,
  });

  const item = runner.currentItem;

  const handleRoll = useCallback(() => {
    if (!item || !runner.canAttempt || isRolling || displayedValues != null) return;
    clearRollTimers();
    SoundManager.tap();

    const targets = [...diceValuesFor(item)];

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayedValues(targets);
      SoundManager.snap();
      return;
    }

    setIsRolling(true);
    const frames = targets.map(rollFrames);
    frames[0].forEach((_frame, index) => {
      const timer = window.setTimeout(() => {
        setDisplayedValues(frames.map((dieFrames) => dieFrames[index]));
        if (index === frames[0].length - 1) {
          SoundManager.snap();
          setIsRolling(false);
        } else {
          SoundManager.tick();
        }
      }, ROLL_START_DELAY_MS + index * ROLL_FRAME_MS);
      timersRef.current.push(timer);
    });
  }, [clearRollTimers, displayedValues, isRolling, item, runner.canAttempt]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (challenge) => ({
      label: challenge.challengeType === 'count_pips'
        ? 'Count the dots'
        : challenge.challengeType === 'compare_dice'
          ? 'Compare the dice'
          : 'Add the dice',
      icon: '🎲',
      accentColor: 'purple',
    }));
  }, [hasSubmitted, items, runner.summary]);

  if (items.length === 0) {
    return (
      <LuminaCard>
        <LuminaCardContent className="py-10 text-center text-sm text-slate-300">
          No dice practice was built for this objective.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const reveal = runner.revealHeld && reward;
  const visualItem = reveal ? reward : item;
  const valuesToRender = reveal ? [...diceValuesFor(reward)] : displayedValues;
  const usesTwoDice = visualItem ? isTwoDiceChallenge(visualItem) : false;
  const dieLabel = valuesToRender == null
    ? usesTwoDice ? 'Roll both dice' : 'Roll the die'
    : reveal
      ? reward.challengeType === 'count_pips'
        ? `Die showing ${reward.spokenAnswer} ${reward.value === 1 ? 'dot' : 'dots'}.`
        : reward.challengeType === 'sum_two_dice'
          ? `Dice showing ${reward.value} and ${reward.secondValue}; ${reward.spokenAnswer} dots altogether.`
          : `Left die ${reward.value}, right die ${reward.secondValue}; ${reward.spokenAnswer}.`
      : visualItem?.challengeType === 'compare_dice'
        ? 'Two dice with dot patterns. Say which has more: left, right, or same.'
        : usesTwoDice
          ? 'Two dice with dot patterns. Say how many dots there are altogether.'
          : 'Die with a dot pattern. Say how many dots you see.';
  const rewardHeadline = reveal
    ? reward.challengeType === 'compare_dice'
      ? reward.comparison === 'same'
        ? 'Same amount'
        : `${reward.comparison === 'left' ? 'Left' : 'Right'} has more`
      : reward.spokenAnswer
    : '';
  const rewardDetail = reveal
    ? reward.challengeType === 'count_pips'
      ? `${reward.value} ${reward.value === 1 ? 'dot' : 'dots'}`
      : reward.challengeType === 'sum_two_dice'
        ? `${reward.value} + ${reward.secondValue} = ${reward.total}`
        : `${reward.value} dots · ${reward.secondValue} dots`
    : '';
  const stageWord = isRolling
    ? 'rolling…'
    : valuesToRender == null
      ? runner.running ? usesTwoDice ? 'tap both dice' : 'tap the die' : 'start the tutor'
      : runner.stage === 'judging'
        ? 'listening'
        : reveal
          ? `yes — ${rewardHeadline}`
          : visualItem?.challengeType === 'compare_dice'
            ? 'say left, right, or same'
            : 'say your number';

  return (
    <LuminaCard surface="elevated" className="mx-auto max-w-3xl">
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle>{data.title || 'Dice Time'}</LuminaCardTitle>
            <p className="text-sm text-slate-400">{data.description}</p>
          </div>
          <LuminaBadge accent="purple" className="text-xs">Roll &amp; say</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!hasSubmitted && item && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            <LuminaPrompt>{studentPrompt(item)}</LuminaPrompt>

            <LuminaPanel accent="purple" className="flex min-h-64 flex-col items-center justify-center py-8">
              <button
                type="button"
                onClick={handleRoll}
                disabled={!runner.canAttempt || isRolling || displayedValues != null}
                aria-label={dieLabel}
                className="rounded-[2rem] p-2 outline-none transition-transform hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-violet-400/70 disabled:cursor-default disabled:hover:scale-100"
              >
                <div className="flex items-end justify-center gap-5 sm:gap-8">
                  {Array.from({ length: usesTwoDice ? 2 : 1 }, (_, dieIndex) => (
                    <div key={dieIndex} className="flex flex-col items-center gap-2">
                      {visualItem?.challengeType === 'compare_dice' && (
                        <span
                          aria-hidden="true"
                          className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300"
                        >
                          {dieIndex === 0 ? 'Left' : 'Right'}
                        </span>
                      )}
                      {valuesToRender == null ? (
                        <div
                          aria-hidden="true"
                          className={`${usesTwoDice ? 'h-24 w-24' : 'h-32 w-32'} grid place-items-center rounded-[1.75rem] border-2 border-dashed border-violet-300/60 bg-violet-500/10 text-4xl font-semibold text-violet-200`}
                        >
                          ?
                        </div>
                      ) : (
                        <Die
                          value={valuesToRender[dieIndex]}
                          size={usesTwoDice ? 'md' : 'lg'}
                          rolling={isRolling}
                          appearance={data.appearance}
                          ariaLabel={visualItem?.challengeType === 'compare_dice'
                            ? `${dieIndex === 0 ? 'Left' : 'Right'} die with a dot pattern`
                            : 'Die with a dot pattern'}
                          className={reveal ? motion.pop : motion.reveal}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </button>

              {reveal && (
                <div className={`mt-5 text-center ${motion.pop}`}>
                  <div className="text-4xl font-bold capitalize text-emerald-300">
                    {rewardHeadline}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-emerald-200">
                    {rewardDetail}
                  </div>
                </div>
              )}

              <div
                aria-live="polite"
                className="mt-5 text-xs uppercase tracking-[0.25em] text-violet-300"
              >
                {stageWord}
              </div>
            </LuminaPanel>

            <JudgedMicPanel run={runner} />
          </>
        )}

        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Dice Practice Complete!"
            celebrationMessage="You rolled, looked, and answered out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DiDiceRoll;
