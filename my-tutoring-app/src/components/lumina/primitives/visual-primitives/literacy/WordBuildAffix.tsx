'use client';

/**
 * The word-part build surface — word-builder `build_affix` (prefix/root/suffix cards) and word-flip `build_inflect`
 * (base word + ending cards). The learner taps cards into a row to make a word for the ask, then presses "I'm done!".
 * The host's rules (`AffixBuildRules`: `affixBuild.ts` by default, `inflectBuild.ts` for word-flip) check the row in
 * code; a row that passes goes to the shared literacy judge (route `judgeWordBuild`), which reads the word against the
 * ask. Try again keeps the row and the verdict words; a new item opens an empty row. Mounted by its host for a build
 * payload, on the teaching workspace only. A host on the boss framework passes `boss`: its assignment and its bound
 * lever set replace the rules' (`rules.assignment`, `rules.levers`), and Pip comes from the runner.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TeachingAssignment, TeachingWorkspace, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { WordBuildVerdict, WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import {
  droppedBy, joined, maxRow, wordBuilderAffixRules, type AffixBuildItem, type AffixBuildRules, type AffixBuildSummary,
  type BuildPart,
} from './affixBuild';

const PART_COLORS: Record<string, string> = {
  prefix: 'bg-purple-500/15 border-purple-400/40 text-purple-100',
  root: 'bg-blue-500/15 border-blue-400/40 text-blue-100',
  suffix: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100',
};
const TYPE_TEXT: Record<string, string> = { prefix: 'text-purple-300', root: 'text-blue-300', suffix: 'text-emerald-300' };

/** The shared literacy judge, server side. */
async function askJudge(body: WordBuildJudgeRequest): Promise<WordBuildVerdict> {
  const res = await fetch('/api/lumina', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild', params: body }),
  });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<WordBuildVerdict>;
}

const progressHooks: Record<string, ReturnType<typeof useWorkspaceProgressFor>> = {};
const progressFor = (id: string) => (progressHooks[id] ??= useWorkspaceProgressFor(id));

/** word-builder's metrics, the default host. */
const wordBuilderMetrics = (s: AffixBuildSummary) => ({
  type: 'word-builder', complexityLevel: 'simple_affix', task: 'build_affix', wordsCompleted: s.solved, wordsTotal: s.total,
  accuracy: s.accuracy, attemptsCount: s.attemptsCount, firstTryCorrect: s.firstTryCorrect,
});

type Phase = 'building' | 'checking' | 'checked';
interface Work { item: string; row: BuildPart[]; made: string[] }

/** The fields the surface reads from its host's payload. */
export interface AffixBuildData {
  title: string;
  availableParts?: readonly BuildPart[];
  buildItems?: readonly AffixBuildItem[];
  supportTier?: string;
  gradeLevel?: string;
  instanceId?: string; skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<never>) => void;
}

export interface WordBuildAffixProps {
  data: AffixBuildData;
  className?: string;
  runtimePlanItemId?: string;
  /** The host primitive (progress and evaluation). Default word-builder. */
  primitiveId?: string;
  /** The host's domain. Default word-builder's `build_affix`. */
  rules?: AffixBuildRules;
  /** The host's metrics from the session summary. */
  metrics?: (s: AffixBuildSummary) => object;
  /** A boss host's wiring (`boss.ts`, `bossLevers.ts`): the assignment and the lever set bound to this lesson. */
  boss?: AffixBuildBoss;
}

/** What a boss host hands the surface in place of the rules' assignment and levers. */
export interface AffixBuildBoss {
  assignment: (item: AffixBuildItem) => TeachingAssignment;
  levers: {
    declare: (item: AffixBuildItem, pulled: readonly string[]) => WorkspaceLever[];
    onScreen: (item: AffixBuildItem, pulled: readonly string[]) => string;
    simpler: (item: AffixBuildItem, lever: string) => AffixBuildItem | null;
    support: (item: AffixBuildItem) => string;
  };
}

/** The answer region Pip watches: from the runner on a boss host, from the hand-wired surface otherwise. */
function PipRegion({ boss, hand, className, children }: { boss: boolean; hand: ReturnType<typeof useWorkspacePipSurface>['workspace'];
  className: string; children: React.ReactNode }) {
  return boss ? <PipWorkspace className={className}>{children}</PipWorkspace> : <div {...hand} className={className}>{children}</div>;
}

export default function WordBuildAffix({ data, className, runtimePlanItemId, primitiveId = 'word-builder',
  rules = wordBuilderAffixRules, metrics = wordBuilderMetrics, boss }: WordBuildAffixProps) {
  const assignment = boss?.assignment ?? rules.assignment;
  const { title, availableParts = [], instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(instanceId || `${primitiveId}-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const board = availableParts as BuildPart[];
  const items = useMemo(() => rules.items(data.buildItems ?? [], board, data.supportTier),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.buildItems, availableParts, data.supportTier, rules]);
  const phases = useMemo<Record<string, PhaseConfig>>(
    () => ({ [rules.phase.key]: { label: rules.phase.label, icon: rules.phase.icon, accentColor: 'purple' } }), [rules]);
  const useBuildProgress = progressFor(primitiveId);

  const [work, setWork] = useState<Work>({ item: '', row: [], made: [] });
  const [phase, setPhase] = useState<Phase>('building');
  const [verdict, setVerdict] = useState<{ met: boolean; words: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<AffixBuildItem | null>(null);
  /** Bumped on every item open, so a judge reply for an earlier row is dropped. */
  const openCount = useRef(0);

  const progress = useBuildProgress<AffixBuildItem>({
    challenges: items, getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment,
    // Try again keeps the row and the verdict words; a new item opens empty and drops any practice item.
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
  const onBoard = practice?.board ?? board;
  const rowWork = work.item === current?.id ? work : { item: current?.id ?? '', row: [] as BuildPart[], made: [] as string[] };
  const pulled = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const blocked = progress.canAttempt === false || phase === 'checking';

  const phaseResults = usePhaseResults({
    challenges: items, results, isComplete: allDone, getChallengeType: () => rules.phase.key, phaseConfig: phases,
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<never>({
    primitiveType: primitiveId as never, instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Building ─────────────────────────────────────────────────────────────
  const edit = (row: BuildPart[]) => {
    if (!current) return;
    setWork({ item: current.id, row, made: rowWork.made });
    if (phase === 'checked') setPhase('building');
    setNotice('');
  };
  const add = (p: BuildPart) => {
    if (blocked || rowWork.row.length >= maxRow) return;
    SoundManager.tap(); edit([...rowWork.row, p]);
  };
  const removeAt = (i: number) => {
    if (blocked) return;
    SoundManager.tap(); edit(rowWork.row.filter((_, j) => j !== i));
  };

  const settle = (item: AffixBuildItem, correct: boolean, miss: string | undefined, words: string) => {
    setVerdict({ met: correct, words }); setPhase('checked');
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(rules.describe(rowWork), correct, correct ? undefined : miss);
    if (correct && !practice) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: item.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  };

  /** "I'm done!": the rules' code check, then the judge. An accepted first way of a two-way item is kept, not committed. */
  const check = async () => {
    const item = current;
    if (!item || blocked || rowWork.row.length === 0) return;
    const view = { row: rowWork.row, made: rowWork.made };
    const shape = rules.shapeMiss(item, view.row, view.made);
    if (shape) { settle(item, false, shape, rules.missWords(shape, item)); return; }
    const opened = openCount.current;
    setPhase('checking'); setNotice('');
    let reading: WordBuildVerdict;
    try {
      reading = await askJudge(rules.judgeRequest(item, view, onBoard, data.gradeLevel));
    } catch {
      if (opened !== openCount.current) return;
      setPhase('building'); setNotice('The word checker could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    const word = joined(view.row);
    if (reading.met && view.made.length + 1 < item.ways) {
      SoundManager.playCorrect();
      setWork({ item: item.id, row: [], made: [...view.made, word] });
      setVerdict({ met: true, words: `Yes! "${word}" works. Now make a different word that means it too.` });
      setPhase('building');
      return;
    }
    settle(item, reading.met, reading.miss, reading.met ? `Yes! "${word}" fits.` : rules.missWords(reading.miss, item));
  };

  // ── Evaluation: submit once, under an evaluation provider ────────────────
  useEffect(() => {
    if (!allDone || hasSubmitted || !items.length || !progress.recordsEvaluation) return;
    const total = items.length;
    const solved = results.filter(r => r.correct).length;
    const attemptsCount = results.reduce((s, r) => s + r.attempts, 0);
    const accuracy = Math.round(results.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / total);
    const firstTryCorrect = results.filter(r => r.correct && r.attempts === 1).length;
    submitResult(solved === total, accuracy, metrics({ solved, total, accuracy, attemptsCount, firstTryCorrect }) as never,
      { challengeResults: results });
  }, [allDone, hasSubmitted, items.length, results, submitResult, progress.recordsEvaluation, metrics]);

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    // A boss host takes Pip from the runner (`<PipDock />`, `<PipWorkspace>`); the rules' default still wires it here.
    scopeId: boss || allDone || hasSubmitted || !current ? null : current.id,
    label: 'The word-part board',
    solved: phase === 'checked' && !!verdict?.met,
    checking: phase === 'checking',
    handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || !sessionItem) return;
    const scene = rules.scene(current, onBoard, rowWork, phase === 'checked' && verdict ? verdict.words : undefined);
    const levers = practice ? [] : boss ? boss.levers.declare(sessionItem, pulled) : rules.levers?.(sessionItem, board, pulled) ?? [];
    const practiceFact: Record<string, string> = practice ? { practice: 'The same ask on a smaller board, one word, ungraded. The full item comes back after it.' } : {};
    // A boss host's lever set writes the support and on-screen facts (`leverScene`); the rules' default writes its own.
    const published: WorkspaceScene = boss
      ? leverScene({ ...scene, facts: { ...scene.facts, ...practiceFact } }, {
        support: practice ? '' : boss.levers.support(sessionItem), onScreen: practice ? '' : boss.levers.onScreen(sessionItem, pulled) })
      : (() => { const onScreen = practice ? undefined : rules.leverFacts?.(pulled, sessionItem, board);
        return { ...scene, facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...practiceFact } }; })();
    workspace.current = {
      ...published,
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = boss ? boss.levers.simpler(sessionItem, id) : rules.smallBoardFor(sessionItem, board);
          if (!easier) return 'There is no smaller board for this item.';
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
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">No words to make.</LuminaCardContent></LuminaCard>;
  }
  const panel = sessionItem && !practice ? rules.panel(sessionItem, board, pulled) : null;
  const frame = current && !practice ? rules.frame(current, onBoard, pulled) : [];
  const label = (p: BuildPart) => rules.partLabel[p.type] ?? p.type;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!allDone && <LuminaBadge accent="purple" className="text-xs">{rules.badge}</LuminaBadge>}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {allDone && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? progress.teachingResult?.accuracy)}
            durationMs={elapsedMs} heading={rules.summary.heading} celebrationMessage={rules.summary.celebration} />
        )}

        {!allDone && current && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, items.length)} total={items.length} variant="dots" />
            </div>
            <LuminaPrompt accent="purple">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-300">Make a word</div>
                <div className="text-lg leading-snug">{current.ask}</div>
                {current.ways === 2 && <div className="text-sm text-slate-300">Then make a different word that means it too.</div>}
                {practice && <div className="text-xs text-amber-300">Practice on a smaller board</div>}
              </div>
            </LuminaPrompt>

            {boss ? <PipDock /> : pip.store && <div {...pip.dock} />}
            <PipRegion boss={!!boss} hand={pip.workspace} className="space-y-3">
              {rowWork.made.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-300" data-testid="wb-made">
                  <span>Made:</span>
                  {rowWork.made.map(w => <span key={w} className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">{w}</span>)}
                </div>
              )}

              {frame.length > 0 && (
                <div data-lever="part-frame" className="flex items-end justify-center gap-2">
                  {frame.map((box, i) => (
                    <React.Fragment key={`frame-${i}`}>
                      {i > 0 && <span className="pb-2 text-slate-500">+</span>}
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] font-mono uppercase tracking-widest ${TYPE_TEXT[box.type]}`}>{box.label}</span>
                        <div className="h-9 w-16 rounded-lg border border-dashed border-white/25 bg-white/5" />
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {panel && (
                <LuminaPanel data-lever={panel.lever} className="p-3 text-center">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">{panel.heading}</p>
                  {panel.note && <p className="mt-1 text-sm text-slate-300">{panel.note}</p>}
                  {panel.rows.map(([parts, word]) => (
                    <p key={word} className="mt-1 text-base text-cyan-100">
                      {parts} = <span className="font-bold">{word}</span>
                    </p>
                  ))}
                </LuminaPanel>
              )}

              <div role="group" aria-label="Your word" data-testid="wb-row"
                className="flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-900/40 p-3">
                {rowWork.row.length === 0 && <span className="text-sm text-slate-500">{rules.emptyRow}</span>}
                {rowWork.row.map((p, i) => {
                  // An ending that takes the place of the last letters shows them struck through (bab̶y̶ + ies).
                  const drop = droppedBy(rowWork.row, i);
                  return (
                    <button key={`${p.id}-${i}`} type="button" aria-label={`Take out ${p.text}`} disabled={blocked}
                      onClick={() => removeAt(i)}
                      className={`rounded-xl border px-3 py-2 text-lg font-bold transition hover:opacity-80 disabled:opacity-60 ${PART_COLORS[p.type]}`}>
                      {drop ? <>{p.text.slice(0, -drop)}<s data-dropped className="opacity-50">{p.text.slice(-drop)}</s></> : p.text}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" role="group" aria-label="Word parts">
                {onBoard.map(p => (
                  <button key={p.id} type="button" aria-label={['Add ' + p.text, label(p), p.meaning].filter(Boolean).join(', ')}
                    disabled={blocked || rowWork.row.length >= maxRow} onClick={() => add(p)}
                    className={`rounded-xl border p-2.5 text-center transition hover:brightness-125 disabled:opacity-40 ${PART_COLORS[p.type]}`}>
                    <span className="block text-base font-bold">{p.text}</span>
                    <span className="block text-[10px] font-mono uppercase opacity-60">{label(p)}</span>
                    {p.meaning && <span className="block text-xs opacity-85">{p.meaning}</span>}
                  </button>
                ))}
              </div>

              <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">
                {notice || (phase === 'checking' ? 'Checking your word…' : '')}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <LuminaButton tone="ghost" onClick={() => edit([])} disabled={blocked || !rowWork.row.length}>Clear</LuminaButton>
                <LuminaButton tone="primary" onClick={check} disabled={blocked || !rowWork.row.length} className="px-8 text-lg font-bold">
                  {phase === 'checking' ? 'Checking…' : "I'm done!"}
                </LuminaButton>
              </div>

              {verdict && (
                <LuminaFeedbackCard status={verdict.met ? 'correct' : 'incorrect'}>
                  <p className="text-base font-semibold">{verdict.words}</p>
                </LuminaFeedbackCard>
              )}
            </PipRegion>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
