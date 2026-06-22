import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { SentenceBuilderData } from "../../primitives/visual-primitives/literacy/SentenceBuilder";
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
  simple: {
    promptDoc: `"simple": Build simple sentences from tiles (S+V or S+V+O). 3-5 tiles. Grades 1-2.`,
    schemaDescription: "'simple' (subject-verb-object)",
  },
  compound: {
    promptDoc: `"compound": Build compound sentences with coordinating conjunctions (and, but, so, or). Two clauses joined. 6-7 tiles. Grade 3.`,
    schemaDescription: "'compound' (two clauses with conjunction)",
  },
  complex: {
    promptDoc: `"complex": Build complex sentences with subordinating conjunctions (because, when, while, although, if). Independent + dependent clause. 7-8 tiles. Grade 4.`,
    schemaDescription: "'complex' (subordinate clause construction)",
  },
  'compound-complex': {
    promptDoc: `"compound-complex": Build compound-complex sentences combining both patterns. Multiple clauses. 8-10 tiles. Grades 5-6.`,
    schemaDescription: "'compound-complex' (multi-clause sentence)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT numbers
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Support-tier scaffold — which on-screen / instructional helps are withdrawn.
// INVARIANT: a tier only removes scaffolding. It NEVER changes the tiles, the
// validArrangements (the answer the component checks), or the sentence type.
// All levers here are display/instruction-only (the check function reads only
// placedTileIds vs validArrangements, never targetMeaning or hint).
//
// Levers (all instruction-as-scaffold, the only modality a tile-arrangement
// builder exposes — there are no per-tile showOptions in the data):
//   targetMeaningStyle — how the "Build a sentence that means…" prompt is phrased.
//     'literal'   (easy)   : the meaning is given in near-target word order, so the
//                            student maps it almost 1:1 onto the tiles (setup shown).
//     'paraphrase'(medium) : the meaning is a faithful paraphrase in different words,
//                            so the student composes the surface form, not copies it.
//     'abstract'  (hard)   : the meaning is stated as an abstract idea / who-did-what,
//                            so the student builds the whole sentence unaided.
//   hintStyle — how explicit the (optional) hint is.
//     'strategy'  (easy)   : names the build strategy ("start with the subject, then…").
//     'nudge'     (medium) : a conceptual nudge only, no step ordering.
//     'none'      (hard)   : no hint at all — the student justifies the order themselves.
// targetMeaning + hint are DISPLAY-ONLY (never read by handleCheck), so withdrawing
// them changes how unaided the build is without ever changing the checked answer.
// ---------------------------------------------------------------------------

interface SentenceBuilderSupportScaffold {
  targetMeaningStyle: 'literal' | 'paraphrase' | 'abstract';
  hintStyle: 'strategy' | 'nudge' | 'none';
  promptLines: string[];
}

function resolveSupportStructure(
  pinnedType: string,
  tier: SupportTier,
): SentenceBuilderSupportScaffold {
  const lead =
    'This tier changes only how much instructional help the student gets while building. '
    + 'It NEVER changes the tiles, the words, the sentence type, or the valid arrangements (the answer).';

  if (tier === 'easy') {
    return {
      targetMeaningStyle: 'literal',
      hintStyle: 'strategy',
      promptLines: [
        lead,
        'targetMeaning: state the meaning in NEAR-TARGET WORD ORDER (e.g. "The cat chases the mouse"), so the student maps the idea almost one-to-one onto the tiles — the setup is shown.',
        'hint: NAME the build strategy explicitly (e.g. "Start with the subject — who or what is acting? Then the action word, then what receives it.").',
        'Keep the title and description neutral — never state the support level or the answer.',
      ],
    };
  }
  if (tier === 'medium') {
    return {
      targetMeaningStyle: 'paraphrase',
      hintStyle: 'nudge',
      promptLines: [
        lead,
        'targetMeaning: state the meaning as a faithful PARAPHRASE in DIFFERENT words from the tiles (e.g. "A cat is going after a mouse"), so the student composes the surface form rather than copying word order.',
        'hint: a conceptual NUDGE only — point at sentence structure without naming the build order (e.g. "Think about which part of the sentence comes first.").',
        'Keep the title and description neutral — never state the support level or the answer.',
      ],
    };
  }
  // hard
  return {
    targetMeaningStyle: 'abstract',
    hintStyle: 'none',
    promptLines: [
      lead,
      'targetMeaning: state the meaning as an ABSTRACT idea / who-did-what (e.g. "a predator pursuing its prey"), so the student builds the whole sentence and its order unaided — the setup is withdrawn.',
      'hint: provide NO hint — leave it empty so the student justifies the word order themselves.',
      'Keep the title and description neutral — never state the support level or the answer.',
    ],
  };
}

/**
 * Schema definition for Sentence Builder Data
 *
 * This schema defines the structure for interactive sentence construction,
 * designed for grades 1-6 literacy instruction. Students build grammatically
 * correct sentences from word/phrase tiles, learning parts of speech and
 * sentence structure through progressive difficulty phases.
 */
const sentenceBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the sentence building activity (e.g., 'Building Simple Sentences')"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level (e.g., '1', '2', '3', '4', '5', '6')"
    },
    sentenceType: {
      type: Type.STRING,
      enum: ["simple", "compound", "complex", "compound-complex"],
      description: "Type of sentences students will build"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this challenge (e.g., 'ch1', 'ch2')"
          },
          targetMeaning: {
            type: Type.STRING,
            description: "Clear description of what the sentence should express (e.g., 'A dog is running fast')"
          },
          tiles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Unique tile identifier (e.g., 't1', 't2')"
                },
                text: {
                  type: Type.STRING,
                  description: "The word or phrase on the tile"
                },
                role: {
                  type: Type.STRING,
                  enum: ["subject", "predicate", "object", "modifier", "conjunction", "punctuation"],
                  description: "Grammatical role of this tile"
                }
              },
              required: ["id", "text", "role"]
            },
            description: "Array of word/phrase tiles that can be arranged into sentences"
          },
          validArrangements: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            },
            description: "Array of valid tile ID orderings. Each sub-array is one valid arrangement of tile IDs."
          },
          hint: {
            type: Type.STRING,
            description: "Optional hint to help students (e.g., 'Start with the subject - who or what is doing something?')"
          }
        },
        required: ["id", "targetMeaning", "tiles", "validArrangements"]
      },
      description: "Array of 3-4 sentence-building challenges"
    },
    roleColors: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        predicate: { type: Type.STRING },
        object: { type: Type.STRING },
        modifier: { type: Type.STRING },
        conjunction: { type: Type.STRING },
        punctuation: { type: Type.STRING }
      },
      description: "Color labels for each grammatical role (e.g., subject: 'blue')"
    }
  },
  required: ["title", "gradeLevel", "sentenceType", "challenges", "roleColors"]
};

/**
 * Generate sentence builder data using Gemini AI
 *
 * Creates interactive sentence construction activities that scale from
 * grade 1 (simple S+V, 3-4 tiles) through grade 6 (compound-complex, 8-10 tiles).
 *
 * The builder follows a 3-phase learning progression:
 * - Explore: Fill in one missing part of a complete sentence
 * - Practice: Build sentences from a tile bank to match a target meaning
 * - Apply: Build original sentences with the same structure
 *
 * @param topic - Sentence building topic or theme (e.g., "Animals at the Zoo", "Weather")
 * @param gradeLevel - Grade level ('1' through '6') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns SentenceBuilderData with grade-appropriate sentence challenges
 */
export const generateSentenceBuilder = async (
  topic: string,
  gradeLevel: string = '2',
  config?: Partial<SentenceBuilderData & {
    targetEvalMode: string;
    /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second axis: difficulty = how much scaffolding within the mode. NEVER changes numbers/tiles. */
    difficulty: string;
  }>
): Promise<SentenceBuilderData> => {

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'sentence-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SentenceBuilder', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(sentenceBuilderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'sentenceType',
        rootLevel: true,
      })
    : sentenceBuilderSchema;

  // Grade-specific complexity guidelines
  const gradeContext: Record<string, string> = {
    '1': `
GRADE 1 GUIDELINES:
- Sentence type: simple (S + V pattern)
- 3-4 tiles per challenge (e.g., "The dog" + "runs" + ".")
- Use high-frequency sight words and CVC words students know
- Tiles should be whole phrases for subject (e.g., "The cat") rather than individual words
- Focus on basic SVO pattern: subject phrase + action verb + punctuation
- Use familiar, concrete nouns: dog, cat, boy, girl, mom, dad
- Use simple present-tense verbs: runs, jumps, eats, sits, plays
- Always include a period tile as punctuation
- Sentences should be 3-5 words total
- 3 challenges per session
- Example: tiles = ["The dog", "runs", "."] -> valid arrangement: [t1, t2, t3]
`,
    '2': `
GRADE 2 GUIDELINES:
- Sentence type: simple (S + V + O pattern)
- 4-5 tiles per challenge
- Introduce separate subject and predicate tiles
- Add object tiles: "The dog" + "chases" + "the cat" + "."
- Use grade-appropriate vocabulary
- Include modifier tiles for some challenges (adjectives): "The big dog" or "quickly"
- Sentences should be 4-7 words total
- 3-4 challenges per session
- Example: tiles = ["The boy", "kicks", "the ball", "."] -> valid: [t1, t2, t3, t4]
`,
    '3': `
GRADE 3 GUIDELINES:
- Sentence type: compound (two clauses joined by conjunction)
- 6-7 tiles per challenge
- Introduce conjunction tiles: "and", "but", "so", "or"
- Two simple clauses connected by a conjunction
- Example: "The cat sat" + "on the mat" + "," + "and" + "the dog" + "ran outside" + "."
- Sentences should be 8-12 words total
- 3-4 challenges per session
- Include comma tiles where appropriate
- Roles: subject, predicate, object, conjunction, punctuation
`,
    '4': `
GRADE 4 GUIDELINES:
- Sentence type: complex (independent + dependent clause)
- 7-8 tiles per challenge
- Introduce subordinating conjunctions: "because", "when", "while", "although", "if"
- Include dependent clause tiles and independent clause tiles
- Example: "Because it was raining" + "," + "the children" + "played" + "inside" + "."
- Sentences should be 10-15 words total
- 3-4 challenges per session
- Modifier tiles for adverbs and adjective phrases
`,
    '5': `
GRADE 5 GUIDELINES:
- Sentence type: compound-complex
- 8-10 tiles per challenge
- Combine compound structure (conjunction) with complex structure (subordinate clause)
- Example: "Although the storm was fierce" + "," + "the sailors" + "held on" + "," + "and" + "the ship" + "survived" + "."
- Sentences should be 12-18 words total
- 3-4 challenges per session
- Rich vocabulary appropriate for grade 5 reading level
`,
    '6': `
GRADE 6 GUIDELINES:
- Sentence type: compound-complex
- 8-10 tiles per challenge
- Complex sentence structures with multiple clauses
- Use sophisticated vocabulary and varied sentence patterns
- Include appositives, participial phrases, and relative clauses as tiles
- Example: "When the experiment began" + "," + "the students" + "observed carefully" + "," + "and" + "they recorded" + "their findings" + "in notebooks" + "."
- Sentences should be 14-20 words total
- 3-4 challenges per session
- Academic language appropriate for grade 6
`
  };

  const gradeLevelKey = ['1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '2';
  const sentenceTypeForGrade = gradeLevelKey <= '2' ? 'simple' : gradeLevelKey === '3' ? 'compound' : gradeLevelKey === '4' ? 'complex' : 'compound-complex';

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT numbers.
  //    pinnedType drives prompt TONE only; the actual withdrawal is applied
  //    deterministically per-challenge at the END of the generator. The tier is a
  //    STUDENT property — applied whenever supportTier is present (blended too). ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: string | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? evalConstraint.allowedTypes[0]
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number/tile size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const generationPrompt = `Create an interactive sentence builder activity for: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${!evalConstraint ? (gradeContext[gradeLevelKey] || gradeContext['2']) : ''}

${challengeTypeSection}
${tierSection}
REQUIRED INFORMATION:

1. **Title**: An engaging, kid-friendly title for the activity

2. **Grade Level**: "${gradeLevelKey}"

3. **Sentence Type**: "${evalConstraint ? evalConstraint.allowedTypes[0] : sentenceTypeForGrade}"

4. **Challenges** (3-4 challenges):
   For EACH challenge provide:
   - id: Unique identifier (ch1, ch2, ch3, etc.)
   - targetMeaning: A clear description of what the completed sentence should express
   - tiles: Array of word/phrase tiles, EACH with:
     - id: Unique tile identifier (t1, t2, t3, etc.) - use UNIQUE ids across ALL challenges (e.g., ch1_t1, ch1_t2 for challenge 1)
     - text: The word or phrase on the tile
     - role: One of: subject, predicate, object, modifier, conjunction, punctuation
   - validArrangements: Array of valid tile ID orderings (at least 1 valid arrangement per challenge)
   - hint: Optional hint to help the student

   CRITICAL TILE RULES:
   - Tile IDs must be unique WITHIN each challenge (use pattern: ch1_t1, ch1_t2, etc.)
   - Every tile in the challenge MUST appear exactly once in each valid arrangement
   - Valid arrangements must produce grammatically correct, meaningful sentences
   - Include punctuation tiles (period, comma, exclamation mark) as separate tiles
   - For grades 1-2: group words into phrase tiles (e.g., "The big dog" as one subject tile)
   - For grades 3+: can have more granular tiles but keep phrases that naturally group together
   - ALWAYS provide at least one valid arrangement per challenge

   ROLE ASSIGNMENT RULES:
   - subject: The noun phrase performing the action (e.g., "The cat", "My friend")
   - predicate: The verb or verb phrase (e.g., "runs", "is eating", "chased")
   - object: The noun phrase receiving the action (e.g., "the ball", "a sandwich")
   - modifier: Adjectives, adverbs, or prepositional phrases (e.g., "quickly", "in the park")
   - conjunction: Coordinating or subordinating conjunctions (e.g., "and", "because", "but")
   - punctuation: Period, comma, exclamation mark, question mark

5. **Role Colors**: Always provide this exact mapping:
   {
     "subject": "blue",
     "predicate": "red",
     "object": "green",
     "modifier": "yellow",
     "conjunction": "purple",
     "punctuation": "gray"
   }

EXAMPLE OUTPUT FOR GRADE 2:

{
  "title": "Animal Action Sentences",
  "gradeLevel": "2",
  "sentenceType": "simple",
  "challenges": [
    {
      "id": "ch1",
      "targetMeaning": "A cat is chasing a mouse",
      "tiles": [
        { "id": "ch1_t1", "text": "The cat", "role": "subject" },
        { "id": "ch1_t2", "text": "chases", "role": "predicate" },
        { "id": "ch1_t3", "text": "the mouse", "role": "object" },
        { "id": "ch1_t4", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [["ch1_t1", "ch1_t2", "ch1_t3", "ch1_t4"]],
      "hint": "Who is doing the action? Start with the subject!"
    },
    {
      "id": "ch2",
      "targetMeaning": "A bird is flying in the sky",
      "tiles": [
        { "id": "ch2_t1", "text": "The bird", "role": "subject" },
        { "id": "ch2_t2", "text": "flies", "role": "predicate" },
        { "id": "ch2_t3", "text": "in the sky", "role": "modifier" },
        { "id": "ch2_t4", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [["ch2_t1", "ch2_t2", "ch2_t3", "ch2_t4"]],
      "hint": "Think about what the bird is doing and where."
    },
    {
      "id": "ch3",
      "targetMeaning": "A fish swims quickly through the water",
      "tiles": [
        { "id": "ch3_t1", "text": "The fish", "role": "subject" },
        { "id": "ch3_t2", "text": "swims", "role": "predicate" },
        { "id": "ch3_t3", "text": "quickly", "role": "modifier" },
        { "id": "ch3_t4", "text": "through the water", "role": "modifier" },
        { "id": "ch3_t5", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [
        ["ch3_t1", "ch3_t2", "ch3_t3", "ch3_t4", "ch3_t5"],
        ["ch3_t1", "ch3_t3", "ch3_t2", "ch3_t4", "ch3_t5"]
      ],
      "hint": "The fish is the subject. What does it do?"
    }
  ],
  "roleColors": {
    "subject": "blue",
    "predicate": "red",
    "object": "green",
    "modifier": "yellow",
    "conjunction": "purple",
    "punctuation": "gray"
  }
}

EXAMPLE OUTPUT FOR GRADE 4 (Complex):

{
  "title": "Weather and Seasons Sentences",
  "gradeLevel": "4",
  "sentenceType": "complex",
  "challenges": [
    {
      "id": "ch1",
      "targetMeaning": "Because it was raining, the children stayed inside",
      "tiles": [
        { "id": "ch1_t1", "text": "Because", "role": "conjunction" },
        { "id": "ch1_t2", "text": "it was raining", "role": "predicate" },
        { "id": "ch1_t3", "text": ",", "role": "punctuation" },
        { "id": "ch1_t4", "text": "the children", "role": "subject" },
        { "id": "ch1_t5", "text": "stayed", "role": "predicate" },
        { "id": "ch1_t6", "text": "inside", "role": "modifier" },
        { "id": "ch1_t7", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [
        ["ch1_t1", "ch1_t2", "ch1_t3", "ch1_t4", "ch1_t5", "ch1_t6", "ch1_t7"],
        ["ch1_t4", "ch1_t5", "ch1_t6", "ch1_t1", "ch1_t2", "ch1_t7"]
      ],
      "hint": "A complex sentence has a dependent clause (starts with 'because', 'when', etc.) and an independent clause."
    }
  ],
  "roleColors": {
    "subject": "blue",
    "predicate": "red",
    "object": "green",
    "modifier": "yellow",
    "conjunction": "purple",
    "punctuation": "gray"
  }
}

Now generate a sentence builder activity for "${topic}" at grade level ${gradeLevelKey}. Make sure every tile ID is unique within its challenge and every valid arrangement uses ALL tile IDs from that challenge exactly once.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-6 English Language Arts educator specializing in grammar instruction and sentence construction. You create engaging, age-appropriate sentence building activities that teach students about parts of speech, sentence structure, and grammatical patterns. You understand developmental progression from simple subject-verb sentences in grade 1 through compound-complex structures in grade 6. You make grammar fun and accessible, using topics and vocabulary that excite young learners. You always ensure grammatical accuracy and provide clear, helpful hints.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as SentenceBuilderData;

    // Merge with any config overrides (excluding targetEvalMode + difficulty —
    // difficulty is the support-tier axis, applied below, not a data passthrough).
    const { targetEvalMode: _unused, difficulty: _unusedTier, ...configRest } = config ?? {};
    void _unused;
    void _unusedTier;
    const finalData: SentenceBuilderData = {
      ...result,
      ...configRest,
      // Tell the live tutor the support level whenever a tier is present (blended
      // sessions too — the tutor reveal policy is tier-aware).
      ...(supportTier ? { supportTier } : {}),
    };

    // ── Within-mode support tier: deterministically enforce the withdrawals the
    //    LLM cannot be trusted to honor (the hint-explicitness floor). Applied
    //    PER CHALLENGE from each challenge's OWN sentence type so a blended session
    //    gets difficulty too. Display-only fields — never touches tiles or
    //    validArrangements (the checked answer). Code owns the STRUCTURE; the LLM
    //    only chose the words (targetMeaning paraphrase/abstraction lives in the
    //    prompt — prose can't be reconstructed deterministically without breaking
    //    grammaticality, so it is prompt-enforced; the hard hint-removal IS code). ──
    if (supportTier && Array.isArray(finalData.challenges)) {
      const sc = resolveSupportStructure(finalData.sentenceType, supportTier);
      for (const ch of finalData.challenges) {
        if (sc.hintStyle === 'none') {
          // Hard: no hint at all — strip it so the Hint button never offers help.
          delete ch.hint;
        }
        // 'strategy' / 'nudge' hints are authored by the LLM under the tierSection;
        // a missing-hint fallback is fine (component just hides the Hint button).
      }
      console.log(`[sentence-builder] Support tier "${supportTier}" applied per-challenge (${pinnedType ? 'single-mode ' + pinnedType : 'blended'})`);
    }

    console.log('Sentence Builder Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      sentenceType: finalData.sentenceType,
      challengeCount: finalData.challenges?.length || 0,
      tilesPerChallenge: finalData.challenges?.map(ch => ch.tiles.length) || [],
    });

    return finalData;

  } catch (error) {
    console.error("Error generating sentence builder:", error);
    throw error;
  }
};
