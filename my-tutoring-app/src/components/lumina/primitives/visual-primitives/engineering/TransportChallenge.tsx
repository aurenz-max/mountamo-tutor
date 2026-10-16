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
 * table of every vehicle appears only once the item is credited. Two paths, chosen by `withWorkspaceController`: the
 * scripted path (tester, no tutor) has its own Next and two tries before a reveal; the workspace path (W1, plain shape)
 * commits every check through `progress.commitCheck` with a named miss, takes a spoken answer judged by the tutor, and
 * lets the runtime move on. The levers live in `transportLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TransportChallengeMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { ReadMeButton } from '../../shared/ReadMeButton';
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
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  amountText, askOf, carriesText, describeTransportWork, emptyWork, keyVehicle, limitLabel, loadText, perTripText,
  runText, totalFor, transportCorrect, transportItems, transportMiss, tripsFor, workspaceAssignment, workspaceScene,
  type LimitType, type TransportFrame, type TransportItem, type TransportMode, type TransportTier, type TransportVehicle,
  type TransportWork,
} from './transportWorkspace';
import {
  leverFact, simplerItem, SHOW_TRIPS_LEVER, TIMES_SETUP_LEVER, timesLines, transportLevers, tripLine,
} from './transportLevers';

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

const TransportChallengeSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  TransportChallengeProps & { tutorOwned: boolean; useController: (options: ProgressOptions<TransportItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, description, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => transportItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.frames, data.scenarios, data.title]);
  const stableInstanceId = useRef(instanceId || `transport-challenge-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const sessionItem: TransportItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<TransportItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<TransportWork>(emptyWork);
  /** The vehicle whose run is on screen: the learner's checked pick (or, once answered, the key). */
  const [ran, setRan] = useState<string | null>(null);
  /** Workspace path: the checked wrong pick, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<TransportChallengeMetrics>({
    primitiveType: 'transport-challenge',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const aiPrimitiveData = useMemo(() => ({
    mode: item?.mode ?? 'single_constraint', itemIndex: currentIndex + 1, totalItems: items.length,
    ask: item ? askOf(item) : title, attemptNumber: currentAttempts + 1,
  }), [item, currentIndex, items.length, title, currentAttempts]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'transport-challenge', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 3-5', enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = () => {
    setWork(emptyWork()); setRan(null); setWrongShown(false);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
  };

  openItem.current = (index, retry) => {
    if (retry) { setWork(emptyWork()); setRan(null); setWrongShown(false); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
    void index;
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    const key = keyVehicle(solved);
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    if (key) { setWork({ picked: key.id }); setRan(key.id); }
    setWrongShown(false);
  };

  // A spoken credit on the smaller job shows it as a checked pick would: the right card and its run.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    const key = keyVehicle(practice);
    if (key) { setWork({ picked: key.id }); setRan(key.id); }
    setWrongShown(false); setPracticeSolved(true);
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
      say(`[ANSWER_CORRECT] The learner picked the right vehicle for: ${askOf(item)} Its run is on screen. Praise briefly.`);
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) { setWrongShown(true); return; }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      const key = keyVehicle(item);
      setScriptedReveal(true);
      if (key) { setWork({ picked: key.id }); setRan(key.id); }
      if (!practice) progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] Two picks missed on: ${askOf(item)} Every vehicle's totals are now on screen; explain them.`);
      return;
    }
    say(`[ANSWER_INCORRECT] ${describeTransportWork(item, work)} for: ${askOf(item)} Its run is on screen and it does not answer. `
      + 'You are not told the answer: ask how many trips a vehicle needs and what its totals come to, without naming a vehicle.');
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

  /** Scripted path: Next, and on the last item the session report. */
  const next = () => {
    if (progress.advance()) { clearItem(); say(`[NEXT_ITEM] Job ${currentIndex + 2} of ${items.length}: ${askOf(items[currentIndex + 1])}`); return; }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((results.filter(r => r.correct).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 50, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} jobs. Celebrate briefly.`);
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), attemptsCount: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || isComplete) return;
    const scene = workspaceScene(item, { work, ran, solved: revealed });
    const levers = practice ? [] : transportLevers(sessionItem, pulled);
    const onScreen = practice ? '' : leverFact(sessionItem, pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A smaller job of the same kind, before the full job comes back.' } : {}),
        ...(onScreen ? { onScreen } : {}) },
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = simplerItem(sessionItem);
          if (!simpler) return 'There is no smaller job here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: workspaceAssignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || (tutorOwned && isComplete);
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || !item ? null : item.id,
    label: 'The job, the vehicles and your pick',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

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
            <div className="flex items-start gap-2">
              <LuminaPrompt accent="cyan" className="flex-1" {...(practice ? { 'data-practice': 'simpler' } : {})}>
                <span className="block font-semibold">{item.title}</span>
                {askOf(item)}
              </LuminaPrompt>
              {!tutorOwned && (
                <ReadMeButton instruction={askOf(item)} ask="Work out each vehicle's trips and totals, then pick one."
                  speaking={isAudioPlaying} onAskTutor={m => sendText?.(m)} tag="[READ_CHALLENGE]"
                  className="flex-shrink-0" aria-label="Read the job to me" />
              )}
            </div>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
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
            </div>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !work.picked} onClick={check}>Check my pick</LuminaActionButton>
              </div>
            )}

            {revealed && key && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
                {`${runText(item, key).replace(/^the /, 'The ')}.`}
              </LuminaFeedbackCard>
            )}
            {!revealed && ranVehicle && (
              <LuminaFeedbackCard status="incorrect">
                {`Your pick's run: ${runText(item, ranVehicle)}. That does not answer the job${tutorOwned ? '.' : '; pick again.'}`}
              </LuminaFeedbackCard>
            )}

            {!tutorOwned && revealed && !practice && (
              <div className="flex justify-end">
                <LuminaActionButton action="next" onClick={next}>{currentIndex < items.length - 1 ? 'Next job →' : 'Finish'}</LuminaActionButton>
              </div>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const TransportChallenge = withWorkspaceController<TransportChallengeProps, ProgressOptions<TransportItem>, Progress>(
  'transport-challenge', TransportChallengeSurface, useScriptedProgress, useWorkspaceProgressFor('transport-challenge'));

export default TransportChallenge;
