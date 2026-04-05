import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// Import types from the component - single source of truth
import type {
  ConstructionSequencePlannerData,
  ConstructionTask,
  ConstructionChallenge,
} from '../../primitives/visual-primitives/engineering/ConstructionSequencePlanner';

// Re-export for convenience
export type { ConstructionSequencePlannerData, ConstructionTask };

// ============================================================================
// Eval Mode Challenge Type Docs
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  sequence: {
    promptDoc: 'Sequence: Generate 4-5 tasks in a clear linear chain with obvious physical dependencies. K-2 appropriate. Each task depends on exactly one predecessor.',
    schemaDescription: 'sequence — linear ordering of construction tasks',
  },
  dependency_chain: {
    promptDoc: 'Dependency Chain: Generate 5-6 tasks with branching or converging dependencies. Grade 2-3 appropriate. At least one task should depend on two predecessors.',
    schemaDescription: 'dependency_chain — order tasks with branching/converging dependencies',
  },
  parallel: {
    promptDoc: 'Parallel: Generate 6-8 tasks where 2-3 tasks can happen simultaneously after a common prerequisite. Include a tight deadline that REQUIRES parallel scheduling to meet. Grade 3-4.',
    schemaDescription: 'parallel — identify tasks that can happen at the same time',
  },
  critical_path: {
    promptDoc: 'Critical Path: Generate 8-10 tasks with complex dependencies, multiple parallel branches of different lengths. The critical path should not be obvious. Grade 4-5.',
    schemaDescription: 'critical_path — find the longest dependency chain determining project duration',
  },
  deadline: {
    promptDoc: 'Deadline: Generate tasks with a target deadline. Student must schedule efficiently (using parallel paths if allowed) to meet the deadline.',
    schemaDescription: 'deadline — optimize schedule to meet a time constraint',
  },
};

// ============================================================================
// Eval Mode → Task Count Mapping
// ============================================================================

function getTaskCountForEvalMode(evalMode: string | undefined, gradeLevel: string): { min: number; max: number } {
  switch (evalMode) {
    case 'sequence': return { min: 4, max: 5 };
    case 'dependency_chain': return { min: 5, max: 6 };
    case 'parallel': return { min: 6, max: 8 };
    case 'critical_path': return { min: 8, max: 10 };
    default: {
      // No eval mode — use grade level
      const g = gradeLevel === 'K' ? 0 : parseInt(gradeLevel, 10);
      if (g <= 1) return { min: 3, max: 4 };
      if (g <= 2) return { min: 4, max: 5 };
      if (g <= 3) return { min: 5, max: 6 };
      if (g <= 4) return { min: 6, max: 8 };
      return { min: 8, max: 10 };
    }
  }
}

// ============================================================================
// Gemini Schema — FLAT fields to avoid malformed nested arrays
// ============================================================================

/** Build a single flat task schema with the given index */
function taskFieldsForIndex(i: number, nullable: boolean): Record<string, Schema> {
  const wrap = (s: Schema): Schema => nullable ? { ...s, nullable: true } : s;
  return {
    [`task${i}Id`]: wrap({
      type: Type.STRING,
      description: `Task ${i} unique kebab-case ID (e.g., 'excavate', 'pour-foundation')`,
    }),
    [`task${i}Name`]: wrap({
      type: Type.STRING,
      description: `Task ${i} human-readable name`,
    }),
    [`task${i}Duration`]: wrap({
      type: Type.NUMBER,
      description: `Task ${i} duration in weeks (positive integer, 1-5)`,
    }),
    [`task${i}Icon`]: wrap({
      type: Type.STRING,
      description: `Task ${i} emoji icon`,
    }),
    [`task${i}Description`]: wrap({
      type: Type.STRING,
      description: `Task ${i} brief description of what this involves`,
    }),
    [`task${i}Dep0`]: {
      type: Type.STRING,
      nullable: true,
      description: `Task ${i} first dependency task ID (null if no dependencies)`,
    },
    [`task${i}Dep1`]: {
      type: Type.STRING,
      nullable: true,
      description: `Task ${i} second dependency task ID (null if fewer than 2 dependencies)`,
    },
    [`task${i}Category`]: wrap({
      type: Type.STRING,
      enum: ['foundation', 'structural', 'mechanical', 'finishing'],
      description: `Task ${i} category: foundation (site prep, base), structural (walls, roof, frame), mechanical (plumbing, electrical, HVAC), finishing (paint, windows, cleanup)`,
    }),
  };
}

// Build challenge fields (flat, up to 3 challenges)
function challengeFieldsForIndex(i: number, nullable: boolean): Record<string, Schema> {
  const wrap = (s: Schema): Schema => nullable ? { ...s, nullable: true } : s;
  return {
    [`challenge${i}Id`]: wrap({
      type: Type.STRING,
      description: `Challenge ${i} unique ID`,
    }),
    [`challenge${i}Type`]: wrap({
      type: Type.STRING,
      enum: ['sequence', 'critical_path', 'parallel', 'deadline'],
      description: `Challenge ${i} type`,
    }),
    [`challenge${i}Question`]: wrap({
      type: Type.STRING,
      description: `Challenge ${i} question text`,
    }),
    [`challenge${i}Hint`]: wrap({
      type: Type.STRING,
      description: `Challenge ${i} hint (helpful without giving answer)`,
    }),
  };
}

const TASK_REQUIRED_FIELDS = ['Id', 'Name', 'Duration', 'Icon', 'Description', 'Category'] as const;

/** Build schema with dynamic required task count based on eval mode */
function buildSchema(taskCount: { min: number; max: number }): Schema {
  const properties: Record<string, Schema> = {
    title: {
      type: Type.STRING,
      description: "Engaging title for the activity (e.g., 'Build a Treehouse!')",
    },
    description: {
      type: Type.STRING,
      description: "Educational description. Age-appropriate language.",
    },
    projectType: {
      type: Type.STRING,
      enum: ['house', 'bridge', 'tower', 'road', 'playground'],
      description: "Type of construction project",
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ['K', '1', '2', '3', '4', '5'],
      description: "Target grade level",
    },
  };

  const required: string[] = [
    'title', 'description', 'projectType', 'gradeLevel',
    'challenge0Id', 'challenge0Type', 'challenge0Question', 'challenge0Hint',
  ];

  // Tasks 0 through (min-1) are REQUIRED; min through (max-1) are nullable; max through 9 are nullable
  for (let i = 0; i < 10; i++) {
    const nullable = i >= taskCount.min;
    Object.assign(properties, taskFieldsForIndex(i, nullable));
    if (!nullable) {
      for (const suffix of TASK_REQUIRED_FIELDS) {
        required.push(`task${i}${suffix}`);
      }
    }
  }

  // Challenges 0-2: challenge 0 required, 1-2 nullable
  Object.assign(properties, challengeFieldsForIndex(0, false));
  Object.assign(properties, challengeFieldsForIndex(1, true));
  Object.assign(properties, challengeFieldsForIndex(2, true));

  return {
    type: Type.OBJECT,
    properties,
    required,
  };
}

// ============================================================================
// Post-Processing: Flat fields → structured data
// ============================================================================

const VALID_CATEGORIES = new Set(['foundation', 'structural', 'mechanical', 'finishing']);

interface RawGeminiResponse {
  title?: string;
  description?: string;
  projectType?: string;
  gradeLevel?: string;
  [key: string]: unknown;
}

function reconstructTasks(raw: RawGeminiResponse): ConstructionTask[] {
  const tasks: ConstructionTask[] = [];

  for (let i = 0; i < 10; i++) {
    const id = raw[`task${i}Id`] as string | undefined;
    const name = raw[`task${i}Name`] as string | undefined;
    const duration = raw[`task${i}Duration`] as number | undefined;
    const icon = raw[`task${i}Icon`] as string | undefined;
    const description = raw[`task${i}Description`] as string | undefined;
    const dep0 = raw[`task${i}Dep0`] as string | null | undefined;
    const dep1 = raw[`task${i}Dep1`] as string | null | undefined;
    const category = raw[`task${i}Category`] as string | undefined;

    // Skip if core required fields are missing
    if (!id || !name || !icon || !description || !category) {
      // Tasks 0-4 are required — if missing, this is a reject signal
      if (i < 5) {
        console.warn(`[ConstructionSequencePlanner] Task ${i} missing required fields — rejecting`);
        return []; // Signal to use fallback
      }
      continue; // Tasks 5-9 are optional
    }

    // Validate category
    if (!VALID_CATEGORIES.has(category)) {
      console.warn(`[ConstructionSequencePlanner] Task ${i} has invalid category "${category}" — rejecting task`);
      if (i < 5) return []; // Required task invalid
      continue;
    }

    // Validate duration
    const validDuration = (typeof duration === 'number' && duration > 0)
      ? Math.round(duration)
      : 1;

    // Collect dependencies (filter nulls/empty)
    const dependencies: string[] = [];
    if (dep0 && typeof dep0 === 'string' && dep0.trim()) dependencies.push(dep0.trim());
    if (dep1 && typeof dep1 === 'string' && dep1.trim()) dependencies.push(dep1.trim());

    tasks.push({
      id: id.trim(),
      name: name.trim(),
      duration: validDuration,
      icon: icon.trim(),
      description: description.trim(),
      dependencies,
      category: category as ConstructionTask['category'],
    });
  }

  return tasks;
}

function reconstructChallenges(raw: RawGeminiResponse): ConstructionChallenge[] {
  const challenges: ConstructionChallenge[] = [];
  const validTypes = new Set(['sequence', 'critical_path', 'parallel', 'deadline']);

  for (let i = 0; i < 3; i++) {
    const id = raw[`challenge${i}Id`] as string | undefined;
    const type = raw[`challenge${i}Type`] as string | undefined;
    const question = raw[`challenge${i}Question`] as string | undefined;
    const hint = raw[`challenge${i}Hint`] as string | undefined;

    if (!id || !type || !question || !hint) continue;
    if (!validTypes.has(type)) continue;

    challenges.push({
      id: id.trim(),
      type: type as ConstructionChallenge['type'],
      question: question.trim(),
      hint: hint.trim(),
    });
  }

  return challenges;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/** Validate all dependencies reference real task IDs */
function validateDependencyReferences(tasks: ConstructionTask[]): ConstructionTask[] {
  const taskIds = new Set(tasks.map(t => t.id));
  return tasks.map(t => ({
    ...t,
    dependencies: t.dependencies.filter(dep => taskIds.has(dep)),
  }));
}

/** Check that at least one task has no dependencies (starting point) */
function ensureStartingTask(tasks: ConstructionTask[]): ConstructionTask[] {
  const hasStart = tasks.some(t => t.dependencies.length === 0);
  if (hasStart) return tasks;

  // Force the first task to have no dependencies
  console.warn('[ConstructionSequencePlanner] No starting task found — clearing first task dependencies');
  return tasks.map((t, i) => i === 0 ? { ...t, dependencies: [] } : t);
}

/** Detect and break circular dependencies using DFS */
function breakCircularDependencies(tasks: ConstructionTask[]): ConstructionTask[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const temp = new Set<string>();
  const safeIds = new Set<string>();

  const visit = (id: string): boolean => {
    if (temp.has(id)) return false; // cycle detected
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
    safeIds.add(id);
    return true;
  };

  // Try topological sort — if it fails, break cycles
  for (const t of tasks) {
    if (!visited.has(t.id)) {
      if (!visit(t.id)) {
        // Cycle found — brute force: clear deps for tasks in the cycle
        console.warn('[ConstructionSequencePlanner] Circular dependency detected — breaking cycle');
        // Reset and try again, removing deps that create cycles
        return tasks.map(task => ({
          ...task,
          dependencies: task.dependencies.filter(dep => {
            // Keep dep only if dep appears before this task in the array
            const depIdx = tasks.findIndex(t2 => t2.id === dep);
            const taskIdx = tasks.findIndex(t2 => t2.id === task.id);
            return depIdx < taskIdx;
          }),
        }));
      }
    }
  }

  return tasks;
}

/** Compute critical path length (for targetWeeks calculation) */
function computeCriticalPathLength(tasks: ConstructionTask[]): number {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const memo = new Map<string, number>();

  const getEarliestFinish = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const task = taskMap.get(id);
    if (!task) return 0;

    let earliestStart = 0;
    for (const dep of task.dependencies) {
      earliestStart = Math.max(earliestStart, getEarliestFinish(dep));
    }
    const finish = earliestStart + task.duration;
    memo.set(id, finish);
    return finish;
  };

  let maxFinish = 0;
  for (const t of tasks) {
    maxFinish = Math.max(maxFinish, getEarliestFinish(t.id));
  }
  return maxFinish;
}

// ============================================================================
// Hardcoded Fallback — guaranteed valid data
// ============================================================================

/** Resolve gradeLevel to a valid enum value */
function resolveGradeLevel(gradeLevel: string): ConstructionSequencePlannerData['gradeLevel'] {
  const valid = new Set(['K', '1', '2', '3', '4', '5']);
  return valid.has(gradeLevel) ? (gradeLevel as ConstructionSequencePlannerData['gradeLevel']) : '2';
}

function getHouseFallback(gradeLevel: string, evalMode?: string): ConstructionSequencePlannerData {
  // Parallel fallback: 6 tasks with parallel branches
  if (evalMode === 'parallel') {
    const tasks: ConstructionTask[] = [
      { id: 'excavate', name: 'Excavate Site', duration: 1, icon: '🚜', description: 'Dig out the area where the house will go', dependencies: [], category: 'foundation' },
      { id: 'foundation', name: 'Pour Foundation', duration: 2, icon: '🏗️', description: 'Pour concrete for the base of the house', dependencies: ['excavate'], category: 'foundation' },
      { id: 'frame', name: 'Frame Walls', duration: 2, icon: '🔨', description: 'Build the wooden frame for walls', dependencies: ['foundation'], category: 'structural' },
      { id: 'plumbing', name: 'Install Plumbing', duration: 2, icon: '🚰', description: 'Run pipes for water and drains through the walls', dependencies: ['foundation'], category: 'mechanical' },
      { id: 'roof', name: 'Install Roof', duration: 1, icon: '🏠', description: 'Put the roof on top of the walls', dependencies: ['frame'], category: 'structural' },
      { id: 'paint', name: 'Paint & Finish', duration: 1, icon: '🎨', description: 'Paint the walls and add finishing touches', dependencies: ['roof', 'plumbing'], category: 'finishing' },
    ];
    return {
      title: 'Build a House — Parallel Planning',
      description: 'Some tasks can happen at the same time! Find which ones can be done in parallel to finish faster.',
      tasks,
      projectType: 'house',
      gradeLevel: resolveGradeLevel(gradeLevel),
      targetWeeks: 7, // critical path (1+2+2+1+1) + 1 buffer
      parallelAllowed: true,
      challenges: [
        { id: 'ch1', type: 'parallel', question: 'Which two tasks can happen at the same time after the foundation is poured?', hint: 'Look for tasks that both depend on the foundation but not on each other.' },
      ],
    };
  }

  // Critical path fallback: 8 tasks with complex deps
  if (evalMode === 'critical_path') {
    const tasks: ConstructionTask[] = [
      { id: 'excavate', name: 'Excavate Site', duration: 1, icon: '🚜', description: 'Dig out the area where the house will go', dependencies: [], category: 'foundation' },
      { id: 'foundation', name: 'Pour Foundation', duration: 2, icon: '🏗️', description: 'Pour concrete for the base', dependencies: ['excavate'], category: 'foundation' },
      { id: 'frame', name: 'Frame Walls', duration: 3, icon: '🔨', description: 'Build the wooden frame for walls', dependencies: ['foundation'], category: 'structural' },
      { id: 'plumbing', name: 'Install Plumbing', duration: 2, icon: '🚰', description: 'Run pipes through the walls', dependencies: ['foundation'], category: 'mechanical' },
      { id: 'electrical', name: 'Wire Electrical', duration: 2, icon: '💡', description: 'Install wiring in walls and ceilings', dependencies: ['frame'], category: 'mechanical' },
      { id: 'roof', name: 'Install Roof', duration: 2, icon: '🏠', description: 'Put the roof on top of the walls', dependencies: ['frame'], category: 'structural' },
      { id: 'windows', name: 'Install Windows', duration: 1, icon: '🪟', description: 'Fit windows into the wall frames', dependencies: ['roof', 'electrical'], category: 'finishing' },
      { id: 'paint', name: 'Paint & Finish', duration: 1, icon: '🎨', description: 'Final paint and cleanup', dependencies: ['windows', 'plumbing'], category: 'finishing' },
    ];
    return {
      title: 'Build a House — Critical Path Challenge',
      description: 'Find the longest chain of tasks that determines how fast we can build. That is the critical path!',
      tasks,
      projectType: 'house',
      gradeLevel: resolveGradeLevel(gradeLevel),
      targetWeeks: 13, // critical path (1+2+3+2+1+1) + 3 buffer
      parallelAllowed: true,
      challenges: [
        { id: 'ch1', type: 'critical_path', question: 'Which sequence of tasks takes the longest and controls the total build time?', hint: 'Trace every path from excavation to paint. Add up the weeks for each. The longest path is the critical path.' },
      ],
    };
  }

  // Default (sequence / dependency_chain) fallback: 5 linear tasks
  const tasks: ConstructionTask[] = [
    { id: 'excavate', name: 'Excavate Site', duration: 1, icon: '🚜', description: 'Dig out the area where the house will go', dependencies: [], category: 'foundation' },
    { id: 'foundation', name: 'Pour Foundation', duration: 2, icon: '🏗️', description: 'Pour concrete for the base of the house', dependencies: ['excavate'], category: 'foundation' },
    { id: 'frame', name: 'Frame Walls', duration: 2, icon: '🔨', description: 'Build the wooden frame for walls', dependencies: ['foundation'], category: 'structural' },
    { id: 'roof', name: 'Install Roof', duration: 1, icon: '🏠', description: 'Put the roof on top of the walls', dependencies: ['frame'], category: 'structural' },
    { id: 'paint', name: 'Paint & Finish', duration: 1, icon: '🎨', description: 'Paint the walls and add finishing touches', dependencies: ['roof'], category: 'finishing' },
  ];

  return {
    title: 'Build a House Step by Step',
    description: 'Plan the construction of a house by putting tasks in the right order!',
    tasks,
    projectType: 'house',
    gradeLevel: resolveGradeLevel(gradeLevel),
    targetWeeks: 9, // critical path (1+2+2+1+1) + 2 buffer
    parallelAllowed: false,
    challenges: [
      { id: 'ch1', type: 'sequence', question: 'Which task must happen first before anything else?', hint: 'Think about what you need to do to the ground before building.' },
    ],
  };
}

// ============================================================================
// Generator
// ============================================================================

export const generateConstructionSequencePlanner = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<ConstructionSequencePlannerData> => {
  const targetEvalMode = config?.targetEvalMode;

  // Resolve eval mode constraint from catalog
  const constraint = resolveEvalModeConstraint(
    'construction-sequence-planner',
    targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ConstructionSequencePlanner', targetEvalMode, constraint);

  const taskCount = getTaskCountForEvalMode(targetEvalMode, gradeLevel);
  const challengeTypeSection = buildChallengeTypePromptSection(constraint, CHALLENGE_TYPE_DOCS);

  // Determine parallelAllowed from eval mode first, then grade level as fallback.
  // When eval-test passes 'elementary' as gradeLevel, parseInt returns NaN,
  // so we must derive parallelAllowed from the eval mode itself.
  const gradeNum = gradeLevel === 'K' ? 0 : parseInt(gradeLevel, 10);
  const parallelAllowed = (targetEvalMode === 'parallel' || targetEvalMode === 'critical_path')
    ? true
    : (!isNaN(gradeNum) ? gradeNum >= 3 : false);

  const prompt = `
Create an educational Construction Sequence Planner for teaching "${topic}" to grade ${gradeLevel} students.

WHAT TO GENERATE:
A set of ${taskCount.min}-${taskCount.max} construction tasks for a building project. Each task has an ID, name, duration, icon, description, dependencies, and category.

TASK CATEGORIES (assign EXACTLY ONE per task):
- "foundation" — site prep, excavation, pouring foundation, grading
- "structural" — walls, roof, framing, supports, towers, deck
- "mechanical" — plumbing, electrical, HVAC, elevator
- "finishing" — paint, windows, doors, cleanup, inspection, landscaping

DEPENDENCY RULES:
- At least ONE task MUST have no dependencies (dep0 = null, dep1 = null) — this is the starting point
- Dependencies must reference other task IDs in this set
- Tasks should follow real construction logic (foundation before walls, walls before roof, etc.)
${parallelAllowed ? '- Include 2-3 tasks that can happen in PARALLEL (same dependencies, different work)' : '- Keep dependencies as a mostly linear chain — no parallel paths needed'}
${targetEvalMode === 'critical_path' ? '- Create multiple paths of DIFFERENT lengths so the critical path is not obvious' : ''}

DURATION RULES:
- Each task duration is in weeks (positive integer, 1-5)
- Vary durations to make scheduling interesting (not all the same)

ICON RULES:
- Use one distinct emoji per task: 🚜 🏗️ 🔨 🏠 🚰 💡 🧊 🔲 🪟 🚪 🎨 📐 🌳 🛤️ 🚧 🛝 ⛓️ 🔩 🛗 🏢 🚦 🛣️ ❄️

PROJECT TYPES: house, bridge, tower, road, playground — pick one appropriate for the topic.

${challengeTypeSection}

GRADE LANGUAGE:
${!isNaN(gradeNum) && gradeNum <= 1 ? 'Use very simple words. Short sentences. "First we dig! Then we build!"' : ''}
${!isNaN(gradeNum) && (gradeNum === 2 || gradeNum === 3) ? 'Clear explanations. "Some tasks need other tasks done first."' : ''}
${(isNaN(gradeNum) || gradeNum >= 4) ? 'More technical. Can mention "critical path", "parallel tasks", "dependencies".' : ''}

CRITICAL — TASK COUNT REQUIREMENT:
You MUST generate EXACTLY ${taskCount.min} to ${taskCount.max} tasks. Fill task0 through task${taskCount.max - 1}.
- You MUST populate ALL fields for task0 through task${taskCount.min - 1} (these are REQUIRED).
- Tasks task${taskCount.min} through task${taskCount.max - 1} are optional but encouraged.
- Leave task fields above task${taskCount.max - 1} as null.
- Do NOT generate fewer than ${taskCount.min} tasks — this will be rejected.

TASK FIELD NOTES:
- task[N]Id: unique kebab-case string (e.g., "pour-foundation", "frame-walls")
- task[N]Dep0, task[N]Dep1: reference OTHER task IDs, or null if no dependency
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildSchema(taskCount),
    },
  });

  const raw: RawGeminiResponse | null = result.text ? JSON.parse(result.text) : null;
  if (!raw) {
    console.warn('[ConstructionSequencePlanner] No data from Gemini — using fallback');
    return getHouseFallback(gradeLevel, targetEvalMode);
  }

  // ---- Reconstruct from flat fields ----
  let tasks = reconstructTasks(raw);

  // If reconstruction failed (missing required tasks), use fallback
  if (tasks.length === 0) {
    console.warn('[ConstructionSequencePlanner] Task reconstruction failed — using fallback');
    return getHouseFallback(gradeLevel, targetEvalMode);
  }

  // Validate minimum task count for the eval mode
  if (tasks.length < taskCount.min) {
    console.warn(
      `[ConstructionSequencePlanner] Gemini returned ${tasks.length} tasks but ${targetEvalMode ?? 'default'} requires ${taskCount.min}-${taskCount.max} — using fallback`
    );
    return getHouseFallback(gradeLevel, targetEvalMode);
  }

  // ---- Validation pipeline ----

  // 1. Validate dependency references (remove refs to non-existent tasks)
  tasks = validateDependencyReferences(tasks);

  // 2. Ensure at least one starting task
  tasks = ensureStartingTask(tasks);

  // 3. Break circular dependencies
  tasks = breakCircularDependencies(tasks);

  // 4. Re-validate deps after cycle breaking
  tasks = validateDependencyReferences(tasks);

  // 5. Compute targetWeeks from critical path + buffer (don't trust Gemini)
  const criticalPathLength = computeCriticalPathLength(tasks);
  const targetWeeks = criticalPathLength + Math.max(1, Math.floor(criticalPathLength * 0.3));

  // 6. Reconstruct challenges
  const challenges = reconstructChallenges(raw);

  // 7. Validate projectType
  const validProjectTypes = new Set(['house', 'bridge', 'tower', 'road', 'playground']);
  const projectType = validProjectTypes.has(raw.projectType ?? '')
    ? (raw.projectType as ConstructionSequencePlannerData['projectType'])
    : 'house';

  // 8. Validate gradeLevel
  const validGrades = new Set(['K', '1', '2', '3', '4', '5']);
  const resolvedGrade = validGrades.has(raw.gradeLevel ?? '')
    ? (raw.gradeLevel as ConstructionSequencePlannerData['gradeLevel'])
    : (validGrades.has(gradeLevel) ? gradeLevel as ConstructionSequencePlannerData['gradeLevel'] : '2');

  const data: ConstructionSequencePlannerData = {
    title: raw.title || `Build a ${projectType}!`,
    description: raw.description || 'Plan the construction by putting tasks in the right order!',
    tasks,
    projectType,
    gradeLevel: resolvedGrade,
    targetWeeks,
    parallelAllowed,
    challenges,
  };

  return data;
};
