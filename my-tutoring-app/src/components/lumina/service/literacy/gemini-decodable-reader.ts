import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { DecodableReaderData } from "../../primitives/visual-primitives/literacy/DecodableReader";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  opensWithSentinel,
  optionsEarSeparable,
  sentenceText,
  wordsIn,
} from '../../primitives/visual-primitives/literacy/decodableReaderScript';

// ---------------------------------------------------------------------------
// Eval modes = COMPREHENSION TASK IDENTITIES (not numeric difficulty).
// The decodable passage stays controlled-vocabulary at the same grade band in
// every mode — what changes is the READING-COMPREHENSION SKILL the embedded
// question demands. This is a genuine DOK/Bloom ladder for reading:
//   literal   → locate-and-restate a fact stated explicitly in the text
//   sequence  → connect two text-explicit parts (order / cause→effect)
//   inference → meaning NOT stated; combine clues across sentences
//   main_idea → synthesize the whole passage into its central message
// The `comprehensionType` enum (root-level, OPTIONAL) carries the pinned skill;
// the component never reads it, so rendering is unaffected (back-compatible).
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  literal: {
    promptDoc:
      `"literal": The comprehension question asks for a fact stated EXPLICITLY in the passage. `
      + `The answer is a single detail the reader can locate and restate verbatim ("Who ran?", "What did the cat sit on?"). `
      + `No inference — the answer words appear in the text. Simplest comprehension skill. K-1 level.`,
    schemaDescription: "'literal' (recall a fact stated directly in the text)",
  },
  sequence: {
    promptDoc:
      `"sequence": The question requires connecting TWO text-explicit parts of the passage — `
      + `the ORDER of events ("What happened first/next/last?") or a simple cause→effect ("Why did X happen?") `
      + `where both the cause and effect are stated. Still text-explicit, but the reader must relate two sentences. Grade 1-2 level.`,
    schemaDescription: "'sequence' (order of events or stated cause/effect)",
  },
  inference: {
    promptDoc:
      `"inference": The answer is NOT stated directly. The reader must combine clues from across the `
      + `passage and reason to a conclusion ("How did the boy feel?", "What will probably happen next?"). `
      + `Distractors must be plausible to a reader who only skimmed. Harder comprehension skill. Grade 2 level.`,
    schemaDescription: "'inference' (deduce something the text implies but does not state)",
  },
  main_idea: {
    promptDoc:
      `"main_idea": The question asks for the CENTRAL message or "what the whole passage is mostly about". `
      + `The reader must synthesize every sentence, not a single detail. Distractors should be true details from the `
      + `passage that are too narrow to be the main idea. Most abstract comprehension skill. Grade 2 level.`,
    schemaDescription: "'main_idea' (synthesize the passage's central message)",
  },
};

/**
 * Schema definition for Decodable Reader Data
 *
 * Generates controlled-vocabulary reading passages for K-2 students: the child
 * READS each sentence aloud into a live judged loop, then answers comprehension
 * questions — aloud with one word where the answer is a word in the story
 * (literal / read-along), by picture card where the answer is a whole
 * proposition. See `decodableReaderScript.ts` for the answer-material fork.
 *
 * TWO CONTENT RULES ARE LOAD-BEARING, NOT COSMETIC, because every string below
 * gets SPOKEN by the tutor:
 *  - a sentence must be 3-8 words (the benched judged-utterance window — a
 *    sentence outside it is dropped at build, never trimmed);
 *  - nothing may BEGIN a sentence with "Yes" or "My turn" — those are the
 *    verdict sentinels, and the engine would read the tutor's own narration as
 *    a judgment and advance the lesson before the child answered.
 * Both are checked in code after generation (retry once, then KEEP-OR-DROP —
 * never backfilled, because a placeholder here becomes a spoken ask).
 */
const decodableReaderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the reading passage (e.g., 'The Cat on the Mat')"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level ('K', '1', or '2')"
    },
    passage: {
      type: Type.OBJECT,
      properties: {
        sentences: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "Unique sentence identifier (e.g., 's1', 's2')"
              },
              words: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.STRING,
                      description: "Unique word identifier (e.g., 's1_w1', 's1_w2')"
                    },
                    text: {
                      type: Type.STRING,
                      description: "The word as displayed AND as it must be read aloud (including punctuation attached to word, e.g., 'cat.' or 'cat,')"
                    },
                    phonicsPattern: {
                      type: Type.STRING,
                      enum: ["cvc", "cvce", "sight", "blend", "digraph", "r-controlled", "diphthong", "other"],
                      description: "The primary phonics pattern of this word"
                    }
                  },
                  required: ["id", "text", "phonicsPattern"]
                },
                description: `Array of words in this sentence. MUST be ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS} words — the child reads this sentence aloud as one utterance and a sentence outside that range is dropped.`
              }
            },
            required: ["id", "words"]
          },
          description: "Array of sentences making up the passage"
        },
        imageDescription: {
          type: Type.STRING,
          description: "Description of the passage scene for visual context"
        }
      },
      required: ["sentences"]
    },
    phonicsPatternsInPassage: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of phonics patterns represented in this passage (e.g., ['cvc', 'sight', 'digraph'])"
    },
    comprehensionType: {
      type: Type.STRING,
      enum: ["literal", "sequence", "inference", "main_idea"],
      description: "The comprehension SKILL the embedded question demands: 'literal' (fact stated in text), 'sequence' (order / stated cause-effect), 'inference' (deduce from clues), 'main_idea' (central message)."
    },
    comprehensionQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: "A comprehension question about the passage, written to be SPOKEN aloud to the child"
          },
          answerWord: {
            type: Type.STRING,
            description: "The ONE WORD that answers this question, exactly as it appears in the passage (e.g. 'mat'). Required when the answer IS a single word stated in the story; leave empty when the answer is a whole idea rather than a word. Never 'yes' or 'no'."
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Option letter identifier (e.g., 'A', 'B', 'C', 'D')"
                },
                text: {
                  type: Type.STRING,
                  description: "Option text content: 3-7 words, one plain sentence. The tutor reads it aloud and the child SAYS which option they pick, so it must carry at least one word that appears in no other option — one option's words must never all appear inside another's."
                },
                emoji: {
                  type: Type.STRING,
                  description: "A single emoji that PICTURES this answer choice (e.g. '🐕' for 'The dog can run', '🐈' for 'The cat can nap'). K-1 readers answer by picture, not by reading the text, so the emoji must be a fair, distinct visual for THIS option — never the same emoji on two options, and never a hint that only the correct option gets a real picture."
                }
              },
              required: ["id", "text", "emoji"]
            },
            description: "Answer options (3-4 options with stable IDs, each with a distinct picture emoji)"
          },
          correctOptionId: {
            type: Type.STRING,
            description: "The correct option ID letter (e.g., 'B') — must match one of the option ids"
          }
        },
        required: ["question", "options", "correctOptionId"]
      },
      description: "The comprehension questions asked after the reading, in order"
    }
  },
  required: ["title", "gradeLevel", "passage", "phonicsPatternsInPassage", "comprehensionQuestions"]
};

// ---------------------------------------------------------------------------
// Content gates — the SAME rules the pack runs at build time, run here too so a
// bad draw is retried once instead of shipped and silently dropped on screen.
// KEEP-OR-DROP only: a placeholder question in a judged loop becomes a spoken
// ask the tutor has to judge.
// ---------------------------------------------------------------------------

type RawQuestion = NonNullable<DecodableReaderData['comprehensionQuestions']>[number];

/** Is this question askable at all — one spoken word, or a fair card set? */
const questionUsable = (q: RawQuestion, wantsSpokenAnswer: boolean): boolean => {
  const question = (q?.question ?? '').trim();
  if (!question || opensWithSentinel(question)) return false;

  const answerWord = (q.answerWord ?? '').trim().toLowerCase();
  const spokenOk =
    wantsSpokenAnswer
    && !!answerWord
    && wordsIn(answerWord) === 1
    && !['yes', 'no'].includes(answerWord.replace(/[^a-z]/g, ''));

  const options = q.options ?? [];
  // The child SAYS which choice it is, so the set has to be tellable apart by
  // EAR as well as fair on screen (`closed_set_choice`). Same gate the pack
  // runs at build time — re-drawing costs one call, dropping costs the question.
  const choicesOk =
    options.length >= 2
    && !!q.correctOptionId
    && options.some((o) => o.id === q.correctOptionId)
    && options.every((o) => !!(o.text ?? '').trim() && !opensWithSentinel(o.text ?? ''))
    && optionsEarSeparable(options);

  return spokenOk || choicesOk;
};

/** Everything wrong with a draw, in one pass — used to decide the retry. */
const contentIssues = (data: DecodableReaderData, wantsSpokenAnswer: boolean): string[] => {
  const issues: string[] = [];
  const sentences = data.passage?.sentences ?? [];
  if (sentences.length === 0) issues.push('no passage sentences');
  for (const sentence of sentences) {
    const text = sentenceText(sentence);
    const count = wordsIn(text);
    if (count < MIN_SENTENCE_WORDS || count > MAX_SENTENCE_WORDS) {
      issues.push(`sentence "${text}" is ${count} words (need ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS})`);
    }
    if (opensWithSentinel(text)) issues.push(`sentence "${text}" opens with a verdict sentinel`);
  }
  const questions = data.comprehensionQuestions ?? [];
  if (questions.length === 0) issues.push('no comprehension questions');
  for (const q of questions) {
    if (!questionUsable(q, wantsSpokenAnswer)) {
      issues.push(`question "${q?.question ?? ''}" has no askable answer`);
    }
  }
  return issues;
};

/**
 * Generate decodable reader data using Gemini AI
 *
 * Creates controlled-vocabulary reading passages the child reads ALOUD, one
 * judged sentence at a time, plus the comprehension questions asked after it.
 * Passages use phonics patterns matching the student's current decoding level.
 *
 * @param topic - Theme for the passage (e.g., "Animals at the Park", "Going to School")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary and length
 * @param config - Optional partial configuration to override generated values
 * @returns DecodableReaderData with grade-appropriate passage and comprehension question
 */
type DecodableReaderConfig = Partial<DecodableReaderData> & { targetEvalMode?: string };

export const generateDecodableReader = async (
  ctx: GenerationContext,
): Promise<DecodableReaderData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const config = ctx.raw as DecodableReaderConfig;

  // Read-along is a READING mode, not a comprehension type. It routes through the
  // catalog eval mode `read_along` (challengeTypes: ['literal']), so the standard
  // resolver below still pins comprehensionType → 'literal'; we only additionally
  // force the Kindergarten rung and stamp mode='read_along' on the output so the
  // component reads the passage aloud instead of asking the child to decode it.
  const isReadAlong = config?.targetEvalMode === 'read_along';

  // ── Eval mode resolution (LEGACY pattern: explicit pin → schema enum) ──
  const evalConstraint = resolveEvalModeConstraint(
    'decodable-reader',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('DecodableReader', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(decodableReaderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'comprehensionType',
        rootLevel: true,
      })
    : decodableReaderSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const gradeContext: Record<string, string> = {
    'K': `
KINDERGARTEN GUIDELINES:
- 2-3 SHORT sentences (3-5 words each)
- Use mostly CVC words (cat, dog, sun, hat, big, red, sit, run, hop)
- Include 5-10 high-frequency sight words (the, a, is, it, I, and, to, can, see, my, like, we, go)
- EVERY word must have a phonicsPattern tag
- Tag sight words as "sight"
- Tag CVC words as "cvc"
- Simple content: concrete actions and objects kids know
- Comprehension: simple "Who?" or "What?" questions whose answer is ONE WORD from the story
- Example: "The big cat sat on a mat."
  - "The" -> sight, "big" -> cvc, "cat" -> cvc, "sat" -> cvc, "on" -> sight, "a" -> sight, "mat." -> cvc
`,
    '1': `
GRADE 1 GUIDELINES:
- 4-6 sentences (4-7 words each)
- Use CVC, CVCE (silent-e), blends, and digraph words
- Include 8-12 sight words (the, a, is, was, are, they, have, said, with, from, what, her, his)
- Mix phonics patterns for variety
- Blends: stop, trip, clap, frog, grin, slip, stem
- Digraphs: ship, chat, thin, whip, fish, much, bath
- CVCE: cake, bike, rope, cute, lake, ride, home
- Comprehension: "What happened?" or "Why?" questions (3-4 picture options)
- Short and medium vowel words mixed
`,
    '2': `
GRADE 2 GUIDELINES:
- 6-8 sentences (5-8 words each)
- Use CVC, CVCE, blends, digraphs, r-controlled vowels, and diphthongs
- Include sight words naturally
- R-controlled: farm, bird, fern, corn, burn, star, first, north
- Diphthongs: coin, boy, cloud, cow, point, round, joy, town
- Can include 2-syllable words: basket, rabbit, sunset, garden, under
- More complex comprehension: inference or main idea (4 picture options)
- Varied sentence structure
`
  };

  // Grade rung: ctx.grade is the canonical per-objective curriculum grade
  // ('K'|'1'..'12'), resolved once at the registry boundary — use it directly,
  // clamped to this primitive's K-2 decodable ladder. Without it (free-form
  // lessons) fall back to the lesson band: kindergarten → 'K', anything else →
  // '1' (mid rung). The old code matched ctx.gradeContext prose against
  // ['K','1','2'], which could never hit, so every passage was pinned to 'K'.
  const LADDER = ['K', '1', '2'] as const;
  let gradeLevelKey: string;
  if (isReadAlong) {
    // Read-along is the Kindergarten pre-reader mode — always the K rung.
    gradeLevelKey = 'K';
  } else if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (ctx.grade && parseInt(ctx.grade, 10) > 2) {
    gradeLevelKey = '2';
  } else {
    gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? 'K' : '1';
  }

  // ── The answer-material fork, as the generator sees it ──────────────────
  // read_along and literal answers are ONE WORD the child SAYS (the word is in
  // the story, so the set is closed); sequence / inference / main_idea answers
  // are whole propositions, which spoken would be an open set, so those are
  // answered by tapping a picture card. Both shapes are always produced — the
  // cards are the fallback when a one-word answer turns out not to exist.
  const pinnedType = evalConstraint?.allowedTypes[0];
  const wantsSpokenAnswer = isReadAlong || pinnedType === 'literal' || !pinnedType;
  // A story has exactly ONE main idea, so a second main-idea question is the
  // same problem worded twice — which the live probe drew on the first try
  // ("What is the whole story mostly about?" / "What is the central message of
  // this passage?"). Every other mode has room for genuinely different asks.
  // (In decode modes the reading itself already supplies most of the items.)
  const questionCount = isReadAlong ? 3 : pinnedType === 'main_idea' ? 1 : 2;

  // In read-along the tutor reads the story, so the passage can stay minimal.
  const readAlongSection = isReadAlong
    ? `\nREAD-ALONG MODE (Kindergarten pre-reader): The TUTOR reads this passage aloud to the child — the child `
      + `does NOT decode it, they LISTEN and then answer. Keep the passage VERY short (2-3 tiny sentences). Every `
      + `question MUST be a simple, concrete "who/what/where" question about the story whose answer is ONE WORD the `
      + `child can say out loud, and whose answer choices are each easy to PICTURE with one emoji.\n`
    : '';

  const answerSection = wantsSpokenAnswer
    ? `\nTHE ANSWER THE CHILD GIVES: each question is answered OUT LOUD with ONE WORD. Set "answerWord" to that `
      + `single word, spelled exactly as it appears in the passage (e.g. passage "The cat sat on a mat." → question `
      + `"What did the cat sit on?" → answerWord "mat"). The question must have exactly ONE defensible one-word `
      + `answer — never a question two words in the story could honestly answer. answerWord is NEVER "yes" or "no". `
      + `Still provide the 3-4 picture options as well (they are the fallback).\n`
    : `\nTHE ANSWER THE CHILD GIVES: the answer here is a whole idea rather than a single word, so the tutor reads `
      + `the options aloud and the child SAYS which one they pick. Nothing is tapped. Leave "answerWord" empty. `
      + `Two rules follow from the answer being SPOKEN, and a question that breaks either one is thrown away:\n`
      + `- Keep each option SHORT: 3 to 7 words, one plain sentence a five-year-old could say back.\n`
      + `- Every option must contain at least one WORD that appears in none of the others, so the tutor can tell `
      + `which one the child named. "A cat." beside "A cat and a dog." is unusable — a child who says "a cat" has `
      + `named both. Options must differ in their KEY WORDS, not merely in length or word order.\n`
      + `The options carry the entire answer set, so make the distractors genuinely plausible to a child who read `
      + `carelessly.\n`;

  const generationPrompt = `Create a decodable reading passage about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (passages, target words, sentences, evidence, questions) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevelKey}
${readAlongSection}${answerSection}
THIS TEXT IS SPOKEN ALOUD BY A LIVE TUTOR, AND TWO RULES ARE ABSOLUTE:
- Every sentence in the passage is ${MIN_SENTENCE_WORDS} to ${MAX_SENTENCE_WORDS} words long. The child reads one sentence at a time as a single breath; a sentence outside that range is thrown away.
- NOTHING you write may BEGIN a sentence with the word "Yes" or the words "My turn" — not the passage, not a question, not an answer choice. Those two openings are reserved: the tutor's own words would be mistaken for a verdict and the lesson would jump ahead. Anywhere ELSE in a sentence they are fine.
${gradeContext[gradeLevelKey] || gradeContext['K']}
${challengeTypeSection}
REQUIRED INFORMATION:

1. **Title**: A kid-friendly title for the passage

2. **Grade Level**: "${gradeLevelKey}"

3. **Passage**: An object with:
   - sentences: Array of sentence objects, EACH with:
     - id: Unique sentence ID (s1, s2, etc.)
     - words: Array of ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS} word objects, EACH with:
       - id: Unique word ID (s1_w1, s1_w2, etc.)
       - text: The word as displayed AND as it is read aloud. Attach trailing punctuation to the word (e.g., "cat." not "cat" + ".")
       - phonicsPattern: One of: cvc, cvce, sight, blend, digraph, r-controlled, diphthong, other
   - imageDescription: Brief description of the scene

   CRITICAL RULES:
   - EVERY word must be tagged with its phonicsPattern
   - Sight words = words that can't be fully decoded with phonics rules (the, a, is, was, said, to, I, etc.)
   - Punctuation (periods, commas) should be attached to the preceding word's text field
   - Word IDs must be unique across the entire passage
   - Every sentence is ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS} words. One sentence = one thing the child reads aloud.

4. **Phonics Patterns in Passage**: Array of pattern types used (e.g., ["cvc", "sight", "blend"])

5. **Comprehension Type**: ${evalConstraint
    ? `MUST be "${evalConstraint.allowedTypes[0]}". Every comprehension question below MUST genuinely demand this exact reading-comprehension skill (see the COMPREHENSION SKILL section above).`
    : `Pick the comprehension skill that best fits your passage: one of "literal", "sequence", "inference", or "main_idea". Set comprehensionType to that value and make the questions genuinely demand that skill.`}

6. **Comprehension Questions**: EXACTLY ${questionCount} DIFFERENT questions about the passage, each an object with:
   - question: Clear question about the passage content that genuinely requires the comprehensionType skill above. The tutor SAYS this to the child, so write it the way you would ask a five-year-old out loud.
   - answerWord: ${wantsSpokenAnswer
     ? 'The ONE word that answers it, exactly as spelled in the passage. Never "yes" or "no", never a phrase.'
     : 'Leave this out — the answer here is a whole idea, not a word.'}
   - options: Array of 3-4 option objects, each with:
     - id: Letter identifier ("A", "B", "C", "D")
     - text: The option text
     - emoji: ONE emoji that pictures this option, so a K-1 reader can answer by picture (see the emoji rules in the schema). Every option gets a distinct, fair picture — never reuse an emoji and never give only the correct option a "real" picture.
   - correctOptionId: The letter ID of the correct option (e.g., "B")
   - Options are SPOKEN — the tutor reads them out and the child says which one. Keep each to 3-7 words, and give every option at least one key word that appears in NO other option (never let one option's words all appear inside another's).
   - The ${questionCount} questions must ask about DIFFERENT parts of the story — never the same fact worded two ways.
   - Mix up the position of the correct answer across questions and across generations
   - Distractors must be plausible but wrong; NEVER let the correct answer be the only complete or only on-topic option
   - For 'inference'/'main_idea': distractors should be true passage details that don't fully answer the question, so the layout can't reveal the answer

EXAMPLE OUTPUT FOR KINDERGARTEN:
{
  "title": "The Big Red Dog",
  "gradeLevel": "K",
  "passage": {
    "sentences": [
      {
        "id": "s1",
        "words": [
          { "id": "s1_w1", "text": "I", "phonicsPattern": "sight" },
          { "id": "s1_w2", "text": "see", "phonicsPattern": "sight" },
          { "id": "s1_w3", "text": "a", "phonicsPattern": "sight" },
          { "id": "s1_w4", "text": "big", "phonicsPattern": "cvc" },
          { "id": "s1_w5", "text": "red", "phonicsPattern": "cvc" },
          { "id": "s1_w6", "text": "dog.", "phonicsPattern": "cvc" }
        ]
      },
      {
        "id": "s2",
        "words": [
          { "id": "s2_w1", "text": "The", "phonicsPattern": "sight" },
          { "id": "s2_w2", "text": "dog", "phonicsPattern": "cvc" },
          { "id": "s2_w3", "text": "can", "phonicsPattern": "cvc" },
          { "id": "s2_w4", "text": "run.", "phonicsPattern": "cvc" }
        ]
      }
    ],
    "imageDescription": "A happy big red dog running in a green park"
  },
  "phonicsPatternsInPassage": ["cvc", "sight"],
  "comprehensionType": "literal",
  "comprehensionQuestions": [
    {
      "question": "What can the dog do?",
      "answerWord": "run",
      "options": [
        { "id": "A", "text": "The dog can run.", "emoji": "🏃" },
        { "id": "B", "text": "The dog can fly.", "emoji": "🦅" },
        { "id": "C", "text": "The dog can swim.", "emoji": "🏊" }
      ],
      "correctOptionId": "A"
    },
    {
      "question": "What color is the dog?",
      "answerWord": "red",
      "options": [
        { "id": "A", "text": "The dog is red.", "emoji": "🔴" },
        { "id": "B", "text": "The dog is blue.", "emoji": "🔵" },
        { "id": "C", "text": "The dog is green.", "emoji": "🟢" }
      ],
      "correctOptionId": "A"
    }
  ]
}

Now generate a decodable reading passage about "${topic}" at grade level ${gradeLevelKey}. Ensure every word has a phonicsPattern tag, IDs are unique, every sentence is ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS} words, no sentence anywhere begins with "Yes" or "My turn", and the ${questionCount} comprehension questions genuinely demand the required comprehension skill.`;

  // Single call over a complex-but-essential schema (per-word tagging IS the
  // interaction surface, so it can't be flattened). Guard against flash-lite
  // truncation with maxOutputTokens + a short retry, and keep passages short via
  // the grade prompt — rather than splitting into an orchestrator, which would
  // add a passage↔question-consistency merge and 2× the failure surface for a
  // call the probes show is already valid. (Schema-level array bounds via
  // `maxItems` were tried and REJECTED by this @google/genai version with a 400
  // INVALID_ARGUMENT, so the array caps live in the prompt, not the schema.) If
  // grade-2 passages ever truncate despite these guards, THAT is when a
  // passage/question split earns its keep.
  // The retry now covers CONTENT, not just JSON: a passage sentence outside the
  // benched window or opening with a verdict sentinel is a spoken-ask defect,
  // and re-drawing costs one call where dropping costs the child the sentence.
  let result: DecodableReaderData | null = null;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: generationPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: activeSchema,
          maxOutputTokens: 8192,
          systemInstruction: `You are an expert K-2 reading specialist who creates decodable reading passages for a LIVE SPOKEN tutor: the child reads each sentence out loud and the tutor judges it word by word, then asks your comprehension questions aloud. You understand controlled vocabulary, phonics patterns, and developmental reading progression. You write engaging, age-appropriate passages using only words that match the student's current decoding abilities plus appropriate sight words, in sentences short enough to read in one breath. You carefully tag every word with its correct phonics pattern. You craft comprehension questions that assess genuine understanding of the passage content.`,
        }
      });
      const text = response.text;
      if (!text) throw new Error("No data returned from Gemini API");
      const parsed = JSON.parse(text) as DecodableReaderData;
      const issues = contentIssues(parsed, wantsSpokenAnswer);
      result = parsed;
      if (issues.length === 0) break;
      console.warn(
        `[DecodableReader] attempt ${attempt}/2 content issues (${issues.length}):`,
        issues.slice(0, 4),
      );
    } catch (e) {
      lastErr = e;
      console.warn(`[DecodableReader] generation attempt ${attempt}/2 failed:`, e);
    }
  }
  if (!result) {
    console.error("Error generating decodable reader:", lastErr);
    throw lastErr instanceof Error ? lastErr : new Error("decodable-reader generation failed");
  }

  // KEEP-OR-DROP, never backfill. Defaulting `correctOptionId` to the first
  // option (what this used to do) invents an answer key and hands it to a tutor
  // that will state it aloud as fact — the worst possible place for a guess.
  const drawnQuestions = result.comprehensionQuestions ?? [];
  const keptQuestions = drawnQuestions.filter((q) => questionUsable(q, wantsSpokenAnswer));
  if (keptQuestions.length < drawnQuestions.length) {
    console.warn(
      `[DecodableReader] dropped ${drawnQuestions.length - keptQuestions.length} unaskable question(s)`,
    );
  }
  result.comprehensionQuestions = keptQuestions;
  // The one-word answer is spoken and echoed by the tutor — normalise it to the
  // bare word so a stray "the mat"/"mat." never reaches a cue.
  for (const q of keptQuestions) {
    if (q.answerWord) q.answerWord = q.answerWord.trim().replace(/[^a-zA-Z0-9'-]+$/, '');
  }

  // Force the pinned comprehension skill when a mode was explicitly pinned,
  // so a single-mode session never drifts off-skill if Gemini mislabels it.
  if (evalConstraint && evalConstraint.allowedTypes.length === 1) {
    result.comprehensionType =
      evalConstraint.allowedTypes[0] as DecodableReaderData['comprehensionType'];
  }

  // Exclude targetEvalMode from the merged output (it is a routing signal, not data).
  const { targetEvalMode: _unusedEvalMode, ...configRest } = config ?? {};
  void _unusedEvalMode;
  const finalData: DecodableReaderData = {
    ...result,
    ...configRest,
    // Reading mode is authoritative from the routed eval mode, never the merged
    // config, so a stale readingMode can't flip a read-along into a decode task.
    // Named readingMode (not `mode`) to avoid the eval-test challenge-type field
    // collision — `mode` is auto-detected as the challenge type for literacy gens.
    readingMode: isReadAlong ? 'read_along' : 'decode',
    // The kept questions are authoritative over anything merged in, for the same
    // reason: a stale config question would arrive with no gate run over it.
    comprehensionQuestions: keptQuestions,
  };

  console.log('Decodable Reader Generated:', {
    title: finalData.title,
    readingMode: finalData.readingMode,
    comprehensionType: finalData.comprehensionType,
    gradeLevel: finalData.gradeLevel,
    sentenceCount: finalData.passage?.sentences?.length || 0,
    totalWords: finalData.passage?.sentences?.reduce((s, sent) => s + sent.words.length, 0) || 0,
    questionCount: finalData.comprehensionQuestions?.length ?? 0,
    spokenAnswers: (finalData.comprehensionQuestions ?? []).filter((q) => !!q.answerWord).length,
    patterns: finalData.phonicsPatternsInPassage,
  });

  return finalData;
};
