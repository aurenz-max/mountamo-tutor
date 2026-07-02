'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  usePrimitiveEvaluation,
  type DumpTruckLoaderMetrics,
} from '../../../evaluation';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaPanel,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaButton,
  LuminaBadge,
} from '../../../ui';

/**
 * Dump Truck Loader - Interactive dump truck loading and hauling simulation
 *
 * Students drive the truck back and forth, get loaded by an excavator,
 * and manually raise the bed to dump material. Full player control.
 *
 * EVALUATION INTEGRATION:
 * - Tracks loads completed, capacity management, weight distribution
 * - Submits evaluation metrics on challenge completion
 */

export interface DumpTruckLoaderData {
  title: string;
  description: string;
  truckCapacity: number;
  bedVolume: number;
  materialType: 'dirt' | 'gravel' | 'sand' | 'debris';
  materialDensity: number;
  showWeight: boolean;
  showFillLevel: boolean;
  tripDistance: number;
  sourceSize: number;
  targetLoads?: number;
  timeLimit?: number;
  theme: 'realistic' | 'cartoon' | 'simple';
  truckColor: string;
  jobs?: DumpTruckJob[];
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

// ============================================================================
// Density (weight per volume unit) — the heart of the lesson.
// With a fixed bed (30) and weight cap (50): heavy materials hit the SCALE
// before the bed fills; light materials fill the BED before they get heavy.
//   full-bed weight = bedVolume * density  → if > capacity, WEIGHT-limited.
// ============================================================================

type MaterialType = 'dirt' | 'gravel' | 'sand' | 'debris';

const DENSITY_BY_MATERIAL: Record<MaterialType, number> = {
  debris: 1.0, // light & fluffy → bed fills first (volume-limited)
  dirt: 1.5,   // medium → bed fills first, just under weight
  gravel: 1.8, // heavy → weight-limited, bed ~83% full
  sand: 2.5,   // wet sand, really heavy → weight-limited, bed ~67% full
};

const MATERIAL_LABEL: Record<MaterialType, string> = {
  debris: 'light debris',
  dirt: 'dirt',
  gravel: 'gravel',
  sand: 'wet sand',
};

// ============================================================================
// Jobs — code-owned density puzzles (numbers = correctness).
// Bed volume and weight capacity stay CONSTANT across jobs; only the material
// (and therefore its density) changes, so the binding limit shifts. That
// contrast is the whole lesson. Optional data.jobs can re-theme the words.
// ============================================================================

export interface DumpTruckJob {
  id: string;
  title: string;
  material: MaterialType;
  sourceSize: number;          // units of material at the pile for this job
  goal: 'complete_loads' | 'clear_source';
  targetLoads?: number;        // for 'complete_loads'
  predict?: boolean;           // ask "which fills first?" before solving
  brief: string;               // kid-friendly job description
  hint: string;                // shown only on request
  explainOnSolve: string;      // the density "why it worked" payoff
}

const DEFAULT_JOBS: DumpTruckJob[] = [
  {
    id: 'j1',
    title: 'Light & Fluffy',
    material: 'debris',
    sourceSize: 60,
    goal: 'complete_loads',
    targetLoads: 2,
    brief: "First job: haul this pile of light packing debris. Fill the bed right up and dump it at the dump zone — twice. Watch the two meters as you load: which one fills up first?",
    hint: "Debris is light. Keep scooping — you'll fill the BED to the top long before the truck gets heavy.",
    explainOnSolve: "Light debris is fluffy — the BED filled to the top while the weight scale barely moved. When material is light, the SIZE of the bed is your limit.",
  },
  {
    id: 'j2',
    title: 'Heavy Wet Sand',
    material: 'sand',
    sourceSize: 40,
    goal: 'complete_loads',
    targetLoads: 1,
    predict: true,
    brief: "New job: wet sand — and it's HEAVY. Load as much as you can safely carry, then dump it. First, make a prediction below.",
    hint: "Try to fill the bed. You'll notice the truck refuses more sand while the bed still looks part-empty — that's the weight limit talking.",
    explainOnSolve: "Wet sand is heavy! The SCALE hit the limit when the bed was only about two-thirds full. With heavy material, WEIGHT is your limit — not space. The bed can't fill all the way.",
  },
  {
    id: 'j3',
    title: 'Gravel Run',
    material: 'gravel',
    sourceSize: 50,
    goal: 'complete_loads',
    targetLoads: 1,
    predict: true,
    brief: "Gravel is heavier than dirt but lighter than wet sand. Predict which meter fills first, then load a full safe load and dump it.",
    hint: "Gravel is heavy enough that the scale still wins — but the bed gets fuller than it did with the wet sand.",
    explainOnSolve: "Gravel is heavy, so WEIGHT was still your limit — but because it's lighter than wet sand, the bed got fuller (about 83%) before the scale maxed out. Heavier material = less you can fit before the weight limit.",
  },
  {
    id: 'j4',
    title: 'The Big Haul',
    material: 'sand',
    sourceSize: 80,
    goal: 'clear_source',
    brief: "Big job: move ALL 80 units of wet sand to the dump zone. Because it's so heavy, each safe load is small — so how many trips will it take? Find out!",
    hint: "Each safe load of wet sand is about 20 units (the scale limit). 80 units ÷ 20 per trip = 4 trips.",
    explainOnSolve: "Heavy material means small safe loads, which means MORE trips. Wet sand only lets you carry ~20 units per trip, so moving 80 units took about 4 trips. Density decides your trip count!",
  },
];

// Dump pile particle
interface DumpPileParticle {
  x: number;
  y: number;
  radius: number;
  color: string;
}

// Falling particle during dump
interface FallingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  grounded: boolean;
}

// Excavator arm state
type ExcavatorPhase = 'idle' | 'swinging-to-pile' | 'scooping' | 'swinging-to-truck' | 'dropping' | 'returning';

const CANVAS_W = 900;
const CANVAS_H = 400;
const GROUND_Y = CANVAS_H - 55;
const ROAD_Y = GROUND_Y;
const ROAD_H = 32;
const TRUCK_SPEED = 3;
const SOURCE_X = 130;
const DUMP_ZONE_X = CANVAS_W - 160;
const LOAD_ZONE_RADIUS = 80;
const DUMP_ZONE_RADIUS = 80;

const DumpTruckLoader: React.FC<DumpTruckLoaderProps> = ({ data, className }) => {
  const {
    title,
    description,
    truckCapacity = 50,
    bedVolume = 30,
    showWeight = true,
    showFillLevel = true,
    timeLimit,
    truckColor = '#F59E0B',
    jobs: dataJobs,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ---- Jobs (density-focused mission ladder) ----
  const jobs = useMemo(
    () => (dataJobs && dataJobs.length > 0 ? dataJobs : DEFAULT_JOBS),
    [dataJobs],
  );
  const [currentJobIdx, setCurrentJobIdx] = useState(0);
  const currentJob = jobs[currentJobIdx];

  // Material + source are driven by the current job; caps stay constant.
  const materialType = currentJob.material;
  const materialDensity = DENSITY_BY_MATERIAL[materialType];
  const sourceSize = currentJob.sourceSize;
  const targetLoads = currentJob.goal === 'complete_loads' ? currentJob.targetLoads : undefined;

  // Which limit binds for this material? (the lesson)
  const bindingLimit: 'weight' | 'volume' = bedVolume * materialDensity > truckCapacity ? 'weight' : 'volume';

  // ---- Job progression state ----
  const [solvedJobIds, setSolvedJobIds] = useState<Set<string>>(new Set());
  const [showSolveCard, setShowSolveCard] = useState(false);
  const [showJobHint, setShowJobHint] = useState(false);
  const [predictGuess, setPredictGuess] = useState<'weight' | 'volume' | null>(null);

  const currentSolved = solvedJobIds.has(currentJob.id);
  const allJobsSolved = solvedJobIds.size >= jobs.length;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Player input state (using refs for frame-perfect reads)
  const keysRef = useRef<Set<string>>(new Set());
  const loadPressedRef = useRef(false);
  const raisePressedRef = useRef(false);
  const lowerPressedRef = useRef(false);

  // Game state refs (mutated in animation loop, synced to React state for UI)
  const truckXRef = useRef(SOURCE_X);
  const bedAngleRef = useRef(0);
  const currentWeightRef = useRef(0);
  const currentVolumeRef = useRef(0);
  const sourceRemainingRef = useRef(sourceSize);
  const loadsCompletedRef = useRef(0);
  const totalMaterialMovedRef = useRef(0);
  const operationCountRef = useRef(0);
  const overloadAttemptsRef = useRef(0);
  const overloadReasonRef = useRef<'weight' | 'volume' | null>(null);
  const overloadFlashRef = useRef(0); // frames remaining to show the overload reason
  const dumpPileRef = useRef<DumpPileParticle[]>([]);
  const fallingParticlesRef = useRef<FallingParticle[]>([]);
  const excavatorPhaseRef = useRef<ExcavatorPhase>('idle');
  const excavatorArmAngleRef = useRef(0); // degrees, 0=vertical, negative=toward pile, positive=toward truck
  const excavatorBucketFullRef = useRef(false);
  const scoopAmountRef = useRef(0);
  const lastDumpVolumeRef = useRef(0); // track volume at dump start for particle generation
  const facingRightRef = useRef(true); // truck facing direction

  // React state for UI display (synced periodically)
  const [uiState, setUiState] = useState({
    sourceRemaining: sourceSize,
    currentWeight: 0,
    currentVolume: 0,
    loadsCompleted: 0,
    overloadAttempts: 0,
    totalMaterialMoved: 0,
    bedAngle: 0,
    truckX: SOURCE_X,
    nearSource: true,
    nearDump: false,
    isLoading: false,
    overloadReason: null as 'weight' | 'volume' | null,
    overloadActive: false,
  });

  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const animFrameRef = useRef<number>();

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
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // Material colors
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

  const darkenColor = (hex: string, factor: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
  };

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

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (hasSubmitted) return;
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTimeRef.current) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [hasSubmitted]);

  // Main game loop
  const gameLoop = useCallback(() => {
    const keys = keysRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // --- UPDATE PHASE ---

    // Truck movement
    const movingLeft = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
    const movingRight = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
    if (movingLeft) {
      truckXRef.current = Math.max(30, truckXRef.current - TRUCK_SPEED);
      facingRightRef.current = false;
    }
    if (movingRight) {
      truckXRef.current = Math.min(CANVAS_W - 120, truckXRef.current + TRUCK_SPEED);
      facingRightRef.current = true;
    }

    const truckCenterX = truckXRef.current + 50;
    const nearSource = Math.abs(truckCenterX - SOURCE_X) < LOAD_ZONE_RADIUS;
    const nearDump = Math.abs(truckCenterX - DUMP_ZONE_X) < DUMP_ZONE_RADIUS;

    // Excavator logic
    const excPhase = excavatorPhaseRef.current;
    const armAngle = excavatorArmAngleRef.current;

    if (loadPressedRef.current && nearSource && excPhase === 'idle' && sourceRemainingRef.current > 0) {
      // Check if we can load more
      const loadAmount = Math.min(5, sourceRemainingRef.current);
      const loadWeight = loadAmount * materialDensity;
      const loadVolume = loadAmount;
      const weightWouldExceed = currentWeightRef.current + loadWeight > truckCapacity;
      const volumeWouldExceed = currentVolumeRef.current + loadVolume > bedVolume;
      if (weightWouldExceed || volumeWouldExceed) {
        overloadAttemptsRef.current += 1;
        // Capture WHICH limit refused the scoop — this is the density lesson.
        overloadReasonRef.current = weightWouldExceed ? 'weight' : 'volume';
        overloadFlashRef.current = 90; // ~1.5s at 60fps
      } else {
        excavatorPhaseRef.current = 'swinging-to-pile';
        scoopAmountRef.current = loadAmount;
      }
      loadPressedRef.current = false;
    }

    // Excavator arm animation
    switch (excPhase) {
      case 'swinging-to-pile':
        excavatorArmAngleRef.current = Math.max(-45, armAngle - 3);
        if (excavatorArmAngleRef.current <= -45) {
          excavatorPhaseRef.current = 'scooping';
        }
        break;
      case 'scooping':
        excavatorBucketFullRef.current = true;
        excavatorPhaseRef.current = 'swinging-to-truck';
        break;
      case 'swinging-to-truck':
        excavatorArmAngleRef.current = Math.min(30, armAngle + 3);
        if (excavatorArmAngleRef.current >= 30) {
          excavatorPhaseRef.current = 'dropping';
        }
        break;
      case 'dropping': {
        excavatorBucketFullRef.current = false;
        const amt = scoopAmountRef.current;
        currentWeightRef.current += amt * materialDensity;
        currentVolumeRef.current += amt;
        sourceRemainingRef.current -= amt;
        operationCountRef.current += 1;
        excavatorPhaseRef.current = 'returning';
        break;
      }
      case 'returning':
        excavatorArmAngleRef.current = armAngle + (0 - armAngle) * 0.1;
        if (Math.abs(excavatorArmAngleRef.current) < 1) {
          excavatorArmAngleRef.current = 0;
          excavatorPhaseRef.current = 'idle';
        }
        break;
    }

    // Bed raise/lower
    if (raisePressedRef.current || keys.has('ArrowUp') || keys.has('w') || keys.has('W')) {
      bedAngleRef.current = Math.min(55, bedAngleRef.current + 1.5);
    }
    if (lowerPressedRef.current || keys.has('ArrowDown') || keys.has('s') || keys.has('S')) {
      bedAngleRef.current = Math.max(0, bedAngleRef.current - 2);
    }

    // Material falling out when bed is tilted enough and near dump zone
    if (bedAngleRef.current > 25 && currentVolumeRef.current > 0 && nearDump) {
      // Generate falling particles
      const spillRate = (bedAngleRef.current - 25) / 30; // 0 to 1
      const amountToSpill = Math.min(0.3 * spillRate, currentVolumeRef.current);

      if (amountToSpill > 0.01) {
        currentVolumeRef.current -= amountToSpill;
        currentWeightRef.current -= amountToSpill * materialDensity;

        // Create a falling particle occasionally
        // Tailgate is at the REAR of the truck. When facing right, rear=left edge; facing left, rear=right edge.
        if (Math.random() < spillRate * 0.6) {
          const totalTruckW = 90; // bedW + cabW
          const tailgateX = facingRightRef.current
            ? truckXRef.current
            : truckXRef.current + totalTruckW;
          const spillDir = facingRightRef.current ? -1 : 1; // particles fly away from truck rear

          fallingParticlesRef.current.push({
            x: tailgateX + (Math.random() - 0.5) * 12,
            y: ROAD_Y - 15 - Math.random() * 10,
            vx: spillDir * (0.5 + Math.random() * 1.5),
            vy: -1 + Math.random() * 1.5,
            radius: 2.5 + Math.random() * 2,
            color: materialColor,
            grounded: false,
          });
        }
      }

      // Check if fully dumped
      if (currentVolumeRef.current <= 0.1 && lastDumpVolumeRef.current > 0) {
        currentVolumeRef.current = 0;
        currentWeightRef.current = 0;
        totalMaterialMovedRef.current += lastDumpVolumeRef.current;
        loadsCompletedRef.current += 1;
        lastDumpVolumeRef.current = 0;
      }
    }

    // Track volume when starting to dump
    if (bedAngleRef.current > 20 && currentVolumeRef.current > 0 && lastDumpVolumeRef.current === 0) {
      lastDumpVolumeRef.current = currentVolumeRef.current;
    }
    if (bedAngleRef.current < 5) {
      lastDumpVolumeRef.current = 0;
    }

    // Update falling particles
    fallingParticlesRef.current = fallingParticlesRef.current.filter(p => {
      if (p.grounded) return true;
      p.vy += 0.4; // gravity
      p.x += p.vx;
      p.y += p.vy;
      if (p.y >= ROAD_Y - p.radius) {
        p.y = ROAD_Y - p.radius;
        p.grounded = true;
        // Convert to dump pile particle
        dumpPileRef.current.push({
          x: p.x,
          y: p.y,
          radius: p.radius,
          color: p.color,
        });
        return false; // remove from falling
      }
      return p.y < CANVAS_H + 20;
    });

    // Clamp values
    currentVolumeRef.current = Math.max(0, currentVolumeRef.current);
    currentWeightRef.current = Math.max(0, currentWeightRef.current);

    // Decay the overload-reason flash
    if (overloadFlashRef.current > 0) overloadFlashRef.current -= 1;

    // Sync to React state for UI (throttled to ~15fps for display)
    setUiState({
      sourceRemaining: sourceRemainingRef.current,
      currentWeight: currentWeightRef.current,
      currentVolume: currentVolumeRef.current,
      loadsCompleted: loadsCompletedRef.current,
      overloadAttempts: overloadAttemptsRef.current,
      totalMaterialMoved: totalMaterialMovedRef.current,
      bedAngle: bedAngleRef.current,
      truckX: truckXRef.current,
      nearSource,
      nearDump,
      isLoading: excavatorPhaseRef.current !== 'idle',
      overloadReason: overloadReasonRef.current,
      overloadActive: overloadFlashRef.current > 0,
    });

    // --- RENDER PHASE ---
    const W = CANVAS_W;
    const H = CANVAS_H;

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#0f1923');
    skyGrad.addColorStop(1, '#1a2d3d');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Distant hills
    ctx.fillStyle = '#162530';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 20);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, GROUND_Y - 20 - Math.sin(x * 0.008) * 30 - Math.sin(x * 0.015) * 15);
    }
    ctx.lineTo(W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Ground
    const groundGrad = ctx.createLinearGradient(0, ROAD_Y, 0, H);
    groundGrad.addColorStop(0, '#3d5a3d');
    groundGrad.addColorStop(1, '#2a4a2a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, ROAD_Y, W, H - ROAD_Y);

    // Road
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, ROAD_Y, W, ROAD_H);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, ROAD_Y, W, 2);
    ctx.fillRect(0, ROAD_Y + ROAD_H - 2, W, 2);
    // Center line
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(0, ROAD_Y + ROAD_H / 2);
    ctx.lineTo(W, ROAD_Y + ROAD_H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Source pile ---
    const pileFraction = Math.max(0, sourceRemainingRef.current / sourceSize);
    const pileRadius = 65 * Math.max(0.15, pileFraction);
    const pileHeight = 55 * Math.max(0.08, pileFraction);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(SOURCE_X, ROAD_Y + 3, pileRadius + 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pile body
    const pileGrad = ctx.createRadialGradient(SOURCE_X, ROAD_Y - pileHeight * 0.4, 0, SOURCE_X, ROAD_Y, pileRadius);
    pileGrad.addColorStop(0, materialColor);
    pileGrad.addColorStop(1, darkenColor(materialColor, 0.55));
    ctx.fillStyle = pileGrad;
    ctx.beginPath();
    ctx.moveTo(SOURCE_X - pileRadius, ROAD_Y);
    ctx.quadraticCurveTo(SOURCE_X - pileRadius * 0.5, ROAD_Y - pileHeight, SOURCE_X, ROAD_Y - pileHeight);
    ctx.quadraticCurveTo(SOURCE_X + pileRadius * 0.5, ROAD_Y - pileHeight, SOURCE_X + pileRadius, ROAD_Y);
    ctx.closePath();
    ctx.fill();

    // Pile texture
    if (pileFraction > 0.1) {
      ctx.fillStyle = darkenColor(materialColor, 0.75);
      for (let i = 0; i < 12 * pileFraction; i++) {
        const angle = Math.random() * Math.PI;
        const dist = Math.random() * pileRadius * 0.7;
        const px = SOURCE_X + Math.cos(angle) * dist - dist * 0.3;
        const py = ROAD_Y - Math.random() * pileHeight * 0.65;
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Zone indicator — source
    if (nearSource) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(SOURCE_X, ROAD_Y - 30, LOAD_ZONE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --- Excavator ---
    const excBaseX = SOURCE_X - 30;
    const excBaseY = ROAD_Y - pileHeight - 10;
    const armLength = 70;
    const excAngle = excavatorArmAngleRef.current;
    const armRad = (excAngle - 90) * Math.PI / 180;

    // Excavator body (cab on treads)
    ctx.fillStyle = '#D97706';
    drawRoundedRect(ctx, excBaseX - 18, excBaseY - 4, 36, 22, 3);
    ctx.fill();
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, excBaseX - 18, excBaseY - 4, 36, 22, 3);
    ctx.stroke();

    // Treads
    ctx.fillStyle = '#333';
    drawRoundedRect(ctx, excBaseX - 22, excBaseY + 16, 44, 10, 4);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, excBaseX - 22, excBaseY + 16, 44, 10, 4);
    ctx.stroke();
    // Tread wheels
    ctx.fillStyle = '#555';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(excBaseX - 14 + i * 10, excBaseY + 21, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cab window
    ctx.fillStyle = '#93C5FD';
    drawRoundedRect(ctx, excBaseX - 10, excBaseY - 1, 14, 10, 2);
    ctx.fill();

    // Arm
    const armEndX = excBaseX + Math.cos(armRad) * armLength;
    const armEndY = excBaseY + Math.sin(armRad) * armLength;

    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(excBaseX, excBaseY);
    ctx.lineTo(armEndX, armEndY);
    ctx.stroke();

    // Hydraulic cylinder (second line offset)
    ctx.strokeStyle = '#78716C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(excBaseX + 5, excBaseY + 5);
    const midX = (excBaseX + armEndX) / 2 + 8;
    const midY = (excBaseY + armEndY) / 2 - 5;
    ctx.lineTo(midX, midY);
    ctx.stroke();

    // Pivot pin
    ctx.fillStyle = '#78716C';
    ctx.beginPath();
    ctx.arc(excBaseX, excBaseY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bucket at arm end
    const bucketW = 18;
    const bucketH = 14;
    ctx.fillStyle = '#78716C';
    ctx.save();
    ctx.translate(armEndX, armEndY);
    ctx.rotate(armRad + Math.PI * 0.3);
    // Bucket shape
    ctx.beginPath();
    ctx.moveTo(-bucketW / 2, 0);
    ctx.lineTo(-bucketW / 2 - 3, bucketH);
    ctx.lineTo(bucketW / 2 + 3, bucketH);
    ctx.lineTo(bucketW / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bucket teeth
    ctx.fillStyle = '#A8A29E';
    for (let t = 0; t < 4; t++) {
      const tx = -bucketW / 2 + 2 + t * (bucketW / 3.5);
      ctx.fillRect(tx, bucketH, 3, 4);
    }

    // Material in bucket
    if (excavatorBucketFullRef.current) {
      ctx.fillStyle = materialColor;
      ctx.beginPath();
      ctx.arc(0, bucketH * 0.4, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // --- Dump zone ---
    ctx.fillStyle = 'rgba(200, 200, 150, 0.1)';
    ctx.fillRect(DUMP_ZONE_X - 55, ROAD_Y - 75, 110, 75);
    ctx.strokeStyle = 'rgba(200, 200, 150, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(DUMP_ZONE_X - 55, ROAD_Y - 75, 110, 75);
    ctx.setLineDash([]);

    if (nearDump) {
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(DUMP_ZONE_X, ROAD_Y - 30, DUMP_ZONE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // "Dump Here" label
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dump Here', DUMP_ZONE_X, ROAD_Y - 80);

    // Dump pile
    dumpPileRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darkenColor(p.color, 0.65);
      ctx.beginPath();
      ctx.arc(p.x + 0.5, p.y + 0.5, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Falling particles
    fallingParticlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- Truck ---
    // Drawn in local coords facing RIGHT: bed(rear) on left, cab(front) on right.
    // Flipped via ctx.scale(-1,1) when facing left.
    const tx = truckXRef.current;
    const truckBaseY = ROAD_Y - 8;
    const cabW = 35;
    const cabH = 45;
    const bedW = 55;
    const bedH = 35;
    const wheelR = 10;
    const totalTruckW = bedW + cabW;
    const isMoving = movingLeft || movingRight;
    const facingRight = facingRightRef.current;
    const bedAng = bedAngleRef.current;

    // Shadow (in world coords, not flipped)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(tx + totalTruckW / 2, truckBaseY + 5, 52, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Begin truck transform ---
    // We draw the truck facing RIGHT in local coords, then flip if needed.
    // Local origin = left edge of truck at road level.
    ctx.save();
    const truckMidX = tx + totalTruckW / 2;
    ctx.translate(truckMidX, 0);
    if (!facingRight) ctx.scale(-1, 1);
    ctx.translate(-totalTruckW / 2, 0);
    // Now local x=0 is rear of truck (bed/tailgate), x=totalTruckW is front (cab headlight)

    // --- Bed (rear, x=0 to bedW) ---
    // Pivot at x=0 (rear/tailgate end, stays on ground)
    // +bedAngle lifts the cab-side end of the bed
    ctx.save();
    ctx.translate(0, truckBaseY); // pivot at rear bottom of bed
    ctx.rotate(-bedAng * Math.PI / 180); // lifts the +x (cab-side) end upward

    // Bed body
    const bedGrad = ctx.createLinearGradient(0, -bedH, 0, 0);
    bedGrad.addColorStop(0, truckColor);
    bedGrad.addColorStop(1, darkenColor(truckColor, 0.65));
    ctx.fillStyle = bedGrad;
    ctx.fillRect(0, -bedH, bedW, bedH);
    ctx.strokeStyle = darkenColor(truckColor, 0.45);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, -bedH, bedW, bedH);

    // Bed ridges
    ctx.strokeStyle = darkenColor(truckColor, 0.55);
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) {
      const ry = -bedH + (bedH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(2, ry);
      ctx.lineTo(bedW - 2, ry);
      ctx.stroke();
    }

    // Material in bed
    if (currentVolumeRef.current > 0.1) {
      const fillFrac = currentVolumeRef.current / bedVolume;
      const fillH = bedH * fillFrac * 0.85;
      const matGrad = ctx.createLinearGradient(0, -fillH, 0, 0);
      matGrad.addColorStop(0, materialColor);
      matGrad.addColorStop(1, darkenColor(materialColor, 0.65));
      ctx.fillStyle = matGrad;
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(3, -fillH + 3);
      for (let bx = 3; bx <= bedW - 3; bx += 5) {
        const bump = Math.sin(bx * 0.3) * 2.5;
        ctx.lineTo(bx, -fillH + bump);
      }
      ctx.lineTo(bedW - 3, -fillH + 3);
      ctx.lineTo(bedW - 3, 0);
      ctx.closePath();
      ctx.fill();

      // Texture dots
      ctx.fillStyle = darkenColor(materialColor, 0.8);
      for (let i = 0; i < 8 * fillFrac; i++) {
        const dx = 5 + Math.random() * (bedW - 10);
        const dy = -(Math.random() * fillH * 0.8);
        ctx.beginPath();
        ctx.arc(dx, dy, 1 + Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tailgate at x=0 (rear end)
    ctx.fillStyle = darkenColor(truckColor, 0.55);
    ctx.fillRect(-3, -bedH, 3, bedH);

    ctx.restore(); // end bed tilt transform

    // Hydraulic ram (visible when bed is raised)
    if (bedAng > 2) {
      // Ram base on chassis under the bed middle
      const ramBaseX = bedW * 0.4;
      const ramBaseLocalY = truckBaseY;
      // Ram top connects to the tilted bed
      const ramTopX = bedW * 0.4 * Math.cos(-bedAng * Math.PI / 180);
      const ramTopY = truckBaseY - bedW * 0.4 * Math.sin(bedAng * Math.PI / 180);
      ctx.strokeStyle = '#78716C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ramBaseX, ramBaseLocalY);
      ctx.lineTo(ramTopX, ramTopY);
      ctx.stroke();
      ctx.strokeStyle = '#A8A29E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ramBaseX, ramBaseLocalY);
      ctx.lineTo((ramBaseX + ramTopX) / 2, (ramBaseLocalY + ramTopY) / 2);
      ctx.stroke();
    }

    // --- Cab (front, x=bedW to bedW+cabW) ---
    const cabX = bedW;
    const cabY = truckBaseY - cabH;

    const cabGrad = ctx.createLinearGradient(cabX, cabY, cabX, cabY + cabH);
    cabGrad.addColorStop(0, truckColor);
    cabGrad.addColorStop(1, darkenColor(truckColor, 0.65));
    ctx.fillStyle = cabGrad;
    drawRoundedRect(ctx, cabX, cabY, cabW, cabH, 4);
    ctx.fill();
    ctx.strokeStyle = darkenColor(truckColor, 0.45);
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
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(cabX + cabW - 10, cabY + 6, 3, cabH * 0.3);

    // Headlight (front of cab = right side)
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(cabX + cabW - 2, cabY + cabH - 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // Exhaust pipe (on cab roof, toward rear)
    ctx.fillStyle = '#555';
    ctx.fillRect(cabX + 3, cabY - 10, 4, 10);

    // Exhaust smoke when moving
    if (isMoving) {
      const smokeTime = Date.now() * 0.003;
      ctx.fillStyle = 'rgba(180,180,180,0.2)';
      ctx.beginPath();
      ctx.arc(cabX + 5, cabY - 16 + Math.sin(smokeTime) * 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,180,180,0.1)';
      ctx.beginPath();
      ctx.arc(cabX + 3, cabY - 24 + Math.cos(smokeTime) * 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Wheels (drawn in local truck coords) ---
    const wheel1X = 15; // rear wheel (under bed)
    const wheel2X = bedW + cabW - 15; // front wheel (under cab)
    const wheelY = truckBaseY + 2;
    const wheelRotation = isMoving ? (Date.now() * 0.01) % (Math.PI * 2) : 0;

    [wheel1X, wheel2X].forEach(wx => {
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#999';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Spokes
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      for (let a = 0; a < 6; a++) {
        const angle = (a / 6) * Math.PI * 2 + wheelRotation;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(angle) * wheelR * 0.25, wheelY + Math.sin(angle) * wheelR * 0.25);
        ctx.lineTo(wx + Math.cos(angle) * wheelR * 0.5, wheelY + Math.sin(angle) * wheelR * 0.5);
        ctx.stroke();
      }
    });

    ctx.restore(); // end truck facing transform

    // --- HUD overlays on canvas ---
    ctx.textAlign = 'start';

    // Zone labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOAD ZONE', SOURCE_X, ROAD_Y + ROAD_H + 14);
    ctx.fillText('DUMP ZONE', DUMP_ZONE_X, ROAD_Y + ROAD_H + 14);
    ctx.textAlign = 'start';

    // Schedule next frame
    animFrameRef.current = requestAnimationFrame(gameLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialColor, materialDensity, truckCapacity, bedVolume, sourceSize, truckColor]);

  // Start/stop game loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameLoop]);

  // ---- Reset the whole sim when the active job changes ----
  const resetForJob = useCallback((job: DumpTruckJob) => {
    truckXRef.current = SOURCE_X;
    bedAngleRef.current = 0;
    currentWeightRef.current = 0;
    currentVolumeRef.current = 0;
    sourceRemainingRef.current = job.sourceSize;
    loadsCompletedRef.current = 0;
    totalMaterialMovedRef.current = 0;
    operationCountRef.current = 0;
    overloadAttemptsRef.current = 0;
    overloadReasonRef.current = null;
    overloadFlashRef.current = 0;
    dumpPileRef.current = [];
    fallingParticlesRef.current = [];
    excavatorPhaseRef.current = 'idle';
    excavatorArmAngleRef.current = 0;
    excavatorBucketFullRef.current = false;
    scoopAmountRef.current = 0;
    lastDumpVolumeRef.current = 0;
    facingRightRef.current = true;
    setShowSolveCard(false);
    setShowJobHint(false);
    setPredictGuess(null);
    setUiState(s => ({
      ...s,
      sourceRemaining: job.sourceSize,
      currentWeight: 0, currentVolume: 0, loadsCompleted: 0,
      overloadAttempts: 0, totalMaterialMoved: 0, bedAngle: 0,
      truckX: SOURCE_X, overloadReason: null, overloadActive: false,
    }));
  }, []);

  // Job completion check
  const isJobComplete = currentJob.goal === 'complete_loads'
    ? uiState.loadsCompleted >= (currentJob.targetLoads ?? 1)
    : uiState.sourceRemaining <= 0 && uiState.currentVolume <= 0.1;

  const efficiency = uiState.totalMaterialMoved > 0 && loadsCompletedRef.current > 0
    ? uiState.totalMaterialMoved / loadsCompletedRef.current
    : 0;

  // Mark the current job solved once its goal is met (the sim is the judge)
  useEffect(() => {
    if (isJobComplete && !currentSolved) {
      SoundManager.playStreak();
      setSolvedJobIds(prev => {
        if (prev.has(currentJob.id)) return prev;
        const next = new Set(prev);
        next.add(currentJob.id);
        return next;
      });
      setShowSolveCard(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJobComplete, currentSolved]);

  const handleNextJob = () => {
    if (currentJobIdx < jobs.length - 1) {
      const nextIdx = currentJobIdx + 1;
      setCurrentJobIdx(nextIdx);
      resetForJob(jobs[nextIdx]);
      SoundManager.tap();
    }
  };

  const handleSubmitEvaluation = () => {
    if (hasSubmitted) return;
    const solvedCount = solvedJobIds.size;
    const success = solvedCount >= Math.ceil(jobs.length / 2);
    const score = Math.round((solvedCount / Math.max(jobs.length, 1)) * 100);
    const metrics: DumpTruckLoaderMetrics = {
      type: 'dump-truck-loader',
      targetLoads: currentJob.targetLoads ?? Math.ceil(sourceSize / bedVolume),
      loadsCompleted: uiState.loadsCompleted,
      totalMaterialMoved: uiState.totalMaterialMoved,
      sourceSize,
      goalMet: allJobsSolved,
      truckCapacity,
      bedVolume,
      materialType,
      averageLoadSize: uiState.loadsCompleted > 0 ? uiState.totalMaterialMoved / uiState.loadsCompleted : 0,
      efficiency,
      overloadAttempts: uiState.overloadAttempts,
      operationCount: operationCountRef.current,
      timeElapsed: elapsedTime,
      jobsSolved: solvedCount,
      jobsTotal: jobs.length,
    };
    submitResult(success, score, metrics, {
      studentWork: { jobsSolved: solvedCount, jobsTotal: jobs.length, efficiency, elapsedTime },
    });
  };

  // Touch/mouse hold helpers for mobile controls
  const holdIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const startHold = (key: string) => {
    SoundManager.tick();
    keysRef.current.add(key);
    clearInterval(holdIntervalRef.current);
  };
  const stopHold = (key: string) => {
    keysRef.current.delete(key);
  };

  // Reveal which meter is the binding limit — but don't spoil a pending prediction.
  const limitRevealed = !currentJob.predict || !!predictGuess || currentSolved;

  return (
    <LuminaCard className={`w-full max-w-7xl mx-auto my-8 animate-fade-in ${className || ''}`}>
      <LuminaCardHeader>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <LuminaCardTitle className="text-2xl font-bold mb-1">{title}</LuminaCardTitle>
            <LuminaCardDescription className="text-sm">{description}</LuminaCardDescription>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent>
        {/* ── Job Board — the spine: each job is a density puzzle ── */}
        <LuminaPanel accent="amber" className="mb-4 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LuminaBadge accent="amber" className="text-xs">
                Job {currentJobIdx + 1} / {jobs.length}
              </LuminaBadge>
              <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">
                {MATERIAL_LABEL[materialType]}
              </span>
            </div>
            {currentSolved && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">✓ Done</span>
            )}
          </div>

          <div>
            <h3 className="text-white font-semibold text-base">{currentJob.title}</h3>
            <p className="text-slate-300 text-sm mt-1 leading-relaxed">{currentJob.brief}</p>
          </div>

          {/* Goal / progress line */}
          <p className="text-slate-400 text-xs">
            {currentJob.goal === 'complete_loads'
              ? `Goal: dump ${currentJob.targetLoads ?? 1} full load${(currentJob.targetLoads ?? 1) > 1 ? 's' : ''} — done ${uiState.loadsCompleted}/${currentJob.targetLoads ?? 1}.`
              : `Goal: move all ${currentJob.sourceSize} units — ${Math.max(0, Math.round(uiState.sourceRemaining))} left at the pile.`}
          </p>

          {/* Predict: which meter fills first? (reinforces density) */}
          {currentJob.predict && !predictGuess && !currentSolved && (
            <div className="bg-slate-800/50 border border-white/10 rounded-lg p-3 space-y-2">
              <p className="text-slate-200 text-xs font-medium">Predict: for {MATERIAL_LABEL[materialType]}, which fills up first?</p>
              <div className="flex gap-2">
                <LuminaButton onClick={() => { setPredictGuess('volume'); SoundManager.tap(); }} className="flex-1 text-xs">
                  📦 The bed
                </LuminaButton>
                <LuminaButton onClick={() => { setPredictGuess('weight'); SoundManager.tap(); }} className="flex-1 text-xs">
                  ⚖️ The scale
                </LuminaButton>
              </div>
            </div>
          )}
          {currentJob.predict && predictGuess && !currentSolved && (
            <p className="text-slate-500 text-[11px]">
              Your guess: {predictGuess === 'weight' ? '⚖️ the scale' : '📦 the bed'} fills first. Now load up and find out!
            </p>
          )}

          {/* Hint — only on request */}
          {!currentSolved && (
            showJobHint ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-300 text-xs">💡 {currentJob.hint}</p>
              </div>
            ) : (
              <button
                onClick={() => { setShowJobHint(true); SoundManager.tick(); }}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <span>💡</span> Stuck? Get a hint
              </button>
            )
          )}

          {/* Solve card — reveal prediction + explain the density lesson */}
          {showSolveCard && currentSolved && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
              <p className="text-emerald-300 text-sm font-medium">🎉 Job done!</p>
              {currentJob.predict && predictGuess && (
                <p className={`text-xs font-medium ${predictGuess === bindingLimit ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {predictGuess === bindingLimit
                    ? `✓ Your prediction was right — the ${bindingLimit === 'weight' ? 'scale' : 'bed'} filled first!`
                    : `Close! You guessed the ${predictGuess === 'weight' ? 'scale' : 'bed'}, but the ${bindingLimit === 'weight' ? 'scale' : 'bed'} actually filled first.`}
                </p>
              )}
              <p className="text-slate-300 text-xs leading-relaxed">{currentJob.explainOnSolve}</p>
              {currentJobIdx < jobs.length - 1 ? (
                <LuminaButton tone="primary" onClick={handleNextJob} className="w-full">
                  Next Job →
                </LuminaButton>
              ) : !hasSubmitted ? (
                <LuminaButton tone="primary" onClick={handleSubmitEvaluation} className="w-full">
                  Finish &amp; Submit
                </LuminaButton>
              ) : null}
            </div>
          )}
        </LuminaPanel>

        {/* Canvas — bespoke interaction surface, left untouched */}
        <div className="relative mb-4 bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full"
            tabIndex={0}
          />
          {/* Live density feedback — WHICH limit just refused a scoop */}
          {uiState.overloadActive && uiState.overloadReason && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-white/15 px-4 py-2 rounded-xl shadow-lg max-w-[90%]">
              {uiState.overloadReason === 'weight' ? (
                <p className="text-orange-300 text-xs font-medium text-center">
                  ⚖️ Weight limit! {MATERIAL_LABEL[materialType]} is heavy — the bed is only {Math.round((uiState.currentVolume / bedVolume) * 100)}% full but the truck is at its weight limit.
                </p>
              ) : (
                <p className="text-blue-300 text-xs font-medium text-center">
                  📦 Bed full! You filled the space — and the scale is only at {Math.round((uiState.currentWeight / truckCapacity) * 100)}%. {MATERIAL_LABEL[materialType]} is light.
                </p>
              )}
            </div>
          )}
        </div>

        {/* On-screen controls — the bespoke physics-driving buttons stay custom */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Driving controls */}
          <LuminaPanel accent="blue">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 text-center">Drive</div>
            <div className="flex items-center justify-center gap-3">
              <button
                onMouseDown={() => startHold('ArrowLeft')}
                onMouseUp={() => stopHold('ArrowLeft')}
                onMouseLeave={() => stopHold('ArrowLeft')}
                onTouchStart={(e) => { e.preventDefault(); startHold('ArrowLeft'); }}
                onTouchEnd={() => stopHold('ArrowLeft')}
                className="w-14 h-14 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 active:bg-blue-500/30 border border-slate-600/50 active:border-blue-500/50 text-slate-200 text-2xl font-bold transition-all flex items-center justify-center select-none"
              >
                ◀
              </button>
              <div className="w-14 h-14 rounded-xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center">
                <span className="text-slate-500 text-xs font-mono">
                  {Math.round(uiState.truckX)}
                </span>
              </div>
              <button
                onMouseDown={() => startHold('ArrowRight')}
                onMouseUp={() => stopHold('ArrowRight')}
                onMouseLeave={() => stopHold('ArrowRight')}
                onTouchStart={(e) => { e.preventDefault(); startHold('ArrowRight'); }}
                onTouchEnd={() => stopHold('ArrowRight')}
                className="w-14 h-14 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 active:bg-blue-500/30 border border-slate-600/50 active:border-blue-500/50 text-slate-200 text-2xl font-bold transition-all flex items-center justify-center select-none"
              >
                ▶
              </button>
            </div>
            <div className="text-center mt-2 text-[10px] text-slate-500 font-mono">← → or A/D keys</div>
          </LuminaPanel>

          {/* Load controls */}
          <LuminaPanel accent="blue">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 text-center">Excavator</div>
            <div className="flex items-center justify-center">
              <button
                onMouseDown={() => { SoundManager.tap(); loadPressedRef.current = true; }}
                disabled={!uiState.nearSource || uiState.isLoading || uiState.sourceRemaining <= 0}
                className="w-full max-w-[180px] h-14 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 active:bg-blue-500/40 disabled:bg-slate-700/40 disabled:opacity-40 border border-blue-500/40 disabled:border-slate-600/30 text-blue-300 disabled:text-slate-500 font-semibold transition-all flex items-center justify-center gap-2 select-none disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                {uiState.isLoading ? 'Loading...' : 'Scoop & Load'}
              </button>
            </div>
            <div className="text-center mt-2 text-[10px] text-slate-500 font-mono">
              {!uiState.nearSource ? 'Drive to load zone first' : uiState.sourceRemaining <= 0 ? 'Source empty' : 'Click to load material'}
            </div>
          </LuminaPanel>

          {/* Dump controls */}
          <LuminaPanel accent="orange">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 text-center">Bed Tilt</div>
            <div className="flex items-center justify-center gap-3">
              <button
                onMouseDown={() => { SoundManager.tick(); raisePressedRef.current = true; }}
                onMouseUp={() => { raisePressedRef.current = false; }}
                onMouseLeave={() => { raisePressedRef.current = false; }}
                onTouchStart={(e) => { e.preventDefault(); SoundManager.tick(); raisePressedRef.current = true; }}
                onTouchEnd={() => { raisePressedRef.current = false; }}
                disabled={!uiState.nearDump || uiState.currentVolume <= 0.1}
                className="w-14 h-14 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 active:bg-orange-500/40 disabled:bg-slate-700/40 disabled:opacity-40 border border-orange-500/40 disabled:border-slate-600/30 text-orange-300 disabled:text-slate-500 text-2xl font-bold transition-all flex items-center justify-center select-none disabled:cursor-not-allowed"
              >
                ▲
              </button>
              <div className="w-14 h-14 rounded-xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center">
                <span className="text-slate-400 text-xs font-mono">
                  {Math.round(uiState.bedAngle)}°
                </span>
              </div>
              <button
                onMouseDown={() => { SoundManager.tick(); lowerPressedRef.current = true; }}
                onMouseUp={() => { lowerPressedRef.current = false; }}
                onMouseLeave={() => { lowerPressedRef.current = false; }}
                onTouchStart={(e) => { e.preventDefault(); SoundManager.tick(); lowerPressedRef.current = true; }}
                onTouchEnd={() => { lowerPressedRef.current = false; }}
                className="w-14 h-14 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 active:bg-orange-500/40 disabled:bg-slate-700/40 disabled:opacity-40 border border-orange-500/40 disabled:border-slate-600/30 text-orange-300 disabled:text-slate-500 text-2xl font-bold transition-all flex items-center justify-center select-none disabled:cursor-not-allowed"
              >
                ▼
              </button>
            </div>
            <div className="text-center mt-2 text-[10px] text-slate-500 font-mono">
              {!uiState.nearDump ? 'Drive to dump zone first' : '↑/↓ or W/S keys'}
            </div>
          </LuminaPanel>
        </div>

        {/* Status Display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <LuminaPanel className="group hover:border-amber-500/50 transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Source Remaining</div>
            <div className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors">
              {Math.round(uiState.sourceRemaining)}
              <span className="text-sm text-slate-400 ml-1">units</span>
            </div>
          </LuminaPanel>

          {showFillLevel && (
            <LuminaPanel className={`group transition-all ${limitRevealed && bindingLimit === 'volume' ? 'border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]'}`}>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>📦 Bed Fill</span>
                {limitRevealed && bindingLimit === 'volume' && <span className="text-blue-400 text-[9px] normal-case">← your limit</span>}
              </div>
              <div className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                {Math.round((uiState.currentVolume / bedVolume) * 100)}
                <span className="text-sm text-slate-400">%</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (uiState.currentVolume / bedVolume) * 100)}%` }}
                />
              </div>
            </LuminaPanel>
          )}

          {showWeight && (
            <LuminaPanel className={`group transition-all ${limitRevealed && bindingLimit === 'weight' ? 'border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.2)]' : 'hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]'}`}>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>⚖️ Weight</span>
                {limitRevealed && bindingLimit === 'weight' && <span className="text-orange-400 text-[9px] normal-case">← your limit</span>}
              </div>
              <div className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">
                {Math.round(uiState.currentWeight)}
                <span className="text-sm text-slate-400">/{truckCapacity}</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (uiState.currentWeight / truckCapacity) * 100)}%` }}
                />
              </div>
            </LuminaPanel>
          )}

          <LuminaPanel className="group hover:border-green-500/50 transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Loads Completed</div>
            <div className="text-2xl font-bold text-white group-hover:text-green-400 transition-colors">
              {uiState.loadsCompleted}
              {targetLoads && <span className="text-sm text-slate-400">/{targetLoads}</span>}
            </div>
          </LuminaPanel>
        </div>

        {timeLimit && (
          <div className="mb-4 text-sm font-mono text-slate-300 text-center">
            Time: <span className={elapsedTime > timeLimit ? 'text-red-400' : 'text-green-400'}>
              {Math.round(elapsedTime)}s
            </span> / {timeLimit}s
          </div>
        )}

        {/* Early finish once at least half the jobs are done */}
        {!allJobsSolved && !hasSubmitted && solvedJobIds.size >= Math.ceil(jobs.length / 2) && (
          <div className="mb-4 flex justify-center">
            <LuminaActionButton action="check" onClick={handleSubmitEvaluation}>
              Finish here ({solvedJobIds.size}/{jobs.length} jobs)
            </LuminaActionButton>
          </div>
        )}

        {hasSubmitted && (
          <LuminaFeedbackCard status="insight" label="Work Submitted 🏗️">
            <div className="flex items-center justify-between gap-4">
              <span>Jobs solved: {solvedJobIds.size}/{jobs.length}. Nice hauling!</span>
              <LuminaActionButton
                action="retry"
                onClick={() => { resetAttempt(); setSolvedJobIds(new Set()); setCurrentJobIdx(0); resetForJob(jobs[0]); }}
              >
                ↺ Try Again
              </LuminaActionButton>
            </div>
          </LuminaFeedbackCard>
        )}

        {/* Job progress dots */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-slate-600 text-xs font-mono">Jobs:</span>
          {jobs.map(j => (
            <span
              key={j.id}
              className={`w-2.5 h-2.5 rounded-full ${solvedJobIds.has(j.id) ? 'bg-emerald-400' : j.id === currentJob.id ? 'bg-amber-400' : 'bg-slate-700'}`}
              title={j.title}
            />
          ))}
          <span className="text-slate-600 text-xs">{solvedJobIds.size}/{jobs.length}</span>
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DumpTruckLoader;
