'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Lever Lab - Interactive lever/fulcrum system for teaching simple machines
 *
 * K-5 Engineering Primitive for understanding:
 * - Balance and equality concepts (K-1)
 * - Fulcrum position effects (1-2)
 * - Load vs effort trade-offs (2-3)
 * - Mechanical advantage calculation (4-5)
 *
 * Real-world connections: excavator boom, wheelbarrow, seesaw, crowbar, bottle opener
 */

export interface LeverLoad {
  position: number;      // Distance from left end (0-beamLength)
  weight: number;        // Weight in arbitrary units
  icon?: string;         // Emoji or icon identifier
  label?: string;        // Optional label for the load
  color?: string;        // Optional color for the load
  isDraggable?: boolean; // Whether user can drag this load
}

export interface LeverLabData {
  title: string;
  description: string;
  beamLength: number;           // Length of lever in units
  fulcrumPosition: number;      // Initial fulcrum placement (distance from left)
  fixedFulcrum: boolean;        // Lock fulcrum in place
  loads: LeverLoad[];           // Objects on the lever
  showDistances: boolean;       // Display measurement labels
  showMA: boolean;              // Display mechanical advantage ratio
  effortInput: 'drag' | 'slider' | 'numeric';  // How to apply effort
  theme: 'seesaw' | 'excavator' | 'crowbar' | 'generic';
  effortPosition?: number;      // Where effort is applied
  effortForce?: number;         // Initial effort force
  showTorque?: boolean;         // Show torque calculations (grades 4-5)
  allowAddLoads?: boolean;      // Allow adding new loads
  maxLoads?: number;            // Maximum number of loads allowed
}

interface LeverLabProps {
  data: LeverLabData;
  className?: string;
}

const LeverLab: React.FC<LeverLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    beamLength = 10,
    fulcrumPosition: initialFulcrumPosition = 5,
    fixedFulcrum = false,
    loads: initialLoads = [],
    showDistances = true,
    showMA = false,
    effortInput = 'slider',
    theme = 'generic',
    effortPosition: initialEffortPosition,
    effortForce: initialEffortForce = 0,
    showTorque = false,
    allowAddLoads = false,
    maxLoads = 6,
  } = data;

  const [fulcrumPosition, setFulcrumPosition] = useState(initialFulcrumPosition);
  const [loads, setLoads] = useState<LeverLoad[]>(initialLoads);
  const [effortForce, setEffortForce] = useState(initialEffortForce);
  const [effortPosition, setEffortPosition] = useState(initialEffortPosition ?? 0);
  const [isDraggingFulcrum, setIsDraggingFulcrum] = useState(false);
  const [draggedLoadIndex, setDraggedLoadIndex] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hoveredLoadIndex, setHoveredLoadIndex] = useState<number | null>(null);

  const beamRef = useRef<SVGRectElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 450;
  const beamY = 220;
  const beamVisualLength = 600;
  const beamStartX = (svgWidth - beamVisualLength) / 2;
  const unitToPixel = beamVisualLength / beamLength;

  // Calculate torque on each side of fulcrum
  const calculateTorques = useCallback(() => {
    let leftTorque = 0;
    let rightTorque = 0;

    loads.forEach(load => {
      const distanceFromFulcrum = load.position - fulcrumPosition;
      const torque = load.weight * Math.abs(distanceFromFulcrum);

      if (distanceFromFulcrum < 0) {
        leftTorque += torque;
      } else if (distanceFromFulcrum > 0) {
        rightTorque += torque;
      }
    });

    // Add effort force contribution
    if (effortForce > 0 && effortPosition !== undefined) {
      const effortDistanceFromFulcrum = effortPosition - fulcrumPosition;
      const effortTorque = effortForce * Math.abs(effortDistanceFromFulcrum);

      if (effortDistanceFromFulcrum < 0) {
        leftTorque += effortTorque;
      } else if (effortDistanceFromFulcrum > 0) {
        rightTorque += effortTorque;
      }
    }

    return { leftTorque, rightTorque };
  }, [loads, fulcrumPosition, effortForce, effortPosition]);

  const { leftTorque, rightTorque } = calculateTorques();
  const isBalanced = Math.abs(leftTorque - rightTorque) < 0.1;

  // Calculate tilt angle based on torque difference
  const tiltAngle = (() => {
    const torqueDiff = rightTorque - leftTorque;
    // Max 15 degrees tilt
    return Math.max(-15, Math.min(15, torqueDiff * 0.5));
  })();

  // Calculate mechanical advantage
  const mechanicalAdvantage = (() => {
    if (effortPosition === undefined || effortPosition === fulcrumPosition) return 0;

    // Find the total load on the opposite side of the effort
    const effortSide = effortPosition < fulcrumPosition ? 'left' : 'right';
    const loadSide = effortSide === 'left' ? 'right' : 'left';

    let loadDistance = 0;
    let totalLoadWeight = 0;

    loads.forEach(load => {
      const isOnLoadSide = (loadSide === 'left' && load.position < fulcrumPosition) ||
                          (loadSide === 'right' && load.position > fulcrumPosition);
      if (isOnLoadSide) {
        loadDistance = Math.abs(load.position - fulcrumPosition);
        totalLoadWeight += load.weight;
      }
    });

    const effortDistance = Math.abs(effortPosition - fulcrumPosition);

    if (loadDistance === 0 || effortDistance === 0) return 0;
    return effortDistance / loadDistance;
  })();

  // Track if user has made any changes (to distinguish initial state from solved state)
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Check for balance success - only show success if user has interacted
  useEffect(() => {
    if (isBalanced && loads.length > 0 && hasUserInteracted) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  }, [isBalanced, loads.length, hasUserInteracted]);

  // Convert pixel position to lever units
  const pixelToUnit = (pixelX: number): number => {
    const relativeX = pixelX - beamStartX;
    return Math.max(0, Math.min(beamLength, relativeX / unitToPixel));
  };

  // Convert lever units to pixel position
  const unitToPixelPos = (unit: number): number => {
    return beamStartX + (unit * unitToPixel);
  };

  // Convert screen coordinates to SVG coordinates
  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const svgRect = svgRef.current.getBoundingClientRect();
    const scaleX = svgWidth / svgRect.width;
    const scaleY = svgHeight / svgRect.height;

    return {
      x: (clientX - svgRect.left) * scaleX,
      y: (clientY - svgRect.top) * scaleY
    };
  }, [svgWidth, svgHeight]);

  // Handle fulcrum drag
  const handleFulcrumMouseDown = (e: React.MouseEvent) => {
    if (fixedFulcrum) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFulcrum(true);
    setHasUserInteracted(true);
  };

  // Handle load drag
  const handleLoadMouseDown = (e: React.MouseEvent, index: number) => {
    if (!loads[index].isDraggable) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggedLoadIndex(index);
    setHasUserInteracted(true);
  };

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;

      const svgCoords = screenToSVG(e.clientX, e.clientY);
      const newPosition = pixelToUnit(svgCoords.x);

      if (isDraggingFulcrum) {
        setFulcrumPosition(Math.max(1, Math.min(beamLength - 1, newPosition)));
      }

      if (draggedLoadIndex !== null) {
        setLoads(prev => prev.map((load, i) =>
          i === draggedLoadIndex
            ? { ...load, position: Math.max(0.2, Math.min(beamLength - 0.2, newPosition)) }
            : load
        ));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingFulcrum(false);
      setDraggedLoadIndex(null);
    };

    // Always add listeners when dragging - use capture phase for better responsiveness
    if (isDraggingFulcrum || draggedLoadIndex !== null) {
      document.addEventListener('mousemove', handleMouseMove, { capture: true });
      document.addEventListener('mouseup', handleMouseUp, { capture: true });
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.userSelect = '';
    };
  }, [isDraggingFulcrum, draggedLoadIndex, beamLength, screenToSVG, pixelToUnit]);

  // Add a new load
  const handleAddLoad = () => {
    if (loads.length >= maxLoads) {
      setHint(`Maximum ${maxLoads} loads allowed!`);
      setTimeout(() => setHint(null), 2000);
      return;
    }

    const newLoad: LeverLoad = {
      position: Math.random() * beamLength,
      weight: 1,
      icon: '📦',
      label: `Load ${loads.length + 1}`,
      isDraggable: true,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    };

    setLoads([...loads, newLoad]);
  };

  // Remove a load
  const handleRemoveLoad = (index: number) => {
    setLoads(loads.filter((_, i) => i !== index));
  };

  // Reset to initial state
  const handleReset = () => {
    setFulcrumPosition(initialFulcrumPosition);
    setLoads(initialLoads);
    setEffortForce(initialEffortForce);
    setEffortPosition(initialEffortPosition ?? 0);
    setHint(null);
    setShowSuccess(false);
    setHasUserInteracted(false);
  };

  // Provide a hint
  const handleGetHint = () => {
    if (isBalanced) {
      setHint('The lever is already balanced!');
    } else if (leftTorque > rightTorque) {
      setHint('The left side is heavier. Try moving the fulcrum left, or move loads right.');
    } else {
      setHint('The right side is heavier. Try moving the fulcrum right, or move loads left.');
    }
    setTimeout(() => setHint(null), 4000);
  };

  // Get theme-specific colors and styles
  const getThemeStyles = () => {
    switch (theme) {
      case 'seesaw':
        return {
          beamColor: '#8B5A2B',
          fulcrumColor: '#4A4A4A',
          groundColor: '#90EE90',
          beamGradient: 'from-amber-700 to-amber-800',
        };
      case 'excavator':
        return {
          beamColor: '#FFD700',
          fulcrumColor: '#333333',
          groundColor: '#D2B48C',
          beamGradient: 'from-yellow-400 to-yellow-600',
        };
      case 'crowbar':
        return {
          beamColor: '#4A4A4A',
          fulcrumColor: '#8B4513',
          groundColor: '#A0522D',
          beamGradient: 'from-gray-600 to-gray-800',
        };
      default:
        return {
          beamColor: '#6366F1',
          fulcrumColor: '#1F2937',
          groundColor: '#E5E7EB',
          beamGradient: 'from-indigo-500 to-indigo-600',
        };
    }
  };

  const themeStyles = getThemeStyles();

  // Calculate Y position on the tilted beam for a given X position
  const getBeamYAtPosition = useCallback((position: number): number => {
    const distanceFromFulcrum = position - fulcrumPosition;
    const distanceInPixels = distanceFromFulcrum * unitToPixel;
    const tiltRadians = tiltAngle * Math.PI / 180;
    return beamY + distanceInPixels * Math.sin(tiltRadians);
  }, [fulcrumPosition, unitToPixel, tiltAngle, beamY]);

  // Render a load on the beam
  const renderLoad = (load: LeverLoad, index: number) => {
    const x = unitToPixelPos(load.position);
    const loadSize = 32 + (load.weight * 6);
    const isDragging = draggedLoadIndex === index;
    const isHovered = hoveredLoadIndex === index;

    // Calculate Y position on the tilted beam
    const beamYAtLoad = getBeamYAtPosition(load.position);
    const y = beamYAtLoad - 15 - loadSize / 2;

    // Get theme-appropriate colors
    const baseColor = load.color || '#3B82F6';
    const glowColor = load.color ? load.color + '60' : 'rgba(59, 130, 246, 0.4)';

    return (
      <g
        key={index}
        transform={`translate(${x}, ${y})`}
        style={{
          cursor: load.isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out'
        }}
        onMouseDown={(e) => handleLoadMouseDown(e, index)}
        onMouseEnter={() => setHoveredLoadIndex(index)}
        onMouseLeave={() => setHoveredLoadIndex(null)}
      >
        {/* Glow effect for draggable items */}
        {load.isDraggable && (isDragging || isHovered) && (
          <rect
            x={-loadSize / 2 - 4}
            y={-loadSize / 2 - 4}
            width={loadSize + 8}
            height={loadSize + 8}
            rx={8}
            fill="none"
            stroke={isDragging ? '#A855F7' : '#60A5FA'}
            strokeWidth={2}
            opacity={0.6}
            className="animate-pulse"
          />
        )}

        {/* Load body with gradient */}
        <defs>
          <linearGradient id={`loadGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={baseColor} />
            <stop offset="100%" stopColor={baseColor} stopOpacity={0.7} />
          </linearGradient>
          <filter id={`loadShadow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={glowColor} floodOpacity="0.5"/>
          </filter>
        </defs>

        <rect
          x={-loadSize / 2}
          y={-loadSize / 2}
          width={loadSize}
          height={loadSize}
          rx={8}
          fill={`url(#loadGrad-${index})`}
          stroke={isDragging ? '#A855F7' : isHovered ? '#60A5FA' : 'rgba(255,255,255,0.3)'}
          strokeWidth={isDragging || isHovered ? 3 : 2}
          filter={`url(#loadShadow-${index})`}
          className="transition-all duration-200"
        />

        {/* Glass effect overlay */}
        <rect
          x={-loadSize / 2 + 2}
          y={-loadSize / 2 + 2}
          width={loadSize - 4}
          height={loadSize / 2 - 2}
          rx={6}
          fill="url(#glassOverlay)"
          opacity={0.3}
        />

        {/* Load icon/label */}
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontSize={loadSize * 0.45}
          fill="white"
          style={{ pointerEvents: 'none' }}
        >
          {load.icon || '📦'}
        </text>

        {/* Weight label below */}
        <text
          x={0}
          y={loadSize / 2 + 18}
          textAnchor="middle"
          fontSize={11}
          fill="white"
          fontWeight="600"
          className="font-mono"
          style={{ pointerEvents: 'none' }}
        >
          {load.weight} {load.weight === 1 ? 'unit' : 'units'}
        </text>

        {/* Distance from fulcrum - shown above */}
        {showDistances && (
          <g>
            <rect
              x={-18}
              y={-loadSize / 2 - 22}
              width={36}
              height={16}
              rx={4}
              fill="rgba(0,0,0,0.5)"
            />
            <text
              x={0}
              y={-loadSize / 2 - 10}
              textAnchor="middle"
              fontSize={10}
              fill="#94A3B8"
              fontFamily="monospace"
              style={{ pointerEvents: 'none' }}
            >
              {Math.abs(load.position - fulcrumPosition).toFixed(1)}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Get theme colors
  const getThemeColor = () => {
    switch (theme) {
      case 'seesaw': return { primary: 'orange', accent: '#F97316' };
      case 'excavator': return { primary: 'yellow', accent: '#EAB308' };
      case 'crowbar': return { primary: 'slate', accent: '#64748B' };
      default: return { primary: 'blue', accent: '#3B82F6' };
    }
  };

  const themeColor = getThemeColor();

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header - Lumina style */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className={`w-12 h-12 rounded-xl bg-${themeColor.primary}-500/20 flex items-center justify-center border border-${themeColor.primary}-500/30 shadow-[0_0_20px_rgba(249,115,22,0.2)]`}>
          <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <p className="text-xs text-orange-400 font-mono uppercase tracking-wider">
              Interactive Physics Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-orange-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Balance Status */}
          <div className="mb-4 flex justify-center">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-500 ${
              isBalanced
                ? 'bg-green-500/20 border border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                : 'bg-red-500/20 border border-red-500/50'
            }`}>
              <span className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></span>
              <span className={`font-mono text-sm font-bold ${isBalanced ? 'text-green-300' : 'text-red-300'}`}>
                {isBalanced ? 'BALANCED!' : 'UNBALANCED'}
              </span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 border border-slate-700/50">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none"
              style={{ maxHeight: '400px', touchAction: 'none' }}
            >
              {/* Definitions */}
              <defs>
                <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0F172A" />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
                <linearGradient id="beamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={themeStyles.beamColor} />
                  <stop offset="50%" stopColor={themeStyles.beamColor} />
                  <stop offset="100%" stopColor={`${themeStyles.beamColor}99`} />
                </linearGradient>
                <linearGradient id="fulcrumGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
                <linearGradient id="glassOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="0"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#10B981" />
                </marker>
              </defs>

              {/* Background */}
              <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#skyGradient)" />

              {/* Grid pattern for visual reference */}
              <g opacity="0.1">
                {Array.from({ length: Math.floor(svgWidth / 40) }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={svgHeight} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
                {Array.from({ length: Math.floor(svgHeight / 40) }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 40} x2={svgWidth} y2={i * 40} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
              </g>

              {/* Ground */}
              <rect
                x={0}
                y={beamY + 100}
                width={svgWidth}
                height={svgHeight - beamY - 100}
                fill={themeStyles.groundColor}
                opacity={0.2}
              />
              <line x1={0} y1={beamY + 100} x2={svgWidth} y2={beamY + 100} stroke={themeStyles.groundColor} strokeWidth="2" opacity="0.4" />

              {/* Fulcrum */}
              <g transform={`translate(${unitToPixelPos(fulcrumPosition)}, ${beamY})`}>
                {/* Fulcrum shadow */}
                <polygon
                  points={`0,-5 -32,100 32,100`}
                  fill="black"
                  opacity={0.3}
                  transform="translate(3, 3)"
                />
                {/* Triangle fulcrum */}
                <polygon
                  points={`0,-8 -28,100 28,100`}
                  fill="url(#fulcrumGradient)"
                  stroke={isDraggingFulcrum ? '#A855F7' : '#475569'}
                  strokeWidth={isDraggingFulcrum ? 3 : 2}
                  style={{ cursor: fixedFulcrum ? 'default' : (isDraggingFulcrum ? 'grabbing' : 'ew-resize') }}
                  onMouseDown={handleFulcrumMouseDown}
                  className={`transition-all duration-200 ${!fixedFulcrum ? 'hover:stroke-purple-400' : ''}`}
                />
                {/* Fulcrum highlight */}
                <polygon
                  points={`0,-6 -12,30 12,30`}
                  fill="white"
                  opacity={0.1}
                />

                {/* Fulcrum position indicator */}
                {showDistances && (
                  <g>
                    <rect x={-35} y={108} width={70} height={20} rx={4} fill="rgba(0,0,0,0.5)" />
                    <text
                      x={0}
                      y={122}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#94A3B8"
                      fontFamily="monospace"
                    >
                      Fulcrum: {fulcrumPosition.toFixed(1)}
                    </text>
                  </g>
                )}
              </g>

              {/* Beam */}
              <g transform={`translate(${unitToPixelPos(fulcrumPosition)}, ${beamY}) rotate(${tiltAngle})`}>
                {/* Beam shadow */}
                <rect
                  x={-unitToPixelPos(fulcrumPosition) + beamStartX + 3}
                  y={-12}
                  width={beamVisualLength}
                  height={28}
                  rx={6}
                  fill="black"
                  opacity={0.3}
                />
                {/* Main beam */}
                <rect
                  ref={beamRef}
                  x={-unitToPixelPos(fulcrumPosition) + beamStartX}
                  y={-15}
                  width={beamVisualLength}
                  height={30}
                  rx={6}
                  fill="url(#beamGradient)"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={1}
                />
                {/* Beam highlight */}
                <rect
                  x={-unitToPixelPos(fulcrumPosition) + beamStartX + 2}
                  y={-13}
                  width={beamVisualLength - 4}
                  height={8}
                  rx={4}
                  fill="white"
                  opacity={0.15}
                />

                {/* Beam markings */}
                {Array.from({ length: beamLength + 1 }).map((_, i) => (
                  <g key={i} transform={`translate(${-unitToPixelPos(fulcrumPosition) + beamStartX + i * unitToPixel}, 0)`}>
                    <line
                      x1={0}
                      y1={-15}
                      x2={0}
                      y2={-6}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth={i === Math.round(fulcrumPosition) ? 2 : 1}
                    />
                    <text
                      x={0}
                      y={28}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#94A3B8"
                      fontFamily="monospace"
                    >
                      {i}
                    </text>
                  </g>
                ))}
              </g>

              {/* Loads - rendered without rotation transform, positioned individually */}
              {loads.map((load, index) => renderLoad(load, index))}

              {/* Effort indicator */}
              {effortForce > 0 && effortPosition !== undefined && (
                <g transform={`translate(${unitToPixelPos(effortPosition)}, ${getBeamYAtPosition(effortPosition) - 50})`}>
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={-30 - effortForce * 5}
                    stroke="#10B981"
                    strokeWidth={4}
                    markerEnd="url(#arrowhead)"
                    filter="url(#glow)"
                  />
                  <rect
                    x={8}
                    y={-25 - effortForce * 2.5}
                    width={70}
                    height={20}
                    rx={4}
                    fill="rgba(16,185,129,0.2)"
                  />
                  <text
                    x={12}
                    y={-12 - effortForce * 2.5}
                    fontSize={11}
                    fill="#10B981"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    Effort: {effortForce}
                  </text>
                </g>
              )}

              {/* Torque display */}
              {showTorque && (
                <>
                  <g transform={`translate(80, ${svgHeight - 50})`}>
                    <rect x={-10} y={-15} width={140} height={24} rx={4} fill="rgba(59,130,246,0.2)" />
                    <text fontSize={12} fill="#60A5FA" fontFamily="monospace">
                      Left Torque: {leftTorque.toFixed(1)}
                    </text>
                  </g>
                  <g transform={`translate(${svgWidth - 200}, ${svgHeight - 50})`}>
                    <rect x={-10} y={-15} width={150} height={24} rx={4} fill="rgba(168,85,247,0.2)" />
                    <text fontSize={12} fill="#A855F7" fontFamily="monospace">
                      Right Torque: {rightTorque.toFixed(1)}
                    </text>
                  </g>
                </>
              )}

              {/* Mechanical Advantage display */}
              {showMA && mechanicalAdvantage > 0 && (
                <g transform={`translate(${svgWidth / 2}, ${svgHeight - 30})`}>
                  <rect x={-100} y={-15} width={200} height={24} rx={12} fill="rgba(245,158,11,0.2)" />
                  <text textAnchor="middle" fontSize={13} fill="#F59E0B" fontFamily="monospace" fontWeight="bold">
                    Mechanical Advantage: {mechanicalAdvantage.toFixed(2)}x
                  </text>
                </g>
              )}
            </svg>

            {/* Success animation overlay */}
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/10 backdrop-blur-sm animate-fade-in">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(34,197,94,0.5)] animate-bounce">
                  Balanced! Great Job!
                </div>
              </div>
            )}

            {/* Drag instruction overlay - only shown when not dragging */}
            {!isDraggingFulcrum && draggedLoadIndex === null && loads.some(l => l.isDraggable) && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 backdrop-blur-sm rounded-full border border-slate-700">
                <p className="text-xs text-slate-400 font-mono">
                  Drag objects to move them along the beam
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Effort Control */}
            {effortInput === 'slider' && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Effort Force: <span className="text-orange-400 font-bold">{effortForce}</span> units
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={effortForce}
                  onChange={(e) => setEffortForce(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            )}

            {effortInput === 'numeric' && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Effort Force
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={effortForce}
                  onChange={(e) => setEffortForce(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-slate-900/50 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none font-mono"
                />
              </div>
            )}

            {/* Effort Position */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-mono text-slate-300 mb-3">
                Effort Position: <span className="text-orange-400 font-bold">{effortPosition?.toFixed(1) ?? 0}</span>
              </label>
              <input
                type="range"
                min={0}
                max={beamLength}
                step={0.1}
                value={effortPosition ?? 0}
                onChange={(e) => setEffortPosition(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>

          {/* Load List & Actions */}
          <div className="flex flex-wrap gap-3 mb-6">
            {loads.map((load, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-slate-800/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-700/50 transition-all hover:border-slate-600"
              >
                <span className="text-lg">{load.icon}</span>
                <span className="text-white text-sm font-medium">{load.label || `Load ${index + 1}`}</span>
                <span className="text-slate-400 text-xs font-mono">({load.weight} @ {load.position.toFixed(1)})</span>
                <button
                  onClick={() => handleRemoveLoad(index)}
                  className="ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-all"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {allowAddLoads && (
              <button
                onClick={handleAddLoad}
                className="px-5 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center gap-2"
              >
                <span>+</span> Add Load
              </button>
            )}

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
            <div className="mt-6 p-4 bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-amber-400 text-lg">💡</span>
                <p className="text-amber-200 text-sm">{hint}</p>
              </div>
            </div>
          )}

          {/* Educational Info */}
          <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              How Levers Work
            </h4>
            <div className="space-y-2">
              <p className="text-slate-300 text-sm">
                A lever is a simple machine that helps us lift heavy things with less effort.
                The <span className="text-orange-400 font-semibold">fulcrum</span> is the pivot point where the lever balances.
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-green-400 font-semibold">Key Principle:</span> When the torques (force × distance) on both sides are equal, the lever is balanced!
              </p>
              {showMA && (
                <p className="text-slate-300 text-sm">
                  <span className="text-yellow-400 font-semibold">Mechanical Advantage:</span> The farther your effort is from the fulcrum compared to the load, the easier it is to lift!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeverLab;
