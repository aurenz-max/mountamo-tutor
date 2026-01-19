'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Pulley System Builder - Interactive pulley system for teaching simple machines
 *
 * K-5 Engineering Primitive for understanding:
 * - Ropes and lifting (K-1)
 * - Single pulley direction change (1-2)
 * - Multiple pulleys reduce effort (2-3)
 * - Counting rope segments for MA (3-4)
 * - Pulley system design challenges (4-5)
 *
 * Real-world connections: crane, flagpole, well bucket, construction hoist, elevator
 */

export interface PulleyPosition {
  id: string;
  x: number;           // X position (0-100 normalized)
  y: number;           // Y position (0-100 normalized)
  type: 'fixed' | 'movable';
  radius?: number;     // Visual radius
}

export interface RopeSegment {
  from: string;        // Pulley ID or 'anchor' or 'effort'
  to: string;          // Pulley ID or 'load'
  side?: 'left' | 'right'; // Which side of pulley rope goes through
}

export interface PulleySystemBuilderData {
  title: string;
  description: string;
  fixedPulleys: PulleyPosition[];      // Positions of fixed pulleys (attached to ceiling/frame)
  movablePulleys: PulleyPosition[];    // Positions of movable pulleys (attached to load)
  loadWeight: number;                   // Weight to lift in arbitrary units
  ropeConfiguration: RopeSegment[];     // Threading path
  showForceLabels: boolean;             // Display tension values
  showRopeSegments: boolean;            // Highlight and count segments
  maxPulleys: number;                   // Limit for building mode
  theme: 'crane' | 'flagpole' | 'well' | 'construction';
  allowAddPulleys?: boolean;            // Allow adding new pulleys
  effortForce?: number;                 // Current effort force applied
  showMechanicalAdvantage?: boolean;    // Display MA calculation
  liftHeight?: number;                  // How high the load has lifted (0-100)
  isPulling?: boolean;                  // Is user currently pulling
}

interface PulleySystemBuilderProps {
  data: PulleySystemBuilderData;
  className?: string;
}

const PulleySystemBuilder: React.FC<PulleySystemBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    fixedPulleys: initialFixedPulleys = [],
    movablePulleys: initialMovablePulleys = [],
    loadWeight = 10,
    ropeConfiguration: initialRopeConfig = [],
    showForceLabels = true,
    showRopeSegments = true,
    maxPulleys = 4,
    theme = 'crane',
    allowAddPulleys = false,
    showMechanicalAdvantage = false,
    liftHeight: initialLiftHeight = 0,
  } = data;

  const [fixedPulleys, setFixedPulleys] = useState<PulleyPosition[]>(initialFixedPulleys);
  const [movablePulleys, setMovablePulleys] = useState<PulleyPosition[]>(initialMovablePulleys);
  const [ropeConfiguration] = useState<RopeSegment[]>(initialRopeConfig);
  const [effortForce, setEffortForce] = useState(0);
  const [liftHeight, setLiftHeight] = useState(initialLiftHeight);
  const [isPulling, setIsPulling] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hoveredPulley, setHoveredPulley] = useState<string | null>(null);
  const [selectedPulleyType, setSelectedPulleyType] = useState<'fixed' | 'movable'>('fixed');

  const svgRef = useRef<SVGSVGElement>(null);

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 500;
  const pulleyRadius = 25;

  // Calculate total pulleys
  const totalPulleys = fixedPulleys.length + movablePulleys.length;

  // Calculate mechanical advantage based on pulley configuration
  // MA = number of rope segments supporting the load
  const calculateMechanicalAdvantage = useCallback(() => {
    // Count rope segments supporting the movable pulley/load
    // In a simple system: MA = 2 * number of movable pulleys (for block and tackle)
    // For a single fixed pulley: MA = 1 (direction change only)
    // For a single movable pulley: MA = 2
    const numMovable = movablePulleys.length;
    const numFixed = fixedPulleys.length;

    if (numMovable === 0 && numFixed > 0) {
      // Only fixed pulleys - direction change only
      return 1;
    } else if (numMovable > 0) {
      // Block and tackle: MA = number of rope segments
      // Each movable pulley typically doubles the MA
      return Math.max(1, numMovable * 2);
    }
    return 1;
  }, [movablePulleys.length, fixedPulleys.length]);

  const mechanicalAdvantage = calculateMechanicalAdvantage();

  // Calculate required effort to lift the load
  const requiredEffort = loadWeight / mechanicalAdvantage;

  // Calculate rope tension
  const ropeTension = effortForce;

  // Check if load is being lifted
  const canLift = effortForce >= requiredEffort;

  // Update lift height based on effort
  useEffect(() => {
    if (isPulling && canLift) {
      const liftInterval = setInterval(() => {
        setLiftHeight(prev => {
          const newHeight = Math.min(100, prev + 2);
          if (newHeight >= 100) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            clearInterval(liftInterval);
          }
          return newHeight;
        });
      }, 50);
      return () => clearInterval(liftInterval);
    }
  }, [isPulling, canLift]);

  // Get theme-specific styles
  const getThemeStyles = () => {
    switch (theme) {
      case 'crane':
        return {
          frameColor: '#FFD700',
          ropeColor: '#8B4513',
          backgroundColor: '#87CEEB',
          groundColor: '#D2B48C',
          pulleyColor: '#4A4A4A',
        };
      case 'flagpole':
        return {
          frameColor: '#C0C0C0',
          ropeColor: '#FFFFFF',
          backgroundColor: '#87CEEB',
          groundColor: '#228B22',
          pulleyColor: '#B8860B',
        };
      case 'well':
        return {
          frameColor: '#8B4513',
          ropeColor: '#DEB887',
          backgroundColor: '#4A90A4',
          groundColor: '#654321',
          pulleyColor: '#333333',
        };
      case 'construction':
        return {
          frameColor: '#FF6600',
          ropeColor: '#333333',
          backgroundColor: '#B0C4DE',
          groundColor: '#808080',
          pulleyColor: '#2F4F4F',
        };
      default:
        return {
          frameColor: '#6366F1',
          ropeColor: '#1F2937',
          backgroundColor: '#1E293B',
          groundColor: '#374151',
          pulleyColor: '#4B5563',
        };
    }
  };

  const themeStyles = getThemeStyles();

  // Convert normalized position to SVG coordinates
  const toSvgX = (x: number) => (x / 100) * (svgWidth - 100) + 50;
  const toSvgY = (y: number) => (y / 100) * (svgHeight - 150) + 50;

  // Convert SVG coordinates to normalized position
  const fromSvgX = (x: number) => ((x - 50) / (svgWidth - 100)) * 100;
  const fromSvgY = (y: number) => ((y - 50) / (svgHeight - 150)) * 100;

  // Handle adding a new pulley
  const handleAddPulley = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!allowAddPulleys || totalPulleys >= maxPulleys) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const y = ((e.clientY - rect.top) / rect.height) * svgHeight;

    const normalizedX = fromSvgX(x);
    const normalizedY = fromSvgY(y);

    const newPulley: PulleyPosition = {
      id: `pulley-${Date.now()}`,
      x: Math.max(0, Math.min(100, normalizedX)),
      y: Math.max(0, Math.min(100, normalizedY)),
      type: selectedPulleyType,
      radius: pulleyRadius,
    };

    if (selectedPulleyType === 'fixed') {
      setFixedPulleys([...fixedPulleys, newPulley]);
    } else {
      setMovablePulleys([...movablePulleys, newPulley]);
    }
  };

  // Handle removing a pulley
  const handleRemovePulley = (id: string, type: 'fixed' | 'movable') => {
    if (type === 'fixed') {
      setFixedPulleys(fixedPulleys.filter(p => p.id !== id));
    } else {
      setMovablePulleys(movablePulleys.filter(p => p.id !== id));
    }
  };

  // Reset to initial state
  const handleReset = () => {
    setFixedPulleys(initialFixedPulleys);
    setMovablePulleys(initialMovablePulleys);
    setEffortForce(0);
    setLiftHeight(initialLiftHeight);
    setIsPulling(false);
    setShowSuccess(false);
    setHint(null);
  };

  // Get a hint
  const handleGetHint = () => {
    if (canLift) {
      setHint("You have enough force! Hold the pull button to lift the load!");
    } else if (effortForce > 0) {
      setHint(`You need ${(requiredEffort - effortForce).toFixed(1)} more units of force. Try adding more pulleys or increasing your effort!`);
    } else if (mechanicalAdvantage === 1) {
      setHint("A single fixed pulley only changes direction. Add a movable pulley to reduce the effort needed!");
    } else {
      setHint(`With ${mechanicalAdvantage}x mechanical advantage, you only need ${requiredEffort.toFixed(1)} units of force to lift ${loadWeight} units!`);
    }
    setTimeout(() => setHint(null), 5000);
  };

  // Render a pulley
  const renderPulley = (pulley: PulleyPosition, isFixed: boolean) => {
    const x = toSvgX(pulley.x);
    const y = toSvgY(pulley.y);
    const isHovered = hoveredPulley === pulley.id;
    const radius = pulley.radius || pulleyRadius;

    return (
      <g
        key={pulley.id}
        transform={`translate(${x}, ${y})`}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHoveredPulley(pulley.id)}
        onMouseLeave={() => setHoveredPulley(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (allowAddPulleys) {
            handleRemovePulley(pulley.id, isFixed ? 'fixed' : 'movable');
          }
        }}
      >
        {/* Pulley mount/frame */}
        {isFixed && (
          <line
            x1={0}
            y1={-radius - 5}
            x2={0}
            y2={-radius - 25}
            stroke={themeStyles.frameColor}
            strokeWidth={4}
          />
        )}

        {/* Pulley wheel shadow */}
        <circle
          cx={3}
          cy={3}
          r={radius}
          fill="rgba(0,0,0,0.3)"
        />

        {/* Pulley wheel */}
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill={themeStyles.pulleyColor}
          stroke={isHovered ? '#A855F7' : '#666666'}
          strokeWidth={isHovered ? 3 : 2}
        />

        {/* Pulley groove */}
        <circle
          cx={0}
          cy={0}
          r={radius - 5}
          fill="none"
          stroke="#333333"
          strokeWidth={3}
        />

        {/* Pulley center */}
        <circle
          cx={0}
          cy={0}
          r={5}
          fill="#888888"
        />

        {/* Type indicator */}
        <text
          x={0}
          y={radius + 20}
          textAnchor="middle"
          fontSize={10}
          fill={isFixed ? '#60A5FA' : '#10B981'}
          fontWeight="bold"
        >
          {isFixed ? 'FIXED' : 'MOVABLE'}
        </text>

        {/* Hover highlight */}
        {isHovered && allowAddPulleys && (
          <circle
            cx={0}
            cy={0}
            r={radius + 5}
            fill="none"
            stroke="#EF4444"
            strokeWidth={2}
            strokeDasharray="5,3"
            className="animate-pulse"
          />
        )}
      </g>
    );
  };

  // Calculate load position based on movable pulley (or center if none)
  const getLoadPosition = useCallback(() => {
    if (movablePulleys.length > 0) {
      // Load hangs directly below the movable pulley
      const movable = movablePulleys[0]; // Use the first movable pulley
      return {
        x: toSvgX(movable.x),
        y: toSvgY(movable.y) + (movable.radius || pulleyRadius) + 80 - (liftHeight * 1.5)
      };
    }
    // No movable pulley - load hangs from center
    return {
      x: toSvgX(50),
      y: svgHeight - 100 - (liftHeight * 1.5)
    };
  }, [movablePulleys, liftHeight]);

  // Render rope path
  const renderRope = () => {
    // Get all fixed pulleys sorted by x position for routing
    const sortedFixed = [...fixedPulleys].sort((a, b) => a.x - b.x);
    const loadPos = getLoadPosition();

    if (sortedFixed.length === 0 && movablePulleys.length === 0) {
      // Just draw a direct line from anchor to load
      return (
        <line
          x1={svgWidth / 2}
          y1={50}
          x2={loadPos.x}
          y2={loadPos.y - 30}
          stroke={themeStyles.ropeColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
    }

    // Draw rope segments
    const pathSegments: JSX.Element[] = [];
    let segmentCount = 0;

    // For a proper pulley system, rope goes:
    // 1. From effort/anchor down to first fixed pulley
    // 2. Through fixed pulleys to movable pulley
    // 3. Back up through fixed pulleys (if block and tackle)
    // 4. Final segment to effort point

    if (movablePulleys.length > 0) {
      // Block and tackle configuration
      const movable = movablePulleys[0];
      const movableX = toSvgX(movable.x);
      const movableY = toSvgY(movable.y);
      const movableRadius = movable.radius || pulleyRadius;

      if (sortedFixed.length >= 2) {
        // Two fixed pulleys with movable between them
        const leftFixed = sortedFixed[0];
        const rightFixed = sortedFixed[sortedFixed.length - 1];
        const leftX = toSvgX(leftFixed.x);
        const leftY = toSvgY(leftFixed.y);
        const leftRadius = leftFixed.radius || pulleyRadius;
        const rightX = toSvgX(rightFixed.x);
        const rightY = toSvgY(rightFixed.y);
        const rightRadius = rightFixed.radius || pulleyRadius;

        // Rope from left fixed down to left side of movable
        pathSegments.push(
          <line
            key="segment-left-down"
            x1={leftX}
            y1={leftY + leftRadius}
            x2={movableX - movableRadius}
            y2={movableY}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;

        // Rope from right side of movable up to right fixed
        pathSegments.push(
          <line
            key="segment-right-up"
            x1={movableX + movableRadius}
            y1={movableY}
            x2={rightX}
            y2={rightY + rightRadius}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;

        // Rope from anchor to left fixed pulley
        pathSegments.push(
          <line
            key="segment-anchor-left"
            x1={leftX}
            y1={30}
            x2={leftX}
            y2={leftY - leftRadius}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;

        // Rope from right fixed to anchor (effort end)
        pathSegments.push(
          <line
            key="segment-right-anchor"
            x1={rightX}
            y1={30}
            x2={rightX}
            y2={rightY - rightRadius}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;

      } else if (sortedFixed.length === 1) {
        // Single fixed pulley with movable
        const fixed = sortedFixed[0];
        const fixedX = toSvgX(fixed.x);
        const fixedY = toSvgY(fixed.y);
        const fixedRadius = fixed.radius || pulleyRadius;

        // Rope from anchor to fixed pulley
        pathSegments.push(
          <line
            key="segment-anchor"
            x1={fixedX}
            y1={30}
            x2={fixedX}
            y2={fixedY - fixedRadius}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;

        // Rope from fixed to movable
        pathSegments.push(
          <line
            key="segment-to-movable"
            x1={fixedX + fixedRadius}
            y1={fixedY}
            x2={movableX}
            y2={movableY - movableRadius}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;

        // Rope from movable down (effort end goes down and around)
        pathSegments.push(
          <line
            key="segment-effort"
            x1={movableX - movableRadius}
            y1={movableY}
            x2={movableX - 50}
            y2={movableY + 60}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;

      } else {
        // Only movable pulley, no fixed - rope goes straight up
        pathSegments.push(
          <line
            key="segment-up"
            x1={movableX}
            y1={30}
            x2={movableX}
            y2={movableY - movableRadius}
            stroke={themeStyles.ropeColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
        segmentCount++;
      }

      // Rope from movable pulley to load (always straight down)
      pathSegments.push(
        <line
          key="segment-to-load"
          x1={movableX}
          y1={movableY + movableRadius}
          x2={loadPos.x}
          y2={loadPos.y - 30}
          stroke={themeStyles.ropeColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
      segmentCount++;

    } else {
      // Only fixed pulleys (direction change only)
      // Route rope through all fixed pulleys in order
      sortedFixed.forEach((pulley, index) => {
        const px = toSvgX(pulley.x);
        const py = toSvgY(pulley.y);
        const radius = pulley.radius || pulleyRadius;

        // Rope to pulley (from top)
        if (index === 0) {
          pathSegments.push(
            <line
              key={`segment-${index}-in`}
              x1={px}
              y1={30}
              x2={px}
              y2={py - radius}
              stroke={themeStyles.ropeColor}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
          segmentCount++;
        }

        // Rope between pulleys
        if (index < sortedFixed.length - 1) {
          const nextPulley = sortedFixed[index + 1];
          const nextPx = toSvgX(nextPulley.x);
          const nextPy = toSvgY(nextPulley.y);
          const nextRadius = nextPulley.radius || pulleyRadius;

          pathSegments.push(
            <line
              key={`segment-${index}-between`}
              x1={px + radius}
              y1={py}
              x2={nextPx - nextRadius}
              y2={nextPy}
              stroke={themeStyles.ropeColor}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
          segmentCount++;
        }
      });

      // Final segment straight down to load
      const lastPulley = sortedFixed[sortedFixed.length - 1];
      const lastPx = toSvgX(lastPulley.x);
      const lastPy = toSvgY(lastPulley.y);
      const lastRadius = lastPulley.radius || pulleyRadius;

      pathSegments.push(
        <line
          key="segment-final"
          x1={lastPx}
          y1={lastPy + lastRadius}
          x2={loadPos.x}
          y2={loadPos.y - 30}
          stroke={themeStyles.ropeColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
      segmentCount++;
    }

    // Rope segment count display
    if (showRopeSegments) {
      pathSegments.push(
        <g key="rope-count" transform={`translate(${svgWidth - 80}, 80)`}>
          <rect
            x={-35}
            y={-15}
            width={70}
            height={30}
            rx={6}
            fill="rgba(0,0,0,0.6)"
          />
          <text
            textAnchor="middle"
            fontSize={11}
            fill="#94A3B8"
            fontFamily="monospace"
          >
            <tspan x={0} dy={5}>Segments: {segmentCount}</tspan>
          </text>
        </g>
      );
    }

    return <>{pathSegments}</>;
  };

  // Render the load
  const renderLoad = () => {
    const loadPos = getLoadPosition();
    const loadX = loadPos.x;
    const loadY = loadPos.y;
    const loadSize = 60;

    return (
      <g transform={`translate(${loadX}, ${loadY})`}>
        {/* Load shadow */}
        <rect
          x={-loadSize / 2 + 5}
          y={5}
          width={loadSize}
          height={loadSize}
          rx={8}
          fill="rgba(0,0,0,0.3)"
        />

        {/* Load box */}
        <rect
          x={-loadSize / 2}
          y={0}
          width={loadSize}
          height={loadSize}
          rx={8}
          fill={theme === 'well' ? '#8B4513' : '#4F46E5'}
          stroke={canLift && isPulling ? '#10B981' : '#6366F1'}
          strokeWidth={canLift && isPulling ? 4 : 2}
        />

        {/* Load icon */}
        <text
          x={0}
          y={loadSize / 2 + 5}
          textAnchor="middle"
          fontSize={30}
        >
          {theme === 'well' ? '🪣' : theme === 'flagpole' ? '🚩' : '📦'}
        </text>

        {/* Weight label */}
        <text
          x={0}
          y={loadSize + 20}
          textAnchor="middle"
          fontSize={12}
          fill="white"
          fontWeight="bold"
        >
          {loadWeight} units
        </text>

        {/* Lift height indicator */}
        <text
          x={loadSize / 2 + 15}
          y={loadSize / 2}
          fontSize={10}
          fill="#94A3B8"
          fontFamily="monospace"
        >
          ↑{liftHeight.toFixed(0)}%
        </text>
      </g>
    );
  };

  // Get theme accent color
  const getThemeAccent = () => {
    switch (theme) {
      case 'crane': return { primary: 'yellow', accent: '#EAB308' };
      case 'flagpole': return { primary: 'blue', accent: '#3B82F6' };
      case 'well': return { primary: 'amber', accent: '#D97706' };
      case 'construction': return { primary: 'orange', accent: '#F97316' };
      default: return { primary: 'indigo', accent: '#6366F1' };
    }
  };

  const themeAccent = getThemeAccent();

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header - Lumina style */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className={`w-12 h-12 rounded-xl bg-${themeAccent.primary}-500/20 flex items-center justify-center border border-${themeAccent.primary}-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)]`}>
          <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
            <p className="text-xs text-yellow-400 font-mono uppercase tracking-wider">
              Interactive Pulley Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-yellow-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#eab308 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Status Display */}
          <div className="mb-4 flex justify-center gap-4 flex-wrap">
            <div className={`inline-flex items-center gap-3 px-5 py-2 rounded-full transition-all duration-300 ${
              canLift
                ? 'bg-green-500/20 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                : 'bg-slate-700/50 border border-slate-600/50'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${canLift ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span className={`font-mono text-sm font-bold ${canLift ? 'text-green-300' : 'text-slate-400'}`}>
                {canLift ? 'READY TO LIFT!' : 'NEED MORE FORCE'}
              </span>
            </div>

            {showMechanicalAdvantage && (
              <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-purple-500/20 border border-purple-500/50">
                <span className="font-mono text-sm text-purple-300">
                  MA: <span className="font-bold">{mechanicalAdvantage}x</span>
                </span>
              </div>
            )}
          </div>

          {/* SVG Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 border border-slate-700/50">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none"
              style={{ maxHeight: '450px', touchAction: 'none' }}
              onClick={handleAddPulley}
            >
              {/* Background gradient */}
              <defs>
                <linearGradient id="pulleySkyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={themeStyles.backgroundColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
              </defs>
              <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#pulleySkyGradient)" />

              {/* Grid */}
              <g opacity="0.1">
                {Array.from({ length: Math.floor(svgWidth / 50) }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={svgHeight} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
                {Array.from({ length: Math.floor(svgHeight / 50) }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 50} x2={svgWidth} y2={i * 50} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
              </g>

              {/* Frame/Ceiling */}
              <rect
                x={100}
                y={20}
                width={svgWidth - 200}
                height={15}
                fill={themeStyles.frameColor}
                rx={3}
              />

              {/* Ground */}
              <rect
                x={0}
                y={svgHeight - 50}
                width={svgWidth}
                height={50}
                fill={themeStyles.groundColor}
                opacity={0.3}
              />

              {/* Rope */}
              {renderRope()}

              {/* Fixed Pulleys */}
              {fixedPulleys.map(pulley => renderPulley(pulley, true))}

              {/* Movable Pulleys */}
              {movablePulleys.map(pulley => renderPulley(pulley, false))}

              {/* Load */}
              {renderLoad()}

              {/* Effort arrow */}
              {effortForce > 0 && (
                <g transform={`translate(150, ${svgHeight - 80})`}>
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={-40 - effortForce * 3}
                    stroke="#10B981"
                    strokeWidth={4}
                    markerEnd="url(#effortArrow)"
                  />
                  <defs>
                    <marker id="effortArrow" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#10B981" />
                    </marker>
                  </defs>
                  <rect
                    x={10}
                    y={-30 - effortForce * 1.5}
                    width={70}
                    height={22}
                    rx={4}
                    fill="rgba(16,185,129,0.2)"
                  />
                  <text
                    x={15}
                    y={-15 - effortForce * 1.5}
                    fontSize={11}
                    fill="#10B981"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    Effort: {effortForce}
                  </text>
                </g>
              )}

              {/* Force labels */}
              {showForceLabels && (
                <g transform={`translate(${svgWidth - 120}, ${svgHeight - 80})`}>
                  <rect x={-10} y={-40} width={120} height={70} rx={8} fill="rgba(0,0,0,0.5)" />
                  <text fontSize={10} fill="#94A3B8" fontFamily="monospace">
                    <tspan x={0} dy={-20}>Load: {loadWeight} units</tspan>
                    <tspan x={0} dy={18}>Required: {requiredEffort.toFixed(1)}</tspan>
                    <tspan x={0} dy={18}>Tension: {ropeTension.toFixed(1)}</tspan>
                  </text>
                </g>
              )}
            </svg>

            {/* Success overlay */}
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/10 backdrop-blur-sm animate-fade-in">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(34,197,94,0.5)] animate-bounce">
                  Load Lifted! Great Work!
                </div>
              </div>
            )}

            {/* Click to add instruction */}
            {allowAddPulleys && totalPulleys < maxPulleys && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 backdrop-blur-sm rounded-full border border-slate-700">
                <p className="text-xs text-slate-400 font-mono">
                  Click anywhere to add a {selectedPulleyType} pulley ({totalPulleys}/{maxPulleys})
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Effort Control */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-mono text-slate-300 mb-3">
                Effort Force: <span className="text-yellow-400 font-bold">{effortForce}</span> units
                <span className="text-slate-500 text-xs ml-2">(Need {requiredEffort.toFixed(1)})</span>
              </label>
              <input
                type="range"
                min={0}
                max={loadWeight}
                step={0.5}
                value={effortForce}
                onChange={(e) => setEffortForce(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>

            {/* Pull Button */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 flex items-center justify-center">
              <button
                onMouseDown={() => setIsPulling(true)}
                onMouseUp={() => setIsPulling(false)}
                onMouseLeave={() => setIsPulling(false)}
                onTouchStart={() => setIsPulling(true)}
                onTouchEnd={() => setIsPulling(false)}
                disabled={!canLift}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
                  canLift
                    ? isPulling
                      ? 'bg-green-600 text-white shadow-[0_0_30px_rgba(34,197,94,0.5)] scale-95'
                      : 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isPulling ? '🏋️ PULLING...' : canLift ? '🏋️ HOLD TO PULL' : '❌ NOT ENOUGH FORCE'}
              </button>
            </div>
          </div>

          {/* Pulley Type Selector (when adding is allowed) */}
          {allowAddPulleys && (
            <div className="mb-6 p-4 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50">
              <label className="block text-sm font-mono text-slate-300 mb-3">Pulley Type to Add:</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPulleyType('fixed')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedPulleyType === 'fixed'
                      ? 'bg-blue-500/30 border border-blue-500/50 text-blue-300'
                      : 'bg-slate-700/50 border border-slate-600/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Fixed Pulley
                  <span className="block text-xs font-normal mt-1">Changes direction only</span>
                </button>
                <button
                  onClick={() => setSelectedPulleyType('movable')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedPulleyType === 'movable'
                      ? 'bg-green-500/30 border border-green-500/50 text-green-300'
                      : 'bg-slate-700/50 border border-slate-600/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Movable Pulley
                  <span className="block text-xs font-normal mt-1">Reduces effort by 2x</span>
                </button>
              </div>
            </div>
          )}

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

          {/* Educational Info */}
          <div className="p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              How Pulleys Work
            </h4>
            <div className="space-y-2">
              <p className="text-slate-300 text-sm">
                A <span className="text-blue-400 font-semibold">fixed pulley</span> is attached to a structure and only changes the direction of the force - it doesn't reduce effort.
              </p>
              <p className="text-slate-300 text-sm">
                A <span className="text-green-400 font-semibold">movable pulley</span> moves with the load and provides a mechanical advantage of 2x - you only need half the force!
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-yellow-400 font-semibold">Key Formula:</span> Mechanical Advantage = Load Weight ÷ Effort Force
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PulleySystemBuilder;
