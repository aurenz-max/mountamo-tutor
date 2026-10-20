'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPrompt, LuminaCallout,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { MapExplorerMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import { LiveMap } from './map/LiveMap';
import { CompassRose } from './map/CompassRose';
import {
  CONTINENTS, OCEANS, REGION_ANCHOR, REGION_FACT, isContinent, regionTitle, type Direction, type RegionId,
} from './map/mapGeo';
import {
  checkFeedback, collapseSteps, flyRoute, isTownTask, mapMatches, mapMiss, placeById,
  type MapAnswer, type MapChallenge, type MapTask, type TownMap,
} from './map/mapModel';
import { describeMapAnswer, mapScene } from './mapExplorerWorkspace';
import { mapExplorerBoss } from './mapExplorer.boss';
import { COMPASS_LEVER, MAP_LEVERS } from './mapExplorerLevers';

export type { MapChallenge, MapTask, TownMap } from './map/mapModel';

// ============================================================================
// Data contract
// ============================================================================

export interface MapExplorerData {
  title: string;
  description: string;
  /** 4-6 asks. REQUIRED. Written by code from the map. Each ask carries its own task (`type`). */
  challenges: MapChallenge[];
  /** The session's first task (a mixed or blended session runs several). */
  challengeType: MapTask;
  /** City tasks: the one real city every city ask in the session uses. */
  townMap?: TownMap;
  /** Where the levers start (`config.difficulty`): easy glows the compass, hard turns the map. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MapExplorerMetrics>) => void;
}

interface MapExplorerProps {
  data: MapExplorerData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  find_on_globe: { label: 'Find it on the globe', icon: '🌍', accentColor: 'emerald' },
  find_by_direction: { label: 'Find by direction', icon: '🧭', accentColor: 'cyan' },
  name_direction: { label: 'Which way?', icon: '🧭', accentColor: 'blue' },
  world_direction: { label: 'Directions on the world', icon: '🗺️', accentColor: 'purple' },
  build_route: { label: 'Fly the trip', icon: '🚁', accentColor: 'amber' },
};

const DIR_BUTTONS: { dir: Direction; label: string; letter: string }[] = [
  { dir: 'north', label: 'North', letter: 'N' }, { dir: 'east', label: 'East', letter: 'E' },
  { dir: 'south', label: 'South', letter: 'S' }, { dir: 'west', label: 'West', letter: 'W' },
];

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useMapProgress = useWorkspaceProgressFor('map-explorer');

type Feedback = { text: string; status: 'correct' | 'incorrect' | 'insight' };
type FactCard = { title: string; text: string; mapsUri?: string; icon: string };

const MapExplorerSurface: React.FC<MapExplorerProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, townMap, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `map-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [found, setFound] = useState<Set<RegionId>>(() => new Set());
  const [focus, setFocus] = useState<{ lon: number; lat: number; key: string } | null>(null);
  const [flash, setFlash] = useState<{ id: string; correct: boolean; key: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fact, setFact] = useState<FactCard | null>(null);
  const [armChosen, setArmChosen] = useState<{ dir: Direction; correct: boolean } | null>(null);
  const [steps, setSteps] = useState<Direction[]>([]);
  const [heliAt, setHeliAt] = useState<number | null>(null);
  const [checks, setChecks] = useState(0);
  const [solved, setSolved] = useState(false);
  const [viewBearing, setViewBearing] = useState<number>(challenges[0]?.rotation ?? 0);
  const [openKey, setOpenKey] = useState('open-0');
  // In-item levers (`MAP_LEVERS`), keyed by the ask they were pulled on.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const flyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopFlight = () => { if (flyTimer.current) { clearInterval(flyTimer.current); flyTimer.current = null; } };
  useEffect(() => stopFlight, []);

  const latestProgress = useRef<{ mergeResult: (r: { challengeId: string; correct: boolean; attempts: number; score?: number }) => void; currentAttempts: number } | null>(null);
  const progress = useMapProgress<MapChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: mapExplorerBoss.assignment,
    // A fresh ask reframes the map at its bearing; Try again clears the attempt (a trip plans again from the start).
    onItemOpened: (index, retry) => {
      stopFlight(); setHeliAt(null); setFlash(null); setFeedback(null); setArmChosen(null); setSolved(false); setSteps([]);
      if (retry) return;
      setChecks(0); setFact(null);
      setViewBearing(challenges[index]?.rotation ?? 0);
      setOpenKey(`open-${index}-${Date.now()}`);
    },
    // A spoken "which way" credited by the observer: show it on the compass and record it.
    onSolved: index => {
      const c = challenges[index];
      if (!c || c.type !== 'name_direction' || !c.direction) return;
      setSolved(true);
      setArmChosen({ dir: c.direction, correct: true });
      setFeedback({ text: checkFeedback(c, townMap, { kind: 'arm', dir: c.direction }), status: 'correct' });
      const place = placeById(townMap, c.targetId);
      if (place) setFact({ title: place.fullName ?? place.name, text: place.blurb ?? '', mapsUri: place.mapsUri, icon: '📍' });
      SoundManager.playCorrect();
      latestProgress.current?.mergeResult({ challengeId: c.id, correct: true, attempts: (latestProgress.current?.currentAttempts ?? 0) + 1, score: 100 });
    },
  });
  latestProgress.current = progress;
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || heliAt !== null || solved;
  const current = challenges[currentIndex] ?? null;
  const town = isTownTask(current?.type ?? challengeType);

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<MapExplorerMetrics>({
    primitiveType: 'map-explorer', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── The check: every answer goes through here ─────────────────────────────
  const commit = useCallback((answer: MapAnswer) => {
    if (!current) return;
    const correct = mapMatches(current, townMap, answer);
    setChecks(n => n + 1);
    setFeedback({ text: checkFeedback(current, townMap, answer), status: correct ? 'correct' : 'incorrect' });
    if (answer.kind === 'tap') setFlash({ id: answer.id, correct, key: `f-${Date.now()}` });
    if (answer.kind === 'arm') setArmChosen({ dir: answer.dir, correct });
    if (correct) {
      SoundManager.playCorrect();
      setSolved(true);
      if (isTownTask(current.type)) {
        const place = placeById(townMap, current.targetId);
        if (place) setFact({ title: place.fullName ?? place.name, text: place.blurb ?? '', mapsUri: place.mapsUri, icon: '📍' });
      } else {
        const id = current.targetId as RegionId;
        setFound(prev => new Set(prev).add(id));
        setFact({ title: regionTitle(id), text: REGION_FACT[id], icon: isContinent(id) ? '🌍' : '🌊' });
        const [lon, lat] = REGION_ANCHOR[id];
        setFocus({ lon, lat, key: `focus-${current.id}` });
      }
    } else SoundManager.playIncorrect();
    progress.commitCheck(describeMapAnswer(current, townMap, answer), correct, mapMiss(current, townMap, answer));
    if (correct) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 25 * (attempts - 1)) });
    }
  }, [current, townMap, progress]);

  const onTapRegion = useCallback((id: string) => {
    if (!current || blocked || allChallengesComplete || isTownTask(current.type)) return;
    commit({ kind: 'tap', id });
  }, [current, blocked, allChallengesComplete, commit]);

  const onTapPlace = useCallback((id: string, bearingNow: number) => {
    if (!current || blocked || allChallengesComplete || current.type !== 'find_by_direction') return;
    commit({ kind: 'tap', id, viewBearing: bearingNow });
  }, [current, blocked, allChallengesComplete, commit]);

  const onArm = useCallback((dir: Direction) => {
    if (!current || blocked || allChallengesComplete) return;
    commit({ kind: 'arm', dir, viewBearing });
  }, [current, blocked, allChallengesComplete, commit, viewBearing]);

  // ── Trips: one hop per arrow; Land is the check, then the helicopter flies the plan ──
  const addStep = (dir: Direction) => {
    if (blocked || steps.length >= 14) return;
    setFeedback(null); setSteps(s => [...s, dir]);
  };
  const onLand = () => {
    if (!current || !townMap || blocked || allChallengesComplete) return;
    if (!steps.length) { setFeedback({ text: 'Plan the trip first: press the arrows.', status: 'insight' }); return; }
    commit({ kind: 'route', steps });
    let at = 0;
    setHeliAt(0);
    stopFlight();
    flyTimer.current = setInterval(() => {
      at += 1;
      if (at > steps.length) { stopFlight(); setHeliAt(null); return; }
      setHeliAt(at);
    }, 450);
  };

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: MapExplorerMetrics = {
      type: 'map-explorer', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation]);

  // ── Levers: the set declares them; the component only draws a pulled one (the compass glow) ──
  const pulledLevers = current && leverState.item === current.id ? leverState.pulled : [];
  const itemLevers = current ? MAP_LEVERS.declare(current, null, pulledLevers) : [];
  const compassGlow = !!current?.compassGlow || itemLevers.some(l => l.id === COMPASS_LEVER && l.pulled);

  // World names: find_on_globe shows only what has been found; world_direction names everything.
  const currentType = current?.type;
  const labels = useMemo<Set<RegionId>>(() => {
    if (currentType === 'world_direction') return new Set<RegionId>([...CONTINENTS, ...OCEANS]);
    return found;
  }, [currentType, found]);

  const flight = useMemo(() => {
    if (current?.type !== 'build_route' || !townMap) return null;
    const f = flyRoute(townMap, current, steps);
    return { points: f.points, at: heliAt ?? f.points.length - 1 };
  }, [current, townMap, steps, heliAt]);

  // What the tutor and the observer see, republished every render: the scene, and the lever set's levers and facts.
  useLayoutEffect(() => {
    if (!current) return;
    const scene = mapScene(current, townMap, {
      labelsShown: Array.from(labels), steps, bearing: viewBearing, checks,
      lastFeedback: feedback && feedback.status !== 'insight' ? feedback.text : null,
    });
    const levers = itemLevers;
    workspace.current = {
      ...leverScene(scene, { support: MAP_LEVERS.support(current, null), onScreen: MAP_LEVERS.onScreen(current, null, pulledLevers) }),
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this ask.`;
        if (lever.pulled) return `${id} is already on screen.`;
        setLeverState({ item: current.id, pulled: [...pulledLevers, id] });
        return true as const;
      },
    };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length || (challenges.some(c => isTownTask(c.type)) && !townMap)) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No map to explore.</LuminaCardContent></LuminaCard>;
  }

  const interactiveCompass = current?.type === 'name_direction' && !allChallengesComplete;
  const real = townMap?.source === 'google_maps';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan">{PHASE_TYPE_CONFIG[current?.type ?? challengeType]?.label ?? 'Maps'}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Map master!" celebrationMessage="You read the map like an explorer." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="cyan">
            <div className="text-base">{current.instruction}</div>
          </LuminaPrompt>
        )}

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock, and the map as one region. */}
        <PipDock />
        <PipWorkspace className="space-y-3">
          {town && townMap && (
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-slate-100">{townMap.name}</span>
              <span className="text-slate-400"> · {townMap.city}{real ? ' · places from Google Maps' : ''}</span>
            </div>
          )}

          <div className="relative">
            <LiveMap className="aspect-[4/3] max-h-[600px] min-h-[320px] w-full"
              view={town ? 'town' : 'world'} town={townMap} viewKey={openKey} bearing={current?.rotation ?? 0}
              labels={labels} found={found}
              highlightRegion={!town ? (current?.fromId as RegionId | undefined) ?? null : null}
              flash={flash} focus={focus}
              placesTappable={current?.type === 'find_by_direction'}
              highlightPlaceId={town ? current?.fromId ?? null : null}
              foundPlaceId={town && solved ? current?.targetId ?? null : null}
              flight={flight} disabled={blocked || allChallengesComplete}
              onTapRegion={onTapRegion} onTapPlace={onTapPlace} onBearing={setViewBearing} />

            {/* The compass turns with the map: when the map turns, so does north. */}
            {!interactiveCompass && (
              <svg viewBox="-100 -100 200 200" className="pointer-events-none absolute bottom-8 left-2 w-20 opacity-90 sm:w-24" role="img"
                aria-label="Compass rose">
                <CompassRose cx={0} cy={0} r={70} rotation={-viewBearing} glow={compassGlow} />
              </svg>
            )}
          </div>
          {interactiveCompass && (
            <div className="mx-auto flex w-56 flex-col items-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Tap the compass</div>
              <svg viewBox="-100 -100 200 200" className="block w-full" role="group" aria-label="Compass rose">
                <CompassRose cx={0} cy={0} r={72} rotation={-viewBearing} glow={compassGlow} onArm={onArm}
                  disabled={blocked} chosen={armChosen} />
              </svg>
            </div>
          )}
          {town && <div className="text-xs text-slate-400">Drag to move · scroll or pinch to zoom · right-drag or twist to turn the map</div>}

          {!allChallengesComplete && current?.type === 'build_route' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {DIR_BUTTONS.map(b => (
                  <LuminaButton key={b.dir} tone="ghost" aria-label={b.label} disabled={blocked} onClick={() => addStep(b.dir)}>
                    <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{b.letter}</span>
                    {b.label}
                  </LuminaButton>
                ))}
                <LuminaButton tone="subtle" disabled={blocked || !steps.length} onClick={() => setSteps(s => s.slice(0, -1))}>Undo</LuminaButton>
                <LuminaButton tone="subtle" disabled={blocked || !steps.length} onClick={() => setSteps([])}>Clear</LuminaButton>
              </div>
              <div className="flex min-h-9 flex-wrap items-center gap-2 text-sm text-slate-200" aria-label="Your flight plan">
                {steps.length ? collapseSteps(steps).map((s, i) => (
                  <span key={i} className="rounded-full border border-blue-300/30 bg-blue-500/15 px-3 py-1">
                    {s.hops} hop{s.hops === 1 ? '' : 's'} {s.dir}
                  </span>
                )) : <span className="text-slate-400">No plan yet. Each arrow is one hop.</span>}
              </div>
              <LuminaActionButton action="check" onClick={onLand} disabled={blocked}>Land!</LuminaActionButton>
            </div>
          )}

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}>
              <p>{feedback.text}</p>
            </LuminaFeedbackCard>
          )}
          {!allChallengesComplete && solved && fact && (fact.text || fact.mapsUri) && (
            <LuminaCallout accent="emerald" icon={fact.icon} label={fact.title}>
              <span>{fact.text}</span>
              {fact.mapsUri && (
                <a href={fact.mapsUri} target="_blank" rel="noreferrer" className="ml-2 text-cyan-300 underline">See it on Google Maps</a>
              )}
            </LuminaCallout>
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const MapExplorer = withWorkspaceOnly<MapExplorerProps>('map-explorer', MapExplorerSurface, props => props.data.title);

/**
 * Maps run only on the teaching workspace: the tutor is present, the learner's tap (or Land) is the check, and
 * the runtime moves to the next ask. Outside a bound session the "needs the tutor" card shows.
 */
export default MapExplorer;
