'use client';

/**
 * DiSpokenPractice — the DI family's content-generic pack. One component, N
 * skills: the stimulus is data, the script is data, and the judged loop is the
 * shared runner.
 *
 * WHAT THE CHILD DOES. Meets a stimulus (printed text, a picture, a group of
 * pictures, or nothing at all — the tutor says it), hears one scripted ask, and
 * SAYS the answer. The tutor's affirmation is the advance: no Check button, no
 * Next button, no timer.
 *
 * WHY IT IS SHORT. Everything that used to be re-rolled per pack now lives
 * above it — `useJudgedScriptRunner` owns the run lifecycle, progression,
 * correction cap and context sync; `diSpokenPracticeScript` owns the DISTAR
 * skeleton. What remains here is a stimulus renderer and a mic, which is the
 * measured residue of `WordFlip.tsx` (661 lines, one interactive element) and
 * `SoundSwap.tsx` (767 lines, one interactive element).
 *
 * ANSWER-LEAK RULE, STRUCTURALLY. Nothing on screen may name the answer before
 * the tutor affirms it. Two places that is enforced here rather than remembered:
 * `count_and_say` draws N pictures and NEVER a numeral, and tap-to-hear is
 * hidden entirely on `decode` items (where the stimulus IS the answer, so
 * speaking it would read the child their own task — phonics-blender's third-tap
 * defect, closed at the source).
 */

import React, { useCallback, useMemo } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaChallengeCounter,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type {
  DiSpokenPracticeMetrics,
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
import {
  completeCue,
  contextFor,
  itemCue,
  moveOnCue,
  pronounceCue,
  MODE_SHAPE,
  type SpokenPracticeItem,
  type SpokenPracticeMode,
} from './diSpokenPracticeScript';

export type { SpokenPracticeItem, SpokenPracticeMode } from './diSpokenPracticeScript';

export interface DiSpokenPracticeData {
  title: string;
  description: string;
  /** 3-6 items, fully scripted by the generator. May be EMPTY: the generator
   *  refuses to invent unscoped content, and an honest empty state beats
   *  off-topic practice. */
  items: SpokenPracticeItem[];
  /** Session task identity (the resolved eval mode). */
  challengeType: SpokenPracticeMode;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiSpokenPracticeMetrics>) => void;
}

const MODE_ICON: Record<SpokenPracticeMode, string> = {
  say_answer: '💬',
  read_aloud: '📖',
  count_and_say: '🔢',
};

/** Misconception Loop S1 — the task identity, named so a distilled sentence
 *  stays self-limiting under this pack's primitive-scoped key. */
const TASK_PHRASE: Record<SpokenPracticeMode, string> = {
  say_answer: 'producing a spoken answer to a stimulus the child was not shown the answer to',
  read_aloud: 'reading printed text aloud (decoding, not recall)',
  count_and_say: 'counting a group of pictures and saying how many',
};

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — generated data arrives as ONE `data`
 *  prop with the evaluation props merged in, never spread. */
export const DiSpokenPractice: React.FC<{ data: DiSpokenPracticeData; index?: number }> = ({ data }) => {
  const items = data.items ?? [];

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-spoken-practice-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } =
    usePrimitiveEvaluation<DiSpokenPracticeMetrics>({
      primitiveType: 'di-spoken-practice',
      instanceId: resolvedInstanceId,
      skillId: data.skillId,
      subskillId: data.subskillId,
      objectiveId: data.objectiveId,
      exhibitId: data.exhibitId,
      componentIntent: data.componentIntent,
      objectiveText: data.objectiveText,
      onSubmit: data.onEvaluationSubmit,
    });

  // ── The pack ──────────────────────────────────────────────────────────────
  const pack = useMemo<JudgedScriptPack<SpokenPracticeItem>>(() => ({
    primitiveType: 'di-spoken-practice',
    activityLine: 'live direct instruction spoken practice',
    items,
    itemCue,
    moveOnCue,
    completeCue,
    // Returns '' on decode items; the runner sends nothing and the button is
    // hidden, so the tutor can never read the child their own task.
    pronounceCue: (item) => pronounceCue(item),
    contextFor,
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      retry: () => 'Have another go — say your answer.',
      affirmedNext: 'Yes! You said it.',
      done: 'Great talking today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge:
        `Direct Instruction spoken practice — ${TASK_PHRASE[item.mode]}. `
        + `The tutor asked: "${item.ask}"`,
      expected: item.expectedAnswer,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.',
    }),
  }), [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: DiSpokenPracticeMetrics = {
      type: 'di-spoken-practice',
      challengeType: data.challengeType,
      totalChallenges: summary.outcomes.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        summary.attemptsCount / Math.max(summary.outcomes.length, 1),
    };
    submitResult(summary.passed, summary.accuracy, metrics);
  }, [data.challengeType, submitResult]);

  const runner = useJudgedScriptRunner<SpokenPracticeItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: data.gradeLevel || 'kindergarten',
    exhibitId: data.exhibitId,
    onFinished: handleFinished,
  });

  const item = runner.currentItem;
  const canHear = !!item && pronounceCue(item) !== '';

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (it) => ({
      label: `${MODE_SHAPE[it.mode].label} — ${it.stimulusText}`,
      icon: MODE_ICON[it.mode],
    }));
  }, [hasSubmitted, runner.summary, items]);

  // ── Stimulus ──────────────────────────────────────────────────────────────
  // The ONLY thing this component renders that a bespoke pack would. Nothing
  // here may name the answer: 'objects' draws pictures and never a numeral,
  // and 'none' prints nothing at all (the tutor says it).
  const renderStimulus = () => {
    if (!item) return null;
    switch (item.stimulusKind) {
      case 'text':
        return (
          <p className="text-center text-4xl font-semibold tracking-wide text-slate-100">
            {item.stimulusText}
          </p>
        );
      case 'emoji':
        return (
          <div className="text-center text-7xl leading-none" role="img" aria-label="picture clue">
            {item.stimulusEmoji}
          </div>
        );
      case 'objects':
        return (
          <div
            className="flex flex-wrap items-center justify-center gap-3"
            role="img"
            aria-label={`a group of ${item.stimulusText}`}
          >
            {Array.from({ length: item.stimulusCount }, (_, i) => (
              <span key={i} className="text-4xl leading-none">{item.stimulusEmoji}</span>
            ))}
          </div>
        );
      case 'none':
      default:
        return (
          <p className="text-center text-sm uppercase tracking-[0.3em] text-slate-500">
            listen
          </p>
        );
    }
  };

  const stageWord = runner.stage === 'affirmed'
    ? 'yes!'
    : runner.stage === 'asking'
      ? 'your turn'
      : runner.stage === 'judging'
        ? 'listening'
        : 'get ready';

  if (items.length === 0) {
    return (
      <LuminaCard>
        <LuminaCardContent className="py-10 text-center">
          <p className="text-slate-300 text-sm">
            No spoken practice was built for this objective.
          </p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
            <p className="text-slate-400 text-sm">{data.description}</p>
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!hasSubmitted && (
          <>
            <div className="mb-2 flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8">
              {renderStimulus()}
            </div>

            {canHear && (
              <div className="flex justify-center">
                <LuminaButton
                  tone={runner.stimulusTapped ? 'primary' : 'subtle'}
                  className="text-xs"
                  onClick={runner.hearStimulus}
                  disabled={!runner.running}
                >
                  🔊 Hear it
                </LuminaButton>
              </div>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">
              {stageWord}
            </div>

            {/* Every item in this pack is answered out loud. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Practice Complete!"
            celebrationMessage="You answered out loud the whole way through!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DiSpokenPractice;
