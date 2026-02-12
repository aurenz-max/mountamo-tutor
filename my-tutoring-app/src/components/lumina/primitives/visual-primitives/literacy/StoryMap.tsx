import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { StoryMapMetrics } from '../../../evaluation/types';

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

const ARC_LABELS_BME: { key: ArcPosition; label: string }[] = [
  { key: 'beginning', label: 'Beginning' },
  { key: 'climax', label: 'Middle' },
  { key: 'resolution', label: 'End' },
];

const ARC_LABELS_MOUNTAIN: { key: ArcPosition; label: string }[] = [
  { key: 'beginning', label: 'Introduction' },
  { key: 'rising-action', label: 'Rising Action' },
  { key: 'climax', label: 'Climax' },
  { key: 'falling-action', label: 'Falling Action' },
  { key: 'resolution', label: 'Resolution' },
];

const CONFLICT_LABELS: Record<string, string> = {
  'person-vs-person': 'Character vs. Character',
  'person-vs-self': 'Character vs. Self',
  'person-vs-nature': 'Character vs. Nature',
  'person-vs-society': 'Character vs. Society',
};

const ROLE_COLORS: Record<string, string> = {
  protagonist: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  antagonist: 'bg-red-500/20 text-red-300 border-red-500/30',
  supporting: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

// =============================================================================
// SVG Story Arc Components
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

const StoryMap: React.FC<StoryMapProps> = ({ data, className = '' }) => {
  // Defensive check
  if (!data || !data.events || !Array.isArray(data.events) || data.events.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-8">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Data</h3>
          <p className="text-slate-300">
            The story map received invalid data. Please regenerate the content.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [startTime] = useState(Date.now());
  const [phase, setPhase] = useState<Phase>('identify');
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

  // Initialize evaluation hook
  const { submitResult, hasSubmitted, resetAttempt } =
    usePrimitiveEvaluation<StoryMapMetrics>({
      primitiveType: 'story-map',
      instanceId: instanceId || `story-map-${Date.now()}`,
      skillId,
      subskillId,
      objectiveId,
      exhibitId,
      onSubmit: onEvaluationSubmit,
    });

  // Determine arc labels based on structure type
  const arcLabels = useMemo(() => {
    if (data.structureType === 'bme') return ARC_LABELS_BME;
    return ARC_LABELS_MOUNTAIN;
  }, [data.structureType]);

  // Create shuffled events for placing
  const [shuffledEvents] = useState(() =>
    [...data.events].sort(() => Math.random() - 0.5)
  );

  // Build character options (include all from data.elements plus 2 distractors by label)
  const characterOptions = useMemo(() => {
    return data.elements.characters.map((c) => ({
      name: c.name,
      role: c.role,
      description: c.description,
    }));
  }, [data.elements.characters]);

  // Build setting options - the correct one plus distractors from passage
  const settingOptions = useMemo(() => {
    const correct = data.elements.setting;
    const options = [
      {
        id: 'correct',
        text: `${correct.place} - ${correct.time}`,
        isCorrect: true,
      },
      {
        id: 'distractor-1',
        text: `An unknown city - Long ago`,
        isCorrect: false,
      },
      {
        id: 'distractor-2',
        text: `A spaceship - In the future`,
        isCorrect: false,
      },
    ];
    return options.sort(() => Math.random() - 0.5);
  }, [data.elements.setting]);

  // Compute unplaced events
  const unplacedEvents = useMemo(() => {
    const placedIds = new Set(placedEvents.map((pe) => pe.eventId));
    return shuffledEvents.filter((e) => !placedIds.has(e.id));
  }, [shuffledEvents, placedEvents]);

  // Determine if grades 4+ show conflict phase
  const showConflictPhase = useMemo(() => {
    const grade = parseInt(data.gradeLevel.replace(/[^0-9]/g, ''), 10);
    return grade >= 4 && !!data.elements.conflict;
  }, [data.gradeLevel, data.elements.conflict]);

  // Phase helpers
  const isPhaseComplete = (p: Phase): boolean => {
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
  // Phase 1: Identify Handlers
  // ============================================================================

  const toggleCharacter = (name: string) => {
    if (phase1Checked) return;
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
    if (phase1Checked) return;
    setSelectedSetting(id);
  };

  const checkPhase1 = () => {
    setPhase1Checked(true);
    setAttemptsCount((prev) => prev + 1);

    // Check if all characters identified
    const allCharsSelected = characterOptions.every((c) =>
      selectedCharacters.has(c.name)
    );
    const noExtraChars = selectedCharacters.size === characterOptions.length;
    const settingCorrect = selectedSetting === 'correct';

    if (allCharsSelected && noExtraChars && settingCorrect) {
      // Auto-advance to phase 2
      setTimeout(() => setPhase('sequence'), 1200);
    }
  };

  // ============================================================================
  // Phase 2: Sequence Handlers
  // ============================================================================

  const handleEventClick = (eventId: string) => {
    if (hasSubmitted || phase2Checked) return;
    setSelectedEventId(selectedEventId === eventId ? null : eventId);
  };

  const handleArcZoneClick = (zoneKey: ArcPosition) => {
    if (hasSubmitted || phase2Checked) return;

    if (selectedEventId) {
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
    if (hasSubmitted || phase2Checked) return;
    setPlacedEvents((prev) => prev.filter((pe) => pe.eventId !== eventId));
  };

  const checkPhase2 = () => {
    setPhase2Checked(true);
    setAttemptsCount((prev) => prev + 1);

    // Compute correctness
    let allCorrect = true;
    placedEvents.forEach((pe) => {
      const eventData = data.events.find((e) => e.id === pe.eventId);
      if (!eventData || eventData.arcPosition !== pe.arcPosition) {
        allCorrect = false;
      }
    });

    const allPlaced = placedEvents.length === data.events.length;

    if (allCorrect && allPlaced) {
      if (showConflictPhase) {
        setTimeout(() => setPhase('analyze'), 1200);
      } else {
        // Submit evaluation
        handleFinalSubmit();
      }
    }
  };

  // ============================================================================
  // Phase 3: Analyze Handlers
  // ============================================================================

  const selectConflictType = (type: string) => {
    if (phase3Checked) return;
    setSelectedConflict(type);
  };

  const checkPhase3 = () => {
    setPhase3Checked(true);
    setAttemptsCount((prev) => prev + 1);
    handleFinalSubmit();
  };

  // ============================================================================
  // Final Submission
  // ============================================================================

  const handleFinalSubmit = () => {
    if (hasSubmitted) return;

    const completionTime = Date.now() - startTime;

    // Phase 1 metrics
    const charactersCorrect = characterOptions.every((c) =>
      selectedCharacters.has(c.name)
    );
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

    const totalScore = Math.round(
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
      totalCharacters: characterOptions.length,
      charactersCorrect,
      settingCorrect,
      identifyPhaseComplete: phase1Checked,

      // Phase 2
      totalEvents: data.events.length,
      eventsPlaced: placedEvents.length,
      eventsCorrectlyPlaced: eventsCorrectCount,
      allEventsCorrect,
      sequencePhaseComplete: phase2Checked,
      eventPlacementResults: eventResults,

      // Phase 3
      conflictTypeCorrect: conflictCorrect,
      selectedConflictType: selectedConflict || undefined,
      correctConflictType: data.elements.conflict?.type,
      analyzePhaseComplete: showConflictPhase ? phase3Checked : true,

      // Overall
      totalAttempts: attemptsCount,
      completionTimeMs: completionTime,
      overallAccuracy: totalScore,
    };

    submitResult(overallSuccess, totalScore, metrics, {
      studentWork: {
        selectedCharacters: Array.from(selectedCharacters),
        selectedSetting,
        placedEvents,
        selectedConflict,
      },
    });
  };

  // ============================================================================
  // Reset
  // ============================================================================

  const handleReset = () => {
    setPhase('identify');
    setShowPassage(true);
    setSelectedCharacters(new Set());
    setSelectedSetting(null);
    setPhase1Checked(false);
    setSelectedEventId(null);
    setPlacedEvents([]);
    setActiveDropZone(null);
    setPhase2Checked(false);
    setSelectedConflict(null);
    setPhase3Checked(false);
    setAttemptsCount(0);
    resetAttempt();
  };

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

  return (
    <Card
      className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className}`}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-2xl text-slate-100">{data.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
              {data.gradeLevel}
            </Badge>
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">
              {data.structureType === 'bme'
                ? 'Beginning-Middle-End'
                : data.structureType === 'story-mountain'
                ? 'Story Mountain'
                : data.structureType === 'plot-diagram'
                ? 'Plot Diagram'
                : "Hero's Journey"}
            </Badge>
          </div>
        </div>

        {/* Phase Progress Indicator */}
        <div className="flex items-center gap-2 mt-4">
          {phaseSteps.map((step, idx) => (
            <React.Fragment key={step.key}>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                  phase === step.key
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : isPhaseComplete(step.key)
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800/50 text-slate-500 border border-slate-700/30'
                }`}
              >
                {isPhaseComplete(step.key) && (
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
                    isPhaseComplete(step.key)
                      ? 'bg-emerald-500/40'
                      : 'bg-slate-700/40'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Phase Instructions */}
        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <p className="text-sm text-indigo-200 font-medium">
            {currentPhaseLabel}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {phase === 'identify' &&
              'Read the passage below, then select all the characters and the correct setting.'}
            {phase === 'sequence' &&
              'Click an event card, then click a position on the story arc to place it.'}
            {phase === 'analyze' &&
              'Based on the story, select the type of conflict the main character faces.'}
          </p>
        </div>

        {/* Passage Section */}
        <div>
          <Button
            variant="ghost"
            onClick={() => setShowPassage(!showPassage)}
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 mb-2 text-sm"
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
          </Button>

          {showPassage && (
            <Card className="backdrop-blur-sm bg-slate-800/30 border-white/5">
              <CardContent className="p-4">
                <h4 className="text-base font-semibold text-slate-100 mb-1">
                  {data.passage.title}
                </h4>
                {data.passage.author && (
                  <p className="text-xs text-slate-500 mb-3">
                    by {data.passage.author}
                  </p>
                )}
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {data.passage.text}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ================================================================== */}
        {/* Phase 1: Identify Characters & Setting */}
        {/* ================================================================== */}
        {phase === 'identify' && (
          <div className="space-y-5">
            {/* Characters */}
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                Who are the characters?{' '}
                <span className="text-slate-500 normal-case font-normal">
                  (Select all)
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {characterOptions.map((char) => {
                  const isSelected = selectedCharacters.has(char.name);
                  const showResult = phase1Checked;
                  const isCorrect = showResult && isSelected;
                  const isMissed = showResult && !isSelected;

                  return (
                    <div
                      key={char.name}
                      onClick={() => toggleCharacter(char.name)}
                      className={`
                        p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                        ${
                          isSelected
                            ? showResult
                              ? isCorrect
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-red-500 bg-red-500/10'
                              : 'border-indigo-500 bg-indigo-500/10'
                            : showResult && isMissed
                            ? 'border-yellow-500/50 bg-yellow-500/5'
                            : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                        }
                        ${phase1Checked ? 'cursor-default' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-100">
                          {char.name}
                        </span>
                        {showResult && isSelected && (
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
                      <p className="text-xs text-slate-400">{char.description}</p>
                      {showResult && (
                        <Badge
                          className={`mt-2 text-xs ${ROLE_COLORS[char.role]}`}
                        >
                          {char.role}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Setting */}
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                Where and when does the story take place?
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {settingOptions.map((opt) => {
                  const isSelected = selectedSetting === opt.id;
                  const showResult = phase1Checked;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => selectSetting(opt.id)}
                      className={`
                        p-3 rounded-lg border-2 transition-all duration-200
                        ${
                          isSelected
                            ? showResult
                              ? opt.isCorrect
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-red-500 bg-red-500/10'
                              : 'border-indigo-500 bg-indigo-500/10'
                            : showResult && opt.isCorrect
                            ? 'border-emerald-500/50 bg-emerald-500/5'
                            : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                        }
                        ${phase1Checked ? 'cursor-default' : 'cursor-pointer'}
                      `}
                    >
                      <span className="text-sm text-slate-200">{opt.text}</span>
                    </div>
                  );
                })}
              </div>
              {phase1Checked && selectedSetting === 'correct' && (
                <p className="mt-2 text-xs text-slate-400">
                  {data.elements.setting.description}
                </p>
              )}
            </div>

            {/* Phase 1 Check Button */}
            {!phase1Checked && (
              <Button
                onClick={checkPhase1}
                disabled={
                  selectedCharacters.size === 0 || selectedSetting === null
                }
                variant="ghost"
                className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check Answers
              </Button>
            )}

            {/* Phase 1 result feedback */}
            {phase1Checked && (
              <div className="space-y-2">
                {characterOptions.every((c) =>
                  selectedCharacters.has(c.name)
                ) &&
                selectedCharacters.size === characterOptions.length &&
                selectedSetting === 'correct' ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-sm text-emerald-300 font-medium">
                      Great job! You identified all the characters and the setting correctly.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm text-amber-300 font-medium">
                      Not quite right. Look at the passage again carefully.
                    </p>
                    <Button
                      onClick={() => {
                        setPhase1Checked(false);
                        setSelectedCharacters(new Set());
                        setSelectedSetting(null);
                      }}
                      variant="ghost"
                      className="mt-2 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 text-xs"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Manual advance button (if they got it right) */}
            {phase1Checked &&
              characterOptions.every((c) =>
                selectedCharacters.has(c.name)
              ) &&
              selectedCharacters.size === characterOptions.length &&
              selectedSetting === 'correct' && (
                <Button
                  onClick={() => setPhase('sequence')}
                  variant="ghost"
                  className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30"
                >
                  Continue to Sequencing
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Phase 2: Sequence Events on Arc */}
        {/* ================================================================== */}
        {phase === 'sequence' && (
          <div className="space-y-5">
            {/* Story Arc SVG */}
            <Card className="backdrop-blur-sm bg-slate-800/20 border-white/5 overflow-hidden">
              <CardContent className="p-4">
                {data.structureType === 'bme' ? (
                  <BMEArc
                    placedEvents={placedEvents}
                    events={data.events}
                    activeDropZone={activeDropZone}
                    isChecked={phase2Checked}
                  />
                ) : (
                  <StoryMountainArc
                    placedEvents={placedEvents}
                    events={data.events}
                    activeDropZone={activeDropZone}
                    isChecked={phase2Checked}
                  />
                )}
              </CardContent>
            </Card>

            {/* Arc Drop Zones (clickable buttons) */}
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                Story Arc Positions
              </h4>
              <div
                className={`grid gap-2 ${
                  data.structureType === 'bme'
                    ? 'grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                }`}
              >
                {arcLabels.map((zone) => {
                  const eventsInZone = placedEvents.filter(
                    (pe) => pe.arcPosition === zone.key
                  );
                  const isActive = activeDropZone === zone.key;

                  return (
                    <div
                      key={zone.key}
                      onClick={() => handleArcZoneClick(zone.key)}
                      onMouseEnter={() =>
                        selectedEventId ? setActiveDropZone(zone.key) : null
                      }
                      onMouseLeave={() => setActiveDropZone(null)}
                      className={`
                        p-3 rounded-lg border-2 text-center transition-all duration-200 min-h-[80px] flex flex-col items-center justify-center
                        ${
                          isActive && selectedEventId
                            ? 'border-violet-500 bg-violet-500/15 scale-105'
                            : selectedEventId
                            ? 'border-violet-500/30 bg-slate-800/40 hover:border-violet-500/60 hover:bg-violet-500/10 cursor-pointer'
                            : 'border-slate-700/50 bg-slate-800/30'
                        }
                        ${phase2Checked ? 'cursor-default' : ''}
                      `}
                    >
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        {zone.label}
                      </span>
                      {eventsInZone.length > 0 ? (
                        <div className="space-y-1 w-full">
                          {eventsInZone.map((pe) => {
                            const eventData = data.events.find(
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

                            return (
                              <div
                                key={pe.eventId}
                                className={`
                                  relative p-2 rounded text-xs text-left
                                  ${
                                    isCorrect
                                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-200'
                                      : isWrong
                                      ? 'bg-red-500/15 border border-red-500/40 text-red-200'
                                      : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-200'
                                  }
                                `}
                              >
                                <span className="line-clamp-2">
                                  {eventData?.text || pe.eventId}
                                </span>
                                {!phase2Checked && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveEvent(pe.eventId);
                                    }}
                                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-700 text-slate-400 hover:text-white hover:bg-red-500/50 flex items-center justify-center text-xs"
                                  >
                                    x
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">
                          {selectedEventId ? 'Click to place' : 'Empty'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Available Event Cards */}
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                Event Cards{' '}
                <span className="text-slate-500 normal-case font-normal">
                  ({unplacedEvents.length} remaining)
                </span>
              </h4>
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

                    return (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event.id)}
                        className={`
                          p-3 rounded-lg border-2 transition-all duration-200
                          ${
                            isSelected
                              ? 'border-violet-500 bg-violet-500/15 shadow-lg shadow-violet-500/10 scale-[1.02]'
                              : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                          }
                          ${phase2Checked ? 'cursor-default' : 'cursor-pointer'}
                        `}
                      >
                        <p className="text-sm text-slate-200">{event.text}</p>
                        {isSelected && (
                          <p className="text-xs text-violet-300 mt-2">
                            Now click a position on the story arc above
                          </p>
                        )}
                      </div>
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
              <Button
                onClick={checkPhase2}
                disabled={placedEvents.length !== data.events.length}
                variant="ghost"
                className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check Sequence
              </Button>
            )}

            {/* Phase 2 result feedback */}
            {phase2Checked && (
              <div className="space-y-2">
                {(() => {
                  let correct = 0;
                  placedEvents.forEach((pe) => {
                    const eventData = data.events.find(
                      (e) => e.id === pe.eventId
                    );
                    if (
                      eventData &&
                      eventData.arcPosition === pe.arcPosition
                    ) {
                      correct++;
                    }
                  });
                  const allCorrect =
                    correct === data.events.length &&
                    placedEvents.length === data.events.length;

                  return allCorrect ? (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-sm text-emerald-300 font-medium">
                        Perfect! You placed all events in the correct positions
                        on the story arc.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <p className="text-sm text-amber-300 font-medium">
                        {correct} of {data.events.length} events are in the
                        right place. Try again!
                      </p>
                      <Button
                        onClick={() => {
                          setPhase2Checked(false);
                          setPlacedEvents([]);
                          setSelectedEventId(null);
                        }}
                        variant="ghost"
                        className="mt-2 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 text-xs"
                      >
                        Try Again
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Manual advance button */}
            {phase2Checked &&
              showConflictPhase &&
              (() => {
                let correct = 0;
                placedEvents.forEach((pe) => {
                  const eventData = data.events.find(
                    (e) => e.id === pe.eventId
                  );
                  if (
                    eventData &&
                    eventData.arcPosition === pe.arcPosition
                  ) {
                    correct++;
                  }
                });
                return (
                  correct === data.events.length &&
                  placedEvents.length === data.events.length
                );
              })() && (
                <Button
                  onClick={() => setPhase('analyze')}
                  variant="ghost"
                  className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30"
                >
                  Continue to Analysis
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Phase 3: Analyze (Conflict type) */}
        {/* ================================================================== */}
        {phase === 'analyze' && showConflictPhase && (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                What type of conflict does the main character face?
              </h4>
              {data.elements.conflict && (
                <p className="text-sm text-slate-400 mb-4">
                  {data.elements.conflict.description}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(CONFLICT_LABELS).map(([type, label]) => {
                  const isSelected = selectedConflict === type;
                  const showResult = phase3Checked;
                  const isCorrect =
                    showResult && type === data.elements.conflict?.type;
                  const isWrong =
                    showResult && isSelected && type !== data.elements.conflict?.type;

                  return (
                    <div
                      key={type}
                      onClick={() => selectConflictType(type)}
                      className={`
                        p-4 rounded-lg border-2 transition-all duration-200
                        ${
                          isSelected
                            ? showResult
                              ? isCorrect
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : isWrong
                                ? 'border-red-500 bg-red-500/10'
                                : 'border-indigo-500 bg-indigo-500/10'
                              : 'border-indigo-500 bg-indigo-500/10'
                            : showResult && isCorrect
                            ? 'border-emerald-500/50 bg-emerald-500/5'
                            : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                        }
                        ${phase3Checked ? 'cursor-default' : 'cursor-pointer'}
                      `}
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phase 3 Check Button */}
            {!phase3Checked && (
              <Button
                onClick={checkPhase3}
                disabled={selectedConflict === null}
                variant="ghost"
                className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check Answer
              </Button>
            )}

            {/* Phase 3 result feedback */}
            {phase3Checked && (
              <div className="space-y-2">
                {selectedConflict === data.elements.conflict?.type ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-sm text-emerald-300 font-medium">
                      Correct! This is a{' '}
                      {CONFLICT_LABELS[data.elements.conflict?.type || '']} conflict.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm text-amber-300 font-medium">
                      Not quite. The correct answer is{' '}
                      {CONFLICT_LABELS[data.elements.conflict?.type || '']}.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Success / Final Section */}
        {/* ================================================================== */}
        {hasSubmitted && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="text-lg font-semibold text-emerald-300">
                  Story Map Complete!
                </h4>
                <p className="text-sm text-slate-300">
                  You analyzed &quot;{data.passage.title}&quot; and mapped its
                  story structure.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {hasSubmitted && (
          <div className="flex gap-3">
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StoryMap;
