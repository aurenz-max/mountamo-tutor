'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type DumpTruckLoaderMetrics,
} from '../../../evaluation';

/**
 * Dump Truck Loader - Interactive dump truck loading and hauling simulation
 *
 * K-5 Engineering Primitive for understanding:
 * - Full and empty concepts (K)
 * - Capacity and "too much" (K-1)
 * - Counting loads (1-2)
 * - Weight limits and distribution (2-3)
 * - Efficiency (loads per time) (4-5)
 *
 * Real-world connections: construction, material handling, capacity, weight
 *
 * EVALUATION INTEGRATION:
 * - Tracks loads completed, capacity management, weight distribution
 * - Submits evaluation metrics on challenge completion
 * - Uses Verlet integration for realistic material physics
 */

export interface DumpTruckLoaderData {
  title: string;
  description: string;

  // Truck configuration
  truckCapacity: number;        // Maximum load weight (units, typically 20-100)
  bedVolume: number;            // Maximum load volume (cubic units, typically 10-50)
  materialType: 'dirt' | 'gravel' | 'sand' | 'debris';
  materialDensity: number;      // Weight per volume unit (typically 1-3)

  // Display options
  showWeight: boolean;          // Display current load weight
  showFillLevel: boolean;       // Display volume used percentage
  tripDistance: number;         // Haul route length (pixels, typically 200-600)
  sourceSize: number;           // Total material to move (units, typically 50-300)

  // Challenge
  targetLoads?: number;         // Number of loads to complete
  timeLimit?: number;           // Optional time limit in seconds

  // Visual theme
  theme: 'realistic' | 'cartoon' | 'simple';
  truckColor: string;           // Color of the truck

  // Evaluation integration (optional)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<DumpTruckLoaderMetrics>) => void;
}

interface DumpTruckLoaderProps {
  data: DumpTruckLoaderData;
  className?: string;
}

// Verlet physics particle for material
interface MaterialParticle {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  radius: number;
  color: string;
  inTruck: boolean;
  dumped: boolean;
}

type TruckState = 'loading' | 'driving-to-dump' | 'dumping' | 'driving-back';

const DumpTruckLoader: React.FC<DumpTruckLoaderProps> = ({ data, className }) => {
  const {
    title,
    description,
    truckCapacity = 50,
    bedVolume = 30,
    materialType = 'dirt',
    materialDensity = 1.5,
    showWeight = true,
    showFillLevel = true,
    tripDistance = 400,
    sourceSize = 150,
    targetLoads,
    timeLimit,
    theme = 'realistic',
    truckColor = '#F59E0B',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Canvas setup
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize] = useState({ width: 800, height: 500 });

  // Truck state
  const [truckState, setTruckState] = useState<TruckState>('loading');
  const [truckX, setTruckX] = useState(100); // Truck position
  const [bedAngle, setBedAngle] = useState(0); // Bed tilt angle (0 = flat, 45 = dumping)

  // Material and loading state
  const [particles, setParticles] = useState<MaterialParticle[]>([]);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [sourceRemaining, setSourceRemaining] = useState(sourceSize);

  // Progress tracking
  const [loadsCompleted, setLoadsCompleted] = useState(0);
  const [totalMaterialMoved, setTotalMaterialMoved] = useState(0);
  const [operationCount, setOperationCount] = useState(0);
  const [overloadAttempts, setOverloadAttempts] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Animation
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(Date.now());

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
    isEvaluationEnabled,
  } = usePrimitiveEvaluation<DumpTruckLoaderMetrics>({
    primitiveType: 'dump-truck-loader',
    instanceId: instanceId || `dump-truck-loader-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Material colors based on type
  const getMaterialColor = (type: string): string => {
    switch (type) {
      case 'dirt': return '#8B7355';
      case 'gravel': return '#A9A9A9';
      case 'sand': return '#F4A460';
      case 'debris': return '#696969';
      default: return '#8B7355';
    }
  };

  const materialColor = getMaterialColor(materialType);

  // Initialize material source pile
  useEffect(() => {
    const initialParticles: MaterialParticle[] = [];
    const pileX = 100;
    const pileY = canvasSize.height - 100;
    const particlesCount = Math.min(100, Math.floor(sourceSize / 2)); // Limit particle count for performance

    for (let i = 0; i < particlesCount; i++) {
      const angle = Math.random() * Math.PI;
      const distance = Math.random() * 60;
      const x = pileX + Math.cos(angle) * distance;
      const y = pileY - Math.random() * 40;

      initialParticles.push({
        x,
        y,
        oldX: x,
        oldY: y,
        radius: 3 + Math.random() * 2,
        color: materialColor,
        inTruck: false,
        dumped: false,
      });
    }

    setParticles(initialParticles);
  }, [sourceSize, materialColor, canvasSize.height]);

  // Verlet integration physics update
  const updatePhysics = useCallback((deltaTime: number) => {
    const dt = Math.min(deltaTime / 1000, 0.05); // Cap delta time for stability
    const gravity = 400; // Pixels per second squared
    const damping = 0.98;

    setParticles(prevParticles => {
      const updated = prevParticles.map(particle => {
        if (particle.inTruck && truckState === 'loading') {
          // Particles in truck bed stay put during loading
          return particle;
        }

        if (particle.inTruck && truckState === 'dumping') {
          // Particles slide out when dumping
          const bedTilt = bedAngle * Math.PI / 180;
          const slideForce = Math.sin(bedTilt) * 300;

          const vx = particle.x - particle.oldX;
          const vy = particle.y - particle.oldY;

          const newX = particle.x + vx * damping + slideForce * dt * dt;
          const newY = particle.y + vy * damping + gravity * dt * dt;

          return {
            ...particle,
            oldX: particle.x,
            oldY: particle.y,
            x: newX,
            y: newY,
          };
        }

        if (particle.dumped) {
          // Dumped particles settle on the ground
          const vx = particle.x - particle.oldX;
          const vy = particle.y - particle.oldY;

          let newX = particle.x + vx * damping;
          let newY = particle.y + vy * damping + gravity * dt * dt;

          // Ground collision
          const groundY = canvasSize.height - 50;
          if (newY + particle.radius > groundY) {
            newY = groundY - particle.radius;
            // Bounce with energy loss
            const bounceVy = (newY - particle.y) * 0.3;
            newY = groundY - particle.radius;
            particle.oldY = newY + bounceVy;
          }

          return {
            ...particle,
            oldX: particle.x,
            oldY: particle.y,
            x: newX,
            y: newY,
          };
        }

        return particle;
      });

      return updated;
    });
  }, [bedAngle, truckState, canvasSize.height]);

  // Handle loading material into truck
  const handleLoadMaterial = () => {
    if (truckState !== 'loading') return;
    if (sourceRemaining <= 0) return;

    const loadAmount = Math.min(5, sourceRemaining); // Load 5 units at a time
    const loadWeight = loadAmount * materialDensity;
    const loadVolume = loadAmount;

    // Check capacity constraints
    if (currentWeight + loadWeight > truckCapacity) {
      setOverloadAttempts(prev => prev + 1);
      return; // Too heavy
    }

    if (currentVolume + loadVolume > bedVolume) {
      setOverloadAttempts(prev => prev + 1);
      return; // Too full
    }

    // Add particles to truck
    setParticles(prevParticles => {
      let addedCount = 0;
      const updated = prevParticles.map(particle => {
        if (!particle.inTruck && !particle.dumped && addedCount < 5) {
          addedCount++;
          const truckBedX = truckX + 40;
          const truckBedY = canvasSize.height - 150 - currentVolume * 1.5;
          return {
            ...particle,
            x: truckBedX + Math.random() * 30,
            y: truckBedY,
            oldX: truckBedX + Math.random() * 30,
            oldY: truckBedY,
            inTruck: true,
          };
        }
        return particle;
      });
      return updated;
    });

    setCurrentWeight(prev => prev + loadWeight);
    setCurrentVolume(prev => prev + loadVolume);
    setSourceRemaining(prev => prev - loadAmount);
    setOperationCount(prev => prev + 1);
  };

  // Start driving to dump location
  const handleDriveToDump = () => {
    if (truckState !== 'loading') return;
    if (currentVolume === 0) return; // Nothing to dump

    setTruckState('driving-to-dump');
  };

  // Start dumping
  const handleStartDump = () => {
    if (truckState !== 'driving-to-dump') return;
    setTruckState('dumping');
  };

  // Finish dumping and return
  const handleFinishDump = () => {
    if (truckState !== 'dumping') return;

    // Mark all truck particles as dumped
    setParticles(prevParticles => prevParticles.map(particle => {
      if (particle.inTruck) {
        return {
          ...particle,
          inTruck: false,
          dumped: true,
        };
      }
      return particle;
    }));

    setTotalMaterialMoved(prev => prev + currentVolume);
    setLoadsCompleted(prev => prev + 1);
    setCurrentWeight(0);
    setCurrentVolume(0);
    setBedAngle(0);
    setTruckState('driving-back');
  };

  // Return to loading position
  const handleReturnToLoad = () => {
    if (truckState !== 'driving-back') return;
    setTruckState('loading');
  };

  // Truck position animation
  useEffect(() => {
    if (truckState === 'driving-to-dump') {
      const targetX = canvasSize.width - 200;
      const interval = setInterval(() => {
        setTruckX(prev => {
          const newX = prev + 3;
          if (newX >= targetX) {
            clearInterval(interval);
            handleStartDump();
            return targetX;
          }
          return newX;
        });
      }, 16);
      return () => clearInterval(interval);
    }

    if (truckState === 'driving-back') {
      const targetX = 100;
      const interval = setInterval(() => {
        setTruckX(prev => {
          const newX = prev - 3;
          if (newX <= targetX) {
            clearInterval(interval);
            handleReturnToLoad();
            return targetX;
          }
          return newX;
        });
      }, 16);
      return () => clearInterval(interval);
    }
  }, [truckState, canvasSize.width]);

  // Bed angle animation during dumping
  useEffect(() => {
    if (truckState === 'dumping') {
      const interval = setInterval(() => {
        setBedAngle(prev => {
          const newAngle = prev + 2;
          if (newAngle >= 45) {
            clearInterval(interval);
            return 45;
          }
          return newAngle;
        });
      }, 50);
      return () => clearInterval(interval);
    } else {
      setBedAngle(0);
    }
  }, [truckState]);

  // Timer
  useEffect(() => {
    if (hasSubmitted) return;
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTimeRef.current) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [hasSubmitted]);

  // Physics animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastTimeRef.current;
      lastTimeRef.current = now;

      updatePhysics(deltaTime);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updatePhysics]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw ground
    ctx.fillStyle = '#86A789';
    ctx.fillRect(0, canvasSize.height - 50, canvasSize.width, 50);

    // Draw source pile area
    ctx.fillStyle = 'rgba(139, 115, 85, 0.3)';
    ctx.beginPath();
    ctx.arc(100, canvasSize.height - 100, 80, 0, Math.PI * 2);
    ctx.fill();

    // Draw dump zone
    const dumpZoneX = canvasSize.width - 150;
    ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.fillRect(dumpZoneX - 50, canvasSize.height - 50, 100, 50);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(dumpZoneX - 50, canvasSize.height - 50, 100, 50);

    // Draw road
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(150, canvasSize.height - 25);
    ctx.lineTo(canvasSize.width - 200, canvasSize.height - 25);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw truck
    const truckBodyY = canvasSize.height - 120;
    const truckBodyHeight = 40;
    const truckBodyWidth = 80;

    // Truck cab
    ctx.fillStyle = truckColor;
    ctx.fillRect(truckX, truckBodyY, 30, truckBodyHeight);

    // Truck bed (with tilt)
    ctx.save();
    ctx.translate(truckX + 30, truckBodyY + truckBodyHeight);
    ctx.rotate(-bedAngle * Math.PI / 180);
    ctx.fillStyle = truckColor;
    ctx.fillRect(0, -truckBodyHeight, 50, truckBodyHeight);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -truckBodyHeight, 50, truckBodyHeight);
    ctx.restore();

    // Truck wheels
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(truckX + 15, truckBodyY + truckBodyHeight + 5, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(truckX + 65, truckBodyY + truckBodyHeight + 5, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw material particles
    particles.forEach(particle => {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.fillText('Load Here', 60, canvasSize.height - 150);
    ctx.fillText('Dump Here', dumpZoneX - 40, canvasSize.height - 60);

  }, [canvasSize, truckX, bedAngle, particles, truckColor]);

  // Check if challenge is complete
  const isComplete = targetLoads ? loadsCompleted >= targetLoads : sourceRemaining <= 0;
  const efficiency = operationCount > 0 ? totalMaterialMoved / operationCount : 0;

  // Submit evaluation
  const handleSubmitEvaluation = () => {
    if (hasSubmitted || !isEvaluationEnabled) return;

    const success = isComplete && (!timeLimit || elapsedTime <= timeLimit);
    const score = Math.min(100, (totalMaterialMoved / sourceSize) * 100);

    const metrics: DumpTruckLoaderMetrics = {
      type: 'dump-truck-loader',
      targetLoads: targetLoads || Math.ceil(sourceSize / bedVolume),
      loadsCompleted,
      totalMaterialMoved,
      sourceSize,
      goalMet: isComplete,
      truckCapacity,
      bedVolume,
      materialType,
      averageLoadSize: loadsCompleted > 0 ? totalMaterialMoved / loadsCompleted : 0,
      efficiency,
      overloadAttempts,
      operationCount,
      timeElapsed: elapsedTime,
    };

    submitResult(success, score, metrics, {
      studentWork: {
        loadsCompleted,
        totalMaterialMoved,
        efficiency,
        elapsedTime,
      },
    });
  };

  // Auto-submit when complete
  useEffect(() => {
    if (isComplete && !hasSubmitted && isEvaluationEnabled) {
      handleSubmitEvaluation();
    }
  }, [isComplete, hasSubmitted, isEvaluationEnabled]);

  return (
    <div className={`w-full max-w-7xl mx-auto my-8 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white mb-1">{title}</h3>
          <p className="text-slate-300 text-sm">{description}</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative mb-6 bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full"
        />
      </div>

      {/* Status Display */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="group bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-amber-500/50 transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Source Remaining</div>
          <div className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors">
            {Math.round(sourceRemaining)}
            <span className="text-sm text-slate-400 ml-1">units</span>
          </div>
        </div>

        {showWeight && (
          <div className="group bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-blue-500/50 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Current Weight</div>
            <div className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
              {Math.round(currentWeight)}
              <span className="text-sm text-slate-400">/{truckCapacity}</span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (currentWeight / truckCapacity) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {showFillLevel && (
          <div className="group bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-purple-500/50 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Fill Level</div>
            <div className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">
              {Math.round((currentVolume / bedVolume) * 100)}
              <span className="text-sm text-slate-400">%</span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (currentVolume / bedVolume) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="group bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-green-500/50 transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Loads Completed</div>
          <div className="text-2xl font-bold text-white group-hover:text-green-400 transition-colors">
            {loadsCompleted}
            {targetLoads && <span className="text-sm text-slate-400">/{targetLoads}</span>}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">State:</span>
            <span className="text-sm font-semibold text-amber-400">
              {truckState.replace(/-/g, ' ').toUpperCase()}
            </span>
          </div>
          {timeLimit && (
            <div className="text-sm font-mono text-slate-300">
              Time: <span className={elapsedTime > timeLimit ? 'text-red-400' : 'text-green-400'}>
                {Math.round(elapsedTime)}s
              </span> / {timeLimit}s
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleLoadMaterial}
            disabled={truckState !== 'loading' || sourceRemaining <= 0}
            className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-blue-500/50 text-blue-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>📦</span>
            Load Material
          </button>

          <button
            onClick={handleDriveToDump}
            disabled={truckState !== 'loading' || currentVolume === 0}
            className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-green-500/50 text-green-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>🚚</span>
            Drive to Dump
          </button>

          <button
            onClick={handleFinishDump}
            disabled={truckState !== 'dumping' || bedAngle < 40}
            className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-orange-500/50 text-orange-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>⬇️</span>
            Finish Dump
          </button>

          {!hasSubmitted && isComplete && isEvaluationEnabled && (
            <button
              onClick={handleSubmitEvaluation}
              className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] ml-auto flex items-center gap-2"
            >
              <span>✓</span>
              Submit Work
            </button>
          )}

          {hasSubmitted && (
            <button
              onClick={resetAttempt}
              className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all ml-auto flex items-center gap-2"
            >
              <span>↺</span>
              Try Again
            </button>
          )}
        </div>

        {overloadAttempts > 0 && (
          <div className="mt-4 p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-lg">⚠️</span>
              <p className="text-red-200 text-sm">
                Overload attempts: <span className="font-bold">{overloadAttempts}</span> (truck is at capacity!)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Completion Message */}
      {isComplete && (
        <div className="mb-6 p-5 bg-green-500/10 backdrop-blur-sm border border-green-500/30 rounded-xl animate-fade-in">
          <div className="flex items-start gap-3">
            <span className="text-green-400 text-2xl">🎉</span>
            <div>
              <div className="text-green-300 font-bold text-lg mb-1">Challenge Complete!</div>
              <div className="text-sm text-green-200">
                You moved <span className="font-semibold">{Math.round(totalMaterialMoved)}</span> units in{' '}
                <span className="font-semibold">{loadsCompleted}</span> loads.
                Efficiency: <span className="font-semibold">{efficiency.toFixed(2)}</span> units per operation.
              </div>
            </div>
          </div>
        </div>
      )}

      {hasSubmitted && (
        <div className="p-5 bg-blue-500/10 backdrop-blur-sm border border-blue-500/30 rounded-xl animate-fade-in">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 text-xl">✓</span>
            <div>
              <div className="text-blue-300 font-bold">Evaluation Submitted</div>
              <div className="text-sm text-blue-200 mt-1">
                Your work has been recorded and evaluated.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DumpTruckLoader;
