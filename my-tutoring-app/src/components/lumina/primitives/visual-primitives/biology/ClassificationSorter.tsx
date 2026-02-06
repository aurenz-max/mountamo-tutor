import React, { useState } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { ClassificationSorterMetrics } from '../../../evaluation/types';
import { Lightbulb, CheckCircle2, XCircle, RotateCcw, Sparkles } from 'lucide-react';

/**
 * Classification Sorter - Interactive biology primitive for categorizing organisms
 *
 * Purpose: Students drag organisms or characteristics into categories. The core "is it a ___?"
 * primitive for biology. Handles binary sorts (vertebrate/invertebrate), multi-category sorts
 * (mammal/reptile/amphibian/bird/fish), and property-based sorts (has bones/no bones,
 * makes own food/eats food).
 *
 * Grade Band: K-8
 * Cognitive Operation: Classify, compare, discriminate
 *
 * Design: Drag-and-drop interface with labeled bins and item cards. Items can be text, image,
 * or organism-card mini variants. Incorrect placements trigger a brief hint. Bins can be
 * hierarchical (Kingdom → Phylum → Class) at higher grades.
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export interface ClassificationCategory {
  id: string;
  label: string;
  description: string; // Shown on hover/tap
  parentId: string | null; // For hierarchical sorting (null for top-level)
}

export interface ClassificationItem {
  id: string;
  label: string;
  imagePrompt: string | null;
  hint: string; // Shown on incorrect placement
  correctCategoryId: string;
  distractorReasoning: string; // Why a student might place this incorrectly
}

export interface ClassificationSorterData {
  title: string;
  instructions: string;
  categories: ClassificationCategory[];
  items: ClassificationItem[];
  sortingRule: string; // The principle being applied (e.g., "Sort by number of legs")
  gradeBand: 'K-2' | '3-5' | '6-8';
  allowPartialCredit: boolean;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ClassificationSorterMetrics>) => void;
}

// ============================================================================
// Component Props
// ============================================================================

interface ClassificationSorterProps {
  data: ClassificationSorterData;
  className?: string;
}

// ============================================================================
// Helper Types
// ============================================================================

interface ItemPlacement {
  itemId: string;
  categoryId: string | null; // null if not yet placed
  isCorrect: boolean | null; // null if not yet checked
  attemptNumber: number;
  timeMs: number; // Time since component mounted
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

const ClassificationSorter: React.FC<ClassificationSorterProps> = ({ data, className = '' }) => {
  const [startTime] = useState(Date.now());
  const [placements, setPlacements] = useState<Map<string, ItemPlacement>>(new Map());
  const [draggedItem, setDraggedItem] = useState<ClassificationItem | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [showHint, setShowHint] = useState<string | null>(null); // Item ID showing hint
  const [attemptCounts, setAttemptCounts] = useState<Map<string, number>>(new Map());

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<ClassificationSorterMetrics>({
    primitiveType: 'classification-sorter',
    instanceId: instanceId || `classification-sorter-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const colors = GRADE_BAND_COLORS[data.gradeBand] || GRADE_BAND_COLORS['3-5'];

  // ============================================================================
  // Drag and Drop Handlers
  // ============================================================================

  const handleDragStart = (e: React.DragEvent, item: ClassificationItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setHoveredCategory(null);
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHoveredCategory(categoryId);
  };

  const handleDragLeave = () => {
    setHoveredCategory(null);
  };

  const handleDrop = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    const currentTime = Date.now() - startTime;
    const isCorrect = draggedItem.correctCategoryId === categoryId;
    const currentAttempts = attemptCounts.get(draggedItem.id) || 0;
    const newAttemptNumber = currentAttempts + 1;

    // Update placements
    const newPlacement: ItemPlacement = {
      itemId: draggedItem.id,
      categoryId,
      isCorrect,
      attemptNumber: newAttemptNumber,
      timeMs: currentTime,
    };

    setPlacements(prev => new Map(prev).set(draggedItem.id, newPlacement));
    setAttemptCounts(prev => new Map(prev).set(draggedItem.id, newAttemptNumber));

    // Show hint if incorrect
    if (!isCorrect) {
      setShowHint(draggedItem.id);
      setTimeout(() => setShowHint(null), 3000); // Hide hint after 3 seconds
    } else {
      setShowHint(null);
    }

    setDraggedItem(null);
    setHoveredCategory(null);
  };

  // ============================================================================
  // Evaluation Logic
  // ============================================================================

  const handleSubmit = () => {
    if (hasSubmitted) return;

    // Calculate metrics
    const totalItems = data.items.length;
    const placedItems = Array.from(placements.values());
    const correctFirstAttempt = placedItems.filter(p => p.isCorrect && p.attemptNumber === 1).length;
    const totalCorrect = placedItems.filter(p => p.isCorrect).length;
    const allCorrect = totalCorrect === totalItems;

    // Calculate score
    let score = 0;
    if (data.allowPartialCredit) {
      // Partial credit: weight first-attempt correctness higher
      const firstAttemptScore = (correctFirstAttempt / totalItems) * 70;
      const totalCorrectScore = (totalCorrect / totalItems) * 30;
      score = Math.min(100, firstAttemptScore + totalCorrectScore);
    } else {
      // All-or-nothing: must get everything correct
      score = allCorrect ? 100 : 0;
    }

    // Build detailed attempts array
    const attempts = data.items.map(item => {
      const placement = placements.get(item.id);
      return {
        itemId: item.id,
        placedCategoryId: placement?.categoryId || '',
        correctCategoryId: item.correctCategoryId,
        isCorrect: placement?.isCorrect || false,
        attemptNumber: placement?.attemptNumber || 0,
        timeMs: placement?.timeMs || 0,
      };
    });

    // Build metrics
    const metrics: ClassificationSorterMetrics = {
      type: 'classification-sorter',
      sortingRule: data.sortingRule,
      totalItems,
      totalCorrectFirstAttempt: correctFirstAttempt,
      totalCorrect,
      allCorrect,
      attempts,
      categoryAccuracy: calculateCategoryAccuracy(),
    };

    submitResult(allCorrect, score, metrics, {
      studentWork: { placements: Array.from(placements.entries()) },
    });
  };

  const handleReset = () => {
    setPlacements(new Map());
    setAttemptCounts(new Map());
    setShowHint(null);
    resetAttempt();
  };

  const calculateCategoryAccuracy = (): Record<string, number> => {
    const categoryAccuracy: Record<string, number> = {};

    data.categories.forEach(category => {
      const itemsInCategory = data.items.filter(item => item.correctCategoryId === category.id);
      const correctPlacements = itemsInCategory.filter(item => {
        const placement = placements.get(item.id);
        return placement?.categoryId === category.id && placement?.isCorrect;
      }).length;

      categoryAccuracy[category.id] = itemsInCategory.length > 0
        ? (correctPlacements / itemsInCategory.length) * 100
        : 0;
    });

    return categoryAccuracy;
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const getUnplacedItems = (): ClassificationItem[] => {
    return data.items.filter(item => !placements.has(item.id) || !placements.get(item.id)?.isCorrect);
  };

  const getItemsInCategory = (categoryId: string): ClassificationItem[] => {
    return data.items.filter(item => {
      const placement = placements.get(item.id);
      return placement?.categoryId === categoryId && placement?.isCorrect;
    });
  };

  const renderItem = (item: ClassificationItem, inCategory: boolean = false) => {
    const placement = placements.get(item.id);
    const isCorrect = placement?.isCorrect;
    const isShowingHint = showHint === item.id;

    return (
      <div
        key={item.id}
        draggable={!hasSubmitted && !isCorrect}
        onDragStart={(e) => handleDragStart(e, item)}
        onDragEnd={handleDragEnd}
        className={`
          p-4 rounded-lg border-2 cursor-move transition-all
          ${isCorrect
            ? 'bg-emerald-900/30 border-emerald-500/50 cursor-default'
            : 'bg-slate-800/50 border-slate-600/50 hover:border-slate-500 hover:bg-slate-800/70'
          }
          ${draggedItem?.id === item.id ? 'opacity-50' : ''}
          ${hasSubmitted && !isCorrect ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          {isCorrect && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          )}
          {isShowingHint && !isCorrect && (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-200">
              {item.label}
            </div>
            {item.imagePrompt && (
              <div className="text-xs text-slate-500 mt-1 italic">
                {item.imagePrompt}
              </div>
            )}
          </div>
        </div>

        {/* Hint on incorrect placement */}
        {isShowingHint && !isCorrect && (
          <div className="mt-3 p-2 rounded bg-red-900/20 border border-red-500/30">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">{item.hint}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCategory = (category: ClassificationCategory) => {
    const itemsInCategory = getItemsInCategory(category.id);
    const isHovered = hoveredCategory === category.id;

    return (
      <div
        key={category.id}
        onDragOver={(e) => handleDragOver(e, category.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, category.id)}
        className={`
          min-h-[200px] p-4 rounded-xl border-2 transition-all
          ${isHovered
            ? 'border-white/30 bg-white/5'
            : 'border-slate-700/50 bg-slate-800/30'
          }
        `}
      >
        {/* Category Header */}
        <div className="mb-4">
          <div className="text-lg font-bold text-slate-200 mb-1">
            {category.label}
          </div>
          <div className="text-xs text-slate-400">
            {category.description}
          </div>
        </div>

        {/* Items in Category */}
        <div className="space-y-2">
          {itemsInCategory.map(item => renderItem(item, true))}
        </div>

        {/* Empty State */}
        {itemsInCategory.length === 0 && (
          <div className="h-32 flex items-center justify-center text-slate-600 text-sm border-2 border-dashed border-slate-700/50 rounded-lg">
            Drop items here
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // Progress Calculation
  // ============================================================================

  const totalItems = data.items.length;
  const correctItems = Array.from(placements.values()).filter(p => p.isCorrect).length;
  const progressPercent = (correctItems / totalItems) * 100;

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-slate-100 mb-2">
          {data.title}
        </h3>
        <p className="text-slate-400 mb-4">
          {data.instructions}
        </p>

        {/* Sorting Rule */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <Sparkles className="w-4 h-4" style={{ color: colors.primary }} />
          <span className="text-sm font-mono text-slate-300">
            {data.sortingRule}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {!hasSubmitted && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">
              Progress: {correctItems} / {totalItems} items sorted correctly
            </span>
            <span className="text-sm font-mono" style={{ color: colors.primary }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: colors.primary,
              }}
            />
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className={`grid gap-6 mb-6 ${
        data.categories.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
        data.categories.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {data.categories.map(category => renderCategory(category))}
      </div>

      {/* Unplaced Items */}
      {!hasSubmitted && getUnplacedItems().length > 0 && (
        <div className="mb-6 p-6 rounded-xl bg-slate-800/20 border border-slate-700/50">
          <div className="text-sm font-mono text-slate-400 uppercase tracking-wider mb-4">
            Items to Sort ({getUnplacedItems().length} remaining)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {getUnplacedItems().map(item => renderItem(item, false))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={hasSubmitted || correctItems < totalItems}
          className={`
            px-6 py-3 rounded-lg font-medium transition-all
            ${hasSubmitted || correctItems < totalItems
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'text-white hover:scale-105 active:scale-95'
            }
          `}
          style={{
            backgroundColor: hasSubmitted || correctItems < totalItems ? undefined : colors.primary,
          }}
        >
          {hasSubmitted ? 'Submitted' : 'Submit Classification'}
        </button>

        {hasSubmitted && (
          <button
            onClick={handleReset}
            className="px-6 py-3 rounded-lg font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>

      {/* Grade Band Indicator (for debugging) */}
      <div className="mt-6 text-xs font-mono text-slate-600 uppercase tracking-wider">
        Grade Band: {data.gradeBand}
      </div>
    </div>
  );
};

export default ClassificationSorter;
