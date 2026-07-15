import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { clampGradeToK2 } from "../scopeContext";
import { PhonemeExplorerData } from "../../primitives/visual-primitives/literacy/PhonemeExplorer";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildRemediationPrompt } from '../generation/remediationPrompt';

// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------
//
// PhonemeExplorer has four structurally-distinct challenge modes (isolate,
// blend, segment, manipulate), each with its own field set. A SINGLE Gemini
// call juggling all four in one mode-multiplexed schema (~15 conditional
// fields, only id+mode required) is unreliable: flash-lite degenerates to
// emitting empty {id, mode} shells that the validator backfills with "word"
// and "???" placeholders.
//
// Instead this generator is an ORCHESTRATOR. It builds a per-challenge mode
// plan, then fans out ONE call per distinct mode IN PARALLEL. Each call uses a
// simple single-mode schema where every content field is REQUIRED — so the
// model must produce real, fully-populated challenges. Results are recomposed
// in plan order (easy→hard) and re-id'd. Complexity per call drops from ~15
// optional fields to ~4-5 required ones (the CLAUDE.md schema-simplicity law).

// ---------------------------------------------------------------------------
// Challenge type documentation registry (per-mode prompt specs)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  isolate: {
    promptDoc:
      `"isolate": Student hears/sees a target phoneme (letter sound) and an example word, `
      + `then picks which of 4 emoji+word choices starts with the same INITIAL/beginning sound. `
      + `Set phoneme (uppercase letter), phonemeSound (pronunciation), exampleWord + exampleEmoji. `
      + `Provide exactly 4 choices (1 correct starting with same sound, 3 distractors starting with different sounds). `
      + `This mode is BEGINNING-sound only — the component renders "starts with" and cannot present `
      + `ending-sound, rhyme, or medial-sound matching. K: single consonants. Grade 1: blends/digraphs as onsets.`,
    schemaDescription: "'isolate' (identify the INITIAL/beginning phoneme)",
  },
  blend: {
    promptDoc:
      `"blend": Student sees a sequence of individual phoneme tiles (e.g., /c/ /a/ /t/) `
      + `and must pick which of 4 words those phonemes blend into. `
      + `Set phonemeSequence (array of individual sounds, e.g., ["k","a","t"]) and phonemeDisplay (e.g., "/k/ /a/ /t/"). `
      + `Provide exactly 4 choices with word+emoji (1 correct = the blended word, 3 distractors = similar-sounding words). `
      + `K: 3-phoneme CVC words. Grade 1: 4-phoneme words with blends. Grade 2: 4-5 phoneme words.`,
    schemaDescription: "'blend' (combine phonemes into word)",
  },
  segment: {
    promptDoc:
      `"segment": Student sees a word with its emoji and must pick the correct phoneme breakdown from 4 options. `
      + `Set targetWord (the word to segment) and targetEmoji (emoji for the word). `
      + `Provide exactly 4 segmentOptions: each is a string showing a phoneme breakdown (e.g., "/c/ /a/ /t/"). `
      + `Exactly 1 option is correct (correctSegmentation index, 0-based). `
      + `Distractors should have wrong phoneme count, swapped sounds, or missing sounds. `
      + `K: 3-phoneme CVC words. Grade 1: 3-4 phoneme words. Grade 2: 4-5 phoneme words.`,
    schemaDescription: "'segment' (break word into phonemes)",
  },
  manipulate: {
    promptDoc:
      `"manipulate": Student reads an instruction to change one phoneme in a word and picks the resulting word. `
      + `Set originalWord, originalEmoji, operation ("substitute"|"delete"|"add"), `
      + `operationDescription (e.g., "Change the /c/ in 'cat' to /b/"). `
      + `Provide exactly 4 choices with word+emoji (1 correct = result of manipulation, 3 distractors). `
      + `K: initial consonant substitution only. Grade 1: initial/final substitution, deletion. `
      + `Grade 2: medial vowel substitution, addition, multi-step.`,
    schemaDescription: "'manipulate' (add/delete/substitute phoneme)",
  },
};

const ALL_MODES = ['isolate', 'blend', 'segment', 'manipulate'] as const;
type PhonemeMode = typeof ALL_MODES[number];
export type PhonemeRemediationMove = 'contrast_phoneme' | 'blend_through' | 'segment_boundary' | 'isolate_operation';

export function phonemeRemediationMoveFor(
  mode: PhonemeMode,
  remediationFocus?: string,
): PhonemeRemediationMove | undefined {
  if (!remediationFocus?.trim()) return undefined;
  if (mode === 'isolate') return 'contrast_phoneme';
  if (mode === 'blend') return 'blend_through';
  if (mode === 'segment') return 'segment_boundary';
  return 'isolate_operation';
}

const TOTAL_CHALLENGES = 5;

const SYSTEM_INSTRUCTION =
  "You are an expert K-2 reading specialist designing phoneme awareness activities. " +
  "You choose concrete, picturable words that young learners know and enjoy. " +
  "You ALWAYS pair emojis that visually match the words they represent. " +
  "You ensure phonological accuracy in all challenges. " +
  "You never reveal answers through visual layout or ordering. " +
  "You NEVER emit placeholder text — every field is fully, concretely populated.";

// ---------------------------------------------------------------------------
// Grade guidelines
// ---------------------------------------------------------------------------

const gradeGuidelines: Record<string, string> = {
  K: `KINDERGARTEN GUIDELINES:
- Use simple CVC words that 5-year-olds know (cat, dog, sun, bus, pen)
- Focus on single consonant sounds: B, C, D, F, G, H, J, K, L, M, N, P, R, S, T, W
- Use different phonemes across challenges (don't repeat the same letter)
- All words must be concrete, picturable objects a child can recognize
- For isolate: initial sounds ONLY
- For blend: 3-phoneme CVC words ONLY
- For segment: 3-phoneme CVC words ONLY
- For manipulate: initial consonant substitution ONLY`,
  "1": `GRADE 1 GUIDELINES:
- Can include blends and digraphs (SH, CH, TH) as target phonemes
- Use a wider vocabulary but keep words concrete and picturable
- Words can be up to 5 letters
- Include a mix of consonant and vowel sounds
- For isolate: initial/beginning sounds ONLY (the component cannot present final or medial sounds)
- For blend: 3-4 phoneme words
- For segment: 3-4 phoneme words
- For manipulate: initial and final substitution, simple deletion`,
  "2": `GRADE 2 GUIDELINES:
- Include a wider range of phonemes including vowel sounds
- Can include less common consonant sounds and digraphs
- Words can be up to 6 letters but must still be concrete and picturable
- Use grade-appropriate vocabulary
- For isolate: initial/beginning sounds ONLY (the component cannot present final or medial sounds)
- For blend: 4-5 phoneme words
- For segment: 4-5 phoneme words
- For manipulate: all operations (substitute, delete, add)`,
};

// ---------------------------------------------------------------------------
// Per-mode schemas (simple, all fields required → no placeholder shells)
// ---------------------------------------------------------------------------

const choicesSchema: Schema = {
  type: Type.ARRAY,
  minItems: "4",
  maxItems: "4",
  items: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING, description: "A concrete, picturable word" },
      emoji: {
        type: Type.STRING,
        description: "A single emoji depicting this word. MUST visually match the word.",
      },
      correct: {
        type: Type.BOOLEAN,
        description: "true if this is the correct answer, false otherwise",
      },
    },
    required: ["word", "emoji", "correct"],
  },
  description: "Exactly 4 choices (1 correct, 3 distractors)",
};

/** Item schema for one mode. Every content field required. `mode` is set by code. */
function modeItemSchema(mode: PhonemeMode): Schema {
  const remediationMove = {
    type: Type.STRING,
    enum: [phonemeRemediationMoveFor(mode, 'active')!],
    description: 'Private remediation trace; set only when remediation is active.',
  };
  switch (mode) {
    case 'isolate':
      return {
        type: Type.OBJECT,
        properties: {
          remediationMove,
          phoneme: { type: Type.STRING, description: "Uppercase letter for this sound (e.g., 'B', 'S', 'M')" },
          phonemeSound: { type: Type.STRING, description: "How the phoneme sounds spoken aloud (e.g., 'buh', 'sss', 'mmm')" },
          exampleWord: { type: Type.STRING, description: "A concrete word that starts with this phoneme (e.g., 'Bear'). Must match exampleEmoji." },
          exampleEmoji: { type: Type.STRING, description: "A single emoji depicting exampleWord. MUST visually match." },
          choices: choicesSchema,
        },
        required: ["phoneme", "phonemeSound", "exampleWord", "exampleEmoji", "choices"],
      };
    case 'blend':
      return {
        type: Type.OBJECT,
        properties: {
          remediationMove,
          phonemeSequence: {
            type: Type.ARRAY,
            minItems: "2",
            maxItems: "5",
            items: { type: Type.STRING },
            description: "Array of individual phoneme sounds (e.g., ['k','a','t'] for 'cat')",
          },
          phonemeDisplay: { type: Type.STRING, description: "Display string for phoneme tiles (e.g., '/k/ /a/ /t/')" },
          choices: choicesSchema,
        },
        required: ["phonemeSequence", "phonemeDisplay", "choices"],
      };
    case 'segment':
      return {
        type: Type.OBJECT,
        properties: {
          remediationMove,
          targetWord: { type: Type.STRING, description: "The word to segment into phonemes (e.g., 'cat')" },
          targetEmoji: { type: Type.STRING, description: "Emoji depicting the target word (e.g., '🐱')" },
          segmentOptions: {
            type: Type.ARRAY,
            minItems: "4",
            maxItems: "4",
            items: { type: Type.STRING },
            description: "4 phoneme breakdown options (e.g., ['/k/ /a/ /t/', '/k/ /t/', '/s/ /a/ /t/', '/k/ /a/ /t/ /s/'])",
          },
          correctSegmentation: { type: Type.NUMBER, description: "0-based index of the correct option in segmentOptions" },
        },
        required: ["targetWord", "targetEmoji", "segmentOptions", "correctSegmentation"],
      };
    case 'manipulate':
      return {
        type: Type.OBJECT,
        properties: {
          remediationMove,
          originalWord: { type: Type.STRING, description: "The starting word (e.g., 'cat')" },
          originalEmoji: { type: Type.STRING, description: "Emoji for the starting word (e.g., '🐱')" },
          operation: { type: Type.STRING, enum: ["substitute", "delete", "add"], description: "Type of phoneme operation" },
          operationDescription: { type: Type.STRING, description: "Human-readable instruction (e.g., \"Change the /k/ in 'cat' to /b/\")" },
          choices: choicesSchema,
        },
        required: ["originalWord", "originalEmoji", "operation", "operationDescription", "choices"],
      };
  }
}

function modeSchema(mode: PhonemeMode, count: number): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      challenges: {
        type: Type.ARRAY,
        minItems: "1",
        maxItems: String(count),
        items: modeItemSchema(mode),
        description: `Exactly ${count} "${mode}" challenge(s)`,
      },
    },
    required: ["challenges"],
  };
}

// ---------------------------------------------------------------------------
// Mode plan
// ---------------------------------------------------------------------------

/** Distribute `total` challenges across the allowed modes, easy→hard, round-robin. */
function buildModePlan(allowed: string[], total: number): PhonemeMode[] {
  const order = ALL_MODES.filter((m) => allowed.includes(m));
  const modes: PhonemeMode[] = order.length ? order : ['isolate'];
  const plan: PhonemeMode[] = [];
  for (let i = 0; i < total; i++) plan.push(modes[i % modes.length]);
  return plan;
}

// ---------------------------------------------------------------------------
// Per-mode generation (one parallel call per distinct mode)
// ---------------------------------------------------------------------------

type RawChallenge = Record<string, unknown>;

async function generateModeChallenges(
  mode: PhonemeMode,
  count: number,
  gradeKey: string,
  topic: string,
  intent: string | undefined,
  remediationFocus: string | undefined,
): Promise<RawChallenge[]> {
  const doc = CHALLENGE_TYPE_DOCS[mode]?.promptDoc ?? '';
  const remediationSection = buildRemediationPrompt(remediationFocus);
  const remediationMove = phonemeRemediationMoveFor(mode, remediationFocus);
  const prompt = `Create exactly ${count} "${mode}" phoneme awareness challenge(s) for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Lean word choices toward "${intent}" when natural — but ALWAYS prioritize phonological/phoneme accuracy over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeKey}

${gradeGuidelines[gradeKey] || gradeGuidelines.K}

${remediationSection ? `${remediationSection}\n- Set remediationMove to "${remediationMove}". Make one wrong option encode the diagnosed confusion while preserving the requested mode and grade scope.` : ''}

MODE SPEC — ${doc}

CRITICAL RULES:
- Every emoji MUST visually depict the word it's paired with. Only standard, widely-recognized emojis.
- Every field must be fully, concretely populated — NEVER use placeholder text like "word" or "???".
${mode === 'isolate' ? '- Use a DIFFERENT target phoneme for each challenge (do not repeat the same letter).\n' : ''}${mode === 'isolate' ? '- The correct choice MUST start with the same sound as the phoneme; distractors start with DIFFERENT sounds.\n' : ''}${mode === 'blend' ? '- phonemeSequence must be accurate phonemes; distractors must be similar-sounding but wrong words.\n' : ''}${mode === 'segment' ? '- The correct segmentation must have the right phoneme count and sounds; distractors have wrong count or swapped sounds.\n' : ''}${mode === 'manipulate' ? '- operationDescription must be clear; the correct choice is the actual result; distractors are plausible but wrong.\n' : ''}
Relate words to the topic "${topic}" when possible, but prioritize phonological accuracy and emoji availability.`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: modeSchema(mode, count),
      maxOutputTokens: 4096,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  const text = response.text;
  if (!text) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.warn(`[PhonemeExplorer] ${mode} JSON parse failed:`, err);
    return [];
  }

  const arr = (parsed as { challenges?: unknown })?.challenges;
  if (!Array.isArray(arr)) return [];
  for (const challenge of arr as RawChallenge[]) {
    if (remediationMove) challenge.remediationMove = remediationMove;
    else delete challenge.remediationMove;
  }

  return arr
    .slice(0, count)
    .map((ch: RawChallenge) => {
      ch.mode = mode;
      validateModeChallenge(ch, mode);
      return ch;
    });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

type PhonemeExplorerConfig = Partial<{
  mode: string;
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode: string;
}>;

/**
 * Generate Phoneme Explorer data by orchestrating parallel per-mode calls.
 *
 * @param ctx - Generation context (topic, intent, grade, raw config)
 * @returns PhonemeExplorerData with fully-populated phoneme awareness challenges
 */
export const generatePhonemeExplorer = async (
  ctx: GenerationContext,
): Promise<PhonemeExplorerData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as PhonemeExplorerConfig;

  // ── Eval mode resolution → which modes are allowed ─────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'phoneme-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PhonemeExplorer', config?.targetEvalMode, evalConstraint);

  // Ladder rung from the canonical curriculum grade (ctx.grade) first; the prose
  // gradeLevel band never matched ["K","1","2"] and pinned every objective to "K".
  const gradeKey = clampGradeToK2(
    ctx.grade,
    (["K", "1", "2"].includes(gradeLevel.toUpperCase()) ? gradeLevel.toUpperCase() : "K") as "K" | "1" | "2",
  );

  const allowed = evalConstraint?.allowedTypes ?? [...ALL_MODES];
  const plan = buildModePlan(allowed, TOTAL_CHALLENGES);
  const distinctModes = Array.from(new Set(plan));

  try {
    // ── Fan out: one call per distinct mode, in parallel ─────────────
    const pools = await Promise.all(
      distinctModes.map((mode) =>
        generateModeChallenges(
          mode,
          plan.filter((m) => m === mode).length,
          gradeKey,
          topic,
          intent,
          ctx.remediationFocus,
        ).catch((err) => {
          console.error(`[PhonemeExplorer] ${mode} generation failed:`, err);
          return [] as RawChallenge[];
        }),
      ),
    );

    // ── Recompose in plan order (easy→hard), popping from each pool ───
    const poolByMode = new Map<PhonemeMode, RawChallenge[]>();
    distinctModes.forEach((mode, i) => poolByMode.set(mode, pools[i]));

    let challenges = plan
      .map((mode) => poolByMode.get(mode)?.shift())
      .filter((ch): ch is RawChallenge => Boolean(ch));

    // ── Fallback: never ship an empty activity ───────────────────────
    if (challenges.length === 0) {
      challenges = [buildFallbackChallenge(allowed)];
    }

    // ── Sequential IDs ───────────────────────────────────────────────
    challenges.forEach((ch, i) => { ch.id = `c${i + 1}`; });

    const finalData: PhonemeExplorerData = {
      title: `Sound Safari: ${topic}`,
      challenges: challenges as unknown as PhonemeExplorerData['challenges'],
    };

    console.log("Phoneme Explorer Generated:", {
      title: finalData.title,
      challengeCount: finalData.challenges.length,
      modes: finalData.challenges.map((ch) => ch.mode),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating phoneme explorer:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Validation helpers (safety net — required-field schemas should prevent shells)
// ---------------------------------------------------------------------------

function validateModeChallenge(ch: RawChallenge, mode: PhonemeMode): void {
  switch (mode) {
    case 'isolate':
      if (!ch.phoneme || typeof ch.phoneme !== "string") ch.phoneme = "?";
      if (!ch.phonemeSound || typeof ch.phonemeSound !== "string")
        ch.phonemeSound = (ch.phoneme as string).toLowerCase();
      if (!ch.exampleWord || typeof ch.exampleWord !== "string") ch.exampleWord = "word";
      if (!ch.exampleEmoji || typeof ch.exampleEmoji !== "string") ch.exampleEmoji = "🔤";
      validateChoices(ch);
      break;
    case 'blend':
      if (!Array.isArray(ch.phonemeSequence) || (ch.phonemeSequence as string[]).length === 0)
        ch.phonemeSequence = ["?", "?", "?"];
      if (!ch.phonemeDisplay || typeof ch.phonemeDisplay !== "string")
        ch.phonemeDisplay = (ch.phonemeSequence as string[]).map((p) => `/${p}/`).join(" ");
      validateChoices(ch);
      break;
    case 'segment':
      if (!ch.targetWord || typeof ch.targetWord !== "string") ch.targetWord = "word";
      if (!ch.targetEmoji || typeof ch.targetEmoji !== "string") ch.targetEmoji = "🔤";
      if (!Array.isArray(ch.segmentOptions) || (ch.segmentOptions as string[]).length < 4) {
        ch.segmentOptions = ["/w/ /er/ /d/", "/w/ /d/", "/w/ /o/ /r/ /d/", "/w/ /u/ /r/ /d/"];
        ch.correctSegmentation = 0;
      }
      if (typeof ch.correctSegmentation !== "number" ||
        (ch.correctSegmentation as number) < 0 ||
        (ch.correctSegmentation as number) >= (ch.segmentOptions as string[]).length) {
        ch.correctSegmentation = 0;
      }
      break;
    case 'manipulate':
      if (!ch.originalWord || typeof ch.originalWord !== "string") ch.originalWord = "word";
      if (!ch.originalEmoji || typeof ch.originalEmoji !== "string") ch.originalEmoji = "🔤";
      if (!ch.operation || typeof ch.operation !== "string") ch.operation = "substitute";
      if (!ch.operationDescription || typeof ch.operationDescription !== "string")
        ch.operationDescription = "Change a sound in the word";
      validateChoices(ch);
      break;
  }
}

function validateChoices(ch: RawChallenge): void {
  if (!Array.isArray(ch.choices) || (ch.choices as unknown[]).length === 0) {
    ch.choices = [
      { word: "???", emoji: "❓", correct: true },
      { word: "???", emoji: "❓", correct: false },
      { word: "???", emoji: "❓", correct: false },
      { word: "???", emoji: "❓", correct: false },
    ];
  }

  // Ensure exactly one correct answer
  const choices = ch.choices as { word: string; emoji: string; correct: boolean }[];
  const correctCount = choices.filter((c) => c.correct).length;
  if (correctCount === 0 && choices.length > 0) {
    choices[0].correct = true;
  } else if (correctCount > 1) {
    let foundFirst = false;
    for (const c of choices) {
      if (c.correct && foundFirst) c.correct = false;
      if (c.correct) foundFirst = true;
    }
  }
}

function buildFallbackChallenge(allowed: string[]): RawChallenge {
  // Only used if every parallel call failed — a minimal valid isolate item.
  void allowed;
  return {
    id: 'c1',
    mode: 'isolate',
    phoneme: 'B',
    phonemeSound: 'buh',
    exampleWord: 'Bear',
    exampleEmoji: '🐻',
    choices: [
      { word: 'Ball', emoji: '⚽', correct: true },
      { word: 'Cat', emoji: '🐱', correct: false },
      { word: 'Dog', emoji: '🐶', correct: false },
      { word: 'Sun', emoji: '☀️', correct: false },
    ],
  };
}
