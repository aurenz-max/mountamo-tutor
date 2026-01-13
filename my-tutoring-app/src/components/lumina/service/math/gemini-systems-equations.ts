import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Systems of Equations Data Interface
 *
 * This matches the SystemsEquationsVisualizerData interface in the component
 */
export interface SystemEquation {
  expression: string;
  color?: string;
  label?: string;
  slope?: number;
  yIntercept?: number;
}

export interface IntersectionPoint {
  x: number;
  y: number;
  label?: string;
}

export interface AlgebraicStep {
  method: 'substitution' | 'elimination' | 'graphing';
  stepNumber: number;
  description: string;
  equation?: string;
}

export interface SystemsEquationsVisualizerData {
  title: string;
  description: string;
  equations: SystemEquation[];
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showGraph?: boolean;
  showAlgebraic?: boolean;
  solutionMethod?: 'graphing' | 'substitution' | 'elimination';
  highlightIntersection?: boolean;
  stepByStep?: boolean;
  intersectionPoint?: IntersectionPoint;
  algebraicSteps?: AlgebraicStep[];
  systemType?: 'one-solution' | 'no-solution' | 'infinite-solutions';
}

/**
 * Schema definition for Systems of Equations Visualizer
 *
 * This schema defines the structure for visualizing and solving systems of linear equations
 */
const systemsEquationsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the system of equations (e.g., 'Solving Systems by Graphing', 'Substitution Method')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn"
    },
    equations: {
      type: Type.ARRAY,
      description: "Array of 2-3 linear equations in the system. Use y = mx + b format.",
      items: {
        type: Type.OBJECT,
        properties: {
          expression: {
            type: Type.STRING,
            description: "The equation in y = mx + b format (e.g., 'y = 2*x + 1')"
          },
          color: {
            type: Type.STRING,
            description: "Hex color for the line (e.g., '#3b82f6', '#10b981')"
          },
          label: {
            type: Type.STRING,
            description: "Label for the equation (e.g., 'Equation 1', 'Line A')"
          },
          slope: {
            type: Type.NUMBER,
            description: "The slope of the line"
          },
          yIntercept: {
            type: Type.NUMBER,
            description: "The y-intercept of the line"
          }
        },
        required: ["expression"]
      }
    },
    xRange: {
      type: Type.ARRAY,
      description: "X-axis bounds [min, max]. Typically [-10, 10]",
      items: { type: Type.NUMBER }
    },
    yRange: {
      type: Type.ARRAY,
      description: "Y-axis bounds [min, max]. Typically [-10, 10]",
      items: { type: Type.NUMBER }
    },
    gridSpacing: {
      type: Type.OBJECT,
      description: "Grid line spacing. Default: {x: 1, y: 1}",
      properties: {
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER }
      }
    },
    showGraph: {
      type: Type.BOOLEAN,
      description: "Display the graphical representation. Default: true"
    },
    showAlgebraic: {
      type: Type.BOOLEAN,
      description: "Show algebraic solution panel. Default: true"
    },
    solutionMethod: {
      type: Type.STRING,
      description: "Primary solution method: 'graphing', 'substitution', or 'elimination'"
    },
    highlightIntersection: {
      type: Type.BOOLEAN,
      description: "Mark the intersection point(s). Default: true"
    },
    stepByStep: {
      type: Type.BOOLEAN,
      description: "Show solution steps incrementally. Default: false"
    },
    intersectionPoint: {
      type: Type.OBJECT,
      description: "The solution point where lines intersect",
      properties: {
        x: { type: Type.NUMBER, description: "X-coordinate of intersection" },
        y: { type: Type.NUMBER, description: "Y-coordinate of intersection" },
        label: { type: Type.STRING, description: "Optional label for the point" }
      }
    },
    algebraicSteps: {
      type: Type.ARRAY,
      description: "Step-by-step solution process",
      items: {
        type: Type.OBJECT,
        properties: {
          method: {
            type: Type.STRING,
            description: "Solution method: 'substitution', 'elimination', or 'graphing'"
          },
          stepNumber: {
            type: Type.NUMBER,
            description: "Step number in the sequence"
          },
          description: {
            type: Type.STRING,
            description: "Student-friendly description of this step"
          },
          equation: {
            type: Type.STRING,
            description: "The equation or expression at this step"
          }
        },
        required: ["method", "stepNumber", "description"]
      }
    },
    systemType: {
      type: Type.STRING,
      description: "Type of system: 'one-solution' (intersecting lines), 'no-solution' (parallel lines), or 'infinite-solutions' (same line)"
    }
  },
  required: ["title", "description", "equations", "xRange", "yRange"]
};

/**
 * Generate systems of equations visualizer data
 *
 * This function creates a complete system of equations visualization including:
 * - 2-3 linear equations
 * - Graphical representation
 * - Algebraic solution steps
 * - Intersection point(s)
 * - Educational context
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns SystemsEquationsVisualizerData with complete configuration
 */
export const generateSystemsEquations = async (
  topic: string,
  gradeLevel: string,
  config?: {
    equations?: SystemEquation[];
    solutionMethod?: 'graphing' | 'substitution' | 'elimination';
    showAlgebraic?: boolean;
    stepByStep?: boolean;
  }
): Promise<SystemsEquationsVisualizerData> => {
  const prompt = `
Create an educational systems of equations visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A system of equations is a set of two or more equations with the same variables
- The solution is the point(s) where all equations are true simultaneously
- For linear systems, this is where the lines intersect on a graph
- Three types of systems:
  1. One solution: Lines intersect at exactly one point
  2. No solution: Lines are parallel (never intersect)
  3. Infinite solutions: Lines are identical (same line)

GRADE LEVEL GUIDELINES:

**Grade 8**:
- Simple systems with integer solutions
- Focus on graphing method
- Solutions visible within [-10, 10] range
- Example: y = 2*x + 1 and y = -x + 4 (intersect at (1, 3))

**Algebra I**:
- Systems with integer or simple decimal solutions
- All three methods: graphing, substitution, elimination
- Include real-world context
- Example: y = 0.5*x + 2 and y = -x + 5

**Algebra II**:
- May include fractions or more complex solutions
- Emphasis on choosing efficient methods
- Include parallel and coincident lines
- May have 3 equations (rare, for advanced students)

SOLUTION METHODS:

**Graphing Method**:
- Plot both equations on the same coordinate plane
- Find the intersection point visually
- Verify by substitution
- Steps:
  1. Graph the first equation
  2. Graph the second equation on the same axes
  3. Identify the intersection point
  4. Check the solution in both equations

**Substitution Method**:
- Solve one equation for one variable
- Substitute into the other equation
- Solve for the remaining variable
- Back-substitute to find the other variable
- Steps example for y = 2*x + 1 and y = -x + 4:
  1. Both equations already solved for y
  2. Set them equal: 2*x + 1 = -x + 4
  3. Solve for x: 3*x = 3, so x = 1
  4. Substitute back: y = 2(1) + 1 = 3
  5. Solution: (1, 3)

**Elimination Method**:
- Multiply equations to make coefficients opposite
- Add equations to eliminate one variable
- Solve for remaining variable
- Back-substitute to find the other variable
- Steps example for 2*x + y = 5 and x - y = 1:
  1. Notice y and -y are already opposites
  2. Add equations: (2*x + y) + (x - y) = 5 + 1
  3. Simplify: 3*x = 6, so x = 2
  4. Substitute: 2(2) + y = 5, so y = 1
  5. Solution: (2, 1)

EQUATION FORMAT:
- Use standard form: y = mx + b
- Always use * for multiplication
- Examples:
  - y = 2*x + 1
  - y = -0.5*x + 3
  - y = x - 2

COLOR SCHEME:
- First equation: '#3b82f6' (blue)
- Second equation: '#10b981' (green)
- Third equation: '#f59e0b' (amber)

CREATING EDUCATIONAL SYSTEMS:

**For Graphing Method**:
- Choose equations with clear, distinct slopes
- Ensure intersection point is within the viewing window
- Use integer solutions when possible for grade 8
- Example: y = 2*x - 1 and y = -x + 5 (intersect at (2, 3))

**For Substitution Method**:
- At least one equation should be solved for y (or easily solvable)
- Choose numbers that work out nicely
- Example: y = 3*x - 2 and y = x + 4

**For Elimination Method**:
- May need to provide equations in standard form
- Choose coefficients that eliminate easily
- Example: 2*x + y = 7 and x - y = 2

**No Solution Example**:
- y = 2*x + 1 and y = 2*x - 3 (same slope, different intercepts)
- systemType: 'no-solution'
- Don't provide intersectionPoint

**Infinite Solutions Example**:
- y = 2*x + 1 and y = 2*x + 1 (identical equations)
- systemType: 'infinite-solutions'
- Every point on the line is a solution

ALGEBRAIC STEPS FORMAT:

For each step, provide:
- stepNumber: Sequential number (1, 2, 3, ...)
- description: Clear explanation of what's happening
- equation: The equation at this stage (optional but helpful)
- method: The solution method being used

Example substitution steps:
[
  {
    "method": "substitution",
    "stepNumber": 1,
    "description": "Write both original equations",
    "equation": "y = 2*x + 1 and y = -x + 4"
  },
  {
    "method": "substitution",
    "stepNumber": 2,
    "description": "Since both are solved for y, set them equal",
    "equation": "2*x + 1 = -x + 4"
  },
  {
    "method": "substitution",
    "stepNumber": 3,
    "description": "Add x to both sides",
    "equation": "3*x + 1 = 4"
  },
  {
    "method": "substitution",
    "stepNumber": 4,
    "description": "Subtract 1 from both sides",
    "equation": "3*x = 3"
  },
  {
    "method": "substitution",
    "stepNumber": 5,
    "description": "Divide both sides by 3",
    "equation": "x = 1"
  },
  {
    "method": "substitution",
    "stepNumber": 6,
    "description": "Substitute x = 1 into the first equation",
    "equation": "y = 2(1) + 1 = 3"
  },
  {
    "method": "substitution",
    "stepNumber": 7,
    "description": "The solution is the point (1, 3)",
    "equation": "(x, y) = (1, 3)"
  }
]

${config ? `
CONFIGURATION HINTS:
${config.solutionMethod ? `- Solution Method: ${config.solutionMethod}` : ''}
${config.showAlgebraic !== undefined ? `- Show Algebraic: ${config.showAlgebraic}` : ''}
${config.stepByStep !== undefined ? `- Step by Step: ${config.stepByStep}` : ''}
${config.equations ? `- Number of equations: ${config.equations.length}` : ''}
` : ''}

REQUIREMENTS:
1. Create 2-3 linear equations appropriate for the grade level
2. Calculate the intersection point (if it exists)
3. Set appropriate xRange and yRange (typically [-10, 10])
4. Provide complete algebraic steps for the specified method
5. Set correct systemType based on the equations
6. Include colors and labels for each equation
7. Make solutions educational and clear
8. Ensure numbers are student-friendly (prefer integers or simple decimals)

Return the complete systems of equations configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: systemsEquationsSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid systems equations data returned from Gemini API');
  }

  // Validation: ensure we have at least 2 equations
  if (!data.equations || data.equations.length < 2) {
    throw new Error('System must have at least 2 equations');
  }

  // Validation: ensure ranges are valid
  if (data.xRange[0] >= data.xRange[1]) {
    console.warn('Invalid xRange. Using default [-10, 10]');
    data.xRange = [-10, 10];
  }

  if (data.yRange[0] >= data.yRange[1]) {
    console.warn('Invalid yRange. Using default [-10, 10]');
    data.yRange = [-10, 10];
  }

  // Apply config overrides from manifest
  if (config) {
    if (config.solutionMethod) data.solutionMethod = config.solutionMethod;
    if (config.showAlgebraic !== undefined) data.showAlgebraic = config.showAlgebraic;
    if (config.stepByStep !== undefined) data.stepByStep = config.stepByStep;
    if (config.equations) data.equations = config.equations;
  }

  // Set defaults
  if (data.gridSpacing === undefined) data.gridSpacing = { x: 1, y: 1 };
  if (data.showGraph === undefined) data.showGraph = true;
  if (data.showAlgebraic === undefined) data.showAlgebraic = true;
  if (data.solutionMethod === undefined) data.solutionMethod = 'graphing';
  if (data.highlightIntersection === undefined) data.highlightIntersection = true;
  if (data.stepByStep === undefined) data.stepByStep = false;
  if (data.systemType === undefined) data.systemType = 'one-solution';

  return data;
};
