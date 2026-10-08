'use client';

/**
 * paragraph-architect `build_paragraph` surface (rules in `paragraphBuild.ts`). Sentence cards, a paragraph tray,
 * "I'm done!". Checked in code from the cards' roles. Try again keeps the paragraph and the verdict words; a new
 * item opens an empty one. Mounted by ParagraphArchitect for a `task: 'paragraph_build'` payload, on the teaching
 * workspace only (the three writing modes keep their own path).
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
  FRAME_LEVER, MODEL_LEVER, MODEL_PARAGRAPH, askFor, boardOrder, describeParagraph, fewerCardsFor, paragraphAssignment,
  paragraphLeverFacts, paragraphLevers, paragraphMiss, paragraphMissWords, paragraphScene, paragraphsFrom, readCardRequest,
  type ParagraphBuildData, type ParagraphItem,
} from './paragraphBuild';

const PHASES: Record<string, PhaseConfig> = { build_paragraph: { label: 'Build a paragraph', icon: '🧱', accentColor: 'emerald' } };
const useProgress = useWorkspaceProgressFor('paragraph-architect');

type Phase = 'building' | 'checked';
interface Work { item: string; order: string[] }

export interface ParagraphBuildSurfaceProps {
  data: ParagraphBuildData & { instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
    onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void };
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

export default function ParagraphBuildSurface({ data, className, runtimePlanItemId }: ParagraphBuildSurfaceProps) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `paragraph-architect-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => paragraphsFrom(data.paragraphs ?? []), [data.paragraphs]);

  const [work, setWork] = useState<Work>({ item: '', order: [] });
  const [phase, setPhase] = useState<Phase>('building');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ParagraphItem | null>(null);

  const progress = useProgress<ParagraphItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: paragraphAssignment,
    onItemOpened: (_index, retry) => {
      setPhase('building');
      if (retry) return;
      setVerdict(null); setPractice(null);
    },
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

  const phaseResults = usePhaseResults({
    challenges: items, results, isComplete: allDone, getChallengeType: () => 'build_paragraph', phaseConfig: PHASES,
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'paragraph-architect' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const edit = (next: string[]) => {
    if (!current) return;
    setWork({ item: current.id, order: next });
    if (phase === 'checked') setPhase('building');
  };
  const toggle = (id: string) => {
    if (blocked) return;
    SoundManager.tap();
    edit(order.includes(id) ? order.filter(x => x !== id) : [...order, id]);
  };
  const readCard = (id: string) => ctx.sendText(readCardRequest(textOf(id)), { silent: true, author: 'host' });

  const check = () => {
    const item = current;
    if (!item || blocked || order.length === 0) return;
    const miss = paragraphMiss(item, order);
    const correct = !miss;
    setVerdict({ met: correct, words: correct ? `Yes! That paragraph tells about ${item.topic} from start to finish.` : paragraphMissWords(miss, item.topic) });
    setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeParagraph(item, order), correct, miss);
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
    submitResult(solved === total, accuracy, {
      type: 'paragraph-architect', task: 'build_paragraph', paragraphsBuilt: solved, paragraphsTotal: total, accuracy,
      attemptsCount: results.reduce((s, r) => s + r.attempts, 0),
    } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items.length, results, submitResult, progress.recordsEvaluation]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allDone || hasSubmitted || !current ? null : current.id,
    label: 'The sentence cards',
    solved: phase === 'checked' && !!verdict?.met,
    checking: false,
    handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = paragraphScene(current, order, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = practice ? [] : paragraphLevers(sessionItem, pulled);
    const onScreen = practice ? undefined : paragraphLeverFacts(pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'A practice set of five cards, ungraded. The full set comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = fewerCardsFor(sessionItem);
          if (!easier) return 'There is no smaller set for this item.';
          setLeverState(next); setVerdict(null); setPhase('building'); setPractice(easier);
          return { practice: paragraphAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setVerdict(null); setPhase('building'); setPractice(null); },
    };
  });

  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">No paragraphs to build.</LuminaCardContent></LuminaCard>;
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="emerald" className="text-xs">🧱 Build a paragraph</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Paragraphs built!" celebrationMessage="You put a topic, facts that belong, and a closing in order." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="emerald">
              <div className="text-lg leading-snug">{askFor(current)}</div>
              {practice && <div className="text-xs text-amber-300">Practice with fewer cards</div>}
            </LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {pulled.includes(MODEL_LEVER) && (
                <LuminaPanel data-lever="model-paragraph" className="p-3 text-sm text-slate-300">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">A paragraph about {MODEL_PARAGRAPH.topic}</p>
                  {MODEL_PARAGRAPH.sentences.map((t, i) => (
                    <p key={t}><span className="text-cyan-300">{i === 0 ? 'Topic: ' : i === MODEL_PARAGRAPH.sentences.length - 1 ? 'Closing: ' : 'Fact: '}</span>{t}</p>
                  ))}
                </LuminaPanel>
              )}

              <div role="group" aria-label="Your paragraph" data-testid="pb-paragraph"
                className="min-h-24 space-y-2 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                {pulled.includes(FRAME_LEVER) && (
                  <div data-lever="paragraph-frame" className="flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-widest text-emerald-300">
                    {['Topic sentence', 'Fact', 'Fact', 'Closing sentence'].map((l, i) => <span key={i} className="rounded border border-dashed border-emerald-300/40 px-2 py-0.5">{l}</span>)}
                  </div>
                )}
                {order.length === 0 && <p className="text-sm text-slate-500">Tap the cards below, in order, to build your paragraph.</p>}
                {order.map((id, n) => (
                  <button key={id} type="button" aria-label={`take out ${id}`} disabled={blocked} onClick={() => toggle(id)}
                    className="block w-full rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-left text-base text-emerald-50 hover:opacity-80">
                    <span className="mr-2 text-xs text-emerald-300">{n + 1}.</span>{textOf(id)}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Sentence cards">
                {board.filter(c => !order.includes(c.id)).map(c => (
                  <div key={c.id} className="relative">
                    <button type="button" aria-label={`card ${c.id}`} disabled={blocked} onClick={() => toggle(c.id)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-3 pr-9 text-left text-base text-slate-100 hover:bg-white/10 disabled:opacity-50">
                      {c.text}
                    </button>
                    <button type="button" aria-label={`read ${c.id}`} onClick={() => readCard(c.id)}
                      className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-1.5 text-sm">🔊</button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <LuminaButton tone="ghost" onClick={() => edit([])} disabled={blocked || !order.length}>Clear</LuminaButton>
                <LuminaButton tone="primary" onClick={check} disabled={blocked || !order.length} className="px-8 text-lg font-bold">
                  I&apos;m done!
                </LuminaButton>
              </div>
              {verdict && (
                <LuminaFeedbackCard status={verdict.met ? 'correct' : 'incorrect'}>
                  <p className="text-base font-semibold">{verdict.words}</p>
                </LuminaFeedbackCard>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
