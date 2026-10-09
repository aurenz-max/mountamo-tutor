'use client';

/**
 * sentence-builder tile modes on the teaching workspace (rules in `sentenceOrder.ts`). Given tiles, a sentence row,
 * "I'm done!". A listed order passes in code; an unlisted well-formed order goes to the shared sentence judge. Try
 * again keeps the row; a new item opens an empty row.
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
import type { WordBuildVerdict } from '../../../service/build-layer/wordBuildDecision';
import {
  MODEL_LEVER, ORDER_ASK, ROLES_LEVER, ROLE_LABEL, modelFor, orderAssignment, orderJudgeRequest, orderLevers, orderMissWords,
  bankOrder, orderScene, orderText, orderVerdict, ordersFrom, shorterFor, type OrderItem, type OrderMiss,
} from './sentenceOrder';

const PHASES: Record<string, PhaseConfig> = { order: { label: 'Build the sentence', icon: '🧩', accentColor: 'blue' } };
const useProgress = useWorkspaceProgressFor('sentence-builder');

async function askJudge(body: ReturnType<typeof orderJudgeRequest>): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }) });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

export interface SentenceOrderData {
  title: string;
  sentenceType: string;
  gradeLevel?: string;
  challenges: OrderItem[];
  instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void;
}
type Phase = 'building' | 'checking' | 'checked';

export default function SentenceOrderSurface({ data, className, runtimePlanItemId }: { data: SentenceOrderData; className?: string;
    runtimePlanItemId?: string; runtimeEvalMode?: string }) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `sentence-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => ordersFrom(data.challenges ?? []), [data.challenges]);

  const [work, setWork] = useState<{ item: string; ids: string[] }>({ item: '', ids: [] });
  const [phase, setPhase] = useState<Phase>('building');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<OrderItem | null>(null);
  const openCount = useRef(0);

  const progress = useProgress<OrderItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: orderAssignment,
    onItemOpened: (_index, retry) => {
      openCount.current += 1;
      setPhase('building'); setNotice('');
      if (retry) return;
      setVerdict(null); setPractice(null);
    },
  });
  const { currentIndex, results, isComplete } = progress;
  const allDone = isComplete || !!progress.practiceSummary;
  const sessionItem = items[currentIndex] ?? null;
  const current = practice ?? sessionItem;
  const ids = work.item === current?.id ? work.ids : [];
  const pulled = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';
  // The bank keeps a stable mixed order per item, never a listed answer order.
  const bank = useMemo(() => (current ? bankOrder(current) : []), [current]);

  const phaseResults = usePhaseResults({ challenges: items, results, isComplete: allDone, getChallengeType: () => 'order', phaseConfig: PHASES });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'sentence-builder' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const edit = (next: string[]) => {
    if (!current) return;
    setWork({ item: current.id, ids: next });
    if (phase === 'checked') setPhase('building');
    setNotice('');
  };
  const toggle = (id: string) => { if (!blocked) { SoundManager.tap(); edit(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]); } };

  const settle = (item: OrderItem, correct: boolean, miss: OrderMiss | undefined, words: string, row: string[]) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(`Built: "${orderText(item, row)}"`, correct, correct ? undefined : miss);
    if (correct && !practice) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  const check = async () => {
    const item = current;
    if (!item || blocked || !ids.length) return;
    const row = ids;
    const v = orderVerdict(item, row);
    if (v === undefined) { settle(item, true, undefined, `Yes! "${orderText(item, row)}"`, row); return; }
    if (v !== 'judge') { settle(item, false, v, orderMissWords(v), row); return; }
    const opened = openCount.current;
    setPhase('checking');
    let reading: WordBuildVerdict;
    try { reading = await askJudge(orderJudgeRequest(item, row, data.gradeLevel)); }
    catch {
      if (opened !== openCount.current) return;
      setPhase('building'); setNotice('The sentence checker could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    settle(item, reading.met, reading.met ? undefined : 'not_sense', reading.met ? `Yes! "${orderText(item, row)}"` : orderMissWords('not_sense'), row);
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    submitResult(solved === total, accuracy, { type: 'sentence-builder', sentenceType: data.sentenceType, sentencesBuilt: solved,
      sentencesTotal: total, accuracy, attemptsCount: results.reduce((s, r) => s + r.attempts, 0) } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items.length, results, submitResult, progress.recordsEvaluation, data.sentenceType]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId, scopeId: allDone || hasSubmitted || !current ? null : current.id, label: 'The sentence tiles',
    solved: phase === 'checked' && !!verdict?.met, checking: phase === 'checking', handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = orderScene(current, ids, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = practice ? [] : orderLevers(sessionItem, pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts,
        ...(pulled.includes(ROLES_LEVER) ? { onScreen: 'Every tile is labelled with its job.' } : {}),
        ...(pulled.includes(MODEL_LEVER) ? { model: modelFor(data.sentenceType) } : {}),
        ...(practice ? { practice: 'The first part of the sentence only, ungraded. The full item comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = shorterFor(sessionItem);
          if (!easier) return 'There is no shorter sentence for this item.';
          setLeverState(next); setVerdict(null); setPhase('building'); setPractice(easier);
          return { practice: orderAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setVerdict(null); setPhase('building'); setPractice(null); },
    };
  });

  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">No sentences to build.</LuminaCardContent></LuminaCard>;
  }
  const roles = pulled.includes(ROLES_LEVER);
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="blue" className="text-xs">🧩 {data.sentenceType} sentences</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Sentences built!" celebrationMessage="You put the parts of each sentence in order." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="blue">
              <div className="text-lg leading-snug">{ORDER_ASK}</div>
              {practice && <div className="text-xs text-amber-300">Practice: the first part only</div>}
            </LuminaPrompt>
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {pulled.includes(MODEL_LEVER) && (
                <LuminaPanel data-lever="model-sentence" className="p-2 text-center text-lg text-cyan-100">{modelFor(data.sentenceType)}</LuminaPanel>
              )}
              <div role="group" aria-label="Your sentence" data-testid="so-row"
                className="flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                {ids.length === 0 && <span className="text-sm text-slate-500">Tap the tiles in order.</span>}
                {ids.map((id, i) => {
                  const t = current.tiles.find(x => x.id === id)!;
                  return <button key={id} type="button" aria-label={`take out ${t.text}`} disabled={blocked} onClick={() => toggle(id)}
                    className="rounded-lg border border-blue-300/40 bg-blue-500/15 px-3 py-2 text-lg text-blue-50">
                    {i === 0 ? t.text.charAt(0).toUpperCase() + t.text.slice(1) : t.text}
                  </button>;
                })}
              </div>
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Tiles">
                {bank.filter(t => !ids.includes(t.id)).map(t => (
                  <button key={t.id} type="button" aria-label={`tile ${t.text}`} disabled={blocked} onClick={() => toggle(t.id)}
                    className="flex flex-col items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-lg text-slate-100 hover:bg-white/10">
                    <span>{t.text}</span>
                    {roles && <span data-lever="tile-roles" className="text-[10px] uppercase tracking-wider text-blue-300">{ROLE_LABEL[t.role]}</span>}
                  </button>
                ))}
              </div>
              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">{notice || (phase === 'checking' ? 'Checking your sentence…' : '')}</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <LuminaButton tone="ghost" onClick={() => edit([])} disabled={blocked || !ids.length}>Clear</LuminaButton>
                <LuminaButton tone="primary" onClick={check} disabled={blocked || !ids.length} className="px-8 text-lg font-bold">
                  {phase === 'checking' ? 'Checking…' : "I'm done!"}
                </LuminaButton>
              </div>
              {verdict && <LuminaFeedbackCard status={verdict.met ? 'correct' : 'incorrect'}><p className="text-base font-semibold">{verdict.words}</p></LuminaFeedbackCard>}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
