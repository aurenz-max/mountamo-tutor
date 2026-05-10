'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../../evaluation';
import type { PassageStudioMetrics } from '../../../../evaluation/types';
import { useLuminaAI } from '../../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../../components/PhaseSummaryPanel';

import PassageRenderer, { type AnchorTone } from './PassageRenderer';
import ReadAloudButton from './ReadAloudButton';
import {
  PassageDisplayBlock,
  PullQuoteBlock,
  VocabCardBlock,
  AuthorContextBlock,
  ComprehensionMcqBlock,
  EvidenceHighlightBlock,
  VocabInContextBlock,
  InferenceBuilderBlock,
  ThemeStatementBlock,
} from './blocks';
import type {
  PassageStudioData,
  PassageBlock,
  PassageLayout,
  PassageSpan,
  ComprehensionMcqBlockData,
  VocabInContextBlockData,
  PassageDisplayBlockData,
  VocabCardBlockData,
  InferenceBuilderBlockData,
  ThemeStatementBlockData,
} from './types';
import { isEvaluableBlock } from './types';

// ── Phase config for the eval summary ───────────────────────────────
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'comprehension-mcq': { label: 'Comprehension', icon: '❓', accentColor: 'amber' },
  'evidence-highlight': { label: 'Evidence', icon: '🔍', accentColor: 'emerald' },
  'vocab-in-context': { label: 'Vocabulary', icon: '📖', accentColor: 'cyan' },
  'inference-builder': { label: 'Inference', icon: '💭', accentColor: 'pink' },
  'theme-statement': { label: 'Theme', icon: '✍️', accentColor: 'orange' },
};

// ── Layout labels ───────────────────────────────────────────────────
const LAYOUT_LABELS: Record<PassageLayout, string> = {
  stack: 'Passage Studio',
  split_passage: 'Passage Studio • Split View',
  reveal_beat: 'Passage Studio • Beat-by-Beat',
  annotated_passage: 'Passage Studio • Annotated',
};

// ── Transition cue ──────────────────────────────────────────────────
const TransitionCue: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-3 px-2 py-1">
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <p className="text-xs text-slate-500 italic font-light max-w-md text-center leading-relaxed">{text}</p>
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

// ── Progress bar ────────────────────────────────────────────────────
const ProgressBar: React.FC<{ blocks: PassageBlock[]; answeredIds: Set<string> }> = ({ blocks, answeredIds }) => (
  <div className="flex gap-1">
    {blocks.map((b) => {
      const isEval = isEvaluableBlock(b);
      const done = answeredIds.has(b.id);
      let color = 'bg-white/15';
      if (isEval && done) color = 'bg-emerald-400/70';
      else if (isEval) color = 'bg-amber-400/30';
      return <div key={b.id} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${color}`} />;
    })}
  </div>
);

// ── Active-block tracking via IntersectionObserver ──────────────────
interface ActiveBlockTracking {
  activeId: string | null;
  registerRef: (id: string) => (el: HTMLDivElement | null) => void;
}

function useActiveBlockId(blockIds: string[], enabled: boolean): ActiveBlockTracking {
  const [activeId, setActiveId] = useState<string | null>(null);
  const refMap = useRef(new Map<string, HTMLDivElement>());

  const registerRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (!el) refMap.current.delete(id);
      else refMap.current.set(id, el);
    },
    [],
  );

  const idsKey = blockIds.join('|');
  useEffect(() => {
    if (!enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.blockId;
          if (id) setActiveId(id);
        }
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: '-20% 0px -40% 0px' },
    );
    refMap.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [enabled, idsKey]);

  return { activeId, registerRef };
}

// ── Component ───────────────────────────────────────────────────────

interface PassageStudioProps {
  data: PassageStudioData;
  className?: string;
}

const PassageStudio: React.FC<PassageStudioProps> = ({ data, className }) => {
  const {
    title,
    subtitle,
    stimulus,
    blocks,
    layout = 'stack',
    narrativeArc,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `passage-studio-${Date.now()}`;

  // Evaluable blocks for progress tracking
  const evaluableBlocks = useMemo(() => blocks.filter(isEvaluableBlock), [blocks]);
  const hasEval = evaluableBlocks.length > 0;

  const {
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = useChallengeProgress({
    challenges: evaluableBlocks,
    getChallengeId: (b) => b.id,
  });

  const phaseResults = usePhaseResults({
    challenges: evaluableBlocks,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (b) => b.blockType,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // Eval submission
  const startTimeRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  const { submitResult } = usePrimitiveEvaluation<PassageStudioMetrics>({
    primitiveType: 'passage-studio',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((r: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult<PassageStudioMetrics> | null>(null);

  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || !hasEval) return;
    setHasSubmitted(true);
    const duration = Date.now() - startTimeRef.current;
    setElapsedMs(duration);

    const correctCount = challengeResults.filter((r) => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const overallScore = Math.round((correctCount / evaluableBlocks.length) * 100);

    const result = submitResult(overallScore >= 70, overallScore, {
      type: 'passage-studio',
      totalBlocks: blocks.length,
      evaluableBlocks: evaluableBlocks.length,
      correctAnswers: correctCount,
      totalAttempts,
      layout,
      stimulusKind: stimulus.kind,
      blockBreakdown: challengeResults.map((r) => {
        const block = blocks.find((b) => b.id === r.challengeId);
        return {
          blockId: r.challengeId,
          blockType: block?.blockType ?? 'unknown',
          correct: r.correct,
          attempts: r.attempts,
        };
      }),
    });
    setSubmittedResult(result);
  }, [
    allChallengesComplete,
    hasSubmitted,
    hasEval,
    challengeResults,
    evaluableBlocks,
    blocks,
    submitResult,
    layout,
    stimulus.kind,
  ]);

  const answeredIds = useMemo(
    () => new Set(challengeResults.map((r) => r.challengeId)),
    [challengeResults],
  );

  // Active block tracking — enabled in all layouts so the AI tutor always knows
  // which block the student is currently looking at.
  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);
  const { activeId, registerRef } = useActiveBlockId(blockIds, true);

  // AI tutor — context object includes the FULL passage (so AI can quote phrases),
  // the active block's metadata + tutoringBrief (so AI knows what task the student
  // is on right now), and progress info.
  const aiPrimitiveData = useMemo(() => {
    const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : null;
    const stimulusTitle = 'title' in stimulus ? stimulus.title : undefined;
    const stimulusAuthor = 'author' in stimulus ? stimulus.author : undefined;
    return {
      title,
      stimulusKind: stimulus.kind,
      stimulusTitle: stimulusTitle ?? '',
      stimulusAuthor: stimulusAuthor ?? '',
      stimulusFullText: stimulus.text,
      layout,
      blockCount: blocks.length,
      evaluableBlockCount: evaluableBlocks.length,
      answeredCount: answeredIds.size,
      narrativeArc: narrativeArc || '',
      blockLabels: blocks.map((b) => `${b.blockType}: ${b.label}`).join(' | '),
      currentBlockId: activeBlock?.id ?? '',
      currentBlockLabel: activeBlock?.label ?? '',
      currentBlockType: activeBlock?.blockType ?? '',
      currentBlockBrief: activeBlock?.tutoringBrief ?? '',
    };
  }, [title, stimulus, blocks, evaluableBlocks.length, narrativeArc, layout, activeId, answeredIds]);

  const { sendText } = useLuminaAI({
    primitiveType: 'passage-studio',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
  });

  const sentIntroRef = useRef(false);
  useEffect(() => {
    if (!sentIntroRef.current && blocks.length > 0) {
      sentIntroRef.current = true;
      const introHint =
        stimulus.kind === 'poem'
          ? 'For this poem, briefly introduce it (one sentence) and offer to read it aloud if the student would like.'
          : stimulus.kind === 'dialogue'
            ? 'Briefly introduce the dialogue and the speakers, then invite the student to read along.'
            : 'Briefly introduce the passage and what the lesson will explore.';
      sendText(
        `[PASSAGE_STUDIO_START] Title: "${title}". ${stimulus.kind} stimulus, ${blocks.length} blocks (${evaluableBlocks.length} interactive). ${introHint}`,
        { silent: true },
      );
    }
  }, [blocks.length, evaluableBlocks.length, title, stimulus.kind, sendText]);

  // Block answer handler — enriched with attempt-aware scaffolding hints
  const handleBlockAnswer = useCallback(
    (blockId: string, correct: boolean, attempts: number) => {
      recordResult({ challengeId: blockId, correct, attempts });
      const block = blocks.find((b) => b.id === blockId);
      const label = block?.label ?? blockId;
      const blockType = block?.blockType ?? 'unknown';

      let instruction: string;
      if (correct) {
        instruction =
          'Briefly congratulate. If there is an evidenceAnchor for this block, quote the supporting phrase from the passage to reinforce the textual evidence.';
      } else if (attempts >= 3) {
        instruction =
          'The student is struggling. Offer level-3 scaffolding: point to a specific phrase or line in the passage that grounds the answer, without revealing the answer itself.';
      } else {
        instruction =
          'Give a brief hint without revealing the answer. Encourage the student to reread the relevant section of the passage.';
      }

      sendText(
        `[ANSWER_${correct ? 'CORRECT' : 'INCORRECT'}] "${label}" (${blockType}) — attempt ${attempts}. ${instruction}`,
        { silent: true },
      );
    },
    [blocks, recordResult, sendText],
  );

  // Completion celebration — fires once when the student finishes all evaluables
  const sentCompleteRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || !hasEval || sentCompleteRef.current) return;
    sentCompleteRef.current = true;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    sendText(
      `[ALL_COMPLETE] Student finished "${title}" — ${correctCount} of ${evaluableBlocks.length} correct across ${blocks.length} blocks. Celebrate the close-reading work and reflect on a key insight from the passage.`,
      { silent: true },
    );
  }, [allChallengesComplete, hasEval, title, evaluableBlocks.length, blocks.length, challengeResults, sendText]);

  // Read-aloud — student tapped the Listen button. Tells AI to read the full
  // stimulus from its context as a *performance*, not a recitation. We hand
  // the tutor title/author so it can channel the writer's voice (the LLM
  // already knows Dickinson's dashes, Whitman's catalogues, Frost's plain
  // weight, etc.) and form-specific directions so line breaks, caesuras, and
  // speaker turns are honored.
  const handleReadAloud = useCallback(() => {
    const stimulusTitle = 'title' in stimulus ? stimulus.title : undefined;
    const stimulusAuthor = 'author' in stimulus ? stimulus.author : undefined;
    const titleSig = stimulusTitle
      ? `"${stimulusTitle}"${stimulusAuthor ? ` by ${stimulusAuthor}` : ''}`
      : `the ${stimulus.kind}`;

    let performanceNote: string;
    switch (stimulus.kind) {
      case 'poem':
        performanceNote = [
          stimulusAuthor
            ? `Channel ${stimulusAuthor}'s distinctive voice — the music, diction, and pacing this poet would want heard.`
            : `Embody the poet's voice — read this as a performance, not a recitation.`,
          'Honor the form: line breaks are breaths, not commas — pause briefly at each one. Em-dashes (—) are caesuras; let them stretch. Let imagery land between lines instead of rushing through. Vary pace and pitch with the emotional turn of each stanza, and lean into any slant rhyme or repetition.',
          'Do not race through it. Do not read in monotone. Read it the way the poet would want a reader to first hear it.',
        ].join(' ');
        break;
      case 'dialogue':
        performanceNote =
          'Voice each speaker distinctly — different pitch, pace, or attitude so the student can follow who is speaking. Carry the emotional state implied by what each character is saying; let tension, hesitation, or warmth come through in the delivery.';
        break;
      case 'sentence-set':
        performanceNote = 'Pause briefly between sentences. Read each at a natural conversational pace.';
        break;
      case 'prose':
      default:
        performanceNote = stimulusAuthor
          ? `Read in the narrator's voice — attend to the rhythm and tone ${stimulusAuthor} writes with. Let sentence cadence shape the pacing, emphasize key phrases, and honor punctuation as breath.`
          : `Read in the narrator's voice. Let sentence rhythms shape the pacing, emphasize key phrases naturally, and honor punctuation as breath.`;
        break;
    }

    sendText(
      `[READ_ALOUD] The student tapped Listen. Read ${titleSig} aloud now using the full stimulus from your context. ${performanceNote} Begin reading immediately — no preamble, no introduction, no commentary before or after.`,
      { silent: true },
    );
  }, [stimulus, sendText]);

  // ── Compute passage anchors based on active/answered state ────────
  // The pinned passage (split_passage) and the in-stack passage block both
  // use this. Anchors come from:
  //   - active block's `anchors` (active tone)
  //   - active vocab-in-context's targetAnchor / vocab-card's passageAnchor / inference-builder's evidence
  //   - answered comprehension-mcq + inference-builder's evidenceAnchor (reveal tone)
  const passageOverlays = useMemo(() => {
    const overlays: Array<{ span: PassageSpan; tone: AnchorTone; key?: string }> = [];

    // Reveal anchors from answered blocks that carry evidenceAnchor
    for (const b of blocks) {
      if (!answeredIds.has(b.id)) continue;
      if (b.blockType === 'comprehension-mcq') {
        const mcq = b as ComprehensionMcqBlockData;
        if (mcq.evidenceAnchor) overlays.push({ span: mcq.evidenceAnchor, tone: 'reveal' });
      } else if (b.blockType === 'inference-builder') {
        const inf = b as InferenceBuilderBlockData;
        const correct = inf.candidates[inf.correctIndex];
        if (correct?.evidenceAnchor) overlays.push({ span: correct.evidenceAnchor, tone: 'reveal' });
      }
    }

    // Active block's anchors
    if (activeId) {
      const active = blocks.find((b) => b.id === activeId);
      if (active) {
        if (active.anchors) {
          for (const span of active.anchors) {
            overlays.push({ span, tone: 'active' });
          }
        }
        if (active.blockType === 'vocab-in-context') {
          overlays.push({ span: (active as VocabInContextBlockData).targetAnchor, tone: 'active' });
        } else if (active.blockType === 'vocab-card') {
          const card = active as VocabCardBlockData;
          if (card.passageAnchor) overlays.push({ span: card.passageAnchor, tone: 'active' });
        }
      }
    }

    return overlays;
  }, [blocks, answeredIds, activeId]);

  // ── Render a block ────────────────────────────────────────────────
  const renderBlock = useCallback(
    (block: PassageBlock, ref?: React.Ref<HTMLDivElement>) => {
      switch (block.blockType) {
        case 'passage-display':
          return (
            <PassageDisplayBlock
              data={block as PassageDisplayBlockData}
              stimulus={stimulus}
              highlightAnchors={layout === 'stack' || layout === 'reveal_beat' ? passageOverlays : undefined}
              onReadAloud={layout === 'stack' || layout === 'reveal_beat' ? handleReadAloud : undefined}
              innerRef={ref}
            />
          );
        case 'pull-quote':
          return <PullQuoteBlock data={block} innerRef={ref} />;
        case 'vocab-card':
          return <VocabCardBlock data={block} innerRef={ref} />;
        case 'author-context':
          return <AuthorContextBlock data={block} innerRef={ref} />;
        case 'comprehension-mcq':
          return (
            <ComprehensionMcqBlock
              data={block}
              onAnswer={handleBlockAnswer}
              answered={answeredIds.has(block.id)}
              innerRef={ref}
            />
          );
        case 'evidence-highlight':
          return (
            <EvidenceHighlightBlock
              data={block}
              stimulus={stimulus}
              onAnswer={handleBlockAnswer}
              answered={answeredIds.has(block.id)}
              innerRef={ref}
            />
          );
        case 'vocab-in-context':
          return (
            <VocabInContextBlock
              data={block}
              onAnswer={handleBlockAnswer}
              answered={answeredIds.has(block.id)}
              innerRef={ref}
            />
          );
        case 'inference-builder':
          return (
            <InferenceBuilderBlock
              data={block as InferenceBuilderBlockData}
              onAnswer={handleBlockAnswer}
              answered={answeredIds.has(block.id)}
              innerRef={ref}
            />
          );
        case 'theme-statement':
          return (
            <ThemeStatementBlock
              data={block as ThemeStatementBlockData}
              stimulus={stimulus}
              onAnswer={handleBlockAnswer}
              answered={answeredIds.has(block.id)}
              innerRef={ref}
            />
          );
        default:
          return null;
      }
    },
    [stimulus, layout, passageOverlays, handleBlockAnswer, answeredIds, handleReadAloud],
  );

  // ── Layout renderers ──────────────────────────────────────────────

  const renderStack = () => (
    <div className="space-y-5">
      {blocks.map((block, idx) => (
        <React.Fragment key={block.id}>
          {renderBlock(block, registerRef(block.id))}
          {block.transitionCue && idx < blocks.length - 1 && <TransitionCue text={block.transitionCue} />}
        </React.Fragment>
      ))}
    </div>
  );

  const renderSplit = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)] gap-5">
      {/* Pinned passage */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-lg overflow-hidden">
          <div className="p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-end mb-3 -mt-1">
              <ReadAloudButton onClick={handleReadAloud} stimulusKind={stimulus.kind} />
            </div>
            <PassageRenderer stimulus={stimulus} overlays={passageOverlays} />
          </div>
        </Card>
      </div>

      {/* Block column */}
      <div className="space-y-4">
        {blocks.map((block, idx) => {
          // In split layout, the passage is pinned — skip passage-display blocks
          // in the block column, since they'd duplicate the pinned passage.
          if (block.blockType === 'passage-display') return null;
          return (
            <React.Fragment key={block.id}>
              {renderBlock(block, registerRef(block.id))}
              {block.transitionCue && idx < blocks.length - 1 && <TransitionCue text={block.transitionCue} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  // ── reveal_beat layout ────────────────────────────────────────────
  // Sequential reveal: blocks appear one at a time. An evaluable block must
  // be answered before the next reveals; a display block reveals the next
  // after a brief dwell once it's been in the viewport.
  const renderRevealBeat = () => (
    <RevealBeatLayout
      blocks={blocks}
      answeredIds={answeredIds}
      renderBlock={renderBlock}
      registerRef={registerRef}
    />
  );

  // ── annotated_passage layout ──────────────────────────────────────
  // Passage in the center, blocks render as margin notes anchored to spans.
  // Passage-display blocks render the canonical passage; everything else
  // floats in a marginalia column tied to the active block. Falls back to
  // split-style when there isn't a primary passage block.
  const renderAnnotated = () => (
    <AnnotatedPassageLayout
      stimulus={stimulus}
      blocks={blocks}
      overlays={passageOverlays}
      renderBlock={renderBlock}
      registerRef={registerRef}
      activeId={activeId}
      onReadAloud={handleReadAloud}
    />
  );

  const renderLayout = () => {
    switch (layout) {
      case 'split_passage':
        return renderSplit();
      case 'reveal_beat':
        return renderRevealBeat();
      case 'annotated_passage':
        return renderAnnotated();
      case 'stack':
      default:
        return renderStack();
    }
  };

  return (
    <div className={`space-y-5 ${className || ''}`}>
      {/* Header */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs">
              {LAYOUT_LABELS[layout]}
            </Badge>
            <span className="text-slate-600 text-xs">{blocks.length} blocks</span>
            {hasEval && (
              <>
                <span className="text-slate-700">&middot;</span>
                <span className="text-amber-400/70 text-xs">
                  {evaluableBlocks.length} {evaluableBlocks.length === 1 ? 'task' : 'tasks'}
                </span>
              </>
            )}
            <span className="text-slate-700">&middot;</span>
            <span className="text-cyan-400/70 text-xs uppercase tracking-wider">{stimulus.kind}</span>
          </div>
          <CardTitle className="text-2xl font-light text-white tracking-tight">{title}</CardTitle>
          {subtitle && <p className="text-slate-400 text-sm mt-1 font-light">{subtitle}</p>}
          <div className="mt-4">
            <ProgressBar blocks={blocks} answeredIds={answeredIds} />
          </div>
        </CardHeader>
      </Card>

      {/* Layout */}
      {renderLayout()}

      {/* Phase summary */}
      {allChallengesComplete && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score ?? 0}
          durationMs={elapsedMs}
          heading="Passage Studio Complete!"
          celebrationMessage={`You worked through ${blocks.length} blocks across "${title}".`}
          className="mb-6"
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// reveal_beat layout
//
// Blocks unlock sequentially. Evaluable blocks gate on `answered`; display
// blocks gate on a 2.5s dwell in the viewport. Mirrors DeepDive's
// `reveal_progressive` but keeps PassageStudio's anchor highlighting active.
// ═══════════════════════════════════════════════════════════════════════

const REVEAL_DWELL_MS = 2500;

interface RevealBeatLayoutProps {
  blocks: PassageBlock[];
  answeredIds: Set<string>;
  renderBlock: (block: PassageBlock, ref?: React.Ref<HTMLDivElement>) => React.ReactNode;
  registerRef: (id: string) => (el: HTMLDivElement | null) => void;
}

const RevealBeatLayout: React.FC<RevealBeatLayoutProps> = ({
  blocks,
  answeredIds,
  renderBlock,
  registerRef,
}) => {
  const [revealedCount, setRevealedCount] = useState(1);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);

  // Reset reveal state when block list changes (e.g. fixture swap).
  useEffect(() => {
    setRevealedCount(1);
  }, [blocks.length]);

  // Advance when current block satisfies its gate.
  useEffect(() => {
    if (revealedCount >= blocks.length) return;
    const current = blocks[revealedCount - 1];
    if (!current) return;

    const isCurrentEvaluable =
      current.blockType === 'comprehension-mcq' ||
      current.blockType === 'evidence-highlight' ||
      current.blockType === 'vocab-in-context' ||
      current.blockType === 'inference-builder' ||
      current.blockType === 'theme-statement';

    if (isCurrentEvaluable) {
      if (answeredIds.has(current.id)) {
        setRevealedCount((c) => Math.min(c + 1, blocks.length));
      }
      return;
    }

    // Display block — dwell on viewport intersection.
    const el = currentRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dwellTimerRef.current = setTimeout(() => {
            setRevealedCount((c) => Math.min(c + 1, blocks.length));
          }, REVEAL_DWELL_MS);
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
  }, [revealedCount, blocks, answeredIds]);

  return (
    <div className="space-y-5">
      {blocks.map((block, idx) => {
        const isRevealed = idx < revealedCount;
        const isCurrent = idx === revealedCount - 1;

        // Combine the orchestrator's IO ref with the local current-block ref.
        const combinedRef = (el: HTMLDivElement | null) => {
          registerRef(block.id)(el);
          if (isCurrent) currentRef.current = el;
        };

        return (
          <div
            key={block.id}
            className={`transition-all duration-700 ease-out ${
              isRevealed
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 h-0 overflow-hidden pointer-events-none'
            }`}
          >
            {renderBlock(block, isRevealed ? combinedRef : undefined)}
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
            {(() => {
              const cur = blocks[revealedCount - 1];
              if (!cur) return '';
              if (
                cur.blockType === 'comprehension-mcq' ||
                cur.blockType === 'evidence-highlight' ||
                cur.blockType === 'vocab-in-context' ||
                cur.blockType === 'inference-builder' ||
                cur.blockType === 'theme-statement'
              ) {
                return 'Answer above to continue…';
              }
              return 'Reading…';
            })()}
          </p>
          <div className="mt-2 flex justify-center gap-1">
            {blocks.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  i < revealedCount ? 'bg-pink-400/70' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// annotated_passage layout
//
// Passage centered; blocks render as marginalia in a side column. Active
// block highlights its anchor in the passage AND scrolls itself into view.
// Display passage-display blocks become the central rendering; all other
// blocks float in the marginalia column anchored to the next-active block.
//
// v1 implementation: a 2-column grid with passage centered (col-span-3) and
// blocks stacking in col-span-2 on the right. The active block's anchors
// light up the passage. We don't try to vertically pin individual notes to
// their span y-positions — that requires DOM measurement plumbing and isn't
// worth the complexity for v1.
// ═══════════════════════════════════════════════════════════════════════

interface AnnotatedPassageLayoutProps {
  stimulus: PassageStudioData['stimulus'];
  blocks: PassageBlock[];
  overlays: Array<{ span: PassageSpan; tone: AnchorTone; key?: string }>;
  renderBlock: (block: PassageBlock, ref?: React.Ref<HTMLDivElement>) => React.ReactNode;
  registerRef: (id: string) => (el: HTMLDivElement | null) => void;
  activeId: string | null;
  onReadAloud: () => void;
}

const AnnotatedPassageLayout: React.FC<AnnotatedPassageLayoutProps> = ({
  stimulus,
  blocks,
  overlays,
  renderBlock,
  registerRef,
  activeId,
  onReadAloud,
}) => {
  const marginBlocks = blocks.filter((b) => b.blockType !== 'passage-display');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Passage column — wider, sticky on large screens */}
      <div className="lg:col-span-3">
        <div className="lg:sticky lg:top-4">
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-lg overflow-hidden">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-end mb-3 -mt-1">
                <ReadAloudButton onClick={onReadAloud} stimulusKind={stimulus.kind} />
              </div>
              <PassageRenderer stimulus={stimulus} overlays={overlays} />
            </div>
          </Card>
        </div>
      </div>

      {/* Marginalia column */}
      <div className="lg:col-span-2 space-y-4">
        {marginBlocks.map((block) => (
          <div
            key={block.id}
            className={`transition-opacity duration-500 ${
              activeId && activeId !== block.id ? 'opacity-70' : 'opacity-100'
            }`}
          >
            {renderBlock(block, registerRef(block.id))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PassageStudio;
