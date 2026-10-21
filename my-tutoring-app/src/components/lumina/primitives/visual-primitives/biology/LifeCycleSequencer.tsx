import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { LifeCycleSequencerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { LuminaDropZone, type DropZoneState } from '../../../ui';
import { Clock, ArrowRight, CheckCircle2, XCircle, Sparkles, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { bankOrder, cycleCorrect, cycleMiss, describeCycleWork, lifeCycleItem, workspaceScene,
  type LifeCycleItem } from './lifeCycleSequencerWorkspace';
import { ARROW_LEVER, KEEP_LEVER, LIFE_CYCLE_LEVERS, PRACTICE_NOTE, lockedStages, type CycleLeverContext }
  from './lifeCycleSequencerLevers';
import { lifeCycleSequencerBoss } from './lifeCycleSequencer.boss';

/**
 * Life Cycle Sequencer - Interactive Biology Primitive
 *
 * Two columns: the mixed-up stage cards and the numbered timeline slots. Cards are placed by drag, by tap-then-slot,
 * or (K-2) by one tap into the next empty slot.
 *
 * Taught only on the teaching workspace (`lifeCycleSequencer.boss.ts`): the payload is one sequence, so the session
 * has one item (`lifeCycleSequencerWorkspace.ts`); Check Answer commits through `progress.commitCheck` with the named
 * miss and the shell's Try again clears the board. In-item levers (`LIFE_CYCLE_LEVERS`): an earlier-to-later arrow,
 * locking the stages a check marked right, and an easier practice sequence.
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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
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

const useCycleProgress = useWorkspaceProgressFor('life-cycle-sequencer');

// ============================================================================
// Main Component
// ============================================================================

const LifeCycleSequencerSurface = ({ data, className = '', runtimePlanItemId }: LifeCycleSequencerProps) => {
  // Defensive check for undefined or invalid data
  if (!data || !data.stages || !Array.isArray(data.stages) || data.stages.length === 0) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Data</h3>
        <p className="text-slate-300">
          The life cycle sequencer received invalid data. Please regenerate the content.
        </p>
      </div>
    );
  }

  const workspace = useRef<TeachingWorkspace | null>(null);
  const [startTime] = useState(Date.now());
  const sessionItem = useMemo(() => lifeCycleItem(data), [data]);
  const items = useMemo(() => [sessionItem], [sessionItem]);
  const [timelineStages, setTimelineStages] = useState<(LifeCycleStage | null)[]>(() =>
    new Array(data.stages.length).fill(null)
  );
  const [selectedStage, setSelectedStage] = useState<LifeCycleStage | null>(null);
  const [draggedStage, setDraggedStage] = useState<LifeCycleStage | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const [stageResults, setStageResults] = useState<Map<string, boolean>>(new Map());
  const [showGradingFlash, setShowGradingFlash] = useState(false);
  const gradingFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The last check's per-stage record and the first check's right count, for the submission. */
  const lastAttempts = useRef<StageAttempt[]>([]);
  const firstCheckCorrect = useRef<number | null>(null);

  // In-item levers, keyed by the session item they were pulled on; the stages `keep_right` locked in their slots; and
  // the easier practice sequence a simplify lever puts in place of the session item until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [kept, setKept] = useState<{ item: string; slots: Record<number, string> }>({ item: '', slots: {} });
  const [practice, setPractice] = useState<LifeCycleItem | null>(null);
  const currentItem = practice ?? sessionItem;
  const pulledLevers = !practice && leverState.item === sessionItem.id ? leverState.pulled : [];
  const keptHere: Record<number, string> = !practice && kept.item === sessionItem.id ? kept.slots : {};
  const isKept = (index: number) => keptHere[index] !== undefined;
  /** A help lever is drawn on the session item while pulled, never on a practice sequence. */
  const arrowOn = !practice && pulledLevers.includes(ARROW_LEVER);
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

  const resolvedInstanceId = useMemo(
    () => instanceId || `life-cycle-sequencer-${Date.now()}`,
    [instanceId],
  );

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<LifeCycleSequencerMetrics>({
    primitiveType: 'life-cycle-sequencer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // ── Progress: the runtime owns the item; bound below, once the setters exist. ──
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useCycleProgress({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: lifeCycleSequencerBoss.assignment!,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onFinished: result => finish.current(result),
  });
  /** A checked answer stays closed until Try again on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = progress.canAttempt === false;
  const locked = () => hasSubmitted || workspaceClosed.current;

  // ============================================================================
  // Reading band
  // ============================================================================
  // At K-2 the stage names, the descriptions, the slot numbers and the "Drop
  // stage here" prompts are all undecodable, and a select-then-target protocol
  // is two acts. The ordering itself is genuinely K-fit — the fix is to make
  // tapping a picture place it in the next empty slot, so ordering becomes one
  // tap per card (reader-fit PRE contract rules 1, 2, 7).
  const isPreReader = data.gradeBand === 'K-2';

  useEffect(
    () => () => {
      if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
    },
    []
  );

  /** A fresh item, or the same one reopened by Try again: the board starts blank but for stages a lever locked. */
  const clearBoard = useCallback((item: LifeCycleItem, lockedSlots: Readonly<Record<number, string>> = {}) => {
    setTimelineStages(item.stages.map((_, i) => item.stages.find(s => s.id === lockedSlots[i]) ?? null));
    setSelectedStage(null);
    setIsChecked(false);
    setStageResults(new Map());
    setShowGradingFlash(false);
  }, []);
  // Try again keeps a practice sequence; a fresh item, or the full item back after practice, drops it.
  openItem.current = (retry) => {
    if (retry && practice) { clearBoard(practice); return; }
    setPractice(null);
    clearBoard(sessionItem, kept.item === sessionItem.id ? kept.slots : {});
  };

  // The bank never shows the stages in order (`bankOrder`); a placed card leaves it.
  const shuffledStages = useMemo(
    () => bankOrder(currentItem).filter(s => !timelineStages.some(t => t?.id === s.id)),
    [currentItem, timelineStages],
  );

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

  /**
   * Place a stage into the first empty slot. This is the PRE protocol: tapping
   * a picture IS the placement, so ordering costs one tap per card instead of
   * select-then-target. Says nothing about correctness — the order is the
   * answer and the student has not checked yet.
   */
  const placeInNextEmptySlot = (stage: LifeCycleStage) => {
    const index = timelineStages.findIndex(s => s === null);
    if (index === -1) return;

    SoundManager.snap();
    const newTimeline = [...timelineStages];
    newTimeline[index] = stage;
    setTimelineStages(newTimeline);
    setSelectedStage(null);
    setIsChecked(false);
    setStageResults(new Map());
  };

  // Touch/Click to select and place
  const handleStageClick = (stage: LifeCycleStage, fromTimeline: boolean = false) => {
    if (locked()) return;

    // PRE: one tap = placed. No selection state to understand or undo-target.
    if (isPreReader && !fromTimeline) {
      placeInNextEmptySlot(stage);
      return;
    }

    if (fromTimeline) {
      // Remove from timeline and return to the pool (a stage a lever locked stays)
      const timelineIndex = timelineStages.findIndex(s => s?.id === stage.id);
      if (timelineIndex !== -1 && !isKept(timelineIndex)) {
        const newTimeline = [...timelineStages];
        newTimeline[timelineIndex] = null;
        setTimelineStages(newTimeline);
        setIsChecked(false);
        setStageResults(new Map());
      }
      setSelectedStage(null);
    } else {
      setSelectedStage(selectedStage?.id === stage.id ? null : stage);
    }
  };

  const handleDropZoneClick = (index: number) => {
    if (!selectedStage || locked() || isKept(index)) return;

    // Place selected stage in timeline; an occupied slot's card goes back to the pool
    const newTimeline = timelineStages.map(s => (s?.id === selectedStage.id ? null : s));
    newTimeline[index] = selectedStage;
    SoundManager.snap();
    setTimelineStages(newTimeline);
    setSelectedStage(null);
    setIsChecked(false);
    setStageResults(new Map());
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, stage: LifeCycleStage) => {
    if (locked()) { e.preventDefault(); return; }
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

    const fromIndex = timelineStages.findIndex(s => s?.id === draggedStage?.id);
    if (!draggedStage || locked() || isKept(dropIndex) || (fromIndex !== -1 && isKept(fromIndex))) return;
    SoundManager.snap();

    const newTimeline = [...timelineStages];

    if (fromIndex !== -1) {
      // Moving within timeline
      if (fromIndex !== dropIndex) {
        const temp = newTimeline[dropIndex];
        newTimeline[dropIndex] = newTimeline[fromIndex];
        newTimeline[fromIndex] = temp;
      }
    } else {
      // Adding from the pool; an occupied slot's card goes back to the pool
      newTimeline[dropIndex] = draggedStage;
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
    if (locked()) return;

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
    if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
    setShowGradingFlash(true);
    gradingFlashTimer.current = setTimeout(() => setShowGradingFlash(false), 900);

    const slots = timelineStages.map(s => s?.id ?? null);
    const allCorrect = cycleCorrect(currentItem, slots);
    if (!practice) {
      lastAttempts.current = attempts;
      if (firstCheckCorrect.current === null) firstCheckCorrect.current = correctCount;
    }

    // The activity's own check is the workspace's checked gesture (counts the attempt, records the verdict).
    progress.commitCheck(describeCycleWork(currentItem, slots), allCorrect,
      allCorrect ? undefined : cycleMiss(currentItem, slots));

    if (allCorrect) SoundManager.playCorrect(); else SoundManager.playIncorrect();
  };

  // Under a lesson's evaluation provider only: the scored session, whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const metrics: LifeCycleSequencerMetrics = {
      type: 'life-cycle-sequencer',
      cycleType: data.cycleType,
      totalStages: data.stages.length,
      stageAttempts: lastAttempts.current,
      totalCorrectFirstAttempt: firstCheckCorrect.current ?? 0,
      completionTimeMs: Date.now() - startTime,
      allStagesCorrect: result.solvedCount === 1,
      attemptsBeforeSuccess: Math.max(0, result.attemptsCount - 1),
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
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
        data-pip-object={`card-${stage.id}`}
        aria-label={stage.label}
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

        {/* Image Preview — `imagePrompt` is an image-GENERATION instruction
            ("a female butterfly laying an egg on a leaf"), not student copy.
            Rendering it put prompt-engineering in the child's field at every
            grade, and at K-2 it is the densest text on the card. */}
        <div className="h-24 bg-slate-700/30 rounded-t-lg flex items-center justify-center border-b border-slate-700/50 relative overflow-hidden">
          <Sparkles className={`text-slate-500 ${isPreReader ? 'w-10 h-10' : 'w-6 h-6'}`} />
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
              aria-label={`More about ${stage.label}`}
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
    const zoneState: DropZoneState =
      isDropTarget
        ? 'dragOver'
        : showGradingFlash && showStatus
          ? isCorrect
            ? 'correct'
            : 'incorrect'
          : stage
            ? 'filled'
            : 'idle';

    return (
      <LuminaDropZone
        key={`drop-zone-${index}`}
        data-pip-object={`slot-${index + 1}`}
        state={zoneState}
        emptyPrompt={(
          <div className="flex flex-col items-center justify-center p-4">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-400/10">
              <span className="text-lg font-bold text-slate-500">{index + 1}</span>
            </div>
            {/* At PRE the slot number alone is the affordance — tapping a
                picture fills the next empty slot, so there is no protocol to
                explain and no text to fail to read. */}
            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                {selectedStage ? 'Tap or drop to place' : 'Drop stage here'}
              </p>
            )}
          </div>
        )}
        onClick={() => handleDropZoneClick(index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        className={`group min-h-[120px] p-0 ${selectedStage && isEmpty ? 'cursor-pointer' : ''}`}
      >
        {!isEmpty && (
          <div
            data-pip-object={`card-${stage.id}`}
            aria-label={stage.label}
            draggable={!hasSubmitted && !isKept(index)}
            onDragStart={(e) => handleDragStart(e, stage)}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              handleStageClick(stage, true);
            }}
            className={`
              relative overflow-hidden
              bg-slate-800/40 backdrop-blur-sm rounded-[10px] p-4
              transition-all duration-300
              ${!hasSubmitted ? 'cursor-pointer hover:bg-slate-800/60' : 'cursor-default'}
            `}
          >
            {/* The help lever `keep_right`: a stage the check marked right, locked in its slot. */}
            {isKept(index) && (
              <div data-lever="kept" aria-label="Locked: marked right" className="absolute top-2 right-2 z-10 text-base">
                <span aria-hidden>🔒</span>
              </div>
            )}

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
            {showStatus && isCorrect && index < currentItem.stages.length - 1 && currentItem.cycleType === 'linear' && (
              <div className="absolute -right-6 top-1/2 -translate-y-1/2 z-20">
                <ArrowRight className="w-5 h-5 text-green-400" />
              </div>
            )}
          </div>
        )}
      </LuminaDropZone>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  const allPlaced = timelineStages.every(s => s !== null);
  const correctCount = Array.from(stageResults.values()).filter(v => v).length;
  const progressPct = (timelineStages.filter(s => s !== null).length / currentItem.stages.length) * 100;
  const solved = isChecked && allPlaced && correctCount === currentItem.stages.length;
  const checkDisabled = hasSubmitted || !allPlaced || isChecked || progress.canAttempt === false;

  // What the tutor and the observer are shown, republished every render, with the session item's levers.
  useLayoutEffect(() => {
    const marked = isChecked
      ? {
        right: timelineStages.flatMap((s, i) => (s && stageResults.get(s.id) === true ? [i] : [])),
        wrong: timelineStages.flatMap((s, i) => (s && stageResults.get(s.id) === false ? [i] : [])),
      }
      : null;
    const slots = timelineStages.map(s => s?.id ?? null);
    const scene = workspaceScene(currentItem, { slots, marked });
    const ctx: CycleLeverContext = { slots, marked, kept: keptHere };
    const levers = practice ? [] : LIFE_CYCLE_LEVERS.declare(sessionItem, ctx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : LIFE_CYCLE_LEVERS.support(sessionItem, ctx),
      onScreen: practice ? '' : LIFE_CYCLE_LEVERS.onScreen(sessionItem, ctx, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this sequence.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = LIFE_CYCLE_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'This sequence is already the plainest of its kind.';
          setLeverState(next); setPractice(easier); clearBoard(easier);
          return { practice: lifeCycleSequencerBoss.assignment!(easier) };
        }
        if (id === KEEP_LEVER) {
          // Offered only when the check left something to lock (`keptSlots`): lock it, and the stages marked wrong go
          // back to the cards; the marks clear with them.
          const lockedSlots = lockedStages(sessionItem, ctx) ?? {};
          setKept({ item: sessionItem.id, slots: lockedSlots });
          setTimelineStages(timelineStages.map((s, i) => (lockedSlots[i] ? s : null)));
          setIsChecked(false); setStageResults(new Map()); setShowGradingFlash(false);
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item: the practice sequence is not the learner's work on it.
      endPractice: () => { setPractice(null); clearBoard(sessionItem, keptHere); },
    };
  });

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-100 mb-2">{data.title}</h3>
        <p className="text-slate-400 mb-2">{currentItem.instructions}</p>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          {/* scaleContext is prose ("about 4 weeks from egg to butterfly") and
              the band badge is a developer readout — neither belongs in a
              five-year-old's field (PRE rule 7). */}
          {!isPreReader && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the cards and the timeline as
          one region. */}
      <PipDock />
      <PipWorkspace className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 mb-6">
        {/* Left Column - Scrambled Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            {/* A heading in uppercase tracking with a live tally is chrome; the
                shrinking pile already shows how many are left. */}
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              {isPreReader ? '' : `Available Cards (${shuffledStages.length})`}
            </h4>
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
                    width: `${progressPct}%`,
                    backgroundColor: colors.primary,
                  }}
                />
              </div>
              <span className="text-xs text-slate-500">
                {timelineStages.filter(s => s).length}/{currentItem.stages.length}
              </span>
            </div>
          </div>

          {practice && (
            <p className="mb-2 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300" data-practice>
              Practice: {practice.title}
            </p>
          )}
          {/* The help lever `time_arrow`: which way time runs over the slots, drawn on no stage. */}
          {arrowOn && (
            <div data-lever="time-arrow" aria-label="Start to later" className="mb-2 flex items-center gap-2 text-sm text-cyan-200">
              <span aria-hidden>🚩</span>
              <span className="text-xs">start</span>
              <div className="relative h-0.5 flex-1 bg-cyan-300/70">
                <span aria-hidden className="absolute -right-1 -top-[9px] text-base leading-none">▶</span>
              </div>
              <span className="text-xs">later</span>
              {currentItem.cycleType === 'circular' && (
                <span data-lever="time-arrow-return" aria-label="Back to the start" className="text-lg">
                  <span aria-hidden>↩</span>
                </span>
              )}
            </div>
          )}
          <div className={`
            grid gap-4
            ${currentItem.cycleType === 'circular'
              ? 'grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }
          `}>
            {timelineStages.map((_, index) => renderDropZone(index))}
          </div>
        </div>
      </PipWorkspace>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleCheckAnswer}
            disabled={checkDisabled}
            className={`
              px-6 py-3 rounded-lg font-semibold
              transition-all duration-200
              ${checkDisabled
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'text-white shadow-lg hover:shadow-xl hover:scale-105'
              }
            `}
            style={{
              backgroundColor: checkDisabled ? undefined : colors.primary,
            }}
          >
            {!allPlaced ? 'Place all cards' : isChecked ? 'Checked' : 'Check Answer'}
          </button>
        </div>

        {/* Score Display */}
        {isChecked && (
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: correctCount === currentItem.stages.length ? '#10b981' : '#f59e0b' }}>
              {correctCount} / {currentItem.stages.length}
            </p>
            <p className="text-xs text-slate-500">correct</p>
          </div>
        )}
      </div>

      {/* Success Message */}
      {solved && (
        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-slideIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <div>
              <h4 className="text-lg font-semibold text-green-300">Perfect! 🎉</h4>
              <p className="text-sm text-slate-300">
                You&apos;ve mastered the {data.title.toLowerCase()}!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
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
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

const LifeCycleSequencer = withWorkspaceOnly<LifeCycleSequencerProps>('life-cycle-sequencer', LifeCycleSequencerSurface,
  props => props.data?.title);

export default LifeCycleSequencer;
