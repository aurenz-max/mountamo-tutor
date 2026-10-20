'use client';

/**
 * Transport Challenge: a job (move a load of people or tons of cargo) and the vehicles that could do it. Each card
 * shows what ONE trip of that vehicle carries and costs; the learner works out trips (the load / what a trip carries,
 * rounded up) and totals (trips x the per-trip figure) and picks the vehicle the mode asks for:
 * - single_constraint: the vehicle that does the whole job within one limit;
 * - multi_constraint: the vehicle that keeps both limits;
 * - full_optimization: no vehicle keeps all three limits; the one that breaks only one.
 *
 * Every item is built and keyed by code (`transportWorkspace.ts`). No card shows trips or totals before a pick is
 * checked; a checked pick runs that one vehicle (its trips play out, its totals fill bars against the limits), and the
 * table of every vehicle appears only once the item is credited. Taught only on the shared tutor/JEV workspace
 * (`withWorkspaceOnly`; its wiring is `transportChallenge.card.ts` + `transportChallenge.boss.ts`): every check commits
 * through `progress.commitCheck` with a named miss, a spoken answer is judged by the tutor against the key, and the
 * runtime moves on. The levers are one lever set in `transportLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TransportChallengeMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  type AnswerChoiceState,
} from '../../../ui';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  amountText, askOf, carriesText, describeTransportWork, emptyWork, keyVehicle, limitLabel, loadText, perTripText,
  runText, totalFor, transportCorrect, transportItems, transportMiss, tripsFor, workspaceScene,
  type LimitType, type TransportFrame, type TransportItem, type TransportMode, type TransportTier, type TransportVehicle,
  type TransportWork,
} from './transportWorkspace';
import {
  NO_CONTEXT, SHOW_TRIPS_LEVER, TIMES_SETUP_LEVER, timesLines, TRANSPORT_LEVERS, tripLine,
} from './transportLevers';
import { transportChallengeBoss } from './transportChallenge.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { TransportFrame, TransportItem, TransportMode, TransportTier };

/** A generation from before 2026-10-16 (model-written scenarios and trade-off questions): read for its modes and names. */
export interface LegacyTransportScenario {
  type?: string; title?: string; origin?: string; destination?: string;
  load?: { kind?: string; name?: string };
}

export interface TransportChallengeData {
  title: string;
  description?: string;
  /** The eval modes this session asks, in order (`resolveTransportModes`). */
  challengeTypes?: TransportMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: TransportTier;
  /** The lesson's names for each job (titles, places, what is moved, the vehicle it is about). */
  frames?: TransportFrame[];
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: TransportItem[];
  scenarios?: LegacyTransportScenario[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TransportChallengeMetrics>) => void;
}

interface TransportChallengeProps {
  data: TransportChallengeData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<TransportMode, string> = {
  single_constraint: 'One limit', multi_constraint: 'Two limits', full_optimization: 'Three limits',
};
const LIMIT_ICON: Record<LimitType, string> = { budget: '💰', time: '⏱️', co2: '🌿' };
const MAX_ICONS = 40;

// ============================================================================
// Pieces
// ============================================================================

/** show_trips: one block a trip, the last part full when the load does not fill it. */
const TripBlocks = ({ item, v }: { item: TransportItem; v: TransportVehicle }) => {
  const trips = tripsFor(item, v);
  const lastFill = (item.load.amount - (trips - 1) * v.capacity) / v.capacity;
  return (
    <div data-lever="show-trips" className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-0.5" aria-hidden="true">
        {Array.from({ length: trips }, (_, i) => (
          <span key={i} className="relative inline-block h-3 w-3 overflow-hidden rounded-sm border border-cyan-300/40 bg-slate-800">
            <span className="absolute inset-y-0 left-0 bg-cyan-400/70" style={{ width: `${(i === trips - 1 ? Math.min(lastFill, 1) : 1) * 100}%` }} />
          </span>
        ))}
      </div>
      <p className="text-xs text-cyan-200">{tripLine(item, v)}</p>
    </div>
  );
};

/** A checked vehicle's run: its trips play out along the route, its totals fill bars against the limits. */
const RunPanel = ({ item, v }: { item: TransportItem; v: TransportVehicle }) => {
  const trips = tripsFor(item, v);
  return (
    <LuminaPanel data-run={v.id} className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>{item.origin}</span><span className="flex-1 border-t border-dashed border-white/20" /><span>{item.destination}</span>
      </div>
      <div className="flex flex-wrap gap-1" aria-label={`${trips} trips of the ${v.name.toLowerCase()}`}>
        {Array.from({ length: Math.min(trips, MAX_ICONS) }, (_, i) => (
          <span key={i} className="animate-in fade-in zoom-in text-lg" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>{v.emoji}</span>
        ))}
        {trips > MAX_ICONS && <span className="text-xs text-slate-400">+{trips - MAX_ICONS} more</span>}
      </div>
      <div className="space-y-1.5">
        {item.limits.map(l => {
          const total = totalFor(item, v, l.type), over = total > l.max;
          return (
            <div key={l.type} className="flex items-center gap-2 text-xs">
              <span className="w-5">{LIMIT_ICON[l.type]}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className={cn('h-full rounded-full transition-all duration-700', over ? 'bg-red-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.min(total / l.max, 1) * 100}%` }} />
              </div>
              <span className={cn('w-40 text-right tabular-nums', over ? 'text-red-300' : 'text-slate-300')}>
                {amountText(l.type, total)} of {amountText(l.type, l.max)}
              </span>
            </div>
          );
        })}
      </div>
    </LuminaPanel>
  );
};

/** Every vehicle's trips and totals: shown once the item is answered. */
const CompareTable = ({ item }: { item: TransportItem }) => (
  <div className="overflow-x-auto" data-compare="all">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-white/10 text-slate-400">
          <th className="py-1.5 pr-2 text-left">Vehicle</th>
          <th className="px-2 py-1.5 text-right">Trips</th>
          {item.limits.map(l => <th key={l.type} className="px-2 py-1.5 text-right">{LIMIT_ICON[l.type]} {amountText(l.type, l.max)}</th>)}
        </tr>
      </thead>
      <tbody>
        {item.vehicles.map(v => (
          <tr key={v.id} className="border-b border-white/5">
            <td className="py-1.5 pr-2 text-slate-200">{v.emoji} {v.name}</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">{tripsFor(item, v)}</td>
            {item.limits.map(l => {
              const t = totalFor(item, v, l.type);
              return <td key={l.type} className={cn('px-2 py-1.5 text-right tabular-nums', t > l.max ? 'text-red-300' : 'text-emerald-300')}>{amountText(l.type, t)}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ============================================================================
// Component
// ============================================================================

const useTransportProgress = useWorkspaceProgressFor('transport-challenge');

const TransportChallengeSurface = ({ data, className, runtimePlanItemId }: TransportChallengeProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, description, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => transportItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.frames, data.scenarios, data.title]);
  const stableInstanceId = useRef(instanceId || `transport-challenge-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice job. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const progress = useTransportProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: transportChallengeBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked pick stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: TransportItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<TransportItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<TransportWork>(emptyWork);
  /** The vehicle whose run is on screen: the learner's checked pick (or, once answered, the key). */
  const [ran, setRan] = useState<string | null>(null);
  /** The checked wrong pick, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<TransportChallengeMetrics>({
    primitiveType: 'transport-challenge',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = () => { setWork(emptyWork()); setRan(null); setWrongShown(false); setPracticeSolved(false); };

  openItem.current = (_index, retry) => {
    if (retry) { clearItem(); return; }
    setPractice(null); clearItem();
  };

  /** A spoken credit shows as a checked pick would: the right card and its run. */
  const showKey = (solved: TransportItem) => {
    const key = keyVehicle(solved);
    if (key) { setWork({ picked: key.id }); setRan(key.id); }
    setWrongShown(false);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    showKey(solved);
  };

  // A spoken answer credited on the practice job: shown there as on a session item, recorded nowhere. A tap shows its
  // own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    showKey(practice);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const pick = (id: string) => {
    if (!item || closed) return;
    SoundManager.select();
    setWork({ picked: id });
  };

  const check = () => {
    if (!item || closed || !work.picked) return;
    const correct = transportCorrect(item, work);
    progress.commitCheck(describeTransportWork(item, work), correct, correct ? undefined : transportMiss(item, work));
    setRan(work.picked);
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    setWrongShown(true);
  };

  const metrics = (): TransportChallengeMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    return {
      type: 'transport-challenge',
      scenariosCompleted: results.length,
      totalScenarios: items.length,
      vehicleChoiceAccuracy: items.length ? Math.round((right.length / items.length) * 100) : 0,
      firstTryCount: results.filter(r => r.correct && r.attempts === 1).length,
      attemptsCount: currentAttempts,
    };
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), attemptsCount: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || isComplete) return;
    const scene = workspaceScene(item, { work, ran, solved: revealed });
    // No lever on the practice job: the full job's levers come back with it.
    const levers = practice || !sessionItem ? [] : TRANSPORT_LEVERS.declare(sessionItem, NO_CONTEXT, pulled);
    const withPractice = practice
      ? { ...scene, facts: { ...scene.facts, practice: 'A smaller job of the same kind, before the full job comes back.' } }
      : scene;
    workspace.current = {
      ...leverScene(withPractice, { support: '',
        onScreen: practice || !sessionItem ? '' : TRANSPORT_LEVERS.onScreen(sessionItem, NO_CONTEXT, pulled) }),
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = TRANSPORT_LEVERS.simpler(sessionItem, NO_CONTEXT, id);
          if (!simpler) return 'There is no smaller job here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: transportChallengeBoss.assignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || isComplete;

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This challenge has no jobs to plan.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item ? keyVehicle(item) : null;
  const ranVehicle = item?.vehicles.find(v => v.id === ran) ?? null;
  const cardState = (v: TransportVehicle): AnswerChoiceState => {
    if (revealed) return v.id === key?.id ? 'correct' : v.id === ran ? 'incorrect' : 'dimmed';
    if (wrongShown && v.id === work.picked) return 'incorrect';
    return work.picked === v.id ? 'selected' : 'idle';
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A smaller job first' : `${MODE_LABEL[item.mode]} · job ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {description && !done && <p className="text-sm text-slate-400">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Challenge complete">
            {`${results.filter(r => r.correct).length} of ${items.length} jobs planned.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>
              <span className="block font-semibold">{item.title}</span>
              {askOf(item)}
            </LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the job and cards as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              <LuminaPanel className="space-y-2">
                <p className="text-sm text-slate-300">
                  Move <span className="font-bold text-blue-300">{loadText(item.load)}</span> from{' '}
                  <span className="text-amber-300">{item.origin}</span> to <span className="text-emerald-300">{item.destination}</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.limits.map(l => <LuminaBadge key={l.type} className="text-xs">{LIMIT_ICON[l.type]} {limitLabel(l)}</LuminaBadge>)}
                </div>
              </LuminaPanel>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {item.vehicles.map(v => (
                  <LuminaAnswerChoice key={v.id} aria-label={v.name} state={cardState(v)} disabled={closed}
                    className="p-3 text-sm" onClick={() => pick(v.id)}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-2xl" aria-hidden="true">{v.emoji}</span>
                      <span className="font-medium text-slate-100">{v.name}</span>
                    </div>
                    <div className="space-y-0.5 text-xs text-slate-400">
                      <div>{carriesText(item, v)}</div>
                      <div>{item.shows.map(t => perTripText(v, t)).join(' · ')}</div>
                    </div>
                    {leverOn(SHOW_TRIPS_LEVER) && <TripBlocks item={item} v={v} />}
                    {leverOn(TIMES_SETUP_LEVER) && (
                      <div data-lever="times-setup" className="mt-2 space-y-0.5 font-mono text-xs text-cyan-200">
                        {timesLines(item, v).map(line => <div key={line}>{line}</div>)}
                      </div>
                    )}
                  </LuminaAnswerChoice>
                ))}
              </div>

              {ranVehicle && <RunPanel item={item} v={ranVehicle} />}
              {revealed && <CompareTable item={item} />}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !work.picked} onClick={check}>Check my pick</LuminaActionButton>
              </div>
            )}

            {revealed && key && (
              <LuminaFeedbackCard status="correct">{`${runText(item, key).replace(/^the /, 'The ')}.`}</LuminaFeedbackCard>
            )}
            {!revealed && ranVehicle && (
              <LuminaFeedbackCard status="incorrect">{`Your pick's run: ${runText(item, ranVehicle)}. That does not answer the job.`}</LuminaFeedbackCard>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const TransportChallenge = withWorkspaceOnly<TransportChallengeProps>('transport-challenge', TransportChallengeSurface, props => props.data.title);

export default TransportChallenge;
