import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  ConstructionSequencePlannerData,
  ConstructionTask,
} from '../../primitives/visual-primitives/engineering/ConstructionSequencePlanner';

// Re-export for convenience if needed elsewhere
export type { ConstructionSequencePlannerData, ConstructionTask };

/**
 * Schema for Construction Task
 */
const constructionTaskSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for the task (e.g., 'excavate', 'pour_foundation')"
    },
    name: {
      type: Type.STRING,
      description: "Human-readable task name (e.g., 'Excavate Site', 'Pour Foundation')"
    },
    duration: {
      type: Type.NUMBER,
      description: "Duration in days/hours/units (K-1: 1-2 units, grades 2-3: 1-5 units, grades 4-5: actual days/hours)"
    },
    icon: {
      type: Type.STRING,
      description: "Emoji icon representing the task. Examples: '🚜' excavate, '🏗️' foundation, '🔨' frame, '🏠' roof, '💡' electrical, '🚰' plumbing, '🪟' windows, '🎨' paint"
    },
    description: {
      type: Type.STRING,
      description: "Brief description of what this task involves",
      nullable: true
    },
    dependencies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of task IDs that must be completed before this task. Empty array [] means no dependencies (can start first)."
    }
  },
  required: ["id", "name", "duration", "icon", "dependencies"]
};

/**
 * Schema for Construction Sequence Planner Data
 */
const constructionSequencePlannerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the sequencing activity (e.g., 'Build a House Step by Step', 'Construction Project Planner')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn. Use age-appropriate language."
    },
    tasks: {
      type: Type.ARRAY,
      items: constructionTaskSchema,
      description: "Array of construction tasks. K-1: 3-4 tasks, grades 1-2: 4-5 tasks, grades 2-3: 5-6 tasks, grades 3-4: 6-8 tasks, grades 4-5: 8-10 tasks. MUST include at least one task with no dependencies (the starting point)."
    },
    displayMode: {
      type: Type.STRING,
      enum: ["list", "flowchart", "timeline"],
      description: "Visualization mode. 'list' for K-2 (simple), 'flowchart' for grades 2-3, 'timeline' for grades 4-5."
    },
    showDependencies: {
      type: Type.BOOLEAN,
      description: "Show dependency arrows/connections. False for K-1, true for grades 1+."
    },
    validateSequence: {
      type: Type.BOOLEAN,
      description: "Check for logical dependency violations. Always true."
    },
    animateSequence: {
      type: Type.BOOLEAN,
      description: "Enable step-by-step animation. True for all grades (kids love animation!)."
    },
    parallelAllowed: {
      type: Type.BOOLEAN,
      description: "Allow concurrent tasks discussion. False for K-2, true for grades 3+ (advanced concept)."
    },
    projectType: {
      type: Type.STRING,
      enum: ["house", "bridge", "tower", "road", "playground"],
      description: "Type of construction project. Determines task theme and icons."
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ["K", "1", "2", "3", "4", "5"],
      description: "Target grade level for appropriate complexity and language."
    }
  },
  required: ["title", "description", "tasks", "displayMode", "showDependencies", "validateSequence", "animateSequence", "parallelAllowed", "projectType", "gradeLevel"]
};

/**
 * Generate Construction Sequence Planner data for visualization
 *
 * Creates construction sequencing problems appropriate for K-5 engineering education:
 * - K-1: First, then, last (3-4 simple tasks)
 * - 1-2: Some things must wait (4-5 tasks with simple dependencies)
 * - 2-3: Dependency chains (5-6 tasks with multiple dependencies)
 * - 3-4: Parallel vs sequential (6-8 tasks, some can happen at same time)
 * - 4-5: Critical path basics (8-10 tasks, identify longest path)
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ConstructionSequencePlannerData with complete configuration
 */
export const generateConstructionSequencePlanner = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ConstructionSequencePlannerData>
): Promise<ConstructionSequencePlannerData> => {
  const prompt = `
Create an educational Construction Sequence Planner visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - CONSTRUCTION SEQUENCING:
Construction Sequence Planner teaches project planning and logical ordering through construction tasks:
1. DEPENDENCIES - Some tasks must wait for others to finish first
2. SEQUENCING - The order in which tasks must be done
3. CRITICAL PATH - The longest sequence of dependent tasks (grades 4-5)
4. PARALLEL WORK - Tasks that can happen at the same time (grades 3+)
5. FIRST/LAST - Identifying start and end points

KEY LEARNING OBJECTIVES BY GRADE:

KINDERGARTEN (ages 5-6):
- Concept: First, then, last
- Focus: Basic ordering - what comes first when building?
- Tasks: 3-4 very simple tasks with obvious order
- Example tasks for HOUSE:
  * id: "dig_hole", name: "Dig a Hole", icon: "🚜", dependencies: []
  * id: "put_blocks", name: "Stack Blocks", icon: "🧱", dependencies: ["dig_hole"]
  * id: "add_roof", name: "Put on Roof", icon: "🏠", dependencies: ["put_blocks"]
- displayMode: "list"
- showDependencies: false
- parallelAllowed: false
- Language: "Let's build a house! What do we do first? What comes next? What goes on last?"

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: Some things must wait
- Focus: Understanding basic dependencies (roof needs walls)
- Tasks: 4 simple tasks with clear physical dependencies
- Example tasks for HOUSE:
  * id: "clear_ground", name: "Clear the Ground", icon: "🌳", dependencies: []
  * id: "build_floor", name: "Build the Floor", icon: "🔲", dependencies: ["clear_ground"]
  * id: "build_walls", name: "Build the Walls", icon: "🧱", dependencies: ["build_floor"]
  * id: "add_roof", name: "Add the Roof", icon: "🏠", dependencies: ["build_walls"]
- displayMode: "list"
- showDependencies: true (simple arrows)
- parallelAllowed: false
- Language: "You can't put the roof on until the walls are up! Some things must wait for others."

GRADES 1-2 (ages 6-8):
- Concept: Dependency chains
- Focus: Multiple dependencies, longer chains
- Tasks: 4-5 tasks with some having 1-2 dependencies
- Example tasks for BRIDGE:
  * id: "survey_site", name: "Survey the Site", icon: "📐", dependencies: []
  * id: "clear_area", name: "Clear the Area", icon: "🌳", dependencies: []
  * id: "build_supports", name: "Build Support Towers", icon: "🏗️", dependencies: ["survey_site", "clear_area"]
  * id: "lay_deck", name: "Lay the Deck", icon: "🛤️", dependencies: ["build_supports"]
  * id: "add_rails", name: "Add Safety Rails", icon: "🚧", dependencies: ["lay_deck"]
- displayMode: "flowchart"
- showDependencies: true
- parallelAllowed: false
- Language: "Some tasks need TWO things done first! Make sure everything a task needs is finished before you do it."

GRADES 2-3 (ages 7-9):
- Concept: Complex dependencies
- Focus: Understanding that some tasks depend on multiple others
- Tasks: 5-6 tasks with varied dependency patterns
- Example tasks for HOUSE:
  * id: "excavate", name: "Excavate Site", icon: "🚜", dependencies: []
  * id: "pour_foundation", name: "Pour Foundation", icon: "🏗️", dependencies: ["excavate"]
  * id: "frame_walls", name: "Frame Walls", icon: "🔨", dependencies: ["pour_foundation"]
  * id: "roof", name: "Install Roof", icon: "🏠", dependencies: ["frame_walls"]
  * id: "rough_plumbing", name: "Rough Plumbing", icon: "🚰", dependencies: ["frame_walls"]
  * id: "drywall", name: "Hang Drywall", icon: "🔲", dependencies: ["rough_plumbing", "roof"]
- displayMode: "flowchart"
- showDependencies: true
- parallelAllowed: false (not explicitly teaching parallel yet)
- Language: "Plan out the construction! Some tasks need several things done first."

GRADES 3-4 (ages 8-10):
- Concept: Parallel vs Sequential tasks
- Focus: Identifying tasks that can happen at the same time
- Tasks: 6-8 tasks with opportunities for parallel work
- Example tasks for HOUSE:
  * id: "excavate", name: "Excavate Site", icon: "🚜", dependencies: []
  * id: "pour_foundation", name: "Pour Foundation", icon: "🏗️", dependencies: ["excavate"]
  * id: "frame_walls", name: "Frame Walls", icon: "🔨", dependencies: ["pour_foundation"]
  * id: "roof", name: "Install Roof", icon: "🏠", dependencies: ["frame_walls"]
  * id: "rough_electrical", name: "Rough Electrical", icon: "💡", dependencies: ["frame_walls"] (parallel with plumbing!)
  * id: "rough_plumbing", name: "Rough Plumbing", icon: "🚰", dependencies: ["frame_walls"] (parallel with electrical!)
  * id: "insulation", name: "Install Insulation", icon: "🧊", dependencies: ["rough_electrical", "rough_plumbing", "roof"]
  * id: "drywall", name: "Hang Drywall", icon: "🔲", dependencies: ["insulation"]
- displayMode: "flowchart"
- showDependencies: true
- parallelAllowed: true
- Language: "Some tasks can happen at the SAME TIME! Electrical and plumbing can both be done after framing."

GRADES 4-5 (ages 9-11):
- Concept: Critical path and project scheduling
- Focus: Identifying the longest sequence of dependencies (critical path)
- Tasks: 8-10 tasks with complex dependencies
- Example tasks for HOUSE:
  * id: "excavate", name: "Excavate Site", icon: "🚜", dependencies: [], duration: 2
  * id: "pour_foundation", name: "Pour Foundation", icon: "🏗️", dependencies: ["excavate"], duration: 3
  * id: "frame_walls", name: "Frame Walls", icon: "🔨", dependencies: ["pour_foundation"], duration: 5
  * id: "roof", name: "Install Roof", icon: "🏠", dependencies: ["frame_walls"], duration: 3
  * id: "rough_electrical", name: "Rough Electrical", icon: "💡", dependencies: ["frame_walls"], duration: 2
  * id: "rough_plumbing", name: "Rough Plumbing", icon: "🚰", dependencies: ["frame_walls"], duration: 2
  * id: "hvac", name: "Install HVAC", icon: "❄️", dependencies: ["frame_walls"], duration: 3
  * id: "insulation", name: "Install Insulation", icon: "🧊", dependencies: ["rough_electrical", "rough_plumbing", "hvac", "roof"], duration: 2
  * id: "drywall", name: "Hang Drywall", icon: "🔲", dependencies: ["insulation"], duration: 3
  * id: "finish_work", name: "Finish Work & Paint", icon: "🎨", dependencies: ["drywall"], duration: 4
- displayMode: "timeline"
- showDependencies: true
- parallelAllowed: true
- Language: "Plan the entire project! Find the critical path - the longest chain of tasks that determines how fast the project can be done."

TASK CONFIGURATION GUIDELINES BY PROJECT TYPE:

HOUSE PROJECT:
Common tasks: excavate, pour_foundation, frame_walls, roof, rough_plumbing, rough_electrical, insulation, drywall, windows, doors, finish_work, paint
Icons: 🚜 excavate, 🏗️ foundation, 🔨 framing, 🏠 roof, 🚰 plumbing, 💡 electrical, 🧊 insulation, 🔲 drywall, 🪟 windows, 🚪 doors, 🎨 paint

BRIDGE PROJECT:
Common tasks: survey_site, clear_area, build_supports, build_towers, install_cables, lay_deck, add_rails, paving, inspection
Icons: 📐 survey, 🌳 clear, 🏗️ supports, ⛓️ cables, 🛤️ deck, 🚧 rails, 🛣️ paving

TOWER PROJECT:
Common tasks: excavate, deep_foundation, concrete_base, steel_frame_lower, steel_frame_upper, elevator_shaft, floor_installation, exterior_walls, windows, roofing
Icons: 🚜 excavate, 🏗️ foundation, 🔩 steel, 🛗 elevator, 🏢 floors, 🪟 windows, 🏠 roof

PLAYGROUND PROJECT:
Common tasks: level_ground, install_posts, build_platform, add_slide, add_swings, add_monkey_bars, surface_material, safety_inspection
Icons: 🌳 clear, 🔨 posts, 🔲 platform, 🛝 slide, ⛓️ swings, 🎯 monkey_bars, 🟢 surface

ROAD PROJECT:
Common tasks: survey_route, clear_land, grade_surface, drainage, base_layer, asphalt_layer, road_markings, signage
Icons: 📐 survey, 🌳 clear, 🚜 grade, 🚰 drainage, 🛤️ base, 🛣️ asphalt, ➡️ markings, 🚦 signs

DEPENDENCY PATTERNS TO USE:

LINEAR CHAIN (simple):
A → B → C → D
Example: excavate → foundation → walls → roof

BRANCHING (grades 2+):
A → B → C
     B → D
Example: foundation → walls → roof
                  walls → plumbing

CONVERGING (grades 2+):
A → C
B → C
Example: electrical → insulation
         plumbing → insulation

PARALLEL (grades 3+):
    A → B
    A → C
    B → D
    C → D
Example: framing → electrical → insulation
         framing → plumbing → insulation

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.tasks ? `- Tasks provided: ${config.tasks.length} tasks` : ''}
${config.projectType ? `- Project type: ${config.projectType}` : ''}
${config.gradeLevel ? `- Grade level: ${config.gradeLevel}` : ''}
${config.displayMode ? `- Display mode: ${config.displayMode}` : ''}
${config.parallelAllowed !== undefined ? `- Parallel allowed: ${config.parallelAllowed}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. Tasks array must have at least one task with dependencies: [] (the starting point)
2. No circular dependencies (A depends on B which depends on A)
3. Task count must match grade level complexity
4. All dependency IDs must reference valid tasks in the array
5. Icons should be diverse and visually distinct
6. Task names should be clear and age-appropriate
7. Dependencies should form logical construction sequences

Return a complete Construction Sequence Planner configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: constructionSequencePlannerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Construction Sequence Planner data returned from Gemini API');
  }

  // Validation: ensure tasks exist and have at least one with no dependencies
  if (!data.tasks || data.tasks.length === 0) {
    console.warn('No tasks provided. Setting defaults.');
    data.tasks = [
      { id: 'excavate', name: 'Excavate Site', icon: '🚜', duration: 1, dependencies: [] },
      { id: 'foundation', name: 'Pour Foundation', icon: '🏗️', duration: 2, dependencies: ['excavate'] },
      { id: 'walls', name: 'Build Walls', icon: '🔨', duration: 3, dependencies: ['foundation'] },
      { id: 'roof', name: 'Install Roof', icon: '🏠', duration: 2, dependencies: ['walls'] },
    ];
  }

  // Validation: ensure at least one task has no dependencies
  const hasStartingTask = data.tasks.some((t: ConstructionTask) => t.dependencies.length === 0);
  if (!hasStartingTask) {
    console.warn('No starting task found. Adding excavate as first task.');
    data.tasks = [
      { id: 'start', name: 'Start Project', icon: '🚦', duration: 1, dependencies: [] },
      ...data.tasks,
    ];
  }

  // Validation: check for circular dependencies
  const hasCycle = (taskId: string, visited: Set<string>, temp: Set<string>): boolean => {
    if (temp.has(taskId)) return true;
    if (visited.has(taskId)) return false;

    temp.add(taskId);
    const task = data.tasks.find((t: ConstructionTask) => t.id === taskId);
    if (task) {
      for (const depId of task.dependencies) {
        if (hasCycle(depId, visited, temp)) return true;
      }
    }
    temp.delete(taskId);
    visited.add(taskId);
    return false;
  };

  const visited = new Set<string>();
  const temp = new Set<string>();
  for (const task of data.tasks) {
    if (hasCycle(task.id, visited, temp)) {
      console.warn('Circular dependency detected. Removing some dependencies.');
      // Simple fix: remove dependencies from last task
      data.tasks[data.tasks.length - 1].dependencies = [];
    }
  }

  // Validation: ensure all dependency IDs are valid
  const taskIds = new Set(data.tasks.map((t: ConstructionTask) => t.id));
  data.tasks = data.tasks.map((task: ConstructionTask) => ({
    ...task,
    dependencies: task.dependencies.filter(depId => taskIds.has(depId)),
  }));

  // Validation: ensure displayMode is valid
  if (!['list', 'flowchart', 'timeline'].includes(data.displayMode)) {
    data.displayMode = 'list';
  }

  // Validation: ensure projectType is valid
  if (!['house', 'bridge', 'tower', 'road', 'playground'].includes(data.projectType)) {
    data.projectType = 'house';
  }

  // Validation: ensure gradeLevel is valid
  if (!['K', '1', '2', '3', '4', '5'].includes(data.gradeLevel)) {
    data.gradeLevel = '2';
  }

  // Set sensible defaults
  if (data.validateSequence === undefined) data.validateSequence = true;
  if (data.animateSequence === undefined) data.animateSequence = true;

  // Apply config overrides
  if (config) {
    if (config.tasks) data.tasks = config.tasks;
    if (config.displayMode) data.displayMode = config.displayMode;
    if (config.showDependencies !== undefined) data.showDependencies = config.showDependencies;
    if (config.validateSequence !== undefined) data.validateSequence = config.validateSequence;
    if (config.animateSequence !== undefined) data.animateSequence = config.animateSequence;
    if (config.parallelAllowed !== undefined) data.parallelAllowed = config.parallelAllowed;
    if (config.projectType) data.projectType = config.projectType;
    if (config.gradeLevel) data.gradeLevel = config.gradeLevel;
  }

  return data;
};
