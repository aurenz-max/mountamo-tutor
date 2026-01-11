import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Slope Triangle Data Interface
 *
 * This matches the SlopeTriangleData interface in the component
 */
export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface SlopeTriangleConfig {
  position: Point;
  size: number;
  showMeasurements: boolean;
  showSlope: boolean;
  showAngle: boolean;
  notation: 'riseRun' | 'deltaNotation';
  color?: string;
}

export interface AttachedLine {
  equation: string;
  color?: string;
  label?: string;
}

export interface SlopeTriangleData {
  title: string;
  description: string;
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showAxes?: boolean;
  showGrid?: boolean;
  attachedLine: AttachedLine;
  triangles: SlopeTriangleConfig[];
  allowDrag?: boolean;
  allowResize?: boolean;
}

/**
 * Schema definition for Slope Triangle Data
 *
 * This schema defines the structure for slope triangles overlaying a line
 */
const slopeTriangleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the slope triangle visualization (e.g., 'Understanding Slope with Rise and Run', 'Slope Triangle Explorer')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    xRange: {
      type: Type.ARRAY,
      description: "Horizontal bounds [min, max]. Choose range to show the line and triangles clearly.",
      items: {
        type: Type.NUMBER
      }
    },
    yRange: {
      type: Type.ARRAY,
      description: "Vertical bounds [min, max]. Choose range to show the line and triangles clearly.",
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
    attachedLine: {
      type: Type.OBJECT,
      description: "The line equation to attach slope triangles to",
      properties: {
        equation: {
          type: Type.STRING,
          description: "Linear equation in y= format (e.g., 'y = 2*x + 1')"
        },
        color: {
          type: Type.STRING,
          description: "Hex color for the line (e.g., '#3b82f6')"
        },
        label: {
          type: Type.STRING,
          description: "Label for the equation (e.g., 'y = 2x + 1')"
        }
      },
      required: ["equation"]
    },
    triangles: {
      type: Type.ARRAY,
      description: "Slope triangles to display on the line. Include 1-3 triangles at different positions or sizes.",
      items: {
        type: Type.OBJECT,
        properties: {
          position: {
            type: Type.OBJECT,
            description: "Starting point (base) of the triangle on the line",
            properties: {
              x: { type: Type.NUMBER, description: "X coordinate of base point" },
              y: { type: Type.NUMBER, description: "Y coordinate (will be calculated from line)" }
            },
            required: ["x", "y"]
          },
          size: {
            type: Type.NUMBER,
            description: "Horizontal distance (run) of the triangle. Typically 2-4 units."
          },
          showMeasurements: {
            type: Type.BOOLEAN,
            description: "Display rise and run measurements. Default: true"
          },
          showSlope: {
            type: Type.BOOLEAN,
            description: "Display calculated slope value. Default: true"
          },
          showAngle: {
            type: Type.BOOLEAN,
            description: "Display angle measurement in degrees. Default: false"
          },
          notation: {
            type: Type.STRING,
            description: "Notation style: 'riseRun' or 'deltaNotation'. Use 'deltaNotation' for higher grades."
          },
          color: {
            type: Type.STRING,
            description: "Triangle color (e.g., '#10b981')"
          }
        },
        required: ["position", "size", "showMeasurements", "showSlope", "showAngle", "notation"]
      }
    },
    allowDrag: {
      type: Type.BOOLEAN,
      description: "Allow students to drag triangles along the line. Default: true"
    },
    allowResize: {
      type: Type.BOOLEAN,
      description: "Allow students to resize triangles. Default: true"
    }
  },
  required: ["title", "description", "xRange", "yRange", "attachedLine", "triangles"]
};

/**
 * Generate slope triangle data for visualization
 *
 * This function creates slope triangle data including:
 * - A linear equation to attach triangles to
 * - One or more slope triangles showing rise and run
 * - Educational context and descriptions
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns SlopeTriangleData with complete configuration
 */
export const generateSlopeTriangle = async (
  topic: string,
  gradeLevel: string,
  config?: {
    xRange?: [number, number];
    yRange?: [number, number];
    equation?: string;
    showAngle?: boolean;
  }
): Promise<SlopeTriangleData> => {
  const prompt = `
Create an educational slope triangle visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A slope triangle is a right triangle that shows the rise (vertical change) and run (horizontal change) on a line
- It makes the slope formula (rise/run or Δy/Δx) concrete and visual
- Students can see that any two points on a line create the same slope
- Angles can be measured to connect slope to trigonometry

GUIDELINES FOR GRADE LEVELS:
- Grades 7-8: Introduction to slope, rise/run, basic linear equations
  - Use simple integer slopes (e.g., 2, -1, 0.5)
  - Focus on rise/run notation
  - xRange: [-10, 10], yRange: [-10, 10]
  - Include 2-3 triangles of different sizes to show consistent slope

- Algebra I: Slope-intercept form, calculating slope, rate of change
  - Mix of integer and decimal slopes
  - Introduce Δy/Δx notation
  - Can show angle measurements for advanced students
  - xRange: [-10, 10], yRange: [-10, 10]

- Algebra II/Geometry: Parallel/perpendicular lines, angle relationships
  - Include angle measurements (showAngle: true)
  - Use Δy/Δx notation
  - Can show steeper slopes or multiple triangles for comparison
  - xRange: [-10, 10], yRange: [-15, 15]

IMPORTANT RULES:

1. **Choose an appropriate linear equation:**
   - Use y = mx + b format
   - Slope should be clear and educational (avoid very steep or very flat)
   - Good examples: "y = 2*x + 1", "y = -0.5*x + 3", "y = 1*x - 2"
   - For slope introduction: Use positive integer slopes (1, 2, 3)
   - For advanced topics: Use negative, fractional, or decimal slopes

2. **Position triangles strategically:**
   - Place at different x-positions to show slope is constant
   - Avoid placing near axis edges where labels might be cut off
   - Good positions: x = -4, x = 0, x = 4 (for a range of -10 to 10)

3. **Choose appropriate triangle sizes:**
   - Size = run distance (horizontal leg)
   - Typical sizes: 2, 3, 4 units
   - Larger triangles are easier to see measurements
   - Vary sizes to demonstrate that slope ratio remains constant

4. **Notation selection:**
   - Grades 7-8: Always use 'riseRun'
   - Algebra I: Can introduce 'deltaNotation'
   - Algebra II+: Prefer 'deltaNotation'

5. **Angle measurements:**
   - Only enable showAngle for:
     - Geometry contexts
     - Connecting slope to trigonometry (tan θ = slope)
     - Advanced algebra classes
   - Default: showAngle = false for basic slope introduction

6. **Educational features:**
   - Always enable showMeasurements (rise and run labels)
   - Always enable showSlope (calculated slope value)
   - Enable allowDrag and allowResize for interactive exploration

7. **Color coding:**
   - Line: Use blue (#3b82f6) for neutral, or themed colors
   - Triangles: Use green (#10b981) as default
   - Can use different colors for multiple triangles to distinguish them

EXAMPLE SCENARIOS:

**Slope Introduction (Grade 7-8):**
- Title: "Visualizing Slope: Rise Over Run"
- Equation: "y = 2*x + 1" (slope = 2)
- Triangles: 2 triangles with sizes 2 and 4
- Notation: 'riseRun'
- showAngle: false
- Description: "Explore how slope is the ratio of rise to run. Notice that different-sized triangles on the same line always give the same slope!"

**Slope Calculation (Algebra I):**
- Title: "Calculating Slope Using Δy/Δx"
- Equation: "y = -1.5*x + 4" (slope = -1.5)
- Triangles: 2-3 triangles with varied sizes
- Notation: 'deltaNotation'
- showAngle: false
- Description: "Learn to calculate slope using the delta notation. Δy/Δx represents the change in y divided by the change in x."

**Slope and Angles (Geometry/Trig):**
- Title: "Connecting Slope to Angle of Inclination"
- Equation: "y = 1*x + 0" (slope = 1, 45° angle)
- Triangles: 1-2 triangles
- Notation: 'deltaNotation'
- showAngle: true
- Description: "Discover the relationship between slope and angle. The angle of inclination is related to slope through the tangent function: tan(θ) = m."

${config ? `
CONFIGURATION HINTS:
${config.xRange ? `- X Range: [${config.xRange[0]}, ${config.xRange[1]}]` : ''}
${config.yRange ? `- Y Range: [${config.yRange[0]}, ${config.yRange[1]}]` : ''}
${config.equation ? `- Equation: ${config.equation}` : ''}
${config.showAngle !== undefined ? `- Show Angle: ${config.showAngle}` : ''}
` : ''}

REQUIREMENTS:
1. Choose appropriate axis ranges for the topic and grade level
2. Write a clear, student-friendly title
3. Provide an educational description of what students will learn
4. Select a linear equation with an appropriate slope for the grade level
5. Include 1-3 slope triangles positioned at different locations or sizes
6. Set notation based on grade level (riseRun for younger, deltaNotation for older)
7. Enable angle display only when appropriate for the topic
8. Enable interactive features (allowDrag, allowResize)

Return the complete slope triangle configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: slopeTriangleSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid slope triangle data returned from Gemini API');
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
    if (config.equation) data.attachedLine.equation = config.equation;
    if (config.showAngle !== undefined) {
      data.triangles.forEach(triangle => {
        triangle.showAngle = config.showAngle!;
      });
    }
  }

  // Set defaults
  if (data.gridSpacing === undefined) data.gridSpacing = { x: 1, y: 1 };
  if (data.showAxes === undefined) data.showAxes = true;
  if (data.showGrid === undefined) data.showGrid = true;
  if (data.allowDrag === undefined) data.allowDrag = true;
  if (data.allowResize === undefined) data.allowResize = true;

  // Ensure triangles have proper defaults
  data.triangles.forEach(triangle => {
    if (triangle.showMeasurements === undefined) triangle.showMeasurements = true;
    if (triangle.showSlope === undefined) triangle.showSlope = true;
    if (triangle.showAngle === undefined) triangle.showAngle = false;
    if (triangle.notation === undefined) triangle.notation = 'riseRun';
    if (!triangle.color) triangle.color = '#10b981';
  });

  return data;
};
