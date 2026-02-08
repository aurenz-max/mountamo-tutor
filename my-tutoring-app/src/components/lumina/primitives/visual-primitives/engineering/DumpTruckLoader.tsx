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

type TruckState = 'loading' | 'driving-to-dump' | 'dumping' | 'driving-back';

// Dump pile particle (settled at dump zone)
interface DumpPileParticle {
  x: number;
  y: number;
  radius: number;
  color: string;
}

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
  const [truckX, setTruckX] = useState(100);
  const [bedAngle, setBedAngle] = useState(0);

  // Material state - track as counts, not individual particles
  const [currentWeight, setCurrentWeight] = useState(0);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [sourceRemaining, setSourceRemaining] = useState(sourceSize);

  // Dump pile accumulation
  const [dumpPileParticles, setDumpPileParticles] = useState<DumpPileParticle[]>([]);

  // Source pile visual size (shrinks as material is taken)
  const [sourcePileSize, setSourcePileSize] = useState(1.0); // 0-1 fraction

  // Dumping animation state
  const [dumpAnimProgress, setDumpAnimProgress] = useState(0); // 0 to 1

  // Progress tracking
  const [loadsCompleted, setLoadsCompleted] = useState(0);
  const [totalMaterialMoved, setTotalMaterialMoved] = useState(0);
  const [operationCount, setOperationCount] = useState(0);
  const [overloadAttempts, setOverloadAttempts] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Animation
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
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

  // Helper to darken a color
  function darkenColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
  }

  // Helper to draw a rounded rect
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Update source pile size when remaining changes
  useEffect(() => {
    setSourcePileSize(Math.max(0, sourceRemaining / sourceSize));
  }, [sourceRemaining, sourceSize]);

  // Handle loading material into truck
  const handleLoadMaterial = () => {
    if (truckState !== 'loading') return;
    if (sourceRemaining <= 0) return;

    const loadAmount = Math.min(5, sourceRemaining);
    const loadWeight = loadAmount * materialDensity;
    const loadVolume = loadAmount;

    if (currentWeight + loadWeight > truckCapacity) {
      setOverloadAttempts(prev => prev + 1);
      return;
    }

    if (currentVolume + loadVolume > bedVolume) {
      setOverloadAttempts(prev => prev + 1);
      return;
    }

    setCurrentWeight(prev => prev + loadWeight);
    setCurrentVolume(prev => prev + loadVolume);
    setSourceRemaining(prev => prev - loadAmount);
    setOperationCount(prev => prev + 1);
  };

  // Start driving to dump location
  const handleDriveToDump = () => {
    if (truckState !== 'loading') return;
    if (currentVolume === 0) return;
    setTruckState('driving-to-dump');
  };

  // Finish dumping and return
  const handleFinishDump = () => {
    if (truckState !== 'dumping') return;

    // Add particles to dump pile
    const dumpZoneX = canvasSize.width - 150;
    const groundY = canvasSize.height - 50;
    const existingHeight = dumpPileParticles.length * 0.3;

    const newPileParticles: DumpPileParticle[] = [];
    const particleCount = Math.min(30, Math.round(currentVolume * 2));
    for (let i = 0; i < particleCount; i++) {
      const spread = 40 + existingHeight * 0.5;
      newPileParticles.push({
        x: dumpZoneX + (Math.random() - 0.5) * spread,
        y: groundY - Math.random() * (10 + existingHeight + particleCount * 0.4),
        radius: 3 + Math.random() * 2,
        color: materialColor,
      });
    }

    setDumpPileParticles(prev => [...prev, ...newPileParticles]);
    setTotalMaterialMoved(prev => prev + currentVolume);
    setLoadsCompleted(prev => prev + 1);
    setCurrentWeight(0);
    setCurrentVolume(0);
    setBedAngle(0);
    setDumpAnimProgress(0);
    setTruckState('driving-back');
  };

  // Truck driving animation
  useEffect(() => {
    if (truckState === 'driving-to-dump') {
      const targetX = canvasSize.width - 200;
      const interval = setInterval(() => {
        setTruckX(prev => {
          const newX = prev + 4;
          if (newX >= targetX) {
            clearInterval(interval);
            setTruckState('dumping');
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
          const newX = prev - 4;
          if (newX <= targetX) {
            clearInterval(interval);
            setTruckState('loading');
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
        setDumpAnimProgress(prev => Math.min(1, prev + 0.04));
      }, 50);
      return () => clearInterval(interval);
    } else {
      setBedAngle(0);
      setDumpAnimProgress(0);
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

  // Canvas rendering
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvasSize.width;
    const H = canvasSize.height;
    const groundY = H - 50;

    // --- Sky ---
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#1a2a3a');
    skyGrad.addColorStop(1, '#2d4a5a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // --- Ground ---
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, '#5a7a5a');
    groundGrad.addColorStop(0.3, '#4a6a4a');
    groundGrad.addColorStop(1, '#3a5a3a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Grass blades at top of ground
    ctx.fillStyle = '#6a9a6a';
    for (let gx = 0; gx < W; gx += 8) {
      ctx.fillRect(gx, groundY - 2, 3, 4);
    }

    // --- Road ---
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, groundY, W, 30);
    // Road edge lines
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, groundY, W, 2);
    ctx.fillRect(0, groundY + 28, W, 2);
    // Center line dashes
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, groundY + 15);
    ctx.lineTo(W, groundY + 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // Road markers (small dots)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let mx = 50; mx < W; mx += 60) {
      ctx.beginPath();
      ctx.arc(mx, groundY + 8, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Source pile area ---
    const pileX = 100;
    const pileBaseY = groundY;
    const pileRadius = 70 * Math.max(0.2, sourcePileSize);
    const pileHeight = 60 * Math.max(0.1, sourcePileSize);

    // Pile shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(pileX, pileBaseY + 3, pileRadius + 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pile body (mound shape)
    const pileGrad = ctx.createRadialGradient(pileX, pileBaseY - pileHeight * 0.4, 0, pileX, pileBaseY, pileRadius);
    pileGrad.addColorStop(0, materialColor);
    pileGrad.addColorStop(1, darkenColor(materialColor, 0.6));
    ctx.fillStyle = pileGrad;
    ctx.beginPath();
    ctx.moveTo(pileX - pileRadius, pileBaseY);
    ctx.quadraticCurveTo(pileX - pileRadius * 0.5, pileBaseY - pileHeight, pileX, pileBaseY - pileHeight);
    ctx.quadraticCurveTo(pileX + pileRadius * 0.5, pileBaseY - pileHeight, pileX + pileRadius, pileBaseY);
    ctx.closePath();
    ctx.fill();

    // Pile texture
    if (sourcePileSize > 0.1) {
      ctx.fillStyle = darkenColor(materialColor, 0.8);
      for (let i = 0; i < 15 * sourcePileSize; i++) {
        const angle = Math.random() * Math.PI;
        const dist = Math.random() * pileRadius * 0.8;
        const px = pileX + Math.cos(angle) * dist - dist * 0.3;
        const py = pileBaseY - Math.random() * pileHeight * 0.7;
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // "Load Here" label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Load Here', pileX, pileBaseY - pileHeight - 15);

    // --- Dump zone ---
    const dumpZoneX = W - 150;

    // Dump zone area marker
    ctx.fillStyle = 'rgba(200, 200, 150, 0.15)';
    ctx.fillRect(dumpZoneX - 60, groundY - 80, 120, 80);
    ctx.strokeStyle = 'rgba(200, 200, 150, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(dumpZoneX - 60, groundY - 80, 120, 80);
    ctx.setLineDash([]);

    // Dump pile (accumulated material)
    dumpPileParticles.forEach(particle => {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darkenColor(particle.color, 0.7);
      ctx.beginPath();
      ctx.arc(particle.x + 0.5, particle.y + 0.5, particle.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // "Dump Here" label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dump Here', dumpZoneX, groundY - 85);
    ctx.textAlign = 'start';

    // --- Truck ---
    const truckBaseY = groundY - 8; // sits on road
    const cabW = 35;
    const cabH = 45;
    const bedW = 55;
    const bedH = 35;
    const wheelR = 10;

    // Truck shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(truckX + 40, truckBaseY + 5, 50, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Cab ---
    const cabX = truckX;
    const cabY = truckBaseY - cabH;

    const cabGrad = ctx.createLinearGradient(cabX, cabY, cabX, cabY + cabH);
    cabGrad.addColorStop(0, truckColor);
    cabGrad.addColorStop(1, darkenColor(truckColor, 0.7));
    ctx.fillStyle = cabGrad;
    drawRoundedRect(ctx, cabX, cabY, cabW, cabH, 4);
    ctx.fill();
    ctx.strokeStyle = darkenColor(truckColor, 0.5);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cabX, cabY, cabW, cabH, 4);
    ctx.stroke();

    // Cab window
    const winGrad = ctx.createLinearGradient(cabX + 4, cabY + 4, cabX + cabW - 6, cabY + cabH * 0.5);
    winGrad.addColorStop(0, '#a8d8f0');
    winGrad.addColorStop(1, '#6bb8e0');
    ctx.fillStyle = winGrad;
    drawRoundedRect(ctx, cabX + 5, cabY + 5, cabW - 10, cabH * 0.4, 2);
    ctx.fill();

    // Window glare
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(cabX + 7, cabY + 6, 3, cabH * 0.3);

    // Headlight
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(cabX + cabW - 2, cabY + cabH - 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // --- Bed (with tilt for dumping) ---
    const bedPivotX = cabX + cabW;
    const bedPivotY = truckBaseY;

    ctx.save();
    ctx.translate(bedPivotX, bedPivotY);
    ctx.rotate(-bedAngle * Math.PI / 180);

    // Bed body
    const bedGrad = ctx.createLinearGradient(0, -bedH, 0, 0);
    bedGrad.addColorStop(0, truckColor);
    bedGrad.addColorStop(1, darkenColor(truckColor, 0.7));
    ctx.fillStyle = bedGrad;
    ctx.fillRect(0, -bedH, bedW, bedH);
    ctx.strokeStyle = darkenColor(truckColor, 0.5);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, -bedH, bedW, bedH);

    // Bed ridges (structural lines)
    ctx.strokeStyle = darkenColor(truckColor, 0.6);
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const ry = -bedH + (bedH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(2, ry);
      ctx.lineTo(bedW - 2, ry);
      ctx.stroke();
    }

    // Material in bed (drawn relative to bed, moves with truck!)
    if (currentVolume > 0) {
      const fillFraction = currentVolume / bedVolume;
      const fillHeight = bedH * fillFraction * 0.85;

      // Material gradient
      const matGrad = ctx.createLinearGradient(0, -fillHeight, 0, 0);
      matGrad.addColorStop(0, materialColor);
      matGrad.addColorStop(1, darkenColor(materialColor, 0.7));
      ctx.fillStyle = matGrad;

      // Bumpy top surface
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(3, -fillHeight + 4);
      for (let bx = 3; bx <= bedW - 3; bx += 6) {
        const bump = Math.sin(bx * 0.3) * 3 + Math.random() * 2;
        ctx.lineTo(bx, -fillHeight + bump);
      }
      ctx.lineTo(bedW - 3, -fillHeight + 4);
      ctx.lineTo(bedW - 3, 0);
      ctx.closePath();
      ctx.fill();

      // Texture dots on material
      ctx.fillStyle = darkenColor(materialColor, 0.8);
      for (let i = 0; i < 10 * fillFraction; i++) {
        const dx = 5 + Math.random() * (bedW - 10);
        const dy = -(Math.random() * fillHeight * 0.8);
        ctx.beginPath();
        ctx.arc(dx, dy, 1 + Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }

      // Dumping animation: material sliding out
      if (truckState === 'dumping' && dumpAnimProgress > 0.3) {
        const slideProgress = (dumpAnimProgress - 0.3) / 0.7;
        ctx.fillStyle = materialColor;
        for (let i = 0; i < 8 * slideProgress; i++) {
          const px = bedW + 5 + Math.random() * 20 * slideProgress;
          const py = -Math.random() * fillHeight * 0.5;
          ctx.beginPath();
          ctx.arc(px, py, 2 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Tailgate
    ctx.fillStyle = darkenColor(truckColor, 0.6);
    ctx.fillRect(bedW - 3, -bedH, 3, bedH);

    ctx.restore();

    // --- Wheels ---
    const wheel1X = truckX + 15;
    const wheel2X = truckX + cabW + bedW - 10;
    const wheelY = truckBaseY + 2;

    [wheel1X, wheel2X].forEach(wx => {
      // Tire
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();
      // Rim
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // Hub
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Tire tread
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      for (let a = 0; a < 6; a++) {
        const angle = (a / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(angle) * wheelR * 0.6, wheelY + Math.sin(angle) * wheelR * 0.6);
        ctx.lineTo(wx + Math.cos(angle) * wheelR * 0.9, wheelY + Math.sin(angle) * wheelR * 0.9);
        ctx.stroke();
      }
    });

    // --- Exhaust pipe ---
    ctx.fillStyle = '#555';
    ctx.fillRect(cabX + 2, cabY - 12, 4, 12);
    // Smoke puff when driving
    if (truckState === 'driving-to-dump' || truckState === 'driving-back') {
      ctx.fillStyle = 'rgba(180,180,180,0.3)';
      ctx.beginPath();
      ctx.arc(cabX + 4, cabY - 18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,180,180,0.15)';
      ctx.beginPath();
      ctx.arc(cabX + 1, cabY - 26, 7, 0, Math.PI * 2);
      ctx.fill();
    }

  }, [canvasSize, truckX, bedAngle, truckColor, materialColor, currentVolume, bedVolume, sourcePileSize, sourceSize, dumpPileParticles, truckState, dumpAnimProgress]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Check if challenge is complete
  const isComplete = targetLoads ? loadsCompleted >= targetLoads : sourceRemaining <= 0;
  const efficiency = operationCount > 0 ? totalMaterialMoved / operationCount : 0;

  // Submit evaluation
  const handleSubmitEvaluation = () => {
    if (hasSubmitted) return;

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
    if (isComplete && !hasSubmitted && data.instanceId) {
      handleSubmitEvaluation();
    }
  }, [isComplete, hasSubmitted]);

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
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Fill Level</div>
            <div className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
              {Math.round((currentVolume / bedVolume) * 100)}
              <span className="text-sm text-slate-400">%</span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (currentVolume / bedVolume) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {showFillLevel && (
          <div className="group bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-purple-500/50 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Weight</div>
            <div className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">
              {Math.round(currentWeight)}
              <span className="text-sm text-slate-400">/{truckCapacity}</span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (currentWeight / truckCapacity) * 100)}%` }}
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

          {!hasSubmitted && isComplete && data.instanceId && (
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
