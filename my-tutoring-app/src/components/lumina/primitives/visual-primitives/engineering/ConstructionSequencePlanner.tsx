'use client';

/**
 * Construction Sequence Planner ("Build It Right"): construction jobs on job cards, and one task per eval mode.
 * - sequence: tap the jobs into the order they must happen (the cards do not say what a job needs).
 * - dependency_chain: each card says which jobs it needs; tap them into an order that works.
 * - parallel: one-week jobs; put each job in a week (jobs in a week happen at the same time) to meet a deadline.
 * - critical_path: jobs with their weeks and needs; say or tap the fewest weeks the whole build can take.
 *
 * Every item is built and keyed by code (`constructionSequenceWorkspace.ts`) from a library of real jobs per project.
 * Nothing on screen gives the order, a week for a job, or the total before the learner's own check: a checked plan is
 * built on screen block by block, and a plan that breaks stops at the first job whose need was not done. Two paths,
 * chosen by `withWorkspaceController`: the scripted path (tester, no tutor) has its own Next and two tries before a
 * reveal; the workspace path (W1, plain shape) commits every check through `progress.commitCheck` with a named miss,
 * takes a spoken total judged by the tutor on critical_path, and lets the runtime move on. The levers live in
 * `constructionSequenceLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { ConstructionSequencePlannerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { ReadMeButton } from '../../shared/ReadMeButton';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaButton,
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
  askOf, buildOrder, criticalWeeks, cspCorrect, cspItems, cspMiss, describeCspWork, emptyWork, fastestPlan, firstBreak,
  isOrderMode, nameOf, parallelProblem, runText, weekRows, weeksUsed, workComplete, workspaceAssignment,
  workspaceScene, type CspItem, type CspMode, type CspTier, type CspWork, type Job, type ProjectId,
} from './constructionSequenceWorkspace';
import {
  asYouGoMarks, chainLines, CHECK_AS_YOU_GO_LEVER, cspLevers, leverFact, NOT_READY, SAME_NEEDS_LEVER, sameNeedsTags,
  simplerItem, TICK_NEEDS_LEVER, TRACE_CHAINS_LEVER, WEEK_BLOCKS_LEVER,
} from './constructionSequenceLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { CspItem, CspMode, CspTier, Job };

export interface ConstructionSequencePlannerData {
  title: string;
  /** One neutral sentence under the title; never an order or a total. */
  description?: string;
  projectType?: ProjectId | string;
  gradeLevel?: string;
  /** The eval modes this session asks, in order (`resolveCspModes`). */
  challengeTypes?: CspMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: CspTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: CspItem[];
  /** Legacy generations (model-written task lists, before 2026-10-16): read only for their modes and project. */
  challenges?: Array<{ type?: string }>;
  supportTier?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ConstructionSequencePlannerMetrics>) => void;
}

interface ConstructionSequencePlannerProps {
  data: ConstructionSequencePlannerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<CspMode, string> = {
  sequence: 'Put the jobs in order', dependency_chain: 'Follow the needs', parallel: 'Plan the weeks', critical_path: 'Find the fewest weeks',
};

// ============================================================================
// The build run: the learner's own checked plan, built block by block
// ============================================================================

type BlockState = 'built' | 'stopped' | 'waiting';

const BuildRun = ({ item, plan, step }: { item: CspItem; plan: CspWork; step: number }) => {
  // The steps of the build: one job each for an order, the jobs of each week for a week plan.
  const steps: string[][] = isOrderMode(item.mode) ? plan.order.map(id => [id])
    : Array.from({ length: weeksUsed(plan) }, (_, k) => item.jobs.filter(j => plan.week[j.id] === k + 1).map(j => j.id));
  let stopAt = Infinity;
  if (isOrderMode(item.mode)) { const b = firstBreak(item, plan.order); if (b) stopAt = b.at; }
  else { const p = parallelProblem(item, plan); if (p && p.miss !== 'too_many_weeks') stopAt = p.week - 1; }
  const stateOf = (k: number): BlockState => (k > step || k > stopAt ? 'waiting' : k === stopAt ? 'stopped' : 'built');
  return (
    <LuminaPanel data-build-run className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-slate-400">The build</p>
      <div className="flex flex-wrap items-end gap-2 border-b-4 border-amber-900/70 pb-1">
        {steps.map((ids, k) => (
          <div key={k} className="flex flex-col-reverse items-center gap-1">
            {item.mode === 'parallel' && <span className="text-[10px] text-slate-500">Week {k + 1}</span>}
            {ids.map(id => {
              const s = stateOf(k), job = item.jobs.find(j => j.id === id)!;
              return (
                <div key={id} data-block={s}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-all duration-300 ${
                    s === 'built' ? 'border-emerald-400/50 bg-emerald-500/15 text-slate-100'
                      : s === 'stopped' ? 'translate-y-1 rotate-6 border-rose-400/70 bg-rose-500/20 text-rose-100'
                        : 'border-white/10 bg-slate-800/40 text-slate-500 opacity-60'}`}>
                  <span aria-hidden="true">{job.icon}</span>{job.name}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </LuminaPanel>
  );
};

/** critical_path, once credited or revealed: each job drawn from the week it can start, as soon as its needs end. */
const Timeline = ({ item }: { item: CspItem }) => {
  const start = new Map<string, number>();
  const at = (id: string): number => {
    if (start.has(id)) return start.get(id)!;
    const j = item.jobs.find(x => x.id === id)!;
    const s = Math.max(0, ...j.needs.map(n => at(n) + (item.jobs.find(x => x.id === n)?.weeks ?? 0)));
    start.set(id, s); return s;
  };
  item.jobs.forEach(j => at(j.id));
  const total = criticalWeeks(item);
  return (
    <LuminaPanel data-timeline className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-slate-400">{`Timeline: ${total} weeks`}</p>
      {item.jobs.map(j => (
        <div key={j.id} className="flex items-center gap-2 text-xs">
          <span className="w-44 truncate text-slate-300"><span aria-hidden="true">{j.icon}</span> {j.name}</span>
          <div className="relative h-4 flex-1 rounded bg-slate-800/40">
            <div className="absolute top-0 h-4 rounded bg-cyan-500/60"
              style={{ left: `${(start.get(j.id)! / total) * 100}%`, width: `${(j.weeks / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </LuminaPanel>
  );
};

// ============================================================================
// Component
// ============================================================================

const ConstructionSequencePlannerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  ConstructionSequencePlannerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<CspItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, description, gradeLevel = '3', instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => cspItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.projectType, data.title, data.gradeLevel]);
  const stableInstanceId = useRef(instanceId || `construction-sequence-planner-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const sessionItem: CspItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<CspItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<CspWork>(emptyWork);
  /** The plan last checked, built on screen. */
  const [checked, setChecked] = useState<CspWork | null>(null);
  const [buildStep, setBuildStep] = useState(0);
  /** Workspace path: the checked wrong work, shown until Try again. */
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

  // The checked plan is built one step at a time (visual only; the verdict is already committed).
  useEffect(() => {
    if (!checked) return;
    setBuildStep(0);
    const steps = Math.max(checked.order.length, ...Object.values(checked.week), 0);
    const timers = Array.from({ length: steps }, (_, k) => setTimeout(() => setBuildStep(k + 1), 350 * (k + 1)));
    return () => timers.forEach(clearTimeout);
  }, [checked]);

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<ConstructionSequencePlannerMetrics>({
    primitiveType: 'construction-sequence-planner',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const aiPrimitiveData = useMemo(() => ({
    projectType: item?.project ?? 'house', gradeLevel, mode: item?.mode ?? 'sequence', taskCount: item?.jobs.length ?? 0,
    itemIndex: currentIndex + 1, totalItems: items.length, ask: item ? askOf(item) : title,
  }), [item, gradeLevel, currentIndex, items.length, title]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'construction-sequence-planner', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel, enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = () => {
    setWork(emptyWork()); setChecked(null); setWrongShown(false);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
  };

  openItem.current = (index, retry) => {
    if (retry) { setWork(emptyWork()); setChecked(null); setWrongShown(false); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || solved.mode !== 'critical_path' || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork(w => ({ ...w, choice: criticalWeeks(solved) })); setWrongShown(false);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  /** An edit after a scripted miss clears the last build. */
  const edit = (f: (w: CspWork) => CspWork) => { setWork(f); setChecked(null); };

  const tapCard = (id: string) => {
    if (!item || closed) return;
    SoundManager.select();
    if (isOrderMode(item.mode)) { if (!work.order.includes(id)) edit(w => ({ ...w, order: [...w.order, id] })); return; }
    if (item.mode === 'parallel') setWork(w => ({ ...w, selected: w.selected === id ? null : id }));
  };
  const putInWeek = (week: number) => {
    if (!item || closed || item.mode !== 'parallel' || !work.selected) return;
    SoundManager.snap();
    const id = work.selected;
    edit(w => ({ ...w, week: { ...w.week, [id]: week }, selected: null }));
  };
  const takeOut = (id: string) => {
    if (!item || closed) return;
    SoundManager.tick();
    if (isOrderMode(item.mode)) edit(w => ({ ...w, order: w.order.filter(x => x !== id) }));
    else edit(w => { const week = { ...w.week }; delete week[id]; return { ...w, week }; });
  };
  const clearPlan = () => { if (!item || closed) return; SoundManager.tick(); edit(() => emptyWork()); };
  const chooseTotal = (n: number) => { if (!item || closed) return; SoundManager.select(); setWork(w => ({ ...w, choice: n })); };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = cspCorrect(item, work);
    progress.commitCheck(describeCspWork(item, work), correct, correct ? undefined : cspMiss(item, work));
    if (item.mode !== 'critical_path') setChecked({ ...work, selected: null });
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      say(`[ANSWER_CORRECT] The learner's plan works: ${askOf(item)} Praise briefly.`);
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) { setWrongShown(true); return; }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      setScriptedReveal(true);
      const key: CspWork = { ...emptyWork(), order: buildOrder(item), week: item.mode === 'parallel' ? fastestPlan(item) : {},
        choice: item.mode === 'critical_path' ? criticalWeeks(item) : null };
      setWork(key);
      if (item.mode !== 'critical_path') setChecked(key);
      if (!practice) progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] Two tries missed on: ${askOf(item)} A plan that works is now on screen; explain it with the needs.`);
      return;
    }
    if (item.mode === 'critical_path') setWork(w => ({ ...w, choice: null }));
    say(`[ANSWER_INCORRECT] ${describeCspWork(item, work)} for: ${askOf(item)} It is wrong. You are not told the answer: ask what each job needs first, without naming an order.`);
  };

  const metrics = (): ConstructionSequencePlannerMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    const all = items.length > 0 && right.length === items.length;
    const first = items[0];
    return {
      type: 'construction-sequence-planner',
      allPhasesCompleted: all, finalSuccess: all, explorePhaseCompleted: true, practicePhaseCompleted: results.length > 0, applyPhaseCompleted: all,
      firstTaskQuestion: first ? askOf(first) : '', correctFirstTask: first ? (buildOrder(first)[0] ?? '') : '', studentFirstTask: null,
      firstTaskCorrect: false, exploreAttempts: 0,
      practiceTasks: items.length, practiceSequenceCorrect: right.length > 0, dependencyViolations: 0, practiceAttempts: currentAttempts,
      totalTasks: items.length, correctlyOrderedTasks: right.length,
      sequenceAccuracy: items.length ? Math.round((right.length / items.length) * 100) : 0, totalDependencyViolations: 0,
      criticalPathIdentified: right.some(i => i.mode === 'critical_path'), usedDependencyArrows: false,
      parallelTasksIdentified: right.filter(i => i.mode === 'parallel').length, sequentialTasksCorrect: right.filter(i => isOrderMode(i.mode)).length,
      totalAttempts: currentAttempts, tasksRearranged: 0, animationUsed: true, studentSequence: [], correctSequence: [], dependenciesDrawn: [],
      solvedOnFirstTry: results.every(r => r.correct && r.attempts === 1), hintsUsed: 0,
    };
  };

  /** Scripted path: Next, and on the last item the session report. */
  const next = () => {
    if (progress.advance()) { clearItem(); say(`[NEXT_ITEM] Item ${currentIndex + 2} of ${items.length}: ${askOf(items[currentIndex + 1])}`); return; }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((results.filter(r => r.correct).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 50, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} items. Celebrate briefly.`);
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), totalAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || isComplete) return;
    const scene = workspaceScene(item, { work, checked, solved: revealed });
    const levers = practice ? [] : cspLevers(sessionItem, pulled);
    const onScreen = practice ? '' : leverFact(sessionItem, pulled, work);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A simpler item of the same kind, before the full item comes back.' } : {}),
        ...(onScreen ? { onScreen } : {}) },
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = simplerItem(sessionItem);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
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
    label: 'The job cards and your plan',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This planner has no jobs to plan.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── What the cards show ──
  const marks = item && leverOn(CHECK_AS_YOU_GO_LEVER) ? asYouGoMarks(item, work) : { jobs: [], weeks: [] };
  const tags = item && leverOn(SAME_NEEDS_LEVER) ? sameNeedsTags(item) : {};
  const placed = (id: string) => (item && isOrderMode(item.mode) ? work.order.includes(id) : !!work.week[id]);
  const showNeeds = !!item && item.mode !== 'sequence';
  const NeedsLine = ({ job }: { job: Job }) => {
    if (!item || !showNeeds) return null;
    if (!job.needs.length) return <span className="block text-[11px] text-slate-500">Needs nothing first</span>;
    return (
      <span className="block text-[11px] text-slate-400">
        Needs: {job.needs.map((n, i) => (
          <span key={n}>{i > 0 ? ', ' : ''}{nameOf(item, n)}{leverOn(TICK_NEEDS_LEVER) && placed(n) ? ' ✓' : ''}</span>
        ))}
      </span>
    );
  };
  const Card = ({ job }: { job: Job }) => (
    <span className="flex min-w-0 flex-col text-left">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">{job.icon}</span>
        <span className="text-sm font-medium text-slate-100">{job.name}</span>
        {tags[job.id] && <span data-lever="same-needs" className="rounded bg-violet-500/30 px-1.5 text-[11px] font-bold text-violet-100">{tags[job.id]}</span>}
      </span>
      <NeedsLine job={job} />
    </span>
  );

  const choiceState = (n: number): AnswerChoiceState => {
    if (!item || item.mode !== 'critical_path') return 'idle';
    const key = criticalWeeks(item);
    if (revealed) return n === key ? 'correct' : n === work.choice ? 'incorrect' : 'dimmed';
    return work.choice === n ? 'selected' : 'idle';
  };

  const runCard = (): React.ReactNode => {
    if (!item || item.mode === 'critical_path' || !checked) return null;
    const ok = cspCorrect(item, checked);
    const text = runText(item, checked);
    if (scriptedReveal && !solvedNow) return <LuminaFeedbackCard status="insight" label="A plan that works">{text}</LuminaFeedbackCard>;
    return (
      <LuminaFeedbackCard status={ok ? 'correct' : 'incorrect'}>
        {text}{!ok && !tutorOwned ? ' Fix the plan and check again.' : ''}
      </LuminaFeedbackCard>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler item first' : `${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {description && !done && <p className="text-sm text-slate-400">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Planner complete">
            {`${results.filter(r => r.correct).length} of ${items.length} plans worked.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <div className="flex items-start gap-2">
              <LuminaPrompt accent="cyan" className="flex-1" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>
              {!tutorOwned && (
                <ReadMeButton instruction={`${askOf(item)} The job cards: ${item.jobs.map(j => j.name).join(', ')}.`}
                  ask="Look at the job cards, then make your plan."
                  speaking={isAudioPlaying} onAskTutor={m => sendText?.(m)} tag="[READ_CHALLENGE]"
                  className="flex-shrink-0" aria-label="Read the task to me" />
              )}
            </div>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
              {/* Order modes: the cards left to place, and the plan */}
              {isOrderMode(item.mode) && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <LuminaPanel className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Job cards</p>
                    {item.jobs.filter(j => !work.order.includes(j.id)).map(j => (
                      <LuminaButton key={j.id} aria-label={j.name} disabled={closed} onClick={() => tapCard(j.id)}
                        className="flex h-auto w-full justify-start px-3 py-2"><Card job={j} /></LuminaButton>
                    ))}
                    {work.order.length === item.jobs.length && <p className="text-xs text-slate-500">Every card is in the plan.</p>}
                  </LuminaPanel>
                  <LuminaPanel className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Your plan</p>
                      <LuminaButton aria-label="Clear the plan" disabled={closed || !work.order.length} onClick={clearPlan} className="h-7 px-2 text-xs">Clear</LuminaButton>
                    </div>
                    {item.jobs.map((_, k) => {
                      const id = work.order[k];
                      const job = id ? item.jobs.find(j => j.id === id) : undefined;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-6 text-right font-mono text-xs text-slate-500">{k + 1}</span>
                          {job ? (
                            <LuminaButton aria-label={`Take out ${job.name}`} disabled={closed} onClick={() => takeOut(job.id)}
                              className="flex h-auto flex-1 justify-start px-3 py-2"><Card job={job} /></LuminaButton>
                          ) : <span className="flex-1 rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-slate-600">empty</span>}
                          {job && marks.jobs.includes(job.id) && <span data-lever="check-as-you-go" className="text-xs text-rose-300">⚠ {NOT_READY}</span>}
                        </div>
                      );
                    })}
                  </LuminaPanel>
                </div>
              )}

              {/* parallel: pick a card, then a week */}
              {item.mode === 'parallel' && (
                <div className="space-y-3">
                  <LuminaPanel className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Job cards: tap one, then a week</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {item.jobs.filter(j => !work.week[j.id]).map(j => (
                        <LuminaButton key={j.id} aria-label={j.name} aria-pressed={work.selected === j.id} disabled={closed} onClick={() => tapCard(j.id)}
                          className={`flex h-auto justify-start px-3 py-2 ${work.selected === j.id ? 'ring-2 ring-cyan-400' : ''}`}><Card job={j} /></LuminaButton>
                      ))}
                    </div>
                  </LuminaPanel>
                  <LuminaPanel className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider text-slate-400">{`Weeks (goal: ${item.deadline})`}</p>
                      <LuminaButton aria-label="Clear the plan" disabled={closed || !weeksUsed(work)} onClick={clearPlan} className="h-7 px-2 text-xs">Clear</LuminaButton>
                    </div>
                    {Array.from({ length: weekRows(item) }, (_, k) => k + 1).map(wk => (
                      <div key={wk} className="flex flex-wrap items-center gap-2">
                        <LuminaButton aria-label={`Put in week ${wk}`} disabled={closed || !work.selected} onClick={() => putInWeek(wk)}
                          className="h-8 w-24 px-2 text-xs">{`Week ${wk}`}</LuminaButton>
                        {item.jobs.filter(j => work.week[j.id] === wk).map(j => (
                          <LuminaButton key={j.id} aria-label={`Take out ${j.name}`} disabled={closed} onClick={() => takeOut(j.id)}
                            className="h-auto px-2 py-1 text-xs">
                            <span aria-hidden="true">{j.icon}</span> {j.name}{marks.jobs.includes(j.id) ? ' ⚠' : ''}
                            {tags[j.id] && <span data-lever="same-needs" className="ml-1 rounded bg-violet-500/30 px-1 font-bold text-violet-100">{tags[j.id]}</span>}
                          </LuminaButton>
                        ))}
                        {marks.weeks.includes(wk) && <span data-lever="check-as-you-go" className="text-xs text-rose-300">⚠ more jobs than crews</span>}
                      </div>
                    ))}
                    {marks.jobs.length > 0 && <p data-lever="check-as-you-go" className="text-xs text-rose-300">{`⚠ ${NOT_READY}`}</p>}
                  </LuminaPanel>
                </div>
              )}

              {/* critical_path: the cards, then the totals */}
              {item.mode === 'critical_path' && (
                <div className="space-y-3">
                  <LuminaPanel className="space-y-2">
                    {item.jobs.map(j => (
                      <div key={j.id} className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2">
                        <Card job={j} />
                        <span className="flex items-center gap-2 text-xs text-slate-300">
                          {leverOn(WEEK_BLOCKS_LEVER) && (
                            <span data-lever="week-blocks" className="flex gap-0.5">
                              {Array.from({ length: j.weeks }, (_, i) => <span key={i} className="inline-block h-3 w-3 rounded-sm bg-cyan-400/70" />)}
                            </span>
                          )}
                          {`${j.weeks} week${j.weeks === 1 ? '' : 's'}`}
                        </span>
                      </div>
                    ))}
                  </LuminaPanel>
                  {leverOn(TRACE_CHAINS_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="trace-chains" className="space-y-1 text-xs text-slate-300">
                      <p className="uppercase tracking-wider text-slate-400">Chains of needs</p>
                      {chainLines(item).map(l => <p key={l}>{l}</p>)}
                    </LuminaPanel>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(item.options ?? []).map(o => (
                      <LuminaAnswerChoice key={o} aria-label={`${o} weeks`} state={choiceState(o)} disabled={closed}
                        className="p-3 text-center font-semibold" onClick={() => chooseTotal(o)}>
                        {`${o} weeks`}
                      </LuminaAnswerChoice>
                    ))}
                  </div>
                  {revealed && <Timeline item={item} />}
                </div>
              )}

              {checked && item.mode !== 'critical_path' && <BuildRun item={item} plan={checked} step={buildStep} />}
            </div>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  {item.mode === 'critical_path' ? 'Check Answer' : 'Check and build'}
                </LuminaActionButton>
              </div>
            )}

            {runCard()}
            {item.mode === 'critical_path' && revealed && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
                {`The longest chain of needs takes ${criticalWeeks(item)} weeks, so the whole ${item.project} takes ${criticalWeeks(item)} weeks even with crews working at the same time.`}
              </LuminaFeedbackCard>
            )}
            {item.mode === 'critical_path' && !revealed && wrongShown && <LuminaFeedbackCard status="incorrect">That is not it.</LuminaFeedbackCard>}
            {item.mode === 'critical_path' && !revealed && !tutorOwned && scriptedWrongs === 1 && (
              <LuminaFeedbackCard status="incorrect">Not quite. Follow each chain of needs and add its weeks, then try once more.</LuminaFeedbackCard>
            )}

            {!tutorOwned && revealed && !practice && (
              <div className="flex justify-end">
                <LuminaActionButton action="next" onClick={next}>{currentIndex < items.length - 1 ? 'Next →' : 'Finish'}</LuminaActionButton>
              </div>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const ConstructionSequencePlanner = withWorkspaceController<ConstructionSequencePlannerProps, ProgressOptions<CspItem>, Progress>(
  'construction-sequence-planner', ConstructionSequencePlannerSurface, useScriptedProgress, useWorkspaceProgressFor('construction-sequence-planner'));

export default ConstructionSequencePlanner;
