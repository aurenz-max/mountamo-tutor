'use client';

/**
 * Letter build surface — shared by cvc-speller `make_word` and sound-swap `swap_build` (rules in `letterBuild.ts`).
 * Three boxes, a letter bank, "I'm done!". Code checks what the ask states; a well-made word goes to the shared word
 * judge for "is it real?". Try again keeps the boxes and the verdict words; a new item opens with fresh boxes (empty,
 * or the given word on a swap). Mounted by its host when the payload has `task: 'letter_build'`, on the teaching
 * workspace only.
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
  MODEL_LEVER, PATTERN_LEVER, describeLetterBuild, letterAssignment, letterBuildLevers, letterBuildScene, letterItemsFrom,
  letterJudgeRequest, letterLeverFacts, letterMissWords, letterShapeMiss, modelFor, patternFor, smallBankFor, startRow,
  type LetterBuildData, type LetterBuildItem, type LetterBuildMiss,
} from './letterBuild';

const PHASES: Record<string, PhaseConfig> = { letter_build: { label: 'Make a word', icon: '🔤', accentColor: 'cyan' } };
const VOWELS = 'aeiou';

async function askJudge(body: ReturnType<typeof letterJudgeRequest>): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }),
  });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

/** What the host reports when the session ends: its own metrics shape. */
export interface LetterBuildSummary { solved: number; total: number; accuracy: number; attemptsCount: number; firstTryCorrect: number }

export interface LetterBuildSurfaceProps {
  primitiveId: string;
  data: LetterBuildData & { instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
    onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void };
  metrics: (s: LetterBuildSummary) => object;
  className?: string;
  runtimePlanItemId?: string;
}

type Phase = 'building' | 'checking' | 'checked';
interface Work { item: string; row: string[]; made: string[] }

const progressHooks: Record<string, ReturnType<typeof useWorkspaceProgressFor>> = {};
const progressFor = (id: string) => (progressHooks[id] ??= useWorkspaceProgressFor(id));

export default function LetterBuildSurface({ primitiveId, data, metrics, className, runtimePlanItemId }: LetterBuildSurfaceProps) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `${primitiveId}-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => letterItemsFrom(data.buildItems ?? [], data.supportTier), [data.buildItems, data.supportTier]);
  const useProgress = progressFor(primitiveId);

  const [work, setWork] = useState<Work>({ item: '', row: [], made: [] });
  const [phase, setPhase] = useState<Phase>('building');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<LetterBuildItem | null>(null);
  const openCount = useRef(0);

  const progress = useProgress<LetterBuildItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: letterAssignment,
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
  const rowWork = work.item === current?.id ? work : { item: current?.id ?? '', row: current ? startRow(current) : [], made: [] as string[] };
  const pulled = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';
  const full = !!current && rowWork.row.length === startRow(current).length && rowWork.row.every(Boolean);

  const phaseResults = usePhaseResults({
    challenges: items, results, isComplete: allDone, getChallengeType: () => 'letter_build', phaseConfig: PHASES,
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: primitiveId as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const edit = (row: string[]) => {
    if (!current) return;
    setWork({ item: current.id, row, made: rowWork.made });
    if (phase === 'checked') setPhase('building');
    setNotice('');
  };
  const place = (letter: string) => {
    if (blocked) return;
    const at = rowWork.row.findIndex(l => !l);
    if (at < 0) { setNotice('Tap a box to empty it first.'); return; }
    SoundManager.tap(); edit(rowWork.row.map((l, i) => (i === at ? letter : l)));
  };
  const empty = (i: number) => {
    if (blocked || !rowWork.row[i]) return;
    SoundManager.tap(); edit(rowWork.row.map((l, j) => (j === i ? '' : l)));
  };

  const settle = (item: LetterBuildItem, correct: boolean, miss: LetterBuildMiss | undefined, words: string) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeLetterBuild(rowWork.row), correct, correct ? undefined : miss);
    if (correct && !practice) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  const check = async () => {
    const item = current;
    if (!item || blocked || !full) return;
    const row = rowWork.row, made = rowWork.made;
    const shape = letterShapeMiss(item, row, made);
    if (shape) { settle(item, false, shape, letterMissWords(shape, item)); return; }
    const opened = openCount.current;
    setPhase('checking'); setNotice('');
    let reading: WordBuildVerdict;
    try {
      reading = await askJudge(letterJudgeRequest(item, row, data.gradeLevel));
    } catch {
      if (opened !== openCount.current) return;
      setPhase('building'); setNotice('The word checker could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    const word = row.join('');
    if (reading.met && made.length + 1 < item.ways) {
      SoundManager.playCorrect();
      setWork({ item: item.id, row: startRow(item), made: [...made, word] });
      setVerdict({ met: true, words: `Yes! "${word}" is a word. Now make a different one.` });
      setPhase('building');
      return;
    }
    settle(item, reading.met, reading.met ? undefined : 'not_a_word',
      reading.met ? `Yes! "${word}" is a word.` : letterMissWords('not_a_word', item));
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const attemptsCount = results.reduce((s, r) => s + r.attempts, 0);
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    submitResult(solved === total, accuracy, metrics({ solved, total, accuracy, attemptsCount,
      firstTryCorrect: results.filter(r => r.correct && r.attempts === 1).length }) as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items.length, results, submitResult, progress.recordsEvaluation, metrics]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allDone || hasSubmitted || !current ? null : current.id,
    label: 'The letter boxes',
    solved: phase === 'checked' && !!verdict?.met,
    checking: phase === 'checking',
    handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = letterBuildScene(current, rowWork.row, rowWork.made, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = practice ? [] : letterBuildLevers(sessionItem, pulled);
    const onScreen = practice ? undefined : letterLeverFacts(pulled, sessionItem);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'The same ask with a smaller letter bank, one word, ungraded. The full item comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = smallBankFor(sessionItem);
          if (!easier) return 'There is no smaller bank for this item.';
          setLeverState(next); setVerdict(null); setPhase('building'); setPractice(easier);
          return { practice: letterAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setVerdict(null); setPhase('building'); setPractice(null); },
    };
  });

  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">No words to make.</LuminaCardContent></LuminaCard>;
  }
  const model = current && pulled.includes(MODEL_LEVER) ? modelFor(current) : null;
  const pattern = current && pulled.includes(PATTERN_LEVER) ? patternFor(current) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="cyan" className="text-xs">🔤 Make a word</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Words made!" celebrationMessage="You made real words out of letters." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="cyan">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Make a word</div>
                <div className="text-lg leading-snug">{current.ask}</div>
                {current.ways === 2 && <div className="text-sm text-slate-300">Then make a different one.</div>}
                {practice && <div className="text-xs text-amber-300">Practice with fewer letters</div>}
              </div>
            </LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {rowWork.made.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-300" data-testid="lb-made">
                  <span>Made:</span>
                  {rowWork.made.map(w => <span key={w} className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">{w}</span>)}
                </div>
              )}
              {pattern && (
                <LuminaPanel data-lever="pattern-card" className="p-2 text-center font-mono text-lg tracking-widest text-cyan-100">{pattern}</LuminaPanel>
              )}
              {model && (
                <LuminaPanel data-lever="model-word" className="p-2 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">Another word </span>
                  <span className="text-lg font-bold text-cyan-100">{model}</span>
                </LuminaPanel>
              )}

              <div role="group" aria-label="Your word" data-testid="lb-row" className="flex justify-center gap-3">
                {rowWork.row.map((l, i) => (
                  <button key={i} type="button" aria-label={`box ${i + 1}${l ? `, ${l}` : ', empty'}`} disabled={blocked || !l}
                    onClick={() => empty(i)}
                    className={`flex h-16 min-w-16 px-2 items-center justify-center rounded-2xl border-2 text-3xl font-bold transition ${l
                      ? 'border-cyan-300/60 bg-cyan-500/15 text-cyan-50 hover:opacity-80' : 'border-dashed border-white/25 bg-white/5 text-slate-500'}`}>
                    {l || ''}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Letters">
                {current.bank.map(l => (
                  <button key={l} type="button" aria-label={`letter ${l}`} disabled={blocked} onClick={() => place(l)}
                    className={`h-12 min-w-12 px-2 rounded-xl border text-2xl font-bold transition hover:brightness-125 disabled:opacity-40 ${VOWELS.includes(l[0])
                      ? 'border-rose-300/40 bg-rose-500/15 text-rose-100' : 'border-sky-300/40 bg-sky-500/15 text-sky-100'}`}>
                    {l}
                  </button>
                ))}
              </div>

              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">
                {notice || (phase === 'checking' ? 'Checking your word…' : '')}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <LuminaButton tone="ghost" onClick={() => edit(startRow(current))} disabled={blocked}>Start over</LuminaButton>
                <LuminaButton tone="primary" onClick={check} disabled={blocked || !full} className="px-8 text-lg font-bold">
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
