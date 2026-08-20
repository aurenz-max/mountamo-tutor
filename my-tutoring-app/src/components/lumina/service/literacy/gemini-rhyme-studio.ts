import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { clampGradeToK2 } from "../scopeContext";
import { RhymeStudioData } from "../../primitives/visual-primitives/literacy/RhymeStudio";
import { isSentinelSafeWord } from "../../primitives/visual-primitives/literacy/rhymeStudioScript";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildRemediationPrompt } from '../generation/remediationPrompt';

type RhymeMode = 'recognition' | 'identification' | 'production';
type RhymeRemediationMove = 'contrast_rime' | 'diagnostic_option' | 'constrained_production';
export function rhymeRemediationMoveFor(mode: RhymeMode, focus?: string): RhymeRemediationMove | undefined {
  if (!focus?.trim()) return undefined;
  if (mode === 'recognition') return 'contrast_rime';
  if (mode === 'identification') return 'diagnostic_option';
  return 'constrained_production';
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

// Irregular-spelling words that Gemini can't reliably classify for rhyme.
// These words rhyme phonetically with regular words but their spelling misleads
// the LLM into marking valid pairs as non-rhyming (SP-7).
const IRREGULAR_RHYME_WORDS = [
  'one', 'two', 'four', 'eight',
  'there', 'were', 'done', 'gone', 'come', 'some',
  'love', 'have', 'give', 'live',
  'said', 'says',
  'though', 'through', 'tough', 'cough', 'dough',
];

// ---------------------------------------------------------------------------
// Pre-reader (K) picture vocabulary
// ---------------------------------------------------------------------------
// flash-lite will NOT reliably emit emojis inside the nested `options` array in
// the same call that produces the options themselves (it silently drops the
// array). So at K we DON'T ask the model for emojis at all — we (a) constrain the
// word choice to this curated, picturable CVC set (injected into the prompt) and
// (b) attach the emoji deterministically in post-process. Every family carries
// ≥3 members so the model can always build a rhyming pair AND a cross-family
// distractor. Entropy stays in the prompt; the code owns the picture surface.
const K_RHYME_FAMILIES: { family: string; words: Array<[string, string]> }[] = [
  { family: '-at', words: [['cat', '🐱'], ['hat', '🎩'], ['bat', '🦇'], ['rat', '🐀'], ['mat', '🧘']] },
  { family: '-an', words: [['pan', '🍳'], ['man', '👨'], ['fan', '🪭'], ['van', '🚐'], ['can', '🥫']] },
  { family: '-ig', words: [['pig', '🐷'], ['wig', '💇'], ['dig', '⛏️'], ['zig', '⚡']] },
  { family: '-og', words: [['dog', '🐶'], ['log', '🪵'], ['frog', '🐸'], ['hog', '🐗']] },
  { family: '-ot', words: [['pot', '🍲'], ['hot', '🔥'], ['dot', '⚫'], ['cot', '🛏️']] },
  { family: '-un', words: [['sun', '☀️'], ['bun', '🍞'], ['run', '🏃'], ['fun', '🎉']] },
  { family: '-en', words: [['hen', '🐔'], ['pen', '🖊️'], ['ten', '🔟'], ['den', '🕳️']] },
  { family: '-op', words: [['top', '🔝'], ['mop', '🧹'], ['pop', '🍿'], ['hop', '🐰']] },
  { family: '-ug', words: [['bug', '🐛'], ['rug', '🧶'], ['mug', '☕'], ['hug', '🤗']] },
  { family: '-ip', words: [['lip', '👄'], ['zip', '🤐'], ['ship', '🚢'], ['drip', '💧']] },
  { family: '-ox', words: [['box', '📦'], ['fox', '🦊'], ['ox', '🐂']] },
  { family: '-ed', words: [['bed', '🛌'], ['red', '🟥'], ['sled', '🛷']] },
];

// Flat lowercase word → emoji lookup derived from the families above.
const K_WORD_EMOJI: Record<string, string> = Object.fromEntries(
  K_RHYME_FAMILIES.flatMap((f) => f.words.map(([w, e]) => [w.toLowerCase(), e])),
);

/** Emoji for a K word, or a neutral ⭐ picture if it wasn't drawn from the set. */
const kEmojiFor = (word: unknown): string =>
  K_WORD_EMOJI[String(word ?? '').toLowerCase().trim()] ?? '⭐';

/** The picturable-word menu, grouped by rhyme family, injected into the K prompt. */
const K_WORD_MENU = K_RHYME_FAMILIES
  .map((f) => `  ${f.family}: ${f.words.map(([w]) => w).join(', ')}`)
  .join('\n');

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  recognition: {
    promptDoc:
      `"recognition": Show two words; student says "yes" or "no" to whether they rhyme. `
      + `Mix it up: some pairs SHOULD rhyme (doesRhyme: true), some should NOT (doesRhyme: false). `
      + `REQUIRED fields: comparisonWord, comparisonWordImage, doesRhyme. `
      + `Do NOT include options or acceptableAnswers. 3-4 challenges per session. `
      + `NEVER use these irregular-spelling words as targetWord or comparisonWord in recognition: ${IRREGULAR_RHYME_WORDS.join(', ')}. `
      + `Only use words with regular, predictable spelling patterns so rhyme judgments are unambiguous.`,
    schemaDescription: "'recognition' (do these words rhyme? yes/no)",
  },
  identification: {
    promptDoc:
      `"identification": Show a target word and 2-3 options; student SAYS the rhyming one out loud. `
      + `Exactly ONE option must have isCorrect: true; all others isCorrect: false. `
      + `Make at least one distractor share the target's BEGINNING sound but not its ending `
      + `(cat → cap, not cat → dog): confusing rhyme with alliteration is the signature error this mode diagnoses. `
      + `REQUIRED fields: options (array of {word, image, isCorrect}). `
      + `Do NOT include comparisonWord, doesRhyme, or acceptableAnswers. 2-3 challenges per session.`,
    schemaDescription: "'identification' (say the rhyming word)",
  },
  production: {
    // OPEN since 2026-08-19: the word bank is deleted and the child THINKS OF a
    // rhyme rather than reading four and saying one. The generator therefore
    // supplies no answer material at all — the tutor judges against a rule, and
    // the only thing it speaks is the target. This is also why the prompt no
    // longer asks for `acceptableAnswers`: that list once contained "NAKE" for
    // the target "cake", and anything it emits here would be an invented word
    // the judge had been told to accept.
    promptDoc:
      `"production": Show ONE target word; the student thinks of any real rhyming word and SAYS it. `
      + `There is no word bank and no options — the answer set is open and the tutor judges it. `
      + `REQUIRED fields: targetWord and rhymeFamily only. `
      + `Do NOT include comparisonWord, doesRhyme, options, acceptableAnswers or bankDistractors. `
      + `Choose targets with MANY common rhymes a young child would know (cat, sun, bed) — never a `
      + `rhyme-poor word (orange, month). 2-3 challenges per session.`,
    schemaDescription: "'production' (think of a rhyming word and say it — open answer)",
  },
};

// ---------------------------------------------------------------------------
// Sentinel safety (DI standing gate 2)
// ---------------------------------------------------------------------------
// Under the judged loop every word here reaches a line the TUTOR SPEAKS, and a
// word that opens a sentence with a verdict sentinel is read by the engine as a
// judgment. The pre-DI component shipped a hardcoded distractor pool whose
// seventh entry was literally "yes" — port 7's near miss arriving here as a
// latent bug. `isSentinelSafeWord` is the pack's own filter, applied to every
// pool this generator emits so the prompt is never trusted with the rule.

/** Drop any word that could open a spoken sentence with a sentinel. */
const sentinelSafe = (words: unknown): string[] =>
  (Array.isArray(words) ? words : [])
    .map((w) => String(w ?? '').trim())
    .filter((w) => w.length > 0 && isSentinelSafeWord(w));

// ⛔ `FALLBACK_BANK_DISTRACTORS` lived here — generic non-rhyming fillers that
// topped up a short word bank. The bank is deleted (2026-08-19) and nothing
// fills anything, so the pool went with it rather than lingering as an unused
// content source.

// ---------------------------------------------------------------------------
// Rhyme integrity — the answer key, checked in code
// ---------------------------------------------------------------------------
// Found by the DI port's live probes (2026-08-12), and it is the port-7 rule
// arriving again: WHERE A PORT CONVERTS A TAP TO A SPOKEN RELATION, RE-CHECK
// THE CONTENT THE TAP NEVER HAD TO JUSTIFY. Three false keys shipped from live
// Gemini in five probes, all silent under a tap surface and all spoken aloud
// under this one:
//   - target "shark" carried rhymeFamily "-ank" and the answer "tank". The
//     correction would have said "tank rhymes with shark — both end with ank".
//   - target "crab" (-ab) offered "fab" as a DISTRACTOR. A child saying it
//     would have been corrected for a right answer.
//   - target "jump" (-ump) listed "lamp" as an acceptable rhyme.
// All three are decidable from spelling alone, which is exactly why the prompt
// was never the right place for the rule. Recognition's irregular-spelling
// words are filtered separately (SP-7), so a spelling test is safe here.

const endsWithRime = (word: unknown, rime: string): boolean =>
  rime.length > 0 && String(word ?? '').trim().toLowerCase().endsWith(rime);

/**
 * Repair what is repairable, drop what is not. Returns false when the challenge
 * cannot be made truthful — a wrong answer key must never ship, and a mode with
 * two right answers is not a harder item, it is a broken one.
 */
export function holdsRhymeIntegrity(ch: Record<string, unknown>): boolean {
  const target = String(ch.targetWord ?? '').trim().toLowerCase();
  const rime = String(ch.rhymeFamily ?? '').replace(/^-+/, '').toLowerCase();
  // The family must be the target's OWN ending. "shark" + "-ank" is not a hard
  // item, it is a false premise, and nothing downstream can recover from it.
  if (!target || !rime || !target.endsWith(rime)) return false;

  if (ch.mode === 'recognition') {
    // The words are the truth and the boolean is a claim about them, so the
    // claim is recomputed rather than trusted.
    ch.doesRhyme = endsWithRime(ch.comparisonWord, rime);
    return !!String(ch.comparisonWord ?? '').trim();
  }

  if (ch.mode === 'identification') {
    const options = (ch.options ?? []) as Array<{ word: string; isCorrect: boolean }>;
    const correct = options.filter((o) => o.isCorrect && endsWithRime(o.word, rime));
    // A "distractor" that really rhymes is a second right answer — drop it
    // rather than ship an item that corrects a correct child.
    const distractors = options.filter((o) => !o.isCorrect && !endsWithRime(o.word, rime));
    if (correct.length === 0 || distractors.length === 0) return false;
    ch.options = [correct[0], ...distractors];
    return true;
  }

  if (ch.mode === 'production') {
    /**
     * ⭐ AN OPEN ITEM HAS NO ANSWER KEY TO CHECK, SO THE GATE MOVED TO THE
     * STIMULUS — and this branch is the one place the bank deletion could have
     * silently emptied the mode.
     *
     * It used to require at least one `acceptableAnswers` entry that genuinely
     * rhymed, dropping the item otherwise. With the bank gone the generator no
     * longer emits that list at all, so the old gate would have dropped EVERY
     * production challenge and the mode would have shipped as an empty
     * activity.
     *
     * What is still checkable, and what actually matters now: the rhymeFamily
     * must really be the ending of the target. The tutor SPEAKS the rime in its
     * correction ("listen to the end of hat — at"), so a target/rime mismatch
     * puts a false phonics claim in a five-year-old's ear. Whether the target
     * has plenty of rhymes is a content-quality question, handled in the prompt.
     */
    if (!endsWithRime(String(ch.targetWord ?? ''), rime)) return false;
  }
  return true;
}


// ---------------------------------------------------------------------------
// WITHIN-MODE SUPPORT TIER (ctx.supportTier) — scaffolding withdrawal.
//
// INVARIANT: the tier NEVER touches the prompt and NEVER changes which content is
// drawn. Word choice, rhyme families, which option is correct, and the
// acceptableAnswers data are all identical at every tier — the LLM is never told
// the tier exists. Everything below is stamped in CODE, post-parse, and is purely
// a DISPLAY / INSTRUCTION / TUTOR-latitude decision.
//
// Levers (one field each), by modality:
//   #1 perception   showRhymeFamilyHighlight — the amber rime-suffix highlight on
//                     the target card. easy shows it; medium/hard withdraw it, so
//                     the student must hear the rime instead of seeing it outlined.
//   #1 perception   showWordImage            — the reader-grade prose image caption
//                     under a word / option tile (a semantic self-check cue).
//                     FORCED TRUE at K: the emoji IS the pre-reader answer surface.
//   #2 instruction  tutorNamesOptions        — whether the tutor enumerates the
//                     answer choices / word bank out loud in its scripted ask.
//                     hard suppresses the enumeration, so a reader must read the
//                     set off the screen before speaking. FORCED TRUE at K — a
//                     non-reader cannot read the set, and without it there is no
//                     closed answer set at all.
//
// RETIRED BY THE DI PORT (2026-08-12): `showInstructionText` withdrew an
// on-screen task restatement that no longer exists — under the judged loop the
// tutor's scripted ask IS the instruction channel at every tier and every band.
// The DISTAR lead-in ladder in `rhymeStudioScript.ts` (model + guide → model →
// nothing) is where tier #2 now does its work.
//   #5 answer-form  RETIRED BY THE BANK DELETION (2026-08-19). `productionCorrectCount`
//                     tuned how many of the four word-bank tiles were correct rhymes;
//                     with production OPEN there are no tiles and no hit rate. The
//                     mode's real support ladder is the DISTAR lead-in in
//                     `rhymeStudioScript.ts` (model + guide → model → nothing), which
//                     is a scaffolding lever intrinsic to the interaction rather than
//                     a property of a menu that no longer exists.
// ---------------------------------------------------------------------------

export type RhymeSupportTier = 'easy' | 'medium' | 'hard';

export interface RhymeSupportScaffold {
  showRhymeFamilyHighlight: boolean;
  tutorNamesOptions: boolean;
  showWordImage: boolean;
}

/** The scaffolding ladder. easy = every help shown. */
export function resolveRhymeSupportScaffold(tier: RhymeSupportTier): RhymeSupportScaffold {
  return {
    // The rime highlight is the single strongest visual give-away — it is the
    // first thing withdrawn.
    showRhymeFamilyHighlight: tier === 'easy',
    showWordImage: tier === 'easy',
    // The tutor's enumeration survives to medium; hard is the "read the set
    // yourself, then say it" rung.
    tutorNamesOptions: tier !== 'hard',
  };
}

/**
 * Stamp the tier's scaffold fields onto each challenge, in place.
 *
 * BAND SUPPORTS ALWAYS WIN: at the pre-reader band (K) the picture surface and the
 * tutor's word read-aloud are the child's only channels, so `showWordImage` and
 * `tutorNamesOptions` are forced TRUE no matter what the tier says.
 *
 * Called AFTER the K emoji post-process so band rules are applied on top of a
 * fully-formed pre-reader challenge.
 */
export function applyRhymeSupportTier(
  challenges: Array<Record<string, unknown>>,
  tier: RhymeSupportTier,
  isPreReaderBand: boolean,
): void {
  const sc = resolveRhymeSupportScaffold(tier);
  for (const ch of challenges) {
    ch.showRhymeFamilyHighlight = sc.showRhymeFamilyHighlight;
    // ── Band floor (K = pre-reader) ──
    ch.showWordImage = isPreReaderBand ? true : sc.showWordImage;
    ch.tutorNamesOptions = isPreReaderBand ? true : sc.tutorNamesOptions;
  }
}

/**
 * Schema definition for Rhyme Studio Data
 *
 * Generates multi-mode rhyme practice activities for K-2 students.
 * Three modes:
 *   - Recognition: Do these two words rhyme? (yes/no)
 *   - Identification: Pick the rhyming word from options
 *   - Production: Type a word that rhymes with the target
 */
const rhymeStudioSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the rhyming activity (e.g., 'Rhyme Time: Animals!')",
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
          mode: {
            type: Type.STRING,
            enum: ["recognition", "identification", "production"],
            description: "Challenge mode",
          },
          remediationMove: {
            type: Type.STRING,
            enum: ["contrast_rime", "diagnostic_option", "constrained_production"],
            description: "Private remediation trace; set only when remediation is active."
          },
          targetWord: {
            type: Type.STRING,
            description: "The primary word for this challenge",
          },
          targetWordImage: {
            type: Type.STRING,
            description: "Short image description for the target word (e.g., 'a fluffy cat')",
          },
          rhymeFamily: {
            type: Type.STRING,
            description: "The rhyme family suffix (e.g., '-at', '-un', '-ig')",
          },
          comparisonWord: {
            type: Type.STRING,
            description: "Recognition mode: the second word to compare",
          },
          comparisonWordImage: {
            type: Type.STRING,
            description: "Recognition mode: image description for comparison word",
          },
          doesRhyme: {
            type: Type.BOOLEAN,
            description: "Recognition mode: whether the two words actually rhyme",
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: {
                  type: Type.STRING,
                  description: "Option word",
                },
                image: {
                  type: Type.STRING,
                  description: "Short image description for this option",
                },
                isCorrect: {
                  type: Type.BOOLEAN,
                  description: "Whether this option rhymes with the target word",
                },
              },
              required: ["word", "image", "isCorrect"],
            },
            description: "Identification mode: 2-3 word options (exactly one correct)",
          },
        },
        required: ["id", "mode", "targetWord", "targetWordImage", "rhymeFamily"],
      },
      description: "Array of 8-10 challenges mixing all three modes",
    },
  },
  required: ["title", "challenges"],
};

/**
 * Generate Rhyme Studio data using Gemini AI
 *
 * Creates multi-mode rhyming practice activities that progress from
 * recognition (easiest) through identification to production (hardest).
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary complexity
 * @param config - Optional configuration overrides (e.g., challengeCount, targetEvalMode)
 * @returns RhymeStudioData with grade-appropriate rhyming challenges
 */
type RhymeStudioConfig = Partial<{
    challengeCount: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>;

export const generateRhymeStudio = async (
  ctx: GenerationContext,
): Promise<RhymeStudioData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as RhymeStudioConfig;
  // Support tier arrives already normalized ('easy'|'medium'|'hard'|undefined) from
  // resolveGenerationContext — never re-parse config.difficulty here. It is applied
  // in code AFTER the model responds; it never enters the prompt.
  const supportTier = ctx.supportTier;
  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'rhyme-studio',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('RhymeStudio', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(rhymeStudioSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : rhymeStudioSchema;

  // Ladder rung from the canonical curriculum grade (ctx.grade) first; the prose
  // gradeLevel band never matched ["K","1","2"] and pinned every objective to "K".
  const gradeLevelKey = clampGradeToK2(
    ctx.grade,
    (["K", "1", "2"].includes(gradeLevel.toUpperCase()) ? gradeLevel.toUpperCase() : "K") as "K" | "1" | "2",
  );

  const challengeCount = config?.challengeCount ?? 9;
  // Over-draw, then trim. The rhyme-integrity gate below CUTS items with a false
  // answer key, and the live probes show that biting hardest exactly where the
  // families get harder (a Grade-2 draw lost 2 of 4). Cutting is right — a wrong
  // key must not be spoken to a child — but a thinned activity is the student
  // paying for the model's miss, so ask for headroom instead.
  const requestCount = challengeCount + 2;

  const gradeGuidelines: Record<string, string> = {
    K: `
KINDERGARTEN GUIDELINES (PRE-READER — pictures + audio only, the child cannot read):
- Every targetWord, comparisonWord, and option word MUST be chosen from THIS picturable menu ONLY
  (each line is one rhyme family; words on the same line rhyme, words on different lines do NOT):
${K_WORD_MENU}
- Set rhymeFamily to the target word's family from the menu (e.g. cat → "-at").
- Recognition: pick two menu words. For a rhyming pair, pick both from the SAME line (doesRhyme: true);
  for a non-rhyming pair, pick them from DIFFERENT lines (doesRhyme: false). Set comparisonWord, comparisonWordImage, doesRhyme.
- Identification: EXACTLY 2 options — the correct one is a menu word from the SAME line as the target;
  the distractor is a menu word from a DIFFERENT line. Give each option a word + a short image description + isCorrect.
- Do NOT invent words outside the menu. Do NOT create production challenges at K (production is Grade 1+).
`,
    "1": `
GRADE 1 GUIDELINES:
- Use CVC and CVCE words with common rhyme families
- Rhyme families: -at, -ake, -ine, -ight, -ump, -ick, -ore, -ail
- Recognition: include some tricky near-misses (e.g., "cat" and "cap" do NOT rhyme)
- Identification: 3 options (one correct, two distractors from different families)
- Production: provide 4-5 acceptable answers including less common words
- Words can be up to 5 letters
`,
    "2": `
GRADE 2 GUIDELINES:
- Use multisyllabic words and varied rhyme patterns
- Rhyme families: -ight, -ound, -tion, -ank, -eam, -oon, -ump, -ell
- Recognition: include tricky pairs that share letters but don't rhyme (e.g., "though" / "tough")
- Identification: 3 options with plausible distractors (same starting sound but different ending)
- Production: provide 4-5 acceptable answers including 2-syllable words
- Words can be up to 6 letters
`,
  };

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );
  const remediationSection = buildRemediationPrompt(ctx.remediationFocus);

  const generationPrompt = `Create a rhyming practice activity for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean word choices toward "${intent}" when possible — but ALWAYS prioritize the phonological/syllable/phoneme accuracy rules below over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]}

Generate exactly ${requestCount} challenges.

${challengeTypeSection}
${remediationSection}

MODE-SPECIFIC FIELD RULES:
- recognition: set comparisonWord, comparisonWordImage, doesRhyme. Do NOT set options or acceptableAnswers.
- identification: set options (array of {word, image, isCorrect}). Do NOT set comparisonWord, doesRhyme, or acceptableAnswers.
- production: set ONLY targetWord + rhymeFamily. The answer is OPEN — the child says any real rhyme and the tutor judges it. Do NOT set comparisonWord, doesRhyme, options, acceptableAnswers or bankDistractors.

CRITICAL RULES:
${ctx.remediationFocus ? '- REMEDIATION TRACE: recognition uses "contrast_rime", identification uses "diagnostic_option", production uses "constrained_production". Make a non-rhyme or distractor encode the diagnosed confusion.' : ''}
- Every challenge must have: id, mode, targetWord, targetWordImage, rhymeFamily
- rhymeFamily MUST start with a hyphen (e.g., "-at", "-un", "-ig")
- PHONETIC ACCURACY IS PARAMOUNT — words rhyme ONLY if they share the same ending SOUND:
  - "eight" (/eɪt/) does NOT rhyme with "kite" (/kaɪt/) — different vowel sounds
  - "there" (/ðɛr/) does NOT rhyme with "zero" (/zɪroʊ/) — completely different endings
  - When in doubt, only use words that share the EXACT same spelling pattern for their ending
- For recognition challenges, NEVER use irregular-spelling words: ${IRREGULAR_RHYME_WORDS.join(', ')}. Stick to words with regular phonetic spelling.
- For recognition with doesRhyme: true, BOTH words MUST end with the rhymeFamily spelling (e.g., rhymeFamily "-at" → "cat" and "hat", NOT "eight" and "kite")
- For recognition with doesRhyme: false, words must have clearly different endings
- For production, the targetWord MUST end with its rhymeFamily and MUST have many common rhymes a young child would know (cat, sun, bed, top). Never a rhyme-poor word (orange, month, silver).
- All words should relate to the topic "${topic}" when possible, but prioritize real rhymes
- Use simple, common, age-appropriate words
- NEVER use the word "yes" as a target, comparison, option, acceptable answer or distractor — the live tutor says every one of these words out loud, and "yes" is how it signals a correct answer
- IDs should be sequential: "c1", "c2", "c3", etc.
- Image descriptions should be brief (3-6 words) and kid-friendly
${!evalConstraint ? '- Order challenges: recognition first, then identification, then production (easiest → hardest).' : ''}

Now generate the activity for "${topic}" at grade level ${gradeLevelKey}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction:
          "You are an expert K-2 reading specialist who designs engaging phonological awareness activities. " +
          "You understand rhyme families deeply and always produce linguistically accurate rhyming pairs. " +
          "You choose concrete, picturable words that young learners know and enjoy. " +
          "You never reveal answers in labels or descriptions. " +
          "You ensure each challenge has all required fields for its mode and omits fields from other modes.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text);

    // ── Validation and defaults ───────────────────────────────────────

    // Ensure title
    if (!result.title || typeof result.title !== "string") {
      result.title = `Rhyme Studio: ${topic}`;
    }

    // Ensure challenges array
    if (!Array.isArray(result.challenges)) {
      result.challenges = [];
    }

    // Validate each challenge has mode-specific fields
    result.challenges = result.challenges.map(
      (ch: Record<string, unknown>, idx: number) => {
        // Ensure id
        if (!ch.id) ch.id = `c${idx + 1}`;
        const move = rhymeRemediationMoveFor(ch.mode as RhymeMode, ctx.remediationFocus);
        if (move) ch.remediationMove = move;
        else delete ch.remediationMove;

        // Ensure rhymeFamily starts with hyphen
        if (
          typeof ch.rhymeFamily === "string" &&
          !ch.rhymeFamily.startsWith("-")
        ) {
          ch.rhymeFamily = `-${ch.rhymeFamily}`;
        }

        // Mode-specific fields. KEEP-OR-DROP, never backfill: under the judged
        // loop a placeholder becomes a spoken ask the tutor must then judge,
        // and the old defaults ("word", "other") would have had a live tutor
        // asking a five-year-old whether "cat" rhymes with "word". Anything
        // missing here fails `holdsRhymeIntegrity` below and the item is cut.
        if (ch.mode === "recognition") {
          if (!ch.comparisonWordImage) ch.comparisonWordImage = "";
        } else if (ch.mode === "identification") {
          if (!Array.isArray(ch.options)) ch.options = [];
          // Every option word is ENUMERATED ALOUD by the tutor's scripted ask,
          // so a word that could open a verdict sentence never reaches the set.
          // A challenge whose CORRECT option is dropped this way is discarded
          // below rather than shipped with no answer.
          const options = (ch.options as Array<{
            word: string;
            image: string;
            isCorrect: boolean;
          }>).filter((o) => isSentinelSafeWord(String(o?.word ?? '')));
          ch.options = options;

          // A missing isCorrect flag is repaired from the WORDS, not from
          // position — promoting options[0] used to invent an answer key that
          // the tutor would then have taught aloud. An item with no option that
          // really rhymes has no answer, and the integrity gate cuts it.
          if (!options.some((o) => o.isCorrect)) {
            const rime = String(ch.rhymeFamily ?? '').replace(/^-+/, '').toLowerCase();
            const real = options.find((o) => endsWithRime(o.word, rime));
            if (real) real.isCorrect = true;
          }
        } else if (ch.mode === "production") {
          // ⛔ THE BANK-BUILDING BRANCH USED TO LIVE HERE and its deletion is
          // the point (rhymeStudioScript.ts header). It guaranteed both halves
          // of a four-tile word bank because that closed set was what kept
          // spoken production a benched response class while `open_set_word`
          // was blocked. The class cleared its bench on 2026-08-19, so the mode
          // is open and there is nothing to assemble.
          //
          // Both fields are STRIPPED rather than ignored: an `acceptableAnswers`
          // list riding along would eventually be read into a judge's accept
          // clause by some later change, and that list has demonstrably
          // contained the nonword "NAKE" for the target "cake".
          delete ch.acceptableAnswers;
          delete ch.bankDistractors;
        }

        return ch;
      }
    );

    // Answer-key gate: repair what is repairable, drop what is not. Runs before
    // the band/tier passes so nothing downstream reasons about a false rime.
    const beforeIntegrity = result.challenges.length;
    result.challenges = result.challenges.filter(holdsRhymeIntegrity);
    if (result.challenges.length !== beforeIntegrity) {
      console.warn(
        `[rhyme-studio] Rhyme-integrity gate dropped `
        + `${beforeIntegrity - result.challenges.length}/${beforeIntegrity} challenge(s) with a false answer key.`,
      );
    }

    /**
     * ⭐ THE K BAND GATE ON PRODUCTION IS GONE, BECAUSE THE BANK WAS ITS ONLY
     * REASON.
     *
     * The rule here used to be: *"production's word-bank distractors cannot be
     * pictured, so it is a Grade 1+ mode"* — drop production at K. That was a
     * true statement about the BANK, not about the skill. A non-reader could
     * not use four printed word cards, and the distractors had no depictable
     * emoji, so the mode was unreachable at the exact band that needs it most.
     *
     * With the bank deleted (2026-08-19) production requires no reading and no
     * pictures at all: the tutor SAYS a word and the child SAYS a rhyme. That
     * is a purely oral exchange, and producing rhymes is a core kindergarten
     * standard (K.RF.2.a — "recognize and produce rhyming words"). Keeping the
     * gate would have shipped a cap whose justification had been deleted, and
     * would have withheld the one rhyme mode a pre-reader can fully do.
     *
     * The K emoji pass below still attaches a picture to the TARGET, so the
     * stimulus stays depictable; there is simply no answer surface to picture.
     */

    // Picture-primary attach (K): the model produced only WORDS (no emojis — that
    // is unreliable on flash-lite inside nested arrays). Attach the depicting emoji
    // deterministically from the curated menu the words were drawn from, so every
    // word — target, comparison, and each identification option — carries a distinct
    // picture a non-reader can use. A ⭐ only appears if a word slipped the menu.
    if (gradeLevelKey === 'K') {
      result.challenges = result.challenges.map((ch: Record<string, unknown>) => {
        ch.targetWordEmoji = kEmojiFor(ch.targetWord);
        if (ch.mode === 'recognition') ch.comparisonWordEmoji = kEmojiFor(ch.comparisonWord);
        if (ch.mode === 'identification' && Array.isArray(ch.options)) {
          (ch.options as Array<Record<string, unknown>>).forEach((o) => {
            o.image = kEmojiFor(o.word);
          });
        }
        return ch;
      });
    }

    // ── Within-mode support tier: withdraw on-screen / instructional / tutor
    //    scaffolding. Applied LAST-but-one, AFTER the K emoji attach, so the
    //    pre-reader band floor is imposed on a fully-formed K challenge and always
    //    wins over the tier. Gated ONLY on supportTier being present — absent ⇒ no
    //    fields stamped ⇒ byte-identical legacy full-help render. ──
    if (supportTier) {
      applyRhymeSupportTier(
        result.challenges as Array<Record<string, unknown>>,
        supportTier,
        gradeLevelKey === 'K',
      );
      console.log(
        `[rhyme-studio] Support tier "${supportTier}" applied to ${result.challenges.length} challenge(s)`
        + `${gradeLevelKey === 'K' ? ' (PRE band floor: picture + tutor read-aloud forced on)' : ''}`,
      );
    }

    // Post-process: remove recognition challenges that use irregular-spelling words (SP-7 safety net),
    // and identification challenges left without a correct option by the sentinel filter above.
    const irregularSet = new Set(IRREGULAR_RHYME_WORDS);
    result.challenges = result.challenges.filter((ch: Record<string, unknown>) => {
      if (ch.mode === 'identification') {
        const options = (ch.options ?? []) as Array<{ isCorrect: boolean }>;
        return options.some((o) => o.isCorrect);
      }
      if (ch.mode !== 'recognition') return true;
      const target = String(ch.targetWord ?? '').toLowerCase();
      const comparison = String(ch.comparisonWord ?? '').toLowerCase();
      return !irregularSet.has(target) && !irregularSet.has(comparison);
    });

    // Trim the over-draw back to what was asked for. A run that survived every
    // gate with items to spare hands back the requested count; one that did not
    // is simply shorter, which is the honest outcome.
    result.challenges = result.challenges.slice(0, challengeCount);

    // Fallback: ensure at least one challenge exists. Each mode gets its OWN
    // shape — under the judged loop a mode-shaped field that is missing is not
    // a degraded render but a broken ask (production with no bank has no answer
    // set, and identification with no options has nothing to enumerate).
    if (result.challenges.length === 0) {
      const fallbackMode = evalConstraint?.allowedTypes[0] ?? 'recognition';
      const base = {
        id: 'c1',
        mode: fallbackMode,
        targetWord: 'cat',
        targetWordImage: 'a fluffy cat',
        rhymeFamily: '-at',
      };
      result.challenges = [
        fallbackMode === 'identification'
          ? {
              ...base,
              options: [
                { word: 'hat', image: 'a red hat', isCorrect: true },
                { word: 'cap', image: 'a blue cap', isCorrect: false },
              ],
            }
          : fallbackMode === 'production'
            // Open production carries no answer material: the target and its
            // rime ARE the whole item.
            ? { ...base }
            : {
                ...base,
                comparisonWord: 'hat',
                comparisonWordImage: 'a red hat',
                doesRhyme: true,
              },
      ];
      if (gradeLevelKey === 'K') {
        result.challenges = result.challenges.map((ch: Record<string, unknown>) => {
          ch.targetWordEmoji = kEmojiFor(ch.targetWord);
          if (ch.mode === 'recognition') ch.comparisonWordEmoji = kEmojiFor(ch.comparisonWord);
          if (ch.mode === 'identification' && Array.isArray(ch.options)) {
            (ch.options as Array<Record<string, unknown>>).forEach((o) => {
              o.image = kEmojiFor(o.word);
            });
          }
          return ch;
        });
      }
      if (supportTier) {
        applyRhymeSupportTier(
          result.challenges as Array<Record<string, unknown>>,
          supportTier,
          gradeLevelKey === 'K',
        );
      }
    }

    const finalData: RhymeStudioData = {
      title: result.title,
      gradeLevel: gradeLevelKey,
      // Tell the live tutor the support level whenever a tier is present — it drives
      // the tutor's reveal policy (how much it may say out loud).
      ...(supportTier ? { supportTier } : {}),
      challenges: result.challenges,
    };

    console.log("Rhyme Studio Generated:", {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      challengeCount: finalData.challenges.length,
      modes: finalData.challenges.map((c) => c.mode),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating rhyme studio:", error);
    throw error;
  }
};
