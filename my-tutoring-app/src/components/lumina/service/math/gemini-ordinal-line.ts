import { Type, Schema } from "@google/genai";
import { OrdinalLineData, OrdinalLineChallenge } from "../../primitives/visual-primitives/math/OrdinalLine";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
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
// Support Tier Harness (fixed) — second field of the two-field contract:
//   targetEvalMode = WHICH skill (task identity), difficulty = HOW MUCH support.
// ============================================================================

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * Per-challenge scaffolding flags (modality #1 perception aids + #3 CPA).
 * All are display-only — withdrawing them never changes the answer.
 * Defaults in the component preserve the no-tier render byte-for-byte, so a
 * field is only meaningful once a tier is applied.
 */
interface SupportScaffold {
  showPositionLabels: boolean; // ordinal labels under each character on the line (identify, relative)
  showSlotLabels: boolean;     // ordinal labels above the drop slots (build, story)
  highlightTarget: boolean;    // glow the reference position (relative-position)
  orderMatchSymbols: boolean;  // render the symbol column in sequence vs shuffled (match)
}

/** easy = the workspace helps the student self-check; hard = work unaided. */
function resolveSupportScaffold(type: string, tier: SupportTier): SupportScaffold {
  const easy = tier === 'easy';
  const hard = tier === 'hard';
  switch (type) {
    case 'identify':
      // perception aid = ordinal markers on the line; withdrawn at hard → count from front
      return { showPositionLabels: !hard, showSlotLabels: true, highlightTarget: true, orderMatchSymbols: false };
    case 'relative-position':
      // two aids: line markers AND the target glow; both withdrawn at hard
      return { showPositionLabels: !hard, showSlotLabels: true, highlightTarget: !hard, orderMatchSymbols: false };
    case 'match':
      // sequential symbol column at easy turns matching into reading-order; shuffled otherwise
      return { showPositionLabels: false, showSlotLabels: true, highlightTarget: true, orderMatchSymbols: easy };
    case 'build-sequence':
    case 'sequence-story':
      // slot markers tell the student which slot is "third"; withdrawn at hard → recall
      return { showPositionLabels: false, showSlotLabels: !hard, highlightTarget: true, orderMatchSymbols: false };
    default:
      return { showPositionLabels: false, showSlotLabels: true, highlightTarget: true, orderMatchSymbols: false };
  }
}

/** CPA dimension (#3): easy pairs word+symbol (most concrete), hard = symbol only. */
function resolveTierLabelFormat(
  tier: SupportTier,
  current: 'word' | 'symbol' | 'both',
): 'word' | 'symbol' | 'both' {
  if (tier === 'easy') return 'both';
  if (tier === 'hard') return 'symbol';
  return current; // medium leaves the grade-band default
}

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
// Ordinal position-window resolver (micro-LLM) — Tier-2 topic/intent fidelity
// ============================================================================
//
// The manifest does NOT emit an ordinal position window (which positions the
// lesson questions about) — that scope is pedagogy's, not the curator's. Without
// it, topic/intent only ever reached prompt PROSE, while the target positions are
// picked in CODE off [1..maxPosition]. So an intent of "positions 6th through 10th"
// still rendered questions across the whole line from 1st (the parade bug). This
// reads the lesson's OWN words and returns the ordinal window it is actually about
// ("first to fifth" → 1-5; "Meeting the Tenth Place: 6th through 10th" → 6-10).
// The grade is a CEILING (K → 5, G1 → 10). On any failure — or when the lesson is
// general ordinal practice with no explicit window — we return null and callers
// keep their grade-band defaults (no regression). Schema, not regex — see memory
// [[schema-over-regex-and-prompt]].

/** The ordinal positions the lesson QUESTIONS about (1-indexed, inclusive). The
 *  visible line is still 1..maxPosition; the window narrows only what is asked. */
type PositionWindow = { start: number; end: number };

/** Grade ceiling on ordinal magnitude — a 10th position needs a 10-long lineup. */
function gradeMaxPosition(gradeLevel: string): number {
  return gradeLevel.toLowerCase().includes('kinder') ? 5 : 10;
}

const positionWindowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hasExplicitWindow: {
      type: Type.BOOLEAN,
      description:
        "True ONLY if the topic/intent names a specific ordinal position range " +
        "(e.g. 'positions 6th through 10th', 'first to fifth', 'the tenth place'). " +
        "False for general ordinal practice with no stated range.",
    },
    startPosition: {
      type: Type.NUMBER,
      description: "First ordinal position the lesson questions about (1-indexed). 1 unless the lesson starts higher (e.g. '6th through 10th' → 6).",
    },
    endPosition: {
      type: Type.NUMBER,
      description: "Last ordinal position the lesson questions about (1-indexed), inferred from the topic/intent (e.g. 'to the fifth' → 5, 'tenth place' → 10).",
    },
  },
  required: ["hasExplicitWindow", "startPosition", "endPosition"],
};

async function resolveOrdinalPositionWindow(
  topic: string,
  intent: string | undefined,
  gradeLevel: string,
): Promise<PositionWindow | null> {
  try {
    const prompt = `An ordinal-positions lesson needs its position window inferred from what it is teaching.

TOPIC: "${topic}"
${intent ? `INTENT: "${intent}"\n` : ''}GRADE: ${gradeLevel}

Return the 1-indexed ordinal positions the student is actually QUESTIONED about in THIS lesson.
- Read the topic/intent for an explicit range: "first to fifth" → 1-5; "positions 6th through 10th" → 6-10; "Meeting the Tenth Place" → the lesson reaches the 10th, so include it.
- If the lesson is general ordinal practice with NO stated range, set hasExplicitWindow=false.
- The grade is a CEILING: never return an endPosition above ${gradeMaxPosition(gradeLevel)} for this grade.`;
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: positionWindowSchema,
      },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    if (!parsed?.hasExplicitWindow) return null;

    const gradeMax = gradeMaxPosition(gradeLevel);
    let start = Math.round(Number(parsed?.startPosition));
    let end = Math.round(Number(parsed?.endPosition));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    // Grade stays the ceiling; clamp the window into [1..gradeMax].
    start = Math.max(1, Math.min(start, gradeMax));
    end = Math.max(1, Math.min(end, gradeMax));
    if (end < start) return null;
    // A whole-line window (1..gradeMax) is not a narrowing — let grade defaults stand.
    if (start <= 1 && end >= gradeMax) return null;
    return { start, end };
  } catch (e) {
    console.warn('[OrdinalLine] position window resolution failed:', e);
    return null;
  }
}

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
  window?: PositionWindow | null,
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

  // Position window (topic/intent): the line must be long enough to contain the
  // window's last position — a "6th through 10th" lesson needs a 10-long lineup so
  // a 10th character exists. Only ever RAISES maxPosition toward the window end
  // (never shrinks the grade default); the resolver already clamped end to the
  // grade ceiling, so this can't push past what the grade allows.
  if (window) {
    data.maxPosition = Math.min(gradeMaxPosition(gradeLevel), Math.max(data.maxPosition, window.end));
  }

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

function sharedContext(setup: SetupResult, gradeLevel: string, window?: PositionWindow | null): string {
  // The line always shows 1..maxPosition; the window narrows which positions the
  // QUESTION targets (a "6th through 10th" intent must not ask about the 1st).
  const windowFocus = window
    ? `\nTHIS activity targets ordinal positions ${window.start} through ${window.end} — every question must be about a position in ${window.start}..${window.end} (the other characters stay on the line as context).`
    : '';
  return `
Context: A "${setup.context}" with these characters in order: ${characterListStr(setup)}.
Max position: ${setup.maxPosition}. Grade: ${gradeLevel}.
Use warm, encouraging language for young children. Only reference positions 1 through ${setup.maxPosition}.${windowFocus}
`;
}

async function generateIdentify(setup: SetupResult, topic: string, gradeLevel: string, window?: PositionWindow | null) {
  const lo = window ? Math.max(1, window.start) : 1;
  const hi = window ? Math.min(setup.maxPosition, window.end) : setup.maxPosition;
  const prompt = `
Create an IDENTIFY challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel, window)}

The student sees the character lineup and must tap the character at a specific ordinal position.
- Pick a position between ${lo} and ${hi}
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

  // Validate — clamp into the question window (falls back to a mid-window default).
  if (!data.targetPosition || data.targetPosition < lo || data.targetPosition > hi) {
    data.targetPosition = Math.min(Math.max(lo, Math.min(3, hi)), hi);
    data.targetOrdinalWord = ORDINAL_WORDS[data.targetPosition - 1];
    data.targetOrdinalSymbol = ORDINAL_SYMBOLS[data.targetPosition - 1];
  }
  if (!data.correctAnswer) data.correctAnswer = String(data.targetPosition);

  return data;
}

async function generateMatch(setup: SetupResult, topic: string, gradeLevel: string, window?: PositionWindow | null) {
  const pairCount = setup.gradeBand === 'K' ? '3-5' : '5-8';
  const lo = window ? Math.max(1, window.start) : 1;
  const hi = window ? Math.min(setup.maxPosition, window.end) : setup.maxPosition;
  const prompt = `
Create a MATCH challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel, window)}

The student matches ordinal words to their symbols (e.g., "first" → "1st").
- Provide ${pairCount} matchPairs
- Only use ordinals between ${lo}th and ${hi}th
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

async function generateRelative(setup: SetupResult, topic: string, gradeLevel: string, window?: PositionWindow | null) {
  // Reference position drawn from the question window; before/after neighbours may
  // fall just outside it but are real characters on the line, so the reasoning holds.
  const refLo = window ? Math.max(1, window.start) : 2;
  const refHi = window ? Math.min(setup.maxPosition, window.end) : setup.maxPosition - 1;
  const prompt = `
Create a RELATIVE-POSITION challenge for an ordinal positions activity about "${topic}".
${sharedContext(setup, gradeLevel, window)}

Ask "Who is BEFORE/AFTER the Nth character?" The student picks from multiple-choice options.
- Pick relativeQuery: "before" or "after"
- Pick a targetPosition between ${refLo} and ${refHi} (so before/after exists on the line)
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

  // Validate targetPosition is within the question window and before/after exists
  if (!data.targetPosition || data.targetPosition < refLo || data.targetPosition > refHi) {
    data.targetPosition = Math.min(Math.max(refLo, 2), refHi >= refLo ? refHi : setup.maxPosition);
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

// ---------------------------------------------------------------------------
// Structural problem difficulty (2nd axis) — in-mode, shape-not-magnitude.
// Each lever changes WHICH positions / how the parts are ordered, never the
// number range (bounded by maxPosition either way). Applied only in the
// code-built single-mode path, where positions/orderings are fully ours.
//
// resolveProblemShape(mode, tier) is the ONE source of truth: it turns a tier
// into a structural INTENT (a few enforced flags consumed by the code builders,
// plus promptLines consumed by the only LLM-in-the-loop structural mode —
// sequence-story). Every lever is a permutation / subset / count WITHIN
// maxPosition, so magnitude is fixed and no lever changes ch.type (eval mode =
// task identity). See memory [[structural-difficulty-not-numeric]].
//
// Per-mode lever (clamped to [floor, cap] from the brief):
//   identify          → target-position LOCUS: anchor {1,2,last} → unbiased →
//                       interior. NO-OP when count covers the whole line (K,
//                       maxPosition≤count) — every position appears regardless.
//   match             → NONE (matching "first"→"1st" is the same recall at any
//                       pair count; differentiation is the scaffold axis).
//   relative_position → reference LOCUS (edge-adjacent → interior) coupled with
//                       distractor similarity (farthest-first → adjacency trap).
//   sequence_story    → story DISORDER = inversion count of the story order vs.
//                       the lineup (near-sorted → high-inversion).
//   build_sequence    → CLUE COUNT (grade base → full line) + clue-list order
//                       (position-ordered → scrambled).
// ---------------------------------------------------------------------------

const TIER_GUARDRAIL =
  'This tier changes problem STRUCTURE (which positions, distractor distance, ' +
  'story inversion, clue count + order) and on-screen help — NOT magnitude. ' +
  'Every position stays within 1..maxPosition; structure changes, magnitude does not.';

/** identify: where the tapped position sits. */
type PositionLocus = 'anchor' | 'unbiased' | 'interior';
/** relative_position: where the reference sits / how the distractors cluster. */
type ReferenceLocus = 'edge' | 'unbiased' | 'interior';
type DistractorBias = 'farthest' | 'shuffled' | 'adjacent';
/** sequence_story: how scrambled the story order is vs. the lineup. */
type InversionBias = 'low' | 'random' | 'high';
/** build_sequence: how many clues, listed in what order. */
type ClueCountBias = 'min' | 'mid' | 'max';

interface ProblemShape {
  positionLocus: PositionLocus;       // identify
  referenceLocus: ReferenceLocus;     // relative_position
  distractorBias: DistractorBias;     // relative_position
  inversionBias: InversionBias;       // sequence_story
  clueCountBias: ClueCountBias;       // build_sequence
  scrambleClues: boolean;             // build_sequence clue-list order
  promptLines: string[];              // folded into the story LLM prompt
}

/**
 * ONE source of truth for the structural axis. The code builders read the
 * enforced flags; the story sub-generator folds promptLines into its prompt.
 * Called only when a tier is present (gated in the builders / main flow), so the
 * no-tier path is byte-identical.
 */
function resolveProblemShape(type: string, tier: SupportTier): ProblemShape {
  const base: ProblemShape = {
    positionLocus: 'unbiased',
    referenceLocus: 'unbiased',
    distractorBias: 'shuffled',
    inversionBias: 'random',
    clueCountBias: 'mid',
    scrambleClues: false,
    promptLines: [TIER_GUARDRAIL],
  };
  const easy = tier === 'easy';
  const hard = tier === 'hard';
  switch (type) {
    case 'identify':
      return {
        ...base,
        positionLocus: easy ? 'anchor' : hard ? 'interior' : 'unbiased',
        promptLines: [
          TIER_GUARDRAIL,
          easy
            ? 'PROBLEM: ask for anchor positions (first, second, last) — easy to land on without counting.'
            : hard
              ? 'PROBLEM: ask for deep-interior positions (not first/second/last) — the student must count forward from the front.'
              : 'PROBLEM: ask for any position across the line.',
        ],
      };
    case 'match':
      // brief: NONE — pair count is instance variance, not a difficulty shape.
      return { ...base, promptLines: [TIER_GUARDRAIL] };
    case 'relative-position':
      return {
        ...base,
        referenceLocus: easy ? 'edge' : hard ? 'interior' : 'unbiased',
        distractorBias: easy ? 'farthest' : hard ? 'adjacent' : 'shuffled',
        promptLines: [
          TIER_GUARDRAIL,
          easy
            ? 'PROBLEM: reference near an edge (few to count); distractors are the farthest characters — clearly eliminable.'
            : hard
              ? 'PROBLEM: interior reference; distractors are the answer\'s immediate neighbours — the off-by-one trap.'
              : 'PROBLEM: unbiased reference and shuffled distractors.',
        ],
      };
    case 'sequence-story':
      return {
        ...base,
        inversionBias: easy ? 'low' : hard ? 'high' : 'random',
        promptLines: [
          TIER_GUARDRAIL,
          easy
            ? 'PROBLEM: the story tracks the line front-to-back (near-sorted order) — positions read off left-to-right.'
            : hard
              ? 'PROBLEM: the story jumps around (high disorder) — position cannot be read off the lineup left-to-right.'
              : 'PROBLEM: the story uses a random distinct ordering.',
        ],
      };
    case 'build-sequence':
      return {
        ...base,
        clueCountBias: easy ? 'min' : hard ? 'max' : 'mid',
        scrambleClues: hard,
        promptLines: [
          TIER_GUARDRAIL,
          easy
            ? 'PROBLEM: fewest clues, listed in position order (readable top-to-bottom).'
            : hard
              ? 'PROBLEM: most clues (up to the full line), listed in scrambled order — can\'t be followed linearly.'
              : 'PROBLEM: a midpoint number of clues, listed in position order.',
        ],
      };
    default:
      return base;
  }
}

/** The 1-indexed positions a lesson QUESTIONS about. Without a window this is the
 *  whole visible line (1..maxPosition, byte-identical to before); with one it is the
 *  topic/intent sub-range [start..end] clamped to the line (degrades to the full
 *  line if the intersection is empty). The line itself always shows 1..maxPosition. */
function questionPositions(
  maxPosition: number,
  window: PositionWindow | null,
): number[] {
  if (!window) return Array.from({ length: maxPosition }, (_, i) => i + 1);
  const lo = Math.max(1, window.start);
  const hi = Math.min(maxPosition, window.end);
  const out: number[] = [];
  for (let p = lo; p <= hi; p++) out.push(p);
  return out.length > 0 ? out : Array.from({ length: maxPosition }, (_, i) => i + 1);
}

/** identify: easy biases anchor positions (window-start/next/last — easy to land
 *  on), hard biases interior positions (must count to them). Draws from the
 *  question window, not the whole line, so a "6th through 10th" intent never asks
 *  about the 1st. When count covers the whole window every position appears → the
 *  tier lever is a no-op (unchanged behaviour). */
function pickPositionsByTier(
  maxPosition: number,
  count: number,
  tier: SupportTier | null,
  window: PositionWindow | null,
): number[] {
  const base = questionPositions(maxPosition, window);
  const take = Math.min(count, base.length);

  if (!tier || resolveProblemShape('identify', tier).positionLocus === 'unbiased') {
    return shuffleInPlace([...base]).slice(0, take);
  }
  const locus = resolveProblemShape('identify', tier).positionLocus;

  // anchors relative to the QUESTION window (its two front positions + its last).
  const anchors = Array.from(
    new Set([base[0], base[1], base[base.length - 1]]),
  ).filter((p): p is number => p !== undefined);
  const interior = shuffleInPlace(base.filter((p) => !anchors.includes(p)));
  const ordered =
    locus === 'anchor'
      ? [...anchors, ...interior]
      : [...interior, ...shuffleInPlace([...anchors])];
  return ordered.slice(0, take);
}

/** match / build: number of parts to coordinate. easy → fewest, hard → most. */
function countByTier(min: number, max: number, tier: SupportTier | null): number {
  if (!tier) return min + Math.floor(Math.random() * (max - min + 1)); // legacy random
  if (tier === 'easy') return min;
  if (tier === 'hard') return max;
  return Math.round((min + max) / 2);
}

/** Inversions vs. natural left-to-right order — the "how scrambled" measure for
 *  build/story orderings. 0 = already sorted; rises with disorder. */
function inversionCount(positions: number[]): number {
  let inv = 0;
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++)
      if (positions[i] > positions[j]) inv++;
  return inv;
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
  tier: SupportTier | null,
  window: PositionWindow | null,
): OrdinalLineChallenge[] {
  const positions = pickPositionsByTier(setup.maxPosition, count, tier, window);
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

// NOTE: match has no structural lever — its only source of instance distinctness
// is the position SUBSET, and matching "first"→"1st" is the same recall whether
// there are 3 pairs or 5. Pair count stays random (preserves distinct instances);
// match's tier differentiation is the scaffold lever (orderMatchSymbols).
function buildMatchChallenges(
  setup: SetupResult,
  count: number,
  window: PositionWindow | null,
): OrdinalLineChallenge[] {
  // Pairs are drawn from the QUESTION window so a "6th through 10th" intent matches
  // only 6th–10th word↔symbol pairs. Pair count is capped to the window size.
  const allPositions = questionPositions(setup.maxPosition, window);
  const minPairs = Math.min(setup.gradeBand === 'K' ? 3 : 5, allPositions.length);
  const maxPairs = Math.min(setup.gradeBand === 'K' ? 5 : 8, allPositions.length);

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
  tier: SupportTier | null,
  window: PositionWindow | null,
): OrdinalLineChallenge[] {
  // The REFERENCE position ("who is before/after the Nth?") is drawn from the
  // QUESTION window; before/after neighbours may fall just outside it but are real
  // characters on the visible line, so the positional reasoning stays valid.
  const refPositions = questionPositions(setup.maxPosition, window);
  const validTuples: Array<{ pos: number; query: 'before' | 'after' }> = [];
  for (const p of refPositions) {
    if (p > 1) validTuples.push({ pos: p, query: 'before' });
    if (p < setup.maxPosition) validTuples.push({ pos: p, query: 'after' });
  }
  shuffleInPlace(validTuples);
  // structural lever (target shape): easy → reference near an edge (few to count),
  // hard → interior reference (far from both ends). Query is a minor tiebreak
  // ("after" for easy). medium → unbiased shuffle. Driven by resolveProblemShape.
  const shape = tier ? resolveProblemShape('relative-position', tier) : null;
  if (shape && shape.referenceLocus !== 'unbiased') {
    const dir = shape.referenceLocus === 'edge' ? 1 : -1;
    const score = (t: { pos: number; query: 'before' | 'after' }) =>
      Math.min(t.pos - 1, setup.maxPosition - t.pos) + (t.query === 'after' ? 0 : 0.5);
    validTuples.sort((a, b) => dir * (score(a) - score(b)));
  }
  const selected = validTuples.slice(0, Math.min(count, validTuples.length));

  return selected.map((t, i) => {
    const answerIdx = t.query === 'before' ? t.pos - 2 : t.pos;
    const correctChar = setup.characters[answerIdx];

    // Build 3-4 multiple-choice options. structural lever (distractor similarity):
    // hard → adjacency-first (the off-by-one trap; pulls in the target char and
    // the answer's neighbours), easy → farthest-first (clearly eliminable).
    const others = setup.characters
      .map((c, idx) => ({ name: c.name, idx }))
      .filter((o) => o.name !== correctChar.name);
    const distractorBias = shape?.distractorBias ?? 'shuffled';
    if (distractorBias === 'adjacent') {
      others.sort((a, b) => Math.abs(a.idx - answerIdx) - Math.abs(b.idx - answerIdx));
    } else if (distractorBias === 'farthest') {
      others.sort((a, b) => Math.abs(b.idx - answerIdx) - Math.abs(a.idx - answerIdx));
    } else {
      shuffleInPlace(others);
    }
    const distractorCount = Math.min(3, others.length);
    const options = shuffleInPlace([
      correctChar.name,
      ...others.slice(0, distractorCount).map((o) => o.name),
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
  tier: SupportTier | null,
): OrdinalLineChallenge[] {
  // structural lever: # of clues to coordinate (K base 3 / G1 base 4 → full line).
  // No-tier keeps the original fixed base count (byte-identical to before).
  // floor = the grade base clue count (never drops below it → stays a real
  // ordering task); cap = the full character set. countByTier maps the
  // clueCountBias (easy=min, medium=mid, hard=max) onto [minClues, maxClues].
  const minClues = Math.min(setup.gradeBand === 'K' ? 3 : 4, setup.characters.length);
  const maxClues = setup.characters.length;
  const shape = tier ? resolveProblemShape('build-sequence', tier) : null;
  const clueCount = tier
    ? Math.min(countByTier(minClues, maxClues, tier), setup.characters.length)
    : minClues;

  const challenges: OrdinalLineChallenge[] = [];
  const seenKeys = new Set<string>();
  let attempts = 0;

  while (challenges.length < count && attempts < count * 20) {
    attempts++;
    const shuffled = shuffleInPlace([...setup.characters]).slice(0, clueCount);
    const clues = shuffled.map((c, i) => ({ character: c.name, position: i + 1 }));
    // dedup on the ASSIGNMENT (position-ascending), independent of clue-list order
    const key = clues.map((c) => `${c.character}@${c.position}`).join('|');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    // structural lever: clue-list presentation order. easy/medium list clues in
    // position order (read top-to-bottom = front-to-back); hard scrambles the list
    // so the student can't follow it linearly. Positions/answer are unchanged.
    const displayClues = shape?.scrambleClues ? shuffleInPlace([...clues]) : clues;

    challenges.push({
      id: `c${challenges.length + 1}`,
      type: 'build-sequence' as const,
      characters: setup.characters,
      instruction: 'Place the animals in the correct order using the clues!',
      clues: displayClues,
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
  tierPromptSection = '',
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
Vary the wording — do not just say "X is first, Y is second."${tierPromptSection}
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
  tier: SupportTier | null,
): Promise<OrdinalLineChallenge[]> {
  // Generate N distinct character orderings before fanning out Gemini calls.
  // Structured-output Gemini converges per call (PRD §6a #2), so variance
  // must come from pre-randomized clues, not from prompt phrasing.
  const seenKeys = new Set<string>();
  const natural = setup.characters.map((c, i) => ({ character: c.name, position: i + 1 }));

  // structural lever: how scrambled the story order is vs. the lineup. easy favours
  // near-sorted orderings (story tracks the line), hard favours high-inversion ones.
  // Measured as inversions of each character's story-position in lineup order.
  const lineupIndex = new Map(setup.characters.map((c, i) => [c.name, i]));
  const inversionsOf = (ord: Array<{ character: string; position: number }>): number => {
    const vec = [...ord]
      .sort((a, b) => (lineupIndex.get(a.character) ?? 0) - (lineupIndex.get(b.character) ?? 0))
      .map((c) => c.position);
    return inversionCount(vec);
  };

  let orderings: Array<Array<{ character: string; position: number }>> = [];

  if (!tier) {
    // legacy path: natural first, then random distinct (byte-identical to before)
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
  } else {
    // build a larger distinct pool, then pick by inversion per tier
    const pool: Array<Array<{ character: string; position: number }>> = [natural];
    seenKeys.add(natural.map((c) => c.character).join('|'));
    let safety = 0;
    while (pool.length < count * 4 && safety < count * 60) {
      safety++;
      const shuffled = shuffleInPlace([...setup.characters]);
      const clues = shuffled.map((c, i) => ({ character: c.name, position: i + 1 }));
      const key = clues.map((c) => c.character).join('|');
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      pool.push(clues);
    }
    const inversionBias = resolveProblemShape('sequence-story', tier).inversionBias;
    if (inversionBias === 'random') {
      shuffleInPlace(pool);
    } else {
      const dir = inversionBias === 'low' ? 1 : -1;
      pool.sort((a, b) => dir * (inversionsOf(a) - inversionsOf(b)));
    }
    orderings = pool.slice(0, count);
  }

  // Fold the structural promptLines into the story prompt so the LLM authors a
  // self-consistent narrative for the (code-selected) ordering — the only
  // LLM-in-the-loop structural mode. ONE KEY (tier) → TWO PLACES (code ordering
  // selection above + this prompt). Empty when no tier (byte-identical path).
  const tierPromptSection = tier
    ? `\n\n## SUPPORT TIER "${tier}" (structure, not bigger numbers)\n${resolveProblemShape('sequence-story', tier).promptLines.map((l) => `- ${l}`).join('\n')}`
    : '';

  const stories = await Promise.all(
    orderings.map((clues) =>
      generateStoryForOrdering(setup, topic, gradeLevel, clues, tierPromptSection),
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
  tier: SupportTier | null,
  window: PositionWindow | null,
): Promise<OrdinalLineChallenge[]> {
  const count = resolveCount(singleType);
  switch (singleType) {
    case 'identify':
      return buildIdentifyChallenges(setup, count, tier, window);
    case 'match':
      return buildMatchChallenges(setup, count, window);
    case 'relative-position':
      return buildRelativeChallenges(setup, count, tier, window);
    case 'build-sequence':
      // build/story order the WHOLE visible line (1..maxPosition), so the window
      // governs line length (via setup) but not which slots are used.
      return buildBuildSequenceChallenges(setup, count, tier);
    case 'sequence-story':
      return buildStoryChallenges(setup, topic, gradeLevel, count, tier);
    default:
      return [];
  }
}

// ============================================================================
// Main Generator (public API)
// ============================================================================

type OrdinalLineConfig = {
  maxPosition?: number;
  context?: 'race' | 'parade' | 'lunch-line' | 'train' | 'bookshelf';
  showOrdinalLabels?: boolean;
  labelFormat?: 'word' | 'symbol' | 'both';
  gradeBand?: 'K' | '1';
  /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding (+ structural shape) within it.
   * NEVER changes the number range (bounded by maxPosition either way).
   */
  difficulty?: string;
};

export const generateOrdinalLine = async (
  ctx: GenerationContext,
): Promise<OrdinalLineData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as OrdinalLineConfig;
  // The per-component objective the manifest assigned to THIS activity. Context-
  // native, so it's always delivered — but this generator historically dropped it,
  // so a "positions 6th through 10th" intent still questioned from the 1st.
  const intent = ctx.intent;
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'ordinal-line',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  logEvalModeResolution('OrdinalLine', config?.targetEvalMode, evalConstraint);

  // The STUDENT's support tier — drives both the structural shape (single-mode
  // build path) and the per-challenge scaffold application (both paths).
  const supportTier = normalizeSupportTier(config?.difficulty);

  const allTypes = ['identify', 'match', 'relative-position', 'sequence-story', 'build-sequence'];
  const allowedTypes = new Set(evalConstraint?.allowedTypes ?? allTypes);

  // ── Resolve the topic/intent position window (Tier-2 fidelity) ──
  // The manifest never pins an explicit window (config.maxPosition is the legacy
  // override), so infer it from the lesson's OWN topic + intent. Gated on the
  // explicit override being absent; null on failure / general practice → the
  // grade-band default stands (no regression). Narrows WHICH positions are
  // questioned; the grade remains the ceiling on magnitude.
  let positionWindow: PositionWindow | null = null;
  if (config?.maxPosition === undefined) {
    positionWindow = await resolveOrdinalPositionWindow(topic, intent, gradeLevel);
    if (positionWindow) {
      console.log(
        `[OrdinalLine] topic-resolved position window:`, positionWindow,
        `(topic="${topic}", intent="${intent ?? ''}")`,
      );
    }
  }

  // Step 1: Setup call (always needed) — window forces the line long enough to
  // contain the window's last position (a 10th needs a 10-long lineup).
  const setup = await generateSetup(topic, gradeLevel, config, positionWindow);

  // Step 2: Build challenges.
  //
  // Single-mode (IRT-pinned to one eval mode): produce N=4 distinct instances of
  // that type via the pool-service / pre-randomized-clue builders (PRD §6a #7).
  // Multi-mode (auto / no constraint): keep the one-per-type orchestration so
  // the tester preview surfaces every challenge shape.
  let challenges: OrdinalLineChallenge[] = [];

  if (allowedTypes.size === 1) {
    const [singleType] = Array.from(allowedTypes);
    challenges = await buildSingleModeChallenges(singleType, setup, topic, gradeLevel, supportTier, positionWindow);
  } else {
    const [identify, match, relative, story, build] = await Promise.all([
      allowedTypes.has('identify') ? generateIdentify(setup, topic, gradeLevel, positionWindow) : null,
      allowedTypes.has('match') ? generateMatch(setup, topic, gradeLevel, positionWindow) : null,
      allowedTypes.has('relative-position') ? generateRelative(setup, topic, gradeLevel, positionWindow) : null,
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

  // ── Apply support tier per challenge (BOTH paths) ──
  // Difficulty is a STUDENT property, so blended/auto sessions get it too —
  // single-mode just happens to give every challenge the same scaffold. Each
  // challenge resolves its scaffold from its OWN mode (ch.type). Display-only:
  // these flags withdraw on-screen help, never touch correctAnswer.
  let effectiveLabelFormat = setup.labelFormat;
  if (supportTier) {
    effectiveLabelFormat = resolveTierLabelFormat(supportTier, setup.labelFormat);
    for (const ch of challenges) {
      const sc = resolveSupportScaffold(ch.type, supportTier);
      ch.supportTier = supportTier;
      ch.showPositionLabels = sc.showPositionLabels;
      ch.showSlotLabels = sc.showSlotLabels;
      ch.highlightTarget = sc.highlightTarget;
      ch.orderMatchSymbols = sc.orderMatchSymbols;
    }
    console.log(
      `[OrdinalLine] Support tier "${supportTier}" applied per-challenge `
      + `(${allowedTypes.size === 1 ? `single-mode ${Array.from(allowedTypes)[0]}` : 'blended'}, labelFormat=${effectiveLabelFormat})`,
    );
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
    labelFormat: effectiveLabelFormat,
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
