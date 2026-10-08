'use client';

/**
 * rhyme-studio `pair_build` surface (rules in `rhymePairBuild.ts`). Eight pictures, no print; tap two into the pair
 * tray, press "I'm done!". Checked in code from the pictures' known rimes. Try again keeps the tray and the verdict
 * words; a new item opens an empty tray. Mounted by RhymeStudio for a `task: 'pair_build'` payload, on the teaching
 * workspace only.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { RhymeStudioMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import {
  ASK, MODEL_LEVER, describePair, modelPairFor, pairAssignment, pairItemsFrom, pairKey, pairLeverFacts, pairLevers,
  pairMiss, pairMissWords, pairScene, pictureOf, sayNameRequest, smallBoardFor, type RhymePairItem,
} from './rhymePairBuild';

const PHASES: Record<string, PhaseConfig> = { pair_build: { label: 'Rhyme pairs', icon: '🎵', accentColor: 'amber' } };
const useProgress = useWorkspaceProgressFor('rhyme-studio');

export interface RhymePairData {
  title: string;
  task: 'pair_build';
  pairItems: RhymePairItem[];
  supportTier?: 'easy' | 'medium' | 'hard';
  instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RhymeStudioMetrics>) => void;
}

type Phase = 'building' | 'checking' | 'checked';
interface Work { item: string; pair: string[]; made: string[] }

export default function RhymePairSurface({ data, className, runtimePlanItemId }: { data: RhymePairData; className?: string; runtimePlanItemId?: string }) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `rhyme-studio-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => pairItemsFrom(data.pairItems ?? [], data.supportTier), [data.pairItems, data.supportTier]);

  const [work, setWork] = useState<Work>({ item: '', pair: [], made: [] });
  const [phase, setPhase] = useState<Phase>('building');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<RhymePairItem | null>(null);

  const progress = useProgress<RhymePairItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: pairAssignment,
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
  const w = work.item === current?.id ? work : { item: current?.id ?? '', pair: [] as string[], made: [] as string[] };
  const pulled = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';

  const phaseResults = usePhaseResults({
    challenges: items, results, isComplete: allDone, getChallengeType: () => 'pair_build', phaseConfig: PHASES,
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<RhymeStudioMetrics>({
    primitiveType: 'rhyme-studio', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const edit = (pair: string[]) => {
    if (!current) return;
    setWork({ item: current.id, pair, made: w.made });
    if (phase === 'checked') setPhase('building');
  };
  const toggle = (word: string) => {
    if (blocked) return;
    if (w.pair.includes(word)) { SoundManager.tap(); edit(w.pair.filter(x => x !== word)); return; }
    if (w.pair.length >= 2) return;
    SoundManager.tap(); edit([...w.pair, word]);
  };
  const sayName = (word: string) => ctx.sendText(sayNameRequest(word), { silent: true, author: 'host' });

  const check = () => {
    const item = current;
    if (!item || blocked || w.pair.length !== 2) return;
    const miss = pairMiss(w.pair, w.made);
    if (!miss && w.made.length + 1 < item.ways) {
      SoundManager.playCorrect();
      setWork({ item: item.id, pair: [], made: [...w.made, pairKey(w.pair)] });
      setVerdict({ met: true, words: `Yes! ${w.pair[0]} and ${w.pair[1]} rhyme. Now find a different pair.` });
      return;
    }
    const correct = !miss;
    setVerdict({ met: correct, words: correct ? `Yes! ${w.pair[0]} and ${w.pair[1]} rhyme.` : pairMissWords(miss) });
    setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describePair(w.pair), correct, miss);
    if (correct && !practice) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const attemptsCount = results.reduce((s, r) => s + r.attempts, 0);
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    submitResult(solved === total, accuracy, {
      type: 'rhyme-studio', challengeMode: 'pair_build', challengesCorrect: solved, challengesTotal: total,
      recognitionAccuracy: accuracy, identificationAccuracy: 0, productionAccuracy: 0, collectionAccuracy: 0,
      rhymeFamiliesPracticed: Array.from(new Set(items.flatMap(i => i.board.map(b => pictureOf(b)!.rime)))), attemptsCount,
    }, { challengeResults: results });
  }, [allDone, hasSubmitted, items, results, submitResult, progress.recordsEvaluation]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allDone || hasSubmitted || !current ? null : current.id,
    label: 'The picture board',
    solved: phase === 'checked' && !!verdict?.met,
    checking: phase === 'checking',
    handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = pairScene(current, w.pair, w.made, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = practice ? [] : pairLevers(sessionItem, pulled);
    const onScreen = practice ? undefined : pairLeverFacts(pulled, sessionItem);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'A smaller board of four pictures with one rhyming pair, ungraded. The full board comes back after it.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = smallBoardFor(sessionItem);
          if (!easier) return 'There is no smaller board for this item.';
          setLeverState(next); setVerdict(null); setPhase('building'); setPractice(easier);
          return { practice: pairAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setVerdict(null); setPhase('building'); setPractice(null); },
    };
  });

  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">No rhyme boards.</LuminaCardContent></LuminaCard>;
  }
  const model = current && pulled.includes(MODEL_LEVER) ? modelPairFor(current) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="amber" className="text-xs">🎵 Rhyme pairs</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Rhymes found!" celebrationMessage="You found pictures whose names end the same." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="amber">
              <div className="text-lg leading-snug">{ASK}</div>
              {current.ways === 2 && <div className="text-sm text-slate-300">Then find a different pair.</div>}
              {practice && <div className="text-xs text-amber-300">Practice board</div>}
            </LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {w.made.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-2xl" data-testid="rp-made">
                  {w.made.map(m => <span key={m} className="rounded-full bg-emerald-500/15 px-3 py-1">{m.split('+').map(x => pictureOf(x)!.emoji).join(' ')}</span>)}
                </div>
              )}
              {model && (
                <LuminaPanel data-lever="model-pair" className="p-2 text-center text-3xl">{model[0].emoji} {model[1].emoji}</LuminaPanel>
              )}

              <div role="group" aria-label="Pair tray" data-testid="rp-tray"
                className="mx-auto flex w-fit gap-3 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                {[0, 1].map(i => {
                  const word = w.pair[i];
                  return word
                    ? <button key={i} type="button" aria-label={`take back ${word}`} disabled={blocked} onClick={() => toggle(word)}
                        className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-amber-300/60 bg-amber-500/10 text-5xl">{pictureOf(word)!.emoji}</button>
                    : <div key={i} className="h-20 w-20 rounded-xl border-2 border-dashed border-white/25 bg-white/5" />;
                })}
              </div>

              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Pictures">
                {current.board.map(word => (
                  <div key={word} className="relative">
                    <button type="button" aria-label={`picture ${word}`} aria-pressed={w.pair.includes(word)} disabled={blocked}
                      onClick={() => toggle(word)}
                      className={`flex h-24 w-full items-center justify-center rounded-2xl border text-5xl transition disabled:opacity-50 ${w.pair.includes(word)
                        ? 'border-amber-300 bg-amber-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      {pictureOf(word)!.emoji}
                    </button>
                    <button type="button" aria-label={`say ${word}`} onClick={() => sayName(word)}
                      className="absolute right-1 top-1 rounded-full bg-slate-900/70 px-1.5 text-sm">🔊</button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <LuminaButton tone="ghost" onClick={() => edit([])} disabled={blocked || !w.pair.length}>Clear</LuminaButton>
                <LuminaButton tone="primary" onClick={check} disabled={blocked || w.pair.length !== 2} className="px-8 text-lg font-bold">
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
