/**
 * Sentence Analyzer Generator — Gemini content generator for LIVE-JUDGED DI
 * sentence grammar analysis (DI port 20, 2026-08-17).
 *
 * ⚠️ THE MULTIPLE-CHOICE FIELDS ARE GONE. The click era asked the model for
 * `posOption0-3`, `roleOption0-3`, `sentenceTypeOption0-3`, `correctPos` and
 * `correctRole` — fourteen flat fields whose only consumer was a tap surface.
 * The child now SAYS the label, the answer set is the code-owned GRADE WALL in
 * `sentenceAnalyzerScript.ts`, and each word's own `pos` / `role` is the single
 * answer key for every mode.
 *
 * The words also stopped being flat: `word0Text..word7Role` became a nested array
 * whose items REQUIRE all three fields, because the live probe showed the model
 * labelling only word 0 and leaving the rest of the answer key empty. Full
 * finding on `sentenceAnalyzerSchema` below — it is the sharpest thing this port
 * learned and it cost `label_all` its entire identity while reporting success.
 *
 * ⭐ THE ONE IT GAINED IS `subjectEndIndex`, AND IT IS A CONTENT FIX. The click
 * era derived subject/predicate in the COMPONENT as
 * `role.includes('subject') ? 'subject' : 'predicate'`, which put every
 * determiner and every subject-side modifier in the predicate — "The" and
 * "clever" in "The clever fox jumped quickly". A judged loop turns that from a
 * silently-wrong tap into a tutor refusing a correct child out loud, so the
 * boundary is now stated by the model and VALIDATED here rather than inferred.
 *
 * Every label the model may write is enum-constrained to the canonical vocabulary
 * the pack speaks and the wall prints, and the build gates are IMPORTED from the
 * script module rather than copied — both sides of the wire must agree on what is
 * sayable (letter-spotter's 19f drift, where two hand-synced copies disagreed
 * live on what a sayable sentence was).
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  SentenceAnalyzerData,
  SentenceAnalyzerChallenge,
  SentenceWord,
} from '../../primitives/visual-primitives/literacy/SentenceAnalyzer';
import {
  ALL_POS,
  ALL_ROLES,
  ALL_SENTENCE_TYPES,
  MIN_WORDS_FOR_SIDE,
  canonicalPos,
  canonicalRole,
  canonicalSentenceType,
  namesAGrammarTerm,
  opensWithSentinel,
  posWallFor,
  roleWallFor,
  type SentenceTier,
} from '../../primitives/visual-primitives/literacy/sentenceAnalyzerScript';
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
    promptDoc: `"identify_pos": The tutor names one word of the sentence out loud and the student SAYS its part of speech. Foundational skill — grades 2-4.`,
    schemaDescription: "'identify_pos' (say the part of speech of one named word)",
  },
  identify_role: {
    promptDoc: `"identify_role": The tutor names one word of the sentence out loud and the student SAYS what job it does (Subject, Predicate, Direct Object...). Grades 3-6.`,
    schemaDescription: "'identify_role' (say the grammatical role of one named word)",
  },
  label_all: {
    promptDoc: `"label_all": The tutor walks the sentence word by word and the student SAYS the part of speech of each one in turn. The most demanding recall task — grades 4-7.`,
    schemaDescription: "'label_all' (say the part of speech of every word in turn)",
  },
  parse_structure: {
    promptDoc: `"parse_structure": Two steps. The tutor names words one at a time and the student SAYS whether each is in the subject or the predicate; then the student SAYS what kind of sentence it is. Grades 4-8. REQUIRES subjectEndIndex.`,
    schemaDescription: "'parse_structure' (say subject-or-predicate per word, then the sentence kind)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding, NOT content
// ---------------------------------------------------------------------------

function normalizeSupportTier(difficulty?: string): SentenceTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  if (d === 'easy' || d === 'medium' || d === 'hard') return d;
  return null;
}

// ---------------------------------------------------------------------------
// Grade resolution — the canonical value, never the prose
// ---------------------------------------------------------------------------

/**
 * Grades 2-8, this primitive's range, resolved in the order the contract
 * requires: the CANONICAL objective grade first, the normalized BAND KEY second,
 * and never a digit scraped out of `gradeContext` prose (see the call site).
 *
 * The band fallback maps to the middle of each band rather than its floor. A
 * free-form "elementary" lesson has no objective grade to read, and answering it
 * with grade 1 — the band's bottom — is the exact failure this replaces.
 */
export const resolveGrade = (grade?: string, band?: string): number => {
  const canonical = (grade ?? '').trim();
  if (/^K$/i.test(canonical)) return 2;
  if (/^\d{1,2}$/.test(canonical)) return Math.min(Math.max(Number(canonical), 2), 8);

  switch ((band ?? '').toLowerCase().trim()) {
    case 'toddler':
    case 'preschool':
    case 'kindergarten':
      return 2;
    case 'middle-school':
      return 7;
    case 'high-school':
    case 'undergraduate':
    case 'graduate':
    case 'phd':
      return 8;
    case 'elementary':
    default:
      // The MIDDLE of grades 1-5, clamped into this primitive's range.
      return 4;
  }
};

const TIER_GUARDRAIL =
  'TIER GUARDRAIL: config.difficulty changes only how much the tutor says BEFORE the question — never '
  + 'the sentences, never a label, never the subject boundary. Generate the same content at every tier.';

// ---------------------------------------------------------------------------
// The schema — a NESTED word array, not flat fields
// ---------------------------------------------------------------------------

const POS_ENUM = ALL_POS as unknown as string[];
const ROLE_ENUM = ALL_ROLES as unknown as string[];
const TYPE_ENUM = ALL_SENTENCE_TYPES as unknown as string[];

/**
 * ⭐ THE WORDS ARE A NESTED ARRAY, AND THE FLAT `word0Text..word7Role` FIELDS
 * THIS FILE USED TO CARRY ARE GONE. Two live-probe findings forced it, and
 * neither was visible to any unit test (2026-08-17):
 *
 * 1. **THE MODEL LABELLED ONLY `word0`.** Every probe came back with word 0
 *    carrying a part of speech and a role and every later word carrying neither
 *    — "The:Determiner/Modifier brown:-/- bear:-/- runs.:-/-". Twenty-four flat
 *    fields cannot all be `required` (a three-word sentence would have to invent
 *    `word7Pos`), so twenty-two of them were optional, and an optional
 *    enum-constrained field is one the model is free to skip. The old header
 *    called flat fields the fix for malformed array JSON; on this model they are
 *    the cause of a silently INCOMPLETE ANSWER KEY. `label_all` — the mode whose
 *    entire identity is walking every word — was reduced to a single ask about
 *    the first word of each sentence, and it reported success while doing it.
 *    A nested item with `required: ['text', 'pos', 'role']` makes the labels
 *    non-optional PER WORD, which is the guarantee the mode needs.
 *
 * 2. **⚠️ `maxItems` ON TWO NESTED ARRAYS IS A HARD `400 INVALID_ARGUMENT`, AND
 *    THE FAMILY'S STANDING RULE POINTS THE WRONG WAY HERE.** The flash-lite
 *    truncation template says to bound EVERY schema array. Bounding both of this
 *    schema's arrays makes every request fail before generation starts.
 *
 *    Bisected twice against the live API, because the first diagnosis was wrong.
 *    On the flat schema, dropping `maxItems` fixed it AND dropping all sixteen
 *    word enums fixed it, which reads as a whole-schema complexity budget. It is
 *    not: after the nested rewrite — three enum properties instead of sixteen —
 *    it still failed with both arrays bounded, and passed the moment EITHER bound
 *    came off. The bound that survives is the OUTER one on `challenges`, since
 *    that is the array whose length actually governs output size; `words` is
 *    bounded by the sentence and sliced to 8 in code.
 *
 *    Carry the shape, not the number: a `maxItems` costs something that stacks
 *    down the nesting, so bound the array that can actually run away and leave
 *    the inner one to code. And note WHY no gate but this one could see it — a
 *    400 is not a truncation. There is no partial output to detect, no fallback
 *    fires, and `tsc` plus 59 unit tests were green over a generator that could
 *    not make a single successful call.
 */
export const sentenceAnalyzerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Engaging title for the grammar activity' },
    description: { type: Type.STRING, description: 'One short sentence describing the activity' },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('2' through '8')" },
    challenges: {
      type: Type.ARRAY,
      maxItems: '6',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'ch1', 'ch2')" },
          type: {
            type: Type.STRING,
            enum: ['identify_pos', 'identify_role', 'label_all', 'parse_structure'],
            description: "Challenge type: 'identify_pos', 'identify_role', 'label_all', or 'parse_structure'",
          },
          sentence: { type: Type.STRING, description: 'The complete sentence as a single string' },
          words: {
            type: Type.ARRAY,
            // ⚠️ NO `maxItems` HERE — see finding 2 above. The OUTER bound is the
            // one kept, because it is the one that governs output size; this
            // array is bounded by the sentence itself (3-8 words) and sliced to
            // 8 in `validateChallenge` regardless.
            description:
              'EVERY word of the sentence, in order, each with BOTH labels. One entry per word — '
              + 'a sentence of five words has five entries, and none of them may be left out.',
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: 'The word exactly as it appears, with any punctuation attached ("ran.")',
                },
                pos: { type: Type.STRING, enum: POS_ENUM, description: 'This word\'s part of speech' },
                role: { type: Type.STRING, enum: ROLE_ENUM, description: 'This word\'s job in the sentence' },
              },
              // ⭐ ALL THREE REQUIRED — this is finding 1's fix.
              required: ['text', 'pos', 'role'],
            },
          },
          sentenceType: {
            type: Type.STRING,
            enum: TYPE_ENUM,
            description: 'What kind of sentence this is. REQUIRED for parse_structure.',
          },
          subjectEndIndex: {
            type: Type.NUMBER,
            description:
              'parse_structure ONLY: the 0-based index of the LAST word of the COMPLETE SUBJECT — '
              + 'including any articles and describing words in front of the naming word. In '
              + '"The clever fox jumped quickly" the complete subject is "The clever fox", so this is 2. '
              + 'OMIT this field entirely if the subject is not one unbroken run of words at the START of '
              + 'the sentence (a command has no subject word at all; a question splits it).',
          },
          explanation: {
            type: Type.STRING,
            description: 'Why the labels are what they are (2-3 student-friendly sentences). Shown only AFTER the tutor confirms.',
          },
        },
        required: ['id', 'type', 'sentence', 'words', 'explanation'],
      },
      description: 'Array of 4-6 grammar challenges',
    },
  },
  required: ['title', 'description', 'gradeLevel', 'challenges'],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface RawWord {
  text?: string;
  pos?: string;
  role?: string;
}

interface FlatChallenge {
  id: string;
  type: string;
  sentence: string;
  explanation: string;
  words?: RawWord[];
  sentenceType?: string;
  subjectEndIndex?: number;
}

/**
 * KEEP-OR-DROP, never backfill. The click era padded option lists with the literal
 * string "Other" and patched `correctPos` into whichever slot was free; a
 * placeholder in a judged loop becomes a spoken ask the tutor has to stand behind.
 * Anything that cannot be asked cleanly returns null and the session is shorter.
 */
function validateChallenge(flat: FlatChallenge): SentenceAnalyzerChallenge | null {
  const sentence = (flat.sentence ?? '').replace(/\s+/g, ' ').trim();
  if (!sentence || !flat.id || !CHALLENGE_TYPE_DOCS[flat.type]) return null;

  // Belt and suspenders on both sides of the wire: the pack runs these too.
  if (namesAGrammarTerm(sentence)) return null;
  if (opensWithSentinel(sentence)) return null;

  const words: SentenceWord[] = [];
  (flat.words ?? []).slice(0, 8).forEach((word, i) => {
    const text = (word?.text ?? '').trim();
    if (!text) return;
    const pos = canonicalPos(word?.pos);
    const role = canonicalRole(word?.role);
    // A word with no canonical label cannot be asked about, but it still occupies
    // its position in the printed sentence — so it is kept with an empty label
    // rather than removed. Removing it would shift every later index, including
    // `subjectEndIndex`, which is an answer key.
    words.push({ id: `w${i}`, text, partOfSpeech: pos ?? '', grammaticalRole: role ?? '' });
  });
  if (words.length === 0) return null;

  const base: SentenceAnalyzerChallenge = {
    id: flat.id,
    type: flat.type as SentenceAnalyzerChallenge['type'],
    sentence,
    words,
    explanation: flat.explanation || 'No explanation provided.',
  };

  if (flat.type === 'identify_pos' || flat.type === 'label_all') {
    // At least one word must carry a POS, or there is nothing to ask.
    return words.some((w) => w.partOfSpeech) ? base : null;
  }

  if (flat.type === 'identify_role') {
    return words.some((w) => w.grammaticalRole) ? base : null;
  }

  // parse_structure
  const sentenceType = canonicalSentenceType(flat.sentenceType);
  if (!sentenceType) return null;
  const end = flat.subjectEndIndex;
  const validEnd =
    typeof end === 'number' && Number.isInteger(end)
    && end >= 0 && end < words.length - 1 && words.length >= MIN_WORDS_FOR_SIDE;
  return {
    ...base,
    sentenceType,
    // An invalid boundary is DROPPED, not clamped: the pack then builds the
    // sentence-kind ask and skips the side asks, which is a shorter session
    // rather than a wrong answer key.
    ...(validEnd ? { subjectEndIndex: end as number } : {}),
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateSentenceAnalyzer = async (
  topic: string,
  /** Band PROSE for prompts. Deliberately not read for the grade — see
   *  `resolveGrade` and the resolution block below. */
  gradeContext: string,
  config?: {
    intent?: string;
    title?: string;
    targetEvalMode?: string;
    difficulty?: string;
    /** Canonical curriculum grade for this objective — 'K' or '1'..'12'. */
    grade?: string;
    /** Normalized band key ('elementary', 'kindergarten', …) — the fallback. */
    gradeBand?: string;
  },
): Promise<SentenceAnalyzerData> => {
  const evalConstraint = resolveEvalModeConstraint(
    'sentence-analyzer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(sentenceAnalyzerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : sentenceAnalyzerSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);
  const tier = normalizeSupportTier(config?.difficulty);

  // --- Grade resolution -----------------------------------------------------
  //
  // ⭐ THE CLICK ERA READ `gradeContext.match(/(\d)/)` AND IT WAS WRONG FOR EVERY
  // ELEMENTARY LESSON — a pre-existing content-fidelity bug this port surfaced
  // and which `GenerationContext` names outright: *"NEVER parse grade out of
  // gradeContext prose; read this."*
  //
  // `gradeContext` is a PROSE SENTENCE, not a grade: "elementary students
  // (grades 1-5) — age-appropriate vocabulary…". The first digit in it is the
  // BOTTOM of the band, so every grade-1-to-5 objective resolved to 1, and a
  // grade-5 lesson got grade-1 sentences with a grade-1 vocabulary wall.
  //
  // Under a tap that was a quiet fidelity failure. Under the judged loop it also
  // DELETES TWO OF FOUR EVAL MODES: the pack builds nothing for `identify_role`
  // or `parse_structure` below grade 3, because those grades have no role
  // vocabulary in scope. That is how it was found — the judged drive on
  // `identify_role` failed with "every generated challenge was dropped", and the
  // gate was right; the grade reaching it was not.
  const safeGrade = resolveGrade(config?.grade, config?.gradeBand);

  const gradeGuidelines: Record<number, string> = {
    2: 'GRADE 2: 3-5 word sentences, familiar vocabulary (cat, run, big). Only identify_pos and label_all.',
    3: 'GRADE 3: 4-6 word sentences. Grade-appropriate vocabulary. No parse_structure.',
    4: 'GRADE 4: 5-7 word sentences. Compound subjects and predicates appear; direct objects appear.',
    5: 'GRADE 5: 5-7 word sentences. Prepositional phrases appear.',
    6: 'GRADE 6: 5-8 word sentences. Compound-complex structures and varied sentence kinds.',
    7: 'GRADE 7: 6-8 word sentences. Participial phrases, indirect objects, appositives.',
    8: 'GRADE 8: 6-8 word sentences. Subordinate clauses and advanced roles.',
  };

  /**
   * THE VOCABULARY IN SCOPE, STATED. The pack DROPS any word whose label is off
   * the grade wall, so a model writing "Interjection" at grade 2 costs an item.
   * Telling it the wall up front is cheaper than dropping what it returns.
   */
  const posWall = posWallFor(safeGrade);
  const roleWall = roleWallFor(safeGrade);

  const prompt = `Create a sentence grammar analysis activity about: "${topic}".

TARGET GRADE LEVEL: ${safeGrade}
${gradeGuidelines[safeGrade] ?? gradeGuidelines[4]}

${challengeTypeSection}

PURPOSE: ${config?.intent || 'Practice naming parts of speech and grammatical roles out loud'}

⚠️ THIS ACTIVITY IS SPOKEN. A live tutor reads each question aloud and the student
ANSWERS OUT LOUD. There are no multiple-choice options anywhere — the student says
the grammar label from memory, with a printed word wall for reference.

VOCABULARY IN SCOPE AT THIS GRADE — use ONLY these:
- Parts of speech: ${posWall.join(', ')}
- Jobs in a sentence: ${roleWall.length ? roleWall.join(', ') : '(none — this grade does not do roles)'}
A word labelled outside these lists is DROPPED and the activity gets shorter.

Generate 4-6 challenges. Each has ONE sentence of 3-8 words.

For EACH challenge:
- id: Unique ID (ch1, ch2, ...)
- type: one of the challenge types above
- sentence: the complete sentence as one string
- words: ONE ENTRY PER WORD, in order, each with text, pos and role.
  ⚠️ EVERY word gets BOTH labels. "The cat sat" is three entries and six labels —
  a word with a missing pos or role makes the whole challenge unusable, because a
  live tutor has to say the label out loud and judge a child against it.
- explanation: why the labels are what they are (2-3 student-friendly sentences)

parse_structure ALSO needs:
- sentenceType: Declarative, Interrogative, Imperative or Exclamatory
- subjectEndIndex: the 0-based index of the LAST word of the COMPLETE SUBJECT.
  The complete subject includes the articles and describing words in FRONT of the
  naming word. In "The clever fox jumped quickly" it is "The clever fox", so
  subjectEndIndex is 2 — NOT 2 because "fox" is the subject, but because "The
  clever fox" ends at index 2.
  OMIT subjectEndIndex if the subject is not one unbroken run of words at the
  START of the sentence. A command ("Close the door.") has no subject word. A
  question ("Where did the fox go?") splits it. Those are still fine sentences for
  the sentence-kind step — just leave the field out.

HARD RULES — a challenge that breaks one is thrown away:
- ⚠️ THE SENTENCE MAY NOT CONTAIN ANY GRAMMAR WORD. No "noun", "verb", "adjective",
  "adverb", "pronoun", "preposition", "conjunction", "determiner", "interjection",
  "subject", "predicate", "object", "modifier", "declarative", "interrogative",
  "imperative" or "exclamatory" anywhere in it. The tutor reads the sentence aloud,
  and a sentence containing a grammar word says an answer before it is asked.
- No sentence may begin with "Yes" or with "My turn" — those are the tutor's own
  verdict words.
- Every word MUST have an accurate part of speech AND an accurate job.
- Do NOT make punctuation a separate word — attach it to the word before it.
- Sentences should be about "${topic}".
${!evalConstraint ? '- Vary challenge types across the set — include at least 2 different types\n' : ''}${tier ? `\n${TIER_GUARDRAIL}\n` : ''}
EXAMPLE (parse_structure):
{
  "id": "ch1",
  "type": "parse_structure",
  "sentence": "The clever fox jumped quickly.",
  "words": [
    { "text": "The",      "pos": "Determiner", "role": "Modifier" },
    { "text": "clever",   "pos": "Adjective",  "role": "Modifier" },
    { "text": "fox",      "pos": "Noun",       "role": "Subject" },
    { "text": "jumped",   "pos": "Verb",       "role": "Predicate" },
    { "text": "quickly.", "pos": "Adverb",     "role": "Modifier" }
  ],
  "sentenceType": "Declarative",
  "subjectEndIndex": 2,
  "explanation": "The complete subject is 'The clever fox' — everything that tells us WHO the sentence is about. The rest tells us what it did."
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
        // 8192 is correct for THIS model — flash-lite is non-thinking, so the
        // ceiling is not shared with a reasoning budget (word-builder's finding
        // is about gemini-flash-latest, which this is not).
        maxOutputTokens: 8192,
        systemInstruction:
          'You are an expert K-8 grammar and language arts specialist writing content for a SPOKEN tutoring '
          + 'session. Every part-of-speech and grammatical-role label must be linguistically accurate, because '
          + 'a live tutor will judge a child out loud against it. You choose grade-appropriate sentences that '
          + 'clearly demonstrate the targeted grammar concepts.',
      },
    });

    const text = response.text;
    if (!text) throw new Error('No data returned from Gemini API');

    const raw = JSON.parse(text) as {
      title: string;
      description: string;
      gradeLevel: string;
      challenges: FlatChallenge[];
    };

    const validChallenges: SentenceAnalyzerChallenge[] = [];
    for (const flat of raw.challenges ?? []) {
      const challenge = validateChallenge(flat);
      if (challenge) validChallenges.push(challenge);
      else console.warn(`[SentenceAnalyzer] Rejected invalid challenge: ${flat?.id} (type=${flat?.type})`);
    }

    if (validChallenges.length === 0) {
      throw new Error('All generated challenges failed validation — no usable content');
    }

    const result: SentenceAnalyzerData = {
      title: config?.title || raw.title || 'Sentence Analysis',
      description: raw.description || 'Say what each word is doing in the sentence.',
      /**
       * ⚠️ THE GRADE WE RESOLVED AND PROMPTED WITH, NOT THE ONE THE MODEL WROTE
       * (genre-explorer drive finding, 2026-08-17). `isBandFloor` hangs the
       * read-aloud accommodation off this field, and a model-authored "Grade 2"
       * silently withdrew it there.
       */
      gradeLevel: String(safeGrade),
      challenges: validChallenges,
      ...(tier ? { supportTier: tier } : {}),
    };

    logEvalModeResolution('SentenceAnalyzer', config?.targetEvalMode, evalConstraint);

    console.log('Sentence Analyzer Generated:', {
      title: result.title,
      gradeLevel: result.gradeLevel,
      supportTier: result.supportTier,
      challengeCount: validChallenges.length,
      types: validChallenges.map((c) => c.type),
      rejected: (raw.challenges?.length ?? 0) - validChallenges.length,
    });

    return result;
  } catch (error) {
    console.error('Error generating sentence analyzer:', error);
    throw error;
  }
};
