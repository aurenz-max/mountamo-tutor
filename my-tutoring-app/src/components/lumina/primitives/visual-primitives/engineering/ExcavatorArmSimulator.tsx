'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  usePrimitiveEvaluation,
  type ExcavatorArmSimulatorMetrics,
} from '../../../evaluation';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaPanel,
  LuminaBadge,
  LuminaButton,
  LuminaStat,
  LuminaActionButton,
} from '../../../ui';

/**
 * Excavator Arm Simulator — "Dig Site Job Board"
 *
 * K-5 Engineering primitive rebuilt on the mission-reimagining pattern
 * (HydraulicsLab / DumpTruckLoader): a ladder of code-owned jobs where the
 * GEOMETRY ENGINE is the judge — not a submit button.
 *
 * Each job makes a different property of the 3-joint arm the puzzle:
 *   1. First Scoop      — cause & effect: dig, swing, load a real truck
 *   2. The Far Patch    — body locked in mud → the REACH ENVELOPE is the lesson
 *   3. Three Scoops     — fuel-limited digs; scoop fullness is depth-based → EFFICIENCY
 *   4. Buried Pipe      — precision trenching over a visible hazard → COORDINATION
 *   5. Jammed Stick     — one joint disabled → kinematic REDUNDANCY
 *
 * Correctness is code-owned: dig zones are positioned as fractions of the
 * actual (boom + stick + bucket) reach, so every job is solvable for any
 * generator-produced arm dimensions. Gemini may re-theme the WORDS via
 * `missionThemes`; the numbers never leave this file.
 *
 * Core mechanics that make the arm itself the skill:
 * - Digging only works with the bucket tip below the terrain surface, and the
 *   scoop fill is proportional to bite depth (live "% bite" gauge at the tip).
 * - Terrain is a dense heightfield that carves real craters, exposing layers.
 * - Dumping is physical: material falls; over the truck bed it loads, off the
 *   bed it spills (and is counted).
 * - Pipe strikes are detected continuously against the bucket tip.
 */

// ── Legacy data-contract types (kept stable for the generator) ──────────────

export interface MaterialLayer {
  type: string;           // e.g., "topsoil", "clay", "sand", "rock"
  color: string;          // Hex color
  depth: number;          // Depth from ground level (pixels)
  hardness: number;       // 1-10 (legacy; not used by the job board)
}

export interface TerrainPoint {
  x: number;              // X position
  height: number;         // Height of terrain at this x
}

/** @deprecated Superseded by the mission job board; kept for data-contract stability. */
export interface TargetZone {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

/** @deprecated Superseded by the mission job board; kept for data-contract stability. */
export interface DiggingChallenge {
  description: string;
  targetX: number;
  targetY: number;
  targetAmount: number;
  materialType?: string;
}

/** Words-only re-theming of a mission (applied by index). Numbers stay in code. */
export interface ExcavatorMissionTheme {
  badge?: string;
  title?: string;
  brief?: string;
  successHint?: string;
  explainOnSolve?: string;
}

export interface ExcavatorArmSimulatorData {
  title: string;
  description: string;

  // Arm configuration
  boomLength: number;           // Length of boom segment (pixels, typically 80-120)
  stickLength: number;          // Length of stick segment (pixels, typically 60-100)
  bucketSize: number;           // Capacity of bucket (units, typically 5-15)

  // Control options
  jointControl: 'sliders' | 'buttons' | 'drag';
  showAngles: boolean;          // Display joint angles
  showReach: boolean;           // Display reach envelope

  // Terrain
  terrainProfile: TerrainPoint[]; // Ground height profile
  materialLayers: MaterialLayer[]; // Soil layers
  targetZone?: TargetZone;        // legacy, unused
  challenge?: DiggingChallenge;   // legacy, unused

  // Constraints
  minBoomAngle: number;
  maxBoomAngle: number;
  minStickAngle: number;
  maxStickAngle: number;
  minBucketAngle: number;
  maxBucketAngle: number;

  // Visual theme
  theme: 'realistic' | 'cartoon' | 'blueprint';
  excavatorColor: string;

  // Optional generator re-theming of mission words (numbers stay in code)
  missionThemes?: ExcavatorMissionTheme[];

  // Evaluation integration (optional)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<ExcavatorArmSimulatorMetrics>) => void;
}

interface ExcavatorArmSimulatorProps {
  data: ExcavatorArmSimulatorData;
  className?: string;
}

// ============================================================================
// Missions — code-owned engineering jobs (numbers = correctness).
//
// Dig zones are resolved at runtime as fractions of the arm's actual reach,
// so every job is guaranteed solvable for any generated boom/stick lengths.
// Goals are multiples of the actual bucketSize (goalScoops), so "3 digs of
// fuel" style constraints always have slack by construction:
//   fuel job: goal = ceil(2.4 × bucket) ≤ 3 full scoops = 3 × bucket. ✓
// ============================================================================

export interface ExcavatorMissionDef {
  id: string;
  badge: string;               // site-story label, e.g. "Stuck in the Mud"
  title: string;
  brief: string;
  goalKind: 'truck' | 'zone';  // load the truck vs. extract from the marked zone
  goalScoops: number;          // goalUnits = ceil(goalScoops × bucketSize)
  lockBody?: boolean;          // tracks stuck — can't drive
  lockStick?: boolean;         // stick hydraulic jammed at a fixed angle
  maxDigs?: number;            // fuel limit
  hasPipe?: boolean;           // buried pipe hazard inside the zone
  zonePlacement?: 'far' | 'mid';
  forceShowReach?: boolean;    // reach envelope always on for this job
  successHint: string;
  explainOnSolve: string;
}

const DEFAULT_MISSIONS: ExcavatorMissionDef[] = [
  {
    id: 'rookie',
    badge: 'Training Yard',
    title: 'First Scoop',
    brief: 'Welcome to the dig site! Drag the glowing joints to curl the bucket into the dirt, press Dig to scoop, then swing over the truck and press Dump. Load the truck to finish the job.',
    goalKind: 'truck',
    goalScoops: 0.8,
    successHint: 'Drag the joints: boom lifts, stick reaches, bucket curls. Push the bucket tip INTO the dirt before pressing Dig — a deeper bite fills the bucket more. Then drive the body close to the truck and dump above the bed.',
    explainOnSolve: 'You just ran a three-joint machine! Boom, stick and bucket each rotate on their own, but working together they put the bucket exactly where you wanted — dig, swing, dump.',
  },
  {
    id: 'reach',
    badge: 'Stuck in the Mud',
    title: 'The Far Patch',
    brief: "Rain! The tracks are stuck in the mud, so you can't drive. The marked patch is far away — stretch the arm as long as it will go to dig there. The dashed circle shows everywhere your bucket can reach.",
    goalKind: 'zone',
    goalScoops: 1.2,
    lockBody: true,
    zonePlacement: 'far',
    forceShowReach: true,
    successHint: 'To reach far away, lower the boom and straighten the stick so the whole arm makes one long line. The bucket can only touch places inside the dashed circle.',
    explainOnSolve: "That dashed circle is the arm's REACH ENVELOPE — boom + stick + bucket stretched into a straight line is the farthest the tip can ever touch. Real operators check it before they park!",
  },
  {
    id: 'fuel',
    badge: 'Fuel Watch',
    title: 'Three Scoops',
    brief: "Low fuel — there's only enough for 3 digs! The truck needs a full load, so every single scoop has to count. Sink the bucket DEEP before you dig (watch the bite meter), and don't waste a scoop.",
    goalKind: 'truck',
    goalScoops: 2.4,
    maxDigs: 3,
    successHint: "A shallow bite gives a half-empty bucket. Push the bucket tip deep into the dirt until the bite meter reads 100%, THEN press Dig. Full scoops only!",
    explainOnSolve: "Deep bite = full bucket. You moved a whole truckload in just 3 scoops — that's EFFICIENCY, and it's how real operators save fuel and time on the job.",
  },
  {
    id: 'pipe',
    badge: 'Call Before You Dig',
    title: 'Careful! Buried Pipe',
    brief: 'A gas pipe runs under the marked trench. Dig out the trench WITHOUT touching the pipe — take shallow scoops and spread them across the trench. One touch and the site shuts down!',
    goalKind: 'zone',
    goalScoops: 1.5,
    hasPipe: true,
    zonePlacement: 'mid',
    successHint: "Never dig deep twice in the same spot — that's how pipes get hit. Take one scoop, slide the bucket sideways, take the next. Shallow and steady wins.",
    explainOnSolve: 'That is precision excavation! Real crews call a hotline to mark buried pipes, then remove thin, careful layers exactly like you did. Fine control of all three joints keeps the tip away from danger.',
  },
  {
    id: 'jammed',
    badge: "Engineer's Challenge",
    title: 'Jammed Stick',
    brief: "Uh oh — the stick's hydraulic cylinder is jammed and won't move. Can you still load the truck using ONLY the boom, the bucket, and driving the tracks? A great operator finds another way.",
    goalKind: 'truck',
    goalScoops: 1.2,
    lockStick: true,
    successHint: 'You lost one joint, not the machine! Drive the tracks to line up, raise or lower the boom to set the height, and curl the bucket to bite and carry the dirt.',
    explainOnSolve: 'You proved the arm has REDUNDANCY — different joint combinations can put the bucket in the same place. When one joint fails, the others (plus the tracks) can cover for it. That is engineering thinking!',
  },
];

// ── Simulation constants ────────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 600;
const GROUND_Y = CANVAS_H - 100;          // base ground line
const BASE_Y = CANVAS_H - 150;            // excavator chassis line
const BUCKET_SEG = 30;                    // bucket link length (px)
const FULL_BITE_DEPTH = 28;               // tip this deep below surface = 100% scoop
const CARVE_RADIUS = 26;                  // crater half-width per dig
const MIN_TERRAIN_HEIGHT = -80;           // deepest possible carve
const HF_SAMPLES = 101;                   // heightfield resolution
const PIPE_DEPTH = 55;                    // pipe center below the ORIGINAL surface
const PIPE_STRIKE_DIST = 13;              // tip within this of pipe center = strike
const JOINT_HIT_RADIUS = 20;

// Truck (parked on the right for truck-goal jobs)
const BED_X0 = 588;
const BED_W = 110;
const BED_WALL_H = 52;
const BED_FLOOR_Y = GROUND_Y - 8;
const BED_TOP_Y = BED_FLOOR_Y - BED_WALL_H;

// ── Small helpers ───────────────────────────────────────────────────────────

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

type DragTarget = 'boom' | 'stick' | 'bucket' | 'body' | null;

interface AirborneParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  towardTruck: boolean;
}

interface MissionLayout {
  goalUnits: number;
  bodyStartX: number;
  bodyLocked: boolean;
  bodyMinX: number;
  bodyMaxX: number;
  stickLockAngle: number | null;
  digZone: { x0: number; x1: number } | null;
  pipe: { x0: number; x1: number; y: number } | null;
  hasTruck: boolean;
  showReach: boolean;
  maxDigs: number | null;
}

const ExcavatorArmSimulator: React.FC<ExcavatorArmSimulatorProps> = ({ data, className }) => {
  const {
    title,
    description,
    boomLength = 100,
    stickLength = 80,
    bucketSize = 10,
    showAngles = true,
    showReach = false,
    terrainProfile = [],
    materialLayers = [],
    minBoomAngle = -30,
    maxBoomAngle = 90,
    minStickAngle = -120,
    maxStickAngle = 30,
    minBucketAngle = -90,
    maxBucketAngle = 90,
    excavatorColor = '#F59E0B',
    missionThemes,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Missions (words themable, numbers code-owned) ─────────────────────────
  const missions = useMemo<ExcavatorMissionDef[]>(
    () => DEFAULT_MISSIONS.map((m, i) => {
      const t = missionThemes?.[i];
      if (!t) return m;
      return {
        ...m,
        badge: t.badge || m.badge,
        title: t.title || m.title,
        brief: t.brief || m.brief,
        successHint: t.successHint || m.successHint,
        explainOnSolve: t.explainOnSolve || m.explainOnSolve,
      };
    }),
    [missionThemes],
  );

  const [currentMissionIdx, setCurrentMissionIdx] = useState(0);
  const currentMission = missions[Math.min(currentMissionIdx, missions.length - 1)];

  // ── Initial terrain heightfield (dense resample of terrainProfile) ────────
  const initialHeights = useMemo<number[]>(() => {
    const pts = [...terrainProfile].sort((a, b) => a.x - b.x);
    const heights: number[] = [];
    for (let i = 0; i < HF_SAMPLES; i++) {
      const x = (i / (HF_SAMPLES - 1)) * CANVAS_W;
      if (pts.length === 0) { heights.push(10); continue; }
      if (x <= pts[0].x) { heights.push(pts[0].height); continue; }
      if (x >= pts[pts.length - 1].x) { heights.push(pts[pts.length - 1].height); continue; }
      let h = pts[pts.length - 1].height;
      for (let p = 0; p < pts.length - 1; p++) {
        if (x >= pts[p].x && x <= pts[p + 1].x) {
          const span = pts[p + 1].x - pts[p].x || 1;
          const t = (x - pts[p].x) / span;
          h = pts[p].height + t * (pts[p + 1].height - pts[p].height);
          break;
        }
      }
      heights.push(h);
    }
    return heights;
  }, [terrainProfile]);

  const heightsRef = useRef<number[]>([...initialHeights]);

  const heightAt = useCallback((x: number): number => {
    const hs = heightsRef.current;
    const fi = clampNum((x / CANVAS_W) * (HF_SAMPLES - 1), 0, HF_SAMPLES - 1);
    const i0 = Math.floor(fi);
    const i1 = Math.min(HF_SAMPLES - 1, i0 + 1);
    const t = fi - i0;
    return hs[i0] + t * (hs[i1] - hs[i0]);
  }, []);

  const surfaceYAt = useCallback((x: number): number => GROUND_Y - heightAt(x), [heightAt]);

  const initialHeightAt = useCallback((x: number): number => {
    const fi = clampNum((x / CANVAS_W) * (HF_SAMPLES - 1), 0, HF_SAMPLES - 1);
    const i0 = Math.floor(fi);
    const i1 = Math.min(HF_SAMPLES - 1, i0 + 1);
    const t = fi - i0;
    return initialHeights[i0] + t * (initialHeights[i1] - initialHeights[i0]);
  }, [initialHeights]);

  // ── Mission layout — geometry resolved from the ACTUAL arm dimensions ─────
  const layout = useMemo<MissionLayout>(() => {
    const maxReach = boomLength + stickLength + BUCKET_SEG;
    const hasTruck = currentMission.goalKind === 'truck';
    const bodyLocked = !!currentMission.lockBody;
    const bodyStartX = bodyLocked ? 150 : 120;
    const bodyMaxX = hasTruck ? BED_X0 - 88 : CANVAS_W - 80;

    let digZone: MissionLayout['digZone'] = null;
    if (currentMission.zonePlacement === 'far') {
      // 78% of max reach from the locked pivot — solvable, but demands extension
      const center = Math.min(bodyStartX + 5 + 0.78 * maxReach, CANVAS_W - 60);
      digZone = { x0: center - 40, x1: center + 40 };
    } else if (currentMission.zonePlacement === 'mid') {
      digZone = { x0: 265, x1: 375 };
    }

    let pipe: MissionLayout['pipe'] = null;
    if (currentMission.hasPipe && digZone) {
      const centerX = (digZone.x0 + digZone.x1) / 2;
      pipe = {
        x0: digZone.x0 - 24,
        x1: digZone.x1 + 24,
        y: GROUND_Y - initialHeightAt(centerX) + PIPE_DEPTH,
      };
    }

    // Stick lock angle clamped into the data's legal range
    const stickLockAngle = currentMission.lockStick
      ? clampNum(-50, minStickAngle, maxStickAngle)
      : null;

    return {
      goalUnits: Math.max(1, Math.ceil(currentMission.goalScoops * bucketSize)),
      bodyStartX,
      bodyLocked,
      bodyMinX: 80,
      bodyMaxX,
      stickLockAngle,
      digZone,
      pipe,
      hasTruck,
      showReach: showReach || !!currentMission.forceShowReach,
      maxDigs: currentMission.maxDigs ?? null,
    };
  }, [currentMission, boomLength, stickLength, bucketSize, showReach, minStickAngle, maxStickAngle, initialHeightAt]);

  // ── Canvas + arm state ─────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [boomAngle, setBoomAngle] = useState(45);
  const [stickAngle, setStickAngle] = useState(-45);
  const [bucketAngle, setBucketAngle] = useState(0);
  const boomAngleRef = useRef(45);
  const stickAngleRef = useRef(-45);
  const bucketAngleRef = useRef(0);

  const [, setExcavatorX] = useState(120);
  const excavatorXRef = useRef(120);

  const draggingRef = useRef<DragTarget>(null);
  const hoveredJointRef = useRef<DragTarget>(null);
  const dragStartXRef = useRef(0);
  const dragStartExcavatorXRef = useRef(0);

  // ── Job/site state ─────────────────────────────────────────────────────────
  // Per-mission (reset by resetSite):
  const [bucketLoad, setBucketLoad] = useState<string[]>([]); // one color per unit
  const bucketLoadRef = useRef<string[]>([]);
  const [truckLoad, setTruckLoad] = useState(0);
  const truckLoadRef = useRef(0);
  const [zoneExtracted, setZoneExtracted] = useState(0);
  const [digsUsed, setDigsUsed] = useState(0);
  const [strikeActive, setStrikeActive] = useState(false);
  const strikeLatchRef = useRef(false);

  // Cumulative (survive mission resets; feed metrics):
  const [totalExcavated, setTotalExcavated] = useState(0);
  const [digOperations, setDigOperations] = useState(0);
  const [dumpOperations, setDumpOperations] = useState(0);
  const [pipeStrikes, setPipeStrikes] = useState(0);
  const [spilledUnits, setSpilledUnits] = useState(0);

  // Mission flow:
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [showSolveCard, setShowSolveCard] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Visual-only refs
  const airborneRef = useRef<AirborneParticle[]>([]);
  const toastRef = useRef<{ text: string; frames: number }>({ text: '', frames: 0 });
  const strikeFlashRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const specklesRef = useRef<{ x: number; y: number }[]>(
    Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random() }))
  );

  const currentSolved = solvedIds.has(currentMission.id);
  const allMissionsSolved = solvedIds.size === missions.length;
  const missionProgress = currentMission.goalKind === 'truck' ? truckLoad : zoneExtracted;
  const outOfFuel =
    layout.maxDigs !== null &&
    digsUsed >= layout.maxDigs &&
    bucketLoad.length === 0 &&
    !currentSolved;

  // Evaluation hook
  const { submitResult, hasSubmitted, resetAttempt } = usePrimitiveEvaluation<ExcavatorArmSimulatorMetrics>({
    primitiveType: 'excavator-arm-simulator',
    instanceId: instanceId || `excavator-arm-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  const toast = useCallback((text: string) => {
    toastRef.current = { text, frames: 120 };
  }, []);

  // ── Joint math ─────────────────────────────────────────────────────────────
  const getJointPositions = useCallback(() => {
    const exX = excavatorXRef.current;
    const armPivotX = exX + 5;
    const armPivotY = BASE_Y + 2;

    const ba = boomAngleRef.current;
    const sa = stickAngleRef.current;
    const bka = bucketAngleRef.current;

    const boomRad = (ba * Math.PI) / 180;
    const stickRad = ((ba + sa) * Math.PI) / 180;
    const bucketRad = ((ba + sa + bka) * Math.PI) / 180;

    const boomEndX = armPivotX + Math.cos(boomRad) * boomLength;
    const boomEndY = armPivotY - Math.sin(boomRad) * boomLength;

    const stickEndX = boomEndX + Math.cos(stickRad) * stickLength;
    const stickEndY = boomEndY - Math.sin(stickRad) * stickLength;

    const bucketTipX = stickEndX + Math.cos(bucketRad) * BUCKET_SEG;
    const bucketTipY = stickEndY - Math.sin(bucketRad) * BUCKET_SEG;

    return {
      pivot: { x: armPivotX, y: armPivotY },
      boomEnd: { x: boomEndX, y: boomEndY },
      stickEnd: { x: stickEndX, y: stickEndY },
      bucketTip: { x: bucketTipX, y: bucketTipY },
      bodyCenter: { x: exX, y: BASE_Y + 15 },
    };
  }, [boomLength, stickLength]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }, []);

  const hitTest = useCallback((mx: number, my: number): DragTarget => {
    const pos = getJointPositions();
    if (dist(mx, my, pos.stickEnd.x, pos.stickEnd.y) < JOINT_HIT_RADIUS) return 'bucket';
    if (dist(mx, my, pos.boomEnd.x, pos.boomEnd.y) < JOINT_HIT_RADIUS) {
      return layout.stickLockAngle !== null ? null : 'stick';
    }
    if (dist(mx, my, pos.pivot.x, pos.pivot.y) < JOINT_HIT_RADIUS) return 'boom';
    if (!layout.bodyLocked) {
      const bx = pos.bodyCenter.x;
      const by = pos.bodyCenter.y;
      if (mx > bx - 40 && mx < bx + 40 && my > by - 30 && my < by + 40) return 'body';
    }
    return null;
  }, [getJointPositions, layout.stickLockAngle, layout.bodyLocked]);

  // ── Angle setters (state + ref, clamped) ──────────────────────────────────
  const handleBoomAngleChange = useCallback((value: number) => {
    const clamped = clampNum(value, minBoomAngle, maxBoomAngle);
    setBoomAngle(clamped);
    boomAngleRef.current = clamped;
  }, [minBoomAngle, maxBoomAngle]);

  const handleStickAngleChange = useCallback((value: number) => {
    if (layout.stickLockAngle !== null) return; // jammed
    const clamped = clampNum(value, minStickAngle, maxStickAngle);
    setStickAngle(clamped);
    stickAngleRef.current = clamped;
  }, [minStickAngle, maxStickAngle, layout.stickLockAngle]);

  const handleBucketAngleChange = useCallback((value: number) => {
    const clamped = clampNum(value, minBucketAngle, maxBucketAngle);
    setBucketAngle(clamped);
    bucketAngleRef.current = clamped;
  }, [minBucketAngle, maxBucketAngle]);

  const handleExcavatorMove = useCallback((newX: number) => {
    if (layout.bodyLocked) return;
    const clamped = clampNum(newX, layout.bodyMinX, layout.bodyMaxX);
    setExcavatorX(clamped);
    excavatorXRef.current = clamped;
  }, [layout.bodyLocked, layout.bodyMinX, layout.bodyMaxX]);

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const target = hitTest(x, y);
    if (target) {
      draggingRef.current = target;
      dragStartXRef.current = x;
      dragStartExcavatorXRef.current = excavatorXRef.current;
      e.preventDefault();
    }
  }, [getCanvasCoords, hitTest]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const target = draggingRef.current;

    if (!target) {
      hoveredJointRef.current = hitTest(x, y);
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = hoveredJointRef.current ? 'grab' : 'default';
      return;
    }

    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grabbing';

    if (target === 'body') {
      const dx = x - dragStartXRef.current;
      handleExcavatorMove(dragStartExcavatorXRef.current + dx);
      return;
    }

    const pos = getJointPositions();
    if (target === 'boom') {
      const dx = x - pos.pivot.x;
      const dy = -(y - pos.pivot.y);
      handleBoomAngleChange((Math.atan2(dy, dx) * 180) / Math.PI);
    } else if (target === 'stick') {
      const dx = x - pos.boomEnd.x;
      const dy = -(y - pos.boomEnd.y);
      const absAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      handleStickAngleChange(absAngle - boomAngleRef.current);
    } else if (target === 'bucket') {
      const dx = x - pos.stickEnd.x;
      const dy = -(y - pos.stickEnd.y);
      const absAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      handleBucketAngleChange(absAngle - boomAngleRef.current - stickAngleRef.current);
    }
  }, [getCanvasCoords, hitTest, getJointPositions, handleBoomAngleChange, handleStickAngleChange, handleBucketAngleChange, handleExcavatorMove]);

  const handleCanvasMouseUp = useCallback(() => {
    draggingRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = hoveredJointRef.current ? 'grab' : 'default';
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    draggingRef.current = null;
    hoveredJointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'default';
  }, []);

  // ── Site reset (per mission; cumulative metrics untouched) ─────────────────
  const resetSite = useCallback(() => {
    heightsRef.current = [...initialHeights];

    const boom0 = clampNum(45, minBoomAngle, maxBoomAngle);
    const stick0 = layout.stickLockAngle ?? clampNum(-45, minStickAngle, maxStickAngle);
    const bucket0 = clampNum(0, minBucketAngle, maxBucketAngle);
    setBoomAngle(boom0); boomAngleRef.current = boom0;
    setStickAngle(stick0); stickAngleRef.current = stick0;
    setBucketAngle(bucket0); bucketAngleRef.current = bucket0;
    setExcavatorX(layout.bodyStartX); excavatorXRef.current = layout.bodyStartX;

    setBucketLoad([]); bucketLoadRef.current = [];
    setTruckLoad(0); truckLoadRef.current = 0;
    setZoneExtracted(0);
    setDigsUsed(0);
    setStrikeActive(false);
    strikeLatchRef.current = false;
    airborneRef.current = [];
    toastRef.current = { text: '', frames: 0 };
    strikeFlashRef.current = 0;
    setShowHint(false);
    setShowSolveCard(false);
  }, [initialHeights, layout, minBoomAngle, maxBoomAngle, minStickAngle, maxStickAngle, minBucketAngle, maxBucketAngle]);

  // Reset the site whenever the mission (and thus its layout) changes — this
  // also initializes the first mission on mount.
  useEffect(() => {
    resetSite();
  }, [resetSite]);

  // ── Engine-judged solve detection ──────────────────────────────────────────
  useEffect(() => {
    if (currentSolved || strikeActive) return;
    if (missionProgress >= layout.goalUnits) {
      setSolvedIds(prev => {
        const next = new Set(prev);
        next.add(currentMission.id);
        return next;
      });
      setShowSolveCard(true);
      SoundManager.playPerfect();
    }
  }, [missionProgress, layout.goalUnits, currentSolved, strikeActive, currentMission.id]);

  // ── Dig — position + depth are the skill ───────────────────────────────────
  const handleDig = useCallback(() => {
    if (strikeActive) return;
    const pos = getJointPositions();
    const tipX = pos.bucketTip.x;
    const tipY = pos.bucketTip.y;

    if (layout.maxDigs !== null && digsUsed >= layout.maxDigs) {
      SoundManager.invalid();
      toast('⛽ Out of fuel — no digs left!');
      return;
    }
    if (bucketLoadRef.current.length >= bucketSize) {
      SoundManager.invalid();
      toast('Bucket is full — dump it first!');
      return;
    }

    const surface = surfaceYAt(tipX);
    const depth = tipY - surface;
    if (depth < 3) {
      SoundManager.invalid();
      toast('Push the bucket tip INTO the dirt first');
      return;
    }

    // Scoop fill is proportional to bite depth — the core skill.
    const frac = Math.min(1, depth / FULL_BITE_DEPTH);
    const capacityLeft = bucketSize - bucketLoadRef.current.length;
    const units = clampNum(Math.round(frac * bucketSize), 1, capacityLeft);

    // Material color from the layer at this depth below base ground level
    let color = '#8B7355';
    for (const layer of materialLayers) {
      if (tipY >= GROUND_Y + layer.depth) color = layer.color;
    }

    // Carve a smooth crater around the tip
    const hs = heightsRef.current;
    const carve = frac * (CARVE_RADIUS + 2);
    for (let i = 0; i < HF_SAMPLES; i++) {
      const xi = (i / (HF_SAMPLES - 1)) * CANVAS_W;
      const d = Math.abs(xi - tipX);
      if (d < CARVE_RADIUS) {
        const falloff = Math.cos((d / CARVE_RADIUS) * (Math.PI / 2));
        hs[i] = Math.max(MIN_TERRAIN_HEIGHT, hs[i] - carve * falloff);
      }
    }

    SoundManager.tap();

    const newLoad = [...bucketLoadRef.current, ...Array.from({ length: units }, () => color)];
    bucketLoadRef.current = newLoad;
    setBucketLoad(newLoad);
    setTotalExcavated(prev => prev + units);
    setDigOperations(prev => prev + 1);
    setDigsUsed(prev => prev + 1);

    if (currentMission.goalKind === 'zone' && layout.digZone) {
      if (tipX >= layout.digZone.x0 && tipX <= layout.digZone.x1) {
        setZoneExtracted(prev => prev + units);
      } else {
        toast('Outside the marked zone — that scoop does not count');
      }
    }
  }, [strikeActive, getJointPositions, layout.maxDigs, layout.digZone, digsUsed, bucketSize, surfaceYAt, materialLayers, currentMission.goalKind, toast]);

  // ── Dump — gravity decides where it lands ──────────────────────────────────
  const handleDump = useCallback(() => {
    if (strikeActive) return;
    const load = bucketLoadRef.current;
    if (load.length === 0) {
      SoundManager.invalid();
      return;
    }

    const pos = getJointPositions();
    const tipX = pos.bucketTip.x;
    const tipY = pos.bucketTip.y;

    const overBed =
      layout.hasTruck &&
      tipX >= BED_X0 + 10 &&
      tipX <= BED_X0 + BED_W - 10 &&
      tipY < BED_TOP_Y - 2;

    // Spawn falling particles (visual; the judgment is geometric at this moment)
    airborneRef.current = [
      ...airborneRef.current,
      ...load.map((color, i) => ({
        x: tipX + ((i % 5) - 2) * 4,
        y: tipY + Math.floor(i / 5) * 3,
        vx: ((i % 5) - 2) * 0.4,
        vy: -0.5 - (i % 3) * 0.3,
        color,
        towardTruck: overBed,
      })),
    ];

    if (layout.hasTruck) {
      if (overBed) {
        const newTruck = truckLoadRef.current + load.length;
        truckLoadRef.current = newTruck;
        setTruckLoad(newTruck);
        SoundManager.pop();
      } else {
        setSpilledUnits(prev => prev + load.length);
        SoundManager.invalid();
        toast('💨 Missed the truck! That load spilled');
      }
    } else {
      SoundManager.snap();
    }

    bucketLoadRef.current = [];
    setBucketLoad([]);
    setDumpOperations(prev => prev + 1);
  }, [strikeActive, getJointPositions, layout.hasTruck, toast]);

  // ── Mission flow handlers ──────────────────────────────────────────────────
  const handleNextMission = useCallback(() => {
    if (currentMissionIdx < missions.length - 1) {
      SoundManager.navigate();
      setCurrentMissionIdx(idx => idx + 1); // layout change triggers resetSite
    }
  }, [currentMissionIdx, missions.length]);

  const handleRevealHint = useCallback(() => setShowHint(true), []);

  // ── Final evaluation (debrief) ─────────────────────────────────────────────
  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmitted) return;

    const solvedCount = solvedIds.size;
    const efficiency = digOperations > 0 ? totalExcavated / digOperations : 0;
    const fillRate = bucketSize > 0 ? clampNum(efficiency / bucketSize, 0, 1) : 0;

    const score = Math.min(100, Math.round(
      60 * (solvedCount / missions.length) +
      (pipeStrikes === 0 ? 15 : Math.max(0, 15 - pipeStrikes * 5)) +
      (spilledUnits === 0 ? 10 : Math.max(0, 10 - spilledUnits)) +
      fillRate * 15
    ));

    const totalGoal = missions.reduce((sum, m) => sum + Math.max(1, Math.ceil(m.goalScoops * bucketSize)), 0);

    const metrics: ExcavatorArmSimulatorMetrics = {
      type: 'excavator-arm-simulator',
      targetAmount: totalGoal,
      excavatedAmount: totalExcavated,
      goalMet: solvedCount === missions.length,
      digOperations,
      dumpOperations,
      efficiency,
      boomAngleRange: Math.abs(maxBoomAngle - minBoomAngle),
      stickAngleRange: Math.abs(maxStickAngle - minStickAngle),
      bucketAngleRange: Math.abs(maxBucketAngle - minBucketAngle),
      finalBoomAngle: boomAngle,
      finalStickAngle: stickAngle,
      finalBucketAngle: bucketAngle,
      missionsSolved: solvedCount,
      missionsTotal: missions.length,
      pipeStrikes,
      spilledUnits,
    };

    submitResult(solvedCount >= Math.ceil(missions.length / 2), score, metrics, {
      studentWork: {
        missionsSolved: solvedCount,
        missionsTotal: missions.length,
        totalExcavated,
        digOperations,
        dumpOperations,
        pipeStrikes,
        spilledUnits,
        avgScoopFill: fillRate,
      },
    });
  }, [hasSubmitted, solvedIds.size, digOperations, totalExcavated, bucketSize, missions, pipeStrikes, spilledUnits, dumpOperations, maxBoomAngle, minBoomAngle, maxStickAngle, minStickAngle, maxBucketAngle, minBucketAngle, boomAngle, stickAngle, bucketAngle, submitResult]);

  const handleFullReset = useCallback(() => {
    setSolvedIds(new Set());
    setTotalExcavated(0);
    setDigOperations(0);
    setDumpOperations(0);
    setPipeStrikes(0);
    setSpilledUnits(0);
    setCurrentMissionIdx(0);
    resetSite(); // in case we're already on mission 0
    resetAttempt();
  }, [resetSite, resetAttempt]);

  // ── Animation + render loop (refs only; no re-renders) ─────────────────────
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = CANVAS_W;
      const H = CANVAS_H;
      const ba = boomAngleRef.current;
      const sa = stickAngleRef.current;
      const bka = bucketAngleRef.current;
      const hovered = hoveredJointRef.current;
      const dragging = draggingRef.current;
      const hs = heightsRef.current;
      const pos = getJointPositions();

      // Continuous pipe-strike detection against the bucket tip
      if (layout.pipe && !strikeLatchRef.current) {
        const p = layout.pipe;
        if (pos.bucketTip.x >= p.x0 && pos.bucketTip.x <= p.x1 && Math.abs(pos.bucketTip.y - p.y) < PIPE_STRIKE_DIST) {
          strikeLatchRef.current = true;
          strikeFlashRef.current = 45;
          SoundManager.playIncorrect();
          setPipeStrikes(prev => prev + 1);
          setStrikeActive(true);
        }
      }

      // Airborne particle physics (cosmetic — judgment happened at dump time)
      const airborne = airborneRef.current;
      for (let i = airborne.length - 1; i >= 0; i--) {
        const p = airborne[i];
        p.vy += 0.45;
        p.x += p.vx;
        p.y += p.vy;
        const inBedX = p.x >= BED_X0 + 6 && p.x <= BED_X0 + BED_W - 6;
        const bedFillH = layout.hasTruck && layout.goalUnits > 0
          ? Math.min(1, truckLoadRef.current / layout.goalUnits) * (BED_WALL_H - 12)
          : 0;
        if (p.towardTruck && inBedX && p.y >= BED_FLOOR_Y - bedFillH - 4) {
          airborne.splice(i, 1);
        } else if (p.y >= GROUND_Y - heightAt(p.x) - 1) {
          airborne.splice(i, 1);
        }
      }

      // ── Sky ──
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      skyGrad.addColorStop(0, '#1e3a5f');
      skyGrad.addColorStop(0.5, '#3b82a0');
      skyGrad.addColorStop(1, '#87CEEB');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      [[120, 60, 50], [350, 40, 35], [600, 80, 45], [750, 55, 30]].forEach(([cx, cy, r]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.8, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
        ctx.arc(cx - r * 0.6, cy + r * 0.1, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Terrain (heightfield polygon, layer bands clipped inside) ──
      const buildSurfacePath = () => {
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let i = 0; i < HF_SAMPLES; i++) {
          const x = (i / (HF_SAMPLES - 1)) * W;
          ctx.lineTo(x, GROUND_Y - hs[i]);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
      };

      ctx.save();
      buildSurfacePath();
      ctx.clip();

      const groundGrad = ctx.createLinearGradient(0, GROUND_Y - 60, 0, H);
      groundGrad.addColorStop(0, '#8B6914');
      groundGrad.addColorStop(0.4, '#7A5C12');
      groundGrad.addColorStop(1, '#5C4410');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 0, W, H);

      // Material layer bands (visible in crater walls — stratification)
      materialLayers.forEach((layer) => {
        ctx.fillStyle = layer.color;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, GROUND_Y + layer.depth, W, H - (GROUND_Y + layer.depth));
        ctx.globalAlpha = 1;
      });

      // Speckle texture
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (const sp of specklesRef.current) {
        ctx.fillRect(sp.x * W, GROUND_Y - 70 + sp.y * (H - GROUND_Y + 70), 2, 2);
      }
      ctx.restore();

      // Grass strip — only where terrain hasn't been dug away
      ctx.strokeStyle = '#4a7c3f';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      let grassOpen = false;
      ctx.beginPath();
      for (let i = 0; i < HF_SAMPLES; i++) {
        const x = (i / (HF_SAMPLES - 1)) * W;
        const y = GROUND_Y - hs[i];
        if (hs[i] > -5) {
          if (!grassOpen) { ctx.moveTo(x, y); grassOpen = true; }
          else ctx.lineTo(x, y);
        } else {
          grassOpen = false;
        }
      }
      ctx.stroke();

      // ── Dig zone highlight ──
      if (layout.digZone) {
        const z = layout.digZone;
        let top = GROUND_Y;
        for (let x = z.x0; x <= z.x1; x += 8) top = Math.min(top, GROUND_Y - heightAt(x));
        top -= 10;
        const zoneH = 92;
        const isPipeJob = !!layout.pipe;
        const zoneColor = isPipeJob ? '#F59E0B' : '#22C55E';

        ctx.fillStyle = isPipeJob ? 'rgba(245, 158, 11, 0.10)' : 'rgba(34, 197, 94, 0.10)';
        ctx.fillRect(z.x0, top, z.x1 - z.x0, zoneH);
        ctx.strokeStyle = zoneColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.strokeRect(z.x0, top, z.x1 - z.x0, zoneH);
        ctx.setLineDash([]);

        ctx.fillStyle = zoneColor;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isPipeJob ? '⚠ TRENCH — PIPE BELOW' : 'DIG ZONE', (z.x0 + z.x1) / 2, top - 8);
        ctx.textAlign = 'start';
      }

      // ── Buried pipe (visible hazard) ──
      if (layout.pipe) {
        const p = layout.pipe;
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x0, p.y);
        ctx.lineTo(p.x1, p.y);
        ctx.stroke();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 14]);
        ctx.beginPath();
        ctx.moveTo(p.x0 + 4, p.y);
        ctx.lineTo(p.x1 - 4, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('GAS', p.x0 + 6, p.y + 3.5);
      }

      // ── Truck ──
      if (layout.hasTruck) {
        const goal = layout.goalUnits;
        const load = truckLoadRef.current;

        // Wheels
        ctx.fillStyle = '#1a1a1a';
        [BED_X0 + 22, BED_X0 + BED_W - 22, BED_X0 + BED_W + 38].forEach(wx => {
          ctx.beginPath();
          ctx.arc(wx, GROUND_Y - 10, 11, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = '#555';
        [BED_X0 + 22, BED_X0 + BED_W - 22, BED_X0 + BED_W + 38].forEach(wx => {
          ctx.beginPath();
          ctx.arc(wx, GROUND_Y - 10, 5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Bed interior + fill pile
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fillRect(BED_X0 + 4, BED_TOP_Y, BED_W - 8, BED_WALL_H);
        if (load > 0 && goal > 0) {
          const fillH = Math.min(1, load / goal) * (BED_WALL_H - 12);
          ctx.fillStyle = '#8B6914';
          ctx.fillRect(BED_X0 + 8, BED_FLOOR_Y - fillH, BED_W - 16, fillH);
          ctx.fillStyle = '#A0791A';
          for (let bx = BED_X0 + 16; bx < BED_X0 + BED_W - 12; bx += 18) {
            ctx.beginPath();
            ctx.arc(bx, BED_FLOOR_Y - fillH, 6, Math.PI, 0);
            ctx.fill();
          }
        }

        // Bed walls + floor
        ctx.fillStyle = '#334155';
        ctx.fillRect(BED_X0, BED_TOP_Y, 6, BED_WALL_H + 4);
        ctx.fillRect(BED_X0 + BED_W - 6, BED_TOP_Y, 6, BED_WALL_H + 4);
        ctx.fillRect(BED_X0, BED_FLOOR_Y, BED_W, 7);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(BED_X0, BED_TOP_Y, BED_W, BED_WALL_H + 7);

        // Cab
        const cabX = BED_X0 + BED_W + 8;
        ctx.fillStyle = '#D97706';
        drawRoundedRect(ctx, cabX, BED_TOP_Y + 12, 50, BED_WALL_H - 5, 6);
        ctx.fill();
        ctx.fillStyle = '#a8d8f0';
        drawRoundedRect(ctx, cabX + 8, BED_TOP_Y + 18, 22, 18, 3);
        ctx.fill();

        // Load label
        ctx.fillStyle = load >= goal ? '#34D399' : '#FBBF24';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🚚 ${load} / ${goal}`, BED_X0 + BED_W / 2, BED_TOP_Y - 12);
        ctx.textAlign = 'start';
      }

      // ── Reach envelope ──
      if (layout.showReach) {
        const maxReach = boomLength + stickLength + BUCKET_SEG;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(pos.pivot.x, pos.pivot.y, maxReach, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Excavator ──
      {
        const baseNodeX = pos.pivot.x - 5;
        const baseNodeY = BASE_Y;

        const trackW = 70;
        const trackH = 20;
        const trackY = baseNodeY + 28;

        // Mud when the body is stuck
        if (layout.bodyLocked) {
          ctx.fillStyle = 'rgba(80, 55, 25, 0.85)';
          ctx.beginPath();
          ctx.ellipse(baseNodeX, trackY + trackH - 2, trackW * 0.8, 12, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        const bodyActive = hovered === 'body' || dragging === 'body';
        if (bodyActive) {
          ctx.save();
          ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
          ctx.shadowBlur = 18;
        }

        ctx.fillStyle = '#1a1a1a';
        drawRoundedRect(ctx, baseNodeX - trackW / 2, trackY, trackW, trackH, 8);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const lx = baseNodeX - trackW / 2 + 10 + i * 10;
          ctx.beginPath();
          ctx.moveTo(lx, trackY + 3);
          ctx.lineTo(lx, trackY + trackH - 3);
          ctx.stroke();
        }
        ctx.fillStyle = '#2a2a2a';
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        [baseNodeX - trackW / 2 + 10, baseNodeX + trackW / 2 - 10].forEach(wx => {
          ctx.beginPath();
          ctx.arc(wx, trackY + trackH / 2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Body
        const bodyW = 55;
        const bodyH = 30;
        const bodyGrad = ctx.createLinearGradient(0, baseNodeY, 0, baseNodeY + bodyH);
        bodyGrad.addColorStop(0, excavatorColor);
        bodyGrad.addColorStop(1, darkenColor(excavatorColor, 0.7));
        ctx.fillStyle = bodyGrad;
        drawRoundedRect(ctx, baseNodeX - bodyW / 2, baseNodeY, bodyW, bodyH, 5);
        ctx.fill();
        ctx.strokeStyle = darkenColor(excavatorColor, 0.5);
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, baseNodeX - bodyW / 2, baseNodeY, bodyW, bodyH, 5);
        ctx.stroke();
        ctx.fillStyle = darkenColor(excavatorColor, 0.6);
        ctx.fillRect(baseNodeX - bodyW / 2 + 4, baseNodeY + 6, 12, bodyH - 12);

        // Cab
        const cabW = 32;
        const cabH = 28;
        const cabX = baseNodeX - cabW / 2 + 5;
        const cabY = baseNodeY - cabH;
        const cabGrad = ctx.createLinearGradient(0, cabY, 0, cabY + cabH);
        cabGrad.addColorStop(0, excavatorColor);
        cabGrad.addColorStop(1, darkenColor(excavatorColor, 0.8));
        ctx.fillStyle = cabGrad;
        drawRoundedRect(ctx, cabX, cabY, cabW, cabH, 4);
        ctx.fill();
        ctx.strokeStyle = darkenColor(excavatorColor, 0.5);
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, cabX, cabY, cabW, cabH, 4);
        ctx.stroke();
        const winGrad = ctx.createLinearGradient(cabX + 4, cabY + 3, cabX + cabW - 6, cabY + cabH * 0.6);
        winGrad.addColorStop(0, '#a8d8f0');
        winGrad.addColorStop(1, '#6bb8e0');
        ctx.fillStyle = winGrad;
        drawRoundedRect(ctx, cabX + 4, cabY + 3, cabW - 8, cabH * 0.55, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(cabX + 6, cabY + 4, 4, cabH * 0.4);

        if (bodyActive) ctx.restore();

        if (layout.bodyLocked) {
          ctx.font = '15px sans-serif';
          ctx.fillText('🔒', baseNodeX + trackW / 2 + 4, trackY + 14);
        }

        // ── Arm segments ──
        const boomW = 12;
        ctx.lineCap = 'round';
        ctx.strokeStyle = darkenColor(excavatorColor, 0.6);
        ctx.lineWidth = boomW + 2;
        ctx.beginPath();
        ctx.moveTo(pos.pivot.x, pos.pivot.y);
        ctx.lineTo(pos.boomEnd.x, pos.boomEnd.y);
        ctx.stroke();
        ctx.strokeStyle = excavatorColor;
        ctx.lineWidth = boomW - 2;
        ctx.beginPath();
        ctx.moveTo(pos.pivot.x, pos.pivot.y);
        ctx.lineTo(pos.boomEnd.x, pos.boomEnd.y);
        ctx.stroke();

        // Boom hydraulic
        const boomMidX = (pos.pivot.x + pos.boomEnd.x) / 2;
        const boomMidY = (pos.pivot.y + pos.boomEnd.y) / 2;
        const boomDx = pos.boomEnd.x - pos.pivot.x;
        const boomDy = pos.boomEnd.y - pos.pivot.y;
        const boomLen = Math.sqrt(boomDx * boomDx + boomDy * boomDy) || 1;
        const boomNx = -boomDy / boomLen;
        const boomNy = boomDx / boomLen;
        ctx.strokeStyle = '#C0C0C0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pos.pivot.x + boomNx * 8, pos.pivot.y + boomNy * 8);
        ctx.lineTo(boomMidX + boomNx * 6, boomMidY + boomNy * 6);
        ctx.stroke();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(boomMidX + boomNx * 6, boomMidY + boomNy * 6);
        ctx.lineTo(pos.boomEnd.x + boomNx * 4, pos.boomEnd.y + boomNy * 4);
        ctx.stroke();

        // Stick
        const stickW = 10;
        ctx.strokeStyle = darkenColor(excavatorColor, 0.6);
        ctx.lineWidth = stickW + 2;
        ctx.beginPath();
        ctx.moveTo(pos.boomEnd.x, pos.boomEnd.y);
        ctx.lineTo(pos.stickEnd.x, pos.stickEnd.y);
        ctx.stroke();
        ctx.strokeStyle = layout.stickLockAngle !== null ? '#9CA3AF' : excavatorColor;
        ctx.lineWidth = stickW - 2;
        ctx.beginPath();
        ctx.moveTo(pos.boomEnd.x, pos.boomEnd.y);
        ctx.lineTo(pos.stickEnd.x, pos.stickEnd.y);
        ctx.stroke();

        // Bucket link
        ctx.strokeStyle = darkenColor(excavatorColor, 0.6);
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(pos.stickEnd.x, pos.stickEnd.y);
        ctx.lineTo(pos.bucketTip.x, pos.bucketTip.y);
        ctx.stroke();
        ctx.strokeStyle = excavatorColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(pos.stickEnd.x, pos.stickEnd.y);
        ctx.lineTo(pos.bucketTip.x, pos.bucketTip.y);
        ctx.stroke();

        // ── Bucket scoop ──
        const bucketRad = ((ba + sa + bka) * Math.PI) / 180;
        const scoopWidth = 30;
        const scoopDepth = 25;
        const tipX = pos.bucketTip.x;
        const tipY = pos.bucketTip.y;
        const perpX = Math.cos(bucketRad + Math.PI / 2);
        const perpY = -Math.sin(bucketRad + Math.PI / 2);
        const fwdX = Math.cos(bucketRad);
        const fwdY = -Math.sin(bucketRad);

        const p1x = tipX;
        const p1y = tipY;
        const p2x = tipX + perpX * scoopWidth;
        const p2y = tipY + perpY * scoopWidth;
        const p3x = p2x + fwdX * scoopDepth;
        const p3y = p2y + fwdY * scoopDepth;
        const p4x = p1x + fwdX * scoopDepth;
        const p4y = p1y + fwdY * scoopDepth;

        ctx.fillStyle = darkenColor(excavatorColor, 0.6);
        ctx.beginPath();
        ctx.moveTo(p3x, p3y);
        ctx.lineTo(p4x, p4y);
        ctx.lineTo(p4x + fwdX * 4, p4y + fwdY * 4);
        ctx.lineTo(p3x + fwdX * 4, p3y + fwdY * 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = excavatorColor;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.lineTo(p4x, p4y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = darkenColor(excavatorColor, 0.5);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Teeth
        ctx.fillStyle = '#9CA3AF';
        for (let t = 0; t < 4; t++) {
          const frac = (t + 0.5) / 4;
          const tx = p1x + (p2x - p1x) * frac;
          const ty = p1y + (p2y - p1y) * frac;
          ctx.beginPath();
          ctx.moveTo(tx - perpX * 2, ty - perpY * 2);
          ctx.lineTo(tx + fwdX * 6, ty + fwdY * 6);
          ctx.lineTo(tx + perpX * 3, ty + perpY * 3);
          ctx.closePath();
          ctx.fill();
        }

        // Bucket contents — drawn IN the scoop, travelling with it
        const load = bucketLoadRef.current;
        if (load.length > 0) {
          const centerX = (p1x + p3x) / 2;
          const centerY = (p1y + p3y) / 2;
          const fillFrac = load.length / Math.max(1, bucketSize);
          load.forEach((color, i) => {
            const a = (i * 137.5) % 360; // deterministic golden-angle scatter
            const rr = 3 + ((i * 53) % 7);
            const px = centerX + Math.cos((a * Math.PI) / 180) * rr;
            const py = centerY + Math.sin((a * Math.PI) / 180) * rr * 0.7 - fillFrac * 4;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // ── Joint pins (hover/drag glow; lock badge on jammed stick) ──
        const jointDefs: { target: DragTarget; jpos: { x: number; y: number }; r: number; locked: boolean }[] = [
          { target: 'boom', jpos: pos.pivot, r: 8, locked: false },
          { target: 'stick', jpos: pos.boomEnd, r: 7, locked: layout.stickLockAngle !== null },
          { target: 'bucket', jpos: pos.stickEnd, r: 6, locked: false },
        ];

        jointDefs.forEach(({ target, jpos, r, locked }) => {
          const isActive = dragging === target;
          const isHovered = hovered === target && !dragging;
          const glowRadius = isActive ? r + 8 : isHovered ? r + 5 : 0;

          if (glowRadius > 0 && !locked) {
            ctx.save();
            ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
            ctx.shadowBlur = isActive ? 20 : 12;
            ctx.strokeStyle = isActive ? '#F59E0B' : 'rgba(245, 158, 11, 0.6)';
            ctx.lineWidth = isActive ? 3 : 2;
            ctx.beginPath();
            ctx.arc(jpos.x, jpos.y, glowRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(jpos.x, jpos.y, r + 2, 0, Math.PI * 2);
          ctx.fill();
          const pinGrad = ctx.createRadialGradient(jpos.x - 1, jpos.y - 1, 0, jpos.x, jpos.y, r);
          if (locked) {
            pinGrad.addColorStop(0, '#7f8ea3');
            pinGrad.addColorStop(1, '#3f4a5a');
          } else {
            pinGrad.addColorStop(0, isActive ? '#FFD700' : isHovered ? '#BBA030' : '#888');
            pinGrad.addColorStop(1, isActive ? '#B8860B' : isHovered ? '#665520' : '#444');
          }
          ctx.fillStyle = pinGrad;
          ctx.beginPath();
          ctx.arc(jpos.x, jpos.y, r, 0, Math.PI * 2);
          ctx.fill();

          if (locked) {
            ctx.font = '13px sans-serif';
            ctx.fillText('🔒', jpos.x + r + 3, jpos.y - r + 2);
          }
        });

        // ── Live bite gauge — the depth-based scoop feedback ──
        const surface = GROUND_Y - heightAt(tipX);
        const depth = tipY - surface;
        if (depth > 2 && load.length < bucketSize) {
          const pct = Math.round(Math.min(1, depth / FULL_BITE_DEPTH) * 100);
          const gx = tipX + 14;
          const gy = tipY - 34;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          drawRoundedRect(ctx, gx, gy, 78, 20, 6);
          ctx.fill();
          ctx.fillStyle = pct >= 90 ? '#34D399' : pct >= 50 ? '#FBBF24' : '#F59E0B';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(`${pct}% bite`, gx + 8, gy + 14);

          // Disturbance ring at the tip
          ctx.strokeStyle = 'rgba(139, 105, 20, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tipX, surface, Math.min(16, depth * 0.6 + 6), Math.PI, 0);
          ctx.stroke();
        }
      }

      // ── Airborne particles ──
      airborneRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Angle HUD ──
      if (showAngles) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        drawRoundedRect(ctx, 8, 8, 140, 68, 6);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`Boom:   ${Math.round(ba)}°`, 16, 28);
        ctx.fillStyle = layout.stickLockAngle !== null ? '#94A3B8' : '#FB923C';
        ctx.fillText(`Stick:  ${Math.round(sa)}°${layout.stickLockAngle !== null ? ' 🔒' : ''}`, 16, 46);
        ctx.fillStyle = '#FBBF24';
        ctx.fillText(`Bucket: ${Math.round(bka)}°`, 16, 64);
      }

      // ── Interaction hint chip ──
      if (!dragging) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        drawRoundedRect(ctx, W - 232, 8, 224, 28, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          layout.bodyLocked ? 'Drag joints to move the arm (tracks stuck!)' : 'Drag joints to move arm, drag body to drive',
          W - 16,
          27,
        );
        ctx.textAlign = 'start';
      }

      // ── Toast ──
      if (toastRef.current.frames > 0) {
        toastRef.current.frames--;
        const alpha = Math.min(1, toastRef.current.frames / 30);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 14px sans-serif';
        const tw = ctx.measureText(toastRef.current.text).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        drawRoundedRect(ctx, W / 2 - tw / 2 - 16, H - 52, tw + 32, 32, 8);
        ctx.fill();
        ctx.fillStyle = '#FBBF24';
        ctx.textAlign = 'center';
        ctx.fillText(toastRef.current.text, W / 2, H - 31);
        ctx.textAlign = 'start';
        ctx.restore();
      }

      // ── Pipe-strike flash ──
      if (strikeFlashRef.current > 0) {
        strikeFlashRef.current--;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.28 * (strikeFlashRef.current / 45)})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [getJointPositions, heightAt, layout, boomLength, stickLength, bucketSize, materialLayers, excavatorColor, showAngles]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const goal = layout.goalUnits;
  const progressFrac = Math.min(1, missionProgress / goal);

  return (
    <div className={`w-full max-w-5xl mx-auto my-8 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center border border-amber-500/30 shadow-lg">
          <span className="text-2xl">🏗️</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-xs text-amber-400 font-mono uppercase tracking-wider">Dig Site — Job Board</p>
          </div>
        </div>
      </div>
      <p className="text-slate-300 text-sm mb-5">{description}</p>

      {/* ── Job briefing — the spine ── */}
      <LuminaPanel accent="orange" className="p-5 space-y-3 mb-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange" className="text-xs">
              Job {currentMissionIdx + 1} / {missions.length}
            </LuminaBadge>
            <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">{currentMission.badge}</span>
          </div>
          {currentSolved && (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">✓ Job done</span>
          )}
        </div>

        <div>
          <h4 className="text-white font-semibold text-base">{currentMission.title}</h4>
          <p className="text-slate-300 text-sm mt-1 leading-relaxed">{currentMission.brief}</p>
        </div>

        {/* Live goal — the geometry engine is the judge */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 font-mono">
              {currentMission.goalKind === 'truck' ? 'Truck load' : 'Dug from the zone'}
            </span>
            <span className={`font-mono ${progressFrac >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {missionProgress} / {goal} units
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${progressFrac >= 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${progressFrac * 100}%` }}
            />
          </div>
        </div>

        {/* Fuel gauge for the fuel-limited job */}
        {layout.maxDigs !== null && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-mono">Fuel:</span>
            {Array.from({ length: layout.maxDigs }, (_, i) => (
              <span key={i} className={`text-base ${i < layout.maxDigs! - digsUsed ? '' : 'opacity-20 grayscale'}`}>⛽</span>
            ))}
            <span className="text-slate-500 text-xs">({Math.max(0, layout.maxDigs - digsUsed)} digs left)</span>
          </div>
        )}

        {/* Pipe strike — site shutdown */}
        {strikeActive && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-2">
            <p className="text-red-300 text-sm font-medium">💥 You hit the gas pipe! The site is shut down.</p>
            <p className="text-slate-400 text-xs">Take shallower scoops and spread them out — never dig deep twice in the same spot.</p>
            <LuminaButton tone="danger" onClick={resetSite} className="w-full">
              Reset the Site &amp; Try Again
            </LuminaButton>
          </div>
        )}

        {/* Out of fuel */}
        {!strikeActive && outOfFuel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
            <p className="text-amber-300 text-sm font-medium">⛽ Out of fuel — and the truck isn&apos;t full yet.</p>
            <p className="text-slate-400 text-xs">Every scoop has to be a FULL one. Sink the bucket until the bite meter reads 100%, then dig.</p>
            <LuminaButton tone="subtle" onClick={resetSite} className="w-full">
              Refuel &amp; Restart the Job
            </LuminaButton>
          </div>
        )}

        {/* Hint — only on request */}
        {!currentSolved && !strikeActive && !outOfFuel && (
          showHint ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-amber-300 text-xs">💡 {currentMission.successHint}</p>
            </div>
          ) : (
            <button
              onClick={handleRevealHint}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <span>💡</span> Stuck? Get a hint
            </button>
          )
        )}

        {/* Solve card — the payoff: WHY it worked */}
        {showSolveCard && currentSolved && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
            <p className="text-emerald-300 text-sm font-medium">🎉 Job done!</p>
            <p className="text-slate-300 text-xs leading-relaxed">{currentMission.explainOnSolve}</p>
            {currentMissionIdx < missions.length - 1 && (
              <LuminaButton tone="primary" onClick={handleNextMission} className="w-full">
                Next Job →
              </LuminaButton>
            )}
          </div>
        )}
      </LuminaPanel>

      {/* ── Operator's Debrief — once every job is done ── */}
      {allMissionsSolved && (
        <LuminaPanel accent="emerald" className="p-5 space-y-4 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏆</span>
            <div>
              <h4 className="text-white font-semibold text-base">Operator&apos;s Debrief</h4>
              <p className="text-slate-400 text-xs mt-0.5">Every job on the board is done — here&apos;s your site record.</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center bg-slate-800/40 rounded-lg p-3">
              <p className="text-emerald-400 text-xl font-bold">{solvedIds.size}/{missions.length}</p>
              <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Jobs</p>
            </div>
            <div className="text-center bg-slate-800/40 rounded-lg p-3">
              <p className="text-amber-400 text-xl font-bold">
                {digOperations > 0 ? Math.round((totalExcavated / (digOperations * bucketSize)) * 100) : 0}%
              </p>
              <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Avg Scoop Fill</p>
            </div>
            <div className="text-center bg-slate-800/40 rounded-lg p-3">
              <p className={`text-xl font-bold ${pipeStrikes === 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pipeStrikes}</p>
              <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Pipe Strikes</p>
            </div>
            <div className="text-center bg-slate-800/40 rounded-lg p-3">
              <p className={`text-xl font-bold ${spilledUnits === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{spilledUnits}</p>
              <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Spilled</p>
            </div>
          </div>

          <div className="space-y-2">
            {missions.map((m, i) => (
              <div key={m.id} className="flex items-start gap-3 bg-slate-800/30 rounded-lg p-3">
                <span className="text-emerald-400 text-sm mt-0.5">✓</span>
                <div>
                  <p className="text-slate-200 text-sm font-medium">
                    {i + 1}. {m.title}
                    <span className="text-slate-500 font-normal"> · {m.badge}</span>
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{m.explainOnSolve}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-300 text-xs leading-relaxed">
              <span className="font-semibold">The big idea:</span> every job used the same machine — three
              simple rotating joints that combine into reach, precision, and power. Engineers call a chain of
              joints like this a <span className="font-semibold">kinematic chain</span> — and your own
              shoulder-elbow-wrist works exactly the same way.
            </p>
          </div>

          {data.instanceId && (
            !hasSubmitted ? (
              <LuminaButton tone="primary" onClick={handleSubmitEvaluation} className="w-full">
                Finish &amp; Submit
              </LuminaButton>
            ) : (
              <p className="text-emerald-400 text-sm text-center font-medium">Results submitted! 🏗️</p>
            )
          )}
        </LuminaPanel>
      )}

      {/* Interactive canvas — the bespoke interaction surface */}
      <div className="mb-4 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-800/40 backdrop-blur-sm">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full touch-none"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
        />
      </div>

      {/* Actuators */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleDig}
          disabled={strikeActive || bucketLoad.length >= bucketSize}
          className="flex-1 px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-amber-500/50 text-amber-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:shadow-none"
        >
          ⛏ Dig ({bucketLoad.length}/{bucketSize})
        </button>
        <button
          onClick={handleDump}
          disabled={strikeActive || bucketLoad.length === 0}
          className="flex-1 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-green-500/50 text-green-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:shadow-none"
        >
          ⬇ Dump
        </button>
      </div>

      {/* Site stats */}
      <div className="grid grid-cols-3 gap-3">
        <LuminaStat label="Total Excavated" value={totalExcavated} accent="amber" />
        <LuminaStat label="Digs" value={digOperations} accent="orange" />
        <LuminaStat label="Dumps" value={dumpOperations} accent="emerald" />
      </div>

      {/* Post-submit reset */}
      {hasSubmitted && (
        <div className="mt-4">
          <LuminaActionButton action="retry" onClick={handleFullReset} className="w-full">
            Start a Fresh Site
          </LuminaActionButton>
        </div>
      )}
    </div>
  );
};

export default ExcavatorArmSimulator;
