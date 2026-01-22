'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Gear Train Builder - Interactive gear system sandbox for teaching simple machines
 *
 * K-5 Engineering Primitive for understanding:
 * - Gears turn together (K-1)
 * - Direction changes with each gear (1-2)
 * - Big gear turns slow gear fast (2-3)
 * - Counting teeth for ratios (3-4)
 * - Design challenges: specific output speed (4-5)
 *
 * Real-world connections: bicycle gears, clock mechanisms, wind-up toys, car transmissions
 */

export interface Gear {
  id: string;
  x: number;           // Grid column position
  y: number;           // Grid row position
  teeth: number;       // Number of teeth (determines size)
  color: string;       // Gear color
  isDriver?: boolean;  // Is this the input gear?
}

export interface GearTrainBuilderData {
  title: string;
  description: string;
  availableGears: number[];      // Gear sizes available (by tooth count)
  gridSize: [number, number];    // [rows, cols] workspace dimensions
  initialGears?: Gear[];         // Pre-placed gears for guided scenarios
  driverGearId?: string;         // Which gear receives input (by id)
  showTeethCount: boolean;       // Label gear teeth
  showSpeedRatio: boolean;       // Display rotation ratio
  showDirection: boolean;        // Indicate CW/CCW
  targetRatio?: number;          // Goal for design challenges (null = free play)
  maxGears: number;              // Limit for scaffolded problems
  theme: 'toy' | 'machine' | 'clock' | 'bicycle';
  allowAddGears?: boolean;       // Can students add new gears
  allowRemoveGears?: boolean;    // Can students remove gears
}

interface GearTrainBuilderProps {
  data: GearTrainBuilderData;
  className?: string;
}

// Constants for gear visualization
const CELL_SIZE = 80;
const TOOTH_SIZE_FACTOR = 4; // pixels per tooth for radius calculation
const MIN_TEETH = 8;
const MAX_TEETH = 32;

const GearTrainBuilder: React.FC<GearTrainBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    availableGears = [8, 12, 16, 24],
    gridSize = [4, 6],
    initialGears = [],
    driverGearId,
    showTeethCount = true,
    showSpeedRatio = true,
    showDirection = true,
    targetRatio,
    maxGears = 6,
    theme = 'toy',
    allowAddGears = true,
    allowRemoveGears = true,
  } = data;

  const [gears, setGears] = useState<Gear[]>(initialGears);
  const [selectedGearSize, setSelectedGearSize] = useState<number>(availableGears[0] || 12);
  const [driverId, setDriverId] = useState<string | null>(driverGearId || null);
  const [driverRotation, setDriverRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | null>(null);

  const [rows, cols] = gridSize;
  const svgWidth = cols * CELL_SIZE + 100;
  const svgHeight = rows * CELL_SIZE + 100;

  // Calculate gear radius from tooth count
  const getGearRadius = (teeth: number) => teeth * TOOTH_SIZE_FACTOR / 2;

  // Get theme-specific colors
  const getThemeStyles = () => {
    switch (theme) {
      case 'toy':
        return {
          backgroundColor: '#1E1B4B',
          gridColor: '#4338CA',
          accentColor: '#F472B6',
          gearColors: ['#F472B6', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24'],
          icon: '🧸',
        };
      case 'machine':
        return {
          backgroundColor: '#18181B',
          gridColor: '#3F3F46',
          accentColor: '#F59E0B',
          gearColors: ['#71717A', '#A1A1AA', '#52525B', '#78716C', '#6B7280'],
          icon: '🏭',
        };
      case 'clock':
        return {
          backgroundColor: '#1C1917',
          gridColor: '#44403C',
          accentColor: '#D4AF37',
          gearColors: ['#D4AF37', '#B8860B', '#DAA520', '#CD853F', '#DEB887'],
          icon: '🕐',
        };
      case 'bicycle':
        return {
          backgroundColor: '#0F172A',
          gridColor: '#1E40AF',
          accentColor: '#22D3EE',
          gearColors: ['#94A3B8', '#64748B', '#475569', '#334155', '#6B7280'],
          icon: '🚲',
        };
      default:
        return {
          backgroundColor: '#0F172A',
          gridColor: '#1E3A8A',
          accentColor: '#22D3EE',
          gearColors: ['#22D3EE', '#A78BFA', '#F472B6', '#34D399', '#FBBF24'],
          icon: '⚙️',
        };
    }
  };

  const themeStyles = getThemeStyles();

  // Check if two gears are meshed (touching)
  const areGearsMeshed = (gear1: Gear, gear2: Gear): boolean => {
    const r1 = getGearRadius(gear1.teeth);
    const r2 = getGearRadius(gear2.teeth);
    const x1 = gear1.x * CELL_SIZE + CELL_SIZE / 2;
    const y1 = gear1.y * CELL_SIZE + CELL_SIZE / 2;
    const x2 = gear2.x * CELL_SIZE + CELL_SIZE / 2;
    const y2 = gear2.y * CELL_SIZE + CELL_SIZE / 2;

    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const meshDistance = r1 + r2;

    // Allow 20% tolerance for meshing
    return distance <= meshDistance * 1.2 && distance >= meshDistance * 0.8;
  };

  // Build connected gear graph from driver
  const buildGearChain = useCallback((): Map<string, { gear: Gear; speedRatio: number; direction: 1 | -1 }> => {
    const chain = new Map<string, { gear: Gear; speedRatio: number; direction: 1 | -1 }>();

    if (!driverId) return chain;

    const driverGear = gears.find(g => g.id === driverId);
    if (!driverGear) return chain;

    // BFS to find all connected gears
    const visited = new Set<string>();
    const queue: Array<{ gear: Gear; speedRatio: number; direction: 1 | -1 }> = [
      { gear: driverGear, speedRatio: 1, direction: 1 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.gear.id)) continue;

      visited.add(current.gear.id);
      chain.set(current.gear.id, current);

      // Find meshed gears
      for (const otherGear of gears) {
        if (visited.has(otherGear.id)) continue;
        if (areGearsMeshed(current.gear, otherGear)) {
          // Speed ratio: driven teeth / driver teeth
          const newSpeedRatio = current.speedRatio * (current.gear.teeth / otherGear.teeth);
          // Direction reverses with each mesh
          const newDirection: 1 | -1 = current.direction === 1 ? -1 : 1;

          queue.push({
            gear: otherGear,
            speedRatio: newSpeedRatio,
            direction: newDirection,
          });
        }
      }
    }

    return chain;
  }, [gears, driverId]);

  // Calculate gear rotations based on chain
  const calculateGearRotations = useCallback((driverAngle: number) => {
    const chain = buildGearChain();
    const rotations: Map<string, number> = new Map();

    chain.forEach((info, gearId) => {
      rotations.set(gearId, driverAngle * info.speedRatio * info.direction);
    });

    return rotations;
  }, [buildGearChain]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = () => {
      setDriverRotation(prev => (prev + 2) % 360);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating]);

  // Get overall gear ratio (last gear speed / driver speed)
  const getOverallRatio = (): number | null => {
    const chain = buildGearChain();
    if (chain.size < 2) return null;

    let lastGearInfo: { speedRatio: number } | null = null;
    chain.forEach((info) => {
      lastGearInfo = info;
    });

    return lastGearInfo ? Math.abs(lastGearInfo.speedRatio) : null;
  };

  // Check if target ratio is achieved
  const checkTargetRatio = useCallback(() => {
    if (!targetRatio) return;

    const currentRatio = getOverallRatio();
    if (currentRatio && Math.abs(currentRatio - targetRatio) < 0.1) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [targetRatio]);

  useEffect(() => {
    checkTargetRatio();
  }, [gears, checkTargetRatio]);

  // Add gear at position
  const handleAddGear = (gridX: number, gridY: number) => {
    if (!allowAddGears) return;
    if (gears.length >= maxGears) {
      setHint(`Maximum ${maxGears} gears allowed!`);
      setTimeout(() => setHint(null), 2000);
      return;
    }

    // Check if position is occupied
    const occupied = gears.some(g => g.x === gridX && g.y === gridY);
    if (occupied) {
      setHint('This spot is already taken!');
      setTimeout(() => setHint(null), 2000);
      return;
    }

    const newGear: Gear = {
      id: `gear-${Date.now()}`,
      x: gridX,
      y: gridY,
      teeth: selectedGearSize,
      color: themeStyles.gearColors[gears.length % themeStyles.gearColors.length],
      isDriver: gears.length === 0,
    };

    setGears(prev => [...prev, newGear]);

    // Set as driver if first gear
    if (gears.length === 0) {
      setDriverId(newGear.id);
    }
  };

  // Remove gear
  const handleRemoveGear = (gearId: string) => {
    if (!allowRemoveGears) return;

    setGears(prev => prev.filter(g => g.id !== gearId));

    if (driverId === gearId) {
      setDriverId(gears.length > 1 ? gears[0].id : null);
    }
  };

  // Set driver gear
  const handleSetDriver = (gearId: string) => {
    setDriverId(gearId);
    setGears(prev => prev.map(g => ({
      ...g,
      isDriver: g.id === gearId,
    })));
  };

  // Manual rotation
  const handleRotate = (degrees: number) => {
    setDriverRotation(prev => prev + degrees);
  };

  // Reset
  const handleReset = () => {
    setGears(initialGears);
    setDriverId(driverGearId || null);
    setDriverRotation(0);
    setIsAnimating(false);
    setHint(null);
    setShowSuccess(false);
  };

  // Hint
  const handleGetHint = () => {
    const chain = buildGearChain();
    if (gears.length === 0) {
      setHint('Click on the grid to place your first gear! It will be the driver gear.');
    } else if (chain.size < 2) {
      setHint('Place gears close together so their teeth mesh. Connected gears spin together!');
    } else if (targetRatio) {
      const currentRatio = getOverallRatio();
      if (currentRatio) {
        if (currentRatio < targetRatio) {
          setHint(`Current ratio: ${currentRatio.toFixed(2)}:1. Add a bigger gear to increase the ratio!`);
        } else {
          setHint(`Current ratio: ${currentRatio.toFixed(2)}:1. Add a smaller gear to decrease the ratio!`);
        }
      }
    } else {
      setHint('Great gear train! Try making a gear spin faster or slower than the driver.');
    }
    setTimeout(() => setHint(null), 4000);
  };

  // Render a single gear
  const renderGear = (gear: Gear, rotation: number, direction: 1 | -1) => {
    const centerX = gear.x * CELL_SIZE + CELL_SIZE / 2 + 50;
    const centerY = gear.y * CELL_SIZE + CELL_SIZE / 2 + 50;
    const radius = getGearRadius(gear.teeth);
    const toothDepth = radius * 0.15;
    const toothWidth = (2 * Math.PI * radius) / (gear.teeth * 2);

    // Generate gear teeth path
    const teethPath: string[] = [];
    for (let i = 0; i < gear.teeth; i++) {
      const angle = (i * 2 * Math.PI) / gear.teeth;
      const nextAngle = ((i + 0.5) * 2 * Math.PI) / gear.teeth;

      const innerX1 = centerX + Math.cos(angle) * (radius - toothDepth);
      const innerY1 = centerY + Math.sin(angle) * (radius - toothDepth);
      const outerX1 = centerX + Math.cos(angle + 0.1) * (radius + toothDepth);
      const outerY1 = centerY + Math.sin(angle + 0.1) * (radius + toothDepth);
      const outerX2 = centerX + Math.cos(nextAngle - 0.1) * (radius + toothDepth);
      const outerY2 = centerY + Math.sin(nextAngle - 0.1) * (radius + toothDepth);
      const innerX2 = centerX + Math.cos(nextAngle) * (radius - toothDepth);
      const innerY2 = centerY + Math.sin(nextAngle) * (radius - toothDepth);

      if (i === 0) {
        teethPath.push(`M ${innerX1} ${innerY1}`);
      }
      teethPath.push(`L ${outerX1} ${outerY1}`);
      teethPath.push(`L ${outerX2} ${outerY2}`);
      teethPath.push(`L ${innerX2} ${innerY2}`);
    }
    teethPath.push('Z');

    const isDriver = gear.id === driverId;
    const chain = buildGearChain();
    const gearInfo = chain.get(gear.id);
    const speedRatio = gearInfo?.speedRatio || 1;

    return (
      <g key={gear.id} style={{ cursor: 'pointer' }}>
        {/* Gear body with rotation */}
        <g transform={`rotate(${rotation}, ${centerX}, ${centerY})`}>
          {/* Gear teeth */}
          <path
            d={teethPath.join(' ')}
            fill={gear.color}
            stroke={isDriver ? themeStyles.accentColor : '#1E293B'}
            strokeWidth={isDriver ? 3 : 2}
            opacity={0.9}
          />

          {/* Inner circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius * 0.6}
            fill={gear.color}
            stroke="#1E293B"
            strokeWidth={2}
            opacity={0.95}
          />

          {/* Spokes */}
          {[0, 60, 120, 180, 240, 300].map((spokeAngle, i) => (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={centerX + Math.cos(spokeAngle * Math.PI / 180) * radius * 0.55}
              y2={centerY + Math.sin(spokeAngle * Math.PI / 180) * radius * 0.55}
              stroke="#1E293B"
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}

          {/* Center hub */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius * 0.2}
            fill="#1E293B"
            stroke={gear.color}
            strokeWidth={2}
          />

          {/* Center axle hole */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius * 0.08}
            fill={themeStyles.backgroundColor}
          />
        </g>

        {/* Labels (don't rotate) */}
        {showTeethCount && (
          <text
            x={centerX}
            y={centerY + radius + 20}
            textAnchor="middle"
            fontSize={11}
            fill="#94A3B8"
            fontFamily="monospace"
          >
            {gear.teeth} teeth
          </text>
        )}

        {/* Speed ratio indicator */}
        {showSpeedRatio && gearInfo && !isDriver && (
          <g transform={`translate(${centerX}, ${centerY - radius - 15})`}>
            <rect
              x={-25}
              y={-10}
              width={50}
              height={20}
              rx={10}
              fill="rgba(20,184,166,0.2)"
              stroke="rgba(20,184,166,0.5)"
              strokeWidth={1}
            />
            <text
              textAnchor="middle"
              y={4}
              fontSize={10}
              fill="#14B8A6"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {speedRatio.toFixed(1)}x
            </text>
          </g>
        )}

        {/* Direction indicator */}
        {showDirection && gearInfo && (
          <g transform={`translate(${centerX + radius + 10}, ${centerY})`}>
            <text
              textAnchor="start"
              fontSize={16}
              fill={direction === 1 ? '#22C55E' : '#EF4444'}
            >
              {direction === 1 ? '↻' : '↺'}
            </text>
          </g>
        )}

        {/* Driver indicator */}
        {isDriver && (
          <g transform={`translate(${centerX}, ${centerY})`}>
            <circle
              r={radius * 0.25}
              fill={themeStyles.accentColor}
              opacity={0.3}
            />
            <text
              textAnchor="middle"
              y={-radius - 25}
              fontSize={10}
              fill={themeStyles.accentColor}
              fontWeight="bold"
            >
              DRIVER
            </text>
          </g>
        )}

        {/* Click handler for removal/driver selection */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius + toothDepth}
          fill="transparent"
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey && allowRemoveGears) {
              handleRemoveGear(gear.id);
            } else {
              handleSetDriver(gear.id);
            }
          }}
        />
      </g>
    );
  };

  // Calculate all gear rotations
  const gearRotations = calculateGearRotations(driverRotation);
  const chain = buildGearChain();
  const overallRatio = getOverallRatio();

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <span className="text-2xl">{themeStyles.icon}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
            <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
              Interactive Gear Train Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-cyan-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#06B6D4 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Stats Display */}
          <div className="mb-4 flex justify-center gap-4 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
              <span className="text-slate-300 text-sm font-mono">
                Gears: <span className="font-bold text-white">{gears.length}/{maxGears}</span>
              </span>
            </div>

            {overallRatio && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/50">
                <span className="text-cyan-300 text-sm font-mono">
                  Output Ratio: <span className="font-bold">{overallRatio.toFixed(2)}:1</span>
                </span>
              </div>
            )}

            {targetRatio && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                overallRatio && Math.abs(overallRatio - targetRatio) < 0.1
                  ? 'bg-green-500/20 border-green-500/50'
                  : 'bg-amber-500/20 border-amber-500/50'
              } border`}>
                <span className={`text-sm font-mono ${
                  overallRatio && Math.abs(overallRatio - targetRatio) < 0.1
                    ? 'text-green-300'
                    : 'text-amber-300'
                }`}>
                  Target: <span className="font-bold">{targetRatio}:1</span>
                </span>
              </div>
            )}
          </div>

          {/* Gear Size Selector */}
          {allowAddGears && (
            <div className="mb-4 flex justify-center gap-2 flex-wrap">
              <span className="text-slate-400 text-sm self-center mr-2">Select gear size:</span>
              {availableGears.map((teeth) => (
                <button
                  key={teeth}
                  onClick={() => setSelectedGearSize(teeth)}
                  className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                    selectedGearSize === teeth
                      ? 'bg-cyan-500/30 border-cyan-500 text-cyan-300 border-2'
                      : 'bg-slate-700/50 border-slate-600 text-slate-400 border hover:bg-slate-700'
                  }`}
                >
                  {teeth}T
                </button>
              ))}
            </div>
          )}

          {/* SVG Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 border border-slate-700/50">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none"
              style={{ maxHeight: '500px' }}
              onClick={(e) => {
                if (!allowAddGears) return;
                const rect = svgRef.current?.getBoundingClientRect();
                if (!rect) return;

                const scaleX = svgWidth / rect.width;
                const scaleY = svgHeight / rect.height;
                const x = (e.clientX - rect.left) * scaleX - 50;
                const y = (e.clientY - rect.top) * scaleY - 50;

                const gridX = Math.floor(x / CELL_SIZE);
                const gridY = Math.floor(y / CELL_SIZE);

                if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
                  handleAddGear(gridX, gridY);
                }
              }}
            >
              {/* Background */}
              <rect x={0} y={0} width={svgWidth} height={svgHeight} fill={themeStyles.backgroundColor} />

              {/* Grid */}
              <g opacity={0.3}>
                {Array.from({ length: rows + 1 }).map((_, i) => (
                  <line
                    key={`h${i}`}
                    x1={50}
                    y1={50 + i * CELL_SIZE}
                    x2={50 + cols * CELL_SIZE}
                    y2={50 + i * CELL_SIZE}
                    stroke={themeStyles.gridColor}
                    strokeWidth={1}
                  />
                ))}
                {Array.from({ length: cols + 1 }).map((_, i) => (
                  <line
                    key={`v${i}`}
                    x1={50 + i * CELL_SIZE}
                    y1={50}
                    x2={50 + i * CELL_SIZE}
                    y2={50 + rows * CELL_SIZE}
                    stroke={themeStyles.gridColor}
                    strokeWidth={1}
                  />
                ))}
              </g>

              {/* Grid dots (peg positions) */}
              {Array.from({ length: rows }).map((_, row) =>
                Array.from({ length: cols }).map((_, col) => (
                  <circle
                    key={`dot-${row}-${col}`}
                    cx={50 + col * CELL_SIZE + CELL_SIZE / 2}
                    cy={50 + row * CELL_SIZE + CELL_SIZE / 2}
                    r={4}
                    fill={themeStyles.gridColor}
                    opacity={0.5}
                  />
                ))
              )}

              {/* Mesh lines between connected gears */}
              {gears.map((gear1, i) =>
                gears.slice(i + 1).map((gear2) => {
                  if (areGearsMeshed(gear1, gear2)) {
                    const x1 = gear1.x * CELL_SIZE + CELL_SIZE / 2 + 50;
                    const y1 = gear1.y * CELL_SIZE + CELL_SIZE / 2 + 50;
                    const x2 = gear2.x * CELL_SIZE + CELL_SIZE / 2 + 50;
                    const y2 = gear2.y * CELL_SIZE + CELL_SIZE / 2 + 50;
                    return (
                      <line
                        key={`mesh-${gear1.id}-${gear2.id}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={themeStyles.accentColor}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        opacity={0.3}
                      />
                    );
                  }
                  return null;
                })
              )}

              {/* Render gears */}
              {gears.map((gear) => {
                const rotation = gearRotations.get(gear.id) || 0;
                const gearInfo = chain.get(gear.id);
                const direction = gearInfo?.direction || 1;
                return renderGear(gear, rotation, direction);
              })}

              {/* Instructions overlay when empty */}
              {gears.length === 0 && (
                <g transform={`translate(${svgWidth / 2}, ${svgHeight / 2})`}>
                  <rect
                    x={-150}
                    y={-40}
                    width={300}
                    height={80}
                    rx={16}
                    fill="rgba(6,182,212,0.1)"
                    stroke="rgba(6,182,212,0.3)"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                  />
                  <text
                    textAnchor="middle"
                    y={-10}
                    fontSize={14}
                    fill="#06B6D4"
                    fontWeight="bold"
                  >
                    Click on the grid to place gears!
                  </text>
                  <text
                    textAnchor="middle"
                    y={15}
                    fontSize={12}
                    fill="#94A3B8"
                  >
                    First gear becomes the driver
                  </text>
                </g>
              )}
            </svg>

            {/* Success animation overlay */}
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-cyan-500/10 backdrop-blur-sm animate-fade-in">
                <div className="bg-gradient-to-br from-cyan-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(6,182,212,0.5)] animate-bounce">
                  Target Ratio Achieved!
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Rotation Controls */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-mono text-slate-300 mb-3">
                Rotate Driver Gear
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleRotate(-45)}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 rounded-lg font-semibold transition-all"
                >
                  ↺ -45°
                </button>
                <button
                  onClick={() => handleRotate(45)}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 rounded-lg font-semibold transition-all"
                >
                  +45° ↻
                </button>
                <button
                  onClick={() => setIsAnimating(!isAnimating)}
                  className={`px-4 py-2 ${
                    isAnimating
                      ? 'bg-red-500/20 border-red-500/50 text-red-300'
                      : 'bg-green-500/20 border-green-500/50 text-green-300'
                  } border rounded-lg font-semibold transition-all`}
                >
                  {isAnimating ? '⏹ Stop' : '▶ Animate'}
                </button>
              </div>
            </div>

            {/* Rotation slider */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-mono text-slate-300 mb-3">
                Driver Rotation: <span className="text-cyan-400 font-bold">{driverRotation.toFixed(0)}°</span>
              </label>
              <input
                type="range"
                min={0}
                max={720}
                step={15}
                value={driverRotation % 720}
                onChange={(e) => setDriverRotation(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={handleGetHint}
              className="px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center gap-2"
            >
              <span>💡</span> Hint
            </button>

            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all flex items-center gap-2"
            >
              <span>↺</span> Reset
            </button>
          </div>

          {/* Hint Display */}
          {hint && (
            <div className="mb-6 p-4 bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-amber-400 text-lg">💡</span>
                <p className="text-amber-200 text-sm">{hint}</p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mb-6 p-4 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-2">How to Use:</h4>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>• <span className="text-cyan-400">Click on grid</span> to place a gear (first gear = driver)</li>
              <li>• <span className="text-cyan-400">Click on a gear</span> to make it the driver</li>
              {allowRemoveGears && <li>• <span className="text-cyan-400">Shift+Click</span> to remove a gear</li>}
              <li>• Place gears close together to mesh their teeth</li>
            </ul>
          </div>

          {/* Educational Info */}
          <div className="p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              How Gears Work
            </h4>
            <div className="space-y-2">
              <p className="text-slate-300 text-sm">
                Gears are <span className="text-cyan-400 font-semibold">toothed wheels</span> that mesh together
                to transfer motion and force. When gears connect, they spin together!
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-amber-400 font-semibold">Direction:</span> Each gear reverses direction.
                If the driver spins clockwise (↻), the next gear spins counter-clockwise (↺).
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-green-400 font-semibold">Speed Ratio:</span> A small gear meshed with a big gear
                spins faster! The ratio equals (driver teeth) ÷ (driven teeth).
              </p>
              {targetRatio && (
                <p className="text-slate-300 text-sm">
                  <span className="text-purple-400 font-semibold">Challenge:</span> Build a gear train with
                  an output ratio of {targetRatio}:1!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GearTrainBuilder;
