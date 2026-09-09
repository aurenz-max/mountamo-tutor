'use client';

/**
 * Oral Sentence Studio — original vocabulary use in complete child sentences.
 *
 * A meaningful scene and two new words stay visible while the child speaks.
 * The Live tutor judges complete thought + scene relevance + semantic word use,
 * never exact wording. Full model sentences are private until feedback.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardDescription,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaReadAloudGlyph,
  LuminaSectionLabel,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { OralSentenceStudioMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { phaseResultsFromSummary, type PhaseConfig } from '../../../hooks/usePhaseResults';
import {
  itemsFromChallenges,
  oralSentenceStudioPack,
  type OralSentenceStudioItem,
} from './oralSentenceStudioScript';

export interface OralSentenceStudioChallenge {
  id: string;
  type: 'describe_scene';
  sceneTitle: string;
  settingEmoji: string;
  settingLabel: string;
  actorEmoji: string;
  actorLabel: string;
  actionEmoji: string;
  actionLabel: string;
  objectEmoji: string;
  objectLabel: string;
  /** Exactly two visible words the child must use. */
  targetWords: [string, string];
  /** Child-friendly meanings aligned by index with targetWords. */
  wordMeanings: [string, string];
  /** Private semantic scene anchor; never rendered before or during an attempt. */
  sceneMeaning: string;
  /** Three private, distinct examples proving the answer set is open. */
  acceptedSentences: [string, string, string];
}

export interface OralSentenceStudioData {
  title: string;
  description: string;
  gradeLevel?: string;
  challengeType: 'describe_scene';
  /** Three long-form spoken challenges, built by the Fork B orchestrator. */
  challenges: OralSentenceStudioChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OralSentenceStudioMetrics>) => void;
}

interface OralSentenceStudioProps {
  data: OralSentenceStudioData;
  className?: string;
}

const PHASE_CONFIG: Record<'describe_scene', PhaseConfig> = {
  describe_scene: { label: 'Picture Sentences', icon: '💬', accentColor: 'cyan' },
};

type FeedbackKind = 'correct' | 'retry';

const OralSentenceStudio: React.FC<OralSentenceStudioProps> = ({ data, className }) => (
  <OralSentenceStudioSession
    key={[data.instanceId ?? '', ...data.challenges.map((challenge) => challenge.id)].join('|')}
    data={data}
    className={className}
  />
);

const OralSentenceStudioSession: React.FC<OralSentenceStudioProps> = ({ data, className }) => {
  const items = useMemo(() => itemsFromChallenges(data.challenges), [data.challenges]);
  const stableInstanceIdRef = useRef(data.instanceId || `oral-sentence-studio-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;
  const transcriptsRef = useRef<Record<string, string[]>>({});
  const [feedbackItem, setFeedbackItem] = useState<OralSentenceStudioItem | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>('retry');

  const evaluation = usePrimitiveEvaluation<OralSentenceStudioMetrics>({
    primitiveType: 'oral-sentence-studio',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const total = items.length;
    const metrics: OralSentenceStudioMetrics = {
      type: 'oral-sentence-studio',
      challengeType: 'describe_scene',
      totalChallenges: total,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: total > 0 ? summary.attemptsCount / total : 0,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      {
        challengeResults: summary.outcomes,
        observations: summary.observations,
        transcripts: transcriptsRef.current,
      },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [evaluation, items.length]);

  const pack = useMemo(() => oralSentenceStudioPack(items), [items]);
  const runner = useJudgedScriptRunner<OralSentenceStudioItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: data.gradeLevel ?? 'K',
    exhibitId: data.exhibitId,
    silenceCloseMs: 1700,
    onAffirmed: (item) => {
      setFeedbackItem(item);
      setFeedbackKind('correct');
    },
    onCorrectionRetry: (item) => {
      setFeedbackItem(item);
      setFeedbackKind('retry');
    },
    onFinished: handleFinished,
    onEmission: (emission, item) => {
      if (!item || emission.kind !== 'attempt-transcript') return;
      (transcriptsRef.current[item.id] ??= []).push(emission.text);
    },
  });

  const currentItem = runner.currentItem ?? items[0] ?? null;
  const phaseResults = useMemo(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, () => PHASE_CONFIG.describe_scene);
  }, [evaluation.hasSubmitted, items, runner.summary]);

  if (!currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These picture sentences are still being made. Try generating the activity again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const challenge = currentItem.challenge;
  const feedbackVisible = feedbackItem != null
    && (feedbackItem.id === currentItem.id || runner.revealHeld);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
            <LuminaCardDescription className="mt-1">{data.description}</LuminaCardDescription>
          </div>
          {!evaluation.hasSubmitted && (
            <LuminaBadge accent="cyan">💬 Picture Sentence</LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              <LuminaReadAloudGlyph size={32} speaking={runner.tutorSpeaking} />
            </div>

            <LuminaPrompt>
              Look at the scene. Say one complete sentence that uses both new words.
            </LuminaPrompt>

            <LuminaPanel accent="cyan" className="overflow-hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <LuminaSectionLabel>Picture to describe</LuminaSectionLabel>
                  <p className="mt-1 font-semibold text-slate-100">{challenge.sceneTitle}</p>
                </div>
                <LuminaBadge accent="cyan">Keep looking while you speak</LuminaBadge>
              </div>

              <div className="relative min-h-56 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-sky-400/15 via-indigo-400/10 to-emerald-400/15 p-5">
                <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-slate-950/45 px-3 py-1.5 text-xs font-semibold text-slate-200">
                  <span className="text-xl" role="img" aria-hidden>{challenge.settingEmoji}</span>
                  {challenge.settingLabel}
                </div>

                <div className="flex min-h-44 items-end justify-center gap-4 pt-12 sm:gap-8">
                  <div className="max-w-32 text-center">
                    <span className="block text-6xl" role="img" aria-label={challenge.actorLabel}>
                      {challenge.actorEmoji}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-slate-100">{challenge.actorLabel}</span>
                  </div>

                  <div className="pb-7 text-center">
                    <span className="block text-4xl" role="img" aria-label={challenge.actionLabel}>
                      {challenge.actionEmoji}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-cyan-100">{challenge.actionLabel}</span>
                    <span className="mt-1 block text-xl text-cyan-200/70" aria-hidden>→</span>
                  </div>

                  <div className="max-w-32 text-center">
                    <span className="block text-6xl" role="img" aria-label={challenge.objectLabel}>
                      {challenge.objectEmoji}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-slate-100">{challenge.objectLabel}</span>
                  </div>
                </div>
              </div>
            </LuminaPanel>

            <LuminaPanel accent="amber">
              <LuminaSectionLabel>Use both new words</LuminaSectionLabel>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {challenge.targetWords.map((word, index) => (
                  <div key={word} className="rounded-xl border border-amber-300/15 bg-amber-300/10 p-4">
                    <p className="text-xl font-bold text-amber-100">{word}</p>
                    <p className="mt-1 text-sm text-slate-300">{challenge.wordMeanings[index]}</p>
                  </div>
                ))}
              </div>
            </LuminaPanel>

            {feedbackVisible && feedbackItem && (
              <LuminaFeedbackCard
                status={feedbackKind === 'correct' ? 'correct' : 'incorrect'}
                label={feedbackKind === 'correct' ? 'Your sentence worked' : 'Build the missing part'}
                teachingNote="This is one possible sentence. Your own wording can be different."
              >
                {feedbackItem.modelResponse}
              </LuminaFeedbackCard>
            )}

            <JudgedMicPanel
              run={runner}
              voiceLabel="Say your whole sentence"
              idleLabel="Start sentence studio"
              openingLabel="Opening sentence studio…"
            >
              {runner.running && (
                <LuminaButton tone="ghost" onClick={runner.hearStimulus}>
                  Hear the words and directions again
                </LuminaButton>
              )}
            </JudgedMicPanel>
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Sentence Studio Complete!"
            celebrationMessage="You used new words to make complete picture sentences."
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default OralSentenceStudio;
