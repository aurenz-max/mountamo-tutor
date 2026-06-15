/**
 * Base-Ten Blocks Generator - Dedicated service for place value visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { BaseTenBlocksData, BaseTenBlocksChallenge } from '../../primitives/visual-primitives/math/BaseTenBlocks';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { createNumberPool } from './numberPoolService';

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
  build_number: {
    promptDoc:
      `"build_number": Student builds a given number from scratch using blocks. `
      + `Set targetNumber to the value they must construct. `
      + `Use encouraging language ("Build the number 247 with blocks!"). `
      + `K-1: numbers 1-20, maxPlace 'tens'. Grades 2-3: numbers 1-999, maxPlace 'hundreds'. `
      + `Grades 4-5: numbers up to 9999, maxPlace 'thousands'. Full scaffolding — concrete manipulative.`,
    schemaDescription: "'build_number' (construct number from blocks)",
  },
  read_blocks: {
    promptDoc:
      `"read_blocks": Blocks are pre-placed, student identifies the number they represent. `
      + `Set targetNumber to the correct answer. `
      + `Instruction must be a GENERIC prompt to look at the blocks — for example: `
      + `"Look at the blocks shown above. What number do they represent?" or `
      + `"What number is shown by these blocks?". `
      + `CRITICAL: The instruction must NOT name how many blocks are in each place value. `
      + `Do NOT say "2 hundreds blocks, 4 tens rods, and 5 ones" — that lets the student `
      + `compute the answer (2·100+4·10+5=245) from the text alone without looking at the blocks. `
      + `Do NOT mention specific digit counts ("X hundreds", "Y tens", "Z ones"). `
      + `Do NOT mention block words ("hundreds blocks", "tens rods", "ones units", "flats", "rods", "units"). `
      + `K-1: numbers 1-20. Grades 2-3: numbers 1-999. Vary digit patterns (e.g., 305 has 0 tens).`,
    schemaDescription: "'read_blocks' (identify number from blocks)",
  },
  regroup: {
    promptDoc:
      `"regroup": Student regroups blocks by trading between place values. `
      + `E.g., trade 10 ones for 1 ten, or 10 tens for 1 hundred. `
      + `Set targetNumber to the number being regrouped. `
      + `IMPORTANT: The blocks always START in standard form (e.g., 125 = 1 hundred, 2 tens, 5 ones). `
      + `The instruction tells the student WHICH trade to make: "You have 1 hundred, 2 tens, and 5 ones. Trade 1 ten for 10 ones." `
      + `Do NOT describe non-standard starting arrangements like "23 ones blocks" — the component cannot render those. `
      + `Focus on the trading mechanic. Grades 2-3 primary. Include trades in both directions (up and down).`,
    schemaDescription: "'regroup' (trade between place values)",
  },
  add_with_blocks: {
    promptDoc:
      `"add_with_blocks": Student adds two numbers using blocks, regrouping as needed. `
      + `Set targetNumber to the SUM. Set secondNumber to the second addend. `
      + `Instruction names both addends: "Add 347 + 285 using blocks." `
      + `Do NOT reveal the sum. Grades 2-3: sums up to 999. Grades 4-5: sums up to 9999.`,
    schemaDescription: "'add_with_blocks' (addition with regrouping)",
  },
  subtract_with_blocks: {
    promptDoc:
      `"subtract_with_blocks": Student subtracts using blocks, borrowing as needed. `
      + `Set targetNumber to the DIFFERENCE. Set secondNumber to the subtrahend. `
      + `Instruction names the minuend and subtrahend: "Subtract 285 from 632 using blocks." `
      + `Do NOT reveal the difference. Grades 2-3: numbers up to 999. Grades 4-5: up to 9999.`,
    schemaDescription: "'subtract_with_blocks' (subtraction with borrowing)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tiers (config.difficulty → scaffolding level)
// ---------------------------------------------------------------------------
// Second axis of the two-field contract: targetEvalMode = WHICH skill,
// difficulty = HOW MUCH on-screen support within it. NEVER changes the numbers.
// BaseTenBlocks has no showOptions — its scaffolds are hardcoded renders, so the
// levers are new per-challenge component fields (showColumnCounts, showBlocksTotal):
//   - showColumnCounts: the digit readout above each place column (perception aid)
//   - showBlocksTotal:  the live "Blocks Total" panel (self-check aid)
// read_blocks keeps BOTH off at every tier (BT-2: showing them leaks the answer).

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  showColumnCounts: boolean; // per-column digit readout
  showBlocksTotal: boolean;  // running "Blocks Total" self-check panel
  promptLines: string[];
}

/**
 * Map (challenge type, tier) → on-screen scaffolds. Scaffolding-only: the target
 * numbers never change, only how much the workspace helps the student self-check.
 * easy = workspace reads + verifies for them; hard = they place blocks and verify
 * mentally before typing the answer.
 */
function resolveSupportStructure(type: string, tier: SupportTier): SupportScaffold {
  const numbersNeverChange =
    'This tier changes only on-screen SUPPORT, never the numbers — the target stays exactly as generated.';

  // read_blocks: counts + total are contractually hidden (they leak the answer).
  // The tier cannot turn them on; it only sets the tutor/instruction tone.
  if (type === 'read_blocks') {
    return {
      showColumnCounts: false,
      showBlocksTotal: false,
      promptLines: [
        numbersNeverChange,
        'read_blocks always hides the column counts and total — keep the instruction a generic "what number do these blocks show?" prompt so the student reads the blocks unaided.',
      ],
    };
  }

  switch (tier) {
    case 'easy':
      return {
        showColumnCounts: true,
        showBlocksTotal: true,
        promptLines: [
          numbersNeverChange,
          'EASY support: the per-column digit counts and the running Blocks Total are both shown — the student can read each place and self-check their total. Keep the hint concrete and step-by-step (name the place values).',
        ],
      };
    case 'medium':
      return {
        showColumnCounts: false,
        showBlocksTotal: true,
        promptLines: [
          numbersNeverChange,
          'MEDIUM support: per-column digit counts are hidden (the student counts each place themselves) but the running Blocks Total stays on for self-checking. Hint should nudge, not narrate every step.',
        ],
      };
    case 'hard':
      return {
        showColumnCounts: false,
        showBlocksTotal: false,
        promptLines: [
          numbersNeverChange,
          'HARD support: both the per-column counts AND the running Blocks Total are hidden — the student places blocks and verifies the total mentally before answering. Keep the hint a minimal conceptual nudge that does not reveal the total.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["build_number", "read_blocks", "regroup", "add_with_blocks", "subtract_with_blocks"],
      description: "The type of challenge"
    },
    instruction: {
      type: Type.STRING,
      description: "Clear instruction telling the student what to do"
    },
    targetNumber: {
      type: Type.NUMBER,
      description: "The target number the student should build or identify"
    },
    secondNumber: {
      type: Type.NUMBER,
      description: "Second number for operations (add/subtract challenges). Optional.",
      nullable: true
    },
    hint: {
      type: Type.STRING,
      description: "A helpful hint shown after multiple failed attempts"
    }
  },
  required: ["type", "instruction", "targetNumber", "hint"]
};

const baseTenBlocksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the base-ten blocks visualization"
    },
    description: {
      type: Type.STRING,
      description: "Brief explanation of what the blocks demonstrate"
    },
    numberValue: {
      type: Type.NUMBER,
      description: "The primary number to represent using base-ten blocks"
    },
    interactionMode: {
      type: Type.STRING,
      enum: ["build", "decompose", "regroup", "operate"],
      description: "How the student interacts with the blocks. 'build' = construct a number, 'decompose' = break apart, 'regroup' = trade between places, 'operate' = add/subtract"
    },
    decimalMode: {
      type: Type.BOOLEAN,
      description: "Whether to include decimal places (tenths, hundredths). Default: false"
    },
    maxPlace: {
      type: Type.STRING,
      enum: ["ones", "tens", "hundreds", "thousands"],
      description: "The highest place value column to show. Default: 'hundreds'"
    },
    supplyTray: {
      type: Type.BOOLEAN,
      description: "Whether to show add/remove buttons for blocks. Default: true"
    },
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "Array of sequential challenges for the student to complete"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-1", "2-3", "4-5"],
      description: "Target grade band for difficulty calibration"
    }
  },
  required: ["title", "description", "numberValue", "challenges", "gradeBand", "interactionMode"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate Base-Ten Blocks content
 *
 * Creates a base-ten blocks visualization for elementary math education,
 * helping students understand place value (ones, tens, hundreds, thousands).
 * Supports multiple interaction modes: build, decompose, regroup, operate.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Base-ten blocks data with number value and challenges
 */
export const generateBaseTenBlocks = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /** Structured number range from the manifest — controls grade-appropriate values. */
    numberRange?: { min: number; max: number };
    difficulty?: string;
  }
): Promise<BaseTenBlocksData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'base-ten-blocks',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseTenBlocksSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseTenBlocksSchema;

  // ── Resolve within-mode support tier (the STUDENT's tier — drives application) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is ONLY for the prompt tone (operate mode = 2 types → no single mode to describe).
  const pinnedType = evalConstraint && evalConstraint.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0]
    : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Build number pool (Gemini structured output is near-deterministic — we own the randomness) ──
  const pool = createNumberPool(config?.numberRange, { minNonZeroDigits: 2 });
  console.log(`[BaseTenBlocks] pool:`, pool?.numbers ?? 'none', `difficulty:`, config?.difficulty ?? 'none');

  const rangeSection = pool?.toPromptSection({
    extraInstructions: '- Use the FIRST number as the primary numberValue for the activity.\n- Pick from the remaining numbers for individual challenge targetNumbers.',
  }) ?? '';

  const prompt = `You are generating a Base-Ten Blocks visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate base-ten blocks content that helps students understand place value (ones, tens, hundreds, thousands).

${challengeTypeSection}
${tierSection}
${rangeSection}

${!evalConstraint && !pool ? `
GRADE BAND GUIDELINES (use when no explicit range is provided):

K-1 (Kindergarten-Grade 1):
- Numbers 1-20 only
- maxPlace: 'tens'
- interactionMode: 'build' (build numbers from blocks)
- decimalMode: false
- Simple challenges: build_number, read_blocks
- 4-6 challenges

2-3 (Grades 2-3):
- Numbers 1-999
- maxPlace: 'hundreds'
- interactionMode: 'build' or 'regroup'
- decimalMode: false
- Challenges: build_number, read_blocks, regroup, add_with_blocks
- 4-6 challenges

4-5 (Grades 4-5):
- Numbers up to 9999, may include decimals
- maxPlace: 'thousands'
- interactionMode: 'operate' or 'decompose'
- decimalMode: true if topic involves decimals
- Challenges: all types including add_with_blocks, subtract_with_blocks
- 4-6 challenges
` : ''}
${!evalConstraint && pool ? `
INFER GRADE BAND FROM RANGE:
- Range max <= 20: gradeBand 'K-1', maxPlace 'tens', interactionMode 'build', 4-6 challenges
- Range max <= 999: gradeBand '2-3', maxPlace 'hundreds', interactionMode 'build' or 'regroup', 4-6 challenges
- Range max >= 1000: gradeBand '4-5', maxPlace 'thousands', interactionMode 'operate' or 'decompose', 4-6 challenges
` : ''}

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain the place value concept being practiced
3. Choose a numberValue appropriate for the grade level and topic
4. Set interactionMode based on the learning objective
5. Include 4-6 challenges that progress in difficulty
6. Each challenge must have a clear instruction, targetNumber, and helpful hint
7. For operation challenges, include secondNumber
8. Set gradeBand based on the target audience
9. Set maxPlace and decimalMode appropriately for the grade band

Return the complete base-ten blocks data structure.`;

  logEvalModeResolution('BaseTenBlocks', config?.targetEvalMode, evalConstraint);

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  // Apply defaults for optional fields
  data.interactionMode = data.interactionMode || 'build';
  data.decimalMode = data.decimalMode ?? false;
  data.maxPlace = data.maxPlace || 'hundreds';
  data.supplyTray = data.supplyTray ?? true;
  data.challenges = data.challenges || [];
  data.gradeBand = data.gradeBand || '2-3';

  // Validate numberValue is reasonable
  if (data.numberValue < 0) data.numberValue = Math.abs(data.numberValue);
  if (data.gradeBand === 'K-1' && data.numberValue > 20) data.numberValue = Math.min(data.numberValue, 20);
  if (data.gradeBand === '2-3' && data.numberValue > 999) data.numberValue = Math.min(data.numberValue, 999);
  if (data.gradeBand === '4-5' && data.numberValue > 9999) data.numberValue = Math.min(data.numberValue, 9999);

  // ── Fix interactionMode based on actual challenge types (BT-1/BT-3) ──
  // When all challenges are read_blocks or regroup, the top-level interactionMode
  // must match so the component initializes blocks correctly for the first challenge.
  if (data.challenges.length > 0) {
    const typeList = (data.challenges as BaseTenBlocksChallenge[]).map(c => c.type);
    const types = new Set(typeList);
    if (types.size === 1) {
      const onlyType = typeList[0];
      if (onlyType === 'read_blocks') data.interactionMode = 'decompose';
      else if (onlyType === 'regroup') data.interactionMode = 'regroup';
      else if (onlyType === 'add_with_blocks' || onlyType === 'subtract_with_blocks') data.interactionMode = 'operate';
      else if (onlyType === 'build_number') data.interactionMode = 'build';
    }
  }

  // Validate challenges
  data.challenges = data.challenges.map((c: BaseTenBlocksChallenge) => ({
    type: c.type || 'build_number',
    instruction: c.instruction || 'Build this number with blocks',
    targetNumber: c.targetNumber ?? data.numberValue,
    secondNumber: c.secondNumber,
    hint: c.hint || 'Think about the place values',
  }));

  // ── BT-3: Strip block-count leaks from read_blocks instructions ──
  // Gemini often names the decomposition ("2 hundreds, 4 tens, 5 ones") in the
  // instruction text, letting the student compute the answer without looking at
  // the blocks. Replace any leaky instruction with a generic prompt.
  const READ_BLOCKS_LEAK_PATTERNS = [
    /\d+\s+(hundreds?|tens?|ones?|thousands?)\b/i,           // "2 hundreds", "4 tens", "5 ones"
    /\b(hundreds?\s+blocks?|tens?\s+rods?|ones?\s+units?|unit\s+cubes?|flats?|rods?)\b/i,
  ];
  const GENERIC_READ_BLOCKS_INSTRUCTIONS = [
    'Look at the blocks shown above. What number do they represent?',
    'What number is shown by these blocks?',
    'Count the blocks above. What number do they make?',
  ];
  let readBlocksRewriteCount = 0;
  data.challenges = (data.challenges as BaseTenBlocksChallenge[]).map((c, idx) => {
    if (c.type !== 'read_blocks') return c;
    const instr = c.instruction ?? '';
    const leaks = READ_BLOCKS_LEAK_PATTERNS.some(re => re.test(instr));
    if (!leaks) return c;
    readBlocksRewriteCount++;
    return {
      ...c,
      instruction: GENERIC_READ_BLOCKS_INSTRUCTIONS[idx % GENERIC_READ_BLOCKS_INSTRUCTIONS.length],
    };
  });
  if (readBlocksRewriteCount > 0) {
    console.warn(`[BaseTenBlocks] BT-3 safety net: rewrote ${readBlocksRewriteCount} read_blocks instruction(s) that leaked block counts`);
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'build_number';
    const fallbacks: Record<string, BaseTenBlocksChallenge> = {
      build_number: { type: 'build_number', instruction: 'Build the number 45 with blocks!', targetNumber: 45, hint: '45 has 4 tens and 5 ones.' },
      read_blocks: { type: 'read_blocks', instruction: 'What number do these blocks show?', targetNumber: 123, hint: 'Count each column: hundreds, tens, ones.' },
      regroup: { type: 'regroup', instruction: 'Regroup 15 ones into tens and ones.', targetNumber: 15, hint: '10 ones = 1 ten. How many are left over?' },
      add_with_blocks: { type: 'add_with_blocks', instruction: 'Add 234 + 158 using blocks.', targetNumber: 392, secondNumber: 158, hint: 'Start with the ones column. Do you need to regroup?' },
      subtract_with_blocks: { type: 'subtract_with_blocks', instruction: 'Subtract 127 from 350 using blocks.', targetNumber: 223, secondNumber: 127, hint: 'Start with the ones. Can you borrow from the tens?' },
    };
    console.log(`[BaseTenBlocks] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks.build_number];
  }

  // ── Apply within-mode support tier per challenge (mode-correct, blends included) ──
  // Difficulty is a STUDENT property, so every challenge gets it — single-mode just
  // happens to give them all the same scaffold. Resolve from each challenge's OWN type
  // so a blended/operate session withdraws the right aids. read_blocks self-guards (both off).
  if (supportTier) {
    data.challenges = (data.challenges as BaseTenBlocksChallenge[]).map((c) => {
      const sc = resolveSupportStructure(c.type, supportTier);
      return { ...c, showColumnCounts: sc.showColumnCounts, showBlocksTotal: sc.showBlocksTotal };
    });
    data.supportTier = supportTier; // mirror onto data so the tutor matches the screen
    console.log(`[BaseTenBlocks] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended/operate'})`);
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[BaseTenBlocks] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  console.log('🧱 Base-Ten Blocks Generated from dedicated service:', {
    topic,
    numberValue: data.numberValue,
    gradeBand: data.gradeBand,
    interactionMode: data.interactionMode,
    challengeCount: data.challenges.length,
  });

  return data as BaseTenBlocksData;
};
