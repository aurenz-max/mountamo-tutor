import { Type, Schema } from "@google/genai";
import { PatternBuilderData } from "../../primitives/visual-primitives/math/PatternBuilder";
import { ai } from "../geminiClient";

/**
 * Schema definition for Pattern Builder Data
 *
 * This schema defines the structure for pattern challenges including
 * repeating, growing, and number patterns for K-3 algebraic thinking.
 */
const patternBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the pattern activity (e.g., 'Color Patterns', 'Growing Numbers')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    patternType: {
      type: Type.STRING,
      description: "Pattern type: 'repeating' (AB, AAB, ABC), 'growing' (1,3,5,7), or 'number' (skip counting, function rules)"
    },
    sequence: {
      type: Type.OBJECT,
      properties: {
        given: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Tokens shown to the student (the visible part of the pattern)"
        },
        hidden: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Tokens the student must fill in to extend the pattern"
        },
        core: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "The repeating unit (for repeating patterns) or first few terms (for growing patterns)"
        },
        rule: {
          type: Type.STRING,
          description: "The pattern rule in words (e.g., 'add 3 each time', 'AB repeating'). Null for simple repeating patterns."
        }
      },
      required: ["given", "hidden", "core"]
    },
    tokens: {
      type: Type.OBJECT,
      properties: {
        available: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Tokens the student can choose from. For colors: 'red','blue','green','yellow','purple','orange','pink'. For shapes: 'circle','square','triangle','star','diamond','heart'. For numbers: '1','2','3', etc."
        },
        type: {
          type: Type.STRING,
          description: "Token type: 'colors', 'shapes', 'numbers', 'emoji', or 'mixed'"
        }
      },
      required: ["available", "type"]
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
            description: "Challenge type: 'extend' (continue the pattern), 'identify_core' (find repeating unit), 'create' (build your own), 'translate' (same structure, different tokens), 'find_rule' (describe the rule)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction text, warm and encouraging"
          },
          answer: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Expected answer tokens (for extend/translate) or core tokens (for identify_core)"
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
        required: ["id", "type", "instruction", "answer", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showCore: {
          type: Type.BOOLEAN,
          description: "Whether to highlight the repeating core unit"
        },
        showStepNumbers: {
          type: Type.BOOLEAN,
          description: "Whether to show position numbers (useful for growing patterns)"
        },
        showRule: {
          type: Type.BOOLEAN,
          description: "Whether to reveal the rule after completion"
        },
        audioMode: {
          type: Type.BOOLEAN,
          description: "Whether to play the pattern as sounds"
        }
      },
      required: ["showCore", "showStepNumbers", "showRule", "audioMode"]
    },
    translationTarget: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether a translation challenge is included"
        },
        sourceType: {
          type: Type.STRING,
          description: "Source token type (e.g., 'colors')"
        },
        targetType: {
          type: Type.STRING,
          description: "Target token type (e.g., 'shapes')"
        },
        mapping: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING, description: "Source token (e.g., 'red')" },
              to: { type: Type.STRING, description: "Target token (e.g., 'circle')" }
            },
            required: ["from", "to"]
          },
          description: "Array of source-to-target token mappings (e.g., [{from:'red',to:'circle'},{from:'blue',to:'square'}])"
        }
      },
      required: ["enabled"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K-1' for Kindergarten-Grade 1, '2-3' for Grades 2-3"
    }
  },
  required: ["title", "description", "patternType", "sequence", "tokens", "challenges", "showOptions", "gradeBand"]
};

/**
 * Generate pattern builder data for interactive pattern activities
 *
 * This function creates pattern challenges including:
 * - Extend: Continue a given pattern (AB → AB??)
 * - Identify Core: Find the repeating unit in a long pattern
 * - Create: Build an original pattern
 * - Translate: Convert a pattern to a different representation
 * - Find Rule: Describe the rule of a growing/number pattern
 *
 * Grade-aware content:
 * - K-1: AB, AAB, ABB repeating patterns with colors/shapes. Extend and identify only.
 * - 2-3: ABC, AABB, growing patterns with numbers. Create, translate, find_rule challenges.
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PatternBuilderData with complete configuration
 */
export const generatePatternBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: {
    patternType?: 'repeating' | 'growing' | 'number';
    gradeBand?: 'K-1' | '2-3';
    challengeTypes?: string[];
    tokenType?: string;
  }
): Promise<PatternBuilderData> => {
  const prompt = `
Create an educational pattern building activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Pattern recognition is a foundational algebraic thinking skill
- Students progress from recognizing to extending to creating patterns
- Repeating patterns have a core unit that repeats (e.g., AB, AAB, ABC)
- Growing patterns increase by a rule (e.g., +2, +3, ×2)
- Number patterns connect to skip counting and multiplication

GUIDELINES FOR GRADE LEVELS:
- Kindergarten to Grade 1 (gradeBand "K-1"):
  * Use 2-element repeating patterns: AB, AAB, ABB
  * Token type should be 'colors' or 'shapes' (NOT numbers)
  * Use bright, simple tokens: red, blue, green, yellow, circle, square, triangle, star
  * Challenges: 'extend' and 'identify_core' ONLY
  * Give 6-8 given tokens showing 2-3 full repetitions, 2-4 hidden tokens
  * Simple, warm language: "What comes next?" "Can you find the part that repeats?"
  * showCore: false initially (let them discover it)
  * showStepNumbers: false (not needed for repeating patterns)
  * Do NOT include translate or create or find_rule challenges for K-1

- Grades 2-3 (gradeBand "2-3"):
  * Use ABC, AABB, or growing patterns
  * Can use numbers, mixed tokens, or colors/shapes
  * Growing patterns: sequences like 2, 4, 6, 8 or 1, 4, 7, 10
  * Include 'extend', 'identify_core', 'create', 'translate', or 'find_rule' challenges
  * For growing patterns: give 4-6 given numbers, 2-3 hidden numbers
  * Connect to skip counting and multiplication
  * showStepNumbers: true for growing patterns
  * showRule: true (reveal after completion)
  * Can include translation challenges (color→shape or shape→number)

CHALLENGE TYPES:
- "extend": Student places tokens to continue the pattern. Answer = the hidden tokens.
- "identify_core": Student selects the smallest repeating unit. Answer = the core tokens.
- "create": Student builds their own pattern from available tokens. No specific answer required.
- "translate": Student recreates the pattern with different token types. Answer = translated sequence.
- "find_rule": Student describes the pattern rule in words. Answer = the rule string.

TOKEN TYPES:
- Colors: red, blue, green, yellow, purple, orange, pink
- Shapes: circle, square, triangle, star, diamond, heart
- Numbers: use actual number strings like "1", "2", "3"
- The 'available' array should include all tokens the student needs PLUS 1-2 distractors

${config ? `
CONFIGURATION HINTS:
${config.patternType ? `- Pattern type: ${config.patternType}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challengeTypes ? `- Challenge types to include: ${config.challengeTypes.join(', ')}` : ''}
${config.tokenType ? `- Token type: ${config.tokenType}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Start with extend challenges, then move to identify_core, then create/translate
3. The 'given' sequence must clearly show the pattern (at least 2 full repetitions)
4. The 'hidden' sequence must be the natural continuation
5. The 'core' array must be the minimal repeating unit
6. For growing patterns, include a clear 'rule' string
7. Available tokens must include all tokens used in the pattern
8. Include 1-2 distractor tokens in available (tokens NOT in the pattern)
9. Use warm, encouraging instruction text appropriate for young children
10. Include meaningful hints that guide without giving away the answer
11. Include narration text the AI tutor can use
12. For translate challenges, include a translationTarget with mapping

Return the complete pattern builder configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: patternBuilderSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid pattern builder data returned from Gemini API');
  }

  // Validation: ensure patternType is valid
  const validTypes = ['repeating', 'growing', 'number'];
  if (!validTypes.includes(data.patternType)) {
    data.patternType = 'repeating';
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K-1' && data.gradeBand !== '2-3') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') || gradeLevel.toLowerCase().includes('grade 1') ? 'K-1' : '2-3';
  }

  // K-1 should not have growing or number patterns
  if (data.gradeBand === 'K-1' && data.patternType !== 'repeating') {
    data.patternType = 'repeating';
  }

  // Ensure sequence has required fields
  if (!data.sequence) {
    data.sequence = { given: ['red', 'blue', 'red', 'blue'], hidden: ['red', 'blue'], core: ['red', 'blue'], rule: null };
  }
  if (!Array.isArray(data.sequence.given)) data.sequence.given = ['red', 'blue', 'red', 'blue'];
  if (!Array.isArray(data.sequence.hidden)) data.sequence.hidden = ['red', 'blue'];
  if (!Array.isArray(data.sequence.core)) data.sequence.core = ['red', 'blue'];

  // Ensure tokens has required fields
  if (!data.tokens) {
    data.tokens = { available: ['red', 'blue', 'green'], type: 'colors' };
  }
  if (!Array.isArray(data.tokens.available) || data.tokens.available.length === 0) {
    data.tokens.available = Array.from(new Set([...data.sequence.given, ...data.sequence.hidden]));
  }

  // Ensure challenges have valid types
  const validChallengeTypes = ['extend', 'identify_core', 'create', 'translate', 'find_rule'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'c1',
      type: 'extend',
      instruction: 'What comes next in this pattern?',
      answer: data.sequence.hidden,
      hint: 'Look at the colors. What repeats?',
      narration: "Let's figure out what comes next in this pattern!",
    }];
  }

  // Ensure showOptions
  if (!data.showOptions) {
    data.showOptions = {
      showCore: false,
      showStepNumbers: data.patternType !== 'repeating',
      showRule: data.patternType !== 'repeating',
      audioMode: false,
    };
  }

  // Convert translationTarget.mapping from array format [{from,to}] to Record<string,string>
  if (data.translationTarget?.mapping && Array.isArray(data.translationTarget.mapping)) {
    const mappingObj: Record<string, string> = {};
    for (const entry of data.translationTarget.mapping) {
      if (entry.from && entry.to) {
        mappingObj[entry.from] = entry.to;
      }
    }
    data.translationTarget.mapping = mappingObj;
  }

  // Apply explicit config overrides
  if (config) {
    if (config.patternType !== undefined) data.patternType = config.patternType;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  return data;
};
