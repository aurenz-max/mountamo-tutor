'use client';

/**
 * Tower Stacker - build a tower that stays up (K-5 engineering: stability, balance point, wind loads).
 *
 * Three open builds (/add-eval-modes references/build-mode.md), each on an EMPTY building area with a green goal line:
 * - `build_tall`: reach the line and stay standing.
 * - `build_few`: reach the line with no more than N pieces (a beam stood on end is 4 tall).
 * - `build_windproof`: reach the line and stay up when the strong wind blows.
 * The learner picks a piece, may turn it, and taps a column to drop it; it falls until it rests on what is under it.
 * "I'm done!" tests the tower with code (`towerMiss`): plain statics, and on windproof a wind load. Many towers pass.
 * Code owns every target (`towerChallenges`); the model writes only the title.
 *
 * On the shared teaching workspace (W1) every check commits through `progress.commitCheck` with the tower in words and
 * a named miss; the runtime owns progression, so the scripted Next is hidden there and the scored session is
 * submitted from `onFinished`.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaActionButton, LuminaButton, LuminaCallout, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaFeedbackCard,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult, type TowerStackerMetrics } from '../../../evaluation';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import {
  PIECE_KINDS, PIECES, WATCH_NEVER_SAY, blownCut, describeTower, dropPiece, fallingPart, leftEdgeFor, pieceSize, restingOn,
  towerCuts, towerMiss, workspaceAssignment, workspaceScene,
  type PieceKind, type TowerChallenge, type TowerMiss, type TowerMode, type TowerPiece,
} from './towerWorkspace';
import { BALANCE_LEVER, COUNT_LEVER, GUST_LEVER, leverFacts, shorterTower, towerLevers } from './towerLevers';
import { TowerScene, type FallingPart } from './TowerScene';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type { TowerChallenge, TowerMode, TowerPiece } from './towerWorkspace';

export interface TowerStackerData {
  title: string;
  description?: string;
  /** The eval mode pinned for this session; 'mixed' when the session holds every tier the band builds. */
  challengeType?: TowerMode | 'mixed';
  /** The towers to build, written by code (`towerChallenges`). */
  challenges: TowerChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TowerStackerMetrics>) => void;
}

export interface TowerStackerProps {
  data: TowerStackerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  build_tall: { label: 'Tall towers', icon: '🏗️', accentColor: 'amber' },
  build_few: { label: 'Few pieces', icon: '🧱', accentColor: 'orange' },
  build_windproof: { label: 'Windproof', icon: '💨', accentColor: 'blue' },
};

/** Per-tower score: 100 first try, then -20 per extra attempt, floored at 20. */
const phaseScore = (attempts: number) => (attempts <= 0 ? 0 : Math.max(20, 100 - (attempts - 1) * 20));

/** The check's words: what happened, never where a piece should go or what would hold it. */
const TOWER_FEEDBACK: Record<TowerMiss, string> = {
  tips_over: 'Not yet. Part of your tower tipped over. Look at what is holding that part up.',
  too_short: 'Not yet. Your tower does not reach the green line.',
  too_many_pieces: 'Not yet. Your tower uses more pieces than the job allows.',
  blown_over: 'Not yet. The wind blew part of your tower over.',
};
const PASS_FEEDBACK: Record<TowerMode, string> = {
  build_tall: 'Yes! Your tower reaches the line and stands.',
  build_few: 'Yes! Your tower reaches the line with few enough pieces.',
  build_windproof: 'Yes! Your tower stood up to the wind.',
};

// ============================================================================
// Component
// ============================================================================

const TowerStackerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  TowerStackerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<TowerChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const challenges = useMemo(() => (data.challenges ?? []).filter(c => PHASE_CONFIG[c.type]), [data.challenges]);

  const stableInstanceId = useRef(instanceId || `tower-stacker-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Challenge progress. On the workspace path the runtime moves the index. ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: c => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, results, isComplete, mergeResult, advance } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  // Levers (`towerLevers.ts`), keyed by the session item they were pulled on, and the easier ask a simplify lever put
  // on screen in its place. The item starts bare: no lever comes from the tier.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<TowerChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ── Per-item state ────────────────────────────────────────────
  const [pieces, setPieces] = useState<TowerPiece[]>([]);
  const [selected, setSelected] = useState<PieceKind | null>(null);
  const [turned, setTurned] = useState(false);
  const [hoverColumn, setHoverColumn] = useState<number | null>(null);
  /** The part that fell at the last check or gust, drawn turned until the build changes. */
  const [falling, setFalling] = useState<FallingPart | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [gust, setGust] = useState<'held' | 'blew' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);
  const recordedRef = useRef(false);
  const nextId = useRef(0);

  const resetFor = useRef<string | null>(null);
  const resetItem = (challenge: TowerChallenge) => {
    resetFor.current = challenge.id;
    setPieces([]); setSelected(null); setTurned(false); setFalling(null); setHint(null); setGust(null);
    setFeedback(null); setAttempts(0); setChallengeDone(false);
    recordedRef.current = false;
  };
  useEffect(() => {
    if (currentChallenge && resetFor.current !== currentChallenge.id) resetItem(currentChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // Workspace path: a fresh item ends any practice. Try again KEEPS the tower and the verdict's words, so the learner
  // revises it; the fallen part stands back up.
  openItem.current = (index, retry) => {
    if (!retry) {
      setPractice(null);
      if (challenges[index]) resetItem(challenges[index]);
      return;
    }
    setFalling(null); setGust(null);
  };

  // ── Evaluation ────────────────────────────────────────────────
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<TowerStackerMetrics>({
    primitiveType: 'tower-stacker',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const phaseResults = usePhaseResults({
    challenges, results, isComplete,
    getChallengeType: c => c.type,
    phaseConfig: PHASE_CONFIG,
    getScore: rs => (rs.length ? Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length) : 0),
  });

  const sessionMetrics = (built: number, accuracy: number, attemptsCount: number, firstTry: number): TowerStackerMetrics => ({
    type: 'tower-stacker', challengeType: data.challengeType ?? 'mixed', totalTowers: challenges.length, towersBuilt: built,
    accuracy, attemptsCount, firstTryCount: firstTry,
  });

  // ── Scripted session complete → submit (the workspace path submits from `onFinished`) ──
  const sessionSubmitted = useRef(false);
  useEffect(() => {
    if (!isComplete || sessionSubmitted.current || tutorOwned || hasSubmitted) return;
    sessionSubmitted.current = true;
    const built = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length));
    submitResult(built === challenges.length, accuracy, sessionMetrics(built, accuracy, results.reduce((s, r) => s + r.attempts, 0),
      results.filter(r => Number(r.score ?? 0) === 100).length), { studentWork: { targets: challenges } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, results, challenges, tutorOwned, hasSubmitted, submitResult]);

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    submitResult(result.passed, result.accuracy,
      sessionMetrics(result.solvedCount, result.accuracy, result.attemptsCount, result.firstTryCount),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Building ──────────────────────────────────────────────────
  const buildOpen = !challengeDone && !learnerBlocked();
  const changed = () => { setFalling(null); setGust(null); setHint(null); };

  const pick = (kind: PieceKind) => {
    if (!buildOpen) return;
    SoundManager.select();
    setSelected(prev => (prev === kind ? null : kind));
    setTurned(false);
  };

  const tapColumn = (column: number) => {
    if (!buildOpen) return;
    if (!selected) { setHint('Pick a piece from the tray first.'); return; }
    const { w } = pieceSize(selected, turned);
    const landed = dropPiece(pieces, selected, turned, leftEdgeFor(column, w), `p${++nextId.current}`);
    if ('blocked' in landed) {
      SoundManager.invalid();
      setHint(landed.blocked === 'too_high' ? 'That would stick out above the top of the building area.'
        : 'That piece needs something under at least half of it.');
      return;
    }
    SoundManager.snap();
    changed();
    setPieces(prev => [...prev, landed.piece]);
  };

  const tapPiece = (id: string) => {
    if (!buildOpen) return;
    const p = pieces.find(x => x.id === id);
    if (!p) return;
    if (restingOn(pieces, p).length) { SoundManager.invalid(); setHint('Take off the pieces on top of it first.'); return; }
    SoundManager.tap();
    changed();
    setPieces(prev => prev.filter(x => x.id !== id));
  };

  const clearAll = () => {
    if (!buildOpen) return;
    changed();
    setPieces([]);
  };

  // ── Check ─────────────────────────────────────────────────────
  const completeCurrent = (attemptsCount: number) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    setChallengeDone(true);
    if (!practice) mergeResult({ challengeId: currentChallenge.id, correct: true, attempts: attemptsCount, score: phaseScore(attemptsCount) });
  };

  const checkTower = () => {
    if (!currentChallenge || !buildOpen || !pieces.length) return;
    const miss = towerMiss(currentChallenge, pieces);
    const next = attempts + 1;
    setAttempts(next);
    setSelected(null); setHint(null); setGust(null);
    setFalling(fallingPart(currentChallenge, pieces, miss));
    progress.commitCheck(describeTower(pieces), !miss, miss);
    if (!miss) {
      SoundManager.playCorrect();
      setFeedback({ text: PASS_FEEDBACK[currentChallenge.type], correct: true });
      completeCurrent(next);
      return;
    }
    SoundManager.playIncorrect();
    setFeedback({ text: TOWER_FEEDBACK[miss], correct: false });
  };

  /** The gust lever: the same wind, ungraded. */
  const tryGust = () => {
    if (!currentChallenge || !buildOpen || !pieces.length) return;
    const cut = blownCut(pieces, currentChallenge.wind ?? 0);
    setGust(cut ? 'blew' : 'held');
    setFalling(cut ? { ids: cut.ids, pivotX: cut.hi, pivotY: cut.level, toRight: true } : null);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, pieces);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : towerLevers(sessionChallenge, pulledLevers);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = shorterTower(sessionChallenge);
          if (!easier) return 'This item has no easier ask; try a help lever.';
          setLeverState(pulled); resetItem(easier); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetItem(sessionChallenge); setPractice(null); },
    };
  });

  // ── The live line (shared build layer): what the tower looks like, never a number, a verdict or how to keep it up ──
  const sceneRef = useRef<SVGSVGElement | null>(null);
  const buildSeeing = useBuildWatcher({
    buildKey: pieces.map(p => `${p.kind}@${p.x},${p.y}${p.h > PIECES[p.kind].height ? 't' : ''}`).join('|'),
    enabled: buildOpen && pieces.length > 0,
    svg: sceneRef,
    request: {
      task: currentChallenge?.instruction ?? '',
      sceneNote: 'A building area on the ground with a dashed green goal line across it'
        + (currentChallenge?.type === 'build_windproof' ? ' and light blue wind arrows on the left' : '')
        + '. The learner drops coloured blocks and beams into it.',
      numbers: 'never',
      neverSay: WATCH_NEVER_SAY,
    },
  });

  // ── Pip shared surface ─────────────────────────────────────────
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: isComplete ? null : currentChallenge?.id ?? null,
    label: 'The tower and the building pieces',
    solved: challengeDone,
    tutorSpeaking: false,
  });

  // ── Render ─────────────────────────────────────────────────────
  if (!challenges.length) {
    return <div className={`w-full p-8 text-center text-slate-400 ${className ?? ''}`}>No towers to build.</div>;
  }
  if (isComplete) {
    return (
      <div className={`w-full max-w-5xl mx-auto my-8 ${className ?? ''}`}>
        <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score} durationMs={elapsedMs}
          heading="Towers Complete" celebrationMessage="You built every tower!" />
      </div>
    );
  }

  const preview = (() => {
    if (!selected || hoverColumn === null || !buildOpen) return null;
    const { w } = pieceSize(selected, turned);
    const landed = dropPiece(pieces, selected, turned, leftEdgeFor(hoverColumn, w), 'preview');
    return 'piece' in landed ? landed.piece : null;
  })();
  const balance = leverOn(BALANCE_LEVER)
    ? towerCuts(pieces).filter(c => c.level === 0 || (falling && c.ids.join() === [...falling.ids].sort().join()))
    : null;
  const turnable = selected !== null && PIECES[selected].width !== PIECES[selected].height;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title || 'Tower Stacker'}</LuminaCardTitle>
        <LuminaCardDescription>Pick a piece, then tap where to drop it. Tap a piece with nothing on it to take it off.</LuminaCardDescription>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-5">
        <div className="space-y-1 text-center">
          {challenges.length > 1 && (
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Tower {currentIndex + 1} / {challenges.length}{practice ? ' · practice' : ''}
            </p>
          )}
          <h4 className="text-lg font-semibold text-amber-200">{currentChallenge?.instruction}</h4>
        </div>

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
          <TowerScene ref={sceneRef} pieces={pieces} targetHeight={currentChallenge?.targetHeight ?? 0}
            windy={currentChallenge?.type === 'build_windproof'} preview={preview} falling={falling} balance={balance}
            disabled={!buildOpen} onTapColumn={tapColumn} onHoverColumn={setHoverColumn} onTapPiece={tapPiece} />
          <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
            {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
          </div>
          {leverOn(COUNT_LEVER) && (
            <p className="text-center text-sm text-slate-300" data-lever="piece-count">
              Pieces in your tower: <span className="text-orange-300 font-bold text-lg">{pieces.length}</span>
            </p>
          )}

          {/* The tray: every piece, as many as the learner wants. */}
          <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Building pieces">
            {PIECE_KINDS.map(kind => {
              const spec = PIECES[kind], on = selected === kind;
              return (
                <LuminaButton key={kind} tone={on ? 'primary' : 'ghost'} disabled={!buildOpen} aria-pressed={on}
                  aria-label={`Pick ${spec.label.toLowerCase()}`} data-pip-object={`tray-${kind}`} onClick={() => pick(kind)}
                  className="min-h-11 !h-auto gap-2 px-3 py-2">
                  <svg width={spec.width * 12} height={spec.height * 12} aria-hidden="true">
                    <rect width={spec.width * 12} height={spec.height * 12} rx={2} fill={spec.color} />
                  </svg>
                  <span>{spec.label}</span>
                </LuminaButton>
              );
            })}
            {turnable && (
              <LuminaButton tone={turned ? 'primary' : 'subtle'} aria-pressed={turned} onClick={() => setTurned(t => !t)}
                disabled={!buildOpen} className="min-h-11">Turn</LuminaButton>
            )}
          </div>
        </div>

        {hint && <LuminaCallout accent="amber" label="Hint" className="p-3">{hint}</LuminaCallout>}
        {gust && (
          <p className="text-center text-sm text-sky-200" data-lever="gust-result">
            {gust === 'held' ? 'Your tower held in the gust.' : 'The gust blew part of your tower over.'}
          </p>
        )}
        {feedback && (
          <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'} label={feedback.correct ? 'Yes' : 'Not yet'}>
            {feedback.text}
          </LuminaFeedbackCard>
        )}

        {/* Actions. The build commits with "I'm done!"; there is no auto-check. */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!challengeDone ? (
            <>
              <LuminaButton disabled={!buildOpen || !pieces.length} onClick={clearAll}>Clear</LuminaButton>
              {leverOn(GUST_LEVER) && (
                <LuminaButton disabled={!buildOpen || !pieces.length} onClick={tryGust}>💨 Try a gust</LuminaButton>
              )}
              <LuminaButton tone="primary" disabled={!buildOpen || !pieces.length} onClick={checkTower}>I&apos;m done!</LuminaButton>
            </>
          ) : !tutorOwned && currentIndex + 1 < challenges.length && !practice ? (
            <LuminaActionButton action="next" onClick={() => advance()}>Next tower →</LuminaActionButton>
          ) : null}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const TowerStacker = withWorkspaceController<TowerStackerProps, ProgressOptions<TowerChallenge>, Progress>(
  'tower-stacker', TowerStackerSurface, useScriptedProgress, useWorkspaceProgressFor('tower-stacker'));

export default TowerStacker;
