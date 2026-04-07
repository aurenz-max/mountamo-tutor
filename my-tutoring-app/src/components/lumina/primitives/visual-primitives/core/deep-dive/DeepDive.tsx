'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../../evaluation';
import type { DeepDiveMetrics } from '../../../../evaluation/types';
import { useLuminaAI } from '../../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../../components/PhaseSummaryPanel';

import type {
  DeepDiveData,
  DeepDiveBlock,
  MultipleChoiceBlockData,
} from './types';

// Block components
import { HeroImageBlock, KeyFactsBlock, DataTableBlock, MultipleChoiceBlock, PullQuoteBlock, ProseBlock } from './blocks';

// ── Phase config for evaluable blocks ───────────────────────────────
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'multiple-choice': { label: 'Knowledge Check', icon: '\u2753', accentColor: 'blue' },
  'fill-in-blank': { label: 'Vocabulary', icon: '\u270F\uFE0F', accentColor: 'purple' },
};

// ── Helper: extract evaluable blocks ────────────────────────────────
interface EvaluableChallenge {
  id: string;
  type: string;
  block: DeepDiveBlock;
}

function getEvaluableChallenges(blocks: DeepDiveBlock[]): EvaluableChallenge[] {
  return blocks
    .filter((b) => b.blockType === 'multiple-choice' || b.blockType === 'fill-in-blank')
    .map((b) => ({ id: b.id, type: b.blockType, block: b }));
}

// ── Transition cue component ─────────────────────────────────────────
const TransitionCue: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-3 px-2 py-1">
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <p className="text-xs text-slate-500 italic font-light max-w-md text-center leading-relaxed">
      {text}
    </p>
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

// ── Progress segments ─────────────────────────────────────────────────
const ProgressBar: React.FC<{ blocks: DeepDiveBlock[]; answeredIds: Set<string> }> = ({ blocks, answeredIds }) => {
  return (
    <div className="flex gap-1">
      {blocks.map((block, i) => {
        const isEvaluable = block.blockType === 'multiple-choice' || block.blockType === 'fill-in-blank';
        const isAnswered = answeredIds.has(block.id);

        let color = 'bg-white/10'; // default: display block (not yet scrolled to)
        if (isEvaluable && isAnswered) {
          color = 'bg-emerald-400/70';
        } else if (isEvaluable) {
          color = 'bg-amber-400/30';
        } else {
          color = 'bg-white/15';
        }

        return (
          <div
            key={block.id}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${color}`}
          />
        );
      })}
    </div>
  );
};

// ── Props ─────────────────────────────────────────────────────────────

interface DeepDiveProps {
  data: DeepDiveData;
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────

const DeepDive: React.FC<DeepDiveProps> = ({ data, className }) => {
  const {
    title,
    subtitle,
    topic,
    blocks,
    narrativeArc,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || 'deep-dive-preview';

  // ── Evaluation hooks ──────────────────────────────────────────
  const evaluableChallenges = useMemo(() => getEvaluableChallenges(blocks), [blocks]);
  const hasEval = evaluableChallenges.length > 0;

  const {
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = useChallengeProgress({
    challenges: evaluableChallenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges: evaluableChallenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Timing ────────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  // ── Evaluation submission ─────────────────────────────────────
  const { submitResult } = usePrimitiveEvaluation<DeepDiveMetrics>({
    primitiveType: 'deep-dive',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult<DeepDiveMetrics> | null>(null);

  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || !hasEval) return;
    setHasSubmitted(true);
    const duration = Date.now() - startTimeRef.current;
    setElapsedMs(duration);

    const correctCount = challengeResults.filter((r) => r.correct).length;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const overallScore = Math.round((correctCount / evaluableChallenges.length) * 100);

    const result = submitResult(
      overallScore >= 70,
      overallScore,
      {
        type: 'deep-dive',
        totalBlocks: blocks.length,
        evaluableBlocks: evaluableChallenges.length,
        correctAnswers: correctCount,
        totalAttempts,
        blockBreakdown: challengeResults.map((r) => ({
          blockId: r.challengeId,
          correct: r.correct,
          attempts: r.attempts,
        })),
      },
    );
    setSubmittedResult(result);
  }, [
    allChallengesComplete, hasSubmitted, hasEval, challengeResults,
    evaluableChallenges, blocks.length, submitResult,
  ]);

  // ── AI Tutor ──────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    topic,
    blockCount: blocks.length,
    evaluableBlockCount: evaluableChallenges.length,
    narrativeArc: narrativeArc || '',
    blockLabels: blocks.map((b) => `${b.blockType}: ${b.label}`).join(', '),
  }), [title, topic, blocks, evaluableChallenges.length, narrativeArc]);

  const { sendText } = useLuminaAI({
    primitiveType: 'deep-dive',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel || 'Elementary',
  });

  // ── Block answer handler ──────────────────────────────────────
  const handleBlockAnswer = useCallback(
    (blockId: string, correct: boolean, attempts: number) => {
      recordResult({
        challengeId: blockId,
        correct,
        attempts,
      });

      // AI tutor messages
      const block = blocks.find((b) => b.id === blockId) as MultipleChoiceBlockData | undefined;
      if (block) {
        if (correct) {
          sendText(
            `[ANSWER_CORRECT] Student answered "${block.label}" correctly in ${attempts} attempt(s). Brief congratulation.`,
            { silent: true },
          );
        } else {
          sendText(
            `[ANSWER_INCORRECT] Student couldn't answer "${block.label}" after ${attempts} attempts. The answer was revealed. Encourage them gently.`,
            { silent: true },
          );
        }
      }
    },
    [blocks, recordResult, sendText],
  );

  // ── Track which blocks have been answered ─────────────────────
  const answeredBlockIds = useMemo(
    () => new Set(challengeResults.map((r) => r.challengeId)),
    [challengeResults],
  );

  // ── Send intro message ────────────────────────────────────────
  const sentIntroRef = useRef(false);
  useEffect(() => {
    if (!sentIntroRef.current && blocks.length > 0) {
      sentIntroRef.current = true;
      sendText(
        `[DEEP_DIVE_START] Topic: "${title}". ${blocks.length} blocks to explore (${evaluableChallenges.length} interactive). Introduce the topic briefly and invite exploration.`,
        { silent: true },
      );
    }
  }, [blocks.length, evaluableChallenges.length, title, sendText]);

  // ── Send completion message ───────────────────────────────────
  useEffect(() => {
    if (allChallengesComplete && hasEval && phaseResults.length > 0) {
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = submittedResult?.score ?? 0;
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. Give encouraging phase-specific feedback.`,
        { silent: true },
      );
    }
  }, [allChallengesComplete, hasEval, phaseResults, submittedResult, sendText]);

  // ── Render blocks with transitions ─────────────────────────────
  const renderBlockWithTransition = (block: DeepDiveBlock, idx: number) => {
    const renderedBlock = (() => {
      switch (block.blockType) {
        case 'hero-image':
          return <HeroImageBlock key={block.id} data={block} index={idx} />;
        case 'key-facts':
          return <KeyFactsBlock key={block.id} data={block} index={idx} />;
        case 'data-table':
          return <DataTableBlock key={block.id} data={block} index={idx} />;
        case 'pull-quote':
          return <PullQuoteBlock key={block.id} data={block} index={idx} />;
        case 'prose':
          return <ProseBlock key={block.id} data={block} index={idx} />;
        case 'multiple-choice':
          return (
            <MultipleChoiceBlock
              key={block.id}
              data={block}
              index={idx}
              onAnswer={handleBlockAnswer}
              answered={answeredBlockIds.has(block.id)}
            />
          );
        default:
          return (
            <div key={block.id} className="p-4 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-sm">
              Block type &quot;{block.blockType}&quot; coming soon
            </div>
          );
      }
    })();

    // Render transition cue AFTER this block (before the next one)
    const transitionCue = block.transitionCue;
    const isLast = idx === blocks.length - 1;

    return (
      <React.Fragment key={block.id}>
        {renderedBlock}
        {transitionCue && !isLast && (
          <TransitionCue text={transitionCue} />
        )}
      </React.Fragment>
    );
  };

  return (
    <div className={`space-y-5 ${className || ''}`}>
      {/* Header */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
              Deep Dive
            </Badge>
            <span className="text-slate-600 text-xs">
              {blocks.length} sections
            </span>
            {hasEval && (
              <>
                <span className="text-slate-700">&middot;</span>
                <span className="text-amber-400/70 text-xs">
                  {evaluableChallenges.length} {evaluableChallenges.length === 1 ? 'question' : 'questions'}
                </span>
              </>
            )}
          </div>
          <CardTitle className="text-2xl font-light text-white tracking-tight">{title}</CardTitle>
          {subtitle && (
            <p className="text-slate-400 text-sm mt-1 font-light">{subtitle}</p>
          )}
          {/* Segmented progress bar */}
          <div className="mt-4">
            <ProgressBar blocks={blocks} answeredIds={answeredBlockIds} />
          </div>
        </CardHeader>
      </Card>

      {/* Blocks with transitions */}
      {blocks.map((block, idx) => renderBlockWithTransition(block, idx))}

      {/* Phase Summary */}
      {allChallengesComplete && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score ?? 0}
          durationMs={elapsedMs}
          heading="Deep Dive Complete!"
          celebrationMessage={`You explored ${blocks.length} blocks and answered ${evaluableChallenges.length} questions.`}
          className="mb-6"
        />
      )}
    </div>
  );
};

export default DeepDive;
