'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type TowerStackerMetrics,
} from '../../../evaluation';

/**
 * Tower Stacker - Interactive vertical building challenge for teaching structural engineering
 *
 * K-5 Engineering Primitive for understanding:
 * - Stacking and balance (K)
 * - Wider base = more stable (K-1)
 * - Center of gravity exploration (2-3)
 * - Material efficiency (height per piece) (3-4)
 * - Wind resistance design (4-5)
 *
 * Real-world connections: buildings, skyscrapers, construction, architecture
 *
 * EVALUATION INTEGRATION:
 * - Tracks height achievement, stability scores, and wind test results
 * - Submits evaluation metrics on wind test completion
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

export interface BuildingPiece {
  id: string;
  type: 'block' | 'beam' | 'triangle' | 'arch';
  width: number;          // Width in grid units (1-4)
  height: number;         // Height in grid units (1-2)
  weight: number;         // Relative weight (affects stability)
  color: string;
  icon?: string;
}

export interface PlacedPiece {
  id: string;
  pieceType: string;
  x: number;              // X position in grid units
  y: number;              // Y position in grid units (bottom of piece)
  width: number;
  height: number;
  weight: number;
  color: string;
  rotation: number;       // 0 or 90 degrees
}

export interface AvailablePiece {
  type: 'block' | 'beam' | 'triangle' | 'arch';
  count: number;
  width: number;
  height: number;
  weight: number;
  color: string;
  icon?: string;
}

export interface TowerStackerData {
  title: string;
  description: string;
  availablePieces: AvailablePiece[];      // Block types and quantities
  targetHeight: number;                    // Goal height to reach (in grid units)
  gridMode: boolean;                       // Snap to grid vs freeform
  enableWind: boolean;                     // Apply lateral force test
  windStrength: number;                    // Force of wind test (0-100)
  showCenterOfGravity: boolean;            // Display CoG indicator
  showHeight: boolean;                     // Display height measurement
  groundWidth: number;                     // Available foundation space (grid units, typically 6-12)
  maxHeight: number;                       // Maximum build height (grid units, typically 10-20)
  theme: 'construction' | 'blocks' | 'city' | 'generic';

  // Evaluation integration (optional)
  instanceId?: string;                     // Unique instance ID for tracking
  skillId?: string;                        // Associated skill for competency tracking
  subskillId?: string;                     // Associated subskill
  objectiveId?: string;                    // Learning objective this primitive addresses
  exhibitId?: string;                      // Parent exhibit ID
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<TowerStackerMetrics>) => void;
}

interface TowerStackerProps {
  data: TowerStackerData;
  className?: string;
}

const TowerStacker: React.FC<TowerStackerProps> = ({ data, className }) => {
  const {
    title,
    description,
    availablePieces = [],
    targetHeight = 10,
    gridMode = true,
    enableWind = true,
    windStrength = 50,
    showCenterOfGravity = true,
    showHeight = true,
    groundWidth = 8,
    maxHeight = 15,
    theme = 'generic',
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Calculate total available pieces for efficiency metric
  const totalAvailablePieces = availablePieces.reduce((sum, p) => sum + p.count, 0);

  // State
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([]);
  const [selectedPieceType, setSelectedPieceType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [towerFell, setTowerFell] = useState(false);
  const [towerStood, setTowerStood] = useState(false);
  const [windOffset, setWindOffset] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [currentRotation, setCurrentRotation] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);

  // Evaluation hook - tracks timing and handles submission
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<TowerStackerMetrics>({
    primitiveType: 'tower-stacker',
    instanceId: instanceId || `tower-stacker-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 500;
  const gridUnitSize = 30;
  const groundY = svgHeight - 60;
  const buildAreaStartX = (svgWidth - groundWidth * gridUnitSize) / 2;

  // Convert grid units to SVG coordinates
  const toSvgX = (gridX: number) => buildAreaStartX + gridX * gridUnitSize;
  const toSvgY = (gridY: number) => groundY - gridY * gridUnitSize;

  // Convert SVG coordinates to grid units
  const toGridX = (svgX: number) => Math.round((svgX - buildAreaStartX) / gridUnitSize);
  const toGridY = (svgY: number) => Math.round((groundY - svgY) / gridUnitSize);

  // Get piece count used
  const getPieceUsedCount = (type: string) => {
    return placedPieces.filter(p => p.pieceType === type).length;
  };

  // Get available count for piece type
  const getAvailableCount = (type: string) => {
    const piece = availablePieces.find(p => p.type === type);
    if (!piece) return 0;
    return piece.count - getPieceUsedCount(type);
  };

  // Calculate tower height
  const calculateTowerHeight = useCallback(() => {
    if (placedPieces.length === 0) return 0;
    const maxY = Math.max(...placedPieces.map(p => p.y + p.height));
    return maxY;
  }, [placedPieces]);

  // Calculate center of gravity
  const calculateCenterOfGravity = useCallback(() => {
    if (placedPieces.length === 0) return null;

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;

    placedPieces.forEach(piece => {
      const centerX = piece.x + piece.width / 2;
      const centerY = piece.y + piece.height / 2;
      totalWeight += piece.weight;
      weightedX += centerX * piece.weight;
      weightedY += centerY * piece.weight;
    });

    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight,
    };
  }, [placedPieces]);

  // Check if piece placement is valid
  const isValidPlacement = useCallback((x: number, y: number, width: number, height: number) => {
    // Check bounds
    if (x < 0 || x + width > groundWidth) return false;
    if (y < 0 || y + height > maxHeight) return false;

    // Check overlap with existing pieces
    for (const piece of placedPieces) {
      const overlapsX = x < piece.x + piece.width && x + width > piece.x;
      const overlapsY = y < piece.y + piece.height && y + height > piece.y;
      if (overlapsX && overlapsY) return false;
    }

    // If on ground level, always valid
    if (y === 0) return true;

    // Must be supported by piece(s) below
    let supportWidth = 0;
    for (const piece of placedPieces) {
      // Check if this piece is directly below
      if (piece.y + piece.height === y) {
        const overlapStart = Math.max(x, piece.x);
        const overlapEnd = Math.min(x + width, piece.x + piece.width);
        if (overlapEnd > overlapStart) {
          supportWidth += overlapEnd - overlapStart;
        }
      }
    }

    // Need at least 50% support
    return supportWidth >= width * 0.5;
  }, [placedPieces, groundWidth, maxHeight]);

  // Calculate stability score (0-100)
  const calculateStability = useCallback(() => {
    if (placedPieces.length === 0) return 100;

    const cog = calculateCenterOfGravity();
    if (!cog) return 100;

    // Find base width
    const basePieces = placedPieces.filter(p => p.y === 0);
    if (basePieces.length === 0) return 0;

    const baseLeft = Math.min(...basePieces.map(p => p.x));
    const baseRight = Math.max(...basePieces.map(p => p.x + p.width));
    const baseWidth = baseRight - baseLeft;
    const baseCenter = baseLeft + baseWidth / 2;

    // How centered is the CoG?
    const cogOffset = Math.abs(cog.x - baseCenter);
    const maxOffset = baseWidth / 2;
    const centeredness = 1 - Math.min(cogOffset / maxOffset, 1);

    // Height penalty (taller = less stable)
    const height = calculateTowerHeight();
    const heightPenalty = Math.min(height / maxHeight, 1) * 0.3;

    // Base width bonus (wider = more stable)
    const widthBonus = Math.min(baseWidth / groundWidth, 1) * 0.2;

    const stability = (centeredness * 0.7 + widthBonus - heightPenalty) * 100;
    return Math.max(0, Math.min(100, stability));
  }, [placedPieces, calculateCenterOfGravity, calculateTowerHeight, groundWidth, maxHeight]);

  // Calculate base width for metrics
  const calculateBaseWidth = useCallback(() => {
    const basePieces = placedPieces.filter(p => p.y === 0);
    if (basePieces.length === 0) return 0;
    const baseLeft = Math.min(...basePieces.map(p => p.x));
    const baseRight = Math.max(...basePieces.map(p => p.x + p.width));
    return baseRight - baseLeft;
  }, [placedPieces]);

  // Calculate base center for CoG offset
  const calculateBaseCenter = useCallback(() => {
    const basePieces = placedPieces.filter(p => p.y === 0);
    if (basePieces.length === 0) return groundWidth / 2;
    const baseLeft = Math.min(...basePieces.map(p => p.x));
    const baseRight = Math.max(...basePieces.map(p => p.x + p.width));
    return baseLeft + (baseRight - baseLeft) / 2;
  }, [placedPieces, groundWidth]);

  // Wind test simulation
  const runWindTest = useCallback(() => {
    setIsSimulating(true);
    setTowerFell(false);
    setTowerStood(false);
    setWindOffset(0);

    const stability = calculateStability();
    const windThreshold = 100 - windStrength;
    const currentHeight = calculateTowerHeight();
    const heightGoalMet = currentHeight >= targetHeight;

    // Animate wind effect
    let frame = 0;
    const maxFrames = 60;
    const peakOffset = (windStrength / 100) * 30;

    const animate = () => {
      frame++;
      const progress = frame / maxFrames;

      // Oscillating wind effect
      const oscillation = Math.sin(progress * Math.PI * 4) * (1 - progress * 0.5);
      setWindOffset(oscillation * peakOffset);

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        setWindOffset(0);

        const windTestPassed = stability >= windThreshold;

        // Determine if tower survives
        if (windTestPassed) {
          setTowerStood(true);
          setHint("Your tower stood strong against the wind!");
        } else {
          setTowerFell(true);
          setHint("The tower was too unstable and fell! Try building a wider base.");
        }

        // Submit evaluation if not already submitted
        if (!hasSubmittedEvaluation) {
          const cog = calculateCenterOfGravity();
          const baseCenter = calculateBaseCenter();
          const baseWidth = calculateBaseWidth();

          // Calculate overall success (both height and wind test)
          const success = heightGoalMet && windTestPassed;

          // Calculate score: 50% height achievement + 50% stability
          const heightScore = Math.min(currentHeight / targetHeight, 1) * 50;
          const stabilityScore = (stability / 100) * 50;
          const score = heightScore + stabilityScore;

          const metrics: TowerStackerMetrics = {
            type: 'tower-stacker',
            targetHeight,
            achievedHeight: currentHeight,
            heightGoalMet,
            stabilityScore: stability,
            windTestPassed,
            windStrength,
            piecesUsed: placedPieces.length,
            piecesAvailable: totalAvailablePieces,
            efficiency: placedPieces.length > 0 ? currentHeight / placedPieces.length : 0,
            baseWidth,
            centerOfGravityOffset: cog ? Math.abs(cog.x - baseCenter) : 0,
            placedPieces: [...placedPieces], // Clone for immutability
          };

          submitEvaluation(success, score, metrics, { placedPieces });
        }

        setTimeout(() => {
          setIsSimulating(false);
        }, 1500);
      }
    };

    requestAnimationFrame(animate);
  }, [
    calculateStability,
    calculateTowerHeight,
    calculateCenterOfGravity,
    calculateBaseWidth,
    calculateBaseCenter,
    windStrength,
    targetHeight,
    placedPieces,
    totalAvailablePieces,
    hasSubmittedEvaluation,
    submitEvaluation,
  ]);

  // Handle canvas click to place piece
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!selectedPieceType || isSimulating) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;

    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    // Find the piece config
    const pieceConfig = availablePieces.find(p => p.type === selectedPieceType);
    if (!pieceConfig) return;

    // Check availability
    if (getAvailableCount(selectedPieceType) <= 0) {
      setHint(`No more ${selectedPieceType}s available!`);
      setTimeout(() => setHint(null), 2000);
      return;
    }

    // Calculate grid position (adjust for rotation)
    const effectiveWidth = currentRotation === 90 ? pieceConfig.height : pieceConfig.width;
    const effectiveHeight = currentRotation === 90 ? pieceConfig.width : pieceConfig.height;

    let gridX = toGridX(svgX - (effectiveWidth * gridUnitSize) / 2);
    let gridY = toGridY(svgY + (effectiveHeight * gridUnitSize) / 2);

    // Snap to grid if enabled
    if (gridMode) {
      gridX = Math.round(gridX);
      gridY = Math.max(0, Math.round(gridY));
    }

    // Clamp to valid range
    gridX = Math.max(0, Math.min(groundWidth - effectiveWidth, gridX));

    // Find lowest valid Y position (gravity)
    let targetY = 0;
    for (let y = gridY; y >= 0; y--) {
      if (isValidPlacement(gridX, y, effectiveWidth, effectiveHeight)) {
        targetY = y;
        break;
      }
    }

    // Final validation
    if (!isValidPlacement(gridX, targetY, effectiveWidth, effectiveHeight)) {
      setHint("Can't place here - needs support!");
      setTimeout(() => setHint(null), 2000);
      return;
    }

    // Place the piece
    const newPiece: PlacedPiece = {
      id: `piece-${Date.now()}`,
      pieceType: selectedPieceType,
      x: gridX,
      y: targetY,
      width: effectiveWidth,
      height: effectiveHeight,
      weight: pieceConfig.weight,
      color: pieceConfig.color,
      rotation: currentRotation,
    };

    setPlacedPieces([...placedPieces, newPiece]);
    setTowerFell(false);
    setTowerStood(false);
  }, [selectedPieceType, isSimulating, availablePieces, currentRotation, gridMode, groundWidth, placedPieces, isValidPlacement, getAvailableCount]);

  // Handle mouse move for drag preview
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!selectedPieceType || isSimulating) {
      setDragPreview(null);
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;

    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    const pieceConfig = availablePieces.find(p => p.type === selectedPieceType);
    if (!pieceConfig) return;

    const effectiveWidth = currentRotation === 90 ? pieceConfig.height : pieceConfig.width;
    const effectiveHeight = currentRotation === 90 ? pieceConfig.width : pieceConfig.height;

    let gridX = toGridX(svgX - (effectiveWidth * gridUnitSize) / 2);
    let gridY = toGridY(svgY + (effectiveHeight * gridUnitSize) / 2);

    if (gridMode) {
      gridX = Math.round(gridX);
      gridY = Math.max(0, Math.round(gridY));
    }

    gridX = Math.max(0, Math.min(groundWidth - effectiveWidth, gridX));

    setDragPreview({ x: gridX, y: gridY });
  }, [selectedPieceType, isSimulating, availablePieces, currentRotation, gridMode, groundWidth]);

  // Delete piece
  const deletePiece = (pieceId: string) => {
    // Check if other pieces depend on this one
    const pieceToDelete = placedPieces.find(p => p.id === pieceId);
    if (!pieceToDelete) return;

    // Remove the piece and any unsupported pieces above
    const newPieces = placedPieces.filter(p => p.id !== pieceId);
    setPlacedPieces(newPieces);
    setTowerFell(false);
    setTowerStood(false);
  };

  // Reset
  const handleReset = () => {
    setPlacedPieces([]);
    setSelectedPieceType(null);
    setTowerFell(false);
    setTowerStood(false);
    setWindOffset(0);
    setIsSimulating(false);
    // Reset evaluation for a new attempt
    resetEvaluationAttempt();
  };

  // Rotate selected piece
  const handleRotate = () => {
    setCurrentRotation(prev => (prev + 90) % 180);
  };

  // Get theme colors
  const getThemeColors = () => {
    switch (theme) {
      case 'construction':
        return { ground: '#92400E', sky: '#0369A1', grid: '#F59E0B' };
      case 'blocks':
        return { ground: '#16A34A', sky: '#7C3AED', grid: '#A855F7' };
      case 'city':
        return { ground: '#374151', sky: '#1E3A5F', grid: '#3B82F6' };
      default:
        return { ground: '#475569', sky: '#0F172A', grid: '#6366F1' };
    }
  };

  const themeColors = getThemeColors();
  const currentHeight = calculateTowerHeight();
  const cog = calculateCenterOfGravity();
  const stability = calculateStability();
  const heightAchieved = currentHeight >= targetHeight;

  // Get piece shape path
  const getPieceShape = (piece: PlacedPiece) => {
    const x = toSvgX(piece.x) + windOffset * (piece.y / maxHeight);
    const y = toSvgY(piece.y + piece.height);
    const w = piece.width * gridUnitSize;
    const h = piece.height * gridUnitSize;

    switch (piece.pieceType) {
      case 'triangle':
        return `M ${x + w / 2} ${y} L ${x} ${y + h} L ${x + w} ${y + h} Z`;
      case 'arch':
        return `M ${x} ${y + h} L ${x} ${y + h / 2} Q ${x + w / 2} ${y} ${x + w} ${y + h / 2} L ${x + w} ${y + h} Z`;
      default:
        return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <p className="text-xs text-amber-400 font-mono uppercase tracking-wider">
              Tower Building Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-amber-500/20 relative overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Status Bar */}
          <div className="mb-4 flex justify-center gap-4 flex-wrap">
            {showHeight && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                heightAchieved ? 'bg-green-500/20 border border-green-500/50' : 'bg-slate-700/50 border border-slate-600/50'
              }`}>
                <span className="text-sm font-mono">
                  Height: <span className={heightAchieved ? 'text-green-300' : 'text-slate-300'}>{currentHeight}</span>/{targetHeight}
                </span>
              </div>
            )}

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              stability >= 70 ? 'bg-green-500/20 border border-green-500/50' :
              stability >= 40 ? 'bg-amber-500/20 border border-amber-500/50' :
              'bg-red-500/20 border border-red-500/50'
            }`}>
              <span className="text-sm font-mono">
                Stability: <span className={
                  stability >= 70 ? 'text-green-300' :
                  stability >= 40 ? 'text-amber-300' :
                  'text-red-300'
                }>{Math.round(stability)}%</span>
              </span>
            </div>

            {towerStood && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/50 animate-pulse">
                <span className="text-green-300 font-bold">Tower Stands!</span>
              </div>
            )}

            {towerFell && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/50 animate-pulse">
                <span className="text-red-300 font-bold">Tower Fell!</span>
              </div>
            )}
          </div>

          {/* SVG Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 border border-slate-700/50">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none"
              style={{ maxHeight: '400px', cursor: selectedPieceType ? 'crosshair' : 'default' }}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setDragPreview(null)}
            >
              {/* Defs */}
              <defs>
                <linearGradient id="skyGradientTower" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={themeColors.sky} />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
                <pattern id="gridPattern" width={gridUnitSize} height={gridUnitSize} patternUnits="userSpaceOnUse">
                  <rect width={gridUnitSize} height={gridUnitSize} fill="none" stroke={themeColors.grid} strokeWidth="0.5" opacity="0.2" />
                </pattern>
              </defs>

              {/* Sky */}
              <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#skyGradientTower)" />

              {/* Grid */}
              <rect
                x={buildAreaStartX}
                y={groundY - maxHeight * gridUnitSize}
                width={groundWidth * gridUnitSize}
                height={maxHeight * gridUnitSize}
                fill="url(#gridPattern)"
              />

              {/* Target height line */}
              <line
                x1={buildAreaStartX - 20}
                y1={toSvgY(targetHeight)}
                x2={buildAreaStartX + groundWidth * gridUnitSize + 20}
                y2={toSvgY(targetHeight)}
                stroke="#22C55E"
                strokeWidth={2}
                strokeDasharray="8,4"
                opacity={0.6}
              />
              <text
                x={buildAreaStartX - 25}
                y={toSvgY(targetHeight) + 4}
                fill="#22C55E"
                fontSize="12"
                textAnchor="end"
                fontFamily="monospace"
              >
                Goal: {targetHeight}
              </text>

              {/* Ground */}
              <rect
                x={0}
                y={groundY}
                width={svgWidth}
                height={60}
                fill={themeColors.ground}
              />

              {/* Build area border */}
              <rect
                x={buildAreaStartX}
                y={groundY - maxHeight * gridUnitSize}
                width={groundWidth * gridUnitSize}
                height={maxHeight * gridUnitSize}
                fill="none"
                stroke={themeColors.grid}
                strokeWidth="2"
                opacity="0.3"
              />

              {/* Placed pieces */}
              {placedPieces.map(piece => (
                <g
                  key={piece.id}
                  style={{ cursor: isSimulating ? 'default' : 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSimulating) deletePiece(piece.id);
                  }}
                >
                  {/* Piece shadow */}
                  <path
                    d={getPieceShape({ ...piece, x: piece.x + 0.1, y: piece.y - 0.1 })}
                    fill="black"
                    opacity={0.3}
                  />

                  {/* Piece */}
                  <path
                    d={getPieceShape(piece)}
                    fill={piece.color}
                    stroke="white"
                    strokeWidth={1.5}
                    className={`transition-all duration-150 ${towerFell ? 'animate-pulse opacity-50' : ''}`}
                  />

                  {/* Delete indicator on hover */}
                  {!isSimulating && (
                    <text
                      x={toSvgX(piece.x + piece.width / 2) + windOffset * (piece.y / maxHeight)}
                      y={toSvgY(piece.y + piece.height / 2) + 5}
                      textAnchor="middle"
                      fontSize="12"
                      fill="white"
                      opacity={0.5}
                      className="pointer-events-none"
                    >
                      click to remove
                    </text>
                  )}
                </g>
              ))}

              {/* Drag preview */}
              {dragPreview && selectedPieceType && (
                (() => {
                  const pieceConfig = availablePieces.find(p => p.type === selectedPieceType);
                  if (!pieceConfig) return null;

                  const effectiveWidth = currentRotation === 90 ? pieceConfig.height : pieceConfig.width;
                  const effectiveHeight = currentRotation === 90 ? pieceConfig.width : pieceConfig.height;

                  const previewPiece: PlacedPiece = {
                    id: 'preview',
                    pieceType: selectedPieceType,
                    x: dragPreview.x,
                    y: dragPreview.y,
                    width: effectiveWidth,
                    height: effectiveHeight,
                    weight: pieceConfig.weight,
                    color: pieceConfig.color,
                    rotation: currentRotation,
                  };

                  const isValid = isValidPlacement(dragPreview.x, 0, effectiveWidth, effectiveHeight) ||
                                  isValidPlacement(dragPreview.x, dragPreview.y, effectiveWidth, effectiveHeight);

                  return (
                    <path
                      d={getPieceShape(previewPiece)}
                      fill={isValid ? pieceConfig.color : '#EF4444'}
                      opacity={0.5}
                      stroke={isValid ? 'white' : '#EF4444'}
                      strokeWidth={2}
                      strokeDasharray="4,4"
                      className="pointer-events-none"
                    />
                  );
                })()
              )}

              {/* Center of gravity indicator */}
              {showCenterOfGravity && cog && placedPieces.length > 0 && (
                <g>
                  <line
                    x1={toSvgX(cog.x) + windOffset * (cog.y / maxHeight)}
                    y1={toSvgY(cog.y) - 10}
                    x2={toSvgX(cog.x) + windOffset * (cog.y / maxHeight)}
                    y2={groundY}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    opacity={0.7}
                  />
                  <circle
                    cx={toSvgX(cog.x) + windOffset * (cog.y / maxHeight)}
                    cy={toSvgY(cog.y)}
                    r={8}
                    fill="#F59E0B"
                    stroke="white"
                    strokeWidth={2}
                  />
                  <text
                    x={toSvgX(cog.x) + windOffset * (cog.y / maxHeight)}
                    y={toSvgY(cog.y) + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="white"
                    fontWeight="bold"
                  >
                    CG
                  </text>
                </g>
              )}

              {/* Wind indicator */}
              {isSimulating && enableWind && (
                <g>
                  <text
                    x={30}
                    y={svgHeight / 2}
                    fontSize="32"
                    className="animate-pulse"
                  >
                    💨
                  </text>
                  <text
                    x={30}
                    y={svgHeight / 2 + 40}
                    fontSize="12"
                    fill="#94A3B8"
                    fontFamily="monospace"
                  >
                    Wind: {windStrength}%
                  </text>
                </g>
              )}

              {/* Height ruler */}
              {showHeight && (
                <g>
                  {Array.from({ length: maxHeight + 1 }).map((_, i) => (
                    <g key={i}>
                      <line
                        x1={buildAreaStartX - 15}
                        y1={toSvgY(i)}
                        x2={buildAreaStartX - 5}
                        y2={toSvgY(i)}
                        stroke="#64748B"
                        strokeWidth={1}
                      />
                      {i % 2 === 0 && (
                        <text
                          x={buildAreaStartX - 20}
                          y={toSvgY(i) + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="#64748B"
                          fontFamily="monospace"
                        >
                          {i}
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              )}

              {/* Instructions */}
              {!isSimulating && placedPieces.length === 0 && (
                <text x={svgWidth / 2} y={60} textAnchor="middle" fill="#94A3B8" fontSize="14" fontFamily="monospace">
                  Select a piece below, then click to place it!
                </text>
              )}
            </svg>
          </div>

          {/* Piece Selector */}
          <div className="mb-6 flex flex-wrap justify-center gap-3">
            {availablePieces.map(piece => {
              const available = getAvailableCount(piece.type);
              const isSelected = selectedPieceType === piece.type;

              return (
                <button
                  key={piece.type}
                  onClick={() => setSelectedPieceType(isSelected ? null : piece.type)}
                  disabled={available <= 0}
                  className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                      : available > 0
                        ? 'bg-slate-800/40 border-slate-600 text-slate-300 hover:bg-slate-700/40'
                        : 'bg-slate-800/20 border-slate-700 text-slate-500 opacity-50'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: piece.color }}
                  />
                  <div className="text-left">
                    <div className="font-semibold capitalize">{piece.type}</div>
                    <div className="text-xs opacity-75">
                      {available} left ({piece.width}x{piece.height})
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Rotate button */}
            {selectedPieceType && (
              <button
                onClick={handleRotate}
                className="px-4 py-3 rounded-xl border border-slate-600 bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 transition-all flex items-center gap-2"
              >
                <span>🔄</span>
                <span className="text-sm">Rotate</span>
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center">
            {enableWind && (
              <button
                onClick={runWindTest}
                disabled={isSimulating || placedPieces.length === 0}
                className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-cyan-500/50 text-cyan-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-2"
              >
                {isSimulating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <span>💨</span>
                    Wind Test
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleReset}
              disabled={isSimulating}
              className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all flex items-center gap-2"
            >
              <span>↺</span> Reset
            </button>
          </div>

          {/* Hint */}
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
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tower Building Tips
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                <span className="text-amber-400 font-semibold">Build a wide base!</span> A wider foundation makes your tower more stable.
              </p>
              <p className="text-slate-300">
                <span className="text-green-400 font-semibold">Center of Gravity (CG)</span> should stay over your base. If it goes too far to one side, the tower will tip!
              </p>
              {enableWind && (
                <p className="text-slate-300">
                  <span className="text-cyan-400 font-semibold">Wind test</span> pushes on your tower. Shorter, wider towers resist wind better than tall, skinny ones.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TowerStacker;
