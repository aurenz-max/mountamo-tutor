import { Type, Schema } from "@google/genai";
import { OrdinalLineData, OrdinalLineChallenge } from "../../primitives/visual-primitives/math/OrdinalLine";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------
// OrdinalLine uses parallel per-type generators (not a single schema with a
// type enum), so we don't use constrainChallengeTypeEnum or
// buildChallengeTypePromptSection. CHALLENGE_TYPE_DOCS is still required by
// resolveEvalModeConstraint to build the constraint object.

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      `"identify": Student sees the character lineup and taps the character at a specific ordinal position. `
      + `Concrete manipulative — "Tap the third animal!"`,
    schemaDescription: "'identify' (name ordinal position)",
  },
  match: {
    promptDoc:
      `"match": Student matches ordinal words to their symbols (e.g., "first" → "1st"). `
      + `3-5 pairs for K, 5-8 pairs for Grade 1.`,
    schemaDescription: "'match' (connect ordinal word to symbol)",
  },
  'relative-position': {
    promptDoc:
      `"relative-position": Student answers "Who is BEFORE/AFTER the Nth character?" `
      + `Multiple-choice with 3-4 character name options. Requires positional reasoning.`,
    schemaDescription: "'relative-position' (before/after reasoning)",
  },
  'sequence-story': {
    promptDoc:
      `"sequence-story": Student reads a story that describes ALL characters in ordinal positions, `
      + `then drags each character emoji to the correct slot. Story must mention every character.`,
    schemaDescription: "'sequence-story' (story-based ordering)",
  },
  'build-sequence': {
    promptDoc:
      `"build-sequence": Student receives 3-6 clues telling them where to place characters. `
      + `Each clue names a character and target position. Student constructs the ordering from scratch.`,
    schemaDescription: "'build-sequence' (construct ordering from clues)",
  },
};

// ============================================================================
// Shared Setup Schema (lightweight first call)
// ============================================================================

interface SetupResult {
  title: string;
  description: string;
  characters: Array<{ name: string; emoji: string }>;
  context: 'race' | 'parade' | 'lunch-line' | 'train' | 'bookshelf';
  maxPosition: number;
  gradeBand: 'K' | '1';
  showOrdinalLabels: boolean;
  labelFormat: 'word' | 'symbol' | 'both';
}

const setupSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Fun title for the ordinal activity (e.g., 'Animal Race: Who's First?')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Character name (e.g., 'Rabbit')" },
          emoji: { type: Type.STRING, description: "Single emoji (e.g., '🐰')" }
        },
        required: ["name", "emoji"]
      },
      description: "Animal characters for the lineup"
    },
    context: {
      type: Type.STRING,
      description: "Theme: 'race', 'parade', 'lunch-line', 'train', or 'bookshelf'"
    },
    maxPosition: {
      type: Type.NUMBER,
      description: "Max ordinal position: 5 for K, up to 10 for Grade 1"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' or '1'"
    },
    showOrdinalLabels: {
      type: Type.BOOLEAN,
      description: "Whether to show ordinal labels (always true)"
    },
    labelFormat: {
      type: Type.STRING,
      description: "Label style: 'word', 'symbol', or 'both'"
    }
  },
  required: ["title", "description", "characters", "context", "maxPosition", "gradeBand", "showOrdinalLabels", "labelFormat"]
};

// ============================================================================
// Per-Challenge-Type Schemas
// ============================================================================

const identifySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Warm instruction like 'Tap the third animal in the race!'"
    },
    targetPosition: {
      type: Type.NUMBER,
      description: "1-indexed position the student must find"
    },
    targetOrdinalWord: {
      type: Type.STRING,
      description: "Ordinal word (e.g., 'third')"
    },
    targetOrdinalSymbol: {
      type: Type.STRING,
      description: "Ordinal symbol (e.g., '3rd')"
    },
    correctAnswer: {
      type: Type.STRING,
      description: "The position number as a string (e.g., '3')"
    }
  },
  required: ["instruction", "targetPosition", "targetOrdinalWord", "targetOrdinalSymbol", "correctAnswer"]
};

const matchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Match each ordinal word to its symbol!'"
    },
    matchPairs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "Ordinal word (e.g., 'first')" },
          symbol: { type: Type.STRING, description: "Ordinal symbol (e.g., '1st')" }
        },
        required: ["word", "symbol"]
      },
      description: "3-5 pairs for K, 5-8 for Grade 1"
    }
  },
  required: ["instruction", "matchPairs"]
};

const relativePositionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Question like 'Who is right AFTER the second animal?'"
    },
    targetPosition: {
      type: Type.NUMBER,
      description: "1-indexed reference position"
    },
    targetOrdinalWord: {
      type: Type.STRING,
      description: "Ordinal word for the reference position"
    },
    targetOrdinalSymbol: {
      type: Type.STRING,
      description: "Ordinal symbol for the reference position"
    },
    relativeQuery: {
      type: Type.STRING,
      description: "'before' or 'after'"
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-4 character name choices"
    },
    correctAnswer: {
      type: Type.STRING,
      description: "The correct character name"
    }
  },
  required: ["instruction", "targetPosition", "targetOrdinalWord", "targetOrdinalSymbol", "relativeQuery", "options", "correctAnswer"]
};

const sequenceStorySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Read the story and drag each animal to their correct spot!'"
    },
    storyText: {
      type: Type.STRING,
      description: "Fun 2-3 sentence story that clearly describes ALL characters in specific ordinal positions"
    },
    clues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          character: { type: Type.STRING, description: "Character name from the lineup" },
          position: { type: Type.NUMBER, description: "1-indexed ordinal position as described in the story" }
        },
        required: ["character", "position"]
      },
      description: "Mapping of every character to their ordinal position as described in the story"
    }
  },
  required: ["instruction", "storyText", "clues"]
};

const buildSequenceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Place the animals using the clues!'"
    },
    clues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          character: { type: Type.STRING, description: "Character name to place" },
          position: { type: Type.NUMBER, description: "1-indexed target position" }
        },
        required: ["character", "position"]
      },
      description: "3-4 clues for K, 4-6 for Grade 1"
    }
  },
  required: ["instruction", "clues"]
};

// ============================================================================
// Setup Generator
// ============================================================================

async function generateSetup(
  topic: string,
  gradeLevel: string,
  config?: {
    context?: string;
    gradeBand?: string;
    maxPosition?: number;
  },
): Promise<SetupResult> {
  const prompt = `
Create a fun theme for an ordinal positions activity teaching "${topic}" to ${gradeLevel} students.

Pick a context (race, parade, lunch-line, train, or bookshelf) and create a lineup of animal characters with emojis.
- Kindergarten (gradeBand "K"): 5 characters, maxPosition 5, labelFormat "word" or "both"
- Grade 1 (gradeBand "1"): up to 10 characters, maxPosition up to 10, labelFormat "symbol" or "both"

${config?.context ? `Preferred context: ${config.context}` : ''}
${config?.gradeBand ? `Grade band: ${config.gradeBand}` : ''}
${config?.maxPosition ? `Max position: ${config.maxPosition}` : ''}

Use unique animal characters with fun emojis. Title should be engaging for young children.
showOrdinalLabels should be true.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: setupSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No setup data returned from Gemini API');

  // --- Validate setup ---
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }
  if (!data.maxPosition || data.maxPosition < 3) {
    data.maxPosition = data.gradeBand === 'K' ? 5 : 10;
  }
  if (data.gradeBand === 'K' && data.maxPosition > 5) data.maxPosition = 5;
  if (data.maxPosition > 10) data.maxPosition = 10;

  const validContexts = ['race', 'parade', 'lunch-line', 'train', 'bookshelf'];
  if (!validContexts.includes(data.context)) data.context = 'race';

  const validFormats = ['word', 'symbol', 'both'];
  if (!validFormats.includes(data.labelFormat)) {
    data.labelFormat = data.gradeBand === 'K' ? 'word' : 'symbol';
  }
  if (typeof data.showOrdinalLabels !== 'boolean') data.showOrdinalLabels = true;

  // Ensure characters array is valid and sized to maxPosition
  const defaultCharacters = [
    { name: 'Rabbit', emoji: '\uD83D\uDC30' },
    { name: 'Turtle', emoji: '\uD83D\uDC22' },
    { name: 'Fox', emoji: '\uD83E\uDD8A' },
    { name: 'Bear', emoji: '\uD83D\uDC3B' },
    { name: 'Frog', emoji: '\uD83D\uDC38' },
    { name: 'Owl', emoji: '\uD83E\uDD89' },
    { name: 'Cat', emoji: '\uD83D\uDC31' },
    { name: 'Dog', emoji: '\uD83D\uDC36' },
    { name: 'Pig', emoji: '\uD83D\uDC37' },
    { name: 'Mouse', emoji: '\uD83D\uDC2D' },
  ];

  if (!Array.isArray(data.characters) || data.characters.length === 0) {
    data.characters = defaultCharacters.slice(0, data.maxPosition);
  }
  // Pad if LLM returned fewer than maxPosition
  while (data.characters.length < data.maxPosition && data.characters.length < defaultCharacters.length) {
    const next = defaultCharacters.find(d => !data.characters.some((c: { name: string }) => c.name === d.name));
    if (next) data.characters.push(next);
    else break;
  }
  // Trim if too many
  if (data.characters.length > data.maxPosition) {
    data.characters = data.characters.slice(0, data.maxPosition);
  }

  return data as SetupResult;
}

// ============================================================================
// Per-Type Challenge Generators
// ============================================================================

function characterListStr(setup: SetupResult): string {
  return setup.characters.map((c, i) => `${i + 1}. ${c.emoji} ${c.name}`).join(', ');
}

function sharedContext(setup: SetupResult, gradeLevel: string): string {
  return `
Context: A "${setup.context}" with these characters in order: ${characterListStr(setup)}.
Max position: ${setup.maxPosition}. Grade: ${gradeLevel}.
Use warm, encouraging language for young children. Only reference positions 1 through ${setup.maxPosition}.
`;
}

async function generateIdentify(setup: SetupResult, topic: string, gradeLevel: string) {
  const prompt = `
Create an IDENTIFY challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel)}

The student sees the character lineup and must tap the character at a specific ordinal position.
- Pick a position between 1 and ${setup.maxPosition}
- Write a fun instruction like "Tap the third animal!"
- correctAnswer is the position number as a string (e.g., "3")
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: identifySchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackIdentify(setup);

  // Validate
  if (!data.targetPosition || data.targetPosition < 1 || data.targetPosition > setup.maxPosition) {
    data.targetPosition = Math.min(3, setup.maxPosition);
  }
  if (!data.correctAnswer) data.correctAnswer = String(data.targetPosition);

  return data;
}

async function generateMatch(setup: SetupResult, topic: string, gradeLevel: string) {
  const pairCount = setup.gradeBand === 'K' ? '3-5' : '5-8';
  const prompt = `
Create a MATCH challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel)}

The student matches ordinal words to their symbols (e.g., "first" → "1st").
- Provide ${pairCount} matchPairs
- Only use ordinals up to ${setup.maxPosition}th
- Instruction should be encouraging
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: matchSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackMatch(setup);

  // Validate matchPairs
  if (!Array.isArray(data.matchPairs) || data.matchPairs.length === 0) {
    return fallbackMatch(setup);
  }

  return data;
}

async function generateRelative(setup: SetupResult, topic: string, gradeLevel: string) {
  const prompt = `
Create a RELATIVE-POSITION challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel)}

Ask "Who is BEFORE/AFTER the Nth character?" The student picks from multiple-choice options.
- Pick relativeQuery: "before" or "after"
- Pick a targetPosition between 2 and ${setup.maxPosition - 1} (so before/after exists)
- Provide 3-4 options (character names from the lineup)
- correctAnswer must be the correct character name
- The correct character is the one directly before/after the target position
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: relativePositionSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackRelative(setup);

  // Validate targetPosition is within bounds and before/after exists
  if (!data.targetPosition || data.targetPosition < 1 || data.targetPosition > setup.maxPosition) {
    data.targetPosition = 2;
  }
  if (data.relativeQuery !== 'before' && data.relativeQuery !== 'after') {
    data.relativeQuery = 'after';
  }
  // Ensure the query makes sense (can't ask "before" for position 1)
  if (data.relativeQuery === 'before' && data.targetPosition <= 1) {
    data.relativeQuery = 'after';
  }
  if (data.relativeQuery === 'after' && data.targetPosition >= setup.maxPosition) {
    data.relativeQuery = 'before';
  }

  // Validate correctAnswer matches actual lineup
  const answerIdx = data.relativeQuery === 'before'
    ? data.targetPosition - 2
    : data.targetPosition;
  if (answerIdx >= 0 && answerIdx < setup.characters.length) {
    data.correctAnswer = setup.characters[answerIdx].name;
  }

  // Ensure correctAnswer is in options
  if (Array.isArray(data.options) && !data.options.includes(data.correctAnswer)) {
    data.options[0] = data.correctAnswer;
  }

  return data;
}

async function generateStory(setup: SetupResult, topic: string, gradeLevel: string) {
  const charNames = setup.characters.map(c => c.name).join(', ');
  const prompt = `
Create a SEQUENCE-STORY challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel)}

Write a fun 2-3 sentence story about ALL the characters (${charNames}) in the "${setup.context}".
The story MUST mention every character and clearly state their ordinal position (first, second, third, etc.).
The student will read the story, then drag each character emoji into the correct position.

- instruction: a warm instruction like "Read the story and drag each animal to their correct spot!"
- storyText: the 2-3 sentence story with ALL characters in ordinal positions
- clues: an array mapping EVERY character to their position as described in the story
  e.g. [{"character": "Lion", "position": 1}, {"character": "Monkey", "position": 2}, ...]
  Every character from the lineup MUST appear exactly once. Positions 1 through ${setup.maxPosition}.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: sequenceStorySchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackStory(setup);

  if (!data.storyText) return fallbackStory(setup);

  // Validate clues reference real characters and valid positions
  const charNameSet = new Set(setup.characters.map(c => c.name));
  if (!Array.isArray(data.clues) || data.clues.length === 0) return fallbackStory(setup);
  data.clues = data.clues.filter(
    (clue: { character: string; position: number }) =>
      charNameSet.has(clue.character) && clue.position >= 1 && clue.position <= setup.maxPosition
  );
  if (data.clues.length < setup.characters.length) return fallbackStory(setup);

  return data;
}

async function generateBuild(setup: SetupResult, topic: string, gradeLevel: string) {
  const clueCount = setup.gradeBand === 'K' ? '3-4' : '4-6';
  const charNames = setup.characters.map(c => c.name).join(', ');
  const prompt = `
Create a BUILD-SEQUENCE challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel)}

Give ${clueCount} clues telling the student where to place characters.
Available characters: ${charNames}.
Each clue has a "character" name and a "position" (1-indexed, up to ${setup.maxPosition}).
Each character and position should be used at most once.
Write an encouraging instruction.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: buildSequenceSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackBuild(setup);

  // Validate clues reference real characters and valid positions
  if (!Array.isArray(data.clues) || data.clues.length === 0) return fallbackBuild(setup);
  const charNameSet = new Set(setup.characters.map(c => c.name));
  data.clues = data.clues.filter(
    (clue: { character: string; position: number }) =>
      charNameSet.has(clue.character) && clue.position >= 1 && clue.position <= setup.maxPosition
  );
  if (data.clues.length === 0) return fallbackBuild(setup);

  return data;
}

// ============================================================================
// Fallback Defaults (per-type)
// ============================================================================

function fallbackIdentify(setup: SetupResult) {
  const pos = Math.min(3, setup.maxPosition);
  const ORDINAL_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const ORDINAL_SYMBOLS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  return {
    instruction: `Tap the ${ORDINAL_WORDS[pos - 1]} animal in the ${setup.context}!`,
    targetPosition: pos,
    targetOrdinalWord: ORDINAL_WORDS[pos - 1],
    targetOrdinalSymbol: ORDINAL_SYMBOLS[pos - 1],
    correctAnswer: String(pos),
  };
}

function fallbackMatch(setup: SetupResult) {
  const ORDINAL_WORDS = ['first', 'second', 'third', 'fourth', 'fifth'];
  const ORDINAL_SYMBOLS = ['1st', '2nd', '3rd', '4th', '5th'];
  const count = Math.min(setup.gradeBand === 'K' ? 3 : 5, setup.maxPosition);
  return {
    instruction: 'Match each ordinal word to its symbol!',
    matchPairs: Array.from({ length: count }, (_, i) => ({
      word: ORDINAL_WORDS[i],
      symbol: ORDINAL_SYMBOLS[i],
    })),
  };
}

function fallbackRelative(setup: SetupResult) {
  const pos = 2;
  const afterChar = setup.characters[pos] || setup.characters[setup.characters.length - 1];
  const options = [afterChar.name];
  for (const c of setup.characters) {
    if (c.name !== afterChar.name && options.length < 3) options.push(c.name);
  }
  return {
    instruction: `Who is right AFTER the second animal?`,
    targetPosition: pos,
    targetOrdinalWord: 'second',
    targetOrdinalSymbol: '2nd',
    relativeQuery: 'after' as const,
    options,
    correctAnswer: afterChar.name,
  };
}

function fallbackStory(setup: SetupResult) {
  const chars = setup.characters;
  const ORDINAL_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

  // Build a story mentioning every character in order
  const storyParts = chars.map((c, i) =>
    `${c.name} ${i === 0 ? 'leads the way in' : 'is in'} ${ORDINAL_WORDS[i]} place`
  );
  const storyText = `The animals are lining up for the ${setup.context}! ${storyParts.join('. ')}.`;

  return {
    instruction: 'Read the story and drag each animal to their correct spot!',
    storyText,
    clues: chars.map((c, i) => ({ character: c.name, position: i + 1 })),
  };
}

function fallbackBuild(setup: SetupResult) {
  const chars = setup.characters;
  const clueCount = Math.min(setup.gradeBand === 'K' ? 3 : 4, chars.length);
  const clues = [];
  for (let i = 0; i < clueCount; i++) {
    clues.push({ character: chars[i].name, position: i + 1 });
  }
  return {
    instruction: 'Place the animals in the correct order using the clues!',
    clues,
  };
}

// ============================================================================
// Multi-Instance Builders (single-mode, pool-service style per PRD §6a #1/#7)
// ============================================================================
//
// When the eval mode pins to ONE challenge type, we generate N distinct
// instances of THAT type instead of 1-per-type. For value-only modes
// (identify, match, relative-position, build-sequence) we build the
// challenges deterministically in code. For sequence-story we fan out N
// parallel Gemini calls with pre-randomized character orderings to force
// variance (structured-output Gemini is convergent — see PRD §6a #2).

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------

type ChallengeType =
  | 'identify'
  | 'match'
  | 'relative-position'
  | 'sequence-story'
  | 'build-sequence';

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1 — fast-tap K-1 ordinal)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  identify: 7,
  match: 7,
  'relative-position': 7,
  'sequence-story': 4, // T3 hold (orchestrator: N parallel Gemini calls per challenge)
  'build-sequence': 4, // not in B2 scope — hold at current
};

function resolveCount(type: string): number {
  const fromTable = (COUNT_BY_MODE as Record<string, number>)[type];
  return Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, fromTable ?? DEFAULT_INSTANCE_COUNT),
  );
}

const ORDINAL_WORDS = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];
const ORDINAL_SYMBOLS = [
  '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th',
];

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistinctPositions(maxPosition: number, count: number): number[] {
  const pool = Array.from({ length: maxPosition }, (_, i) => i + 1);
  shuffleInPlace(pool);
  return pool.slice(0, Math.min(count, maxPosition));
}

function contextNoun(context: SetupResult['context']): string {
  switch (context) {
    case 'race':       return 'animal';
    case 'parade':     return 'animal';
    case 'lunch-line': return 'one';
    case 'train':      return 'one';
    case 'bookshelf':  return 'book';
    default:           return 'one';
  }
}

function buildIdentifyChallenges(
  setup: SetupResult,
  count: number,
): OrdinalLineChallenge[] {
  const positions = pickDistinctPositions(setup.maxPosition, count);
  const noun = contextNoun(setup.context);
  return positions.map((pos, i) => ({
    id: `c${i + 1}`,
    type: 'identify' as const,
    characters: setup.characters,
    instruction: `Tap the ${ORDINAL_WORDS[pos - 1]} ${noun} in the ${setup.context}!`,
    targetPosition: pos,
    targetOrdinalWord: ORDINAL_WORDS[pos - 1],
    targetOrdinalSymbol: ORDINAL_SYMBOLS[pos - 1],
    correctAnswer: String(pos),
  }));
}

function buildMatchChallenges(
  setup: SetupResult,
  count: number,
): OrdinalLineChallenge[] {
  const minPairs = setup.gradeBand === 'K' ? 3 : 5;
  const maxPairs = Math.min(setup.gradeBand === 'K' ? 5 : 8, setup.maxPosition);
  const allPositions = Array.from({ length: setup.maxPosition }, (_, i) => i + 1);

  const challenges: OrdinalLineChallenge[] = [];
  const seenKeys = new Set<string>();
  let attempts = 0;

  while (challenges.length < count && attempts < count * 20) {
    attempts++;
    const pairCount = minPairs + Math.floor(Math.random() * (maxPairs - minPairs + 1));
    const positions = shuffleInPlace([...allPositions])
      .slice(0, pairCount)
      .sort((a, b) => a - b);
    const key = positions.join(',');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    challenges.push({
      id: `c${challenges.length + 1}`,
      type: 'match' as const,
      characters: setup.characters,
      instruction: 'Match each ordinal word to its symbol!',
      matchPairs: positions.map((p) => ({
        word: ORDINAL_WORDS[p - 1],
        symbol: ORDINAL_SYMBOLS[p - 1],
      })),
      correctAnswer: 'all_matched',
    });
  }

  return challenges;
}

function buildRelativeChallenges(
  setup: SetupResult,
  count: number,
): OrdinalLineChallenge[] {
  // Enumerate all valid (position, query) tuples
  const validTuples: Array<{ pos: number; query: 'before' | 'after' }> = [];
  for (let p = 1; p <= setup.maxPosition; p++) {
    if (p > 1) validTuples.push({ pos: p, query: 'before' });
    if (p < setup.maxPosition) validTuples.push({ pos: p, query: 'after' });
  }
  shuffleInPlace(validTuples);
  const selected = validTuples.slice(0, Math.min(count, validTuples.length));

  return selected.map((t, i) => {
    const answerIdx = t.query === 'before' ? t.pos - 2 : t.pos;
    const correctChar = setup.characters[answerIdx];

    // Build 3-4 multiple-choice options: correct + distractors from the lineup
    const distractors = setup.characters
      .filter((c) => c.name !== correctChar.name)
      .map((c) => c.name);
    shuffleInPlace(distractors);
    const distractorCount = Math.min(3, distractors.length);
    const options = shuffleInPlace([
      correctChar.name,
      ...distractors.slice(0, distractorCount),
    ]);

    return {
      id: `c${i + 1}`,
      type: 'relative-position' as const,
      characters: setup.characters,
      instruction: `Who is right ${t.query === 'before' ? 'BEFORE' : 'AFTER'} the ${ORDINAL_WORDS[t.pos - 1]} character?`,
      targetPosition: t.pos,
      targetOrdinalWord: ORDINAL_WORDS[t.pos - 1],
      targetOrdinalSymbol: ORDINAL_SYMBOLS[t.pos - 1],
      relativeQuery: t.query,
      options,
      correctAnswer: correctChar.name,
    };
  });
}

function buildBuildSequenceChallenges(
  setup: SetupResult,
  count: number,
): OrdinalLineChallenge[] {
  // Clue count mirrors the original prompt: K → 3, G1 → 4
  const clueCount = Math.min(
    setup.gradeBand === 'K' ? 3 : 4,
    setup.characters.length,
  );

  const challenges: OrdinalLineChallenge[] = [];
  const seenKeys = new Set<string>();
  let attempts = 0;

  while (challenges.length < count && attempts < count * 20) {
    attempts++;
    const shuffled = shuffleInPlace([...setup.characters]).slice(0, clueCount);
    const clues = shuffled.map((c, i) => ({ character: c.name, position: i + 1 }));
    const key = clues.map((c) => `${c.character}@${c.position}`).join('|');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    challenges.push({
      id: `c${challenges.length + 1}`,
      type: 'build-sequence' as const,
      characters: setup.characters,
      instruction: 'Place the animals in the correct order using the clues!',
      clues,
      correctAnswer: 'sequence_complete',
    });
  }

  return challenges;
}

const storySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: { type: Type.STRING },
    storyText: { type: Type.STRING },
  },
  required: ['instruction', 'storyText'],
};

async function generateStoryForOrdering(
  setup: SetupResult,
  topic: string,
  gradeLevel: string,
  clues: Array<{ character: string; position: number }>,
): Promise<{ instruction: string; storyText: string }> {
  const sorted = [...clues].sort((a, b) => a.position - b.position);
  const orderingHint = sorted
    .map((c) => `${c.character} is ${ORDINAL_WORDS[c.position - 1]}`)
    .join(', ');

  const prompt = `
Create a SEQUENCE-STORY for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel)}

Write a fun 2-3 sentence story in the "${setup.context}" using this EXACT character ordering:
${orderingHint}.

Every character must be mentioned with their ordinal position word (first, second, third, etc.).
Vary the wording — do not just say "X is first, Y is second."
Return only:
- instruction: a warm, brief instruction
- storyText: the 2-3 sentence story matching the ordering above
`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: storySchema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    if (!data?.storyText) return fallbackStoryWithOrdering(setup, sorted);
    return {
      instruction: data.instruction || 'Read the story and drag each animal to their correct spot!',
      storyText: data.storyText,
    };
  } catch {
    return fallbackStoryWithOrdering(setup, sorted);
  }
}

function fallbackStoryWithOrdering(
  setup: SetupResult,
  sorted: Array<{ character: string; position: number }>,
): { instruction: string; storyText: string } {
  const parts = sorted.map((c, i) =>
    `${c.character} ${i === 0 ? 'leads the way in' : 'is in'} ${ORDINAL_WORDS[c.position - 1]} place`,
  );
  return {
    instruction: 'Read the story and drag each animal to their correct spot!',
    storyText: `The animals are lining up for the ${setup.context}! ${parts.join('. ')}.`,
  };
}

async function buildStoryChallenges(
  setup: SetupResult,
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<OrdinalLineChallenge[]> {
  // Generate N distinct character orderings before fanning out Gemini calls.
  // Structured-output Gemini converges per call (PRD §6a #2), so variance
  // must come from pre-randomized clues, not from prompt phrasing.
  const orderings: Array<Array<{ character: string; position: number }>> = [];
  const seenKeys = new Set<string>();

  // First ordering: natural left-to-right
  const natural = setup.characters.map((c, i) => ({ character: c.name, position: i + 1 }));
  orderings.push(natural);
  seenKeys.add(natural.map((c) => c.character).join('|'));

  let safety = 0;
  while (orderings.length < count && safety < count * 30) {
    safety++;
    const shuffled = shuffleInPlace([...setup.characters]);
    const clues = shuffled.map((c, i) => ({ character: c.name, position: i + 1 }));
    const key = clues.map((c) => c.character).join('|');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    orderings.push(clues);
  }

  const stories = await Promise.all(
    orderings.map((clues) =>
      generateStoryForOrdering(setup, topic, gradeLevel, clues),
    ),
  );

  return stories.map((story, i) => ({
    id: `c${i + 1}`,
    type: 'sequence-story' as const,
    characters: setup.characters,
    instruction: story.instruction,
    storyText: story.storyText,
    clues: orderings[i],
    correctAnswer: 'sequence_complete',
  }));
}

async function buildSingleModeChallenges(
  singleType: string,
  setup: SetupResult,
  topic: string,
  gradeLevel: string,
): Promise<OrdinalLineChallenge[]> {
  const count = resolveCount(singleType);
  switch (singleType) {
    case 'identify':
      return buildIdentifyChallenges(setup, count);
    case 'match':
      return buildMatchChallenges(setup, count);
    case 'relative-position':
      return buildRelativeChallenges(setup, count);
    case 'build-sequence':
      return buildBuildSequenceChallenges(setup, count);
    case 'sequence-story':
      return buildStoryChallenges(setup, topic, gradeLevel, count);
    default:
      return [];
  }
}

// ============================================================================
// Main Generator (public API)
// ============================================================================

export const generateOrdinalLine = async (
  topic: string,
  gradeLevel: string,
  config?: {
    maxPosition?: number;
    context?: 'race' | 'parade' | 'lunch-line' | 'train' | 'bookshelf';
    showOrdinalLabels?: boolean;
    labelFormat?: 'word' | 'symbol' | 'both';
    gradeBand?: 'K' | '1';
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
  }
): Promise<OrdinalLineData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'ordinal-line',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  logEvalModeResolution('OrdinalLine', config?.targetEvalMode, evalConstraint);

  const allTypes = ['identify', 'match', 'relative-position', 'sequence-story', 'build-sequence'];
  const allowedTypes = new Set(evalConstraint?.allowedTypes ?? allTypes);

  // Step 1: Setup call (always needed)
  const setup = await generateSetup(topic, gradeLevel, config);

  // Step 2: Build challenges.
  //
  // Single-mode (IRT-pinned to one eval mode): produce N=4 distinct instances of
  // that type via the pool-service / pre-randomized-clue builders (PRD §6a #7).
  // Multi-mode (auto / no constraint): keep the one-per-type orchestration so
  // the tester preview surfaces every challenge shape.
  let challenges: OrdinalLineChallenge[] = [];

  if (allowedTypes.size === 1) {
    const [singleType] = Array.from(allowedTypes);
    challenges = await buildSingleModeChallenges(singleType, setup, topic, gradeLevel);
  } else {
    const [identify, match, relative, story, build] = await Promise.all([
      allowedTypes.has('identify') ? generateIdentify(setup, topic, gradeLevel) : null,
      allowedTypes.has('match') ? generateMatch(setup, topic, gradeLevel) : null,
      allowedTypes.has('relative-position') ? generateRelative(setup, topic, gradeLevel) : null,
      allowedTypes.has('sequence-story') ? generateStory(setup, topic, gradeLevel) : null,
      allowedTypes.has('build-sequence') ? generateBuild(setup, topic, gradeLevel) : null,
    ]);

    let idx = 1;

    if (identify) {
      challenges.push({
        id: `c${idx++}`,
        type: 'identify',
        characters: setup.characters,
        correctAnswer: identify.correctAnswer ?? String(identify.targetPosition),
        ...identify,
      } as OrdinalLineChallenge);
    }

    if (match) {
      challenges.push({
        id: `c${idx++}`,
        type: 'match',
        characters: setup.characters,
        correctAnswer: 'all_matched',
        ...match,
      } as OrdinalLineChallenge);
    }

    if (relative) {
      challenges.push({
        id: `c${idx++}`,
        type: 'relative-position',
        characters: setup.characters,
        ...relative,
      } as OrdinalLineChallenge);
    }

    if (story) {
      challenges.push({
        id: `c${idx++}`,
        type: 'sequence-story',
        characters: setup.characters,
        correctAnswer: 'sequence_complete',
        ...story,
      } as OrdinalLineChallenge);
    }

    if (build) {
      challenges.push({
        id: `c${idx++}`,
        type: 'build-sequence',
        characters: setup.characters,
        correctAnswer: 'sequence_complete',
        ...build,
      } as OrdinalLineChallenge);
    }
  }

  // Final summary log
  const typeBreakdown = challenges.map(c => c.type).join(', ');
  console.log(`[OrdinalLine] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  const data: OrdinalLineData = {
    title: setup.title,
    description: setup.description,
    challenges,
    maxPosition: setup.maxPosition,
    context: setup.context,
    showOrdinalLabels: setup.showOrdinalLabels,
    labelFormat: setup.labelFormat,
    gradeBand: setup.gradeBand,
  };

  // Step 4: Apply explicit config overrides
  if (config) {
    if (config.maxPosition !== undefined) data.maxPosition = config.maxPosition;
    if (config.context !== undefined) data.context = config.context;
    if (config.showOrdinalLabels !== undefined) data.showOrdinalLabels = config.showOrdinalLabels;
    if (config.labelFormat !== undefined) data.labelFormat = config.labelFormat;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  return data;
};
