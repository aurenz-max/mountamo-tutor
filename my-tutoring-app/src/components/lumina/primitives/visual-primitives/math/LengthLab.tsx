'use client';

import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  dropZoneStateClass,
  motion,
  type DropZoneState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LengthLabMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { lengthLabBoss } from './lengthLab.boss';
import { describeLengthWork, lengthLabMatches, lengthMiss, lengthScene, type LengthView } from './lengthLabWorkspace';
import {
  CHAIN_MODEL_LEVER, END_LINES_LEVER, LENGTH_LEVERS, ORDER_STEPS_LEVER, OUTLINE_LEVER, UNIT_MARKS_LEVER, UNIT_MODEL_LEVER,
  WORD_MODEL_LEVER,
} from './lengthLabLevers';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LengthLabChallenge {
  id: string;
  type:
    | 'compare' | 'tile_and_count' | 'order' | 'indirect'
    // K measuring family: guess before you measure, and measure the same thing twice.
    | 'estimate_then_tile' | 'two_unit_compare';
  instruction: string;
  hint: string;
  narration: string;
  /** Objects to display — names and lengths (in unit cells) */
  objectName0: string;
  objectLength0: number;
  objectColor0: string;
  objectName1: string;
  objectLength1: number;
  objectColor1: string;
  /** Third object for 'order' challenges */
  objectName2?: string;
  objectLength2?: number;
  objectColor2?: string;
  /** For compare: 'longer' | 'shorter' | 'same' */
  correctAnswer: string;
  /** For tile_and_count: correct unit count */
  correctUnitCount?: number;
  /** Unit type for tiling */
  unitType?: string;
  /** estimate_then_tile: the guesses offered before the units appear. The
   *  estimate is RECORDED, never marked right or wrong — a guess that can be
   *  wrong is not a guess. Code-owned so the true count is always among them. */
  estimateOptions?: number[];
  /** two_unit_compare: the second unit the same object is measured with. */
  unitTypeB?: string;
  correctUnitCountB?: number;
  /** For order: correct sequence CSV (e.g. "pencil,crayon,marker") shortest→longest */
  correctOrderCsv?: string;
  /** For indirect: the reference object info */
  referenceObjectName?: string;
  referenceObjectLength?: number;
  referenceObjectColor?: string;
  /** Indirect comparison clue (e.g. "The pencil is shorter than the string") */
  clue0?: string;
  clue1?: string;
  /** Support-tier scaffolds (set by the generator from config.difficulty). */
  showUnitTicks?: boolean;          // compare/order — unit-cell dividers on the bars
  showAlignmentFeedback?: boolean;  // tile_and_count — live fit self-check (default on)
  supportTier?: string;             // 'easy' | 'medium' | 'hard' — drives tutor reveal
}

export interface LengthLabData {
  title: string;
  description: string;
  challenges: LengthLabChallenge[];
  unitType: string; // 'cubes' | 'paper_clips' | 'bears' | 'erasers'
  gradeBand: 'K' | '1';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LengthLabMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  estimate_then_tile: { label: 'Guess, Then Measure', icon: '🤔', accentColor: 'amber' },
  two_unit_compare:   { label: 'Two Units',           icon: '⚖️', accentColor: 'purple' },
  compare:        { label: 'Compare',        icon: '↔️', accentColor: 'blue' },
  tile_and_count: { label: 'Tile & Count',   icon: '🧱', accentColor: 'emerald' },
  order:          { label: 'Order',           icon: '📏', accentColor: 'purple' },
  indirect:       { label: 'Indirect',        icon: '🔍', accentColor: 'amber' },
};

const UNIT_EMOJI: Record<string, string> = {
  cubes: '🟦',
  paper_clips: '📎',
  bears: '🧸',
  erasers: '▬',
  // Body-part units: what a child reaches for when there is no ruler
  // (MEAS001-05-B — measuring with hands and fingers).
  hands: '🖐️',
  fingers: '☝️',
  feet: '👣',
};

const UNIT_WIDTH = 36; // px per unit cell
const MAX_BAR_UNITS = 12;

// ============================================================================
// Helper: Object Bar Renderer
// ============================================================================

interface ObjectBarProps {
  name: string;
  length: number;
  color: string;
  maxUnits: number;
  showLabel?: boolean;
  highlighted?: boolean;
  /** Easy/medium support tier — render unit-cell dividers so the student can count cells. */
  showTicks?: boolean;
  onClick?: () => void;
  className?: string;
}

function ObjectBar({ name, length, color, maxUnits, showLabel = true, highlighted = false, showTicks = false, onClick, className = '' }: ObjectBarProps) {
  const units = Math.min(length, maxUnits);
  const widthPx = units * UNIT_WIDTH;
  return (
    <div className={`flex items-center gap-3 ${className}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div
        className={`relative overflow-hidden rounded-md transition-all duration-300 ${highlighted ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900' : ''}`}
        style={{
          width: `${widthPx}px`,
          height: '28px',
          backgroundColor: color,
          minWidth: '24px',
          opacity: 0.85,
        }}
      >
        {showTicks && Array.from({ length: Math.max(0, units - 1) }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{ left: `${(i + 1) * UNIT_WIDTH}px`, width: '1px', backgroundColor: 'rgba(255,255,255,0.5)' }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-slate-300 text-sm whitespace-nowrap">{name}</span>
      )}
    </div>
  );
}

// ============================================================================
// Lever pictures (`lengthLabLevers.ts`). Each is drawn only while its lever is pulled; none names an item object.
// ============================================================================

/** end_lines: each bar's far end carried down as a dashed line across the panel (the panel has p-4 padding). */
function EndLines({ lengths }: { lengths: number[] }) {
  return (
    <>
      {Array.from(new Set(lengths)).map((len) => (
        <div key={len} data-lever="end-line" aria-hidden
          className="absolute top-2 bottom-2 border-l-2 border-dashed border-yellow-300/70 pointer-events-none"
          style={{ left: `${16 + Math.max(24, Math.min(len, MAX_BAR_UNITS) * UNIT_WIDTH)}px` }} />
      ))}
    </>
  );
}

const ModelBar = ({ width, color = '#94a3b8', tag }: { width: number; color?: string; tag?: string }) => (
  <div className="flex items-center gap-2">
    <div className="rounded" style={{ width: `${width}px`, height: '14px', backgroundColor: color, opacity: 0.8 }} />
    {tag && <span className="text-xs text-slate-300">{tag}</span>}
  </div>
);

/** word_model: what longer, shorter and same look like, on plain grey bars. */
function WordModel() {
  return (
    <div data-lever="word-model" className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
      <div className="space-y-1"><ModelBar width={120} tag="longer" /><ModelBar width={48} tag="shorter" /></div>
      <div className="space-y-1"><ModelBar width={80} tag="same" /><ModelBar width={80} tag="same" /></div>
    </div>
  );
}

/** unit_model: one plain grey bar, measured with small squares and with big squares. */
function UnitModel() {
  const squares = (n: number, size: number) => (
    <div className="flex">{Array.from({ length: n }).map((_, i) => (
      <div key={i} className="border border-white/30 bg-white/10" style={{ width: `${size}px`, height: '16px' }} />))}</div>
  );
  return (
    <div data-lever="unit-model" className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
      <ModelBar width={128} />
      {squares(4, 32)}
      {squares(2, 64)}
    </div>
  );
}

/** chain_model: three plain bars at one start, with the two captions that chain them. */
function ChainModel() {
  return (
    <div data-lever="chain-model" className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
      <div className="space-y-1">
        <ModelBar width={40} color="#ef4444" />
        <ModelBar width={80} color="#3b82f6" />
        <ModelBar width={120} color="#22c55e" />
      </div>
      <p className="text-xs text-slate-300">red is shorter than blue</p>
      <p className="text-xs text-slate-300">blue is shorter than green</p>
    </div>
  );
}

// ============================================================================
// Helper: Tiling Workspace
// ============================================================================

interface TilingWorkspaceProps {
  objectName: string;
  objectLength: number;
  objectColor: string;
  unitType: string;
  correctCount: number;
  onComplete: (count: number) => void;
  disabled: boolean;
  /** Easy support tier — show the live "fit" self-check. Defaults on (medium/hard withdraw). */
  showAlignmentFeedback?: boolean;
  /** How many object-cells ONE of these units covers. A bigger unit is drawn
   *  wider, so "fewer of them reach the end" is something the child SEES rather
   *  than something the feedback line tells them. */
  unitSpan?: number;
  /** Whether a wrong count prints the right one. Off where the count is the answer, since Try again follows. */
  revealOnMiss?: boolean;
  /** The tiles in the row as they change, for the tutor's view of the work. */
  onCountChange?: (count: number) => void;
  /** object_outline lever: a dashed outline of the object's length behind the units. */
  outline?: boolean;
}

function TilingWorkspace({ objectName, objectLength, objectColor, unitType, correctCount, onComplete, disabled, showAlignmentFeedback = true, unitSpan = 1, revealOnMiss = true, onCountChange, outline = false }: TilingWorkspaceProps) {
  const [placedUnits, setPlacedUnits] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const objectWidthPx = Math.min(objectLength, MAX_BAR_UNITS) * UNIT_WIDTH;
  const unitEmoji = UNIT_EMOJI[unitType] || '🟦';

  const addUnit = useCallback(() => {
    if (disabled || submitted) return;
    SoundManager.tick();
    setPlacedUnits(prev => Math.min(prev + 1, MAX_BAR_UNITS + 2));
  }, [disabled, submitted]);

  const removeUnit = useCallback(() => {
    if (disabled || submitted) return;
    SoundManager.tick();
    setPlacedUnits(prev => Math.max(prev - 1, 0));
  }, [disabled, submitted]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    onComplete(placedUnits);
  }, [placedUnits, onComplete]);

  // Reset when challenge changes
  useEffect(() => {
    setPlacedUnits(0);
    setSubmitted(false);
  }, [objectName, correctCount, unitType]);

  useEffect(() => { onCountChange?.(placedUnits); }, [placedUnits, onCountChange]);
  const unitLabel = unitType.replace('_', ' ');

  const tileWidthPx = UNIT_WIDTH * Math.max(1, unitSpan);
  const unitWidthPx = placedUnits * tileWidthPx;
  const isCorrect = submitted && placedUnits === correctCount;
  const isWrong = submitted && placedUnits !== correctCount;

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Object to measure */}
        <div className="space-y-1">
          <span className="text-slate-400 text-xs uppercase tracking-wider">Object: {objectName}</span>
          <div
            className="rounded-md"
            style={{ width: `${objectWidthPx}px`, height: '28px', backgroundColor: objectColor, minWidth: '24px', opacity: 0.85 }}
          />
        </div>

        {/* Unit tiles below */}
        <div className="space-y-1">
          <span className="text-slate-400 text-xs uppercase tracking-wider">Your tiles ({unitType.replace('_', ' ')})</span>
          <div className="relative flex items-center gap-0 min-h-[32px]">
            {outline && (
              <div data-lever="object-outline" aria-hidden
                className="absolute left-0 rounded-md border-2 border-dashed border-yellow-300/70 pointer-events-none"
                style={{ width: `${objectWidthPx}px`, height: '28px', minWidth: '24px' }} />
            )}
            {Array.from({ length: placedUnits }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-center border border-white/20 bg-white/10 text-lg"
                style={{ width: `${tileWidthPx}px`, height: '28px' }}
              >
                {unitEmoji}
              </div>
            ))}
            {placedUnits === 0 && (
              <span className="text-slate-500 text-sm italic">Tap + to add tiles</span>
            )}
          </div>
          {/* Alignment feedback (withdrawn at medium/hard support tiers) */}
          {placedUnits > 0 && !submitted && showAlignmentFeedback && (
            <div className="text-xs text-slate-500">
              {unitWidthPx < objectWidthPx ? 'Not enough tiles yet...' :
               unitWidthPx > objectWidthPx ? 'Too many tiles! Remove some.' :
               'Looks like a perfect fit!'}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-lg px-3"
          onClick={removeUnit}
          aria-label={`Remove ${unitLabel}`}
          disabled={disabled || submitted || placedUnits === 0}
        >
          -
        </Button>
        <span className="text-slate-200 text-xl font-semibold min-w-[2ch] text-center">{placedUnits}</span>
        <Button
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-lg px-3"
          onClick={addUnit}
          aria-label={`Add ${unitLabel}`}
          disabled={disabled || submitted}
        >
          +
        </Button>
        {!submitted && placedUnits > 0 && (
          <Button
            variant="ghost"
            className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300 ml-auto"
            onClick={handleSubmit}
            disabled={disabled}
          >
            Check
          </Button>
        )}
      </div>

      {/* Feedback */}
      {isCorrect && (
        <div className="text-emerald-400 text-sm font-medium">
          Correct! The {objectName} is {correctCount} {unitType.replace('_', ' ')} long.
        </div>
      )}
      {isWrong && (
        <div className="text-red-400 text-sm font-medium">
          {revealOnMiss
            ? <>Not quite. You placed {placedUnits}, but the {objectName} is {correctCount} {unitLabel} long.</>
            : <>Not quite. Look where your {unitLabel} end and where the {objectName} ends.</>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper: Ordering Workspace
// ============================================================================

interface OrderItem {
  name: string;
  length: number;
  color: string;
}

interface OrderingWorkspaceProps {
  items: OrderItem[];
  correctOrderCsv: string;
  /** The names placed, shortest slot first; returns the activity's verdict. */
  onComplete: (order: string[]) => boolean;
  disabled: boolean;
  /** The names in the slots as they change, for the tutor's view of the work. */
  onSlotsChange?: (order: string[]) => void;
  /** order_steps lever: three wordless bars under the slots, growing the way the slots run. */
  steps?: boolean;
}

function OrderingWorkspace({ items, correctOrderCsv, onComplete, disabled, onSlotsChange, steps = false }: OrderingWorkspaceProps) {
  const [slots, setSlots] = useState<(OrderItem | null)[]>([null, null, null]);
  const [availableItems, setAvailableItems] = useState<OrderItem[]>([...items]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Reset on challenge change
  useEffect(() => {
    setSlots([null, null, null]);
    setAvailableItems([...items]);
    setSubmitted(false);
    setIsCorrect(false);
  }, [items, correctOrderCsv]);

  const placeItem = useCallback((item: OrderItem) => {
    if (disabled || submitted) return;
    const firstEmpty = slots.findIndex(s => s === null);
    if (firstEmpty === -1) return;
    SoundManager.snap();
    const newSlots = [...slots];
    newSlots[firstEmpty] = item;
    setSlots(newSlots);
    setAvailableItems(prev => prev.filter(i => i.name !== item.name));
  }, [disabled, submitted, slots]);

  const removeFromSlot = useCallback((index: number) => {
    if (disabled || submitted) return;
    const item = slots[index];
    if (!item) return;
    const newSlots = [...slots];
    newSlots[index] = null;
    setSlots(newSlots);
    setAvailableItems(prev => [...prev, item]);
  }, [disabled, submitted, slots]);

  useEffect(() => {
    onSlotsChange?.(slots.filter((s): s is OrderItem => s !== null).map(s => s.name));
  }, [slots, onSlotsChange]);

  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const correct = onComplete(slots.map(s => s?.name || ''));
    setIsCorrect(correct);
    setSubmitted(true);
  }, [slots, disabled, onComplete]);

  const allFilled = slots.every(s => s !== null);

  return (
    <div className="space-y-4">
      {/* Available items */}
      <div className="space-y-1">
        <span className="text-slate-400 text-xs uppercase tracking-wider">Objects to arrange</span>
        <div className="flex flex-wrap gap-2">
          {availableItems.map(item => (
            <Button
              key={item.name}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 flex items-center gap-2"
              onClick={() => placeItem(item)}
              disabled={disabled || submitted}
            >
              <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
              {item.name}
            </Button>
          ))}
          {availableItems.length === 0 && !submitted && (
            <span className="text-slate-500 text-sm italic">All placed! Check your order.</span>
          )}
        </div>
      </div>

      {/* Slots: shortest → longest */}
      <div className="space-y-1">
        <span className="text-slate-400 text-xs uppercase tracking-wider">
          Shortest → Longest
        </span>
        <div className="flex items-end gap-3">
          {slots.map((slot, i) => {
            // Ordering slot speaks the shared drop-zone language: graded on
            // submit (whole-row correct/incorrect), else filled/idle.
            const slotState: DropZoneState = submitted
              ? (isCorrect ? 'correct' : 'incorrect')
              : slot
                ? 'filled'
                : 'idle';
            const slotMotion = submitted && isCorrect ? motion.pop : submitted && !isCorrect ? motion.shake : '';
            return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`min-w-[80px] min-h-[44px] rounded-lg flex items-center justify-center cursor-pointer transition-colors ${dropZoneStateClass(slotState)} ${slotMotion}`}
                onClick={() => removeFromSlot(i)}
              >
                {slot ? (
                  <div className="flex items-center gap-2 px-3 py-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: slot.color }} />
                    <span className="text-slate-200 text-sm">{slot.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-600 text-xs">{i + 1}</span>
                )}
              </div>
            </div>
            );
          })}
        </div>
        {steps && (
          <div className="flex items-end gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="min-w-[80px] flex justify-center">
                <div data-lever="order-step" aria-hidden className="w-10 rounded-sm bg-yellow-300/50" style={{ height: `${8 * (i + 1)}px` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      {!submitted && allFilled && (
        <Button
          variant="ghost"
          className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
          onClick={handleSubmit}
          disabled={disabled}
        >
          Check Order
        </Button>
      )}

      {submitted && isCorrect && (
        <div className="text-emerald-400 text-sm font-medium">
          Perfect! You arranged them from shortest to longest!
        </div>
      )}
      {submitted && !isCorrect && (
        <div className="text-red-400 text-sm font-medium">
          Not quite. Try comparing the lengths more carefully.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface LengthLabProps {
  data: LengthLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Main Component
// ============================================================================

const useLengthProgress = useWorkspaceProgressFor('length-lab');

const LengthLabSurface = ({ data, runtimePlanItemId }: LengthLabProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    unitType = 'cubes',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Evaluation ──
  const resolvedInstanceId = instanceId || 'length-lab-default';
  const [hasSubmittedEval, setHasSubmittedEval] = useState(false);

  const {
    submitResult: submitEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<LengthLabMetrics>({
    primitiveType: 'length-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Challenge progress: the teaching workspace owns it and moves the index. ──
  /** Bound below, once the setters exist; the progress hook calls it only after render. */
  const openItem = useRef<(retry: boolean) => void>(() => {});
  /** Bound below; a spoken answer the observer credited (`onSolved`). */
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  /** The challenge a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);
  const progress = useLengthProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: lengthLabBoss.assignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onSolved: (index) => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
  });
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
  } = progress;
  /** A checked answer stays closed until Try again or the next challenge. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ── Current challenge ──
  // Levers (`lengthLabLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place. The tier's unit marks and fit line are starting positions, not levers.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<LengthLabChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] || null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  /** estimate_then_tile: the guess the child committed BEFORE the units appeared.
   *  Recorded with the result and never graded — the measuring is what is scored. */
  const [estimate, setEstimate] = useState<number | null>(null);
  /** two_unit_compare: the counts the child got with each unit, in order. */
  const [unitACount, setUnitACount] = useState<number | null>(null);
  const [unitBCount, setUnitBCount] = useState<number | null>(null);
  /** The tiles in the row now, and the objects in the order slots (the tutor's view of the work). */
  const [tiles, setTiles] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  /** Remounts the tiling and ordering rows, so Try again opens them blank. */
  const [attemptKey, setAttemptKey] = useState(0);

  // A fresh challenge starts clean. Try again clears the checked work but keeps the guess, which is never graded:
  // the child measures again against the same guess.
  const clearWork = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    setEstimate(null);
    setUnitACount(null);
    setUnitBCount(null);
    setTiles(0);
    setOrder([]);
    setAttemptKey(k => k + 1);
  };
  // Try again on a practice item keeps it; only a fresh item (or the return from practice) ends it.
  openItem.current = (retry) => {
    if (!retry) setPractice(null);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setUnitACount(null);
    setUnitBCount(null);
    setTiles(0);
    setOrder([]);
    if (!retry) setEstimate(null);
    setAttemptKey(k => k + 1);
  };

  // ── Stable order items (memoized so OrderingWorkspace doesn't reset on every parent re-render) ──
  const orderItems = useMemo<OrderItem[]>(() => {
    const ch = currentChallenge;
    if (!ch || ch.type !== 'order') return [];
    const items: OrderItem[] = [
      { name: ch.objectName0, length: ch.objectLength0, color: ch.objectColor0 },
      { name: ch.objectName1, length: ch.objectLength1, color: ch.objectColor1 },
    ];
    if (ch.objectName2 && ch.objectLength2 && ch.objectColor2) {
      items.push({ name: ch.objectName2, length: ch.objectLength2, color: ch.objectColor2 });
    }
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [currentChallenge]);

  // ── The learner's work, as the check and the tutor read it ──
  const unitA = currentChallenge?.unitType || unitType;
  const unitB = currentChallenge?.unitTypeB || unitType;
  const view = (over: Partial<LengthView> = {}): LengthView => ({
    answer: selectedAnswer, tiles, estimate, countA: unitACount, countB: unitBCount, unitA, unitB, order,
    ticksShown: !!currentChallenge?.showUnitTicks || leverOn(UNIT_MARKS_LEVER), fitShown: currentChallenge?.showAlignmentFeedback !== false,
    ...over,
  });
  /** The activity's own check, committed as the workspace's checked gesture. */
  const commit = (work: LengthView): boolean => {
    const ch = currentChallenge!;
    const correct = lengthLabMatches(ch, work);
    if (correct) tappedCorrect.current = ch.id;
    progress.commitCheck(describeLengthWork(ch, work), correct, correct ? undefined : lengthMiss(ch, work));
    return correct;
  };

  // A spoken compare or indirect answer the observer credited (`onSolved` fires once per challenge, for a tap too):
  // the result a correct tap records, and the credited choice shown as a correct tap shows it. The shared lifecycle
  // plays the success sound.
  solvedAloud.current = (index) => {
    const solved = challenges[index];
    if (!solved || tappedCorrect.current === solved.id || (solved.type !== 'compare' && solved.type !== 'indirect')) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setSelectedAnswer(solved.correctAnswer);
    setShowFeedback(true);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice || (practice.type !== 'compare' && practice.type !== 'indirect')) return;
    setSelectedAnswer(practice.correctAnswer);
    setShowFeedback(true);
  };

  // ── Submit evaluation when all complete ──
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEval) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    setHasSubmittedEval(true);

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const overallPct = Math.round((correctCount / challenges.length) * 100);
    const elapsed = elapsedMs;

    const metrics: LengthLabMetrics = {
      type: 'length-lab',
      totalChallenges: challenges.length,
      correctAnswers: correctCount,
      totalAttempts,
      accuracy: overallPct / 100,
      averageTimePerChallenge: Math.round(elapsed / challenges.length),
    };

    submitEvaluation(
      correctCount === challenges.length,
      overallPct,
      metrics,
      { challengeResults },
    );
  }, [allChallengesComplete, hasSubmittedEval, progress.recordsEvaluation, challengeResults, challenges.length, submitEvaluation, elapsedMs]);

  // ── Handle compare answer ──
  const handleCompareAnswer = (answer: string) => {
    if (!currentChallenge || showFeedback || learnerBlocked()) return;
    setSelectedAnswer(answer);
    setShowFeedback(true);
    if (commit(view({ answer }))) SoundManager.playCorrect(); else SoundManager.playIncorrect();
  };

  // ── The guess, and the two-unit walk ────────────────────────────────────
  const handleEstimate = (guess: number) => {
    if (estimate !== null || learnerBlocked()) return;
    SoundManager.select();
    setEstimate(guess);
  };

  /** two_unit_compare: the first tiling is recorded, the second opens the question. */
  const handleUnitATile = useCallback((count: number) => {
    setUnitACount(count);
  }, []);
  const handleUnitBTile = useCallback((count: number) => {
    setUnitBCount(count);
  }, []);

  const handleTwoUnitAnswer = (answerUnit: string) => {
    if (!currentChallenge || showFeedback || learnerBlocked()) return;
    setSelectedAnswer(answerUnit);
    setShowFeedback(true);
    // The unit you need MORE of is the smaller one — that inverse is the whole
    // insight, so it is re-derived from the two counts, never stored separately.
    if (commit(view({ answer: answerUnit }))) SoundManager.playCorrect(); else SoundManager.playIncorrect();
  };

  // ── Handle tile completion ──
  const handleTileComplete = (count: number) => {
    if (!currentChallenge) return;
    setTiles(count);
    if (commit(view({ tiles: count }))) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    setShowFeedback(true);
  };

  // ── Handle order completion ──
  const handleOrderComplete = (placed: string[]): boolean => {
    if (!currentChallenge) return false;
    setOrder(placed);
    const correct = commit(view({ order: placed }));
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    setShowFeedback(true);
    return correct;
  };

  // ── Handle indirect answer ──
  const handleIndirectAnswer = (answer: string) => {
    if (!currentChallenge || showFeedback || learnerBlocked()) return;
    setSelectedAnswer(answer);
    setShowFeedback(true);
    if (commit(view({ answer }))) SoundManager.playCorrect(); else SoundManager.playIncorrect();
  };

  // What the tutor and the observer are shown, republished every render. No demonstration, no presentation; the
  // lever set (`lengthLabLevers.ts`) writes the levers, their facts and the support fact.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = lengthScene(currentChallenge, view());
    const ctx = { ticksShown: !!sessionChallenge.showUnitTicks, sessionUnit: unitType, guessed: estimate !== null };
    const onScreen = practice ? '' : LENGTH_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers);
    const levers = practice ? [] : LENGTH_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    workspace.current = {
      ...leverScene(scene, { support: LENGTH_LEVERS.support(practice ? null : sessionChallenge, ctx), onScreen }),
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = LENGTH_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); clearWork(); setPractice(easier);
          return { practice: lengthLabBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearWork(); setPractice(null); },
    };
  });

  // ── Render challenge content ──
  const inputClosed = allChallengesComplete || blocked;
  const renderChallenge = () => {
    if (!currentChallenge) return null;
    const ch = currentChallenge;
    const ticksOn = !!ch.showUnitTicks || leverOn(UNIT_MARKS_LEVER);

    switch (ch.type) {
      case 'compare': {
        const isCorrect = showFeedback && selectedAnswer === ch.correctAnswer;
        const isWrong = showFeedback && selectedAnswer !== ch.correctAnswer;

        return (
          <div className="space-y-5">
            {/* Two objects on shared baseline */}
            <div className="relative space-y-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <ObjectBar name={ch.objectName0} length={ch.objectLength0} color={ch.objectColor0} maxUnits={MAX_BAR_UNITS} showTicks={ticksOn} />
              <ObjectBar name={ch.objectName1} length={ch.objectLength1} color={ch.objectColor1} maxUnits={MAX_BAR_UNITS} showTicks={ticksOn} />
              {leverOn(END_LINES_LEVER) && <EndLines lengths={[ch.objectLength0, ch.objectLength1]} />}
            </div>
            {leverOn(WORD_MODEL_LEVER) && <WordModel />}

            {/* Answer buttons */}
            <div className="flex flex-wrap gap-2">
              {['longer', 'shorter', 'same'].map(answer => {
                const label = answer === 'longer' ? `${ch.objectName0} is longer` :
                              answer === 'shorter' ? `${ch.objectName0} is shorter` :
                              'They are the same length';
                const isSelected = selectedAnswer === answer;
                return (
                  <Button
                    key={answer}
                    variant="ghost"
                    className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                      isSelected && isCorrect ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' :
                      isSelected && isWrong ? 'bg-red-500/20 border-red-400/30 text-red-300' :
                      ''
                    }`}
                    onClick={() => handleCompareAnswer(answer)}
                    disabled={showFeedback || inputClosed}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            {isCorrect && <div className="text-emerald-400 text-sm font-medium">That&apos;s right!</div>}
            {isWrong && <div className="text-red-400 text-sm font-medium">Not quite. Look at the bars — which one sticks out farther?</div>}
          </div>
        );
      }

      // ── Guess first, then measure. The guess is never graded: a K child who
      // is marked wrong for guessing learns to stop guessing, and estimating
      // before measuring is the point of the row this serves. ──
      case 'estimate_then_tile':
        return (
          <div className="space-y-5">
            {estimate === null ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-300">
                  Before you measure — how many do you think it will take?
                </p>
                <div className="flex flex-wrap gap-2">
                  {(ch.estimateOptions ?? []).map((guess) => (
                    <Button
                      key={guess}
                      variant="ghost"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 px-5 text-lg font-mono"
                      onClick={() => handleEstimate(guess)}
                      disabled={inputClosed}
                    >
                      {guess}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-300">
                  You guessed <span className="font-mono text-amber-300">{estimate}</span>. Now measure and see.
                </p>
                <TilingWorkspace
                  key={`${ch.id}-${attemptKey}`}
                  objectName={ch.objectName0}
                  objectLength={ch.objectLength0}
                  objectColor={ch.objectColor0}
                  unitType={ch.unitType || unitType}
                  correctCount={ch.correctUnitCount || ch.objectLength0}
                  onComplete={handleTileComplete}
                  disabled={inputClosed}
                  showAlignmentFeedback={ch.showAlignmentFeedback !== false}
                  revealOnMiss={false}
                  onCountChange={setTiles}
                  outline={leverOn(OUTLINE_LEVER)}
                />
              </>
            )}
          </div>
        );

      // ── The same object, measured twice with different units. The child lays
      // both out and then says which they needed more of — the inverse
      // relationship between unit size and count. ──
      case 'two_unit_compare': {
        const label = (u: string) => u.replace('_', ' ');
        const correctUnit = (ch.correctUnitCount ?? 0) > (ch.correctUnitCountB ?? 0) ? unitA : unitB;
        return (
          <div className="space-y-5">
            {leverOn(UNIT_MODEL_LEVER) && <UnitModel />}
            <div className="space-y-2">
              <p className="text-sm text-slate-300">
                First, measure the {ch.objectName0} with {label(unitA)}.
              </p>
              <TilingWorkspace
                key={`${ch.id}-a-${attemptKey}`}
                objectName={ch.objectName0}
                objectLength={ch.objectLength0}
                objectColor={ch.objectColor0}
                unitType={unitA}
                correctCount={ch.correctUnitCount || ch.objectLength0}
                // The first unit can be the wider one (8.1i), so it is drawn at its own width too.
                unitSpan={Math.max(1, Math.round(ch.objectLength0 / Math.max(1, ch.correctUnitCount ?? ch.objectLength0)))}
                onComplete={handleUnitATile}
                disabled={inputClosed}
                showAlignmentFeedback={ch.showAlignmentFeedback !== false}
              />
            </div>

            {unitACount !== null ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-300">
                  Now measure the same {ch.objectName0} with {label(unitB)}.
                </p>
                <TilingWorkspace
                  key={`${ch.id}-b-${attemptKey}`}
                  objectName={ch.objectName0}
                  objectLength={ch.objectLength0}
                  objectColor={ch.objectColor0}
                  unitType={unitB}
                  correctCount={ch.correctUnitCountB || ch.objectLength0}
                  // One big unit spans several small ones — that ratio is why
                  // fewer of them reach the end, so it is drawn, not asserted.
                  unitSpan={Math.max(1, Math.round(ch.objectLength0 / Math.max(1, ch.correctUnitCountB ?? 1)))}
                  onComplete={handleUnitBTile}
                  disabled={inputClosed}
                  showAlignmentFeedback={ch.showAlignmentFeedback !== false}
                />
              </div>
            ) : null}

            {unitACount !== null && unitBCount !== null ? (
              <div className="space-y-3">
                <p className="text-sm text-purple-300">
                  Which one did you need more of?
                </p>
                <div className="flex flex-wrap gap-2">
                  {[unitA, unitB].map((u) => {
                    const isSelected = selectedAnswer === u;
                    return (
                      <Button
                        key={u}
                        variant="ghost"
                        aria-label={label(u)}
                        className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                          isSelected && showFeedback && u === correctUnit ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' :
                          isSelected && showFeedback ? 'bg-red-500/20 border-red-400/30 text-red-300' : ''
                        }`}
                        onClick={() => handleTwoUnitAnswer(u)}
                        disabled={showFeedback || inputClosed}
                      >
                        {UNIT_EMOJI[u] || '🟦'} {label(u)}
                      </Button>
                    );
                  })}
                </div>
                {showFeedback && selectedAnswer === correctUnit ? (
                  <div className="text-emerald-400 text-sm font-medium">
                    That&apos;s right — the smaller unit takes more of them to reach the end.
                  </div>
                ) : null}
                {showFeedback && selectedAnswer !== correctUnit ? (
                  <div className="text-red-400 text-sm font-medium">
                    Not quite. Look back at how many of each you laid down.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      }

      case 'tile_and_count':
        return (
          <TilingWorkspace
            key={`${ch.id}-${attemptKey}`}
            objectName={ch.objectName0}
            objectLength={ch.objectLength0}
            objectColor={ch.objectColor0}
            unitType={ch.unitType || unitType}
            correctCount={ch.correctUnitCount || ch.objectLength0}
            onComplete={handleTileComplete}
            disabled={inputClosed}
            showAlignmentFeedback={ch.showAlignmentFeedback !== false}
            revealOnMiss={false}
            onCountChange={setTiles}
            outline={leverOn(OUTLINE_LEVER)}
          />
        );

      case 'order': {
        return (
          <div className="space-y-5">
            {/* Show all objects */}
            <div className="relative space-y-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              {orderItems.map(item => (
                <ObjectBar key={item.name} name={item.name} length={item.length} color={item.color} maxUnits={MAX_BAR_UNITS} showTicks={ticksOn} />
              ))}
              {leverOn(END_LINES_LEVER) && <EndLines lengths={orderItems.map(item => item.length)} />}
            </div>

            <OrderingWorkspace
              key={`${ch.id}-${attemptKey}`}
              items={orderItems}
              correctOrderCsv={ch.correctOrderCsv || ''}
              onComplete={handleOrderComplete}
              disabled={inputClosed}
              onSlotsChange={setOrder}
              steps={leverOn(ORDER_STEPS_LEVER)}
            />
          </div>
        );
      }

      case 'indirect': {
        const isCorrect = showFeedback && selectedAnswer === ch.correctAnswer;
        const isWrong = showFeedback && selectedAnswer !== ch.correctAnswer;

        return (
          <div className="space-y-5">
            {/* Clues */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Clues</span>
              {ch.clue0 && <p className="text-slate-200 text-sm">{ch.clue0}</p>}
              {ch.clue1 && <p className="text-slate-200 text-sm">{ch.clue1}</p>}
              {ch.referenceObjectName && (
                <div className="mt-2">
                  <ObjectBar
                    name={`Reference: ${ch.referenceObjectName}`}
                    length={ch.referenceObjectLength || 5}
                    color={ch.referenceObjectColor || '#888'}
                    maxUnits={MAX_BAR_UNITS}
                  />
                </div>
              )}
            </div>
            {leverOn(CHAIN_MODEL_LEVER) && <ChainModel />}

            {/* Question: which is longer? */}
            <div className="flex flex-wrap gap-2">
              {[ch.objectName0, ch.objectName1, 'same'].map(answer => {
                const label = answer === 'same' ? 'Same length' : `${answer} is longer`;
                const isSelected = selectedAnswer === answer;
                return (
                  <Button
                    key={answer}
                    variant="ghost"
                    className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                      isSelected && isCorrect ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' :
                      isSelected && isWrong ? 'bg-red-500/20 border-red-400/30 text-red-300' :
                      ''
                    }`}
                    onClick={() => handleIndirectAnswer(answer)}
                    disabled={showFeedback || inputClosed}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            {isCorrect && <div className="text-emerald-400 text-sm font-medium">Great thinking! You used the clues to compare.</div>}
            {isWrong && <div className="text-red-400 text-sm font-medium">Think about the clues. If A is shorter than the string, and the string is shorter than B, which is longer?</div>}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // ── Hint display ──
  const showHint = currentAttempts >= 2 && currentChallenge && !showFeedback;

  // ── Empty state ──
  if (!challenges.length) {
    return (
      <LuminaCard>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          No challenges available.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          {currentChallenge && (
            <LuminaBadge>
              {currentIndex + 1} / {challenges.length}
            </LuminaBadge>
          )}
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {/* Phase summary when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100))}
            durationMs={elapsedMs}
            heading="Length Lab Complete!"
            celebrationMessage="You explored measuring and comparing lengths!"
            className="mb-6"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <div className="space-y-4">
            {/* Challenge type badge */}
            <div className="flex items-center gap-2">
              <LuminaBadge>
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </LuminaBadge>
            </div>

            {/* Instruction */}
            <p className="text-slate-200 text-base font-medium">{currentChallenge.instruction}</p>

            {/* Challenge content. Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above the
                workspace, and the workspace as one region, never a single choice. */}
            <PipDock />
            <PipWorkspace>
              {renderChallenge()}
            </PipWorkspace>

            {/* Hint */}
            {showHint && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/20 text-amber-300 text-sm">
                {currentChallenge.hint}
              </div>
            )}

          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const LengthLab = withWorkspaceOnly<LengthLabProps>('length-lab', LengthLabSurface, (props) => props.data.title);

export default LengthLab;
