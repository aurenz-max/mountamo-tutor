'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type ExcavatorArmSimulatorMetrics,
} from '../../../evaluation';

/**
 * Excavator Arm Simulator - Interactive multi-jointed arm simulation
 *
 * K-5 Engineering Primitive for understanding:
 * - Cause and effect with joints (K-1)
 * - Reach and range exploration (1-2)
 * - Sequencing dig operations (2-3)
 * - Joint angle coordination (3-4)
 * - Reach envelope and efficiency (4-5)
 *
 * Real-world connections: excavators, construction equipment, hydraulics, robotics
 *
 * MOUSE INTERACTION:
 * - Click & drag joints (boom elbow, stick elbow, bucket wrist) to rotate arm segments
 * - Click & drag excavator body to move it left/right
 * - Click bucket tip near ground to dig, click when full near target to dump
 *
 * EVALUATION INTEGRATION:
 * - Tracks material excavated, operations completed, efficiency
 * - Submits evaluation metrics on challenge completion
 * - Uses Verlet integration for realistic physics simulation
 */

export interface MaterialLayer {
  type: string;           // e.g., "topsoil", "clay", "sand", "rock"
  color: string;          // Hex color
  depth: number;          // Depth from ground level (pixels)
  hardness: number;       // 1-10, affects digging difficulty
}

export interface TerrainPoint {
  x: number;              // X position
  height: number;         // Height of terrain at this x
}

export interface TargetZone {
  x: number;              // Center X position
  y: number;              // Center Y position
  width: number;          // Width of target zone
  height: number;         // Height of target zone
  label: string;          // Display label (e.g., "Dump Here")
}

export interface DiggingChallenge {
  description: string;    // What needs to be excavated
  targetX: number;        // X location to dig
  targetY: number;        // Y location to dig (depth)
  targetAmount: number;   // Amount of material to excavate
  materialType?: string;  // Specific material type (optional)
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
  targetZone?: TargetZone;        // Dump target location

  // Challenge
  challenge?: DiggingChallenge;   // Specific excavation task

  // Constraints
  minBoomAngle: number;         // Degrees (typically -30)
  maxBoomAngle: number;         // Degrees (typically 90)
  minStickAngle: number;        // Degrees (typically -120)
  maxStickAngle: number;        // Degrees (typically 30)
  minBucketAngle: number;       // Degrees (typically -90)
  maxBucketAngle: number;       // Degrees (typically 90)

  // Visual theme
  theme: 'realistic' | 'cartoon' | 'blueprint';
  excavatorColor: string;       // Color of the arm

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

// Verlet physics node for realistic arm movement
interface VerletNode {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  pinned: boolean;
}

// Material particle for excavated dirt/materials
interface MaterialParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  materialType: string;
}

// Draggable joint identifiers
type DragTarget = 'boom' | 'stick' | 'bucket' | 'body' | null;

const JOINT_HIT_RADIUS = 20; // px — how close you need to click to grab a joint

// Helper: darken a hex color
function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

// Helper to draw a rounded rect
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

// Distance between two points
function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
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
    targetZone,
    challenge,
    minBoomAngle = -30,
    maxBoomAngle = 90,
    minStickAngle = -120,
    maxStickAngle = 30,
    minBucketAngle = -90,
    maxBucketAngle = 90,
    excavatorColor = '#F59E0B',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Canvas setup
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize] = useState({ width: 800, height: 600 });

  // Arm joint angles (in degrees) — state for UI, refs for animation loop
  const [boomAngle, setBoomAngle] = useState(45);
  const [stickAngle, setStickAngle] = useState(-45);
  const [bucketAngle, setBucketAngle] = useState(0);
  const boomAngleRef = useRef(45);
  const stickAngleRef = useRef(-45);
  const bucketAngleRef = useRef(0);

  // Excavator base position — state for UI, ref for animation loop
  const [excavatorX, setExcavatorX] = useState(100);
  const excavatorXRef = useRef(100);

  // Mouse interaction state
  const draggingRef = useRef<DragTarget>(null);
  const hoveredJointRef = useRef<DragTarget>(null);
  const dragStartXRef = useRef(0);
  const dragStartExcavatorXRef = useRef(0);

  // Verlet nodes for realistic physics — ref only (never shown in JSX)
  const nodesRef = useRef<VerletNode[]>([]);

  // Excavation state
  const [bucketContents, setBucketContents] = useState<MaterialParticle[]>([]);
  const bucketContentsRef = useRef<MaterialParticle[]>([]);
  const [totalExcavated, setTotalExcavated] = useState(0);
  const [digOperations, setDigOperations] = useState(0);
  const [dumpOperations, setDumpOperations] = useState(0);

  // Terrain state (modified by digging)
  const [currentTerrain, setCurrentTerrain] = useState<TerrainPoint[]>(terrainProfile);
  const currentTerrainRef = useRef<TerrainPoint[]>(terrainProfile);

  // Animation
  const animationFrameRef = useRef<number>();

  // Pre-computed random speckle positions (stable across frames)
  const specklesRef = useRef<{ x: number; y: number }[]>(
    Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random() }))
  );

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<ExcavatorArmSimulatorMetrics>({
    primitiveType: 'excavator-arm-simulator',
    instanceId: instanceId || `excavator-arm-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Initialize Verlet nodes for the arm
  useEffect(() => {
    const baseX = excavatorXRef.current;
    const baseY = canvasSize.height - 150;

    nodesRef.current = [
      { x: baseX, y: baseY, oldX: baseX, oldY: baseY, pinned: true },
      { x: baseX + boomLength, y: baseY, oldX: baseX + boomLength, oldY: baseY, pinned: false },
      { x: baseX + boomLength + stickLength, y: baseY, oldX: baseX + boomLength + stickLength, oldY: baseY, pinned: false },
      { x: baseX + boomLength + stickLength + 30, y: baseY, oldX: baseX + boomLength + stickLength + 30, oldY: baseY, pinned: false },
    ];
  }, [boomLength, stickLength, canvasSize.height]);

  // Compute joint positions from angles (used by both rendering and mouse interaction)
  const getJointPositions = useCallback(() => {
    const exX = excavatorXRef.current;
    const baseY = canvasSize.height - 150;
    const armPivotX = exX + 5;
    const armPivotY = baseY + 2;

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

    const bucketTipX = stickEndX + Math.cos(bucketRad) * 30;
    const bucketTipY = stickEndY - Math.sin(bucketRad) * 30;

    return {
      pivot: { x: armPivotX, y: armPivotY },
      boomEnd: { x: boomEndX, y: boomEndY },
      stickEnd: { x: stickEndX, y: stickEndY },
      bucketTip: { x: bucketTipX, y: bucketTipY },
      bodyCenter: { x: exX, y: baseY + 15 },
    };
  }, [boomLength, stickLength, canvasSize.height]);

  // Convert canvas mouse event to canvas-space coordinates
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasSize.width / rect.width;
    const scaleY = canvasSize.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [canvasSize]);

  // Detect which joint the mouse is near
  const hitTest = useCallback((mx: number, my: number): DragTarget => {
    const pos = getJointPositions();

    // Check bucket wrist first (smallest, hardest to grab)
    if (dist(mx, my, pos.stickEnd.x, pos.stickEnd.y) < JOINT_HIT_RADIUS) return 'bucket';
    // Boom-stick elbow
    if (dist(mx, my, pos.boomEnd.x, pos.boomEnd.y) < JOINT_HIT_RADIUS) return 'stick';
    // Boom pivot
    if (dist(mx, my, pos.pivot.x, pos.pivot.y) < JOINT_HIT_RADIUS) return 'boom';
    // Excavator body
    const bx = pos.bodyCenter.x;
    const by = pos.bodyCenter.y;
    if (mx > bx - 40 && mx < bx + 40 && my > by - 30 && my < by + 40) return 'body';

    return null;
  }, [getJointPositions]);

  // Handle angle changes with constraints — update both state and ref
  const handleBoomAngleChange = useCallback((value: number) => {
    const clamped = Math.max(minBoomAngle, Math.min(maxBoomAngle, value));
    setBoomAngle(clamped);
    boomAngleRef.current = clamped;
  }, [minBoomAngle, maxBoomAngle]);

  const handleStickAngleChange = useCallback((value: number) => {
    const clamped = Math.max(minStickAngle, Math.min(maxStickAngle, value));
    setStickAngle(clamped);
    stickAngleRef.current = clamped;
  }, [minStickAngle, maxStickAngle]);

  const handleBucketAngleChange = useCallback((value: number) => {
    const clamped = Math.max(minBucketAngle, Math.min(maxBucketAngle, value));
    setBucketAngle(clamped);
    bucketAngleRef.current = clamped;
  }, [minBucketAngle, maxBucketAngle]);

  const handleExcavatorMove = useCallback((newX: number) => {
    const clamped = Math.max(80, Math.min(canvasSize.width - 80, newX));
    setExcavatorX(clamped);
    excavatorXRef.current = clamped;
  }, [canvasSize.width]);

  // --- Mouse event handlers for canvas ---
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
      // Just update hover state for visual feedback
      hoveredJointRef.current = hitTest(x, y);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = hoveredJointRef.current ? 'grab' : 'default';
      }
      return;
    }

    // Active drag
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grabbing';

    if (target === 'body') {
      const dx = x - dragStartXRef.current;
      handleExcavatorMove(dragStartExcavatorXRef.current + dx);
      return;
    }

    const pos = getJointPositions();

    if (target === 'boom') {
      // Angle from pivot to mouse
      const dx = x - pos.pivot.x;
      const dy = -(y - pos.pivot.y); // flip y for standard math coords
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      handleBoomAngleChange(angle);
    } else if (target === 'stick') {
      // Angle from boom end to mouse, relative to boom angle
      const dx = x - pos.boomEnd.x;
      const dy = -(y - pos.boomEnd.y);
      const absAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const relAngle = absAngle - boomAngleRef.current;
      handleStickAngleChange(relAngle);
    } else if (target === 'bucket') {
      // Angle from stick end to mouse, relative to boom+stick
      const dx = x - pos.stickEnd.x;
      const dy = -(y - pos.stickEnd.y);
      const absAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const relAngle = absAngle - boomAngleRef.current - stickAngleRef.current;
      handleBucketAngleChange(relAngle);
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

  // Animation loop — reads from refs, never triggers React re-renders
  useEffect(() => {
    const updateNodePositions = () => {
      const nodes = nodesRef.current;
      if (nodes.length === 0) return;

      const exX = excavatorXRef.current;
      const baseY = canvasSize.height - 150;
      const ba = boomAngleRef.current;
      const sa = stickAngleRef.current;
      const bka = bucketAngleRef.current;

      const boomRad = (ba * Math.PI) / 180;
      const stickRad = ((ba + sa) * Math.PI) / 180;
      const bucketRad = ((ba + sa + bka) * Math.PI) / 180;

      const armPivotX = exX + 5;
      const armPivotY = baseY + 2;

      const boomEndX = armPivotX + Math.cos(boomRad) * boomLength;
      const boomEndY = armPivotY - Math.sin(boomRad) * boomLength;

      const stickEndX = boomEndX + Math.cos(stickRad) * stickLength;
      const stickEndY = boomEndY - Math.sin(stickRad) * stickLength;

      const bucketTipX = stickEndX + Math.cos(bucketRad) * 30;
      const bucketTipY = stickEndY - Math.sin(bucketRad) * 30;

      const damping = 0.95;

      // Mutate nodes directly — no setState
      nodes[0].x = armPivotX;
      nodes[0].y = armPivotY;
      nodes[0].oldX = armPivotX;
      nodes[0].oldY = armPivotY;

      if (!nodes[1].pinned) {
        const vx = (nodes[1].x - nodes[1].oldX) * damping;
        const vy = (nodes[1].y - nodes[1].oldY) * damping;
        nodes[1].oldX = nodes[1].x;
        nodes[1].oldY = nodes[1].y;
        nodes[1].x = boomEndX + vx * 0.1;
        nodes[1].y = boomEndY + vy * 0.1;
      }

      if (!nodes[2].pinned) {
        const vx = (nodes[2].x - nodes[2].oldX) * damping;
        const vy = (nodes[2].y - nodes[2].oldY) * damping;
        nodes[2].oldX = nodes[2].x;
        nodes[2].oldY = nodes[2].y;
        nodes[2].x = stickEndX + vx * 0.1;
        nodes[2].y = stickEndY + vy * 0.1;
      }

      if (!nodes[3].pinned) {
        const vx = (nodes[3].x - nodes[3].oldX) * damping;
        const vy = (nodes[3].y - nodes[3].oldY) * damping;
        nodes[3].oldX = nodes[3].x;
        nodes[3].oldY = nodes[3].y;
        nodes[3].x = bucketTipX + vx * 0.1;
        nodes[3].y = bucketTipY + vy * 0.1;
      }
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const nodes = nodesRef.current;
      const ba = boomAngleRef.current;
      const sa = stickAngleRef.current;
      const bka = bucketAngleRef.current;
      const terrain = currentTerrainRef.current;
      const contents = bucketContentsRef.current;
      const hovered = hoveredJointRef.current;
      const dragging = draggingRef.current;

      const W = canvasSize.width;
      const H = canvasSize.height;

      // --- Sky gradient ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      skyGrad.addColorStop(0, '#1e3a5f');
      skyGrad.addColorStop(0.5, '#3b82a0');
      skyGrad.addColorStop(1, '#87CEEB');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      [[120, 60, 50], [350, 40, 35], [600, 80, 45], [750, 55, 30]].forEach(([cx, cy, r]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.8, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
        ctx.arc(cx - r * 0.6, cy + r * 0.1, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Ground ---
      const groundY = H - 100;

      // Dirt gradient
      const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
      groundGrad.addColorStop(0, '#8B6914');
      groundGrad.addColorStop(0.3, '#7A5C12');
      groundGrad.addColorStop(1, '#5C4410');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, groundY, W, H - groundY);

      // Top grass strip
      ctx.fillStyle = '#4a7c3f';
      ctx.fillRect(0, groundY, W, 6);
      ctx.fillStyle = '#5a9c4a';
      ctx.fillRect(0, groundY, W, 3);

      // Material layers
      materialLayers.forEach((layer) => {
        ctx.fillStyle = layer.color;
        const layerY = groundY + layer.depth;
        ctx.fillRect(0, layerY, W, H - layerY);
      });

      // Terrain profile
      if (terrain.length > 0) {
        ctx.fillStyle = '#6B5B47';
        ctx.beginPath();
        ctx.moveTo(0, H);
        terrain.forEach(point => {
          ctx.lineTo(point.x, groundY - point.height);
        });
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      }

      // Dirt texture speckles — pre-computed positions
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (const sp of specklesRef.current) {
        const sx = sp.x * W;
        const sy = groundY + 8 + sp.y * (H - groundY - 8);
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Small rocks on surface
      ctx.fillStyle = '#9E8E7E';
      [[80, groundY + 2], [220, groundY + 1], [500, groundY + 3], [650, groundY + 2]].forEach(([rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(rx, ry, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Target zone ---
      if (targetZone) {
        const tzX = targetZone.x - targetZone.width / 2;
        const tzY = targetZone.y - targetZone.height / 2;

        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fillRect(tzX - 4, tzY - 4, targetZone.width + 8, targetZone.height + 8);

        ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
        ctx.fillRect(tzX, tzY, targetZone.width, targetZone.height);

        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(tzX, tzY, targetZone.width, targetZone.height);
        ctx.setLineDash([]);

        const arrowX = targetZone.x;
        const arrowY = tzY - 20;
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY + 12);
        ctx.lineTo(arrowX - 6, arrowY);
        ctx.lineTo(arrowX + 6, arrowY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#22C55E';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(targetZone.label, targetZone.x, tzY - 24);
        ctx.textAlign = 'start';
      }

      // --- Reach envelope ---
      if (showReach && nodes.length > 0) {
        const baseNodeX = nodes[0].x;
        const baseNodeY = nodes[0].y;
        const maxReach = boomLength + stickLength + 30;

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(baseNodeX, baseNodeY, maxReach, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // --- Excavator ---
      if (nodes.length >= 4) {
        const baseNodeX = nodes[0].x;
        const baseNodeY = nodes[0].y;

        // --- Tracks ---
        const trackW = 70;
        const trackH = 20;
        const trackY = baseNodeY + 28;

        // Body highlight when hovered/dragged
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

        // --- Main body ---
        const bodyW = 55;
        const bodyH = 30;
        const bodyDrawY = baseNodeY;

        const bodyGrad = ctx.createLinearGradient(0, bodyDrawY, 0, bodyDrawY + bodyH);
        bodyGrad.addColorStop(0, excavatorColor);
        bodyGrad.addColorStop(1, darkenColor(excavatorColor, 0.7));
        ctx.fillStyle = bodyGrad;
        drawRoundedRect(ctx, baseNodeX - bodyW / 2, bodyDrawY, bodyW, bodyH, 5);
        ctx.fill();

        ctx.strokeStyle = darkenColor(excavatorColor, 0.5);
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, baseNodeX - bodyW / 2, bodyDrawY, bodyW, bodyH, 5);
        ctx.stroke();

        ctx.fillStyle = darkenColor(excavatorColor, 0.6);
        ctx.fillRect(baseNodeX - bodyW / 2 + 4, bodyDrawY + 6, 12, bodyH - 12);

        // --- Cab ---
        const cabW = 32;
        const cabH = 28;
        const cabX = baseNodeX - cabW / 2 + 5;
        const cabY = bodyDrawY - cabH;

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

        // --- ARM SEGMENTS ---
        const armPivotX = baseNodeX;
        const armPivotY = baseNodeY + 2;

        // Boom segment
        const boomW = 12;
        ctx.strokeStyle = excavatorColor;
        ctx.lineWidth = boomW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(armPivotX, armPivotY);
        ctx.lineTo(nodes[1].x, nodes[1].y);
        ctx.stroke();

        ctx.strokeStyle = darkenColor(excavatorColor, 0.6);
        ctx.lineWidth = boomW + 2;
        ctx.beginPath();
        ctx.moveTo(armPivotX, armPivotY);
        ctx.lineTo(nodes[1].x, nodes[1].y);
        ctx.stroke();

        ctx.strokeStyle = excavatorColor;
        ctx.lineWidth = boomW - 2;
        ctx.beginPath();
        ctx.moveTo(armPivotX, armPivotY);
        ctx.lineTo(nodes[1].x, nodes[1].y);
        ctx.stroke();

        // Hydraulic cylinder on boom
        const boomMidX = (armPivotX + nodes[1].x) / 2;
        const boomMidY = (armPivotY + nodes[1].y) / 2;
        const boomDx = nodes[1].x - armPivotX;
        const boomDy = nodes[1].y - armPivotY;
        const boomLen = Math.sqrt(boomDx * boomDx + boomDy * boomDy);
        const boomNx = -boomDy / boomLen;
        const boomNy = boomDx / boomLen;
        ctx.strokeStyle = '#C0C0C0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(armPivotX + boomNx * 8, armPivotY + boomNy * 8);
        ctx.lineTo(boomMidX + boomNx * 6, boomMidY + boomNy * 6);
        ctx.stroke();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(boomMidX + boomNx * 6, boomMidY + boomNy * 6);
        ctx.lineTo(nodes[1].x + boomNx * 4, nodes[1].y + boomNy * 4);
        ctx.stroke();

        // Stick segment
        const stickW = 10;
        ctx.strokeStyle = darkenColor(excavatorColor, 0.6);
        ctx.lineWidth = stickW + 2;
        ctx.beginPath();
        ctx.moveTo(nodes[1].x, nodes[1].y);
        ctx.lineTo(nodes[2].x, nodes[2].y);
        ctx.stroke();

        ctx.strokeStyle = excavatorColor;
        ctx.lineWidth = stickW - 2;
        ctx.beginPath();
        ctx.moveTo(nodes[1].x, nodes[1].y);
        ctx.lineTo(nodes[2].x, nodes[2].y);
        ctx.stroke();

        // Hydraulic on stick
        const stickMidX = (nodes[1].x + nodes[2].x) / 2;
        const stickMidY = (nodes[1].y + nodes[2].y) / 2;
        const stickDx = nodes[2].x - nodes[1].x;
        const stickDy = nodes[2].y - nodes[1].y;
        const stickLen = Math.sqrt(stickDx * stickDx + stickDy * stickDy);
        const stickNx = -stickDy / stickLen;
        const stickNy = stickDx / stickLen;
        ctx.strokeStyle = '#C0C0C0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(nodes[1].x + stickNx * 7, nodes[1].y + stickNy * 7);
        ctx.lineTo(stickMidX + stickNx * 5, stickMidY + stickNy * 5);
        ctx.stroke();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(stickMidX + stickNx * 5, stickMidY + stickNy * 5);
        ctx.lineTo(nodes[2].x + stickNx * 3, nodes[2].y + stickNy * 3);
        ctx.stroke();

        // Bucket link
        ctx.strokeStyle = darkenColor(excavatorColor, 0.6);
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(nodes[2].x, nodes[2].y);
        ctx.lineTo(nodes[3].x, nodes[3].y);
        ctx.stroke();

        ctx.strokeStyle = excavatorColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(nodes[2].x, nodes[2].y);
        ctx.lineTo(nodes[3].x, nodes[3].y);
        ctx.stroke();

        // --- Bucket scoop ---
        const bucketRad = ((ba + sa + bka) * Math.PI) / 180;
        const scoopWidth = 30;
        const scoopDepth = 25;

        const tipX = nodes[3].x;
        const tipY = nodes[3].y;

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

        // Teeth on bucket edge
        ctx.fillStyle = '#9CA3AF';
        const teethCount = 4;
        for (let t = 0; t < teethCount; t++) {
          const frac = (t + 0.5) / teethCount;
          const tx = p1x + (p2x - p1x) * frac;
          const ty = p1y + (p2y - p1y) * frac;
          ctx.beginPath();
          ctx.moveTo(tx - perpX * 2, ty - perpY * 2);
          ctx.lineTo(tx + fwdX * 6, ty + fwdY * 6);
          ctx.lineTo(tx + perpX * 3, ty + perpY * 3);
          ctx.closePath();
          ctx.fill();
        }

        // --- Interactive Joint indicators ---
        // Draw joints with hover/drag glow
        const jointDefs: { target: DragTarget; pos: { x: number; y: number }; r: number }[] = [
          { target: 'boom', pos: { x: armPivotX, y: armPivotY }, r: 8 },
          { target: 'stick', pos: nodes[1], r: 7 },
          { target: 'bucket', pos: nodes[2], r: 6 },
        ];

        jointDefs.forEach(({ target, pos, r }) => {
          const isActive = dragging === target;
          const isHovered = hovered === target && !dragging;
          const glowRadius = isActive ? r + 8 : isHovered ? r + 5 : 0;

          // Glow ring
          if (glowRadius > 0) {
            ctx.save();
            ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
            ctx.shadowBlur = isActive ? 20 : 12;
            ctx.strokeStyle = isActive ? '#F59E0B' : 'rgba(245, 158, 11, 0.6)';
            ctx.lineWidth = isActive ? 3 : 2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Joint pin
          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r + 2, 0, Math.PI * 2);
          ctx.fill();
          const pinGrad = ctx.createRadialGradient(pos.x - 1, pos.y - 1, 0, pos.x, pos.y, r);
          pinGrad.addColorStop(0, isActive ? '#FFD700' : isHovered ? '#BBA030' : '#888');
          pinGrad.addColorStop(1, isActive ? '#B8860B' : isHovered ? '#665520' : '#444');
          ctx.fillStyle = pinGrad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(pos.x - r * 0.3, pos.y - r * 0.3, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        });

        // Material particles in bucket
        contents.forEach(particle => {
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = darkenColor(particle.color, 0.7);
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });
      }

      // Angle indicators (HUD-style)
      if (showAngles && nodes.length >= 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        drawRoundedRect(ctx, 8, 8, 140, 68, 6);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`Boom:   ${Math.round(ba)}°`, 16, 28);
        ctx.fillStyle = '#FB923C';
        ctx.fillText(`Stick:  ${Math.round(sa)}°`, 16, 46);
        ctx.fillStyle = '#FBBF24';
        ctx.fillText(`Bucket: ${Math.round(bka)}°`, 16, 64);
      }

      // Interaction hint (show briefly or when no drag has happened yet)
      if (!dragging && nodes.length >= 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        drawRoundedRect(ctx, W - 220, 8, 212, 28, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Drag joints to move arm, drag body to slide', W - 16, 27);
        ctx.textAlign = 'start';
      }
    };

    const animate = () => {
      updateNodePositions();
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasSize, excavatorColor, showAngles, showReach, boomLength, stickLength, materialLayers, targetZone]);

  // Dig operation
  const handleDig = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length < 4) return;
    if (bucketContentsRef.current.length >= bucketSize) return;

    const bucketX = nodes[3].x;
    const bucketY = nodes[3].y;
    const groundY = canvasSize.height - 100;

    if (bucketY < groundY) return;

    let materialType = 'dirt';
    let materialColor = '#8B7355';
    let hardness = 1;

    for (const layer of materialLayers) {
      const layerY = groundY + layer.depth;
      if (bucketY >= layerY) {
        materialType = layer.type;
        materialColor = layer.color;
        hardness = layer.hardness;
      }
    }

    const amountExcavated = Math.min(bucketSize - bucketContentsRef.current.length, Math.ceil(3 / hardness));

    const newParticles: MaterialParticle[] = [];
    for (let i = 0; i < amountExcavated; i++) {
      newParticles.push({
        x: bucketX + (Math.random() - 0.5) * 20,
        y: bucketY + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        color: materialColor,
        materialType,
      });
    }

    setBucketContents(prev => {
      const next = [...prev, ...newParticles];
      bucketContentsRef.current = next;
      return next;
    });
    setTotalExcavated(prev => prev + amountExcavated);
    setDigOperations(prev => prev + 1);

    setCurrentTerrain(prev => {
      const updated = [...prev];
      const terrainIndex = Math.floor((bucketX / canvasSize.width) * updated.length);
      if (terrainIndex >= 0 && terrainIndex < updated.length) {
        updated[terrainIndex] = {
          ...updated[terrainIndex],
          height: Math.max(0, updated[terrainIndex].height - amountExcavated * 2),
        };
      }
      currentTerrainRef.current = updated;
      return updated;
    });
  }, [bucketSize, canvasSize.height, canvasSize.width, materialLayers]);

  // Dump operation
  const handleDump = useCallback(() => {
    if (bucketContentsRef.current.length === 0) return;

    const nodes = nodesRef.current;
    if (targetZone && nodes.length >= 4) {
      const bucketX = nodes[3].x;
      const bucketY = nodes[3].y;

      const inTargetX = Math.abs(bucketX - targetZone.x) < targetZone.width / 2;
      const inTargetY = Math.abs(bucketY - targetZone.y) < targetZone.height / 2;

      if (inTargetX && inTargetY) {
        setDumpOperations(prev => prev + 1);
      }
    }

    setBucketContents([]);
    bucketContentsRef.current = [];
  }, [targetZone]);

  // Submit evaluation
  const handleSubmit = () => {
    if (hasSubmitted) return;

    let success = true;
    let score = 100;

    if (challenge) {
      const excavatedEnough = totalExcavated >= challenge.targetAmount;
      const dumpedInTarget = targetZone ? dumpOperations > 0 : true;

      success = excavatedEnough && dumpedInTarget;
      score = Math.min(100, (totalExcavated / challenge.targetAmount) * 100);
    }

    const efficiency = digOperations > 0 ? totalExcavated / digOperations : 0;

    const metrics: ExcavatorArmSimulatorMetrics = {
      type: 'excavator-arm-simulator',
      targetAmount: challenge?.targetAmount || 0,
      excavatedAmount: totalExcavated,
      goalMet: success,
      digOperations,
      dumpOperations,
      efficiency,
      boomAngleRange: Math.abs(maxBoomAngle - minBoomAngle),
      stickAngleRange: Math.abs(maxStickAngle - minStickAngle),
      bucketAngleRange: Math.abs(maxBucketAngle - minBucketAngle),
      finalBoomAngle: boomAngle,
      finalStickAngle: stickAngle,
      finalBucketAngle: bucketAngle,
    };

    submitResult(success, score, metrics, {
      studentWork: {
        totalExcavated,
        digOperations,
        dumpOperations,
        finalAngles: { boom: boomAngle, stick: stickAngle, bucket: bucketAngle },
      },
    });
  };

  const handleReset = () => {
    setBoomAngle(45);
    setStickAngle(-45);
    setBucketAngle(0);
    setExcavatorX(100);
    boomAngleRef.current = 45;
    stickAngleRef.current = -45;
    bucketAngleRef.current = 0;
    excavatorXRef.current = 100;
    setBucketContents([]);
    bucketContentsRef.current = [];
    setTotalExcavated(0);
    setDigOperations(0);
    setDumpOperations(0);
    setCurrentTerrain(terrainProfile);
    currentTerrainRef.current = terrainProfile;
    resetAttempt();
  };

  return (
    <div className={`w-full max-w-7xl mx-auto my-8 animate-fade-in ${className || ''}`}>
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-300">{description}</p>

        {challenge && (
          <div className="mt-3 p-4 bg-blue-500/15 border border-blue-500/40 rounded-xl backdrop-blur-sm">
            <p className="text-blue-200 text-sm">
              <strong>Challenge:</strong> {challenge.description}
            </p>
            <p className="text-blue-300 text-xs mt-1">
              Target: {challenge.targetAmount} units of material
            </p>
          </div>
        )}
      </div>

      {/* Interactive Canvas — primary control surface */}
      <div className="mb-6 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-800/40 backdrop-blur-sm">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full touch-none"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleDig}
          disabled={bucketContents.length >= bucketSize}
          className="flex-1 px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-amber-500/50 text-amber-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:shadow-none"
        >
          Dig ({bucketContents.length}/{bucketSize})
        </button>
        <button
          onClick={handleDump}
          disabled={bucketContents.length === 0}
          className="flex-1 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-green-500/50 text-green-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:shadow-none"
        >
          Dump
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 text-center">
          <div className="text-2xl font-bold text-amber-400">{totalExcavated}</div>
          <div className="text-xs text-slate-400">Total Excavated</div>
        </div>
        <div className="p-3 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 text-center">
          <div className="text-2xl font-bold text-orange-400">{digOperations}</div>
          <div className="text-xs text-slate-400">Digs</div>
        </div>
        <div className="p-3 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 text-center">
          <div className="text-2xl font-bold text-green-400">{dumpOperations}</div>
          <div className="text-xs text-slate-400">Dumps</div>
        </div>
      </div>

      {/* Evaluation Controls */}
      {data.instanceId && (
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={hasSubmitted}
            className="flex-1 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-blue-500/50 text-blue-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:shadow-none"
          >
            {hasSubmitted ? 'Submitted' : 'Submit Work'}
          </button>
          {hasSubmitted && (
            <button
              onClick={handleReset}
              className="px-4 py-3 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExcavatorArmSimulator;
