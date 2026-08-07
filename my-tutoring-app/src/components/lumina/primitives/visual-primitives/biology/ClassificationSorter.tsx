import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { ClassificationSorterMetrics } from '../../../evaluation/types';
import { Lightbulb, CheckCircle2, XCircle, RotateCcw, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LuminaDropZone, LuminaReadAloud, type DropZoneState } from '../../../ui';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

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
  // Transient grading flash on the zone that just received a drop (pop/shake).
  const [dropFlash, setDropFlash] = useState<{ categoryId: string; ok: boolean } | null>(null);
  // Last placement outcome, surfaced to the tutor as runtime state.
  const [lastPlacementCorrect, setLastPlacementCorrect] = useState<boolean | null>(null);
  const dropFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (dropFlashTimer.current) clearTimeout(dropFlashTimer.current);
    },
    []
  );

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Stable across renders — an inline `id || \`prefix-${Date.now()}\`` produces a
  // new string every render and restarts the AI connect effect in a loop.
  const resolvedInstanceId = useMemo(
    () => instanceId || `classification-sorter-${Date.now()}`,
    [instanceId],
  );

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<ClassificationSorterMetrics>({
    primitiveType: 'classification-sorter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const colors = GRADE_BAND_COLORS[data.gradeBand] || GRADE_BAND_COLORS['3-5'];

  // ============================================================================
  // Reading band
  // ============================================================================
  // At K-2 the item labels, the group names, the rule badge and the instructions
  // are all undecodable, and HTML5 drag-and-drop is not a protocol a five-year-old
  // can execute. The fix follows the WordSorter PRE precedent: stage ONE item at
  // a time so the two-part drag collapses to tap-a-group = choose (PRE contract
  // rules 2 and 4), and let the tutor's voice carry every word.
  const isPreReader = data.gradeBand === 'K-2';

  const categoryLabels = useMemo(
    () => data.categories.map(c => c.label).join(', '),
    [data.categories],
  );

  // Items still needing a correct home, in stable order.
  const unplacedItems = useMemo(
    () => data.items.filter(item => !placements.get(item.id)?.isCorrect),
    [data.items, placements],
  );
  // At PRE exactly one item is on stage; older bands see the whole pool.
  const stagedItem = isPreReader ? (unplacedItems[0] ?? null) : null;

  const correctCount = useMemo(
    () => Array.from(placements.values()).filter(p => p.isCorrect).length,
    [placements],
  );

  // ============================================================================
  // AI tutoring
  // ============================================================================
  const aiPrimitiveData = useMemo(() => ({
    title: data.title,
    sortingRule: data.sortingRule,
    categoryLabels,
    currentItemLabel: stagedItem?.label ?? (unplacedItems[0]?.label ?? 'all sorted'),
    correctCount,
    totalItems: data.items.length,
    gradeBand: data.gradeBand,
    lastPlacementCorrect,
  }), [
    data.title, data.sortingRule, data.gradeBand, data.items.length,
    categoryLabels, stagedItem, unplacedItems, correctCount, lastPlacementCorrect,
  ]);

  const { sendText, isAudioPlaying } = useLuminaAI({
    primitiveType: 'classification-sorter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: isPreReader ? 'kindergarten' : 'elementary',
  });

  // Read-aloud: silent like every system trigger — `silent` suppresses only the
  // chat-transcript entry, the socket payload is unchanged, so the tutor still
  // speaks. The rule and the group names are the QUESTION, never the answer.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    SoundManager.tap();
    sendText(
      `[SORT_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true },
    );
  }, [sendText]);

  // ORIENT — fires once so a non-reader learns the task without asking.
  const hasOrientedRef = useRef(false);
  useEffect(() => {
    if (hasOrientedRef.current) return;
    hasOrientedRef.current = true;
    sendText(
      `[SORT_ORIENT] A ${isPreReader ? 'pre-reader who cannot read any text' : 'student'} just opened `
      + `a sorting activity. The rule is: "${data.sortingRule}". The groups are: ${categoryLabels}. `
      + `${isPreReader
        ? 'One thing at a time appears on stage and they TAP a group to put it there.'
        : 'They drag each item into a group.'} `
      + `Say the rule and the group names in child words. Never say where any item belongs.`,
      { silent: true },
    );
  }, [sendText, isPreReader, data.sortingRule, categoryLabels]);

  // PRE only: the tutor's voice IS the item card, since the child cannot read it.
  // One utterance per staged item — the instruction channel, not chatter.
  const lastStagedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPreReader || !stagedItem) return;
    if (lastStagedRef.current === stagedItem.id) return;
    lastStagedRef.current = stagedItem.id;
    sendText(
      `[SORT_ITEM_STAGED] The next card on stage is "${stagedItem.label}". `
      + `Say ONLY this name aloud, clearly. Do NOT say which group it belongs in.`,
      { silent: true },
    );
  }, [isPreReader, stagedItem, sendText]);

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

  /**
   * The one placement path. Drag-and-drop (grades 3-8) and tap-a-group (K-2)
   * both land here, so scoring, feedback and the tutor moment cannot drift
   * apart between the two protocols.
   */
  const placeItem = useCallback((item: ClassificationItem, categoryId: string) => {
    SoundManager.snap();

    const currentTime = Date.now() - startTime;
    const isCorrect = item.correctCategoryId === categoryId;
    const currentAttempts = attemptCounts.get(item.id) || 0;
    const newAttemptNumber = currentAttempts + 1;

    const newPlacement: ItemPlacement = {
      itemId: item.id,
      categoryId,
      isCorrect,
      attemptNumber: newAttemptNumber,
      timeMs: currentTime,
    };

    setPlacements(prev => new Map(prev).set(item.id, newPlacement));
    setAttemptCounts(prev => new Map(prev).set(item.id, newAttemptNumber));
    setLastPlacementCorrect(isCorrect);

    const categoryLabel = data.categories.find(c => c.id === categoryId)?.label ?? categoryId;

    // Show hint if incorrect
    if (!isCorrect) {
      SoundManager.invalid();
      setShowHint(item.id);
      setTimeout(() => setShowHint(null), 3000); // Hide hint after 3 seconds
      // The hint text is a nudge the tutor may PARAPHRASE, never the answer —
      // correctCategoryId is deliberately withheld from this message.
      sendText(
        `[SORT_INCORRECT] Student put "${item.label}" in "${categoryLabel}" and that is not right. `
        + `Attempt ${newAttemptNumber}. The rule is "${data.sortingRule}". `
        + `Ask what they notice about "${item.label}". Do NOT name the correct group and do NOT `
        + `narrow it down by eliminating groups.`,
        { silent: true },
      );
    } else {
      SoundManager.playCorrect();
      setShowHint(null);
      // Quiet on a routine correct placement — the sound and the zone flash carry
      // it. The tutor speaks at the staged-item and completion beats instead.
    }

    // Flash the receiving zone (correct pops, incorrect shakes), then settle.
    if (dropFlashTimer.current) clearTimeout(dropFlashTimer.current);
    setDropFlash({ categoryId, ok: isCorrect });
    dropFlashTimer.current = setTimeout(() => setDropFlash(null), 900);

    setDraggedItem(null);
    setHoveredCategory(null);
  }, [startTime, attemptCounts, data.categories, data.sortingRule, sendText]);

  const handleDrop = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    if (!draggedItem) return;
    placeItem(draggedItem, categoryId);
  };

  /** PRE protocol: the staged item is implicit, so tapping a group IS the answer. */
  const handleCategoryTap = useCallback((categoryId: string) => {
    if (!isPreReader || hasSubmitted || !stagedItem) return;
    placeItem(stagedItem, categoryId);
  }, [isPreReader, hasSubmitted, stagedItem, placeItem]);

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

    sendText(
      `[SORT_ALL_COMPLETE] Student finished the sort: ${totalCorrect} of ${totalItems} correct, `
      + `${correctFirstAttempt} on the first try. The rule was "${data.sortingRule}". `
      + `Celebrate warmly in child words and say one true thing the rule taught them.`,
      { silent: true },
    );
  };

  const handleReset = () => {
    setPlacements(new Map());
    setAttemptCounts(new Map());
    setShowHint(null);
    setLastPlacementCorrect(null);
    // Clear the per-attempt narration latch, or the first item staged after a
    // retry is silently swallowed.
    lastStagedRef.current = null;
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

  const getUnplacedItems = (): ClassificationItem[] => unplacedItems;

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
            {/* `imagePrompt` is an image-GENERATION instruction ("a spotted frog
                on a lily pad"), not student copy. Rendering it as italic body
                text put prompt-engineering in the child's field at every grade. */}
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

    // Drop handlers stay on the whole Card (large hit-area for young students);
    // the LuminaDropZone inside is the visual state surface, driven from here.
    const zoneState: DropZoneState =
      hoveredCategory === category.id
        ? 'dragOver'
        : dropFlash?.categoryId === category.id
          ? dropFlash.ok
            ? 'correct'
            : 'incorrect'
          : itemsInCategory.length > 0
            ? 'filled'
            : 'idle';

    return (
      <Card
        key={category.id}
        onDragOver={(e) => handleDragOver(e, category.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, category.id)}
        // PRE: the whole card is the answer button — tap = choose, since the
        // staged item is already implicit. No drag, no two-tap protocol.
        {...(isPreReader && !hasSubmitted && stagedItem
          ? {
            role: 'button' as const,
            tabIndex: 0,
            'aria-label': `Put it in ${category.label}`,
            onClick: () => handleCategoryTap(category.id),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCategoryTap(category.id);
              }
            },
          }
          : {})}
        className={`min-h-[200px] backdrop-blur-xl bg-slate-900/40 border-white/10 ${
          isPreReader && !hasSubmitted && stagedItem
            ? 'cursor-pointer transition-transform hover:scale-[1.02] active:scale-95'
            : ''
        }`}
      >
        <CardHeader className="pb-3">
          <CardTitle className={`text-slate-200 ${isPreReader ? 'text-2xl' : ''}`}>
            {category.label}
          </CardTitle>
          {/* The group description is a sentence of scientific prose. It helps a
              reader and is noise to a non-reader, who gets the group names by
              voice instead. */}
          {!isPreReader && (
            <CardDescription className="text-slate-400">{category.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <LuminaDropZone
            state={zoneState}
            emptyPrompt={isPreReader ? undefined : 'Drop items here'}
            className="min-h-[128px] flex-col items-stretch"
          >
            {itemsInCategory.map(item => renderItem(item, true))}
          </LuminaDropZone>
        </CardContent>
      </Card>
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
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl mb-8">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <CardTitle className="text-slate-100">{data.title}</CardTitle>
              <CardDescription className="text-slate-400">{data.instructions}</CardDescription>
            </div>
            <LuminaReadAloud
              iconOnly
              size={isPreReader ? 'lg' : 'sm'}
              accent="cyan"
              speaking={isAudioPlaying}
              aria-label="Read the instructions to me"
              className="flex-shrink-0"
              onClick={() => readAloud(
                `${data.title}. ${data.instructions} Here is the rule: ${data.sortingRule}.`,
              )}
            />
          </div>

          {/* Sorting Rule Badge — the RULE is the question, so it stays at every
              band; at PRE it is carried by voice as well, never by text alone. */}
          <div className="flex items-center gap-2 pt-2">
            <Badge className={`bg-slate-800/50 border-slate-700/50 text-orange-300 ${
              isPreReader ? 'text-base py-1' : ''
            }`}>
              <Sparkles className="w-3 h-3 mr-1" style={{ color: colors.primary }} />
              {data.sortingRule}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* PRE stage: ONE item at a time. This is what collapses the two-part drag
          into tap-a-group = choose, and it keeps the screen to one thing to do
          (PRE contract rules 2 and 4). Tap the card to hear its name again. */}
      {isPreReader && !hasSubmitted && stagedItem && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 mb-6">
          <CardContent className="py-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => {
                SoundManager.tap();
                sendText(
                  `[SORT_ITEM_TAP] The student tapped the card to hear it again: "${stagedItem.label}". `
                  + `Say ONLY this name aloud, clearly. Do NOT say which group it belongs in.`,
                  { silent: true },
                );
              }}
              aria-label={`Hear ${stagedItem.label} again`}
              className="px-8 py-6 rounded-2xl bg-slate-800/60 border-2 border-white/15 text-3xl font-semibold text-slate-100 transition-transform hover:scale-[1.03] active:scale-95"
            >
              {stagedItem.label}
            </button>
            <LuminaReadAloud
              size="lg"
              accent="cyan"
              speaking={isAudioPlaying}
              label="Say it again"
              onClick={() => readAloud(stagedItem.label)}
            />
          </CardContent>
        </Card>
      )}

      {/* Progress Bar — a fraction, a percentage and a progress meter are adult
          chrome a K-2 child cannot read (PRE contract rule 7). The emptying
          stage and the filling groups already show progress. */}
      {!hasSubmitted && !isPreReader && (
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

      {/* Unplaced Items — at PRE the pool is replaced by the single staged card
          above, so this whole pile (and its "(N remaining)" counter) is gone. */}
      {!hasSubmitted && !isPreReader && getUnplacedItems().length > 0 && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-mono text-slate-400 uppercase tracking-wider">
              Items to Sort ({getUnplacedItems().length} remaining)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {getUnplacedItems().map(item => renderItem(item, false))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={hasSubmitted || correctItems < totalItems}
          variant="ghost"
          className={`
            px-6 py-3 font-medium
            ${hasSubmitted || correctItems < totalItems
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'bg-white/5 text-white border border-white/20 hover:bg-white/10'
            }
          `}
          style={{
            backgroundColor: hasSubmitted || correctItems < totalItems ? undefined : colors.primary,
            borderColor: hasSubmitted || correctItems < totalItems ? undefined : 'transparent',
          }}
        >
          {hasSubmitted ? 'Submitted' : 'Submit Classification'}
        </Button>

        {hasSubmitted && (
          <Button
            onClick={handleReset}
            variant="ghost"
            className="px-6 py-3 bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>

      {/* Grade Band Indicator (for debugging) — a debug readout has no business
          in any student's field, least of all a five-year-old's. Dev only. */}
      {process.env.NODE_ENV !== 'production' && !isPreReader && (
        <div className="mt-6 text-xs font-mono text-slate-600 uppercase tracking-wider">
          Grade Band: {data.gradeBand}
        </div>
      )}
    </div>
  );
};

export default ClassificationSorter;
