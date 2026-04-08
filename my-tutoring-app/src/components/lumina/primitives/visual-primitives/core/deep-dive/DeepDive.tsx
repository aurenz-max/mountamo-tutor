'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
import { computeBlockSizeHints, type SizeHint } from '../../../../utils/editorial-layout';

import type {
  DeepDiveData,
  DeepDiveBlock,
  WrapperLayout,
  MultipleChoiceBlockData,
  FillInBlankBlockData,
  DiagramBlockData,
  MiniSimBlockData,
} from './types';

// Block components
import { HeroImageBlock, KeyFactsBlock, DataTableBlock, MultipleChoiceBlock, PullQuoteBlock, ProseBlock, TimelineBlock, FillInBlankBlock, CompareContrastBlock, DiagramBlock, MiniSimBlock } from './blocks';

// ── Phase config for evaluable blocks ───────────────────────────────
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'multiple-choice': { label: 'Knowledge Check', icon: '\u2753', accentColor: 'blue' },
  'fill-in-blank': { label: 'Vocabulary', icon: '\u270F\uFE0F', accentColor: 'purple' },
  'diagram': { label: 'Diagram Analysis', icon: '\uD83D\uDDFA\uFE0F', accentColor: 'cyan' },
  'mini-sim': { label: 'Prediction', icon: '\uD83E\uDDEA', accentColor: 'cyan' },
};

// ── Helper: extract evaluable blocks ────────────────────────────────
interface EvaluableChallenge {
  id: string;
  type: string;
  block: DeepDiveBlock;
}

function getEvaluableChallenges(blocks: DeepDiveBlock[]): EvaluableChallenge[] {
  return blocks
    .filter((b) => {
      if (b.blockType === 'multiple-choice' || b.blockType === 'fill-in-blank') return true;
      if (b.blockType === 'diagram') return (b as DiagramBlockData).interactionMode === 'label';
      if (b.blockType === 'mini-sim') return !!(b as MiniSimBlockData).prediction;
      return false;
    })
    .map((b) => ({ id: b.id, type: b.blockType, block: b }));
}

function isEvaluableBlockType(blockType: string, block?: DeepDiveBlock): boolean {
  if (blockType === 'multiple-choice' || blockType === 'fill-in-blank') return true;
  if (blockType === 'diagram' && block) return (block as DiagramBlockData).interactionMode === 'label';
  if (blockType === 'mini-sim' && block) return !!(block as MiniSimBlockData).prediction;
  return false;
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
      {blocks.map((block) => {
        const isEvaluable = isEvaluableBlockType(block.blockType, block);
        const isAnswered = answeredIds.has(block.id);

        let color = 'bg-white/15';
        if (isEvaluable && isAnswered) {
          color = 'bg-emerald-400/70';
        } else if (isEvaluable) {
          color = 'bg-amber-400/30';
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

// ── Layout badge labels ──────────────────────────────────────────────
const LAYOUT_LABELS: Record<WrapperLayout, string> = {
  stack: 'Deep Dive',
  grid_2col: 'Deep Dive \u2022 Grid',
  reveal_progressive: 'Deep Dive \u2022 Guided',
  masonry: 'Deep Dive \u2022 Mosaic',
};

// ── Reveal Progressive hook ──────────────────────────────────────────
const DWELL_MS = 2500; // display blocks need 2.5s in view to unlock next

function useRevealProgressive(
  blocks: DeepDiveBlock[],
  answeredBlockIds: Set<string>,
  enabled: boolean,
) {
  // First block always visible
  const [revealedCount, setRevealedCount] = useState(enabled ? 1 : blocks.length);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const currentBlockRef = useRef<HTMLDivElement | null>(null);

  // When a block is answered (evaluable) or dwelled on (display), reveal the next
  useEffect(() => {
    if (!enabled || revealedCount >= blocks.length) return;

    const currentBlock = blocks[revealedCount - 1];
    if (!currentBlock) return;

    // Evaluable blocks: reveal next when answered
    if (isEvaluableBlockType(currentBlock.blockType, currentBlock)) {
      if (answeredBlockIds.has(currentBlock.id)) {
        setRevealedCount((c) => Math.min(c + 1, blocks.length));
      }
      return;
    }

    // Display blocks: reveal next after dwell time in viewport
    const el = currentBlockRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dwellTimerRef.current = setTimeout(() => {
            setRevealedCount((c) => Math.min(c + 1, blocks.length));
          }, DWELL_MS);
        } else if (dwellTimerRef.current) {
          clearTimeout(dwellTimerRef.current);
          dwellTimerRef.current = null;
        }
      },
      { threshold: 0.3 },
    );
    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [enabled, revealedCount, blocks, answeredBlockIds]);

  // Reset when blocks change
  useEffect(() => {
    if (enabled) setRevealedCount(1);
  }, [blocks.length, enabled]);

  return { revealedCount, currentBlockRef };
}

// ── Size hint → grid span class mapping ─────────────────────────────
function gridSpanClass(sizeHint: SizeHint): string {
  switch (sizeHint) {
    case 'full':
    case 'wide':
      return 'col-span-2';
    default:
      return 'col-span-1';
  }
}

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
    layout: wrapperLayout = 'stack',
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

      const block = blocks.find((b) => b.id === blockId) as (MultipleChoiceBlockData | FillInBlankBlockData) | undefined;
      if (block) {
        const blockLabel = block.label || block.blockType;
        if (correct) {
          sendText(
            `[ANSWER_CORRECT] Student answered "${blockLabel}" correctly in ${attempts} attempt(s). Brief congratulation.`,
            { silent: true },
          );
        } else {
          sendText(
            `[ANSWER_INCORRECT] Student couldn't answer "${blockLabel}" after ${attempts} attempts. The answer was revealed. Encourage them gently.`,
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

  // ── Reveal progressive state ──────────────────────────────────
  const { revealedCount, currentBlockRef } = useRevealProgressive(
    blocks,
    answeredBlockIds,
    wrapperLayout === 'reveal_progressive',
  );

  // ── Pretext size hints (for grid_2col and masonry) ────────────
  const [containerWidth, setContainerWidth] = useState(700);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sizeHints = useMemo(() => {
    if (wrapperLayout !== 'grid_2col' && wrapperLayout !== 'masonry') return [];
    return computeBlockSizeHints(blocks as Parameters<typeof computeBlockSizeHints>[0], containerWidth);
  }, [blocks, containerWidth, wrapperLayout]);

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

  // ── Render a single block ─────────────────────────────────────
  const renderBlock = useCallback((block: DeepDiveBlock, idx: number) => {
    switch (block.blockType) {
      case 'hero-image':
        return <HeroImageBlock data={block} index={idx} />;
      case 'key-facts':
        return <KeyFactsBlock data={block} index={idx} />;
      case 'data-table':
        return <DataTableBlock data={block} index={idx} />;
      case 'pull-quote':
        return <PullQuoteBlock data={block} index={idx} />;
      case 'prose':
        return <ProseBlock data={block} index={idx} />;
      case 'multiple-choice':
        return (
          <MultipleChoiceBlock
            data={block}
            index={idx}
            onAnswer={handleBlockAnswer}
            answered={answeredBlockIds.has(block.id)}
          />
        );
      case 'timeline':
        return <TimelineBlock data={block} index={idx} />;
      case 'fill-in-blank':
        return (
          <FillInBlankBlock
            data={block}
            index={idx}
            onAnswer={handleBlockAnswer}
            answered={answeredBlockIds.has(block.id)}
          />
        );
      case 'compare-contrast':
        return <CompareContrastBlock data={block} index={idx} />;
      case 'diagram': {
        const diagramBlock = block as DiagramBlockData;
        if (diagramBlock.interactionMode === 'label') {
          return (
            <DiagramBlock
              data={diagramBlock}
              index={idx}
              onAnswer={handleBlockAnswer}
              answered={answeredBlockIds.has(block.id)}
            />
          );
        }
        return <DiagramBlock data={diagramBlock} index={idx} />;
      }
      case 'mini-sim': {
        const simBlock = block as MiniSimBlockData;
        if (simBlock.prediction) {
          return (
            <MiniSimBlock
              data={simBlock}
              index={idx}
              onAnswer={handleBlockAnswer}
              answered={answeredBlockIds.has(block.id)}
            />
          );
        }
        return <MiniSimBlock data={simBlock} index={idx} />;
      }
      default:
        return (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-sm">
            Block type &quot;{block.blockType}&quot; coming soon
          </div>
        );
    }
  }, [handleBlockAnswer, answeredBlockIds]);

  // ── Layout renderers ───────────────────────────────────────────

  const renderStackLayout = () => (
    <div className="space-y-5">
      {blocks.map((block, idx) => (
        <React.Fragment key={block.id}>
          {renderBlock(block, idx)}
          {block.transitionCue && idx < blocks.length - 1 && (
            <TransitionCue text={block.transitionCue} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderGrid2ColLayout = () => (
    <div className="grid grid-cols-2 gap-4">
      {blocks.map((block, idx) => {
        const hint = sizeHints[idx] || 'standard';
        return (
          <div key={block.id} className={gridSpanClass(hint)}>
            {renderBlock(block, idx)}
          </div>
        );
      })}
    </div>
  );

  const renderRevealProgressiveLayout = () => (
    <div className="space-y-5">
      {blocks.map((block, idx) => {
        const isRevealed = idx < revealedCount;
        const isCurrentBlock = idx === revealedCount - 1;

        return (
          <div
            key={block.id}
            ref={isCurrentBlock ? currentBlockRef : undefined}
            className={`transition-all duration-700 ease-out ${
              isRevealed
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 h-0 overflow-hidden pointer-events-none'
            }`}
          >
            {renderBlock(block, idx)}
            {block.transitionCue && idx < blocks.length - 1 && isRevealed && (
              <div className="mt-5">
                <TransitionCue text={block.transitionCue} />
              </div>
            )}
          </div>
        );
      })}
      {revealedCount < blocks.length && (
        <div className="text-center py-4">
          <p className="text-xs text-slate-600 italic">
            {isEvaluableBlockType(blocks[revealedCount - 1]?.blockType, blocks[revealedCount - 1])
              ? 'Answer the question above to continue...'
              : 'Reading...'}
          </p>
          <div className="mt-2 flex justify-center gap-1">
            {blocks.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  i < revealedCount ? 'bg-indigo-400/70' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderMasonryLayout = () => {
    // Separate full-span blocks (hero-image) from masonry-eligible blocks
    const masonryBlocks: Array<{ block: DeepDiveBlock; idx: number; hint: SizeHint }> = [];
    const fullBleedBlocks: Array<{ block: DeepDiveBlock; idx: number }> = [];

    blocks.forEach((block, idx) => {
      const hint = sizeHints[idx] || 'standard';
      if (hint === 'full') {
        fullBleedBlocks.push({ block, idx });
      } else {
        masonryBlocks.push({ block, idx, hint });
      }
    });

    return (
      <div className="space-y-5">
        {/* Full-bleed blocks render above the masonry grid */}
        {fullBleedBlocks.map(({ block, idx }) => (
          <React.Fragment key={block.id}>
            {renderBlock(block, idx)}
          </React.Fragment>
        ))}

        {/* Masonry grid for remaining blocks */}
        {masonryBlocks.length > 0 && (
          <div
            className="columns-1 sm:columns-2 gap-4"
            style={{ columnFill: 'balance' }}
          >
            {masonryBlocks.map(({ block, idx, hint }) => (
              <div
                key={block.id}
                className={`break-inside-avoid mb-4 ${
                  hint === 'wide' ? 'column-span-all' : ''
                }`}
                style={hint === 'wide' ? { columnSpan: 'all' } : undefined}
              >
                {renderBlock(block, idx)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderLayout = () => {
    switch (wrapperLayout) {
      case 'grid_2col':
        return renderGrid2ColLayout();
      case 'reveal_progressive':
        return renderRevealProgressiveLayout();
      case 'masonry':
        return renderMasonryLayout();
      case 'stack':
      default:
        return renderStackLayout();
    }
  };

  return (
    <div ref={containerRef} className={`space-y-5 ${className || ''}`}>
      {/* Header */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
              {LAYOUT_LABELS[wrapperLayout] || 'Deep Dive'}
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

      {/* Blocks in chosen layout */}
      {renderLayout()}

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
