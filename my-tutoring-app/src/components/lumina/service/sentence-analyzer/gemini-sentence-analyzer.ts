/**
 * Sentence Analyzer Generator — Gemini content generator for interactive
 * sentence grammar analysis with 4 challenge types.
 *
 * Uses flat-field schema to avoid malformed LLM JSON for arrays, then
 * reconstructs typed arrays in post-validation.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  SentenceAnalyzerData,
  SentenceAnalyzerChallenge,
  SentenceWord,
} from '../../primitives/visual-primitives/literacy/SentenceAnalyzer';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation (used by eval mode system)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_pos: {
    promptDoc: `"identify_pos": A specific word in the sentence is highlighted. The student must identify its part of speech from 4 multiple-choice options. Foundational skill — grades 2-4.`,
    schemaDescription: "'identify_pos' (identify part of speech of a highlighted word)",
  },
  identify_role: {
    promptDoc: `"identify_role": A specific word in the sentence is highlighted. The student must identify its grammatical role (Subject, Predicate, Direct Object, etc.) from 4 multiple-choice options. Grades 3-6.`,
    schemaDescription: "'identify_role' (identify grammatical role of a highlighted word)",
  },
  label_all: {
    promptDoc: `"label_all": The student must label the part of speech for EVERY word in the sentence. No multiple-choice — they select from the set of POS tags used in the sentence. Most demanding recall task — grades 4-7.`,
    schemaDescription: "'label_all' (label part of speech of every word)",
  },
  parse_structure: {
    promptDoc: `"parse_structure": Two-step challenge. Step 1: group each word as Subject or Predicate. Step 2: classify the sentence type (Declarative, Interrogative, Imperative, Exclamatory) from 4 options. Grades 4-8.`,
    schemaDescription: "'parse_structure' (group words into subject/predicate, classify sentence type)",
  },
};

// ---------------------------------------------------------------------------
// Flat Gemini schema — max 8 words per sentence, flat option fields
// ---------------------------------------------------------------------------

const sentenceAnalyzerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging title for the sentence analysis activity',
    },
    description: {
      type: Type.STRING,
      description: 'Brief description of the activity',
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level ('2' through '8')",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'ch1', 'ch2')",
          },
          type: {
            type: Type.STRING,
            enum: ['identify_pos', 'identify_role', 'label_all', 'parse_structure'],
            description:
              "Challenge type: 'identify_pos', 'identify_role', 'label_all', or 'parse_structure'",
          },
          sentence: {
            type: Type.STRING,
            description: 'The full sentence text',
          },
          // --- Flat word fields (max 8 words) ---
          wordCount: {
            type: Type.NUMBER,
            description: 'Number of words in the sentence (1-8)',
          },
          word0Text: { type: Type.STRING, description: 'Word 0 text' },
          word0Pos: { type: Type.STRING, description: 'Word 0 part of speech (Noun, Verb, Adjective, Adverb, Pronoun, Preposition, Conjunction, Determiner, Interjection)' },
          word0Role: { type: Type.STRING, description: 'Word 0 grammatical role (Subject, Predicate, Direct Object, Indirect Object, Object of Preposition, Modifier, Conjunction, Determiner)' },
          word1Text: { type: Type.STRING, description: 'Word 1 text' },
          word1Pos: { type: Type.STRING, description: 'Word 1 part of speech' },
          word1Role: { type: Type.STRING, description: 'Word 1 grammatical role' },
          word2Text: { type: Type.STRING, description: 'Word 2 text' },
          word2Pos: { type: Type.STRING, description: 'Word 2 part of speech' },
          word2Role: { type: Type.STRING, description: 'Word 2 grammatical role' },
          word3Text: { type: Type.STRING, description: 'Word 3 text' },
          word3Pos: { type: Type.STRING, description: 'Word 3 part of speech' },
          word3Role: { type: Type.STRING, description: 'Word 3 grammatical role' },
          word4Text: { type: Type.STRING, description: 'Word 4 text' },
          word4Pos: { type: Type.STRING, description: 'Word 4 part of speech' },
          word4Role: { type: Type.STRING, description: 'Word 4 grammatical role' },
          word5Text: { type: Type.STRING, description: 'Word 5 text' },
          word5Pos: { type: Type.STRING, description: 'Word 5 part of speech' },
          word5Role: { type: Type.STRING, description: 'Word 5 grammatical role' },
          word6Text: { type: Type.STRING, description: 'Word 6 text' },
          word6Pos: { type: Type.STRING, description: 'Word 6 part of speech' },
          word6Role: { type: Type.STRING, description: 'Word 6 grammatical role' },
          word7Text: { type: Type.STRING, description: 'Word 7 text' },
          word7Pos: { type: Type.STRING, description: 'Word 7 part of speech' },
          word7Role: { type: Type.STRING, description: 'Word 7 grammatical role' },

          // --- identify_pos / identify_role: target word ---
          targetWordIndex: {
            type: Type.NUMBER,
            description: 'Index (0-based) of the target word for identify_pos / identify_role challenges. Not used for label_all or parse_structure.',
          },

          // --- identify_pos options (flat) ---
          posOption0: { type: Type.STRING, description: 'POS option 0 (for identify_pos)' },
          posOption1: { type: Type.STRING, description: 'POS option 1 (for identify_pos)' },
          posOption2: { type: Type.STRING, description: 'POS option 2 (for identify_pos)' },
          posOption3: { type: Type.STRING, description: 'POS option 3 (for identify_pos)' },
          correctPos: {
            type: Type.STRING,
            description: 'Correct part of speech answer (for identify_pos). Must exactly match one of posOption0-3.',
          },

          // --- identify_role options (flat) ---
          roleOption0: { type: Type.STRING, description: 'Role option 0 (for identify_role)' },
          roleOption1: { type: Type.STRING, description: 'Role option 1 (for identify_role)' },
          roleOption2: { type: Type.STRING, description: 'Role option 2 (for identify_role)' },
          roleOption3: { type: Type.STRING, description: 'Role option 3 (for identify_role)' },
          correctRole: {
            type: Type.STRING,
            description: 'Correct grammatical role answer (for identify_role). Must exactly match one of roleOption0-3.',
          },

          // --- parse_structure fields (flat) ---
          sentenceType: {
            type: Type.STRING,
            description: 'Sentence type classification (for parse_structure): Declarative, Interrogative, Imperative, or Exclamatory',
          },
          sentenceTypeOption0: { type: Type.STRING, description: 'Sentence type option 0 (for parse_structure)' },
          sentenceTypeOption1: { type: Type.STRING, description: 'Sentence type option 1 (for parse_structure)' },
          sentenceTypeOption2: { type: Type.STRING, description: 'Sentence type option 2 (for parse_structure)' },
          sentenceTypeOption3: { type: Type.STRING, description: 'Sentence type option 3 (for parse_structure)' },

          // --- explanation (all types) ---
          explanation: {
            type: Type.STRING,
            description: 'Explanation shown after the student answers. Explain WHY the answer is correct.',
          },
        },
        required: [
          'id', 'type', 'sentence', 'wordCount',
          'word0Text', 'word0Pos', 'word0Role',
          'explanation',
        ],
      },
      description: 'Array of 4-6 grammar challenges',
    },
  },
  required: ['title', 'description', 'gradeLevel', 'challenges'],
};

// ---------------------------------------------------------------------------
// Flat → structured reconstruction helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  id: string;
  type: string;
  sentence: string;
  wordCount: number;
  explanation: string;
  targetWordIndex?: number;
  correctPos?: string;
  correctRole?: string;
  sentenceType?: string;
  [key: string]: unknown;
}

function reconstructWords(flat: FlatChallenge): SentenceWord[] {
  const words: SentenceWord[] = [];
  const count = Math.min(Math.max(flat.wordCount || 1, 1), 8);
  for (let i = 0; i < count; i++) {
    const text = flat[`word${i}Text`] as string | undefined;
    const pos = flat[`word${i}Pos`] as string | undefined;
    const role = flat[`word${i}Role`] as string | undefined;
    if (text) {
      words.push({
        id: `w${i}`,
        text,
        partOfSpeech: pos || 'Unknown',
        grammaticalRole: role || 'Unknown',
      });
    }
  }
  return words;
}

function reconstructOptions(flat: FlatChallenge, prefix: string): string[] {
  const opts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const val = flat[`${prefix}${i}`] as string | undefined;
    if (val) opts.push(val);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Post-validation: ensure each challenge has all required fields for its type
// ---------------------------------------------------------------------------

function validateChallenge(
  flat: FlatChallenge,
): SentenceAnalyzerChallenge | null {
  const words = reconstructWords(flat);
  if (words.length === 0) return null;

  const base = {
    id: flat.id,
    type: flat.type as SentenceAnalyzerChallenge['type'],
    sentence: flat.sentence,
    words,
    explanation: flat.explanation || 'No explanation provided.',
  };

  switch (flat.type) {
    case 'identify_pos': {
      const posOptions = reconstructOptions(flat, 'posOption');
      const targetIdx = flat.targetWordIndex ?? 0;
      const correctPos = flat.correctPos;
      if (posOptions.length < 2 || !correctPos) return null;
      // Ensure correctPos is in the options list
      if (!posOptions.includes(correctPos)) {
        posOptions[posOptions.length - 1] = correctPos;
      }
      // Pad to 4 options if needed
      while (posOptions.length < 4) posOptions.push('Other');
      // Clamp targetWordIndex
      const safeIdx = Math.min(Math.max(targetIdx, 0), words.length - 1);
      return {
        ...base,
        targetWordIndex: safeIdx,
        posOptions,
        correctPos,
      };
    }

    case 'identify_role': {
      const roleOptions = reconstructOptions(flat, 'roleOption');
      const targetIdx = flat.targetWordIndex ?? 0;
      const correctRole = flat.correctRole;
      if (roleOptions.length < 2 || !correctRole) return null;
      if (!roleOptions.includes(correctRole)) {
        roleOptions[roleOptions.length - 1] = correctRole;
      }
      while (roleOptions.length < 4) roleOptions.push('Other');
      const safeIdx = Math.min(Math.max(targetIdx, 0), words.length - 1);
      return {
        ...base,
        targetWordIndex: safeIdx,
        roleOptions,
        correctRole,
      };
    }

    case 'label_all': {
      // All words need accurate POS — already in words[].partOfSpeech
      // Reject if any word has Unknown POS (Gemini failed)
      if (words.some(w => w.partOfSpeech === 'Unknown')) return null;
      return base;
    }

    case 'parse_structure': {
      const stOptions = reconstructOptions(flat, 'sentenceTypeOption');
      const sentenceType = flat.sentenceType;
      if (!sentenceType || stOptions.length < 2) return null;
      if (!stOptions.includes(sentenceType)) {
        stOptions[stOptions.length - 1] = sentenceType;
      }
      while (stOptions.length < 4) stOptions.push('Other');
      // Reject if any word has Unknown role (needed for subject/predicate grouping)
      if (words.some(w => w.grammaticalRole === 'Unknown')) return null;
      return {
        ...base,
        sentenceType,
        sentenceTypeOptions: stOptions,
      };
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate Sentence Analyzer content using Gemini.
 *
 * Creates 4-6 grammar analysis challenges across 4 challenge types.
 * Uses flat-field schema to avoid LLM JSON malformation, then reconstructs
 * and validates each challenge before returning.
 */
export const generateSentenceAnalyzer = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    title?: string;
    targetEvalMode?: string;
  },
): Promise<SentenceAnalyzerData> => {
  // --- Eval mode constraint ---
  const evalConstraint = resolveEvalModeConstraint(
    'sentence-analyzer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        sentenceAnalyzerSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : sentenceAnalyzerSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // --- Grade-level prompt context ---
  const gradeGuidelines: Record<string, string> = {
    '2': `GRADE 2: Simple 3-5 word sentences. Common POS: Noun, Verb, Adjective, Determiner. Roles: Subject, Predicate. Only identify_pos and label_all types. Use familiar vocabulary (cat, run, big).`,
    '3': `GRADE 3: 4-6 word sentences. Add Adverb, Pronoun. Roles: Subject, Predicate, Modifier. All types except parse_structure. Use grade-appropriate vocab.`,
    '4': `GRADE 4: 5-7 word sentences. Full POS set. All 4 challenge types. Introduce compound subjects and predicates. Direct Objects appear.`,
    '5': `GRADE 5: 5-7 word sentences. Include Preposition, Conjunction. All roles including Object of Preposition. All 4 challenge types with harder sentences.`,
    '6': `GRADE 6: 5-8 word sentences. Complex grammar: compound-complex structures, prepositional phrases, varied sentence types. All challenge types.`,
    '7': `GRADE 7: 6-8 word sentences. Advanced grammar: participial phrases, indirect objects, appositives. All challenge types with nuanced analysis.`,
    '8': `GRADE 8: 6-8 word sentences. Sophisticated structures: subordinate clauses (treated as single words where appropriate), advanced roles. All challenge types.`,
  };

  // Extract numeric grade from gradeContext string
  const gradeMatch = gradeContext.match(/(\d)/);
  const gradeKey = gradeMatch ? gradeMatch[1] : '4';
  const safeGradeKey = Object.keys(gradeGuidelines).includes(gradeKey) ? gradeKey : '4';

  const prompt = `Create a sentence grammar analysis activity about: "${topic}".

TARGET GRADE LEVEL: ${safeGradeKey}
${gradeGuidelines[safeGradeKey]}

${challengeTypeSection}

PURPOSE: ${config?.intent || 'Practice identifying parts of speech and grammatical roles'}

INSTRUCTIONS:
Generate 4-6 challenges. Each challenge has ONE sentence broken into individual words (max 8 words per sentence).

For EACH challenge provide:
- id: Unique ID (ch1, ch2, etc.)
- type: One of the challenge types listed above
- sentence: The complete sentence as a single string
- wordCount: Number of words (1-8). Count each word separately — "The cat sat" = 3 words
- word0Text through word{N-1}Text: Each word's text (include punctuation attached to the word, e.g., "ran." for the last word)
- word0Pos through word{N-1}Pos: Part of speech for each word. Use EXACTLY these labels: Noun, Verb, Adjective, Adverb, Pronoun, Preposition, Conjunction, Determiner, Interjection
- word0Role through word{N-1}Role: Grammatical role for each word. Use EXACTLY these labels: Subject, Predicate, Direct Object, Indirect Object, Object of Preposition, Modifier, Conjunction, Determiner
- explanation: WHY the answer is correct (2-3 sentences, student-friendly)

TYPE-SPECIFIC FIELDS:
- identify_pos: Set targetWordIndex (0-based index of the target word), posOption0-3 (4 POS choices, 1 correct + 3 plausible distractors), correctPos (must exactly match one option)
- identify_role: Set targetWordIndex, roleOption0-3 (4 role choices), correctRole (must exactly match one option)
- label_all: No extra fields needed — the word POS labels ARE the answer key
- parse_structure: Set sentenceType (Declarative/Interrogative/Imperative/Exclamatory), sentenceTypeOption0-3 (always include all 4 sentence types as options)

CRITICAL RULES:
- Every word MUST have accurate POS and grammatical role labels
- For identify_pos: correctPos MUST match the actual POS of words[targetWordIndex]
- For identify_role: correctRole MUST match the actual role of words[targetWordIndex]
- Distractors must be plausible but clearly wrong (e.g., for a Verb target, include Noun, Adjective, Adverb as distractors)
- Do NOT include the period/punctuation as a separate word — attach it to the last word
- Sentences should be topically relevant to "${topic}"
${!evalConstraint ? '- Vary challenge types across the set — include at least 2 different types\n' : ''}
EXAMPLE (identify_pos):
{
  "id": "ch1",
  "type": "identify_pos",
  "sentence": "The clever fox jumped quickly.",
  "wordCount": 5,
  "word0Text": "The", "word0Pos": "Determiner", "word0Role": "Determiner",
  "word1Text": "clever", "word1Pos": "Adjective", "word1Role": "Modifier",
  "word2Text": "fox", "word2Pos": "Noun", "word2Role": "Subject",
  "word3Text": "jumped", "word3Pos": "Verb", "word3Role": "Predicate",
  "word4Text": "quickly.", "word4Pos": "Adverb", "word4Role": "Modifier",
  "targetWordIndex": 1,
  "posOption0": "Adjective", "posOption1": "Noun", "posOption2": "Verb", "posOption3": "Adverb",
  "correctPos": "Adjective",
  "explanation": "The word 'clever' is an Adjective because it describes the noun 'fox'. Adjectives tell us more about nouns — what kind, which one, or how many."
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
        systemInstruction:
          'You are an expert K-8 grammar and language arts specialist. You create precise, pedagogically sound sentence analysis exercises. Every POS and grammatical role label must be linguistically accurate. You choose grade-appropriate sentences that clearly demonstrate the targeted grammar concepts.',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No data returned from Gemini API');
    }

    const raw = JSON.parse(text) as {
      title: string;
      description: string;
      gradeLevel: string;
      challenges: FlatChallenge[];
    };

    // --- Reconstruct and validate challenges ---
    const validChallenges: SentenceAnalyzerChallenge[] = [];
    for (const flat of raw.challenges ?? []) {
      const challenge = validateChallenge(flat);
      if (challenge) {
        validChallenges.push(challenge);
      } else {
        console.warn(`[SentenceAnalyzer] Rejected invalid challenge: ${flat.id} (type=${flat.type})`);
      }
    }

    // Fallback: if all challenges were rejected, throw so caller can retry
    if (validChallenges.length === 0) {
      throw new Error('All generated challenges failed validation — no usable content');
    }

    const result: SentenceAnalyzerData = {
      title: config?.title || raw.title || 'Sentence Analysis',
      description: raw.description || 'Analyze sentence structure and grammar.',
      gradeLevel: raw.gradeLevel || safeGradeKey,
      challenges: validChallenges,
    };

    logEvalModeResolution('SentenceAnalyzer', config?.targetEvalMode, evalConstraint);

    console.log('Sentence Analyzer Generated:', {
      title: result.title,
      gradeLevel: result.gradeLevel,
      challengeCount: validChallenges.length,
      types: validChallenges.map(c => c.type),
      rejected: (raw.challenges?.length ?? 0) - validChallenges.length,
    });

    return result;
  } catch (error) {
    console.error('Error generating sentence analyzer:', error);
    throw error;
  }
};
