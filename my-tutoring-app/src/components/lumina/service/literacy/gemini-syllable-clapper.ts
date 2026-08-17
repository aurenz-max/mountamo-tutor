import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { clampGradeToK2 } from "../scopeContext";
import { SyllableClapperData } from "../../primitives/visual-primitives/literacy/SyllableClapper";
import {
  DIALECT_VARIABLE_WORDS,
  MAX_PARTS,
  MIN_PARTS,
  endsWithSilentESyllable,
  hasStableSyllableCount,
  isSayableSyllableWord,
  syllablesJoinToWord,
} from "../../primitives/visual-primitives/literacy/syllableClapperScript";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// Challenge Type Documentation (one entry per WORD-LENGTH band)
//
// ⭐ THE `hard` BAND WAS RE-SPECIFIED BY THE DI PORT, and this is the port's
// headline content finding. It used to ask for "words with ambiguous syllable
// boundaries (caterpillar, refrigerator, comfortable, interesting,
// hippopotamus)" — as though ambiguity were difficulty. Two of those have no
// single defensible answer: "comfortable" is 3 or 4 beats and "interesting" is
// 3 or 4, depending on the speaker. A tap surface could hide that (the key was
// never spoken aloud, and the child had three tries and a directional hint); a
// judged loop cannot — the tutor REFUSES a child who was right and then models
// the "correct" count at them, teaching a dialect as a fact.
//
// Hard is now LENGTH plus unfamiliarity, never dialect variance. The words are
// long and less common but cleanly segmented, and `hasStableSyllableCount`
// (imported from the script module) drops the variable ones on both sides of
// the wire, so a cached or hand-authored payload is covered too.
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  easy: {
    promptDoc:
      `"easy": High-frequency 1-2 syllable words with clean, unambiguous boundaries. `
      + `Use concrete, picturable words every kindergartener knows (cat, dog, apple, puppy, happy, tiger). `
      + `Difficulty 3. Syllable count: 1-2.`,
    schemaDescription: "'easy' — 1-2 syllable, high-frequency words",
  },
  medium: {
    promptDoc:
      `"medium": 2-3 syllable words from broader vocabulary. Compound words are ideal `
      + `(butterfly, sunflower, basketball, rainbow) because their beats are obvious to the ear. `
      + `Words should still be concrete and picturable but can be less common. `
      + `Difficulty 4. Syllable count: 2-3.`,
    schemaDescription: "'medium' — 2-3 syllable, broader vocabulary",
  },
  hard: {
    promptDoc:
      `"hard": 3-4 syllable words — LONGER and less familiar, but every beat still CLEARLY heard `
      + `(caterpillar, watermelon, alligator, kindergarten, dinosaur, helicopter, television). `
      + `Length is the difficulty here, never ambiguity. `
      + `Difficulty 5. Syllable count: 3-4.`,
    schemaDescription: "'hard' — 3-4 syllable, longer and less common words",
  },
};

// ============================================================================
// Within-mode SUPPORT TIER (axis 3) — scaffolding withdrawal
//
// ⚠ NAME-COLLISION WARNING (read before touching anything below):
// this primitive's EVAL MODES / `challengeType` values are LITERALLY
// 'easy' | 'medium' | 'hard' — but those name WORD LENGTH (1-2 / 2-3 / 3-4
// syllables), i.e. the task's content band. The SUPPORT TIER is a completely
// SEPARATE axis that arrives on `config.difficulty` and is normalized upstream
// into `ctx.supportTier`. The two are ORTHOGONAL: evalMode='medium' with
// supportTier='hard' is a legal and common pairing (2-3 syllable words, no clap
// invitation). NEVER infer one from the other, and NEVER let the tier write
// `challengeType` — that would silently re-band the content.
//
// ⭐ THE LEVERS MOVED WITH THE MODALITY. The click era withdrew a 6-circle clap
// TALLY and a directional miss hint ("too many claps"); the DI port deleted both
// surfaces outright — the tally printed the running count the child was supposed
// to hold, and a direction turns a 1-to-4 answer space into a binary search. The
// tier now shapes THE TUTOR'S ENUNCIATION, which is the only scaffold channel a
// spoken listening task actually has:
//
//   #1 stimulus   echoWordSlowly — the ask says the word a SECOND time, slower
//                                  and drawn out but still one joined stream.
//                                  easy only. Never chanted in parts: the parts
//                                  ARE the answer (see syllableClapperScript).
//   #2 motor      inviteClap     — the ask invites the hands ("clap the parts,
//                                  then tell me how many"). easy + medium; hard
//                                  withdraws the motor scaffold so the
//                                  segmenting happens in the ear alone.
//
// INVARIANTS. The tier NEVER touches the word, the syllable split, the count,
// `difficulty` or `challengeType`. No tier text reaches the LLM prompt at all —
// both fields are stamped in CODE, deterministically, after the parse — so a
// tier can never steer which words are drawn. The spoken word itself and
// tap-to-hear are never withdrawn at any tier: this is a listening task and the
// stimulus is its whole point.
// ============================================================================

export type SyllableSupportTier = 'easy' | 'medium' | 'hard';

export interface SyllableClapperSupportScaffold {
  /** #1 — the ask says the word a second time, slower and still joined. */
  echoWordSlowly: boolean;
  /** #2 — the ask invites the hands. */
  inviteClap: boolean;
}

/**
 * Resolve the ask scaffolds for one SUPPORT tier.
 *
 * Pure + exported so the tier ladder is unit-testable without a Gemini call.
 * Takes the support tier ONLY — it must never see `challengeType` / the eval
 * mode (see the name-collision warning above).
 */
export function resolveSyllableSupportScaffold(
  tier: SyllableSupportTier,
): SyllableClapperSupportScaffold {
  return {
    echoWordSlowly: tier === 'easy',
    inviteClap: tier !== 'hard',
  };
}

// ============================================================================
// Schema
// ============================================================================

const syllableClapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Engaging title for the syllable clapping activity (e.g., 'Clap It Out: Animals!')",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier (e.g., 'c1', 'c2')",
          },
          word: {
            type: Type.STRING,
            description:
              "ONE single word to clap — no spaces, no phrases, no proper nouns. "
              + "Age-appropriate, concrete, picturable, and instantly recognisable BY EAR.",
          },
          challengeType: {
            type: Type.STRING,
            enum: ["easy", "medium", "hard"],
            description:
              "Word-length band: 'easy' (1-2 syllable, high-frequency), 'medium' (2-3 syllable, broader vocab), 'hard' (3-4 syllable, longer and less common)",
          },
          syllableCount: {
            type: Type.NUMBER,
            description: "Number of syllables in the word (1-4)",
          },
          syllables: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'The word split into syllable parts. Joining them MUST spell the word exactly (e.g. ["but", "ter", "fly"]).',
          },
          imageDescription: {
            type: Type.STRING,
            description:
              "Brief kid-friendly image description (3-6 words, e.g., 'a colorful butterfly')",
          },
          difficulty: {
            type: Type.NUMBER,
            description:
              "Difficulty rating from 3 (easy) to 5 (hard)",
          },
        },
        required: [
          "id",
          "word",
          "challengeType",
          "syllableCount",
          "syllables",
          "imageDescription",
          "difficulty",
        ],
      },
      description: "Array of 6-10 syllable clapping challenges",
    },
  },
  required: ["title", "challenges"],
};

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate Syllable Clapper data using Gemini AI.
 *
 * ⚠️ VALIDATION IS KEEP-OR-DROP, NEVER BACKFILL. The click era repaired a
 * missing word to the literal string "word", a missing split to `[word]`, and an
 * empty draw to a hardcoded "cat" — all invisible under a button that graded
 * against whatever key it was handed. In a judged loop each of those becomes a
 * SPOKEN ASK a live tutor must judge, and the "cat" fallback is the shape
 * letter-spotter's probe caught shipping an entirely code-authored, topic-free
 * lesson graded as success. Drops are logged with reasons and the call retries
 * once; nothing is invented.
 *
 * @param ctx - the resolved generation context (topic, grade, intent, tier)
 */
type SyllableClapperConfig = Partial<{
  challengeCount: number;
  intent: string;
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode: string;
}>;

interface RawChallenge {
  id?: string;
  word?: string;
  syllables?: string[];
  syllableCount?: number;
  imageDescription?: string;
  challengeType?: string;
  difficulty?: number;
  echoWordSlowly?: boolean;
  inviteClap?: boolean;
}

/** Why a challenge was dropped, for the log. A reject path that never says why
 *  is how interactive-book shipped five fallback books in six draws. */
const dropReason = (ch: RawChallenge): string | null => {
  const word = (ch.word ?? '').trim();
  // Kept separately because `isSayableSyllableWord` is a type guard: inside its
  // failing branch `word` is narrowed to `never`, and the whole point of the
  // branch is to PRINT what arrived (letter-spotter's 400-char deliberation).
  const shown = word.slice(0, 30);
  const parts = (ch.syllables ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  if (!isSayableSyllableWord(word)) return `"${shown}" is not one sayable word`;
  if (!hasStableSyllableCount(word)) return `"${word}" has no single syllable count in English`;
  if (parts.length < MIN_PARTS || parts.length > MAX_PARTS) {
    return `"${word}" split into ${parts.length} parts (allowed ${MIN_PARTS}-${MAX_PARTS})`;
  }
  if (!syllablesJoinToWord(word, parts)) {
    return `"${word}" parts [${parts.join('|')}] do not spell the word`;
  }
  if (endsWithSilentESyllable(parts)) {
    return `"${word}" parts [${parts.join('|')}] make a beat out of a silent final e`;
  }
  return null;
};

export const generateSyllableClapper = async (
  ctx: GenerationContext,
): Promise<SyllableClapperData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config: SyllableClapperConfig = { ...(ctx.raw as SyllableClapperConfig), intent: ctx.intent };
  // Ladder rung from the canonical curriculum grade (ctx.grade) first; the prose
  // gradeLevel band never matched ["K","1","2"] and pinned every objective to "K".
  const gradeLevelKey = clampGradeToK2(
    ctx.grade,
    (["K", "1", "2"].includes(gradeLevel.toUpperCase()) ? gradeLevel.toUpperCase() : "K") as "K" | "1" | "2",
  );

  const challengeCount = config?.challengeCount ?? 8;

  // ── Support tier (axis 3) ─────────────────────────────────────────
  // Normalized upstream by resolveGenerationContext (config.difficulty →
  // 'easy'|'medium'|'hard'|undefined). Read it here and NOWHERE else — never
  // re-parse config.difficulty, and never confuse it with targetEvalMode, whose
  // values happen to share these three words (see the warning block above).
  const supportTier = ctx.supportTier as SyllableSupportTier | undefined;

  // ── Eval mode resolution ──────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'syllable-clapper',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SyllableClapper', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(syllableClapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
      })
    : syllableClapperSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Grade guidelines (only for mixed mode) ────────────────────────
  const gradeGuidelines: Record<string, string> = {
    K: `
KINDERGARTEN GUIDELINES:
- Use simple, concrete words kids already know (cat, apple, banana, dog, happy)
- "easy" words: 1-syllable (cat, dog, sun) and 2-syllable (apple, puppy, tiger)
- "medium" words: 2-3 syllable compound/familiar (butterfly, elephant, banana)
- "hard" words: 3-syllable (dinosaur, kangaroo) — use sparingly for K
- All words should be highly picturable and familiar to 5-year-olds
`,
    "1": `
GRADE 1 GUIDELINES:
- Use familiar words with a wider range of syllable counts
- "easy": 1-2 syllable high-frequency (cat, truck, robot, flower)
- "medium": 2-3 syllable broader vocab (umbrella, computer, butterfly)
- "hard": 3-4 syllable words (caterpillar, watermelon)
- Words should be common in grade 1 vocabulary and easy to recognise by ear
`,
    "2": `
GRADE 2 GUIDELINES:
- Use a broader vocabulary including descriptive words
- "easy": 1-2 syllable (bright, garden, pencil)
- "medium": 2-3 syllable (sunflower, basketball, tomato)
- "hard": 3-4 syllable (caterpillar, kindergarten, alligator)
- Can include compound words and words with common prefixes/suffixes
`,
  };

  // ⭐ The dialect blocklist goes into the PROMPT as well as the code gate. The
  // gate alone would drop items silently and cost supply; steering the WORD
  // CHOICE is what actually fixes a draw (phoneme-explorer's blend gate moved
  // its drop rate 4/20 → 0/15 the same way).
  const bannedSample = Array.from(DIALECT_VARIABLE_WORDS).slice(0, 24).join(', ');

  const generationPrompt = `Create a syllable clapping activity for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean word choices toward "${intent}" when possible — but ALWAYS prioritize the phonological/syllable accuracy rules below over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevelKey}

HOW THIS ACTIVITY IS PLAYED — read this before choosing a single word.
A live tutor SAYS the word out loud, as one unbroken stream. The word is NEVER
shown on screen. The child claps the parts with their own hands and SAYS how many
parts they heard. So every word must:
  - be recognisable BY EAR alone (no homophone traps, no words a 5-year-old would
    only know in print),
  - be ONE word: no spaces, no hyphenated phrases, no proper nouns, no initials,
  - have ONE syllable count that every English speaker agrees on.

${challengeTypeSection}

${!evalConstraint ? (gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]) : ''}

Generate exactly ${challengeCount} challenges.
${!evalConstraint ? 'Order them from easiest to hardest (easy first, hard last).' : `All challenges MUST have challengeType "${evalConstraint.allowedTypes[0]}".`}

CRITICAL RULES:
1. The "syllables" array MUST correctly split the word into its real syllable parts.
   - "butterfly" → ["but", "ter", "fly"] (3 syllables) ✓
   - "cat" → ["cat"] (1 syllable) ✓
   - "apple" → ["ap", "ple"] (2 syllables) ✓
   - "watermelon" → ["wa", "ter", "mel", "on"] (4 syllables) ✓
2. Joining the "syllables" array MUST spell the original word EXACTLY, letter for
   letter. This is checked in code and the challenge is DISCARDED if it fails —
   the tutor reads those parts aloud one at a time, so a wrong split is a
   different word said to a child.
3. ⛔ SAY THE WORD OUT LOUD AND COUNT THE BEATS BEFORE YOU SPLIT IT. Every part
   must be one beat a child could clap. Never make a beat out of a SILENT FINAL
   E: "centipede" is ["cen","ti","pede"] — THREE beats — never
   ["cen","ti","pe","de"], which spells the word correctly and still gives the
   wrong answer. Same for "cupcake" (["cup","cake"], 2) and "hurricane"
   (["hur","ri","cane"], 3). A split ending in a lone consonant + "e" is
   DISCARDED in code.
4. "syllableCount" MUST equal the length of the "syllables" array.
5. ⛔ NEVER use a word whose syllable count depends on the speaker. Banned
   examples (this is a sample, not the whole class): ${bannedSample}.
   The test: if you can imagine two teachers clapping it a different number of
   times, DO NOT USE IT. "squirrel", "fire", "flower", "every" and "chocolate"
   are all rejected for exactly this reason. Prefer compound words and words with
   crisp consonant boundaries.
6. Each syllable part must be pronounceable on its own — letters only, no digits
   or punctuation. Avoid splits that strand a lone consonant.
7. Never use the word "yes" and never begin any text field with "Yes" or "My turn".
8. All words must be age-appropriate, concrete, and picturable for young children.
9. IDs should be sequential: "c1", "c2", "c3", etc.
10. Image descriptions should be brief (3-6 words) and kid-friendly.
11. Do NOT use the same word twice — a word is asked about once per session.
12. Try to relate words to the topic "${topic}" when possible, but prioritize
    correct, unambiguous syllable splitting over topic fit.
${!evalConstraint ? `
DISTRIBUTION for ${challengeCount} challenges:
- 2-3 "easy" words (1-2 syllables, difficulty 3)
- 3 "medium" words (2-3 syllables, difficulty 4)
- 2 "hard" words (3-4 syllables, difficulty 5)
Adjust proportions if challengeCount differs, but always include a mix.` : ''}

EXAMPLE:
{
  "title": "Clap It Out: Animals!",
  "challenges": [
    {
      "id": "c1",
      "word": "cat",
      "challengeType": "easy",
      "syllableCount": 1,
      "syllables": ["cat"],
      "imageDescription": "a fluffy orange cat",
      "difficulty": 3
    },
    {
      "id": "c2",
      "word": "tiger",
      "challengeType": "easy",
      "syllableCount": 2,
      "syllables": ["ti", "ger"],
      "imageDescription": "a striped orange tiger",
      "difficulty": 3
    },
    {
      "id": "c3",
      "word": "elephant",
      "challengeType": "medium",
      "syllableCount": 3,
      "syllables": ["el", "e", "phant"],
      "imageDescription": "a big gray elephant",
      "difficulty": 4
    }
  ]
}

Now generate the activity for "${topic}" at grade level ${gradeLevelKey}.`;

  const draw = async (): Promise<{ title: string; kept: RawChallenge[]; drawn: number }> => {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        maxOutputTokens: 8192,
        systemInstruction:
          "You are an expert K-2 reading specialist who designs engaging phonological awareness activities. " +
          "You understand English syllable structure deeply and always produce linguistically accurate syllable splits. " +
          "You choose concrete, picturable words that young learners know and can recognise by ear. " +
          "You never choose a word whose syllable count varies between speakers. " +
          "You never reveal answers in labels or descriptions. " +
          "You double-check that joining the syllables array produces the original word exactly.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as { title?: string; challenges?: RawChallenge[] };

    const raw: RawChallenge[] = Array.isArray(result.challenges) ? result.challenges : [];
    const kept: RawChallenge[] = [];
    for (let idx = 0; idx < raw.length; idx++) {
      const ch = raw[idx];
      const reason = dropReason(ch);
      if (reason) {
        console.warn(`[syllable-clapper] dropped challenge ${idx + 1}: ${reason}`);
        continue;
      }
      const parts = (ch.syllables ?? []).map((p) => p.trim()).filter(Boolean);
      const validTypes = evalConstraint?.allowedTypes ?? ['easy', 'medium', 'hard'];
      const inferred = parts.length <= 2 ? 'easy' : parts.length <= 3 ? 'medium' : 'hard';
      kept.push({
        ...ch,
        id: ch.id || `c${idx + 1}`,
        word: (ch.word ?? '').trim(),
        syllables: parts,
        // The SPLIT is authoritative; a model-supplied count that disagrees with
        // its own split is exactly what rule 3 and the join gate exist to catch.
        syllableCount: parts.length,
        challengeType: validTypes.includes(ch.challengeType ?? '')
          ? ch.challengeType
          : (validTypes.includes(inferred) ? inferred : validTypes[0]),
        difficulty:
          typeof ch.difficulty === 'number' && ch.difficulty >= 3 && ch.difficulty <= 5
            ? ch.difficulty
            : Math.min(3 + parts.length - 1, 5),
        imageDescription:
          typeof ch.imageDescription === 'string' && ch.imageDescription.trim()
            ? ch.imageDescription.trim()
            : `a picture of ${(ch.word ?? '').trim()}`,
      });
    }
    return { title: result.title || `Clap It Out: ${topic}`, kept, drawn: raw.length };
  };

  try {
    let { title, kept, drawn } = await draw();

    // One retry when the gates emptied the draw. No fallback item: a placeholder
    // in a judged loop is a spoken ask the tutor must judge, and a code-authored
    // lesson that grades as success is worse than an honest empty one.
    if (kept.length === 0) {
      console.warn(
        `[syllable-clapper] all ${drawn} challenge(s) failed the content gates — retrying once`,
      );
      ({ title, kept, drawn } = await draw());
    }

    // ── Within-mode support tier: shape the ASK (never the word, the split, or
    //    the count). Stamped PER CHALLENGE in code AFTER the parse, so the tier
    //    cannot have influenced which words the LLM drew. Gated ONLY on
    //    supportTier being present — never on challengeType / the eval mode,
    //    which share the same three words. ──
    if (supportTier) {
      const sc = resolveSyllableSupportScaffold(supportTier);
      for (const ch of kept) {
        ch.echoWordSlowly = sc.echoWordSlowly;
        ch.inviteClap = sc.inviteClap;
      }
      console.log(
        `[syllable-clapper] Support tier "${supportTier}" applied to ${kept.length} challenge(s) — `
        + `echoWordSlowly=${sc.echoWordSlowly}, inviteClap=${sc.inviteClap}. Eval mode (word band) `
        + `"${config?.targetEvalMode ?? 'blended'}" is UNCHANGED by the tier.`,
      );
    }

    const finalData: SyllableClapperData = {
      title,
      ...(supportTier ? { supportTier } : {}),
      challenges: kept as SyllableClapperData['challenges'],
    };

    console.log("Syllable Clapper Generated:", {
      title: finalData.title,
      drawn,
      kept: finalData.challenges.length,
      dropped: drawn - finalData.challenges.length,
      words: finalData.challenges.map((c) => c.word),
      challengeTypes: finalData.challenges.map((c) => c.challengeType),
      syllableCounts: finalData.challenges.map((c) => c.syllableCount),
      supportTier: supportTier ?? '(none — fully supported ask)',
    });

    return finalData;
  } catch (error) {
    console.error("Error generating syllable clapper:", error);
    throw error;
  }
};
