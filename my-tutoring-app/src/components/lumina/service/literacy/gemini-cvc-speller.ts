import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { CvcSpellerData } from "../../primitives/visual-primitives/literacy/CvcSpeller";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildRemediationPrompt } from '../generation/remediationPrompt';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'fill-vowel': {
    promptDoc:
      `"fill-vowel": Student hears a CVC word (AI says it), sees the consonant frame (e.g., "c_t"), `
      + `and picks the correct vowel from 2 confusable options. Binary discrimination — exactly 2 vowel choices. `
      + `The AI provides progressive scaffolding: natural word → stretched vowel → isolated vowel sound.`,
    schemaDescription: "'fill-vowel' (hear word, pick missing vowel from 2 options)",
  },
  'spell-word': {
    promptDoc:
      `"spell-word": Student hears a CVC word (AI says it) and spells the full word by placing 3 letters `
      + `into Elkonin-box slots. Letter bank has target letters + distractors. `
      + `AI scaffolds: natural word → onset-rime segmentation → full phoneme segmentation.`,
    schemaDescription: "'spell-word' (hear word, spell all 3 letters in Elkonin boxes)",
  },
  'word-sort': {
    promptDoc:
      `"word-sort": Student hears CVC words one at a time (AI says each word) and sorts them into `
      + `2 vowel-sound buckets. Each bucket represents a confusable short vowel (e.g., short-a vs short-e). `
      + `AI scaffolds: say word naturally → stretch vowel → contrast both vowel sounds.`,
    schemaDescription: "'word-sort' (hear words, sort into 2 vowel-sound buckets)",
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
// INVARIANT: a tier ONLY removes scaffolding. It never changes the target word,
// the heard audio, the correct vowel, or any answer — only how much the
// workspace helps the student self-check.
//
// Levers (per task type):
//   spell-word  → showPictureCue (emoji + image identify the word, so the
//                 student can self-check what they're spelling) AND
//                 distractorLevel (how cluttered the letter bank is — trims
//                 distractorLetters only, NEVER the 3 target letters).
//   word-sort   → showPictureCue (the emoji reveals the word; withdrawing it
//                 forces a pure listen-and-sort).
//   fill-vowel  → no display lever (consonant frame + 2 vowel options are the
//                 task itself); the tutor channel carries its tier instead.
// ---------------------------------------------------------------------------

type CvcTaskType = 'fill-vowel' | 'spell-word' | 'word-sort';
type CvcRemediationMove = 'contrast_vowel' | 'phoneme_slots' | 'minimal_pair_sort';

export function cvcRemediationMoveFor(
  taskType: CvcTaskType,
  remediationFocus?: string,
): CvcRemediationMove | undefined {
  if (!remediationFocus?.trim()) return undefined;
  if (taskType === 'fill-vowel') return 'contrast_vowel';
  if (taskType === 'spell-word') return 'phoneme_slots';
  return 'minimal_pair_sort';
}

interface CvcSupportScaffold {
  /** spell-word / word-sort: show the emoji + image that identifies the word (self-check aid). */
  showPictureCue?: boolean;
  /** spell-word: how many distractor letters clutter the bank (0-1 easy → up to 5 hard). */
  distractorLevel?: 'clean' | 'some' | 'full';
  promptLines: string[];
}

function resolveSupportStructure(
  taskType: CvcTaskType,
  tier: SupportTier,
): CvcSupportScaffold {
  const lead =
    'This tier changes only how much on-screen / spoken help the student gets. It NEVER '
    + 'changes the target word, the audio, the correct letters, or the answer.';
  const neutral =
    'Keep the title and description neutral — never state the support level or reveal the answer.';

  if (taskType === 'spell-word') {
    const showPictureCue = tier !== 'hard';
    const distractorLevel: CvcSupportScaffold['distractorLevel'] =
      tier === 'easy' ? 'clean' : tier === 'medium' ? 'some' : 'full';
    return {
      showPictureCue,
      distractorLevel,
      promptLines: [
        lead,
        `The picture cue (emoji + image of the word) is ${showPictureCue ? 'shown so the student can self-check what they are spelling' : 'withdrawn — the student spells purely from the sounds they hear'}.`,
        `The letter bank is ${distractorLevel === 'clean' ? 'kept clean (few extra letters), so sounding-out is the only step' : distractorLevel === 'some' ? 'lightly populated with a few distractor letters' : 'fully populated with distractor letters, so the student must hold each phoneme while searching'}.`,
        neutral,
      ],
    };
  }

  if (taskType === 'word-sort') {
    const showPictureCue = tier !== 'hard';
    return {
      showPictureCue,
      promptLines: [
        lead,
        `The picture cue (emoji of the word) is ${showPictureCue ? 'shown to anchor the word being sorted' : 'withdrawn — the student sorts purely by the vowel sound they hear'}.`,
        neutral,
      ],
    };
  }

  // fill-vowel: the consonant frame + 2 vowel choices ARE the task; nothing
  // visual to withdraw without changing what is assessed. The tutor channel
  // carries the tier (easy names the strategy, hard withholds it).
  return {
    promptLines: [
      lead,
      'No on-screen scaffolding is withdrawn for this mode (the consonant frame and the two vowel choices are the task itself); the spoken support is tuned by tier instead.',
      neutral,
    ],
  };
}

// ---------------------------------------------------------------------------
// Confusable vowel pairs for fill-vowel and word-sort distractors
// ---------------------------------------------------------------------------

const CONFUSABLE_VOWELS: Record<string, string> = {
  a: 'e',   // short-a ↔ short-e is the classic kindergarten confusion
  e: 'i',   // short-e ↔ short-i
  i: 'e',   // short-i ↔ short-e
  o: 'u',   // short-o ↔ short-u
  u: 'o',   // short-u ↔ short-o
};

const VOWEL_KEYWORDS: Record<string, string> = {
  a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up',
};

// ---------------------------------------------------------------------------
// Structural difficulty (config.difficulty) — second axis: problem SHAPE, not
// scaffolding. For a phoneme-discrimination card the lever is the SIMILARITY of
// the wrong choices (the recognition-card "distractor similarity" lever): a
// FAR decoy is easy to reject, a NEAR (confusable) decoy is hard. This never
// changes the target word, the vowel focus, the heard audio, or the answer —
// only how confusable the foils are.
//
// TIER_GUARDRAIL — the truthful dual-axis invariant for config.difficulty.
// Axis 1 (support tiers) withdraws on-screen help (picture cue, distractor
// COUNT); axis 2 (this) changes the distractor SIMILARITY. Neither changes the
// target word, the correct letters, or the answer. Harder ≠ longer/bigger words.
// ---------------------------------------------------------------------------

const TIER_GUARDRAIL =
  'Tier changes scaffolding + distractor similarity; never the target word, vowel focus, or answer.';

/** Short-vowel confusability, ranked MOST-confusable → LEAST (near → far). */
const VOWEL_CONFUSION_RANK: Record<string, string[]> = {
  a: ['e', 'o', 'i', 'u'],
  e: ['i', 'a', 'u', 'o'],
  i: ['e', 'u', 'a', 'o'],
  o: ['u', 'a', 'e', 'i'],
  u: ['o', 'i', 'a', 'e'],
};

/** Visually / aurally confusable consonants (plus vowels via CONFUSABLE_VOWELS),
 *  used to pick NEAR-miss distractor letters for spell-word at higher tiers. */
const CONFUSABLE_LETTERS: Record<string, string[]> = {
  b: ['d', 'p', 'q'], d: ['b', 'p', 'q'], p: ['q', 'b', 'd'], q: ['p', 'b', 'd'],
  m: ['n', 'w'], n: ['m', 'r', 'h'], w: ['m', 'v'], v: ['w', 'f'], f: ['v', 't'],
  g: ['j', 'q'], j: ['g'], c: ['k', 's'], k: ['c', 'x'], s: ['c', 'z'], z: ['s', 'x'],
  t: ['f', 'l'], l: ['t'], r: ['n'], h: ['n'], x: ['k', 'z'], y: ['v'],
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick from a near→far ranked list by tier: hard = nearest, easy = farthest. */
function pickByTier<T>(rankedNearToFar: T[], tier: SupportTier): T | undefined {
  if (rankedNearToFar.length === 0) return undefined;
  if (tier === 'hard') return rankedNearToFar[0];
  if (tier === 'easy') return rankedNearToFar[rankedNearToFar.length - 1];
  return rankedNearToFar[Math.min(1, rankedNearToFar.length - 1)];
}

/** Choose `cap` distractor letters by similarity to the target letters. NEAR
 *  fills from the visually/aurally confusable pool first; FAR fills from the
 *  rest of the alphabet first; MID interleaves. Never returns a target letter,
 *  so the word stays spellable (answer-safe). */
function selectDistractorLetters(
  targetLetters: string[],
  cap: number,
  similarity: 'far' | 'mid' | 'near',
): string[] {
  const targets = new Set(targetLetters.map((l) => l.toLowerCase()));
  const nearSet = new Set<string>();
  for (const tl of targetLetters.map((l) => l.toLowerCase())) {
    for (const c of CONFUSABLE_LETTERS[tl] ?? []) if (!targets.has(c)) nearSet.add(c);
    const cv = CONFUSABLE_VOWELS[tl];
    if (cv && !targets.has(cv)) nearSet.add(cv);
  }
  const near = shuffleInPlace(Array.from(nearSet));
  const far = shuffleInPlace(ALPHABET.filter((c) => !targets.has(c) && !nearSet.has(c)));
  let ordered: string[];
  if (similarity === 'near') ordered = [...near, ...far];
  else if (similarity === 'far') ordered = [...far, ...near];
  else {
    ordered = [];
    const a = [...near], b = [...far];
    while (a.length || b.length) {
      if (b.length) ordered.push(b.shift()!);
      if (a.length) ordered.push(a.shift()!);
    }
  }
  return ordered.slice(0, Math.max(0, cap));
}

interface CvcProblemShape {
  /** fill-vowel: the decoy vowel chosen by confusability distance. */
  vowelDecoy?: string;
  /** word-sort: the contrast bucket vowel chosen by confusability distance. */
  contrastVowel?: string;
  /** spell-word: how similar the distractor letters are to the target letters. */
  letterSimilarity: 'far' | 'mid' | 'near';
  promptLines: string[];
}

/** One in-mode structural lever per task type, all of it "distractor similarity". */
function resolveProblemShape(
  taskType: CvcTaskType,
  tier: SupportTier,
  ctx: { targetVowel: string },
): CvcProblemShape {
  const lead =
    'STRUCTURAL DIFFICULTY (second axis): this changes how CONFUSABLE the wrong choices are — '
    + 'NOT the target word, the vowel focus, or the answer.';
  const rank = VOWEL_CONFUSION_RANK[ctx.targetVowel] ?? [];
  const distLabel = tier === 'hard' ? 'a NEAR, highly confusable' : tier === 'easy' ? 'a FAR, easily distinguished' : 'a moderately confusable';

  if (taskType === 'fill-vowel') {
    const vowelDecoy = pickByTier(rank, tier);
    return {
      vowelDecoy,
      letterSimilarity: 'far',
      promptLines: [
        lead,
        `The two vowel choices are "${ctx.targetVowel}" and the decoy "${vowelDecoy ?? '?'}" — ${distLabel} vowel (the exact decoy is enforced in code).`,
      ],
    };
  }
  if (taskType === 'word-sort') {
    const contrastVowel = pickByTier(rank, tier);
    return {
      contrastVowel,
      letterSimilarity: 'far',
      promptLines: [
        lead,
        `Sort against the contrast vowel "${contrastVowel ?? '?'}" — ${distLabel} vowel vs the focus "${ctx.targetVowel}". Include words with BOTH vowels.`,
      ],
    };
  }
  // spell-word
  const letterSimilarity = tier === 'hard' ? 'near' : tier === 'easy' ? 'far' : 'mid';
  return {
    letterSimilarity,
    promptLines: [
      lead,
      `Distractor letters in the bank should be ${letterSimilarity === 'near' ? 'NEAR misses — visually/aurally confusable with the target letters (b/d/p, m/n, the confusable vowel)' : letterSimilarity === 'far' ? 'FAR — clearly different from the target letters' : 'a mix of near and far'} (the exact letters are enforced in code).`,
    ],
  };
}

/**
 * Schema definition for CVC Speller Data
 *
 * Three task modes with progressive difficulty:
 * - fill-vowel: Hear word, pick missing vowel (binary discrimination)
 * - spell-word: Hear word, spell all 3 letters (Elkonin boxes)
 * - word-sort: Hear words, categorize by vowel sound (2 buckets)
 *
 * Audio-first design: all words delivered via AI tutor voice.
 * AI scaffolding provides progressive phoneme segmentation.
 */
const cvcSpellerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging child-facing title for the CVC spelling activity (e.g., 'Spell Short-A Words!'). Plain playful words a teacher would SAY only — never phoneme slash-notation like /æ/ and never dev codes like 'short-a'."
    },
    vowelFocus: {
      type: Type.STRING,
      enum: ["short-a", "short-e", "short-i", "short-o", "short-u"],
      description: "Which short vowel sound to focus on"
    },
    letterGroup: {
      type: Type.NUMBER,
      description: "Letter group difficulty (1 = easiest consonants, 4 = all letters). Must be 1, 2, 3, or 4."
    },
    availableLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "All single lowercase letters available in the letter bank for this activity"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'c1', 'c2')"
          },
          taskType: {
            type: Type.STRING,
            enum: ["fill-vowel", "spell-word", "word-sort"],
            description: "The task type for this challenge"
          },
          remediationMove: {
            type: Type.STRING,
            enum: ["contrast_vowel", "phoneme_slots", "minimal_pair_sort"],
            description: "Private remediation trace; set only when remediation is active."
          },
          targetWord: {
            type: Type.STRING,
            description: "The 3-letter CVC word (e.g., 'cat', 'hen', 'pig')"
          },
          targetLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The 3 individual letters in order (e.g., ['c', 'a', 't'])"
          },
          targetPhonemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The 3 phonemes in slash notation (e.g., ['/k/', '/æ/', '/t/'])"
          },
          emoji: {
            type: Type.STRING,
            description: "A single emoji representing the word (e.g., '🐱' for cat)"
          },
          imageDescription: {
            type: Type.STRING,
            description: "Brief visual description of the word"
          },
          distractorLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 extra letters NOT in the target word, used as distractors in the letter bank (spell-word mode)"
          },
          vowelOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly 2 vowel letters for fill-vowel mode (e.g., ['a', 'e']). One correct, one confusable distractor."
          },
          sortBucketLabel: {
            type: Type.STRING,
            description: "For word-sort mode: which vowel sound bucket this word belongs to (e.g., 'short-a' or 'short-e')"
          },
          commonErrors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                errorSpelling: {
                  type: Type.STRING,
                  description: "A common misspelling of the target word"
                },
                feedback: {
                  type: Type.STRING,
                  description: "Helpful corrective feedback for this error"
                }
              },
              required: ["errorSpelling", "feedback"]
            },
            description: "Common misspellings with corrective feedback (spell-word mode)"
          }
        },
        required: ["id", "taskType", "targetWord", "targetLetters", "targetPhonemes", "emoji", "imageDescription"]
      },
      description: "Array of 4-6 CVC word challenges"
    }
  },
  required: ["title", "vowelFocus", "letterGroup", "availableLetters", "challenges"]
};

// ============================================================================
// Letter Group Definitions
// ============================================================================

const LETTER_GROUP_SETS: Record<number, string[]> = {
  1: ['s', 't', 'm', 'p'],
  2: ['s', 't', 'm', 'p', 'n', 'c', 'b', 'd', 'g'],
  3: ['s', 't', 'm', 'p', 'n', 'c', 'b', 'd', 'g', 'f', 'h', 'l', 'r', 'w'],
  4: ['s', 't', 'm', 'p', 'n', 'c', 'b', 'd', 'g', 'f', 'h', 'l', 'r', 'w', 'j', 'k', 'v', 'x', 'y', 'z'],
};

const VOWEL_MAP: Record<string, string> = {
  'short-a': 'a', 'short-e': 'e', 'short-i': 'i', 'short-o': 'o', 'short-u': 'u',
};

export function resolveCvcVowelFocus(
  topic: string,
  configured?: string,
): keyof typeof VOWEL_MAP {
  const explicit = configured?.toLowerCase().trim();
  if (explicit && explicit in VOWEL_MAP) return explicit as keyof typeof VOWEL_MAP;
  const match = topic.toLowerCase().match(/short[\s-]*([aeiou])\b/);
  return (match ? `short-${match[1]}` : 'short-a') as keyof typeof VOWEL_MAP;
}

/**
 * Generate CVC Speller data using Gemini AI
 *
 * Three task modes with progressive difficulty:
 * - fill-vowel (β 1.5): Hear word, pick missing vowel from 2 confusable options
 * - spell-word (β 2.5): Hear word, spell all 3 letters in Elkonin boxes
 * - word-sort (β 3.5): Hear words, categorize into 2 vowel-sound buckets
 *
 * Audio-first: words are delivered via AI tutor voice, not shown as text.
 * AI scaffolding provides progressive phoneme segmentation at each level.
 */
type CvcSpellerConfig = Partial<CvcSpellerData & {
  targetEvalMode?: string;
  /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second axis:
   *  difficulty = how much scaffolding within the mode. NEVER changes numbers/words. */
  difficulty?: string;
}>;

export const generateCvcSpeller = async (
  ctx: GenerationContext,
): Promise<CvcSpellerData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as CvcSpellerConfig;

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'cvc-speller',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('CvcSpeller', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(cvcSpellerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'taskType',
      })
    : cvcSpellerSchema;

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------
  const vowelFocus = resolveCvcVowelFocus(topic, config?.vowelFocus);
  const letterGroup = config?.letterGroup || 1;
  const targetVowel = VOWEL_MAP[vowelFocus] || 'a';
  const confusableVowel = CONFUSABLE_VOWELS[targetVowel] || (targetVowel === 'a' ? 'e' : 'a');
  const consonants = LETTER_GROUP_SETS[letterGroup] || LETTER_GROUP_SETS[1];

  // -------------------------------------------------------------------------
  // Build prompt
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT word
  //    size. pinnedType (the single pinned mode, if any) drives prompt TONE only;
  //    the withdrawal is applied deterministically per challenge at the end. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: CvcTaskType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as CvcTaskType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Axis 2 (structural): the contrast vowel used in the prompt is tuned by tier
  // (near at hard, far at easy). When no tier is present it falls back to the
  // legacy nearest-confusable vowel, keeping the no-tier prompt byte-identical.
  const structuralContrast = supportTier && VOWEL_CONFUSION_RANK[targetVowel]
    ? (pickByTier(VOWEL_CONFUSION_RANK[targetVowel], supportTier) ?? confusableVowel)
    : confusableVowel;
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier, { targetVowel })
    : null;
  const tierPromptLines: string[] = [
    ...(tierScaffold ? tierScaffold.promptLines : []),
    ...(tierShape ? tierShape.promptLines : []),
  ];
  const tierSection = tierPromptLines.length
    ? `\n## WITHIN-MODE DIFFICULTY (config.difficulty — scaffolding + discrimination shape, NOT word size)\n${tierPromptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';
  const remediationSection = buildRemediationPrompt(ctx.remediationFocus);

  const generationPrompt = `Create a CVC word spelling activity for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean word/letter choices toward "${intent}" when possible — but ALWAYS prioritize the phonics/decoding accuracy rules below over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevel}
VOWEL FOCUS: ${vowelFocus} (the vowel "${targetVowel}")
CONFUSABLE VOWEL PAIR: "${targetVowel}" vs "${structuralContrast}" (${VOWEL_KEYWORDS[targetVowel]} vs ${VOWEL_KEYWORDS[structuralContrast]})
LETTER GROUP: ${letterGroup} (available consonants: ${consonants.join(', ')})

AUDIO-FIRST DESIGN:
This is an audio-first activity. The AI tutor SAYS each word aloud — students LISTEN, they don't read.
The AI provides progressive scaffolding: natural word → stretched sounds → isolated phonemes.

${challengeTypeSection}
${tierSection}
${remediationSection}
TASK-SPECIFIC FORMATS:

For "fill-vowel" challenges:
- Student hears the word, sees consonant frame (e.g., "c_t"), picks from 2 vowels
- vowelOptions: exactly 2 vowels — the correct one ("${targetVowel}") and confusable ("${structuralContrast}")
- distractorLetters: not needed (omit or empty)
${ctx.remediationFocus ? '- Set remediationMove to "contrast_vowel" and make the wrong vowel encode the diagnosed confusion.' : ''}
- Words must use vowel "${targetVowel}" — the confusable "${structuralContrast}" is ONLY for the wrong option

For "spell-word" challenges:
- Student hears the word and places all 3 letters in Elkonin boxes
- distractorLetters: 3-5 letters NOT in the target word
- vowelOptions: not needed
- commonErrors: 1-2 common misspellings with feedback
${ctx.remediationFocus ? '- Set remediationMove to "phoneme_slots" and include a distractor spelling that predicts the diagnosed confusion.' : ''}

For "word-sort" challenges:
- Student hears words and sorts into 2 buckets by vowel sound
- sortBucketLabel: either "${vowelFocus}" or "short-${structuralContrast}"
- Include a MIX of both vowels — some words use "${targetVowel}", some use "${structuralContrast}"
- vowelOptions: not needed, distractorLetters: not needed
- IMPORTANT: word-sort challenges MUST include words with BOTH vowels (not just "${targetVowel}")
${ctx.remediationFocus ? '- Set remediationMove to "minimal_pair_sort" and choose contrast words that isolate the diagnosed sound distinction.' : ''}

REQUIREMENTS:
- 4-6 challenges total
- ALL words must be real English CVC words (3 letters)
- Only use consonants from letter group ${letterGroup}: ${consonants.join(', ')}
- targetLetters: exactly 3 letters spelling the word
- targetPhonemes: exactly 3 phonemes in slash notation
- Choose concrete, picturable words appropriate for K-2
${!evalConstraint ? '- Mix task types to create variety (e.g., 2 fill-vowel, 2 spell-word, 2 word-sort)' : ''}

PHONEME NOTATION:
- Short vowels: /æ/ (a), /ɛ/ (e), /ɪ/ (i), /ɒ/ (o), /ʌ/ (u)
- Consonants: /b/, /k/ (for c), /d/, /f/, /g/, /h/, /j/, /k/, /l/, /m/, /n/, /p/, /r/, /s/, /t/, /v/, /w/, /y/, /z/`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 reading and spelling specialist. You create engaging, developmentally appropriate CVC word spelling activities that build phonemic awareness and letter-sound correspondence. You understand which CVC words are real, common English words appropriate for young learners. You ensure all phoneme notations are linguistically accurate and that every word strictly follows the CVC pattern with the specified vowel. You choose concrete, picturable words that motivate young spellers. For word-sort challenges, you include words with BOTH the target vowel and the confusable vowel.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as CvcSpellerData;

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    result.vowelFocus = vowelFocus as CvcSpellerData['vowelFocus'];
    result.letterGroup = letterGroup as CvcSpellerData['letterGroup'];

    // Child-facing title: strip phoneme slash-notation (/æ/) and dev slugs
    // ('short-a') the model sometimes emits despite the schema description
    // (reader-fit RF-4 — a K draw shipped "Sort the Short Sounds: /æ/ or /ɛ/?").
    if (result.title && (/\/[^/\s]{1,4}\//.test(result.title) || /short-[aeiou]/i.test(result.title))) {
      const vowelLetter = vowelFocus.replace('short-', '').toUpperCase();
      result.title = `Short ${vowelLetter} Word Fun!`;
    }

    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => {
        ch.id = ch.id || `c${idx + 1}`;
        ch.taskType = ch.taskType || (evalConstraint?.allowedTypes[0] as 'fill-vowel' | 'spell-word' | 'word-sort') || 'spell-word';
        ch.targetLetters = ch.targetLetters || ch.targetWord.split('');
        ch.emoji = ch.emoji || '';
        ch.imageDescription = ch.imageDescription || '';
        ch.distractorLetters = ch.distractorLetters || [];
        ch.commonErrors = ch.commonErrors || [];
        const remediationMove = cvcRemediationMoveFor(ch.taskType as CvcTaskType, ctx.remediationFocus);
        if (remediationMove) {
          ch.remediationMove = remediationMove;
        } else {
          delete ch.remediationMove;
        }

        // Ensure fill-vowel has exactly 2 vowel options
        if (ch.taskType === 'fill-vowel') {
          if (!ch.vowelOptions || ch.vowelOptions.length !== 2) {
            ch.vowelOptions = [targetVowel, confusableVowel];
          }
          // Shuffle vowel options
          if (Math.random() > 0.5 && ch.vowelOptions) {
            ch.vowelOptions = [ch.vowelOptions[1], ch.vowelOptions[0]];
          }
        }

        // Ensure word-sort has a bucket label
        if (ch.taskType === 'word-sort' && !ch.sortBucketLabel) {
          const middleLetter = ch.targetLetters[1]?.toLowerCase();
          ch.sortBucketLabel = middleLetter === confusableVowel
            ? `short-${confusableVowel}`
            : vowelFocus;
        }

        return ch;
      });
    }

    // ========================================================================
    // Within-mode support tier: withdraw on-screen scaffolding (never the word).
    // Gated ONLY on supportTier — a blended/auto session gets difficulty too,
    // each challenge resolving its scaffold from its OWN taskType. Runs LAST,
    // after all structural fixups, so a tier can only REMOVE help.
    // ========================================================================
    if (supportTier && result.challenges) {
      for (const ch of result.challenges) {
        const sc = resolveSupportStructure(ch.taskType as CvcTaskType, supportTier);

        // Picture cue (spell-word + word-sort): emoji/image self-check aid.
        // fill-vowel renders no picture, so leave it untouched (no-op there).
        if (ch.taskType === 'spell-word' || ch.taskType === 'word-sort') {
          ch.showPictureCue = sc.showPictureCue ?? true;
        }

        // ── Axis 1 (support: distractor COUNT) × Axis 2 (structural: distractor
        //    SIMILARITY) for spell-word. Support tier sets the cap; structural
        //    tier picks WHICH letters fill it. selectDistractorLetters excludes
        //    target letters, so the word stays spellable (answer-safe). ──
        if (ch.taskType === 'spell-word' && sc.distractorLevel) {
          const cap = sc.distractorLevel === 'clean' ? 1 : sc.distractorLevel === 'some' ? 3 : 5;
          const shape = resolveProblemShape('spell-word', supportTier, { targetVowel });
          ch.distractorLetters = selectDistractorLetters(
            ch.targetLetters || ch.targetWord.split(''),
            cap,
            shape.letterSimilarity,
          );
        }

        // ── Axis 2 (structural) for fill-vowel: re-select the DECOY vowel by
        //    confusability (near at hard, far at easy). The correct vowel is the
        //    word's middle letter and is never touched, so the answer
        //    (targetLetters[1]) is preserved. ──
        if (ch.taskType === 'fill-vowel') {
          const correct = (ch.targetLetters?.[1] ?? targetVowel).toLowerCase();
          const shape = resolveProblemShape('fill-vowel', supportTier, { targetVowel: correct });
          let decoy = shape.vowelDecoy;
          if (!decoy || decoy === correct) {
            decoy = CONFUSABLE_VOWELS[correct] ?? (correct === 'a' ? 'e' : 'a');
          }
          ch.vowelOptions = Math.random() > 0.5 ? [correct, decoy] : [decoy, correct];
        }

        // ── Axis 2 (structural) for word-sort: pin the bucket label to the
        //    tier-tuned contrast pair {focus, structuralContrast}. The WORDS are
        //    prose (LLM-authored under the prompt's tier-tuned contrast); this
        //    only keeps the labels consistent with that pair. ──
        if (ch.taskType === 'word-sort') {
          const mid = ch.targetLetters?.[1]?.toLowerCase();
          ch.sortBucketLabel = mid === structuralContrast ? `short-${structuralContrast}` : vowelFocus;
        }
      }
      // Tell the live tutor the support level (blended sessions included) so its
      // reveal policy is tier-aware per challenge.
      result.supportTier = supportTier;
      console.log(
        `[cvc-speller] tier "${supportTier}" applied per-challenge — contrast="${structuralContrast}" `
        + `(${pinnedType ? 'single-mode ' + pinnedType : 'blended'}). ${TIER_GUARDRAIL}`,
      );
    }

    console.log('CVC Speller Generated:', {
      title: result.title,
      vowelFocus: result.vowelFocus,
      letterGroup: result.letterGroup,
      challengeCount: result.challenges?.length || 0,
      taskTypes: result.challenges?.map(c => c.taskType) || [],
      words: result.challenges?.map(c => c.targetWord) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating CVC speller:", error);
    throw error;
  }
};
