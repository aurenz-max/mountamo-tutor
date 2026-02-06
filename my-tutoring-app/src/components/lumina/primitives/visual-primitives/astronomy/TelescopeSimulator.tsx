'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TelescopeSimulatorMetrics } from '../../../evaluation/types';

// =============================================================================
// Exported Data Types (Single Source of Truth)
// =============================================================================

export interface CelestialTarget {
  id: string;
  name: string;
  type: 'planet' | 'star' | 'moon' | 'constellation' | 'nebula' | 'galaxy' | 'cluster';
  azimuth: number;   // 0-360 degrees
  altitude: number;  // 0-90 degrees
  magnitude: number; // apparent magnitude (lower = brighter)
  angularSize: number; // apparent size in arcminutes
  color: string;
  description: string;
  funFact: string;
  visibleNaked: boolean;
  bestTelescope: TelescopeType;
  detailLevels: {
    naked: string;
    binoculars: string;
    small: string;
    large: string;
    space: string;
  };
}

export interface JournalEntry {
  id: string;
  objectId: string;
  objectName: string;
  timestamp: number;
  magnification: number;
  telescopeType: string;
  viewMode: string;
  notes: string;
}

export type TelescopeType = 'binoculars' | 'small' | 'large' | 'space';
export type SkyViewMode = 'visible' | 'infrared' | 'radio';

export interface TelescopeSimulatorData {
  title: string;
  description: string;
  gradeLevel: string;

  celestialObjects: CelestialTarget[];

  starFieldSeed?: number;
  starCount?: number;

  telescopeType: TelescopeType;
  initialMagnification: number;
  maxMagnification?: number; // Deprecated: each telescope has its own maxMag
  viewMode: SkyViewMode;

  showLabels: boolean;
  showGrid: boolean;

  targetObjects?: string[];
  journalMode: boolean;

  focusMode: 'auto' | 'manual';

  learningFocus: string;
  hints: string[];
  funFact?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TelescopeSimulatorMetrics>) => void;
}

// =============================================================================
// Constants
// =============================================================================

const VIEWPORT_SIZE = 560;
const VIEWPORT_RADIUS = 260;

const TELESCOPE_SPECS: Record<TelescopeType, {
  maxMag: number;
  fovBase: number;
  label: string;
  icon: string;
  resolution: number;
}> = {
  binoculars: { maxMag: 12, fovBase: 8, label: 'Binoculars', icon: '👀', resolution: 0.6 },
  small:      { maxMag: 60, fovBase: 4, label: 'Small Scope', icon: '🔭', resolution: 0.8 },
  large:      { maxMag: 250, fovBase: 2.5, label: 'Large Scope', icon: '🏗️', resolution: 0.95 },
  space:      { maxMag: 500, fovBase: 1.5, label: 'Space Telescope', icon: '🛰️', resolution: 1.0 },
};

const VIEW_MODE_CONFIG: Record<SkyViewMode, {
  bg: string;
  starColor: string;
  label: string;
  icon: string;
}> = {
  visible:  { bg: '#060618', starColor: '#ffffff', label: 'Visible', icon: '👁️' },
  infrared: { bg: '#180808', starColor: '#ff9955', label: 'Infrared', icon: '🔴' },
  radio:    { bg: '#081018', starColor: '#55aaff', label: 'Radio', icon: '📡' },
};

const STAR_COLORS = ['#ffffff', '#ffe4c4', '#fff5e0', '#cce0ff', '#ffd0a0', '#aaccff', '#ffcccc'];

// =============================================================================
// Utility Functions
// =============================================================================

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

interface StarData {
  id: string;
  az: number;
  alt: number;
  magnitude: number;
  color: string;
  twinklePhase: number;
}

function generateStarField(seed: number, count: number): StarData[] {
  const rng = seededRandom(seed);
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      id: `star-${i}`,
      az: rng() * 360,
      alt: rng() * 85 + 5, // 5-90 degrees altitude
      magnitude: rng() * 6 + 1, // 1-7 magnitude
      color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)],
      twinklePhase: rng() * Math.PI * 2,
    });
  }
  return stars;
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  let d = normalizeAngle(a - b);
  if (d > 180) d -= 360;
  return d;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// =============================================================================
// Sub-Components
// =============================================================================

const FocusRing: React.FC<{
  focusLevel: number;
  optimalFocus: number;
  onChange: (value: number) => void;
  disabled: boolean;
}> = ({ focusLevel, optimalFocus, onChange, disabled }) => {
  const quality = 100 - Math.abs(focusLevel - optimalFocus) * 2;
  const qualityColor = quality > 80 ? 'text-green-400' : quality > 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Focus</span>
        <span className={`text-xs font-mono ${disabled ? 'text-slate-500' : qualityColor}`}>
          {disabled ? 'AUTO' : `${Math.round(quality)}%`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={focusLevel}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  );
};

const ObjectInfoPopup: React.FC<{
  object: CelestialTarget;
  telescopeType: TelescopeType;
  magnification: number;
  onClose: () => void;
  onLogObservation: () => void;
  journalMode: boolean;
}> = ({ object, telescopeType, magnification, onClose, onLogObservation, journalMode }) => {
  const detailKey = telescopeType;
  const detail = object.detailLevels[detailKey] || object.detailLevels.naked;
  const typeIcons: Record<string, string> = {
    planet: '🪐', star: '⭐', moon: '🌙', constellation: '✨',
    nebula: '🌌', galaxy: '🌀', cluster: '💫',
  };

  return (
    <div className="absolute top-4 left-4 right-4 bg-slate-900/95 backdrop-blur-lg border border-blue-500/30 rounded-xl p-4 z-30 shadow-xl shadow-blue-500/10">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{typeIcons[object.type] || '✨'}</span>
            <h4 className="text-lg font-bold text-white">{object.name}</h4>
          </div>
          <span className="text-xs text-blue-300 capitalize">{object.type}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition p-1"
        >✕</button>
      </div>
      <p className="text-sm text-slate-300 mb-2">{object.description}</p>
      <div className="bg-slate-800/50 rounded-lg p-3 mb-2">
        <p className="text-xs text-blue-300 font-medium mb-1">Through your {TELESCOPE_SPECS[telescopeType].label} at {magnification}×:</p>
        <p className="text-sm text-slate-200">{detail}</p>
      </div>
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 mb-3">
        <p className="text-xs text-indigo-300 font-medium">💡 Fun Fact</p>
        <p className="text-sm text-slate-200">{object.funFact}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Magnitude: {object.magnitude.toFixed(1)} · Size: {object.angularSize}′</span>
        {journalMode && (
          <button
            onClick={onLogObservation}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs"
          >📝 Log Observation</button>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

interface TelescopeSimulatorProps {
  data: TelescopeSimulatorData;
  className?: string;
}

const TelescopeSimulator: React.FC<TelescopeSimulatorProps> = ({ data, className }) => {
  const {
    title, description, gradeLevel, celestialObjects = [],
    starFieldSeed = 42, starCount = 400,
    telescopeType: initialTelescope = 'small',
    initialMagnification = 5,
    viewMode: initialViewMode = 'visible',
    showLabels: initialShowLabels = true,
    showGrid: initialShowGrid = false,
    targetObjects = [], journalMode = false,
    focusMode: initialFocusMode = 'auto',
    learningFocus, hints = [], funFact,
    instanceId, skillId, subskillId, objectiveId, exhibitId,
    onEvaluationSubmit,
  } = data;

  // ---- State ----
  const [telescopeAz, setTelescopeAz] = useState(180); // pointing azimuth
  const [telescopeAlt, setTelescopeAlt] = useState(45); // pointing altitude
  const [magnification, setMagnification] = useState(initialMagnification);
  const [focusLevel, setFocusLevel] = useState(50);
  const [telescopeType, setTelescopeType] = useState<TelescopeType>(initialTelescope);
  const [viewMode, setViewMode] = useState<SkyViewMode>(initialViewMode);
  const [showLabels, setShowLabels] = useState(initialShowLabels);
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [focusMode, setFocusMode] = useState<'auto' | 'manual'>(initialFocusMode);

  const [selectedObject, setSelectedObject] = useState<CelestialTarget | null>(null);
  const [foundObjects, setFoundObjects] = useState<Set<string>>(new Set());
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [activeTab, setActiveTab] = useState<'targets' | 'journal'>('targets');
  const [panStart, setPanStart] = useState<{ x: number; y: number; az: number; alt: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track interactions for evaluation
  const [panDistance, setPanDistance] = useState(0);
  const [viewModesUsed, setViewModesUsed] = useState<Set<string>>(new Set([initialViewMode]));
  const [telescopesUsed, setTelescopesUsed] = useState<Set<string>>(new Set([initialTelescope]));
  const [manualFocusAttempts, setManualFocusAttempts] = useState(0);
  const [objectsExplored, setObjectsExplored] = useState<Set<string>>(new Set());
  const [magRange, setMagRange] = useState<[number, number]>([initialMagnification, initialMagnification]);

  // ---- Evaluation ----
  const { submitResult, hasSubmitted, resetAttempt } = usePrimitiveEvaluation<TelescopeSimulatorMetrics>({
    primitiveType: 'telescope-simulator',
    instanceId: instanceId || `telescope-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // ---- Derived ----
  const specs = TELESCOPE_SPECS[telescopeType];
  const effectiveMaxMag = specs.maxMag; // Use telescope's actual max, not the initial prop
  const fov = specs.fovBase / Math.max(1, magnification / 5); // field of view in degrees
  const optimalFocus = 50 + (magnification / effectiveMaxMag) * 10 - 5; // shifts slightly with mag
  const blurAmount = focusMode === 'auto' ? 0 : Math.min(8, Math.abs(focusLevel - optimalFocus) * 0.12);
  const focusQuality = focusMode === 'auto' ? 100 : Math.max(0, 100 - Math.abs(focusLevel - optimalFocus) * 2);

  const stars = useMemo(
    () => generateStarField(starFieldSeed, starCount),
    [starFieldSeed, starCount]
  );

  const hasTargets = targetObjects.length > 0;
  const allTargetsFound = hasTargets && targetObjects.every(id => foundObjects.has(id));
  const modeConfig = VIEW_MODE_CONFIG[viewMode];

  // ---- Sky-to-viewport coordinate conversion ----
  const skyToViewport = useCallback((az: number, alt: number) => {
    const cx = VIEWPORT_SIZE / 2;
    const cy = VIEWPORT_SIZE / 2;
    const dx = angleDiff(az, telescopeAz);
    const dy = alt - telescopeAlt;
    const scale = (VIEWPORT_RADIUS * 2) / fov;
    return {
      x: cx + dx * scale,
      y: cy - dy * scale,
    };
  }, [telescopeAz, telescopeAlt, fov]);

  const isInViewport = useCallback((vx: number, vy: number) => {
    const cx = VIEWPORT_SIZE / 2;
    const cy = VIEWPORT_SIZE / 2;
    const dx = vx - cx;
    const dy = vy - cy;
    return (dx * dx + dy * dy) < (VIEWPORT_RADIUS * VIEWPORT_RADIUS);
  }, []);

  // ---- D3 Rendering ----
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const cx = VIEWPORT_SIZE / 2;
    const cy = VIEWPORT_SIZE / 2;

    // ---- Defs (one-time setup) ----
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
      defs = svg.append('defs');

      // Circular clip
      defs.append('clipPath').attr('id', 'telescope-clip')
        .append('circle').attr('cx', cx).attr('cy', cy).attr('r', VIEWPORT_RADIUS);

      // Vignette gradient
      const radGrad = defs.append('radialGradient').attr('id', 'vignette');
      radGrad.append('stop').attr('offset', '0%').attr('stop-color', 'transparent');
      radGrad.append('stop').attr('offset', '70%').attr('stop-color', 'transparent');
      radGrad.append('stop').attr('offset', '95%').attr('stop-opacity', 0.6).attr('stop-color', '#000');
      radGrad.append('stop').attr('offset', '100%').attr('stop-opacity', 0.95).attr('stop-color', '#000');

      // Focus blur filter
      const blurFilter = defs.append('filter').attr('id', 'focus-blur').attr('x', '-10%').attr('y', '-10%').attr('width', '120%').attr('height', '120%');
      blurFilter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 0);

      // Glow filter for bright objects
      const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 3).attr('result', 'blur');
      glow.append('feMerge').html('<feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/>');

      // Layers
      svg.append('rect').attr('class', 'sky-bg').attr('width', VIEWPORT_SIZE).attr('height', VIEWPORT_SIZE)
        .attr('clip-path', 'url(#telescope-clip)');
      svg.append('g').attr('class', 'grid-layer').attr('clip-path', 'url(#telescope-clip)');
      svg.append('g').attr('class', 'content-layer').attr('clip-path', 'url(#telescope-clip)')
        .attr('filter', 'url(#focus-blur)');
      svg.append('circle').attr('class', 'vignette')
        .attr('cx', cx).attr('cy', cy).attr('r', VIEWPORT_RADIUS).attr('fill', 'url(#vignette)')
        .attr('pointer-events', 'none');
      // Crosshair
      const ch = svg.append('g').attr('class', 'crosshair').attr('pointer-events', 'none');
      ch.append('line').attr('x1', cx - 12).attr('y1', cy).attr('x2', cx + 12).attr('y2', cy)
        .attr('stroke', 'rgba(100,150,255,0.25)').attr('stroke-width', 0.5);
      ch.append('line').attr('x1', cx).attr('y1', cy - 12).attr('x2', cx).attr('y2', cy + 12)
        .attr('stroke', 'rgba(100,150,255,0.25)').attr('stroke-width', 0.5);
      // Eyepiece ring
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', VIEWPORT_RADIUS)
        .attr('fill', 'none').attr('stroke', '#222').attr('stroke-width', 16)
        .attr('pointer-events', 'none');
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', VIEWPORT_RADIUS + 6)
        .attr('fill', 'none').attr('stroke', '#111').attr('stroke-width', 4)
        .attr('pointer-events', 'none');
    }

    // ---- Update sky background ----
    svg.select('.sky-bg').attr('fill', modeConfig.bg);

    // ---- Update blur filter ----
    svg.select('#focus-blur feGaussianBlur').attr('stdDeviation', blurAmount);

    // ---- Grid layer ----
    const gridLayer = svg.select('.grid-layer');
    gridLayer.selectAll('*').remove();
    if (showGrid) {
      const gridStep = Math.max(2, Math.ceil(fov / 5)) * 2;
      for (let az = 0; az < 360; az += gridStep) {
        const p1 = skyToViewport(az, 0);
        const p2 = skyToViewport(az, 90);
        if (isInViewport(p1.x, p1.y) || isInViewport(p2.x, p2.y)) {
          gridLayer.append('line')
            .attr('x1', p1.x).attr('y1', p1.y).attr('x2', p2.x).attr('y2', p2.y)
            .attr('stroke', 'rgba(100,150,255,0.08)').attr('stroke-width', 0.5);
        }
      }
      for (let alt = 0; alt <= 90; alt += gridStep) {
        const points: { x: number; y: number }[] = [];
        for (let az = telescopeAz - fov; az <= telescopeAz + fov; az += 1) {
          points.push(skyToViewport(az, alt));
        }
        if (points.length > 1) {
          const line = d3.line<{ x: number; y: number }>()
            .x(d => d.x).y(d => d.y);
          gridLayer.append('path')
            .attr('d', line(points))
            .attr('fill', 'none')
            .attr('stroke', 'rgba(100,150,255,0.08)')
            .attr('stroke-width', 0.5);
        }
      }
    }

    // ---- Content layer (stars + objects) ----
    const contentLayer = svg.select('.content-layer');
    contentLayer.selectAll('*').remove();

    // Render stars
    const visibleStars = stars.filter(s => {
      const pos = skyToViewport(s.az, s.alt);
      return isInViewport(pos.x, pos.y);
    });

    visibleStars.forEach(star => {
      const pos = skyToViewport(star.az, star.alt);
      const magScale = Math.max(0.3, (7 - star.magnitude) / 5);
      const r = magScale * Math.min(2.5, 0.5 + Math.sqrt(magnification) * 0.15);
      const opacity = Math.min(1, magScale * 0.9);
      const starColor = viewMode === 'visible' ? star.color : modeConfig.starColor;

      contentLayer.append('circle')
        .attr('cx', pos.x).attr('cy', pos.y).attr('r', r)
        .attr('fill', starColor).attr('opacity', opacity);
    });

    // Render celestial objects
    celestialObjects.forEach(obj => {
      const pos = skyToViewport(obj.azimuth, obj.altitude);
      if (!isInViewport(pos.x, pos.y)) return;

      const magScale = Math.max(1, (8 - obj.magnitude) / 3);
      // Better scaling: scale object size based on FOV and angular size
      // This makes size proportional to how much of the FOV the object occupies
      const isPlanetOrMoon = obj.type === 'planet' || obj.type === 'moon';

      if (isPlanetOrMoon) {
        // Convert angular size (arcminutes) to degrees, then calculate pixels based on FOV
        const angularSizeDeg = obj.angularSize / 60; // arcmin to degrees
        const pixelsPerDegree = (VIEWPORT_RADIUS * 2) / fov;
        const angularSizePixels = angularSizeDeg * pixelsPerDegree;
        // Use angular size directly, with a small base for visibility at low mag
        var r = Math.max(3, angularSizePixels * 0.5);
      } else {
        // Stars and other objects use magnitude-based sizing
        const angularScale = (obj.angularSize / 10) * Math.sqrt(magnification);
        const sizeScale = 1 + angularScale;
        var r = Math.max(3, magScale * sizeScale * 1.5);
      }
      const isTarget = targetObjects.includes(obj.id);
      const isFound = foundObjects.has(obj.id);
      const objColor = viewMode === 'visible' ? obj.color : modeConfig.starColor;

      const g = contentLayer.append('g')
        .attr('class', 'celestial-object')
        .attr('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          setSelectedObject(obj);
          setObjectsExplored(prev => new Set(prev).add(obj.id));
          if (isTarget && !isFound) {
            setFoundObjects(prev => new Set(prev).add(obj.id));
          }
        });

      // Glow for bright objects
      if (obj.magnitude < 2) {
        g.append('circle')
          .attr('cx', pos.x).attr('cy', pos.y).attr('r', r * 2.5)
          .attr('fill', objColor).attr('opacity', 0.08);
        g.append('circle')
          .attr('cx', pos.x).attr('cy', pos.y).attr('r', r * 1.6)
          .attr('fill', objColor).attr('opacity', 0.15);
      }

      // Planet disc or star point
      if (obj.type === 'planet' || obj.type === 'moon') {
        // Main disc
        g.append('circle')
          .attr('cx', pos.x).attr('cy', pos.y).attr('r', r)
          .attr('fill', objColor).attr('stroke', d3.color(objColor)?.brighter(0.5)?.toString() || objColor)
          .attr('stroke-width', 0.5).attr('opacity', 0.95);

        // Enhanced Moon rendering with craters at high magnification
        if (obj.id === 'moon' && magnification > 15) {
          // Add subtle shading gradient for 3D effect
          const moonGradId = `moon-grad-${obj.id}`;
          const existingDefs = svg.select<SVGDefsElement>('defs');
          if (!existingDefs.empty() && !existingDefs.select(`#${moonGradId}`).node()) {
            const moonGrad = existingDefs.append('radialGradient').attr('id', moonGradId);
            moonGrad.append('stop').attr('offset', '0%').attr('stop-color', d3.color(objColor)?.brighter(0.3)?.toString() || objColor);
            moonGrad.append('stop').attr('offset', '70%').attr('stop-color', objColor);
            moonGrad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(objColor)?.darker(0.5)?.toString() || objColor);
          }
          g.select('circle').attr('fill', `url(#${moonGradId})`);

          // Add craters at higher magnifications
          if (magnification > 30) {
            const craterCount = Math.min(8, Math.floor(magnification / 10));
            const rng = seededRandom(42); // Consistent crater positions
            for (let i = 0; i < craterCount; i++) {
              const angle = rng() * Math.PI * 2;
              const dist = rng() * r * 0.7;
              const craterR = r * (0.08 + rng() * 0.12);
              const cx = pos.x + Math.cos(angle) * dist;
              const cy = pos.y + Math.sin(angle) * dist;

              // Crater shadow
              g.append('circle')
                .attr('cx', cx).attr('cy', cy).attr('r', craterR)
                .attr('fill', d3.color(objColor)?.darker(1.2)?.toString() || '#555')
                .attr('opacity', 0.6);

              // Crater rim highlight
              g.append('circle')
                .attr('cx', cx - craterR * 0.2).attr('cy', cy - craterR * 0.2).attr('r', craterR * 0.8)
                .attr('fill', 'none')
                .attr('stroke', d3.color(objColor)?.brighter(0.3)?.toString() || '#fff')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.4);
            }
          }

          // Add maria (dark patches) at medium magnification
          if (magnification > 20 && magnification <= 30) {
            const mariaData = [
              { x: 0.3, y: -0.2, r: 0.25 },
              { x: -0.2, y: 0.3, r: 0.2 },
              { x: 0.1, y: 0.4, r: 0.15 }
            ];
            mariaData.forEach(maria => {
              g.append('ellipse')
                .attr('cx', pos.x + maria.x * r)
                .attr('cy', pos.y + maria.y * r)
                .attr('rx', maria.r * r * 1.2)
                .attr('ry', maria.r * r)
                .attr('fill', d3.color(objColor)?.darker(0.8)?.toString() || '#888')
                .attr('opacity', 0.5);
            });
          }
        }

        // Phase effect for Venus at high magnification
        if (obj.id === 'venus' && magnification > 20) {
          g.append('circle')
            .attr('cx', pos.x - r * 0.3).attr('cy', pos.y).attr('r', r * 0.9)
            .attr('fill', modeConfig.bg).attr('opacity', 0.6);
        }
      } else if (obj.type === 'nebula' || obj.type === 'galaxy') {
        g.append('ellipse')
          .attr('cx', pos.x).attr('cy', pos.y).attr('rx', r * 1.5).attr('ry', r)
          .attr('fill', objColor).attr('opacity', 0.25).attr('filter', 'url(#glow)');
      } else if (obj.type === 'cluster') {
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2;
          const dist = r * 0.6;
          g.append('circle')
            .attr('cx', pos.x + Math.cos(angle) * dist)
            .attr('cy', pos.y + Math.sin(angle) * dist)
            .attr('r', r * 0.25)
            .attr('fill', objColor).attr('opacity', 0.8);
        }
      } else {
        // Diffraction spikes for stars
        g.append('circle')
          .attr('cx', pos.x).attr('cy', pos.y).attr('r', r)
          .attr('fill', objColor).attr('opacity', 0.9);
        if (magnification > 10 && obj.magnitude < 3) {
          const spikeLen = r * 2;
          [0, 90].forEach(angle => {
            const rad = (angle * Math.PI) / 180;
            g.append('line')
              .attr('x1', pos.x - Math.cos(rad) * spikeLen)
              .attr('y1', pos.y - Math.sin(rad) * spikeLen)
              .attr('x2', pos.x + Math.cos(rad) * spikeLen)
              .attr('y2', pos.y + Math.sin(rad) * spikeLen)
              .attr('stroke', objColor).attr('stroke-width', 0.5).attr('opacity', 0.3);
          });
        }
      }

      // Label
      if (showLabels || (isTarget && !isFound)) {
        g.append('text')
          .attr('x', pos.x).attr('y', pos.y + r + 12)
          .attr('text-anchor', 'middle')
          .attr('fill', isTarget && !isFound ? '#fbbf24' : '#94a3b8')
          .attr('font-size', '10px')
          .attr('font-family', 'sans-serif')
          .text(obj.name);
      }

      // Target indicator ring
      if (isTarget && !isFound) {
        g.append('circle')
          .attr('cx', pos.x).attr('cy', pos.y).attr('r', r + 8)
          .attr('fill', 'none').attr('stroke', '#fbbf24')
          .attr('stroke-width', 1).attr('stroke-dasharray', '3,3').attr('opacity', 0.6);
      }
      if (isTarget && isFound) {
        g.append('text')
          .attr('x', pos.x + r + 4).attr('y', pos.y - r)
          .attr('fill', '#4ade80').attr('font-size', '12px')
          .text('✓');
      }
    });

  }, [
    stars, celestialObjects, telescopeAz, telescopeAlt, magnification,
    blurAmount, viewMode, showLabels, showGrid, fov, modeConfig,
    skyToViewport, isInViewport, targetObjects, foundObjects,
  ]);

  // ---- Interaction Handlers ----
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanStart({ x: e.clientX, y: e.clientY, az: telescopeAz, alt: telescopeAlt });
  }, [telescopeAz, telescopeAlt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!panStart) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    const scale = fov / (VIEWPORT_RADIUS * 2);
    const newAz = normalizeAngle(panStart.az - dx * scale);
    const newAlt = clamp(panStart.alt + dy * scale, 5, 85);
    setTelescopeAz(newAz);
    setTelescopeAlt(newAlt);
    setPanDistance(prev => prev + Math.abs(dx) + Math.abs(dy));
  }, [panStart, fov]);

  const handleMouseUp = useCallback(() => {
    setPanStart(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const step = Math.max(1, magnification * 0.1);
    setMagnification(prev => {
      const next = clamp(prev + delta * step, 1, effectiveMaxMag);
      setMagRange(r => [Math.min(r[0], next), Math.max(r[1], next)]);
      return next;
    });
  }, [magnification, effectiveMaxMag]);

  const handleFocusChange = useCallback((value: number) => {
    setFocusLevel(value);
    if (focusMode === 'manual') {
      setManualFocusAttempts(prev => prev + 1);
    }
  }, [focusMode]);

  const handleTelescopeChange = useCallback((type: TelescopeType) => {
    setTelescopeType(type);
    setTelescopesUsed(prev => new Set(prev).add(type));
    // Reset magnification if exceeds new max
    const newMax = TELESCOPE_SPECS[type].maxMag;
    if (magnification > newMax) setMagnification(newMax);
  }, [magnification]);

  const handleViewModeChange = useCallback((mode: SkyViewMode) => {
    setViewMode(mode);
    setViewModesUsed(prev => new Set(prev).add(mode));
  }, []);

  const handleLogObservation = useCallback(() => {
    if (!selectedObject) return;
    const entry: JournalEntry = {
      id: `obs-${Date.now()}`,
      objectId: selectedObject.id,
      objectName: selectedObject.name,
      timestamp: Date.now(),
      magnification,
      telescopeType,
      viewMode,
      notes: `Observed ${selectedObject.name} at ${magnification}× with ${TELESCOPE_SPECS[telescopeType].label}`,
    };
    setJournal(prev => [...prev, entry]);
  }, [selectedObject, magnification, telescopeType, viewMode]);

  // ---- Quick Navigate to Object ----
  const navigateToObject = useCallback((obj: CelestialTarget) => {
    setTelescopeAz(obj.azimuth);
    setTelescopeAlt(obj.altitude);
  }, []);

  // ---- Evaluation Submission ----
  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmitted) return;

    const found = foundObjects.size;
    const total = targetObjects.length || celestialObjects.length;
    const score = hasTargets
      ? Math.round((targetObjects.filter(id => foundObjects.has(id)).length / targetObjects.length) * 100)
      : Math.round((objectsExplored.size / Math.max(1, celestialObjects.length)) * 100);

    const success = hasTargets ? allTargetsFound : objectsExplored.size >= Math.ceil(celestialObjects.length / 2);

    const metrics: TelescopeSimulatorMetrics = {
      type: 'telescope-simulator',
      targetObjectsTotal: targetObjects.length,
      targetObjectsFound: targetObjects.filter(id => foundObjects.has(id)).length,
      allTargetsFound: hasTargets ? allTargetsFound : false,
      observationsLogged: journal.length,
      focusAccuracy: Math.round(focusQuality),
      objectsExplored: objectsExplored.size,
      viewModesUsed: Array.from(viewModesUsed),
      telescopeTypesUsed: Array.from(telescopesUsed),
      magnificationRange: magRange,
      focusMode,
      manualFocusAttempts: focusMode === 'manual' ? manualFocusAttempts : undefined,
      timeSpent: 0,
      panDistance: Math.round(panDistance),
    };

    submitResult(success, score, metrics, {
      studentWork: {
        foundObjects: Array.from(foundObjects),
        journal,
        finalPointing: { az: telescopeAz, alt: telescopeAlt },
      },
    });
  }, [
    hasSubmitted, foundObjects, targetObjects, celestialObjects, objectsExplored,
    journal, focusQuality, viewModesUsed, telescopesUsed, magRange, focusMode,
    manualFocusAttempts, panDistance, telescopeAz, telescopeAlt, submitResult,
    allTargetsFound, hasTargets,
  ]);

  // Auto-submit when all targets found
  useEffect(() => {
    if (allTargetsFound && !hasSubmitted && hasTargets) {
      // Small delay so student sees the final check mark
      const t = setTimeout(() => handleSubmitEvaluation(), 1500);
      return () => clearTimeout(t);
    }
  }, [allTargetsFound, hasSubmitted, hasTargets, handleSubmitEvaluation]);

  // ---- Render ----
  return (
    <div className={`bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden ${className || ''}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          🔭 {title || 'Telescope Simulator'}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description || learningFocus}</p>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* ---- Viewport + Controls ---- */}
        <div className="flex-1 p-4">
          {/* Viewport */}
          <div
            ref={containerRef}
            className="relative mx-auto"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          >
            <svg
              ref={svgRef}
              width={VIEWPORT_SIZE}
              height={VIEWPORT_SIZE}
              className="cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            />

            {/* Info Popup */}
            {selectedObject && (
              <ObjectInfoPopup
                object={selectedObject}
                telescopeType={telescopeType}
                magnification={magnification}
                onClose={() => setSelectedObject(null)}
                onLogObservation={handleLogObservation}
                journalMode={journalMode}
              />
            )}

            {/* Coordinate readout */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-3 py-1 rounded-full">
              <span className="text-xs text-blue-300 font-mono">
                AZ {telescopeAz.toFixed(1)}° · ALT {telescopeAlt.toFixed(1)}° · {magnification.toFixed(0)}×
              </span>
            </div>

            {/* Target found celebration */}
            {allTargetsFound && hasTargets && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="bg-green-500/20 backdrop-blur-lg border border-green-500/40 rounded-2xl px-8 py-6 text-center pointer-events-auto">
                  <div className="text-4xl mb-2">🎉</div>
                  <h4 className="text-xl font-bold text-green-400">All Objects Found!</h4>
                  <p className="text-sm text-green-300 mt-1">
                    You discovered {targetObjects.length} celestial {targetObjects.length === 1 ? 'object' : 'objects'}!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="mt-4 bg-slate-800/50 rounded-xl p-4 space-y-3 max-w-[560px] mx-auto">
            {/* Magnification */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400 font-medium">Magnification</span>
                <span className="text-xs text-blue-300 font-mono">{magnification.toFixed(0)}× / {effectiveMaxMag}×</span>
              </div>
              <input
                type="range" min={1} max={effectiveMaxMag}
                value={magnification}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMagnification(v);
                  setMagRange(r => [Math.min(r[0], v), Math.max(r[1], v)]);
                }}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Focus */}
            <FocusRing
              focusLevel={focusLevel}
              optimalFocus={optimalFocus}
              onChange={handleFocusChange}
              disabled={focusMode === 'auto'}
            />

            {/* Telescope Type */}
            <div>
              <span className="text-xs text-slate-400 font-medium block mb-1">Telescope</span>
              <div className="flex gap-1">
                {(Object.keys(TELESCOPE_SPECS) as TelescopeType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTelescopeChange(t)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                      telescopeType === t
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="block text-sm">{TELESCOPE_SPECS[t].icon}</span>
                    <span className="block mt-0.5">{TELESCOPE_SPECS[t].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">View:</span>
              <div className="flex gap-1 flex-1">
                {(Object.keys(VIEW_MODE_CONFIG) as SkyViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleViewModeChange(m)}
                    className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                      viewMode === m
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {VIEW_MODE_CONFIG[m].icon} {VIEW_MODE_CONFIG[m].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles Row */}
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox" checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500"
                />
                Labels
              </label>
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox" checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500"
                />
                Grid
              </label>
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={focusMode === 'manual'}
                  onChange={(e) => setFocusMode(e.target.checked ? 'manual' : 'auto')}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500"
                />
                Manual Focus
              </label>
            </div>
          </div>
        </div>

        {/* ---- Sidebar ---- */}
        <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-700/50 p-4 flex flex-col">
          {/* Tabs */}
          <div className="flex mb-3 gap-1">
            <button
              onClick={() => setActiveTab('targets')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'targets' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
            >
              🎯 Targets {hasTargets && `(${foundObjects.size}/${targetObjects.length})`}
            </button>
            {journalMode && (
              <button
                onClick={() => setActiveTab('journal')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'journal' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                📝 Journal ({journal.length})
              </button>
            )}
          </div>

          {/* Target List */}
          {activeTab === 'targets' && (
            <div className="flex-1 overflow-y-auto space-y-2">
              {(hasTargets
                ? celestialObjects.filter(o => targetObjects.includes(o.id))
                : celestialObjects
              ).map(obj => {
                const isFound = foundObjects.has(obj.id);
                const isExplored = objectsExplored.has(obj.id);
                const typeIcons: Record<string, string> = {
                  planet: '🪐', star: '⭐', moon: '🌙', constellation: '✨',
                  nebula: '🌌', galaxy: '🌀', cluster: '💫',
                };
                return (
                  <button
                    key={obj.id}
                    onClick={() => navigateToObject(obj)}
                    className={`w-full text-left p-2.5 rounded-lg transition border ${
                      isFound
                        ? 'bg-green-500/10 border-green-500/30'
                        : isExplored
                          ? 'bg-blue-500/10 border-blue-500/20'
                          : 'bg-slate-800/50 border-slate-700/30 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeIcons[obj.type] || '✨'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-white truncate">{obj.name}</span>
                          {isFound && <span className="text-green-400 text-xs">✓</span>}
                        </div>
                        <span className="text-xs text-slate-400 capitalize">{obj.type}</span>
                      </div>
                      <span className="text-xs text-slate-500">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Journal */}
          {activeTab === 'journal' && (
            <div className="flex-1 overflow-y-auto space-y-2">
              {journal.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No observations yet. Click an object and log it!
                </div>
              ) : (
                journal.map(entry => (
                  <div key={entry.id} className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{entry.objectName}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{entry.notes}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Hints */}
          {hints.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <button
                onClick={() => setShowHints(!showHints)}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                💡 {showHints ? 'Hide hints' : 'Show hints'}
              </button>
              {showHints && (
                <ul className="mt-2 space-y-1">
                  {hints.map((hint, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                      <span className="text-blue-400">•</span>
                      {hint}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Fun Fact */}
          {funFact && (
            <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <p className="text-xs text-indigo-300 font-medium mb-1">✨ Did you know?</p>
              <p className="text-xs text-slate-300">{funFact}</p>
            </div>
          )}

          {/* Submit Button */}
          {!hasSubmitted && !allTargetsFound && (
            <button
              onClick={handleSubmitEvaluation}
              className="mt-3 w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition shadow-lg"
            >
              Submit Observation
            </button>
          )}
          {hasSubmitted && (
            <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
              <p className="text-sm text-green-400 font-medium">✓ Observation Submitted!</p>
              <button
                onClick={resetAttempt}
                className="mt-2 text-xs text-slate-400 hover:text-white transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TelescopeSimulator;
