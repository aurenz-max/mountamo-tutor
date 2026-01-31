'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  usePrimitiveEvaluation,
  type ConstructionSequencePlannerMetrics,
} from '../../../evaluation';

/**
 * Construction Sequence Planner - Interactive timeline/flowchart tool for ordering construction tasks
 *
 * K-5 Engineering Primitive for understanding:
 * - First, then, last sequencing (K-1)
 * - Some things must wait (1-2)
 * - Dependency chains (2-3)
 * - Parallel vs sequential (3-4)
 * - Critical path basics (4-5)
 *
 * Real-world connections: construction projects, building houses, project management
 *
 * EVALUATION INTEGRATION:
 * - Three-phase learning: Explore (identify first) → Practice (order subset) → Apply (full sequence)
 * - Tracks sequence accuracy, dependency understanding, and critical path identification
 * - Submits evaluation metrics on successful completion
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

export interface ConstructionTask {
  id: string;
  name: string;
  duration: number;           // Duration in days/hours/units
  icon: string;               // Emoji icon for visual recognition
  description?: string;       // What this task involves
  dependencies: string[];     // Task IDs that must come before this one
}

export interface ConstructionSequencePlannerData {
  title: string;
  description: string;
  tasks: ConstructionTask[];                            // All construction tasks
  displayMode: 'list' | 'flowchart' | 'timeline';       // Visualization mode
  showDependencies: boolean;                            // Draw arrow connections
  validateSequence: boolean;                            // Check logical order
  animateSequence: boolean;                             // Play through build animation
  parallelAllowed: boolean;                             // Allow concurrent tasks (grades 3+)
  projectType: 'house' | 'bridge' | 'tower' | 'road' | 'playground';
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';       // For age-appropriate complexity

  // Evaluation integration (optional)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<ConstructionSequencePlannerMetrics>) => void;
}

interface ConstructionSequencePlannerProps {
  data: ConstructionSequencePlannerData;
  className?: string;
}

type LearningPhase = 'explore' | 'practice' | 'apply';

const ConstructionSequencePlanner: React.FC<ConstructionSequencePlannerProps> = ({ data, className }) => {
  const {
    title,
    description,
    tasks = [],
    displayMode = 'list',
    showDependencies = true,
    validateSequence = true,
    animateSequence = true,
    parallelAllowed = false,
    projectType = 'house',
    gradeLevel = '2',
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Learning phases state
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
  const [feedback, setFeedback] = useState<string>('');
  const [showHint, setShowHint] = useState(false);

  // Phase 1: Explore - Identify the first task
  const [selectedFirstTask, setSelectedFirstTask] = useState<string | null>(null);
  const [exploreAttempts, setExploreAttempts] = useState(0);

  // Phase 2: Practice - Order a subset of tasks (3-4 tasks)
  const practiceTasks = React.useMemo(() => tasks.slice(0, Math.min(4, tasks.length)), [tasks]);
  const [practiceSequence, setPracticeSequence] = useState<string[]>([]);
  const [practiceAttempts, setPracticeAttempts] = useState(0);

  // Phase 3: Apply - Full task sequencing
  const [fullSequence, setFullSequence] = useState<string[]>([]);
  const [drawnDependencies, setDrawnDependencies] = useState<Array<{ from: string; to: string }>>([]);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [tasksRearranged, setTasksRearranged] = useState(0);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAnimationStep, setCurrentAnimationStep] = useState(0);
  const [animationUsed, setAnimationUsed] = useState(false);

  // Hints
  const [hintsUsed, setHintsUsed] = useState(0);

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<ConstructionSequencePlannerMetrics>({
    primitiveType: 'construction-sequence-planner',
    instanceId: instanceId || `construction-sequence-planner-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // Initialize practice sequence with shuffled tasks
  useEffect(() => {
    if (practiceTasks.length > 0 && practiceSequence.length === 0 && currentPhase === 'practice') {
      const shuffled = [...practiceTasks.map(t => t.id)].sort(() => Math.random() - 0.5);
      setPracticeSequence(shuffled);
    }
  }, [practiceTasks, practiceSequence.length, currentPhase]);

  // Initialize full sequence with shuffled tasks
  useEffect(() => {
    if (tasks.length > 0 && fullSequence.length === 0) {
      const shuffled = [...tasks.map(t => t.id)].sort(() => Math.random() - 0.5);
      setFullSequence(shuffled);
    }
  }, [tasks, fullSequence.length]);

  // Find the correct first task (task with no dependencies)
  const getCorrectFirstTask = useCallback(() => {
    return tasks.find(t => t.dependencies.length === 0);
  }, [tasks]);

  // Get a valid correct sequence using topological sort
  const getCorrectSequence = useCallback((taskList: ConstructionTask[]) => {
    const result: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (taskId: string): boolean => {
      if (temp.has(taskId)) return false; // Cycle detected
      if (visited.has(taskId)) return true;

      temp.add(taskId);
      const task = taskList.find(t => t.id === taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (!visit(depId)) return false;
        }
      }
      temp.delete(taskId);
      visited.add(taskId);
      result.push(taskId);
      return true;
    };

    for (const task of taskList) {
      if (!visited.has(task.id)) {
        if (!visit(task.id)) {
          return []; // Cycle detected, return empty
        }
      }
    }

    return result;
  }, []);

  // Validate sequence for dependency violations
  const validateTaskSequence = useCallback((sequence: string[], taskList: ConstructionTask[]) => {
    let violations = 0;
    const taskMap = new Map(taskList.map(t => [t.id, t]));

    for (let i = 0; i < sequence.length; i++) {
      const taskId = sequence[i];
      const task = taskMap.get(taskId);
      if (!task) continue;

      // Check if all dependencies come before this task
      for (const depId of task.dependencies) {
        const depIndex = sequence.indexOf(depId);
        if (depIndex === -1 || depIndex >= i) {
          violations++;
        }
      }
    }

    return violations;
  }, []);

  // Phase 1: Check first task
  const handleCheckFirstTask = useCallback(() => {
    if (!selectedFirstTask) {
      setFeedback('Please select a task first!');
      return;
    }

    setExploreAttempts(prev => prev + 1);
    const correctFirst = getCorrectFirstTask();

    if (selectedFirstTask === correctFirst?.id) {
      setFeedback(`🎉 Correct! "${correctFirst.name}" has no dependencies, so it must come first!`);
      setTimeout(() => {
        // Initialize practice sequence when transitioning to practice phase
        if (practiceSequence.length === 0) {
          const shuffled = [...practiceTasks.map(t => t.id)].sort(() => Math.random() - 0.5);
          setPracticeSequence(shuffled);
        }
        setCurrentPhase('practice');
        setFeedback('');
      }, 2000);
    } else {
      const selectedTask = tasks.find(t => t.id === selectedFirstTask);
      if (selectedTask && selectedTask.dependencies.length > 0) {
        setFeedback(`❌ Not quite. "${selectedTask.name}" needs other tasks to be done first. Which task has nothing to wait for?`);
      } else {
        setFeedback('❌ Not quite. Try again!');
      }
    }
  }, [selectedFirstTask, getCorrectFirstTask, tasks]);

  // Phase 2: Check practice sequence
  const handleCheckPracticeSequence = useCallback(() => {
    setPracticeAttempts(prev => prev + 1);
    const violations = validateTaskSequence(practiceSequence, practiceTasks);

    if (violations === 0) {
      setFeedback('✅ Perfect! You ordered the tasks correctly! Now try ordering all the tasks.');
      setTimeout(() => {
        setCurrentPhase('apply');
        setFeedback('');
      }, 2500);
    } else {
      setFeedback(`❌ There ${violations === 1 ? 'is 1 dependency problem' : `are ${violations} dependency problems`}. Some tasks need others done first!`);
    }
  }, [practiceSequence, practiceTasks, validateTaskSequence]);

  // Phase 3: Submit final sequence
  const handleSubmitFinalSequence = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const violations = validateTaskSequence(fullSequence, tasks);
    const correctSeq = getCorrectSequence(tasks);
    const correctlyOrdered = fullSequence.filter((taskId, idx) => {
      // Check if this task's position respects all dependencies
      const task = tasks.find(t => t.id === taskId);
      if (!task) return false;

      for (const depId of task.dependencies) {
        const depIndex = fullSequence.indexOf(depId);
        if (depIndex >= idx) return false;
      }
      return true;
    }).length;

    const sequenceAccuracy = (correctlyOrdered / tasks.length) * 100;
    const success = violations === 0;

    // Check for critical path identification (grades 3-5)
    const criticalPathIdentified = gradeLevel >= '3' && parallelAllowed;

    const metrics: ConstructionSequencePlannerMetrics = {
      type: 'construction-sequence-planner',

      // Overall completion
      allPhasesCompleted: true,
      finalSuccess: success,

      // Phase completion
      explorePhaseCompleted: true,
      practicePhaseCompleted: true,
      applyPhaseCompleted: true,

      // Phase 1: Explore
      firstTaskQuestion: 'Which task must be done first?',
      correctFirstTask: getCorrectFirstTask()?.name || '',
      studentFirstTask: tasks.find(t => t.id === selectedFirstTask)?.name || null,
      firstTaskCorrect: selectedFirstTask === getCorrectFirstTask()?.id,
      exploreAttempts,

      // Phase 2: Practice
      practiceTasks: practiceTasks.length,
      practiceSequenceCorrect: validateTaskSequence(practiceSequence, practiceTasks) === 0,
      dependencyViolations: validateTaskSequence(practiceSequence, practiceTasks),
      practiceAttempts,

      // Phase 3: Apply
      totalTasks: tasks.length,
      correctlyOrderedTasks: correctlyOrdered,
      sequenceAccuracy,
      totalDependencyViolations: violations,
      criticalPathIdentified,

      // Approach
      usedDependencyArrows: showDependencies,
      parallelTasksIdentified: 0, // Could be enhanced with explicit parallel identification
      sequentialTasksCorrect: correctlyOrdered,

      // Interaction
      totalAttempts: exploreAttempts + practiceAttempts + 1,
      tasksRearranged,
      animationUsed,

      // Final sequence
      studentSequence: fullSequence,
      correctSequence: correctSeq,
      dependenciesDrawn: drawnDependencies,

      // Efficiency
      solvedOnFirstTry: exploreAttempts === 1 && practiceAttempts === 1 && violations === 0,
      hintsUsed,
    };

    const score = success ? 100 : Math.max(0, sequenceAccuracy - (violations * 5));

    submitEvaluation(success, score, metrics, {
      studentWork: {
        fullSequence,
        phases: {
          explore: { selectedFirstTask, attempts: exploreAttempts },
          practice: { sequence: practiceSequence, attempts: practiceAttempts },
          apply: { sequence: fullSequence, violations },
        },
      },
    });

    if (success) {
      setFeedback('🎉 Excellent! You correctly ordered all the construction tasks!');
    } else {
      setFeedback(`The sequence has ${violations} dependency issue${violations !== 1 ? 's' : ''}. Tasks need their dependencies completed first.`);
    }
  }, [
    fullSequence,
    tasks,
    validateTaskSequence,
    getCorrectSequence,
    hasSubmittedEvaluation,
    submitEvaluation,
    gradeLevel,
    parallelAllowed,
    getCorrectFirstTask,
    selectedFirstTask,
    exploreAttempts,
    practiceSequence,
    practiceTasks,
    practiceAttempts,
    tasksRearranged,
    animationUsed,
    drawnDependencies,
    showDependencies,
    hintsUsed,
  ]);

  // Drag and drop handlers
  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number, sequenceType: 'practice' | 'apply') => {
    if (!draggedTask) return;

    setTasksRearranged(prev => prev + 1);

    if (sequenceType === 'practice') {
      const newSequence = [...practiceSequence];
      const draggedIndex = newSequence.indexOf(draggedTask);
      if (draggedIndex !== -1) {
        newSequence.splice(draggedIndex, 1);
        newSequence.splice(targetIndex, 0, draggedTask);
        setPracticeSequence(newSequence);
      }
    } else {
      const newSequence = [...fullSequence];
      const draggedIndex = newSequence.indexOf(draggedTask);
      if (draggedIndex !== -1) {
        newSequence.splice(draggedIndex, 1);
        newSequence.splice(targetIndex, 0, draggedTask);
        setFullSequence(newSequence);
      }
    }

    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  // Animation
  const handleRunAnimation = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setAnimationUsed(true);
    setCurrentAnimationStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrentAnimationStep(step);
      if (step >= fullSequence.length) {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 1000);
  }, [isAnimating, fullSequence.length]);

  // Hint system
  const handleShowHint = () => {
    setShowHint(true);
    setHintsUsed(prev => prev + 1);

    if (currentPhase === 'explore') {
      const correctFirst = getCorrectFirstTask();
      setFeedback(`💡 Hint: Look for the task that doesn't need anything else done first. "${correctFirst?.name}" is a good place to start...`);
    } else if (currentPhase === 'practice') {
      setFeedback('💡 Hint: Check what each task needs. Put those tasks before the ones that depend on them!');
    } else {
      setFeedback('💡 Hint: Start with tasks that have no dependencies. Then add tasks whose dependencies are already in your sequence.');
    }
  };

  const handleReset = () => {
    setCurrentPhase('explore');
    setSelectedFirstTask(null);
    setPracticeSequence([...practiceTasks.map(t => t.id)].sort(() => Math.random() - 0.5));
    setFullSequence([...tasks.map(t => t.id)].sort(() => Math.random() - 0.5));
    setExploreAttempts(0);
    setPracticeAttempts(0);
    setTasksRearranged(0);
    setAnimationUsed(false);
    setHintsUsed(0);
    setFeedback('');
    setShowHint(false);
    resetEvaluationAttempt();
  };

  // Get task by ID
  const getTask = (taskId: string) => tasks.find(t => t.id === taskId);

  return (
    <div className={`w-full ${className || ''}`}>
      <div className="max-w-6xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15 bg-blue-500"
        />

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Engineering:</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-blue-500/20 text-blue-300 border-blue-500/30">
                CONSTRUCTION PLANNING
              </span>
            </div>
            <h2 className="text-3xl font-light text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>

          {/* Phase Progress Indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all duration-300 ${
              currentPhase === 'explore'
                ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                : currentPhase !== 'explore'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}>
              <span className="text-xl">{currentPhase === 'explore' ? '🔍' : '✅'}</span>
              <span className="font-medium text-sm">1. Explore</span>
            </div>
            <div className="text-slate-600">→</div>
            <div className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all duration-300 ${
              currentPhase === 'practice'
                ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                : currentPhase === 'apply'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}>
              <span className="text-xl">{currentPhase === 'apply' || currentPhase === 'practice' && practiceAttempts > 0 ? '✅' : '📝'}</span>
              <span className="font-medium text-sm">2. Practice</span>
            </div>
            <div className="text-slate-600">→</div>
            <div className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all duration-300 ${
              currentPhase === 'apply'
                ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}>
              <span className="text-xl">{hasSubmittedEvaluation ? '✅' : '🎯'}</span>
              <span className="font-medium text-sm">3. Apply</span>
            </div>
          </div>

          {/* Phase 1: Explore - Identify First Task */}
          {currentPhase === 'explore' && (
            <div className="glass-panel rounded-2xl border border-blue-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />

              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔍</span>
                  Step 1: Find the Starting Point
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  When building a {projectType}, which task must be done first? Look for the task that doesn't need anything else completed before it!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedFirstTask(task.id)}
                      className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                        selectedFirstTask === task.id
                          ? 'glass-panel border-blue-400/50 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{task.icon}</span>
                        <div>
                          <div className="font-medium text-white">{task.name}</div>
                          {task.dependencies.length > 0 && (
                            <div className="text-xs text-slate-400 mt-1">
                              Needs: {task.dependencies.map(depId => getTask(depId)?.name).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckFirstTask}
                  disabled={!selectedFirstTask}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* Phase 2: Practice - Order Subset */}
          {currentPhase === 'practice' && (
            <div className="glass-panel rounded-2xl border border-purple-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  Step 2: Practice Ordering
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Drag the tasks into the correct order. Remember: tasks must come after their dependencies!
                </p>

                <div className="space-y-3 mb-6">
                  {practiceSequence.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      Loading tasks...
                    </div>
                  ) : (
                    practiceSequence.map((taskId, index) => {
                      const task = getTask(taskId);
                      if (!task) return null;

                      return (
                        <div
                          key={taskId}
                          draggable
                          onDragStart={() => handleDragStart(taskId)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(index, 'practice')}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-4 p-4 glass-panel border border-white/20 rounded-xl cursor-move hover:border-purple-400/50 hover:shadow-lg transition-all duration-300 ${
                            draggedTask === taskId ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-center w-10 h-10 bg-purple-500/30 text-purple-200 font-bold rounded-full border-2 border-purple-400/50 flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-3xl flex-shrink-0">{task.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white text-lg">{task.name}</div>
                            {/* Dependencies hidden in practice phase - student needs to figure it out */}
                          </div>
                          <div className="text-slate-400 text-xl flex-shrink-0">☰</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={handleCheckPracticeSequence}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105"
                >
                  Check My Order
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: Apply - Full Sequence */}
          {currentPhase === 'apply' && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  Step 3: Complete the Full Sequence
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Now order all {tasks.length} tasks in the correct construction sequence!
                </p>

                <div className="space-y-3 mb-6">
                  {fullSequence.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      Loading tasks...
                    </div>
                  ) : (
                    fullSequence.map((taskId, index) => {
                      const task = getTask(taskId);
                      if (!task) return null;

                      const isBeingAnimated = isAnimating && index === currentAnimationStep - 1;
                      const hasBeenAnimated = isAnimating && index < currentAnimationStep;

                      return (
                        <div
                          key={taskId}
                          draggable
                          onDragStart={() => handleDragStart(taskId)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(index, 'apply')}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-4 p-4 border rounded-xl cursor-move transition-all duration-300 ${
                            draggedTask === taskId
                              ? 'opacity-50'
                              : isBeingAnimated
                              ? 'glass-panel bg-amber-500/20 border-amber-500/50 shadow-lg scale-105'
                              : hasBeenAnimated
                              ? 'glass-panel bg-emerald-500/10 border-emerald-500/30'
                              : 'glass-panel border-white/20 hover:border-emerald-400/50 hover:shadow-lg'
                          }`}
                        >
                          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/30 text-emerald-200 font-bold rounded-full border-2 border-emerald-400/50 flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-3xl flex-shrink-0">{task.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white text-lg">{task.name}</div>
                            {/* Dependencies hidden in apply phase - student needs to figure it out */}
                          </div>
                          {isBeingAnimated && <span className="text-2xl flex-shrink-0">⚙️</span>}
                          <div className="text-slate-400 text-xl flex-shrink-0">☰</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex gap-3">
                  {animateSequence && !hasSubmittedEvaluation && (
                    <button
                      onClick={handleRunAnimation}
                      disabled={isAnimating}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                    >
                      {isAnimating ? '▶️ Playing...' : '▶️ Animate Sequence'}
                    </button>
                  )}
                  <button
                    onClick={handleSubmitFinalSequence}
                    disabled={hasSubmittedEvaluation}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                  >
                    {hasSubmittedEvaluation ? '✓ Submitted' : 'Submit Final Sequence'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`p-4 rounded-xl mb-6 border transition-all duration-300 ${
              feedback.includes('🎉') || feedback.includes('✅')
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : feedback.includes('💡')
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {feedback}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              onClick={handleShowHint}
              className="px-5 py-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300"
            >
              💡 Show Hint
            </button>
            {hasSubmittedEvaluation && (
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                🔄 Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConstructionSequencePlanner;
