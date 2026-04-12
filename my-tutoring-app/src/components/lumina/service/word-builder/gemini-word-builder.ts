/**
 * Word Builder Generator — Morphology / vocabulary exercises
 *
 * Generates word-building challenges where students construct words from
 * prefixes, roots, and suffixes. Supports four complexity levels controlled
 * by the IRT eval mode system via a root-level `complexityLevel` enum.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ── Re-export types for consumers ──────────────────────��───────────────────
export interface WordPart {
  id: string;
  text: string;
  type: 'prefix' | 'root' | 'suffix';
  meaning: string;
}

export interface TargetWord {
  word: string;
  parts: string[];
  hint: string;
  definition: string;
  sentenceContext: string;
}

export interface WordBuilderData {
  title: string;
  complexityLevel: 'simple_affix' | 'compound_affix' | 'greek_latin' | 'multi_morpheme';
  availableParts: WordPart[];
  targets: TargetWord[];
}

// ── Challenge type docs (one per eval mode) ──────────────────────────────��─

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  simple_affix: {
    promptDoc:
      `"simple_affix": Words with ONE prefix OR ONE suffix attached to a common root.
       Target: 2-part words only (e.g., un+happy, play+ful, re+do).
       Parts pool: 4-6 common prefixes/suffixes (un-, re-, pre-, -ful, -ly, -er) plus 4-6 short everyday roots.
       Distractors: 2-3 unused parts. Grade 3-4 vocabulary.`,
    schemaDescription: "'simple_affix' (one prefix or suffix + common root)",
  },
  compound_affix: {
    promptDoc:
      `"compound_affix": Words with BOTH a prefix AND a suffix around a root.
       Target: 3-part words (e.g., un+help+ful, re+play+able, dis+agree+ment).
       Parts pool: 4-5 prefixes, 4-5 roots, 3-4 suffixes. Students must select all three.
       Distractors: 3-4 unused parts that could plausibly fit but don't form real words.
       Grade 4-5 vocabulary.`,
    schemaDescription: "'compound_affix' (prefix + root + suffix)",
  },
  greek_latin: {
    promptDoc:
      `"greek_latin": Academic words built from Greek/Latin morphemes.
       Target: 2-3 part words with scholarly roots (e.g., bio+log+y, tele+scope, geo+graph+y).
       Parts pool: Greek/Latin prefixes (bio-, geo-, tele-, micro-, auto-), roots (-log-, -graph-, -scope-, -meter-),
       and suffixes (-y, -ic, -tion, -ous). Include meaning for every part.
       Distractors: 3-5 unused academic morphemes. Grade 5-7 vocabulary.`,
    schemaDescription: "'greek_latin' (Greek/Latin academic roots)",
  },
  multi_morpheme: {
    promptDoc:
      `"multi_morpheme": Complex multi-morpheme words with abstract or layered roots.
       Target: 3-part words with less transparent etymology (e.g., pre+dict+able, anti+bio+tic, in+struct+ion).
       Parts pool: 5-6 prefixes including negative/directional (anti-, in-/im-, trans-, inter-),
       5-6 abstract Latin roots (-dict-, -struct-, -ject-, -port-, -rupt-), 4-5 suffixes (-tion, -able, -ive, -ment, -ous).
       Distractors: 4-6 unused morphemes. Grade 6-8+ vocabulary.`,
    schemaDescription: "'multi_morpheme' (complex, multi-morpheme words)",
  },
};

// ── Schema ──────────────────────────���─────────────────────────────��────────

const baseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the exercise (e.g., 'Building Science Words')",
    },
    complexityLevel: {
      type: Type.STRING,
      enum: ['simple_affix', 'compound_affix', 'greek_latin', 'multi_morpheme'],
      description: 'Complexity tier for this exercise',
    },
    availableParts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique ID like 'pre-un', 'root-help', 'suf-ful'",
          },
          text: {
            type: Type.STRING,
            description: "The morpheme text (e.g., 'un', 'help', 'ful')",
          },
          type: {
            type: Type.STRING,
            enum: ['prefix', 'root', 'suffix'],
            description: 'Morpheme category',
          },
          meaning: {
            type: Type.STRING,
            description: "Concise meaning (1-3 words, e.g., 'not', 'assist', 'full of')",
          },
        },
        required: ['id', 'text', 'type', 'meaning'],
      },
      description: 'Pool of 10-15 word parts including distractors.',
    },
    targets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: 'The complete word to build',
          },
          parts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Ordered array of part IDs that form this word (e.g., ["pre-un","root-help","suf-ful"])',
          },
          hint: {
            type: Type.STRING,
            description:
              'A clue describing the word WITHOUT using the word itself. Should reference the definition or usage.',
          },
          definition: {
            type: Type.STRING,
            description: 'Clear, age-appropriate definition',
          },
          sentenceContext: {
            type: Type.STRING,
            description:
              'Example sentence using the word. Use a blank (___) in place of the target word.',
          },
        },
        required: ['word', 'parts', 'hint', 'definition', 'sentenceContext'],
      },
      description: '3-5 target words to build, ordered easiest → hardest.',
    },
  },
  required: ['title', 'complexityLevel', 'availableParts', 'targets'],
};

// ── Generator ──────────────────────────��───────────────────────────────────

export const generateWordBuilder = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    targetEvalMode?: string;
  },
): Promise<WordBuilderData> => {
  // Resolve eval mode constraint from catalog
  const evalConstraint = resolveEvalModeConstraint(
    'word-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('WordBuilder', config?.targetEvalMode, evalConstraint);

  // Constrain schema — root-level complexityLevel field
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'complexityLevel',
        rootLevel: true,
      })
    : baseSchema;

  // Build prompt
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create a word-building morphology exercise for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Teach vocabulary through word construction'}

${challengeTypeSection}

## Critical Rules

1. **NEVER put the target word in the hint.** The hint must describe the word without naming it.
   - GOOD hint: "Describing something that cannot be helped"
   - BAD hint: "The word unhelpful"

2. **sentenceContext must use ___ (three underscores) in place of the target word.** Students should not see the answer.
   - GOOD: "The broken elevator was ___ for people in wheelchairs."
   - BAD: "The broken elevator was unhelpful for people in wheelchairs."

3. **Every part ID in a target's \`parts\` array MUST exist in \`availableParts\`.**

4. **Include 3-5 distractor parts** that don't belong to any target word. This prevents students from solving by elimination.

5. **Part ID format**: Use "pre-{text}", "root-{text}", "suf-{text}" (e.g., "pre-un", "root-help", "suf-ful").

6. **Meaning quality**: Keep meanings to 1-3 words. Use accessible language for the grade level.
   - Prefix meanings: "not", "again", "before", "against"
   - Root meanings: "write", "life", "earth", "help"
   - Suffix meanings: "full of", "state of", "one who", "able to be"

7. **Order targets from easiest to hardest** within the set.

${!evalConstraint ? `## Grade-Level Guidelines
- Grades 3-4: Use common English prefixes/suffixes (un-, re-, -ful, -ly) with everyday roots
- Grades 5-6: Introduce Greek/Latin roots (bio-, geo-, -graph-, -scope-) with academic vocabulary
- Grades 7-8: Complex multi-morpheme words with abstract roots (-dict-, -struct-, -ject-)
` : ''}
Generate 3-5 target words with a pool of 10-15 available parts.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: activeSchema,
    },
  });

  if (!response.text) throw new Error('No content generated');
  const data = JSON.parse(response.text) as WordBuilderData;

  // Post-processing: inject complexityLevel if Gemini dropped it
  if (!data.complexityLevel && evalConstraint) {
    data.complexityLevel = evalConstraint.allowedTypes[0] as WordBuilderData['complexityLevel'];
  }
  if (!data.complexityLevel) {
    data.complexityLevel = 'compound_affix'; // sensible default for mixed mode
  }

  // Validate: ensure all target part IDs exist in availableParts
  const partIds = new Set(data.availableParts.map((p) => p.id));
  for (const target of data.targets) {
    for (const pid of target.parts) {
      if (!partIds.has(pid)) {
        console.warn(`[WordBuilder] Target "${target.word}" references missing part "${pid}"`);
      }
    }
  }

  console.log('🔤 Word Builder Generated:', {
    topic,
    title: data.title,
    complexityLevel: data.complexityLevel,
    partCount: data.availableParts?.length || 0,
    targetCount: data.targets?.length || 0,
    evalMode: config?.targetEvalMode ?? 'mixed',
  });

  return data;
};
