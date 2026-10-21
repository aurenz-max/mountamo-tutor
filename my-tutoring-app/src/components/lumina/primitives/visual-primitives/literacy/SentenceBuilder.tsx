'use client';

/**
 * SentenceBuilder — sentence building on the shared tutor/JEV teaching workspace only (R12, user ruling 2026-10-08:
 * one path), wired from its boss (`sentenceBuilder.boss.ts`). Two surfaces, one per payload shape:
 *   - the tile modes (simple, compound, complex, compound-complex), here (rules in `sentenceOrder.ts`). The learner
 *     orders ALL the given tiles into one sentence; a listed order passes in code and an unlisted full order goes to
 *     the shared sentence judge. The sentence is never printed first. Try again keeps the row; a new item opens an
 *     empty one.
 *   - `build_sentence` (open build): `SentenceBuildSurface`, a question or telling sentence from word tiles.
 * An unbound mount shows the shared "needs the tutor" card. Pip comes from the runner (`<PipDock />`, `<PipWorkspace>`).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { SentenceBuilderMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { WordBuildVerdict } from '../../../service/build-layer/wordBuildDecision';
import SentenceBuildSurface from './SentenceBuildSurface';
import type { SentenceItem } from './sentenceBuild';
import {
  MODEL_LEVER, ORDER_ASK, ROLES_LEVER, ROLE_LABEL, bankOrder, orderJudgeRequest, orderMissWords, orderModelFor, orderScene,
  orderText, orderVerdict, type OrderItem, type OrderMiss,
} from './sentenceOrder';
import { SENTENCE_LEVERS, isBuildItem } from './sentenceBuilderLevers';
import { sentenceBuilderBoss, sentenceBuilderItems } from './sentenceBuilder.boss';

export interface SentenceBuilderData {
  title: string;
  gradeLevel: string;
  sentenceType: 'simple' | 'compound' | 'complex' | 'compound-complex';
  /** `build_sentence` (open build): the word-tile surface runs the session from `sentences`; `challenges` is empty. */
  task?: 'sentence_build';
  sentences?: SentenceItem[];

  /** Each is a sentence to order from its tiles. `targetMeaning` is the generator's note; it is never printed. */
  challenges: Array<{
    id: string;
    targetMeaning: string;
    tiles: Array<{
      id: string;
      text: string;
      role: 'subject' | 'predicate' | 'object' | 'modifier' | 'conjunction' | 'punctuation';
    }>;
    validArrangements: string[][];
    hint?: string;
  }>;

  roleColors: Record<string, string>;
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SentenceBuilderMetrics>) => void;
}

export interface SentenceBuilderProps {
  data: SentenceBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const PHASES: Record<string, PhaseConfig> = { order: { label: 'Build the sentence', icon: '🧩', accentColor: 'blue' } };
const useProgress = useWorkspaceProgressFor('sentence-builder');
const assignment = sentenceBuilderBoss.assignment!;

async function askJudge(body: ReturnType<typeof orderJudgeRequest>): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }) });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

type Phase = 'building' | 'checking' | 'checked';

/** The tile modes: given tiles, a sentence row, "I'm done!". */
function SentenceOrderSurface({ data, className, runtimePlanItemId }: SentenceBuilderProps) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `sentence-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => sentenceBuilderItems(data).filter((i): i is OrderItem => !isBuildItem(i)), [data]);

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
    workspace, assignment,
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
  // The bank keeps a stable mixed order per item: never an answer order, no three tiles together as the answer has them.
  const bank = useMemo(() => (current ? bankOrder(current) : []), [current]);
  const model = sessionItem && pulled.includes(MODEL_LEVER) ? orderModelFor(sessionItem) : null;

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

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = orderScene(current, ids, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = practice ? [] : SENTENCE_LEVERS.declare(sessionItem, null, pulled);
    const published = leverScene(scene, {
      support: practice ? '' : SENTENCE_LEVERS.support(sessionItem, null),
      onScreen: practice ? '' : SENTENCE_LEVERS.onScreen(sessionItem, null, pulled),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts,
        ...(practice ? { practice: 'The first part of the sentence only, ungraded. The full item comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = SENTENCE_LEVERS.simpler(sessionItem, null, id) as OrderItem | null;
          if (!easier) return `No lever ${id} on this item.`;
          setLeverState(next); setVerdict(null); setPhase('building'); setPractice(easier);
          return { practice: assignment(easier) };
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
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? progress.teachingResult?.accuracy)}
            durationMs={elapsedMs} heading="Sentences built!" celebrationMessage="You put the parts of each sentence in order." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="blue">
              <div className="text-lg leading-snug">{ORDER_ASK}</div>
              {practice && (
                <div className="mt-1 flex items-center gap-2 text-xs text-amber-300">
                  <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>
                  The first part only
                </div>
              )}
            </LuminaPrompt>

            <PipDock />
            <PipWorkspace className="space-y-3">
              {model && (
                <LuminaPanel data-lever="model-sentence" className="p-2 text-center text-lg text-cyan-100">{model}</LuminaPanel>
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
            </PipWorkspace>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

/** One mount, one shape: the open build's word tiles, or the tile-order modes (wired from the same boss). */
function SentenceBuilderSurface(props: SentenceBuilderProps) {
  return props.data.task === 'sentence_build'
    ? <SentenceBuildSurface {...props} />
    : <SentenceOrderSurface {...props} />;
}

const SentenceBuilder = withWorkspaceOnly<SentenceBuilderProps>('sentence-builder', SentenceBuilderSurface,
  props => props.data.title);

export default SentenceBuilder;
