'use client';

/**
 * DeepDive — an orchestrated scroll lesson of modular blocks, taught only on the shared tutor/JEV workspace
 * (`withWorkspaceOnly`; its wiring is `deepDive.card.ts` + `deepDive.boss.ts`). The graded blocks are the items, one at
 * a time: the sections up to the current check are on screen, the runtime opens the next check after a committed
 * right answer, and Try again comes from the shell. A block never shows a check's answer on its own (`onAttempt`).
 * The learner may type a question at any time: new sections answering it appear below the lesson as practice, never
 * scored (`generateDeepDiveFollowUp`).
 */
import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaBadge, LuminaButton, LuminaInput, LuminaMathText } from '../../../../ui';
import { spokenMath, spokenMathDeep } from '../../../../utils/mathText';
import type { DeepDiveFollowUpResult } from '../../../../service/core/gemini-deep-dive';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../../evaluation';
import type { DeepDiveMetrics } from '../../../../evaluation/types';
import { usePhaseResults, practiceScore, type PhaseConfig } from '../../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../../components/PhaseSummaryPanel';
import { computeBlockSizeHints, type SizeHint } from '../../../../utils/editorial-layout';
import { isPreReaderGrade } from '../../../../utils/kindergartenMode';
import { PipDock, PipWorkspace } from '../../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../../components/live-activity/runtime/useWorkspaceProgress';
import { deepDiveBoss } from './deepDive.boss';
import { deepDiveItems, isEvaluableBlock, workspaceScene, choiceOf, deepDiveMiss, type DeepDiveView } from './deepDiveWorkspace';

import type {
  DeepDiveData, DeepDiveBlock, WrapperLayout, DiagramBlockData, MiniSimBlockData, PerspectivesBlockData,
} from './types';
import {
  HeroImageBlock, KeyFactsBlock, DataTableBlock, MultipleChoiceBlock, PullQuoteBlock, ProseBlock, TimelineBlock,
  FillInBlankBlock, CompareContrastBlock, DiagramBlock, MiniSimBlock, PerspectivesBlock, HypothesisLabBlock, DrawerBlock, GenDisplayBlock, InsetBlock, WorkedExampleBlock, ProcessBlock, MisconceptionBlock,
} from './blocks';

// ── Phase config for evaluable blocks ───────────────────────────────
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'multiple-choice': { label: 'Knowledge Check', icon: '❓', accentColor: 'blue' },
  'fill-in-blank': { label: 'Vocabulary', icon: '✏️', accentColor: 'purple' },
  'diagram': { label: 'Diagram Analysis', icon: '🗺️', accentColor: 'cyan' },
  'mini-sim': { label: 'Prediction', icon: '🧪', accentColor: 'cyan' },
  'perspectives': { label: 'Perspective Analysis', icon: '👁️', accentColor: 'pink' },
  'hypothesis-lab': { label: 'Experimental Design', icon: '🧪', accentColor: 'emerald' },
  'compare-contrast': { label: 'Sorting', icon: '⚖️', accentColor: 'blue' },
  'timeline': { label: 'Sequencing', icon: '📜', accentColor: 'pink' },
  'data-table': { label: 'Data Analysis', icon: '📊', accentColor: 'emerald' },
};

// ── Student follow-up questions ─────────────────────────────────────
interface FollowUp {
  id: string;
  question: string;
  status: 'loading' | 'waiting' | 'ready' | 'redirect' | 'error';
  reply?: string;
  /** A held question: the open check whose answer it would give away; it runs once that check is answered. */
  waitFor?: string;
  /** Opened from a See also link (the label is shown) rather than typed. */
  link?: string;
  blocks: DeepDiveBlock[];
}
/** Each question costs a planner call and up to three block calls (a diagram is an image). */
const MAX_FOLLOW_UPS = 6;

/** The question text of a graded block, which a follow-up must not answer. */
function checkText(block: DeepDiveBlock): string {
  const choice = choiceOf(block);
  if (choice) return choice.question;
  const b = block as unknown as Record<string, unknown>;
  return String(b.scenario ?? b.caption ?? b.label ?? '');
}

/**
 * What the tutor is asked when the learner taps a card to hear more. The blocks' own messages were written for the
 * scripted tutor and end by asking the learner a question; on the workspace the checks are the only questions.
 */
const hearAbout = (message: string) => `${spokenMath(message)}\n(On this lesson: answer in two or three short sentences and ask no `
  + 'question of your own; the checks on screen are the only questions.)';

// ── Transition cue component ─────────────────────────────────────────
const TransitionCue: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-3 px-2 py-1">
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <p className="text-xs text-slate-500 italic font-light max-w-md text-center leading-relaxed"><LuminaMathText text={text} /></p>
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

// ── Progress segments ─────────────────────────────────────────────────
const ProgressBar: React.FC<{ blocks: DeepDiveBlock[]; answeredIds: Set<string> }> = ({ blocks, answeredIds }) => (
  <div className="flex gap-1">
    {blocks.map((block) => {
      const evaluable = isEvaluableBlock(block);
      const color = evaluable && answeredIds.has(block.id) ? 'bg-emerald-400/70' : evaluable ? 'bg-amber-400/30' : 'bg-white/15';
      return <div key={block.id} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${color}`} />;
    })}
  </div>
);

const LAYOUT_LABELS: Record<WrapperLayout, string> = {
  stack: 'Deep Dive',
  grid_2col: 'Deep Dive • Grid',
  reveal_progressive: 'Deep Dive • Guided',
  masonry: 'Deep Dive • Mosaic',
};

function gridSpanClass(sizeHint: SizeHint): string {
  return sizeHint === 'full' || sizeHint === 'wide' ? 'col-span-2' : 'col-span-1';
}

interface DeepDiveProps {
  data: DeepDiveData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const useDeepDiveProgress = useWorkspaceProgressFor('deep-dive');

const DeepDiveSurface: React.FC<DeepDiveProps> = ({ data, className, runtimePlanItemId }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title, subtitle, topic, blocks, narrativeArc, layout: wrapperLayout = 'stack',
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;
  const stableInstanceIdRef = useRef(instanceId || `deep-dive-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Pre-reader (K) band: questions are read aloud and picture-primary, adult chrome is hidden, and there is no typed
  // Ask box. data.gradeLevel is the generator's audience prose ("grade K student").
  const preReader = isPreReaderGrade(data.gradeLevel);

  // ── Progress: the runtime moves the index ─────────────────────
  const items = useMemo(() => deepDiveItems(data), [data]);
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const progress = useDeepDiveProgress({
    challenges: items,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: deepDiveBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
    onSolved: index => solvedAloud.current(index),
  });
  const current = items[progress.currentIndex] ?? null;
  const allComplete = progress.isComplete;
  const solvedIds = useMemo(() => new Set(progress.results.filter(r => r.correct).map(r => r.challengeId)), [progress.results]);
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;
  const hear = useCallback((message: string) => progress.requestHear?.(hearAbout(message)), [progress]);

  /** The learner's last checked work on the current item, for the scene. */
  const [work, setWork] = useState('');
  /** Try again count on the current item: a diagram is remounted for a fresh try. */
  const [tries, setTries] = useState(0);
  /** Checks credited from the learner's words: the block remounts showing its answer. */
  const [aloud, setAloud] = useState<Set<string>>(() => new Set());
  const tapped = useRef(new Set<string>());

  openItem.current = (_index, retry) => {
    setWork('');
    if (retry) setTries(t => t + 1); else setTries(0);
  };
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tapped.current.has(solved.id)) return;
    setAloud(prev => new Set(prev).add(solved.id));
  };

  /** The checked attempt on the current block: counts it, and records a right answer. */
  const handleAttempt = useCallback((blockId: string, correct: boolean, described: string) => {
    const item = items.find(i => i.id === blockId);
    if (!item || item.id !== current?.id) return;
    if (correct) tapped.current.add(blockId);
    setWork(described);
    commitCheck.current(described, correct, correct ? undefined : deepDiveMiss(item));
  }, [items, current]);

  // ── Evaluation (under a lesson's evaluation provider only) ────
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<DeepDiveMetrics>({
    primitiveType: 'deep-dive', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });
  finish.current = (result) => {
    if (hasSubmitted) return;
    const totalAttempts = progress.results.reduce((sum, r) => sum + r.attempts, 0);
    submitResult(result.passed, result.accuracy, {
      type: 'deep-dive', totalBlocks: blocks.length, evaluableBlocks: items.length,
      correctAnswers: progress.results.filter(r => r.correct).length, totalAttempts,
      blockBreakdown: progress.results.map(r => ({ blockId: r.challengeId, correct: r.correct, attempts: r.attempts })),
    }, { challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
    undefined, result.diagnosisEvidence);
  };

  const phaseResults = usePhaseResults({
    challenges: items, results: progress.results, isComplete: allComplete,
    getChallengeType: (c) => c.kind, phaseConfig: PHASE_TYPE_CONFIG,
  });
  const showSummary = allComplete && phaseResults.length > 0;
  const summaryScore = practiceScore(progress.practiceSummary) ?? submittedResult?.score
    ?? (items.length ? Math.round((solvedIds.size / items.length) * 100) : 0);

  // ── What is on screen: the sections up to the current check, then every section once all are done ──
  const cut = allComplete || !current ? blocks.length : blocks.findIndex(b => b.id === current.id) + 1;
  const visible = useMemo(() => blocks.slice(0, Math.max(cut, 1)), [blocks, cut]);

  // ── Student questions: each one grows the dive with new blocks ─
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [question, setQuestion] = useState('');
  const asking = followUps.some((f) => f.status === 'loading');
  const askedCount = useRef(0);
  // Read by the request, which also runs from an effect after a held question's check is answered.
  const askState = useRef({ followUps, solvedIds });
  askState.current = { followUps, solvedIds };

  const runFollowUp = useCallback(async (id: string, text: string) => {
    const { followUps: asked, solvedIds: solved } = askState.current;
    // A check is open until it is answered right; the follow-up must not give its answer away.
    const open = items.filter((c) => !solved.has(c.id));
    const update = (patch: Partial<FollowUp>) => setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    try {
      const res = await fetch('/api/lumina', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deepDiveFollowUp', params: {
          question: text, topic, gradeLevel: data.gradeLevel || 'Elementary', title, narrativeArc: narrativeArc || undefined,
          sectionLabels: [...blocks, ...asked.flatMap((f) => f.blocks)].map((b) => b.label).filter(Boolean),
          openChecks: open.map((c) => checkText(c.block)),
          priorQuestions: asked.filter((f) => f.id !== id).map((f) => f.question),
        } }),
      });
      if (!res.ok) throw new Error(`Follow-up failed: ${res.status}`);
      const result = await res.json() as DeepDiveFollowUpResult;
      if (result.kind === 'blocks') {
        const fresh = result.blocks.map((b, i) => ({ ...b, id: `${id}-${i}` }) as DeepDiveBlock);
        const via = asked.find((f) => f.id === id)?.link ? 'opened the See also link' : 'typed the question';
        // The planner's reply is not shown or said: it can state the answer a new self-check then asks (probe
        // 2026-11-04, 1 of 3). The sections teach it; the tutor only points to them.
        update({ status: 'ready', reply: undefined, waitFor: undefined, blocks: fresh });
        progress.requestHear?.(`The learner ${via} "${text}", and new sections answering it are now below the lesson: `
          + `${fresh.map((b) => b.label).join(', ')}. In one sentence, point them to the first one. Do not answer the question `
          + 'yourself, and ask no question of your own.');
      } else if (result.reason === 'answers_open_check' && open[result.check]) {
        // Held, not refused: the question is answered as soon as the learner has tried that check.
        update({ status: 'waiting', reply: result.reply, waitFor: open[result.check].id });
      } else {
        update({ status: 'redirect', reply: result.reply });
      }
    } catch (error) {
      console.error('[DeepDive] follow-up failed:', error);
      update({ status: 'error' });
    }
  }, [items, topic, data.gradeLevel, title, narrativeArc, blocks, progress]);

  const canAsk = !asking && followUps.length < MAX_FOLLOW_UPS;
  const startFollowUp = useCallback((text: string, link?: string) => {
    if (!text || !canAsk) return;
    const id = `ask${++askedCount.current}`;
    const entry: FollowUp = { id, question: text, status: 'loading', blocks: [], link };
    // The request reads the list from askState, so it must see this entry before it runs.
    askState.current = { ...askState.current, followUps: [...askState.current.followUps, entry] };
    setFollowUps((prev) => [...prev, entry]);
    void runFollowUp(id, text);
  }, [canAsk, runFollowUp]);
  const ask = useCallback(() => {
    const text = question.trim();
    if (!text || !canAsk) return;
    setQuestion('');
    startFollowUp(text);
  }, [question, canAsk, startFollowUp]);
  const seeAlso = preReader ? [] : data.seeAlso ?? [];
  const opened = new Set(followUps.map((f) => f.link).filter(Boolean));

  // A held question runs once the check it waited on has been answered right.
  useEffect(() => {
    const ready = followUps.filter((f) => f.status === 'waiting' && f.waitFor && solvedIds.has(f.waitFor));
    if (!ready.length) return;
    setFollowUps((prev) => prev.map((f) => (ready.some((r) => r.id === f.id) ? { ...f, status: 'loading', reply: undefined } : f)));
    for (const f of ready) void runFollowUp(f.id, f.question);
  }, [followUps, solvedIds, runFollowUp]);

  // A follow-up's self-check is practice: answered here, never recorded.
  const [practiceDone, setPracticeDone] = useState<Set<string>>(() => new Set());
  const handlePracticeAnswer = useCallback((blockId: string) => setPracticeDone((prev) => new Set(prev).add(blockId)), []);

  // ── What the tutor and the observer are shown, republished every render ─
  useLayoutEffect(() => {
    if (!current) return;
    const view: DeepDiveView = {
      work,
      preReader,
      sections: visible.slice(0, -1).map(b => b.label).filter(Boolean),
      asked: followUps.map(f => ({ question: f.question, status: f.status, sections: f.blocks.map(b => b.label) })),
    };
    // The tutor speaks what it is shown, so math reaches it as words ("x squared"), never as LaTeX.
    workspace.current = spokenMathDeep(workspaceScene(data, current, view));
  });

  // ── Pretext size hints (for grid_2col and masonry) ────────────
  const [containerWidth, setContainerWidth] = useState(700);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sizeHints = useMemo(() => {
    if (wrapperLayout !== 'grid_2col' && wrapperLayout !== 'masonry') return [];
    return computeBlockSizeHints(visible as Parameters<typeof computeBlockSizeHints>[0], containerWidth);
  }, [visible, containerWidth, wrapperLayout]);

  // ── Render a single block ─────────────────────────────────────
  // A lesson check is live only while it is the current item; a solved one shows its answer; a follow-up's check is
  // practice. Display blocks forward a tap to the tutor (`hear`); a graded block does not (its help message names
  // the key), and the learner asks the tutor aloud instead.
  const renderBlock = (block: DeepDiveBlock, idx: number, followUp = false) => {
    const graded = !followUp && isEvaluableBlock(block);
    const isCurrent = graded && block.id === current?.id && !allComplete;
    const answered = followUp ? practiceDone.has(block.id) : graded && (solvedIds.has(block.id) || aloud.has(block.id));
    const onAnswer = followUp ? handlePracticeAnswer
      : block.blockType === 'diagram' ? (id: string, correct: boolean) => handleAttempt(id, correct, `Checked the diagram's labels: ${correct ? 'most are' : 'not enough are'} on the right parts`)
        : () => {};
    const onAttempt = isCurrent ? (correct: boolean, described: string) => handleAttempt(block.id, correct, described) : undefined;
    const onAskTutor = graded ? undefined : hear;
    switch (block.blockType) {
      case 'hero-image':
        return <HeroImageBlock data={block} index={idx} />;
      case 'key-facts':
        return <KeyFactsBlock data={block} index={idx} onAskTutor={onAskTutor} preReader={preReader} />;
      case 'data-table':
        return <DataTableBlock data={block} index={idx} onAnswer={block.patternCheck ? onAnswer : undefined} onAttempt={onAttempt}
          answered={answered} onAskTutor={onAskTutor} />;
      case 'pull-quote':
        return <PullQuoteBlock data={block} index={idx} onAskTutor={onAskTutor} preReader={preReader} />;
      case 'prose':
        return <ProseBlock data={block} index={idx} onAskTutor={onAskTutor} preReader={preReader} />;
      case 'multiple-choice':
        return <MultipleChoiceBlock data={block} index={idx} onAnswer={onAnswer} onAttempt={onAttempt} answered={answered}
          onAskTutor={onAskTutor} preReader={preReader} />;
      case 'timeline':
        return <TimelineBlock data={block} index={idx} onAnswer={block.interactionMode === 'order' ? onAnswer : undefined}
          onAttempt={onAttempt} answered={answered} onAskTutor={onAskTutor} />;
      case 'fill-in-blank':
        return <FillInBlankBlock data={block} index={idx} onAnswer={onAnswer} onAttempt={onAttempt} answered={answered} onAskTutor={onAskTutor} />;
      case 'compare-contrast':
        return <CompareContrastBlock data={block} index={idx} onAnswer={block.interactionMode === 'sort' ? onAnswer : undefined}
          onAttempt={onAttempt} answered={answered} onAskTutor={onAskTutor} />;
      case 'diagram': {
        const diagramBlock = block as DiagramBlockData;
        return diagramBlock.interactionMode === 'label'
          ? <DiagramBlock data={diagramBlock} index={idx} onAnswer={onAnswer} answered={answered} onAskTutor={onAskTutor} preReader={preReader} />
          : <DiagramBlock data={diagramBlock} index={idx} onAskTutor={onAskTutor} preReader={preReader} />;
      }
      case 'mini-sim': {
        const simBlock = block as MiniSimBlockData;
        return simBlock.prediction
          ? <MiniSimBlock data={simBlock} index={idx} onAnswer={onAnswer} onAttempt={onAttempt} answered={answered} onAskTutor={onAskTutor} preReader={preReader} />
          : <MiniSimBlock data={simBlock} index={idx} preReader={preReader} />;
      }
      case 'perspectives': {
        const perspectivesBlock = block as PerspectivesBlockData;
        return perspectivesBlock.comprehension
          ? <PerspectivesBlock data={perspectivesBlock} index={idx} onAnswer={onAnswer} onAttempt={onAttempt} answered={answered} onAskTutor={onAskTutor} />
          : <PerspectivesBlock data={perspectivesBlock} index={idx} />;
      }
      case 'hypothesis-lab':
        return <HypothesisLabBlock data={block} index={idx} onAnswer={onAnswer} onAttempt={onAttempt} answered={answered} onAskTutor={onAskTutor} />;
      case 'drawer':
        return <DrawerBlock data={block} />;
      case 'display':
        return <GenDisplayBlock data={block} />;
      case 'process':
        return <ProcessBlock data={block} index={idx} onAskTutor={onAskTutor} />;
      case 'misconception':
        return <MisconceptionBlock data={block} index={idx} onAskTutor={onAskTutor} />;
      case 'worked-example':
        return <WorkedExampleBlock data={block} index={idx} onAnswer={block.tryStep ? onAnswer : undefined} onAttempt={onAttempt}
          answered={answered} onAskTutor={onAskTutor} />;
      case 'chart': case 'number-line': case 'definition': case 'passage':
        return <InsetBlock data={block} index={idx} onAskTutor={onAskTutor} />;
      default:
        return (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-sm">
            Block type &quot;{block.blockType}&quot; coming soon
          </div>
        );
    }
  };

  /** A lesson block in its frame: the current check closes while the shell holds a checked answer. */
  const lessonBlock = (block: DeepDiveBlock, idx: number) => {
    const isCurrent = block.id === current?.id && !allComplete;
    // Remounted for a spoken credit (it then shows its answer) and, for a diagram, on each Try again.
    const key = `${block.id}${aloud.has(block.id) ? ':aloud' : ''}${isCurrent && block.blockType === 'diagram' ? `:${tries}` : ''}`;
    if (!isCurrent) return <React.Fragment key={key}>{renderBlock(block, idx)}</React.Fragment>;
    const closed = progress.canAttempt === false;
    return (
      <fieldset key={key} disabled={closed} data-deep-dive-check={block.id}
        className={`m-0 min-w-0 border-0 p-0 ${closed ? 'pointer-events-none' : ''}`}>
        {renderBlock(block, idx)}
      </fieldset>
    );
  };

  // ── Layouts (the current check's position cuts the lesson; reveal_progressive reads as the stack) ──
  type Placed = { block: DeepDiveBlock; idx: number };
  const renderBlocks = (list: Placed[]) => {
    if (wrapperLayout === 'grid_2col') {
      return (
        <div className="grid grid-cols-2 gap-4">
          {list.map(({ block, idx }) => (
            <div key={block.id} className={gridSpanClass(sizeHints[idx] || 'standard')}>{lessonBlock(block, idx)}</div>
          ))}
        </div>
      );
    }
    if (wrapperLayout === 'masonry') {
      const full = list.map(({ block, idx }) => ({ block, idx, hint: sizeHints[idx] || 'standard' }));
      return (
        <div className="space-y-5">
          {full.filter(b => b.hint === 'full').map(({ block, idx }) => lessonBlock(block, idx))}
          <div className="columns-1 sm:columns-2 gap-4" style={{ columnFill: 'balance' }}>
            {full.filter(b => b.hint !== 'full').map(({ block, idx, hint }) => (
              <div key={block.id} className="break-inside-avoid mb-4" style={hint === 'wide' ? { columnSpan: 'all' } : undefined}>
                {lessonBlock(block, idx)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {list.map(({ block, idx }, k) => (
          <React.Fragment key={block.id}>
            {lessonBlock(block, idx)}
            {block.transitionCue && k < list.length - 1 && <TransitionCue text={block.transitionCue} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // A sectioned lesson (agentic author) shows each section's heading over its blocks, like an article.
  const sections = data.sections ?? [];
  const groups = useMemo(() => {
    const placed = visible.map((block, idx) => ({ block, idx }));
    if (!sections.length) return [{ section: -1, list: placed }];
    const out: Array<{ section: number; list: Placed[] }> = [];
    for (const p of placed) {
      const section = p.block.section ?? -1;
      const last = out[out.length - 1];
      if (last && last.section === section) last.list.push(p);
      else out.push({ section, list: [p] });
    }
    return out;
  }, [visible, sections.length]);
  const reached = new Set(groups.map(g => g.section));

  const renderLayout = () => (
    <div className="space-y-8">
      {groups.map(({ section, list }) => (
        <section key={`${section}-${list[0].block.id}`} id={section >= 0 ? `deep-dive-section-${section}` : undefined} className="space-y-5">
          {sections[section] && (
            <h2 className="border-b border-white/10 pb-2 text-lg font-light tracking-tight text-white"><LuminaMathText text={sections[section].heading} /></h2>
          )}
          {renderBlocks(list)}
        </section>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} className={`space-y-5 ${className || ''}`}>
      <LuminaCard className="overflow-hidden">
        <LuminaCardHeader className="pb-4">
          {/* Section/question counts are adult chrome — hidden for pre-readers */}
          {!preReader && (
            <div className="flex items-center gap-2 mb-3">
              <LuminaBadge accent="indigo" className="text-xs">{LAYOUT_LABELS[wrapperLayout] || 'Deep Dive'}</LuminaBadge>
              <span className="text-slate-600 text-xs">{blocks.length} sections</span>
              <span className="text-slate-700">&middot;</span>
              <span className="text-amber-400/70 text-xs">{items.length} {items.length === 1 ? 'question' : 'questions'}</span>
            </div>
          )}
          <LuminaCardTitle className="text-2xl font-light text-white tracking-tight"><LuminaMathText text={title} /></LuminaCardTitle>
          {subtitle && <p className="text-slate-400 text-sm mt-1 font-light"><LuminaMathText text={subtitle} /></p>}
          <div className="mt-4"><ProgressBar blocks={blocks} answeredIds={solvedIds} /></div>
          {/* Contents: the sections reached so far link to their heading; the rest open as the checks are answered */}
          {sections.length > 0 && !preReader && (
            <ol className="mt-4 space-y-1 text-sm" aria-label="Contents">
              {sections.map((sec, i) => (
                <li key={sec.heading} className="flex gap-2">
                  <span className="text-slate-600">{i + 1}.</span>
                  {reached.has(i)
                    ? <a href={`#deep-dive-section-${i}`} className="text-cyan-300/90 hover:text-cyan-200"><LuminaMathText text={sec.heading} /></a>
                    : <span className="text-slate-500"><LuminaMathText text={sec.heading} /></span>}
                </li>
              ))}
            </ol>
          )}
        </LuminaCardHeader>
      </LuminaCard>

      {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock, then the lesson as its region. */}
      <PipDock />
      <PipWorkspace className="space-y-5">
        {renderLayout()}
      </PipWorkspace>

      {showSummary && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={summaryScore}
          durationMs={elapsedMs}
          heading="Deep Dive Complete!"
          celebrationMessage={`You explored ${blocks.length} blocks and answered ${items.length} questions.`}
          className="mb-6"
        />
      )}

      {/* See also: related questions, offered once the lesson is done; each opens sections below like a typed question */}
      {allComplete && seeAlso.length > 0 && (
        <LuminaCard className="p-4" data-deep-dive-see-also>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">See also</p>
          <div className="flex flex-wrap gap-2">
            {seeAlso.map((l) => (
              <LuminaButton key={l.label} tone="ghost" disabled={!canAsk || opened.has(l.label)}
                onClick={() => startFollowUp(l.question, l.label)}>
                <LuminaMathText text={l.label} />
              </LuminaButton>
            ))}
          </div>
        </LuminaCard>
      )}

      {/* Sections the learner asked for, each under its question: practice, never scored */}
      {followUps.map((f) => (
        <section key={f.id} data-deep-dive-follow-up={f.id} className="space-y-4">
          <div className="flex items-start gap-2 px-1">
            <LuminaBadge accent="cyan" className="text-xs shrink-0">{f.link ? 'See also' : 'You asked'}</LuminaBadge>
            <p className="text-slate-200 text-sm"><LuminaMathText text={f.link ?? f.question} /></p>
          </div>
          {f.status === 'loading' && <p className="px-1 text-xs text-slate-500 italic">Making new sections for your question...</p>}
          {f.status === 'error' && <p className="px-1 text-xs text-rose-300/80">That question didn&apos;t go through. Try asking it again.</p>}
          {f.reply && <p className="px-1 text-sm text-slate-400">{f.reply}</p>}
          {f.status === 'waiting' && (
            <p className="px-1 text-xs text-amber-300/80">Saved. This one gets answered as soon as you try that question.</p>
          )}
          {f.blocks.map((block, i) => (
            <React.Fragment key={block.id}>{renderBlock(block, blocks.length + i, true)}</React.Fragment>
          ))}
        </section>
      ))}

      {/* Ask bar: typed questions. A pre-reader asks the tutor aloud instead. */}
      {!preReader && (
        <LuminaCard className="p-4">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <LuminaInput
              aria-label="Ask a question about this topic"
              className="flex-1"
              value={question}
              maxLength={400}
              disabled={!canAsk}
              placeholder={followUps.length >= MAX_FOLLOW_UPS ? 'Ask your tutor for more' : 'Wondering about something? Ask here'}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <LuminaButton type="submit" disabled={!question.trim() || !canAsk}>
              {asking ? 'Thinking...' : 'Ask'}
            </LuminaButton>
          </form>
        </LuminaCard>
      )}
    </div>
  );
};

const DeepDive = withWorkspaceOnly<DeepDiveProps>('deep-dive', DeepDiveSurface, props => props.data.title);

export default DeepDive;
