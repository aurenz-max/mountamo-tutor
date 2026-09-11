'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaActionButton,
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaHintDisclosure,
  LuminaPanel,
  LuminaPrompt,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SpatialPathMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

export type SpatialPathRelation = 'over' | 'under' | 'through' | 'around' | 'across';

export interface SpatialRoute {
  id: string;
  relation: SpatialPathRelation;
  /** SVG path data. The geometry, not the destination, is the scored evidence. */
  d: string;
  geometrySignature: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface SpatialPathChallenge {
  id: string;
  type: 'choose_route';
  instruction: string;
  traveler: { name: string; emoji: string };
  landmark: { name: string; emoji: string };
  requestedRelation: SpatialPathRelation;
  routes: SpatialRoute[];
  correctRouteId: string;
  contrast: string;
}

export interface SpatialPathData {
  title: string;
  description: string;
  challengeType: 'choose_route';
  challenges: SpatialPathChallenge[];
  gradeBand?: 'K' | '1' | '2';
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SpatialPathMetrics>) => void;
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  choose_route: { label: 'Choose a Route', icon: '🛤️', accentColor: 'cyan' },
};

// Neutral candidate palette: reserve green exclusively for the post-submit key.
const ROUTE_COLORS = ['#38bdf8', '#a78bfa', '#f59e0b', '#f472b6', '#e2e8f0'];

interface RouteSceneProps {
  challenge: SpatialPathChallenge;
  selectedRouteId: string | null;
  submitted: boolean;
  animationNonce: number;
  onSelect: (routeId: string) => void;
}

const RouteScene: React.FC<RouteSceneProps> = ({
  challenge, selectedRouteId, submitted, animationNonce, onSelect,
}) => {
  const selected = challenge.routes.find((route) => route.id === selectedRouteId);
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-sky-950/40 to-emerald-950/30">
      <svg viewBox="0 0 600 320" className="h-auto w-full" role="img" aria-label={`Routes around the ${challenge.landmark.name}`}>
        <rect x="0" y="0" width="600" height="320" fill="transparent" />
        <rect x="255" y="85" width="90" height="150" rx="28" fill="#334155" stroke="#64748b" strokeWidth="4" />
        <path d="M278 235 V160 Q300 125 322 160 V235" fill="#0f172a" stroke="#94a3b8" strokeWidth="4" />
        <rect x="185" y="68" width="230" height="28" rx="14" fill="#475569" stroke="#94a3b8" strokeWidth="3" />
        <path d="M220 96 V126 M380 96 V126" stroke="#64748b" strokeWidth="7" />
        <rect x="286" y="226" width="28" height="48" rx="6" fill="#0ea5e9" opacity="0.65" />
        <path d="M235 160 H365" stroke="#f8fafc" strokeWidth="9" strokeDasharray="12 8" opacity="0.3" />
        <text x="300" y="48" textAnchor="middle" fontSize="15" fill="#cbd5e1">{challenge.landmark.emoji} {challenge.landmark.name}</text>
        <circle cx="60" cy="160" r="12" fill="#0f172a" stroke="#cbd5e1" strokeWidth="3" />
        <circle cx="540" cy="160" r="12" fill="#0f172a" stroke="#cbd5e1" strokeWidth="3" />
        <text x="60" y="195" textAnchor="middle" fontSize="13" fill="#cbd5e1">START</text>
        <text x="540" y="195" textAnchor="middle" fontSize="13" fill="#cbd5e1">FINISH</text>

        {challenge.routes.map((route, index) => {
          const isSelected = route.id === selectedRouteId;
          const isCorrect = route.id === challenge.correctRouteId;
          const stroke = submitted
            ? isCorrect ? '#34d399' : isSelected ? '#fb7185' : '#64748b'
            : isSelected ? '#22d3ee' : ROUTE_COLORS[index % ROUTE_COLORS.length];
          return (
            <g key={route.id}>
              <path
                d={route.d}
                fill="none"
                stroke="transparent"
                strokeWidth="28"
                className="cursor-pointer"
                onClick={() => !submitted && onSelect(route.id)}
                aria-label={`Choose route ${index + 1}`}
              />
              <path
                id={`${challenge.id}-${route.id}`}
                d={route.d}
                fill="none"
                stroke={stroke}
                strokeWidth={isSelected || (submitted && isCorrect) ? 9 : 6}
                strokeLinecap="round"
                strokeDasharray={isSelected ? undefined : '11 8'}
                opacity={submitted && !isCorrect && !isSelected ? 0.35 : 0.9}
                pointerEvents="none"
              />
              <circle
                cx={route.start.x + 36}
                cy={route.start.y + (index - 2) * 6}
                r="12"
                fill={stroke}
                className="cursor-pointer"
                onClick={() => !submitted && onSelect(route.id)}
              />
              <text
                x={route.start.x + 36}
                y={route.start.y + (index - 2) * 6 + 4}
                textAnchor="middle"
                fontSize="11"
                fill="#020617"
                pointerEvents="none"
              >{index + 1}</text>
              {submitted && (isCorrect || isSelected) && (
                <text x="300" y={isCorrect ? 18 : 304} textAnchor="middle" fontSize="14" fill={stroke}>
                  Route {index + 1}: {route.relation}
                </text>
              )}
            </g>
          );
        })}

        {submitted && selected && (
          <text key={`${selected.id}-${animationNonce}`} x="42" y="150" fontSize="28">
            {challenge.traveler.emoji}
            <animateMotion dur="1.5s" fill="freeze" path={selected.d} />
          </text>
        )}
      </svg>
    </div>
  );
};

export default function SpatialPath({ data, className }: { data: SpatialPathData; className?: string }) {
  const challenges = data.challenges ?? [];
  const {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
  } = useChallengeProgress({ challenges, getChallengeId: (challenge) => challenge.id });
  const current = challenges[currentIndex] ?? null;
  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: (challenge) => challenge.type,
    phaseConfig: PHASE_CONFIG,
  });
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ status: 'correct' | 'incorrect'; text: string } | null>(null);
  const [submittedRoute, setSubmittedRoute] = useState(false);
  const [animationNonce, setAnimationNonce] = useState(0);
  const [routeAttempts, setRouteAttempts] = useState<Array<{ challengeId: string; routeId: string; relation: string; correct: boolean }>>([]);
  const recordedRef = useRef(false);
  const viewedHintsRef = useRef(new Set<string>());
  const instanceId = useRef(data.instanceId ?? `spatial-path-${crypto.randomUUID()}`).current;

  const evaluation = usePrimitiveEvaluation<SpatialPathMetrics>({
    primitiveType: 'spatial-path', instanceId, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });
  const aiPrimitiveData = useMemo(() => ({
    challengeType: 'choose_route',
    requestedRelation: current?.requestedRelation,
    traveler: current?.traveler.name,
    landmark: current?.landmark.name,
    routeCount: current?.routes.length ?? 0,
    currentChallenge: currentIndex + 1,
    totalChallenges: challenges.length,
  }), [current, currentIndex, challenges.length]);
  const { sendText } = useLuminaAI({
    primitiveType: 'spatial-path', instanceId, primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeBand === 'K' ? 'Kindergarten' : `Grade ${data.gradeBand ?? '1'}`,
  });

  useEffect(() => {
    if (!current) return;
    setSelectedRouteId(null);
    setFeedback(null);
    setSubmittedRoute(false);
    recordedRef.current = false;
  }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    sendText(
      `[ROUTE_ITEM] Challenge ${currentIndex + 1} of ${challenges.length}: "${current.instruction}" `
      + 'The child must choose by route shape; every route ends at the same place.',
      { silent: true },
    );
  }, [current?.id, currentIndex, challenges.length, sendText]);

  const handleCheck = useCallback(() => {
    if (!current || !selectedRouteId || recordedRef.current) return;
    incrementAttempts();
    setSubmittedRoute(true);
    setAnimationNonce((value) => value + 1);
    const selected = current.routes.find((route) => route.id === selectedRouteId);
    const correct = selectedRouteId === current.correctRouteId;
    setRouteAttempts((previous) => [...previous, {
      challengeId: current.id,
      routeId: selectedRouteId,
      relation: selected?.relation ?? 'unknown',
      correct,
    }]);
    if (correct) {
      recordedRef.current = true;
      SoundManager.playCorrect();
      setFeedback({ status: 'correct', text: `Yes — ${current.contrast}` });
      recordResult({ challengeId: current.id, correct: true, attempts: currentAttempts + 1, selectedRouteId, requestedRelation: current.requestedRelation });
      sendText(`[ANSWER_CORRECT] The child chose route ${selectedRouteId}, whose geometry goes ${current.requestedRelation} the ${current.landmark.name}. Celebrate briefly.`, { silent: true });
    } else {
      SoundManager.playIncorrect();
      setFeedback({ status: 'incorrect', text: `That route goes ${selected?.relation ?? 'a different way'}, not ${current.requestedRelation}. Watch its path, then compare it with the green route.` });
      sendText(`[ANSWER_INCORRECT] The child chose a ${selected?.relation ?? 'different'} route; the request was ${current.requestedRelation}. Contrast the movement relation without using the final destination.`, { silent: true });
    }
  }, [current, selectedRouteId, currentAttempts, incrementAttempts, recordResult, sendText]);

  const retry = useCallback(() => {
    setSelectedRouteId(null);
    setSubmittedRoute(false);
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!isComplete || evaluation.hasSubmitted || challenges.length === 0) return;
    const correctCount = results.filter((result) => result.correct).length;
    const attemptsCount = results.reduce((sum, result) => sum + result.attempts, 0);
    const firstTryCount = results.filter((result) => result.correct && result.attempts === 1).length;
    const overallAccuracy = Math.round(results.reduce(
      (sum, result) => sum + (result.correct ? Math.max(20, 100 - (result.attempts - 1) * 20) : 0), 0,
    ) / challenges.length);
    evaluation.submitResult(
      correctCount === challenges.length,
      overallAccuracy,
      {
        type: 'spatial-path', challengeType: 'choose_route', totalChallenges: challenges.length,
        correctCount, attemptsCount, firstTryCount, hintsViewed: viewedHintsRef.current.size, overallAccuracy,
        averageAttemptsPerChallenge: attemptsCount / challenges.length,
      },
      { routeAttempts },
    );
    sendText(`[ALL_COMPLETE] The child completed ${correctCount}/${challenges.length} route-geometry challenges. Give one brief movement-word celebration.`, { silent: true });
  }, [isComplete, evaluation, challenges, results, routeAttempts, sendText]);

  const overallScore = evaluation.submittedResult?.score ?? (results.length
    ? Math.round(results.reduce((sum, result) => sum + (result.correct ? 100 : 0), 0) / challenges.length)
    : 0);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LuminaCardTitle>{data.title}</LuminaCardTitle>
          {current && <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} />}
        </div>
        <p className="text-sm text-slate-400">{data.description}</p>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-5">
        {isComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={overallScore}
            durationMs={evaluation.elapsedMs} heading="Route Explorer Complete"
            celebrationMessage="You followed the shape of each path." />
        )}
        {current && !isComplete && (
          <>
            <div className="flex justify-center"><LuminaBadge accent="cyan">Same start + same finish</LuminaBadge></div>
            <LuminaPrompt>{current.instruction}</LuminaPrompt>
            <RouteScene challenge={current} selectedRouteId={selectedRouteId}
              submitted={submittedRoute} animationNonce={animationNonce}
              onSelect={(routeId) => { SoundManager.select(); setSelectedRouteId(routeId); setFeedback(null); }} />
            <LuminaPanel>
              <p className="text-center text-sm text-slate-300">Tap a numbered route. The destination is the same; the path itself is your answer.</p>
            </LuminaPanel>
            <LuminaHintDisclosure onOpenChange={(open) => {
              if (open) viewedHintsRef.current.add(current.id);
            }}>
              Trace each path with your finger. Ask what it does at the landmark, not where it ends.
            </LuminaHintDisclosure>
            {feedback && <LuminaFeedbackCard status={feedback.status} label={feedback.status === 'correct' ? 'Route matched' : 'Compare the paths'}>
              {feedback.text}
            </LuminaFeedbackCard>}
            <div className="flex justify-center">
              {!recordedRef.current && !submittedRoute && (
                <LuminaActionButton action="check" onClick={handleCheck} disabled={!selectedRouteId}>Animate this route</LuminaActionButton>
              )}
              {!recordedRef.current && submittedRoute && (
                <LuminaActionButton action="retry" onClick={retry}>Try another route</LuminaActionButton>
              )}
              {recordedRef.current && (
                <LuminaActionButton action="next" onClick={() => advance()}>
                  {currentIndex < challenges.length - 1 ? 'Next route' : 'See results'}
                </LuminaActionButton>
              )}
            </div>
          </>
        )}
        {challenges.length === 0 && <p className="py-8 text-center text-slate-400">No route challenges loaded.</p>}
      </LuminaCardContent>
    </LuminaCard>
  );
}
