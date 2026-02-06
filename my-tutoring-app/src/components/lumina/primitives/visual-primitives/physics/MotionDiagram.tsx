'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  usePrimitiveEvaluation,
  type MotionDiagramMetrics,
} from '../../../evaluation';

/**
 * Motion Diagram / Strobe Diagram - Interactive visualization for teaching kinematics
 *
 * Middle School - High School Physics Primitive for understanding:
 * - Introduction to motion (Middle School)
 * - Velocity concept (Middle School/High School)
 * - Acceleration concept (High School)
 * - Projectile motion analysis (High School)
 * - Circular motion (High School/AP)
 *
 * Real-world connections: sports analysis, car safety, space travel
 *
 * EVALUATION INTEGRATION:
 * - Tracks student understanding of motion patterns
 * - Measures accuracy in identifying velocity and acceleration
 * - Submits evaluation metrics on task completion
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

export interface PositionMarker {
  x: number;           // X position in canvas coordinates
  y: number;           // Y position in canvas coordinates
  time: number;        // Time at this position (seconds)
  velocityX?: number;  // X component of velocity (for vector display)
  velocityY?: number;  // Y component of velocity (for vector display)
  accelerationX?: number; // X component of acceleration
  accelerationY?: number; // Y component of acceleration
}

export type MotionType = 'uniform' | 'accelerated' | 'projectile' | 'circular' | 'custom';

export interface MotionDiagramData {
  title: string;
  description: string;
  motionType: MotionType;
  timeInterval: number;              // Seconds between markers (e.g., 0.5, 1.0)
  showVelocityVectors: boolean;      // Display velocity arrows
  showAccelerationVectors: boolean;  // Display acceleration arrows
  showPath: boolean;                 // Draw trajectory line
  vectorScale: number;               // Size multiplier for vector arrows
  markerCount: number;               // Number of position markers
  gridSize: number;                  // Grid spacing in pixels

  // Pre-generated motion path (optional - for evaluation mode)
  positions?: PositionMarker[];

  // Interactive mode settings
  interactive: boolean;              // Allow student to create/modify motion
  showGrid: boolean;                 // Display grid overlay
  showMeasurements: boolean;         // Show distance measurements between markers

  // Evaluation mode settings
  targetMotionType?: MotionType;     // What type of motion should student identify
  targetVectorCount?: number;        // How many vectors student should place

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<MotionDiagramMetrics>) => void;
}

interface MotionDiagramProps {
  data: MotionDiagramData;
  className?: string;
}

const MotionDiagram: React.FC<MotionDiagramProps> = ({ data, className }) => {
  const {
    title,
    description,
    motionType = 'uniform',
    timeInterval = 1.0,
    showVelocityVectors = true,
    showAccelerationVectors = false,
    showPath = true,
    vectorScale = 1.0,
    markerCount = 5,
    gridSize = 40,
    positions: initialPositions = null,
    interactive = true,
    showGrid = true,
    showMeasurements = false,
    targetMotionType,
    targetVectorCount,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [positions, setPositions] = useState<PositionMarker[]>(initialPositions || []);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);
  const [studentVectors, setStudentVectors] = useState<{ position: number; type: 'velocity' | 'acceleration' }[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [identifiedMotionType, setIdentifiedMotionType] = useState<MotionType | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<MotionDiagramMetrics>({
    primitiveType: 'motion-diagram',
    instanceId: instanceId || `motion-diagram-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // Canvas dimensions
  const canvasWidth = 800;
  const canvasHeight = 400;

  // Generate default positions based on motion type
  useEffect(() => {
    if ((!initialPositions || initialPositions.length === 0) && !interactive) {
      const generated = generateMotionPath(motionType, markerCount, timeInterval, canvasWidth, canvasHeight);
      setPositions(generated);
    }
  }, [motionType, markerCount, timeInterval, interactive, initialPositions?.length, canvasWidth, canvasHeight]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    }

    // Draw path
    if (showPath && positions.length > 1) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(positions[0].x, positions[0].y);
      for (let i = 1; i < positions.length; i++) {
        ctx.lineTo(positions[i].x, positions[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw position markers
    positions.forEach((pos, index) => {
      const isVisible = !isAnimating || index <= currentAnimationIndex;
      if (!isVisible) return;

      // Draw marker
      ctx.fillStyle = selectedMarker === index ? '#3b82f6' : '#1e293b';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw time label
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText(`t=${pos.time.toFixed(1)}s`, pos.x + 10, pos.y - 10);

      // Draw velocity vector
      if (showVelocityVectors && pos.velocityX !== undefined && pos.velocityY !== undefined) {
        drawVector(ctx, pos.x, pos.y, pos.velocityX * vectorScale, pos.velocityY * vectorScale, '#10b981', 'v');
      }

      // Draw acceleration vector
      if (showAccelerationVectors && pos.accelerationX !== undefined && pos.accelerationY !== undefined) {
        drawVector(ctx, pos.x, pos.y, pos.accelerationX * vectorScale * 2, pos.accelerationY * vectorScale * 2, '#f59e0b', 'a');
      }

      // Draw measurements
      if (showMeasurements && index > 0) {
        const prevPos = positions[index - 1];
        const dx = pos.x - prevPos.x;
        const dy = pos.y - prevPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const midX = (pos.x + prevPos.x) / 2;
        const midY = (pos.y + prevPos.y) / 2;

        ctx.fillStyle = '#6366f1';
        ctx.font = '11px sans-serif';
        ctx.fillText(`${distance.toFixed(0)}px`, midX, midY - 5);
      }
    });
  }, [positions, showGrid, showPath, showVelocityVectors, showAccelerationVectors, showMeasurements,
      gridSize, vectorScale, isAnimating, currentAnimationIndex, selectedMarker, canvasWidth, canvasHeight]);

  // Helper: Draw vector arrow
  const drawVector = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    label: string
  ) => {
    const magnitude = Math.sqrt(vx * vx + vy * vy);
    if (magnitude < 1) return; // Don't draw very small vectors

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    // Arrow body
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + vx, y + vy);
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(vy, vx);
    const headLength = 10;
    ctx.beginPath();
    ctx.moveTo(x + vx, y + vy);
    ctx.lineTo(
      x + vx - headLength * Math.cos(angle - Math.PI / 6),
      y + vy - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(x + vx, y + vy);
    ctx.lineTo(
      x + vx - headLength * Math.cos(angle + Math.PI / 6),
      y + vy - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();

    // Label
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, x + vx + 10, y + vy);
  };

  // Animation control
  const handlePlayAnimation = () => {
    setIsAnimating(true);
    setCurrentAnimationIndex(0);

    const animate = () => {
      setCurrentAnimationIndex((prev) => {
        if (prev >= positions.length - 1) {
          setIsAnimating(false);
          return prev;
        }
        animationFrameRef.current = window.setTimeout(() => {
          requestAnimationFrame(animate);
        }, timeInterval * 300); // Adjust animation speed
        return prev + 1;
      });
    };

    animate();
  };

  const handleStopAnimation = () => {
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
    }
    setIsAnimating(false);
    setCurrentAnimationIndex(positions.length - 1);
  };

  // Interactive: Add marker on click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || isAnimating) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newMarker: PositionMarker = {
      x,
      y,
      time: positions.length * timeInterval,
    };

    // Calculate velocity if there's a previous marker
    if (positions.length > 0) {
      const prevMarker = positions[positions.length - 1];
      const vx = (x - prevMarker.x) / timeInterval / 20; // Scale down for display
      const vy = (y - prevMarker.y) / timeInterval / 20;
      newMarker.velocityX = vx;
      newMarker.velocityY = vy;

      // Calculate acceleration if there are two previous markers
      if (positions.length > 1 && prevMarker.velocityX !== undefined && prevMarker.velocityY !== undefined) {
        const ax = (vx - prevMarker.velocityX) / timeInterval;
        const ay = (vy - prevMarker.velocityY) / timeInterval;
        newMarker.accelerationX = ax;
        newMarker.accelerationY = ay;
      }
    }

    setPositions([...positions, newMarker]);
  };

  // Evaluation: Identify motion type
  const handleIdentifyMotion = (type: MotionType) => {
    setIdentifiedMotionType(type);
  };

  // Submit evaluation
  const handleSubmit = () => {
    if (hasSubmittedEvaluation) return;

    // Calculate metrics
    const motionTypeCorrect = targetMotionType ? identifiedMotionType === targetMotionType : true;
    const vectorsPlaced = studentVectors.length;
    const vectorsCorrect = targetVectorCount ? vectorsPlaced >= targetVectorCount : true;

    const success = motionTypeCorrect && vectorsCorrect;
    const score = success ? 100 : (
      (motionTypeCorrect ? 50 : 0) + (vectorsCorrect ? 50 : 0)
    );

    // Analyze motion pattern
    const avgVelocity = calculateAverageVelocity(positions);
    const avgAcceleration = calculateAverageAcceleration(positions);
    const isUniform = avgAcceleration < 5; // Threshold for uniform motion

    const metrics: MotionDiagramMetrics = {
      type: 'motion-diagram',
      motionType: identifiedMotionType || motionType,
      targetMotionType,
      motionTypeCorrect,
      markersPlaced: positions.length,
      markerCount,
      velocityVectorsShown: showVelocityVectors ? positions.filter(p => p.velocityX !== undefined).length : 0,
      accelerationVectorsShown: showAccelerationVectors ? positions.filter(p => p.accelerationX !== undefined).length : 0,
      averageVelocity: avgVelocity,
      averageAcceleration: avgAcceleration,
      uniformMotion: isUniform,
      timeInterval,
      vectorsPlaced,
      vectorsCorrect,
    };

    submitEvaluation(success, score, metrics, {
      studentWork: { positions, identifiedMotionType, studentVectors },
    });
  };

  const handleReset = () => {
    setPositions(initialPositions || []);
    setIsAnimating(false);
    setCurrentAnimationIndex(0);
    setStudentVectors([]);
    setSelectedMarker(null);
    setIdentifiedMotionType(null);
    resetEvaluationAttempt();
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">
          {title}
        </h3>
        <p className="text-blue-700 dark:text-blue-300">
          {description}
        </p>
      </div>

      {/* Canvas */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onClick={handleCanvasClick}
          className="cursor-crosshair w-full"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handlePlayAnimation}
          disabled={isAnimating || positions.length < 2}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ▶ Play Animation
        </button>

        <button
          onClick={handleStopAnimation}
          disabled={!isAnimating}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ⏹ Stop
        </button>

        {interactive && (
          <button
            onClick={() => setPositions([])}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Motion Type Identification (Evaluation Mode) */}
      {targetMotionType && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
            What type of motion is this?
          </h4>
          <div className="flex flex-wrap gap-2">
            {(['uniform', 'accelerated', 'projectile', 'circular'] as MotionType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleIdentifyMotion(type)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  identifiedMotionType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Time Interval</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{timeInterval.toFixed(1)}s</div>
        </div>

        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="text-sm text-green-600 dark:text-green-400 font-medium">Markers</div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">{positions.length}</div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Motion Type</div>
          <div className="text-lg font-bold text-purple-900 dark:text-purple-100 capitalize">{motionType}</div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
          <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Total Time</div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
            {(positions.length * timeInterval).toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Submit / Reset Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={hasSubmittedEvaluation || positions.length < 2}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {hasSubmittedEvaluation ? '✓ Submitted' : 'Submit Analysis'}
        </button>

        {hasSubmittedEvaluation && (
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-semibold"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// Helper: Generate motion path based on type
function generateMotionPath(
  motionType: MotionType,
  count: number,
  timeInterval: number,
  canvasWidth: number,
  canvasHeight: number
): PositionMarker[] {
  const positions: PositionMarker[] = [];
  const startX = 100;
  const startY = canvasHeight / 2;

  for (let i = 0; i < count; i++) {
    const t = i * timeInterval;
    let x = startX;
    let y = startY;
    let vx = 0;
    let vy = 0;
    let ax = 0;
    let ay = 0;

    switch (motionType) {
      case 'uniform':
        // Constant velocity
        x = startX + i * 80;
        y = startY;
        vx = 80 / timeInterval / 20;
        vy = 0;
        ax = 0;
        ay = 0;
        break;

      case 'accelerated':
        // Constant acceleration
        x = startX + i * 60 + i * i * 10;
        y = startY;
        vx = (60 + 20 * i) / timeInterval / 20;
        vy = 0;
        ax = 20 / timeInterval / timeInterval;
        ay = 0;
        break;

      case 'projectile':
        // Parabolic motion
        x = startX + i * 80;
        y = startY - (i * 40 - i * i * 15);
        vx = 80 / timeInterval / 20;
        vy = (40 - 30 * i) / timeInterval / 20;
        ax = 0;
        ay = -30 / timeInterval / timeInterval;
        break;

      case 'circular':
        // Circular motion
        const radius = 100;
        const omega = (2 * Math.PI) / (count * timeInterval);
        const angle = omega * t;
        x = startX + 200 + radius * Math.cos(angle);
        y = startY + radius * Math.sin(angle);
        vx = -radius * omega * Math.sin(angle) / 20;
        vy = radius * omega * Math.cos(angle) / 20;
        ax = -radius * omega * omega * Math.cos(angle);
        ay = -radius * omega * omega * Math.sin(angle);
        break;

      case 'custom':
        // Default to uniform
        x = startX + i * 80;
        y = startY;
        vx = 80 / timeInterval / 20;
        vy = 0;
        break;
    }

    positions.push({
      x: Math.min(x, canvasWidth - 50),
      y: Math.max(50, Math.min(y, canvasHeight - 50)),
      time: t,
      velocityX: vx,
      velocityY: vy,
      accelerationX: ax,
      accelerationY: ay,
    });
  }

  return positions;
}

// Helper: Calculate average velocity
function calculateAverageVelocity(positions: PositionMarker[]): number {
  if (positions.length < 2) return 0;

  let totalVelocity = 0;
  let count = 0;

  for (const pos of positions) {
    if (pos.velocityX !== undefined && pos.velocityY !== undefined) {
      const v = Math.sqrt(pos.velocityX * pos.velocityX + pos.velocityY * pos.velocityY);
      totalVelocity += v;
      count++;
    }
  }

  return count > 0 ? totalVelocity / count : 0;
}

// Helper: Calculate average acceleration
function calculateAverageAcceleration(positions: PositionMarker[]): number {
  if (positions.length < 2) return 0;

  let totalAcceleration = 0;
  let count = 0;

  for (const pos of positions) {
    if (pos.accelerationX !== undefined && pos.accelerationY !== undefined) {
      const a = Math.sqrt(pos.accelerationX * pos.accelerationX + pos.accelerationY * pos.accelerationY);
      totalAcceleration += a;
      count++;
    }
  }

  return count > 0 ? totalAcceleration / count : 0;
}

export default MotionDiagram;
