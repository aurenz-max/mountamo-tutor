'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaActionButton,
  dropZoneStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
  type PatternBuilderMetrics,
} from '../../../evaluation';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  activeMapping as mappingFor, activeSequence as sequenceFor, createdFacts, describePatternBuilderCheck, paletteFor,
  patternBuilderAssignment, patternBuilderMatches, patternBuilderMiss, patternBuilderScene, phaseFor, shapeLetters,
  DONE_LABEL, START_OVER_LABEL, type PatternBuilderView, type PatternPhase,
} from './patternBuilderWorkspace';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import {
  CORE_MODEL_LEVER, GROUPS_LEVER, LINE_LEVER, MARKER_LEVER, MODEL_LEVER, PRACTICE_NOTE, coreModel, coreModelFact, groupsFact,
  lineFact, markerFact, markerPlace, modelFact, numberLine, patternBuilderLevers, practiceItem, repeatGroups, shapeModel,
  type NumberLineModel,
} from './patternBuilderLevers';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { patternBuilderPipPose } from '../../../pip/patternBuilderPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PatternBuilderChallenge {
  id: string;
  type: 'extend' | 'identify_core' | 'create' | 'translate' | 'find_rule';
  instruction: string;
  answer: string[] | string;
  hint: string;
  narration: string;
  /** Per-challenge sequence for single-type eval modes where each challenge has a distinct pattern. */
  sequence?: {
    given: string[];
    hidden: string[];
    core: string[];
  };
  /** Per-challenge translation mapping for translate challenges in single-type eval modes. */
  translationMapping?: Record<string, string>;
  /** Per-challenge selectable tokens (correct answers + distractors). Falls back to top-level tokens.available. */
  availableTokens?: string[];
  /**
   * Within-mode support tier ('easy' | 'medium' | 'hard') from the manifest.
   * easy = unit boundary highlighted + rule named; medium = unit highlighted, no rule;
   * hard = no unit highlight, no rule (infer from the sequence). Drives how far the
   * tutor may coach (a scene fact) — NEVER changes the pattern length or elements.
   */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** create (open build): the pattern shape the ask names ('AB', 'ABB', 'AAB', 'ABC', 'AABB'), chosen in code. The
   *  learner picks the tokens; the builder checks the shape repeats. Absent on older payloads (any repeat passes). */
  createShape?: string;
}

export interface PatternBuilderData {
  title: string;
  description?: string;
  patternType: 'repeating' | 'growing' | 'number';
  sequence: {
    given: string[];
    hidden: string[];
    core: string[];
    rule: string | null;
  };
  tokens: {
    available: string[];
    type: 'colors' | 'shapes' | 'numbers' | 'emoji' | 'mixed';
    customIcons?: boolean;
  };
  challenges: PatternBuilderChallenge[];
  showOptions?: {
    showCore?: boolean;
    showStepNumbers?: boolean;
    showRule?: boolean;
    audioMode?: boolean;
  };
  translationTarget?: {
    enabled?: boolean;
    sourceType?: string;
    targetType?: string;
    mapping?: Record<string, string>;
  };
  imagePrompt?: string | null;
  gradeBand?: 'K-1' | '2-3';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PatternBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<PatternPhase, { label: string; description: string }> = {
  copy: { label: 'Extend', description: 'Continue the pattern' },
  identify: { label: 'Identify', description: 'Find the repeating core' },
  create: { label: 'Create', description: 'Build your own pattern' },
  translate: { label: 'Translate', description: 'Same pattern, new look' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  extend: { label: 'Extend the Pattern', icon: '🔗', accentColor: 'blue' },
  identify_core: { label: 'Identify the Core', icon: '🔍', accentColor: 'purple' },
  create: { label: 'Create a Pattern', icon: '✨', accentColor: 'emerald' },
  translate: { label: 'Translate the Pattern', icon: '🔄', accentColor: 'cyan' },
  find_rule: { label: 'Find the Rule', icon: '📐', accentColor: 'amber' },
};

// Visual representations for token types
const TOKEN_DISPLAY: Record<string, { bg: string; border: string; text: string }> = {
  // Colors
  red: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  blue: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
  green: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
  yellow: { bg: '#eab308', border: '#ca8a04', text: '#000' },
  purple: { bg: '#a855f7', border: '#9333ea', text: '#fff' },
  orange: { bg: '#f97316', border: '#ea580c', text: '#fff' },
  pink: { bg: '#ec4899', border: '#db2777', text: '#fff' },
  // Shapes
  circle: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
  square: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  triangle: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
  star: { bg: '#eab308', border: '#ca8a04', text: '#000' },
  diamond: { bg: '#a855f7', border: '#9333ea', text: '#fff' },
  heart: { bg: '#ec4899', border: '#db2777', text: '#fff' },
};

const SHAPE_SYMBOLS: Record<string, string> = {
  circle: '●',
  square: '■',
  triangle: '▲',
  star: '★',
  diamond: '◆',
  heart: '♥',
};

function getTokenDisplay(token: string): { bg: string; border: string; text: string; label: string } {
  const lower = token.toLowerCase();
  const display = TOKEN_DISPLAY[lower];
  if (display) {
    const symbol = SHAPE_SYMBOLS[lower];
    return { ...display, label: symbol || token.charAt(0).toUpperCase() };
  }
  // Fallback: use token text directly (numbers, emoji, etc.)
  return { bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.3)', text: '#e2e8f0', label: token };
}

const CELL_SIZE = 52;

/** The asked shape's glyphs (create): grey and token-free, so no glyph can be read as a token to copy. */
const SHAPE_GLYPHS: Record<string, string> = { A: '◯', B: '△', C: '◇' };

// ============================================================================
// Props
// ============================================================================

interface PatternBuilderProps {
  data: PatternBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const usePatternBuilderProgress = useWorkspaceProgressFor('pattern-builder');

// ============================================================================
// Component
// ============================================================================

function PatternBuilderSurface({ data, className, runtimePlanItemId }: PatternBuilderProps) {
  const {
    title,
    description,
    patternType,
    sequence,
    challenges = [],
    showOptions = {},
    translationTarget,
    gradeBand = 'K-1',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showCore = false,
    showStepNumbers = false,
    showRule = false,
  } = showOptions;

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `pattern-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(retry: boolean) => void>(() => {});

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it
  // -------------------------------------------------------------------------
  const progress = usePatternBuilderProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: patternBuilderAssignment,
    onItemOpened: (_index, retry) => reopen.current(retry),
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
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Extension answers (user-placed tokens for hidden positions)
  const [extensionAnswers, setExtensionAnswers] = useState<string[]>([]);

  // Core identification: which indices the student has selected as core
  const [selectedCoreIndices, setSelectedCoreIndices] = useState<Set<number>>(new Set());

  // Create mode: user-built pattern
  const [createdPattern, setCreatedPattern] = useState<string[]>([]);

  // Translation mode: user-built translated pattern
  const [translatedPattern, setTranslatedPattern] = useState<string[]>([]);

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Domain-specific tracking (not covered by shared hooks)
  const [coreIdentifiedCorrectly, setCoreIdentifiedCorrectly] = useState(false);
  const [ruleArticulated, setRuleArticulated] = useState(false);
  const [patternCreated, setPatternCreated] = useState(false);
  const [translationCorrect, setTranslationCorrect] = useState(false);
  const [patternTypesExplored] = useState(new Set<string>([patternType]));

  // In-item levers (`patternBuilderLevers.ts`), keyed by the session item they were pulled on, and the easier
  // practice item a simplify lever puts in place of the session item until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PatternBuilderChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] || null;
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = sessionChallenge && leverState.item === sessionChallenge.id ? leverState.pulled : [];
  const currentPhase: PatternPhase = phaseFor(currentChallenge?.type);

  // Per-challenge sequence override (single-type eval modes give each challenge its own pattern).
  // Falls back to the top-level sequence for multi-type mode where all challenges share one pattern.
  const activeSequence = currentChallenge ? sequenceFor(data, currentChallenge) : sequence;

  // Per-challenge translation mapping override (translate-only mode).
  const activeMapping = currentChallenge ? mappingFor(data, currentChallenge) : translationTarget?.mapping;

  // The top-level rule describes the shared pattern only; a challenge with its own pattern has no rule of its own.
  const challengeRule = currentChallenge && !currentChallenge.sequence ? sequence.rule : null;

  // Compute which phases are actually represented so tabs don't show phantom phases
  const presentPhases = useMemo((): Set<PatternPhase> => {
    const phases = new Set<PatternPhase>(challenges.map(c => phaseFor(c.type)));
    if (phases.size === 0) phases.add('copy');
    return phases;
  }, [challenges]);

  // A fresh challenge, or the same one after Try again, starts clean, except an open build: its Try again keeps
  // the learner's row and the verdict's words, to revise.
  const isOpenBuild = currentChallenge?.type === 'create' && !!currentChallenge.createShape;
  reopen.current = (retry) => {
    if (retry && isOpenBuild) return;
    if (!retry) setPractice(null);
    setFeedback('');
    setFeedbackType('');
    setExtensionAnswers([]);
    setSelectedCoreIndices(new Set());
    setCreatedPattern([]);
    setTranslatedPattern([]);
  };

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<PatternBuilderMetrics>({
    primitiveType: 'pattern-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  /** Learner input is closed while a checked answer waits for Try again, and once the challenge is solved. */
  const learnerBlocked = () => !canAttempt || isCurrentChallengeComplete || hasSubmittedEvaluation || allChallengesComplete;

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const clearFeedback = () => { setFeedback(''); setFeedbackType(''); };

  const handleAddExtensionToken = (token: string) => {
    if (learnerBlocked()) return;
    SoundManager.tap();
    setExtensionAnswers(prev => (prev.length >= activeSequence.hidden.length ? prev : [...prev, token]));
    clearFeedback();
  };

  const handleRemoveLastExtension = () => {
    if (learnerBlocked()) return;
    setExtensionAnswers(prev => prev.slice(0, -1));
    clearFeedback();
  };

  const handleToggleCoreIndex = (index: number) => {
    if (learnerBlocked()) return;
    SoundManager.select();
    setSelectedCoreIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    clearFeedback();
  };

  const handleAddCreatedToken = (token: string) => {
    if (learnerBlocked()) return;
    SoundManager.tap();
    setCreatedPattern(prev => [...prev, token]);
    clearFeedback();
  };

  const handleRemoveLastCreated = () => {
    if (learnerBlocked()) return;
    setCreatedPattern(prev => prev.slice(0, -1));
    clearFeedback();
  };

  const handleStartOver = () => {
    if (learnerBlocked()) return;
    setCreatedPattern([]);
    clearFeedback();
  };

  const handleAddTranslatedToken = (token: string) => {
    if (learnerBlocked()) return;
    SoundManager.tap();
    setTranslatedPattern(prev => [...prev, token]);
    clearFeedback();
  };

  const handleRemoveLastTranslated = () => {
    if (learnerBlocked()) return;
    setTranslatedPattern(prev => prev.slice(0, -1));
    clearFeedback();
  };

  // -------------------------------------------------------------------------
  // Check: the builder's own verdict, committed to the workspace
  // -------------------------------------------------------------------------
  const view: PatternBuilderView = {
    extension: extensionAnswers, coreIndices: Array.from(selectedCoreIndices), created: createdPattern, translated: translatedPattern,
  };

  /** The message a check shows; never the answer before it is found. */
  const checkFeedback = (correct: boolean): string => {
    switch (currentChallenge?.type) {
      case 'extend': return correct ? 'Great job! You extended the pattern correctly!' : 'Not quite! Look at the pattern again. What repeats?';
      case 'identify_core': return correct ? 'You found the repeating core!'
        : 'That\'s not quite the repeating unit. Try selecting the smallest group that repeats.';
      case 'create': {
        if (correct) return 'Wonderful! You made your own pattern!';
        // Never the tokens to use: the miss in words, and the asked shape (the task) again.
        const shape = currentChallenge.createShape ? shapeLetters(currentChallenge.createShape) : '';
        const miss = patternBuilderMiss(data, currentChallenge, view);
        if (miss === 'too_short') return shape ? `Make your ${shape} part, then make it again.` : 'Add more tokens. A pattern needs to repeat at least twice!';
        if (miss === 'other_shape') return shape ? `That repeats, but it is not ${shape} yet. Look at your first part.` : 'Use at least two different tokens.';
        return 'I can\'t see the same part again. Look at your first part, then make it again.';
      }
      case 'translate': return correct ? 'Perfect translation! Same pattern, different look!'
        : 'Not quite. Each token maps to a specific new token. Check the mapping!';
      case 'find_rule': return correct ? (challengeRule ? `Great thinking! The rule is: "${challengeRule}"` : 'You figured out the pattern!')
        : 'Think about what happens to each number to get the next one.';
      default: return '';
    }
  };

  const handleCheckAnswer = () => {
    if (!currentChallenge || learnerBlocked()) return;
    const correct = patternBuilderMatches(data, currentChallenge, view);
    setFeedback(checkFeedback(correct));
    setFeedbackType(correct ? 'success' : 'error');
    // An easier practice item is ungraded: its success records nothing for the session.
    if (correct && !practice) {
      if (currentChallenge.type === 'identify_core') setCoreIdentifiedCorrectly(true);
      if (currentChallenge.type === 'find_rule') setRuleArticulated(true);
      if (currentChallenge.type === 'create') setPatternCreated(true);
      if (currentChallenge.type === 'translate') setTranslationCorrect(true);
      SoundManager.playCorrect();
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        type: currentChallenge.type,
        attempts: currentAttempts + 1,
      });
    } else if (correct) {
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
    }
    progress.commitCheck(describePatternBuilderCheck(data, currentChallenge, view), correct,
      patternBuilderMiss(data, currentChallenge, view));
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

    const extendResults = challengeResults.filter(r => challenges.find(c => c.id === r.challengeId)?.type === 'extend');
    const totalCorrect = challengeResults.filter(r => r.correct).length;
    const score = challenges.length > 0 ? Math.round((totalCorrect / challenges.length) * 100) : 0;
    const metrics: PatternBuilderMetrics = {
      type: 'pattern-builder',
      evalMode: challenges[0]?.type ?? 'default',
      extensionsCorrect: extendResults.filter(r => r.correct).length,
      extensionsTotal: extendResults.length,
      coreIdentifiedCorrectly,
      ruleArticulated,
      patternCreated,
      translationCorrect,
      patternTypesExplored: patternTypesExplored.size,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };
    submitEvaluation(totalCorrect === challenges.length, score, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, challengeResults, challenges,
    coreIdentifiedCorrectly, ruleArticulated, patternCreated, translationCorrect, patternTypesExplored, submitEvaluation]);

  // The session item's levers (`patternBuilderLevers.ts`); a help lever's picture is drawn beside or on the session
  // item only while it is pulled (or shown from the start on easy), never on a practice item.
  const itemLevers = sessionChallenge ? patternBuilderLevers(sessionChallenge, data, pulledLevers) : [];
  const helpOn = (id: string) => !practice && itemLevers.some(l => l.id === id && l.pulled);
  const shownModel = sessionChallenge && helpOn(MODEL_LEVER) ? shapeModel(sessionChallenge, paletteFor(data, sessionChallenge)) : null;
  const groupLen = sessionChallenge && helpOn(GROUPS_LEVER) ? repeatGroups(data, sessionChallenge) : null;
  const shownLine = sessionChallenge && helpOn(LINE_LEVER) ? numberLine(data, sessionChallenge) : null;
  const shownCoreModel = sessionChallenge && helpOn(CORE_MODEL_LEVER) ? coreModel(data, sessionChallenge) : null;
  const markerOn = !!sessionChallenge && helpOn(MARKER_LEVER);
  const markerAt = markerOn && sessionChallenge ? markerPlace(data, sessionChallenge, translatedPattern.length) : null;

  /** Every learner row back to empty: a practice item and the full item it stands in for share no work. */
  const clearWork = () => {
    setExtensionAnswers([]); setSelectedCoreIndices(new Set()); setCreatedPattern([]); setTranslatedPattern([]); clearFeedback();
  };

  // What the tutor and the observer are shown, republished every render. Derived from the challenge
  // alone, so opening an item adds no revision after the advance.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = patternBuilderScene(data, currentChallenge);
    const levers = practice ? [] : itemLevers;
    const onScreen = shownModel ? modelFact(shownModel)
      : groupLen ? groupsFact(data, sessionChallenge, groupLen)
      : shownLine ? lineFact(shownLine)
      : shownCoreModel ? coreModelFact(shownCoreModel)
      : markerOn ? markerFact(data, sessionChallenge, translatedPattern.length) : undefined;
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(isOpenBuild ? createdFacts(createdPattern) : {}),
        ...(onScreen ? { onScreen } : {}),
        // The gaps show where the row starts over, so the tier's "do not point it out" no longer holds.
        ...(groupLen ? { coaching: 'The gaps where the row starts over are on screen: you may point to them. Never say a blank\'s token.' } : {}),
        ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge, data);
          if (!easier) return 'This item is already the plainest of its kind.';
          setLeverState(next); setPractice(easier); clearWork();
          return { practice: patternBuilderAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice row is not the learner's work on it.
      endPractice: () => { setPractice(null); clearWork(); },
    };
  });

  // The live line (shared build layer) on an open build: what the row looks like, never a verdict or a count.
  const rowSvgRef = useRef<SVGSVGElement | null>(null);
  const buildSeeing = useBuildWatcher({
    buildKey: `${currentChallenge?.id}:${createdPattern.join(',')}`,
    enabled: isOpenBuild && createdPattern.length > 0 && !learnerBlocked(),
    svg: rowSvgRef,
    // The task without its shape words: the ask's "two", "pattern" and "repeat" are what the line may never say, and
    // a watcher handed them echoes them (a drive kept 2 of 5 lines).
    request: { task: 'Putting coloured tiles in a row, in an order the child chooses', numbers: 'never',
      neverSay: ['pattern', 'repeat', 'repeats', 'repeating'],
      // The row's token names, so the line names the learner's colours and shapes as placed (a drive caught the
      // watcher calling a red tile purple from the picture alone). Their own work, so naming it leaks nothing.
      sceneNote: 'A strip where the child places tiles, left to right, six to a line. Each tile shows its first letter.',
      made: `tiles, left to right: ${createdPattern.join(', ')}` },
  });

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const fullSequence = [...activeSequence.given, ...activeSequence.hidden];

  // -------------------------------------------------------------------------
  // Pip shared surface
  // -------------------------------------------------------------------------
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's last touch; Pip never places a token, checks, or advances.
  // Tutor audio counts only while the tutor is on this block and began on this challenge.
  const pip = usePipTargets(currentChallenge?.id ?? null, !isCurrentChallengeComplete && !hasSubmittedEvaluation);
  const pipRef = pip.ref;
  const tutorSpeaking = ctx.isAudioPlaying && !!currentChallenge
    && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId);
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete || hasSubmittedEvaluation) return null;
    const targets = pip.targets();
    const pose = patternBuilderPipPose({
      running: true, preparing: false, currentSolved: isCurrentChallengeComplete, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      phase: currentPhase,
      openSlotId: extensionAnswers.length < activeSequence.hidden.length ? `slot-${extensionAnswers.length}` : undefined,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Pattern builder',
      dock: pip.dock.current, targets, pose,
    };
  });

  // -------------------------------------------------------------------------
  // Overall Score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // Snapshot duration when challenges complete (elapsedMs from hook keeps ticking)
  const completionDurationRef = useRef<number | undefined>(undefined);
  if (allChallengesComplete && completionDurationRef.current === undefined) {
    completionDurationRef.current = elapsedMs;
  }

  // Determine available tokens for the current challenge
  const availableTokens = currentChallenge ? paletteFor(data, currentChallenge) : data.tokens.available;

  // -------------------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------------------

  // Render a single token cell
  const renderToken = useCallback((token: string, index: number, opts?: {
    onClick?: () => void;
    isHidden?: boolean;
    isSelected?: boolean;
    isCoreHighlight?: boolean;
    size?: number;
    /** Pip's registry id for this cell; presentation only. */
    pipId?: string;
  }) => {
    const {
      onClick,
      isHidden = false,
      isSelected = false,
      isCoreHighlight = false,
      size = CELL_SIZE,
      pipId,
    } = opts || {};

    const display = getTokenDisplay(token);
    const isClickable = !!onClick;

    return (
      <div
        key={`${token}-${index}`}
        ref={pipId ? pipRef(pipId) : undefined}
        data-pip-object={pipId}
        onClick={onClick}
        className={`
          inline-flex items-center justify-center rounded-lg font-bold text-lg
          transition-all duration-200 select-none
          ${isClickable ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}
          ${isHidden ? `${dropZoneStateClass('idle')} opacity-70` : ''}
          ${isSelected ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-900' : ''}
          ${isCoreHighlight ? 'ring-2 ring-emerald-400/60' : ''}
        `}
        style={{
          width: size,
          height: size,
          // Filled tokens keep their identity color (the answer the student
          // places); the empty "?" slot speaks the shared idle drop-zone
          // language via dropZoneStateClass above.
          ...(isHidden ? {} : {
            backgroundColor: display.bg,
            borderColor: display.border,
            borderWidth: 2,
            borderStyle: 'solid' as const,
            color: display.text,
          }),
          fontSize: size > 40 ? '1.25rem' : '0.875rem',
        }}
      >
        {isHidden ? '?' : display.label}
      </div>
    );
  }, [pipRef]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange" className="text-xs">
              {gradeBand === 'K-1' ? 'Grades K-1' : 'Grades 2-3'}
            </LuminaBadge>
            <LuminaBadge accent="emerald" className="text-xs capitalize">
              {patternType} Pattern
            </LuminaBadge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(PHASE_CONFIG).filter(([phase]) => presentPhases.has(phase as PatternPhase)).map(([phase, config]) => (
              <LuminaBadge
                key={phase}
                accent={currentPhase === phase ? 'orange' : undefined}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {config.label}
              </LuminaBadge>
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPanel className="p-3">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </LuminaPanel>
        )}
        {practice && <div className="text-center text-xs text-amber-300" data-practice>Practice row</div>}

        {/* Pattern Display */}
        {(currentPhase === 'copy' || currentPhase === 'identify') && (
          <div className="space-y-3">
            {/* Given sequence + hidden slots */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {showStepNumbers && (
                <div className="w-full flex justify-center gap-1.5 mb-1">
                  {fullSequence.map((_, i) => (
                    <div
                      key={`step-${i}`}
                      className="text-slate-600 text-[10px] text-center"
                      style={{ width: CELL_SIZE }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              )}
              <div ref={pip.ref('pattern')} data-pip-object="pattern" className="flex items-center gap-1.5 flex-wrap justify-center">
                {activeSequence.given.map((token, i) => {
                  const isCorePos = showCore && i < activeSequence.core.length;
                  const isIdentifyMode = currentPhase === 'identify';
                  const cell = renderToken(token, i, {
                    onClick: isIdentifyMode && !isCurrentChallengeComplete
                      ? () => { pip.look(`seq-${i}`); handleToggleCoreIndex(i); }
                      : undefined,
                    isSelected: isIdentifyMode && selectedCoreIndices.has(i),
                    isCoreHighlight: isCorePos && !isIdentifyMode,
                    pipId: isIdentifyMode ? `seq-${i}` : undefined,
                  });
                  // The help lever `repeat_groups`: a gap on the shown row where it starts over, never on a blank.
                  if (!groupLen || i === 0 || i % groupLen !== 0) return cell;
                  return (
                    <React.Fragment key={`gap-${i}`}>
                      <div data-lever="repeat-gap" aria-hidden className="mx-1.5 h-10 border-l-2 border-dashed border-amber-300/60" />
                      {cell}
                    </React.Fragment>
                  );
                })}

                {/* Separator */}
                {currentPhase === 'copy' && activeSequence.hidden.length > 0 && (
                  <div className="text-slate-600 text-xl mx-1">{'→'}</div>
                )}

                {/* Hidden slots / extension answers */}
                {currentPhase === 'copy' && activeSequence.hidden.map((token, i) => {
                  const answered = extensionAnswers[i];
                  if (answered) {
                    return renderToken(answered, activeSequence.given.length + i, {
                      onClick: !isCurrentChallengeComplete
                        ? () => {
                          pip.look(`slot-${i}`);
                          if (i === extensionAnswers.length - 1) handleRemoveLastExtension();
                        }
                        : undefined,
                      pipId: `slot-${i}`,
                    });
                  }
                  return renderToken(token, activeSequence.given.length + i, { isHidden: true, pipId: `slot-${i}` });
                })}
              </div>
            </div>

            {shownLine && <HopLine line={shownLine} />}
            {shownCoreModel && (
              // The help lever `core_model`: a row in other pictures with its OWN part boxed, beside the item and never
              // on it; its shape differs from the item's part, so no box length carries over.
              <div className="flex flex-wrap items-center justify-center gap-2" data-lever="core-model"
                aria-label={`Like this: ${shownCoreModel.names.join(', ')}`}>
                <span className="mr-1 text-sm text-slate-400">Like this:</span>
                {Array.from({ length: shownCoreModel.glyphs.length / shownCoreModel.shape.length }, (_, g) => (
                  <span key={g} data-model-part className="flex gap-1 rounded-md border-2 border-amber-300/60 px-1.5 py-0.5">
                    {shownCoreModel.glyphs.slice(g * shownCoreModel.shape.length, (g + 1) * shownCoreModel.shape.length)
                      .map((glyph, i) => <span key={i} className="text-2xl leading-none">{glyph}</span>)}
                  </span>
                ))}
              </div>
            )}

            {/* Core highlight label */}
            {showCore && currentPhase !== 'identify' && (
              <div className="text-center">
                <span className="text-emerald-400/60 text-xs">
                  Core: {activeSequence.core.join(' ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Create Mode */}
        {currentPhase === 'create' && (
          <div className="space-y-3">
            {isOpenBuild && currentChallenge?.createShape && (
              // The shape as grey glyphs, one per letter: no token's colour, shape or initial, so it reads as the
              // structure to make and never as tokens to copy. The letters stay small under each glyph for readers.
              <div className="flex items-end justify-center gap-2" data-asked-shape aria-label={`Shape ${shapeLetters(currentChallenge.createShape)}`}>
                <span className="mr-1 text-sm text-slate-400">Shape:</span>
                {currentChallenge.createShape.split('').map((letter, i) => (
                  <span key={i} className="flex flex-col items-center">
                    <span className="text-2xl leading-none text-slate-400">{SHAPE_GLYPHS[letter] ?? '◯'}</span>
                    <span className="text-[10px] text-slate-500">{letter}</span>
                  </span>
                ))}
              </div>
            )}
            {shownModel && (
              // The help lever: the asked shape twice in pictures that are not on the palette, beside the build and
              // never on it, so it shows how the shape goes without giving a row to copy.
              <div className="flex items-center justify-center gap-2" data-lever="shape-model"
                aria-label={`Like this: ${shownModel.names.join(', ')}`}>
                <span className="mr-1 text-sm text-slate-400">Like this:</span>
                {shownModel.glyphs.map((glyph, i) => <span key={i} className="text-2xl leading-none">{glyph}</span>)}
              </div>
            )}
            {isOpenBuild ? (
              <div ref={pip.ref('build')} data-pip-object="build"
                className="flex min-h-[60px] items-center justify-center rounded-lg border border-white/5 bg-slate-800/20 p-3">
                {createdPattern.length === 0
                  ? <p className="text-slate-500 text-sm">Tap tokens below to make your pattern</p>
                  : <CreatedRow ref={rowSvgRef} row={createdPattern}
                    onTapLast={!learnerBlocked() ? () => { pip.look('build'); handleRemoveLastCreated(); } : undefined} />}
              </div>
            ) : (
            <div ref={pip.ref('build')} data-pip-object="build"
              className="flex items-center justify-center gap-1.5 flex-wrap min-h-[60px] bg-slate-800/20 rounded-lg p-3 border border-white/5">
              {createdPattern.length === 0 ? (
                <p className="text-slate-500 text-sm">Tap tokens below to build your pattern</p>
              ) : (
                createdPattern.map((token, i) =>
                  renderToken(token, i, {
                    onClick: !isCurrentChallengeComplete && i === createdPattern.length - 1
                      ? () => { pip.look('build'); handleRemoveLastCreated(); }
                      : undefined,
                  })
                )
              )}
            </div>
            )}
            {isOpenBuild && (
              <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
                {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
              </div>
            )}
          </div>
        )}

        {/* Translate Mode */}
        {currentPhase === 'translate' && (
          <div className="space-y-3">
            {/* Source pattern */}
            <div className="space-y-1">
              <p className="text-slate-400 text-xs text-center">
                Original ({translationTarget?.sourceType || 'source'}):
              </p>
              <div className="flex items-start justify-center gap-1.5 flex-wrap" data-lever={markerOn ? 'place-marker' : undefined}>
                {activeSequence.given.map((token, i) => !markerOn ? renderToken(token, i) : (
                  // The help lever `place_marker`: a tick under each place made and a marker under the next, from the
                  // learner's own row; nothing on the build row or the palette.
                  <div key={`src-${i}`} className="flex flex-col items-center gap-0.5">
                    {renderToken(token, i, { isSelected: markerAt === i })}
                    <span className="h-4 text-xs leading-4" data-place={i < translatedPattern.length ? 'done' : markerAt === i ? 'next' : undefined}>
                      {i < translatedPattern.length ? <span className="text-emerald-400">✓</span>
                        : markerAt === i ? <span className="text-orange-300">▲</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Translation key: each old token and the new token it becomes, drawn as the tokens themselves */}
            {activeMapping && (
              <div data-pip-object="key" className="flex items-center justify-center gap-3 flex-wrap text-xs">
                {Object.entries(activeMapping).map(([from, to], i) => (
                  <span key={from} className="flex items-center gap-1 text-slate-400">
                    {renderToken(from, i, { size: 28 })}
                    {'→'}
                    {renderToken(to, i, { size: 28 })}
                  </span>
                ))}
              </div>
            )}

            {/* Translation zone */}
            <div className="space-y-1">
              <p className="text-slate-400 text-xs text-center">
                Your translation ({translationTarget?.targetType || 'target'}):
              </p>
              <div ref={pip.ref('build')} data-pip-object="build"
                className="flex items-center justify-center gap-1.5 flex-wrap min-h-[60px] bg-slate-800/20 rounded-lg p-3 border border-white/5">
                {translatedPattern.length === 0 ? (
                  <p className="text-slate-500 text-sm">Tap tokens below to translate</p>
                ) : (
                  translatedPattern.map((token, i) =>
                    renderToken(token, i, {
                      onClick: !isCurrentChallengeComplete && i === translatedPattern.length - 1
                        ? () => { pip.look('build'); handleRemoveLastTranslated(); }
                        : undefined,
                    })
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rule Display */}
        {showRule && challengeRule && isCurrentChallengeComplete && (
          <div className="text-center">
            <LuminaBadge accent="emerald" className="bg-emerald-500/10 border-emerald-400/30 text-xs">
              Rule: {challengeRule}
            </LuminaBadge>
          </div>
        )}

        {/* Pip's dock sits between the workspace and the palette: every cue
            (a "?" slot, the pattern row, the build zone) is above it and every
            answer token is below it, so a pointer never crosses a token. */}
        {pipStore && currentChallenge && !allChallengesComplete && (
          <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
            className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
        )}

        {/* Token Palette */}
        {!allChallengesComplete && !isCurrentChallengeComplete && (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs text-center">Available tokens:</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {availableTokens.map((token, i) =>
                renderToken(token, i, {
                  pipId: `token-${i}`,
                  onClick: () => {
                    pip.look(`token-${i}`);
                    if (currentPhase === 'copy') handleAddExtensionToken(token);
                    else if (currentPhase === 'create') handleAddCreatedToken(token);
                    else if (currentPhase === 'translate') handleAddTranslatedToken(token);
                  },
                  size: 44,
                })
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons: the runtime advances, so there is no Next here */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && isOpenBuild && (
              <>
                {createdPattern.length > 0 && (
                  <LuminaButton tone="subtle" className="text-xs" disabled={learnerBlocked()} onClick={handleStartOver}>
                    {START_OVER_LABEL}
                  </LuminaButton>
                )}
                <LuminaButton tone="primary" onClick={handleCheckAnswer} disabled={learnerBlocked() || createdPattern.length === 0}>
                  {DONE_LABEL}
                </LuminaButton>
              </>
            )}
            {!isCurrentChallengeComplete && !allChallengesComplete && !isOpenBuild && (
              <>
                {/* Undo button */}
                {(extensionAnswers.length > 0 || createdPattern.length > 0 || translatedPattern.length > 0) && (
                  <LuminaButton
                    tone="subtle"
                    className="text-xs"
                    disabled={learnerBlocked()}
                    onClick={() => {
                      if (currentPhase === 'copy') handleRemoveLastExtension();
                      else if (currentPhase === 'create') handleRemoveLastCreated();
                      else if (currentPhase === 'translate') handleRemoveLastTranslated();
                    }}
                  >
                    Undo
                  </LuminaButton>
                )}
                <LuminaActionButton
                  action="check"
                  onClick={handleCheckAnswer}
                  disabled={learnerBlocked()}
                />
              </>
            )}
            {allChallengesComplete && !hasSubmittedEvaluation && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Summary Panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={completionDurationRef.current}
            heading="Pattern Challenge Complete!"
            celebrationMessage="You explored patterns like a mathematician!"
            className="mb-6"
          />
        )}

        {/* Hint: after two misses, and it stays up through Try again */}
        {currentChallenge?.hint && currentAttempts >= 2 && !isCurrentChallengeComplete && !allChallengesComplete && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

/** The open build's row as one svg, so the build watcher's picture is exactly what the learner sees. Six to a line;
 *  the last token taps off. No grouping or count is drawn (the parts are the learner's to make). */
const CreatedRow = React.forwardRef<SVGSVGElement, { row: string[]; onTapLast?: () => void }>(function CreatedRow({ row, onTapLast }, ref) {
  const size = 48, gap = 6, perLine = 6;
  const cols = Math.min(perLine, row.length), lines = Math.ceil(row.length / perLine);
  const width = cols * (size + gap) - gap, height = lines * (size + gap) - gap;
  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="h-auto max-w-full" data-created-row>
      {row.map((token, i) => {
        const d = getTokenDisplay(token);
        const x = (i % perLine) * (size + gap), y = Math.floor(i / perLine) * (size + gap);
        const last = i === row.length - 1;
        return (
          <g key={i} data-created-token={i} onClick={last ? onTapLast : undefined} style={last && onTapLast ? { cursor: 'pointer' } : undefined}>
            <rect x={x} y={y} width={size} height={size} rx={8} fill={d.bg} stroke={d.border} strokeWidth={2} />
            <text x={x + size / 2} y={y + size / 2 + 7} textAnchor="middle" fontSize={20} fontWeight={700} fill={d.text}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
});

/** The help lever `number_line`: the shown numbers as dots on a line that spans them only, a hop from each to the
 *  next and no size written. Nothing past the last shown number, so no blank's place is drawn. */
function HopLine({ line }: { line: NumberLineModel }) {
  const width = 320, pad = 18, y = 46;
  const x = (v: number) => pad + ((v - line.min) / (line.max - line.min)) * (width - 2 * pad);
  return (
    <div className="flex justify-center" data-lever="number-line">
      <svg width={width} height={70} viewBox={`0 0 ${width} 70`} className="max-w-full" aria-label={`Number line from ${line.min} to ${line.max}`}>
        <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#94a3b8" strokeWidth={2} />
        {line.points.slice(1).map((p, i) => {
          const a = x(line.points[i]), b = x(p), mid = (a + b) / 2, rise = Math.min(30, Math.abs(b - a) / 2 + 6);
          return <path key={`hop-${i}`} data-hop d={`M ${a} ${y} Q ${mid} ${y - rise * 2} ${b} ${y}`} fill="none" stroke="#fbbf24" strokeWidth={2} />;
        })}
        {line.points.map((p, i) => (
          <g key={`dot-${i}`}>
            <circle cx={x(p)} cy={y} r={5} fill="#38bdf8" />
            <text x={x(p)} y={y + 18} textAnchor="middle" fontSize={12} fill="#cbd5e1">{p}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const PatternBuilder = withWorkspaceOnly<PatternBuilderProps>('pattern-builder', PatternBuilderSurface, props => props.data.title);

export default PatternBuilder;
