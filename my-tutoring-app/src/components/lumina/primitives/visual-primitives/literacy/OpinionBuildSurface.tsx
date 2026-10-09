'use client';

/**
 * opinion-builder `build_opinion` surface (rules in `opinionBuild.ts`). Cards for both sides of a question, an answer
 * tray, "I'm done!". Checked in code from the cards' roles and sides. Try again keeps the answer and the verdict words.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import {
  FRAME_LEVER, MODEL_LEVER, MODEL_OPINION, askFor, boardOrder, describeOpinion, oneSideFor, opinionAssignment,
  opinionLeverFacts, opinionLevers, opinionMiss, opinionMissWords, opinionScene, opinionsFrom, readCardRequest,
  type OpinionBuildData, type OpinionItem,
} from './opinionBuild';

const PHASES: Record<string, PhaseConfig> = { build_opinion: { label: 'Build an opinion', icon: '🍪', accentColor: 'amber' } };
const useProgress = useWorkspaceProgressFor('opinion-builder');

export interface OpinionBuildSurfaceProps {
  data: OpinionBuildData & { instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
    onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void };
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

export default function OpinionBuildSurface({ data, className, runtimePlanItemId }: OpinionBuildSurfaceProps) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `opinion-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => opinionsFrom(data.opinions ?? []), [data.opinions]);

  const [work, setWork] = useState<{ item: string; order: string[] }>({ item: '', order: [] });
  const [checked, setChecked] = useState(false);
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<OpinionItem | null>(null);

  const progress = useProgress<OpinionItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: opinionAssignment,
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

  const phaseResults = usePhaseResults({ challenges: items, results, isComplete: allDone, getChallengeType: () => 'build_opinion', phaseConfig: PHASES });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'opinion-builder' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const edit = (next: string[]) => { if (current) { setWork({ item: current.id, order: next }); setChecked(false); } };
  const toggle = (id: string) => { if (!blocked) { SoundManager.tap(); edit(order.includes(id) ? order.filter(x => x !== id) : [...order, id]); } };
  const readCard = (id: string) => ctx.sendText(readCardRequest(textOf(id)), { silent: true, author: 'host' });

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

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId, scopeId: allDone || hasSubmitted || !current ? null : current.id, label: 'The opinion cards',
    solved: checked && !!verdict?.met, checking: false, handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = opinionScene(current, order, checked && verdict ? verdict.words : undefined);
    const levers = practice ? [] : opinionLevers(sessionItem, pulled);
    const onScreen = practice ? undefined : opinionLeverFacts(pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'One side\'s cards only, ungraded. The full set comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = oneSideFor(sessionItem);
          if (!easier) return 'There is no smaller set for this item.';
          setLeverState(next); setVerdict(null); setChecked(false); setPractice(easier);
          return { practice: opinionAssignment(easier) };
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
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Opinions built!" celebrationMessage="You backed up your opinion with a reason and an example." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="amber">
              <div className="text-lg leading-snug">{askFor(current)}</div>
              {practice && <div className="text-xs text-amber-300">Practice with one side</div>}
            </LuminaPrompt>
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {pulled.includes(MODEL_LEVER) && (
                <LuminaPanel data-lever="model-opinion" className="p-3 text-sm text-slate-300">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">{MODEL_OPINION.question}</p>
                  {MODEL_OPINION.parts.map(([label, t]) => <p key={t}><span className="text-cyan-300">{label}: </span>{t}</p>)}
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
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
