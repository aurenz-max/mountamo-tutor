/**
 * Word Builder Generator — Morphology / vocabulary exercises
 *
 * Generates word-building challenges where students construct words from
 * prefixes, roots, and suffixes. Supports four complexity levels controlled
 * by the IRT eval mode system via a root-level `complexityLevel` enum.
 *
 * ── THE DI PORT CHANGED WHAT A VALID TARGET IS ──────────────────────────────
 * Under the click-era Check button a slightly-wrong target was survivable: the
 * child dragged tiles and code compared ids. Under the judged loop the tutor
 * SAYS the clue, the child SAYS the word, and the affirmation says the assembly
 * out loud — so a target whose parts do not compose its word teaches a false
 * decomposition, and a clue containing its own answer is the question and the
 * answer read in one breath.
 *
 * Both sides of that wire are gated, and the gates are IMPORTED from
 * `wordBuilderScript` rather than copied. Hand-synced copies drift: the two
 * sides of letter-spotter's wire disagreed live on what a sayable sentence was
 * (90 chars vs 100) until the copies were deleted.
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
import {
  isSayableProse,
  isSayableWord,
  itemsFromTargets,
  MAX_CLUE_CHARS,
  MIN_MORPHEME_CHARS,
  opensWithSentinel,
} from '../../primitives/visual-primitives/literacy/wordBuilderScript';

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
  /** Stamped here so the judged session opens at the right grade — this
   *  primitive's band is 3-8 and the runner's fallback is kindergarten. */
  gradeLevel?: string;
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
      // Bounded (this SDK types minItems/maxItems as STRINGS — knowledge-check
      // precedent) so a wide draw cannot run the response past the token
      // ceiling and truncate mid-object.
      minItems: '8',
      maxItems: '15',
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
      minItems: '3',
      maxItems: '5',
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

This exercise is spoken: a live tutor READS THE HINT ALOUD and the student SAYS
the whole word back. Rules 1, 2 and 8-11 exist because of that, and an item that
breaks any of them is DROPPED rather than repaired — a broken item shortens the
lesson, a repaired one gets read to a child.

1. **NEVER put the target word in the hint.** The hint must describe the word without naming it, and must not contain it as part of a longer word either.
   - GOOD hint: "Describing something that cannot be helped"
   - BAD hint: "The word unhelpful" / "Unhelpfully done"

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

8. **THE PARTS MUST SPELL THE WORD EXACTLY**, joined in order with nothing added, removed or changed. The tutor says the assembly out loud when the student gets it right, so it has to be true.
   - GOOD: un + help + ful = "unhelpful" · tele + scope = "telescope" · in + struct + ion = "instruction"
   - BAD: happy + ly ("happily" changes y to i) · run + ing ("running" doubles the n) · bio + log + y (never split a single letter off)
   - If a word you want needs a spelling change, choose a different word.

9. **Every part's \`text\` is at least ${MIN_MORPHEME_CHARS} letters**, lowercase a-z only, no hyphens or dots. A one-letter part has no spoken form.

10. **Each hint is ONE short sentence a tutor can say in a breath** — at most ${MAX_CLUE_CHARS} characters, no quotation marks, no underscores, no line breaks.

11. **No two target words may overlap, and no hint or sentence may mention another target's word.** "helpful" and "unhelpful" in the same set means the tutor speaks one word's answer while asking the other.

12. **Never begin any word, hint, definition, sentence or meaning with "Yes" or with "My turn"** — those two openers are reserved verdict signals in the spoken session.

${!evalConstraint ? `## Grade-Level Guidelines
- Grades 3-4: Use common English prefixes/suffixes (un-, re-, -ful, -ly) with everyday roots
- Grades 5-6: Introduce Greek/Latin roots (bio-, geo-, -graph-, -scope-) with academic vocabulary
- Grades 7-8: Complex multi-morpheme words with abstract roots (-dict-, -struct-, -ject-)
` : ''}
Generate 3-5 target words with a pool of 10-15 available parts.`;

  const draw = async (): Promise<WordBuilderData> => {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
        /**
         * ⚠️ 25000, NOT the family's 8192 — because this generator is on a
         * THINKING model and that number is a non-thinking one.
         *
         * The truncation template ("bound every schema array, then give the
         * call room, 8192") is calibrated on `gemini-flash-lite-latest`, where
         * the whole budget is payload. `gemini-flash-latest` spends the SAME
         * ceiling on its reasoning first, so 8192 left roughly 850 characters
         * for the response: the live probe truncated mid-string on BOTH draws
         * of `simple_affix` and `compound_affix` (the retry is what made it two
         * draws), while `greek_latin` and `multi_morpheme` came back clean —
         * a ceiling that is fatal for half the modes and invisible for the
         * rest, which is the same shape phoneme-explorer's 4096 had.
         *
         * The bound still earns its place as a runaway backstop; it just has to
         * be a thinking-model number (custom-visual's precedent).
         */
        maxOutputTokens: 25000,
      },
    });
    if (!response.text) throw new Error('No content generated');
    return JSON.parse(response.text) as WordBuilderData;
  };

  let data: WordBuilderData;
  try {
    data = await draw();
  } catch (error) {
    console.warn('[WordBuilder] first draw failed, retrying once:', error);
    data = await draw();
  }

  // Post-processing: inject complexityLevel if Gemini dropped it
  if (!data.complexityLevel && evalConstraint) {
    data.complexityLevel = evalConstraint.allowedTypes[0] as WordBuilderData['complexityLevel'];
  }
  if (!data.complexityLevel) {
    data.complexityLevel = 'compound_affix'; // sensible default for mixed mode
  }

  data.availableParts = data.availableParts ?? [];
  data.targets = data.targets ?? [];

  // ── KEEP-OR-DROP, never backfill ──────────────────────────────────────────
  // The click-era version console.warn'd about a target referencing a missing
  // part and shipped it anyway, because the Check button could still compare
  // ids. In the judged loop a broken target becomes a SPOKEN ask the tutor has
  // to stand behind, so it is dropped here and again in `itemsFromTargets` —
  // the same gates on both sides of the wire, imported rather than copied.
  const beforeParts = data.availableParts.length;
  data.availableParts = data.availableParts.filter((part) => {
    const text = (part?.text ?? '').trim();
    const meaning = (part?.meaning ?? '').trim();
    return (
      !!part?.id
      && text.length >= MIN_MORPHEME_CHARS
      && /^[a-z]+$/i.test(text)
      && isSayableProse(meaning, 40)
      && !opensWithSentinel(text)
      && !opensWithSentinel(meaning)
    );
  });

  const beforeTargets = data.targets.length;
  data.targets = data.targets.filter((target) => {
    const word = (target?.word ?? '').trim();
    const hint = (target?.hint ?? '').trim();
    return (
      isSayableWord(word)
      && !opensWithSentinel(word)
      && isSayableProse(hint, MAX_CLUE_CHARS)
      && !opensWithSentinel(hint)
      && !hint.toLowerCase().includes(word.toLowerCase())
    );
  });

  // The authority on askability is the builder the RUNNER reads — run it here
  // so the log reports what the lesson will actually contain, not what the
  // model returned.
  const askable = itemsFromTargets(data.targets, data.availableParts, data.complexityLevel);

  console.log('🔤 Word Builder Generated:', {
    topic,
    title: data.title,
    complexityLevel: data.complexityLevel,
    partCount: data.availableParts.length,
    partsDropped: beforeParts - data.availableParts.length,
    targetCount: data.targets.length,
    targetsDropped: beforeTargets - data.targets.length,
    askableItems: askable.length,
    evalMode: config?.targetEvalMode ?? 'mixed',
  });

  if (askable.length === 0) {
    console.warn('[WordBuilder] no target survived the build gates — the lesson will render empty');
  }

  data.gradeLevel = gradeContext;

  return data;
};
