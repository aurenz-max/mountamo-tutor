import { Type, Schema } from "@google/genai";
import { ShapeBuilderData } from "../../primitives/visual-primitives/math/ShapeBuilder";
import { ai } from "../geminiClient";

/**
 * Schema definition for Shape Builder Data
 *
 * This schema defines the structure for geometric construction activities,
 * including building shapes from vertices/edges, discovering properties,
 * classifying, composing/decomposing, and finding symmetry for K-5 geometry.
 */
const shapeBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the geometry activity (e.g., 'Build a Rectangle!', 'Shape Sort Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    mode: {
      type: Type.STRING,
      enum: ["build", "discover", "classify", "compose", "decompose", "symmetry"],
      description: "Primary activity mode: build (construct shapes), discover (explore properties), classify (sort shapes), compose (combine shapes), decompose (break apart shapes), symmetry (find lines of symmetry)"
    },
    grid: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ["dot", "coordinate", "none"],
          description: "Grid type: 'dot' (dot paper), 'coordinate' (coordinate plane), 'none' (free-form)"
        },
        size: {
          type: Type.OBJECT,
          properties: {
            rows: {
              type: Type.NUMBER,
              description: "Number of grid rows (typically 8-12)"
            },
            columns: {
              type: Type.NUMBER,
              description: "Number of grid columns (typically 8-12)"
            }
          },
          required: ["rows", "columns"]
        },
        showCoordinates: {
          type: Type.BOOLEAN,
          description: "Whether to display coordinate labels on the grid axes"
        }
      },
      required: ["type", "size", "showCoordinates"]
    },
    targetShape: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        name: {
          type: Type.STRING,
          nullable: true,
          description: "Name of the target shape (e.g., 'Rectangle', 'Equilateral Triangle'). Null if the student must discover it."
        },
        properties: {
          type: Type.OBJECT,
          properties: {
            sides: {
              type: Type.NUMBER,
              description: "Number of sides the target shape should have"
            },
            rightAngles: {
              type: Type.NUMBER,
              nullable: true,
              description: "Number of right angles (90°) the target shape should have"
            },
            parallelPairs: {
              type: Type.NUMBER,
              nullable: true,
              description: "Number of pairs of parallel sides"
            },
            equalSides: {
              type: Type.STRING,
              nullable: true,
              enum: ["all", "pairs", "none"],
              description: "Whether sides should be equal: 'all' (regular), 'pairs' (opposite equal), 'none'"
            },
            linesOfSymmetry: {
              type: Type.NUMBER,
              nullable: true,
              description: "Number of lines of symmetry the target shape has"
            }
          },
          required: ["sides"]
        }
      },
      required: ["name", "properties"]
    },
    preloadedShapes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique shape ID (e.g., 's1', 's2')"
          },
          vertices: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER, description: "X grid coordinate" },
                y: { type: Type.NUMBER, description: "Y grid coordinate" }
              },
              required: ["x", "y"]
            },
            description: "Array of vertex coordinates defining the shape"
          },
          name: {
            type: Type.STRING,
            description: "Display name for the shape (e.g., 'Triangle A', 'Square')"
          },
          locked: {
            type: Type.BOOLEAN,
            description: "Whether the shape cannot be modified by the student"
          }
        },
        required: ["id", "vertices", "name", "locked"]
      },
      description: "Pre-placed shapes on the grid (for classify, compose, discover, symmetry modes)"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            enum: ["build", "measure", "classify", "compose", "find_symmetry", "coordinate_shape"],
            description: "Challenge type: build (construct a shape), measure (use tools to discover properties), classify (sort shapes into categories), compose (combine shapes), find_symmetry (draw lines of symmetry), coordinate_shape (build on coordinate grid)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging"
          },
          targetProperties: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              sides: {
                type: Type.NUMBER,
                description: "Required number of sides"
              },
              rightAngles: {
                type: Type.NUMBER,
                description: "Required number of right angles"
              },
              parallelPairs: {
                type: Type.NUMBER,
                description: "Required number of parallel side pairs"
              },
              equalSides: {
                type: Type.STRING,
                enum: ["all", "pairs", "none"],
                description: "Required equal sides pattern"
              },
              linesOfSymmetry: {
                type: Type.NUMBER,
                description: "Required number of lines of symmetry to find"
              }
            }
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce it)"
          }
        },
        required: ["id", "type", "instruction", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
    },
    tools: {
      type: Type.OBJECT,
      properties: {
        ruler: {
          type: Type.BOOLEAN,
          description: "Enable ruler tool for measuring side lengths"
        },
        protractor: {
          type: Type.BOOLEAN,
          description: "Enable protractor tool for measuring angles"
        },
        symmetryLine: {
          type: Type.BOOLEAN,
          description: "Enable symmetry line drawing tool"
        },
        parallelMarker: {
          type: Type.BOOLEAN,
          description: "Enable parallel side marker tool"
        }
      },
      required: ["ruler", "protractor", "symmetryLine", "parallelMarker"]
    },
    classificationCategories: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      },
      description: "Categories for classify mode (e.g., ['Triangles', 'Quadrilaterals', 'Pentagons'])"
    },
    patternBlocks: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether pattern blocks (tangram-style pieces) are available"
        },
        availableShapes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Available pattern block shapes (e.g., ['triangle', 'square', 'hexagon', 'rhombus', 'trapezoid'])"
        }
      },
      required: ["enabled", "availableShapes"]
    },
    imagePrompt: {
      type: Type.STRING,
      nullable: true,
      description: "Optional prompt for generating an illustrative image for the activity"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5"],
      description: "Grade band: 'K-2' for younger students, '3-5' for upper elementary"
    }
  },
  required: ["title", "description", "mode", "grid", "challenges", "tools", "gradeBand"]
};

/**
 * Generate shape builder data for interactive geometry activities
 *
 * Grade-aware content:
 * - K-2: Build basic shapes (triangles, rectangles, squares), count sides/corners,
 *   simple classification, introduce symmetry with familiar shapes
 * - 3-5: Properties-based construction (right angles, parallel sides), shape hierarchy,
 *   compose/decompose, coordinate shapes, multi-line symmetry, formal classification
 *
 * @param topic - The geometry topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ShapeBuilderData with complete configuration
 */
export const generateShapeBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ShapeBuilderData>
): Promise<ShapeBuilderData> => {
  const prompt = `
Create an educational geometry activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Shape Builder is an interactive workspace where students construct shapes on a dot/coordinate grid
- Students click grid points to place vertices and connect edges
- Key skills: shape construction, property discovery, classification, composition/decomposition, symmetry
- The AI tutor names properties as students discover them

GUIDELINES FOR GRADE LEVELS:
- K-2 (gradeBand "K-2"):
  * Build basic shapes: triangles, squares, rectangles, circles concept
  * Count sides and corners (vertices)
  * Simple classification: "Is this a triangle or a rectangle?"
  * Introduce symmetry with familiar shapes (butterfly, heart shapes)
  * Use dot grid (type: "dot"), larger grid (10x10), no coordinates
  * Warm, simple language: "Can you build a shape with 4 sides?"
  * Challenge types: build, classify, find_symmetry (simple)
  * Tools: ruler only (count sides), symmetryLine for symmetry activities
  * Preloaded shapes for classify should be simple and well-spaced

- 3-5 (gradeBand "3-5"):
  * Properties-based construction: "Build a shape with 4 right angles and 2 pairs of parallel sides"
  * Shape hierarchy: square → rectangle → parallelogram → quadrilateral
  * Compose shapes from pattern blocks, decompose complex shapes
  * Coordinate grid shapes: "Plot vertices at (2,3), (5,3), (5,7), (2,7)"
  * Multi-line symmetry, rotational symmetry concepts
  * Use coordinate grid for coordinate_shape challenges
  * Challenge types: all types including measure, compose, coordinate_shape
  * All tools enabled for discover/measure activities
  * Formal classification categories: Triangles, Quadrilaterals, Pentagons, Hexagons

CHALLENGE TYPES:
- "build": Construct a shape matching given properties. Set targetProperties.
- "measure": Use ruler/protractor/parallel tools to discover properties of a preloaded shape.
- "classify": Sort multiple preloaded shapes into categories.
- "compose": Combine pattern blocks to form a target shape.
- "find_symmetry": Draw lines of symmetry on a preloaded shape. Set targetProperties.linesOfSymmetry.
- "coordinate_shape": Build a shape by plotting vertices on a coordinate grid.

${config ? `
CONFIGURATION HINTS:
${config.mode ? `- Mode: ${config.mode}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.grid?.type ? `- Grid type: ${config.grid.type}` : ''}
${config.targetShape?.name ? `- Target shape: ${config.targetShape.name}` : ''}
${config.classificationCategories ? `- Categories: ${config.classificationCategories.join(', ')}` : ''}
${config.patternBlocks?.enabled ? `- Pattern blocks enabled` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Start with easier challenges and build complexity
3. Use warm, encouraging instruction text appropriate for the grade band
4. For K-2: keep instructions simple, use "sides" and "corners" instead of "edges" and "vertices"
5. For 3-5: use proper geometric vocabulary (parallel, perpendicular, congruent)
6. For classify mode: include 4-6 preloaded shapes spread across the grid, set classificationCategories
7. For find_symmetry: include a preloaded shape and set targetProperties.linesOfSymmetry
8. For compose mode: enable patternBlocks with appropriate shapes
9. For build challenges: always set targetProperties with at least the number of sides
10. Enable appropriate tools based on the challenge types:
    - ruler: true for measure and discover modes
    - protractor: true for 3-5 grade measure activities
    - symmetryLine: true for symmetry activities
    - parallelMarker: true for 3-5 grade activities involving parallelograms/trapezoids
11. Include meaningful hints that guide without giving the answer
12. Include narration text the AI tutor can use to introduce each challenge
13. Ensure preloaded shape vertices form valid, non-degenerate polygons on the grid
14. For coordinate_shape: set grid.type to "coordinate" and grid.showCoordinates to true

Return the complete shape builder configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: shapeBuilderSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid shape builder data returned from Gemini API');
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K-2' && data.gradeBand !== '3-5') {
    const lower = gradeLevel.toLowerCase();
    if (lower.includes('k') || lower.includes('1') || lower.includes('2') || lower.includes('kinder')) {
      data.gradeBand = 'K-2';
    } else {
      data.gradeBand = '3-5';
    }
  }

  // Validation: ensure mode is valid
  const validModes = ['build', 'discover', 'classify', 'compose', 'decompose', 'symmetry'];
  if (!validModes.includes(data.mode)) {
    data.mode = 'build';
  }

  // Validation: ensure grid has valid defaults
  if (!data.grid) {
    data.grid = { type: 'dot', size: { rows: 10, columns: 10 }, showCoordinates: false };
  } else {
    if (!['dot', 'coordinate', 'none'].includes(data.grid.type)) {
      data.grid.type = 'dot';
    }
    if (!data.grid.size) {
      data.grid.size = { rows: 10, columns: 10 };
    } else {
      if (!data.grid.size.rows || data.grid.size.rows < 4) data.grid.size.rows = 10;
      if (!data.grid.size.columns || data.grid.size.columns < 4) data.grid.size.columns = 10;
    }
    if (data.grid.showCoordinates === undefined) {
      data.grid.showCoordinates = false;
    }
  }

  // Validation: ensure tools has valid defaults
  if (!data.tools) {
    data.tools = { ruler: true, protractor: false, symmetryLine: false, parallelMarker: false };
  } else {
    if (data.tools.ruler === undefined) data.tools.ruler = true;
    if (data.tools.protractor === undefined) data.tools.protractor = false;
    if (data.tools.symmetryLine === undefined) data.tools.symmetryLine = false;
    if (data.tools.parallelMarker === undefined) data.tools.parallelMarker = false;
  }

  // Ensure challenges have valid types
  const validChallengeTypes = ['build', 'measure', 'classify', 'compose', 'find_symmetry', 'coordinate_shape'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'c1',
      type: 'build',
      instruction: data.gradeBand === 'K-2'
        ? 'Can you build a shape with 4 sides? Click the dots to place corners!'
        : 'Construct a quadrilateral by clicking grid points to place vertices.',
      targetProperties: { sides: 4 },
      hint: data.gradeBand === 'K-2'
        ? 'Count the dots you click — you need 4 corners!'
        : 'A quadrilateral has exactly 4 sides and 4 vertices.',
      narration: "Let's build a shape together! Click on the grid dots to place your corners.",
    }];
  }

  // Ensure preloadedShapes is an array
  if (!Array.isArray(data.preloadedShapes)) {
    data.preloadedShapes = [];
  }

  // Validate preloaded shape vertices
  data.preloadedShapes = data.preloadedShapes.filter(
    (s: { vertices?: unknown[] }) => Array.isArray(s.vertices) && s.vertices.length >= 3
  );

  // Ensure classificationCategories is an array
  if (!Array.isArray(data.classificationCategories)) {
    data.classificationCategories = [];
  }

  // Ensure patternBlocks has valid defaults if present
  if (data.patternBlocks) {
    if (data.patternBlocks.enabled === undefined) data.patternBlocks.enabled = false;
    if (!Array.isArray(data.patternBlocks.availableShapes)) {
      data.patternBlocks.availableShapes = [];
    }
  }

  // Apply explicit config overrides
  if (config) {
    if (config.mode !== undefined) data.mode = config.mode;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.grid !== undefined) data.grid = { ...data.grid, ...config.grid };
    if (config.targetShape !== undefined) data.targetShape = config.targetShape;
    if (config.tools !== undefined) data.tools = { ...data.tools, ...config.tools };
    if (config.classificationCategories !== undefined) data.classificationCategories = config.classificationCategories;
    if (config.patternBlocks !== undefined) data.patternBlocks = config.patternBlocks;
  }

  return data;
};
