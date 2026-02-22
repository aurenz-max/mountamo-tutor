import { Type, Schema } from "@google/genai";
import { OrdinalLineData, OrdinalLineChallenge } from "../../primitives/visual-primitives/math/OrdinalLine";
import { ai } from "../geminiClient";

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
  config?: Partial<OrdinalLineData>,
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
// Main Generator (public API — signature unchanged)
// ============================================================================

/**
 * Generate ordinal line data using parallel LLM calls.
 *
 * Architecture:
 *   1. Lightweight "setup" call → title, characters, context, config
 *   2. Five parallel calls (one per challenge type) with focused schemas
 *   3. Recombine into OrdinalLineData
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns OrdinalLineData with complete configuration
 */
export const generateOrdinalLine = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<OrdinalLineData>
): Promise<OrdinalLineData> => {
  // Step 1: Setup call (lightweight)
  const setup = await generateSetup(topic, gradeLevel, config);

  // Step 2: Five parallel challenge calls
  const [identify, match, relative, story, build] = await Promise.all([
    generateIdentify(setup, topic, gradeLevel),
    generateMatch(setup, topic, gradeLevel),
    generateRelative(setup, topic, gradeLevel),
    generateStory(setup, topic, gradeLevel),
    generateBuild(setup, topic, gradeLevel),
  ]);

  // Step 3: Recombine
  const data: OrdinalLineData = {
    title: setup.title,
    description: setup.description,
    challenges: [
      {
        id: 'c1',
        type: 'identify',
        characters: setup.characters,
        correctAnswer: identify.correctAnswer ?? String(identify.targetPosition),
        ...identify,
      },
      {
        id: 'c2',
        type: 'match',
        characters: setup.characters,
        correctAnswer: 'all_matched',
        ...match,
      },
      {
        id: 'c3',
        type: 'relative-position',
        characters: setup.characters,
        ...relative,
      },
      {
        id: 'c4',
        type: 'sequence-story',
        characters: setup.characters,
        correctAnswer: 'sequence_complete',
        ...story,
      },
      {
        id: 'c5',
        type: 'build-sequence',
        characters: setup.characters,
        correctAnswer: 'sequence_complete',
        ...build,
      },
    ] as OrdinalLineChallenge[],
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
