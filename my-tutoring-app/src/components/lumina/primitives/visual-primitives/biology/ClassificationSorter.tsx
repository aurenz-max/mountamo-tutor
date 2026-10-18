import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { ClassificationSorterMetrics } from '../../../evaluation/types';
import { Lightbulb, CheckCircle2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LuminaDropZone, type DropZoneState } from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeSort, sortMatches, sortMiss, workspaceScene } from './classificationSorterWorkspace';
import { CLUE_LEVER, MARKS_LEVER, MEANING_LEVER, cardClue, groupMeanings, SORT_LEVERS } from './classificationSorterLevers';
import { classificationSorterBoss } from './classificationSorter.boss';

/**
 * Classification Sorter - Interactive biology primitive for categorizing organisms
 *
 * Purpose: Students sort organisms or characteristics into categories. The core "is it a ___?"
 * primitive for biology. Handles binary sorts (vertebrate/invertebrate), multi-category sorts
 * (mammal/reptile/amphibian/bird/fish), and property-based sorts (has bones/no bones,
 * makes own food/eats food). Bins can be hierarchical (Kingdom → Phylum → Class) at higher grades.
 *
 * Grade Band: K-8
 * Cognitive Operation: Classify, compare, discriminate
 *
 * Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is
 * `classificationSorter.card.ts` + `classificationSorter.boss.ts`). Each item is one challenge, staged alone, and the
 * learner taps a group; the runtime owns the order and the retry, and the tutor is never told an item's group. A
 * mount with no tutor renders the shared "needs the tutor" card. The scripted drag-and-drop drill is gone
 * (2026-10-18: one path, as DiTeachingStage).
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export interface ClassificationCategory {
  id: string;
  label: string;
  description: string; // Shown under the group name to a reader
  parentId: string | null; // For hierarchical sorting (null for top-level)
}

export interface ClassificationItem {
  id: string;
  label: string;
  imagePrompt: string | null;
  hint: string; // The card_clue lever's source (every group name blanked)
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

interface ClassificationSorterProps {
  data: ClassificationSorterData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

interface ItemPlacement {
  itemId: string;
  categoryId: string | null;
  isCorrect: boolean | null;
  attemptNumber: number;
  timeMs: number; // Time since component mounted
}

const GRADE_BAND_COLORS: Record<string, { primary: string; secondary: string; rgb: string }> = {
  'K-2': { primary: '#f59e0b', secondary: '#fbbf24', rgb: '245, 158, 11' },
  '3-5': { primary: '#10b981', secondary: '#34d399', rgb: '16, 185, 129' },
  '6-8': { primary: '#3b82f6', secondary: '#60a5fa', rgb: '59, 130, 246' },
};

const useSorterProgress = useWorkspaceProgressFor('classification-sorter');

const ClassificationSorterSurface = ({ data, className = '', runtimePlanItemId }: ClassificationSorterProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [startTime] = useState(Date.now());
  const [placements, setPlacements] = useState<Map<string, ItemPlacement>>(new Map());
  const [attemptCounts, setAttemptCounts] = useState<Map<string, number>>(new Map());
  // Transient grading flash on the group that just received the card (pop/shake).
  const [dropFlash, setDropFlash] = useState<{ categoryId: string; ok: boolean } | null>(null);
  // The group the learner put the staged item in on this try (cleared by Try again), and the last wrong group per
  // item (kept across Try again, so a repeat is named).
  const [tryPlacedIn, setTryPlacedIn] = useState<string | null>(null);
  const lastWrong = useRef<Map<string, string>>(new Map());
  // In-item levers (`classificationSorterLevers.ts`), keyed by the item they were pulled on.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const dropFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dropFlashTimer.current) clearTimeout(dropFlashTimer.current); }, []);

  const { instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  // Stable across renders: an inline `id || \`prefix-${Date.now()}\`` is a new string every render.
  const resolvedInstanceId = useMemo(() => instanceId || `classification-sorter-${Date.now()}`, [instanceId]);

  // One challenge per item; the runtime moves the index.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useSorterProgress({
    challenges: data.items,
    getChallengeId: item => item.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: classificationSorterBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<ClassificationSorterMetrics>({
    primitiveType: 'classification-sorter',
    instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const colors = GRADE_BAND_COLORS[data.gradeBand] || GRADE_BAND_COLORS['3-5'];
  // At K-2 the labels and the group descriptions are undecodable: the tutor's voice carries every word, and the
  // descriptions stay hidden (the group_meaning lever brings them back as plain meanings).
  const isPreReader = data.gradeBand === 'K-2';

  const workspaceItem = data.items[progress.currentIndex] ?? null;
  const stagedItem = workspaceItem && !placements.get(workspaceItem.id)?.isCorrect ? workspaceItem : null;

  const pulledLevers = workspaceItem && leverState.item === workspaceItem.id ? leverState.pulled : [];
  const meanings = workspaceItem && pulledLevers.includes(MEANING_LEVER) ? groupMeanings(data.categories, workspaceItem) : null;
  const clue = workspaceItem && pulledLevers.includes(CLUE_LEVER) ? cardClue(workspaceItem, data.categories) : null;
  const marksOn = pulledLevers.includes(MARKS_LEVER);

  // A fresh item and Try again both open the stage blank. A wrong group stays named in `lastWrong`.
  openItem.current = () => {
    setTryPlacedIn(null);
    setDropFlash(null);
  };

  /** Tapping a group IS the answer: the staged item is implicit. The activity checks it and commits the miss. */
  const placeItem = useCallback((item: ClassificationItem, categoryId: string) => {
    SoundManager.snap();
    const isCorrect = sortMatches(item, categoryId);
    const attemptNumber = (attemptCounts.get(item.id) || 0) + 1;
    setPlacements(prev => new Map(prev).set(item.id,
      { itemId: item.id, categoryId, isCorrect, attemptNumber, timeMs: Date.now() - startTime }));
    setAttemptCounts(prev => new Map(prev).set(item.id, attemptNumber));

    const miss = sortMiss(item, data.categories, categoryId, lastWrong.current.get(item.id) ?? null);
    if (!isCorrect) lastWrong.current.set(item.id, categoryId);
    setTryPlacedIn(categoryId);
    progress.commitCheck(describeSort(item, data.categories, categoryId), isCorrect, miss);

    if (isCorrect) SoundManager.playCorrect(); else SoundManager.invalid();
    if (dropFlashTimer.current) clearTimeout(dropFlashTimer.current);
    setDropFlash({ categoryId, ok: isCorrect });
    dropFlashTimer.current = setTimeout(() => setDropFlash(null), 900);
  }, [startTime, attemptCounts, data.categories, progress]);

  // A checked answer stays closed until Try again or Next challenge on the shell.
  const tapOpen = !!stagedItem && progress.canAttempt !== false && tryPlacedIn === null;
  const handleCategoryTap = (categoryId: string) => {
    if (tapOpen && stagedItem) placeItem(stagedItem, categoryId);
  };

  // ============================================================================
  // Evaluation: the scored session, under a lesson's evaluation provider only
  // ============================================================================
  const calculateCategoryAccuracy = (): Record<string, number> => Object.fromEntries(data.categories.map(category => {
    const inCategory = data.items.filter(item => item.correctCategoryId === category.id);
    const right = inCategory.filter(item => {
      const placement = placements.get(item.id);
      return placement?.categoryId === category.id && placement?.isCorrect;
    }).length;
    return [category.id, inCategory.length > 0 ? (right / inCategory.length) * 100 : 0];
  }));

  const placementAttempts = () => data.items.map(item => {
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

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const metrics: ClassificationSorterMetrics = {
      type: 'classification-sorter',
      sortingRule: data.sortingRule,
      totalItems: data.items.length,
      totalCorrectFirstAttempt: result.firstTryCount,
      totalCorrect: result.solvedCount,
      allCorrect: result.passed,
      attempts: placementAttempts(),
      categoryAccuracy: calculateCategoryAccuracy(),
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ============================================================================
  // Render helpers
  // ============================================================================
  const getItemsInCategory = (categoryId: string) => data.items.filter(item => {
    const placement = placements.get(item.id);
    return placement?.categoryId === categoryId && placement?.isCorrect;
  });

  /** A card already sorted into its group (the sorted_marks lever rings these). */
  const renderSorted = (item: ClassificationItem) => (
    <div key={item.id} data-in-category data-lever={marksOn ? 'sorted-mark' : undefined}
      className={`p-4 rounded-lg border-2 bg-emerald-900/30 border-emerald-500/50 ${marksOn ? 'ring-2 ring-cyan-300/80' : ''}`}>
      <div className="flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div className="flex-1 text-sm font-medium text-slate-200">{item.label}</div>
      </div>
    </div>
  );

  const renderCategory = (category: ClassificationCategory) => {
    const itemsInCategory = getItemsInCategory(category.id);
    const zoneState: DropZoneState = dropFlash?.categoryId === category.id
      ? dropFlash.ok ? 'correct' : 'incorrect'
      : itemsInCategory.length > 0 ? 'filled' : 'idle';
    return (
      <Card
        key={category.id}
        data-pip-object={`group-${category.id}`}
        // The whole card is the answer button: tap = choose, since the staged item is already implicit.
        {...(tapOpen
          ? {
            role: 'button' as const,
            tabIndex: 0,
            'aria-label': `Put it in ${category.label}`,
            onClick: () => handleCategoryTap(category.id),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCategoryTap(category.id); }
            },
          }
          : {})}
        className={`min-h-[200px] backdrop-blur-xl bg-slate-900/40 border-white/10 ${
          tapOpen ? 'cursor-pointer transition-transform hover:scale-[1.02] active:scale-95' : ''}`}
      >
        <CardHeader className="pb-3">
          <CardTitle className={`text-slate-200 ${isPreReader ? 'text-2xl' : ''}`}>{category.label}</CardTitle>
          {/* The group description is a sentence of scientific prose: it helps a reader and is noise to a
              non-reader, who gets the group names by voice instead. */}
          {!isPreReader && <CardDescription className="text-slate-400">{category.description}</CardDescription>}
          {/* The group_meaning lever: what the group means, for a band that hides the descriptions. */}
          {isPreReader && meanings && (
            <CardDescription data-lever="group-meaning" className="text-cyan-200 text-base">{meanings[category.id]}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <LuminaDropZone state={zoneState} className="min-h-[128px] flex-col items-stretch">
            {itemsInCategory.map(renderSorted)}
          </LuminaDropZone>
        </CardContent>
      </Card>
    );
  };

  const totalItems = data.items.length;
  const correctItems = Array.from(placements.values()).filter(p => p.isCorrect).length;
  const progressPercent = totalItems ? (correctItems / totalItems) * 100 : 0;

  // ============================================================================
  // Workspace scene, republished after every render: the rule, the groups, the staged card, what the bins hold.
  // ============================================================================
  useLayoutEffect(() => {
    if (!workspaceItem) return;
    const sorted = data.items.filter(i => placements.get(i.id)?.isCorrect)
      .map(i => ({ label: i.label, categoryId: i.correctCategoryId }));
    const leverContext = { categories: data.categories, descriptionsShown: !isPreReader, sortedCount: sorted.length };
    const levers = SORT_LEVERS.declare(workspaceItem, leverContext, pulledLevers);
    const onScreen = SORT_LEVERS.onScreen(workspaceItem, leverContext, pulledLevers) || undefined;
    workspace.current = { ...workspaceScene(data, workspaceItem, { placedIn: tryPlacedIn, sorted, descriptionsShown: !isPreReader, onScreen }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this card.`;
        if (lever.pulled) return `${id} is already pulled.`;
        setLeverState({ item: workspaceItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
    };
  });

  return (
    <div className={`w-full ${className}`}>
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-slate-100">{data.title}</CardTitle>
          <CardDescription className="text-slate-400">{data.instructions}</CardDescription>
          {/* The RULE is the question, so it stays at every band; at K-2 the tutor's voice carries it too. */}
          <div className="flex items-center gap-2 pt-2">
            <Badge className={`bg-slate-800/50 border-slate-700/50 text-orange-300 ${isPreReader ? 'text-base py-1' : ''}`}>
              <Sparkles className="w-3 h-3 mr-1" style={{ color: colors.primary }} />
              {data.sortingRule}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* ONE item at a time, at every band: tap-a-group = choose, and one thing to do on screen. */}
      {!hasSubmitted && stagedItem && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 mb-6">
          <CardContent className="py-6 flex flex-col items-center gap-3">
            <div data-pip-object="card"
              className="px-8 py-6 rounded-2xl bg-slate-800/60 border-2 border-white/15 text-3xl font-semibold text-slate-100">
              {stagedItem.label}
            </div>
            {/* The card_clue lever: the card's own clue, every group name blanked. */}
            {clue && (
              <div data-lever="card-clue" className="flex items-start gap-2 max-w-md p-3 rounded-lg bg-cyan-900/20 border border-cyan-400/30">
                <Lightbulb className="w-4 h-4 text-yellow-300 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-200">{clue}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* A fraction and a meter are adult chrome a K-2 child cannot read; the filling groups show progress. */}
      {!hasSubmitted && !isPreReader && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Progress: {correctItems} / {totalItems} items sorted correctly</span>
            <span className="text-sm font-mono" style={{ color: colors.primary }}>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${progressPercent}%`, backgroundColor: colors.primary }} />
          </div>
        </div>
      )}

      {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the groups as the region it outlines. */}
      <PipDock />
      <PipWorkspace>
        <div className={`grid gap-6 mb-6 ${
          data.categories.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          data.categories.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {data.categories.map(renderCategory)}
        </div>
      </PipWorkspace>
    </div>
  );
};

const ClassificationSorter = withWorkspaceOnly<ClassificationSorterProps>('classification-sorter',
  ClassificationSorterSurface, props => props.data.title);

export default ClassificationSorter;
