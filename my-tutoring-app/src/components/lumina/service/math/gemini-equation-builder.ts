import { Type, Schema } from "@google/genai";
import { EquationBuilderData } from "../../primitives/visual-primitives/math/EquationBuilder";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build: {
    promptDoc:
      `"build": Student drags number and operator tiles to construct a target equation. `
      + `targetEquation is the goal (e.g., "3 + 2 = 5"). `
      + `availableTiles MUST include all tokens from targetEquation PLUS 2-3 distractor tiles `
      + `(extra numbers or operators that do NOT belong). `
      + `Example: target "3 + 2 = 5" → tiles ["3", "+", "2", "=", "5", "4", "-"]. `
      + `Use spaces in targetEquation between every token: "3 + 2 = 5" not "3+2=5". `
      + `CRITICAL: The instruction MUST NOT reveal the target equation. `
      + `Describe the goal conceptually: "Build an addition equation that equals 5", `
      + `"Use the tiles to make a true equation", "Can you find the right equation?". `
      + `NEVER write the answer in the instruction text.`,
    schemaDescription: "'build' (construct equation from tiles)",
  },
  'missing-value': {
    promptDoc:
      `"missing-value": Given an equation with one ? placeholder, student picks the correct value. `
      + `equation has a ? at one position (e.g., "3 + ? = 5" or "? + 2 = 5" or "3 + 2 = ?"). `
      + `missingPosition is the 0-based token index of the ? in the space-separated equation. `
      + `correctValue is the number that replaces ?. `
      + `options is 4 multiple-choice numbers including correctValue and 3 distractors. `
      + `IMPORTANT: For missing-result mode, ? must be AFTER the = sign. For missing-operand mode, ? must be BEFORE the = sign.`,
    schemaDescription: "'missing-value' (find unknown number)",
  },
  'true-false': {
    promptDoc:
      `"true-false": Student decides if a displayed equation is true or false. `
      + `displayEquation is a complete equation like "3 + 2 = 6" or "4 + 1 = 5". `
      + `isTrue is whether the equation is mathematically correct. `
      + `Mix true and false equations — do NOT make all true or all false. `
      + `Use spaces between every token: "3 + 2 = 6" not "3+2=6".`,
    schemaDescription: "'true-false' (evaluate equation truth)",
  },
  balance: {
    promptDoc:
      `"balance": Student finds a missing number to make both sides equal. `
      + `leftSide is an expression like "3 + 4" (always fully known). `
      + `rightSide has a ? placeholder like "? + 2" or "5 + ?". `
      + `correctAnswer is the number replacing ?. Both sides must evaluate to the same value. `
      + `This teaches that = means "same amount on both sides." `
      + `Use spaces between tokens: "3 + 4" not "3+4".`,
    schemaDescription: "'balance' (make both sides equal)",
  },
  rewrite: {
    promptDoc:
      `"rewrite": Student rewrites an equation in a different form using tiles. `
      + `originalEquation is shown (e.g., "3 + 2 = 5"). `
      + `acceptedForms lists all valid rewrites (e.g., ["2 + 3 = 5", "5 = 3 + 2", "5 = 2 + 3", "5 - 3 = 2", "5 - 2 = 3"]). `
      + `availableTiles MUST include all tokens needed for any accepted form PLUS 2-3 distractors. `
      + `This teaches relational understanding of the equal sign.`,
    schemaDescription: "'rewrite' (rewrite equation in another form)",
  },
};

// ---------------------------------------------------------------------------
// Per-type field relevance — controls which fields appear in the schema
// ---------------------------------------------------------------------------

/** Fields relevant to each challenge type (beyond the always-required id/type/instruction) */
const CHALLENGE_TYPE_FIELDS: Record<string, string[]> = {
  build: ['targetEquation', 'tile0', 'tile1', 'tile2', 'tile3', 'tile4', 'tile5', 'tile6'],
  'missing-value': ['equation', 'missingPosition', 'correctValue', 'option0', 'option1', 'option2', 'option3'],
  'true-false': ['displayEquation', 'isTrue'],
  balance: ['leftSide', 'rightSide', 'correctAnswer'],
  rewrite: ['originalEquation', 'tile0', 'tile1', 'tile2', 'tile3', 'tile4', 'tile5', 'tile6'],
};

/** All optional challenge-level field definitions (reusable across schema builds) */
const OPTIONAL_FIELD_SCHEMAS: Record<string, Schema> = {
  targetEquation: {
    type: Type.STRING,
    description: "Target equation for build type. Space-separated tokens: '3 + 2 = 5'.",
  },
  tile0: { type: Type.STRING, description: "Available tile 0 (number, operator, or =). MUST include all equation tokens + distractors.", nullable: true },
  tile1: { type: Type.STRING, description: "Available tile 1.", nullable: true },
  tile2: { type: Type.STRING, description: "Available tile 2.", nullable: true },
  tile3: { type: Type.STRING, description: "Available tile 3.", nullable: true },
  tile4: { type: Type.STRING, description: "Available tile 4.", nullable: true },
  tile5: { type: Type.STRING, description: "Available tile 5 (distractor).", nullable: true },
  tile6: { type: Type.STRING, description: "Available tile 6 (distractor).", nullable: true },
  equation: {
    type: Type.STRING,
    description: "Equation with ? placeholder for missing-value type. Space-separated: '3 + ? = 5'.",
  },
  missingPosition: {
    type: Type.NUMBER,
    description: "0-based token index of the ? in the space-separated equation string.",
  },
  correctValue: {
    type: Type.NUMBER,
    description: "The correct number that replaces ?.",
  },
  option0: { type: Type.NUMBER, description: "Multiple choice option 0 (one must be correctValue)." },
  option1: { type: Type.NUMBER, description: "Multiple choice option 1." },
  option2: { type: Type.NUMBER, description: "Multiple choice option 2." },
  option3: { type: Type.NUMBER, description: "Multiple choice option 3." },
  displayEquation: {
    type: Type.STRING,
    description: "Complete equation for true-false type. Space-separated: '3 + 2 = 6'.",
  },
  isTrue: {
    type: Type.BOOLEAN,
    description: "Whether displayEquation is mathematically correct.",
  },
  leftSide: {
    type: Type.STRING,
    description: "Left side expression for balance type. Space-separated: '3 + 4'.",
  },
  rightSide: {
    type: Type.STRING,
    description: "Right side expression with ? for balance type. Space-separated: '? + 2'.",
  },
  correctAnswer: {
    type: Type.NUMBER,
    description: "The number replacing ? in rightSide so both sides are equal.",
  },
  originalEquation: {
    type: Type.STRING,
    description: "The equation to rewrite for rewrite type. Space-separated: '3 + 2 = 5'.",
  },
};

// ---------------------------------------------------------------------------
// Schema builder
// ---------------------------------------------------------------------------

/**
 * Build a Gemini schema tailored to the allowed challenge types.
 * When constrained to a single type, irrelevant fields are omitted
 * so the LLM focuses on the fields that matter.
 */
function buildEquationBuilderSchema(allowedTypes?: string[]): Schema {
  const types = allowedTypes ?? Object.keys(CHALLENGE_TYPE_FIELDS);
  const fieldSet: Record<string, boolean> = {};
  for (let ti = 0; ti < types.length; ti++) {
    const fields = CHALLENGE_TYPE_FIELDS[types[ti]] ?? [];
    for (let fi = 0; fi < fields.length; fi++) {
      fieldSet[fields[fi]] = true;
    }
  }

  // Build challenge item properties — always include core fields
  const challengeProps: Record<string, Schema> = {
    id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'c1', 'c2')" },
    type: {
      type: Type.STRING,
      description: types.length === 1
        ? `Challenge type: always '${types[0]}'`
        : `Challenge type: ${types.map(t => CHALLENGE_TYPE_DOCS[t]?.schemaDescription ?? t).join(', ')}`,
      ...(allowedTypes ? { enum: allowedTypes } : {}),
    },
    instruction: {
      type: Type.STRING,
      description: "Student-facing instruction, warm and encouraging. Describe the concept WITHOUT revealing the answer. For build/rewrite: NEVER include the target equation in the instruction.",
    },
  };

  // Add only the relevant optional fields
  const activeFields = Object.keys(fieldSet);
  for (let i = 0; i < activeFields.length; i++) {
    const field = activeFields[i];
    if (OPTIONAL_FIELD_SCHEMAS[field]) {
      challengeProps[field] = OPTIONAL_FIELD_SCHEMAS[field];
    }
  }

  return {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Title for the equation-building activity (e.g., 'Equation Workshop!', 'Balance It!')",
      },
      description: {
        type: Type.STRING,
        description: "Brief educational description of what students will learn about equations",
      },
      maxNumber: {
        type: Type.NUMBER,
        description: "Maximum number used in equations. K: 5, Grade 1: 10, Grade 2: 20.",
      },
      gradeBand: {
        type: Type.STRING,
        description: "Grade band: 'K' for Kindergarten, '1' for Grade 1, '2' for Grade 2",
      },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: challengeProps,
          required: ["id", "type", "instruction"],
        },
        description: `Array of 3-6 progressive challenges${types.length === 1 ? ` (all type '${types[0]}')` : ''}`,
      },
    },
    required: ["title", "description", "maxNumber", "gradeBand", "challenges"],
  };
}

// ---------------------------------------------------------------------------
// Equation evaluation helpers
// ---------------------------------------------------------------------------

/** Evaluate a simple expression like "3 + 4" or "7" to a number */
function evalSide(side: string): number | null {
  const s = side.replace(/\s+/g, '');
  const num = parseInt(s, 10);
  if (!isNaN(num) && String(num) === s) return num;

  const addMatch = s.match(/^(\d+)\+(\d+)$/);
  if (addMatch) return parseInt(addMatch[1], 10) + parseInt(addMatch[2], 10);

  const subMatch = s.match(/^(\d+)-(\d+)$/);
  if (subMatch) return parseInt(subMatch[1], 10) - parseInt(subMatch[2], 10);

  return null;
}

/** Evaluate whether a full equation string is true (e.g., "3 + 2 = 5") */
function evaluateEquation(eq: string): boolean {
  const normalized = eq.replace(/\s+/g, '');
  const parts = normalized.split('=');
  if (parts.length !== 2) return false;
  const left = evalSide(parts[0]);
  const right = evalSide(parts[1]);
  if (left === null || right === null) return false;
  return left === right;
}

/** Tokenize a space-separated equation string */
function tokenize(eq: string): string[] {
  return eq.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

/** Generate distractor numbers near a target, within [0, max] */
function generateDistractors(correct: number, count: number, max: number): number[] {
  const distractors = new Set<number>();
  // Try nearby values first
  const candidates = [correct + 1, correct - 1, correct + 2, correct - 2, correct + 3];
  for (const c of candidates) {
    if (c !== correct && c >= 0 && c <= max && distractors.size < count) {
      distractors.add(c);
    }
  }
  // Fill remaining with random values
  let attempts = 0;
  while (distractors.size < count && attempts < 20) {
    const r = Math.floor(Math.random() * (max + 1));
    if (r !== correct) distractors.add(r);
    attempts++;
  }
  return Array.from(distractors).slice(0, count);
}

/** Shuffle an array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Post-validation: reconstruct arrays + verify mathematical correctness
// ---------------------------------------------------------------------------

interface RawChallenge {
  id?: string;
  type?: string;
  instruction?: string;
  targetEquation?: string;
  tile0?: string; tile1?: string; tile2?: string; tile3?: string;
  tile4?: string; tile5?: string; tile6?: string;
  equation?: string;
  missingPosition?: number;
  correctValue?: number;
  option0?: number; option1?: number; option2?: number; option3?: number;
  displayEquation?: string;
  isTrue?: boolean;
  leftSide?: string;
  rightSide?: string;
  correctAnswer?: number;
  originalEquation?: string;
  [key: string]: unknown;
}

/**
 * Validate and reconstruct a single challenge.
 * Returns null if the challenge is fatally broken (missing required fields).
 */
function validateChallenge(
  raw: RawChallenge,
  maxNumber: number,
  evalMode?: string,
): import("../../primitives/visual-primitives/math/EquationBuilder").EquationBuilderChallenge | null {
  if (!raw.id || !raw.type || !raw.instruction) {
    console.log(`[EquationBuilder] REJECT challenge — missing id/type/instruction:`, JSON.stringify(raw));
    return null;
  }

  switch (raw.type) {
    case 'build': return validateBuild(raw, maxNumber);
    case 'missing-value': return validateMissingValue(raw, maxNumber, evalMode);
    case 'true-false': return validateTrueFalse(raw);
    case 'balance': return validateBalance(raw, maxNumber);
    case 'rewrite': return validateRewrite(raw, maxNumber);
    default:
      console.log(`[EquationBuilder] REJECT challenge — unknown type: "${raw.type}"`);
      return null;
  }
}

function buildValidChallenge(fields: Record<string, unknown>) {
  return fields as unknown as import("../../primitives/visual-primitives/math/EquationBuilder").EquationBuilderChallenge;
}

function validateBuild(raw: RawChallenge, maxNumber: number) {
  if (!raw.targetEquation) {
    console.log(`[EquationBuilder] REJECT build — missing targetEquation`);
    return null;
  }

  // Ensure spaces in target equation
  let target = raw.targetEquation;
  if (!target.includes(' ')) {
    // Insert spaces around operators and =
    target = target.replace(/([+\-=])/g, ' $1 ').replace(/\s+/g, ' ').trim();
  }

  // Verify equation is mathematically true
  if (!evaluateEquation(target)) {
    console.log(`[EquationBuilder] REJECT build — targetEquation "${target}" is not mathematically true`);
    return null;
  }

  // EB-2: Derive availableTiles deterministically — start from target tokens,
  // then add unique distractors. Never trust Gemini's flat tile fields for dedup.
  const targetTokens = tokenize(target);

  // Start with exactly the tokens needed for the target equation
  const tiles: string[] = [...targetTokens];
  const tileSet = new Set(tiles);

  // Collect Gemini's extra tiles as candidate distractors (deduplicated)
  for (let i = 0; i <= 6; i++) {
    const val = raw[`tile${i}`] as string | undefined;
    if (val != null && val !== '' && !tileSet.has(val)) {
      tiles.push(val);
      tileSet.add(val);
    }
  }

  // Ensure at least 2 distractors
  const distractorCount = tiles.length - targetTokens.length;
  if (distractorCount < 2) {
    const existingNumbers = new Set(tiles.filter(t => /^\d+$/.test(t)).map(Number));
    const distractorsNeeded = 2 - distractorCount;
    let added = 0;
    for (let n = 0; n <= maxNumber && added < distractorsNeeded; n++) {
      if (!existingNumbers.has(n)) {
        tiles.push(String(n));
        tileSet.add(String(n));
        added++;
      }
    }
    // Add a distractor operator if only numbers were added
    if (!tileSet.has('-') && targetTokens.includes('+')) {
      tiles.push('-');
    } else if (!tileSet.has('+') && targetTokens.includes('-')) {
      tiles.push('+');
    }
  }

  // EB-1: Strip answer leak — if instruction contains the target equation, replace it
  let instruction = raw.instruction!;
  const targetNormalized = target.replace(/\s+/g, '');
  const instructionNormalized = instruction.replace(/\s+/g, '');
  if (instructionNormalized.includes(targetNormalized)) {
    // Extract just the result to give a hint without revealing the full equation
    const eqParts = target.split('=').map(s => s.trim());
    const result = eqParts[eqParts.length - 1];
    instruction = `Can you build an equation that equals ${result}?`;
    console.log(`[EquationBuilder] EB-1: Stripped leaked equation from build instruction`);
  }

  return buildValidChallenge({
    id: raw.id,
    type: 'build',
    instruction,
    targetEquation: target,
    availableTiles: shuffle([...tiles]),
  });
}

function validateMissingValue(raw: RawChallenge, maxNumber: number, evalMode?: string) {
  if (!raw.equation) {
    console.log(`[EquationBuilder] REJECT missing-value — missing equation`);
    return null;
  }

  let equation = raw.equation;
  if (!equation.includes(' ')) {
    equation = equation.replace(/([+\-=?])/g, ' $1 ').replace(/\s+/g, ' ').trim();
  }

  const tokens = tokenize(equation);
  const qIndex = tokens.indexOf('?');
  if (qIndex < 0) {
    console.log(`[EquationBuilder] REJECT missing-value — no ? in equation "${equation}"`);
    return null;
  }

  // Post-filter: enforce missing-result vs missing-operand based on eval mode
  const eqIndex = tokens.indexOf('=');
  if (eqIndex < 0) {
    console.log(`[EquationBuilder] REJECT missing-value — no = in equation "${equation}"`);
    return null;
  }

  if (evalMode === 'missing-result' && qIndex < eqIndex) {
    // missing-result requires ? AFTER =, but this has ? before =
    console.log(`[EquationBuilder] REJECT missing-value — eval mode "missing-result" but ? is before = in "${equation}"`);
    return null;
  }
  if (evalMode === 'missing-operand' && qIndex > eqIndex) {
    // missing-operand requires ? BEFORE =, but this has ? after =
    console.log(`[EquationBuilder] REJECT missing-value — eval mode "missing-operand" but ? is after = in "${equation}"`);
    return null;
  }

  // Compute correctValue by solving the equation
  const solveTokens = [...tokens];
  // Replace ? with a placeholder to solve
  // Parse the equation: A op B = C (or C = A op B)
  const eqParts = equation.split('=').map(s => s.trim());
  if (eqParts.length !== 2) {
    console.log(`[EquationBuilder] REJECT missing-value — bad equation format "${equation}"`);
    return null;
  }

  let correctValue: number | null = null;

  // Determine which side has the ? and solve
  const leftHasQ = eqParts[0].includes('?');
  const rightHasQ = eqParts[1].includes('?');

  if (leftHasQ && rightHasQ) {
    console.log(`[EquationBuilder] REJECT missing-value — both sides have ? in "${equation}"`);
    return null;
  }

  if (rightHasQ) {
    // Left side is fully known, right side has ?
    const leftVal = evalSide(eqParts[0]);
    if (leftVal === null) {
      console.log(`[EquationBuilder] REJECT missing-value — cannot evaluate left side "${eqParts[0]}"`);
      return null;
    }

    const rightStr = eqParts[1].replace(/\s+/g, '');
    if (rightStr === '?') {
      // Simple: A + B = ?
      correctValue = leftVal;
    } else {
      // e.g., "? + 2" or "2 + ?"
      const addMatch = rightStr.match(/^\??\+(\d+)$/) || rightStr.match(/^(\d+)\+\??$/);
      const subMatch = rightStr.match(/^\?-(\d+)$/) || rightStr.match(/^(\d+)-\?$/);
      if (rightStr.startsWith('?+') || rightStr.startsWith('? +')) {
        const other = parseInt(rightStr.replace(/\?\s*\+\s*/, ''), 10);
        correctValue = leftVal - other;
      } else if (rightStr.endsWith('+?') || rightStr.endsWith('+ ?')) {
        const other = parseInt(rightStr.replace(/\s*\+\s*\?/, ''), 10);
        correctValue = leftVal - other;
      } else if (rightStr.startsWith('?-') || rightStr.startsWith('? -')) {
        const other = parseInt(rightStr.replace(/\?\s*-\s*/, ''), 10);
        correctValue = leftVal + other;
      } else if (rightStr.endsWith('-?') || rightStr.endsWith('- ?')) {
        const other = parseInt(rightStr.replace(/\s*-\s*\?/, ''), 10);
        correctValue = other - leftVal;
      } else {
        correctValue = leftVal; // fallback: ? alone on right
      }
    }
  } else if (leftHasQ) {
    // Right side is fully known, left side has ?
    const rightVal = evalSide(eqParts[1]);
    if (rightVal === null) {
      console.log(`[EquationBuilder] REJECT missing-value — cannot evaluate right side "${eqParts[1]}"`);
      return null;
    }

    const leftStr = eqParts[0].replace(/\s+/g, '');
    if (leftStr === '?') {
      correctValue = rightVal;
    } else if (leftStr.startsWith('?+') || leftStr.startsWith('?+')) {
      const other = parseInt(leftStr.replace(/\?\+/, ''), 10);
      correctValue = rightVal - other;
    } else if (leftStr.endsWith('+?')) {
      const other = parseInt(leftStr.replace(/\+\?/, ''), 10);
      correctValue = rightVal - other;
    } else if (leftStr.startsWith('?-')) {
      const other = parseInt(leftStr.replace(/\?-/, ''), 10);
      correctValue = rightVal + other;
    } else if (leftStr.endsWith('-?')) {
      const other = parseInt(leftStr.replace(/-\?/, ''), 10);
      correctValue = other - rightVal;
    } else {
      correctValue = rightVal;
    }
  }

  if (correctValue === null || isNaN(correctValue)) {
    // Fallback: trust Gemini's correctValue if we can't solve
    if (raw.correctValue != null && !isNaN(raw.correctValue)) {
      correctValue = raw.correctValue;
    } else {
      console.log(`[EquationBuilder] REJECT missing-value — cannot compute correctValue for "${equation}"`);
      return null;
    }
  }

  // Use computed missingPosition (0-based token index of ?)
  const missingPosition = qIndex;

  // Reconstruct options from flat fields
  const optionsSet = new Set<number>();
  for (let i = 0; i <= 3; i++) {
    const val = raw[`option${i}`] as number | undefined;
    if (val != null && !isNaN(val)) optionsSet.add(val);
  }
  // Ensure correctValue is in options
  optionsSet.add(correctValue);
  // Fill to 4 options with distractors
  if (optionsSet.size < 4) {
    const distractors = generateDistractors(correctValue, 4 - optionsSet.size, maxNumber);
    for (const d of distractors) optionsSet.add(d);
  }
  const options = shuffle(Array.from(optionsSet).slice(0, 4));

  return buildValidChallenge({
    id: raw.id,
    type: 'missing-value',
    instruction: raw.instruction,
    equation,
    missingPosition,
    correctValue,
    options,
  });
}

function validateTrueFalse(raw: RawChallenge) {
  if (!raw.displayEquation) {
    console.log(`[EquationBuilder] REJECT true-false — missing displayEquation`);
    return null;
  }

  let displayEquation = raw.displayEquation;
  if (!displayEquation.includes(' ')) {
    displayEquation = displayEquation.replace(/([+\-=])/g, ' $1 ').replace(/\s+/g, ' ').trim();
  }

  // Compute isTrue ourselves — never trust Gemini
  const isTrue = evaluateEquation(displayEquation);

  return buildValidChallenge({
    id: raw.id,
    type: 'true-false',
    instruction: raw.instruction,
    displayEquation,
    isTrue,
  });
}

function validateBalance(raw: RawChallenge, maxNumber: number) {
  if (!raw.leftSide || !raw.rightSide) {
    console.log(`[EquationBuilder] REJECT balance — missing leftSide or rightSide`);
    return null;
  }

  let leftSide = raw.leftSide;
  let rightSide = raw.rightSide;

  // Ensure spaces
  if (!leftSide.includes(' ')) {
    leftSide = leftSide.replace(/([+\-])/g, ' $1 ').replace(/\s+/g, ' ').trim();
  }
  if (!rightSide.includes(' ')) {
    rightSide = rightSide.replace(/([+\-?])/g, ' $1 ').replace(/\s+/g, ' ').trim();
  }

  // Compute correctAnswer from both sides
  const leftVal = evalSide(leftSide);
  if (leftVal === null) {
    console.log(`[EquationBuilder] REJECT balance — cannot evaluate leftSide "${leftSide}"`);
    return null;
  }

  // Parse rightSide to find ? and solve
  const rightNorm = rightSide.replace(/\s+/g, '');
  let correctAnswer: number | null = null;

  if (rightNorm === '?') {
    correctAnswer = leftVal;
  } else if (rightNorm.startsWith('?+')) {
    const other = parseInt(rightNorm.replace('?+', ''), 10);
    correctAnswer = leftVal - other;
  } else if (rightNorm.endsWith('+?')) {
    const other = parseInt(rightNorm.replace('+?', ''), 10);
    correctAnswer = leftVal - other;
  } else if (rightNorm.startsWith('?-')) {
    const other = parseInt(rightNorm.replace('?-', ''), 10);
    correctAnswer = leftVal + other;
  } else if (rightNorm.endsWith('-?')) {
    const other = parseInt(rightNorm.replace('-?', ''), 10);
    correctAnswer = other - leftVal;
  } else {
    // Fallback: trust Gemini's correctAnswer
    if (raw.correctAnswer != null && !isNaN(raw.correctAnswer)) {
      correctAnswer = raw.correctAnswer;
    }
  }

  if (correctAnswer === null || isNaN(correctAnswer) || correctAnswer < 0) {
    console.log(`[EquationBuilder] REJECT balance — cannot compute correctAnswer for "${leftSide} = ${rightSide}"`);
    return null;
  }

  return buildValidChallenge({
    id: raw.id,
    type: 'balance',
    instruction: raw.instruction,
    leftSide,
    rightSide,
    correctAnswer,
  });
}

function validateRewrite(raw: RawChallenge, maxNumber: number) {
  if (!raw.originalEquation) {
    console.log(`[EquationBuilder] REJECT rewrite — missing originalEquation`);
    return null;
  }

  let originalEquation = raw.originalEquation;
  if (!originalEquation.includes(' ')) {
    originalEquation = originalEquation.replace(/([+\-=])/g, ' $1 ').replace(/\s+/g, ' ').trim();
  }

  // Verify original equation is mathematically true
  if (!evaluateEquation(originalEquation)) {
    console.log(`[EquationBuilder] REJECT rewrite — originalEquation "${originalEquation}" is not true`);
    return null;
  }

  // Generate acceptedForms from the original equation
  const norm = originalEquation.replace(/\s+/g, '');
  const eqParts = norm.split('=');
  if (eqParts.length !== 2) {
    console.log(`[EquationBuilder] REJECT rewrite — bad equation format "${originalEquation}"`);
    return null;
  }

  const leftVal = evalSide(eqParts[0]);
  const rightVal = evalSide(eqParts[1]);
  if (leftVal === null || rightVal === null || leftVal !== rightVal) {
    console.log(`[EquationBuilder] REJECT rewrite — equation doesn't balance`);
    return null;
  }

  // Extract the numbers involved
  // Parse both sides for operands
  const total = leftVal;
  const allNums = new Set<number>();
  for (const side of eqParts) {
    const nums = side.match(/\d+/g);
    if (nums) nums.forEach(n => allNums.add(parseInt(n, 10)));
  }

  // Generate all valid rewrites for a + b = c pattern
  const acceptedForms: string[] = [];
  const numsArr = Array.from(allNums);

  // Find additive pairs that sum to total
  for (let i = 0; i < numsArr.length; i++) {
    for (let j = 0; j < numsArr.length; j++) {
      if (numsArr[i] + numsArr[j] === total && !(i === j && numsArr.length < 2)) {
        const form1 = `${numsArr[i]} + ${numsArr[j]} = ${total}`;
        const form2 = `${total} = ${numsArr[i]} + ${numsArr[j]}`;
        if (!acceptedForms.includes(form1) && form1.replace(/\s+/g, '') !== norm) acceptedForms.push(form1);
        if (!acceptedForms.includes(form2)) acceptedForms.push(form2);
      }
      if (numsArr[i] - numsArr[j] >= 0 && numsArr[i] <= total) {
        const diff = numsArr[i] - numsArr[j];
        if (diff >= 0 && diff <= maxNumber) {
          const subForm = `${numsArr[i]} - ${numsArr[j]} = ${diff}`;
          // Only include if it's a valid rewrite involving the same numbers
          if (evaluateEquation(subForm) && !acceptedForms.includes(subForm) && subForm.replace(/\s+/g, '') !== norm) {
            acceptedForms.push(subForm);
          }
        }
      }
    }
  }

  // Also generate subtraction forms: total - a = b
  for (const n of numsArr) {
    if (n !== total && total - n >= 0) {
      const subForm1 = `${total} - ${n} = ${total - n}`;
      const subForm2 = `${total - n} = ${total} - ${n}`;
      if (evaluateEquation(subForm1) && !acceptedForms.includes(subForm1) && subForm1.replace(/\s+/g, '') !== norm) {
        acceptedForms.push(subForm1);
      }
      if (evaluateEquation(subForm2) && !acceptedForms.includes(subForm2)) {
        acceptedForms.push(subForm2);
      }
    }
  }

  if (acceptedForms.length === 0) {
    // At minimum, the reversed equation is accepted
    acceptedForms.push(`${eqParts[1]} = ${eqParts[0]}`.replace(/(\d)([+\-])/g, '$1 $2 ').replace(/([+\-=])(\d)/g, '$1 $2'));
  }

  // Reconstruct availableTiles from flat fields
  const tiles: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const val = raw[`tile${i}`] as string | undefined;
    if (val != null && val !== '') tiles.push(val);
  }

  // Ensure tiles cover all tokens needed for accepted forms
  const neededTokens = new Set<string>();
  for (const form of acceptedForms) {
    for (const token of tokenize(form)) {
      neededTokens.add(token);
    }
  }
  // Also add original equation tokens
  for (const token of tokenize(originalEquation)) {
    neededTokens.add(token);
  }

  const neededArr = Array.from(neededTokens);
  for (let ni = 0; ni < neededArr.length; ni++) {
    if (!tiles.includes(neededArr[ni])) {
      tiles.push(neededArr[ni]);
    }
  }

  // Ensure distractors
  const distractorCount = tiles.length - neededTokens.size;
  if (distractorCount < 2) {
    const existingNumbers = new Set(tiles.filter(t => /^\d+$/.test(t)).map(Number));
    let added = 0;
    for (let n = 0; n <= maxNumber && added < 2 - distractorCount; n++) {
      if (!existingNumbers.has(n)) {
        tiles.push(String(n));
        added++;
      }
    }
  }

  // Strip answer leak — if instruction reveals any accepted form, replace it
  let rewriteInstruction = raw.instruction!;
  const rewriteInstrNorm = rewriteInstruction.replace(/\s+/g, '');
  for (const form of acceptedForms) {
    if (rewriteInstrNorm.includes(form.replace(/\s+/g, ''))) {
      rewriteInstruction = `Can you write this equation another way?`;
      console.log(`[EquationBuilder] Stripped leaked accepted form from rewrite instruction`);
      break;
    }
  }

  return buildValidChallenge({
    id: raw.id,
    type: 'rewrite',
    instruction: rewriteInstruction,
    originalEquation,
    acceptedForms,
    availableTiles: shuffle([...tiles]),
  });
}

// ---------------------------------------------------------------------------
// Hardcoded fallback challenges
// ---------------------------------------------------------------------------

function getFallbackChallenges(
  evalMode: string | undefined,
  maxNum: number,
  gradeBand: string,
): import("../../primitives/visual-primitives/math/EquationBuilder").EquationBuilderChallenge[] {
  const a = Math.min(3, maxNum - 2);
  const b = 2;
  const total = a + b;

  const fallbacks: Record<string, () => import("../../primitives/visual-primitives/math/EquationBuilder").EquationBuilderChallenge> = {
    'build': () => ({
      id: 'fallback-1',
      type: 'build',
      instruction: `Can you build an equation that equals ${total}?`,
      targetEquation: `${a} + ${b} = ${total}`,
      availableTiles: shuffle([String(a), '+', String(b), '=', String(total), String(a + 1), '-']),
    }),
    'missing-value': () => ({
      id: 'fallback-1',
      type: 'missing-value',
      instruction: `What number is missing? ${a} + ${b} = ?`,
      equation: `${a} + ${b} = ?`,
      missingPosition: 4,
      correctValue: total,
      options: shuffle([total, ...generateDistractors(total, 3, maxNum)]),
    }),
    'true-false': () => ({
      id: 'fallback-1',
      type: 'true-false',
      instruction: `Is this equation true or false?`,
      displayEquation: `${a} + ${b} = ${total}`,
      isTrue: true,
    }),
    'balance': () => ({
      id: 'fallback-1',
      type: 'balance',
      instruction: `Make both sides equal: ${a} + ${b} = ? + 1`,
      leftSide: `${a} + ${b}`,
      rightSide: `? + 1`,
      correctAnswer: total - 1,
    }),
    'rewrite': () => ({
      id: 'fallback-1',
      type: 'rewrite',
      instruction: `Write this equation another way: ${a} + ${b} = ${total}`,
      originalEquation: `${a} + ${b} = ${total}`,
      acceptedForms: [`${b} + ${a} = ${total}`, `${total} = ${a} + ${b}`, `${total} - ${a} = ${b}`, `${total} - ${b} = ${a}`],
      availableTiles: shuffle([String(a), String(b), String(total), '+', '-', '=', String(a + 1)]),
    }),
  };

  // Map eval modes to challenge types
  const evalModeToType: Record<string, string> = {
    'build-simple': 'build',
    'missing-result': 'missing-value',
    'true-false': 'true-false',
    'missing-operand': 'missing-value',
    'balance-both-sides': 'balance',
    'rewrite': 'rewrite',
  };

  const challengeType = evalMode ? (evalModeToType[evalMode] ?? 'build') : 'build';
  const factory = fallbacks[challengeType] ?? fallbacks['build'];

  // For missing-operand fallback, fix the equation to have ? before =
  if (evalMode === 'missing-operand') {
    return [{
      id: 'fallback-1',
      type: 'missing-value',
      instruction: `What number is missing? ? + ${b} = ${total}`,
      equation: `? + ${b} = ${total}`,
      missingPosition: 0,
      correctValue: a,
      options: shuffle([a, ...generateDistractors(a, 3, maxNum)]),
    }];
  }

  return [factory()];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate equation builder data for interactive equation-building activities.
 *
 * Grade-aware content:
 * - Kindergarten (K): maxNumber 5, focus on build and missing-value
 * - Grade 1: maxNumber 10, all 5 challenge types
 * - Grade 2: maxNumber 20, emphasis on balance and rewrite
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns EquationBuilderData with complete configuration
 */
export const generateEquationBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    maxNumber: number;
    challengeTypes: string[];
    challengeCount: number;
    /** Target eval mode from the IRT calibration system */
    targetEvalMode: string;
  }>
): Promise<EquationBuilderData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'equation-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Build mode-constrained schema ──
  const activeSchema = buildEquationBuilderSchema(evalConstraint?.allowedTypes ?? effectiveChallengeTypes);

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational equation-building activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Students build, evaluate, and balance equations using draggable number and operator tiles
- The MOST IMPORTANT concept: the equal sign = means "same amount on both sides," NOT "answer comes next"
- Challenge types progress from concrete tile-building to abstract relational reasoning
- This is a K-2 math manipulative for equation understanding

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * maxNumber: 5 (numbers 0-5)
  * Focus on 'build' and 'missing-value' types
  * Use warm, playful language ("Can you build this equation?")
  * Simple addition only (no subtraction)

- Grade 1 (gradeBand "1"):
  * maxNumber: 10 (numbers 0-10)
  * Include all challenge types, progressing in difficulty
  * Addition and subtraction
  * Introduce balance and rewrite to build relational understanding

- Grade 2 (gradeBand "2"):
  * maxNumber: 20 (numbers 0-20)
  * Emphasis on balance and rewrite for deeper relational understanding
  * More complex expressions on both sides of =
` : ''}

${(() => {
  const hints: string[] = [];
  if (config?.maxNumber) hints.push(`- Max number: ${config.maxNumber}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.challengeCount) hints.push(`- Number of challenges: ${config.challengeCount}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate ${config?.challengeCount || '3-5'} challenges that progress in difficulty
2. Use warm, encouraging instruction text appropriate for young children
3. For 'build': targetEquation must be mathematically true. Include all equation tokens PLUS 2-3 distractor tiles in tile0-tile6
4. For 'missing-value': equation must have exactly one ?. Provide 4 multiple-choice options (option0-option3) including the correct answer
5. For 'true-false': MIX true and false equations (not all the same). displayEquation must be complete
6. For 'balance': leftSide is fully known, rightSide has one ?. Both sides must evaluate to the same value
7. For 'rewrite': originalEquation must be mathematically true. Include tiles for alternative forms + distractors
8. ALL equations must use spaces between tokens: "3 + 2 = 5" not "3+2=5"
9. Numbers must not exceed maxNumber
10. Vary the numbers across challenges — don't repeat the same equation

Return the complete equation builder configuration.
`;

  logEvalModeResolution('EquationBuilder', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid equation builder data returned from Gemini API');
  }

  // ---- Validation & defaults ----

  // Validate gradeBand
  if (data.gradeBand !== 'K' && data.gradeBand !== '1' && data.gradeBand !== '2') {
    if (gradeLevel.toLowerCase().includes('kinder')) data.gradeBand = 'K';
    else if (gradeLevel.includes('2')) data.gradeBand = '2';
    else data.gradeBand = '1';
  }

  // Validate maxNumber
  const gradeBandMaxes: Record<string, number> = { K: 5, '1': 10, '2': 20 };
  const gradeMax = gradeBandMaxes[data.gradeBand] ?? 10;
  if (!data.maxNumber || data.maxNumber < 2) {
    data.maxNumber = gradeMax;
  }
  if (data.maxNumber > gradeMax) {
    data.maxNumber = gradeMax;
  }

  // Validate challenges through post-validation pipeline
  const validTypes = ['build', 'missing-value', 'true-false', 'balance', 'rewrite'];

  const validatedChallenges: import("../../primitives/visual-primitives/math/EquationBuilder").EquationBuilderChallenge[] = [];

  for (const raw of (data.challenges || [])) {
    // Skip unknown types
    if (!validTypes.includes(raw.type)) {
      console.log(`[EquationBuilder] SKIP challenge with invalid type: "${raw.type}"`);
      continue;
    }

    const validated = validateChallenge(raw, data.maxNumber, config?.targetEvalMode);
    if (validated) {
      validatedChallenges.push(validated);
    }
  }

  // Use validated challenges or fallbacks
  if (validatedChallenges.length > 0) {
    data.challenges = validatedChallenges;
  } else {
    console.log(`[EquationBuilder] No valid challenges — using fallback`);
    data.challenges = getFallbackChallenges(config?.targetEvalMode, data.maxNumber, data.gradeBand);
  }

  // Apply explicit config overrides
  if (config?.maxNumber !== undefined) {
    data.maxNumber = Math.min(config.maxNumber, gradeMax);
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map(c => c.type).join(', ');
  console.log(`[EquationBuilder] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
