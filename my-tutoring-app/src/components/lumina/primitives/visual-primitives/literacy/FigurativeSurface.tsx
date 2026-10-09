'use client';

/**
 * figurative-language-finder on the teaching workspace (rules in `figurativeSteps.ts`). Find items: the learner taps a
 * sentence of the passage and a kind of figure, then "I'm done!"; a tagged figure passes in code, any other pick goes
 * to the writing judge. Meaning items: the learner types what a phrase really means. Make items (`build_figurative`):
 * the learner writes their own figure. Nothing in the passage is marked until the learner finds it.
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
import type { WordBuildJudgeRequest, WordBuildVerdict } from '../../../service/build-layer/wordBuildDecision';
import {
  CLUE, FRAME, FRAME_LEVER, GUIDE_LEVER, MARK_LEVER, MODEL_FIGURE, MODEL_LEVER, askFor, figAssignment, figItems, figLevers,
  figMissWords, figScene, findJudgeRequest, findVerdict, judgedFind, judgedMiss, sentenceOf, sentencesOf, typeChoices,
  writtenJudgeRequest, writtenShapeMiss, type FigItem, type FigMiss, type FigPayload, type FigType, type Found,
} from './figurativeSteps';

const PHASES: Record<string, PhaseConfig> = {
  find: { label: 'Find', icon: '🔍', accentColor: 'purple' },
  meaning: { label: 'Meaning', icon: '💬', accentColor: 'cyan' },
  make: { label: 'Make', icon: '🎨', accentColor: 'amber' },
};
const useProgress = useWorkspaceProgressFor('figurative-language-finder');

async function askJudge(body: WordBuildJudgeRequest): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }) });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

export interface FigurativeSurfaceData extends FigPayload {
  title: string;
  gradeLevel?: string;
  instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void;
}
type Phase = 'working' | 'checking' | 'checked';
const article = (t: FigType) => (['alliteration', 'onomatopoeia', 'imagery'].includes(t) ? '' : /^[aeiou]/.test(t) ? 'an ' : 'a ');

export default function FigurativeSurface({ data, className, runtimePlanItemId }: { data: FigurativeSurfaceData; className?: string;
    runtimePlanItemId?: string; runtimeEvalMode?: string }) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `figurative-language-finder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const items = useMemo(() => figItems(data), [data]);
  const sentences = useMemo(() => sentencesOf(data.passage ?? ''), [data.passage]);
  const chips = useMemo(() => typeChoices(data), [data]);

  const [found, setFound] = useState<Found[]>([]);
  const [pick, setPick] = useState<{ sentence?: number; type?: FigType }>({});
  const [typed, setTyped] = useState<{ item: string; text: string }>({ item: '', text: '' });
  const [phase, setPhase] = useState<Phase>('working');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const openCount = useRef(0);

  const progress = useProgress<FigItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: figAssignment,
    onItemOpened: (_index, retry) => { openCount.current += 1; setPhase('working'); setNotice(''); if (!retry) { setVerdict(null); setPick({}); } },
  });
  const { currentIndex, results, isComplete } = progress;
  const allDone = isComplete || !!progress.practiceSummary;
  const current = items[currentIndex] ?? null;
  const text = typed.item === current?.id ? typed.text : '';
  const pulled = leverState.item === current?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';
  const marked = useMemo(() => new Set((data.instances ?? []).filter(i => !found.some(f => f.key === i.instanceId))
    .map(i => sentenceOf(sentences, i.text)).filter(n => n >= 0)), [data.instances, found, sentences]);

  const phaseResults = usePhaseResults({ challenges: items, results, isComplete: allDone, getChallengeType: i => i.kind, phaseConfig: PHASES });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: 'figurative-language-finder' as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const changed = () => { if (phase === 'checked') setPhase('working'); setNotice(''); };
  const type = (value: string) => { if (current) { setTyped({ item: current.id, text: value }); changed(); } };
  const choose = (next: { sentence?: number; type?: FigType }) => { if (blocked) return; SoundManager.tap(); setPick(p => ({ ...p, ...next })); changed(); };

  const settle = (item: FigItem, correct: boolean, miss: FigMiss | undefined, words: string, said: string) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(said, correct, correct ? undefined : miss);
    if (correct) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  const judge = async (body: WordBuildJudgeRequest): Promise<WordBuildVerdict | null> => {
    const opened = openCount.current;
    setPhase('checking');
    try {
      const v = await askJudge(body);
      return opened === openCount.current ? v : null;
    } catch {
      if (opened === openCount.current) { setPhase('working'); setNotice('The checker could not look just now. Press "I\'m done!" again.'); }
      return null;
    }
  };

  const check = async () => {
    const item = current;
    if (!item || blocked) return;
    if (item.kind === 'find') {
      const { sentence, type: t } = pick;
      if (sentence === undefined || !t) return;
      const said = `Picked sentence ${sentence + 1} ("${sentences[sentence]}") as ${t}`;
      const v = findVerdict(data, found, sentence, t);
      if (v !== 'judge') {
        if ('pass' in v) { setFound(f => [...f, v.pass]); settle(item, true, undefined, `Yes! "${v.pass.text}" is ${article(t)}${t}.`, said); }
        else settle(item, false, v.miss, figMissWords(v.miss, t), said);
        return;
      }
      const reading = await judge(findJudgeRequest(data, sentence, t, data.gradeLevel));
      if (!reading) return;
      if (reading.met) { setFound(f => [...f, judgedFind(sentence, t)]); settle(item, true, undefined, `Yes! That sentence has ${article(t)}${t}.`, said); }
      else { const miss = judgedMiss(); settle(item, false, miss, figMissWords(miss, t), said); }
      return;
    }
    if (!text.trim()) return;
    const said = `Wrote: "${text.trim()}"`;
    const shape = writtenShapeMiss(item, text);
    if (shape) { settle(item, false, shape, figMissWords(shape), said); return; }
    const reading = await judge(writtenJudgeRequest(item, text, data.passage, data.gradeLevel));
    if (!reading) return;
    const miss: FigMiss | undefined = reading.met ? undefined : reading.miss === 'wrong_meaning' ? 'wrong_job' : 'not_sense';
    settle(item, reading.met, miss, reading.met ? (item.kind === 'make' ? `Yes! That is ${article(item.device)}${item.device}.` : 'Yes! That is what it means.') : figMissWords(miss), said);
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    const finds = items.filter(i => i.kind === 'find').length;
    const meanings = results.filter(r => r.challengeId.startsWith('mean-'));
    submitResult(solved === total, accuracy, { type: 'figurative-language-finder', instancesTotal: finds, instancesFound: found.length,
      classificationsCorrect: found.length, classificationsTotal: finds,
      literalTranslationAccuracy: meanings.length ? Math.round(meanings.reduce((s, r) => s + (r.score ?? 0), 0) / meanings.length) : 0,
      typesEncountered: Array.from(new Set(found.map(f => f.type))), falsePositives: 0,
      attemptsCount: results.reduce((s, r) => s + r.attempts, 0) } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, items, results, submitResult, progress.recordsEvaluation, found.length]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId, scopeId: allDone || hasSubmitted || !current ? null : current.id, label: 'The passage',
    solved: phase === 'checked' && !!verdict?.met, checking: phase === 'checking', handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  useLayoutEffect(() => {
    if (!current) return;
    const scene = figScene(current, found, { sentence: pick.sentence !== undefined ? sentences[pick.sentence] : undefined, type: pick.type, written: text },
      phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = figLevers(current, pulled);
    const model = current.kind === 'find' ? MODEL_FIGURE[chips[0] ?? 'simile'] : MODEL_FIGURE[current.kind === 'meaning' ? current.type : current.device];
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(pulled.includes(MODEL_LEVER) ? { model: `${model.sentence} (${model.phrase}: ${model.means})` } : {}),
        ...(pulled.includes(MARK_LEVER) ? { onScreen: 'The sentences that still hold a figure are marked.' } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        setLeverState({ item: current.id, pulled: [...pulled, id] });
        if (id === FRAME_LEVER && current.kind === 'make' && !text.trim()) setTyped({ item: current.id, text: FRAME[current.device] });
        return true as const;
      },
    };
  });

  if (!items.length) return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">Nothing to find here.</LuminaCardContent></LuminaCard>;

  const foundIn = (n: number) => found.filter(f => f.sentence === n);
  const renderSentence = (s: string, n: number) => {
    const hits = foundIn(n);
    let body: React.ReactNode = s;
    const tagged = hits.find(h => h.text && s.toLowerCase().includes(h.text.toLowerCase()));
    if (tagged?.text) {
      const at = s.toLowerCase().indexOf(tagged.text.toLowerCase());
      body = <>{s.slice(0, at)}<span className="underline decoration-purple-300 decoration-2 underline-offset-4">{s.slice(at, at + tagged.text.length)}</span>{s.slice(at + tagged.text.length)}</>;
    }
    return <>{body}{hits.map(h => <LuminaBadge key={h.key} accent="purple" className="ml-1 text-[10px]">{h.type}</LuminaBadge>)}</>;
  };

  const model = current && (current.kind === 'find' ? MODEL_FIGURE[chips[0] ?? 'simile'] : MODEL_FIGURE[current.kind === 'meaning' ? current.type : current.device]);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && current && <LuminaBadge accent="purple" className="text-xs">{PHASES[current.kind].icon} {PHASES[current.kind].label}</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
            durationMs={elapsedMs} heading="Figures of speech done!" celebrationMessage="You read past the plain words." />
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="purple"><div className="text-lg leading-snug">{askFor(current)}</div></LuminaPrompt>
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {pulled.includes(MODEL_LEVER) && model && (
                <LuminaPanel data-lever="model-figure" className="p-2 text-sm text-slate-300">
                  <p>Example: {model.sentence}</p>
                  {current.kind === 'meaning' ? <p className="text-cyan-100">“{model.phrase}” means: {model.means}</p> : <p className="text-purple-100">The figure: “{model.phrase}”</p>}
                </LuminaPanel>
              )}
              {current.kind === 'find' && (
                <>
                  <div role="group" aria-label="Passage" data-testid="fig-passage" className="space-y-1 rounded-2xl border border-white/10 bg-slate-900/40 p-3 text-base leading-relaxed">
                    {sentences.map((s, n) => (
                      <button key={n} type="button" aria-label={`sentence ${n + 1}`} aria-pressed={pick.sentence === n} disabled={blocked}
                        onClick={() => choose({ sentence: n })}
                        className={`mr-1 inline rounded px-1 text-left transition ${pick.sentence === n ? 'bg-purple-500/30 text-white ring-1 ring-purple-300' : 'text-slate-200 hover:bg-white/10'} ${pulled.includes(MARK_LEVER) && marked.has(n) ? 'outline-dashed outline-1 outline-amber-300/70' : ''}`}>
                        {renderSentence(s, n)}
                      </button>
                    ))}
                  </div>
                  <div role="group" aria-label="Kinds" className="flex flex-wrap justify-center gap-2">
                    {chips.map(t => (
                      <button key={t} type="button" aria-label={`kind ${t}`} aria-pressed={pick.type === t} disabled={blocked} onClick={() => choose({ type: t })}
                        className={`rounded-xl border px-3 py-1.5 text-sm ${pick.type === t ? 'border-purple-300 bg-purple-500/25 text-white' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}>
                        <span className="font-semibold">{t}</span>
                        {pulled.includes(GUIDE_LEVER) && <span data-lever="device-guide" className="block text-[11px] text-slate-400">{CLUE[t]}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {current.kind === 'meaning' && (
                <LuminaPanel data-testid="fig-sentence" className="p-3 text-base text-slate-300">
                  {(() => { const at = current.sentence.toLowerCase().indexOf(current.phrase.toLowerCase());
                    return at < 0 ? current.sentence : <>{current.sentence.slice(0, at)}<mark className="rounded bg-cyan-500/25 px-1 text-cyan-50">{current.sentence.slice(at, at + current.phrase.length)}</mark>{current.sentence.slice(at + current.phrase.length)}</>; })()}
                </LuminaPanel>
              )}
              {current.kind === 'make' && pulled.includes(GUIDE_LEVER) && (
                <LuminaPanel data-lever="device-guide" className="p-2 text-sm text-amber-100">{`${article(current.device)}${current.device}`.replace(/^./, c => c.toUpperCase())} {CLUE[current.device]}.</LuminaPanel>
              )}
              {current.kind !== 'find' && (
                <textarea aria-label="Your sentence" value={text} disabled={blocked} rows={2} onChange={e => type(e.target.value)}
                  placeholder={current.kind === 'meaning' ? 'Say it in plain words' : 'Write your sentence'}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/50 p-3 text-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              )}
              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">{notice || (phase === 'checking' ? 'Checking…' : '')}</div>
              <div className="flex justify-center">
                <LuminaButton tone="primary" onClick={check} className="px-8 text-lg font-bold"
                  disabled={blocked || (current.kind === 'find' ? pick.sentence === undefined || !pick.type : !text.trim())}>
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
