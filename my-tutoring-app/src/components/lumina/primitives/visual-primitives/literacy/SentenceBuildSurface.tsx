'use client';

/**
 * sentence-builder `build_sentence` surface (rules in `sentenceBuild.ts`). Word tiles and end marks, a sentence row,
 * "I'm done!". Code checks the shape; a well-shaped sentence goes to the shared literacy judge for sense and topic.
 * Try again keeps the row and the verdict words; a new item opens an empty row. Mounted by SentenceBuilder for a
 * `task: 'sentence_build'` payload, on the teaching workspace only (the tile-order modes keep their own path).
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
  FRAME_LEVER, MODEL_LEVER, askFor, describeSentence, fewerTilesFor, frameFor, isEndMark, modelFor, sentenceAssignment,
  sentenceJudgeRequest, sentenceLeverFacts, sentenceLevers, sentenceMissWords, sentenceScene, sentenceShapeMiss, sentenceText,
  sentencesFrom, type SentenceBuildData, type SentenceItem, type SentenceMiss,
} from './sentenceBuild';

const PHASES: Record<string, PhaseConfig> = { build_sentence: { label: 'Make a sentence', icon: '🧱', accentColor: 'blue' } };
const useProgress = useWorkspaceProgressFor('sentence-builder');

async function askJudge(body: ReturnType<typeof sentenceJudgeRequest>): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }),
  });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

type Phase = 'building' | 'checking' | 'checked';
interface Work { item: string; row: string[]; made: string[] }

export interface SentenceBuildSurfaceProps {
  data: SentenceBuildData & { instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
    onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void };
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

export default function SentenceBuildSurface({ data, className, runtimePlanItemId }: SentenceBuildSurfaceProps) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `sentence-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => sentencesFrom(data.sentences ?? [], data.supportTier), [data.sentences, data.supportTier]);

  const [work, setWork] = useState<Work>({ item: '', row: [], made: [] });
  const [phase, setPhase] = useState<Phase>('building');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SentenceItem | null>(null);
  const openCount = useRef(0);

  const progress = useProgress<SentenceItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: sentenceAssignment,
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
  const w = work.item === current?.id ? work : { item: current?.id ?? '', row: [] as string[], made: [] as string[] };
  const pulled = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';

  const phaseResults = usePhaseResults({
    challenges: items, results, isComplete: allDone, getChallengeType: () => 'build_sentence', phaseConfig: PHASES,
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'sentence-builder' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const edit = (row: string[]) => {
    if (!current) return;
    setWork({ item: current.id, row, made: w.made });
    if (phase === 'checked') setPhase('building');
    setNotice('');
  };
  const add = (t: string) => { if (!blocked && w.row.length < 12) { SoundManager.tap(); edit([...w.row, t]); } };
  const removeAt = (i: number) => { if (!blocked) { SoundManager.tap(); edit(w.row.filter((_, j) => j !== i)); } };

  const settle = (item: SentenceItem, correct: boolean, miss: SentenceMiss | undefined, words: string) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeSentence(w.row), correct, correct ? undefined : miss);
    if (correct && !practice) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  const check = async () => {
    const item = current;
    if (!item || blocked || !w.row.length) return;
    const row = w.row, made = w.made;
    const shape = sentenceShapeMiss(item, row, made);
    if (shape) { settle(item, false, shape, sentenceMissWords(shape, item)); return; }
    const opened = openCount.current;
    setPhase('checking'); setNotice('');
    let reading: WordBuildVerdict;
    try {
      reading = await askJudge(sentenceJudgeRequest(item, row, data.gradeLevel));
    } catch {
      if (opened !== openCount.current) return;
      setPhase('building'); setNotice('The sentence checker could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    const text = sentenceText(row);
    if (reading.met && made.length + 1 < item.ways) {
      SoundManager.playCorrect();
      setWork({ item: item.id, row: [], made: [...made, text.toLowerCase()] });
      setVerdict({ met: true, words: `Yes! "${text}" Now make a different one.` });
      setPhase('building');
      return;
    }
    const miss: SentenceMiss | undefined = reading.met ? undefined : reading.miss === 'wrong_meaning' ? 'off_topic' : 'not_sense';
    settle(item, reading.met, miss, reading.met ? `Yes! "${text}"` : sentenceMissWords(miss, item));
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    submitResult(solved === total, accuracy, { type: 'sentence-builder', task: 'build_sentence', sentencesBuilt: solved,
      sentencesTotal: total, accuracy, attemptsCount: results.reduce((s, r) => s + r.attempts, 0) } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items.length, results, submitResult, progress.recordsEvaluation]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allDone || hasSubmitted || !current ? null : current.id,
    label: 'The word tiles',
    solved: phase === 'checked' && !!verdict?.met,
    checking: phase === 'checking',
    handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = sentenceScene(current, w.row, w.made, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = practice ? [] : sentenceLevers(sessionItem, pulled);
    const onScreen = practice ? undefined : sentenceLeverFacts(pulled, sessionItem);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'The same ask with only the tiles one sentence needs, ungraded. The full set comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = fewerTilesFor(sessionItem);
          if (!easier) return 'There is no smaller set for this item.';
          setLeverState(next); setVerdict(null); setPhase('building'); setPractice(easier);
          return { practice: sentenceAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setVerdict(null); setPhase('building'); setPractice(null); },
    };
  });

  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">No sentences to make.</LuminaCardContent></LuminaCard>;
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="blue" className="text-xs">🧱 Make a sentence</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Sentences made!" celebrationMessage="You made your own sentences." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="blue">
              <div className="text-lg leading-snug">{askFor(current)}</div>
              {current.ways === 2 && <div className="text-sm text-slate-300">Then make a different one.</div>}
              {practice && <div className="text-xs text-amber-300">Practice with fewer tiles</div>}
            </LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {w.made.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 text-sm" data-testid="sb-made">
                  {w.made.map(m => <span key={m} className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">{m}</span>)}
                </div>
              )}
              {pulled.includes(FRAME_LEVER) && (
                <div data-lever="sentence-frame" className="flex flex-wrap justify-center gap-2 text-xs font-mono text-blue-200">
                  {frameFor(current).map((f, i) => <span key={i} className="rounded border border-dashed border-blue-300/40 px-2 py-1">{f}</span>)}
                </div>
              )}
              {pulled.includes(MODEL_LEVER) && (
                <LuminaPanel data-lever="model-sentence" className="p-2 text-center text-lg text-cyan-100">{modelFor(current)}</LuminaPanel>
              )}

              <div role="group" aria-label="Your sentence" data-testid="sb-row"
                className="flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                {w.row.length === 0 && <span className="text-sm text-slate-500">Tap tiles to make your sentence.</span>}
                {w.row.map((t, i) => (
                  <button key={`${t}-${i}`} type="button" aria-label={`take out ${t} ${i + 1}`} disabled={blocked} onClick={() => removeAt(i)}
                    className="rounded-lg border border-blue-300/40 bg-blue-500/15 px-3 py-2 text-lg text-blue-50 hover:opacity-80">
                    {i === 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Word tiles">
                {current.bank.map(t => (
                  <button key={t} type="button" aria-label={`tile ${t}`} disabled={blocked} onClick={() => add(t)}
                    className={`rounded-lg border px-3 py-2 text-lg transition hover:brightness-125 disabled:opacity-40 ${isEndMark(t)
                      ? 'min-w-10 border-amber-300/40 bg-amber-500/15 font-bold text-amber-100' : 'border-white/15 bg-white/5 text-slate-100'}`}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">
                {notice || (phase === 'checking' ? 'Checking your sentence…' : '')}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <LuminaButton tone="ghost" onClick={() => edit([])} disabled={blocked || !w.row.length}>Clear</LuminaButton>
                <LuminaButton tone="primary" onClick={check} disabled={blocked || !w.row.length} className="px-8 text-lg font-bold">
                  {phase === 'checking' ? 'Checking…' : "I'm done!"}
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
