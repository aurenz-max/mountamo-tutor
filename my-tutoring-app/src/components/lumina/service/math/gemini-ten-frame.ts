import { Type, Schema } from "@google/genai";
import { TenFrameData } from "../../primitives/visual-primitives/math/TenFrame";
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
// Each entry provides:
//   promptDoc     — injected into the Gemini prompt (only for allowed types)
//   schemaDescription — concise label for the schema enum description
//
// When an eval mode is active, only the relevant entries are included.
// When no eval mode, all entries are included for mixed-difficulty generation.

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build: {
    promptDoc:
      `"build": Student places exactly N counters on the frame. targetCount = N. `
      + `Use warm language ("Put 5 counters on the frame!"). `
      + `Numbers 1-7 for K, 1-10 for grades 1-2. Full scaffolding — concrete manipulative.`,
    schemaDescription: "'build' (place counters)",
  },
  subitize: {
    promptDoc:
      `"subitize": Counters flash briefly, student types how many they saw. `
      + `Set flashDuration: 1500-2000ms for K, 1000-1500ms for grades 1-2. `
      + `Numbers 1-5 for K, 1-10 for grades 1-2. Vary arrangements for perceptual fluency.`,
    schemaDescription: "'subitize' (flash and identify count)",
  },
  make_ten: {
    promptDoc:
      `"make_ten": Frame shows some counters, student enters how many more to fill the frame. `
      + `For single frame: make 10. For double frame: make 20. `
      + `targetCount = number of counters ALREADY shown (must be < frame capacity). `
      + `Use varied starting counts (3-8 for single frame). Focus on number bonds to 10.`,
    schemaDescription: "'make_ten' (find complement to 10)",
  },
  add: {
    promptDoc:
      `"add": The frame starts EMPTY — no counters are pre-placed. `
      + `Student places both addends themselves. targetCount = sum. startCount is NOT used for add. `
      + `Instruction MUST tell the student to place both groups (e.g., "Place 8 counters, then add 5 more to show 13!"). `
      + `Do NOT say counters are "already" on the frame — the student places everything. `
      + `Use numbers that encourage the make-ten strategy (e.g., 8+5, 7+6).`,
    schemaDescription: "'add' (addition)",
  },
  subtract: {
    promptDoc:
      `"subtract": Student removes counters from a pre-filled frame. `
      + `MUST set startCount (counters shown initially) AND targetCount (counters remaining). `
      + `Example: startCount=7, targetCount=4 means "start with 7, take away 3, 4 remain". `
      + `Instruction MUST name starting amount AND removal amount. Do NOT reveal the answer.`,
    schemaDescription: "'subtract' (subtraction)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const tenFrameSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the ten frame activity (e.g., 'Building Numbers to 10', 'Make Ten!')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    mode: {
      type: Type.STRING,
      description: "Frame mode: 'single' for one 2x5 frame (numbers 0-10), 'double' for two frames (numbers 0-20)"
    },
    counters: {
      type: Type.OBJECT,
      properties: {
        count: {
          type: Type.NUMBER,
          description: "Initial number of counters to place (usually 0 for build challenges)"
        },
        color: {
          type: Type.STRING,
          description: "Counter color: 'red', 'yellow', 'blue', or 'green'"
        },
        positions: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Initial counter positions (0-9 for single, 0-19 for double). Usually empty array for build challenges."
        }
      },
      required: ["count", "color", "positions"]
    },
    twoColorMode: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether two-color decomposition is active"
        },
        color1Count: {
          type: Type.NUMBER,
          description: "Number of counters in color 1"
        },
        color2Count: {
          type: Type.NUMBER,
          description: "Number of counters in color 2"
        },
        color1: {
          type: Type.STRING,
          description: "First counter color"
        },
        color2: {
          type: Type.STRING,
          description: "Second counter color"
        }
      },
      required: ["enabled", "color1Count", "color2Count", "color1", "color2"]
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
            description: "Challenge type: 'build' (place counters), 'subitize' (flash and identify count), 'make_ten' (find complement to 10), 'add' (addition), 'subtract' (subtraction)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction text, warm and encouraging (e.g., 'Put 7 counters on the frame!')"
          },
          targetCount: {
            type: Type.NUMBER,
            description: "Target number for this challenge (0-10 for single, 0-20 for double)"
          },
          startCount: {
            type: Type.NUMBER,
            description: "For subtract challenges: how many counters are pre-filled on the frame before removal. E.g. startCount=7, targetCount=4 means 'start with 7, take away 3, 4 remain'."
          },
          flashDuration: {
            type: Type.NUMBER,
            description: "Duration in ms for subitize flash (e.g., 1500). Only used for subitize challenges."
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce the challenge)"
          }
        },
        required: ["id", "type", "instruction", "targetCount", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showCount: {
          type: Type.BOOLEAN,
          description: "Show counter count below the frame"
        },
        showEquation: {
          type: Type.BOOLEAN,
          description: "Show equation representation (for add/subtract)"
        },
        showEmptyCount: {
          type: Type.BOOLEAN,
          description: "Show the number of empty spaces"
        },
        allowFlip: {
          type: Type.BOOLEAN,
          description: "Allow flipping counter colors"
        }
      },
      required: ["showCount", "showEquation", "showEmptyCount", "allowFlip"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1-2' for Grades 1-2"
    }
  },
  required: ["title", "description", "mode", "counters", "challenges", "showOptions", "gradeBand"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateTenFrame = async (
  topic: string,
  gradeLevel: string,
  config?: {
    mode?: 'single' | 'double';
    gradeBand?: 'K' | '1-2';
    challengeTypes?: string[];
    counterColor?: string;
    twoColorEnabled?: boolean;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
  }
): Promise<TenFrameData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'ten-frame',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Build mode-constrained schema ──
  // When an eval mode is active, the schema enum restricts challenge.type
  // so Gemini *cannot* produce disallowed types. No post-filtering needed.
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(tenFrameSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : tenFrameSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational ten frame activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A ten frame is a 2×5 rectangular grid used to build number sense
- Students place counters (colored circles) on the grid to represent numbers
- Key skills: subitizing (instant recognition), composing/decomposing numbers, making 10
- The frame makes the relationship to 5 and 10 highly visible

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Build challenges with numbers 1-10 (single frame)
  * Subitize flash with numbers 1-5 (short flash durations, 1500-2000ms)
  * Two-color decomposition (e.g., 3 red + 4 yellow = 7)
  * Focus on "how many?" and "how many more to make 5/10?"
  * Use single frame mode ONLY
  * Simple, encouraging language ("Put 4 counters on the frame!")

- Grades 1-2 (gradeBand "1-2"):
  * Make-ten challenges (given some counters, find the complement to 10)
  * Addition using double frames (e.g., 8 + 5 = 13)
  * Subtraction with counters (start with N, remove some)
  * Subitize with larger numbers (up to 10), faster flash (1000-1500ms)
  * Can use double frame for numbers 11-20
  * Build on make-ten strategy for mental math
` : ''}

SUBTRACTION GUIDELINES (if generating subtract challenges):
- Always include startCount for subtract challenges (it controls how many counters appear)
- Use numbers within 10 for single frame (startCount ≤ 10)
- Instruction should name the starting amount AND the amount to remove, e.g. "There are 8 counters. Take away 5!"
- Do NOT reveal the answer in the instruction — ask "How many are left?" without stating the result

${(() => {
  const hints: string[] = [];
  if (config?.mode) hints.push(`- Frame mode: ${config.mode}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.counterColor) hints.push(`- Counter color: ${config.counterColor}`);
  if (config?.twoColorEnabled) hints.push(`- Two-color decomposition: enabled`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

CRITICAL — NUMERIC CONSISTENCY:
The numbers in the instruction text MUST EXACTLY match the challenge's numeric fields. The UI displays counters based on the numeric fields, NOT the instruction text. If they disagree, students see a mismatch.
- build: the number in instruction MUST equal targetCount (e.g., targetCount=5 → "Put 5 counters on the frame!")
- subtract: instruction MUST mention startCount as the starting amount AND (startCount − targetCount) as the removal amount (e.g., startCount=8, targetCount=5 → "There are 8 counters. Take away 3.")
- make_ten: instruction MUST mention targetCount as the number already on the frame. For single frame: "make 10". For double frame: "make 20". (e.g., single: targetCount=6 → "There are 6 counters. How many more to make 10?"; double: targetCount=12 → "There are 12 counters. How many more to make 20?")
- add: instruction numbers MUST sum to targetCount

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Start with easier challenges and build up
3. Use warm, encouraging instruction text appropriate for young children
4. Set initial counter count and positions to 0/empty for build challenges
5. For subitize challenges, use flashDuration between 1000-2000ms
6. For make_ten challenges, targetCount should be the number of counters ALREADY on the frame (must be less than frame capacity: <10 for single, <20 for double)
7. Include meaningful hints that guide without giving the answer
8. Include narration text the AI tutor can use to introduce each challenge
9. For Kindergarten: stick to single frame, numbers 1-10, build and subitize only
10. For Grades 1-2: can include make_ten, add, subtract, and double frame
11. Set showOptions appropriately:
    - showCount: true for build challenges, false for subitize
    - showEmptyCount: false for make_ten (showing empty count leaks the complement answer)
    - showEquation: true for add/subtract

Return the complete ten frame configuration.
`;

  logEvalModeResolution('TenFrame', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid ten frame data returned from Gemini API');
  }

  // ── Structural validation (mode, gradeBand, counters) ──

  if (data.mode !== 'single' && data.mode !== 'double') {
    data.mode = 'single';
  }

  if (data.gradeBand !== 'K' && data.gradeBand !== '1-2') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1-2';
  }

  if (data.gradeBand === 'K' && data.mode === 'double') {
    data.mode = 'single';
  }

  // Filter to valid challenge types (safety net — schema enum handles the eval mode case)
  const validTypes = ['build', 'subitize', 'make_ten', 'add', 'subtract'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // ── Domain-specific validation ──

  // Validate subtract challenges: ensure startCount is present and sensible
  for (const ch of data.challenges as Array<{ type: string; startCount?: number; targetCount: number; instruction: string }>) {
    if (ch.type === 'subtract') {
      const maxCount = data.mode === 'double' ? 20 : 10;
      if (ch.startCount == null || ch.startCount <= 0) {
        ch.startCount = Math.min(ch.targetCount + 2, maxCount);
      }
      if (ch.startCount <= ch.targetCount) {
        ch.startCount = Math.min(ch.targetCount + 1, maxCount);
      }
      if (ch.startCount > maxCount) ch.startCount = maxCount;
    }
  }

  // Instruction ↔ numeric field consistency
  const wordNum = (text: string, n: number): boolean =>
    new RegExp(`\\b${n}\\b`).test(text);

  for (const ch of data.challenges as Array<{ type: string; startCount?: number; targetCount: number; instruction: string }>) {
    if (ch.type === 'subtract' && ch.startCount != null) {
      const removeCount = ch.startCount - ch.targetCount;
      if (!wordNum(ch.instruction, ch.startCount) || !wordNum(ch.instruction, removeCount)) {
        ch.instruction = `The frame starts with ${ch.startCount} counters. Take away ${removeCount}. How many are left?`;
      }
    } else if (ch.type === 'make_ten') {
      const makeTenTarget = data.mode === 'double' ? 20 : 10;
      if (ch.targetCount < 0 || ch.targetCount >= makeTenTarget) {
        ch.targetCount = Math.max(1, makeTenTarget - 3);
      }
      if (!wordNum(ch.instruction, ch.targetCount)) {
        ch.instruction = `There are ${ch.targetCount} counters on the frame. How many more do you need to make ${makeTenTarget}?`;
      }
    } else if (ch.type === 'build') {
      if (!wordNum(ch.instruction, ch.targetCount)) {
        ch.instruction = `Place ${ch.targetCount} counters on the ten frame!`;
      }
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'build';
    const fallbacks: Record<string, { type: string; instruction: string; targetCount: number; hint: string; narration: string; flashDuration?: number; startCount?: number }> = {
      build: { type: 'build', instruction: 'Put 5 counters on the ten frame!', targetCount: 5, hint: 'Fill up one whole row!', narration: "Let's start by building the number 5 on the ten frame." },
      subitize: { type: 'subitize', instruction: 'How many counters did you see?', targetCount: 4, hint: 'Think about how many fit in one row.', narration: "Watch carefully — how many counters flash on the frame?", flashDuration: 1500 },
      make_ten: { type: 'make_ten', instruction: 'There are 6 counters. How many more to make 10?', targetCount: 6, hint: 'Count the empty spaces!', narration: "Some counters are already here. How many more do we need?" },
      add: { type: 'add', instruction: 'Show 3 + 4 on the frame!', targetCount: 7, hint: 'Place 3, then add 4 more.', narration: "Let's add these numbers using the ten frame." },
      subtract: { type: 'subtract', instruction: 'The frame starts with 8 counters. Take away 3. How many are left?', targetCount: 5, hint: 'Click counters to remove them!', narration: "Let's practice taking away.", startCount: 8 },
    };
    console.log(`[TenFrame] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...fallbacks[fallbackType] ?? fallbacks.build }];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[TenFrame] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Ensure counter positions is an array
  if (!data.counters) {
    data.counters = { count: 0, color: 'red', positions: [] };
  }
  if (!Array.isArray(data.counters.positions)) {
    data.counters.positions = [];
  }

  // Apply explicit config overrides from manifest
  if (config) {
    if (config.mode !== undefined) data.mode = config.mode;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.counterColor !== undefined) data.counters.color = config.counterColor;
  }

  return data;
};
