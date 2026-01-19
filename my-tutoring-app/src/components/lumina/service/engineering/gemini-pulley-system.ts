import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Pulley Position - represents a pulley in the system
 */
export interface PulleyPosition {
  id: string;
  x: number;           // X position (0-100 normalized)
  y: number;           // Y position (0-100 normalized)
  type: 'fixed' | 'movable';
  radius?: number;     // Visual radius
}

/**
 * Rope Segment - represents a section of rope in the system
 */
export interface RopeSegment {
  from: string;        // Pulley ID or 'anchor' or 'effort'
  to: string;          // Pulley ID or 'load'
  side?: 'left' | 'right'; // Which side of pulley rope goes through
}

/**
 * Pulley System Builder Data - complete configuration for pulley visualization
 */
export interface PulleySystemBuilderData {
  title: string;
  description: string;
  fixedPulleys: PulleyPosition[];      // Positions of fixed pulleys (attached to ceiling/frame)
  movablePulleys: PulleyPosition[];    // Positions of movable pulleys (attached to load)
  loadWeight: number;                   // Weight to lift in arbitrary units
  ropeConfiguration: RopeSegment[];     // Threading path
  showForceLabels: boolean;             // Display tension values
  showRopeSegments: boolean;            // Highlight and count segments
  maxPulleys: number;                   // Limit for building mode
  theme: 'crane' | 'flagpole' | 'well' | 'construction';
  allowAddPulleys?: boolean;            // Allow adding new pulleys
  effortForce?: number;                 // Current effort force applied
  showMechanicalAdvantage?: boolean;    // Display MA calculation
  liftHeight?: number;                  // How high the load has lifted (0-100)
}

/**
 * Schema definition for Pulley Position
 */
const pulleyPositionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for this pulley (e.g., 'fixed-1', 'movable-1')"
    },
    x: {
      type: Type.NUMBER,
      description: "X position normalized 0-100. 50 is center, 0 is far left, 100 is far right."
    },
    y: {
      type: Type.NUMBER,
      description: "Y position normalized 0-100. 0 is top (ceiling), 100 is bottom (near load)."
    },
    type: {
      type: Type.STRING,
      enum: ["fixed", "movable"],
      description: "Type of pulley: 'fixed' is attached to ceiling/frame, 'movable' moves with the load"
    },
    radius: {
      type: Type.NUMBER,
      description: "Visual radius of the pulley. Default is 25.",
      nullable: true
    }
  },
  required: ["id", "x", "y", "type"]
};

/**
 * Schema definition for Rope Segment
 */
const ropeSegmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    from: {
      type: Type.STRING,
      description: "Starting point: pulley ID, 'anchor', or 'effort'"
    },
    to: {
      type: Type.STRING,
      description: "Ending point: pulley ID or 'load'"
    },
    side: {
      type: Type.STRING,
      enum: ["left", "right"],
      description: "Which side of the pulley the rope wraps around",
      nullable: true
    }
  },
  required: ["from", "to"]
};

/**
 * Schema definition for Pulley System Builder Data
 */
const pulleySystemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the pulley system activity (e.g., 'Crane Lift Challenge!', 'How Does a Well Work?')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn and do. Use age-appropriate language."
    },
    fixedPulleys: {
      type: Type.ARRAY,
      items: pulleyPositionSchema,
      description: "Array of fixed pulleys attached to the ceiling/frame. These don't move."
    },
    movablePulleys: {
      type: Type.ARRAY,
      items: pulleyPositionSchema,
      description: "Array of movable pulleys that move with the load. These provide mechanical advantage."
    },
    loadWeight: {
      type: Type.NUMBER,
      description: "Weight of the load to lift in arbitrary units. Use 5-20 for elementary."
    },
    ropeConfiguration: {
      type: Type.ARRAY,
      items: ropeSegmentSchema,
      description: "Array defining how the rope is threaded through the system."
    },
    showForceLabels: {
      type: Type.BOOLEAN,
      description: "Show force and tension labels. True for grades 2+, false for K-1."
    },
    showRopeSegments: {
      type: Type.BOOLEAN,
      description: "Show and count rope segments. True for grades 3+ learning about MA."
    },
    maxPulleys: {
      type: Type.NUMBER,
      description: "Maximum number of pulleys allowed in building mode. 2-4 for elementary."
    },
    theme: {
      type: Type.STRING,
      enum: ["crane", "flagpole", "well", "construction"],
      description: "Visual theme. 'flagpole' for K-1, 'well' for historical context, 'crane'/'construction' for STEM focus."
    },
    allowAddPulleys: {
      type: Type.BOOLEAN,
      description: "Allow students to add/remove pulleys. True for exploration, false for guided challenges."
    },
    showMechanicalAdvantage: {
      type: Type.BOOLEAN,
      description: "Show mechanical advantage calculation. True for grades 3-5."
    },
    liftHeight: {
      type: Type.NUMBER,
      description: "Initial lift height (0-100). Usually start at 0.",
      nullable: true
    }
  },
  required: ["title", "description", "fixedPulleys", "movablePulleys", "loadWeight", "ropeConfiguration", "showForceLabels", "showRopeSegments", "maxPulleys", "theme"]
};

/**
 * Generate Pulley System Builder data for visualization
 *
 * Creates pulley system simulations appropriate for K-5 engineering education:
 * - K-1: Single pulley, direction change (flagpole theme)
 * - 1-2: Fixed vs movable pulley exploration
 * - 2-3: Multiple pulleys reduce effort
 * - 3-4: Counting rope segments for MA
 * - 4-5: Pulley system design challenges
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PulleySystemBuilderData with complete configuration
 */
export const generatePulleySystemBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PulleySystemBuilderData>
): Promise<PulleySystemBuilderData> => {

  const prompt = `
Create an educational Pulley System Builder visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - PULLEY BASICS:
A pulley is a wheel with a groove around its edge where a rope sits. Pulleys help us lift heavy things.

TWO TYPES OF PULLEYS:
1. FIXED PULLEY - Attached to ceiling/frame, doesn't move
   - Only changes direction of pull (pull down to lift up)
   - Mechanical Advantage = 1 (no force reduction)
   - Example: Flagpole pulley

2. MOVABLE PULLEY - Attached to the load, moves up/down with it
   - Reduces effort needed by half!
   - Mechanical Advantage = 2
   - Example: Part of a block and tackle

KEY PHYSICS:
- Mechanical Advantage (MA) = Load Weight ÷ Effort Force
- More rope segments supporting the load = Greater MA
- Trade-off: Less force required, but must pull more rope

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Theme: ALWAYS use 'flagpole' - familiar and simple
- Concept: A rope through a wheel helps us lift things / changes direction
- Setup: ONE fixed pulley only
- Load: Light (5-8 units), fun objects (flag, bucket)
- Features: showForceLabels: false, showRopeSegments: false, showMechanicalAdvantage: false
- Language: "Pull down on the rope to make the flag go UP!"
- allowAddPulleys: false
- maxPulleys: 1
- Example:
  - fixedPulleys: [{id: 'fixed-1', x: 50, y: 10, type: 'fixed'}]
  - movablePulleys: []
  - loadWeight: 5

GRADES 1-2 (ages 6-8):
- Theme: 'flagpole' or 'well'
- Concept: Fixed vs movable pulley - which is easier?
- Setup: Either one fixed OR one movable (compare in separate activities)
- Load: 6-10 units
- Features: showForceLabels: true (simple), showRopeSegments: false
- Language: "Which pulley makes lifting easier?"
- allowAddPulleys: true (to experiment)
- maxPulleys: 2
- Example with movable pulley:
  - fixedPulleys: []
  - movablePulleys: [{id: 'movable-1', x: 50, y: 60, type: 'movable'}]
  - loadWeight: 8

GRADES 2-3 (ages 7-9):
- Theme: 'well' or 'crane'
- Concept: Combining pulleys = less effort
- Setup: 1 fixed + 1 movable (block and tackle intro)
- Load: 10-15 units
- Features: showForceLabels: true, showRopeSegments: true
- Language: "Can you lift the heavy bucket with less force?"
- allowAddPulleys: true
- maxPulleys: 3
- Example:
  - fixedPulleys: [{id: 'fixed-1', x: 50, y: 10, type: 'fixed'}]
  - movablePulleys: [{id: 'movable-1', x: 50, y: 50, type: 'movable'}]
  - loadWeight: 12

GRADES 3-4 (ages 8-10):
- Theme: 'crane' or 'construction'
- Concept: Counting rope segments to find MA
- Setup: 1-2 fixed + 1-2 movable pulleys
- Load: 12-18 units
- Features: showForceLabels: true, showRopeSegments: true, showMechanicalAdvantage: true
- Language: "Count the rope segments supporting the load!"
- allowAddPulleys: true (design challenge)
- maxPulleys: 4
- Example:
  - fixedPulleys: [{id: 'fixed-1', x: 40, y: 10, type: 'fixed'}, {id: 'fixed-2', x: 60, y: 10, type: 'fixed'}]
  - movablePulleys: [{id: 'movable-1', x: 50, y: 50, type: 'movable'}]
  - loadWeight: 15

GRADES 4-5 (ages 9-11):
- Theme: 'crane' or 'construction'
- Concept: Engineering design - build a system with target MA
- Setup: Multiple pulleys, complex configurations
- Load: 15-20 units
- Features: ALL true
- Language: Technical vocabulary: "mechanical advantage", "effort", "load"
- Challenge: "Design a pulley system with MA of 4x"
- allowAddPulleys: true
- maxPulleys: 4
- Example complex system:
  - fixedPulleys: [{id: 'fixed-1', x: 30, y: 10, type: 'fixed'}, {id: 'fixed-2', x: 70, y: 10, type: 'fixed'}]
  - movablePulleys: [{id: 'movable-1', x: 40, y: 40, type: 'movable'}, {id: 'movable-2', x: 60, y: 60, type: 'movable'}]
  - loadWeight: 20

POSITIONING GUIDELINES:
- X coordinates: 0-100 (0=left, 50=center, 100=right)
- Y coordinates: 0-100 (0=top/ceiling, 100=bottom/ground)
- Fixed pulleys: Usually y=10-20 (near ceiling)
- Movable pulleys: Usually y=40-70 (middle area, above load)
- Space pulleys apart by at least 15-20 units for clarity

THEME CONTEXTS:
- 'flagpole': School flagpole, outdoor setting, raising a flag
- 'well': Old-fashioned well, bucket of water, historical
- 'crane': Construction crane, lifting heavy objects
- 'construction': Building site, orange/yellow colors, hard hats

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.fixedPulleys ? `- Fixed pulleys provided: ${JSON.stringify(config.fixedPulleys)}` : ''}
${config.movablePulleys ? `- Movable pulleys provided: ${JSON.stringify(config.movablePulleys)}` : ''}
${config.loadWeight ? `- Load weight: ${config.loadWeight}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
${config.showMechanicalAdvantage !== undefined ? `- Show MA: ${config.showMechanicalAdvantage}` : ''}
${config.allowAddPulleys !== undefined ? `- Allow adding: ${config.allowAddPulleys}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. All pulley positions must have x and y in range 0-100
2. Each pulley must have a unique id
3. Load weight must be positive (5-20 for elementary)
4. For K-1, only include fixed pulleys (no movable)
5. For grades 2+, include at least one movable pulley for MA > 1
6. Rope configuration should connect anchor → pulleys → load logically

EDUCATIONAL PRINCIPLES:
1. Start with concrete, familiar examples (flagpole, well)
2. Build from simple (K-1: direction change) to complex (4-5: MA calculations)
3. Use real-world connections throughout
4. Encourage experimentation ("What happens if...?")
5. Provide clear visual feedback on forces

Return a complete Pulley System Builder configuration appropriate for the grade level.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: pulleySystemSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Pulley System data returned from Gemini API');
  }

  // Validation: ensure arrays exist
  if (!data.fixedPulleys) data.fixedPulleys = [];
  if (!data.movablePulleys) data.movablePulleys = [];
  if (!data.ropeConfiguration) data.ropeConfiguration = [];

  // Validation: ensure load weight is reasonable
  if (!data.loadWeight || data.loadWeight < 1 || data.loadWeight > 50) {
    console.warn('Invalid loadWeight. Setting default.');
    data.loadWeight = 10;
  }

  // Validation: ensure all pulleys have valid positions
  const validatePulleys = (pulleys: PulleyPosition[]): PulleyPosition[] => {
    return pulleys.map((pulley, index) => ({
      ...pulley,
      id: pulley.id || `pulley-${index}`,
      x: Math.max(0, Math.min(100, pulley.x || 50)),
      y: Math.max(0, Math.min(100, pulley.y || 30)),
      type: pulley.type || 'fixed',
      radius: pulley.radius || 25
    }));
  };

  data.fixedPulleys = validatePulleys(data.fixedPulleys);
  data.movablePulleys = validatePulleys(data.movablePulleys);

  // Validation: ensure maxPulleys is reasonable
  if (!data.maxPulleys || data.maxPulleys < 1 || data.maxPulleys > 6) {
    data.maxPulleys = 4;
  }

  // Apply config overrides
  if (config) {
    if (config.fixedPulleys) data.fixedPulleys = config.fixedPulleys;
    if (config.movablePulleys) data.movablePulleys = config.movablePulleys;
    if (config.loadWeight !== undefined) data.loadWeight = config.loadWeight;
    if (config.ropeConfiguration) data.ropeConfiguration = config.ropeConfiguration;
    if (config.showForceLabels !== undefined) data.showForceLabels = config.showForceLabels;
    if (config.showRopeSegments !== undefined) data.showRopeSegments = config.showRopeSegments;
    if (config.maxPulleys !== undefined) data.maxPulleys = config.maxPulleys;
    if (config.theme) data.theme = config.theme;
    if (config.allowAddPulleys !== undefined) data.allowAddPulleys = config.allowAddPulleys;
    if (config.showMechanicalAdvantage !== undefined) data.showMechanicalAdvantage = config.showMechanicalAdvantage;
    if (config.liftHeight !== undefined) data.liftHeight = config.liftHeight;
  }

  // Set sensible defaults for optional fields
  if (data.allowAddPulleys === undefined) data.allowAddPulleys = true;
  if (data.showMechanicalAdvantage === undefined) data.showMechanicalAdvantage = false;
  if (data.liftHeight === undefined) data.liftHeight = 0;

  return data;
};
