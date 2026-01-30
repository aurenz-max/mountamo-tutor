'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  usePrimitiveEvaluation,
  type ShapeStrengthTesterMetrics,
} from '../../../evaluation';

/* -------------------------------------------------------------------------- */
/*                                PHYSICS ENGINE                              */
/* -------------------------------------------------------------------------- */
// Verlet Integration for realistic structural simulation

interface Particle {
  id: string;
  x: number;
  y: number;
  oldx: number;
  oldy: number;
  pinned: boolean;
  mass: number;
}

interface Stick {
  id: string;
  p1: string; // Particle ID
  p2: string; // Particle ID
  length: number;
  material: BeamMaterial;
  maxStretch: number; // Max deformation ratio before breaking
  currentLength: number;
  stress: number; // 0-1+ normalized stress
  failed: boolean;
}

// Physics constants
const GRAVITY = 0.3;
const FRICTION = 0.98;
const CONSTRAINT_ITERATIONS = 8; // Higher = stiffer structures

/* -------------------------------------------------------------------------- */
/*                                 TYPES                                      */
/* -------------------------------------------------------------------------- */

export type BeamMaterial = 'straw' | 'wood' | 'steel';
export type TestType = 'compression' | 'shear' | 'earthquake';

export interface Point {
  x: number;
  y: number;
}

export interface Beam {
  id: string;
  material: BeamMaterial;
  start: Point;
  end: Point;
  angle: number;
  length: number;
  failed: boolean;
  stress?: number; // For visualization
}

export interface TestResult {
  testType: TestType;
  load: number;
  survived: boolean;
  failurePoints: string[];
  triangleCount: number;
  maxDeflection: number;
}

export interface ShapeStrengthTesterData {
  title: string;
  description: string;
  canvasWidth?: number;
  canvasHeight?: number;
  testType: TestType;
  testLoad: number;
  targetTriangles?: number;
  targetHeight?: number;
  availableMaterials: BeamMaterial[];
  defaultMaterial: BeamMaterial;
  hint?: string;

  // Evaluation integration
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<ShapeStrengthTesterMetrics>) => void;
}

interface ShapeStrengthTesterProps {
  data: ShapeStrengthTesterData;
  className?: string;
}

const ShapeStrengthTester: React.FC<ShapeStrengthTesterProps> = ({ data, className }) => {
  const {
    title,
    description,
    canvasWidth = 600,
    canvasHeight = 400,
    testType = 'compression',
    testLoad = 50,
    targetTriangles = 0,
    targetHeight = 0,
    availableMaterials = ['wood', 'steel', 'straw'],
    defaultMaterial = 'wood',
    hint,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // UI State
  const [beams, setBeams] = useState<Beam[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<BeamMaterial>(defaultMaterial);
  const [isPlacing, setIsPlacing] = useState(false);
  const [placementStart, setPlacementStart] = useState<Point | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  const [hoveredBeam, setHoveredBeam] = useState<string | null>(null);

  // Simulation State
  const [isBuilding, setIsBuilding] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [currentTest, setCurrentTest] = useState<TestResult | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [hintMessage, setHintMessage] = useState<string | null>(hint || null);

  // Physics engine refs (mutable for performance)
  const particles = useRef<Map<string, Particle>>(new Map());
  const sticks = useRef<Map<string, Stick>>(new Map());
  const animationFrameId = useRef<number>();
  const svgRef = useRef<SVGSVGElement>(null);
  const loadMultiplier = useRef<number>(0);
  const simulationTime = useRef<number>(0);

  const canvasOffsetY = 50;

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<ShapeStrengthTesterMetrics>({
    primitiveType: 'shape-strength-tester',
    instanceId: instanceId || `shape-strength-tester-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  const convertScreenToSVGCoords = (clientX: number, clientY: number, rect: DOMRect): Point => {
    const scaleX = canvasWidth / rect.width;
    const scaleY = (canvasHeight + canvasOffsetY + 50) / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const snapToGrid = (point: Point, gridSize: number = 30): Point => ({
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  });

  const distance = (p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const getMaterialColor = (material: BeamMaterial): string => {
    const colors: Record<BeamMaterial, string> = {
      straw: '#F59E0B',
      wood: '#92400E',
      steel: '#6B7280',
    };
    return colors[material];
  };

  const getMaterialProperties = (material: BeamMaterial) => {
    switch (material) {
      case 'straw':
        return { maxStretch: 1.05, color: '#F59E0B' }; // Breaks at 5% deformation
      case 'wood':
        return { maxStretch: 1.12, color: '#92400E' }; // Breaks at 12% deformation
      case 'steel':
        return { maxStretch: 1.25, color: '#6B7280' }; // Breaks at 25% deformation
    }
  };

  // ---------------------------------------------------------------------------
  // BUILDING LOGIC
  // ---------------------------------------------------------------------------

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isBuilding || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const svgPoint = convertScreenToSVGCoords(e.clientX, e.clientY, rect);
    const point: Point = {
      x: svgPoint.x,
      y: svgPoint.y - canvasOffsetY,
    };

    setIsPlacing(true);
    setPlacementStart(snapToGrid(point));
    setCurrentMousePos(snapToGrid(point));
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const svgPoint = convertScreenToSVGCoords(e.clientX, e.clientY, rect);
    const point: Point = {
      x: svgPoint.x,
      y: svgPoint.y - canvasOffsetY,
    };

    if (isPlacing && placementStart) {
      setCurrentMousePos(snapToGrid(point));
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isPlacing || !placementStart || !currentMousePos) return;

    const beamLength = distance(placementStart, currentMousePos);
    const minLength = 40;

    if (beamLength >= minLength) {
      const angle = Math.atan2(currentMousePos.y - placementStart.y, currentMousePos.x - placementStart.x) * (180 / Math.PI);

      const newBeam: Beam = {
        id: `beam-${Date.now()}-${Math.random()}`,
        material: selectedMaterial,
        start: placementStart,
        end: currentMousePos,
        angle,
        length: beamLength,
        failed: false,
        stress: 0,
      };

      setBeams(prev => [...prev, newBeam]);
    }

    setIsPlacing(false);
    setPlacementStart(null);
    setCurrentMousePos(null);
  };

  const clearStructure = () => {
    setBeams([]);
    setIsBuilding(true);
    setIsSimulating(false);
    setCurrentTest(null);
    setTestProgress(0);
    setHintMessage(hint || null);

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    particles.current.clear();
    sticks.current.clear();
    loadMultiplier.current = 0;
    simulationTime.current = 0;
  };

  // ---------------------------------------------------------------------------
  // PHYSICS ENGINE
  // ---------------------------------------------------------------------------

  const initPhysicsSimulation = () => {
    if (beams.length === 0) {
      setHintMessage('Build a structure first before testing!');
      return;
    }

    particles.current.clear();
    sticks.current.clear();
    loadMultiplier.current = 0;
    simulationTime.current = 0;

    // Convert beams to physics particles and sticks
    beams.forEach(beam => {
      const p1Id = `${Math.round(beam.start.x)},${Math.round(beam.start.y)}`;
      const p2Id = `${Math.round(beam.end.x)},${Math.round(beam.end.y)}`;

      const props = getMaterialProperties(beam.material);

      // Create particles if they don't exist
      if (!particles.current.has(p1Id)) {
        particles.current.set(p1Id, {
          id: p1Id,
          x: beam.start.x,
          y: beam.start.y,
          oldx: beam.start.x,
          oldy: beam.start.y,
          pinned: beam.start.y >= canvasHeight - 5, // Pin to ground
          mass: 1,
        });
      }

      if (!particles.current.has(p2Id)) {
        particles.current.set(p2Id, {
          id: p2Id,
          x: beam.end.x,
          y: beam.end.y,
          oldx: beam.end.x,
          oldy: beam.end.y,
          pinned: beam.end.y >= canvasHeight - 5, // Pin to ground
          mass: 1,
        });
      }

      // Create stick constraint
      sticks.current.set(beam.id, {
        id: beam.id,
        p1: p1Id,
        p2: p2Id,
        length: beam.length,
        material: beam.material,
        maxStretch: props.maxStretch,
        currentLength: beam.length,
        stress: 0,
        failed: false,
      });
    });

    setIsBuilding(false);
    setIsSimulating(true);
    setTestProgress(0);
    setHintMessage(null);

    // Start physics loop
    animationFrameId.current = requestAnimationFrame(updatePhysics);
  };

  // Count triangles for evaluation
  const countTriangles = useCallback((): number => {
    const adjacency = new Map<string, Set<string>>();

    beams.forEach(beam => {
      const p1Key = `${Math.round(beam.start.x)},${Math.round(beam.start.y)}`;
      const p2Key = `${Math.round(beam.end.x)},${Math.round(beam.end.y)}`;

      if (!adjacency.has(p1Key)) adjacency.set(p1Key, new Set());
      if (!adjacency.has(p2Key)) adjacency.set(p2Key, new Set());

      adjacency.get(p1Key)!.add(p2Key);
      adjacency.get(p2Key)!.add(p1Key);
    });

    let triangleCount = 0;
    const visited = new Set<string>();

    adjacency.forEach((neighbors1, v1) => {
      neighbors1.forEach(v2 => {
        const neighbors2 = adjacency.get(v2);
        if (!neighbors2) return;

        neighbors2.forEach(v3 => {
          if (v3 === v1) return;
          const neighbors3 = adjacency.get(v3);
          if (!neighbors3 || !neighbors3.has(v1)) return;

          const triangleKey = [v1, v2, v3].sort().join('-');
          if (!visited.has(triangleKey)) {
            visited.add(triangleKey);
            triangleCount++;
          }
        });
      });
    });

    return triangleCount;
  }, [beams]);

  const stopSimulation = useCallback((failed: boolean) => {
    setIsSimulating(false);

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    const failedBeams = Array.from(sticks.current.values())
      .filter(s => s.failed)
      .map(s => s.id);

    const survived = failedBeams.length === 0;
    const triangles = countTriangles();

    const result: TestResult = {
      testType,
      load: testLoad,
      survived,
      failurePoints: failedBeams,
      triangleCount: triangles,
      maxDeflection: failedBeams.length * 5,
    };

    setCurrentTest(result);
    setTestResults(prev => [...prev, result]);

    // Generate feedback
    if (survived) {
      setHintMessage(`✓ Success! Structure survived ${testLoad}N ${testType} test! Triangles detected: ${triangles}`);
    } else {
      if (triangles === 0) {
        setHintMessage(`❌ Failed! ${failedBeams.length} beams collapsed. Try adding diagonal bracing to create triangles - they're much stronger!`);
      } else {
        setHintMessage(`❌ Failed! ${failedBeams.length} beams collapsed. Try using stronger materials or adding more triangular support in weak areas.`);
      }
    }
  }, [testLoad, testType, countTriangles]);

  const updatePhysics = useCallback(() => {
    // Don't check isSimulating here - it's controlled by the animation frame lifecycle
    simulationTime.current += 1;

    // Gradually increase load over time
    if (simulationTime.current < 300) { // 5 seconds at 60fps
      loadMultiplier.current = (simulationTime.current / 300);
      setTestProgress(Math.round(loadMultiplier.current * 100));
    }

    const currentLoad = testLoad * loadMultiplier.current;
    let totalFailures = 0;

    // Find the highest particles (top of structure) for compression test
    let minY = canvasHeight;
    const topParticles = new Set<string>();

    particles.current.forEach(p => {
      if (p.pinned) return;
      if (p.y < minY) minY = p.y;
    });

    // Identify particles within 20px of the top
    particles.current.forEach(p => {
      if (!p.pinned && p.y < minY + 20) {
        topParticles.add(p.id);
      }
    });

    // A. Update particle positions (Verlet integration)
    particles.current.forEach(p => {
      if (p.pinned) return;

      const vx = (p.x - p.oldx) * FRICTION;
      const vy = (p.y - p.oldy) * FRICTION;

      p.oldx = p.x;
      p.oldy = p.y;

      p.x += vx;
      p.y += vy;

      // Apply gravity
      p.y += GRAVITY * p.mass;

      // Apply test-specific forces
      if (testType === 'compression') {
        // Only apply load to TOP particles (simulating weight pressing down)
        if (topParticles.has(p.id)) {
          p.y += currentLoad / 100; // Much stronger force, concentrated at top
        }
      } else if (testType === 'shear') {
        p.x += currentLoad / 1000; // Push sideways
      } else if (testType === 'earthquake') {
        // Oscillating force
        const shake = Math.sin(simulationTime.current * 0.15) * currentLoad / 500;
        p.x += shake;
      }

      // Keep particles in bounds
      if (p.x < 0) p.x = 0;
      if (p.x > canvasWidth) p.x = canvasWidth;
      if (p.y < 0) p.y = 0;
      if (p.y > canvasHeight) {
        p.y = canvasHeight;
        p.pinned = true; // Pin if it hits ground
      }
    });

    // B. Solve constraints (make beams act like sticks)
    for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration++) {
      sticks.current.forEach(stick => {
        if (stick.failed) return;

        const p1 = particles.current.get(stick.p1);
        const p2 = particles.current.get(stick.p2);
        if (!p1 || !p2) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        stick.currentLength = dist;

        // Calculate deformation ratio
        const deformationRatio = dist / stick.length;

        // Calculate stress (normalized)
        stick.stress = Math.abs(1 - deformationRatio) * 5;

        // Check for failure (too much stretch or compression)
        if (deformationRatio > stick.maxStretch || deformationRatio < (2 - stick.maxStretch)) {
          stick.failed = true;
          totalFailures++;
          return;
        }

        // Apply constraint to restore target length
        const diff = stick.length - dist;
        const percent = diff / dist / 2;
        const offsetX = dx * percent;
        const offsetY = dy * percent;

        if (!p1.pinned) {
          p1.x -= offsetX;
          p1.y -= offsetY;
        }
        if (!p2.pinned) {
          p2.x += offsetX;
          p2.y += offsetY;
        }
      });
    }

    // C. Sync physics state back to React beams for rendering
    const updatedBeams = beams.map(beam => {
      const stick = sticks.current.get(beam.id);
      if (!stick) return beam;

      const p1 = particles.current.get(stick.p1);
      const p2 = particles.current.get(stick.p2);
      if (!p1 || !p2) return beam;

      return {
        ...beam,
        start: { x: p1.x, y: p1.y },
        end: { x: p2.x, y: p2.y },
        failed: stick.failed,
        stress: stick.stress,
      };
    });

    setBeams(updatedBeams);

    // D. Check for catastrophic failure
    const failurePercentage = totalFailures / beams.length;

    if (failurePercentage > 0.3 || simulationTime.current > 600) {
      // Test complete
      stopSimulation(totalFailures > 0);
      return;
    }

    // Continue simulation
    animationFrameId.current = requestAnimationFrame(updatePhysics);
  }, [beams, testLoad, testType, canvasHeight, canvasWidth, stopSimulation]);

  const resetToBuilding = () => {
    setIsBuilding(true);
    setIsSimulating(false);
    setCurrentTest(null);
    setTestProgress(0);

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    // Reset beams to original positions
    const resetBeams = beams.map(b => ({
      ...b,
      failed: false,
      stress: 0
    }));
    setBeams(resetBeams);

    particles.current.clear();
    sticks.current.clear();
    loadMultiplier.current = 0;
    simulationTime.current = 0;
  };

  const calculateHeight = (): number => {
    if (beams.length === 0) return 0;
    const minY = Math.min(...beams.flatMap(b => [b.start.y, b.end.y]));
    const maxY = Math.max(...beams.flatMap(b => [b.start.y, b.end.y]));
    return maxY - minY;
  };

  // Submit evaluation
  const handleSubmitEvaluation = () => {
    if (hasSubmittedEvaluation) return;

    const triangles = countTriangles();
    const height = calculateHeight();
    const success = currentTest?.survived || false;

    const triangleGoalMet = targetTriangles > 0 ? triangles >= targetTriangles : true;
    const heightGoalMet = targetHeight > 0 ? height >= targetHeight : true;

    const score =
      (beams.length > 0 ? 15 : 0) +
      (triangles > 0 ? 25 : 0) +
      (success ? 40 : 0) +
      (triangleGoalMet ? 10 : 0) +
      (heightGoalMet ? 10 : 0);

    const metrics: ShapeStrengthTesterMetrics = {
      type: 'shape-strength-tester',
      shapesTested: testResults.length,
      totalTests: testResults.length,
      triangleDiscovered: triangles > 0,
      bracingUsed: triangles > 0,
      maxLoadAchieved: testLoad,
      testResults: testResults.map(r => ({
        shapeType: 'custom' as const,
        load: r.load,
        deformation: r.maxDeflection,
        survived: r.survived,
        withBracing: r.triangleCount > 0,
      })),
      targetShapeMet: triangleGoalMet,
      targetLoadMet: success,
    };

    submitEvaluation(success, Math.min(100, score), metrics, { testResults, triangles, height });
  };

  const triangles = countTriangles();
  const height = Math.round(calculateHeight());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">
              Physics Simulation Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-purple-500/20 relative overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-3xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Challenge Info */}
          <div className={`mb-4 p-4 rounded-xl border ${
            currentTest?.survived ? 'bg-green-500/20 border-green-500/50' : 'bg-purple-500/20 border-purple-500/50'
          }`}>
            <div className="flex flex-wrap items-center gap-3 justify-center text-sm">
              <span className="font-semibold text-white">Challenge:</span>
              <span className="text-slate-300">Test: {testType} {testLoad}N</span>
              {targetTriangles > 0 && <span className="text-slate-300">• Min {targetTriangles} triangles</span>}
              {targetHeight > 0 && <span className="text-slate-300">• Height: {targetHeight}px</span>}
              {currentTest?.survived && <span className="text-green-300">✓ Passed!</span>}
            </div>
          </div>

          {/* Status Bar */}
          <div className="mb-4 flex justify-center gap-4 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
              <span className="text-sm font-mono">
                Beams: <span className="text-purple-300">{beams.length}</span>
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
              <span className="text-sm font-mono">
                Triangles: <span className="text-green-300">{triangles}</span>
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
              <span className="text-sm font-mono">
                Height: <span className="text-blue-300">{height}px</span>
              </span>
            </div>

            {!isBuilding && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                currentTest?.survived ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'
              }`}>
                <span className="text-sm font-mono">
                  Status: <span className={currentTest?.survived ? 'text-green-300' : 'text-red-300'}>
                    {currentTest?.survived ? 'PASSED' : currentTest ? 'FAILED' : 'TESTING'}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Building Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 border border-slate-700/50">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight + canvasOffsetY + 50}`}
              className="w-full h-auto select-none cursor-crosshair"
              style={{ maxHeight: '500px' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={() => {
                if (isPlacing) handleCanvasMouseUp();
              }}
            >
              <defs>
                <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1E293B" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
                <pattern id="gridPattern" patternUnits="userSpaceOnUse" width="30" height="30">
                  <circle cx="0" cy="0" r="1" fill="#475569" opacity="0.3" />
                </pattern>
              </defs>

              {/* Background */}
              <rect x={0} y={0} width={canvasWidth} height={canvasHeight + canvasOffsetY + 50} fill="url(#skyGradient)" />

              {/* Grid pattern */}
              {isBuilding && (
                <rect x={0} y={canvasOffsetY} width={canvasWidth} height={canvasHeight} fill="url(#gridPattern)" />
              )}

              {/* Ground */}
              <rect
                x={0}
                y={canvasHeight + canvasOffsetY}
                width={canvasWidth}
                height={50}
                fill="#334155"
                stroke="#475569"
                strokeWidth={2}
              />

              {/* Beams */}
              {beams.map(beam => {
                const baseColor = getMaterialColor(beam.material);
                const isFailed = beam.failed;
                const stress = beam.stress || 0;

                // Color interpolation based on stress
                const getStressColor = () => {
                  if (isFailed) return '#EF4444';
                  if (stress > 0.7) return '#F59E0B'; // Warning yellow
                  return baseColor;
                };

                // Width changes based on stress (compression/tension)
                const strokeWidth = isFailed ? 4 : Math.max(3, 6 - stress * 2);

                return (
                  <g key={beam.id}>
                    <line
                      x1={beam.start.x}
                      y1={beam.start.y + canvasOffsetY}
                      x2={beam.end.x}
                      y2={beam.end.y + canvasOffsetY}
                      stroke={getStressColor()}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      opacity={isFailed ? 0.3 : 0.9}
                      className={isFailed ? 'animate-pulse' : ''}
                    />
                    {/* Joints */}
                    <circle
                      cx={beam.start.x}
                      cy={beam.start.y + canvasOffsetY}
                      r={4}
                      fill={isFailed ? '#DC2626' : '#3B82F6'}
                      stroke="white"
                      strokeWidth={1}
                    />
                    <circle
                      cx={beam.end.x}
                      cy={beam.end.y + canvasOffsetY}
                      r={4}
                      fill={isFailed ? '#DC2626' : '#3B82F6'}
                      stroke="white"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {/* Preview beam while placing */}
              {isPlacing && placementStart && currentMousePos && (
                <line
                  x1={placementStart.x}
                  y1={placementStart.y + canvasOffsetY}
                  x2={currentMousePos.x}
                  y2={currentMousePos.y + canvasOffsetY}
                  stroke={getMaterialColor(selectedMaterial)}
                  strokeWidth={6}
                  strokeLinecap="round"
                  opacity={0.5}
                  strokeDasharray="5,5"
                />
              )}

              {/* Load indicators (during test) */}
              {isSimulating && testProgress > 0 && (
                <>
                  {testType === 'compression' && (
                    Array.from({ length: 5 }).map((_, i) => (
                      <g key={`load-${i}`}>
                        <line
                          x1={(canvasWidth / 6) * (i + 1)}
                          y1={10}
                          x2={(canvasWidth / 6) * (i + 1)}
                          y2={canvasOffsetY - 10}
                          stroke="#EF4444"
                          strokeWidth={3}
                          markerEnd="url(#arrowhead)"
                          className="animate-pulse"
                        />
                      </g>
                    ))
                  )}
                  {testType === 'shear' && (
                    Array.from({ length: 3 }).map((_, i) => (
                      <g key={`load-${i}`}>
                        <line
                          x1={canvasWidth - 30}
                          y1={canvasOffsetY + (canvasHeight / 4) * (i + 1)}
                          x2={canvasWidth - 80}
                          y2={canvasOffsetY + (canvasHeight / 4) * (i + 1)}
                          stroke="#EF4444"
                          strokeWidth={3}
                          markerEnd="url(#arrowhead)"
                          className="animate-pulse"
                        />
                      </g>
                    ))
                  )}
                  {testType === 'earthquake' && (
                    <g>
                      <path
                        d={`M 50 ${canvasHeight + canvasOffsetY + 25} Q 150 ${canvasHeight + canvasOffsetY + 15} 250 ${canvasHeight + canvasOffsetY + 25} T 450 ${canvasHeight + canvasOffsetY + 25}`}
                        stroke="#EF4444"
                        strokeWidth={3}
                        fill="none"
                        className="animate-pulse"
                      />
                    </g>
                  )}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
                      <polygon points="0 0, 10 3, 0 6" fill="#EF4444" />
                    </marker>
                  </defs>
                  <text
                    x={canvasWidth / 2}
                    y={25}
                    fill="#EF4444"
                    fontSize="16"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {Math.round(testLoad * loadMultiplier.current)}N {testType}
                  </text>
                </>
              )}
            </svg>

            {/* Instructions overlay */}
            {isBuilding && beams.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 text-center max-w-md">
                  <p className="text-slate-300 mb-2">Click and drag to place beams</p>
                  <p className="text-slate-400 text-sm">Build your structure, then run the physics test!</p>
                  <p className="text-green-400 text-sm mt-2">💡 Tip: Triangles make structures stronger!</p>
                </div>
              </div>
            )}
          </div>

          {/* Material Selector */}
          {isBuilding && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Material</label>
                <div className="flex flex-wrap justify-center gap-3">
                  {availableMaterials.map(material => {
                    const props = getMaterialProperties(material);
                    return (
                      <button
                        key={material}
                        onClick={() => setSelectedMaterial(material)}
                        className={`px-6 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                          selectedMaterial === material
                            ? 'bg-orange-500/30 border-orange-500 text-orange-300'
                            : 'bg-slate-800/40 border-slate-600 text-slate-300 hover:bg-slate-700/40'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: props.color }}
                        />
                        <span className="font-semibold capitalize">{material}</span>
                        <span className="text-xs opacity-70">({Math.round((props.maxStretch - 1) * 100)}% flex)</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-500">
                  Click and drag to build - watch physics in real-time!
                </p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center">
            {isBuilding ? (
              <>
                <button
                  onClick={initPhysicsSimulation}
                  disabled={beams.length === 0}
                  className="px-8 py-3 bg-red-500/20 hover:bg-red-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-red-500/50 text-red-300 rounded-xl font-semibold transition-all flex items-center gap-2"
                >
                  <span>🔬</span>
                  Run Physics Test
                </button>

                <button
                  onClick={clearStructure}
                  disabled={beams.length === 0}
                  className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700/70 disabled:opacity-50 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all flex items-center gap-2"
                >
                  <span>🗑️</span> Clear
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={resetToBuilding}
                  className="px-8 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 rounded-xl font-semibold transition-all flex items-center gap-2"
                >
                  <span>🔨</span> Rebuild
                </button>

                {currentTest?.survived && !hasSubmittedEvaluation && (
                  <button
                    onClick={handleSubmitEvaluation}
                    className="px-8 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 rounded-xl font-semibold transition-all flex items-center gap-2"
                  >
                    <span>✓</span> Submit Results
                  </button>
                )}
              </>
            )}
          </div>

          {/* Test Progress Bar */}
          {isSimulating && (
            <div className="mt-6 p-4 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-white font-semibold">Testing...</span>
                <span className="text-slate-400 text-sm">{testProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100"
                  style={{ width: `${testProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Hint */}
          {hintMessage && (
            <div className={`mt-6 p-4 backdrop-blur-sm border rounded-xl animate-fade-in ${
              currentTest?.survived
                ? 'bg-green-500/10 border-green-500/30'
                : currentTest
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-purple-500/10 border-purple-500/30'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-lg">{currentTest?.survived ? '✓' : currentTest ? '❌' : '💡'}</span>
                <p className={`text-sm ${
                  currentTest?.survived
                    ? 'text-green-200'
                    : currentTest
                      ? 'text-red-200'
                      : 'text-purple-200'
                }`}>{hintMessage}</p>
              </div>
            </div>
          )}

          {/* Educational Info */}
          <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Building Strong Structures
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                <span className="text-green-400 font-semibold">Triangles</span> are the strongest shape! They can't be deformed without changing the length of their sides.
              </p>
              <p className="text-slate-300">
                <span className="text-blue-400 font-semibold">Squares</span> can collapse because their corners can move. Add diagonal bracing to make them rigid!
              </p>
              <p className="text-slate-300">
                <span className="text-red-400 font-semibold">Compression</span> pushes down from above (like gravity on a building).
              </p>
              <p className="text-slate-300">
                <span className="text-orange-400 font-semibold">Shear</span> pushes sideways (like wind or earthquakes).
              </p>
              <p className="text-slate-300">
                <span className="text-cyan-400 font-semibold">Real-world:</span> Engineers use triangular trusses in bridges, towers, and earthquake-resistant buildings!
              </p>
            </div>
          </div>

          {/* Test History */}
          {testResults.length > 0 && (
            <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Test History
              </h4>
              <div className="space-y-2 text-sm">
                {testResults.map((result, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-300 capitalize">Test {i + 1}: {result.testType} {result.load}N</span>
                      <span className="text-slate-500">• {result.triangleCount} triangles</span>
                    </div>
                    <span className={result.survived ? 'text-green-400' : 'text-red-400'}>
                      {result.survived ? '✓ Passed' : `❌ Failed (${result.failurePoints.length} failures)`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShapeStrengthTester;
