import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Coordinate Graph Data Interface
 *
 * This matches the CoordinateGraphData interface in the component
 */
export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface Line {
  type: 'line' | 'segment' | 'ray';
  point1: Point;
  point2: Point;
  color?: string;
  label?: string;
}

export interface GraphAnnotation {
  x: number;
  y: number;
  text: string;
  type: 'intercept' | 'vertex' | 'intersection' | 'feature' | 'point-of-interest';
  color?: string;
}

export interface Equation {
  expression: string;
  color?: string;
  label?: string;

  // Educational enhancements
  slope?: number;
  yIntercept?: number;
  conceptFocus?: 'slope' | 'intercept' | 'intersection' | 'transformation' | 'general';
  realWorldContext?: string;
  slopeInterpretation?: string;
  interceptInterpretation?: string;
  annotations?: GraphAnnotation[];
}

export interface Region {
  inequality: string;
  color?: string;
  fillOpacity?: number;
}

export interface CoordinateGraphData {
  title: string;
  description: string;
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showAxes?: boolean;
  showGrid?: boolean;
  plotMode?: 'points' | 'freehand' | 'equation';
  equations?: Equation[];
  points?: Point[];
  lines?: Line[];
  regions?: Region[];
  traceEnabled?: boolean;
  showIntercepts?: boolean;
  allowZoom?: boolean;
}

/**
 * Schema definition for Coordinate Graph Data
 *
 * This schema defines the structure for a 2D Cartesian coordinate plane
 * with support for points, lines, equations, and regions.
 */
const coordinateGraphSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the coordinate graph (e.g., 'Graphing Linear Equations', 'Plotting Points')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this graph"
    },
    xRange: {
      type: Type.ARRAY,
      description: "Horizontal bounds [min, max]. Choose range based on the concepts being taught.",
      items: {
        type: Type.NUMBER
      }
    },
    yRange: {
      type: Type.ARRAY,
      description: "Vertical bounds [min, max]. Choose range based on the concepts being taught.",
      items: {
        type: Type.NUMBER
      }
    },
    gridSpacing: {
      type: Type.OBJECT,
      description: "Grid line intervals. Default: {x: 1, y: 1}",
      properties: {
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER }
      }
    },
    showAxes: {
      type: Type.BOOLEAN,
      description: "Display x and y axes. Default: true"
    },
    showGrid: {
      type: Type.BOOLEAN,
      description: "Display background grid. Default: true"
    },
    plotMode: {
      type: Type.STRING,
      description: "Interaction mode: 'points' for plotting discrete points, 'equation' for graphing functions. Default: 'points'"
    },
    equations: {
      type: Type.ARRAY,
      description: "Functions to graph. Use y= format. Example: 'y = 2*x + 1'",
      items: {
        type: Type.OBJECT,
        properties: {
          expression: {
            type: Type.STRING,
            description: "The equation in y= format (e.g., 'y = 2*x + 1')"
          },
          color: {
            type: Type.STRING,
            description: "Hex color for the line (e.g., '#3b82f6')"
          },
          label: {
            type: Type.STRING,
            description: "Short label for the equation (e.g., 'Line 1')"
          },
          slope: {
            type: Type.NUMBER,
            description: "The slope of the line (for linear equations). Extract from expression."
          },
          yIntercept: {
            type: Type.NUMBER,
            description: "The y-intercept of the line (where it crosses y-axis). Extract from expression."
          },
          conceptFocus: {
            type: Type.STRING,
            description: "Primary concept this equation demonstrates: 'slope', 'intercept', 'intersection', 'transformation', or 'general'"
          },
          realWorldContext: {
            type: Type.STRING,
            description: "Real-world context for the equation (e.g., 'A taxi charges $2 per mile plus $1 base fee')"
          },
          slopeInterpretation: {
            type: Type.STRING,
            description: "Student-friendly explanation of the slope (e.g., 'For every 1 unit right, go up 2 units')"
          },
          interceptInterpretation: {
            type: Type.STRING,
            description: "Student-friendly explanation of the y-intercept (e.g., 'The starting value when x = 0')"
          },
          annotations: {
            type: Type.ARRAY,
            description: "Educational annotations to place on the graph at specific points",
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER, description: "X coordinate" },
                y: { type: Type.NUMBER, description: "Y coordinate" },
                text: { type: Type.STRING, description: "Annotation text" },
                type: {
                  type: Type.STRING,
                  description: "Type of annotation: 'intercept', 'vertex', 'intersection', 'feature', or 'point-of-interest'"
                },
                color: { type: Type.STRING, description: "Optional color for annotation" }
              },
              required: ["x", "y", "text", "type"]
            }
          }
        },
        required: ["expression"]
      }
    },
    points: {
      type: Type.ARRAY,
      description: "Discrete points to plot initially",
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          label: { type: Type.STRING }
        },
        required: ["x", "y"]
      }
    },
    lines: {
      type: Type.ARRAY,
      description: "Lines, segments, or rays to draw",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          point1: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER }
            }
          },
          point2: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER }
            }
          },
          color: { type: Type.STRING },
          label: { type: Type.STRING }
        }
      }
    },
    traceEnabled: {
      type: Type.BOOLEAN,
      description: "Allow curve tracing with mouse hover. Default: true"
    },
    showIntercepts: {
      type: Type.BOOLEAN,
      description: "Highlight x and y intercepts. Default: false"
    },
    allowZoom: {
      type: Type.BOOLEAN,
      description: "Enable zoom controls. Default: true"
    }
  },
  required: ["title", "description", "xRange", "yRange"]
};

/**
 * Generate coordinate graph data for visualization
 *
 * This function creates coordinate graph data including:
 * - Appropriate axis ranges for the topic and grade level
 * - Equations to graph based on mathematical concepts
 * - Initial points for ordered pair practice
 * - Educational context and descriptions
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns CoordinateGraphData with complete configuration
 */
export const generateCoordinateGraph = async (
  topic: string,
  gradeLevel: string,
  config?: {
    xRange?: [number, number];
    yRange?: [number, number];
    plotMode?: 'points' | 'freehand' | 'equation';
    equations?: Equation[];
    showIntercepts?: boolean;
  }
): Promise<CoordinateGraphData> => {
  const prompt = `
Create an educational coordinate graph visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A coordinate graph (Cartesian plane) is a 2D grid with x and y axes
- Students plot points using (x, y) ordered pairs
- Lines and curves can be drawn to show relationships
- Functions can be graphed by plotting many points that satisfy an equation

GUIDELINES FOR GRADE LEVELS:
- Grades 4-5: Introduction to ordered pairs, simple points in first quadrant (x: 0-10, y: 0-10)
- Grades 5-6: All four quadrants, plotting points, reading coordinates (x: -5 to 5, y: -5 to 5)
- Grades 6-7: Simple linear relationships, patterns, basic graphing (x: -10 to 10, y: -10 to 10)
- Grades 7-8: Linear equations, slope, intercepts, systems of equations
- Algebra I: Linear functions, slope-intercept form, point-slope form
- Algebra II: Quadratic functions, exponential functions, systems
- Precalculus: Function families, transformations, trigonometric functions

TOPIC-SPECIFIC GUIDANCE:

**Ordered Pairs & Plotting Points (Grades 4-6)**:
- xRange: [0, 10] or [-5, 5]
- yRange: [0, 10] or [-5, 5]
- plotMode: 'points'
- Provide 3-5 sample points with labels (A, B, C, etc.)
- Grid spacing: {x: 1, y: 1}
- Focus: Understanding (x, y) notation, locating points

**Linear Equations (Grades 7-8)**:
- xRange: [-10, 10]
- yRange: [-10, 10]
- plotMode: 'equation'
- Include 1-2 linear equations (y = mx + b format)
- showIntercepts: true
- Colors: Use distinct colors for multiple lines
- Example equations: "y = 2*x + 1", "y = -0.5*x + 3"

**Slope and Intercepts (Grades 8-Algebra)**:
- xRange: [-10, 10]
- yRange: [-10, 10]
- Include equations with clear slopes and intercepts
- showIntercepts: true
- Label equations with slope information

**Systems of Equations (Algebra)**:
- xRange: [-10, 10]
- yRange: [-10, 10]
- Include 2-3 linear equations that intersect
- Different colors for each line
- showIntercepts: true
- Labels should indicate the system being solved

**Quadratic Functions (Algebra II)**:
- xRange: [-10, 10]
- yRange: [-20, 20] (adjust for vertex)
- Equations: "y = x**2", "y = (x-2)**2 + 1", etc.
- showIntercepts: true
- Focus on vertex, axis of symmetry

**Function Families (Precalculus)**:
- Appropriate range for the function type
- Multiple related functions showing transformations
- Example: y = x**2, y = 2*x**2, y = -x**2 + 3

**Inequalities (Algebra II)**:
- Linear or quadratic inequalities
- Use regions for shading
- Show boundary lines

EQUATION SYNTAX:
- Linear: "y = 2*x + 1"
- Quadratic: "y = x**2 - 4*x + 3"
- Exponential: "y = 2**x"
- Square root: "y = (x**0.5)" (for x ≥ 0)
- Absolute value: Not directly supported, use piecewise description
- Always use * for multiplication, ** for exponents

IMPORTANT RULES:
1. Choose axis ranges that show the important features (intercepts, vertices, intersections)
2. Use gridSpacing appropriate for the range (usually 1 or 2)
3. For point plotting activities: plotMode = 'points', provide sample points
4. For equation graphing: plotMode = 'equation', provide equations array
5. Use distinct colors for multiple functions: '#3b82f6' (blue), '#10b981' (green), '#f59e0b' (amber), '#a855f7' (purple)
6. Enable showIntercepts for topics about intercepts, slope, or solving
7. Enable traceEnabled for exploring function values
8. Labels should be educational and explain what each line/point represents

EDUCATIONAL ENHANCEMENTS (REQUIRED for each equation):
1. **Slope & Intercept**: For linear equations, extract and provide:
   - slope: The numeric slope value (e.g., 2 for "y = 2*x + 1")
   - yIntercept: The y-intercept value (e.g., 1 for "y = 2*x + 1")
   - slopeInterpretation: Student-friendly explanation (e.g., "For every 1 unit right, go up 2 units" or "Steep positive slope")
   - interceptInterpretation: What the y-intercept means (e.g., "The line crosses the y-axis at 1" or "Starting value is 1")

2. **Real-World Context**: Provide a realWorldContext that relates the equation to everyday life
   - Example for "y = 2*x + 1": "A taxi charges $1 base fee plus $2 per mile traveled"
   - Example for "y = -0.5*x + 5": "A candle starts at 5 inches tall and burns down 0.5 inches per hour"

3. **Concept Focus**: Set conceptFocus to indicate the primary learning objective:
   - 'slope': Emphasizing understanding of slope/rate of change
   - 'intercept': Focus on y-intercept meaning
   - 'intersection': For systems of equations showing where lines meet
   - 'transformation': For function transformations (shifts, stretches)
   - 'general': General graphing practice

4. **Annotations**: Add 2-4 educational annotations on the graph to highlight key features:
   - Mark y-intercepts with type 'intercept' and text like "Y-intercept: (0, 1)"
   - Mark x-intercepts with type 'intercept' and text like "X-intercept: (-0.5, 0)"
   - Mark intersection points with type 'intersection' and text like "Lines intersect at (2, 5)"
   - Mark other important features like vertices, max/min points
   - Each annotation must have x, y coordinates, descriptive text, and a type

EXAMPLE ENHANCED EQUATION:
{
  "expression": "y = 2*x + 1",
  "color": "#3b82f6",
  "label": "Line 1: y = 2x + 1 (Steep slope)",
  "slope": 2,
  "yIntercept": 1,
  "conceptFocus": "slope",
  "realWorldContext": "A taxi charges $1 base fee plus $2 per mile",
  "slopeInterpretation": "For every 1 mile traveled, the cost increases by $2",
  "interceptInterpretation": "The base fee is $1 before any miles are traveled",
  "annotations": [
    {
      "x": 0,
      "y": 1,
      "text": "Y-intercept: Start at (0, 1)",
      "type": "intercept"
    },
    {
      "x": 2,
      "y": 5,
      "text": "After 2 miles: $5 total",
      "type": "point-of-interest"
    }
  ]
}

${config ? `
CONFIGURATION HINTS:
${config.xRange ? `- X Range: [${config.xRange[0]}, ${config.xRange[1]}]` : ''}
${config.yRange ? `- Y Range: [${config.yRange[0]}, ${config.yRange[1]}]` : ''}
${config.plotMode ? `- Plot Mode: ${config.plotMode}` : ''}
${config.showIntercepts !== undefined ? `- Show Intercepts: ${config.showIntercepts}` : ''}
${config.equations ? `- Equations provided: ${config.equations.length}` : ''}
` : ''}

REQUIREMENTS:
1. Choose appropriate axis ranges for the topic and grade level
2. Write a clear, student-friendly title
3. Provide an educational description of what students will learn
4. Set plotMode based on the activity ('points' for plotting practice, 'equation' for graphing)
5. For equation mode: include appropriate equations for the topic
6. For points mode: include 3-5 sample points as examples
7. Enable features that support the learning objective (showIntercepts, traceEnabled, allowZoom)
8. Use standard grid spacing (usually 1 or 2)

Return the complete coordinate graph configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: coordinateGraphSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid coordinate graph data returned from Gemini API');
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

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.xRange) data.xRange = config.xRange;
    if (config.yRange) data.yRange = config.yRange;
    if (config.plotMode) data.plotMode = config.plotMode;
    if (config.equations) data.equations = config.equations;
    if (config.showIntercepts !== undefined) data.showIntercepts = config.showIntercepts;
  }

  // Set defaults
  if (data.gridSpacing === undefined) data.gridSpacing = { x: 1, y: 1 };
  if (data.showAxes === undefined) data.showAxes = true;
  if (data.showGrid === undefined) data.showGrid = true;
  if (data.plotMode === undefined) data.plotMode = 'points';
  if (data.traceEnabled === undefined) data.traceEnabled = true;
  if (data.showIntercepts === undefined) data.showIntercepts = false;
  if (data.allowZoom === undefined) data.allowZoom = true;
  if (data.equations === undefined) data.equations = [];
  if (data.points === undefined) data.points = [];
  if (data.lines === undefined) data.lines = [];

  return data;
};
