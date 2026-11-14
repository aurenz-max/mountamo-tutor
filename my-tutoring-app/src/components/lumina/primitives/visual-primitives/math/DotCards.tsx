'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaPrompt,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { DotCardsMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  DOT_PAD, describeDotCardsCheck, dotCardsMatches, dotCardsMiss, dotCardsScene, type CardFace,
} from './dotCardsWorkspace';
import { dotCardsBoss } from './dotCards.boss';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';

// ============================================================================
// Data types (single source of truth)
// ============================================================================

/** How the two groups sit on the card. The arrangement is part of the card's difficulty. */
export type DotArrangement = 'dice' | 'rows' | 'frame' | 'scatter';

/** One dot, in the card's 200 x 120 drawing space; `part` is its group (0 blue, 1 orange). */
export interface DotCardDot { x: number; y: number; part: 0 | 1 }

export interface DotCardsChallenge {
  id: string;
  type: 'quick_total';
  /** The two groups' sizes, 1-5 each. Never rendered as numbers before the card is solved. */
  parts: [number, number];
  /** parts[0] + parts[1], computed by the generator. */
  total: number;
  arrangement: DotArrangement;
  /** One dot per unit, positioned by the generator. */
  dots: DotCardDot[];
  /** How long one look lasts, from the support tier. Never shown. */
  lookMs?: number;
}

export interface DotCardsData {
  title: string;
  description: string;
  challengeType: 'quick_total';
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: DotCardsChallenge[];

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DotCardsMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  quick_total: { label: 'Quick Look', icon: '🎴', accentColor: 'blue' },
};

const DEFAULT_LOOK_MS = 2500;
const PART_FILL = ['#60a5fa', '#fb923c'] as const;
const PART_NAME = ['blue', 'orange'] as const;

/** Per-card score: first try 100, second 50, later tries 25. */
const scoreFor = (attempts: number) => (attempts <= 1 ? 100 : attempts === 2 ? 50 : 25);

// ============================================================================
// The card (bespoke surface)
// ============================================================================

/** The card face: the frame or dice outlines, then the dots. Drawn only while the card is face up. */
const CardFace: React.FC<{ card: DotCardsChallenge }> = ({ card }) => (
  <svg viewBox="0 0 200 120" className="h-full w-full" role="img" aria-label="Dot card">
    {card.arrangement === 'frame' && Array.from({ length: 10 }, (_, i) => (
      <rect key={i} x={25 + (i % 5) * 30} y={30 + Math.floor(i / 5) * 30} width={30} height={30}
        fill="none" stroke="#334155" strokeWidth={2} />
    ))}
    {card.arrangement === 'dice' && [10, 106].map((x) => (
      <rect key={x} x={x} y={18} width={84} height={84} rx={14} fill="none" stroke="#cbd5e1" strokeWidth={2} />
    ))}
    {card.dots.map((dot, i) => (
      <circle key={i} data-dot-part={dot.part} cx={dot.x} cy={dot.y} r={card.arrangement === 'frame' ? 11 : 10}
        fill={PART_FILL[dot.part]} />
    ))}
  </svg>
);

/** The card's back: no dots in the DOM, so nothing can be counted while it is down. */
const CardBack: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[repeating-linear-gradient(45deg,rgba(148,163,184,0.12)_0_10px,transparent_10px_20px)]">
    <span className="text-6xl font-bold text-slate-500" aria-hidden>?</span>
  </div>
);

// ============================================================================
// Component
// ============================================================================

interface DotCardsProps {
  data: DotCardsData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useDotCardsProgress = useWorkspaceProgressFor('dot-cards');

function DotCardsSurface({ data, className, runtimePlanItemId }: DotCardsProps) {
  const challenges = data.challenges ?? [];
  const instanceId = useRef(data.instanceId ?? `dot-cards-${Math.random().toString(36).slice(2)}`).current;
  const workspace = useRef<TeachingWorkspace | null>(null);
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(retry: boolean) => void>(() => {});
  /** Bound below; a spoken total the observer credited (`onSolved`). */
  const solvedAloud = useRef<(index: number) => void>(() => {});

  const progress = useDotCardsProgress({
    challenges, getChallengeId: (challenge) => challenge.id,
    instanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: dotCardsBoss.assignment,
    onItemOpened: (_index, retry) => reopen.current(retry),
    onSolved: (index) => solvedAloud.current(index),
  });
  const { currentIndex, currentAttempts, results, isComplete, recordResult } = progress;
  const canAttempt = progress.canAttempt !== false;
  const card = challenges[currentIndex] ?? null;

  // ── Per-card state ─────────────────────────────────────────────
  const [face, setFace] = useState<CardFace>('down');
  const [wrong, setWrong] = useState<number[]>([]);
  const lookTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flippedAt = useRef(0);
  const firstResponseMsRef = useRef<number[]>([]);
  const clearLook = () => { if (lookTimer.current) { clearTimeout(lookTimer.current); lookTimer.current = null; } };
  useEffect(() => clearLook, []);

  // A fresh card and Try again both start face down: Try again earns one new look.
  reopen.current = () => {
    clearLook();
    setFace('down');
    setWrong([]);
  };

  const solved = !!card && results.some((r) => r.challengeId === card.id && r.correct);
  const learnerBlocked = () => !canAttempt || solved || isComplete || !card;

  const flip = () => {
    if (learnerBlocked() || face !== 'down' || !card) return;
    SoundManager.pop();
    setFace('showing');
    flippedAt.current = Date.now();
    clearLook();
    lookTimer.current = setTimeout(() => { lookTimer.current = null; setFace('looked'); }, card.lookMs ?? DEFAULT_LOOK_MS);
  };

  // ── Evaluation ─────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<DotCardsMetrics>({
    primitiveType: 'dot-cards', instanceId, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const phaseResults = usePhaseResults({
    challenges, results, isComplete,
    getChallengeType: () => data.challengeType,
    phaseConfig: PHASE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((sum, r) => sum + (r.score ?? 0), 0) / Math.max(rs.length, 1)),
  });

  const firstResponse = () => {
    if (currentAttempts === 0 && flippedAt.current) firstResponseMsRef.current.push(Date.now() - flippedAt.current);
  };

  // ── The activity's check: every tap is checked and committed; the runtime advances ──
  const tappedCorrect = useRef<string | null>(null);
  const answer = (value: number) => {
    if (!card || learnerBlocked() || face === 'down' || wrong.includes(value)) return;
    firstResponse();
    const correct = dotCardsMatches(card, value);
    if (correct) {
      tappedCorrect.current = card.id;
      clearLook();
      SoundManager.playCorrect();
      const attempts = currentAttempts + 1;
      recordResult({ challengeId: card.id, correct: true, attempts, score: scoreFor(attempts) });
    } else {
      SoundManager.playIncorrect();
      clearLook();
      setFace('looked');
      setWrong((w) => [...w, value]);
    }
    progress.commitCheck(describeDotCardsCheck(value), correct, dotCardsMiss(card, value));
  };

  // A spoken total the observer credited: the result a correct tap records, so the card turns face up with its groups.
  solvedAloud.current = (index) => {
    const solvedCard = challenges[index];
    if (!solvedCard || tappedCorrect.current === solvedCard.id) return;
    firstResponse();
    clearLook();
    const attempts = currentAttempts + 1;
    progress.mergeResult({ challengeId: solvedCard.id, correct: true, attempts, score: scoreFor(attempts) });
  };

  // ── Completion: submit once, only under an evaluation provider ──
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || evaluation.hasSubmitted || submittedRef.current || challenges.length === 0) return;
    if (progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const correctCount = results.filter((r) => r.correct).length;
    const attemptsCount = results.reduce((sum, r) => sum + r.attempts, 0);
    const firstTryCount = results.filter((r) => r.correct && r.attempts === 1).length;
    const overallAccuracy = Math.round(results.reduce((sum, r) => sum + (r.score ?? 0), 0) / challenges.length);
    const metrics: DotCardsMetrics = {
      type: 'dot-cards',
      challengeType: 'quick_total',
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: 0,
      overallAccuracy,
      averageAttemptsPerChallenge: attemptsCount / challenges.length,
    };
    const times = firstResponseMsRef.current;
    evaluation.submitResult(correctCount === challenges.length, overallAccuracy, metrics, {
      cards: results.map((r) => {
        const c = challenges.find((x) => x.id === r.challengeId);
        return { parts: c?.parts, arrangement: c?.arrangement, attempts: r.attempts };
      }),
      averageFirstResponseMs: times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0,
    });
  }, [isComplete, evaluation, challenges, results, progress.recordsEvaluation]);

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    if (!card) return;
    workspace.current = { ...leverScene(dotCardsScene(card, { face }), { support: '', onScreen: '' }) };
  });

  const overallScore = evaluation.submittedResult?.score ?? (results.length
    ? Math.round(results.reduce((sum, r) => sum + (r.score ?? 0), 0) / Math.max(challenges.length, 1)) : 0);

  const tileState = (value: number): AnswerChoiceState => {
    if (solved && card && value === card.total) return 'correct';
    if (wrong.includes(value)) return 'incorrect';
    return solved ? 'dimmed' : 'idle';
  };

  const faceUp = solved || face === 'showing';
  const missShown = !canAttempt && !solved;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LuminaCardTitle>{data.title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue">Quick Look</LuminaBadge>
            {!isComplete && challenges.length > 0 && (
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} variant="dots" />
            )}
          </div>
        </div>
        <p className="text-sm text-slate-400">{data.description}</p>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {challenges.length === 0 && <p className="py-8 text-center text-slate-400">No cards loaded.</p>}

        {isComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? overallScore}
            durationMs={evaluation.elapsedMs}
            heading="Dot Cards Complete!"
            celebrationMessage={`${results.filter((r) => r.attempts === 1).length} of ${challenges.length} cards right on the first try.`}
          />
        )}

        {card && !isComplete && (
          <>
            <LuminaPrompt>
              {face === 'down' && !solved ? 'Flip the card and take a quick look.' : 'How many dots altogether?'}
            </LuminaPrompt>

            <div
              data-dot-card
              data-face={faceUp ? 'up' : 'down'}
              className={`mx-auto aspect-[5/3] w-full max-w-md rounded-3xl border-2 p-3 transition-colors ${faceUp ? 'border-white/20 bg-slate-50' : 'border-white/10 bg-slate-800/60'}`}
            >
              {faceUp ? <CardFace card={card} /> : <CardBack />}
            </div>

            {face === 'down' && !solved && (
              <div className="flex justify-center">
                <LuminaButton tone="primary" aria-label="Flip the card" onClick={flip} disabled={!canAttempt}>
                  Flip the card
                </LuminaButton>
              </div>
            )}

            {/* Pip comes from the workspace runner: the dock between the card and the pad, the pad as one region. */}
            <PipDock />

            <PipWorkspace className="mx-auto grid max-w-xl grid-cols-5 gap-2">
              {DOT_PAD.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Answer ${value}`}
                  onClick={() => answer(value)}
                  disabled={solved || !canAttempt || face === 'down' || wrong.includes(value)}
                  className={`h-14 rounded-xl border text-2xl font-bold transition-all ${answerStateClass(tileState(value))}`}
                >
                  {value}
                </button>
              ))}
            </PipWorkspace>

            {missShown && (
              <LuminaFeedbackCard status="incorrect" label="Not yet">
                Look for the blue dots and the orange dots. You get another look.
              </LuminaFeedbackCard>
            )}
            {solved && (
              <LuminaFeedbackCard status="correct" label={currentAttempts <= 1 ? 'You saw it!' : 'You got it!'}>
                {card.parts[0]} {PART_NAME[0]} and {card.parts[1]} {PART_NAME[1]} make {card.total}.
              </LuminaFeedbackCard>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const DotCards = withWorkspaceOnly<DotCardsProps>('dot-cards', DotCardsSurface, (props) => props.data.title);

export default DotCards;
