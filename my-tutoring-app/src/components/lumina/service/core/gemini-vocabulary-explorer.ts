/**
 * Vocabulary Explorer Generator - Topic-specific vocabulary explorer with
 * rich contextual definitions, example sentences, word origins, related words,
 * pronunciation guides, and comprehension challenges.
 *
 * Uses a FLAT Gemini schema to avoid malformed nested JSON.
 * Supports eval modes with match, fill_blank, context, identify challenge types.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { VocabularyExplorerData } from '../../primitives/visual-primitives/core/VocabularyExplorer';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  match: {
    promptDoc:
      `"match": Match terms to their definitions. `
      + `Student connects term-definition pairs. Provide 3-4 pairs.`,
    schemaDescription: "'match' (match terms to definitions)",
  },
  fill_blank: {
    promptDoc:
      `"fill_blank": Fill in the blank with the correct vocabulary word. `
      + `Provide a sentence with a blank and 4 options. Student picks the correct word.`,
    schemaDescription: "'fill_blank' (fill in the blank with correct word)",
  },
  context: {
    promptDoc:
      `"context": Identify correct usage in a new context/sentence. `
      + `Provide a sentence and 4 options. Student picks the option that best fits.`,
    schemaDescription: "'context' (identify correct usage in context)",
  },
  identify: {
    promptDoc:
      `"identify": Pick the correct definition from distractors. `
      + `Provide 4 possible definitions. Student picks the right one.`,
    schemaDescription: "'identify' (pick correct definition from distractors)",
  },
};

// ---------------------------------------------------------------------------
// Grade-Level Context Helper
// ---------------------------------------------------------------------------

const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'Toddler': 'toddlers (ages 1-3) — very simple concepts, concrete examples.',
    'Preschool': 'preschool children (ages 3-5) — simple sentences, colorful examples.',
    'Kindergarten': 'kindergarten students (ages 5-6) — clear language, foundational concepts.',
    'Elementary': 'elementary students (grades 1-5) — age-appropriate vocabulary, concrete examples.',
    'Middle School': 'middle school students (grades 6-8) — more complex vocabulary, real-world applications.',
    'High School': 'high school students (grades 9-12) — advanced vocabulary, sophisticated concepts.',
  };
  return contexts[gradeLevel] || contexts['Elementary'];
};

// ---------------------------------------------------------------------------
// Flat Gemini Schema
// ---------------------------------------------------------------------------

const termSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique term ID (e.g. 'term1', 'term2')" },
    word: { type: Type.STRING, description: "The vocabulary word" },
    pronunciation: { type: Type.STRING, description: "Phonetic pronunciation (e.g. 'foh-toh-SIN-thuh-sis')" },
    partOfSpeech: { type: Type.STRING, description: "Part of speech (noun, verb, adjective, etc.)" },
    definition: { type: Type.STRING, description: "Grade-appropriate definition (1-2 sentences)" },
    exampleSentence: { type: Type.STRING, description: "Example sentence using the word in topic context" },
    relatedWord0: { type: Type.STRING, description: "First related word" },
    relatedWord1: { type: Type.STRING, description: "Second related word" },
    relatedWord2: { type: Type.STRING, description: "Third related word" },
    wordOrigin: { type: Type.STRING, description: "Optional: origin/etymology of the word" },
    imagePrompt: { type: Type.STRING, description: "Optional: prompt for AI image generation" },
  },
  required: ["id", "word", "partOfSpeech", "definition", "exampleSentence", "relatedWord0", "relatedWord1", "relatedWord2"],
};

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["match", "fill_blank", "context", "identify"],
      description: "Challenge type",
    },
    question: { type: Type.STRING, description: "The challenge question or instruction" },
    // For match challenges (up to 4 pairs)
    matchTerm0: { type: Type.STRING, description: "First match term (for match type)" },
    matchDef0: { type: Type.STRING, description: "First match definition (for match type)" },
    matchTerm1: { type: Type.STRING, description: "Second match term (for match type)" },
    matchDef1: { type: Type.STRING, description: "Second match definition (for match type)" },
    matchTerm2: { type: Type.STRING, description: "Third match term (for match type)" },
    matchDef2: { type: Type.STRING, description: "Third match definition (for match type)" },
    matchTerm3: { type: Type.STRING, description: "Fourth match term (for match type)" },
    matchDef3: { type: Type.STRING, description: "Fourth match definition (for match type)" },
    // For fill_blank / context / identify (multiple choice)
    sentence: { type: Type.STRING, description: "Sentence with blank (for fill_blank)" },
    option0: { type: Type.STRING, description: "First answer option" },
    option1: { type: Type.STRING, description: "Second answer option" },
    option2: { type: Type.STRING, description: "Third answer option" },
    option3: { type: Type.STRING, description: "Fourth answer option" },
    correctAnswer: { type: Type.STRING, description: "The EXACT text of the correct option — copy one of option0-option3 verbatim" },
    correctIndex: { type: Type.NUMBER, description: "Backup: index (0-3) of the correct option" },
    // Common
    explanation: { type: Type.STRING, description: "Explanation shown after answering (1-2 sentences)" },
    relatedTermId: { type: Type.STRING, description: "Term ID this challenge relates to" },
  },
  required: ["type", "question", "explanation", "relatedTermId"],
};

const vocabularyExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the vocabulary explorer (e.g. 'Ocean Vocabulary')" },
    topic: { type: Type.STRING, description: "The topic these words relate to" },
    introduction: { type: Type.STRING, description: "1-2 sentence introduction to the vocabulary set" },
    terms: {
      type: Type.ARRAY,
      items: termSchema,
      description: "5-8 vocabulary terms with definitions and examples",
    },
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "3-4 comprehension challenges testing vocabulary knowledge",
    },
  },
  required: ["title", "topic", "introduction", "terms", "challenges"],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

type VocabChallenge = NonNullable<VocabularyExplorerData['challenges']>[number];
type VocabTerm = VocabularyExplorerData['terms'][number];

/** Fisher-Yates shuffle (new array). */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * VE-3: Build a real, answerable multiple-choice challenge from the generated
 * terms. Used when Gemini drops the flat option0-3 fields (SP-14) or when we
 * need to pad to the 3-challenge minimum — instead of emitting unanswerable
 * "Option A-D" placeholders. `type` is honored so the fallback never violates
 * the eval-mode's challenge-type constraint. Correct by construction: options
 * are real term data and correctIndex is derived, not trusted.
 */
function buildMcChallengeFromTerms(
  terms: VocabTerm[],
  used: Set<string>,
  type: 'fill_blank' | 'context' | 'identify' = 'identify',
): VocabChallenge {
  const term = terms.find(t => !used.has(t.id)) || terms[0];
  used.add(term.id);

  if (type === 'identify') {
    // options ARE definitions; pick the one that defines the word.
    const correct = term.definition || `The meaning of "${term.word}"`;
    const distractors = terms
      .filter(t => t.id !== term.id && t.definition && t.definition !== correct)
      .slice(0, 3)
      .map(t => t.definition);
    const options = shuffle([correct, ...distractors]);
    while (options.length < 4) options.push(`Unrelated to "${term.word}"`);
    return {
      type: 'identify',
      question: `Which definition best describes "${term.word}"?`,
      options: options.slice(0, 4),
      correctIndex: Math.max(0, options.indexOf(correct)),
      explanation: `"${term.word}" means: ${term.definition}`,
      relatedTermId: term.id,
    };
  }

  // fill_blank / context: options ARE words; pick the one matching the meaning.
  const correct = term.word;
  const distractors = terms
    .filter(t => t.id !== term.id && t.word && t.word !== correct)
    .slice(0, 3)
    .map(t => t.word);
  const options = shuffle([correct, ...distractors]);
  while (options.length < 4) options.push(`(not ${correct})`);
  const correctIndex = Math.max(0, options.indexOf(correct));
  const explanation = `The word "${term.word}" means: ${term.definition}`;

  if (type === 'fill_blank') {
    const wordRe = new RegExp(term.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const sentence = term.exampleSentence && wordRe.test(term.exampleSentence)
      ? term.exampleSentence.replace(wordRe, '_____')
      : `Fill in the blank: a word meaning "${term.definition}" is _____.`;
    return {
      type: 'fill_blank',
      question: 'Choose the word that best completes the sentence.',
      sentence,
      options: options.slice(0, 4),
      correctIndex,
      explanation,
      relatedTermId: term.id,
    };
  }

  return {
    type: 'context',
    question: `Which word means: "${term.definition}"?`,
    options: options.slice(0, 4),
    correctIndex,
    explanation,
    relatedTermId: term.id,
  };
}

/**
 * VE-3: Build a real `match` challenge from the generated terms (term ↔ definition).
 * Used to pad match-constrained modes so the fallback can't drift to a wrong type.
 */
function buildMatchChallengeFromTerms(terms: VocabTerm[], used: Set<string>): VocabChallenge {
  const picks: VocabTerm[] = [];
  for (const t of terms) {
    if (picks.length >= 3) break;
    if (!used.has(t.id)) { picks.push(t); used.add(t.id); }
  }
  // If we ran out of unused terms, top up from the front (allow reuse).
  for (let i = 0; picks.length < 3 && i < terms.length; i++) {
    if (!picks.includes(terms[i])) picks.push(terms[i]);
  }
  return {
    type: 'match',
    question: 'Match each term to its definition.',
    matchPairs: picks.map(t => ({ term: t.word, definition: t.definition })),
    explanation: 'Each term pairs with the definition that states its meaning.',
    relatedTermId: picks[0]?.id || 'term1',
  };
}

function validateVocabularyExplorerData(raw: any, allowedTypes?: string[]): VocabularyExplorerData {
  const title = raw.title || 'Vocabulary Explorer';
  const topic = raw.topic || '';
  const introduction = raw.introduction || '';

  // --- Terms (5-8) ---
  let terms: VocabularyExplorerData['terms'] = [];
  if (Array.isArray(raw.terms)) {
    terms = raw.terms.slice(0, 8).map((t: any, i: number) => {
      // Reconstruct relatedWords from flat fields
      const relatedWords: string[] = [];
      if (t.relatedWord0) relatedWords.push(String(t.relatedWord0));
      else if (t.relatedWords?.[0]) relatedWords.push(String(t.relatedWords[0]));
      if (t.relatedWord1) relatedWords.push(String(t.relatedWord1));
      else if (t.relatedWords?.[1]) relatedWords.push(String(t.relatedWords[1]));
      if (t.relatedWord2) relatedWords.push(String(t.relatedWord2));
      else if (t.relatedWords?.[2]) relatedWords.push(String(t.relatedWords[2]));

      return {
        id: String(t.id || `term${i + 1}`),
        word: String(t.word || `Word ${i + 1}`),
        pronunciation: t.pronunciation || undefined,
        partOfSpeech: String(t.partOfSpeech || 'noun'),
        definition: String(t.definition || ''),
        exampleSentence: String(t.exampleSentence || ''),
        relatedWords: relatedWords.length > 0 ? relatedWords : ['related'],
        wordOrigin: t.wordOrigin || undefined,
        imagePrompt: t.imagePrompt || undefined,
      };
    });
  }
  // Pad to minimum 5 terms
  while (terms.length < 5) {
    terms.push({
      id: `term${terms.length + 1}`,
      word: `Word ${terms.length + 1}`,
      partOfSpeech: 'noun',
      definition: 'Definition coming soon.',
      exampleSentence: 'Example coming soon.',
      relatedWords: ['related'],
    });
  }

  // --- Challenges (3-4) ---
  // Tracks term IDs consumed by derived/padded identify challenges so we don't
  // repeat the same word (VE-3 fallback + min-3 padding).
  const usedDerived = new Set<string>();
  let challenges: NonNullable<VocabularyExplorerData['challenges']> = [];
  if (Array.isArray(raw.challenges)) {
    challenges = raw.challenges.slice(0, 4).map((c: any) => {
      const validTypes = ['match', 'fill_blank', 'context', 'identify'];
      const type = validTypes.includes(c.type) ? c.type : 'identify';

      const base = {
        type: type as 'match' | 'fill_blank' | 'context' | 'identify',
        question: String(c.question || 'Question'),
        explanation: String(c.explanation || ''),
        relatedTermId: String(c.relatedTermId || 'term1'),
      };

      if (type === 'match') {
        // Reconstruct matchPairs from flat fields
        const matchPairs: Array<{ term: string; definition: string }> = [];
        for (let i = 0; i < 4; i++) {
          const term = c[`matchTerm${i}`] || c.matchPairs?.[i]?.term;
          const def = c[`matchDef${i}`] || c.matchPairs?.[i]?.definition;
          if (term && def) {
            matchPairs.push({ term: String(term), definition: String(def) });
          }
        }
        if (matchPairs.length < 3) {
          // Fill to minimum 3 pairs from terms if possible
          while (matchPairs.length < 3) {
            const idx = matchPairs.length;
            if (terms[idx]) {
              matchPairs.push({ term: terms[idx].word, definition: terms[idx].definition });
            } else {
              matchPairs.push({ term: `Term ${idx + 1}`, definition: `Definition ${idx + 1}` });
            }
          }
        }
        return { ...base, matchPairs };
      } else {
        // fill_blank, context, identify — reconstruct options from flat fields
        const options = [
          c.option0 ?? c.options?.[0],
          c.option1 ?? c.options?.[1],
          c.option2 ?? c.options?.[2],
          c.option3 ?? c.options?.[3],
        ].map((o: any) => (o == null ? '' : String(o).trim()));

        // VE-3 (SP-14): Flash Lite drops the flat option fields → no real options.
        // Don't ship "Option A-D" placeholders; derive a real challenge from terms.
        if (!options.every(o => o.length > 0)) {
          console.warn('[VocabularyExplorer] Challenge missing real options — deriving from terms (VE-3)');
          return buildMcChallengeFromTerms(terms, usedDerived, type as 'fill_blank' | 'context' | 'identify');
        }

        // VE-1: derive correctIndex from the answer TEXT, not the positional index
        // (Gemini's correctIndex is wrong in the majority of generations — it anchors
        // to 0). Mirrors knowledge-check's correctOptionId pattern.
        const correctAnswer = c.correctAnswer != null ? String(c.correctAnswer).trim() : '';
        let correctIndex = correctAnswer
          ? options.findIndex(o => o.toLowerCase() === correctAnswer.toLowerCase())
          : -1;
        if (correctIndex < 0) {
          // Last resort only: trust the LLM's positional index (clamped).
          correctIndex = typeof c.correctIndex === 'number' ? c.correctIndex : 0;
          if (correctIndex < 0 || correctIndex > 3) correctIndex = 0;
        }

        return {
          ...base,
          options,
          correctIndex,
          sentence: type === 'fill_blank' ? (c.sentence || undefined) : undefined,
        };
      }
    });
  }
  // Pad to minimum 3 challenges with REAL term-derived challenges (never placeholders),
  // honoring the eval-mode's allowed challenge type so padding can't drift off-type.
  const padType = (allowedTypes && allowedTypes.length ? allowedTypes[0] : 'identify') as
    'match' | 'fill_blank' | 'context' | 'identify';
  while (challenges.length < 3) {
    challenges.push(
      padType === 'match'
        ? buildMatchChallengeFromTerms(terms, usedDerived)
        : buildMcChallengeFromTerms(terms, usedDerived, padType),
    );
  }

  return {
    title,
    topic,
    introduction,
    terms,
    challenges,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type VocabularyExplorerConfig = Partial<{ targetEvalMode?: string }>;

/**
 * Generate a VocabularyExplorer with topic-specific vocabulary terms and challenges.
 */
export const generateVocabularyExplorer = async (
  ctx: GenerationContext,
): Promise<VocabularyExplorerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as VocabularyExplorerConfig;
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'vocabulary-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        vocabularyExplorerSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { arrayName: 'challenges', fieldName: 'type' },
      )
    : vocabularyExplorerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `You are a vocabulary curriculum expert creating an engaging Vocabulary Explorer.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}

## Your Mission:
Create a rich vocabulary explorer about "${topic}" with 5-8 key terms, contextual definitions,
example sentences, pronunciation guides, related words, and comprehension challenges.

${challengeTypeSection}

## Content Guidelines:

### Terms (5-8 items)
- Choose vocabulary words central to the topic "${topic}"
- Each term needs:
  - word: the vocabulary word
  - pronunciation: phonetic spelling (e.g. "foh-toh-SIN-thuh-sis")
  - partOfSpeech: noun, verb, adjective, adverb, etc.
  - definition: grade-appropriate definition (1-2 sentences)
  - exampleSentence: a sentence using the word naturally in the topic context
  - relatedWord0, relatedWord1, relatedWord2: three related words (synonyms, antonyms, or topic-related)
  - wordOrigin: optional etymology or origin
  - imagePrompt: optional prompt for AI image generation depicting the concept

### Challenges (3-4 items)
- Test vocabulary comprehension — NEVER reveal answers in the question text
- Each challenge references a relatedTermId from the terms above
- Challenge types:
  - "match": Provide 3-4 term-definition pairs using matchTerm0/matchDef0 through matchTerm3/matchDef3
  - "fill_blank": Provide a sentence with a blank, 4 options (option0-option3), and correctAnswer (exact text of the right option)
  - "context": Provide a new context sentence, 4 usage options (option0-option3), and correctAnswer (exact text of the right option)
  - "identify": Provide a word and 4 possible definitions (option0-option3), and correctAnswer (exact text of the right definition)

## Grade-Level Adaptation:
- For K-2: Simple, high-frequency words; short definitions; concrete examples
- For 3-5: More academic vocabulary; definitions with context clues; topic-specific terms
- For 6-8: Domain-specific and Latin/Greek-rooted words; precise definitions; nuanced usage

## Critical Rules:
1. All definitions must be accurate and age-appropriate
2. Example sentences must use the word naturally — no awkward "the word X means..." patterns
3. NEVER reveal answers in challenge questions, option labels, or placeholder text
4. correctAnswer must be the EXACT verbatim text of the correct option (copy it from option0-option3). Also set correctIndex to its position as a backup.
5. Every challenge must have exactly 4 real, non-empty options (for non-match types) — never leave an option blank
6. Match challenges need 3-4 term-definition pairs
7. Distractors should be plausible but clearly wrong for the target grade level

Now generate the Vocabulary Explorer.`;

  logEvalModeResolution('VocabularyExplorer', config?.targetEvalMode, evalConstraint);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for vocabulary-explorer");

    const raw = JSON.parse(response.text);
    const data = validateVocabularyExplorerData(raw, evalConstraint?.allowedTypes);

    console.log('[VocabularyExplorer] Generated:', {
      topic,
      gradeLevel,
      title: data.title,
      termsCount: data.terms.length,
      challengesCount: data.challenges?.length ?? 0,
    });

    return data;
  } catch (error) {
    console.error("[VocabularyExplorer] Generation error:", error);
    throw error;
  }
};
