import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext, SupportTier } from "../generation/generationContext";
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

// DI MODALITY (2026-08-11): every mode is answered ALOUD and judged by the
// live tutor in-band. Only `isolate` still carries 4 choices — they are the
// on-screen MENU (the question side, unmarked); the other three modes emit the
// ANSWER as a field and no choices at all. `phonemeExplorerScript.ts` owns the
// leak/sayability gates that drop an item the tutor could not honestly ask.
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  isolate: {
    promptDoc:
      `"isolate": The tutor says a target sound and reads a 4-word menu aloud; the student SAYS which `
      + `word starts with that sound. Set phoneme (uppercase letter), phonemeSound (pronunciation), `
      + `exampleWord + exampleEmoji. Provide exactly 4 choices (1 correct starting with the sound, 3 `
      + `distractors starting with clearly DIFFERENT sounds). The exampleWord must NOT be one of the 4 `
      + `choices. This mode is BEGINNING-sound only. K: single consonants. Grade 1: blends/digraphs as onsets.`,
    schemaDescription: "'isolate' (say the menu word with the target initial sound)",
  },
  blend: {
    promptDoc:
      `"blend": The tutor says the sounds one at a time and the student SAYS the blended word aloud. `
      + `Set phonemeSequence (array of individual sounds, e.g., ["k","a","t"]), word (the word those `
      + `sounds make, e.g., "cat") and emoji (depicting the word). No choices — the spoken word IS the answer. `
      + `K: 3-phoneme CVC words. Grade 1: 4-phoneme words with blends. Grade 2: 4-5 phoneme words.`,
    schemaDescription: "'blend' (say the word the sounds make)",
  },
  segment: {
    promptDoc:
      `"segment": The tutor says a word and the student SAYS HOW MANY sounds they hear. `
      + `Set targetWord, targetEmoji, and segments (the word's phonemes IN ORDER, e.g., ["k","a","t"] — `
      + `its length is the graded count, 2-5 sounds). No options. Segment by SOUNDS, not letters `
      + `("sheep" is 3 sounds: sh-ee-p). K: 3-phoneme CVC words. Grade 1: 3-4 phonemes. Grade 2: 4-5 phonemes.`,
    schemaDescription: "'segment' (say how many sounds the word has)",
  },
  manipulate: {
    promptDoc:
      `"manipulate": The tutor says a word and one sound to change, and the student SAYS the new word aloud. `
      + `Set originalWord, originalEmoji, operation ("substitute"|"delete"|"add"), operationDescription `
      + `(e.g., "Change the /k/ in 'cat' to /b/"), resultWord (the answer) and resultEmoji. `
      + `CRITICAL: operationDescription must NEVER contain the resultWord — it is spoken with the microphone `
      + `open, and containing the answer would give it away. No choices. `
      + `K: initial consonant substitution only. Grade 1: initial/final substitution, deletion. `
      + `Grade 2: medial vowel substitution, addition, multi-step.`,
    schemaDescription: "'manipulate' (say the word after the sound change)",
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

// ---------------------------------------------------------------------------
// Within-mode support tier (ctx.supportTier) — scaffolding WITHDRAWAL, axis 1.
//
// THE ONE RULE: the tier never changes WHICH content is drawn. No tier text ever
// reaches the prompt — the model authors the same phonemes, words, emojis and
// distractors at every tier — and these scaffold flags are stamped in CODE after
// the parse, deterministically, per challenge (so a blended plan gets the right
// flags for each of its modes). What a tier changes is how much on-screen and
// spoken HELP surrounds that identical item:
//
//   1. showExampleWord / showExampleHint (isolate) — the worked-example card
//      ("🐻 Bear / starts with B"). easy = whole card, medium = card without the
//      "starts with" sub-label, hard = no card. The phoneme tile is the STIMULUS
//      and is never withdrawn at any tier.
//   2. showChoiceEmoji (every mode) — the picture cue on the answer buttons and
//      on the segment/manipulate target. hard hides it so the student decodes
//      PRINT. The emoji fields stay in the data (the schema requires them and the
//      tutor still names words) — this is a RENDER-time withdrawal.
//   3. showBlendCue (blend) / showOperationDetail (manipulate) — the instruction
//      furniture: the "Blend these sounds together:" cue with its "+" separators,
//      and the printed operation description. At hard the tiles read as a cold
//      sequence and the operation is carried by the tutor's VOICE instead of
//      print (the neutral replacement line is picked in code — never by asking
//      the LLM to reword natural language, which desyncs from the answer).
//   4. readOptionsAloud — the tutor's automatic enumeration of all four options.
//      Withdrawn at hard so the student reads them; on-demand pronunciation of
//      the phoneme/word (the primitive's whole point) is never withdrawn.
//
// BAND WINS: at K (the pre-reader band) the picture cue IS the pre-reader's
// access to the option words, so #2 and #4 are never withdrawn there no matter
// what the tier says. The tier still withdraws #1 and #3 at K — those are worked
// examples and instruction furniture a pre-reader cannot read anyway.
// ---------------------------------------------------------------------------

export interface PhonemeSupportScaffold {
  /** isolate — show the worked-example card at all. Default (absent): shown. */
  showExampleWord?: boolean;
  /** isolate — show the "starts with X" sub-label under the example. Default: shown. */
  showExampleHint?: boolean;
  /** all modes — show emoji on choice buttons + segment/manipulate target. Default: shown. */
  showChoiceEmoji?: boolean;
  /** blend — show the "Blend these sounds together:" cue and "+" separators. Default: shown. */
  showBlendCue?: boolean;
  /** manipulate — show the authored operationDescription (vs a neutral line). Default: shown. */
  showOperationDetail?: boolean;
  /** tutor — auto-read all four options at challenge start. Default: read. */
  readOptionsAloud?: boolean;
}

/** Pre-reader band: the grade key the generator resolved for this lesson. */
function isPreReaderGradeKey(gradeKey: string): boolean {
  return gradeKey.trim().toUpperCase() === 'K';
}

/**
 * Resolve the scaffold stamps for ONE challenge from its own mode + the tier.
 * Display/instruction only — never touches the words, phonemes, choices, or the
 * correct answer. Exported for the support-tier regression suite.
 */
export function resolvePhonemeSupportScaffold(
  mode: PhonemeMode,
  tier: SupportTier,
  gradeKey: string,
): PhonemeSupportScaffold {
  const hard = tier === 'hard';
  // Band support composes with the tier and ALWAYS wins.
  const printOnly = hard && !isPreReaderGradeKey(gradeKey);

  const scaffold: PhonemeSupportScaffold = {
    showChoiceEmoji: !printOnly,
    readOptionsAloud: !printOnly,
  };

  switch (mode) {
    case 'isolate':
      scaffold.showExampleWord = !hard;
      scaffold.showExampleHint = tier === 'easy';
      break;
    case 'blend':
      scaffold.showBlendCue = !hard;
      break;
    case 'manipulate':
      scaffold.showOperationDetail = !hard;
      break;
    case 'segment':
      // segment has no instruction furniture of its own — the target word IS the
      // stimulus and the options are the answer surface.
      break;
  }

  return scaffold;
}

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
          word: { type: Type.STRING, description: "The word the sounds blend into (e.g., 'cat') — the spoken answer" },
          emoji: { type: Type.STRING, description: "A single emoji depicting the word. MUST visually match." },
        },
        required: ["phonemeSequence", "word", "emoji"],
      };
    case 'segment':
      return {
        type: Type.OBJECT,
        properties: {
          remediationMove,
          targetWord: { type: Type.STRING, description: "The word to segment into phonemes (e.g., 'cat')" },
          targetEmoji: { type: Type.STRING, description: "Emoji depicting the target word (e.g., '🐱')" },
          segments: {
            type: Type.ARRAY,
            minItems: "2",
            maxItems: "5",
            items: { type: Type.STRING },
            description: "The word's phonemes IN ORDER (e.g., ['k','a','t']). Its length is the graded sound count. Segment by SOUNDS, not letters.",
          },
        },
        required: ["targetWord", "targetEmoji", "segments"],
      };
    case 'manipulate':
      return {
        type: Type.OBJECT,
        properties: {
          remediationMove,
          originalWord: { type: Type.STRING, description: "The starting word (e.g., 'cat')" },
          originalEmoji: { type: Type.STRING, description: "Emoji for the starting word (e.g., '🐱')" },
          operation: { type: Type.STRING, enum: ["substitute", "delete", "add"], description: "Type of phoneme operation" },
          operationDescription: { type: Type.STRING, description: "Spoken instruction (e.g., \"Change the /k/ in 'cat' to /b/\"). MUST NOT contain the resultWord." },
          resultWord: { type: Type.STRING, description: "The word after the change (e.g., 'bat') — the spoken answer" },
          resultEmoji: { type: Type.STRING, description: "A single emoji depicting resultWord. MUST visually match." },
        },
        required: ["originalWord", "originalEmoji", "operation", "operationDescription", "resultWord", "resultEmoji"],
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
${mode === 'isolate' ? '- Use a DIFFERENT target phoneme for each challenge (do not repeat the same letter).\n' : ''}${mode === 'isolate' ? '- The correct choice MUST start with the same sound as the phoneme; distractors start with DIFFERENT sounds. The exampleWord must NOT appear among the choices.\n' : ''}${mode === 'blend' ? '- phonemeSequence must be accurate phonemes and word must be EXACTLY the word they blend into.\n' : ''}${mode === 'segment' ? '- segments must be the word\'s true SOUNDS in order, not its letters ("sheep" → ["sh","ee","p"], 3 sounds).\n' : ''}${mode === 'manipulate' ? '- operationDescription must be clear and must NEVER contain resultWord (it is spoken with the microphone open); resultWord is the true result of the operation.\n' : ''}
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
      return ch;
    })
    .filter((ch) => {
      const keep = validateModeChallenge(ch, mode);
      if (!keep) {
        console.warn(`[PhonemeExplorer] dropped a malformed ${mode} challenge (drop, never backfill)`);
      }
      return keep;
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

    // ── Within-mode support tier: withdraw on-screen / spoken scaffolding ──
    //    Applied PER CHALLENGE from that challenge's OWN mode, so a blended plan
    //    gets the right flags for each item. Gated ONLY on ctx.supportTier being
    //    present — absent ⇒ no fields stamped ⇒ byte-identical legacy full-help
    //    render. Never touches words, phonemes, choices, or the answer.
    const supportTier = ctx.supportTier;
    if (supportTier) {
      for (const ch of challenges) {
        Object.assign(
          ch,
          resolvePhonemeSupportScaffold(ch.mode as PhonemeMode, supportTier, gradeKey),
        );
      }
      console.log(
        `[phoneme-explorer] Support tier "${supportTier}" applied per-challenge `
        + `(grade ${gradeKey}${isPreReaderGradeKey(gradeKey) ? ', pre-reader band keeps picture cues + read-aloud' : ''}); `
        + `modes: ${challenges.map((ch) => ch.mode).join(', ')}`,
      );
    }

    const finalData: PhonemeExplorerData = {
      title: `Sound Safari: ${topic}`,
      // Tell the live tutor the support level so its reveal latitude matches the
      // screen (see the SUPPORT TIER reveal-policy directive in the catalog).
      ...(supportTier ? { supportTier } : {}),
      challenges: challenges as unknown as PhonemeExplorerData['challenges'],
    };

    console.log("Phoneme Explorer Generated:", {
      title: finalData.title,
      challengeCount: finalData.challenges.length,
      modes: finalData.challenges.map((ch) => ch.mode),
      supportTier: finalData.supportTier ?? '(none)',
    });

    return finalData;
  } catch (error) {
    console.error("Error generating phoneme explorer:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Validation — KEEP or DROP, never backfill. (The old validators patched
// malformed challenges with "word"/"???" placeholders; in a judged spoken loop
// a fabricated item becomes a spoken ask the tutor must then judge, so a
// challenge that arrives broken ships nothing. `phonemeExplorerScript.ts`'s
// itemFromChallenge runs the same gates again component-side — belt and
// suspenders on two sides of the wire.)
// ---------------------------------------------------------------------------

const isWord = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z][a-z' -]*$/i.test(v.trim()) && v.trim().toLowerCase() !== 'yes';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function validateModeChallenge(ch: RawChallenge, mode: PhonemeMode): boolean {
  switch (mode) {
    case 'isolate': {
      if (!isNonEmptyString(ch.phoneme) || !isNonEmptyString(ch.phonemeSound)) return false;
      if (!isWord(ch.exampleWord) || !isNonEmptyString(ch.exampleEmoji)) return false;
      const choices = ch.choices;
      if (!Array.isArray(choices) || choices.length !== 4) return false;
      const typed = choices as { word?: unknown; emoji?: unknown; correct?: unknown }[];
      if (!typed.every((c) => isWord(c.word) && isNonEmptyString(c.emoji))) return false;
      if (typed.filter((c) => c.correct === true).length !== 1) return false;
      const words = typed.map((c) => (c.word as string).trim().toLowerCase());
      if (new Set(words).size !== words.length) return false;
      // The example is a SECOND right answer if it sits in the menu.
      if (words.includes((ch.exampleWord as string).trim().toLowerCase())) return false;
      return true;
    }
    case 'blend': {
      const seq = ch.phonemeSequence;
      return Array.isArray(seq) && seq.length >= 2 && seq.length <= 5
        && (seq as unknown[]).every(isNonEmptyString)
        && isWord(ch.word) && isNonEmptyString(ch.emoji);
    }
    case 'segment': {
      const segs = ch.segments;
      return isWord(ch.targetWord) && isNonEmptyString(ch.targetEmoji)
        && Array.isArray(segs) && segs.length >= 2 && segs.length <= 5
        && (segs as unknown[]).every(isNonEmptyString);
    }
    case 'manipulate': {
      if (!isWord(ch.originalWord) || !isNonEmptyString(ch.originalEmoji)) return false;
      if (!isNonEmptyString(ch.operationDescription)) return false;
      if (!isWord(ch.resultWord) || !isNonEmptyString(ch.resultEmoji)) return false;
      const result = (ch.resultWord as string).trim();
      if (result.toLowerCase() === (ch.originalWord as string).trim().toLowerCase()) return false;
      // The operation is SPOKEN with the mic open — containing the answer gives it away.
      const escaped = result.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(ch.operationDescription as string)) return false;
      return true;
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
