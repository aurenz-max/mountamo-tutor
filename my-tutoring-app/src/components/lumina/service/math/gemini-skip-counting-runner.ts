import { Type, Schema } from "@google/genai";
import { SkipCountingRunnerData } from "../../primitives/visual-primitives/math/SkipCountingRunner";
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
  count_along: {
    promptDoc:
      `"count_along": Character jumps automatically, student watches and counts along. `
      + `startPosition = startFrom (e.g. 0). Use autoPlay: true. `
      + `Concrete — full guidance, rhythmic counting with visual support. `
      + `Narration should count rhythmically: "5... 10... 15..."`,
    schemaDescription: "'count_along' (follow skip-count sequence)",
  },
  predict: {
    promptDoc:
      `"predict": Student guesses the NEXT landing after startPosition. `
      + `Set startPosition to a position partway along the sequence. `
      + `Example: skip by 4, startPosition=16 → student must answer 20. `
      + `Instruction MUST match startPosition: "The rabbit is at 16. Where is the next landing?" `
      + `Pictorial with prompts — anticipate next value.`,
    schemaDescription: "'predict' (anticipate next value)",
  },
  fill_missing: {
    promptDoc:
      `"fill_missing": Some positions are hidden, student types the missing numbers. `
      + `startPosition = startFrom. Set hiddenPositions array with the positions to hide. `
      + `Pictorial with reduced prompts — complete missing terms in the sequence.`,
    schemaDescription: "'fill_missing' (complete missing terms)",
  },
  find_skip_value: {
    promptDoc:
      `"find_skip_value": Student identifies the skip amount from a displayed sequence. `
      + `startPosition = startFrom. Show several jumps and ask "How much is each jump?" `
      + `Transitional — discover the skip interval from the pattern.`,
    schemaDescription: "'find_skip_value' (discover the skip interval)",
  },
  connect_multiplication: {
    promptDoc:
      `"connect_multiplication": Student states the multiplication fact for the full journey up to startPosition. `
      + `Example: skip by 4, startPosition=28 → show 7 jumps → student answers "7 × 4 = 28". `
      + `Set targetFact to the multiplication fact string. `
      + `Instruction MUST reference startPosition. `
      + `Symbolic — link skip counting to multiplication facts.`,
    schemaDescription: "'connect_multiplication' (link to multiplication facts)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const skipCountingRunnerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the skip counting activity (e.g., 'Jump by 5s!', 'Frog Leaps by 3s')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    skipValue: {
      type: Type.NUMBER,
      description: "The skip counting value (2, 3, 4, 5, 10, etc.)"
    },
    startFrom: {
      type: Type.NUMBER,
      description: "Starting number on the number line (default 0)"
    },
    endAt: {
      type: Type.NUMBER,
      description: "Ending number on the number line (e.g., 30, 50, 100)"
    },
    direction: {
      type: Type.STRING,
      description: "Counting direction: 'forward' (default) or 'backward' (division preview for grade 3)"
    },
    character: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "Character type: 'frog', 'kangaroo', 'rabbit', 'rocket', or 'custom'"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Optional image prompt describing the character"
        }
      },
      required: ["type"]
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
            description: "Challenge type: 'count_along' (follow skip-count sequence), 'predict' (anticipate next value), 'fill_missing' (complete missing terms), 'find_skip_value' (discover the skip interval), 'connect_multiplication' (link to multiplication facts)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction text, rhythmic and encouraging"
          },
          hiddenPositions: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Positions where labels are hidden for prediction/fill challenges"
          },
          targetFact: {
            type: Type.STRING,
            description: "The multiplication fact to discover (e.g., '4 × 5 = 20'). Only for connect_multiplication type."
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge"
          },
          startPosition: {
            type: Type.NUMBER,
            description: "The position the character should be at when this challenge starts. REQUIRED for predict (the position the student predicts FROM, e.g. 16 means 'what comes after 16?') and connect_multiplication (the target position showing the full journey, e.g. 28 means show jumps from 0 to 28). Must be a multiple of skipValue from startFrom."
          }
        },
        required: ["id", "type", "instruction", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showArray: {
          type: Type.BOOLEAN,
          description: "Show parallel array visualization (rows x skip value)"
        },
        showJumpArcs: {
          type: Type.BOOLEAN,
          description: "Show arc trails for each jump"
        },
        showEquation: {
          type: Type.BOOLEAN,
          description: "Show the multiplication equation (n x skipValue = position)"
        },
        showDigitPattern: {
          type: Type.BOOLEAN,
          description: "Highlight patterns in ones digits (e.g., 5,0,5,0 for 5s)"
        },
        autoPlay: {
          type: Type.BOOLEAN,
          description: "Character jumps automatically (for watch phase)"
        }
      },
      required: ["showArray", "showJumpArcs", "showEquation", "showDigitPattern", "autoPlay"]
    },
    gameMode: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether game mode is active"
        },
        type: {
          type: Type.STRING,
          description: "Game type: 'catch_the_number', 'fill_the_gaps', 'speed_count'"
        },
        timeLimit: {
          type: Type.NUMBER,
          description: "Time limit in seconds (null for no limit)"
        }
      },
      required: ["enabled"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '1-2' for Grades 1-2, '2-3' for Grades 2-3"
    }
  },
  required: ["title", "description", "skipValue", "startFrom", "endAt", "direction", "character", "challenges", "showOptions", "gradeBand"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateSkipCountingRunner = async (
  topic: string,
  gradeLevel: string,
  config?: {
    skipValue?: number;
    gradeBand?: '1-2' | '2-3';
    direction?: 'forward' | 'backward';
    challengeTypes?: string[];
    characterType?: string;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /** Intent or title from the manifest item. */
    intent?: string;
  }
): Promise<SkipCountingRunnerData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'skip-counting-runner',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(skipCountingRunnerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : skipCountingRunnerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational skip counting activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Skip counting is the bridge from counting to multiplication
- When a child counts 5, 10, 15, 20, they're doing 5x1, 5x2, 5x3, 5x4
- The number line with animated jumps makes the equal-sized leaps visible
- Arrays built alongside connect to multiplication models

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Grades 1-2 (gradeBand "1-2"):
  * Skip count by 2s, 5s, and 10s ONLY
  * Forward direction only (no backward counting)
  * Start from 0, end at 20-50 depending on skip value
  * Use autoPlay: true for first challenge (count_along)
  * Challenges: 'count_along' and 'predict' only
  * Fun character: frog or kangaroo preferred
  * Rhythmic, simple narration: "5... 10... 15... what comes next?"
  * showArray: false or true for simple cases
  * showEquation: false
  * Do NOT include find_skip_value or connect_multiplication

- Grades 2-3 (gradeBand "2-3"):
  * Skip count by 2s, 3s, 4s, 5s, 10s
  * Can include backward counting (direction: 'backward') for division preview
  * Start from 0 (or higher for backward), end at 30-100
  * Include prediction and multiplication connection challenges
  * Challenges: all types including 'find_skip_value' and 'connect_multiplication'
  * showArray: true (connect to multiplication arrays)
  * showEquation: true
  * showDigitPattern: true for 5s and 10s
` : ''}

STARTPOSITION RULES:
Each challenge has a "startPosition" — the number-line position the character occupies when the challenge begins.
The component builds landing spots from startFrom up to startPosition automatically.
- count_along / fill_missing / find_skip_value: startPosition = startFrom (e.g. 0)
- predict: startPosition = a position partway along the sequence (e.g. 16 for skip-by-4). Instruction MUST reference startPosition.
- connect_multiplication: startPosition = the target product (e.g. 28 for 7×4). Instruction MUST reference startPosition. Include targetFact.

CRITICAL: The position mentioned in the instruction text MUST exactly match startPosition.

CHARACTER TYPES: frog, kangaroo, rabbit, rocket
- Frog: "leaping" by 2s or 3s
- Kangaroo: "hopping" by 5s
- Rabbit: "bouncing" by 2s
- Rocket: "blasting" by 10s

${(() => {
  const hints: string[] = [];
  if (config?.skipValue) hints.push(`- Skip value: ${config.skipValue}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (config?.direction) hints.push(`- Direction: ${config.direction}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.characterType) hints.push(`- Character: ${config.characterType}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. The endAt should be a multiple of skipValue (from startFrom)
3. Use rhythmic, encouraging narration that counts along: "5... 10... 15..."
4. For predict challenges, set hiddenPositions to numbers the student must guess
5. For connect_multiplication, include the targetFact string
6. Include meaningful hints
7. Choose a character that fits the story context
8. EVERY challenge MUST have a startPosition that is a valid multiple of skipValue from startFrom
9. For predict: startPosition should be a few jumps in (not 0), and instruction must reference that position
10. For connect_multiplication: startPosition should be far enough along for a meaningful multiplication fact

Return the complete skip counting runner configuration.
`;

  logEvalModeResolution('SkipCountingRunner', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid skip counting runner data returned from Gemini API');
  }

  // Validation: ensure skipValue is a positive number
  if (!data.skipValue || data.skipValue <= 0) {
    data.skipValue = 5;
  }

  // Validation: ensure direction is valid
  if (data.direction !== 'forward' && data.direction !== 'backward') {
    data.direction = 'forward';
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== '1-2' && data.gradeBand !== '2-3') {
    data.gradeBand = gradeLevel.toLowerCase().includes('1') ? '1-2' : '2-3';
  }

  // Grades 1-2 should not have backward counting
  if (data.gradeBand === '1-2' && data.direction === 'backward') {
    data.direction = 'forward';
  }

  // Grades 1-2 should only use 2, 5, or 10
  if (data.gradeBand === '1-2' && ![2, 5, 10].includes(data.skipValue)) {
    data.skipValue = 5;
  }

  // Ensure startFrom and endAt are numbers
  if (typeof data.startFrom !== 'number') data.startFrom = 0;
  if (typeof data.endAt !== 'number') data.endAt = data.skipValue * 10;

  // Ensure endAt is reachable from startFrom
  if (data.direction === 'forward' && data.endAt <= data.startFrom) {
    data.endAt = data.startFrom + data.skipValue * 10;
  }
  if (data.direction === 'backward' && data.endAt >= data.startFrom) {
    data.endAt = Math.max(0, data.startFrom - data.skipValue * 10);
  }

  // Ensure character
  if (!data.character) {
    data.character = { type: 'frog' };
  }
  const validCharacters = ['frog', 'kangaroo', 'rabbit', 'rocket', 'custom'];
  if (!validCharacters.includes(data.character.type)) {
    data.character.type = 'frog';
  }

  // Ensure challenges have valid types (safety net — schema enum handles the eval mode case)
  const validChallengeTypes = ['count_along', 'predict', 'fill_missing', 'find_skip_value', 'connect_multiplication'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'count_along';
    const sv = data.skipValue;
    const sf = data.startFrom;
    const fallbacks: Record<string, { type: string; instruction: string; hint: string; narration: string; startPosition?: number; hiddenPositions?: number[]; targetFact?: string }> = {
      count_along: { type: 'count_along', instruction: `Watch the ${data.character.type} jump by ${sv}s! Count along!`, hint: `Count by ${sv}s: ${sf}, ${sf + sv}, ${sf + sv * 2}...`, narration: `Let's watch our ${data.character.type} friend jump by ${sv}s! Ready? ${sf}... ${sf + sv}... ${sf + sv * 2}...`, startPosition: sf },
      predict: { type: 'predict', instruction: `The ${data.character.type} is at ${sf + sv * 3}. Where does it land next?`, hint: `Add ${sv} to ${sf + sv * 3}.`, narration: `Can you predict the next landing spot?`, startPosition: sf + sv * 3 },
      fill_missing: { type: 'fill_missing', instruction: `Some numbers are missing! Fill in the blanks.`, hint: `Count by ${sv}s from ${sf}.`, narration: `Oh no, some numbers disappeared! Can you find them?`, startPosition: sf, hiddenPositions: [sf + sv * 2, sf + sv * 4] },
      find_skip_value: { type: 'find_skip_value', instruction: `Look at the jumps. How much is each jump?`, hint: `Find the difference between two neighbors.`, narration: `Can you figure out how far each jump goes?`, startPosition: sf },
      connect_multiplication: { type: 'connect_multiplication', instruction: `The ${data.character.type} made jumps to reach ${sf + sv * 5}. What multiplication fact is that?`, hint: `Count the jumps, then multiply: jumps × ${sv}.`, narration: `Skip counting IS multiplication!`, startPosition: sf + sv * 5, targetFact: `5 × ${sv} = ${sf + sv * 5}` },
    };
    console.log(`[SkipCountingRunner] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...fallbacks[fallbackType] ?? fallbacks.count_along }];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[SkipCountingRunner] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Ensure showOptions
  if (!data.showOptions) {
    data.showOptions = {
      showArray: data.gradeBand === '2-3',
      showJumpArcs: true,
      showEquation: data.gradeBand === '2-3',
      showDigitPattern: data.skipValue === 5 || data.skipValue === 10,
      autoPlay: false,
    };
  }

  // Ensure gameMode
  if (!data.gameMode) {
    data.gameMode = { enabled: false };
  }

  // Apply explicit config overrides
  if (config) {
    if (config.skipValue !== undefined) data.skipValue = config.skipValue;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.direction !== undefined) data.direction = config.direction;
    if (config.characterType !== undefined) data.character.type = config.characterType;
  }

  // ── Validate / compute startPosition for each challenge ──
  // Build the full sequence of valid positions
  const positions: number[] = [];
  if (data.direction === 'forward') {
    for (let pos = data.startFrom; pos <= data.endAt; pos += data.skipValue) positions.push(pos);
  } else {
    for (let pos = data.startFrom; pos >= data.endAt; pos -= data.skipValue) positions.push(pos);
  }

  const positionSet = new Set(positions);
  let progressIdx = 0; // tracks progression through sequence across challenges

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.challenges.forEach((challenge: any) => {
    // If Gemini provided a valid startPosition, use it
    if (typeof challenge.startPosition === 'number' && positionSet.has(challenge.startPosition)) {
      const idx = positions.indexOf(challenge.startPosition);
      if (idx >= 0) progressIdx = idx;
      return;
    }

    // Try to extract a position from the instruction text (e.g. "is at 16", "landed on 28")
    const posRegex = /(?:at|on|reached|landed on|is at)\s+(\d+)/i;
    const match = challenge.instruction?.match(posRegex);
    if (match) {
      const mentioned = parseInt(match[1], 10);
      if (positionSet.has(mentioned)) {
        challenge.startPosition = mentioned;
        const idx = positions.indexOf(mentioned);
        if (idx >= 0) progressIdx = idx;
        return;
      }
    }

    // For connect_multiplication, try parsing targetFact (e.g. "7 × 4 = 28")
    if (challenge.type === 'connect_multiplication' && challenge.targetFact) {
      const factMatch = challenge.targetFact.match(/=\s*(\d+)/);
      if (factMatch) {
        const product = parseInt(factMatch[1], 10);
        if (positionSet.has(product)) {
          challenge.startPosition = product;
          const idx = positions.indexOf(product);
          if (idx >= 0) progressIdx = idx;
          return;
        }
      }
    }

    // Fallback: compute a reasonable startPosition based on challenge type
    switch (challenge.type) {
      case 'count_along':
      case 'fill_missing':
      case 'find_skip_value':
        challenge.startPosition = data.startFrom;
        progressIdx = 0;
        break;
      case 'predict':
        // Place a few jumps into the sequence so the prediction isn't trivial
        progressIdx = Math.min(Math.max(progressIdx + 2, 3), positions.length - 2);
        if (progressIdx < 0) progressIdx = 0;
        challenge.startPosition = positions[progressIdx];
        break;
      case 'connect_multiplication':
        // Place far enough for a meaningful multiplication fact
        progressIdx = Math.min(Math.max(progressIdx + 3, Math.floor(positions.length * 0.5)), positions.length - 1);
        challenge.startPosition = positions[progressIdx];
        break;
      default:
        challenge.startPosition = data.startFrom;
        break;
    }
  });

  return data;
};
