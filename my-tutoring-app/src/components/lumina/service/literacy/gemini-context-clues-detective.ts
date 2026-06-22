import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { ContextCluesDetectiveData } from "../../primitives/visual-primitives/literacy/ContextCluesDetective";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  definition: {
    promptDoc: `"definition": The word is directly explained in the text. The passage contains an explicit definition or restatement of the target word. Simplest clue type — grades 2-3.`,
    schemaDescription: "'definition' (meaning stated directly in text)",
  },
  synonym: {
    promptDoc: `"synonym": A similar word appears near the target word. The passage uses a synonym or near-synonym to clarify meaning. Grades 3-4.`,
    schemaDescription: "'synonym' (meaning from similar word nearby)",
  },
  antonym: {
    promptDoc: `"antonym": An opposite word creates contrast that clarifies the target word's meaning. Uses "unlike", "but", "however" signal words. Grades 4-5.`,
    schemaDescription: "'antonym' (meaning from opposite/contrast)",
  },
  example: {
    promptDoc: `"example": Examples in the text clarify the target word's meaning. Uses "such as", "for example", "including" signal phrases. Grades 2-4.`,
    schemaDescription: "'example' (meaning from given examples)",
  },
  inference: {
    promptDoc: `"inference": Meaning must be inferred from broader context — not directly stated. Requires combining clues from multiple sentences. Hardest type — grades 5-6.`,
    schemaDescription: "'inference' (meaning from broader context)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode difficulty (config.difficulty) — TWO axes on one dial.
// Second field of the two-field contract: targetEvalMode = which clue type the
// student practises (the TASK IDENTITY — definition vs synonym/antonym vs example
// vs inference); difficulty = how hard a problem of THAT clue type to face.
//
//   Axis 1 (scaffolding, /add-support-tiers): how much on-screen help is shown
//           — clue-sentence tint, type descriptions, named strategy. Display-only.
//   Axis 2 (problem SHAPE, /add-structural-difficulty): how hard the SAME clue
//           type is, structurally — how far the clue sits from the target word
//           (search/dispersion) and how near the wrong meaning options sit to the
//           right one (distractor proximity). SHAPE changes; MAGNITUDE (passage
//           length, grade-band vocabulary) and the clue TYPE never change.
//
// TIER_GUARDRAIL (the one hard rule): a tier reshapes the problem (clue distance,
// distractor closeness) but NEVER scales magnitude (passage length / word grade
// band stays owned by the eval mode + grade) and NEVER turns one clue type into
// another (the clue type IS the eval mode — moving definition→inference is a
// forbidden eval-mode jump, not a difficulty tier). The clue type, the correct
// meaning, and which sentence is genuinely the clue are always exactly as the LLM
// authored them — the answer is recomputed from the LLM's own self-consistent text,
// never reconstructed in code (narrative re-assembly desyncs the story; see
// [[project_structural-difficulty-story-primitives]]). Axis 2 here is therefore a
// SCHEMA-/PROMPT-shaped lever the code COUNTS + VALIDATES + clamps, not rebuilds.
// ---------------------------------------------------------------------------
const TIER_GUARDRAIL =
  'A tier changes the problem SHAPE (how far the clue sits from the target word; how '
  + 'near the wrong meaning options are to the right one) and how much on-screen help '
  + 'is shown. It NEVER changes the passage length, the grade-band vocabulary, the clue '
  + 'TYPE, the correct meaning, or which sentence is the genuine clue. Harder = a subtler, '
  + 'farther-dispersed problem of the SAME clue type, not a longer passage or a different clue type.';

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Bespoke support scaffold — which on-screen helps are withdrawn per tier.
// Three withdrawals mapped to the primitive's three solver phases:
//   FIND     → showClueHints:        pre-tint the real clue sentence(s) so the
//              student can self-check their search (#1 perception aid).
//   CLASSIFY → showClueTypeDescriptions: show what each clue type means under its
//              label vs. bare labels — recall the types unaided (#2 instruction).
//   DEFINE   → strategyHint:         name the reading strategy ("look for the
//              synonym near the word") vs. withhold it (#2 instruction).
// INVARIANT: a tier sets ONLY these fields. It never touches passage sentences,
// clueType, clueSentenceIds, targetWord, correctMeaning, or meaningOptions — those
// remain exactly as the LLM authored them (the answer is untouched at every tier).
// ---------------------------------------------------------------------------

interface ContextCluesSupportScaffold {
  /** FIND: pre-tint the clue sentence(s) (easy/medium) vs. bare passage (hard). */
  showClueHints: boolean;
  /** CLASSIFY: show per-type descriptions (easy) vs. bare type labels (medium/hard). */
  showClueTypeDescriptions: boolean;
  /** DEFINE: emit a named-strategy nudge keyed to the clue type (easy only). */
  nameStrategy: boolean;
  promptLines: string[];
}

/** Per-clue-type strategy nudge for the DEFINE phase. Tells the student HOW to read
 *  the clue WITHOUT stating the meaning. Easy tier only. */
const STRATEGY_HINT_BY_TYPE: Record<string, string> = {
  definition: 'Strategy: find the sentence that explains the word in plain words right where it appears.',
  synonym: 'Strategy: look for a familiar word nearby that means about the same thing.',
  antonym: 'Strategy: find the opposite word (look for "unlike", "but", "however") and flip it.',
  example: 'Strategy: read the examples ("such as", "like") and ask what they have in common.',
  inference: 'Strategy: gather hints across the sentences and reason out what fits.',
};

function resolveSupportStructure(
  pinnedType: string,
  tier: SupportTier,
): ContextCluesSupportScaffold {
  const lead =
    'This tier changes only how much on-screen help the student gets. It NEVER changes '
    + 'the passage text, the clue type, the target word, which sentence is the clue, or the meaning.';

  // FIND-phase clue cue: shown at easy & medium, withdrawn at hard.
  const showClueHints = tier !== 'hard';
  // CLASSIFY-phase type descriptions: shown only at easy.
  const showClueTypeDescriptions = tier === 'easy';
  // DEFINE-phase strategy naming: named only at easy.
  const nameStrategy = tier === 'easy';

  return {
    showClueHints,
    showClueTypeDescriptions,
    nameStrategy,
    promptLines: [
      lead,
      `FIND phase: the actual clue sentence(s) are ${showClueHints ? 'faintly cued so the student can confirm their search' : 'NOT cued — the student locates the clue sentence unaided'}.`,
      `CLASSIFY phase: the explanation of what each clue type means is ${showClueTypeDescriptions ? 'shown under each type label' : 'withdrawn — only the bare type names are shown, so the student recalls the clue types from memory'}.`,
      `DEFINE phase: the reading strategy for this clue type is ${nameStrategy ? 'named for the student' : 'NOT named — the student decides how to use the clue and justifies the meaning themselves'}.`,
      'Keep the title and description neutral — never state the support level, the clue type, or the answer.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Axis 2 — STRUCTURAL difficulty (problem shape, NOT magnitude, NOT clue type).
//
// One in-mode lever, applied within EVERY clue type (the eval mode is held fixed):
//   • clueGap  — how many sentences separate the genuine clue sentence from the
//                target-word sentence. easy: gap 0 (clue co-located in the target
//                sentence, self-contained); medium: gap 1 (clue adjacent); hard:
//                gap ≥2 (clue dispersed, non-adjacent, with distractor sentences
//                between it and the target word — the student must search).
//   • nearDistractors — how plausible the WRONG meaning options are. easy: far
//                (unrelated semantic field); medium: mixed; hard: near (same field,
//                differ on one feature — a real read-the-clue decision).
//   • clueCount (inference only) — how many clue sentences must be COMBINED. The
//                identity of inference is "combine clues across sentences", so its
//                floor is ≥1 and hard pushes the synthesis breadth, never the type.
//
// MAGNITUDE (passage length, grade-band vocabulary) is owned by the eval mode +
// grade and is the CAP: clueGap clamps to [0, passageLen-2] so the clue always fits
// inside the existing passage — a tier never lengthens the passage. The lever
// SATURATES honestly at the small end: a grade-2 3-sentence passage caps clueGap at
// 1, so its "hard" gap is 1, not a forced overflow.
//
// This lever is SCHEMA-/PROMPT-shaped (passage text is answer-bearing and cannot be
// safely reconstructed in code). The post-process COUNTS the LLM's actual gap and
// VALIDATES it against the clamped target — it never rewrites a sentence, so the
// correct meaning + clueType + clue sentence stay exactly as the LLM authored them.
// ---------------------------------------------------------------------------

interface ContextCluesProblemShape {
  /** Target sentence-distance between the genuine clue and the target word, clamped to band. */
  clueGapTarget: number;
  /** Whether wrong meaning options should sit near (plausible, same field) the right one. */
  nearDistractors: boolean;
  /** Inference only: how many clue sentences must be combined (floor 1). */
  clueCountTarget: number;
  promptLines: string[];
}

/** Per-grade passage length (sentence count) the grade context already asks for.
 *  Used ONLY as the magnitude CAP for the gap lever — never to change the passage. */
const PASSAGE_LEN_BY_GRADE: Record<string, number> = {
  '2': 3, '3': 4, '4': 5, '5': 6, '6': 7,
};

/** Clamp helper. */
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * resolveProblemShape — one tier → one structural intent, CLAMPED to the band.
 * The gap cap is (passageLen-2): the clue + the target sentence must both fit, so
 * the deepest legal gap leaves at least the clue and target sentences in the passage.
 * Saturates honestly: a short grade-2 passage caps the hard gap at 1.
 */
function resolveProblemShape(
  clueType: string,
  tier: SupportTier,
  passageLen: number,
): ContextCluesProblemShape {
  const gapCap = Math.max(0, passageLen - 2); // never lengthens the passage
  const isInference = clueType === 'inference';

  // Raw (pre-clamp) lever intents per tier.
  const rawGap = tier === 'easy' ? 0 : tier === 'medium' ? 1 : 2;
  const clueGapTarget = clamp(rawGap, 0, gapCap);
  const nearDistractors = tier === 'hard';

  // Inference's identity is "combine clues" → floor 1, hard widens synthesis.
  // Cap at passageLen-1 (can't be more clue sentences than non-target sentences).
  const clueCountCap = Math.max(1, passageLen - 1);
  const rawClueCount = isInference
    ? (tier === 'easy' ? 1 : tier === 'medium' ? 2 : 3)
    : 1;
  const clueCountTarget = clamp(rawClueCount, 1, clueCountCap);

  const gapPhrase =
    clueGapTarget === 0
      ? 'in the SAME sentence as the target word (self-contained, easiest to spot)'
      : clueGapTarget === 1
        ? 'in a sentence ADJACENT to the target word (one sentence away)'
        : `in a NON-ADJACENT sentence, at least ${clueGapTarget} sentences away from the target word, with topically-relevant NON-clue sentences in between so the student must search`;

  const distractorPhrase = nearDistractors
    ? 'NEAR distractors: the 3 wrong meaning options sit in the SAME semantic field as the correct meaning and differ on only ONE feature, so the student must actually read the clue to choose (still clearly wrong in context — never ambiguous).'
    : tier === 'medium'
      ? 'MIXED distractors: one wrong option is plausibly close, the others clearly unrelated.'
      : 'FAR distractors: the 3 wrong meaning options are clearly unrelated to the correct meaning (different topic/field).';

  const lines = [
    TIER_GUARDRAIL,
    `Structural difficulty for this clue type is "${tier}". Keep the clue TYPE, the passage LENGTH (${passageLen} sentences), and the grade-band vocabulary exactly as specified above — only the SHAPE below changes.`,
    `CLUE PLACEMENT: place the genuine context clue ${gapPhrase}. The clue must still be a true ${clueType} clue and must genuinely determine the meaning.`,
    distractorPhrase,
  ];
  if (isInference) {
    lines.push(
      `INFERENCE SYNTHESIS: the meaning must be combined from ${clueCountTarget} clue sentence${clueCountTarget > 1 ? 's' : ''} (list all of them in clueSentenceIds); never state the meaning directly.`,
    );
  }

  return { clueGapTarget, nearDistractors, clueCountTarget, promptLines: lines };
}

/**
 * Sentence-distance counter (validation only). Returns the MINIMUM gap between any
 * genuine clue sentence and the target sentence by position index, or null if the
 * shape can't be measured. The post-process uses this to LOG claimed-vs-actual; it
 * never rewrites sentences (passage text is answer-bearing and LLM-authored).
 */
function measureClueGap(ch: {
  passage?: { sentences?: Array<{ id: string }> };
  targetWordSentenceId?: string;
  clueSentenceIds?: string[];
}): number | null {
  const sentences = ch.passage?.sentences;
  if (!Array.isArray(sentences) || sentences.length === 0) return null;
  const idx = new Map(sentences.map((s, i) => [s.id, i] as const));
  const targetIdx = ch.targetWordSentenceId != null ? idx.get(ch.targetWordSentenceId) : undefined;
  if (targetIdx == null) return null;
  const clueIdxs = (ch.clueSentenceIds ?? [])
    .map((id) => idx.get(id))
    .filter((i): i is number => i != null);
  if (clueIdxs.length === 0) return null;
  // Distance counts the NON-clue sentences strictly between the clue and the target.
  return Math.min(...clueIdxs.map((ci) => Math.abs(ci - targetIdx)));
}

/**
 * Schema definition for Context Clues Detective Data
 *
 * Generates vocabulary-in-context activities where students encounter
 * unfamiliar words in passages and determine meaning using context clues.
 * Teaches clue types: definition, synonym, antonym, example, inference.
 */
const contextCluesDetectiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the context clues activity"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level ('2' through '6')"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'ch1', 'ch2')"
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
                      description: "Unique sentence ID (e.g., 'ch1_s1')"
                    },
                    text: {
                      type: Type.STRING,
                      description: "The sentence text"
                    },
                    isClue: {
                      type: Type.BOOLEAN,
                      description: "Whether this sentence contains a context clue for the target word"
                    }
                  },
                  required: ["id", "text", "isClue"]
                }
              }
            },
            required: ["sentences"]
          },
          targetWord: {
            type: Type.STRING,
            description: "The unfamiliar/challenging word students must define"
          },
          targetWordSentenceId: {
            type: Type.STRING,
            description: "ID of the sentence that contains the target word"
          },
          clueType: {
            type: Type.STRING,
            enum: ["definition", "synonym", "antonym", "example", "inference"],
            description: "The type of context clue present in the passage"
          },
          clueSentenceIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "IDs of sentences that contain context clues"
          },
          correctMeaning: {
            type: Type.STRING,
            description: "The correct meaning/definition of the target word"
          },
          meaningOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Multiple-choice meaning options (4 options, one correct)"
          },
          acceptableMeanings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Alternative acceptable meanings"
          },
          dictionaryDefinition: {
            type: Type.STRING,
            description: "Standard dictionary definition for comparison"
          }
        },
        required: [
          "id", "passage", "targetWord", "targetWordSentenceId",
          "clueType", "clueSentenceIds", "correctMeaning",
          "meaningOptions", "dictionaryDefinition"
        ]
      },
      description: "Array of 3-4 word challenges"
    }
  },
  required: ["title", "gradeLevel", "challenges"]
};

/**
 * Generate context clues detective data using Gemini AI
 *
 * Creates vocabulary-in-context activities that teach students to determine
 * word meaning from surrounding text. Scales from simple definition clues
 * (grade 2) through inference and connotation (grade 6).
 *
 * @param topic - Theme for the passages (e.g., "Ocean Animals", "Space Exploration")
 * @param gradeLevel - Grade level ('2' through '6') determines word difficulty and clue types
 * @param config - Optional partial configuration to override generated values
 * @returns ContextCluesDetectiveData with passages, target words, and clue information
 */
export const generateContextCluesDetective = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<ContextCluesDetectiveData & {
    targetEvalMode: string;
    /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second axis: difficulty = how much scaffolding within the mode. NEVER changes numbers (here: never changes the passage, clue type, or meaning). */
    difficulty?: string;
  }>
): Promise<ContextCluesDetectiveData> => {

  const gradeContext: Record<string, string> = {
    '2': `
GRADE 2 GUIDELINES:
- 3 challenges, each with 3-4 sentence passages
- Target words: slightly above grade level but deducible from context
- Clue types: ONLY "definition" and "example" clues (simplest types)
- Definition clue: the word is directly explained in the text ("A habitat, which is a place where an animal lives, ...")
- Example clue: examples clarify the word ("Reptiles, such as snakes, lizards, and turtles, ...")
- Meaning options: 4 choices, one correct, distractors are plausible but clearly wrong
- Simple, short sentences. Concrete nouns and verbs.
- Pattern: "The word ___ means ___ because the sentence says ___"
`,
    '3': `
GRADE 3 GUIDELINES:
- 3-4 challenges, each with 4-5 sentence passages
- Target words: grade 3 vocabulary (e.g., "enormous", "ancient", "fragile")
- Clue types: "definition", "example", and "synonym" clues
- Synonym clue: a similar word appears nearby ("The enormous, or very large, dinosaur...")
- Include one definition and one synonym clue minimum
- Meaning options: 4 choices
- Clue sentence should be near the target word sentence
`,
    '4': `
GRADE 4 GUIDELINES:
- 3-4 challenges, each with 5-6 sentence passages
- Target words: grade 4 academic vocabulary (e.g., "persevere", "abundant", "treacherous")
- Clue types: all five types - "definition", "synonym", "antonym", "example", "inference"
- Antonym clue: an opposite word creates contrast ("Unlike the barren desert, the rainforest was lush...")
- Include at least one antonym clue
- Multiple clues may support the same word (list multiple clueSentenceIds)
- Meaning options: 4 choices with closer distractors
`,
    '5': `
GRADE 5 GUIDELINES:
- 3-4 challenges, each with 5-7 sentence passages
- Target words: grade 5 vocabulary, including words with Greek/Latin roots
- Clue types: emphasis on "inference" and "antonym" (harder types)
- Inference clue: meaning must be inferred from broader context, not directly stated
- Include root connection hints where relevant
- Meaning options: 4 choices with subtle distinctions
- Passages should be more complex with compound sentences
`,
    '6': `
GRADE 6 GUIDELINES:
- 3-4 challenges, each with 6-8 sentence passages
- Target words: grade 6 academic and literary vocabulary (e.g., "ominous", "benevolent", "pragmatic")
- Clue types: all types, emphasis on "inference" and connotation vs denotation
- Include words with multiple meanings where context resolves the correct one
- Technical vocabulary in context (scientific, historical terms)
- Meaning options: 4 choices with nuanced distinctions
- More sophisticated passages with varied sentence structure
`
  };

  const evalConstraint = resolveEvalModeConstraint(
    'context-clues-detective',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ContextCluesDetective', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(contextCluesDetectiveSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'clueType',
      })
    : contextCluesDetectiveSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT content.
  //    pinnedType (the single pinned clue type, if any) drives the prompt TONE only;
  //    the withdrawal itself is applied deterministically per challenge at the END,
  //    so a blended/auto session (no single pin) still gets its difficulty. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? evalConstraint.allowedTypes[0]
      : undefined;
  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';
  const passageLen = PASSAGE_LEN_BY_GRADE[gradeLevelKey] ?? 4;

  // One key (the tier ENUM), two axes, ONE coherent prompt block: scaffolding
  // withdrawal (axis 1) + problem shape (axis 2). Both keyed on the pinned clue
  // type when a single mode is pinned; the per-challenge post-process re-resolves
  // each axis from each challenge's OWN clueType so blended sessions get both too.
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier, passageLen)
    : null;
  const tierSection = (tierScaffold || tierShape)
    ? `\n## WITHIN-MODE DIFFICULTY (problem SHAPE + scaffolding — NEVER the clue type or answer)\n`
      + (tierShape ? `### Problem shape (structural difficulty)\n${tierShape.promptLines.map((l) => `- ${l}`).join('\n')}\n` : '')
      + (tierScaffold ? `### On-screen support (scaffolding level)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n` : '')
    : '';

  const generationPrompt = `Create a context clues detective activity about: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeContext[gradeLevelKey] || gradeContext['3']}
${challengeTypeSection}
${tierSection}
REQUIRED INFORMATION:

1. **Title**: Engaging detective-themed title

2. **Grade Level**: "${gradeLevelKey}"

3. **Challenges** (3-4 challenges):
   For EACH challenge provide:
   - id: Unique ID (ch1, ch2, etc.)
   - passage: Object with sentences array. Each sentence has:
     - id: Unique sentence ID (ch1_s1, ch1_s2, etc.)
     - text: The sentence text
     - isClue: true if this sentence contains a context clue for the target word
   - targetWord: The unfamiliar word to investigate
   - targetWordSentenceId: ID of the sentence containing the target word
   - clueType: One of "definition", "synonym", "antonym", "example", "inference"
   - clueSentenceIds: Array of sentence IDs containing context clues
   - correctMeaning: The word's meaning as derivable from context
   - meaningOptions: 4 multiple-choice options (correctMeaning must be one of them)
   - acceptableMeanings: Other acceptable phrasings of the meaning
   - dictionaryDefinition: Standard dictionary-style definition

   CRITICAL RULES:
   - The target word MUST appear in the sentence identified by targetWordSentenceId
   - The clue sentence(s) MUST genuinely help determine the word's meaning
   - The clue type MUST match the actual clue strategy used in the passage
   - Non-clue sentences should be topically relevant but NOT help define the target word
   - The correctMeaning MUST be one of the meaningOptions exactly
   - Distractors should be plausible (related to the topic) but clearly wrong in context
   - Each challenge should use a DIFFERENT target word
${!evalConstraint ? '   - Vary the clue types across challenges\n' : ''}
EXAMPLE FOR GRADE 3:
{
  "title": "Word Detective: Ocean Secrets",
  "gradeLevel": "3",
  "challenges": [
    {
      "id": "ch1",
      "passage": {
        "sentences": [
          { "id": "ch1_s1", "text": "The ocean is home to many creatures.", "isClue": false },
          { "id": "ch1_s2", "text": "Some fish are enormous, meaning they are very, very large.", "isClue": true },
          { "id": "ch1_s3", "text": "Whale sharks can grow to be 40 feet long.", "isClue": true },
          { "id": "ch1_s4", "text": "Divers love to swim near these gentle animals.", "isClue": false }
        ]
      },
      "targetWord": "enormous",
      "targetWordSentenceId": "ch1_s2",
      "clueType": "definition",
      "clueSentenceIds": ["ch1_s2", "ch1_s3"],
      "correctMeaning": "Very large in size",
      "meaningOptions": ["Very large in size", "Very fast", "Very colorful", "Very dangerous"],
      "acceptableMeanings": ["really big", "huge", "extremely large"],
      "dictionaryDefinition": "Extremely large in size, extent, or amount."
    }
  ]
}

Now generate a context clues detective activity about "${topic}" at grade level ${gradeLevelKey}. Ensure clue types match the actual strategies used and target words appear in their designated sentences.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-6 vocabulary and reading comprehension specialist. You create context clues activities that teach students to determine word meaning from surrounding text. You understand the five context clue types deeply: definition (word is explained in text), synonym (similar word nearby), antonym (opposite word creates contrast), example (examples clarify meaning), and inference (meaning deduced from broader context). You choose age-appropriate target vocabulary that challenges students at their grade level while remaining deducible from well-crafted context. Your passages are engaging, topically coherent, and pedagogically sound.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as ContextCluesDetectiveData;

    const { targetEvalMode: _unused, difficulty: _unusedDifficulty, ...configRest } = config ?? {};
    void _unused;
    void _unusedDifficulty;
    const finalData: ContextCluesDetectiveData = {
      ...result,
      ...configRest,
    };

    // ── Within-mode support tier: withdraw on-screen scaffolding (never the content).
    //    Applied PER CHALLENGE from each challenge's OWN clueType, so a blended
    //    (auto-mode) session gets difficulty too — the tier is a student property,
    //    not a single-mode one. Gated ONLY on supportTier being present (never on
    //    pinnedType — that would silently drop difficulty for every blended session).
    //    Runs AFTER the data is assembled so it only adds display flags; the passage,
    //    clueType, clueSentenceIds, targetWord, correctMeaning and meaningOptions are
    //    all left exactly as authored (the answer is untouched at every tier). ──
    if (supportTier && Array.isArray(finalData.challenges)) {
      for (const ch of finalData.challenges) {
        // ── Axis 1: scaffolding withdrawal (display-only flags). ──
        const sc = resolveSupportStructure(ch.clueType, supportTier); // per-challenge, mode-correct
        ch.showClueHints = sc.showClueHints;
        ch.showClueTypeDescriptions = sc.showClueTypeDescriptions;
        ch.strategyHint = sc.nameStrategy
          ? (STRATEGY_HINT_BY_TYPE[ch.clueType] ?? STRATEGY_HINT_BY_TYPE.inference)
          : undefined;

        // ── Axis 2: structural difficulty (problem shape). The clue placement +
        //    distractor proximity are SCHEMA/PROMPT-shaped — the LLM authored a
        //    self-consistent passage we must NOT rewrite (text is answer-bearing).
        //    Here we COUNT the LLM's actual clue gap vs the clamped band target and
        //    LOG claimed-vs-actual so drift is observable; we never reconstruct. ──
        const shape = resolveProblemShape(ch.clueType, supportTier, passageLen);
        const actualGap = measureClueGap(ch);
        if (actualGap != null && actualGap < shape.clueGapTarget) {
          // LLM under-dispersed (placed the clue closer than the tier asked). We do
          // NOT move sentences — log it; the clamped target is advisory for the LLM,
          // the floor (≥1 genuine clue, type unchanged) is what protects solvability.
          console.log(
            `[context-clues-detective] shape drift (${ch.clueType}/${supportTier}): clueGap target=${shape.clueGapTarget} actual=${actualGap} — passage left as authored (answer-bearing).`,
          );
        }
      }
      console.log(
        `[context-clues-detective] Difficulty "${supportTier}" applied per-challenge `
        + `(${pinnedType ? 'single-mode ' + pinnedType : 'blended'}); passageLen=${passageLen}, gapCap=${Math.max(0, passageLen - 2)}.`,
      );
    }

    console.log('Context Clues Detective Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      challengeCount: finalData.challenges?.length || 0,
      targetWords: finalData.challenges?.map(ch => ch.targetWord) || [],
      clueTypes: finalData.challenges?.map(ch => ch.clueType) || [],
    });

    return finalData;

  } catch (error) {
    console.error("Error generating context clues detective:", error);
    throw error;
  }
};
