import React, { useState, useRef, useEffect } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { LifeCycleSequencerMetrics } from '../../../evaluation/types';
import { Clock, ArrowRight, CheckCircle2, XCircle, RotateCcw, Lightbulb, Sparkles, RefreshCw, GripVertical, ChevronDown, ChevronUp, HelpCircle, Zap } from 'lucide-react';

/**
 * Life Cycle Sequencer - Enhanced Interactive Biology Primitive
 *
 * NEW UX IMPROVEMENTS:
 * 1. Two-column layout: scrambled cards → timeline drop zones
 * 2. Enhanced drag feedback with drop zone highlighting
 * 3. Progressive disclosure (collapsible card details)
 * 4. Touch support with tap-to-place
 * 5. Visual timeline with connection lines
 * 6. Animated hints and better onboarding
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface LifeCycleStage {
  id: string;
  label: string;
  imagePrompt: string;
  description: string;
  correctPosition: number;
  transitionToNext: string;
  duration: string | null;
}

export interface MisconceptionTrap {
  commonError: string;
  correction: string;
}

export interface LifeCycleSequencerData {
  title: string;
  instructions: string;
  cycleType: 'linear' | 'circular';
  stages: LifeCycleStage[];
  scaleContext: string;
  misconceptionTrap: MisconceptionTrap;
  gradeBand: 'K-2' | '3-5' | '6-8';
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LifeCycleSequencerMetrics>) => void;
}

interface LifeCycleSequencerProps {
  data: LifeCycleSequencerData;
  className?: string;
}

interface StageAttempt {
  stageId: string;
  placedPosition: number;
  correctPosition: number;
  isCorrect: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const GRADE_BAND_COLORS: Record<string, { primary: string; secondary: string; rgb: string }> = {
  'K-2': { primary: '#f59e0b', secondary: '#fbbf24', rgb: '245, 158, 11' },
  '3-5': { primary: '#10b981', secondary: '#34d399', rgb: '16, 185, 129' },
  '6-8': { primary: '#3b82f6', secondary: '#60a5fa', rgb: '59, 130, 246' },
};

// ============================================================================
// Main Component
// ============================================================================

const LifeCycleSequencer: React.FC<LifeCycleSequencerProps> = ({ data, className = '' }) => {
  // Defensive check for undefined or invalid data
  if (!data || !data.stages || !Array.isArray(data.stages) || data.stages.length === 0) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Data</h3>
        <p className="text-slate-300">
          The life cycle sequencer received invalid data. Please regenerate the content.
        </p>
        <details className="mt-4 text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-300">Debug Info</summary>
          <pre className="mt-2 p-2 bg-slate-900/50 rounded overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  const [startTime] = useState(Date.now());
  const [shuffledStages, setShuffledStages] = useState<LifeCycleStage[]>(() =>
    [...data.stages].sort(() => Math.random() - 0.5)
  );
  const [timelineStages, setTimelineStages] = useState<(LifeCycleStage | null)[]>(() =>
    new Array(data.stages.length).fill(null)
  );
  const [selectedStage, setSelectedStage] = useState<LifeCycleStage | null>(null);
  const [draggedStage, setDraggedStage] = useState<LifeCycleStage | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const [stageResults, setStageResults] = useState<Map<string, boolean>>(new Map());
  const [showMisconception, setShowMisconception] = useState(false);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  const colors = GRADE_BAND_COLORS[data.gradeBand] || GRADE_BAND_COLORS['3-5'];

  // Evaluation hook
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<LifeCycleSequencerMetrics>({
    primitiveType: 'life-cycle-sequencer',
    instanceId: instanceId || `life-cycle-sequencer-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Dismiss tutorial after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowTutorial(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // ============================================================================
  // Interaction Handlers
  // ============================================================================

  const toggleCardExpansion = (stageId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageId)) {
        newSet.delete(stageId);
      } else {
        newSet.add(stageId);
      }
      return newSet;
    });
  };

  // Touch/Click to select and place
  const handleStageClick = (stage: LifeCycleStage, fromTimeline: boolean = false) => {
    if (hasSubmitted) return;

    if (fromTimeline) {
      // Remove from timeline and return to shuffled pool
      const timelineIndex = timelineStages.findIndex(s => s?.id === stage.id);
      if (timelineIndex !== -1) {
        const newTimeline = [...timelineStages];
        newTimeline[timelineIndex] = null;
        setTimelineStages(newTimeline);
        setShuffledStages(prev => [...prev, stage]);
      }
      setSelectedStage(null);
    } else {
      setSelectedStage(selectedStage?.id === stage.id ? null : stage);
    }
  };

  const handleDropZoneClick = (index: number) => {
    if (!selectedStage || hasSubmitted) return;

    // Place selected stage in timeline
    const newTimeline = [...timelineStages];
    const newShuffled = shuffledStages.filter(s => s.id !== selectedStage.id);

    // If slot is occupied, swap back to shuffled pool
    if (newTimeline[index]) {
      newShuffled.push(newTimeline[index]!);
    }

    newTimeline[index] = selectedStage;
    setTimelineStages(newTimeline);
    setShuffledStages(newShuffled);
    setSelectedStage(null);
    setIsChecked(false);
    setStageResults(new Map());
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, stage: LifeCycleStage) => {
    setDraggedStage(stage);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stage.id);
  };

  const handleDragEnd = () => {
    setDraggedStage(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (!draggedStage || hasSubmitted) return;

    const newTimeline = [...timelineStages];
    const isFromTimeline = timelineStages.some(s => s?.id === draggedStage.id);

    if (isFromTimeline) {
      // Moving within timeline
      const fromIndex = timelineStages.findIndex(s => s?.id === draggedStage.id);
      if (fromIndex !== -1 && fromIndex !== dropIndex) {
        const temp = newTimeline[dropIndex];
        newTimeline[dropIndex] = newTimeline[fromIndex];
        newTimeline[fromIndex] = temp;
      }
    } else {
      // Adding from shuffled pool
      const newShuffled = shuffledStages.filter(s => s.id !== draggedStage.id);

      // If slot occupied, return it to pool
      if (newTimeline[dropIndex]) {
        newShuffled.push(newTimeline[dropIndex]!);
      }

      newTimeline[dropIndex] = draggedStage;
      setShuffledStages(newShuffled);
    }

    setTimelineStages(newTimeline);
    setDraggedStage(null);
    setDragOverIndex(null);
    setIsChecked(false);
    setStageResults(new Map());
  };

  // ============================================================================
  // Check Answer Logic
  // ============================================================================

  const handleCheckAnswer = () => {
    // Prevent checking if already submitted
    if (hasSubmitted) return;

    const attempts: StageAttempt[] = [];
    const results = new Map<string, boolean>();
    let correctCount = 0;

    timelineStages.forEach((stage, index) => {
      if (stage) {
        const isCorrect = stage.correctPosition === index;
        results.set(stage.id, isCorrect);
        if (isCorrect) correctCount++;

        attempts.push({
          stageId: stage.id,
          placedPosition: index,
          correctPosition: stage.correctPosition,
          isCorrect,
        });
      }
    });

    setStageResults(results);
    setIsChecked(true);
    setAttemptsCount(prev => prev + 1);

    const allPlaced = timelineStages.every(s => s !== null);
    const allCorrect = correctCount === data.stages.length && allPlaced;

    if (allCorrect && !hasSubmitted) {
      setShowMisconception(false);
      handleSubmit(attempts, correctCount);
    } else if (allPlaced) {
      setShowMisconception(true);
    }
  };

  const handleSubmit = (attempts: StageAttempt[], correctCount: number) => {
    if (hasSubmitted) return;

    const completionTime = Date.now() - startTime;
    const allCorrect = correctCount === data.stages.length;
    const score = (correctCount / data.stages.length) * 100;

    const metrics: LifeCycleSequencerMetrics = {
      type: 'life-cycle-sequencer',
      cycleType: data.cycleType,
      totalStages: data.stages.length,
      stageAttempts: attempts,
      totalCorrectFirstAttempt: correctCount,
      completionTimeMs: completionTime,
      allStagesCorrect: allCorrect,
      attemptsBeforeSuccess: attemptsCount,
    };

    submitResult(allCorrect, score, metrics, {
      studentWork: { orderedStages: timelineStages.map(s => s?.id || null) },
    });
  };

  const handleReset = () => {
    const shuffled = [...data.stages].sort(() => Math.random() - 0.5);
    setShuffledStages(shuffled);
    setTimelineStages(new Array(data.stages.length).fill(null));
    setSelectedStage(null);
    setIsChecked(false);
    setStageResults(new Map());
    setShowMisconception(false);
    setAttemptsCount(0);
    setShowHint(false);
    resetAttempt();
  };

  const handleShowHint = () => {
    setShowHint(true);
    // Find first correct position
    const firstStage = data.stages.find(s => s.correctPosition === 0);
    if (firstStage) {
      setSelectedStage(firstStage);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderScrambledCard = (stage: LifeCycleStage) => {
    const isSelected = selectedStage?.id === stage.id;
    const isBeingDragged = draggedStage?.id === stage.id;
    const isExpanded = expandedCards.has(stage.id);

    return (
      <div
        key={stage.id}
        draggable={!hasSubmitted}
        onDragStart={(e) => handleDragStart(e, stage)}
        onDragEnd={handleDragEnd}
        onClick={() => handleStageClick(stage)}
        className={`
          relative group cursor-pointer
          bg-slate-800/40 backdrop-blur-sm border-2 rounded-lg
          transition-all duration-200
          ${isSelected
            ? `border-[${colors.primary}] shadow-[0_0_20px_rgba(${colors.rgb},0.4)] scale-105`
            : 'border-slate-700/50 hover:border-slate-600'
          }
          ${isBeingDragged ? 'opacity-40' : 'opacity-100'}
          ${hasSubmitted ? 'cursor-default' : 'cursor-move hover:shadow-lg'}
        `}
        style={{
          borderColor: isSelected ? colors.primary : undefined,
        }}
      >
        {/* Drag Handle */}
        {!hasSubmitted && (
          <div className="absolute top-2 left-2 text-slate-500 group-hover:text-slate-400">
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Image Preview */}
        <div className="h-24 bg-slate-700/30 rounded-t-lg flex items-center justify-center border-b border-slate-700/50 relative overflow-hidden">
          <Sparkles className="w-6 h-6 text-slate-500 absolute" />
          <span className="text-xs text-slate-500 text-center px-4 relative z-10">
            {stage.imagePrompt}
          </span>
        </div>

        {/* Card Content */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-100 flex-1">
              {stage.label}
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCardExpansion(stage.id);
              }}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Collapsed state - just duration */}
          {!isExpanded && stage.duration && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>{stage.duration}</span>
            </div>
          )}

          {/* Expanded state - full details */}
          {isExpanded && (
            <div className="space-y-2 text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/50">
              <p className="leading-relaxed">{stage.description}</p>
              {stage.duration && (
                <div className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{stage.duration}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 2px ${colors.primary}`,
            }}
          />
        )}
      </div>
    );
  };

  const renderDropZone = (index: number) => {
    const stage = timelineStages[index];
    const isDropTarget = dragOverIndex === index;
    const isCorrect = stage ? stageResults.get(stage.id) : undefined;
    const showStatus = isChecked && isCorrect !== undefined;
    const isEmpty = !stage;

    return (
      <div
        key={`drop-zone-${index}`}
        onClick={() => handleDropZoneClick(index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        className={`
          relative group
          transition-all duration-300
          ${isEmpty
            ? `border-2 border-dashed rounded-xl ${
                isDropTarget
                  ? `border-[${colors.primary}] bg-[${colors.primary}]/10 scale-105`
                  : 'border-slate-700/50 hover:border-slate-600'
              }`
            : ''
          }
          ${selectedStage && isEmpty ? 'cursor-pointer hover:bg-slate-800/30' : ''}
          ${isDropTarget ? 'ring-2 ring-offset-2 ring-offset-slate-950' : ''}
        `}
        style={{
          minHeight: isEmpty ? '120px' : 'auto',
          borderColor: isDropTarget ? colors.primary : undefined,
          ringColor: isDropTarget ? colors.primary : undefined,
        }}
      >
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all"
              style={{
                backgroundColor: isDropTarget ? `rgba(${colors.rgb}, 0.2)` : 'rgba(148, 163, 184, 0.1)',
              }}
            >
              <span className="text-lg font-bold" style={{ color: isDropTarget ? colors.primary : '#64748b' }}>
                {index + 1}
              </span>
            </div>
            {isDropTarget && (
              <p className="text-xs text-center" style={{ color: colors.primary }}>
                Drop here
              </p>
            )}
            {!isDropTarget && selectedStage && (
              <p className="text-xs text-slate-500 text-center">
                Tap to place
              </p>
            )}
          </div>
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleStageClick(stage, true);
            }}
            className={`
              relative overflow-hidden
              bg-slate-800/40 backdrop-blur-sm border-2 rounded-xl p-4
              transition-all duration-300
              ${showStatus
                ? isCorrect
                  ? 'border-green-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-shake'
                : 'border-slate-700/50'
              }
              ${!hasSubmitted ? 'cursor-pointer hover:border-slate-600' : 'cursor-default'}
            `}
          >
            {/* Status Badge */}
            {showStatus && (
              <div className="absolute top-2 right-2 z-10">
                {isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
            )}

            {/* Position Number */}
            <div
              className="absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: `rgba(${colors.rgb}, 0.2)`,
                color: colors.primary,
              }}
            >
              {index + 1}
            </div>

            {/* Image */}
            <div className="h-20 bg-slate-700/30 rounded-lg flex items-center justify-center border border-slate-700/50 mb-3 mt-6">
              <Sparkles className="w-5 h-5 text-slate-500" />
            </div>

            {/* Stage Info */}
            <h4 className="text-sm font-semibold text-slate-100 mb-1">
              {stage.label}
            </h4>
            {stage.duration && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{stage.duration}</span>
              </div>
            )}

            {/* Transition Arrow (when correct and not last) */}
            {showStatus && isCorrect && index < data.stages.length - 1 && data.cycleType === 'linear' && (
              <div className="absolute -right-6 top-1/2 -translate-y-1/2 z-20">
                <ArrowRight className="w-5 h-5 text-green-400" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  const allPlaced = timelineStages.every(s => s !== null);
  const correctCount = Array.from(stageResults.values()).filter(v => v).length;
  const progress = (timelineStages.filter(s => s !== null).length / data.stages.length) * 100;

  return (
    <div className={`relative ${className}`}>
      {/* Tutorial Overlay */}
      {showTutorial && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-slate-900/95 to-transparent p-6 rounded-xl backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Zap className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">How to Play</h4>
              <p className="text-sm text-slate-300">
                <strong>Desktop:</strong> Drag cards from the left to the timeline on the right.
                <strong className="ml-2">Touch:</strong> Tap a card to select it, then tap a numbered slot to place it.
              </p>
            </div>
            <button
              onClick={() => setShowTutorial(false)}
              className="ml-auto text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-100 mb-2">{data.title}</h3>
        <p className="text-slate-400 mb-2">{data.instructions}</p>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{data.scaleContext}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium" style={{
              backgroundColor: `rgba(${colors.rgb}, 0.2)`,
              color: colors.primary
            }}>
              {data.gradeBand}
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 mb-6">
        {/* Left Column - Scrambled Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Available Cards ({shuffledStages.length})
            </h4>
            {!isChecked && shuffledStages.length > 0 && (
              <button
                onClick={handleShowHint}
                className="text-xs text-slate-500 hover:text-yellow-400 transition-colors flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                Hint
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {shuffledStages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                All cards placed!
              </div>
            ) : (
              shuffledStages.map(renderScrambledCard)
            )}
          </div>

          {showHint && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-yellow-300 font-medium">Hint</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Look for the stage that describes the very beginning of the process!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Timeline Drop Zones */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Your Timeline
            </h4>
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: colors.primary,
                  }}
                />
              </div>
              <span className="text-xs text-slate-500">
                {timelineStages.filter(s => s).length}/{data.stages.length}
              </span>
            </div>
          </div>

          <div className={`
            grid gap-4
            ${data.cycleType === 'circular'
              ? 'grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }
          `}>
            {timelineStages.map((_, index) => renderDropZone(index))}
          </div>
        </div>
      </div>

      {/* Misconception Trap */}
      {showMisconception && !hasSubmitted && (
        <div
          className="mb-6 p-4 rounded-xl border-2 animate-slideIn"
          style={{
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            borderColor: '#fbbf24',
          }}
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="text-base font-semibold text-yellow-300 mb-2">
                Common Misconception
              </h4>
              <p className="text-sm text-slate-300 mb-2">
                <strong>Common Error:</strong> {data.misconceptionTrap.commonError}
              </p>
              <p className="text-sm text-slate-300">
                <strong>Remember:</strong> {data.misconceptionTrap.correction}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleCheckAnswer}
            disabled={hasSubmitted || !allPlaced || isChecked}
            className={`
              px-6 py-3 rounded-lg font-semibold
              transition-all duration-200
              ${hasSubmitted || !allPlaced || isChecked
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'text-white shadow-lg hover:shadow-xl hover:scale-105'
              }
            `}
            style={{
              backgroundColor: hasSubmitted || !allPlaced || isChecked ? undefined : colors.primary,
            }}
          >
            {!allPlaced ? 'Place all cards' : isChecked ? 'Checked' : 'Check Answer'}
          </button>

          {(isChecked || hasSubmitted) && (
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-slate-700 text-slate-300 rounded-lg font-semibold hover:bg-slate-600 transition-all duration-200 flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Try Again
            </button>
          )}
        </div>

        {/* Score Display */}
        {isChecked && (
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: correctCount === data.stages.length ? '#10b981' : '#f59e0b' }}>
              {correctCount} / {data.stages.length}
            </p>
            <p className="text-xs text-slate-500">correct</p>
          </div>
        )}
      </div>

      {/* Success Message */}
      {hasSubmitted && correctCount === data.stages.length && (
        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-slideIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <div>
              <h4 className="text-lg font-semibold text-green-300">Perfect! 🎉</h4>
              <p className="text-sm text-slate-300">
                You've mastered the {data.title.toLowerCase()}!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LifeCycleSequencer;
