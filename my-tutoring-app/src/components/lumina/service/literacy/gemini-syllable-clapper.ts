import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { clampGradeToK2 } from "../scopeContext";
import { SyllableClapperData } from "../../primitives/visual-primitives/literacy/SyllableClapper";
import {
  DIALECT_VARIABLE_WORDS,
  MAX_PARTS,
  MIN_PARTS,
  deletionShapeIsValid,
  endsWithSilentESyllable,
  hasStableSyllableCount,
  isSayableSyllableWord,
  syllablesJoinToWord,
  taskOf,
  type SyllableBand,
} from "../../primitives/visual-primitives/literacy/syllableClapperScript";
import {
  SYLLABLE_CLAPPER_TYPE_DOCS,
  SYLLABLE_TASKS,
  syllableTaskShape,
  type SyllableTask,
} from "../../primitives/visual-primitives/literacy/syllableClapperModes";
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// Challenge Type Documentation — ONE ENTRY PER TASK IDENTITY, and it is NOT
// written here.
//
// ⭐ THE DOCS COME FROM `syllableClapperModes`, which is also where the catalog
// gets its `evalModes` and the pack gets its response classes and step
// sequence. That single declaration is the point: before it, the generator's
// prompt docs, the catalog's mode list and the judged pack's contracts were
// three hand-maintained copies of the same three facts, and the failure mode
// was silent — a mode renamed in one place still generated, still rendered,
// and simply stopped being routable.
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = SYLLABLE_CLAPPER_TYPE_DOCS;

// ============================================================================
// Within-mode SUPPORT TIER (config.difficulty) — scaffolding AND word length
//
// ⭐ WORD LENGTH LIVES HERE NOW (2026-09-11). It used to be the eval mode, under
// the names `easy` / `medium` / `hard`, which made one act look like three
// skills and left the three real acts — blending, counting, deleting — with
// nowhere to be declared. Length is what it always was: how hard an instance of
// ONE skill is, which is the tier axis. It now rides `config.difficulty`
// alongside the two ask scaffolds that were already there.
//
// THE NAME COLLISION THAT MOTIVATED THE OLD WARNING BLOCK IS GONE. `evalMode`
// and `challengeType` are now `blend_syllables` | `count_parts` |
// `delete_compound`; the tier is `easy` | `medium` | `hard`. The two axes no
// longer share a single word.
//
//   #1 stimulus   echoWordSlowly — the ask voices the stimulus a SECOND time.
//                                  easy only. On counting and deleting that is
//                                  the word, slower and still joined — never
//                                  chanted, because the parts ARE the answer
//                                  there. On blending it is the same chant
//                                  again, because the chant IS the question.
//   #2 motor      inviteClap     — the ask invites the hands ("clap the parts,
//                                  then tell me how many"). `count_parts` only,
//                                  easy + medium; hard withdraws the motor
//                                  scaffold so the segmenting happens in the
//                                  ear alone.
//   #3 length     band           — how many parts the drawn words have. A
//                                  PROMPT steer only: it never becomes a code
//                                  gate, because a tier that DROPS content
//                                  empties a draw silently. The code gate is
//                                  the mode's own part window
//                                  (`syllableTaskShape`), which is about what
//                                  the act can ask at all.
//
// INVARIANTS. The tier never touches the syllable split, the count, the
// residue, or `challengeType`. The scaffold flags are stamped in CODE after the
// parse, so they cannot steer which words the model drew; only the band reaches
// the prompt, and only as a length preference.
// ============================================================================

export type SyllableSupportTier = 'easy' | 'medium' | 'hard';

export interface SyllableClapperSupportScaffold {
  /** #1 — the ask voices the stimulus a second time. */
  echoWordSlowly: boolean;
  /** #2 — the ask invites the hands (`count_parts` only). */
  inviteClap: boolean;
  /** #3 — the word-length band the prompt asks for. */
  band: SyllableBand;
}

/**
 * Resolve the ask scaffolds and the length band for one SUPPORT tier.
 * Pure + exported so the tier ladder is unit-testable without a Gemini call.
 */
export function resolveSyllableSupportScaffold(
  tier: SyllableSupportTier,
): SyllableClapperSupportScaffold {
  return {
    echoWordSlowly: tier === 'easy',
    inviteClap: tier !== 'hard',
    band: tier,
  };
}

/**
 * The length preference for one act at one tier, as a prompt line.
 *
 * `delete_compound` is exactly two parts at every tier — a compound has two
 * words in it and that is the whole shape of the act — so its ladder is word
 * FAMILIARITY instead of word length. That is an honest ladder and not a missing
 * one: "say cupcake without cup" and "say lighthouse without light" are
 * genuinely different asks for a five-year-old.
 */
const bandPromptLine = (task: SyllableTask, band: SyllableBand): string => {
  if (task === 'delete_compound') {
    return band === 'easy'
      ? 'Use the most familiar two-part compounds a five-year-old hears every day (cupcake, sunhat, bedtime, football).'
      : band === 'medium'
        ? 'Use common two-part compounds (bedroom, rainbow, raincoat, toothbrush, snowman).'
        : 'Use less everyday two-part compounds whose parts are still both ordinary words (sandcastle, lighthouse, grasshopper, butterfly).';
  }
  if (task === 'blend_syllables') {
    return band === 'easy'
      ? 'Use TWO-part words, highly familiar and concrete (rabbit, pencil, tiger, apple).'
      : band === 'medium'
        ? 'Use two- and three-part words from a broader vocabulary (butterfly, umbrella, banana).'
        : 'Use three- and four-part words that are still instantly recognisable once joined (alligator, watermelon, helicopter).';
  }
  return band === 'easy'
    ? 'Use ONE- and TWO-part high-frequency words with clean boundaries (cat, dog, apple, puppy, tiger).'
    : band === 'medium'
      ? 'Use TWO- and THREE-part words from a broader vocabulary; compound words are ideal because their beats are obvious to the ear (butterfly, sunflower, basketball).'
      : 'Use THREE- and FOUR-part words — longer and less familiar, but every beat still cleanly heard (caterpillar, watermelon, alligator, helicopter). Length is the difficulty here, never ambiguity.';
};

// ============================================================================
// Schema
// ============================================================================

const syllableClapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Engaging title for the syllable activity (e.g., 'Clap It Out: Animals!')",
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
              "ONE single word — no spaces, no phrases, no proper nouns. "
              + "Age-appropriate, concrete, picturable, and instantly recognisable BY EAR.",
          },
          challengeType: {
            type: Type.STRING,
            enum: [...SYLLABLE_TASKS],
            description:
              "The task: 'blend_syllables' (hear the parts, say the word), "
              + "'count_parts' (hear the word, say how many parts), "
              + "'delete_compound' (say the compound word without one of its two words)",
          },
          syllableCount: {
            type: Type.NUMBER,
            description: "Number of syllables in the word (1-5)",
          },
          syllables: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'The word split into syllable parts. Joining them MUST spell the word exactly (e.g. ["but", "ter", "fly"]).',
          },
          removePart: {
            type: Type.STRING,
            description:
              "delete_compound ONLY: the compound WORD the tutor takes away. MUST be exactly "
              + "one of the two entries in 'syllables'. Leave empty for the other tasks.",
          },
          residue: {
            type: Type.STRING,
            description:
              "delete_compound ONLY: the ordinary word left behind. MUST be the OTHER entry in "
              + "'syllables', and MUST be a word a five-year-old knows on its own. Leave empty "
              + "for the other tasks.",
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
      description: "Array of 6-10 syllable challenges",
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
  /** Parent objective text — the secondary routing signal for mode resolution. */
  objectiveText: string;
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
  removePart?: string;
  residue?: string;
  difficulty?: number;
  echoWordSlowly?: boolean;
  inviteClap?: boolean;
}

/**
 * Why a challenge was dropped, for the log. A reject path that never says why
 * is how interactive-book shipped five fallback books in six draws.
 *
 * It mirrors `itemFromChallenge`'s gates one for one, including the per-TASK
 * part window — a two-part word is a fine `count_parts` item and an impossible
 * `blend_syllables` one at the four-part band, and the generator should say so
 * rather than let the component drop it silently at render.
 */
const dropReason = (ch: RawChallenge): string | null => {
  const word = (ch.word ?? '').trim();
  // Kept separately because `isSayableSyllableWord` is a type guard: inside its
  // failing branch `word` is narrowed to `never`, and the whole point of the
  // branch is to PRINT what arrived (letter-spotter's 400-char deliberation).
  const shown = word.slice(0, 30);
  const parts = (ch.syllables ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  const task = taskOf(ch.challengeType);
  const shape = syllableTaskShape(task);
  if (!isSayableSyllableWord(word)) return `"${shown}" is not one sayable word`;
  if (!hasStableSyllableCount(word)) return `"${word}" has no single syllable count in English`;
  const min = Math.max(MIN_PARTS, shape.partsMin);
  const max = Math.min(MAX_PARTS, shape.partsMax);
  if (parts.length < min || parts.length > max) {
    return `"${word}" split into ${parts.length} parts (${task} allows ${min}-${max})`;
  }
  if (!syllablesJoinToWord(word, parts)) {
    return `"${word}" parts [${parts.join('|')}] do not spell the word`;
  }
  if (endsWithSilentESyllable(parts)) {
    return `"${word}" parts [${parts.join('|')}] make a beat out of a silent final e`;
  }
  if (shape.needsResidue && !deletionShapeIsValid(parts, ch.removePart, ch.residue)) {
    return `"${word}" cannot be a deletion item: remove="${ch.removePart ?? ''}" `
      + `residue="${ch.residue ?? ''}" must be the two parts [${parts.join('|')}], both sayable words`;
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

  // ── Support tier ──────────────────────────────────────────────────
  // Normalized upstream by resolveGenerationContext (config.difficulty →
  // 'easy'|'medium'|'hard'|undefined). Read it here and NOWHERE else.
  const supportTier = ctx.supportTier as SyllableSupportTier | undefined;

  // ── Eval mode resolution ──────────────────────────────────────────
  // The INTENT path matters now in a way it could not before: with the modes
  // renamed from word lengths to acts, "blend syllables to say the word" and
  // "count the syllables you hear" are different objectives that resolve to
  // different modes, where previously both landed on a length band.
  const resolution = await resolveEvalModes(
    'syllable-clapper',
    {
      targetEvalMode: config?.targetEvalMode,
      intent: config?.intent,
      objectiveText: config?.objectiveText,
    },
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = resolution
    ? constrainChallengeTypeEnum(syllableClapperSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
      })
    : syllableClapperSchema;

  const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);

  console.log(
    `[SyllableClapper] modes: ${resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed'}`
    + ` → types [${(resolution?.allowedTypes ?? ['all']).join(', ')}]`,
  );

  // ── The length band reaches the prompt; the scaffolds never do ─────
  // Gated on a SINGLE resolved mode: a blend of two acts has no one length
  // ladder (two parts is the floor for blending and the ceiling for deleting),
  // so asking for one would steer one act's words with the other's rung.
  const pinnedTask = resolution?.modes.length === 1
    ? (resolution.allowedTypes[0] as SyllableTask)
    : undefined;
  const scaffold = supportTier ? resolveSyllableSupportScaffold(supportTier) : null;
  const tierSection = scaffold && pinnedTask
    ? `\nWORD LENGTH FOR THIS ACTIVITY:\n- ${bandPromptLine(pinnedTask, scaffold.band)}\n`
    : '';

  // ⭐ The dialect blocklist goes into the PROMPT as well as the code gate. The
  // gate alone would drop items silently and cost supply; steering the WORD
  // CHOICE is what actually fixes a draw (phoneme-explorer's blend gate moved
  // its drop rate 4/20 → 0/15 the same way).
  const bannedSample = Array.from(DIALECT_VARIABLE_WORDS).slice(0, 24).join(', ');

  const generationPrompt = `Create a syllable activity for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean word choices toward "${intent}" when possible — but ALWAYS prioritize the phonological/syllable accuracy rules below over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevelKey}

HOW THIS ACTIVITY IS PLAYED — read this before choosing a single word.
A live tutor VOICES the word out loud and the child answers OUT LOUD. The word is
NEVER shown on screen, in any task. So every word must:
  - be recognisable BY EAR alone (no homophone traps, no words a 5-year-old would
    only know in print),
  - be ONE word: no spaces, no hyphenated phrases, no proper nouns, no initials,
  - have ONE syllable count that every English speaker agrees on.

${challengeTypeSection}
${tierSection}
${!resolution ? `
GRADE GUIDANCE (${gradeLevelKey}): use concrete, picturable words the child already
knows by sound. Kindergarten stays with everyday one- and two-part words; Grade 1
adds three-part words; Grade 2 adds longer and less common words.
` : ''}
Generate exactly ${challengeCount} challenges.
${resolution && resolution.allowedTypes.length === 1
  ? `All challenges MUST have challengeType "${resolution.allowedTypes[0]}".`
  : 'Order them from easiest to hardest.'}

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
11. Do NOT use the same word twice — a word is asked about once per session,
    whatever the task.
12. Try to relate words to the topic "${topic}" when possible, but prioritize
    correct, unambiguous syllable splitting over topic fit.
13. ⛔ FOR "delete_compound" ONLY — the strictest rule in this prompt, and the
    reason is that the child has to SAY the leftover out loud. The word MUST be a
    TWO-part COMPOUND, and BOTH parts must be ordinary words a five-year-old
    already knows on their own. The parts here are WORDS, not syllables — a part
    may be two beats long ("dragonfly" is "dragon" + "fly", and that is correct).
    Supply "removePart" (one of the two parts) and "residue" (the OTHER part).
    Both parts are checked against a list of common words in code, and the
    challenge is DISCARDED if either is not on it.
    - "cupcake" → ["cup","cake"], removePart "cup", residue "cake" ✓
    - "dragonfly" → ["dragon","fly"], removePart "dragon", residue "fly" ✓
    - "peanut" → ["pe","anut"] ✗ — "anut" is not a word. It is "pea" + "nut".
    - "walnut" → ["wal","nut"] ✗ — "wal" is not a word.
    - "banana" ✗ — not a compound at all; "banana without ba" is "nana".
    - "sunflower" → ["sun","flower"] ✗ — "flower" is dialect-variable.
    - "rabbit" → ["rab","bit"] ✗ — "rab" is not a word.
    Good sources: cupcake, bedroom, raincoat, toothbrush, snowman, football,
    sandbox, popcorn, bedtime, sunhat, backpack, mailbox, cowboy, starfish,
    bluebird, ladybug, dragonfly, honeybee, birdhouse, cornbread, oatmeal.

EXAMPLE (one of each task — your activity will usually be all one task):
{
  "title": "Clap It Out: Animals!",
  "challenges": [
    {
      "id": "c1",
      "word": "tiger",
      "challengeType": "blend_syllables",
      "syllableCount": 2,
      "syllables": ["ti", "ger"],
      "imageDescription": "a striped orange tiger",
      "difficulty": 3
    },
    {
      "id": "c2",
      "word": "elephant",
      "challengeType": "count_parts",
      "syllableCount": 3,
      "syllables": ["el", "e", "phant"],
      "imageDescription": "a big gray elephant",
      "difficulty": 4
    },
    {
      "id": "c3",
      "word": "starfish",
      "challengeType": "delete_compound",
      "syllableCount": 2,
      "syllables": ["star", "fish"],
      "removePart": "star",
      "residue": "fish",
      "imageDescription": "an orange starfish",
      "difficulty": 5
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
          "For deletion tasks you only ever choose two-part compounds whose halves are both real, familiar words. " +
          "You never reveal answers in labels or descriptions. " +
          "You double-check that joining the syllables array produces the original word exactly.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as { title?: string; challenges?: RawChallenge[] };

    const raw: RawChallenge[] = Array.isArray(result.challenges) ? result.challenges : [];
    const kept: RawChallenge[] = [];
    const validTypes: string[] = resolution?.allowedTypes ?? [...SYLLABLE_TASKS];
    for (let idx = 0; idx < raw.length; idx++) {
      const ch = {
        ...raw[idx],
        // Normalize BEFORE the gate: a payload whose challengeType is outside
        // the resolved set is re-homed to the resolved act, and the gate then
        // judges it against THAT act's part window. Re-homing after the gate
        // would let a three-part word through as a deletion item.
        challengeType: validTypes.includes(raw[idx].challengeType ?? '')
          ? raw[idx].challengeType
          : validTypes[0],
      };
      const reason = dropReason(ch);
      if (reason) {
        console.warn(`[syllable-clapper] dropped challenge ${idx + 1}: ${reason}`);
        continue;
      }
      const parts = (ch.syllables ?? []).map((p) => p.trim()).filter(Boolean);
      kept.push({
        ...ch,
        id: ch.id || `c${idx + 1}`,
        word: (ch.word ?? '').trim(),
        syllables: parts,
        // The SPLIT is authoritative; a model-supplied count that disagrees with
        // its own split is exactly what rule 3 and the join gate exist to catch.
        syllableCount: parts.length,
        ...(ch.challengeType === 'delete_compound'
          ? { removePart: (ch.removePart ?? '').trim(), residue: (ch.residue ?? '').trim() }
          : { removePart: undefined, residue: undefined }),
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

    // ── Support tier: shape the ASK (never the word, the split, the count or
    //    the residue). Stamped PER CHALLENGE in code AFTER the parse, so the
    //    tier cannot have influenced which words the LLM drew. ──
    if (scaffold) {
      for (const ch of kept) {
        ch.echoWordSlowly = scaffold.echoWordSlowly;
        ch.inviteClap = scaffold.inviteClap;
      }
      console.log(
        `[syllable-clapper] Support tier "${supportTier}" applied to ${kept.length} challenge(s) — `
        + `echoWordSlowly=${scaffold.echoWordSlowly}, inviteClap=${scaffold.inviteClap}, `
        + `band="${scaffold.band}"${pinnedTask ? '' : ' (band NOT sent — no single pinned act)'}.`,
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
