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

const ExcavatorArmSimulator: React.FC<ExcavatorArmSimulatorProps> = ({ data, className }) => {
  const {
    title,
    description,
    boomLength = 100,
    stickLength = 80,
    bucketSize = 10,
    jointControl = 'sliders',
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
    theme = 'realistic',
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

  // Arm joint angles (in degrees)
  const [boomAngle, setBoomAngle] = useState(45);
  const [stickAngle, setStickAngle] = useState(-45);
  const [bucketAngle, setBucketAngle] = useState(0);

  // Excavator base position
  const [excavatorX, setExcavatorX] = useState(100);

  // Verlet nodes for realistic physics
  const [nodes, setNodes] = useState<VerletNode[]>([]);

  // Excavation state
  const [bucketContents, setBucketContents] = useState<MaterialParticle[]>([]);
  const [totalExcavated, setTotalExcavated] = useState(0);
  const [digOperations, setDigOperations] = useState(0);
  const [dumpOperations, setDumpOperations] = useState(0);

  // Terrain state (modified by digging)
  const [currentTerrain, setCurrentTerrain] = useState<TerrainPoint[]>(terrainProfile);

  // Animation
  const animationFrameRef = useRef<number>();
  const [isDragging, setIsDragging] = useState<number | null>(null); // Which joint is being dragged

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
    isEvaluationEnabled,
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
    const baseX = excavatorX;
    const baseY = canvasSize.height - 150;

    // Create nodes: base, boom end, stick end, bucket tip
    const initialNodes: VerletNode[] = [
      { x: baseX, y: baseY, oldX: baseX, oldY: baseY, pinned: true }, // Base (pinned)
      { x: baseX + boomLength, y: baseY, oldX: baseX + boomLength, oldY: baseY, pinned: false }, // Boom end
      { x: baseX + boomLength + stickLength, y: baseY, oldX: baseX + boomLength + stickLength, oldY: baseY, pinned: false }, // Stick end
      { x: baseX + boomLength + stickLength + 30, y: baseY, oldX: baseX + boomLength + stickLength + 30, oldY: baseY, pinned: false }, // Bucket tip
    ];

    setNodes(initialNodes);
  }, [boomLength, stickLength, canvasSize.height, excavatorX]);

  // Update Verlet positions based on joint angles
  const updateNodePositions = useCallback(() => {
    if (nodes.length === 0) return;

    const baseX = excavatorX;
    const baseY = canvasSize.height - 150;

    // Convert angles to radians
    const boomRad = (boomAngle * Math.PI) / 180;
    const stickRad = ((boomAngle + stickAngle) * Math.PI) / 180;
    const bucketRad = ((boomAngle + stickAngle + bucketAngle) * Math.PI) / 180;

    // Calculate positions using forward kinematics
    const boomEndX = baseX + Math.cos(boomRad) * boomLength;
    const boomEndY = baseY - Math.sin(boomRad) * boomLength;

    const stickEndX = boomEndX + Math.cos(stickRad) * stickLength;
    const stickEndY = boomEndY - Math.sin(stickRad) * stickLength;

    const bucketTipX = stickEndX + Math.cos(bucketRad) * 30; // Bucket length is 30px
    const bucketTipY = stickEndY - Math.sin(bucketRad) * 30;

    // Update nodes with Verlet integration (simple damping)
    const damping = 0.95;

    setNodes(prev => {
      const updated = [...prev];

      // Update base position
      updated[0].x = baseX;
      updated[0].oldX = baseX;

      // Boom end (node 1)
      if (!updated[1].pinned) {
        const vx = (updated[1].x - updated[1].oldX) * damping;
        const vy = (updated[1].y - updated[1].oldY) * damping;
        updated[1].oldX = updated[1].x;
        updated[1].oldY = updated[1].y;
        updated[1].x = boomEndX + vx * 0.1;
        updated[1].y = boomEndY + vy * 0.1;
      }

      // Stick end (node 2)
      if (!updated[2].pinned) {
        const vx = (updated[2].x - updated[2].oldX) * damping;
        const vy = (updated[2].y - updated[2].oldY) * damping;
        updated[2].oldX = updated[2].x;
        updated[2].oldY = updated[2].y;
        updated[2].x = stickEndX + vx * 0.1;
        updated[2].y = stickEndY + vy * 0.1;
      }

      // Bucket tip (node 3)
      if (!updated[3].pinned) {
        const vx = (updated[3].x - updated[3].oldX) * damping;
        const vy = (updated[3].y - updated[3].oldY) * damping;
        updated[3].oldX = updated[3].x;
        updated[3].oldY = updated[3].y;
        updated[3].x = bucketTipX + vx * 0.1;
        updated[3].y = bucketTipY + vy * 0.1;
      }

      return updated;
    });
  }, [nodes.length, boomAngle, stickAngle, bucketAngle, boomLength, stickLength, canvasSize.height, excavatorX]);

  // Render the excavator and terrain
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#87CEEB'; // Sky blue
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw ground
    const groundY = canvasSize.height - 100;
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, groundY, canvasSize.width, canvasSize.height - groundY);

    // Draw material layers
    materialLayers.forEach((layer) => {
      ctx.fillStyle = layer.color;
      const layerY = groundY + layer.depth;
      ctx.fillRect(0, layerY, canvasSize.width, canvasSize.height - layerY);
    });

    // Draw terrain profile (modified by digging)
    if (currentTerrain.length > 0) {
      ctx.fillStyle = '#6B5B47';
      ctx.beginPath();
      ctx.moveTo(0, canvasSize.height);
      currentTerrain.forEach(point => {
        ctx.lineTo(point.x, groundY - point.height);
      });
      ctx.lineTo(canvasSize.width, canvasSize.height);
      ctx.closePath();
      ctx.fill();
    }

    // Draw target zone if present
    if (targetZone) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      ctx.fillRect(targetZone.x - targetZone.width / 2, targetZone.y - targetZone.height / 2, targetZone.width, targetZone.height);
      ctx.strokeRect(targetZone.x - targetZone.width / 2, targetZone.y - targetZone.height / 2, targetZone.width, targetZone.height);

      ctx.fillStyle = '#22C55E';
      ctx.font = '14px sans-serif';
      ctx.fillText(targetZone.label, targetZone.x - 30, targetZone.y - targetZone.height / 2 - 10);
    }

    // Draw reach envelope if enabled
    if (showReach && nodes.length > 0) {
      const baseX = nodes[0].x;
      const baseY = nodes[0].y;
      const maxReach = boomLength + stickLength + 30; // Including bucket

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(baseX, baseY, maxReach, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw excavator arm (Verlet nodes connected)
    if (nodes.length >= 4) {
      // Draw excavator base/body
      const baseWidth = 60;
      const baseHeight = 40;
      const trackHeight = 15;

      // Tracks
      ctx.fillStyle = '#1F2937';
      ctx.fillRect(nodes[0].x - baseWidth / 2, nodes[0].y + baseHeight - trackHeight, baseWidth, trackHeight);

      // Body
      ctx.fillStyle = excavatorColor;
      ctx.fillRect(nodes[0].x - baseWidth / 2, nodes[0].y, baseWidth, baseHeight);

      // Cab
      ctx.fillStyle = '#60A5FA';
      ctx.fillRect(nodes[0].x - 20, nodes[0].y - 20, 40, 20);

      ctx.strokeStyle = excavatorColor;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Boom (base to boom end)
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(nodes[1].x, nodes[1].y);
      ctx.stroke();

      // Stick (boom end to stick end)
      ctx.beginPath();
      ctx.moveTo(nodes[1].x, nodes[1].y);
      ctx.lineTo(nodes[2].x, nodes[2].y);
      ctx.stroke();

      // Bucket (stick end to bucket tip)
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(nodes[2].x, nodes[2].y);
      ctx.lineTo(nodes[3].x, nodes[3].y);
      ctx.stroke();

      // Draw bucket scoop
      const bucketRad = ((boomAngle + stickAngle + bucketAngle) * Math.PI) / 180;
      const scoopWidth = 25;
      const scoopDepth = 20;

      ctx.fillStyle = excavatorColor;
      ctx.beginPath();
      ctx.moveTo(nodes[3].x, nodes[3].y);
      ctx.lineTo(
        nodes[3].x + Math.cos(bucketRad + Math.PI / 2) * scoopWidth,
        nodes[3].y - Math.sin(bucketRad + Math.PI / 2) * scoopWidth
      );
      ctx.lineTo(
        nodes[3].x + Math.cos(bucketRad + Math.PI / 2) * scoopWidth + Math.cos(bucketRad) * scoopDepth,
        nodes[3].y - Math.sin(bucketRad + Math.PI / 2) * scoopWidth - Math.sin(bucketRad) * scoopDepth
      );
      ctx.lineTo(
        nodes[3].x + Math.cos(bucketRad) * scoopDepth,
        nodes[3].y - Math.sin(bucketRad) * scoopDepth
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw joints
      ctx.fillStyle = '#374151';
      [nodes[0], nodes[1], nodes[2]].forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw material particles in bucket
      bucketContents.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw angle indicators
    if (showAngles && nodes.length >= 4) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px monospace';
      ctx.fillText(`Boom: ${Math.round(boomAngle)}°`, 10, 20);
      ctx.fillText(`Stick: ${Math.round(stickAngle)}°`, 10, 40);
      ctx.fillText(`Bucket: ${Math.round(bucketAngle)}°`, 10, 60);
    }
  }, [nodes, canvasSize, boomAngle, stickAngle, bucketAngle, excavatorColor, showAngles, showReach, boomLength, stickLength, currentTerrain, materialLayers, targetZone, bucketContents]);

  // Animation loop
  useEffect(() => {
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
  }, [updateNodePositions, render]);

  // Handle angle changes with constraints
  const handleBoomAngleChange = (value: number) => {
    setBoomAngle(Math.max(minBoomAngle, Math.min(maxBoomAngle, value)));
  };

  const handleStickAngleChange = (value: number) => {
    setStickAngle(Math.max(minStickAngle, Math.min(maxStickAngle, value)));
  };

  const handleBucketAngleChange = (value: number) => {
    setBucketAngle(Math.max(minBucketAngle, Math.min(maxBucketAngle, value)));
  };

  // Handle excavator position changes
  const handleExcavatorMove = (deltaX: number) => {
    setExcavatorX(prev => Math.max(80, Math.min(canvasSize.width - 80, prev + deltaX)));
  };

  // Dig operation - excavate material at bucket location
  const handleDig = () => {
    if (nodes.length < 4) return;
    if (bucketContents.length >= bucketSize) return; // Bucket full

    const bucketX = nodes[3].x;
    const bucketY = nodes[3].y;
    const groundY = canvasSize.height - 100;

    // Check if bucket is in the ground
    if (bucketY < groundY) return; // Bucket above ground

    // Determine material type at this location
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

    // Excavate material (harder materials yield less)
    const amountExcavated = Math.min(bucketSize - bucketContents.length, Math.ceil(3 / hardness));

    // Create material particles
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

    setBucketContents(prev => [...prev, ...newParticles]);
    setTotalExcavated(prev => prev + amountExcavated);
    setDigOperations(prev => prev + 1);

    // Modify terrain (create a scoop mark)
    setCurrentTerrain(prev => {
      const updated = [...prev];
      // Simplified terrain modification - remove height at bucket position
      const terrainIndex = Math.floor((bucketX / canvasSize.width) * updated.length);
      if (terrainIndex >= 0 && terrainIndex < updated.length) {
        updated[terrainIndex] = {
          ...updated[terrainIndex],
          height: Math.max(0, updated[terrainIndex].height - amountExcavated * 2),
        };
      }
      return updated;
    });
  };

  // Dump operation - release material from bucket
  const handleDump = () => {
    if (bucketContents.length === 0) return;

    // Check if bucket is over target zone
    if (targetZone && nodes.length >= 4) {
      const bucketX = nodes[3].x;
      const bucketY = nodes[3].y;

      const inTargetX = Math.abs(bucketX - targetZone.x) < targetZone.width / 2;
      const inTargetY = Math.abs(bucketY - targetZone.y) < targetZone.height / 2;

      if (inTargetX && inTargetY) {
        // Successful dump in target zone
        setDumpOperations(prev => prev + 1);
      }
    }

    // Clear bucket
    setBucketContents([]);
  };

  // Submit evaluation
  const handleSubmit = () => {
    if (hasSubmitted || !isEvaluationEnabled) return;

    // Determine success based on challenge
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

      // Goal achievement
      targetAmount: challenge?.targetAmount || 0,
      excavatedAmount: totalExcavated,
      goalMet: success,

      // Efficiency
      digOperations,
      dumpOperations,
      efficiency,

      // Control mastery
      boomAngleRange: Math.abs(maxBoomAngle - minBoomAngle),
      stickAngleRange: Math.abs(maxStickAngle - minStickAngle),
      bucketAngleRange: Math.abs(maxBucketAngle - minBucketAngle),

      // Final state
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
    setBucketContents([]);
    setTotalExcavated(0);
    setDigOperations(0);
    setDumpOperations(0);
    setCurrentTerrain(terrainProfile);
    resetAttempt();
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-300">{description}</p>

        {challenge && (
          <div className="mt-3 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
            <p className="text-blue-200 text-sm">
              <strong>Challenge:</strong> {challenge.description}
            </p>
            <p className="text-blue-300 text-xs mt-1">
              Target: {challenge.targetAmount} units of material
            </p>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="mb-4 rounded-lg overflow-hidden border border-slate-600">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full bg-slate-900"
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Boom Control */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Boom Angle: {Math.round(boomAngle)}°
          </label>
          {jointControl === 'sliders' && (
            <input
              type="range"
              min={minBoomAngle}
              max={maxBoomAngle}
              step="1"
              value={boomAngle}
              onChange={(e) => handleBoomAngleChange(Number(e.target.value))}
              className="w-full"
            />
          )}
          {jointControl === 'buttons' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleBoomAngleChange(boomAngle - 5)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                -5°
              </button>
              <button
                onClick={() => handleBoomAngleChange(boomAngle + 5)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                +5°
              </button>
            </div>
          )}
        </div>

        {/* Stick Control */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Stick Angle: {Math.round(stickAngle)}°
          </label>
          {jointControl === 'sliders' && (
            <input
              type="range"
              min={minStickAngle}
              max={maxStickAngle}
              step="1"
              value={stickAngle}
              onChange={(e) => handleStickAngleChange(Number(e.target.value))}
              className="w-full"
            />
          )}
          {jointControl === 'buttons' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleStickAngleChange(stickAngle - 5)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                -5°
              </button>
              <button
                onClick={() => handleStickAngleChange(stickAngle + 5)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                +5°
              </button>
            </div>
          )}
        </div>

        {/* Bucket Control */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Bucket Angle: {Math.round(bucketAngle)}°
          </label>
          {jointControl === 'sliders' && (
            <input
              type="range"
              min={minBucketAngle}
              max={maxBucketAngle}
              step="1"
              value={bucketAngle}
              onChange={(e) => handleBucketAngleChange(Number(e.target.value))}
              className="w-full"
            />
          )}
          {jointControl === 'buttons' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleBucketAngleChange(bucketAngle - 5)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                -5°
              </button>
              <button
                onClick={() => handleBucketAngleChange(bucketAngle + 5)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                +5°
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Movement Controls */}
      <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Excavator Position
        </label>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => handleExcavatorMove(-20)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
          >
            ← Move Left
          </button>
          <div className="flex-1 text-center text-slate-400 text-sm">
            X: {Math.round(excavatorX)}
          </div>
          <button
            onClick={() => handleExcavatorMove(20)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
          >
            Move Right →
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleDig}
          disabled={bucketContents.length >= bucketSize}
          className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          ⛏️ Dig ({bucketContents.length}/{bucketSize})
        </button>
        <button
          onClick={handleDump}
          disabled={bucketContents.length === 0}
          className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
        >
          🚛 Dump
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
          <div className="text-2xl font-bold text-amber-400">{totalExcavated}</div>
          <div className="text-xs text-slate-400">Total Excavated</div>
        </div>
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
          <div className="text-2xl font-bold text-orange-400">{digOperations}</div>
          <div className="text-xs text-slate-400">Digs</div>
        </div>
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
          <div className="text-2xl font-bold text-green-400">{dumpOperations}</div>
          <div className="text-xs text-slate-400">Dumps</div>
        </div>
      </div>

      {/* Evaluation Controls */}
      {isEvaluationEnabled && (
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={hasSubmitted}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
          >
            {hasSubmitted ? '✓ Submitted' : 'Submit Work'}
          </button>
          {hasSubmitted && (
            <button
              onClick={handleReset}
              className="px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition-all"
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
