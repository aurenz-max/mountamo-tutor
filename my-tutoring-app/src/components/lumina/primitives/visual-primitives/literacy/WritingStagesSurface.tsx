'use client';

/**
 * The writing steps on the teaching workspace (rules in `writingStages.ts`), for paragraph-architect's writing modes and
 * opinion-builder's OREO and CER. One sentence per step, typed; "I'm done!" runs the code checks, then the shared
 * writing judge. An accepted sentence joins the paragraph above and the next step opens; Try again keeps the draft.
 * The host passes its boss's assignment and lever set (paragraph-architect's, opinion-builder's).
 * Pip comes from the runner (`<PipDock />`, `<PipWorkspace>`).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TeachingAssignment, TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene, type LeverSet } from '../../../components/live-activity/bossLevers';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { WordBuildVerdict } from '../../../service/build-layer/wordBuildDecision';
import {
  MODEL_LEVER, STARTERS_LEVER, blankStarter, modelStep, stagesFor, writingJudgeRequest,
  writingMissWords, writingScene, writingShapeMiss, type WritingPayload, type WritingMiss, type WritingStage,
} from './writingStages';

const PHASES: Record<string, PhaseConfig> = { write: { label: 'Write a step', icon: '✍️', accentColor: 'emerald' } };
const progressHooks: Record<string, ReturnType<typeof useWorkspaceProgressFor>> = {};
const progressFor = (id: string) => (progressHooks[id] ??= useWorkspaceProgressFor(id));

async function askJudge(body: ReturnType<typeof writingJudgeRequest>): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }) });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

export interface WritingStagesData extends WritingPayload {
  title: string;
  gradeLevel?: string;
  /** Sets when the model lever comes (`supportFact`); easy also opens with the sentence starters on screen. */
  supportTier?: 'easy' | 'medium' | 'hard';
  instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void;
}
type Phase = 'writing' | 'checking' | 'checked';

/** The lever set a host passes: one over writing steps, or a wider one (paragraph-architect's) that includes them. */
export type WritingLevers = Pick<LeverSet<WritingStage, null>, 'declare' | 'onScreen' | 'support'>
  & { simpler: (item: WritingStage, ctx: null, lever: string) => unknown };

export default function WritingStagesSurface({ data, className, runtimePlanItemId, primitiveId = 'paragraph-architect',
  assignment, levers }: {
    data: WritingStagesData; className?: string; runtimePlanItemId?: string; runtimeEvalMode?: string; primitiveId?: string;
    assignment: (stage: WritingStage) => TeachingAssignment; levers: WritingLevers }) {
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `${primitiveId}-${Date.now()}`);
  const useProgress = progressFor(primitiveId);
  const resolvedInstanceId = instanceId || stableId.current;
  const stages = useMemo(() => stagesFor(data), [data]);

  const [paragraph, setParagraph] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ item: string; text: string }>({ item: '', text: '' });
  const [phase, setPhase] = useState<Phase>('writing');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<WritingStage | null>(null);
  const openCount = useRef(0);

  const progress = useProgress<WritingStage>({
    challenges: stages, getChallengeId: s => s.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment,
    onItemOpened: (_index, retry) => {
      openCount.current += 1;
      setPhase('writing'); setNotice('');
      if (retry) return;
      setVerdict(null); setPractice(null);
    },
  });
  const { currentIndex, results, isComplete } = progress;
  const allDone = isComplete || !!progress.practiceSummary;
  const sessionStage = stages[currentIndex] ?? null;
  const current = practice ?? sessionStage;
  const text = draft.item === current?.id ? draft.text : '';
  // Easy opens each step with the starters on screen.
  const starting = !practice && data.supportTier === 'easy' && (sessionStage?.starters.length ?? 0) > 0 ? [STARTERS_LEVER] : [];
  const pulled = !practice && leverState.item === sessionStage?.id ? [...starting, ...leverState.pulled] : starting;
  const blocked = progress.canAttempt === false || phase === 'checking';
  const blank = practice ? blankStarter(practice) : null;
  /** On the blank practice the typed words fill the starter's blank. */
  const sentence = blank ? blank.replace(/_{2,}/, text.trim()) : text;
  const model = current && pulled.includes(MODEL_LEVER) ? modelStep(current) : null;

  const phaseResults = usePhaseResults({ challenges: stages, results, isComplete: allDone, getChallengeType: () => 'write', phaseConfig: PHASES });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: primitiveId as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const type = (value: string) => {
    if (!current) return;
    setDraft({ item: current.id, text: value });
    if (phase === 'checked') setPhase('writing');
    setNotice('');
  };

  const settle = (stage: WritingStage, correct: boolean, miss: WritingMiss | undefined, words: string, said: string) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(`Wrote: "${said.trim()}"`, correct, correct ? undefined : miss);
    if (correct && !practice) {
      setParagraph(p => [...p, said.trim()]);
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: stage.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  const check = async () => {
    const stage = current;
    if (!stage || blocked || !text.trim()) return;
    const said = sentence;
    const shape = writingShapeMiss(said, stage.starters, paragraph);
    if (shape) { settle(stage, false, shape, writingMissWords(shape), said); return; }
    const opened = openCount.current;
    setPhase('checking');
    let reading: WordBuildVerdict;
    try { reading = await askJudge(writingJudgeRequest(stage, said, paragraph, data.gradeLevel)); }
    catch {
      if (opened !== openCount.current) return;
      setPhase('writing'); setNotice('The writing checker could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    const miss: WritingMiss | undefined = reading.met ? undefined : reading.miss === 'wrong_meaning' ? 'wrong_job' : 'not_sense';
    settle(stage, reading.met, miss, reading.met ? 'Yes! That sentence does the job.' : writingMissWords(miss), said);
  };

  useEffect(() => {
    if (!allDone || hasSubmitted || !stages.length || !progress.recordsEvaluation) return;
    const total = stages.length;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    submitResult(solved === total, accuracy, { type: primitiveId, paragraphType: data.paragraphType, stepsWritten: solved,
      stepsTotal: total, accuracy, attemptsCount: results.reduce((s, r) => s + r.attempts, 0) } as never, { challengeResults: results });
  }, [allDone, hasSubmitted, stages.length, results, submitResult, progress.recordsEvaluation, data.paragraphType]);

  useLayoutEffect(() => {
    if (!current || !sessionStage) return;
    const scene = writingScene(current, sentence, paragraph, phase === 'checked' && verdict ? verdict.words : undefined);
    const offered = practice ? [] : levers.declare(sessionStage, null, pulled);
    const published = leverScene(scene, {
      support: practice ? '' : levers.support(sessionStage, null),
      onScreen: practice ? '' : levers.onScreen(sessionStage, null, pulled),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts,
        ...(practice ? { practice: `Fill the blank in: ${blankStarter(practice)}. Ungraded; the full step comes back after it.` } : {}) },
      levers: offered,
      pullLever: (id: string) => {
        const lever = offered.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this step.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionStage.id, pulled: [...(leverState.item === sessionStage.id ? leverState.pulled : []), id] };
        if (lever.kind === 'simplify') {
          const easier = levers.simpler(sessionStage, null, id) as WritingStage | null;
          if (!easier) return `No lever ${id} on this step.`;
          setLeverState(next); setVerdict(null); setPhase('writing'); setPractice(easier);
          return { practice: assignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setVerdict(null); setPhase('writing'); setPractice(null); },
    };
  });

  if (!stages.length) return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">Nothing to write.</LuminaCardContent></LuminaCard>;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="emerald" className="text-xs">✍️ {data.paragraphType} paragraph</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <>
            <LuminaPanel data-testid="ws-final" className="p-3 text-base text-slate-100">{paragraph.join(' ')}</LuminaPanel>
            <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? progress.teachingResult?.accuracy)}
              durationMs={elapsedMs} heading="Paragraph written!" celebrationMessage="You wrote a whole paragraph, one step at a time." />
          </>
        )}
        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, stages.length)} total={stages.length} variant="dots" />
            </div>
            <LuminaPanel data-testid="ws-paragraph" className="min-h-12 p-3 text-base text-slate-200">
              {paragraph.length ? paragraph.join(' ') : <span className="text-sm text-slate-500">Your paragraph will grow here.</span>}
            </LuminaPanel>
            <LuminaPrompt accent="emerald">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Topic: {current.topic}</span>
                {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
              </div>
              <div className="text-lg leading-snug">{current.ask}</div>
              {practice && blank && <div className="mt-1 text-sm text-amber-300">Practice: finish this starter: {blank}</div>}
            </LuminaPrompt>
            <PipDock />
            <PipWorkspace className="space-y-3">
              {model && (
                <LuminaPanel data-lever="model-step" className="p-2 text-center text-cyan-100">Another topic: {model}</LuminaPanel>
              )}
              <textarea aria-label="Your sentence" value={text} disabled={blocked} rows={2} onChange={e => type(e.target.value)}
                placeholder={blank ? 'Type the missing words' : 'Type your sentence'}
                className="w-full rounded-xl border border-white/15 bg-slate-900/50 p-3 text-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              {pulled.includes(STARTERS_LEVER) && (
                <div data-lever="sentence-starters" className="flex flex-wrap gap-2">
                  {current.starters.map(s => (
                    <button key={s} type="button" disabled={blocked} onClick={() => type(s)}
                      className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">{s}</button>
                  ))}
                </div>
              )}
              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">{notice || (phase === 'checking' ? 'Checking your sentence…' : '')}</div>
              <div className="flex justify-center">
                <LuminaButton tone="primary" onClick={check} disabled={blocked || !text.trim()} className="px-8 text-lg font-bold">
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
