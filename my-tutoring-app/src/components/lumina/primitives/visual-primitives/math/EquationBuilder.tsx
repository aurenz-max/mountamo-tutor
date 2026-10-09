'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaPrompt,
  LuminaInput,
  LuminaActionButton,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  answerStateClass,
  dropZoneStateClass,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EquationBuilderMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  CLEAR_LABEL, DONE_LABEL, ENTRY_LABEL, bankOrder, describeEquationBuilderCheck, equationBuilderAssignment, equationBuilderMatches,
  equationBuilderMiss, equationBuilderScene, evaluateEquation, makeNMiss, parseEquationTokens, tileLabel, waysAsked,
  type EquationBuilderMiss, type EquationBuilderView,
} from './equationBuilderWorkspace';
import {
  DOTS_LEVER, EQ_FRAME_LEVER, FRAME_LEVER, MATCH_LEVER, PRINTED_DOTS_LEVER, REWRITE_MODEL_LEVER, equationBuilderLevers,
  equationFrame, equationLeverFacts, matchMarked, practiceItem, printedDots, rewriteModel,
} from './equationBuilderLevers';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { equationBuilderPipPose } from '../../../pip/equationBuilderPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface EquationBuilderChallenge {
  id: string;
  type: 'build' | 'missing-value' | 'true-false' | 'balance' | 'rewrite' | 'make-n';
  instruction: string;

  // make-n (open build) — "Make a number sentence that equals 10": any sentence from the bank that makes `target`
  // passes. `availableTiles` is the bank (each tile can be used again); `ways: 2` asks for a second, different one.
  target?: number;
  ways?: number;

  // build — "Build the equation: 3 plus 2 equals 5"
  targetEquation?: string;        // "3 + 2 = 5"
  availableTiles?: string[];      // ["3", "2", "5", "+", "=", "4", "-"]

  // missing-value — "What number makes this true? 4 + ? = 7"
  equation?: string;              // "4 + ? = 7"
  missingPosition?: number;       // index of the blank
  correctValue?: number;
  options?: number[];             // MC choices

  // true-false — "Is 3 + 2 = 6 true or false?"
  displayEquation?: string;
  isTrue?: boolean;

  // balance — "Make both sides equal: 3 + 4 = ? + 2"
  leftSide?: string;
  rightSide?: string;
  correctAnswer?: number;

  // rewrite — "Write this another way: 5 = ? + 3"
  originalEquation?: string;
  acceptedForms?: string[];
}

export interface EquationBuilderData {
  title: string;
  description?: string;
  challenges: EquationBuilderChallenge[];
  maxNumber: number;
  gradeBand: 'K' | '1' | '2';

  /** Within-mode support tier (config.difficulty). Calibrates the tutor's reveal
   *  level to match the on-screen scaffold so it never leaks what a tier withheld. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EquationBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build:           { label: 'Build',           icon: '🧱', accentColor: 'purple' },
  'missing-value': { label: 'Missing Value',   icon: '❓', accentColor: 'blue' },
  'true-false':    { label: 'True or False',   icon: '⚖️', accentColor: 'emerald' },
  balance:         { label: 'Balance',          icon: '🟰', accentColor: 'amber' },
  rewrite:         { label: 'Rewrite',          icon: '🔄', accentColor: 'cyan' },
  'make-n':        { label: 'Make It',          icon: '🛠️', accentColor: 'purple' },
};

/** make-n: the longest row (four numbers and their signs). */
const MAKE_ROW_MAX = 7;

/** What a missed make-n sentence shows on screen; never what the sentence makes. */
const makeMissWords = (miss: EquationBuilderMiss | undefined, total: number, canTakeAway: boolean): string => {
  switch (miss) {
    case 'bare_number': return 'That is one number on its own. A number sentence joins numbers with a sign.';
    case 'unfinished_sentence': return 'That is not a number sentence yet. Try a number, a sign, then a number.';
    case 'same_way': return `You made that one already. Try different numbers${canTakeAway ? ', or take away' : ''}.`;
    default: return `Not quite: that sentence does not make ${total}. Work out what it makes, then change a tile.`;
  }
};

/** `number_dots` / `printed_dots` lever: as many dots as one number tile says, in rows of five. */
function NumberDots({ n, lever = 'number-dots' }: { n: number; lever?: string }) {
  return (
    <div data-lever={lever} aria-label={`${n} dots`} className="grid grid-cols-5 gap-0.5 w-14">
      {Array.from({ length: n }).map((_, i) => <span key={i} className="h-2 w-2 rounded-full bg-indigo-300/80" />)}
    </div>
  );
}

// Tile appearance — bespoke interaction-surface styling for the equation tiles.
const TILE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  number: { bg: 'bg-indigo-500/20', border: 'border-indigo-400/40', text: 'text-indigo-200' },
  operator: { bg: 'bg-amber-500/20', border: 'border-amber-400/40', text: 'text-amber-200' },
  equals: { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', text: 'text-emerald-200' },
  // Blank tiles render through the shared idle drop-zone language (see Tile);
  // these placeholder values are unused for blanks.
  blank: { bg: 'bg-transparent', border: 'border-transparent', text: 'text-slate-500' },
};

function getTileType(tile: string): keyof typeof TILE_COLORS {
  if (tile === '=' || tile === '==') return 'equals';
  if (tile === '+' || tile === '-' || tile === '×' || tile === '÷') return 'operator';
  if (tile === '?' || tile === '_') return 'blank';
  return 'number';
}

// ============================================================================
// Sub-components — bespoke equation-tile interaction surface (the painting)
// ============================================================================

/** A single equation tile (draggable from pool or placed in workspace) */
function Tile({
  value,
  onClick,
  disabled,
  size = 'md',
  highlight,
  className = '',
  buttonRef,
  pipObject,
  ariaLabel,
}: {
  value: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  highlight?: 'correct' | 'incorrect' | null;
  className?: string;
  buttonRef?: (element: Element | null) => void;
  pipObject?: string;
  ariaLabel?: string;
}) {
  const tileType = getTileType(value);
  const isBlank = tileType === 'blank';
  const colors = TILE_COLORS[tileType];
  const sizeClasses = {
    sm: 'w-10 h-10 text-lg',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };

  // A blank tile IS an (idle) drop target — speak the shared zone language;
  // number/operator/equals tiles keep their bespoke identity tint.
  const colorClasses = isBlank
    ? dropZoneStateClass('idle')
    : `${colors.bg} ${colors.text} border ${colors.border}`;

  const highlightClasses = highlight === 'correct'
    ? 'ring-2 ring-emerald-400/60 bg-emerald-500/20'
    : highlight === 'incorrect'
    ? 'ring-2 ring-red-400/60 bg-red-500/20'
    : '';

  return (
    <button
      ref={buttonRef}
      data-pip-object={pipObject}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]} ${colorClasses} rounded-xl
        font-bold select-none
        flex items-center justify-center
        transition-all duration-150
        ${!disabled ? 'hover:scale-110 hover:brightness-125 cursor-pointer active:scale-95' : 'opacity-50 cursor-not-allowed'}
        ${highlightClasses}
        ${className}
      `}
    >
      {value}
    </button>
  );
}

/** Equation display — shows a formatted equation with optional blanks */
function EquationDisplay({
  parts,
  blankIndex,
  size = 'lg',
  rowRef,
  gapRef,
  dots,
}: {
  parts: string[];
  blankIndex?: number;
  size?: 'sm' | 'md' | 'lg';
  rowRef?: (element: Element | null) => void;
  gapRef?: (element: Element | null) => void;
  /** `printed_dots`: dots under each printed number, none under the ?. */
  dots?: boolean;
}) {
  const counts = printedDots(parts.map((p, i) => i === blankIndex ? '?' : p));
  return (
    <div ref={rowRef} data-pip-object={rowRef ? 'equation' : undefined} className="flex items-start justify-center gap-2 flex-wrap">
      {parts.map((part, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <Tile
            value={i === blankIndex ? '?' : part}
            disabled
            size={size}
            buttonRef={i === blankIndex ? gapRef : undefined}
            pipObject={i === blankIndex && gapRef ? 'gap' : undefined}
          />
          {dots && counts[i] !== null && <NumberDots n={counts[i]!} lever="printed-dots" />}
        </div>
      ))}
    </div>
  );
}

/** Workspace slots where the student builds the equation */
function BuildWorkspace({
  slots,
  maxSlots,
  onRemoveSlot,
  disabled,
  slotRef,
  dots,
}: {
  slots: string[];
  maxSlots: number;
  onRemoveSlot: (index: number) => void;
  disabled: boolean;
  slotRef?: (index: number) => (element: Element | null) => void;
  /** `number_dots`: dots under each number tile the learner placed. */
  dots?: boolean;
}) {
  const emptySlots = Math.max(0, maxSlots - slots.length);
  return (
    <div className="flex items-start justify-center gap-2 min-h-[70px] flex-wrap">
      {slots.map((tile, i) => (
        <div key={`slot-${i}`} className="flex flex-col items-center gap-1">
          <Tile
            value={tile}
            onClick={() => !disabled && onRemoveSlot(i)}
            disabled={disabled}
            size="md"
            buttonRef={slotRef?.(i)}
            pipObject={slotRef ? `slot-${i}` : undefined}
          />
          {dots && /^\d+$/.test(tile) && <NumberDots n={parseInt(tile, 10)} />}
        </div>
      ))}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${dropZoneStateClass('idle')}`}
        >
          _
        </div>
      ))}
    </div>
  );
}

/** Available tile pool — student picks from here */
function TilePool({
  tiles,
  onPickTile,
  disabled,
  marked,
}: {
  tiles: string[];
  onPickTile: (index: number) => void;
  disabled: boolean;
  /** `match_marks`: which tiles get a ring. */
  marked?: (tile: string) => boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {tiles.map((tile, i) => {
        const tileButton = (
          <Tile
            key={`pool-${i}-${tile}`}
            value={tile}
            onClick={() => onPickTile(i)}
            disabled={disabled}
            size="md"
            ariaLabel={tileLabel(tile)}
          />
        );
        return marked?.(tile)
          ? <span key={`pool-${i}-${tile}`} data-lever="match-mark" className="rounded-xl ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-transparent">{tileButton}</span>
          : tileButton;
      })}
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface EquationBuilderProps {
  data: EquationBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useEquationBuilderProgress = useWorkspaceProgressFor('equation-builder');

// ============================================================================
// Component
// ============================================================================

function EquationBuilderSurface({ data, className, runtimePlanItemId }: EquationBuilderProps) {
  const {
    title,
    description,
    challenges = [],
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const maxNumber = data.maxNumber ?? 10;

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `equation-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(index: number, retry: boolean) => void>(() => {});

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it
  // -------------------------------------------------------------------------
  const progress = useEquationBuilderProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: equationBuilderAssignment,
    onItemOpened: (index, retry) => reopen.current(index, retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = progress;
  const canAttempt = progress.canAttempt !== false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  // Levers (`equationBuilderLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<EquationBuilderChallenge | null>(null);
  /** The practice item as of now, not as of the last render: closing it reopens the session item in the same commit. */
  const practiceNow = useRef<EquationBuilderChallenge | null>(null);
  const showPractice = (item: EquationBuilderChallenge | null) => { practiceNow.current = item; setPractice(item); };
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** The session item's levers; `pulled` includes an easy tier's starting dots. They stay drawn on a practice item. */
  const sessionLevers = equationBuilderLevers(sessionChallenge, pulledLevers, supportTier);
  const leverOn = (id: string) => sessionLevers.some(l => l.id === id && l.pulled);

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  // make-n: the row and the ways already accepted, keyed by the item on screen, so a new item (or the easier practice
  // item, or the full item back after it) reads an empty row in the same render. Try again keeps it.
  const [make, setMake] = useState<{ item: string; row: string[]; made: string[][] }>({ item: '', row: [], made: [] });
  const makeWork = make.item === currentChallenge?.id ? make : { row: [] as string[], made: [] as string[][] };
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [challengeSolved, setChallengeSolved] = useState(false);

  // Build / Rewrite state — tiles in workspace + tiles in pool
  const [workspaceSlots, setWorkspaceSlots] = useState<string[]>([]);
  const [poolTiles, setPoolTiles] = useState<string[]>([]);

  // Missing-value state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // True-false state
  const [selectedTruthValue, setSelectedTruthValue] = useState<boolean | null>(null);

  // Balance state
  const [balanceAnswer, setBalanceAnswer] = useState('');

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<EquationBuilderMetrics>({
    primitiveType: 'equation-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** Learner input is closed while a checked answer waits for Try again, and once the challenge is solved. */
  const learnerBlocked = () => !canAttempt || challengeSolved || hasSubmittedEvaluation || allChallengesComplete;

  // -------------------------------------------------------------------------
  // Pip shared surface
  // -------------------------------------------------------------------------
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's last touch; Pip never places a tile, picks, checks, or advances.
  // Tutor audio counts only while the tutor is on this block and began on this challenge.
  const pip = usePipTargets(currentChallenge?.id ?? null, !challengeSolved && !hasSubmittedEvaluation);
  const tutorSpeaking = ctx.isAudioPlaying && !!currentChallenge
    && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId);
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete || hasSubmittedEvaluation) return null;
    const targets = pip.targets();
    const pose = equationBuilderPipPose({
      running: true, preparing: false, currentSolved: challengeSolved, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      type: currentChallenge.type, visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Equation builder',
      dock: pip.dock.current, targets, pose,
    };
  });
  // The dock sits right below the cue target (slot row or printed equation) and
  // above the answers (tile pool, options, number box), so a pointer never crosses one.
  const pipDock = pipStore && (
    <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
      className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
  );

  // -------------------------------------------------------------------------
  // A fresh challenge, or the same one after Try again, starts clean
  // -------------------------------------------------------------------------
  const openChallenge = useCallback((challenge: EquationBuilderChallenge | undefined) => {
    setFeedback('');
    setFeedbackType('');
    setChallengeSolved(false);
    setWorkspaceSlots([]);
    setSelectedOption(null);
    setSelectedTruthValue(null);
    setBalanceAnswer('');
    // Shuffle the tiles for the pool (build / rewrite)
    const tiles = challenge && (challenge.type === 'build' || challenge.type === 'rewrite') ? challenge.availableTiles ?? [] : [];
    setPoolTiles([...tiles].sort(() => Math.random() - 0.5));
  }, []);
  // A make-n build survives Try again, and so does its verdict until the next check (open build). A fresh item
  // starts clean and drops any easier practice item.
  // Try again on a practice item reopens the practice item, not the session item behind it. (The runtime reports the
  // full item coming back after practice as a retry of that item, after endPractice has run: read the ref.)
  reopen.current = (index, retry) => {
    if (retry && currentChallenge?.type === 'make-n') return;
    if (!retry) showPractice(null);
    openChallenge(retry && practiceNow.current ? practiceNow.current : challenges[index]);
  };

  useEffect(() => {
    openChallenge(sessionChallenge ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallengeIndex]);

  // -------------------------------------------------------------------------
  // Build / Rewrite: tile management
  // -------------------------------------------------------------------------
  const handlePickTile = (poolIndex: number) => {
    if (learnerBlocked()) return;
    const tile = poolTiles[poolIndex];
    if (!tile) return;
    SoundManager.snap();        // ← tile lands in the workspace
    setPoolTiles(prev => prev.filter((_, i) => i !== poolIndex));
    setWorkspaceSlots(prev => [...prev, tile]);
  };

  const handleRemoveSlot = (slotIndex: number) => {
    if (learnerBlocked()) return;
    const tile = workspaceSlots[slotIndex];
    if (!tile) return;
    setWorkspaceSlots(prev => prev.filter((_, i) => i !== slotIndex));
    setPoolTiles(prev => [...prev, tile]);
  };

  const handleClearWorkspace = () => {
    if (learnerBlocked()) return;
    setPoolTiles(prev => [...prev, ...workspaceSlots]);
    setWorkspaceSlots([]);
  };

  // -------------------------------------------------------------------------
  // make-n: the bank never runs out; tap a row tile to take it out
  // -------------------------------------------------------------------------
  const editRow = (edit: (row: string[]) => string[]) => {
    if (!currentChallenge || learnerBlocked()) return;
    const id = currentChallenge.id;
    setMake(prev => {
      const base = prev.item === id ? prev : { item: id, row: [], made: [] };
      return { ...base, row: edit(base.row) };
    });
  };
  const handleBankTile = (tile: string) => {
    if (makeWork.row.length >= MAKE_ROW_MAX) return;
    SoundManager.snap();
    editRow(row => [...row, tile]);
  };

  // -------------------------------------------------------------------------
  // Every Check: the builder's own verdict, committed to the workspace
  // -------------------------------------------------------------------------
  const view: EquationBuilderView = currentChallenge?.type === 'make-n'
    ? { slots: makeWork.row, made: makeWork.made, option: null, truth: null, entry: '' }
    : { slots: workspaceSlots, option: selectedOption, truth: selectedTruthValue, entry: balanceAnswer };

  /** Records the verdict and commits it; the runtime offers Try again or advances. */
  const settle = (challenge: EquationBuilderChallenge, correct: boolean, success: string, miss: string) => {
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(success);
      setFeedbackType('success');
      setChallengeSolved(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback(miss);
      setFeedbackType('error');
    }
    progress.commitCheck(describeEquationBuilderCheck(challenge, view), correct, equationBuilderMiss(challenge, view));
  };

  const handleCheckBuild = () => {
    if (!currentChallenge || currentChallenge.type !== 'build' || learnerBlocked()) return;
    settle(currentChallenge, equationBuilderMatches(currentChallenge, view), 'You built it! Great job!',
      evaluateEquation(workspaceSlots.join(' '))
        ? 'That\'s a true equation, but not the one we need. Look at the instruction again.'
        : 'That doesn\'t make a true equation yet. Keep trying!');
  };

  /**
   * "I'm done!": the builder's check of the row. On a two-way item an accepted first way is kept on screen and the
   * row opens empty for the next; only the last way (or any miss) is committed to the workspace.
   */
  const handleDone = () => {
    const c = currentChallenge;
    if (!c || c.type !== 'make-n' || c.target === undefined || learnerBlocked() || makeWork.row.length === 0) return;
    const miss = makeNMiss(c.target, makeWork.row, makeWork.made);
    if (!miss && makeWork.made.length + 1 < waysAsked(c)) {
      SoundManager.playCorrect();
      setMake({ item: c.id, row: [], made: [...makeWork.made, makeWork.row] });
      setFeedback(`Yes! ${makeWork.row.join(' ')} = ${c.target}. Now make ${c.target} a different way.`);
      setFeedbackType('success');
      return;
    }
    settle(c, !miss, `Yes! ${makeWork.row.join(' ')} = ${c.target}!`,
      makeMissWords(miss, c.target, (c.availableTiles ?? []).includes('-')));
  };

  const handleCheckMissingValue = () => {
    if (!currentChallenge || currentChallenge.type !== 'missing-value' || selectedOption === null || learnerBlocked()) return;
    const filledEq = (currentChallenge.equation ?? '').replace('?', String(selectedOption));
    settle(currentChallenge, equationBuilderMatches(currentChallenge, view), `Yes! ${filledEq} is true!`,
      'Not quite. Remember, both sides of = must be the same amount!');
  };

  const handleCheckTrueFalse = () => {
    if (!currentChallenge || currentChallenge.type !== 'true-false' || selectedTruthValue === null || learnerBlocked()) return;
    const eq = currentChallenge.displayEquation ?? '';
    settle(currentChallenge, equationBuilderMatches(currentChallenge, view),
      currentChallenge.isTrue
        ? `Correct! ${eq} is true — both sides are equal!`
        : `Correct! ${eq} is false — the two sides are not equal.`,
      'Think again. Check each side of the = sign. Are they the same amount?');
  };

  const handleCheckBalance = () => {
    if (!currentChallenge || currentChallenge.type !== 'balance' || learnerBlocked()) return;
    const answer = parseInt(balanceAnswer, 10);
    settle(currentChallenge, equationBuilderMatches(currentChallenge, view),
      `Yes! ${currentChallenge.leftSide} = ${(currentChallenge.rightSide ?? '').replace('?', String(answer))} — both sides balance!`,
      'The two sides aren\'t equal yet. What number makes both sides the same?');
  };

  const handleCheckRewrite = () => {
    if (!currentChallenge || currentChallenge.type !== 'rewrite' || learnerBlocked()) return;
    const builtStr = workspaceSlots.join(' ');
    const isSameAsOriginal = (currentChallenge.originalEquation ?? '').replace(/\s+/g, '') === builtStr.replace(/\s+/g, '');
    settle(currentChallenge, equationBuilderMatches(currentChallenge, view),
      `Great! ${builtStr} says the same thing a different way!`,
      isSameAsOriginal
        ? 'That\'s the same equation! Try writing it a different way.'
        : evaluateEquation(builtStr)
        ? 'That\'s true, but try a different form of the original equation.'
        : 'That doesn\'t make a true equation. Remember both sides of = must be equal!');
  };

  // -------------------------------------------------------------------------
  // Completion: the runtime advances; once every challenge is solved, submit once
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || hasAutoSubmittedRef.current) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    hasAutoSubmittedRef.current = true;

    const totalCorrect = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const overallPct = Math.round((totalCorrect / challenges.length) * 100);

    submitEvaluation(
      overallPct >= 60,
      overallPct,
      {
        type: 'equation-builder',
        totalChallenges: challenges.length,
        correctCount: totalCorrect,
        totalAttempts,
        averageAttemptsPerChallenge: totalAttempts / challenges.length,
        challengeBreakdown: challengeResults.map(r => ({
          challengeId: r.challengeId,
          correct: r.correct,
          attempts: r.attempts,
        })),
      },
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, challengeResults, challenges, submitEvaluation]);

  // What the tutor and the observer are shown, republished every render. Derived from the challenge (and a make-n
  // row keyed by item), so opening an item (and its tile shuffle) adds no revision after the advance.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    const scene = equationBuilderScene(currentChallenge, { supportTier, work: { slots: makeWork.row, made: makeWork.made } });
    const onScreen = equationLeverFacts(currentChallenge, sessionLevers);
    // While an easier item is up the levers are off, and endPractice brings the full item back, blank.
    const levers = practice ? [] : sessionLevers;
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionChallenge || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(pulled);
          openChallenge(easier);
          showPractice(easier);
          return { practice: equationBuilderAssignment(easier) };
        }
        setLeverState(pulled);
        return true as const;
      },
      endPractice: () => { showPractice(null); openChallenge(sessionChallenge ?? undefined); },
    };
  });

  // -------------------------------------------------------------------------
  // Compute overall score for display
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challengeResults.length) * 100);
  }, [allChallengesComplete, challengeResults]);

  // -------------------------------------------------------------------------
  // Render current challenge
  // -------------------------------------------------------------------------
  const renderChallenge = () => {
    if (!currentChallenge) return null;
    const isDisabled = learnerBlocked();

    switch (currentChallenge.type) {
      case 'build':
        return renderBuildChallenge(isDisabled);
      case 'missing-value':
        return renderMissingValueChallenge(isDisabled);
      case 'true-false':
        return renderTrueFalseChallenge(isDisabled);
      case 'balance':
        return renderBalanceChallenge(isDisabled);
      case 'rewrite':
        return renderRewriteChallenge(isDisabled);
      case 'make-n':
        return renderMakeChallenge(isDisabled);
      default:
        return null;
    }
  };

  /** Open build: the learner's row, then "= total"; the bank below never runs out. Levers start bare. */
  const renderMakeChallenge = (disabled: boolean) => {
    const c = currentChallenge!;
    const total = String(c.target ?? '');
    const ways = waysAsked(c);
    const { row, made } = makeWork;
    const dotsOn = pulledLevers.includes(DOTS_LEVER);
    const frameOn = pulledLevers.includes(FRAME_LEVER);
    return (
      <div className="space-y-6">
        {ways > 1 && (
          <div className="space-y-2 text-center">
            <p className="text-sm text-slate-400">Way {Math.min(made.length + 1, ways)} of {ways}</p>
            {made.map((w, i) => <EquationDisplay key={i} parts={[...w, '=', total]} size="sm" />)}
          </div>
        )}

        <LuminaPanel ref={pip.ref('workspace')} data-pip-object="workspace">
          <p className="text-xs text-slate-500 mb-2 text-center">Your number sentence</p>
          <div className="flex items-start justify-center gap-2 flex-wrap min-h-[70px]">
            {row.map((tile, i) => (
              <div key={`row-${i}`} className="flex flex-col items-center gap-1">
                <Tile value={tile} size="md" disabled={disabled} buttonRef={pip.ref(`slot-${i}`)} pipObject={`slot-${i}`}
                  onClick={() => { pip.look('pool'); editRow(r => r.filter((_, j) => j !== i)); }} />
                {dotsOn && /^\d+$/.test(tile) && <NumberDots n={parseInt(tile, 10)} />}
              </div>
            ))}
            {row.length === 0 && (
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${dropZoneStateClass('idle')}`}>_</div>
            )}
            <Tile value="=" disabled size="md" />
            <Tile value={total} disabled size="md" />
          </div>
          {frameOn && (
            <div data-lever="sentence-frame" aria-label="Sentence shape: number, sign, number"
              className="mt-3 flex items-center justify-center gap-2 text-slate-500">
              <span className="w-10 h-10 rounded-lg border border-dashed border-indigo-400/50" />
              <span className="w-8 h-8 rounded-full border border-dashed border-amber-400/50" />
              <span className="w-10 h-10 rounded-lg border border-dashed border-indigo-400/50" />
              <span className="text-lg">= {total}</span>
            </div>
          )}
        </LuminaPanel>

        {pipDock}

        <div ref={pip.ref('pool')} data-pip-object="pool">
          <p className="text-xs text-slate-500 mb-2 text-center">Tiles (use any tile as many times as you like)</p>
          <TilePool tiles={bankOrder(c.availableTiles ?? [])} disabled={disabled || row.length >= MAKE_ROW_MAX}
            onPickTile={(i) => { pip.look(`slot-${row.length}`); handleBankTile(bankOrder(c.availableTiles ?? [])[i]); }} />
        </div>

        <div className="flex justify-center gap-3">
          <LuminaButton onClick={() => { pip.look('pool'); editRow(() => []); }} disabled={disabled}>
            {CLEAR_LABEL}
          </LuminaButton>
          <LuminaActionButton action="check" onClick={handleDone} disabled={disabled || row.length === 0}>
            {DONE_LABEL}
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  const renderBuildChallenge = (disabled: boolean) => {
    const target = currentChallenge?.targetEquation ?? '';
    const targetTokenCount = parseEquationTokens(target).length;
    return (
      <div className="space-y-6">
        {/* Workspace */}
        <LuminaPanel ref={pip.ref('workspace')} data-pip-object="workspace">
          <p className="text-xs text-slate-500 mb-2 text-center">Your equation</p>
          {leverOn(EQ_FRAME_LEVER) && (
            <div data-lever="equation-frame" aria-label="Equation shape" className="mb-3 flex items-center justify-center gap-2 text-slate-400">
              {equationFrame(currentChallenge!).map((box, i) => box === 'equals'
                ? <span key={i} className="text-lg">=</span>
                : <span key={i} className={box === 'sign'
                  ? 'w-8 h-8 rounded-full border border-dashed border-amber-400/50'
                  : 'w-10 h-10 rounded-lg border border-dashed border-indigo-400/50'} />)}
            </div>
          )}
          <BuildWorkspace
            slots={workspaceSlots}
            maxSlots={targetTokenCount}
            onRemoveSlot={(i) => { pip.look('pool'); handleRemoveSlot(i); }}
            disabled={disabled}
            slotRef={(i) => pip.ref(`slot-${i}`)}
            dots={leverOn(DOTS_LEVER)}
          />
        </LuminaPanel>

        {pipDock}

        {/* Tile pool */}
        <div ref={pip.ref('pool')} data-pip-object="pool">
          <p className="text-xs text-slate-500 mb-2 text-center">Available tiles</p>
          <TilePool tiles={poolTiles} onPickTile={(i) => { pip.look(`slot-${workspaceSlots.length}`); handlePickTile(i); }} disabled={disabled} />
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <LuminaButton
            onClick={() => { pip.look('pool'); handleClearWorkspace(); }}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Clear
          </LuminaButton>
          <LuminaActionButton
            action="check"
            onClick={handleCheckBuild}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Check
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  const renderMissingValueChallenge = (disabled: boolean) => {
    const eq = currentChallenge?.equation ?? '';
    const tokens = parseEquationTokens(eq);
    const blankIdx = currentChallenge?.missingPosition ?? tokens.indexOf('?');
    const options = currentChallenge?.options ?? [];

    return (
      <div className="space-y-6">
        {/* Display equation with blank */}
        <EquationDisplay parts={tokens} blankIndex={blankIdx} size="lg"
          rowRef={pip.ref('equation')} gapRef={pip.ref('gap')} dots={leverOn(PRINTED_DOTS_LEVER)} />

        {pipDock}

        {/* MC options — bespoke compact tiles, grading colors tokenized */}
        <div className="flex justify-center gap-3 flex-wrap">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              ref={pip.ref(`option-${opt}`)}
              data-pip-object={`option-${opt}`}
              className={`
                w-16 h-16 text-2xl font-bold rounded-xl border transition-all
                ${answerStateClass(selectedOption === opt ? 'selected' : 'idle')}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => { if (!disabled) { pip.look(`option-${opt}`); SoundManager.select(); setSelectedOption(opt); } }}
              disabled={disabled}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* Check */}
        <div className="flex justify-center">
          <LuminaActionButton
            action="check"
            onClick={handleCheckMissingValue}
            disabled={disabled || selectedOption === null}
          >
            Check
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  const renderTrueFalseChallenge = (disabled: boolean) => {
    const eq = currentChallenge?.displayEquation ?? '';
    const tokens = parseEquationTokens(eq);

    return (
      <div className="space-y-6">
        {/* Display equation */}
        <EquationDisplay parts={tokens} size="lg" rowRef={pip.ref('equation')} dots={leverOn(PRINTED_DOTS_LEVER)} />

        {pipDock}

        {/* True / False buttons — bespoke pills, grading colors tokenized */}
        <div className="flex justify-center gap-4">
          <button
            type="button"
            ref={pip.ref('truth-true')}
            data-pip-object="truth-true"
            className={`
              px-8 py-4 text-lg font-bold rounded-xl border transition-all
              ${answerStateClass(selectedTruthValue === true ? 'selected' : 'idle')}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => { if (!disabled) { pip.look('truth-true'); SoundManager.select(); setSelectedTruthValue(true); } }}
            disabled={disabled}
          >
            True
          </button>
          <button
            type="button"
            ref={pip.ref('truth-false')}
            data-pip-object="truth-false"
            className={`
              px-8 py-4 text-lg font-bold rounded-xl border transition-all
              ${answerStateClass(selectedTruthValue === false ? 'selected' : 'idle')}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => { if (!disabled) { pip.look('truth-false'); SoundManager.select(); setSelectedTruthValue(false); } }}
            disabled={disabled}
          >
            False
          </button>
        </div>

        {/* Check */}
        <div className="flex justify-center">
          <LuminaActionButton
            action="check"
            onClick={handleCheckTrueFalse}
            disabled={disabled || selectedTruthValue === null}
          >
            Check
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  const renderBalanceChallenge = (disabled: boolean) => {
    const leftTokens = parseEquationTokens(currentChallenge?.leftSide ?? '');
    const rightTokens = parseEquationTokens(currentChallenge?.rightSide ?? '');
    const blankIdx = rightTokens.indexOf('?');
    const dotsOn = leverOn(PRINTED_DOTS_LEVER);
    const withDots = (t: string, tile: React.ReactNode, key: string) => (
      <div key={key} className="flex flex-col items-center gap-1">
        {tile}
        {dotsOn && /^\d+$/.test(t) && <NumberDots n={parseInt(t, 10)} lever="printed-dots" />}
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Balance display: left = right */}
        <div ref={pip.ref('equation')} data-pip-object="equation" className="flex items-start justify-center gap-4 flex-wrap">
          <div className="flex items-start gap-1">
            {leftTokens.map((t, i) => withDots(t, <Tile value={t} disabled size="md" />, `l-${i}`))}
          </div>
          <Tile value="=" disabled size="md" />
          <div className="flex items-start gap-1">
            {rightTokens.map((t, i) => withDots(i === blankIdx ? '?' : t,
              <Tile value={i === blankIdx ? '?' : t} disabled size="md"
                buttonRef={i === blankIdx ? pip.ref('gap') : undefined} pipObject={i === blankIdx ? 'gap' : undefined} />, `r-${i}`))}
          </div>
        </div>

        {pipDock}

        {/* Number input — generic answer entry */}
        <div ref={pip.ref('entry')} data-pip-object="entry" className="flex justify-center items-center gap-3">
          <span className="text-slate-400 text-sm">? =</span>
          <LuminaInput
            type="number"
            inputMode="numeric"
            min={0}
            max={maxNumber * 2}
            aria-label={ENTRY_LABEL}
            value={balanceAnswer}
            onFocus={() => { if (!disabled) pip.look('entry'); }}
            onChange={(e) => { if (!disabled) { pip.look('entry'); setBalanceAnswer(e.target.value); } }}
            disabled={disabled}
            className="w-20 h-14 text-center text-2xl font-bold"
            placeholder="?"
          />
        </div>

        {/* Check */}
        <div className="flex justify-center">
          <LuminaActionButton
            action="check"
            onClick={handleCheckBalance}
            disabled={disabled || balanceAnswer === ''}
          >
            Check
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  const renderRewriteChallenge = (disabled: boolean) => {
    const original = currentChallenge?.originalEquation ?? '';
    const originalTokens = parseEquationTokens(original);
    const model = leverOn(REWRITE_MODEL_LEVER) ? rewriteModel(currentChallenge!) : null;
    // For rewrite, show the original equation + workspace to build a new form
    return (
      <div className="space-y-6">
        {/* Original equation */}
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-2">Original equation</p>
          <EquationDisplay parts={originalTokens} size="md" />
        </div>

        {/* `rewrite_model`: an example in other numbers, never the learner's */}
        {model && (
          <div data-lever="rewrite-model" className="flex items-center justify-center gap-3 flex-wrap rounded-xl border border-dashed border-cyan-300/30 p-2">
            <span className="text-xs text-slate-400">Like this:</span>
            <EquationDisplay parts={parseEquationTokens(model.from)} size="sm" />
            <span className="text-slate-400" aria-hidden>→</span>
            <EquationDisplay parts={parseEquationTokens(model.to)} size="sm" />
          </div>
        )}

        {/* Workspace */}
        <LuminaPanel ref={pip.ref('workspace')} data-pip-object="workspace">
          <p className="text-xs text-slate-500 mb-2 text-center">Build a different way to write it</p>
          <BuildWorkspace
            slots={workspaceSlots}
            maxSlots={originalTokens.length}
            onRemoveSlot={(i) => { pip.look('pool'); handleRemoveSlot(i); }}
            disabled={disabled}
            slotRef={(i) => pip.ref(`slot-${i}`)}
            dots={leverOn(DOTS_LEVER)}
          />
        </LuminaPanel>

        {pipDock}

        {/* Tile pool */}
        <div ref={pip.ref('pool')} data-pip-object="pool">
          <p className="text-xs text-slate-500 mb-2 text-center">Available tiles</p>
          <TilePool tiles={poolTiles} onPickTile={(i) => { pip.look(`slot-${workspaceSlots.length}`); handlePickTile(i); }} disabled={disabled}
            marked={leverOn(MATCH_LEVER) ? (tile) => matchMarked(currentChallenge!, tile) : undefined} />
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <LuminaButton
            onClick={() => { pip.look('pool'); handleClearWorkspace(); }}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Clear
          </LuminaButton>
          <LuminaActionButton
            action="check"
            onClick={handleCheckRewrite}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Check
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No challenges available.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const currentTypeConfig = currentChallenge
    ? CHALLENGE_TYPE_CONFIG[currentChallenge.type]
    : undefined;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <LuminaChallengeCounter
            current={currentChallengeIndex + 1}
            total={challenges.length}
          />
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-6">
        {/* Phase Summary — shown when all complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="You explored equations like a pro!"
            className="mb-6"
          />
        )}

        {/* Current challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Challenge type badge */}
            <div className="flex items-center gap-2">
              <LuminaBadge accent={currentTypeConfig?.accentColor as LuminaAccent}>
                {currentTypeConfig?.icon}{' '}
                {currentTypeConfig?.label}
              </LuminaBadge>
            </div>

            {/* Instruction */}
            <LuminaPrompt center className="text-lg">
              {currentChallenge.instruction}
            </LuminaPrompt>

            {/* Challenge content */}
            {renderChallenge()}

            {/* Feedback */}
            {feedback && (
              <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : 'incorrect'}>
                {feedback}
              </LuminaFeedbackCard>
            )}

          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const EquationBuilder = withWorkspaceOnly<EquationBuilderProps>('equation-builder', EquationBuilderSurface, props => props.data.title);

export default EquationBuilder;
