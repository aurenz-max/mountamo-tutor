'use client';

/**
 * SolarSystemExplorer — a living orrery with TWO faces:
 *
 *   EXPLORE (no judgeable challenges): the original free-exploration surface.
 *   Tap a body, hear about it, zoom and pan; the tutor narrates via the
 *   ORIENT / BODY_SELECTED / READ_ALOUD beats. Unchanged on purpose — the
 *   reader-fit suite pins this face.
 *
 *   JUDGED (challenges present): the DI modality. The tutor asks about the sky
 *   OUT LOUD, the child answers OUT LOUD with a planet's name, and the tutor's
 *   own affirmation advances the lesson (`useJudgedScriptRunner`). The click
 *   era's answer path — tap-to-select, confirm button, the three-tries reveal
 *   ladder, Next button, improvised [SOLAR_*] answer choreography — is gone.
 *   Tapping SURVIVES as what it honestly is: LOOKING. A tap opens a body's
 *   research card (the compare modes' own instrument); it never answers.
 *
 * Judged-stage rules carried from the family (see solarSystemScript.ts):
 *   - The identify SPOTLIGHT is a runner-gated stimulus (19c): it paints only
 *     after the tutor's ask for THIS item is spoken — declared via
 *     `onPresentStimulus` + `stimulus.when`, never a hand-rolled timer.
 *   - While an identify item is open, body LABELS are withheld — a printed
 *     name under the spotlit planet is the answer in pixels (defect 11).
 *   - The reveal renders behind `runner.revealHeld`, and its payload is NOT
 *     cleared in `onItemOpened` (18b — the same-dispatch advance).
 *   - Interaction gates ride `runner.canAttempt` / `runner.currentSolved`,
 *     never `runner.stage`.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { LuminaReadAloud } from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { SolarSystemExplorerMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  itemsFromChallenges,
  solarSystemPackBase,
  askFor,
  revealTextFor,
  isPairFacet,
  type SolarItem,
  type SolarChallengeType,
  type SolarBand,
} from './solarSystemScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary, type PhaseConfig } from '../../../hooks/usePhaseResults';

export type { SolarChallengeType };

// Export data interface - single source of truth
export interface CelestialBody {
  id: string;
  name: string;
  type: 'star' | 'planet' | 'dwarf-planet';
  color: string;
  radiusKm: number;
  distanceAu: number;
  orbitalPeriodDays: number;
  rotationPeriodHours: number;
  moons: number;
  description: string;
  textureGradient: string;
  temperatureC: number;
  funFact?: string;
}

/**
 * A graded ask. `facet` (plus `position` / `optionBodyIds`) is the STRUCTURED
 * identity the judged script builds from — prose fields are legacy and are
 * never parsed ([[feedback_schema-over-regex-and-prompt]]). A challenge
 * without a facet cannot be asked honestly and is dropped by the build gates.
 */
export interface SolarChallenge {
  id: string;
  type: SolarChallengeType;
  /** Structured ask identity — see SolarFacet in solarSystemScript. */
  facet?: string;
  /** order_from_sun 'position' facet: 1-based position among the planets. */
  position?: number;
  /** pair facets: the two compared body ids. */
  optionBodyIds?: string[];
  /** Every body that satisfies the ask. Length > 1 for `classify`. */
  answerBodyIds: string[];
  /** Legacy click-era prose. Kept for logs and old cached payloads only. */
  prompt?: string;
  hint?: string;
  explanation?: string;
}

export interface SolarSystemExplorerData {
  title: string;
  description: string;
  bodies: CelestialBody[];
  initialZoom?: 'system' | 'inner' | 'outer' | 'planet' | 'moon';
  focusBody?: string;
  timeScale?: number;
  showOrbits?: boolean;
  showLabels?: boolean;
  scaleMode?: 'size_accurate' | 'distance_accurate' | 'hybrid';
  showHabitableZone?: boolean;
  dateTime?: string;
  showDistances?: boolean;
  compareMode?: boolean;
  gradeLevel?: 'K' | '1' | '2' | '3' | '4' | '5';

  /** Graded spoken questions. Absent/empty → pure exploration, as before. */
  challenges?: SolarChallenge[];

  /** Within-mode support tier — present only when the manifest emitted difficulty. */
  supportTier?: 'easy' | 'medium' | 'hard';

  /** Auto-injected by ManifestOrderRenderer; scopes the tutor session. */
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SolarSystemExplorerMetrics>) => void;
}

interface SolarSystemExplorerProps {
  data: SolarSystemExplorerData;
  className?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify:          { label: 'Name It',  icon: '🔎', accentColor: 'blue' },
  order_from_sun:    { label: 'In Order', icon: '🔢', accentColor: 'cyan' },
  classify:          { label: 'Sort It',  icon: '🗂️', accentColor: 'purple' },
  compare_attribute: { label: 'Compare',  icon: '⚖️', accentColor: 'emerald' },
  orbital_reasoning: { label: 'Orbits',   icon: '🌀', accentColor: 'amber' },
};

// Base scale: 1 AU = pixels
const AU_TO_PIXELS = 180;

// ============================================================================
// The canvas — the living sky both faces share
// ============================================================================

interface SolarCanvasProps {
  bodies: CelestialBody[];
  isPreReader: boolean;
  initialZoom?: SolarSystemExplorerData['initialZoom'];
  initialTimeScale: number;
  initialShowOrbits: boolean;
  initialShowLabels: boolean;
  initialShowDistances: boolean;
  initialScaleMode: 'size_accurate' | 'distance_accurate' | 'hybrid';
  showHabitableZone?: boolean;
  dateTime?: string;
  selectedBodyId: string | null;
  onBodyTap: (id: string) => void;
  /** Judged identify items: a printed name under the spotlit planet would be
   *  the answer in pixels, so every label is withheld while one is open. */
  suppressLabels?: boolean;
  /** Pulsing halo — the runner-gated stimulus (identify target, or a pair). */
  spotlightBodyIds?: string[];
  /** Post-affirm only: emerald ring + forced label on the answer body/bodies. */
  revealBodyIds?: string[];
}

const SolarCanvas: React.FC<SolarCanvasProps> = ({
  bodies,
  isPreReader,
  initialZoom,
  initialTimeScale,
  initialShowOrbits,
  initialShowLabels,
  initialShowDistances,
  initialScaleMode,
  showHabitableZone,
  dateTime,
  selectedBodyId,
  onBodyTap,
  suppressLabels = false,
  spotlightBodyIds = [],
  revealBodyIds = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState(initialTimeScale);
  const [showOrbits, setShowOrbits] = useState(initialShowOrbits);
  const [showLabels, setShowLabels] = useState(initialShowLabels);
  const [showDistances, setShowDistances] = useState(initialShowDistances);
  const [scaleMode, setScaleMode] = useState(initialScaleMode);
  const [paused, setPaused] = useState(false);

  // Animation state - refs to avoid re-renders during animation
  const simulationDateRef = useRef(dateTime ? new Date(dateTime) : new Date());
  const [displayDate] = useState(simulationDateRef.current);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const bodyGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const dateDisplayRef = useRef<HTMLDivElement>(null);

  const spotlightSet = useMemo(() => new Set(spotlightBodyIds), [spotlightBodyIds]);
  const revealSet = useMemo(() => new Set(revealBodyIds), [revealBodyIds]);
  const dimOthers = spotlightSet.size > 0;

  // Window resize listener (more performant than ResizeObserver for this case)
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // D3 Zoom Behavior
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 100])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });
    const svg = d3.select(svgRef.current);
    svg.call(zoom);

    let initialScale = 0.3;
    if (initialZoom === 'inner') initialScale = 0.8;
    else if (initialZoom === 'outer') initialScale = 0.15;
    else if (initialZoom === 'planet') initialScale = 2;

    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(initialScale);
    svg.call(zoom.transform, initialTransform);
  }, [dimensions.width, dimensions.height, initialZoom]);

  // Animation loop - direct DOM manipulation for smooth 60fps orbital motion
  useEffect(() => {
    let frameCount = 0;
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined && !paused) {
        const deltaTime = time - previousTimeRef.current;
        const timeToAdd = timeScale * deltaTime * 100;
        simulationDateRef.current = new Date(simulationDateRef.current.getTime() + timeToAdd);

        bodyGroupRefs.current.forEach((element, bodyId) => {
          const body = bodies.find((b) => b.id === bodyId);
          if (body && body.distanceAu > 0) {
            const periodMs = body.orbitalPeriodDays * 24 * 60 * 60 * 1000;
            const currentTime = simulationDateRef.current.getTime();
            const angle = ((currentTime % periodMs) / periodMs) * 2 * Math.PI;
            const r = body.distanceAu * AU_TO_PIXELS;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            element.setAttribute('transform', `translate(${x}, ${y})`);
          }
        });

        frameCount++;
        if (frameCount % 30 === 0 && dateDisplayRef.current) {
          dateDisplayRef.current.textContent = simulationDateRef.current.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          });
        }
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [paused, timeScale, bodies]);

  const getInitialPosition = useCallback((body: CelestialBody) => {
    if (body.distanceAu === 0) return { x: 0, y: 0 };
    const periodMs = body.orbitalPeriodDays * 24 * 60 * 60 * 1000;
    const time = simulationDateRef.current.getTime();
    const angle = ((time % periodMs) / periodMs) * 2 * Math.PI;
    const r = body.distanceAu * AU_TO_PIXELS;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  }, []);

  const setBodyRef = useCallback((bodyId: string, element: SVGGElement | null) => {
    if (element) bodyGroupRefs.current.set(bodyId, element);
    else bodyGroupRefs.current.delete(bodyId);
  }, []);

  const getVisualRadius = (body: CelestialBody) => {
    if (body.type === 'star') return scaleMode === 'size_accurate' ? 30 : 35;
    if (scaleMode === 'size_accurate') return Math.max(3, Math.log(body.radiusKm) * 1.8);
    if (scaleMode === 'distance_accurate') return Math.max(2, body.radiusKm * 0.0003);
    return Math.max(4, Math.log(body.radiusKm) * 1.5);
  };

  const habitableZoneInner = 0.95 * AU_TO_PIXELS;
  const habitableZoneOuter = 1.37 * AU_TO_PIXELS;
  const labelsOn = showLabels && !suppressLabels;

  return (
    <div className="relative glass-panel rounded-2xl border border-white/10 overflow-hidden" style={{ height: '600px' }}>
      <div ref={containerRef} className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing bg-black/40">
        <StarBackground width={dimensions.width} height={dimensions.height} transform={transform} />

        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="absolute top-0 left-0">
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {showHabitableZone && (
              <g opacity={0.2}>
                <circle cx={0} cy={0} r={habitableZoneOuter} fill="none" stroke="#22c55e" strokeWidth={20 / transform.k} />
                <circle cx={0} cy={0} r={habitableZoneInner} fill="none" stroke="#22c55e" strokeWidth={20 / transform.k} />
                <circle cx={0} cy={0} r={(habitableZoneInner + habitableZoneOuter) / 2} fill="none" stroke="#22c55e" strokeWidth={1 / transform.k} strokeDasharray="4 4" />
              </g>
            )}

            {showOrbits &&
              bodies.map((body) => {
                if (body.distanceAu === 0) return null;
                return (
                  <circle
                    key={`orbit-${body.id}`}
                    cx={0}
                    cy={0}
                    r={body.distanceAu * AU_TO_PIXELS}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth={1 / transform.k}
                  />
                );
              })}

            {bodies.map((body) => {
              const pos = getInitialPosition(body);
              const r = getVisualRadius(body);
              const isSelected = selectedBodyId === body.id;
              const isHovered = hoveredBodyId === body.id;
              const isSpotlit = spotlightSet.has(body.id);
              const isRevealed = revealSet.has(body.id);

              return (
                <g
                  key={body.id}
                  data-body-id={body.id}
                  ref={(el) => setBodyRef(body.id, el)}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={dimOthers && !isSpotlit && !isRevealed ? 0.35 : 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBodyTap(body.id);
                  }}
                  onMouseEnter={() => setHoveredBodyId(body.id)}
                  onMouseLeave={() => setHoveredBodyId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow for Sun */}
                  {body.type === 'star' && <circle r={r * 3} fill="url(#sunGlow)" opacity={0.6} />}

                  {/* Transparent hit target — the drawn planet can be a handful
                      of pixels at system zoom, and it is moving. Without this,
                      tapping is a dexterity test rather than an astronomy one. */}
                  <circle r={Math.max(r * 2.2, 14 / transform.k)} fill="transparent" />

                  {/* The judged stimulus: a pulsing halo the tutor's ask refers
                      to. It follows the body because it lives inside its <g>. */}
                  {isSpotlit && (
                    <>
                      <circle r={r * 2.6} fill={body.color} opacity={0.3} className="animate-pulse" />
                      <circle
                        r={r * 1.8 + 6}
                        fill="none"
                        stroke="white"
                        strokeWidth={2.5 / transform.k}
                        strokeDasharray="6 3"
                        className="animate-pulse"
                      />
                    </>
                  )}

                  {isHovered && !isSelected && (
                    <circle r={r * 2} fill={body.color} opacity={0.3} />
                  )}

                  {isSelected && (
                    <>
                      <circle r={r * 2.5} fill={body.color} opacity={0.2} />
                      <circle
                        r={r * 1.5 + 5}
                        fill="none"
                        stroke="white"
                        strokeWidth={2 / transform.k}
                        strokeDasharray="4 2"
                      />
                    </>
                  )}

                  {/* Revealed answer — only ever set AFTER the tutor affirms,
                      never before (answer-leak rule, in pixels). */}
                  {isRevealed && (
                    <circle
                      r={r * 1.5 + 9}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth={3 / transform.k}
                    />
                  )}

                  <circle
                    r={r}
                    fill={body.color}
                    stroke={isSelected ? 'white' : isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isHovered || isSelected ? 2 / transform.k : 1 / transform.k}
                  />
                  <circle r={r} fill={`url(#planetGradient-${body.id})`} opacity={0.7} />

                  {/* Label — withheld wholesale during identify items; a reveal
                      forces the answer's label back on while the tutor names it. */}
                  {((labelsOn && (transform.k > 0.4 || isSelected || isHovered)) || isRevealed) && (
                    <text
                      y={r + 14 / transform.k}
                      textAnchor="middle"
                      fill={isRevealed ? '#6ee7b7' : 'white'}
                      fontSize={(isHovered || isSelected || isRevealed ? 12 : 11) / transform.k}
                      className="select-none pointer-events-none font-medium"
                      style={{
                        textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                        fontWeight: isHovered || isSelected || isRevealed ? 600 : 500,
                      }}
                    >
                      {body.name}
                    </text>
                  )}

                  {showDistances && body.distanceAu > 0 && transform.k > 0.5 && (
                    <text
                      y={r + 26 / transform.k}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize={9 / transform.k}
                      className="select-none pointer-events-none"
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                    >
                      {body.distanceAu.toFixed(2)} AU
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          <defs>
            <radialGradient id="sunGlow">
              <stop offset="0%" stopColor="#FDB813" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FDB813" stopOpacity="0" />
            </radialGradient>
            {bodies.map((body) => (
              <radialGradient id={`planetGradient-${body.id}`} key={`grad-${body.id}`} cx="30%" cy="30%">
                <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                <stop offset="70%" stopColor="black" stopOpacity="0.4" />
                <stop offset="100%" stopColor="black" stopOpacity="0.6" />
              </radialGradient>
            ))}
          </defs>
        </svg>

        {/* Help Text — a three-clause protocol instruction in 12px is the one
            string a non-reader most needs and least can read. */}
        {!isPreReader && (
          <div className="absolute top-4 right-4 glass-panel backdrop-blur-md px-3 py-2 rounded-lg border border-white/20 text-xs text-slate-300 pointer-events-none">
            Scroll to Zoom • Drag to Pan • Click Planets
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
        <div className="glass-panel backdrop-blur-md rounded-xl border border-white/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(!paused)}
              aria-label={paused ? 'Play' : 'Pause'}
              className={`bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/30 text-white rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                isPreReader ? 'px-4 py-3 text-2xl leading-none' : 'px-3 py-1.5 text-sm'
              }`}
            >
              {isPreReader ? (paused ? '▶' : '⏸') : (paused ? '▶ Play' : '⏸ Pause')}
            </button>
            {/* A raw speed multiplier is a number a five-year-old cannot use. */}
            {!isPreReader && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-mono">Speed:</span>
                <input
                  type="range"
                  min="100"
                  max="20000"
                  step="100"
                  value={timeScale}
                  onChange={(e) => setTimeScale(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            )}
          </div>

          {/* Display toggles and the scale selector are adult chrome — hidden
              for pre-readers (reader-fit rule 7). */}
          {!isPreReader && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input type="checkbox" checked={showOrbits} onChange={(e) => setShowOrbits(e.target.checked)} className="rounded" />
                  Orbits
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="rounded" />
                  Labels
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input type="checkbox" checked={showDistances} onChange={(e) => setShowDistances(e.target.checked)} className="rounded" />
                  Distances
                </label>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-mono">Scale:</span>
                <select
                  value={scaleMode}
                  onChange={(e) => setScaleMode(e.target.value as 'size_accurate' | 'distance_accurate' | 'hybrid')}
                  className="bg-white/5 hover:bg-white/10 text-white rounded-lg px-2 py-1 text-xs border border-white/20 transition-colors"
                >
                  <option value="hybrid">Hybrid</option>
                  <option value="size_accurate">Size Accurate</option>
                  <option value="distance_accurate">Distance Accurate</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Date Display — a calendar date carries no meaning at K-1. */}
        {!isPreReader && (
          <div
            ref={dateDisplayRef}
            className="glass-panel backdrop-blur-md rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-300 font-mono"
          >
            {displayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// The research card — a tapped body's story and stats
// ============================================================================

interface BodyCardProps {
  body: CelestialBody;
  isPreReader: boolean;
  onClose: () => void;
  /** Explore face only: the tutor reads the card aloud. The judged face passes
   *  nothing — an improvised read-aloud send mid-item is deleted choreography. */
  onReadAloud?: (text: string) => void;
  readAloudSpeaking?: boolean;
}

const BodyCard: React.FC<BodyCardProps> = ({ body, isPreReader, onClose, onReadAloud, readAloudSpeaking }) => (
  <div className="mt-6 glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: body.color }} />
    <div className="relative z-10 pt-2">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-2xl font-light text-white mb-2">{body.name}</h4>
          <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-[10px] font-mono tracking-widest uppercase">
            {body.type.replace('-', ' ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <p className="text-slate-300 leading-relaxed flex-1">{body.description}</p>
        {onReadAloud && (
          <LuminaReadAloud
            iconOnly
            size={isPreReader ? 'lg' : 'sm'}
            accent="cyan"
            speaking={!!readAloudSpeaking}
            aria-label={`Tell me about ${body.name}`}
            className="flex-shrink-0"
            onClick={() => onReadAloud(
              `${body.name}. ${body.description}`
              + `${body.funFact ? ` Here is a fun fact. ${body.funFact}` : ''}`,
            )}
          />
        )}
      </div>

      {body.funFact && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-2">💡 Fun Fact</div>
          <div className="text-white text-sm font-light">{body.funFact}</div>
        </div>
      )}

      {/* Six numeric stats are the densest adult chrome here and mean nothing
          to a K-1 child; NOT rendered rather than CSS-hidden. This grid is ALSO
          the research instrument for the most-moons and hottest facets, which
          is why those items are never built at K-1. */}
      {!isPreReader && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {body.distanceAu > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
              <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Distance from Sun</div>
              <div className="text-white font-light text-lg">{body.distanceAu.toFixed(2)} AU</div>
            </div>
          )}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
            <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Radius</div>
            <div className="text-white font-light text-lg">{body.radiusKm.toLocaleString()} km</div>
          </div>
          {body.orbitalPeriodDays > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
              <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Year (Orbit)</div>
              <div className="text-white font-light text-lg">{body.orbitalPeriodDays.toFixed(0)} days</div>
            </div>
          )}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
            <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Day (Rotation)</div>
            <div className="text-white font-light text-lg">{body.rotationPeriodHours.toFixed(1)} hrs</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
            <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Temperature</div>
            <div className="text-white font-light text-lg">{body.temperatureC}°C</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
            <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Moons</div>
            <div className="text-white font-light text-lg">{body.moons}</div>
          </div>
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// EXPLORE face — the original free-exploration surface, unchanged behaviour
// ============================================================================

interface ExploreFaceProps {
  data: SolarSystemExplorerData;
  isPreReader: boolean;
  resolvedInstanceId: string;
}

const ExploreFace: React.FC<ExploreFaceProps> = ({ data, isPreReader, resolvedInstanceId }) => {
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(data.focusBody || null);

  const selectedBody = useMemo(
    () => data.bodies.find((b) => b.id === selectedBodyId) ?? null,
    [data.bodies, selectedBodyId],
  );

  const aiPrimitiveData = useMemo(() => ({
    // The catalog's tutoring block interpolates challengeType + stimulus only;
    // free exploration fills both so no template key ever reads "(not set)".
    challengeType: 'free_explore',
    stimulus: `a live model of the solar system showing ${data.bodies.map((b) => b.name).join(', ')}; `
      + 'the learner taps a body to hear about it',
    title: data.title,
    selectedBodyName: selectedBody?.name ?? 'nothing yet',
    ...(data.supportTier ? { supportTier: data.supportTier } : {}),
  }), [data.title, data.bodies, data.supportTier, selectedBody]);

  const { sendText, isAudioPlaying } = useLuminaAI({
    primitiveType: 'solar-system-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
  });

  // Read-aloud: silent like every system trigger — `silent` suppresses only the
  // chat-transcript entry; the socket payload is unchanged, so the tutor speaks.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    sendText(
      `[SOLAR_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. `
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
      `[SOLAR_ORIENT] A ${isPreReader ? 'pre-reader who cannot read any text' : 'student'} just opened `
      + `a solar system model showing: ${data.bodies.map((b) => b.name).join(', ')}. `
      + `They tap a planet to learn about it. Tell them what to do in child words, warmly.`
      + `${isPreReader ? ' Never speak a measurement to them — no kilometres, AU, degrees or day counts.' : ''}`,
      { silent: true },
    );
  }, [sendText, isPreReader, data.bodies]);

  // Tapping a body: the tutor names it and says one child-sized thing.
  const lastAnnouncedBodyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedBody) return;
    if (lastAnnouncedBodyRef.current === selectedBody.id) return;
    lastAnnouncedBodyRef.current = selectedBody.id;
    sendText(
      `[SOLAR_BODY_SELECTED] The student tapped ${selectedBody.name}. `
      + `Say its name and ONE short child-sized thing about it. `
      + `Do not ask a question and do not list numbers.`,
      { silent: true },
    );
  }, [selectedBody, sendText]);

  return (
    <>
      <SolarCanvas
        bodies={data.bodies}
        isPreReader={isPreReader}
        initialZoom={data.initialZoom}
        initialTimeScale={data.timeScale || 5000}
        initialShowOrbits={data.showOrbits !== false}
        initialShowLabels={data.showLabels !== false}
        initialShowDistances={data.showDistances || false}
        initialScaleMode={data.scaleMode || 'hybrid'}
        showHabitableZone={data.showHabitableZone}
        dateTime={data.dateTime}
        selectedBodyId={selectedBodyId}
        onBodyTap={setSelectedBodyId}
      />
      {selectedBody && (
        <BodyCard
          body={selectedBody}
          isPreReader={isPreReader}
          onClose={() => setSelectedBodyId(null)}
          onReadAloud={readAloud}
          readAloudSpeaking={isAudioPlaying}
        />
      )}
    </>
  );
};

// ============================================================================
// JUDGED face — the DI modality
// ============================================================================

interface JudgedFaceProps {
  data: SolarSystemExplorerData;
  items: SolarItem[];
  rung: SolarBand;
  isPreReader: boolean;
  resolvedInstanceId: string;
}

const JudgedFace: React.FC<JudgedFaceProps> = ({ data, items, rung, isPreReader, resolvedInstanceId }) => {
  // ── Stage-payload state (the runner owns progression; this is the sky) ────
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  /** The runner-gated stimulus: which item's spotlight is on screen. */
  const [presentedItemId, setPresentedItemId] = useState<string | null>(null);
  /** Post-affirm only. NOT cleared when the next item opens — that clear and
   *  the `onAffirmed` that set it land in one React batch (18b).
   *  `runner.revealHeld` is the render gate. */
  const [reward, setReward] = useState<{ text: string; bodyIds: string[] } | null>(null);
  const exploredBodiesRef = useRef<Set<string>>(new Set());

  const evaluation = usePrimitiveEvaluation<SolarSystemExplorerMetrics>({
    primitiveType: 'solar-system-explorer',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const pack = useMemo<JudgedScriptPack<SolarItem>>(() => ({
    ...solarSystemPackBase(items),
    passThreshold: 70,
    statusLines: {
      ready: () => 'Listen, then say the planet\'s name out loud.',
      retry: () => 'Have another go — say the planet\'s name.',
      done: 'Great sky-watching today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge: `${item.kind}/${item.facet}: ${askFor(item)}`,
      expected: item.answerNames.join(' / '),
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.',
    }),
  }), [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const kindCounts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.kind] = (acc[item.kind] ?? 0) + 1;
      return acc;
    }, {});
    const dominantMode = Object.entries(kindCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    const metrics: SolarSystemExplorerMetrics = {
      type: 'solar-system-explorer',
      evalMode: dominantMode,
      totalChallenges: items.length,
      correctChallenges: summary.solvedCount,
      totalAttempts: summary.attemptsCount,
      accuracy: summary.accuracy,
      bodiesExplored: exploredBodiesRef.current.size,
      durationMs: evaluation.elapsedMs,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useJudgedScriptRunner<SolarItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: rung === 'K' ? 'Kindergarten' : `Grade ${rung}`,
    exhibitId: data.exhibitId,
    onFinished: handleFinished,
    onItemOpened: () => {
      setSelectedBodyId(null);
      setPresentedItemId(null);
    },
    onAffirmed: (item) => {
      // The first moment the answer may appear on screen.
      setReward({ text: revealTextFor(item), bodyIds: item.answerBodyIds });
    },
    // The spotlight waits on HER voice: it paints only after the ask for this
    // item has been spoken (and re-paints after a correction, on the same gate).
    onPresentStimulus: (item) => setPresentedItemId(item.id),
    stimulus: {
      when: (item) => item.kind === 'identify' || isPairFacet(item.facet),
    },
  });

  const currentItem = runner.currentItem;

  // A tap is LOOKING: it opens the research card (where the band allows one)
  // and counts as exploration. It never commits anything.
  const handleBodyTap = useCallback((bodyId: string) => {
    exploredBodiesRef.current.add(bodyId);
    setSelectedBodyId((prev) => (prev === bodyId ? null : bodyId));
  }, []);

  const spotlightBodyIds = useMemo(() => {
    if (!currentItem || presentedItemId !== currentItem.id) return [];
    if (currentItem.kind === 'identify') return [currentItem.targetBodyId];
    return currentItem.pairBodyIds;
  }, [currentItem, presentedItemId]);

  const revealBodyIds = runner.revealHeld && reward ? reward.bodyIds : [];

  // The identify label withhold (defect 11, in pixels): while an identify item
  // is on screen, no body may wear its printed name — except the reveal.
  const suppressLabels = currentItem?.kind === 'identify';

  // The research card would answer an identify item outright (it prints the
  // body's name); on other kinds it is the model's own reference material,
  // exactly as tappable as it was in the click era.
  const selectedBody = useMemo(
    () => data.bodies.find((b) => b.id === selectedBodyId) ?? null,
    [data.bodies, selectedBodyId],
  );
  const showCard = !!selectedBody && !isPreReader && currentItem?.kind !== 'identify'
    && !evaluation.hasSubmitted;

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => (
      PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🪐' }
    ));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  const stageWord = runner.stage === 'judging'
    ? 'let\'s see…'
    : runner.currentSolved
      ? 'yes!'
      : runner.running
        ? 'say it out loud'
        : 'get ready';

  return (
    <>
      {!evaluation.hasSubmitted && (
        <>
          <div className="mb-3 flex items-center gap-2">
            {/* Progress dots — adult chrome at K-1, where the tutor's voice is
                the whole frame. */}
            {!isPreReader && (
              <>
                {items.map((item, i) => {
                  const done = runner.solvedIds.has(item.id);
                  return (
                    <span
                      key={item.id}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        i === runner.currentIndex ? 'w-8 bg-blue-400'
                          : done ? 'w-2.5 bg-emerald-400'
                          : 'w-2.5 bg-white/20'
                      }`}
                    />
                  );
                })}
                <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  {Math.min(runner.currentIndex + 1, items.length)} / {items.length}
                </span>
              </>
            )}
            {/* Tap-to-hear — the QUESTION again, never a hint ladder. Never
                withdrawn by band or tier. */}
            <button
              type="button"
              onClick={runner.hearStimulus}
              className={`ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 border-2 border-amber-500/30 hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all ${
                runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''
              }`}
              aria-label="Hear the question again"
            >
              <span className="text-xl">🔁</span>
            </button>
          </div>

          <SolarCanvas
            bodies={data.bodies}
            isPreReader={isPreReader}
            initialZoom={data.initialZoom}
            initialTimeScale={data.timeScale || 5000}
            initialShowOrbits={data.showOrbits !== false}
            initialShowLabels={data.showLabels !== false}
            initialShowDistances={data.showDistances || false}
            initialScaleMode={data.scaleMode || 'hybrid'}
            showHabitableZone={data.showHabitableZone}
            dateTime={data.dateTime}
            selectedBodyId={selectedBodyId}
            onBodyTap={handleBodyTap}
            suppressLabels={suppressLabels}
            spotlightBodyIds={spotlightBodyIds}
            revealBodyIds={revealBodyIds}
          />

          {/* The reveal — the first moment an answer may appear. Gated on
              `revealHeld`, never on `currentSolved` (18b). */}
          {reward && runner.revealHeld && (
            <div className="mt-4 glass-panel rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
              <span className="text-emerald-300 text-2xl font-black animate-bounce inline-block">
                {reward.text}
              </span>
            </div>
          )}

          <div className="mt-4 text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

          {!isPreReader && (
            <p className="mt-1 text-center text-xs text-slate-500">
              Look at the sky, zoom and tap around — then say your answer out loud.
            </p>
          )}

          {/* The orb tells the truth: every item in this pack is spoken. */}
          <div className="mt-3">
            <JudgedMicPanel run={runner} />
          </div>

          {showCard && selectedBody && (
            <BodyCard
              body={selectedBody}
              isPreReader={isPreReader}
              onClose={() => setSelectedBodyId(null)}
            />
          )}
        </>
      )}

      {evaluation.hasSubmitted && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          className="mt-4"
          phases={phaseResults}
          overallScore={evaluation.submittedResult?.score}
          durationMs={evaluation.elapsedMs}
          heading="Your Space Journey"
          celebrationMessage="You called the planets by name — out loud, like a real astronomer!"
        />
      )}
    </>
  );
};

// ============================================================================
// Component
// ============================================================================

const VALID_RUNGS: readonly SolarBand[] = ['K', '1', '2', '3', '4', '5'];

const SolarSystemExplorer: React.FC<SolarSystemExplorerProps> = ({ data, className = '' }) => {
  const rung: SolarBand = VALID_RUNGS.includes(data.gradeLevel as SolarBand)
    ? (data.gradeLevel as SolarBand)
    : '3';
  const isPreReader = rung === 'K' || rung === '1';

  const stableInstanceIdRef = useRef(
    data.instanceId || `solar-system-explorer-${Math.round(performance.now())}`,
  );
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

  // The judged items — challenges that survive the build gates. All-dropped is
  // an honest degrade to exploration: shipping a broken ask would put a wrong
  // line in the tutor's mouth, and free exploration is this primitive's floor.
  const built = useMemo(
    () => itemsFromChallenges(data.challenges ?? [], { bodies: data.bodies, rung }),
    [data.challenges, data.bodies, rung],
  );
  const isJudged = built.items.length > 0;

  useEffect(() => {
    if ((data.challenges?.length ?? 0) > 0 && !isJudged) {
      console.warn(
        `[SolarSystemExplorer] all ${data.challenges?.length} challenges dropped by the build gates — running as free exploration`,
      );
    }
  }, [data.challenges, isJudged]);

  return (
    <div className={`w-full ${className}`}>
      <div className="max-w-7xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 bg-blue-500" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 bg-purple-500" />

        <div className="relative z-10">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Astronomy:</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-blue-500/20 text-blue-300 border-blue-500/30">
                {isJudged ? 'CHALLENGE' : 'EXPLORE'}
              </span>
              {isJudged && (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                  Say it out loud
                </span>
              )}
            </div>
            <h3 className="text-3xl font-light text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 leading-relaxed">{data.description}</p>
          </div>

          {isJudged ? (
            <JudgedFace
              data={data}
              items={built.items}
              rung={rung}
              isPreReader={isPreReader}
              resolvedInstanceId={resolvedInstanceId}
            />
          ) : (
            <ExploreFace
              data={data}
              isPreReader={isPreReader}
              resolvedInstanceId={resolvedInstanceId}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Star background component - memoized to prevent unnecessary re-renders
const StarBackground = React.memo(({
  width,
  height,
  transform,
}: {
  width: number;
  height: number;
  transform: { x: number; y: number; k: number };
}) => {
  const stars = useMemo(() => {
    const s = [];
    for (let i = 0; i < 400; i++) {
      s.push({
        x: Math.random() * 3000 - 1500,
        y: Math.random() * 3000 - 1500,
        r: Math.random() * 1.5,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }
    return s;
  }, []);

  return (
    <svg width={width} height={height} className="absolute top-0 left-0 pointer-events-none">
      <g
        transform={`translate(${transform.x * 0.1 + width / 2}, ${transform.y * 0.1 + height / 2}) scale(${Math.max(0.3, transform.k * 0.1)})`}
      >
        {stars.map((star, i) => (
          <circle key={i} cx={star.x} cy={star.y} r={star.r} fill="white" opacity={star.opacity} />
        ))}
      </g>
    </svg>
  );
});
StarBackground.displayName = 'StarBackground';

export default SolarSystemExplorer;
