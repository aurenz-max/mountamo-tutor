'use client';

/**
 * OpinionBuilder — opinion writing on the shared tutor/JEV teaching workspace only (OB-7L, following R12: one path),
 * wired from its boss (`opinionBuilder.boss.ts`). Two surfaces, one per payload shape:
 *   - OREO and CER (the writing modes): `WritingStagesSurface` with the `oreo` / `cer` steps. The learner writes the
 *     answer one sentence per step; code checks length, blanks and repeats, and the shared literacy judge checks each
 *     sentence makes sense and does its step's job.
 *   - `build_opinion` (open build, rules in `opinionBuild.ts`): cards for both sides of a question, an answer tray,
 *     "I'm done!", checked in code from the cards' roles and sides. Try again keeps the answer and the verdict words.
 * An unbound mount shows the shared "needs the tutor" card. Pip comes from the runner (`<PipDock />`, `<PipWorkspace>`).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { OpinionBuilderMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import WritingStagesSurface from './WritingStagesSurface';
import {
  FRAME_LEVER, MODEL_LEVER, askFor, boardOrder, describeOpinion, modelOpinionFor, opinionItemsOf, opinionMiss,
  opinionMissWords, opinionScene, opinionWritingPayload, readCardRequest, type OpinionItem,
} from './opinionBuild';
import { OPINION_LEVERS } from './opinionBuilderLevers';
import { opinionBuilderBoss } from './opinionBuilder.boss';

export interface OpinionBuilderData {
  title: string;
  gradeLevel: string;
  framework: 'oreo' | 'cer';
  /** The opinion/argument question. */
  prompt: string;

  /** Starters per step (a help lever shows them; one with a trailing ... is the simplify lever's practice). */
  scaffold: {
    claimLabel: string;
    claimStarters: string[];
    reasonLabel: string;
    reasonStarters: string[];
    reasonCount: number;
    conclusionLabel: string;
    conclusionStarters: string[];
    linkingWords: string[];
    counterArgumentEnabled: boolean;
    counterArgumentStarters?: string[];
  };

  supportTier?: 'easy' | 'medium' | 'hard';
  /** `build_opinion` (open build): the card surface runs the session from `opinions`. */
  task?: 'opinion_build';
  opinions?: OpinionItem[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OpinionBuilderMetrics>) => void;
}

interface OpinionBuilderProps {
  data: OpinionBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

export { opinionWritingPayload };

const PHASES: Record<string, PhaseConfig> = { build_opinion: { label: 'Build an opinion', icon: '🍪', accentColor: 'amber' } };
const useProgress = useWorkspaceProgressFor('opinion-builder');
const assignment = opinionBuilderBoss.assignment!;

/** build_opinion: cards for either side tapped into an OREO answer in order. */
function OpinionBuildSurface({ data, className, runtimePlanItemId }: OpinionBuilderProps) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `opinion-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => opinionItemsOf(data), [data]);

  const [work, setWork] = useState<{ item: string; order: string[] }>({ item: '', order: [] });
  const [checked, setChecked] = useState(false);
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<OpinionItem | null>(null);

  const progress = useProgress<OpinionItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment,
    onItemOpened: (_index, retry) => { setChecked(false); if (retry) return; setVerdict(null); setPractice(null); },
  });
  const { currentIndex, results, isComplete } = progress;
  const allDone = isComplete || !!progress.practiceSummary;
  const sessionItem = items[currentIndex] ?? null;
  const current = practice ?? sessionItem;
  const order = work.item === current?.id ? work.order : [];
  const pulled = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false;
  const board = useMemo(() => (current ? boardOrder(current) : []), [current]);
  const textOf = (id: string) => current?.cards.find(c => c.id === id)?.text ?? '';
  const model = sessionItem && pulled.includes(MODEL_LEVER) ? modelOpinionFor(sessionItem) : null;

  const phaseResults = usePhaseResults({ challenges: items, results, isComplete: allDone, getChallengeType: () => 'build_opinion', phaseConfig: PHASES });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'opinion-builder' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const edit = (next: string[]) => { if (current) { setWork({ item: current.id, order: next }); setChecked(false); } };
  const toggle = (id: string) => { if (!blocked) { SoundManager.tap(); edit(order.includes(id) ? order.filter(x => x !== id) : [...order, id]); } };
  const readCard = (id: string) => progress.requestHear?.(readCardRequest(textOf(id)));

  const check = () => {
    const item = current;
    if (!item || blocked || !order.length) return;
    const miss = opinionMiss(item, order);
    const correct = !miss;
    setVerdict({ met: correct, words: correct ? 'Yes! Every card backs up your opinion, from start to finish.' : opinionMissWords(miss) });
    setChecked(true);
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeOpinion(item, order), correct, miss);
    if (correct && !practice) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    submitResult(solved === total, accuracy, { type: 'opinion-builder', task: 'build_opinion', opinionsBuilt: solved, opinionsTotal: total,
      accuracy, attemptsCount: results.reduce((s, r) => s + r.attempts, 0) } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items.length, results, submitResult, progress.recordsEvaluation]);

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = opinionScene(current, order, checked && verdict ? verdict.words : undefined);
    const levers = practice ? [] : OPINION_LEVERS.declare(sessionItem, null, pulled);
    const published = leverScene(scene, {
      support: practice ? '' : OPINION_LEVERS.support(sessionItem, null),
      onScreen: practice ? '' : OPINION_LEVERS.onScreen(sessionItem, null, pulled),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts,
        ...(practice ? { practice: 'One side\'s cards only, ungraded. The full set comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = OPINION_LEVERS.simpler(sessionItem, null, id) as OpinionItem | null;
          if (!easier) return `No lever ${id} on this item.`;
          setLeverState(next); setVerdict(null); setChecked(false); setPractice(easier);
          return { practice: assignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setVerdict(null); setChecked(false); setPractice(null); },
    };
  });

  if (!items.length) return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">No questions to answer.</LuminaCardContent></LuminaCard>;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="amber" className="text-xs">🍪 Build an opinion</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? progress.teachingResult?.accuracy)}
            durationMs={elapsedMs} heading="Opinions built!" celebrationMessage="You backed up your opinion with a reason and an example." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="amber">
              <div className="text-lg leading-snug">{askFor(current)}</div>
              {practice && (
                <div className="mt-1 flex items-center gap-2 text-xs text-amber-300">
                  <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>
                  Practice with one side
                </div>
              )}
            </LuminaPrompt>

            <PipDock />
            <PipWorkspace className="space-y-3">
              {model && (
                <LuminaPanel data-lever="model-opinion" className="p-3 text-sm text-slate-300">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">{model.question}</p>
                  {model.parts.map(([label, t]) => <p key={t}><span className="text-cyan-300">{label}: </span>{t}</p>)}
                </LuminaPanel>
              )}
              <div role="group" aria-label="Your answer" data-testid="ob-answer" className="min-h-24 space-y-2 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                {pulled.includes(FRAME_LEVER) && (
                  <div data-lever="oreo-frame" className="flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-widest text-amber-300">
                    {['Opinion', 'Reason', 'Example', 'Opinion again'].map(l => <span key={l} className="rounded border border-dashed border-amber-300/40 px-2 py-0.5">{l}</span>)}
                  </div>
                )}
                {order.length === 0 && <p className="text-sm text-slate-500">Tap the cards below, in order, to build your answer.</p>}
                {order.map((id, n) => (
                  <button key={id} type="button" aria-label={`take out ${id}`} disabled={blocked} onClick={() => toggle(id)}
                    className="block w-full rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-left text-base text-amber-50 hover:opacity-80">
                    <span className="mr-2 text-xs text-amber-300">{n + 1}.</span>{textOf(id)}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Opinion cards">
                {board.filter(c => !order.includes(c.id)).map(c => (
                  <div key={c.id} className="relative">
                    <button type="button" aria-label={`card ${c.id}`} disabled={blocked} onClick={() => toggle(c.id)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-3 pr-9 text-left text-base text-slate-100 hover:bg-white/10 disabled:opacity-50">
                      {c.text}
                    </button>
                    <button type="button" aria-label={`read ${c.id}`} onClick={() => readCard(c.id)} className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-1.5 text-sm">🔊</button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <LuminaButton tone="ghost" onClick={() => edit([])} disabled={blocked || !order.length}>Clear</LuminaButton>
                <LuminaButton tone="primary" onClick={check} disabled={blocked || !order.length} className="px-8 text-lg font-bold">I&apos;m done!</LuminaButton>
              </div>
              {verdict && <LuminaFeedbackCard status={verdict.met ? 'correct' : 'incorrect'}><p className="text-base font-semibold">{verdict.words}</p></LuminaFeedbackCard>}
            </PipWorkspace>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

/** One mount, one shape: the open build's cards, or the writing steps (wired from the same boss). */
function OpinionBuilderSurface(props: OpinionBuilderProps) {
  const { data } = props;
  return data.task === 'opinion_build'
    ? <OpinionBuildSurface {...props} />
    : <WritingStagesSurface {...props} primitiveId="opinion-builder" assignment={assignment} levers={OPINION_LEVERS}
        data={{ ...opinionWritingPayload(data), title: data.title, gradeLevel: data.gradeLevel, supportTier: data.supportTier, instanceId: data.instanceId,
          skillId: data.skillId, subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
          onEvaluationSubmit: data.onEvaluationSubmit as never }} />;
}

const OpinionBuilder = withWorkspaceOnly<OpinionBuilderProps>('opinion-builder', OpinionBuilderSurface, props => props.data.title);

export default OpinionBuilder;
