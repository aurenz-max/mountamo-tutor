'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaChallengeCounter,
  LuminaPrompt,
  LuminaCallout,
  LuminaChipBank,
  LuminaFeedbackCard,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SentenceBuilderMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SentenceBuilderData {
  title: string;
  gradeLevel: string;
  sentenceType: 'simple' | 'compound' | 'complex' | 'compound-complex';

  // Challenges - each is a sentence to build
  challenges: Array<{
    id: string;
    targetMeaning: string;           // What the sentence should express
    tiles: Array<{
      id: string;
      text: string;
      role: 'subject' | 'predicate' | 'object' | 'modifier' | 'conjunction' | 'punctuation';
    }>;
    validArrangements: string[][];   // Array of valid tile ID orderings
    hint?: string;
  }>;

  // Role color legend
  roleColors: Record<string, string>; // e.g., { subject: 'blue', predicate: 'red' }

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SentenceBuilderMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface SentenceBuilderProps {
  data: SentenceBuilderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type TileRole = 'subject' | 'predicate' | 'object' | 'modifier' | 'conjunction' | 'punctuation';
type LearningPhase = 'explore' | 'practice' | 'apply';

// Pedagogical role color-coding for the build tiles (the interaction surface).
// These tints intentionally match the role legend so students can map a word
// to its grammatical role — they are NOT grading colors.
const ROLE_STYLES: Record<TileRole, string> = {
  subject: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  predicate: 'bg-red-500/20 border-red-500/40 text-red-300',
  object: 'bg-green-500/20 border-green-500/40 text-green-300',
  modifier: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  conjunction: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
  punctuation: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
};

const ROLE_LABELS: Record<TileRole, string> = {
  subject: 'Subject',
  predicate: 'Predicate',
  object: 'Object',
  modifier: 'Modifier',
  conjunction: 'Conjunction',
  punctuation: 'Punctuation',
};

const PHASE_LABELS: Record<LearningPhase, { label: string; description: string }> = {
  explore: { label: 'Explore', description: 'Fill in the missing part' },
  practice: { label: 'Practice', description: 'Build sentences from tiles' },
  apply: { label: 'Apply', description: 'Create your own sentence' },
};

const PHASE_ACCENT: Record<LearningPhase, LuminaAccent> = {
  explore: 'blue',
  practice: 'amber',
  apply: 'emerald',
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  explore:  { label: 'Explore',  icon: '🔍', accentColor: 'blue' },
  practice: { label: 'Practice', icon: '✏️',  accentColor: 'amber' },
  apply:    { label: 'Apply',    icon: '🚀', accentColor: 'emerald' },
};

// ============================================================================
// Unified challenge type — one entry per phase × original challenge
// ============================================================================

type UnifiedChallenge = SentenceBuilderData['challenges'][number] & {
  phase: LearningPhase;
};

// ============================================================================
// Component
// ============================================================================

const SentenceBuilder: React.FC<SentenceBuilderProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    sentenceType,
    challenges = [],
    roleColors,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Build unified challenges array (explore + practice + apply) ──
  const unifiedChallenges = useMemo((): UnifiedChallenge[] => [
    ...challenges.map((ch) => ({ ...ch, id: `explore-${ch.id}`, phase: 'explore' as LearningPhase })),
    ...challenges.map((ch) => ({ ...ch, id: `practice-${ch.id}`, phase: 'practice' as LearningPhase })),
    ...challenges.map((ch) => ({ ...ch, id: `apply-${ch.id}`, phase: 'apply' as LearningPhase })),
  ], [challenges]);

  // ── Challenge progress (replaces manual index/attempts/results state) ──
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({
    challenges: unifiedChallenges,
    getChallengeId: (ch) => ch.id,
  });

  // ── Phase results (for PhaseSummaryPanel) ──
  const phaseResults = usePhaseResults({
    challenges: unifiedChallenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.phase,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Derived state ──
  const currentChallenge = unifiedChallenges[currentIndex] ?? null;
  const currentPhase: LearningPhase = currentChallenge?.phase ?? 'explore';
  const withinPhaseIndex = challenges.length > 0 ? currentIndex % challenges.length : 0;

  const phaseCompletions = useMemo(() => ({
    explore: challenges.length > 0 && currentIndex >= challenges.length,
    practice: challenges.length > 0 && currentIndex >= challenges.length * 2,
    apply: allChallengesComplete,
  }), [currentIndex, challenges.length, allChallengesComplete]);

  // Explore phase: which tile index to hide (cycles with within-phase index)
  const exploreMissingIndex = useMemo(() => {
    if (currentPhase !== 'explore' || !currentChallenge) return 0;
    const arrangementLength = currentChallenge.validArrangements[0]?.length || 3;
    return withinPhaseIndex % arrangementLength;
  }, [currentPhase, currentChallenge, withinPhaseIndex]);

  // Current challenge already completed?
  const currentChallengeCompleted = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)
    : false;

  // ── Tile placement state ──
  const [placedTileIds, setPlacedTileIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Hints tracking (still per-challenge, keyed by unified ID)
  const [hintsUsedPerChallenge, setHintsUsedPerChallenge] = useState<Record<string, number>>({});

  // ── Evaluation hook ──
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<SentenceBuilderMetrics>({
    primitiveType: 'sentence-builder',
    instanceId: instanceId || `sentence-builder-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ──
  const resolvedInstanceId = instanceId || `sentence-builder-${Date.now()}`;

  const aiPrimitiveData = useMemo(() => ({
    sentenceType,
    currentPhase,
    phaseDescription: PHASE_LABELS[currentPhase]?.description ?? '',
    withinPhaseIndex: withinPhaseIndex + 1,
    totalChallengesPerPhase: challenges.length,
    targetMeaning: currentChallenge?.targetMeaning ?? '',
    tilesPlaced: placedTileIds.length,
    totalTiles: currentChallenge?.tiles.length ?? 0,
    attemptNumber: currentAttempts + 1,
    gradeLevel,
    placedWords: placedTileIds.map(id => currentChallenge?.tiles.find(t => t.id === id)?.text ?? '').join(' '),
    tileRoles: currentChallenge?.tiles.map(t => `${t.text}(${t.role})`).join(', ') ?? '',
  }), [
    sentenceType, currentPhase, withinPhaseIndex, challenges.length,
    currentChallenge, placedTileIds, currentAttempts, gradeLevel,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'sentence-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ─── Activity introduction ──
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Sentence Builder for grade ${gradeLevel}. Sentence type: ${sentenceType}. `
      + `${challenges.length} challenges across 3 phases (explore → practice → apply). `
      + `First challenge: "${currentChallenge?.targetMeaning}". `
      + `Introduce warmly: "Let's build some sentences together!"`,
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, gradeLevel, sentenceType, sendText]);

  // ── Local overall score (fallback for PhaseSummaryPanel) ──
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || unifiedChallenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / unifiedChallenges.length) * 100);
  }, [allChallengesComplete, unifiedChallenges, challengeResults]);

  // ── Explore phase: correct arrangement for current challenge ──
  const exploreCorrectArrangement = useMemo(() => {
    if (!currentChallenge || currentChallenge.validArrangements.length === 0) return [];
    return currentChallenge.validArrangements[0];
  }, [currentChallenge]);

  // Available tiles for the word bank (not yet placed)
  const availableTiles = useMemo(() => {
    if (!currentChallenge) return [];
    if (currentPhase === 'explore') {
      const missingTileId = exploreCorrectArrangement[exploreMissingIndex];
      return currentChallenge.tiles.filter(t => t.id === missingTileId);
    }
    return currentChallenge.tiles.filter(t => !placedTileIds.includes(t.id));
  }, [currentChallenge, currentPhase, placedTileIds, exploreCorrectArrangement, exploreMissingIndex]);

  // Shuffled tiles for the word bank
  const shuffledBankTiles = useMemo(() => {
    if (currentPhase === 'explore') return availableTiles;
    const shuffled = [...availableTiles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase, currentIndex, availableTiles.length]);

  // Frame slots for explore phase
  const exploreFrameSlots = useMemo(() => {
    if (currentPhase !== 'explore' || !currentChallenge) return [];
    return exploreCorrectArrangement.map((tileId, index) => {
      if (index === exploreMissingIndex) {
        const placedId = placedTileIds[0];
        if (placedId) {
          const tile = currentChallenge.tiles.find(t => t.id === placedId);
          return { isEmpty: false, tile, isTarget: true };
        }
        return { isEmpty: true, tile: null, isTarget: true };
      }
      const tile = currentChallenge.tiles.find(t => t.id === tileId);
      return { isEmpty: false, tile, isTarget: false };
    });
  }, [currentPhase, currentChallenge, exploreCorrectArrangement, exploreMissingIndex, placedTileIds]);

  // ── Handlers ──

  const handleAddTile = useCallback((tileId: string) => {
    if (hasSubmittedEvaluation) return;
    SoundManager.tap();
    if (currentPhase === 'explore') {
      setPlacedTileIds([tileId]);
    } else {
      setPlacedTileIds(prev => [...prev, tileId]);
    }
    setFeedback('');
    setFeedbackType('');
  }, [currentPhase, hasSubmittedEvaluation]);

  const handleRemoveTile = useCallback((tileId: string) => {
    if (hasSubmittedEvaluation) return;
    setPlacedTileIds(prev => prev.filter(id => id !== tileId));
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  const handleClearAll = useCallback(() => {
    setPlacedTileIds([]);
    setFeedback('');
    setFeedbackType('');
  }, []);

  const handleCheck = useCallback(() => {
    if (!currentChallenge) return;

    incrementAttempts();

    let isCorrect = false;

    if (currentPhase === 'explore') {
      const missingTileId = exploreCorrectArrangement[exploreMissingIndex];
      isCorrect = placedTileIds.length === 1 && placedTileIds[0] === missingTileId;
    } else {
      isCorrect = currentChallenge.validArrangements.some(
        arrangement =>
          arrangement.length === placedTileIds.length &&
          arrangement.every((id, index) => id === placedTileIds[index])
      );
    }

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback('Correct! Great job building that sentence!');
      setFeedbackType('success');
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      const placedWords = placedTileIds.map(id => currentChallenge.tiles.find(t => t.id === id)?.text ?? '').join(' ');
      sendText(
        `[ANSWER_CORRECT] Student built the sentence correctly in the ${currentPhase} phase! `
        + `Sentence: "${placedWords}". Attempt ${currentAttempts + 1}. `
        + `Target meaning: "${currentChallenge.targetMeaning}". Celebrate briefly and encourage.`,
        { silent: true },
      );

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        hintsUsed: hintsUsedPerChallenge[currentChallenge.id] || 0,
      });
    } else {
      SoundManager.playIncorrect();
      const placedWords = placedTileIds.map(id => currentChallenge.tiles.find(t => t.id === id)?.text ?? '').join(' ');
      setFeedback('Not quite right. Try rearranging the tiles!');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      sendText(
        `[ANSWER_INCORRECT] Student arranged: "${placedWords}" but it doesn't match a valid arrangement. `
        + `Phase: ${currentPhase}. Attempt ${currentAttempts + 1}. `
        + `Target meaning: "${currentChallenge.targetMeaning}". `
        + `Available roles: ${currentChallenge.tiles.map(t => `${t.text}(${t.role})`).join(', ')}. `
        + `Give a hint about sentence structure without revealing the answer.`,
        { silent: true },
      );
    }
  }, [currentChallenge, currentPhase, placedTileIds, exploreCorrectArrangement, exploreMissingIndex, incrementAttempts, recordResult, currentAttempts, hintsUsedPerChallenge, sendText]);

  const handleHint = useCallback(() => {
    if (!currentChallenge) return;
    setShowHint(true);
    setHintsUsedPerChallenge(prev => ({
      ...prev,
      [currentChallenge.id]: (prev[currentChallenge.id] || 0) + 1,
    }));
  }, [currentChallenge]);

  // Submit final evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const completedCount = challengeResults.filter(r => r.correct).length;
    const accuracy = unifiedChallenges.length > 0 ? (completedCount / unifiedChallenges.length) * 100 : 0;
    const score = Math.round(Math.max(0, Math.min(100, accuracy)));
    const totalHintsUsed = Object.values(hintsUsedPerChallenge).reduce((s, v) => s + v, 0);

    const metrics: SentenceBuilderMetrics = {
      type: 'sentence-builder',
      sentenceType,
      gradeLevel: data.gradeLevel || '2',
      totalChallenges: unifiedChallenges.length,
      challengesCompleted: completedCount,
      explorePhaseCompleted: true,
      practicePhaseCompleted: true,
      applyPhaseCompleted: true,
      totalAttempts,
      totalHintsUsed,
      averageAttemptsPerChallenge: unifiedChallenges.length > 0 ? totalAttempts / unifiedChallenges.length : 0,
      challengeResults: unifiedChallenges.map(ch => ({
        challengeId: ch.id,
        completed: challengeResults.some(r => r.challengeId === ch.id && r.correct),
        attempts: challengeResults.find(r => r.challengeId === ch.id)?.attempts || 0,
        hintsUsed: hintsUsedPerChallenge[ch.id] || 0,
      })),
      accuracy: Math.round(accuracy),
    };

    submitEvaluation(
      score >= 60,
      score,
      metrics,
      {
        placedTileIds,
        phaseCompletions: { explore: true, practice: true, apply: true },
      }
    );
  }, [
    hasSubmittedEvaluation,
    challengeResults,
    unifiedChallenges,
    sentenceType,
    data.gradeLevel,
    hintsUsedPerChallenge,
    placedTileIds,
    submitEvaluation,
  ]);

  // Move to next challenge or finish
  const handleNext = useCallback(() => {
    const prevPhase = currentPhase;

    setPlacedTileIds([]);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setIsShaking(false);
    setIsCelebrating(false);

    if (!advanceProgress()) {
      // All challenges done — submit evaluation
      const correctCount = challengeResults.filter(r => r.correct).length;
      const overallPct = unifiedChallenges.length > 0
        ? Math.round((correctCount / unifiedChallenges.length) * 100)
        : 0;

      sendText(
        `[ALL_COMPLETE] Student finished all ${unifiedChallenges.length} challenges across 3 phases! `
        + `Overall accuracy: ${overallPct}%. Sentence type: ${sentenceType}. `
        + `Celebrate the full session and comment on their sentence-building growth!`,
        { silent: true },
      );

      submitFinalEvaluation();
      return;
    }

    // Detect phase transition
    const nextIndex = currentIndex + 1;
    const nextChallenge = unifiedChallenges[nextIndex];
    const nextPhase = nextChallenge?.phase;

    if (nextPhase && nextPhase !== prevPhase) {
      sendText(
        `[PHASE_TRANSITION] Moving from ${PHASE_LABELS[prevPhase].label} to ${PHASE_LABELS[nextPhase as LearningPhase].label} phase. `
        + `New task: ${PHASE_LABELS[nextPhase as LearningPhase].description}. `
        + `Introduce the new phase and what the student should expect.`,
        { silent: true },
      );
    } else if (nextChallenge) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${(withinPhaseIndex + 2)} of ${challenges.length} in ${prevPhase} phase. `
        + `New target meaning: "${nextChallenge.targetMeaning}". Introduce it briefly.`,
        { silent: true },
      );
    }
  }, [advanceProgress, submitFinalEvaluation, currentPhase, currentIndex, unifiedChallenges,
    challengeResults, sentenceType, withinPhaseIndex, challenges.length, sendText]);

  // ── Render helpers ──

  // The build tile — the bespoke interaction object. Role-tinted (pedagogy),
  // picked up from the bank and placed into the sentence frame.
  const renderTile = (
    tile: { id: string; text: string; role: TileRole },
    onClick: () => void,
    isInFrame: boolean
  ) => {
    const roleStyle = ROLE_STYLES[tile.role];
    return (
      <button
        key={tile.id}
        onClick={onClick}
        className={`
          px-3 py-2 rounded-lg border font-medium text-sm
          transition-all duration-200 cursor-pointer select-none
          ${roleStyle}
          ${isInFrame ? 'hover:opacity-70' : 'hover:scale-105 hover:brightness-125'}
          ${isCelebrating && isInFrame ? 'animate-bounce' : ''}
        `}
      >
        {tile.text}
      </button>
    );
  };

  const renderPhaseProgress = () => {
    const phases: LearningPhase[] = ['explore', 'practice', 'apply'];
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const isActive = phase === currentPhase;
          const isCompleted = phaseCompletions[phase];
          return (
            <React.Fragment key={phase}>
              {index > 0 && (
                <div className={`h-0.5 w-8 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
                    ${isCompleted
                      ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                      : isActive
                        ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
                        : 'bg-slate-700/30 border-slate-600/40 text-slate-500'
                    }
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-blue-300' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {PHASE_LABELS[phase].label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderRoleLegend = () => {
    const roles: TileRole[] = ['subject', 'predicate', 'object', 'modifier', 'conjunction', 'punctuation'];
    const usedRoles = new Set(currentChallenge?.tiles.map(t => t.role) || []);
    const relevantRoles = roles.filter(r => usedRoles.has(r));

    // Role chips mirror the tile color-coding (pedagogy), so they stay bespoke
    // rather than using LuminaBadge's grading palette.
    return (
      <div className="flex flex-wrap gap-2 mb-3">
        {relevantRoles.map(role => (
          <span
            key={role}
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[role]}`}
          >
            {ROLE_LABELS[role]}
          </span>
        ))}
      </div>
    );
  };

  const renderSentenceFrame = () => {
    if (currentPhase === 'explore') {
      return (
        <div
          className={`
            flex flex-wrap items-center gap-2 min-h-[56px] p-4 rounded-xl
            border border-dashed border-white/20 bg-white/5
            ${isShaking ? 'animate-shake' : ''}
          `}
        >
          {exploreFrameSlots.map((slot, index) => {
            if (slot.isEmpty) {
              return (
                <div
                  key={`slot-${index}`}
                  className="px-3 py-2 rounded-lg border-2 border-dashed border-amber-500/40 bg-amber-500/10 min-w-[60px] min-h-[38px] flex items-center justify-center"
                >
                  <span className="text-amber-400/60 text-sm">?</span>
                </div>
              );
            }
            if (slot.isTarget && slot.tile) {
              return renderTile(
                slot.tile as { id: string; text: string; role: TileRole },
                () => handleRemoveTile(slot.tile!.id),
                true
              );
            }
            if (slot.tile) {
              return (
                <div
                  key={slot.tile.id}
                  className={`px-3 py-2 rounded-lg border font-medium text-sm ${ROLE_STYLES[slot.tile.role as TileRole]} opacity-80`}
                >
                  {slot.tile.text}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }

    const totalSlots = currentChallenge
      ? currentChallenge.validArrangements[0]?.length || currentChallenge.tiles.length
      : 0;
    const emptySlotCount = Math.max(0, totalSlots - placedTileIds.length);

    return (
      <div
        className={`
          flex flex-wrap items-center gap-2 min-h-[56px] p-4 rounded-xl
          border border-dashed border-white/20 bg-white/5
          ${isShaking ? 'animate-shake' : ''}
        `}
      >
        {placedTileIds.map(tileId => {
          const tile = currentChallenge?.tiles.find(t => t.id === tileId);
          if (!tile) return null;
          return renderTile(
            tile as { id: string; text: string; role: TileRole },
            () => handleRemoveTile(tileId),
            true
          );
        })}
        {Array.from({ length: emptySlotCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="px-3 py-2 rounded-lg border-2 border-dashed border-slate-600/40 bg-slate-800/20 min-w-[60px] min-h-[38px] flex items-center justify-center"
          >
            <span className="text-slate-600 text-xs">...</span>
          </div>
        ))}
      </div>
    );
  };

  const renderWordBank = () => {
    const tiles = currentPhase === 'explore' ? availableTiles : shuffledBankTiles;
    if (tiles.length === 0 && currentPhase !== 'explore') {
      return (
        <div className="text-center py-3 text-slate-500 text-sm">
          All tiles placed! Click &quot;Check&quot; to verify your sentence.
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {tiles.map(tile =>
          renderTile(
            tile as { id: string; text: string; role: TileRole },
            () => handleAddTile(tile.id),
            false
          )
        )}
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedback) return null;
    const status = feedbackType === 'success'
      ? 'correct'
      : feedbackType === 'error'
        ? 'incorrect'
        : 'insight';
    return (
      <LuminaFeedbackCard status={status} label={feedbackType === 'success' ? 'Correct!' : undefined}>
        {feedback}
      </LuminaFeedbackCard>
    );
  };

  // ── Early return ──

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Main render ──

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge className="text-xs capitalize">{sentenceType} sentences</LuminaBadge>
            </div>
          </div>
          <LuminaBadge accent={PHASE_ACCENT[currentPhase]} className="text-xs">
            {PHASE_LABELS[currentPhase].description}
          </LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress */}
        {renderPhaseProgress()}

        {/* Challenge Counter (within current phase) */}
        <div className="flex items-center justify-between">
          <LuminaChallengeCounter current={withinPhaseIndex + 1} total={challenges.length} />
          {currentChallenge.hint && (
            <LuminaButton
              onClick={handleHint}
              className="text-xs h-7 px-2"
            >
              Hint
            </LuminaButton>
          )}
        </div>

        {/* Target Meaning */}
        <LuminaPrompt>
          <p className="text-xs text-slate-500 mb-1 font-normal">Build a sentence that means:</p>
          <p className="text-slate-200 text-sm font-medium">{currentChallenge.targetMeaning}</p>
        </LuminaPrompt>

        {/* Hint */}
        {showHint && currentChallenge.hint && (
          <LuminaCallout accent="amber" label="Hint">
            {currentChallenge.hint}
          </LuminaCallout>
        )}

        {/* Role Legend */}
        {renderRoleLegend()}

        {/* Sentence Frame */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Your sentence:</p>
          {renderSentenceFrame()}
        </div>

        {/* Feedback */}
        {renderFeedback()}

        {/* Word Bank */}
        <LuminaChipBank label="Word Bank">
          {renderWordBank()}
        </LuminaChipBank>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          {!currentChallengeCompleted ? (
            <>
              <LuminaButton
                onClick={handleClearAll}
                disabled={placedTileIds.length === 0}
              >
                Clear
              </LuminaButton>
              <LuminaActionButton
                action="check"
                onClick={handleCheck}
                disabled={
                  currentPhase === 'explore'
                    ? placedTileIds.length !== 1
                    : placedTileIds.length === 0
                }
                className="ml-auto"
              >
                Check
              </LuminaActionButton>
            </>
          ) : (
            <LuminaActionButton
              action="next"
              onClick={handleNext}
              className="ml-auto"
            >
              {currentPhase === 'apply' && withinPhaseIndex === challenges.length - 1
                ? hasSubmittedEvaluation
                  ? 'Complete!'
                  : 'Finish'
                : 'Next'}
            </LuminaActionButton>
          )}
        </div>

        {/* Phase Summary Panel (replaces manual "Session Complete" UI) */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Session Complete!"
            celebrationMessage={`You completed all ${unifiedChallenges.length} challenges across three phases!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SentenceBuilder;
