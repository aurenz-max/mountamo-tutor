'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SentenceBuilderMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

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

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  explore:  { label: 'Explore',  icon: '\uD83D\uDD0D', accentColor: 'blue' },
  practice: { label: 'Practice', icon: '\u270F\uFE0F',  accentColor: 'amber' },
  apply:    { label: 'Apply',    icon: '\uD83D\uDE80', accentColor: 'emerald' },
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
      setFeedback('Correct! Great job building that sentence!');
      setFeedbackType('success');
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        hintsUsed: hintsUsedPerChallenge[currentChallenge.id] || 0,
      });
    } else {
      setFeedback('Not quite right. Try rearranging the tiles!');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  }, [currentChallenge, currentPhase, placedTileIds, exploreCorrectArrangement, exploreMissingIndex, incrementAttempts, recordResult, currentAttempts, hintsUsedPerChallenge]);

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
    setPlacedTileIds([]);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setIsShaking(false);
    setIsCelebrating(false);

    if (!advanceProgress()) {
      // All challenges done — submit evaluation
      submitFinalEvaluation();
      return;
    }
    // advanceProgress() already incremented index and reset attempts.
    // Domain-specific state already cleared above.
  }, [advanceProgress, submitFinalEvaluation]);

  // ── Render helpers ──

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
                  {isCompleted ? '\u2713' : index + 1}
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

    return (
      <div className="flex flex-wrap gap-2 mb-3">
        {relevantRoles.map(role => (
          <Badge
            key={role}
            variant="outline"
            className={`text-xs ${ROLE_STYLES[role]}`}
          >
            {ROLE_LABELS[role]}
          </Badge>
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
    return (
      <div
        className={`
          px-4 py-2 rounded-lg text-sm font-medium text-center
          ${feedbackType === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : feedbackType === 'error'
              ? 'bg-red-500/20 border border-red-500/40 text-red-300'
              : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
          }
        `}
      >
        {feedback}
      </div>
    );
  };

  // ── Early return ──

  if (!currentChallenge) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Main render ──

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
                Grade {gradeLevel}
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs capitalize">
                {sentenceType} sentences
              </Badge>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              currentPhase === 'explore'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : currentPhase === 'practice'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {PHASE_LABELS[currentPhase].description}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        {renderPhaseProgress()}

        {/* Challenge Counter (within current phase) */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Challenge {withinPhaseIndex + 1} of {challenges.length}
          </span>
          {currentChallenge.hint && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHint}
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 text-xs h-7 px-2"
            >
              Hint
            </Button>
          )}
        </div>

        {/* Target Meaning */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-xs text-slate-500 mb-1">Build a sentence that means:</p>
          <p className="text-slate-200 text-sm font-medium">{currentChallenge.targetMeaning}</p>
        </div>

        {/* Hint */}
        {showHint && currentChallenge.hint && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <p className="text-amber-300 text-sm">{currentChallenge.hint}</p>
          </div>
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
        <div>
          <p className="text-xs text-slate-500 mb-2">Word Bank:</p>
          <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
            {renderWordBank()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          {!currentChallengeCompleted ? (
            <>
              <Button
                variant="ghost"
                onClick={handleClearAll}
                disabled={placedTileIds.length === 0}
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
              >
                Clear
              </Button>
              <Button
                variant="ghost"
                onClick={handleCheck}
                disabled={
                  currentPhase === 'explore'
                    ? placedTileIds.length !== 1
                    : placedTileIds.length === 0
                }
                className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 ml-auto"
              >
                Check
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={handleNext}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 ml-auto"
            >
              {currentPhase === 'apply' && withinPhaseIndex === challenges.length - 1
                ? hasSubmittedEvaluation
                  ? 'Complete!'
                  : 'Finish'
                : 'Next'}
            </Button>
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
      </CardContent>
    </Card>
  );
};

export default SentenceBuilder;
