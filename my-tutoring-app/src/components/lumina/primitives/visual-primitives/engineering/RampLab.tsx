'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Ramp Lab - Interactive inclined plane simulation for teaching simple machines
 *
 * K-5 Engineering Primitive for understanding:
 * - Rolling vs sliding exploration (K-1)
 * - Steeper = harder to push (1-2)
 * - Height vs length trade-off (2-3)
 * - Calculating slope advantage (4-5)
 *
 * Real-world connections: loading docks, dump trucks, wheelchair ramps, skateboard ramps
 */

export type LoadType = 'box' | 'barrel' | 'wheel' | 'custom';
export type FrictionLevel = 'none' | 'low' | 'medium' | 'high';
export type RampTheme = 'loading_dock' | 'dump_truck' | 'skateboard' | 'generic';

export interface RampLabData {
  title: string;
  description: string;
  rampLength: number;           // Length of ramp surface in units
  rampAngle: number;            // Angle in degrees (0-60)
  adjustableAngle: boolean;     // Allow student control
  loadWeight: number;           // Object weight in arbitrary units
  loadType: LoadType;           // Type of object on ramp
  showMeasurements: boolean;    // Display h, l, angle
  frictionLevel: FrictionLevel; // Friction coefficient
  theme: RampTheme;             // Visual theme
  showForceArrows?: boolean;    // Show force decomposition arrows (grades 3-5)
  showMA?: boolean;             // Show mechanical advantage (grades 4-5)
  allowPush?: boolean;          // Allow student to apply push force
  pushForce?: number;           // Initial push force
  customLoadIcon?: string;      // Custom emoji for load
  customLoadLabel?: string;     // Custom label for load
}

interface RampLabProps {
  data: RampLabData;
  className?: string;
}

// Acceleration vs Force Graph Component
interface AccelerationGraphProps {
  thresholdForce: number;
  currentPushForce: number;
  mass: number;
  maxForce: number;
  canMoveUp: boolean;
}

const AccelerationGraph: React.FC<AccelerationGraphProps> = ({
  thresholdForce,
  currentPushForce,
  mass,
  maxForce,
  canMoveUp,
}) => {
  const graphWidth = 600;
  const graphHeight = 200;
  const padding = { top: 30, right: 40, bottom: 50, left: 60 };
  const plotWidth = graphWidth - padding.left - padding.right;
  const plotHeight = graphHeight - padding.top - padding.bottom;

  // Calculate max acceleration for scaling (at max force)
  const maxAcceleration = (maxForce - thresholdForce) / mass;
  const yScale = maxAcceleration > 0 ? plotHeight / (maxAcceleration * 1.2) : plotHeight;

  // Current acceleration
  const currentAcceleration = canMoveUp ? (currentPushForce - thresholdForce) / mass : 0;

  // Generate line path for acceleration curve
  const generateAccelerationPath = () => {
    const points: string[] = [];
    const numPoints = 100;

    for (let i = 0; i <= numPoints; i++) {
      const force = (i / numPoints) * maxForce;
      const x = padding.left + (force / maxForce) * plotWidth;

      let acceleration = 0;
      if (force > thresholdForce) {
        acceleration = (force - thresholdForce) / mass;
      }

      const y = padding.top + plotHeight - (acceleration * yScale);
      points.push(`${i === 0 ? 'M' : 'L'} ${x},${y}`);
    }

    return points.join(' ');
  };

  // X position for threshold line
  const thresholdX = padding.left + (thresholdForce / maxForce) * plotWidth;

  // Current point position
  const currentX = padding.left + (currentPushForce / maxForce) * plotWidth;
  const currentY = padding.top + plotHeight - (currentAcceleration * yScale);

  // Generate Y-axis ticks
  const yTicks = [];
  const numYTicks = 5;
  for (let i = 0; i <= numYTicks; i++) {
    const value = (maxAcceleration * 1.2 * i) / numYTicks;
    const y = padding.top + plotHeight - (i / numYTicks) * plotHeight;
    yTicks.push({ value, y });
  }

  // Generate X-axis ticks
  const xTicks = [];
  const numXTicks = 5;
  for (let i = 0; i <= numXTicks; i++) {
    const value = (maxForce * i) / numXTicks;
    const x = padding.left + (i / numXTicks) * plotWidth;
    xTicks.push({ value, x });
  }

  return (
    <svg
      viewBox={`0 0 ${graphWidth} ${graphHeight}`}
      className="w-full h-auto"
      style={{ maxHeight: '250px' }}
    >
      {/* Background */}
      <rect x={0} y={0} width={graphWidth} height={graphHeight} fill="transparent" />

      {/* Grid lines */}
      <g opacity="0.2">
        {yTicks.map((tick, i) => (
          <line
            key={`y-grid-${i}`}
            x1={padding.left}
            y1={tick.y}
            x2={padding.left + plotWidth}
            y2={tick.y}
            stroke="#64748B"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ))}
        {xTicks.map((tick, i) => (
          <line
            key={`x-grid-${i}`}
            x1={tick.x}
            y1={padding.top}
            x2={tick.x}
            y2={padding.top + plotHeight}
            stroke="#64748B"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ))}
      </g>

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + plotHeight}
        stroke="#94A3B8"
        strokeWidth="2"
      />
      <line
        x1={padding.left}
        y1={padding.top + plotHeight}
        x2={padding.left + plotWidth}
        y2={padding.top + plotHeight}
        stroke="#94A3B8"
        strokeWidth="2"
      />

      {/* Y-axis ticks and labels */}
      {yTicks.map((tick, i) => (
        <g key={`y-tick-${i}`}>
          <line
            x1={padding.left - 5}
            y1={tick.y}
            x2={padding.left}
            y2={tick.y}
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <text
            x={padding.left - 10}
            y={tick.y + 4}
            textAnchor="end"
            fontSize="10"
            fill="#94A3B8"
            fontFamily="monospace"
          >
            {tick.value.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X-axis ticks and labels */}
      {xTicks.map((tick, i) => (
        <g key={`x-tick-${i}`}>
          <line
            x1={tick.x}
            y1={padding.top + plotHeight}
            x2={tick.x}
            y2={padding.top + plotHeight + 5}
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <text
            x={tick.x}
            y={padding.top + plotHeight + 18}
            textAnchor="middle"
            fontSize="10"
            fill="#94A3B8"
            fontFamily="monospace"
          >
            {tick.value.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      <text
        x={padding.left + plotWidth / 2}
        y={graphHeight - 8}
        textAnchor="middle"
        fontSize="12"
        fill="#CBD5E1"
        fontFamily="monospace"
      >
        Push Force (N)
      </text>
      <text
        x={15}
        y={padding.top + plotHeight / 2}
        textAnchor="middle"
        fontSize="12"
        fill="#CBD5E1"
        fontFamily="monospace"
        transform={`rotate(-90, 15, ${padding.top + plotHeight / 2})`}
      >
        Acceleration (m/s²)
      </text>

      {/* Threshold zone (shaded area where no motion occurs) */}
      <rect
        x={padding.left}
        y={padding.top}
        width={Math.max(0, thresholdX - padding.left)}
        height={plotHeight}
        fill="#EF4444"
        opacity="0.1"
      />

      {/* Threshold line */}
      <line
        x1={thresholdX}
        y1={padding.top}
        x2={thresholdX}
        y2={padding.top + plotHeight}
        stroke="#F59E0B"
        strokeWidth="2"
        strokeDasharray="6,4"
      />
      <text
        x={thresholdX}
        y={padding.top - 8}
        textAnchor="middle"
        fontSize="10"
        fill="#F59E0B"
        fontFamily="monospace"
        fontWeight="bold"
      >
        Threshold: {thresholdForce.toFixed(1)}N
      </text>

      {/* Acceleration curve */}
      <path
        d={generateAccelerationPath()}
        fill="none"
        stroke="#10B981"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Zero acceleration line in threshold zone */}
      <line
        x1={padding.left}
        y1={padding.top + plotHeight}
        x2={thresholdX}
        y2={padding.top + plotHeight}
        stroke="#EF4444"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Current state indicator */}
      <g>
        {/* Vertical line to show current force */}
        <line
          x1={currentX}
          y1={padding.top}
          x2={currentX}
          y2={padding.top + plotHeight}
          stroke="#60A5FA"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.5"
        />

        {/* Current point */}
        <circle
          cx={currentX}
          cy={currentY}
          r={8}
          fill={canMoveUp ? '#10B981' : '#EF4444'}
          stroke="white"
          strokeWidth="2"
          className="drop-shadow-lg"
        />

        {/* Current acceleration label */}
        <g transform={`translate(${Math.min(currentX + 15, graphWidth - 80)}, ${Math.max(currentY - 10, padding.top + 20)})`}>
          <rect
            x={-5}
            y={-12}
            width={75}
            height={20}
            rx={4}
            fill="rgba(0,0,0,0.7)"
          />
          <text
            fontSize="11"
            fill={canMoveUp ? '#10B981' : '#EF4444'}
            fontFamily="monospace"
            fontWeight="bold"
          >
            a = {currentAcceleration.toFixed(2)} m/s²
          </text>
        </g>
      </g>

      {/* Legend */}
      <g transform={`translate(${padding.left + plotWidth - 150}, ${padding.top + 10})`}>
        <rect x={-5} y={-5} width={155} height={50} rx={6} fill="rgba(0,0,0,0.5)" />
        <line x1={0} y1={8} x2={20} y2={8} stroke="#10B981" strokeWidth="3" />
        <text x={25} y={12} fontSize="10" fill="#94A3B8" fontFamily="monospace">Moving (a {'>'} 0)</text>
        <line x1={0} y1={28} x2={20} y2={28} stroke="#EF4444" strokeWidth="3" />
        <text x={25} y={32} fontSize="10" fill="#94A3B8" fontFamily="monospace">Stationary (a = 0)</text>
      </g>
    </svg>
  );
};

const RampLab: React.FC<RampLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    rampLength = 10,
    rampAngle: initialAngle = 30,
    adjustableAngle = true,
    loadWeight = 5,
    loadType = 'box',
    showMeasurements = true,
    frictionLevel = 'medium',
    theme = 'generic',
    showForceArrows = false,
    showMA = false,
    allowPush = true,
    pushForce: initialPushForce = 0,
    customLoadIcon,
    customLoadLabel,
  } = data;

  const [rampAngle, setRampAngle] = useState(initialAngle);
  const [pushForce, setPushForce] = useState(initialPushForce);
  const [loadPosition, setLoadPosition] = useState(0); // 0 = bottom, 100 = top
  const [isAnimating, setIsAnimating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isDraggingLoad, setIsDraggingLoad] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | null>(null);

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 450;
  const rampBaseX = 100;
  const rampBaseY = 350;
  const maxRampWidth = 550;

  // Calculate ramp dimensions based on angle
  const angleRad = (rampAngle * Math.PI) / 180;
  const rampHeight = maxRampWidth * Math.sin(angleRad);
  const rampWidth = maxRampWidth * Math.cos(angleRad);

  // Friction coefficients
  const frictionCoefficients: Record<FrictionLevel, number> = {
    none: 0,
    low: 0.1,
    medium: 0.3,
    high: 0.5,
  };
  const frictionCoeff = frictionCoefficients[frictionLevel];

  // Calculate forces
  const gravity = 9.8;
  const normalForce = loadWeight * gravity * Math.cos(angleRad);
  const parallelForce = loadWeight * gravity * Math.sin(angleRad);
  const frictionForce = frictionCoeff * normalForce;
  const netForce = parallelForce - frictionForce + pushForce;

  // Mechanical advantage (ramp length / height)
  const mechanicalAdvantage = rampAngle > 0 ? rampLength / (rampLength * Math.sin(angleRad)) : Infinity;

  // Check if load can move up
  const canMoveUp = pushForce > (parallelForce + frictionForce);
  const canSlideDown = parallelForce > frictionForce && pushForce === 0;

  // Get load icon based on type
  const getLoadIcon = () => {
    if (customLoadIcon) return customLoadIcon;
    switch (loadType) {
      case 'box': return '📦';
      case 'barrel': return '🛢️';
      case 'wheel': return '🛞';
      default: return '📦';
    }
  };

  // Get load label
  const getLoadLabel = () => {
    if (customLoadLabel) return customLoadLabel;
    switch (loadType) {
      case 'box': return 'Box';
      case 'barrel': return 'Barrel';
      case 'wheel': return 'Wheel';
      default: return 'Load';
    }
  };

  // Get theme colors and styles
  const getThemeStyles = () => {
    switch (theme) {
      case 'loading_dock':
        return {
          rampColor: '#6B7280',
          rampStroke: '#4B5563',
          groundColor: '#374151',
          accentColor: '#F59E0B',
          bgGradient: ['#1F2937', '#111827'],
        };
      case 'dump_truck':
        return {
          rampColor: '#D97706',
          rampStroke: '#B45309',
          groundColor: '#78716C',
          accentColor: '#FBBF24',
          bgGradient: ['#292524', '#1C1917'],
        };
      case 'skateboard':
        return {
          rampColor: '#7C3AED',
          rampStroke: '#6D28D9',
          groundColor: '#4B5563',
          accentColor: '#A78BFA',
          bgGradient: ['#1E1B4B', '#0F172A'],
        };
      default:
        return {
          rampColor: '#3B82F6',
          rampStroke: '#2563EB',
          groundColor: '#374151',
          accentColor: '#60A5FA',
          bgGradient: ['#1E293B', '#0F172A'],
        };
    }
  };

  const themeStyles = getThemeStyles();

  // Calculate load position on ramp
  const getLoadPosition = useCallback(() => {
    const progress = loadPosition / 100;
    const x = rampBaseX + progress * rampWidth;
    const y = rampBaseY - progress * rampHeight;
    return { x, y };
  }, [loadPosition, rampBaseX, rampBaseY, rampWidth, rampHeight]);

  // Animation for sliding/pushing
  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = () => {
      setLoadPosition(prev => {
        let newPos = prev;
        const speed = Math.abs(netForce) * 0.02;

        if (canMoveUp && pushForce > 0) {
          newPos = Math.min(100, prev + speed);
          if (newPos >= 100) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            setIsAnimating(false);
            return 100;
          }
        } else if (canSlideDown) {
          newPos = Math.max(0, prev - speed);
          if (newPos <= 0) {
            setIsAnimating(false);
            return 0;
          }
        } else {
          setIsAnimating(false);
          return prev;
        }

        return newPos;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, canMoveUp, canSlideDown, netForce, pushForce]);

  // Handle angle change
  const handleAngleChange = (newAngle: number) => {
    setRampAngle(Math.max(0, Math.min(60, newAngle)));
    setHasUserInteracted(true);
  };

  // Handle push force change
  const handlePushForceChange = (force: number) => {
    setPushForce(Math.max(0, Math.min(100, force)));
    setHasUserInteracted(true);
  };

  // Start pushing
  const handleStartPush = () => {
    if (pushForce > 0) {
      setIsAnimating(true);
    }
  };

  // Reset everything
  const handleReset = () => {
    setRampAngle(initialAngle);
    setPushForce(initialPushForce);
    setLoadPosition(0);
    setIsAnimating(false);
    setHint(null);
    setShowSuccess(false);
    setHasUserInteracted(false);
  };

  // Provide a hint
  const handleGetHint = () => {
    if (loadPosition >= 100) {
      setHint('Great job! The load reached the top!');
    } else if (pushForce === 0) {
      setHint('Try increasing the push force to move the load up the ramp.');
    } else if (!canMoveUp) {
      setHint(`You need more push force! The load needs more than ${(parallelForce + frictionForce).toFixed(1)} units of force to move up.`);
    } else if (rampAngle > 45) {
      setHint('The ramp is very steep! Try a gentler angle to make pushing easier.');
    } else {
      setHint('Press "Push!" to start moving the load up the ramp.');
    }
    setTimeout(() => setHint(null), 4000);
  };

  // Release load to see if it slides
  const handleRelease = () => {
    if (loadPosition > 0) {
      setPushForce(0);
      setIsAnimating(true);
    }
  };

  const loadPos = getLoadPosition();

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header - Lumina style */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19l-7-7 7-7M21 19l-7-7 7-7" transform="rotate(-30 12 12)"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <p className="text-xs text-blue-400 font-mono uppercase tracking-wider">
              Inclined Plane Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-blue-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Status Display */}
          <div className="mb-4 flex justify-center gap-4">
            <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full transition-all duration-300 ${
              canMoveUp && pushForce > 0
                ? 'bg-green-500/20 border border-green-500/50'
                : canSlideDown
                ? 'bg-red-500/20 border border-red-500/50'
                : 'bg-slate-700/50 border border-slate-600/50'
            }`}>
              <span className={`w-2 h-2 rounded-full ${canMoveUp && pushForce > 0 ? 'bg-green-400' : canSlideDown ? 'bg-red-400' : 'bg-slate-400'} animate-pulse`}></span>
              <span className={`font-mono text-xs ${canMoveUp && pushForce > 0 ? 'text-green-300' : canSlideDown ? 'text-red-300' : 'text-slate-400'}`}>
                {canMoveUp && pushForce > 0 ? 'CAN PUSH UP' : canSlideDown ? 'WILL SLIDE DOWN' : 'STATIONARY'}
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
                <linearGradient id="skyGradientRamp" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={themeStyles.bgGradient[0]} />
                  <stop offset="100%" stopColor={themeStyles.bgGradient[1]} />
                </linearGradient>
                <linearGradient id="rampGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={themeStyles.rampColor} />
                  <stop offset="100%" stopColor={themeStyles.rampStroke} />
                </linearGradient>
                <filter id="glowRamp" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <marker
                  id="arrowRamp"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#10B981" />
                </marker>
                <marker
                  id="arrowRed"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
                </marker>
              </defs>

              {/* Background */}
              <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#skyGradientRamp)" />

              {/* Grid pattern */}
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
                y={rampBaseY}
                width={svgWidth}
                height={svgHeight - rampBaseY}
                fill={themeStyles.groundColor}
                opacity={0.3}
              />
              <line x1={0} y1={rampBaseY} x2={svgWidth} y2={rampBaseY} stroke={themeStyles.groundColor} strokeWidth="3" opacity="0.6" />

              {/* Ramp Triangle */}
              <polygon
                points={`${rampBaseX},${rampBaseY} ${rampBaseX + rampWidth},${rampBaseY} ${rampBaseX + rampWidth},${rampBaseY - rampHeight}`}
                fill="url(#rampGradient)"
                stroke={themeStyles.rampStroke}
                strokeWidth={2}
              />

              {/* Ramp Surface (top line) */}
              <line
                x1={rampBaseX}
                y1={rampBaseY}
                x2={rampBaseX + rampWidth}
                y2={rampBaseY - rampHeight}
                stroke={themeStyles.accentColor}
                strokeWidth={4}
                strokeLinecap="round"
              />

              {/* Height indicator */}
              {showMeasurements && (
                <g>
                  {/* Vertical height line */}
                  <line
                    x1={rampBaseX + rampWidth + 30}
                    y1={rampBaseY}
                    x2={rampBaseX + rampWidth + 30}
                    y2={rampBaseY - rampHeight}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                  />
                  <text
                    x={rampBaseX + rampWidth + 45}
                    y={rampBaseY - rampHeight / 2}
                    fill="#F59E0B"
                    fontSize={12}
                    fontFamily="monospace"
                  >
                    h = {rampHeight.toFixed(0)}
                  </text>

                  {/* Base length */}
                  <line
                    x1={rampBaseX}
                    y1={rampBaseY + 30}
                    x2={rampBaseX + rampWidth}
                    y2={rampBaseY + 30}
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                  />
                  <text
                    x={rampBaseX + rampWidth / 2}
                    y={rampBaseY + 50}
                    fill="#10B981"
                    fontSize={12}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    base = {rampWidth.toFixed(0)}
                  </text>

                  {/* Angle arc */}
                  <path
                    d={`M ${rampBaseX + 60},${rampBaseY} A 60 60 0 0 0 ${rampBaseX + 60 * Math.cos(angleRad)},${rampBaseY - 60 * Math.sin(angleRad)}`}
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth={2}
                  />
                  <text
                    x={rampBaseX + 80}
                    y={rampBaseY - 20}
                    fill="#A78BFA"
                    fontSize={14}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {rampAngle.toFixed(0)}°
                  </text>
                </g>
              )}

              {/* Force arrows (when enabled) */}
              {showForceArrows && (
                <g transform={`translate(${loadPos.x}, ${loadPos.y})`}>
                  {/* Gravity (down) */}
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={40}
                    stroke="#EF4444"
                    strokeWidth={3}
                    markerEnd="url(#arrowRed)"
                  />
                  <text x={10} y={30} fill="#EF4444" fontSize={10} fontFamily="monospace">
                    W
                  </text>

                  {/* Normal force (perpendicular to ramp) */}
                  <line
                    x1={0}
                    y1={0}
                    x2={-30 * Math.sin(angleRad)}
                    y2={-30 * Math.cos(angleRad)}
                    stroke="#60A5FA"
                    strokeWidth={3}
                    markerEnd="url(#arrowRamp)"
                  />
                  <text
                    x={-30 * Math.sin(angleRad) - 15}
                    y={-30 * Math.cos(angleRad)}
                    fill="#60A5FA"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    N
                  </text>

                  {/* Push force (up the ramp) */}
                  {pushForce > 0 && (
                    <line
                      x1={0}
                      y1={0}
                      x2={-pushForce * 0.5 * Math.cos(angleRad)}
                      y2={pushForce * 0.5 * Math.sin(angleRad)}
                      stroke="#10B981"
                      strokeWidth={3}
                      markerEnd="url(#arrowRamp)"
                    />
                  )}
                </g>
              )}

              {/* Load on ramp */}
              <g
                transform={`translate(${loadPos.x}, ${loadPos.y - 25})`}
                style={{ cursor: isDraggingLoad ? 'grabbing' : 'grab' }}
              >
                {/* Load shadow */}
                <ellipse cx={2} cy={22} rx={22} ry={6} fill="black" opacity={0.3} />

                {/* Load body */}
                <rect
                  x={-25}
                  y={-25}
                  width={50}
                  height={50}
                  rx={loadType === 'barrel' || loadType === 'wheel' ? 25 : 8}
                  fill={themeStyles.accentColor}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={2}
                  className="drop-shadow-lg"
                />

                {/* Load icon */}
                <text
                  x={0}
                  y={8}
                  textAnchor="middle"
                  fontSize={28}
                  style={{ pointerEvents: 'none' }}
                >
                  {getLoadIcon()}
                </text>

                {/* Weight label */}
                <text
                  x={0}
                  y={45}
                  textAnchor="middle"
                  fontSize={11}
                  fill="white"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {loadWeight} units
                </text>
              </g>

              {/* Position indicator */}
              <text
                x={loadPos.x}
                y={loadPos.y - 65}
                textAnchor="middle"
                fontSize={10}
                fill="#94A3B8"
                fontFamily="monospace"
              >
                {loadPosition.toFixed(0)}%
              </text>

              {/* Mechanical Advantage display */}
              {showMA && (
                <g transform={`translate(${svgWidth - 150}, 30)`}>
                  <rect x={-10} y={-5} width={140} height={45} rx={8} fill="rgba(0,0,0,0.5)" />
                  <text fontSize={11} fill="#94A3B8" fontFamily="monospace">
                    Mechanical Advantage:
                  </text>
                  <text y={25} fontSize={16} fill="#F59E0B" fontFamily="monospace" fontWeight="bold">
                    {mechanicalAdvantage.toFixed(2)}x
                  </text>
                </g>
              )}

              {/* Force summary */}
              {showForceArrows && (
                <g transform={`translate(20, 30)`}>
                  <rect x={-10} y={-5} width={170} height={80} rx={8} fill="rgba(0,0,0,0.5)" />
                  <text fontSize={10} fill="#94A3B8" fontFamily="monospace">Forces:</text>
                  <text y={18} fontSize={10} fill="#EF4444" fontFamily="monospace">
                    Down slope: {parallelForce.toFixed(1)} N
                  </text>
                  <text y={36} fontSize={10} fill="#F59E0B" fontFamily="monospace">
                    Friction: {frictionForce.toFixed(1)} N
                  </text>
                  <text y={54} fontSize={10} fill="#10B981" fontFamily="monospace">
                    Push: {pushForce.toFixed(1)} N
                  </text>
                  <text y={72} fontSize={10} fill="white" fontFamily="monospace" fontWeight="bold">
                    Net: {netForce.toFixed(1)} N
                  </text>
                </g>
              )}
            </svg>

            {/* Success animation overlay */}
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/10 backdrop-blur-sm animate-fade-in">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(34,197,94,0.5)] animate-bounce">
                  Made it to the top!
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Angle Control */}
            {adjustableAngle && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Ramp Angle: <span className="text-purple-400 font-bold">{rampAngle}°</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={rampAngle}
                  onChange={(e) => handleAngleChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Gentle (5°)</span>
                  <span>Steep (60°)</span>
                </div>
              </div>
            )}

            {/* Push Force Control */}
            {allowPush && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Push Force: <span className="text-green-400 font-bold">{pushForce.toFixed(1)} N</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={pushForce}
                  onChange={(e) => handlePushForceChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>None</span>
                  <span>Max</span>
                </div>
              </div>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50 text-center">
              <div className="text-xs text-slate-400 font-mono mb-1">Friction</div>
              <div className="text-sm text-amber-400 font-bold capitalize">{frictionLevel}</div>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50 text-center">
              <div className="text-xs text-slate-400 font-mono mb-1">Load</div>
              <div className="text-sm text-blue-400 font-bold">{getLoadLabel()}</div>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50 text-center">
              <div className="text-xs text-slate-400 font-mono mb-1">Position</div>
              <div className="text-sm text-green-400 font-bold">{loadPosition.toFixed(0)}%</div>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50 text-center">
              <div className="text-xs text-slate-400 font-mono mb-1">Net Force</div>
              <div className={`text-sm font-bold ${netForce > 0 ? 'text-green-400' : netForce < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {netForce.toFixed(1)} N
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleStartPush}
              disabled={pushForce === 0 || isAnimating}
              className="px-5 py-2.5 bg-green-500/20 hover:bg-green-500/30 disabled:bg-slate-700/30 disabled:opacity-50 border border-green-500/50 text-green-300 disabled:text-slate-500 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center gap-2"
            >
              <span>🏃</span> Push!
            </button>

            <button
              onClick={handleRelease}
              disabled={loadPosition === 0 || isAnimating}
              className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 disabled:bg-slate-700/30 disabled:opacity-50 border border-red-500/50 text-red-300 disabled:text-slate-500 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center gap-2"
            >
              <span>📉</span> Release
            </button>

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

          {/* Acceleration vs Force Graph */}
          <div className="mt-6 bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Acceleration vs Push Force
            </h4>
            <p className="text-slate-400 text-sm mb-4">
              See how the acceleration changes as you apply more force. The <span className="text-amber-400">threshold</span> shows the minimum force needed to start moving.
            </p>
            <AccelerationGraph
              thresholdForce={parallelForce + frictionForce}
              currentPushForce={pushForce}
              mass={loadWeight}
              maxForce={100}
              canMoveUp={canMoveUp}
            />
          </div>

          {/* Educational Info */}
          <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              How Ramps Work
            </h4>
            <div className="space-y-2">
              <p className="text-slate-300 text-sm">
                A ramp (inclined plane) is a simple machine that helps us lift heavy things using less force,
                but we have to push them over a longer distance.
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-purple-400 font-semibold">Key Principle:</span> A gentler slope needs less pushing force but a longer distance.
                A steeper slope is shorter but needs more force!
              </p>
              {showMA && (
                <p className="text-slate-300 text-sm">
                  <span className="text-yellow-400 font-semibold">Mechanical Advantage:</span> The longer the ramp compared to its height, the easier it is to push things up!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RampLab;
