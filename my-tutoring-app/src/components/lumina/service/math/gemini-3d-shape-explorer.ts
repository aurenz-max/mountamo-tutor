import { Type, Schema } from "@google/genai";
import { ThreeDShapeExplorerData } from "../../primitives/visual-primitives/math/ThreeDShapeExplorer";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'identify-3d': {
    promptDoc:
      `"identify-3d": Show a 3D shape, student picks its name from options. `
      + `Set shape3d to the shape name. Provide 3-4 options including the correct answer. `
      + `Great for introducing shape vocabulary. Concrete identification task.`,
    schemaDescription: "'identify-3d' (name the 3D shape)",
  },
  'match-to-real-world': {
    promptDoc:
      `"match-to-real-world": Match real-world objects to their 3D shapes. `
      + `Provide 3-5 matchPairs with realWorldObject, emoji, and shape3d. `
      + `Use kid-friendly objects (basketball=sphere, dice=cube, can=cylinder, party hat=cone, shoebox=rectangular-prism).`,
    schemaDescription: "'match-to-real-world' (connect shapes to objects)",
  },
  '2d-vs-3d': {
    promptDoc:
      `"2d-vs-3d": Show a mix of flat (2D) and solid (3D) shapes, student sorts them. `
      + `Provide 4-6 mixedShapes with name, emoji, and is3d flag. `
      + `Include 2D shapes: circle, square, triangle, rectangle. `
      + `Include 3D shapes: cube, sphere, cylinder, cone. `
      + `Use clear emojis.`,
    schemaDescription: "'2d-vs-3d' (sort flat vs solid)",
  },
  'faces-and-properties': {
    promptDoc:
      `"faces-and-properties": Explore a shape's properties. `
      + `Set displayShape to the shape. `
      + `Provide accurate properties (flatFaces, curvedSurfaces, faceShapes, canRoll, canStack, canSlide). `
      + `Provide 2-4 propertyQuestions with answerType: "boolean"/"number"/"choice", correctAnswer as string, `
      + `and options array for "choice" type. `
      + `CORRECT PROPERTIES: cube: 6 flat, 0 curved, ["square"]; sphere: 0 flat, 1 curved, []; `
      + `cylinder: 2 flat, 1 curved, ["circle"]; cone: 1 flat, 1 curved, ["circle"]; `
      + `rectangular-prism: 6 flat, 0 curved, ["rectangle"].`,
    schemaDescription: "'faces-and-properties' (explore shape properties)",
  },
  'shape-riddle': {
    promptDoc:
      `"shape-riddle": A mystery shape detective challenge! Give clues, student guesses the shape. `
      + `Set shape3d to the correct answer shape. Provide 3-4 options including the correct answer. `
      + `Provide 3-4 clues describing properties without naming the shape. `
      + `Clues should reference faces, rolling, stacking, real-world look-alikes. `
      + `NEVER include the shape name in any clue!`,
    schemaDescription: "'shape-riddle' (guess mystery shape from clues)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

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
            description: "Challenge type: 'identify-3d' (name the shape), '2d-vs-3d' (sort flat vs solid), 'match-to-real-world' (connect shapes to objects), 'faces-and-properties' (explore properties), 'shape-riddle' (guess mystery shape from clues)"
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
          // shape-riddle fields (also uses shape3d + options from identify-3d)
          clues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For shape-riddle: 3-4 detective clues describing the mystery shape's properties (e.g., 'I have no flat faces.', 'I can roll in any direction.', 'I look like a ball!')"
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
  config?: Partial<ThreeDShapeExplorerData> & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<ThreeDShapeExplorerData> => {
  // ---------------------------------------------------------------------------
  // Eval mode resolution
  // ---------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    '3d-shape-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('3DShapeExplorer', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(threeDShapeExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : threeDShapeExplorerSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

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

${challengeTypeSection}

${!evalConstraint ? `GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Focus on identify-3d, 2d-vs-3d, and match-to-real-world
  * Use very simple language ("This shape looks like a ball!")
  * 3-4 challenges, mostly identification and sorting
  * showUnfoldAnimation: false, show3dRotation: true

- Grade 1 (gradeBand "1"):
  * Include faces-and-properties and shape-riddle challenges
  * Slightly more academic language but still warm
  * 4-5 challenges with variety of types
  * showUnfoldAnimation: true, show3dRotation: true
` : ''}
${config ? `
CONFIGURATION HINTS:
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.showUnfoldAnimation !== undefined ? `- Show unfold animation: ${config.showUnfoldAnimation}` : ''}
${config.show3dRotation !== undefined ? `- Show 3D rotation: ${config.show3dRotation}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress from easier to harder
2. ${evalConstraint ? `ALL challenges must use ONLY the allowed challenge type(s)` : 'Mix challenge types appropriate for the grade level'}
3. Use warm, encouraging language for young children
4. Shape names MUST be exactly: "cube", "sphere", "cylinder", "cone", "rectangular-prism"
5. For identify-3d challenges, the correct shape name MUST be in the options array
6. For faces-and-properties, properties MUST be factually accurate
7. For 2d-vs-3d, include a balanced mix of 2D and 3D shapes
8. For match-to-real-world, use objects kids recognize from everyday life
9. For shape-riddle, NEVER include the shape name in any clue — clues must describe properties only
10. Every propertyQuestion MUST have answerType set to "boolean", "number", or "choice". correctAnswer must be a string. "choice" questions MUST include an options array with the correct answer included.

Return the complete 3D shape explorer configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
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
  const validChallengeTypes = ['identify-3d', '2d-vs-3d', 'match-to-real-world', 'faces-and-properties', 'shape-riddle'];

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

    // Validate shape-riddle challenges
    if (challenge.type === 'shape-riddle') {
      if (challenge.shape3d && !validShapes.includes(challenge.shape3d)) {
        challenge.shape3d = 'sphere';
      }
      if (!challenge.options || challenge.options.length < 2) {
        challenge.options = ['cube', 'sphere', 'cylinder', 'cone'];
      }
      if (challenge.shape3d && !challenge.options.includes(challenge.shape3d)) {
        challenge.options[0] = challenge.shape3d;
      }
      if (!challenge.clues || challenge.clues.length === 0) {
        const fallbackClues: Record<string, string[]> = {
          cube: ['I have 6 flat faces.', 'All my faces are squares.', 'I cannot roll.', 'I look like a dice!'],
          sphere: ['I have no flat faces.', 'I can roll in any direction.', 'I have one curved surface.', 'I look like a ball!'],
          cylinder: ['I have 2 flat faces.', 'My flat faces are circles.', 'I can roll and stack.', 'I look like a can!'],
          cone: ['I have 1 flat face.', 'I have a point at the top.', 'My flat face is a circle.', 'I look like a party hat!'],
          'rectangular-prism': ['I have 6 flat faces.', 'My faces are rectangles.', 'I cannot roll.', 'I look like a cereal box!'],
        };
        challenge.clues = fallbackClues[challenge.shape3d || 'sphere'] || fallbackClues.sphere;
      }
      // Strip any clues that accidentally contain the shape name
      const shapeName = (challenge.shape3d || '').replace('-', ' ');
      challenge.clues = challenge.clues.map((clue: string) =>
        clue.toLowerCase().includes(shapeName) ? clue.replace(new RegExp(shapeName, 'gi'), '???') : clue
      );
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'identify-3d';
    if (fallbackType === 'identify-3d') {
      data.challenges = [{
        id: 'c1',
        type: 'identify-3d',
        instruction: 'What shape is this? It looks like a ball!',
        shape3d: 'sphere',
        options: ['cube', 'sphere', 'cylinder', 'cone'],
      }];
    } else if (fallbackType === 'match-to-real-world') {
      data.challenges = [{
        id: 'c1',
        type: 'match-to-real-world',
        instruction: 'Can you match each object to its 3D shape?',
        matchPairs: [
          { realWorldObject: 'basketball', emoji: '🏀', shape3d: 'sphere' },
          { realWorldObject: 'dice', emoji: '🎲', shape3d: 'cube' },
          { realWorldObject: 'can of soup', emoji: '🥫', shape3d: 'cylinder' },
        ],
      }];
    } else if (fallbackType === '2d-vs-3d') {
      data.challenges = [{
        id: 'c1',
        type: '2d-vs-3d',
        instruction: 'Can you sort the flat shapes from the solid shapes?',
        mixedShapes: [
          { name: 'circle', emoji: '🟡', is3d: false },
          { name: 'sphere', emoji: '⚽', is3d: true },
          { name: 'square', emoji: '🟧', is3d: false },
          { name: 'cube', emoji: '🧊', is3d: true },
        ],
      }];
    } else if (fallbackType === 'faces-and-properties') {
      data.challenges = [{
        id: 'c1',
        type: 'faces-and-properties',
        instruction: 'Let\'s explore the properties of a cube!',
        displayShape: 'cube',
        properties: { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['square'], canRoll: false, canStack: true, canSlide: true },
        propertyQuestions: [
          { question: 'How many flat faces does this shape have?', answerType: 'number', correctAnswer: '6' },
          { question: 'Can this shape roll?', answerType: 'boolean', correctAnswer: 'false' },
        ],
      }];
    } else {
      data.challenges = [{
        id: 'c1',
        type: 'shape-riddle',
        instruction: 'Can you guess the mystery shape from the clues?',
        shape3d: 'sphere',
        options: ['cube', 'sphere', 'cylinder', 'cone'],
        clues: ['I have no flat faces.', 'I can roll in any direction.', 'I have one curved surface.', 'I look like a ball!'],
      }];
    }
  }

  // Apply explicit config overrides
  if (config) {
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.showUnfoldAnimation !== undefined) data.showUnfoldAnimation = config.showUnfoldAnimation;
    if (config.show3dRotation !== undefined) data.show3dRotation = config.show3dRotation;
    if (config.title !== undefined) data.title = config.title;
    if (config.description !== undefined) data.description = config.description;
  }

  // Final summary log (matches pattern from other generators)
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[3DShapeExplorer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
