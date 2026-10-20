'use client';

/**
 * Spatial Path: routes past a landmark, all from one START to one FINISH; every item is one tapped route and
 * Animate this route.
 *
 * Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is `spatialPath.card.ts` +
 * `spatialPath.boss.ts`): `spatialPathWorkspace.ts` holds the scene, the learner's work in words and the named miss;
 * the map's own check commits through `progress.commitCheck`, and the runtime owns Try again and Next. The levers are
 * one lever set in `spatialPathLevers.ts`. A wrong check never turns the correct route green: Try again reopens the
 * same map.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { describeRouteWork, routeMatches, routeMiss, workspaceScene, type RouteView } from './spatialPathWorkspace';
import { ROUTE_LEVERS, WATCH_LEVER, WORD_LEVER, WORD_MODELS, type WordModel } from './spatialPathLevers';
import { spatialPathBoss } from './spatialPath.boss';

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
  /** The lesson's support tier on this item, which the lever set's `support` fact reads (the component fills it from
   *  `SpatialPathData.supportTier`). */
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface SpatialPathData {
  title: string;
  description: string;
  challengeType: 'choose_route';
  challenges: SpatialPathChallenge[];
  gradeBand?: 'K' | '1' | '2';
  /** Within-mode support tier: when the word picture (a model lever) comes (`ROUTE_LEVERS.support`). Present only when
   *  the lesson set a difficulty; medium otherwise. */
  supportTier?: 'easy' | 'medium' | 'hard';
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SpatialPathMetrics>) => void;
}

interface SpatialPathProps {
  data: SpatialPathData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
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
  /** Whether the checked map shows the correct route in green: on a right check only, since Try again reopens the
   *  same map after a wrong one. */
  revealKey: boolean;
  animationNonce: number;
  /** The watch_each lever: a dot in each route's colour walks every route in turn. */
  watchEach?: boolean;
  onSelect: (routeId: string) => void;
}

const RouteScene: React.FC<RouteSceneProps> = ({
  challenge, selectedRouteId, submitted, revealKey, animationNonce, watchEach, onSelect,
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
          const keyShown = submitted && revealKey && isCorrect;
          const stroke = submitted
            ? keyShown ? '#34d399' : isSelected ? '#fb7185' : '#64748b'
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
                strokeWidth={isSelected || keyShown ? 9 : 6}
                strokeLinecap="round"
                strokeDasharray={isSelected ? undefined : '11 8'}
                opacity={submitted && !keyShown && !isSelected ? 0.35 : 0.9}
                pointerEvents="none"
              />
              <circle
                cx={route.start.x + 36}
                cy={route.start.y + (index - 2) * 6}
                r="12"
                fill={stroke}
                className="cursor-pointer"
                data-pip-object={`route-${index + 1}`}
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
              {submitted && (keyShown || isSelected) && (
                <text x="300" y={keyShown ? 18 : 304} textAnchor="middle" fontSize="14" fill={stroke}>
                  Route {index + 1}: {route.relation}
                </text>
              )}
            </g>
          );
        })}

        {watchEach && !submitted && challenge.routes.map((route, index) => (
          <circle key={`watch-${route.id}`} r="9" cx="0" cy="0" fill={ROUTE_COLORS[index % ROUTE_COLORS.length]}
            stroke="#020617" strokeWidth="2" opacity="0" data-lever="watch_each" pointerEvents="none">
            {/* Hidden at the origin until its turn, then shown as it walks. */}
            <set attributeName="opacity" to="0.95" begin={`${index * 1.8}s`} fill="freeze" />
            <animateMotion dur="1.6s" begin={`${index * 1.8}s`} fill="freeze" path={route.d} />
          </circle>
        ))}

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

/** The word_picture lever: a ball going the asked way past a plain object, apart from the map. No route number. */
const WordPicture: React.FC<{ model: WordModel }> = ({ model }) => (
  <div className="flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-slate-900/40 p-3" data-lever="word_picture">
    <svg viewBox="0 0 200 110" className="h-24 w-48" role="img" aria-label={`A ball going ${model.relation} a ${model.object}`}>
      <defs><marker id="word-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#e2e8f0" /></marker></defs>
      {model.relation === 'over' && <rect x="80" y="50" width="40" height="40" rx="4" fill="#92400e" />}
      {model.relation === 'under' && <g fill="#a16207"><rect x="55" y="30" width="90" height="9" rx="2" /><rect x="60" y="39" width="6" height="58" /><rect x="134" y="39" width="6" height="58" /></g>}
      {model.relation === 'through' && <ellipse cx="100" cy="58" rx="11" ry="30" fill="none" stroke="#f472b6" strokeWidth="6" />}
      {model.relation === 'around' && <g><rect x="96" y="58" width="8" height="22" fill="#78350f" /><circle cx="100" cy="46" r="16" fill="#15803d" /></g>}
      {model.relation === 'across' && <g><rect x="55" y="66" width="90" height="34" fill="#0ea5e9" opacity="0.6" /><rect x="50" y="61" width="100" height="6" fill="#a16207" /></g>}
      <path d={model.path} fill="none" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="7 5" markerEnd="url(#word-arrow)" />
      <circle r="7" fill="#facc15"><animateMotion dur="2s" repeatCount="indefinite" path={model.path} /></circle>
    </svg>
    <p className="text-lg font-semibold text-slate-100">{model.relation}</p>
  </div>
);

const useRouteProgress = useWorkspaceProgressFor('spatial-path');

const SpatialPathSurface = ({ data, className, runtimePlanItemId }: SpatialPathProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const challenges = data.challenges ?? [];
  const instanceId = useRef(data.instanceId ?? `spatial-path-${crypto.randomUUID()}`).current;

  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useRouteProgress({
    challenges,
    getChallengeId: (challenge) => challenge.id,
    instanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: spatialPathBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete, mergeResult } = progress;
  /** A checked route stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;
  // Levers (`spatialPathLevers.ts`), keyed by the session item they were pulled on, and the easier challenge a
  // simplify lever put on screen in its place. The item starts bare.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SpatialPathChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier challenge while a simplify lever holds it, else the session item. */
  const current = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
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

  const evaluation = usePrimitiveEvaluation<SpatialPathMetrics>({
    primitiveType: 'spatial-path', instanceId, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** A blank map: no route chosen, nothing replayed. */
  const clearMap = useCallback(() => {
    setSelectedRouteId(null);
    setFeedback(null);
    setSubmittedRoute(false);
  }, []);

  useEffect(() => {
    if (!current) return;
    clearMap();
    recordedRef.current = false;
  }, [current?.id, clearMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // A fresh item ends any practice; it and Try again both open a blank map (Try again on a practice challenge keeps it).
  openItem.current = (_index, retry) => {
    clearMap();
    if (!retry) { recordedRef.current = false; setPractice(null); }
  };

  const view: RouteView = { selectedRouteId, checked: submittedRoute };

  // The map's own check, committed with its named miss.
  const handleCheck = () => {
    if (!current || !selectedRouteId || recordedRef.current || learnerBlocked()) return;
    setSubmittedRoute(true);
    setAnimationNonce((value) => value + 1);
    const selected = current.routes.find((route) => route.id === selectedRouteId);
    const correct = routeMatches(current, selectedRouteId);
    setRouteAttempts((previous) => [...previous, {
      challengeId: current.id,
      routeId: selectedRouteId,
      relation: selected?.relation ?? 'unknown',
      correct,
    }]);
    progress.commitCheck(describeRouteWork(current, { selectedRouteId, checked: true }), correct,
      correct ? undefined : routeMiss(current, selectedRouteId));
    if (correct) {
      recordedRef.current = true;
      SoundManager.playCorrect();
      setFeedback({ status: 'correct', text: `Yes — ${current.contrast}` });
      // A practice challenge (the simplify lever) records nothing: it is not the session's challenge.
      if (!practice) mergeResult({ challengeId: current.id, correct: true, attempts: currentAttempts + 1, selectedRouteId, requestedRelation: current.requestedRelation });
    } else {
      SoundManager.playIncorrect();
      setFeedback({ status: 'incorrect', text: `That route goes ${selected?.relation ?? 'a different way'}, not ${current.requestedRelation}. `
        + 'Watch its path at the landmark.' });
    }
  };

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss (`diagnosisEvidence.phases`).
  finish.current = (result) => {
    if (evaluation.hasSubmitted || progress.recordsEvaluation === false) return;
    evaluation.submitResult(result.passed, result.accuracy, {
      type: 'spatial-path', challengeType: 'choose_route', totalChallenges: challenges.length,
      correctCount: result.solvedCount, attemptsCount: result.attemptsCount, firstTryCount: result.firstTryCount,
      hintsViewed: viewedHintsRef.current.size, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: result.attemptsCount / Math.max(1, challenges.length),
    }, { routeAttempts, challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
    undefined, result.diagnosisEvidence);
  };

  // What the tutor and the observer are shown, republished every render. The lever set declares the levers and writes
  // the support and onScreen facts (`leverScene`); a practice map declares none.
  useLayoutEffect(() => {
    if (!current || !sessionChallenge) return;
    const scene = workspaceScene(current, view);
    const leverItem: SpatialPathChallenge = { ...sessionChallenge, supportTier: sessionChallenge.supportTier ?? data.supportTier };
    const levers = practice ? [] : ROUTE_LEVERS.declare(leverItem, null, pulledLevers);
    workspace.current = {
      ...leverScene(scene, {
        support: practice ? '' : ROUTE_LEVERS.support(leverItem, null),
        onScreen: practice ? '' : ROUTE_LEVERS.onScreen(leverItem, null, pulledLevers),
      }),
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = ROUTE_LEVERS.simpler(sessionChallenge, null, id);
          if (!easier) return 'This item has no easier map; try a help lever.';
          setLeverState(pulled); clearMap(); recordedRef.current = false; setPractice(easier);
          return { practice: spatialPathBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearMap(); recordedRef.current = false; setPractice(null); },
    };
  });

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
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? overallScore}
            durationMs={evaluation.elapsedMs} heading="Route Explorer Complete"
            celebrationMessage="You followed the shape of each path." />
        )}
        {current && !isComplete && (
          <>
            <div className="flex justify-center"><LuminaBadge accent="cyan">Same start + same finish</LuminaBadge></div>
            <LuminaPrompt>{current.instruction}</LuminaPrompt>
            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the map as its region. */}
            <PipDock />
            <PipWorkspace>
              <RouteScene challenge={current} selectedRouteId={selectedRouteId}
                submitted={submittedRoute} revealKey={feedback?.status === 'correct'}
                animationNonce={animationNonce} watchEach={leverOn(WATCH_LEVER)}
                onSelect={(routeId) => {
                  if (learnerBlocked()) return;
                  SoundManager.select(); setSelectedRouteId(routeId); setFeedback(null);
                }} />
            </PipWorkspace>

            {leverOn(WORD_LEVER) && <WordPicture model={WORD_MODELS[current.requestedRelation]} />}
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
            {/* Check: the runtime owns Try again and Next. */}
            {!recordedRef.current && !submittedRoute && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" onClick={handleCheck} disabled={!selectedRouteId || learnerBlocked()}>Animate this route</LuminaActionButton>
              </div>
            )}
          </>
        )}
        {challenges.length === 0 && <p className="py-8 text-center text-slate-400">No route challenges loaded.</p>}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const SpatialPath = withWorkspaceOnly<SpatialPathProps>('spatial-path', SpatialPathSurface, props => props.data.title);

export default SpatialPath;
