'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Wheel & Axle Explorer - Interactive wheel/axle system for teaching simple machines
 *
 * K-5 Engineering Primitive for understanding:
 * - Wheels make moving easier (K-1)
 * - Doorknobs vs handles (1-2)
 * - Bigger wheel = easier turn (2-3)
 * - Gear ratio introduction (4-5)
 *
 * Real-world connections: steering wheel, winch, doorknob, well crank, screwdriver
 */

export interface WheelAxleExplorerData {
  title: string;
  description: string;
  wheelDiameter: number;        // Size of outer wheel (units)
  axleDiameter: number;         // Size of inner axle (units)
  adjustable: boolean;          // Allow resizing wheel/axle
  attachedLoad: number;         // Weight on axle rope (0 = no load)
  showRatio: boolean;           // Display diameter ratio
  showForce: boolean;           // Display force values
  rotationInput: 'drag' | 'buttons' | 'slider';  // How to rotate wheel
  theme: 'steering_wheel' | 'winch' | 'doorknob' | 'well_crank';
  showMechanicalAdvantage?: boolean;  // Show MA calculation (grades 4-5)
  showRotationCount?: boolean;  // Show how many wheel turns = axle turns
  targetRotations?: number;     // Goal rotations for challenge mode
}

interface WheelAxleExplorerProps {
  data: WheelAxleExplorerData;
  className?: string;
}

const WheelAxleExplorer: React.FC<WheelAxleExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    wheelDiameter: initialWheelDiameter = 8,
    axleDiameter: initialAxleDiameter = 2,
    adjustable = true,
    attachedLoad = 0,
    showRatio = true,
    showForce = false,
    rotationInput = 'drag',
    theme = 'winch',
    showMechanicalAdvantage = false,
    showRotationCount = true,
    targetRotations = 0,
  } = data;

  const [wheelDiameter, setWheelDiameter] = useState(initialWheelDiameter);
  const [axleDiameter, setAxleDiameter] = useState(initialAxleDiameter);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastAngle, setLastAngle] = useState(0);
  const [totalRotations, setTotalRotations] = useState(0);
  const [liftHeight, setLiftHeight] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const wheelCenterRef = useRef({ x: 0, y: 0 });

  // SVG dimensions
  const svgWidth = 700;
  const svgHeight = 500;
  const centerX = svgWidth / 2;
  const centerY = 200;

  // Scale factors for visualization
  const wheelRadius = (wheelDiameter / 2) * 25;
  const axleRadius = (axleDiameter / 2) * 25;

  // Calculate mechanical advantage
  const mechanicalAdvantage = wheelDiameter / axleDiameter;

  // Calculate force required to lift load
  const requiredForce = attachedLoad > 0 ? attachedLoad / mechanicalAdvantage : 0;

  // Calculate axle rotation based on wheel rotation
  const axleRotation = wheelRotation;

  // Calculate rope/load lift based on rotation
  useEffect(() => {
    const axleCircumference = Math.PI * axleDiameter;
    const rotationFraction = wheelRotation / 360;
    const newLiftHeight = rotationFraction * axleCircumference;
    setLiftHeight(newLiftHeight);

    // Count total rotations
    const rotations = Math.abs(wheelRotation) / 360;
    setTotalRotations(rotations);

    // Check for success in challenge mode
    if (targetRotations > 0 && rotations >= targetRotations && !showSuccess) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  }, [wheelRotation, axleDiameter, targetRotations, showSuccess]);

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
  }, []);

  // Calculate angle from center to point
  const getAngle = useCallback((x: number, y: number) => {
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, [centerX, centerY]);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (rotationInput !== 'drag') return;
    e.preventDefault();
    setIsDragging(true);
    const svgCoords = screenToSVG(e.clientX, e.clientY);
    setLastAngle(getAngle(svgCoords.x, svgCoords.y));
  };

  // Handle drag move
  useEffect(() => {
    if (rotationInput !== 'drag') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const svgCoords = screenToSVG(e.clientX, e.clientY);
      const currentAngle = getAngle(svgCoords.x, svgCoords.y);
      let delta = currentAngle - lastAngle;

      // Handle wrapping around 180/-180
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      setWheelRotation(prev => prev + delta);
      setLastAngle(currentAngle);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, lastAngle, rotationInput, screenToSVG, getAngle]);

  // Rotate by fixed amount (for buttons/slider)
  const rotateWheel = (degrees: number) => {
    setWheelRotation(prev => prev + degrees);
  };

  // Reset to initial state
  const handleReset = () => {
    setWheelRotation(0);
    setTotalRotations(0);
    setLiftHeight(0);
    setHint(null);
    setShowSuccess(false);
    setWheelDiameter(initialWheelDiameter);
    setAxleDiameter(initialAxleDiameter);
  };

  // Provide a hint
  const handleGetHint = () => {
    if (mechanicalAdvantage >= 4) {
      setHint('Great setup! With a big wheel and small axle, you need less force to lift the load.');
    } else if (mechanicalAdvantage < 2) {
      setHint('Try making the wheel bigger compared to the axle. A larger wheel means less effort needed!');
    } else {
      setHint(`Your mechanical advantage is ${mechanicalAdvantage.toFixed(1)}x. This means you need ${(100/mechanicalAdvantage).toFixed(0)}% of the force to lift the load.`);
    }
    setTimeout(() => setHint(null), 4000);
  };

  // Get theme-specific colors and elements
  const getThemeStyles = () => {
    switch (theme) {
      case 'steering_wheel':
        return {
          wheelColor: '#1F2937',
          axleColor: '#6B7280',
          accentColor: '#EF4444',
          backgroundColor: '#0F172A',
          icon: '🚗',
        };
      case 'winch':
        return {
          wheelColor: '#78716C',
          axleColor: '#44403C',
          accentColor: '#F59E0B',
          backgroundColor: '#1C1917',
          icon: '🏗️',
        };
      case 'doorknob':
        return {
          wheelColor: '#D4AF37',
          axleColor: '#92400E',
          accentColor: '#FBBF24',
          backgroundColor: '#1E293B',
          icon: '🚪',
        };
      case 'well_crank':
        return {
          wheelColor: '#8B5A2B',
          axleColor: '#5C4033',
          accentColor: '#60A5FA',
          backgroundColor: '#0F172A',
          icon: '🪣',
        };
      default:
        return {
          wheelColor: '#3B82F6',
          axleColor: '#1E40AF',
          accentColor: '#60A5FA',
          backgroundColor: '#0F172A',
          icon: '⚙️',
        };
    }
  };

  const themeStyles = getThemeStyles();

  // Render wheel spokes
  const renderSpokes = (radius: number, count: number, color: string) => {
    const spokes = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * 360 / count) * (Math.PI / 180);
      spokes.push(
        <line
          key={i}
          x1={0}
          y1={0}
          x2={Math.cos(angle) * radius}
          y2={Math.sin(angle) * radius}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
    }
    return spokes;
  };

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header - Lumina style */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
          <span className="text-2xl">{themeStyles.icon}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            <p className="text-xs text-teal-400 font-mono uppercase tracking-wider">
              Interactive Wheel & Axle Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-teal-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#14B8A6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Stats Display */}
          <div className="mb-4 flex justify-center gap-4 flex-wrap">
            {showRatio && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/50">
                <span className="text-teal-300 text-sm font-mono">
                  Ratio: <span className="font-bold">{mechanicalAdvantage.toFixed(1)}:1</span>
                </span>
              </div>
            )}

            {showForce && attachedLoad > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/50">
                <span className="text-amber-300 text-sm font-mono">
                  Force needed: <span className="font-bold">{requiredForce.toFixed(1)} units</span>
                </span>
              </div>
            )}

            {showRotationCount && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/50">
                <span className="text-purple-300 text-sm font-mono">
                  Turns: <span className="font-bold">{totalRotations.toFixed(1)}</span>
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
              style={{ maxHeight: '400px', touchAction: 'none' }}
            >
              {/* Definitions */}
              <defs>
                <linearGradient id="wheelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={themeStyles.wheelColor} />
                  <stop offset="50%" stopColor={themeStyles.wheelColor} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={themeStyles.wheelColor} stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="axleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={themeStyles.axleColor} />
                  <stop offset="100%" stopColor={themeStyles.axleColor} stopOpacity={0.8} />
                </linearGradient>
                <filter id="wheelGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="black" floodOpacity="0.4"/>
                </filter>
              </defs>

              {/* Background */}
              <rect x={0} y={0} width={svgWidth} height={svgHeight} fill={themeStyles.backgroundColor} />

              {/* Grid pattern */}
              <g opacity="0.1">
                {Array.from({ length: Math.floor(svgWidth / 40) }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={svgHeight} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
                {Array.from({ length: Math.floor(svgHeight / 40) }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 40} x2={svgWidth} y2={i * 40} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
              </g>

              {/* Support/Frame structure */}
              <g>
                {/* Frame posts */}
                <rect x={centerX - 150} y={50} width={15} height={200} fill="#475569" rx={4} />
                <rect x={centerX + 135} y={50} width={15} height={200} fill="#475569" rx={4} />
                {/* Top bar */}
                <rect x={centerX - 150} y={40} width={300} height={20} fill="#64748B" rx={4} />
              </g>

              {/* Wheel and Axle assembly - rotates together */}
              <g transform={`translate(${centerX}, ${centerY}) rotate(${wheelRotation})`}>
                {/* Axle (cylinder representation) */}
                <circle
                  cx={0}
                  cy={0}
                  r={axleRadius}
                  fill="url(#axleGradient)"
                  stroke="#1E293B"
                  strokeWidth={2}
                />
                {/* Axle highlight */}
                <circle
                  cx={-axleRadius * 0.3}
                  cy={-axleRadius * 0.3}
                  r={axleRadius * 0.3}
                  fill="white"
                  opacity={0.15}
                />

                {/* Wheel outer ring */}
                <circle
                  cx={0}
                  cy={0}
                  r={wheelRadius}
                  fill="none"
                  stroke="url(#wheelGradient)"
                  strokeWidth={20}
                  filter="url(#shadow)"
                  style={{ cursor: rotationInput === 'drag' ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                  onMouseDown={handleMouseDown}
                />

                {/* Wheel inner ring */}
                <circle
                  cx={0}
                  cy={0}
                  r={wheelRadius - 15}
                  fill="none"
                  stroke={themeStyles.wheelColor}
                  strokeWidth={3}
                  opacity={0.6}
                />

                {/* Spokes */}
                <g opacity={0.8}>
                  {renderSpokes(wheelRadius - 10, 8, themeStyles.wheelColor)}
                </g>

                {/* Hub */}
                <circle
                  cx={0}
                  cy={0}
                  r={axleRadius + 10}
                  fill={themeStyles.wheelColor}
                  stroke="#1E293B"
                  strokeWidth={2}
                />

                {/* Hub highlight */}
                <circle
                  cx={-5}
                  cy={-5}
                  r={8}
                  fill="white"
                  opacity={0.2}
                />

                {/* Rotation handle/grip - theme specific */}
                {theme === 'steering_wheel' && (
                  <g>
                    {/* Three-spoke steering wheel design */}
                    {[0, 120, 240].map((angle, i) => (
                      <g key={i} transform={`rotate(${angle})`}>
                        <rect
                          x={-8}
                          y={-wheelRadius + 30}
                          width={16}
                          height={wheelRadius - 50}
                          fill={themeStyles.wheelColor}
                          rx={4}
                        />
                      </g>
                    ))}
                    {/* Center emblem */}
                    <circle cx={0} cy={0} r={25} fill="#EF4444" />
                    <text x={0} y={5} textAnchor="middle" fontSize={12} fill="white" fontWeight="bold">TURN</text>
                  </g>
                )}

                {theme === 'well_crank' && (
                  <g>
                    {/* Crank handle */}
                    <rect
                      x={wheelRadius - 20}
                      y={-12}
                      width={50}
                      height={24}
                      fill="#5C4033"
                      rx={8}
                    />
                    <circle cx={wheelRadius + 20} cy={0} r={15} fill="#8B5A2B" stroke="#5C4033" strokeWidth={3} />
                  </g>
                )}

                {/* Axle rope attachment point indicator */}
                {attachedLoad > 0 && (
                  <circle
                    cx={axleRadius}
                    cy={0}
                    r={5}
                    fill={themeStyles.accentColor}
                  />
                )}
              </g>

              {/* Rope and Load (only if load is attached) */}
              {attachedLoad > 0 && (
                <g>
                  {/* Rope from axle down */}
                  <line
                    x1={centerX + Math.cos(wheelRotation * Math.PI / 180) * axleRadius}
                    y1={centerY + Math.sin(wheelRotation * Math.PI / 180) * axleRadius}
                    x2={centerX + 80}
                    y2={300 + Math.max(0, 100 - liftHeight * 10)}
                    stroke="#A78BFA"
                    strokeWidth={4}
                    strokeDasharray="8 4"
                  />

                  {/* Load bucket/weight */}
                  <g transform={`translate(${centerX + 80}, ${300 + Math.max(0, 100 - liftHeight * 10)})`}>
                    <rect
                      x={-30}
                      y={0}
                      width={60}
                      height={50}
                      fill="#7C3AED"
                      rx={6}
                    />
                    <text x={0} y={30} textAnchor="middle" fontSize={14} fill="white" fontWeight="bold">
                      {attachedLoad} units
                    </text>
                    {/* Lift indicator */}
                    <text x={0} y={65} textAnchor="middle" fontSize={10} fill="#A78BFA" fontFamily="monospace">
                      Lifted: {liftHeight.toFixed(1)} units
                    </text>
                  </g>
                </g>
              )}

              {/* Size indicators */}
              <g transform={`translate(80, ${centerY})`}>
                {/* Wheel diameter indicator */}
                <line x1={0} y1={-wheelRadius} x2={0} y2={wheelRadius} stroke="#60A5FA" strokeWidth={2} strokeDasharray="4 2" />
                <line x1={-10} y1={-wheelRadius} x2={10} y2={-wheelRadius} stroke="#60A5FA" strokeWidth={2} />
                <line x1={-10} y1={wheelRadius} x2={10} y2={wheelRadius} stroke="#60A5FA" strokeWidth={2} />
                <rect x={-40} y={-10} width={80} height={20} rx={4} fill="rgba(96,165,250,0.2)" />
                <text x={0} y={5} textAnchor="middle" fontSize={11} fill="#60A5FA" fontFamily="monospace">
                  Wheel: {wheelDiameter}
                </text>
              </g>

              <g transform={`translate(${svgWidth - 80}, ${centerY})`}>
                {/* Axle diameter indicator */}
                <line x1={0} y1={-axleRadius} x2={0} y2={axleRadius} stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 2" />
                <line x1={-10} y1={-axleRadius} x2={10} y2={-axleRadius} stroke="#F59E0B" strokeWidth={2} />
                <line x1={-10} y1={axleRadius} x2={10} y2={axleRadius} stroke="#F59E0B" strokeWidth={2} />
                <rect x={-40} y={-10} width={80} height={20} rx={4} fill="rgba(245,158,11,0.2)" />
                <text x={0} y={5} textAnchor="middle" fontSize={11} fill="#F59E0B" fontFamily="monospace">
                  Axle: {axleDiameter}
                </text>
              </g>

              {/* Mechanical Advantage display */}
              {showMechanicalAdvantage && (
                <g transform={`translate(${svgWidth / 2}, ${svgHeight - 40})`}>
                  <rect x={-120} y={-15} width={240} height={30} rx={15} fill="rgba(20,184,166,0.2)" />
                  <text textAnchor="middle" y={5} fontSize={13} fill="#14B8A6" fontFamily="monospace" fontWeight="bold">
                    Mechanical Advantage: {mechanicalAdvantage.toFixed(2)}x
                  </text>
                </g>
              )}

              {/* Rotation direction indicator */}
              {rotationInput === 'drag' && (
                <g transform={`translate(${centerX}, ${centerY - wheelRadius - 30})`}>
                  <path
                    d="M -20 0 A 20 20 0 1 1 20 0"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth={2}
                    markerEnd="url(#arrowMarker)"
                    opacity={0.5}
                  />
                  <defs>
                    <marker id="arrowMarker" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#94A3B8" />
                    </marker>
                  </defs>
                  <text y={-8} textAnchor="middle" fontSize={10} fill="#94A3B8">
                    Drag to rotate
                  </text>
                </g>
              )}
            </svg>

            {/* Success animation overlay */}
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-teal-500/10 backdrop-blur-sm animate-fade-in">
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(20,184,166,0.5)] animate-bounce">
                  Great Job!
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Rotation Controls */}
            {rotationInput === 'buttons' && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Rotate Wheel
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => rotateWheel(-45)}
                    className="flex-1 px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/50 text-teal-300 rounded-lg font-semibold transition-all"
                  >
                    ↺ Left
                  </button>
                  <button
                    onClick={() => rotateWheel(45)}
                    className="flex-1 px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/50 text-teal-300 rounded-lg font-semibold transition-all"
                  >
                    Right ↻
                  </button>
                </div>
              </div>
            )}

            {rotationInput === 'slider' && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Wheel Rotation: <span className="text-teal-400 font-bold">{wheelRotation.toFixed(0)}°</span>
                </label>
                <input
                  type="range"
                  min={-720}
                  max={720}
                  step={15}
                  value={wheelRotation}
                  onChange={(e) => setWheelRotation(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>
            )}

            {/* Size Adjustments */}
            {adjustable && (
              <>
                <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                  <label className="block text-sm font-mono text-slate-300 mb-3">
                    Wheel Size: <span className="text-blue-400 font-bold">{wheelDiameter}</span>
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={12}
                    step={1}
                    value={wheelDiameter}
                    onChange={(e) => setWheelDiameter(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                  <label className="block text-sm font-mono text-slate-300 mb-3">
                    Axle Size: <span className="text-amber-400 font-bold">{axleDiameter}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={0.5}
                    value={axleDiameter}
                    onChange={(e) => setAxleDiameter(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </>
            )}
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

          {/* Educational Info */}
          <div className="p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              How Wheel & Axle Works
            </h4>
            <div className="space-y-2">
              <p className="text-slate-300 text-sm">
                A wheel and axle is a simple machine made of two circular objects of different sizes.
                The <span className="text-blue-400 font-semibold">wheel</span> (larger) and the
                <span className="text-amber-400 font-semibold"> axle</span> (smaller) rotate together.
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-teal-400 font-semibold">Key Principle:</span> When you turn the wheel,
                a small force on the big wheel becomes a big force on the small axle!
              </p>
              {showMechanicalAdvantage && (
                <p className="text-slate-300 text-sm">
                  <span className="text-purple-400 font-semibold">Mechanical Advantage = Wheel Diameter ÷ Axle Diameter.</span>
                  {` A ratio of ${mechanicalAdvantage.toFixed(1)}:1 means you get ${mechanicalAdvantage.toFixed(1)}× more force!`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WheelAxleExplorer;
