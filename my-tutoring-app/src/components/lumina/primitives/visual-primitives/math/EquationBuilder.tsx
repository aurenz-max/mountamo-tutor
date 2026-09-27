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
  ENTRY_LABEL, describeEquationBuilderCheck, equationBuilderAssignment, equationBuilderMatches, equationBuilderScene,
  evaluateEquation, parseEquationTokens, tileLabel, type EquationBuilderView,
} from './equationBuilderWorkspace';
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
  type: 'build' | 'missing-value' | 'true-false' | 'balance' | 'rewrite';
  instruction: string;

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
};

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
}: {
  parts: string[];
  blankIndex?: number;
  size?: 'sm' | 'md' | 'lg';
  rowRef?: (element: Element | null) => void;
  gapRef?: (element: Element | null) => void;
}) {
  return (
    <div ref={rowRef} data-pip-object={rowRef ? 'equation' : undefined} className="flex items-center justify-center gap-2 flex-wrap">
      {parts.map((part, i) => (
        <Tile
          key={i}
          value={i === blankIndex ? '?' : part}
          disabled
          size={size}
          buttonRef={i === blankIndex ? gapRef : undefined}
          pipObject={i === blankIndex && gapRef ? 'gap' : undefined}
        />
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
}: {
  slots: string[];
  maxSlots: number;
  onRemoveSlot: (index: number) => void;
  disabled: boolean;
  slotRef?: (index: number) => (element: Element | null) => void;
}) {
  const emptySlots = Math.max(0, maxSlots - slots.length);
  return (
    <div className="flex items-center justify-center gap-2 min-h-[70px] flex-wrap">
      {slots.map((tile, i) => (
        <Tile
          key={`slot-${i}`}
          value={tile}
          onClick={() => !disabled && onRemoveSlot(i)}
          disabled={disabled}
          size="md"
          buttonRef={slotRef?.(i)}
          pipObject={slotRef ? `slot-${i}` : undefined}
        />
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
}: {
  tiles: string[];
  onPickTile: (index: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {tiles.map((tile, i) => (
        <Tile
          key={`pool-${i}-${tile}`}
          value={tile}
          onClick={() => onPickTile(i)}
          disabled={disabled}
          size="md"
          ariaLabel={tileLabel(tile)}
        />
      ))}
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

function EquationBuilderSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: EquationBuilderProps) {
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
  const reopen = useRef<(index: number) => void>(() => {});

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it
  // -------------------------------------------------------------------------
  const progress = useEquationBuilderProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || 'mixed', workspace, assignment: equationBuilderAssignment,
    onItemOpened: (index) => reopen.current(index),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
  } = progress;
  const canAttempt = progress.canAttempt !== false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
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
  reopen.current = (index) => openChallenge(challenges[index]);

  useEffect(() => {
    openChallenge(currentChallenge ?? undefined);
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
  // Every Check: the builder's own verdict, committed to the workspace
  // -------------------------------------------------------------------------
  const view: EquationBuilderView = { slots: workspaceSlots, option: selectedOption, truth: selectedTruthValue, entry: balanceAnswer };

  /** Records the verdict and commits it; the runtime offers Try again or advances. */
  const settle = (challenge: EquationBuilderChallenge, correct: boolean, success: string, miss: string) => {
    incrementAttempts();
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(success);
      setFeedbackType('success');
      setChallengeSolved(true);
      recordResult({ challengeId: challenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      SoundManager.playIncorrect();
      setFeedback(miss);
      setFeedbackType('error');
    }
    progress.commitCheck?.(describeEquationBuilderCheck(challenge, view), correct);
  };

  const handleCheckBuild = () => {
    if (!currentChallenge || currentChallenge.type !== 'build' || learnerBlocked()) return;
    settle(currentChallenge, equationBuilderMatches(currentChallenge, view), 'You built it! Great job!',
      evaluateEquation(workspaceSlots.join(' '))
        ? 'That\'s a true equation, but not the one we need. Look at the instruction again.'
        : 'That doesn\'t make a true equation yet. Keep trying!');
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

  // What the tutor and the observer are shown, republished every render. Derived from the challenge
  // alone, so opening an item (and its tile shuffle) adds no revision after the advance.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...equationBuilderScene(currentChallenge, { supportTier }), demonstration: [],
      canDemonstrate: false, canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    progress.publishWorkspace?.();
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
      default:
        return null;
    }
  };

  const renderBuildChallenge = (disabled: boolean) => {
    const target = currentChallenge?.targetEquation ?? '';
    const targetTokenCount = parseEquationTokens(target).length;
    return (
      <div className="space-y-6">
        {/* Workspace */}
        <LuminaPanel ref={pip.ref('workspace')} data-pip-object="workspace">
          <p className="text-xs text-slate-500 mb-2 text-center">Your equation</p>
          <BuildWorkspace
            slots={workspaceSlots}
            maxSlots={targetTokenCount}
            onRemoveSlot={(i) => { pip.look('pool'); handleRemoveSlot(i); }}
            disabled={disabled}
            slotRef={(i) => pip.ref(`slot-${i}`)}
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
          rowRef={pip.ref('equation')} gapRef={pip.ref('gap')} />

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
        <EquationDisplay parts={tokens} size="lg" rowRef={pip.ref('equation')} />

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

    return (
      <div className="space-y-6">
        {/* Balance display: left = right */}
        <div ref={pip.ref('equation')} data-pip-object="equation" className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            {leftTokens.map((t, i) => (
              <Tile key={`l-${i}`} value={t} disabled size="md" />
            ))}
          </div>
          <Tile value="=" disabled size="md" />
          <div className="flex items-center gap-1">
            {rightTokens.map((t, i) => (
              <Tile key={`r-${i}`} value={i === blankIdx ? '?' : t} disabled size="md"
                buttonRef={i === blankIdx ? pip.ref('gap') : undefined} pipObject={i === blankIdx ? 'gap' : undefined} />
            ))}
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
    // For rewrite, show the original equation + workspace to build a new form
    return (
      <div className="space-y-6">
        {/* Original equation */}
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-2">Original equation</p>
          <EquationDisplay parts={originalTokens} size="md" />
        </div>

        {/* Workspace */}
        <LuminaPanel ref={pip.ref('workspace')} data-pip-object="workspace">
          <p className="text-xs text-slate-500 mb-2 text-center">Build a different way to write it</p>
          <BuildWorkspace
            slots={workspaceSlots}
            maxSlots={originalTokens.length}
            onRemoveSlot={(i) => { pip.look('pool'); handleRemoveSlot(i); }}
            disabled={disabled}
            slotRef={(i) => pip.ref(`slot-${i}`)}
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
