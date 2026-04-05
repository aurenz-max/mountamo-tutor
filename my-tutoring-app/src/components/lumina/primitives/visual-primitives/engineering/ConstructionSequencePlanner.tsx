'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ConstructionSequencePlannerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ConstructionTask {
  id: string;
  name: string;
  duration: number;              // Duration in weeks
  icon: string;
  description: string;
  dependencies: string[];        // Task IDs that must come before this
  category: 'foundation' | 'structural' | 'mechanical' | 'finishing';
}

export interface ConstructionChallenge {
  id: string;
  type: 'sequence' | 'critical_path' | 'parallel' | 'deadline';
  question: string;
  hint: string;
}

export interface ConstructionSequencePlannerData {
  title: string;
  description: string;
  tasks: ConstructionTask[];
  projectType: 'house' | 'bridge' | 'tower' | 'road' | 'playground';
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';
  targetWeeks: number;           // "Can you build in under N weeks?"
  parallelAllowed: boolean;
  challenges: ConstructionChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ConstructionSequencePlannerMetrics>) => void;
}

// ============================================================================
// Build Scene Constants — Component owns ALL geometry and animation
// ============================================================================

const SCENE_W = 600;
const SCENE_H = 320;
const GROUND_Y = 280;

// Visual elements per category for house project
interface BuildElement {
  category: 'foundation' | 'structural' | 'mechanical' | 'finishing';
  draw: (ctx: CanvasRenderingContext2D, progress: number) => void;
}

// Colors
const CAT_COLORS: Record<string, string> = {
  foundation: '#f59e0b',
  structural: '#3b82f6',
  mechanical: '#8b5cf6',
  finishing: '#10b981',
};

const CAT_LABELS: Record<string, string> = {
  foundation: 'Foundation',
  structural: 'Structure',
  mechanical: 'Systems',
  finishing: 'Finishing',
};

// ============================================================================
// Graph Algorithms — Critical path, topological sort, validation
// ============================================================================

function topologicalSort(tasks: ConstructionTask[]): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  const visit = (id: string): boolean => {
    if (temp.has(id)) return false; // cycle
    if (visited.has(id)) return true;
    temp.add(id);
    const task = taskMap.get(id);
    if (task) {
      for (const dep of task.dependencies) {
        if (!visit(dep)) return false;
      }
    }
    temp.delete(id);
    visited.add(id);
    result.push(id);
    return true;
  };

  for (const t of tasks) {
    if (!visited.has(t.id) && !visit(t.id)) return [];
  }
  return result;
}

function computeCriticalPath(tasks: ConstructionTask[]): {
  path: string[];
  totalWeeks: number;
  earliestStart: Map<string, number>;
  earliestFinish: Map<string, number>;
} {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const sorted = topologicalSort(tasks);
  const es = new Map<string, number>(); // earliest start
  const ef = new Map<string, number>(); // earliest finish

  // Forward pass
  for (const id of sorted) {
    const task = taskMap.get(id)!;
    let start = 0;
    for (const dep of task.dependencies) {
      start = Math.max(start, ef.get(dep) ?? 0);
    }
    es.set(id, start);
    ef.set(id, start + task.duration);
  }

  // Find project end
  let maxFinish = 0;
  let endTaskId = sorted[sorted.length - 1];
  for (const id of sorted) {
    const finish = ef.get(id) ?? 0;
    if (finish > maxFinish) {
      maxFinish = finish;
      endTaskId = id;
    }
  }

  // Backward pass to find critical path
  const ls = new Map<string, number>(); // latest start
  const lf = new Map<string, number>(); // latest finish
  for (const id of [...sorted].reverse()) {
    const task = taskMap.get(id)!;
    // Find latest finish — minimum of latest start of successors
    let latestFinish = maxFinish;
    for (const t of tasks) {
      if (t.dependencies.includes(id)) {
        latestFinish = Math.min(latestFinish, ls.get(t.id) ?? maxFinish);
      }
    }
    lf.set(id, latestFinish);
    ls.set(id, latestFinish - task.duration);
  }

  // Critical tasks have zero slack (ES == LS)
  const criticalTasks = sorted.filter(id => {
    const slack = (ls.get(id) ?? 0) - (es.get(id) ?? 0);
    return Math.abs(slack) < 0.001;
  });

  return { path: criticalTasks, totalWeeks: maxFinish, earliestStart: es, earliestFinish: ef };
}

function validateSchedule(
  schedule: string[],
  tasks: ConstructionTask[],
): { valid: boolean; violations: Array<{ taskId: string; missingDep: string }> } {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const completed = new Set<string>();
  const violations: Array<{ taskId: string; missingDep: string }> = [];

  for (const id of schedule) {
    const task = taskMap.get(id);
    if (!task) continue;
    for (const dep of task.dependencies) {
      if (!completed.has(dep)) {
        violations.push({ taskId: id, missingDep: dep });
      }
    }
    completed.add(id);
  }

  return { valid: violations.length === 0, violations };
}

// ============================================================================
// Build Scene — Canvas rendering of construction progress
// ============================================================================

function drawBuildScene(
  ctx: CanvasRenderingContext2D,
  completedCategories: Set<string>,
  failedTask: { id: string; category: string } | null,
  failureFrame: number,
  projectType: string,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#0f172a');
  sky.addColorStop(1, '#1e293b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, GROUND_Y);

  // Ground
  ctx.fillStyle = '#422006';
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(0, GROUND_Y, w, 4);

  const cx = w / 2;

  // Foundation
  if (completedCategories.has('foundation')) {
    ctx.fillStyle = '#78716c';
    ctx.fillRect(cx - 120, GROUND_Y - 20, 240, 20);
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 120, GROUND_Y - 20, 240, 20);
    // Concrete texture lines
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 110 + i * 50, GROUND_Y - 18);
      ctx.lineTo(cx - 110 + i * 50, GROUND_Y - 2);
      ctx.strokeStyle = '#a8a29e33';
      ctx.stroke();
    }
  }

  // Structural — walls and roof
  if (completedCategories.has('structural')) {
    const shouldFail = failedTask?.category === 'structural' && !completedCategories.has('foundation');
    const sinkOffset = shouldFail ? Math.min(failureFrame * 2, 40) : 0;
    const baseY = GROUND_Y - 20 + sinkOffset;

    // Walls
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - 110, baseY - 120, 20, 120); // left wall
    ctx.fillRect(cx + 90, baseY - 120, 20, 120);  // right wall
    // Bricks
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 0.5;
    for (let row = 0; row < 8; row++) {
      const y = baseY - 120 + row * 15;
      ctx.beginPath();
      ctx.moveTo(cx - 110, y);
      ctx.lineTo(cx - 90, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 90, y);
      ctx.lineTo(cx + 110, y);
      ctx.stroke();
    }
    // Roof
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(cx - 130, baseY - 120);
    ctx.lineTo(cx, baseY - 180);
    ctx.lineTo(cx + 130, baseY - 120);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // If no foundation, show sinking/cracking
    if (shouldFail && failureFrame > 5) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 40, baseY - 60);
      ctx.lineTo(cx + 40, baseY - 90);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else if (failedTask?.category === 'structural' && failureFrame > 0) {
    // Roof placed without walls — collapses!
    const drop = Math.min(failureFrame * 4, GROUND_Y - 40);
    ctx.fillStyle = '#92400e';
    ctx.globalAlpha = Math.max(0.3, 1 - failureFrame / 30);
    ctx.beginPath();
    ctx.moveTo(cx - 130, drop - 60);
    ctx.lineTo(cx, drop - 120 + failureFrame * 2);
    ctx.lineTo(cx + 130, drop - 60);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Debris particles
    if (failureFrame > 10) {
      ctx.fillStyle = '#78350f';
      for (let i = 0; i < 8; i++) {
        const px = cx - 80 + Math.sin(i * 1.3 + failureFrame * 0.1) * 60;
        const py = GROUND_Y - 10 - Math.abs(Math.sin(i * 0.7 + failureFrame * 0.2)) * 30;
        ctx.fillRect(px, py, 8, 6);
      }
    }
  }

  // Mechanical — pipes and wires (inside walls)
  if (completedCategories.has('mechanical') && completedCategories.has('structural')) {
    // Pipes
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 80, GROUND_Y - 20);
    ctx.lineTo(cx - 80, GROUND_Y - 100);
    ctx.lineTo(cx - 40, GROUND_Y - 100);
    ctx.stroke();
    // Wires
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + 40, GROUND_Y - 20);
    ctx.lineTo(cx + 40, GROUND_Y - 110);
    ctx.lineTo(cx + 80, GROUND_Y - 110);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (failedTask?.category === 'mechanical' && !completedCategories.has('structural')) {
    // Mechanical without walls — pipes dangling, sparks
    if (failureFrame > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 80, GROUND_Y - 20);
      ctx.lineTo(cx - 80, GROUND_Y - 60 + Math.sin(failureFrame * 0.3) * 10);
      ctx.stroke();
      // Sparks
      ctx.fillStyle = '#fbbf24';
      for (let i = 0; i < 4; i++) {
        const sx = cx - 80 + Math.cos(failureFrame * 0.5 + i) * 15;
        const sy = GROUND_Y - 60 + Math.sin(failureFrame * 0.5 + i * 1.5) * 15;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Finishing — windows, door, paint
  if (completedCategories.has('finishing') && completedCategories.has('structural')) {
    // Door
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(cx - 15, GROUND_Y - 65, 30, 45);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx + 8, GROUND_Y - 42, 3, 0, Math.PI * 2);
    ctx.fill();
    // Windows
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(cx - 70, GROUND_Y - 100, 30, 25);
    ctx.fillRect(cx + 40, GROUND_Y - 100, 30, 25);
    // Window frames
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 70, GROUND_Y - 100, 30, 25);
    ctx.strokeRect(cx + 40, GROUND_Y - 100, 30, 25);
    // Cross bars
    ctx.beginPath();
    ctx.moveTo(cx - 55, GROUND_Y - 100);
    ctx.lineTo(cx - 55, GROUND_Y - 75);
    ctx.moveTo(cx - 70, GROUND_Y - 87.5);
    ctx.lineTo(cx - 40, GROUND_Y - 87.5);
    ctx.stroke();
  }

  // Failure label
  if (failedTask && failureFrame > 15) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    const messages: Record<string, string> = {
      foundation: 'No foundation — structure sinks!',
      structural: 'No walls — roof collapses!',
      mechanical: 'No walls — nowhere to run pipes!',
      finishing: 'No structure — nothing to finish!',
    };
    ctx.fillText(
      messages[failedTask.category] ?? 'Wrong order!',
      cx,
      50 + Math.sin(failureFrame * 0.2) * 3,
    );
  }
}

// ============================================================================
// Gantt Timeline Sub-component
// ============================================================================

interface GanttProps {
  tasks: ConstructionTask[];
  schedule: string[];
  criticalPath: string[];
  earliestStart: Map<string, number>;
  totalWeeks: number;
  targetWeeks: number;
  isBuilding: boolean;
  currentBuildTask: string | null;
  completedTasks: Set<string>;
}

const GanttTimeline: React.FC<GanttProps> = ({
  tasks,
  schedule,
  criticalPath,
  earliestStart,
  totalWeeks,
  targetWeeks,
  isBuilding,
  currentBuildTask,
  completedTasks,
}) => {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const maxWeek = Math.max(totalWeeks, targetWeeks) + 2;
  const weekWidth = 100 / maxWeek;

  return (
    <div className="space-y-1.5">
      {/* Week headers */}
      <div className="flex items-center h-6 ml-[140px]">
        {Array.from({ length: maxWeek }, (_, i) => (
          <div
            key={i}
            className={`text-[10px] font-mono text-center flex-shrink-0 ${
              i < targetWeeks ? 'text-slate-400' : 'text-red-400/60'
            }`}
            style={{ width: `${weekWidth}%` }}
          >
            W{i + 1}
          </div>
        ))}
      </div>
      {/* Target deadline line */}
      <div className="relative h-0 ml-[140px]">
        <div
          className="absolute top-0 bottom-0 h-[999px] border-r-2 border-dashed border-amber-500/40 -mt-2"
          style={{ left: `${targetWeeks * weekWidth}%` }}
        />
      </div>
      {/* Task bars */}
      {schedule.map((id) => {
        const task = taskMap.get(id);
        if (!task) return null;
        const start = earliestStart.get(id) ?? 0;
        const isCritical = criticalPath.includes(id);
        const isActive = currentBuildTask === id;
        const isDone = completedTasks.has(id);
        const catColor = CAT_COLORS[task.category];

        return (
          <div key={id} className="flex items-center h-7 gap-2">
            <div className="w-[140px] flex-shrink-0 flex items-center gap-1.5 truncate">
              <span className="text-lg">{task.icon}</span>
              <span className={`text-xs truncate ${isDone ? 'text-slate-400' : 'text-slate-200'}`}>
                {task.name}
              </span>
            </div>
            <div className="flex-1 relative h-full">
              <div
                className={`absolute top-0.5 h-5 rounded-sm transition-all duration-300 ${
                  isActive ? 'animate-pulse ring-2 ring-white/40' : ''
                } ${isDone ? 'opacity-60' : ''}`}
                style={{
                  left: `${start * weekWidth}%`,
                  width: `${task.duration * weekWidth}%`,
                  backgroundColor: catColor,
                  border: isCritical ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span className="text-[9px] text-white font-mono px-1 leading-5 whitespace-nowrap">
                  {task.duration}w
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 ml-[140px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-2 border-amber-500 rounded-sm" />
          <span className="text-[10px] text-slate-400">Critical Path</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-amber-500/40" />
          <span className="text-[10px] text-slate-400">Deadline (W{targetWeeks})</span>
        </div>
        {Object.entries(CAT_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-slate-400">{CAT_LABELS[cat]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

type GamePhase = 'plan' | 'build' | 'results';

const ConstructionSequencePlanner: React.FC<{ data: ConstructionSequencePlannerData; className?: string }> = ({ data, className }) => {
  const {
    title,
    description,
    tasks = [],
    projectType = 'house',
    gradeLevel = '2',
    targetWeeks = 20,
    parallelAllowed = false,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ---- State ----
  const [phase, setPhase] = useState<GamePhase>('plan');
  const [schedule, setSchedule] = useState<string[]>(() =>
    [...tasks.map(t => t.id)].sort(() => Math.random() - 0.5),
  );
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [rearrangeCount, setRearrangeCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('info');

  // Build animation state
  const [isBuilding, setIsBuilding] = useState(false);
  const [currentBuildIdx, setCurrentBuildIdx] = useState(-1);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [completedCategories, setCompletedCategories] = useState<Set<string>>(new Set());
  const [failedTask, setFailedTask] = useState<{ id: string; category: string } | null>(null);
  const [failureFrame, setFailureFrame] = useState(0);
  const [buildFinished, setBuildFinished] = useState(false);
  const [buildSuccess, setBuildSuccess] = useState(false);

  // Timing
  const startTimeRef = useRef(Date.now());

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Resolved instance ID
  const resolvedInstanceId = instanceId || `construction-sequence-planner-${Date.now()}`;

  // ---- Graph computations ----
  const { path: criticalPath, totalWeeks, earliestStart, earliestFinish } = useMemo(
    () => computeCriticalPath(tasks),
    [tasks],
  );

  const scheduleWeeks = useMemo(() => {
    // Compute total project duration given the current schedule order
    // respecting dependencies and parallel execution if allowed
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const finish = new Map<string, number>();

    for (const id of schedule) {
      const task = taskMap.get(id);
      if (!task) continue;
      let start = 0;
      for (const dep of task.dependencies) {
        start = Math.max(start, finish.get(dep) ?? 0);
      }
      finish.set(id, start + task.duration);
    }

    let max = 0;
    finish.forEach(v => { max = Math.max(max, v); });
    return max;
  }, [schedule, tasks]);

  // ---- Evaluation hook ----
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<ConstructionSequencePlannerMetrics>({
    primitiveType: 'construction-sequence-planner',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    projectType,
    gradeLevel,
    taskCount: tasks.length,
    targetWeeks,
    criticalPathLength: criticalPath.length,
    parallelAllowed,
  }), [projectType, gradeLevel, tasks.length, targetWeeks, criticalPath.length, parallelAllowed]);

  const { sendText } = useLuminaAI({
    primitiveType: 'construction-sequence-planner',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ---- Canvas rendering ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBuildScene(ctx, completedCategories, failedTask, failureFrame, projectType);
  }, [completedCategories, failedTask, failureFrame, projectType]);

  // Failure animation loop
  useEffect(() => {
    if (!failedTask) return;
    let frame = 0;
    const tick = () => {
      frame++;
      setFailureFrame(frame);
      if (frame < 40) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [failedTask]);

  // ---- Drag & Drop ----
  const handleDragStart = useCallback((idx: number) => {
    setDraggedIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTargetIdx(idx);
  }, []);

  const handleDrop = useCallback((targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDropTargetIdx(null);
      return;
    }
    setSchedule(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setRearrangeCount(c => c + 1);
    setDraggedIdx(null);
    setDropTargetIdx(null);
    setFeedback(null);
  }, [draggedIdx]);

  const handleDragEnd = useCallback(() => {
    setDraggedIdx(null);
    setDropTargetIdx(null);
  }, []);

  // ---- Build Animation ----
  const startBuild = useCallback(() => {
    setAttempts(a => a + 1);
    const { valid, violations } = validateSchedule(schedule, tasks);
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    if (!valid) {
      // Find the first violation and animate up to it
      const firstViolation = violations[0];
      const violationIdx = schedule.indexOf(firstViolation.taskId);
      const violatingTask = taskMap.get(firstViolation.taskId);
      const missingTask = taskMap.get(firstViolation.missingDep);

      setPhase('build');
      setIsBuilding(true);
      setCompletedTasks(new Set());
      setCompletedCategories(new Set());
      setFailedTask(null);
      setFailureFrame(0);
      setBuildFinished(false);
      setBuildSuccess(false);

      // Animate tasks up to the violation
      let step = 0;
      const buildUp = () => {
        if (step < violationIdx) {
          const id = schedule[step];
          const task = taskMap.get(id);
          setCurrentBuildIdx(step);
          setCompletedTasks(prev => { const n = new Set(Array.from(prev)); n.add(id); return n; });
          if (task) {
            setCompletedCategories(prev => { const n = new Set(Array.from(prev)); n.add(task.category); return n; });
          }
          step++;
          setTimeout(buildUp, 600);
        } else {
          // Show the failure
          setCurrentBuildIdx(violationIdx);
          setFailedTask({
            id: firstViolation.taskId,
            category: violatingTask?.category ?? 'structural',
          });
          setIsBuilding(false);
          setBuildFinished(true);
          setBuildSuccess(false);

          setFeedback(
            `${violatingTask?.icon ?? '❌'} "${violatingTask?.name}" can't be done yet — ` +
            `"${missingTask?.name}" needs to happen first!`,
          );
          setFeedbackType('error');

          sendText(
            `[BUILD_FAILURE] Student tried to do "${violatingTask?.name}" before "${missingTask?.name}". ` +
            `The build animation showed the failure. This is attempt ${attempts + 1}. ` +
            `Give a brief hint about why ${missingTask?.name} must come first in construction.`,
            { silent: true },
          );
        }
      };

      setTimeout(buildUp, 300);
    } else {
      // Valid sequence — animate full build
      setPhase('build');
      setIsBuilding(true);
      setCompletedTasks(new Set());
      setCompletedCategories(new Set());
      setFailedTask(null);
      setFailureFrame(0);
      setBuildFinished(false);
      setBuildSuccess(false);

      let step = 0;
      const buildAll = () => {
        if (step < schedule.length) {
          const id = schedule[step];
          const task = taskMap.get(id);
          setCurrentBuildIdx(step);
          setCompletedTasks(prev => { const n = new Set(Array.from(prev)); n.add(id); return n; });
          if (task) {
            setCompletedCategories(prev => { const n = new Set(Array.from(prev)); n.add(task.category); return n; });
          }
          step++;
          setTimeout(buildAll, 500);
        } else {
          setIsBuilding(false);
          setBuildFinished(true);
          setBuildSuccess(true);
          setCurrentBuildIdx(-1);
          submitResults(true);

          const meetsDeadline = scheduleWeeks <= targetWeeks;
          setFeedback(
            meetsDeadline
              ? `Project complete in ${scheduleWeeks} weeks — under the ${targetWeeks}-week deadline!`
              : `Project complete in ${scheduleWeeks} weeks — over the ${targetWeeks}-week target by ${scheduleWeeks - targetWeeks} weeks.`,
          );
          setFeedbackType(meetsDeadline ? 'success' : 'info');

          sendText(
            `[ALL_COMPLETE] Student built successfully in ${scheduleWeeks} weeks (target: ${targetWeeks}). ` +
            `${meetsDeadline ? 'Met the deadline!' : 'Over deadline.'} ` +
            `Attempts: ${attempts + 1}. Give encouraging feedback.`,
            { silent: true },
          );
        }
      };

      setTimeout(buildAll, 300);
    }
  }, [schedule, tasks, attempts, scheduleWeeks, targetWeeks, sendText]);

  // ---- Submit evaluation results ----
  const submitResults = useCallback((success: boolean) => {
    if (hasSubmittedEvaluation) return;

    const elapsedMs = Date.now() - startTimeRef.current;
    const { violations } = validateSchedule(schedule, tasks);
    const correctSeq = topologicalSort(tasks);
    const correctCount = schedule.filter((id, idx) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return false;
      return task.dependencies.every(dep => schedule.indexOf(dep) < idx);
    }).length;
    const meetsDeadline = scheduleWeeks <= targetWeeks;

    const metrics: ConstructionSequencePlannerMetrics = {
      type: 'construction-sequence-planner',
      allPhasesCompleted: success,
      finalSuccess: success && meetsDeadline,
      explorePhaseCompleted: true,
      practicePhaseCompleted: true,
      applyPhaseCompleted: success,
      firstTaskQuestion: 'Which task starts first?',
      correctFirstTask: correctSeq[0] ?? '',
      studentFirstTask: schedule[0],
      firstTaskCorrect: schedule[0] === correctSeq[0],
      exploreAttempts: 1,
      practiceTasks: tasks.length,
      practiceSequenceCorrect: success,
      dependencyViolations: violations.length,
      practiceAttempts: attempts,
      totalTasks: tasks.length,
      correctlyOrderedTasks: correctCount,
      sequenceAccuracy: (correctCount / tasks.length) * 100,
      totalDependencyViolations: violations.length,
      criticalPathIdentified: parallelAllowed && scheduleWeeks <= totalWeeks + 1,
      usedDependencyArrows: true,
      parallelTasksIdentified: parallelAllowed ? tasks.filter(t =>
        tasks.some(other => other.id !== t.id &&
          JSON.stringify([...other.dependencies].sort()) === JSON.stringify([...t.dependencies].sort()) &&
          other.dependencies.length > 0),
      ).length : 0,
      sequentialTasksCorrect: correctCount,
      totalAttempts: attempts,
      tasksRearranged: rearrangeCount,
      animationUsed: true,
      studentSequence: schedule,
      correctSequence: correctSeq,
      dependenciesDrawn: [],
      solvedOnFirstTry: attempts === 1 && success,
      hintsUsed,
    };

    const score = success
      ? meetsDeadline ? 100 : Math.max(60, 100 - (scheduleWeeks - targetWeeks) * 5)
      : Math.max(0, (correctCount / tasks.length) * 60);

    submitEvaluation(success, Math.round(score), metrics, {
      studentWork: { schedule, scheduleWeeks, targetWeeks, attempts },
    });
  }, [schedule, tasks, attempts, hintsUsed, rearrangeCount, scheduleWeeks, targetWeeks,
    totalWeeks, parallelAllowed, hasSubmittedEvaluation, submitEvaluation]);

  // ---- Hint ----
  const handleHint = useCallback(() => {
    setHintsUsed(h => h + 1);
    const { violations } = validateSchedule(schedule, tasks);
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    if (violations.length > 0) {
      const v = violations[0];
      const task = taskMap.get(v.taskId);
      const dep = taskMap.get(v.missingDep);
      setFeedback(`${dep?.icon ?? '💡'} "${task?.name}" needs "${dep?.name}" done first. Try moving it earlier!`);
      setFeedbackType('info');
    } else if (scheduleWeeks > targetWeeks && parallelAllowed) {
      setFeedback(`💡 Your order is correct but takes ${scheduleWeeks} weeks. Look for tasks that can run in parallel to shorten the schedule!`);
      setFeedbackType('info');
    } else {
      setFeedback('💡 Your sequence looks good! Try building to see it come to life.');
      setFeedbackType('info');
    }

    sendText(
      `[HINT_REQUESTED] Student asked for hint. Schedule has ${violations.length} violations. ` +
      `Current duration: ${scheduleWeeks}w, target: ${targetWeeks}w. ` +
      `Give a brief, specific hint without revealing the answer.`,
      { silent: true },
    );
  }, [schedule, tasks, scheduleWeeks, targetWeeks, parallelAllowed, sendText]);

  // ---- Reset ----
  const handleReset = useCallback(() => {
    setPhase('plan');
    setSchedule([...tasks.map(t => t.id)].sort(() => Math.random() - 0.5));
    setAttempts(0);
    setRearrangeCount(0);
    setHintsUsed(0);
    setFeedback(null);
    setIsBuilding(false);
    setCurrentBuildIdx(-1);
    setCompletedTasks(new Set());
    setCompletedCategories(new Set());
    setFailedTask(null);
    setFailureFrame(0);
    setBuildFinished(false);
    setBuildSuccess(false);
    startTimeRef.current = Date.now();
    resetEvaluationAttempt();
  }, [tasks, resetEvaluationAttempt]);

  const handleBackToPlan = useCallback(() => {
    setPhase('plan');
    setIsBuilding(false);
    setCurrentBuildIdx(-1);
    setCompletedTasks(new Set());
    setCompletedCategories(new Set());
    setFailedTask(null);
    setFailureFrame(0);
    setBuildFinished(false);
    setBuildSuccess(false);
    setFeedback(null);
  }, []);

  // ---- Task map for lookups ----
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  // Send intro message
  useEffect(() => {
    sendText(
      `[INTRO] Student is planning a ${projectType} construction project with ${tasks.length} tasks. ` +
      `Target: ${targetWeeks} weeks. Grade ${gradeLevel}. ` +
      `Introduce the project briefly and encourage them to think about what needs to happen first.`,
      { silent: true },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`w-full ${className || ''}`}>
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-1">
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border-white/10">
              Engineering
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-mono bg-blue-500/20 text-blue-300 border-blue-500/30">
              Build It Right
            </Badge>
            {phase === 'plan' && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-mono bg-amber-500/20 text-amber-300 border-amber-500/30 ml-auto">
                {scheduleWeeks}w / {targetWeeks}w target
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl font-light text-white">{title}</CardTitle>
          <p className="text-slate-300 text-sm leading-relaxed">{description}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Build Scene Canvas */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/50">
            <canvas
              ref={canvasRef}
              width={SCENE_W}
              height={SCENE_H}
              className="w-full"
              style={{ imageRendering: 'auto' }}
            />
          </div>

          {/* === PLAN PHASE === */}
          {phase === 'plan' && (
            <>
              {/* Schedule / Task List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-200">
                    Drag tasks into the correct construction order:
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {tasks.length} tasks
                  </span>
                </div>
                {schedule.map((id, idx) => {
                  const task = taskMap.get(id);
                  if (!task) return null;
                  const isDropTarget = dropTargetIdx === idx;
                  const isDragged = draggedIdx === idx;
                  const catColor = CAT_COLORS[task.category];
                  // Check if this task has unmet deps in current schedule
                  const unmetDeps = task.dependencies.filter(dep => {
                    const depIdx = schedule.indexOf(dep);
                    return depIdx === -1 || depIdx > idx;
                  });

                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-move transition-all duration-200
                        ${isDragged ? 'opacity-30' : ''}
                        ${isDropTarget ? 'border-blue-400/50 bg-blue-500/10 scale-[1.02]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'}
                        ${unmetDeps.length > 0 ? 'border-l-2' : ''}
                      `}
                      style={unmetDeps.length > 0 ? { borderLeftColor: '#ef4444' } : undefined}
                    >
                      <div
                        className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 text-white"
                        style={{ backgroundColor: catColor + '40', border: `1.5px solid ${catColor}` }}
                      >
                        {idx + 1}
                      </div>
                      <span className="text-xl flex-shrink-0">{task.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-100 truncate">{task.name}</div>
                        {task.dependencies.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate">
                            Needs: {task.dependencies.map(d => taskMap.get(d)?.name ?? d).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 flex-shrink-0 w-8 text-right">
                        {task.duration}w
                      </div>
                      <div className="text-slate-600 flex-shrink-0">⠿</div>
                    </div>
                  );
                })}
              </div>

              {/* Gantt Preview */}
              {parallelAllowed && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                    Timeline Preview
                  </h3>
                  <GanttTimeline
                    tasks={tasks}
                    schedule={schedule}
                    criticalPath={criticalPath}
                    earliestStart={earliestStart}
                    totalWeeks={totalWeeks}
                    targetWeeks={targetWeeks}
                    isBuilding={false}
                    currentBuildTask={null}
                    completedTasks={new Set()}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={startBuild}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  ▶ Start Building
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleHint}
                  className="bg-white/5 border border-white/20 hover:bg-white/10"
                >
                  💡 Hint
                </Button>
              </div>
            </>
          )}

          {/* === BUILD PHASE === */}
          {phase === 'build' && (
            <>
              {/* Gantt with live progress */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  {isBuilding ? 'Building...' : buildSuccess ? 'Build Complete!' : 'Build Failed'}
                </h3>
                <GanttTimeline
                  tasks={tasks}
                  schedule={schedule}
                  criticalPath={criticalPath}
                  earliestStart={earliestStart}
                  totalWeeks={totalWeeks}
                  targetWeeks={targetWeeks}
                  isBuilding={isBuilding}
                  currentBuildTask={currentBuildIdx >= 0 ? schedule[currentBuildIdx] : null}
                  completedTasks={completedTasks}
                />
              </div>

              {/* Build status */}
              {buildFinished && (
                <div className="flex items-center gap-3">
                  {!buildSuccess && (
                    <Button
                      onClick={handleBackToPlan}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      ← Fix My Plan
                    </Button>
                  )}
                  {buildSuccess && !hasSubmittedEvaluation && scheduleWeeks > targetWeeks && (
                    <Button
                      onClick={handleBackToPlan}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      ← Optimize Schedule
                    </Button>
                  )}
                  {buildSuccess && hasSubmittedEvaluation && (
                    <Button
                      variant="ghost"
                      onClick={handleReset}
                      className="bg-white/5 border border-white/20 hover:bg-white/10"
                    >
                      🔄 Try Again
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`p-3 rounded-lg border text-sm transition-all duration-300 ${
              feedbackType === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : feedbackType === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}>
              {feedback}
            </div>
          )}

          {/* Critical Path Info (grades 3+) */}
          {parallelAllowed && phase === 'plan' && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs text-slate-400">
                <span className="text-amber-400 font-medium">Critical path</span>: the longest
                chain of tasks that can&apos;t be done in parallel. Your project can&apos;t finish
                faster than {totalWeeks} weeks no matter how you schedule.
                {totalWeeks <= targetWeeks
                  ? ' You can meet the deadline!'
                  : ` The deadline of ${targetWeeks} weeks is tight — you'll need to find parallel paths.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConstructionSequencePlanner;
