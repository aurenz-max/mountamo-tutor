'use client';

/**
 * story-planner on the teaching workspace (rules in `storySteps.ts`). K-1: pick a picture per card, then tap the story
 * events into order (every picture and event can be read aloud). Grade 2+: write each planning card; "I'm done!" runs
 * code checks, then the writing judge. The plan grows on screen as cards are accepted.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt, LuminaReadAloud,
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
  FIRST_LEVER, MODEL_CARD, MODEL_LEVER, MODEL_ORDER, STARTER, STARTER_LEVER, askFor, boardOf, orderMiss, readRequest,
  storyAssignment, storyItems, storyLevers, storyMissWords, storyScene, writeJudgeRequest, writeShapeMiss,
  isPictureStory, splitPictureOption, type StoryItem, type StoryMiss, type StoryPayload,
} from './storySteps';

const PHASES: Record<string, PhaseConfig> = {
  plan: { label: 'Plan', icon: '🎨', accentColor: 'amber' },
  write: { label: 'Plan', icon: '📝', accentColor: 'amber' },
  order: { label: 'Order', icon: '🔢', accentColor: 'cyan' },
};
const useProgress = useWorkspaceProgressFor('story-planner');

async function askJudge(body: ReturnType<typeof writeJudgeRequest>): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }) });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

export interface StorySurfaceData extends StoryPayload {
  title: string;
  gradeLevel?: string;
  instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void;
}
type Phase = 'working' | 'checking' | 'checked';

export default function StorySurface({ data, className, runtimePlanItemId }: { data: StorySurfaceData; className?: string;
    runtimePlanItemId?: string; runtimeEvalMode?: string }) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `story-planner-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => storyItems(data), [data]);
  const picture = isPictureStory(items, data.gradeLevel);

  const [plan, setPlan] = useState<{ label: string; text: string }[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [typed, setTyped] = useState<{ item: string; text: string }>({ item: '', text: '' });
  const [phase, setPhase] = useState<Phase>('working');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const openCount = useRef(0);

  const progress = useProgress<StoryItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: storyAssignment,
    onItemOpened: (_index, retry) => { openCount.current += 1; setPhase('working'); setNotice(''); if (!retry) { setVerdict(null); setOrder([]); } },
  });
  const { currentIndex, results, isComplete } = progress;
  const allDone = isComplete || !!progress.practiceSummary;
  const current = items[currentIndex] ?? null;
  const text = typed.item === current?.id ? typed.text : '';
  const pulled = leverState.item === current?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';
  const planText = plan.map(c => `${c.label}: ${c.text}`).join(' ');
  const read = (t: string) => ctx.sendText(readRequest(t), { silent: true, author: 'host' });

  const phaseResults = usePhaseResults({ challenges: items, results, isComplete: allDone, getChallengeType: i => i.kind, phaseConfig: PHASES });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'story-planner' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const changed = () => { if (phase === 'checked') setPhase('working'); setNotice(''); };
  const type = (value: string) => { if (current) { setTyped({ item: current.id, text: value }); changed(); } };
  const toggle = (id: string) => { if (blocked) return; SoundManager.tap(); setOrder(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id]); changed(); };
  // One tap chooses AND moves on (no confirm step); the last card's tap commits the plan.
  const pick = (card: string, choice: string) => {
    if (blocked || current?.kind !== 'plan') return;
    SoundManager.tap();
    const next = { ...picks, [card]: choice };
    setPicks(next); changed();
    if (current.cards.every(c => next[c.id])) {
      setPlan(current.cards.map(c => ({ label: c.label, text: splitPictureOption(next[c.id]).label })));
      settle(current, true, undefined, 'Great plan! Those choices make a story.', `Picked: ${current.cards.map(c => `${c.label} ${splitPictureOption(next[c.id]).label}`).join('; ')}`);
    }
  };
  const cardAt = current?.kind === 'plan' ? current.cards.findIndex(c => !picks[c.id]) : -1;

  const settle = (item: StoryItem, correct: boolean, miss: StoryMiss | undefined, words: string, said: string) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(said, correct, correct ? undefined : miss);
    if (correct) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  const check = async () => {
    const item = current;
    if (!item || blocked) return;
    if (item.kind === 'plan') return;
    if (item.kind === 'order') {
      if (!order.length) return;
      const miss = orderMiss(item, order);
      settle(item, !miss, miss, miss ? storyMissWords(miss) : 'Yes! That is the story in order.',
        `Ordered: ${order.map(id => item.events.find(e => e.id === id)?.text).join(' / ')}`);
      return;
    }
    if (!text.trim()) return;
    const said = `Wrote on ${item.label}: "${text.trim()}"`;
    const shape = writeShapeMiss(text, plan.map(c => c.text));
    if (shape) { settle(item, false, shape, storyMissWords(shape), said); return; }
    const opened = openCount.current;
    setPhase('checking');
    let reading: WordBuildVerdict;
    try { reading = await askJudge(writeJudgeRequest(item, text, data.writingPrompt, planText, data.gradeLevel)); }
    catch {
      if (opened !== openCount.current) return;
      setPhase('working'); setNotice('The checker could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    const miss: StoryMiss | undefined = reading.met ? undefined : reading.miss === 'wrong_meaning' ? 'wrong_job' : 'not_sense';
    if (reading.met) setPlan(p => [...p, { label: item.label, text: text.trim() }]);
    settle(item, reading.met, miss, reading.met ? `Yes! That ${item.label.toLowerCase()} card works.` : storyMissWords(miss), said);
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    const has = (re: RegExp) => plan.some(c => re.test(c.label.toLowerCase()));
    const arc = items.find(i => i.kind === 'order');
    submitResult(solved === total, accuracy, { type: 'story-planner', elementsPlanned: plan.length, elementsRequired: data.elements.length,
      characterDepth: 'surface', eventCount: arc && arc.kind === 'order' ? arc.events.length : plan.filter(c => /event/i.test(c.label)).length,
      conflictIdentified: has(/problem|conflict|happen/), resolutionConnectsToConflict: has(/solution|resol|end/),
      descriptiveLanguageUsed: 0 } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items, results, submitResult, progress.recordsEvaluation, plan, data.elements.length]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId, scopeId: allDone || hasSubmitted || !current ? null : current.id, label: 'The story plan',
    solved: phase === 'checked' && !!verdict?.met, checking: phase === 'checking', handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current) return;
    const picked = current.kind === 'order' ? order.map(id => current.events.find(e => e.id === id)?.text).join(' | ')
      : current.kind === 'plan' ? Object.values(picks).join(' | ') : undefined;
    const scene = storyScene(current, data.writingPrompt, { written: text, plan: planText, picked, card: Math.max(0, cardAt) }, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = storyLevers(current, pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts,
        ...(pulled.includes(MODEL_LEVER) ? { model: current.kind === 'write' ? MODEL_CARD[current.part] : MODEL_ORDER.join(' / ') } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        setLeverState({ item: current.id, pulled: [...pulled, id] });
        if (id === STARTER_LEVER && current.kind === 'write' && !text.trim()) setTyped({ item: current.id, text: STARTER[current.part] });
        if (id === FIRST_LEVER && current.kind === 'order') setOrder([current.events[0].id]);
        return true as const;
      },
    };
  });

  if (!items.length) return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">Nothing to plan.</LuminaCardContent></LuminaCard>;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && current && !picture && <LuminaBadge accent="amber" className="text-xs">{PHASES[current.kind].icon} {PHASES[current.kind].label}</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Story planned!" celebrationMessage="Your plan is ready to write." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            {/* A K-1 child cannot decode the story idea or the ask: the tutor reads them, and a button replays them. */}
            {picture ? (
              <div className="flex justify-center"><LuminaReadAloud size="lg" label="Hear the story idea" onClick={() => read(data.writingPrompt)} /></div>
            ) : (
              <>
                <LuminaPanel className="p-3 text-sm text-slate-300">{data.writingPrompt}</LuminaPanel>
                <LuminaPrompt accent="amber"><div className="text-lg leading-snug">{askFor(current)}</div></LuminaPrompt>
              </>
            )}
            {picture && Object.keys(picks).length > 0 && (
              <div data-testid="sp-picks" aria-label="Your story so far" className="flex justify-center gap-3 text-4xl">
                {Object.values(picks).map(c => <span key={c} aria-hidden>{splitPictureOption(c).emoji || '⭐'}</span>)}
              </div>
            )}
            {plan.length > 0 && !picture && (
              <div data-testid="sp-plan" className="grid gap-1 rounded-xl border border-white/10 bg-slate-900/40 p-2 text-sm text-slate-300">
                {plan.map(c => <p key={c.label}><span className="font-semibold text-amber-200">{c.label}:</span> {c.text}</p>)}
              </div>
            )}
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {pulled.includes(MODEL_LEVER) && (
                <LuminaPanel data-lever="model-card" className="p-2 text-sm text-slate-300">
                  {current.kind === 'write' ? <>From another story: {MODEL_CARD[current.part]}</> : <>Another story in order: {MODEL_ORDER.join(' → ')}</>}
                </LuminaPanel>
              )}
              {current.kind === 'plan' && cardAt >= 0 && (() => { const card = current.cards[cardAt]; return (
                <div key={card.id} className="space-y-3">
                  <div className="flex justify-center"><LuminaReadAloud iconOnly size="lg" label={`hear the question ${card.label}`} onClick={() => read(card.prompt)} /></div>
                  <div role="group" aria-label={card.label} className="grid grid-cols-3 gap-3">
                    {card.choices.map(c => { const o = splitPictureOption(c); return (
                      <div key={c} className="flex flex-col items-center gap-1">
                        <button type="button" aria-label={o.label} disabled={blocked} onClick={() => pick(card.id, c)}
                          className="flex w-full flex-col items-center rounded-2xl border border-white/15 bg-white/5 p-3 hover:bg-white/10">
                          <span className="text-5xl" aria-hidden>{o.emoji}</span><span className="mt-1 text-xs text-slate-300">{o.label}</span>
                        </button>
                        <LuminaReadAloud iconOnly size="sm" label={`hear ${o.label}`} onClick={() => read(c)} />
                      </div>); })}
                  </div>
                </div>); })()}
              {current.kind === 'order' && (
                <>
                  <div role="group" aria-label="Your order" data-testid="sp-order" className="min-h-16 space-y-2 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                    {order.map((id, n) => { const o = splitPictureOption(current.events.find(e => e.id === id)?.text ?? ''); return (
                      <button key={id} type="button" aria-label={`${o.label} — tap to take it back out`} disabled={blocked} onClick={() => toggle(id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-left text-cyan-50">
                        <span className="text-lg font-bold">{n + 1}</span><span className="text-3xl" aria-hidden>{o.emoji}</span><span className="text-sm">{o.label}</span></button>); })}
                  </div>
                  <div className="grid gap-2" role="group" aria-label="Events">
                    {boardOf(current).filter(e => !order.includes(e.id)).map(e => { const o = splitPictureOption(e.text); return (
                      <span key={e.id} className="flex items-center gap-2">
                        <button type="button" aria-label={o.label} disabled={blocked} onClick={() => toggle(e.id)}
                          className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-slate-100 hover:bg-white/10">
                          <span className="text-3xl" aria-hidden>{o.emoji}</span><span className="text-sm">{o.label}</span></button>
                        <LuminaReadAloud iconOnly size="sm" label={`hear ${o.label}`} onClick={() => read(e.text)} />
                      </span>); })}
                  </div>
                </>
              )}
              {current.kind === 'write' && (
                <textarea aria-label="Your card" value={text} disabled={blocked} rows={2} onChange={e => type(e.target.value)} placeholder="Type your idea"
                  className="w-full rounded-xl border border-white/15 bg-slate-900/50 p-3 text-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              )}
              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">{notice || (phase === 'checking' ? 'Checking…' : '')}</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {current.kind === 'order' && <LuminaButton tone="ghost" onClick={() => setOrder([])} disabled={blocked || !order.length}>Clear</LuminaButton>}
                {current.kind !== 'plan' && (
                  <LuminaButton tone="primary" onClick={check} className="px-8 text-lg font-bold"
                    disabled={blocked || (current.kind === 'order' ? order.length !== current.events.length : !text.trim())}>
                    {phase === 'checking' ? 'Checking…' : "I'm done!"}
                  </LuminaButton>
                )}
              </div>
              {verdict && <LuminaFeedbackCard status={verdict.met ? 'correct' : 'incorrect'}><p className="text-base font-semibold">{verdict.words}</p></LuminaFeedbackCard>}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
