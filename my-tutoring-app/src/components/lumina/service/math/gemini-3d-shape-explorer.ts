import { Type, Schema } from "@google/genai";
import { ThreeDShapeExplorerData } from "../../primitives/visual-primitives/math/ThreeDShapeExplorer";
import { ai } from "../geminiClient";

/**
 * Schema definition for 3D Shape Explorer Data
 *
 * This schema defines the structure for 3D shape exploration activities,
 * including shape identification, 2D vs 3D classification, real-world matching,
 * face/property exploration, and shape comparison for K-1 geometry.
 */
const threeDShapeExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., '3D Shape Adventure!', 'Discover Solid Shapes')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
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
            description: "Challenge type: 'identify-3d' (name the shape), '2d-vs-3d' (sort flat vs solid), 'match-to-real-world' (connect shapes to objects), 'faces-and-properties' (explore properties), 'compare' (compare two shapes)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and age-appropriate (e.g., 'What shape is this? It looks like a ball!')"
          },
          // identify-3d fields
          shape3d: {
            type: Type.STRING,
            description: "For identify-3d: the 3D shape to identify. One of: 'cube', 'sphere', 'cylinder', 'cone', 'rectangular-prism'"
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For identify-3d: answer options (shape names). The correct answer must be included."
          },
          // 2d-vs-3d fields
          mixedShapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Shape name (e.g., 'circle', 'sphere', 'square', 'cube')" },
                emoji: { type: Type.STRING, description: "Emoji representing the shape (e.g., '⚽', '🟡', '🧊', '📦')" },
                is3d: { type: Type.BOOLEAN, description: "true if this is a 3D (solid) shape, false if 2D (flat)" }
              },
              required: ["name", "emoji", "is3d"]
            },
            description: "For 2d-vs-3d: mix of flat and solid shapes for students to sort"
          },
          // match-to-real-world fields
          matchPairs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                realWorldObject: { type: Type.STRING, description: "Real-world object name (e.g., 'basketball', 'ice cream cone', 'box')" },
                emoji: { type: Type.STRING, description: "Emoji for the real-world object (e.g., '🏀', '🍦', '📦')" },
                shape3d: { type: Type.STRING, description: "The 3D shape it matches: 'cube', 'sphere', 'cylinder', 'cone', 'rectangular-prism'" }
              },
              required: ["realWorldObject", "emoji", "shape3d"]
            },
            description: "For match-to-real-world: pairs of real objects and their 3D shapes"
          },
          // faces-and-properties fields
          displayShape: {
            type: Type.STRING,
            description: "For faces-and-properties: the shape to explore. One of: 'cube', 'sphere', 'cylinder', 'cone', 'rectangular-prism'"
          },
          properties: {
            type: Type.OBJECT,
            properties: {
              flatFaces: { type: Type.NUMBER, description: "Number of flat faces (e.g., cube=6, cylinder=2, sphere=0)" },
              curvedSurfaces: { type: Type.NUMBER, description: "Number of curved surfaces (e.g., sphere=1, cylinder=1, cube=0)" },
              faceShapes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Shapes of the flat faces (e.g., ['square'] for cube, ['circle'] for cylinder)"
              },
              canRoll: { type: Type.BOOLEAN, description: "Whether the shape can roll" },
              canStack: { type: Type.BOOLEAN, description: "Whether the shape can be stacked" },
              canSlide: { type: Type.BOOLEAN, description: "Whether the shape can slide on a flat surface" }
            },
            required: ["flatFaces", "curvedSurfaces", "faceShapes", "canRoll", "canStack", "canSlide"],
            description: "For faces-and-properties: the correct properties of the shape"
          },
          propertyQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: "A question about the shape's properties (e.g., 'How many flat faces does this shape have?')" },
                answerType: { type: Type.STRING, description: "The type of answer UI to show: 'boolean' for Yes/No, 'number' for number picker (0-8), 'choice' for multiple choice text options" },
                correctAnswer: { type: Type.STRING, description: "The correct answer as a string (e.g., '6' for number, 'true'/'false' for boolean, 'square' for choice)" },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "For 'choice' answerType only: the options to show (e.g., ['circle', 'square', 'rectangle', 'triangle']). Include the correct answer."
                }
              },
              required: ["question", "answerType", "correctAnswer"]
            },
            description: "For faces-and-properties: questions about the shape for students to answer. Use answerType to control UI: 'boolean' for yes/no questions, 'number' for counting questions, 'choice' for naming face shapes."
          },
          // compare fields
          shape1: {
            type: Type.STRING,
            description: "For compare: first shape to compare. One of: 'cube', 'sphere', 'cylinder', 'cone', 'rectangular-prism'"
          },
          shape2: {
            type: Type.STRING,
            description: "For compare: second shape to compare. One of: 'cube', 'sphere', 'cylinder', 'cone', 'rectangular-prism'"
          },
          similarities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For compare: things these two shapes have in common (e.g., 'Both can stack')"
          },
          differences: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For compare: differences between the shapes (e.g., 'A sphere can roll but a cube cannot')"
          }
        },
        required: ["id", "type", "instruction"]
      },
      description: "Array of 3-5 progressive challenges mixing different challenge types"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    },
    showUnfoldAnimation: {
      type: Type.BOOLEAN,
      description: "Whether to show net/unfold animation for shapes (Grade 1 feature)"
    },
    show3dRotation: {
      type: Type.BOOLEAN,
      description: "Whether to enable 3D rotation interaction"
    }
  },
  required: ["title", "description", "challenges", "gradeBand", "showUnfoldAnimation", "show3dRotation"]
};

/**
 * Generate 3D Shape Explorer data for interactive geometry activities
 *
 * Grade-aware content:
 * - Kindergarten: identify basic 3D shapes (cube, sphere, cylinder, cone),
 *   sort 2D vs 3D, match shapes to real-world objects
 * - Grade 1: explore faces/properties, compare shapes, deeper understanding
 *   of edges, vertices, and how shapes move (roll, stack, slide)
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ThreeDShapeExplorerData with complete configuration
 */
export const generateThreeDShapeExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ThreeDShapeExplorerData>
): Promise<ThreeDShapeExplorerData> => {
  const prompt = `
Create an educational 3D shape exploration activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Students explore 3D (solid) shapes: cube, sphere, cylinder, cone, rectangular-prism
- Activities build understanding of 2D vs 3D shapes, shape properties, and real-world connections
- This is for young children (Kindergarten and Grade 1) so use warm, fun language

AVAILABLE 3D SHAPES (use these exact names):
- "cube" (like a block or dice)
- "sphere" (like a ball)
- "cylinder" (like a can)
- "cone" (like an ice cream cone)
- "rectangular-prism" (like a cereal box)

CHALLENGE TYPES:
1. "identify-3d": Show a 3D shape, student picks its name from options.
   - Set shape3d to the shape name
   - Provide 3-4 options including the correct answer
   - Great for introducing shape vocabulary

2. "2d-vs-3d": Show a mix of flat (2D) and solid (3D) shapes, student sorts them.
   - Provide 4-6 mixedShapes with name, emoji, and is3d flag
   - Include 2D shapes: circle, square, triangle, rectangle
   - Include 3D shapes: cube, sphere, cylinder, cone
   - Use clear emojis (e.g., ⚽ for sphere, 🟡 for circle, 🧊 for cube, 🔺 for triangle)

3. "match-to-real-world": Match real-world objects to their 3D shapes.
   - Provide 3-5 matchPairs with realWorldObject, emoji, and shape3d
   - Use kid-friendly objects (basketball=sphere, dice=cube, can=cylinder, party hat=cone, shoebox=rectangular-prism)

4. "faces-and-properties": Explore a shape's properties.
   - Set displayShape to the shape
   - Provide accurate properties (flatFaces, curvedSurfaces, faceShapes, canRoll, canStack, canSlide)
   - Provide 2-4 propertyQuestions. Each question MUST have:
     * question: the text to show
     * answerType: "boolean" for Yes/No questions, "number" for counting, "choice" for naming shapes
     * correctAnswer: the answer as a string ("true"/"false", "6", "square")
     * options: REQUIRED for "choice" type (e.g., ["circle", "square", "rectangle", "triangle"])
   - QUESTION EXAMPLES:
     * { question: "How many flat faces?", answerType: "number", correctAnswer: "6" }
     * { question: "Can this shape roll?", answerType: "boolean", correctAnswer: "false" }
     * { question: "Can this shape stack?", answerType: "boolean", correctAnswer: "true" }
     * { question: "What shape are the flat faces?", answerType: "choice", correctAnswer: "square", options: ["circle", "square", "rectangle", "triangle"] }
   - CORRECT PROPERTIES:
     * cube: 6 flat faces, 0 curved, faceShapes=["square"], canRoll=false, canStack=true, canSlide=true
     * sphere: 0 flat faces, 1 curved, faceShapes=[], canRoll=true, canStack=false, canSlide=false
     * cylinder: 2 flat faces, 1 curved, faceShapes=["circle"], canRoll=true, canStack=true, canSlide=true
     * cone: 1 flat face, 1 curved, faceShapes=["circle"], canRoll=true, canStack=false, canSlide=true
     * rectangular-prism: 6 flat faces, 0 curved, faceShapes=["rectangle"], canRoll=false, canStack=true, canSlide=true

5. "compare": Compare two 3D shapes.
   - Set shape1 and shape2
   - Provide 2-3 similarities and 2-3 differences
   - Use kid-friendly language for comparisons

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Focus on identify-3d, 2d-vs-3d, and match-to-real-world
  * Use very simple language ("This shape looks like a ball!")
  * 3-4 challenges, mostly identification and sorting
  * showUnfoldAnimation: false, show3dRotation: true

- Grade 1 (gradeBand "1"):
  * Include faces-and-properties and compare challenges
  * Slightly more academic language but still warm
  * 4-5 challenges with variety of types
  * showUnfoldAnimation: true, show3dRotation: true

${config ? `
CONFIGURATION HINTS:
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.showUnfoldAnimation !== undefined ? `- Show unfold animation: ${config.showUnfoldAnimation}` : ''}
${config.show3dRotation !== undefined ? `- Show 3D rotation: ${config.show3dRotation}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress from easier to harder
2. Mix challenge types appropriate for the grade level
3. Use warm, encouraging language for young children
4. Shape names MUST be exactly: "cube", "sphere", "cylinder", "cone", "rectangular-prism"
5. For identify-3d challenges, the correct shape name MUST be in the options array
6. For faces-and-properties, properties MUST be factually accurate (use the reference above)
7. For 2d-vs-3d, include a balanced mix of 2D and 3D shapes
8. For match-to-real-world, use objects kids recognize from everyday life
9. For compare, provide meaningful similarities and differences
10. Every propertyQuestion MUST have answerType set to "boolean", "number", or "choice". correctAnswer must be a string. "choice" questions MUST include an options array with the correct answer included.

Return the complete 3D shape explorer configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: threeDShapeExplorerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid 3D shape explorer data returned from Gemini API');
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validation: ensure boolean display options have defaults
  if (typeof data.showUnfoldAnimation !== 'boolean') {
    data.showUnfoldAnimation = data.gradeBand === '1';
  }
  if (typeof data.show3dRotation !== 'boolean') {
    data.show3dRotation = true;
  }

  // Valid shape names
  const validShapes = ['cube', 'sphere', 'cylinder', 'cone', 'rectangular-prism'];
  const validChallengeTypes = ['identify-3d', '2d-vs-3d', 'match-to-real-world', 'faces-and-properties', 'compare'];

  // Filter out invalid challenge types
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Per-challenge validation
  for (const challenge of data.challenges) {
    // Validate identify-3d challenges
    if (challenge.type === 'identify-3d') {
      if (challenge.shape3d && !validShapes.includes(challenge.shape3d)) {
        challenge.shape3d = 'cube';
      }
      if (!challenge.options || challenge.options.length < 2) {
        challenge.options = ['cube', 'sphere', 'cylinder', 'cone'];
      }
      // Ensure correct answer is in options
      if (challenge.shape3d && !challenge.options.includes(challenge.shape3d)) {
        challenge.options[0] = challenge.shape3d;
      }
    }

    // Validate 2d-vs-3d challenges
    if (challenge.type === '2d-vs-3d') {
      if (!challenge.mixedShapes || challenge.mixedShapes.length < 2) {
        challenge.mixedShapes = [
          { name: 'circle', emoji: '🟡', is3d: false },
          { name: 'sphere', emoji: '⚽', is3d: true },
          { name: 'square', emoji: '🟧', is3d: false },
          { name: 'cube', emoji: '🧊', is3d: true },
        ];
      }
    }

    // Validate match-to-real-world challenges
    if (challenge.type === 'match-to-real-world') {
      if (challenge.matchPairs) {
        for (const pair of challenge.matchPairs) {
          if (!validShapes.includes(pair.shape3d)) {
            pair.shape3d = 'cube';
          }
        }
      } else {
        challenge.matchPairs = [
          { realWorldObject: 'basketball', emoji: '🏀', shape3d: 'sphere' },
          { realWorldObject: 'dice', emoji: '🎲', shape3d: 'cube' },
          { realWorldObject: 'can of soup', emoji: '🥫', shape3d: 'cylinder' },
        ];
      }
    }

    // Validate faces-and-properties challenges
    if (challenge.type === 'faces-and-properties') {
      if (challenge.displayShape && !validShapes.includes(challenge.displayShape)) {
        challenge.displayShape = 'cube';
      }
      // Ensure properties exist with reasonable defaults
      if (!challenge.properties) {
        const shapeProps: Record<string, typeof challenge.properties> = {
          cube: { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['square'], canRoll: false, canStack: true, canSlide: true },
          sphere: { flatFaces: 0, curvedSurfaces: 1, faceShapes: [], canRoll: true, canStack: false, canSlide: false },
          cylinder: { flatFaces: 2, curvedSurfaces: 1, faceShapes: ['circle'], canRoll: true, canStack: true, canSlide: true },
          cone: { flatFaces: 1, curvedSurfaces: 1, faceShapes: ['circle'], canRoll: true, canStack: false, canSlide: true },
          'rectangular-prism': { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['rectangle'], canRoll: false, canStack: true, canSlide: true },
        };
        challenge.properties = shapeProps[challenge.displayShape || 'cube'] || shapeProps.cube;
      }
      if (!challenge.propertyQuestions || challenge.propertyQuestions.length === 0) {
        const props = challenge.properties;
        challenge.propertyQuestions = [
          { question: 'How many flat faces does this shape have?', answerType: 'number', correctAnswer: String(props.flatFaces) },
          { question: 'Can this shape roll?', answerType: 'boolean', correctAnswer: String(props.canRoll) },
          { question: 'Can this shape stack?', answerType: 'boolean', correctAnswer: String(props.canStack) },
        ];
        if (props.faceShapes && props.faceShapes.length > 0) {
          challenge.propertyQuestions.push({
            question: 'What shape are the flat faces?',
            answerType: 'choice',
            correctAnswer: props.faceShapes[0],
            options: ['circle', 'square', 'rectangle', 'triangle'],
          });
        }
      }
      // Ensure all correctAnswer values are strings and answerType is valid
      const validAnswerTypes = ['boolean', 'number', 'choice'];
      for (const q of challenge.propertyQuestions) {
        q.correctAnswer = String(q.correctAnswer);
        if (!validAnswerTypes.includes(q.answerType)) {
          // Infer answerType from correctAnswer content
          if (q.correctAnswer === 'true' || q.correctAnswer === 'false') {
            q.answerType = 'boolean';
          } else if (!isNaN(Number(q.correctAnswer))) {
            q.answerType = 'number';
          } else {
            q.answerType = 'choice';
            if (!q.options || q.options.length < 2) {
              q.options = ['circle', 'square', 'rectangle', 'triangle'];
            }
          }
        }
        // Ensure choice questions have options with the correct answer included
        if (q.answerType === 'choice') {
          if (!q.options || q.options.length < 2) {
            q.options = ['circle', 'square', 'rectangle', 'triangle'];
          }
          if (!q.options.includes(q.correctAnswer)) {
            q.options[0] = q.correctAnswer;
          }
        }
      }
    }

    // Validate compare challenges
    if (challenge.type === 'compare') {
      if (challenge.shape1 && !validShapes.includes(challenge.shape1)) {
        challenge.shape1 = 'cube';
      }
      if (challenge.shape2 && !validShapes.includes(challenge.shape2)) {
        challenge.shape2 = 'sphere';
      }
      if (!challenge.similarities || challenge.similarities.length === 0) {
        challenge.similarities = ['Both are 3D shapes'];
      }
      if (!challenge.differences || challenge.differences.length === 0) {
        challenge.differences = ['They have different numbers of faces'];
      }
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [
      {
        id: 'c1',
        type: 'identify-3d',
        instruction: 'What shape is this? It looks like a ball!',
        shape3d: 'sphere',
        options: ['cube', 'sphere', 'cylinder', 'cone'],
      },
      {
        id: 'c2',
        type: '2d-vs-3d',
        instruction: 'Can you sort the flat shapes from the solid shapes?',
        mixedShapes: [
          { name: 'circle', emoji: '🟡', is3d: false },
          { name: 'sphere', emoji: '⚽', is3d: true },
          { name: 'square', emoji: '🟧', is3d: false },
          { name: 'cube', emoji: '🧊', is3d: true },
        ],
      },
    ];
  }

  // Apply explicit config overrides
  if (config) {
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.showUnfoldAnimation !== undefined) data.showUnfoldAnimation = config.showUnfoldAnimation;
    if (config.show3dRotation !== undefined) data.show3dRotation = config.show3dRotation;
    if (config.title !== undefined) data.title = config.title;
    if (config.description !== undefined) data.description = config.description;
  }

  return data;
};
