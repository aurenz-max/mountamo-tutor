'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { OpenBuilderMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import {
  BLOCKS, BLOCK_COLORS, BLOCK_KINDS, COLOR_NAMES, COLS, SCENES, dropRow, placeBlock,
  type BlockColor, type BlockKind, type OpenBuilderChallenge, type OpenBuilderTask, type OpenBuilderVerdict, type Placed,
} from './openBuilderModel';
import { describeBuildWork, openBuilderAssignment, openBuilderScene } from './openBuilderWorkspace';
import { BlockThumb, BuilderBoard } from './OpenBuilderArt';
import {
  MARKS_LEVER, PARTS_LEVER, PRACTICE_NOTE, goalParts, jobMarks, openBuilderLevers, partsFact, practiceItem,
} from './openBuilderLevers';
import { svgPicture, useBuildWatcher } from '../../build-layer/buildLayer';

export type { OpenBuilderChallenge } from './openBuilderModel';

// ============================================================================
// Data contract
// ============================================================================

export interface OpenBuilderData {
  title: string;
  description: string;
  /** 1-12 building projects, each set in one of the code's scenes. REQUIRED. */
  challenges: OpenBuilderChallenge[];
  challengeType: OpenBuilderTask;
  gradeBand: 'K-2' | '3-5';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OpenBuilderMetrics>) => void;
}

interface OpenBuilderProps {
  data: OpenBuilderData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build_to_goal: { label: 'Build to the goal', icon: '🧱', accentColor: 'amber' },
};

/** The building buddy: the server judge looks at a picture of the board. */
async function askBuddy(c: OpenBuilderChallenge, image: string): Promise<OpenBuilderVerdict> {
  const res = await fetch('/api/lumina', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeOpenBuild', params: { sceneId: c.sceneId, goal: c.goal, image } }),
  });
  if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
  return res.json() as Promise<OpenBuilderVerdict>;
}

// ============================================================================
// Component
// ============================================================================

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useOpenBuilderProgress = useWorkspaceProgressFor('open-builder');

type Phase = 'building' | 'checking' | 'checked';

const OpenBuilderSurface: React.FC<OpenBuilderProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId, exhibitId,
    onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const boardRef = useRef<SVGSVGElement | null>(null);
  const stableInstanceId = useRef(instanceId || `open-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [placed, setPlaced] = useState<Placed[]>([]);
  const [kind, setKind] = useState<BlockKind>('small');
  const [color, setColor] = useState<BlockColor>('coral');
  const [ghostCol, setGhostCol] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('building');
  const [verdict, setVerdict] = useState<OpenBuilderVerdict | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  /** Bumped on every item open, so a judge reply for an earlier build is dropped. */
  const openCount = useRef(0);
  // In-item levers (`openBuilderLevers.ts`), keyed by the session item they were pulled on, and the smaller practice
  // project a simplify lever puts in place of the session item until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<OpenBuilderChallenge | null>(null);
  /** An empty board with nothing said about it: a fresh project, a practice project, or the full one back after it. */
  const clearBoard = () => {
    openCount.current += 1;
    setPhase('building'); setNotice(''); setGhostCol(null); setPlaced([]); setVerdict(null); setPicture(null);
  };

  const progress = useOpenBuilderProgress<OpenBuilderChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: openBuilderAssignment,
    // A fresh project starts on an empty board. Try again keeps the build AND the buddy's words on screen,
    // so the learner changes what the buddy pointed at instead of starting over.
    onItemOpened: (_index, retry) => {
      if (retry) { openCount.current += 1; setPhase('building'); setNotice(''); setGhostCol(null); return; }
      setPractice(null); clearBoard();
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || phase === 'checking';
  const sessionChallenge = challenges[currentIndex] ?? null;
  const current = practice ?? sessionChallenge;
  const scene = current ? SCENES[current.sceneId] : null;
  const pulledLevers = sessionChallenge && leverState.item === sessionChallenge.id ? leverState.pulled : [];
  // The session item's levers; a help picture shows on the session item only while pulled (or from the start on easy).
  const itemLevers = sessionChallenge ? openBuilderLevers(sessionChallenge, challenges, pulledLevers) : [];
  const helpOn = (id: string) => !practice && itemLevers.some(l => l.id === id && l.pulled);
  const shownMarks = sessionChallenge && helpOn(MARKS_LEVER) ? jobMarks(sessionChallenge) : null;
  const shownParts = sessionChallenge && helpOn(PARTS_LEVER) ? goalParts(sessionChallenge) : null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<OpenBuilderMetrics>({
    primitiveType: 'open-builder', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Building ──────────────────────────────────────────────────────────────
  /** Any change to the build after a check reopens building. The buddy's words stay until the next check. */
  const changed = () => { if (phase === 'checked') setPhase('building'); setNotice(''); };

  const drop = useCallback((col: number) => {
    if (blocked || !scene) return;
    const at = Math.max(0, Math.min(col, COLS - BLOCKS[kind].w));
    const next = placeBlock(scene, placed, kind, color, at);
    if ('error' in next) { SoundManager.playIncorrect?.(); setNotice(next.error); return; }
    SoundManager.tap();
    setPlaced(next); changed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, scene, placed, kind, color, phase]);

  const undo = useCallback(() => {
    if (blocked || !placed.length) return;
    SoundManager.tap();
    setPlaced(p => p.slice(0, -1)); changed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, placed.length, phase]);

  const startOver = useCallback(() => {
    if (blocked || !placed.length) return;
    setPlaced([]); changed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, placed.length, phase]);

  // ── The buddy's reading of a picture of the board is the check ───────────
  const check = useCallback(async () => {
    if (!current || blocked || !placed.length || !boardRef.current) return;
    const challenge = current, build = placed, opened = openCount.current;
    setPhase('checking'); setNotice(''); setGhostCol(null);
    let reading: OpenBuilderVerdict;
    try {
      const image = await svgPicture(boardRef.current);
      if (opened === openCount.current) setPicture(image);
      reading = await askBuddy(challenge, image);
    } catch {
      if (opened !== openCount.current) return;
      setPhase('building'); setNotice('Your building buddy could not look just now. Press "I\'m done!" again.');
      return;
    }
    if (opened !== openCount.current) return;
    setVerdict(reading); setPhase('checked');
    if (reading.met) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeBuildWork(challenge, build), reading.met, reading.met ? undefined : reading.miss);
    // A practice project is ungraded: its success records nothing for the session.
    if (reading.met && !practice) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: challenge.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  }, [current, blocked, placed, progress, practice]);

  // ── The watcher: one live line once the learner pauses (shared build layer) ──
  const seeing = useBuildWatcher({
    buildKey: placed.map(p => `${p.kind}${p.color}${p.col},${p.row}`).join('|'),
    enabled: !!current && phase === 'building' && placed.length > 0,
    svg: boardRef,
    request: { task: current?.goal ?? '', sceneNote: scene?.sceneNote ?? '', numbers: 'allowed' },
  });

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: OpenBuilderMetrics = {
      type: 'open-builder', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation]);

  // ── Pip: the board as a whole; the build is handed to the buddy ───────────
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmitted || !current ? null : current.id,
    label: 'The building board',
    solved: phase === 'checked' && !!verdict?.met,
    checking: phase === 'checking',
    handover: true,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || !sessionChallenge) return;
    const base = openBuilderScene(current, { placed, phase, verdict: phase === 'checking' ? null : verdict, seeing: phase === 'building' ? seeing : '' });
    const onScreen = [shownMarks?.fact, shownParts && partsFact(shownParts)].filter(Boolean).join('; ');
    const levers = practice ? [] : itemLevers;
    workspace.current = {
      ...base,
      facts: { ...base.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this project.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const smaller = practiceItem(sessionChallenge, challenges);
          if (!smaller) return 'This project is already the smallest job of its kind.';
          setLeverState(next); setPractice(smaller); clearBoard();
          return { practice: openBuilderAssignment(smaller) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full project on an empty board: the practice build is not the learner's work on it.
      endPractice: () => { setPractice(null); clearBoard(); },
    };
  });

  // ── Keyboard on the board: arrows move the drop column, Enter drops, U undoes ──
  const onBoardKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setGhostCol(c => Math.max(0, Math.min(COLS - 1, (c ?? 0) + (e.key === 'ArrowLeft' ? -1 : 1))));
    } else if ((e.key === 'Enter' || e.key === ' ') && ghostCol !== null) {
      e.preventDefault(); drop(ghostCol);
    } else if (e.key === 'u' || e.key === 'U') undo();
  };

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No building projects.</LuminaCardContent></LuminaCard>;
  }

  const ghost = !blocked && scene && ghostCol !== null ? (() => {
    const col = Math.max(0, Math.min(ghostCol, COLS - BLOCKS[kind].w));
    const at = dropRow(scene, placed, kind, col);
    return { kind, color, col, row: 'error' in at ? null : at.row };
  })() : null;
  const showVerdict = verdict && phase !== 'checking';
  const stale = phase === 'building' && !!verdict;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? localScore} durationMs={elapsedMs}
            heading="Projects Complete!" celebrationMessage="You built every project!" className="mb-6" />
        )}

        {!allChallengesComplete && current && scene && (
          <>
            <LuminaPrompt accent="amber">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">{current.title}</div>
                <div className="text-lg leading-snug">{current.goal}</div>
              </div>
            </LuminaPrompt>

            {practice && <div className="text-center text-xs text-amber-300" data-practice>Practice project</div>}
            {shownParts && (
              // The help lever `goal_parts`: a card for each part the goal names, never a block, a count or a place.
              <div className="flex flex-wrap items-stretch justify-center gap-2" data-lever="goal-parts" aria-label="What the goal asks for">
                {shownParts.map((p, i) => (
                  <div key={i} data-part className="flex min-w-16 flex-col items-center gap-0.5 rounded-xl border border-amber-300/40 bg-amber-300/10 px-2 py-1.5">
                    <span className="text-2xl" aria-hidden>{p.glyph}</span>
                    <span className="text-xs text-slate-100">{p.word}</span>
                  </div>
                ))}
              </div>
            )}
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              <div className="space-y-3">
                  <div role="group" aria-label={`Building board: ${scene.title}`} tabIndex={0} onKeyDown={onBoardKey}
                    className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    onMouseLeave={() => setGhostCol(null)}>
                    <BuilderBoard ref={boardRef} scene={scene} placed={placed} ghost={ghost} marks={shownMarks?.marks} />
                    {!blocked && (
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: COLS }, (_, col) => (
                          <button key={col} type="button" aria-label={`Drop in column ${col + 1}`}
                            className="h-full flex-1 cursor-pointer bg-transparent outline-none hover:bg-white/10 focus-visible:bg-white/15"
                            onMouseEnter={() => setGhostCol(col)} onFocus={() => setGhostCol(col)}
                            onClick={() => drop(col)} />
                        ))}
                      </div>
                    )}
                  </div>

                <LuminaPanel className="space-y-2 p-3">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {BLOCK_KINDS.map(k => (
                      <button key={k} type="button" aria-label={`Choose ${BLOCKS[k].name.toLowerCase()}`} aria-pressed={kind === k}
                        disabled={blocked} onClick={() => { SoundManager.select(); setKind(k); setNotice(''); }}
                        className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-1.5 transition ${kind === k
                          ? 'border-amber-300 bg-amber-300/15' : 'border-white/10 bg-white/5 hover:bg-white/10'} disabled:opacity-40`}>
                        <BlockThumb kind={k} color={color} />
                        <span className="text-[11px] leading-tight text-slate-100">{BLOCKS[k].name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Colors">
                    {COLOR_NAMES.map(c => (
                      <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} disabled={blocked}
                        onClick={() => { SoundManager.select(); setColor(c); }}
                        className={`h-8 w-8 rounded-full border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ background: BLOCK_COLORS[c].fill }} />
                    ))}
                  </div>
                </LuminaPanel>

                  <div className="flex min-h-8 items-center justify-center gap-2 text-center" aria-live="polite" data-testid="ob-watcher">
                    {seeing && phase === 'building' && !notice && (
                      <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {seeing}</span>
                    )}
                  </div>

                  <div className="min-h-5 text-center text-sm text-slate-300" aria-live="polite">
                    {notice || (phase === 'checking' ? 'Your building buddy is looking at your build…'
                      : placed.length ? 'Keep building, or press "I\'m done!" when it is ready.'
                      : 'Pick a block, then tap the board to drop it.')}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <LuminaButton tone="ghost" aria-label="Undo" onClick={undo} disabled={blocked || !placed.length}>↶ Undo</LuminaButton>
                    <LuminaButton tone="ghost" onClick={startOver} disabled={blocked || !placed.length}>Start over</LuminaButton>
                    <LuminaButton tone="primary" onClick={check} disabled={blocked || !placed.length} className="px-8 text-lg font-bold">
                      {phase === 'checking' ? 'Looking…' : "I'm done!"}
                    </LuminaButton>
                  </div>

                  {showVerdict && (
                    <div className={stale ? 'opacity-80' : undefined}>
                      <LuminaFeedbackCard status={verdict.met ? 'correct' : 'incorrect'}>
                        <div className="space-y-1">
                          {verdict.noticed && <p>{verdict.noticed}</p>}
                          {verdict.met ? <p className="font-semibold">You did it!</p>
                            : verdict.nudge && <p className="text-base font-semibold">{verdict.nudge}</p>}
                        </div>
                      </LuminaFeedbackCard>
                    </div>
                  )}
              </div>

              {process.env.NODE_ENV !== 'production' && picture && (
                <details className="text-xs text-slate-400">
                  <summary className="cursor-pointer">What the building buddy saw (dev)</summary>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="The picture sent to the judge" src={`data:image/png;base64,${picture}`} className="mt-2 w-full max-w-md rounded-lg" />
                </details>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const OpenBuilder = withWorkspaceOnly<OpenBuilderProps>('open-builder', OpenBuilderSurface, props => props.data.title);

/**
 * Building projects run only on the teaching workspace: the tutor is present, the buddy's reading of a
 * picture of the board is the check, and the runtime moves to the next project. Outside a bound session
 * the "needs the tutor" card shows.
 */
export default OpenBuilder;
