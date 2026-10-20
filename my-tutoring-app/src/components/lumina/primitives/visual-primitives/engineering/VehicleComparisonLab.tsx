'use client';

/**
 * Vehicle Comparison Lab: a data table of real vehicles (rows) and measures (columns), and one task per eval mode.
 * - metric_leader: choose the vehicle that leads the column the ask names.
 * - evidence_choice: a job with one need; choose the vehicle for it and the column whose numbers prove it.
 * - constraint_tradeoff: a job with minimums and a priority; rule out the vehicles that miss a minimum, then choose
 *   the one that leads the priority among the rest.
 *
 * Every item is built and keyed by code from the roster's numbers (`vehicleComparisonWorkspace.ts`). The rows are
 * not sorted, and nothing marks a leader until the answer is credited. Taught only on the shared tutor/JEV workspace
 * (`withWorkspaceOnly`; its wiring is `vehicleComparisonLab.card.ts` + `vehicleComparisonLab.boss.ts`): every check
 * commits through `progress.commitCheck` with a named miss, a spoken answer is judged by the tutor against the key,
 * and the runtime moves on. The levers are one lever set in `vehicleComparisonLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  LuminaTable,
  type AnswerChoiceState,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { VehicleComparisonLabMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { resolveVehicleVisualKind, type VehicleVisualCategory } from './vehicleVisualKind';
import {
  askOf, cellText, comparisonMiss, describeVehicleWork, emptyWork, explanation, keyOf, METRIC_LABEL, vehicleCorrect,
  vehicleItems, workComplete, workspaceScene,
  type ComparisonVehicle, type MetricKey, type VehicleItem, type VehicleMode, type VehicleTier, type VehicleWork,
} from './vehicleComparisonWorkspace';
import {
  COLUMN_MEANINGS_LEVER, COUNT_DIGITS_LEVER, digitColumns, digitNote, FOCUS_COLUMN_LEVER, MARK_MINIMUMS_LEVER,
  meaningLines, NO_CONTEXT, SMALLER_IS_BETTER_LEVER, smallerLine, VEHICLE_LEVERS,
} from './vehicleComparisonLevers';
import { vehicleComparisonLabBoss } from './vehicleComparisonLab.boss';

// -----------------------------------------------------------------------------
// Data contract (single source of truth; the generator imports it)
// -----------------------------------------------------------------------------

export type VehicleCategory = VehicleVisualCategory;
export type ComparisonMetricKey = MetricKey;
export type ComparisonChallengeType = VehicleMode;
export type { ComparisonVehicle, VehicleMetric } from './vehicleComparisonWorkspace';
export type { VehicleItem, VehicleMode, VehicleTier };

/** Legacy generations (before 2026-10-16) wrote model-keyed missions; only their `type` is read now. */
export interface ComparisonChallenge {
  id: string;
  type: ComparisonChallengeType;
  scenario?: string;
  [key: string]: unknown;
}

export interface SurprisingFact {
  fact: string;
  vehicleIds: string[];
}

export interface VehicleComparisonLabData {
  title: string;
  instructions: string;
  topicFocus: string;
  vehicles: ComparisonVehicle[];
  /** The measures the lesson is about; items ask about these first. */
  comparisonMetrics: ComparisonMetricKey[];
  /** Shown after the last item, never during one (a fact can name a leader). */
  surprisingFacts?: SurprisingFact[];
  gradeBand: 'K-2' | '3-5';
  /** The eval modes this session asks, in order (`resolveVehicleModes`). */
  challengeTypes?: ComparisonChallengeType[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: VehicleTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the roster. */
  items?: VehicleItem[];
  /** Legacy fields, read only for their modes. */
  challenges?: ComparisonChallenge[];
  chartType?: string;
  challengeType?: ComparisonChallengeType;
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<VehicleComparisonLabMetrics>) => void;
}

interface VehicleComparisonLabProps {
  data: VehicleComparisonLabData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<VehicleMode, string> = {
  metric_leader: 'Find the leader',
  evidence_choice: 'Choose and prove',
  constraint_tradeoff: 'Rule out, then choose',
};

// -----------------------------------------------------------------------------
// Vehicle art: one silhouette per vehicle class, never sized by a value.
// -----------------------------------------------------------------------------

const CATEGORY_ACCENT: Record<VehicleCategory, string> = {
  air: 'text-sky-300', land: 'text-amber-300', sea: 'text-cyan-300', space: 'text-violet-300',
};

const VehicleDiagram: React.FC<{ vehicle: { name: string; category: VehicleCategory; visualKind?: unknown }; className?: string }> = ({ vehicle, className }) => {
  const visualKind = resolveVehicleVisualKind(vehicle);
  const p = { viewBox: '0 0 180 90', 'aria-hidden': true, className, 'data-vehicle-visual-kind': visualKind } as const;
  const dark = 'rgb(15 23 42)';
  switch (visualKind) {
    case 'airplane': return (<svg {...p}><path d="M14 48 L75 42 L109 10 L124 10 L108 40 L157 37 Q170 38 174 45 Q170 52 157 53 L108 50 L124 80 L109 80 L75 54 L14 50 Z" fill="currentColor" opacity=".92" /><path d="M53 43 L37 25 L48 25 L72 43 M53 52 L37 69 L48 69 L72 53" fill="currentColor" opacity=".62" /></svg>);
    case 'helicopter': return (<svg {...p}><path d="M39 51 Q43 31 69 29 H111 Q128 31 138 45 L160 49 V60 H52 Q39 59 39 51Z" fill="currentColor" opacity=".92" /><path d="M78 29 L91 15 M48 15 H135 M144 49 L157 30 H165 L160 51" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity=".68" /><path d="M63 67 H135" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".55" /></svg>);
    case 'ship': case 'boat': return (<svg {...p}><path d="M17 54 H164 L148 73 H43 Q27 70 17 54Z" fill="currentColor" opacity=".92" /><path d="M49 51 V27 H119 V51 M64 27 V17 H103 V27" fill="currentColor" opacity=".68" /><path d="M23 78 Q38 70 53 78 T83 78 T113 78 T143 78 T173 78" fill="none" stroke="currentColor" strokeWidth="5" opacity=".35" /></svg>);
    case 'submarine': return (<svg {...p}><path d="M19 51 Q33 31 72 31 H132 Q151 32 164 48 Q151 65 132 66 H72 Q33 66 19 51Z" fill="currentColor" opacity=".92" /><path d="M81 31 V18 H104 V31 M94 18 V10 H116" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity=".65" /></svg>);
    case 'spacecraft': return (<svg {...p}><path d="M102 8 Q135 27 138 59 L111 52 L96 76 L81 52 L54 59 Q57 27 90 8Z" fill="currentColor" opacity=".92" /><circle cx="96" cy="30" r="10" fill={dark} opacity=".85" /><path d="M84 57 L74 83 L91 68 L96 88 L101 68 L118 83 L108 57" fill="currentColor" opacity=".4" /></svg>);
    case 'bus': return (<svg {...p}><rect x="18" y="20" width="145" height="50" rx="9" fill="currentColor" opacity=".92" /><path d="M31 29 H135 V48 H31Z" fill={dark} opacity=".82" /><circle cx="48" cy="69" r="12" fill={dark} /><circle cx="135" cy="69" r="12" fill={dark} /></svg>);
    case 'train': return (<svg {...p}><path d="M28 15 H137 Q153 15 153 32 V65 H28Z" fill="currentColor" opacity=".92" /><path d="M39 25 H74 V44 H39Z M84 25 H137 V44 H84Z" fill={dark} opacity=".82" /><path d="M19 72 H163 M38 81 H145" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".5" /><circle cx="54" cy="65" r="11" fill={dark} /><circle cx="126" cy="65" r="11" fill={dark} /></svg>);
    case 'bicycle': case 'motorcycle': return (<svg {...p}><circle cx="47" cy="63" r="21" fill="none" stroke="currentColor" strokeWidth="7" opacity=".9" /><circle cx="137" cy="63" r="21" fill="none" stroke="currentColor" strokeWidth="7" opacity=".9" /><path d="M47 63 L76 29 L98 63 L62 63 L86 43 L116 43 L137 63 M72 25 H90 M113 43 L107 27 H122" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity=".92" />{visualKind === 'motorcycle' && <path d="M75 35 Q96 23 116 43 H88Z" fill="currentColor" opacity=".55" />}</svg>);
    case 'truck': case 'construction': return (<svg {...p}><path d="M18 31 H104 V66 H18Z M104 43 H137 L160 61 V66 H104Z" fill="currentColor" opacity=".92" />{visualKind === 'construction' && <path d="M24 28 L69 11 L91 28Z" fill="currentColor" opacity=".55" />}<circle cx="50" cy="66" r="13" fill={dark} /><circle cx="132" cy="66" r="13" fill={dark} /></svg>);
    case 'car': return (<svg {...p}><path d="M19 59 L31 38 Q35 30 46 30 H116 Q125 30 134 40 L151 44 Q162 46 166 58 V66 H19Z" fill="currentColor" opacity=".92" /><path d="M52 35 H83 V47 H38 L44 37 Q46 35 52 35Z M89 35 H114 Q120 35 126 44 L129 47 H89Z" fill={dark} opacity=".85" /><circle cx="52" cy="66" r="13" fill={dark} /><circle cx="137" cy="66" r="13" fill={dark} /></svg>);
    default: return (<svg {...p}><rect x="28" y="20" width="124" height="52" rx="18" fill="currentColor" opacity=".18" /><text x="90" y="54" textAnchor="middle" fill="currentColor" fontSize="17" fontWeight="700" letterSpacing="2">{vehicle.category.toUpperCase()}</text></svg>);
  }
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const useVehicleProgress = useWorkspaceProgressFor('vehicle-comparison-lab');

const VehicleComparisonLabSurface = ({ data, className, runtimePlanItemId }: VehicleComparisonLabProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instructions, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => vehicleItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.vehicles, data.challengeTypes, data.difficulty, data.comparisonMetrics, data.title]);
  const stableInstanceId = useRef(instanceId || `vehicle-comparison-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useVehicleProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: vehicleComparisonLabBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: VehicleItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<VehicleItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<VehicleWork>(emptyWork);
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<VehicleComparisonLabMetrics>({
    primitiveType: 'vehicle-comparison-lab',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = () => { setWork(emptyWork()); setWrongShown(false); setPracticeSolved(false); };

  openItem.current = (_index, retry) => {
    if (retry) { clearItem(); return; }
    setPractice(null); clearItem();
  };

  const showKey = (solved: VehicleItem) => {
    const key = keyOf(solved);
    setWork({ vehicle: key.vehicle, evidence: key.evidence ?? null }); setWrongShown(false);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    showKey(solved);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    showKey(practice);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const chooseVehicle = (id: string) => {
    if (!item || closed) return;
    SoundManager.select();
    setWork(w => ({ ...w, vehicle: id }));
  };
  const chooseEvidence = (m: MetricKey) => {
    if (!item || closed || item.mode !== 'evidence_choice') return;
    SoundManager.select();
    setWork(w => ({ ...w, evidence: m }));
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = vehicleCorrect(item, work);
    progress.commitCheck(describeVehicleWork(item, work), correct, correct ? undefined : comparisonMiss(item, work));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    setWrongShown(true);
  };

  const metrics = (): VehicleComparisonLabMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    const evidenceItems = items.filter(i => i.mode === 'evidence_choice');
    return {
      type: 'vehicle-comparison-lab',
      vehiclesCompared: new Set(items.flatMap(i => i.rows.map(r => r.id))).size,
      metricsExplored: Array.from(new Set(items.map(i => i.metric))),
      challengeAnswersCorrect: right.length,
      challengesTotal: items.length,
      challengeJustificationProvided: evidenceItems.length > 0 && evidenceItems.every(i => right.includes(i)),
      chartTypesUsed: ['data-table'],
      surprisingFactsDiscovered: 0,
      surprisingFactsTotal: data.surprisingFacts?.length ?? 0,
      predictionsMade: 0,
      predictionsCorrect: 0,
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
    const scene = workspaceScene(item, { work, solved: revealed });
    // No lever on the practice item: the full item's levers come back with it.
    const levers = practice || !sessionItem ? [] : VEHICLE_LEVERS.declare(sessionItem, NO_CONTEXT, pulled);
    const withPractice = practice
      ? { ...scene, facts: { ...scene.facts, practice: 'A simpler item of the same kind, before the full item comes back.' } }
      : scene;
    workspace.current = {
      ...leverScene(withPractice, { support: '',
        onScreen: practice || !sessionItem ? '' : VEHICLE_LEVERS.onScreen(sessionItem, NO_CONTEXT, pulled) }),
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = VEHICLE_LEVERS.simpler(sessionItem, NO_CONTEXT, id);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: vehicleComparisonLabBoss.assignment(simpler) };
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
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no questions to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item ? keyOf(item) : null;
  const rowState = (id: string): AnswerChoiceState => {
    if (revealed) return id === key?.vehicle ? 'correct' : id === work.vehicle ? 'incorrect' : 'dimmed';
    if (wrongShown && work.vehicle === id) return 'incorrect';
    return work.vehicle === id ? 'selected' : 'idle';
  };
  const columnState = (m: MetricKey): AnswerChoiceState => {
    if (revealed) return m === key?.evidence ? 'correct' : m === work.evidence ? 'incorrect' : 'dimmed';
    if (wrongShown && work.evidence === m) return 'incorrect';
    return work.evidence === m ? 'selected' : 'idle';
  };
  const faded = (m: MetricKey) => !!item && leverOn(FOCUS_COLUMN_LEVER) && m !== item.metric;
  const digitsOn = (m: MetricKey) => !!item && leverOn(COUNT_DIGITS_LEVER) && digitColumns(item).includes(m);
  const minimumOf = (m: MetricKey) => item?.mode === 'constraint_tradeoff' && leverOn(MARK_MINIMUMS_LEVER)
    ? item.minimums.find(n => n.metric === m) : undefined;

  const table = item && (
    <LuminaTable
      accent="cyan"
      data-vehicle-table=""
      columns={['#', 'Vehicle', ...item.columns.map(c => <span key={c} className={cn(faded(c) && 'opacity-30')}>{METRIC_LABEL[c]}</span>)]}
      rows={item.rows.map((row, i) => [
        <span key="n" className="font-mono text-slate-400">{i + 1}</span>,
        <LuminaAnswerChoice key="v" aria-label={row.name} state={rowState(row.id)} disabled={closed}
          className="flex min-w-[10rem] items-center gap-2 p-2" onClick={() => chooseVehicle(row.id)}>
          <VehicleDiagram vehicle={row} className={cn('h-7 w-12 flex-shrink-0', CATEGORY_ACCENT[row.category] ?? 'text-slate-300')} />
          <span className="text-sm font-semibold">{row.name}</span>
        </LuminaAnswerChoice>,
        ...item.columns.map(c => {
          const min = minimumOf(c);
          const met = min ? (row.values[c] ?? -Infinity) >= min.atLeast : null;
          return (
            <span key={c} className={cn('block font-mono', faded(c) && 'opacity-30')}>
              <span className="inline-flex items-center gap-1">
                {cellText(item, row, c)}
                {met !== null && (met
                  ? <Check aria-label="meets the minimum" data-lever="mark-minimums" className="h-4 w-4 text-emerald-300" />
                  : <X aria-label="misses the minimum" data-lever="mark-minimums" className="h-4 w-4 text-rose-300" />)}
              </span>
              {digitsOn(c) && <span data-lever="count-digits" className="block text-[11px] text-slate-400">{digitNote(row.values[c]!)}</span>}
            </span>
          );
        }),
      ])}
    />
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler item first' : `${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {instructions && !done && <p className="text-sm text-slate-400">{instructions}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Lab complete">
            <p>{`${results.filter(r => r.correct).length} of ${items.length} items answered.`}</p>
            {(data.surprisingFacts ?? []).slice(0, 3).map(f => <p key={f.fact} className="mt-2 text-sm text-slate-300">Did you know? {f.fact}</p>)}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the table and buttons as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {table}

              {leverOn(SMALLER_IS_BETTER_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="smaller-is-better" className="text-sm text-slate-300">{smallerLine(item.metric)}</LuminaPanel>
              )}
              {leverOn(COLUMN_MEANINGS_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="column-meanings" className="space-y-1 text-sm text-slate-300">
                  {meaningLines(item).map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}

              {item.mode === 'evidence_choice' && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Which column proves it?</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {item.columns.map(c => (
                      <LuminaAnswerChoice key={c} aria-label={METRIC_LABEL[c]} state={columnState(c)} disabled={closed}
                        className="p-3 text-center text-sm font-semibold" onClick={() => chooseEvidence(c)}>
                        {METRIC_LABEL[c]}
                      </LuminaAnswerChoice>
                    ))}
                  </div>
                </div>
              )}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>Check</LuminaActionButton>
              </div>
            )}

            {revealed && <LuminaFeedbackCard status="correct">{explanation(item)}</LuminaFeedbackCard>}
            {!revealed && wrongShown && <LuminaFeedbackCard status="incorrect">That is not it.</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const VehicleComparisonLab = withWorkspaceOnly<VehicleComparisonLabProps>('vehicle-comparison-lab', VehicleComparisonLabSurface, props => props.data.title);

export default VehicleComparisonLab;
