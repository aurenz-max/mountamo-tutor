'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { MoonPhasesLabMetrics } from '../../../evaluation/types';

// ============================================================================
// DATA INTERFACES (Single Source of Truth)
// ============================================================================

export type ViewMode = 'from_earth' | 'from_space' | 'split_view';

export type MoonPhase =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'third_quarter'
  | 'waning_crescent';

export interface MoonPhaseInfo {
  name: string;
  angle: number; // Position in orbit (0-360)
  description: string;
  emoji: string;
}

export interface MoonPhasesLabData {
  title: string;
  description: string;

  // View configuration
  viewMode: ViewMode;

  // Moon position (0-360 degrees around orbit)
  moonPosition: number;

  // Visual elements
  showSunDirection: boolean;
  showOrbit: boolean;
  phaseLabels: boolean;
  showEarthView: boolean;
  showTidalLocking: boolean;

  // Interaction
  interactivePosition: boolean;

  // Animation
  animateOrbit: boolean;
  cycleSpeed: number; // Days per second

  // Grade level for appropriate complexity
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';

  // Learning objectives
  learningObjectives?: string[];

  // Challenge mode (optional)
  challengePhase?: MoonPhase; // Ask student to find this phase

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MoonPhasesLabMetrics>) => void;
}

interface MoonPhasesLabProps {
  data: MoonPhasesLabData;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MOON_PHASES: MoonPhaseInfo[] = [
  { name: 'New Moon', angle: 0, description: 'Moon is between Earth and Sun - we see the dark side', emoji: '🌑' },
  { name: 'Waxing Crescent', angle: 45, description: 'A sliver of light appears on the right', emoji: '🌒' },
  { name: 'First Quarter', angle: 90, description: 'Half the Moon is lit - the right half', emoji: '🌓' },
  { name: 'Waxing Gibbous', angle: 135, description: 'More than half lit, growing toward full', emoji: '🌔' },
  { name: 'Full Moon', angle: 180, description: 'Earth is between Moon and Sun - fully lit!', emoji: '🌕' },
  { name: 'Waning Gibbous', angle: 225, description: 'Still mostly lit, but shrinking', emoji: '🌖' },
  { name: 'Third Quarter', angle: 270, description: 'Half lit again - the left half this time', emoji: '🌗' },
  { name: 'Waning Crescent', angle: 315, description: 'A sliver on the left, almost back to new', emoji: '🌘' },
];

const ORBIT_RADIUS = 140;
const EARTH_RADIUS = 30;
const MOON_RADIUS = 12;
const SUN_DISTANCE = 350; // Distance to Sun indicator

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getPhaseFromAngle = (angle: number): MoonPhaseInfo => {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // Find the closest phase
  let closestPhase = MOON_PHASES[0];
  let minDiff = 360;

  for (const phase of MOON_PHASES) {
    const diff = Math.abs(normalizedAngle - phase.angle);
    const wrapDiff = Math.min(diff, 360 - diff);
    if (wrapDiff < minDiff) {
      minDiff = wrapDiff;
      closestPhase = phase;
    }
  }

  return closestPhase;
};

const getPhaseKey = (phaseName: string): MoonPhase => {
  const mapping: Record<string, MoonPhase> = {
    'New Moon': 'new_moon',
    'Waxing Crescent': 'waxing_crescent',
    'First Quarter': 'first_quarter',
    'Waxing Gibbous': 'waxing_gibbous',
    'Full Moon': 'full_moon',
    'Waning Gibbous': 'waning_gibbous',
    'Third Quarter': 'third_quarter',
    'Waning Crescent': 'waning_crescent',
  };
  return mapping[phaseName] || 'new_moon';
};

// Calculate illumination percentage (0-100)
const getIlluminationPercent = (angle: number): number => {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  // At 0° (new moon) = 0%, at 180° (full moon) = 100%
  return Math.round(50 * (1 - Math.cos((normalizedAngle * Math.PI) / 180)));
};

// Calculate day in lunar cycle (1-29.5)
const getDayInCycle = (angle: number): number => {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  return Math.round((normalizedAngle / 360) * 29.5 * 10) / 10;
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

// Earth view of Moon - shows how Moon appears from Earth's surface
interface EarthViewMoonProps {
  moonAngle: number;
  size?: number;
}

const EarthViewMoon: React.FC<EarthViewMoonProps> = ({ moonAngle, size = 80 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size / 2) - 5;

    // Background
    svg.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', radius)
      .attr('fill', '#1a1a2e');

    // Moon gradient
    const defs = svg.append('defs');
    const moonGradient = defs.append('radialGradient')
      .attr('id', `moonGradient-${moonAngle}`)
      .attr('cx', '50%')
      .attr('cy', '50%');
    moonGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f5f5dc');
    moonGradient.append('stop').attr('offset', '100%').attr('stop-color', '#d4d4aa');

    // Calculate phase appearance
    // At angle 0 (new moon): entire moon is dark
    // At angle 180 (full moon): entire moon is lit
    // The illuminated portion changes based on angle

    const normalizedAngle = ((moonAngle % 360) + 360) % 360;

    // Draw the full moon disk (lit portion)
    svg.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', radius - 1)
      .attr('fill', `url(#moonGradient-${moonAngle})`);

    // Draw shadow based on phase
    // Shadow covers left or right portion of moon
    if (normalizedAngle !== 180) { // Not full moon
      const shadowClip = defs.append('clipPath').attr('id', `shadowClip-${moonAngle}`);
      shadowClip.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', radius - 1);

      // Create shadow path
      // For waxing phases (0-180): shadow on left
      // For waning phases (180-360): shadow on right

      const isWaxing = normalizedAngle < 180;
      const phaseProgress = isWaxing
        ? normalizedAngle / 180
        : (360 - normalizedAngle) / 180;

      // Create ellipse for terminator line effect
      const terminatorWidth = Math.abs(Math.cos((normalizedAngle * Math.PI) / 180)) * radius;

      const shadowPath = d3.path();

      if (isWaxing) {
        // Shadow on left, lit on right
        shadowPath.moveTo(centerX, centerY - radius);
        shadowPath.lineTo(centerX - radius, centerY - radius);
        shadowPath.lineTo(centerX - radius, centerY + radius);
        shadowPath.lineTo(centerX, centerY + radius);
        // Curved terminator
        shadowPath.bezierCurveTo(
          centerX - terminatorWidth, centerY + radius * 0.5,
          centerX - terminatorWidth, centerY - radius * 0.5,
          centerX, centerY - radius
        );
      } else {
        // Shadow on right, lit on left
        shadowPath.moveTo(centerX, centerY - radius);
        shadowPath.lineTo(centerX + radius, centerY - radius);
        shadowPath.lineTo(centerX + radius, centerY + radius);
        shadowPath.lineTo(centerX, centerY + radius);
        // Curved terminator
        shadowPath.bezierCurveTo(
          centerX + terminatorWidth, centerY + radius * 0.5,
          centerX + terminatorWidth, centerY - radius * 0.5,
          centerX, centerY - radius
        );
      }

      svg.append('path')
        .attr('d', shadowPath.toString())
        .attr('fill', '#1a1a2e')
        .attr('clip-path', `url(#shadowClip-${moonAngle})`);
    }

    // Add subtle crater details
    const craters = [
      { cx: 0.3, cy: 0.4, r: 0.08 },
      { cx: 0.6, cy: 0.3, r: 0.06 },
      { cx: 0.5, cy: 0.6, r: 0.1 },
      { cx: 0.7, cy: 0.55, r: 0.05 },
    ];

    craters.forEach(crater => {
      svg.append('circle')
        .attr('cx', centerX + (crater.cx - 0.5) * radius * 2)
        .attr('cy', centerY + (crater.cy - 0.5) * radius * 2)
        .attr('r', crater.r * radius)
        .attr('fill', '#c4c4a4')
        .attr('opacity', 0.3);
    });

  }, [moonAngle, size]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      className="rounded-full"
    />
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MoonPhasesLab: React.FC<MoonPhasesLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    viewMode,
    moonPosition: initialMoonPosition,
    showSunDirection,
    showOrbit,
    phaseLabels,
    showEarthView,
    showTidalLocking,
    interactivePosition,
    animateOrbit,
    cycleSpeed,
    gradeLevel,
    learningObjectives,
    challengePhase,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [moonPosition, setMoonPosition] = useState(initialMoonPosition);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<MoonPhase | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [phasesExplored, setPhasesExplored] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<MoonPhasesLabMetrics>({
    primitiveType: 'moon-phases-lab',
    instanceId: instanceId || `moon-phases-lab-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Current phase info
  const currentPhase = useMemo(() => getPhaseFromAngle(moonPosition), [moonPosition]);
  const illumination = useMemo(() => getIlluminationPercent(moonPosition), [moonPosition]);
  const dayInCycle = useMemo(() => getDayInCycle(moonPosition), [moonPosition]);

  // Track explored phases
  useEffect(() => {
    const phaseKey = getPhaseKey(currentPhase.name);
    setPhasesExplored(prev => new Set([...prev, phaseKey]));
  }, [currentPhase.name]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      // Calculate rotation based on cycle speed
      // cycleSpeed = days per second, full cycle = 29.5 days
      const degreesPerMs = (360 / 29.5) * cycleSpeed / 1000;

      setMoonPosition(prev => (prev + degreesPerMs * deltaTime) % 360);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, cycleSpeed]);

  // D3 Space View Visualization
  useEffect(() => {
    if (!svgRef.current) return;
    if (viewMode === 'from_earth') return; // Skip space view rendering

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 500;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background - space
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#0a0a1a');

    // Stars
    const starCount = 50;
    for (let i = 0; i < starCount; i++) {
      svg.append('circle')
        .attr('cx', Math.random() * width)
        .attr('cy', Math.random() * height)
        .attr('r', Math.random() * 1.5 + 0.5)
        .attr('fill', 'white')
        .attr('opacity', Math.random() * 0.5 + 0.3);
    }

    // Define gradients
    const defs = svg.append('defs');

    // Sun glow gradient
    const sunGlow = defs.append('radialGradient')
      .attr('id', 'sunGlow');
    sunGlow.append('stop').attr('offset', '0%').attr('stop-color', '#FFD700').attr('stop-opacity', 0.4);
    sunGlow.append('stop').attr('offset', '100%').attr('stop-color', '#FFD700').attr('stop-opacity', 0);

    // Earth gradient
    const earthGradient = defs.append('radialGradient')
      .attr('id', 'earthGradient');
    earthGradient.append('stop').attr('offset', '0%').attr('stop-color', '#60A5FA');
    earthGradient.append('stop').attr('offset', '70%').attr('stop-color', '#3B82F6');
    earthGradient.append('stop').attr('offset', '100%').attr('stop-color', '#1E40AF');

    // Moon gradient
    const moonGradient = defs.append('radialGradient')
      .attr('id', 'moonGradient');
    moonGradient.append('stop').attr('offset', '0%').attr('stop-color', '#E5E5E5');
    moonGradient.append('stop').attr('offset', '100%').attr('stop-color', '#A0A0A0');

    // Sun direction indicator (on left side)
    if (showSunDirection) {
      // Sun glow
      svg.append('circle')
        .attr('cx', -30)
        .attr('cy', centerY)
        .attr('r', 100)
        .attr('fill', 'url(#sunGlow)');

      // Sun rays
      const rayGroup = svg.append('g');
      for (let i = -3; i <= 3; i++) {
        rayGroup.append('line')
          .attr('x1', 0)
          .attr('y1', centerY + i * 40)
          .attr('x2', width)
          .attr('y2', centerY + i * 40)
          .attr('stroke', '#FFD700')
          .attr('stroke-width', 1)
          .attr('opacity', 0.2)
          .attr('stroke-dasharray', '10,10');
      }

      // Sun label
      svg.append('text')
        .attr('x', 15)
        .attr('y', centerY - 60)
        .attr('fill', '#FFD700')
        .attr('font-size', 14)
        .attr('font-weight', 'bold')
        .text('☀️ Sunlight');
    }

    // Moon orbit path
    if (showOrbit) {
      svg.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', ORBIT_RADIUS)
        .attr('fill', 'none')
        .attr('stroke', '#4A5568')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');
    }

    // Phase markers on orbit
    if (phaseLabels) {
      MOON_PHASES.forEach(phase => {
        const angleRad = ((phase.angle - 90) * Math.PI) / 180;
        const x = centerX + Math.cos(angleRad) * (ORBIT_RADIUS + 25);
        const y = centerY + Math.sin(angleRad) * (ORBIT_RADIUS + 25);

        svg.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#94a3b8')
          .attr('font-size', 10)
          .text(phase.emoji);
      });
    }

    // Earth at center
    const earthGroup = svg.append('g');

    // Earth night side shadow
    earthGroup.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', EARTH_RADIUS)
      .attr('fill', 'url(#earthGradient)');

    // Earth shadow (night side - right half from this view)
    const earthShadowClip = defs.append('clipPath').attr('id', 'earthShadowClip');
    earthShadowClip.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', EARTH_RADIUS);

    earthGroup.append('rect')
      .attr('x', centerX)
      .attr('y', centerY - EARTH_RADIUS)
      .attr('width', EARTH_RADIUS)
      .attr('height', EARTH_RADIUS * 2)
      .attr('fill', 'rgba(0, 0, 0, 0.5)')
      .attr('clip-path', 'url(#earthShadowClip)');

    // Earth label
    svg.append('text')
      .attr('x', centerX)
      .attr('y', centerY + EARTH_RADIUS + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#60A5FA')
      .attr('font-size', 12)
      .attr('font-weight', 'bold')
      .text('Earth');

    // Calculate Moon position
    // Angle 0 = between Earth and Sun (new moon)
    // We draw orbit as if looking down from above with Sun to the left
    const moonAngleRad = ((moonPosition - 90) * Math.PI) / 180;
    const moonX = centerX + Math.cos(moonAngleRad) * ORBIT_RADIUS;
    const moonY = centerY + Math.sin(moonAngleRad) * ORBIT_RADIUS;

    // Moon
    const moonGroup = svg.append('g')
      .attr('cursor', interactivePosition ? 'pointer' : 'default');

    moonGroup.append('circle')
      .attr('cx', moonX)
      .attr('cy', moonY)
      .attr('r', MOON_RADIUS)
      .attr('fill', 'url(#moonGradient)');

    // Moon shadow (far side from Sun)
    // The shadow is always on the side away from the Sun (right side from this view)
    const moonShadowClip = defs.append('clipPath').attr('id', 'moonShadowClip');
    moonShadowClip.append('circle')
      .attr('cx', moonX)
      .attr('cy', moonY)
      .attr('r', MOON_RADIUS);

    moonGroup.append('rect')
      .attr('x', moonX)
      .attr('y', moonY - MOON_RADIUS)
      .attr('width', MOON_RADIUS)
      .attr('height', MOON_RADIUS * 2)
      .attr('fill', 'rgba(0, 0, 0, 0.7)')
      .attr('clip-path', 'url(#moonShadowClip)');

    // Tidal locking indicator
    if (showTidalLocking) {
      // Show an arrow or marker on the Moon indicating it always faces Earth
      const arrowLength = 8;
      const arrowAngle = Math.atan2(centerY - moonY, centerX - moonX);

      const arrowTip = {
        x: moonX + Math.cos(arrowAngle) * (MOON_RADIUS + arrowLength),
        y: moonY + Math.sin(arrowAngle) * (MOON_RADIUS + arrowLength),
      };

      moonGroup.append('line')
        .attr('x1', moonX + Math.cos(arrowAngle) * MOON_RADIUS)
        .attr('y1', moonY + Math.sin(arrowAngle) * MOON_RADIUS)
        .attr('x2', arrowTip.x)
        .attr('y2', arrowTip.y)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2);

      // Arrow head
      const arrowHeadSize = 4;
      moonGroup.append('polygon')
        .attr('points', [
          [arrowTip.x, arrowTip.y],
          [arrowTip.x - Math.cos(arrowAngle - 0.5) * arrowHeadSize, arrowTip.y - Math.sin(arrowAngle - 0.5) * arrowHeadSize],
          [arrowTip.x - Math.cos(arrowAngle + 0.5) * arrowHeadSize, arrowTip.y - Math.sin(arrowAngle + 0.5) * arrowHeadSize],
        ].map(p => p.join(',')).join(' '))
        .attr('fill', '#f59e0b');
    }

    // Moon label
    svg.append('text')
      .attr('x', moonX)
      .attr('y', moonY + MOON_RADIUS + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#E5E5E5')
      .attr('font-size', 11)
      .attr('font-weight', 'bold')
      .text('Moon');

    // Current phase label at top
    svg.append('text')
      .attr('x', centerX)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 18)
      .attr('font-weight', 'bold')
      .text(`${currentPhase.emoji} ${currentPhase.name}`);

    // Interactive drag handling
    if (interactivePosition) {
      const drag = d3.drag<SVGGElement, unknown>()
        .on('drag', (event) => {
          const dx = event.x - centerX;
          const dy = event.y - centerY;
          let angle = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
          if (angle < 0) angle += 360;
          setMoonPosition(angle);
        });

      moonGroup.call(drag as any);
    }

  }, [
    moonPosition,
    viewMode,
    showSunDirection,
    showOrbit,
    phaseLabels,
    showTidalLocking,
    interactivePosition,
    currentPhase,
  ]);

  // Handle phase selection for challenge mode
  const handlePhaseSelect = (phase: MoonPhase) => {
    setSelectedPhase(phase);
    setUserAnswers(prev => ({ ...prev, selected_phase: phase }));
  };

  // Jump to a specific phase
  const jumpToPhase = useCallback((phase: MoonPhaseInfo) => {
    setMoonPosition(phase.angle);
    setIsAnimating(false);
  }, []);

  // Evaluation handlers
  const handleCheckUnderstanding = () => {
    if (hasSubmitted) return;

    let score = 0;
    let totalPoints = 0;

    // Score based on phases explored
    const explorationScore = (phasesExplored.size / 8) * 50;
    score += explorationScore;
    totalPoints += 50;

    // Score based on challenge completion (if any)
    if (challengePhase) {
      totalPoints += 50;
      if (selectedPhase === challengePhase) {
        score += 50;
      }
    } else {
      // Without challenge, full credit for exploration
      totalPoints = 100;
      score = explorationScore * 2;
    }

    const finalScore = Math.round((score / totalPoints) * 100);
    const success = finalScore >= 70;

    const metrics: MoonPhasesLabMetrics = {
      type: 'moon-phases-lab',
      phasesExplored: phasesExplored.size,
      totalPhases: 8,
      challengeCompleted: challengePhase ? selectedPhase === challengePhase : true,
      animationWatched: userAnswers['animation_watched'] === 'yes',
      viewModesUsed: [viewMode],
      comprehensionScore: finalScore,
    };

    submitResult(success, finalScore, metrics, {
      studentWork: {
        phasesExplored: Array.from(phasesExplored),
        selectedPhase,
        answers: userAnswers,
      },
    });
  };

  const handleReset = () => {
    setMoonPosition(initialMoonPosition);
    setIsAnimating(false);
    setSelectedPhase(null);
    setUserAnswers({});
    setPhasesExplored(new Set());
    setShowExplanation(false);
    resetAttempt();
  };

  return (
    <div className={`bg-slate-900 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-300">{description}</p>
      </div>

      {/* Main Content */}
      <div className={`grid gap-6 ${viewMode === 'split_view' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Space View */}
        {(viewMode === 'from_space' || viewMode === 'split_view') && (
          <div className="bg-slate-950 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span>🛸</span>
              <span>View from Space</span>
            </h4>
            <div className="flex justify-center">
              <svg
                ref={svgRef}
                width="500"
                height="400"
                className="rounded-lg"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          </div>
        )}

        {/* Earth View */}
        {(viewMode === 'from_earth' || viewMode === 'split_view' || showEarthView) && (
          <div className="bg-slate-950 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span>🌎</span>
              <span>View from Earth</span>
            </h4>
            <div className="flex flex-col items-center gap-4">
              <EarthViewMoon moonAngle={moonPosition} size={150} />
              <div className="text-center">
                <div className="text-3xl mb-2">{currentPhase.emoji}</div>
                <div className="text-xl font-bold text-white">{currentPhase.name}</div>
                <div className="text-slate-400 text-sm mt-1">{currentPhase.description}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase Information Panel */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Illumination</div>
          <div className="text-2xl font-bold text-white">{illumination}%</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Day in Cycle</div>
          <div className="text-2xl font-bold text-white">{dayInCycle} / 29.5</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Phases Explored</div>
          <div className="text-2xl font-bold text-white">{phasesExplored.size} / 8</div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 bg-slate-800 rounded-lg p-4">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span>🎮</span>
          <span>Controls</span>
        </h4>

        <div className="space-y-4">
          {/* Position slider */}
          {interactivePosition && (
            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                Moon Position: {Math.round(moonPosition)}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={moonPosition}
                onChange={(e) => {
                  setMoonPosition(Number(e.target.value));
                  setIsAnimating(false);
                }}
                className="w-full"
              />
            </div>
          )}

          {/* Animation controls */}
          {animateOrbit && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setIsAnimating(!isAnimating);
                  setUserAnswers(prev => ({ ...prev, animation_watched: 'yes' }));
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isAnimating
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isAnimating ? '⏸️ Pause' : '▶️ Play'} Animation
              </button>
              <span className="text-slate-400 text-sm">
                Speed: {cycleSpeed} days/sec
              </span>
            </div>
          )}

          {/* Quick jump to phases */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block">Jump to Phase:</label>
            <div className="flex flex-wrap gap-2">
              {MOON_PHASES.map(phase => (
                <button
                  key={phase.name}
                  onClick={() => jumpToPhase(phase)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    currentPhase.name === phase.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {phase.emoji} {gradeLevel === 'K' || gradeLevel === '1' ? phase.emoji : phase.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Challenge Mode */}
      {challengePhase && !hasSubmitted && (
        <div className="mt-6 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-700/50 rounded-lg p-4">
          <h4 className="text-purple-300 font-semibold mb-3 flex items-center gap-2">
            <span>🎯</span>
            <span>Challenge: Find the {challengePhase.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          </h4>
          <p className="text-slate-300 text-sm mb-3">
            Move the Moon to show what a {challengePhase.replace('_', ' ')} looks like.
          </p>
          <div className="flex flex-wrap gap-2">
            {MOON_PHASES.map(phase => (
              <button
                key={phase.name}
                onClick={() => handlePhaseSelect(getPhaseKey(phase.name))}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedPhase === getPhaseKey(phase.name)
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {phase.emoji} {phase.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tidal Locking Explanation */}
      {showTidalLocking && (
        <div className="mt-6 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-700/50 rounded-lg p-4">
          <h4 className="text-amber-300 font-semibold mb-2 flex items-center gap-2">
            <span>🔒</span>
            <span>Why We Only See One Side</span>
          </h4>
          <p className="text-slate-300 text-sm">
            The Moon is "tidally locked" to Earth. This means the Moon rotates once on its axis
            in the same time it takes to orbit Earth once. That's why we always see the same side
            of the Moon! The orange arrow shows which side always faces Earth.
          </p>
        </div>
      )}

      {/* Learning Questions */}
      {!hasSubmitted && learningObjectives && learningObjectives.length > 0 && (
        <div className="mt-6 bg-slate-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span>✏️</span>
            <span>Think About It</span>
          </h4>
          <div className="space-y-3">
            {learningObjectives.map((objective, index) => (
              <div key={index} className="text-slate-300 text-sm flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>{objective}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleCheckUnderstanding}
          disabled={hasSubmitted}
          className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {hasSubmitted ? '✓ Submitted' : 'Check Understanding'}
        </button>

        {hasSubmitted && (
          <button
            onClick={handleReset}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            🔄 Try Again
          </button>
        )}

        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {showExplanation ? '👁️ Hide' : '💡 Show'} Explanation
        </button>
      </div>

      {/* Explanation Panel */}
      {showExplanation && (
        <div className="mt-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-lg p-4">
          <h5 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span>💡</span>
            <span>Why Does the Moon Change Shape?</span>
          </h5>
          <div className="text-slate-200 text-sm space-y-3">
            <p>
              <strong className="text-blue-300">The Moon doesn't actually change shape!</strong>
              {' '}What changes is how much of the lit side we can see from Earth.
            </p>
            <p>
              The Sun always lights up half of the Moon (just like it lights up half of Earth).
              As the Moon orbits Earth, we see different amounts of that lit half.
            </p>
            <div className="bg-slate-800/50 rounded p-3 mt-3">
              <strong className="text-purple-300">The Lunar Cycle:</strong>
              <ul className="mt-2 space-y-1">
                <li>🌑 <strong>New Moon</strong>: Moon is between us and the Sun - we see the dark side</li>
                <li>🌓 <strong>First Quarter</strong>: We see half the lit side</li>
                <li>🌕 <strong>Full Moon</strong>: We're between the Moon and Sun - we see the whole lit side</li>
                <li>🌗 <strong>Third Quarter</strong>: We see the other half of the lit side</li>
              </ul>
            </div>
            <p className="text-slate-400 text-xs mt-2">
              One complete cycle takes about 29.5 days - that's where we get "month" (from "Moon")!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoonPhasesLab;
