import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { StoryMapMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaPanel,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaPrompt,
  LuminaSectionLabel,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaDropZone,
  type DropZoneState,
  answerStateClasses,
  accentChipBg,
  accentText,
  accentSoftBorder,
  accentSolidBg,
} from '../../../ui';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  CONFLICT_LABELS,
  conflictOptions,
  arcLabels as arcLabelsFor,
  asksConflict,
  characterChoices,
  describeStoryWork,
  eventBank,
  settingChoices,
  storyMapCorrect,
  storyMapItems,
  storyMapMiss,
  workspaceAssignment,
  workspaceScene,
  type StoryMapItem,
  type StoryMapView,
} from './storyMapWorkspace';
import {
  ARROW_LEVER,
  CONFLICT_PICTURES,
  CONFLICT_PICTURES_LEVER,
  COUNT_LEVER,
  PARTS_LEVER,
  PRACTICE_NOTE,
  partPicture,
  practiceAssignment,
  practiceFor,
  storyMapLeverFacts,
  storyMapLevers,
  type PracticeStory,
} from './storyMapLevers';

// =============================================================================
// Type Definitions
// =============================================================================

export interface StoryMapData {
  title: string;
  gradeLevel: string;
  structureType: 'bme' | 'story-mountain' | 'plot-diagram' | 'heros-journey';

  // The story/passage for analysis
  passage: {
    title: string;
    text: string;
    author?: string;
  };

  // Story elements to identify
  elements: {
    characters: Array<{
      name: string;
      description: string;
      role: 'protagonist' | 'antagonist' | 'supporting';
    }>;
    setting: { place: string; time: string; description: string };
    conflict?: {
      type:
        | 'person-vs-person'
        | 'person-vs-self'
        | 'person-vs-nature'
        | 'person-vs-society';
      description: string;
    };
  };

  // Events to place on the arc (in correct order)
  events: Array<{
    id: string;
    text: string;
    arcPosition:
      | 'beginning'
      | 'rising-action'
      | 'climax'
      | 'falling-action'
      | 'resolution';
    order: number;
  }>;

  // Support-tier stamps (generator-owned; medium/hard may ship validated
  // distractor character names that never appear in the passage)
  supportTier?: 'easy' | 'medium' | 'hard';
  distractorCharacters?: string[];

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: PrimitiveEvaluationResult
  ) => void;
}

interface StoryMapProps {
  data: StoryMapData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

type Phase = 'identify' | 'sequence' | 'analyze';

type ArcPosition =
  | 'beginning'
  | 'rising-action'
  | 'climax'
  | 'falling-action'
  | 'resolution';

interface PlacedEvent {
  eventId: string;
  arcPosition: ArcPosition;
}

// =============================================================================
// Constants
// =============================================================================

// Role chips use the shared accent palette: protagonist→emerald,
// antagonist→rose, supporting→blue.
const ROLE_ACCENT: Record<string, 'emerald' | 'rose' | 'blue'> = {
  protagonist: 'emerald',
  antagonist: 'rose',
  supporting: 'blue',
};

// =============================================================================
// SVG Story Arc Components  (bespoke interaction-surface canvas — left intact)
// =============================================================================

function BMEArc({
  placedEvents,
  events,
  activeDropZone,
  isChecked,
}: {
  placedEvents: PlacedEvent[];
  events: StoryMapData['events'];
  activeDropZone: ArcPosition | null;
  isChecked: boolean;
}) {
  const width = 720;
  const height = 200;
  const sectionWidth = width / 3;

  const zones: { key: ArcPosition; label: string; x: number }[] = [
    { key: 'beginning', label: 'Beginning', x: 0 },
    { key: 'climax', label: 'Middle', x: sectionWidth },
    { key: 'resolution', label: 'End', x: sectionWidth * 2 },
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      style={{ maxHeight: '200px' }}
    >
      <defs>
        <linearGradient id="bme-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Background bar */}
      <rect
        x="10"
        y="60"
        width={width - 20}
        height="80"
        rx="12"
        fill="url(#bme-gradient)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />

      {/* Section dividers */}
      {[1, 2].map((i) => (
        <line
          key={i}
          x1={sectionWidth * i}
          y1="60"
          x2={sectionWidth * i}
          y2="140"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      ))}

      {/* Zone labels and drop indicators */}
      {zones.map((zone) => {
        const centerX = zone.x + sectionWidth / 2;
        const isActive = activeDropZone === zone.key;
        const eventsHere = placedEvents.filter(
          (pe) => pe.arcPosition === zone.key
        );
        const hasEvent = eventsHere.length > 0;

        let correctness: boolean | null = null;
        if (isChecked && hasEvent) {
          const placedEvent = eventsHere[0];
          const eventData = events.find((e) => e.id === placedEvent.eventId);
          if (eventData) {
            correctness = eventData.arcPosition === zone.key;
          }
        }

        return (
          <g key={zone.key}>
            {/* Label */}
            <text
              x={centerX}
              y="45"
              textAnchor="middle"
              fill={isActive ? '#a78bfa' : '#94a3b8'}
              fontSize="13"
              fontWeight="600"
            >
              {zone.label}
            </text>

            {/* Active highlight */}
            {isActive && (
              <rect
                x={zone.x + 15}
                y="65"
                width={sectionWidth - 30}
                height="70"
                rx="8"
                fill="rgba(139, 92, 246, 0.15)"
                stroke="rgba(139, 92, 246, 0.4)"
                strokeWidth="2"
                strokeDasharray="6,3"
              />
            )}

            {/* Placed event indicator */}
            {hasEvent && (
              <circle
                cx={centerX}
                cy="100"
                r="12"
                fill={
                  correctness === true
                    ? 'rgba(16,185,129,0.3)'
                    : correctness === false
                    ? 'rgba(239,68,68,0.3)'
                    : 'rgba(139,92,246,0.3)'
                }
                stroke={
                  correctness === true
                    ? '#10b981'
                    : correctness === false
                    ? '#ef4444'
                    : '#a78bfa'
                }
                strokeWidth="2"
              />
            )}

            {/* Event count number */}
            {hasEvent && (
              <text
                x={centerX}
                y="105"
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="12"
                fontWeight="bold"
              >
                {eventsHere.length}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function StoryMountainArc({
  placedEvents,
  events,
  activeDropZone,
  isChecked,
}: {
  placedEvents: PlacedEvent[];
  events: StoryMapData['events'];
  activeDropZone: ArcPosition | null;
  isChecked: boolean;
}) {
  const width = 720;
  const height = 280;

  // Mountain path points
  const mountainPath = `
    M 30,240
    L 120,200
    L 250,130
    L 360,50
    L 470,130
    L 580,200
    L 690,240
  `;

  // Fill path (closed)
  const fillPath = `
    M 30,240
    L 120,200
    L 250,130
    L 360,50
    L 470,130
    L 580,200
    L 690,240
    Z
  `;

  // Zone positions for drop zones (x, y coordinates on the mountain)
  const zonePositions: {
    key: ArcPosition;
    label: string;
    x: number;
    y: number;
    labelY: number;
  }[] = [
    { key: 'beginning', label: 'Introduction', x: 75, y: 220, labelY: 260 },
    { key: 'rising-action', label: 'Rising Action', x: 185, y: 165, labelY: 115 },
    { key: 'climax', label: 'Climax', x: 360, y: 50, labelY: 25 },
    { key: 'falling-action', label: 'Falling Action', x: 525, y: 165, labelY: 115 },
    { key: 'resolution', label: 'Resolution', x: 635, y: 220, labelY: 260 },
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      style={{ maxHeight: '280px' }}
    >
      <defs>
        <linearGradient
          id="mountain-gradient"
          x1="0%"
          y1="100%"
          x2="50%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.05" />
          <stop
            offset="50%"
            stopColor="rgb(139, 92, 246)"
            stopOpacity="0.2"
          />
          <stop
            offset="100%"
            stopColor="rgb(99, 102, 241)"
            stopOpacity="0.05"
          />
        </linearGradient>
      </defs>

      {/* Mountain fill */}
      <path
        d={fillPath}
        fill="url(#mountain-gradient)"
      />

      {/* Mountain outline */}
      <path
        d={mountainPath}
        fill="none"
        stroke="rgba(139, 92, 246, 0.4)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Zone labels and drop indicators */}
      {zonePositions.map((zone) => {
        const isActive = activeDropZone === zone.key;
        const eventsHere = placedEvents.filter(
          (pe) => pe.arcPosition === zone.key
        );
        const hasEvent = eventsHere.length > 0;

        let correctness: boolean | null = null;
        if (isChecked && hasEvent) {
          const placedEvent = eventsHere[0];
          const eventData = events.find((e) => e.id === placedEvent.eventId);
          if (eventData) {
            correctness = eventData.arcPosition === zone.key;
          }
        }

        return (
          <g key={zone.key}>
            {/* Label */}
            <text
              x={zone.x}
              y={zone.labelY}
              textAnchor="middle"
              fill={isActive ? '#a78bfa' : '#64748b'}
              fontSize="11"
              fontWeight="500"
            >
              {zone.label}
            </text>

            {/* Drop zone circle */}
            <circle
              cx={zone.x}
              cy={zone.y}
              r={isActive ? 22 : 18}
              fill={
                isActive
                  ? 'rgba(139, 92, 246, 0.2)'
                  : hasEvent
                  ? correctness === true
                    ? 'rgba(16,185,129,0.2)'
                    : correctness === false
                    ? 'rgba(239,68,68,0.2)'
                    : 'rgba(139, 92, 246, 0.15)'
                  : 'rgba(100, 116, 139, 0.1)'
              }
              stroke={
                isActive
                  ? '#a78bfa'
                  : hasEvent
                  ? correctness === true
                    ? '#10b981'
                    : correctness === false
                    ? '#ef4444'
                    : '#a78bfa'
                  : 'rgba(100, 116, 139, 0.3)'
              }
              strokeWidth={isActive ? 2.5 : 1.5}
              strokeDasharray={isActive ? '6,3' : hasEvent ? 'none' : '4,3'}
              className="transition-all duration-200"
            />

            {/* Event count or slot number */}
            <text
              x={zone.x}
              y={zone.y + 5}
              textAnchor="middle"
              fill={hasEvent ? '#e2e8f0' : '#64748b'}
              fontSize={hasEvent ? '13' : '11'}
              fontWeight={hasEvent ? 'bold' : 'normal'}
            >
              {hasEvent ? eventsHere.length : '?'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// =============================================================================
// Main Component
// =============================================================================

const InvalidStoryMap = () => (
  <LuminaCard>
    <LuminaCardContent className="p-8">
      <h3 className="text-lg font-semibold text-rose-400 mb-2">Invalid Data</h3>
      <p className="text-slate-300">
        The story map received invalid data. Please regenerate the content.
      </p>
    </LuminaCardContent>
  </LuminaCard>
);

type StoryMapSurfaceProps = StoryMapProps & {
  tutorOwned: boolean;
  useController: (options: ProgressOptions<StoryMapItem>) => Progress;
};

const StoryMapSurface = (props: StoryMapSurfaceProps) => {
  const { data } = props;
  // Defensive check
  if (!data || !data.events || !Array.isArray(data.events) || data.events.length === 0) return <InvalidStoryMap />;
  return <StoryMapBoard {...props} />;
};

const StoryMapBoard = ({ data, className = '', runtimePlanItemId, tutorOwned, useController }: StoryMapSurfaceProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [startTime] = useState(Date.now());
  const [scriptedPhase, setPhase] = useState<Phase>('identify');
  const [showPassage, setShowPassage] = useState(true);

  // Phase 1: Identify state
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [selectedSetting, setSelectedSetting] = useState<string | null>(null);
  const [phase1Checked, setPhase1Checked] = useState(false);

  // Phase 2: Sequence state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [placedEvents, setPlacedEvents] = useState<PlacedEvent[]>([]);
  const [activeDropZone, setActiveDropZone] = useState<ArcPosition | null>(null);
  const [phase2Checked, setPhase2Checked] = useState(false);
  const [showZoneFlash, setShowZoneFlash] = useState(false);
  const zoneFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (zoneFlashTimer.current) clearTimeout(zoneFlashTimer.current);
    },
    [],
  );

  // Phase 3: Analyze state
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [phase3Checked, setPhase3Checked] = useState(false);

  // General state
  const [attemptsCount, setAttemptsCount] = useState(0);

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const stableInstanceId = useRef(instanceId || `story-map-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // Initialize evaluation hook
  const { submitResult, hasSubmitted, resetAttempt } =
    usePrimitiveEvaluation<StoryMapMetrics>({
      primitiveType: 'story-map',
      instanceId: resolvedInstanceId,
      skillId,
      subskillId,
      objectiveId,
      exhibitId,
      onSubmit: onEvaluationSubmit,
    });

  // ── Progress. Each phase is one checked item; on the workspace path the runtime moves the index. ──
  const items = useMemo(() => storyMapItems(data), [data]);
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (item) => workspaceAssignment(item, data),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  const sessionItem: StoryMapItem | undefined = tutorOwned ? items[progress.currentIndex] : items.find((i) => i.id === scriptedPhase);
  const phase: Phase = tutorOwned ? (sessionItem?.id ?? items[items.length - 1].id) : scriptedPhase;
  const workspaceDone = tutorOwned && progress.isComplete;

  // In-item levers (`storyMapLevers.ts`), keyed by the phase they were pulled on, and the shorter practice story a
  // simplify lever puts in place of this one until the observer returns to it. `shown` is the story on screen.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PracticeStory | null>(null);
  const shown: PracticeStory = practice ?? data;
  const pulledLevers = !practice && sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  const itemLevers = tutorOwned && !practice && !workspaceDone ? storyMapLevers(sessionItem, data, pulledLevers) : [];
  /** A help lever is drawn on the session story while pulled, never on a practice story. */
  const helpOn = (id: string) => itemLevers.some((l) => l.id === id && l.kind === 'help' && l.pulled);

  // Arc labels for the structure type
  const arcLabels = useMemo(() => arcLabelsFor(shown), [shown]);

  // The event bank, never in story order (`eventBank`).
  const shuffledEvents = useMemo(() => eventBank(shown), [shown]);

  // The printed character names: the story's characters and, at the medium and hard tiers, names not in it.
  const characterOptions = useMemo(() => characterChoices(shown), [shown]);

  // The printed settings: the story's own and two that fit no story here.
  const settingOptions = useMemo(() => settingChoices(shown), [shown]);

  // Compute unplaced events
  const unplacedEvents = useMemo(() => {
    const placedIds = new Set(placedEvents.map((pe) => pe.eventId));
    return shuffledEvents.filter((e) => !placedIds.has(e.id));
  }, [shuffledEvents, placedEvents]);

  // Grades 4+ with a conflict add the analyze phase
  const showConflictPhase = asksConflict(data);

  // The learner's work as the check and the tutor read it.
  const view: StoryMapView = {
    selectedCharacters: characterOptions.map((c) => c.name).filter((n) => selectedCharacters.has(n)),
    selectedSetting,
    placed: Object.fromEntries(placedEvents.map((pe) => [pe.eventId, pe.arcPosition])),
    selectedConflict,
    marked: phase2Checked
      ? {
          right: placedEvents.filter((pe) => shown.events.find((e) => e.id === pe.eventId)?.arcPosition === pe.arcPosition).map((pe) => pe.eventId),
          wrong: placedEvents.filter((pe) => shown.events.find((e) => e.id === pe.eventId)?.arcPosition !== pe.arcPosition).map((pe) => pe.eventId),
        }
      : null,
  };

  /** The activity's check of the open phase: counts the attempt and, on the workspace path, commits it with its miss. */
  const commitPhase = (id: Phase): boolean => {
    const item = { id } as StoryMapItem;
    const correct = storyMapCorrect(item, shown, view);
    progress.commitCheck(describeStoryWork(item, shown, view), correct, correct ? undefined : storyMapMiss(item, shown, view));
    return correct;
  };

  // Phase helpers
  const isPhaseComplete = (p: Phase): boolean => {
    if (tutorOwned) return progress.results.some((r) => r.challengeId === p && r.correct);
    switch (p) {
      case 'identify':
        return phase1Checked;
      case 'sequence':
        return phase2Checked;
      case 'analyze':
        return phase3Checked;
      default:
        return false;
    }
  };

  // ============================================================================
  // Phase clearing (a fresh item, or Try again on the workspace path)
  // ============================================================================

  const clearIdentify = () => {
    setSelectedCharacters(new Set());
    setSelectedSetting(null);
    setPhase1Checked(false);
  };
  const clearSequence = () => {
    setPhase2Checked(false);
    setShowZoneFlash(false);
    if (zoneFlashTimer.current) {
      clearTimeout(zoneFlashTimer.current);
      zoneFlashTimer.current = null;
    }
    setPlacedEvents([]);
    setSelectedEventId(null);
    setActiveDropZone(null);
  };
  const clearAnalyze = () => {
    setSelectedConflict(null);
    setPhase3Checked(false);
  };
  // Only the opened phase's own work is cleared: the earlier phases' answers stay for the record.
  const clearPhase = (id: Phase | undefined) => {
    if (id === 'identify') clearIdentify();
    else if (id === 'sequence') clearSequence();
    else if (id === 'analyze') clearAnalyze();
  };
  // Try again keeps a practice story; a fresh item, or the full story back after practice, drops it.
  openItem.current = (index, retry) => {
    clearPhase(items[index]?.id);
    if (!retry) setPractice(null);
  };

  // ============================================================================
  // Phase 1: Identify Handlers
  // ============================================================================

  const toggleCharacter = (name: string) => {
    if (phase1Checked || learnerBlocked()) return;
    setSelectedCharacters((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectSetting = (id: string) => {
    if (phase1Checked || learnerBlocked()) return;
    setSelectedSetting(id);
  };

  const checkPhase1 = () => {
    if (learnerBlocked()) return;
    setPhase1Checked(true);
    setAttemptsCount((prev) => prev + 1);
    const correct = commitPhase('identify');

    if (correct) {
      SoundManager.playCorrect();
      // Scripted path: auto-advance to phase 2. The workspace's runtime moves on from the committed check.
      if (!tutorOwned) setTimeout(() => setPhase('sequence'), 1200);
    } else {
      SoundManager.playIncorrect();
    }
  };

  // ============================================================================
  // Phase 2: Sequence Handlers
  // ============================================================================

  const handleEventClick = (eventId: string) => {
    if (hasSubmitted || phase2Checked || learnerBlocked()) return;
    setSelectedEventId(selectedEventId === eventId ? null : eventId);
  };

  const handleArcZoneClick = (zoneKey: ArcPosition) => {
    if (hasSubmitted || phase2Checked || learnerBlocked()) return;

    if (selectedEventId) {
      SoundManager.snap();
      // Place event on arc
      const alreadyPlaced = placedEvents.find(
        (pe) => pe.eventId === selectedEventId
      );
      if (alreadyPlaced) {
        // Move to new position
        setPlacedEvents((prev) =>
          prev.map((pe) =>
            pe.eventId === selectedEventId
              ? { ...pe, arcPosition: zoneKey }
              : pe
          )
        );
      } else {
        setPlacedEvents((prev) => [
          ...prev,
          { eventId: selectedEventId, arcPosition: zoneKey },
        ]);
      }
      setSelectedEventId(null);
      setActiveDropZone(null);
    } else {
      // Check if there's an event in this zone to select for moving
      const eventsInZone = placedEvents.filter(
        (pe) => pe.arcPosition === zoneKey
      );
      if (eventsInZone.length > 0) {
        // Select the last event placed in this zone
        setSelectedEventId(eventsInZone[eventsInZone.length - 1].eventId);
      }
    }
  };

  const handleRemoveEvent = (eventId: string) => {
    if (hasSubmitted || phase2Checked || learnerBlocked()) return;
    setPlacedEvents((prev) => prev.filter((pe) => pe.eventId !== eventId));
  };

  const checkPhase2 = () => {
    if (learnerBlocked()) return;
    setPhase2Checked(true);
    setAttemptsCount((prev) => prev + 1);

    if (zoneFlashTimer.current) clearTimeout(zoneFlashTimer.current);
    setShowZoneFlash(true);
    zoneFlashTimer.current = setTimeout(() => setShowZoneFlash(false), 900);

    const correct = commitPhase('sequence');

    if (correct) {
      SoundManager.playCorrect();
      if (tutorOwned) return;
      if (showConflictPhase) {
        setTimeout(() => setPhase('analyze'), 1200);
      } else {
        // Submit evaluation
        handleFinalSubmit();
      }
    } else {
      SoundManager.playIncorrect();
    }
  };

  // ============================================================================
  // Phase 3: Analyze Handlers
  // ============================================================================

  const selectConflictType = (type: string) => {
    if (phase3Checked || learnerBlocked()) return;
    setSelectedConflict(type);
  };

  const checkPhase3 = () => {
    if (learnerBlocked()) return;
    setPhase3Checked(true);
    setAttemptsCount((prev) => prev + 1);
    const correct = commitPhase('analyze');
    if (correct) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    // Scripted path: the analysis is the last step either way. The workspace path reopens a miss.
    if (!tutorOwned) handleFinalSubmit();
  };

  // ============================================================================
  // Final Submission
  // ============================================================================

  const buildMetrics = (totalAttempts: number, overallAccuracy?: number): { metrics: StoryMapMetrics; overallSuccess: boolean; totalScore: number } => {
    const completionTime = Date.now() - startTime;
    const realNames = data.elements.characters.map((c) => c.name);

    // Phase 1 metrics
    const charactersCorrect = realNames.every((n) => selectedCharacters.has(n))
      && selectedCharacters.size === realNames.length;
    const settingCorrect = selectedSetting === 'correct';

    // Phase 2 metrics
    let eventsCorrectCount = 0;
    const eventResults: StoryMapMetrics['eventPlacementResults'] = [];
    placedEvents.forEach((pe) => {
      const eventData = data.events.find((e) => e.id === pe.eventId);
      if (eventData) {
        const correct = eventData.arcPosition === pe.arcPosition;
        if (correct) eventsCorrectCount++;
        eventResults.push({
          eventId: pe.eventId,
          placedPosition: pe.arcPosition,
          correctPosition: eventData.arcPosition,
          isCorrect: correct,
        });
      }
    });

    const allEventsPlaced = placedEvents.length === data.events.length;
    const allEventsCorrect =
      allEventsPlaced && eventsCorrectCount === data.events.length;

    // Phase 3 metrics
    const conflictCorrect = data.elements.conflict
      ? selectedConflict === data.elements.conflict.type
      : true;

    // Overall score
    const identifyScore = (charactersCorrect ? 50 : 0) + (settingCorrect ? 50 : 0);
    const sequenceScore = allEventsPlaced
      ? (eventsCorrectCount / data.events.length) * 100
      : 0;
    const analyzeScore = showConflictPhase ? (conflictCorrect ? 100 : 0) : 100;

    // Weighted score
    const weights = showConflictPhase
      ? { identify: 0.25, sequence: 0.5, analyze: 0.25 }
      : { identify: 0.3, sequence: 0.7, analyze: 0 };

    const totalScore = overallAccuracy ?? Math.round(
      identifyScore * weights.identify +
        sequenceScore * weights.sequence +
        analyzeScore * weights.analyze
    );

    const overallSuccess =
      charactersCorrect &&
      settingCorrect &&
      allEventsCorrect &&
      conflictCorrect;

    const metrics: StoryMapMetrics = {
      type: 'story-map',
      structureType: data.structureType,
      gradeLevel: data.gradeLevel,

      // Phase 1
      charactersIdentified: selectedCharacters.size,
      totalCharacters: realNames.length,
      charactersCorrect,
      settingCorrect,
      identifyPhaseComplete: tutorOwned ? isPhaseComplete('identify') : phase1Checked,

      // Phase 2
      totalEvents: data.events.length,
      eventsPlaced: placedEvents.length,
      eventsCorrectlyPlaced: eventsCorrectCount,
      allEventsCorrect,
      sequencePhaseComplete: tutorOwned ? isPhaseComplete('sequence') : phase2Checked,
      eventPlacementResults: eventResults,

      // Phase 3
      conflictTypeCorrect: conflictCorrect,
      selectedConflictType: selectedConflict || undefined,
      correctConflictType: data.elements.conflict?.type,
      analyzePhaseComplete: showConflictPhase ? (tutorOwned ? isPhaseComplete('analyze') : phase3Checked) : true,

      // Overall
      totalAttempts,
      completionTimeMs: completionTime,
      overallAccuracy: totalScore,
    };
    return { metrics, overallSuccess, totalScore };
  };

  const studentWork = () => ({
    selectedCharacters: Array.from(selectedCharacters),
    selectedSetting,
    placedEvents,
    selectedConflict,
  });

  /** Scripted path: one submission for the whole map. */
  const handleFinalSubmit = () => {
    if (hasSubmitted || tutorOwned) return;
    const { metrics, overallSuccess, totalScore } = buildMetrics(attemptsCount + 1);
    submitResult(overallSuccess, totalScore, metrics, { studentWork: studentWork() });
  };

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const { metrics } = buildMetrics(result.attemptsCount, result.accuracy);
    submitResult(result.passed, result.accuracy, metrics,
      { studentWork: studentWork(), challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ============================================================================
  // Reset (scripted path)
  // ============================================================================

  const handleReset = () => {
    setPhase('identify');
    setShowPassage(true);
    clearIdentify();
    clearSequence();
    clearAnalyze();
    setAttemptsCount(0);
    resetAttempt();
  };

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !sessionItem || workspaceDone) return;
    const scene = workspaceScene(sessionItem, shown, view);
    const levers = itemLevers;
    const onScreen = practice ? ''
      : storyMapLeverFacts(sessionItem, data, levers.filter((l) => l.kind === 'help' && l.pulled).map((l) => l.id));
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this part of the story map.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceFor(sessionItem, data);
          if (!easier) return 'There is no shorter practice story for this part.';
          setLeverState(next); setPractice(easier); clearPhase(sessionItem.id);
          return { practice: practiceAssignment(sessionItem, easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full story, blank: the practice story is not the learner's work on it.
      endPractice: () => { setPractice(null); clearPhase(sessionItem.id); },
    };
  });

  // ============================================================================
  // Render
  // ============================================================================

  const phaseSteps = showConflictPhase
    ? [
        { key: 'identify' as Phase, label: '1. Identify', activeLabel: 'Identify Characters & Setting' },
        { key: 'sequence' as Phase, label: '2. Sequence', activeLabel: 'Place Events on the Story Arc' },
        { key: 'analyze' as Phase, label: '3. Analyze', activeLabel: 'Identify the Conflict' },
      ]
    : [
        { key: 'identify' as Phase, label: '1. Identify', activeLabel: 'Identify Characters & Setting' },
        { key: 'sequence' as Phase, label: '2. Sequence', activeLabel: 'Place Events on the Story Arc' },
      ];

  const currentPhaseLabel = phaseSteps.find((ps) => ps.key === phase)?.activeLabel || '';

  // Phase success conditions (reused by feedback + advance buttons), from the activity's own check.
  const phase1Success = storyMapCorrect({ id: 'identify' }, shown, view);
  const phase2Success = storyMapCorrect({ id: 'sequence' }, shown, view);
  const phase3Success = storyMapCorrect({ id: 'analyze' }, shown, view);
  const finished = hasSubmitted || workspaceDone;

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: instanceId || 'story-map',
    scopeId: finished ? null : phase,
    label: 'The story and the story map',
    solved: phase === 'identify' ? phase1Checked && phase1Success : phase === 'sequence' ? phase2Checked && phase2Success : phase3Checked && phase3Success,
    tutorSpeaking: false,
  });

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <LuminaCardTitle className="text-2xl">{data.title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue">{data.gradeLevel}</LuminaBadge>
            <LuminaBadge accent="purple">
              {data.structureType === 'bme'
                ? 'Beginning-Middle-End'
                : data.structureType === 'story-mountain'
                ? 'Story Mountain'
                : data.structureType === 'plot-diagram'
                ? 'Plot Diagram'
                : "Hero's Journey"}
            </LuminaBadge>
          </div>
        </div>

        {/* Phase Progress Indicator */}
        <div className="flex items-center gap-2 mt-4">
          {phaseSteps.map((step, idx) => {
            const isActive = phase === step.key && !finished;
            const isComplete = isPhaseComplete(step.key);
            const pillAccent: 'blue' | 'emerald' | null = isActive
              ? 'blue'
              : isComplete
              ? 'emerald'
              : null;

            return (
              <React.Fragment key={step.key}>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
                    pillAccent
                      ? `${accentChipBg[pillAccent]} ${accentText[pillAccent]} ${accentSoftBorder[pillAccent]}`
                      : 'bg-black/20 text-slate-500 border-white/10'
                  }`}
                >
                  {isComplete && (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {step.label}
                </div>
                {idx < phaseSteps.length - 1 && (
                  <div
                    className={`h-px w-6 ${
                      isComplete ? accentSolidBg.emerald : 'bg-white/10'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-6">
        {/* Phase Instructions */}
        {!workspaceDone && (
        <LuminaPrompt accent="blue">
          <p className="text-sm text-blue-200 font-medium">{currentPhaseLabel}</p>
          <p className="text-xs text-slate-400 mt-1">
            {phase === 'identify' &&
              'Read the passage below, then select all the characters and the correct setting.'}
            {phase === 'sequence' &&
              'Click an event card, then click a position on the story arc to place it.'}
            {phase === 'analyze' &&
              'Based on the story, select the type of conflict the main character faces.'}
          </p>
        </LuminaPrompt>
        )}

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !finished && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-6">
        {/* Passage Section */}
        <div>
          <LuminaButton
            onClick={() => setShowPassage(!showPassage)}
            className="mb-2 text-sm"
          >
            {showPassage ? 'Hide' : 'Show'} Passage
            <svg
              className={`w-4 h-4 ml-1 transition-transform ${
                showPassage ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </LuminaButton>

          {practice && (
            <p className="text-xs text-amber-300 mb-1" data-practice>Practice story</p>
          )}
          {showPassage && (
            <LuminaPanel>
              {/* Passage body — the reading surface; text kept bespoke. */}
              <h4 className="text-base font-semibold text-slate-100 mb-1">
                {shown.passage.title}
              </h4>
              {shown.passage.author && (
                <p className="text-xs text-slate-500 mb-3">
                  by {shown.passage.author}
                </p>
              )}
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {shown.passage.text}
              </p>
            </LuminaPanel>
          )}
        </div>

        {/* ================================================================== */}
        {/* Phase 1: Identify Characters & Setting */}
        {/* ================================================================== */}
        {phase === 'identify' && !workspaceDone && (
          <div className="space-y-5">
            {/* Characters */}
            <div>
              <LuminaSectionLabel accent="blue" size="sm" className="mb-3">
                Who are the characters?{' '}
                <span className="text-slate-500 normal-case font-normal">
                  (Select all)
                </span>
              </LuminaSectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {characterOptions.map((char) => {
                  const isSelected = selectedCharacters.has(char.name);
                  // Only a correct check grades the tiles: a miss marks nothing, so it never shows which names
                  // are characters (Try again clears the picks).
                  const solved = phase1Checked && phase1Success;

                  // Graded selection tile — use the shared answer-state colors.
                  const stateClass = isSelected
                    ? solved
                      ? answerStateClasses.correct
                      : answerStateClasses.selected
                    : answerStateClasses.idle;

                  return (
                    <button
                      type="button"
                      key={char.name}
                      aria-label={char.name}
                      aria-pressed={isSelected}
                      onClick={() => toggleCharacter(char.name)}
                      className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${stateClass} ${
                        phase1Checked ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-100">
                          {char.name}
                        </span>
                        {solved && isSelected && (
                          <svg
                            className="w-4 h-4 text-emerald-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      {/* A character's description and role print once the picks are right: printed before,
                          they would mark which names are in the story. */}
                      {solved && char.description && (
                        <p className="text-xs text-slate-400">{char.description}</p>
                      )}
                      {solved && char.role && (
                        <LuminaBadge
                          accent={ROLE_ACCENT[char.role]}
                          className="mt-2 text-xs"
                        >
                          {char.role}
                        </LuminaBadge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* The help lever `character_count`: one empty person space per character, filled one per pick. It counts
                picks and never marks which names. */}
            {helpOn(COUNT_LEVER) && (
              <div data-lever="character-count" aria-label="Character spaces" className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">Characters in this story:</span>
                {data.elements.characters.map((_, i) => (
                  <span
                    key={i}
                    data-lever="character-space"
                    data-filled={i < selectedCharacters.size ? 'true' : 'false'}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-lg ${
                      i < selectedCharacters.size ? 'border-violet-400 bg-violet-500/20' : 'border-dashed border-white/20'
                    }`}
                  >
                    <span aria-hidden="true" className={i < selectedCharacters.size ? '' : 'opacity-30'}>🧍</span>
                  </span>
                ))}
                {selectedCharacters.size > data.elements.characters.length && (
                  <span className="text-xs text-amber-300">More picks than spaces</span>
                )}
              </div>
            )}

            {/* Setting */}
            <div>
              <LuminaSectionLabel accent="blue" size="sm" className="mb-3">
                Where and when does the story take place?
              </LuminaSectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {settingOptions.map((opt) => {
                  const isSelected = selectedSetting === opt.id;
                  const solved = phase1Checked && phase1Success;

                  // Graded single-select option — shared answer-state colors, only once the picks are right.
                  const stateClass = isSelected
                    ? solved
                      ? answerStateClasses.correct
                      : answerStateClasses.selected
                    : answerStateClasses.idle;

                  return (
                    <button
                      type="button"
                      key={opt.id}
                      aria-label={opt.text}
                      aria-pressed={isSelected}
                      onClick={() => selectSetting(opt.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${stateClass} ${
                        phase1Checked ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <span className="text-sm text-slate-200">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
              {phase1Checked && phase1Success && (
                <p className="mt-2 text-xs text-slate-400">
                  {shown.elements.setting.description}
                </p>
              )}
            </div>

            {/* Phase 1 Check Button */}
            {!phase1Checked && (
              <LuminaActionButton
                action="check"
                onClick={checkPhase1}
                disabled={
                  selectedCharacters.size === 0 || selectedSetting === null || (tutorOwned && progress.canAttempt === false)
                }
              >
                Check Answers
              </LuminaActionButton>
            )}

            {/* Phase 1 result feedback */}
            {phase1Checked && (
              <div className="space-y-2">
                {phase1Success ? (
                  <LuminaFeedbackCard status="correct">
                    Great job! You identified all the characters and the setting
                    correctly.
                  </LuminaFeedbackCard>
                ) : (
                  <LuminaFeedbackCard status="incorrect">
                    Not quite right. Look at the passage again carefully.
                    {/* The workspace's Try again is on the shell. */}
                    {!tutorOwned && (
                      <div className="mt-3">
                        <LuminaActionButton action="retry" onClick={clearIdentify} />
                      </div>
                    )}
                  </LuminaFeedbackCard>
                )}
              </div>
            )}

            {/* Manual advance button (if they got it right; scripted path) */}
            {phase1Checked && phase1Success && !tutorOwned && (
              <LuminaActionButton
                action="next"
                onClick={() => setPhase('sequence')}
              >
                Continue to Sequencing →
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Phase 2: Sequence Events on Arc */}
        {/* ================================================================== */}
        {phase === 'sequence' && !workspaceDone && (
          <div className="space-y-5">
            {/* Story Arc SVG — bespoke interaction-surface canvas. */}
            <LuminaPanel className="overflow-hidden">
              {shown.structureType === 'bme' ? (
                <BMEArc
                  placedEvents={placedEvents}
                  events={shown.events}
                  activeDropZone={activeDropZone}
                  isChecked={phase2Checked}
                />
              ) : (
                <StoryMountainArc
                  placedEvents={placedEvents}
                  events={shown.events}
                  activeDropZone={activeDropZone}
                  isChecked={phase2Checked}
                />
              )}
            </LuminaPanel>

            {/* Arc Drop Zones (bespoke click-to-place placement targets) */}
            <div>
              <LuminaSectionLabel accent="blue" size="sm" className="mb-3">
                Story Arc Positions
              </LuminaSectionLabel>
              {/* The help lever `arc_arrow`: which way the story runs along the parts, drawn on no event. */}
              {helpOn(ARROW_LEVER) && (
                <div data-lever="arc-arrow" aria-label="Story starts to story ends" className="mb-2 flex items-center gap-2 text-xs text-sky-300">
                  <span aria-hidden="true">🚩</span>
                  <span>Story starts</span>
                  <span aria-hidden="true" className="h-0.5 flex-1 bg-gradient-to-r from-sky-400/60 to-sky-300" />
                  <span aria-hidden="true">➜</span>
                  <span>Story ends</span>
                </div>
              )}
              <div
                className={`grid gap-2 ${
                  shown.structureType === 'bme'
                    ? 'grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                }`}
              >
                {arcLabels.map((zone) => {
                  const eventsInZone = placedEvents.filter(
                    (pe) => pe.arcPosition === zone.key
                  );
                  const isActive = activeDropZone === zone.key;
                  const zoneIsCorrect =
                    eventsInZone.length > 0 &&
                    eventsInZone.every((pe) => {
                      const eventData = shown.events.find(
                        (event) => event.id === pe.eventId,
                      );
                      return eventData?.arcPosition === zone.key;
                    });
                  const zoneState: DropZoneState =
                    isActive && selectedEventId
                      ? 'dragOver'
                      : showZoneFlash && phase2Checked && eventsInZone.length > 0
                      ? zoneIsCorrect
                        ? 'correct'
                        : 'incorrect'
                      : eventsInZone.length > 0
                      ? 'filled'
                      : 'idle';

                  return (
                    <div key={zone.key} className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {zone.label}
                      </span>
                      {/* The help lever `part_pictures`: what this part of any story does, never an event. */}
                      {helpOn(PARTS_LEVER) && (
                        <span data-lever="part-picture" className="text-center text-xs text-slate-300">
                          <span aria-hidden="true" className="mr-1 text-base">{partPicture(shown, zone.key).icon}</span>
                          {partPicture(shown, zone.key).words}
                        </span>
                      )}
                      <LuminaDropZone
                        state={zoneState}
                        emptyPrompt={
                          <span className="text-xs font-normal">
                            {selectedEventId ? 'Click to place' : 'Empty'}
                          </span>
                        }
                        role="button"
                        tabIndex={phase2Checked ? -1 : 0}
                        aria-disabled={phase2Checked}
                        aria-label={`${zone.label} story arc position`}
                        data-pip-object={`zone-${zone.key}`}
                        onClick={() => handleArcZoneClick(zone.key)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (
                            !phase2Checked &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            handleArcZoneClick(zone.key);
                          }
                        }}
                        onMouseEnter={() =>
                          selectedEventId ? setActiveDropZone(zone.key) : null
                        }
                        onMouseLeave={() => setActiveDropZone(null)}
                        className={`min-h-[80px] flex-col items-stretch p-3 text-center ${
                          phase2Checked ? 'cursor-default' : 'cursor-pointer'
                        }`}
                      >
                        {eventsInZone.length > 0 ? (
                        <div className="space-y-1 w-full">
                          {eventsInZone.map((pe) => {
                            const eventData = shown.events.find(
                              (e) => e.id === pe.eventId
                            );
                            const isCorrect =
                              phase2Checked &&
                              eventData &&
                              eventData.arcPosition === pe.arcPosition;
                            const isWrong =
                              phase2Checked &&
                              eventData &&
                              eventData.arcPosition !== pe.arcPosition;

                            // Graded placed-event chip — shared answer-state colors.
                            const chipClass = isCorrect
                              ? answerStateClasses.correct
                              : isWrong
                              ? answerStateClasses.incorrect
                              : answerStateClasses.idle;

                            return (
                              <div
                                key={pe.eventId}
                                className={`relative p-2 rounded text-xs text-left border ${chipClass}`}
                              >
                                <span className="line-clamp-2">
                                  {eventData?.text || pe.eventId}
                                </span>
                                {!phase2Checked && (
                                  <button
                                    type="button"
                                    aria-label={`Take off: ${eventData?.text ?? pe.eventId}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveEvent(pe.eventId);
                                    }}
                                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-700 text-slate-400 hover:text-white hover:bg-rose-500/50 flex items-center justify-center text-xs"
                                  >
                                    x
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        ) : null}
                      </LuminaDropZone>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Available Event Cards — bespoke selectable tokens to place. */}
            <div>
              <LuminaSectionLabel accent="blue" size="sm" className="mb-3">
                Event Cards{' '}
                <span className="text-slate-500 normal-case font-normal">
                  ({unplacedEvents.length} remaining)
                </span>
              </LuminaSectionLabel>
              {unplacedEvents.length === 0 ? (
                <div className="text-center py-4 text-emerald-400 text-sm">
                  <svg
                    className="w-6 h-6 mx-auto mb-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  All events placed!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unplacedEvents.map((event) => {
                    const isSelected = selectedEventId === event.id;
                    const eventStateClass = isSelected
                      ? answerStateClasses.selected
                      : answerStateClasses.idle;

                    return (
                      <button
                        type="button"
                        key={event.id}
                        aria-label={event.text}
                        aria-pressed={isSelected}
                        onClick={() => handleEventClick(event.id)}
                        className={`
                          p-3 rounded-lg border-2 text-left transition-all duration-200 ${eventStateClass}
                          ${phase2Checked ? 'cursor-default' : 'cursor-pointer'}
                        `}
                      >
                        <p className="text-sm text-slate-200">{event.text}</p>
                        {isSelected && (
                          <p className="text-xs text-violet-300 mt-2">
                            Now click a position on the story arc above
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Also show placed events that can be moved */}
              {placedEvents.length > 0 && unplacedEvents.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  Click an event already on the arc to select it, then click a
                  different position to move it.
                </p>
              )}
            </div>

            {/* Phase 2 Check Button */}
            {!phase2Checked && (
              <LuminaActionButton
                action="check"
                onClick={checkPhase2}
                disabled={placedEvents.length !== shown.events.length || (tutorOwned && progress.canAttempt === false)}
              >
                Check Sequence
              </LuminaActionButton>
            )}

            {/* Phase 2 result feedback */}
            {phase2Checked && (
              <div className="space-y-2">
                {phase2Success ? (
                  <LuminaFeedbackCard status="correct">
                    Perfect! You placed all events in the correct positions on
                    the story arc.
                  </LuminaFeedbackCard>
                ) : (
                  <LuminaFeedbackCard status="incorrect">
                    {view.marked?.right.length ?? 0} of {shown.events.length} events are in the right
                    place. Try again!
                    {/* The workspace's Try again is on the shell. */}
                    {!tutorOwned && (
                      <div className="mt-3">
                        <LuminaActionButton action="retry" onClick={clearSequence} />
                      </div>
                    )}
                  </LuminaFeedbackCard>
                )}
              </div>
            )}

            {/* Manual advance button (scripted path) */}
            {phase2Checked && showConflictPhase && phase2Success && !tutorOwned && (
              <LuminaActionButton
                action="next"
                onClick={() => setPhase('analyze')}
              >
                Continue to Analysis →
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Phase 3: Analyze (Conflict type) */}
        {/* ================================================================== */}
        {phase === 'analyze' && showConflictPhase && !workspaceDone && (
          <div className="space-y-5">
            <div>
              <LuminaSectionLabel accent="blue" size="sm" className="mb-3">
                What type of conflict does the main character face?
              </LuminaSectionLabel>
              {shown.elements.conflict && (
                <p className="text-sm text-slate-400 mb-4">
                  {shown.elements.conflict.description}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {conflictOptions(shown).map((type) => {
                  const label = CONFLICT_LABELS[type];
                  const isSelected = selectedConflict === type;
                  const showResult = phase3Checked;
                  const isCorrectAnswer = type === shown.elements.conflict?.type;
                  // The workspace reopens a miss, so a wrong check marks only the pick, never the answer.
                  const revealKey = !tutorOwned || phase3Success;

                  let choiceState:
                    | 'idle'
                    | 'selected'
                    | 'correct'
                    | 'incorrect'
                    | 'dimmed';
                  if (!showResult) {
                    choiceState = isSelected ? 'selected' : 'idle';
                  } else if (isCorrectAnswer && revealKey) {
                    choiceState = 'correct';
                  } else if (isSelected) {
                    choiceState = 'incorrect';
                  } else {
                    choiceState = 'dimmed';
                  }

                  return (
                    <LuminaAnswerChoice
                      key={type}
                      aria-label={label}
                      state={choiceState}
                      disabled={phase3Checked}
                      onClick={() => selectConflictType(type)}
                      className="p-4"
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {label}
                      </span>
                      {/* The help lever `conflict_pictures`: a picture on every choice, so none is marked. */}
                      {helpOn(CONFLICT_PICTURES_LEVER) && (
                        <span aria-hidden="true" data-lever="conflict-picture" className="mt-1 block text-xs text-slate-400">
                          <span className="mr-1 text-base">{CONFLICT_PICTURES[type].icon}</span>
                          {CONFLICT_PICTURES[type].words}
                        </span>
                      )}
                    </LuminaAnswerChoice>
                  );
                })}
              </div>
            </div>

            {/* Phase 3 Check Button */}
            {!phase3Checked && (
              <LuminaActionButton
                action="check"
                onClick={checkPhase3}
                disabled={selectedConflict === null || (tutorOwned && progress.canAttempt === false)}
              >
                Check Answer
              </LuminaActionButton>
            )}

            {/* Phase 3 result feedback */}
            {phase3Checked && (
              <div className="space-y-2">
                {phase3Success ? (
                  <LuminaFeedbackCard status="correct">
                    Correct! This is a{' '}
                    {CONFLICT_LABELS[shown.elements.conflict!.type]} conflict.
                  </LuminaFeedbackCard>
                ) : tutorOwned ? (
                  <LuminaFeedbackCard status="incorrect">
                    Not quite. Think about who or what the main character struggles against.
                  </LuminaFeedbackCard>
                ) : (
                  <LuminaFeedbackCard status="incorrect">
                    Not quite. The correct answer is{' '}
                    {shown.elements.conflict ? CONFLICT_LABELS[shown.elements.conflict.type] : ''}.
                  </LuminaFeedbackCard>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        </div>

        {/* Success / Final Section */}
        {/* ================================================================== */}
        {finished && (
          <LuminaFeedbackCard
            status="correct"
            label="Story Map Complete!"
          >
            You analyzed &quot;{data.passage.title}&quot; and mapped its story
            structure.
          </LuminaFeedbackCard>
        )}

        {/* Action Buttons (scripted path) */}
        {hasSubmitted && !tutorOwned && (
          <div className="flex gap-3">
            <LuminaActionButton action="retry" onClick={handleReset} />
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const StoryMap = withWorkspaceController<StoryMapProps, ProgressOptions<StoryMapItem>, Progress>(
  'story-map', StoryMapSurface, useScriptedProgress, useWorkspaceProgressFor('story-map'));

export default StoryMap;
