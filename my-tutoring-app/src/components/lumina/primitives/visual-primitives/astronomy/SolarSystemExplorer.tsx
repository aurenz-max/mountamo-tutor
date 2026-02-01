'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';

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
}

interface SolarSystemExplorerProps {
  data: SolarSystemExplorerData;
  className?: string;
}

const SolarSystemExplorer: React.FC<SolarSystemExplorerProps> = ({ data, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(data.focusBody || null);
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState(data.timeScale || 5000);
  const [showOrbits, setShowOrbits] = useState(data.showOrbits !== false);
  const [showLabels, setShowLabels] = useState(data.showLabels !== false);
  const [showDistances, setShowDistances] = useState(data.showDistances || false);
  const [scaleMode, setScaleMode] = useState<'size_accurate' | 'distance_accurate' | 'hybrid'>(
    data.scaleMode || 'hybrid'
  );
  const [paused, setPaused] = useState(false);
  const [compareBody1, setCompareBody1] = useState<string | null>(null);
  const [compareBody2, setCompareBody2] = useState<string | null>(null);

  // Animation state - use refs to avoid re-renders during animation
  const simulationDateRef = useRef(data.dateTime ? new Date(data.dateTime) : new Date());
  const [displayDate, setDisplayDate] = useState(simulationDateRef.current);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const bodyGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const dateDisplayRef = useRef<HTMLDivElement>(null);

  // Base scale: 1 AU = pixels
  const AU_TO_PIXELS = 180;

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

    // Initial transform based on initialZoom
    let initialScale = 0.3;
    if (data.initialZoom === 'inner') initialScale = 0.8;
    else if (data.initialZoom === 'outer') initialScale = 0.15;
    else if (data.initialZoom === 'planet') initialScale = 2;

    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(initialScale);

    svg.call(zoom.transform, initialTransform);
  }, [dimensions.width, dimensions.height, data.initialZoom]);

  // Animation loop - uses direct DOM manipulation for smooth 60fps animation
  useEffect(() => {
    let frameCount = 0;

    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined && !paused) {
        const deltaTime = time - previousTimeRef.current;
        const timeToAdd = timeScale * deltaTime * 100;

        // Update the simulation date (ref only, no React re-render)
        simulationDateRef.current = new Date(simulationDateRef.current.getTime() + timeToAdd);

        // Direct DOM manipulation for planet positions - bypasses React reconciliation
        bodyGroupRefs.current.forEach((element, bodyId) => {
          const body = data.bodies.find(b => b.id === bodyId);
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

        // Update date display every 30 frames (~500ms) to avoid layout thrashing
        frameCount++;
        if (frameCount % 30 === 0 && dateDisplayRef.current) {
          dateDisplayRef.current.textContent = simulationDateRef.current.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
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
  }, [paused, timeScale, data.bodies]);

  // Calculate initial position based on orbital period
  const getInitialPosition = useCallback((body: CelestialBody) => {
    if (body.distanceAu === 0) return { x: 0, y: 0 }; // Sun at center

    const periodMs = body.orbitalPeriodDays * 24 * 60 * 60 * 1000;
    const time = simulationDateRef.current.getTime();
    const angle = ((time % periodMs) / periodMs) * 2 * Math.PI;

    const r = body.distanceAu * AU_TO_PIXELS;
    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    };
  }, []);

  // Callback to register body group refs for direct DOM manipulation
  const setBodyRef = useCallback((bodyId: string, element: SVGGElement | null) => {
    if (element) {
      bodyGroupRefs.current.set(bodyId, element);
    } else {
      bodyGroupRefs.current.delete(bodyId);
    }
  }, []);

  // Visual radius based on scale mode
  const getVisualRadius = (body: CelestialBody) => {
    if (body.type === 'star') {
      return scaleMode === 'size_accurate' ? 30 : 35;
    }

    if (scaleMode === 'size_accurate') {
      // Logarithmic scale for visibility
      return Math.max(3, Math.log(body.radiusKm) * 1.8);
    } else if (scaleMode === 'distance_accurate') {
      // Very small but proportional
      return Math.max(2, body.radiusKm * 0.0003);
    } else {
      // Hybrid: balanced visibility
      return Math.max(4, Math.log(body.radiusKm) * 1.5);
    }
  };

  const selectedBody = data.bodies.find((b) => b.id === selectedBodyId);

  // Habitable zone calculation (simplified: 0.95 AU to 1.37 AU for Sun-like star)
  const habitableZoneInner = 0.95 * AU_TO_PIXELS;
  const habitableZoneOuter = 1.37 * AU_TO_PIXELS;

  return (
    <div className={`w-full ${className}`}>
      <div className="max-w-7xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 bg-blue-500" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 bg-purple-500" />

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Astronomy:</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-blue-500/20 text-blue-300 border-blue-500/30">
                EXPLORE
              </span>
            </div>
            <h3 className="text-3xl font-light text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 leading-relaxed">{data.description}</p>
          </div>

          {/* Main Viewer */}
          <div className="relative glass-panel rounded-2xl border border-white/10 overflow-hidden" style={{ height: '600px' }}>
            <div ref={containerRef} className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing bg-black/40">
              <StarBackground width={dimensions.width} height={dimensions.height} transform={transform} />

              <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="absolute top-0 left-0">
                <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                  {/* Habitable Zone */}
                  {data.showHabitableZone && (
                    <g opacity={0.2}>
                      <circle cx={0} cy={0} r={habitableZoneOuter} fill="none" stroke="#22c55e" strokeWidth={20 / transform.k} />
                      <circle cx={0} cy={0} r={habitableZoneInner} fill="none" stroke="#22c55e" strokeWidth={20 / transform.k} />
                      <circle cx={0} cy={0} r={(habitableZoneInner + habitableZoneOuter) / 2} fill="none" stroke="#22c55e" strokeWidth={1 / transform.k} strokeDasharray="4 4" />
                    </g>
                  )}

                  {/* Orbits */}
                  {showOrbits &&
                    data.bodies.map((body) => {
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

                  {/* Bodies */}
                  {data.bodies.map((body) => {
                    const pos = getInitialPosition(body);
                    const r = getVisualRadius(body);
                    const isSelected = selectedBodyId === body.id;
                    const isHovered = hoveredBodyId === body.id;
                    const isCompare = compareBody1 === body.id || compareBody2 === body.id;

                    return (
                      <g
                        key={body.id}
                        ref={(el) => setBodyRef(body.id, el)}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBodyId(body.id);
                        }}
                        onMouseEnter={() => setHoveredBodyId(body.id)}
                        onMouseLeave={() => setHoveredBodyId(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Glow for Sun */}
                        {body.type === 'star' && <circle r={r * 3} fill="url(#sunGlow)" opacity={0.6} />}

                        {/* Hover Glow */}
                        {isHovered && !isSelected && (
                          <circle
                            r={r * 2}
                            fill={body.color}
                            opacity={0.3}
                          />
                        )}

                        {/* Selection Indicator */}
                        {isSelected && (
                          <>
                            <circle
                              r={r * 2.5}
                              fill={body.color}
                              opacity={0.2}
                            />
                            <circle
                              r={r * 1.5 + 5}
                              fill="none"
                              stroke="white"
                              strokeWidth={2 / transform.k}
                              strokeDasharray="4 2"
                            />
                          </>
                        )}

                        {/* Compare Indicator */}
                        {isCompare && (
                          <circle
                            r={r * 1.5 + 8}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={2 / transform.k}
                          />
                        )}

                        {/* The Body */}
                        <circle
                          r={r}
                          fill={body.color}
                          stroke={isSelected ? 'white' : isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                          strokeWidth={isHovered || isSelected ? 2 / transform.k : 1 / transform.k}
                        />

                        {/* Gradient Overlay */}
                        <circle r={r} fill={`url(#planetGradient-${body.id})`} opacity={0.7} />

                        {/* Label */}
                        {showLabels && (transform.k > 0.4 || isSelected || isHovered) && (
                          <text
                            y={r + 14 / transform.k}
                            textAnchor="middle"
                            fill="white"
                            fontSize={(isHovered || isSelected ? 12 : 11) / transform.k}
                            className="select-none pointer-events-none font-medium"
                            style={{
                              textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                              fontWeight: isHovered || isSelected ? 600 : 500
                            }}
                          >
                            {body.name}
                          </text>
                        )}

                        {/* Distance Label */}
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

                {/* Gradients */}
                <defs>
                  <radialGradient id="sunGlow">
                    <stop offset="0%" stopColor="#FDB813" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FDB813" stopOpacity="0" />
                  </radialGradient>
                  {data.bodies.map((body) => (
                    <radialGradient id={`planetGradient-${body.id}`} key={`grad-${body.id}`} cx="30%" cy="30%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                      <stop offset="70%" stopColor="black" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="black" stopOpacity="0.6" />
                    </radialGradient>
                  ))}
                </defs>
              </svg>

              {/* Help Text */}
              <div className="absolute top-4 right-4 glass-panel backdrop-blur-md px-3 py-2 rounded-lg border border-white/20 text-xs text-slate-300 pointer-events-none">
                Scroll to Zoom • Drag to Pan • Click Planets
              </div>
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
              {/* Left Controls */}
              <div className="glass-panel backdrop-blur-md rounded-xl border border-white/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaused(!paused)}
                    className="px-3 py-1.5 bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/30 text-white rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105"
                  >
                    {paused ? '▶ Play' : '⏸ Pause'}
                  </button>
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
                </div>

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
                    onChange={(e) => setScaleMode(e.target.value as any)}
                    className="bg-white/5 hover:bg-white/10 text-white rounded-lg px-2 py-1 text-xs border border-white/20 transition-colors"
                  >
                    <option value="hybrid">Hybrid</option>
                    <option value="size_accurate">Size Accurate</option>
                    <option value="distance_accurate">Distance Accurate</option>
                  </select>
                </div>
              </div>

              {/* Date Display */}
              <div
                ref={dateDisplayRef}
                className="glass-panel backdrop-blur-md rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-300 font-mono"
              >
                {displayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          {selectedBody && (
            <div className="mt-6 glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden">
              {/* Accent bar */}
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ backgroundColor: selectedBody.color }}
              />

              <div className="relative z-10 pt-2">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-2xl font-light text-white mb-2">{selectedBody.name}</h4>
                    <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-[10px] font-mono tracking-widest uppercase">
                      {selectedBody.type.replace('-', ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedBodyId(null)}
                    className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-slate-300 mb-4 leading-relaxed">{selectedBody.description}</p>

                {selectedBody.funFact && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-2">💡 Fun Fact</div>
                    <div className="text-white text-sm font-light">{selectedBody.funFact}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedBody.distanceAu > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                      <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Distance from Sun</div>
                      <div className="text-white font-light text-lg">{selectedBody.distanceAu.toFixed(2)} AU</div>
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Radius</div>
                    <div className="text-white font-light text-lg">{selectedBody.radiusKm.toLocaleString()} km</div>
                  </div>
                  {selectedBody.orbitalPeriodDays > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                      <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Year (Orbit)</div>
                      <div className="text-white font-light text-lg">{selectedBody.orbitalPeriodDays.toFixed(0)} days</div>
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Day (Rotation)</div>
                    <div className="text-white font-light text-lg">{selectedBody.rotationPeriodHours.toFixed(1)} hrs</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Temperature</div>
                    <div className="text-white font-light text-lg">{selectedBody.temperatureC}°C</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all duration-300">
                    <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest font-mono">Moons</div>
                    <div className="text-white font-light text-lg">{selectedBody.moons}</div>
                  </div>
                </div>
              </div>
            </div>
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

export default SolarSystemExplorer;
