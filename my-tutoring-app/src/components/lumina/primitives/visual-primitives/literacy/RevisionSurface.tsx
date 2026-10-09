'use client';

/**
 * revision-workshop's revision modes on the teaching workspace (rules in `revisionSteps.ts`). The draft is on screen
 * with the sentence to revise marked; the learner types the revision ("I'm done!" runs code checks, then the writing
 * judge). Reorganize orders the draft's sentences instead, checked in code.
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
  EDIT_LEVER, HINT_LEVER, MODEL_LEVER, MODEL_REVISION, orderMiss, revisionAssignment, revisionItems, revisionJudgeRequest,
  revisionLevers, revisionMissWords, revisionScene, revisionShapeMiss, type RevisionItem, type RevisionMiss, type RevisionPayload,
} from './revisionSteps';

const PHASES: Record<string, PhaseConfig> = { revise: { label: 'Revise', icon: '✏️', accentColor: 'cyan' } };
const useProgress = useWorkspaceProgressFor('revision-workshop');

async function askJudge(body: ReturnType<typeof revisionJudgeRequest>): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }) });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

export interface RevisionSurfaceData extends RevisionPayload {
  title: string;
  gradeLevel?: string;
  instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void;
}
type Phase = 'writing' | 'checking' | 'checked';

/** A stable order of the draft's sentences that is never the answer order. */
const mixedTargets = (p: RevisionPayload) => {
  const ts = [...p.targets];
  const out = ts.length > 1 ? [...ts.slice(1), ts[0]] : ts;
  return out.map(t => ({ id: t.targetId, text: t.originalText }));
};

export default function RevisionSurface({ data, className, runtimePlanItemId }: { data: RevisionSurfaceData; className?: string;
    runtimePlanItemId?: string; runtimeEvalMode?: string }) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `revision-workshop-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => revisionItems(data), [data]);
  const reorganize = data.revisionSkill === 'reorganize';

  const [typed, setTyped] = useState<{ item: string; text: string }>({ item: '', text: '' });
  const [order, setOrder] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('writing');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const openCount = useRef(0);

  const progress = useProgress<RevisionItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: revisionAssignment,
    onItemOpened: (_index, retry) => { openCount.current += 1; setPhase('writing'); setNotice(''); if (!retry) setVerdict(null); },
  });
  const { currentIndex, results, isComplete } = progress;
  const allDone = isComplete || !!progress.practiceSummary;
  const current = items[currentIndex] ?? null;
  const text = typed.item === current?.id ? typed.text : '';
  const pulled = leverState.item === current?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';
  const cards = useMemo(() => mixedTargets(data), [data]);
  const shown = reorganize ? order.map(id => cards.find(c => c.id === id)?.text ?? '').join(' ') : text;

  const phaseResults = usePhaseResults({ challenges: items, results, isComplete: allDone, getChallengeType: () => 'revise', phaseConfig: PHASES });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'revision-workshop' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const type = (value: string) => { if (current) { setTyped({ item: current.id, text: value }); if (phase === 'checked') setPhase('writing'); setNotice(''); } };
  const toggle = (id: string) => { if (blocked) return; SoundManager.tap(); setOrder(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id]); if (phase === 'checked') setPhase('writing'); };

  const settle = (item: RevisionItem, correct: boolean, miss: RevisionMiss | undefined, words: string, said: string) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(`Wrote: "${said.trim()}"`, correct, correct ? undefined : miss);
    if (correct) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  const check = async () => {
    const item = current;
    if (!item || blocked) return;
    if (reorganize) {
      if (!order.length) return;
      const miss = orderMiss(data, order);
      settle(item, !miss, miss, miss ? revisionMissWords(miss) : 'Yes! Now the sentences make sense in order.', shown);
      return;
    }
    if (!text.trim()) return;
    const shape = revisionShapeMiss(item, text);
    if (shape) { settle(item, false, shape, revisionMissWords(shape), text); return; }
    const opened = openCount.current;
    setPhase('checking');
    let reading: WordBuildVerdict;
    try { reading = await askJudge(revisionJudgeRequest(item, text, data.draft, data.gradeLevel)); }
    catch {
      if (opened !== openCount.current) return;
      setPhase('writing'); setNotice('The writing checker could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    const miss: RevisionMiss | undefined = reading.met ? undefined : reading.miss === 'wrong_meaning' ? 'wrong_job' : 'not_sense';
    settle(item, reading.met, miss, reading.met ? 'Yes! That revision does the job.' : revisionMissWords(miss), text);
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    submitResult(solved === total, accuracy, { type: 'revision-workshop', revisionSkill: data.revisionSkill, revisionsApplied: solved,
      revisionTargets: total, improvementScore: accuracy, beforeAfterCompared: false, readAloudUsed: false,
      attemptsCount: results.reduce((s, r) => s + r.attempts, 0) } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items.length, results, submitResult, progress.recordsEvaluation, data.revisionSkill]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId, scopeId: allDone || hasSubmitted || !current ? null : current.id, label: 'The draft',
    solved: phase === 'checked' && !!verdict?.met, checking: phase === 'checking', handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current) return;
    const scene = revisionScene(current, data.draft, shown, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = revisionLevers(current, pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts,
        ...(pulled.includes(HINT_LEVER) ? { onScreen: `The revision tip is shown: ${current.suggestion}` } : {}),
        ...(pulled.includes(MODEL_LEVER) ? { model: `Before: ${MODEL_REVISION[current.skill][0]} After: ${MODEL_REVISION[current.skill][1]}` } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        setLeverState({ item: current.id, pulled: [...pulled, id] });
        if (id === EDIT_LEVER && !text.trim()) setTyped({ item: current.id, text: current.original });
        return true as const;
      },
    };
  });

  if (!items.length) return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">Nothing to revise.</LuminaCardContent></LuminaCard>;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="cyan" className="text-xs">✏️ {data.revisionSkill.replace('-', ' ')}</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Revising done!" celebrationMessage="You made the writing stronger." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            {!reorganize && (
              <LuminaPanel data-testid="rv-draft" className="p-3 text-base leading-relaxed text-slate-300">
                {data.draft.split(current.original).flatMap((part, i, all) => i < all.length - 1
                  ? [part, <mark key={i} className="rounded bg-cyan-500/25 px-1 text-cyan-50">{current.original}</mark>] : [part])}
              </LuminaPanel>
            )}
            <LuminaPrompt accent="cyan"><div className="text-lg leading-snug">{current.ask}</div></LuminaPrompt>
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {pulled.includes(HINT_LEVER) && <LuminaPanel data-lever="revision-hint" className="p-2 text-sm text-cyan-100">Tip: {current.suggestion}</LuminaPanel>}
              {pulled.includes(MODEL_LEVER) && (
                <LuminaPanel data-lever="model-revision" className="p-2 text-sm text-slate-300">
                  <p>Before: {MODEL_REVISION[current.skill][0]}</p><p className="text-cyan-100">After: {MODEL_REVISION[current.skill][1]}</p>
                </LuminaPanel>
              )}
              {reorganize ? (
                <>
                  <div role="group" aria-label="Your order" data-testid="rv-order" className="min-h-20 space-y-2 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                    {order.length === 0 && <p className="text-sm text-slate-500">Tap the sentences in the order that makes sense.</p>}
                    {order.map((id, n) => <button key={id} type="button" aria-label={`take out ${id}`} disabled={blocked} onClick={() => toggle(id)}
                      className="block w-full rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-left text-cyan-50"><span className="mr-2 text-xs">{n + 1}.</span>{cards.find(c => c.id === id)?.text}</button>)}
                  </div>
                  <div className="grid gap-2" role="group" aria-label="Sentences">
                    {cards.filter(c => !order.includes(c.id)).map(c => <button key={c.id} type="button" aria-label={`sentence ${c.id}`} disabled={blocked}
                      onClick={() => toggle(c.id)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-slate-100 hover:bg-white/10">{c.text}</button>)}
                  </div>
                </>
              ) : (
                <textarea aria-label="Your revision" value={text} disabled={blocked} rows={2} onChange={e => type(e.target.value)}
                  placeholder="Type your revised sentence"
                  className="w-full rounded-xl border border-white/15 bg-slate-900/50 p-3 text-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              )}
              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">{notice || (phase === 'checking' ? 'Checking your revision…' : '')}</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {reorganize && <LuminaButton tone="ghost" onClick={() => setOrder([])} disabled={blocked || !order.length}>Clear</LuminaButton>}
                <LuminaButton tone="primary" onClick={check} disabled={blocked || (reorganize ? !order.length : !text.trim())} className="px-8 text-lg font-bold">
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
