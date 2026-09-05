import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  LetterSoundLinkData,
  LetterSoundLinkChallenge,
} from "../../primitives/visual-primitives/literacy/LetterSoundLink";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildRemediationPrompt } from '../generation/remediationPrompt';
import { asksIndependentProduction, lettersNamedIn, resolveObjectiveLetterGroup } from './letterGroups';
import {
  canProduceSound,
  keywordFor,
  keywordNamesItsPicture,
  PRODUCIBLE_LETTERS,
} from '../../primitives/visual-primitives/literacy/letterSoundLinkScript';

type LetterSoundMode = 'see-hear' | 'hear-see' | 'keyword-match';
type LetterSoundRemediationMove = 'contrast_sound' | 'contrast_letter' | 'contrast_keyword';

// ---------------------------------------------------------------------------
// Within-mode support tier (ctx.supportTier) — scaffolding withdrawal ONLY.
//
// The tier NEVER touches content selection: it is not in the prompt, and every
// field below is stamped in CODE post-parse. It never changes which letter,
// which sound, which keyword, or which option is correct — only how much help
// surrounds the same item. Absent tier ⇒ nothing stamped ⇒ byte-identical
// legacy full-help render.
//
// ANSWER DIMENSION DIFFERS PER MODE (letter-spotter precedent: when the target
// IS the answer, nothing names it):
//   see-hear      → the SOUND is the answer (its keyword encodes the sound)
//   hear-see      → the LETTER is the answer (the sound is the given stimulus)
//   keyword-match → the KEYWORD WORD is the answer (as is the sound it starts with)
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';

/** Attempts before a challenge locks and reveals. Absent tier ⇒ component legacy (3). */
const MAX_ATTEMPTS_BY_TIER: Record<SupportTier, number> = {
  easy: 3,
  medium: 3,
  hard: 2,
};

export interface LetterSoundSupportScaffold {
  /** #1 perception — when the keyword picture anchor appears. */
  showKeywordAnchor: 'proactive' | 'after-miss' | 'never';
  /** #2 instruction — on-card task cue. null = withdrawn (hard). Never names the answer. */
  strategyHint: string | null;
  /** #2 instruction — footer protocol cue. null = withdrawn (hard, and hear-see which has no footer). */
  protocolHint: string | null;
  /** #2 instruction — the hear-see "more than one letter makes this sound" nudge. */
  showSharedSoundHint: boolean;
  /** #3 answer-form — may the student audition an option before committing? */
  auditionBeforeCommit: boolean;
}

/**
 * Tier-authored on-card cues, per mode. HARD RULE: cue text NEVER names the
 * target sound, the keyword word, or the target letter — it only frames the
 * listening move. `medium` re-states the shipped legacy line verbatim so the
 * medium render is identical to the untiered one.
 */
const TASK_CUE: Record<LetterSoundMode, { easy: string; medium: string }> = {
  'see-hear': {
    easy: 'Look at the letter, then listen to BOTH bubbles before you pick.',
    medium: 'Which sound does this letter make?',
  },
  'hear-see': {
    easy: 'Listen to the sound, then say it back yourself before you look at the letters.',
    medium: 'Tap to hear the sound, then find the letter!',
  },
  'keyword-match': {
    easy: 'Sound out the letter quietly to yourself, then listen for the picture that starts the same way.',
    // Verbatim legacy line (ASCII apostrophe, matching the component's &apos;).
    medium: 'Which word starts with this letter\'s sound?',
  },
};

const PROTOCOL_CUE: Record<LetterSoundMode, { easy: string; medium: string } | null> = {
  'see-hear': {
    easy: 'Tap each speaker to hear the sound, then tap your answer again to choose it',
    medium: 'Listen to both, then tap your choice again to keep it.',
  },
  // hear-see has no protocol footer on the card (the letters are visible).
  'hear-see': null,
  'keyword-match': {
    easy: 'Tap each picture to hear the word, then choose which one starts with this letter\'s sound',
    medium: 'Listen to both pictures, then tap your choice again to keep it.',
  },
};

/**
 * Resolve the per-challenge scaffold for a tier. Pure + exported so the tier
 * mapping (including the K band-gate) is unit-testable without calling Gemini.
 *
 * BAND WINS: `auditionBeforeCommit` is forced tier-inert at K — the pre-reader
 * contract (LetterSoundLink.reader-fit) depends on the audition-then-commit
 * two-tap protocol, so no tier may withdraw it there. It is also never withdrawn
 * for see-hear at ANY grade: those options are bare speaker bubbles with no
 * visual identity, so the audition IS how the stimulus is perceived — removing
 * it would convert the task into a coin flip rather than withdraw support.
 */
export function resolveLetterSoundSupportScaffold(
  mode: LetterSoundMode,
  tier: SupportTier,
  gradeKey: string,
): LetterSoundSupportScaffold {
  const cue = TASK_CUE[mode];
  const protocol = PROTOCOL_CUE[mode];

  const strategyHint = tier === 'hard' ? null : cue[tier === 'easy' ? 'easy' : 'medium'];
  const protocolHint = tier === 'hard' || !protocol
    ? null
    : protocol[tier === 'easy' ? 'easy' : 'medium'];

  const auditionWithdrawable = mode === 'keyword-match' && gradeKey !== 'K';

  return {
    showKeywordAnchor: tier === 'easy' ? 'proactive' : tier === 'hard' ? 'never' : 'after-miss',
    strategyHint,
    protocolHint,
    showSharedSoundHint: tier !== 'hard',
    auditionBeforeCommit: !(tier === 'hard' && auditionWithdrawable),
  };
}

export function letterSoundRemediationMoveFor(
  mode: LetterSoundMode,
  remediationFocus?: string,
  contrastAvailable = true,
): LetterSoundRemediationMove | undefined {
  if (!remediationFocus?.trim()) return undefined;
  if (!contrastAvailable) return undefined;
  if (mode === 'see-hear') return 'contrast_sound';
  if (mode === 'hear-see') return 'contrast_letter';
  return 'contrast_keyword';
}

/** Hear-see may only claim remediation when the diagnosed contrast is teachable in this letter group. */
export function hearSeeContrastAvailable(remediationFocus: string | undefined, cumulativeLetters: string[]): boolean {
  if (!remediationFocus?.trim()) return false;
  const namedLetters = Array.from(remediationFocus.matchAll(/\bletter\s+['"]?([a-z])['"]?/gi))
    .map((match) => match[1].toLowerCase());
  return namedLetters.length >= 2 && namedLetters.every((letter) => cumulativeLetters.includes(letter));
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'see-hear': {
    promptDoc:
      `"see-hear": Student sees a letter and SAYS ALOUD the sound it makes; the live tutor judges the audio. `
      + `2-3 challenges per session. Emit NO options for this mode — there is nothing to pick from. `
      + `targetLetter MUST be one of: ${PRODUCIBLE_LETTERS.join(', ')} — these are the only sounds a `
      + `kindergartener can be asked to hold and produce alone. Never target t, p, c, k, d, g, b, j, w, y, h, x or qu here.`,
    schemaDescription: "'see-hear' (see letter, SAY its sound aloud)",
  },
  'hear-see': {
    promptDoc:
      `"hear-see": The tutor says a sound; the student TAPS the correct LETTER from 2 options. `
      + `2-3 challenges per session. Options are {letter: "x", isCorrect: boolean}. Exactly ONE correct. `
      + `Any letter in the group may be targeted here — the tutor makes the sound, the student only has to find it. `
      + `Pick a letter whose sound is confusable with the target (see DISTRACTOR RULES). `
      + `If target sound /k/ can be made by both c and k, set sharedSoundLetters to ["c", "k"].`,
    schemaDescription: "'hear-see' (hear sound, TAP the letter that makes it)",
  },
  'keyword-match': {
    promptDoc:
      `"keyword-match": Student sees a letter and two pictures and SAYS ALOUD the picture word that starts with `
      + `that letter's sound. 2-3 challenges per session. Options are {sound: "keyword_word", isCorrect: boolean}. `
      + `Exactly ONE correct. The correct keyword must genuinely START with the target letter's sound, AND its `
      + `PICTURE must read as that word to a child who cannot read — never target x (its sound /ks/ does not begin `
      + `English words) or i (no short-i word has a picture a five-year-old names). `
      + `Distractor keyword should start with a confusable sound (see DISTRACTOR RULES).`,
    schemaDescription: "'keyword-match' (see letter, SAY the picture word that starts with its sound)",
  },
};

/**
 * Schema definition for Letter Sound Link Data
 *
 * Generates interactive letter-sound correspondence activities for K-2 students.
 * Audio-first design: students hear sounds via speaker buttons, no phoneme text visible.
 * Binary discrimination (2 options) for developmentally appropriate sound comparison.
 * Three modes: See-Hear, Hear-See, Keyword-Match.
 * Follows cumulative group progression across 4 letter groups.
 */
const letterSoundLinkSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the letter-sound activity (e.g., 'Letter Sounds - Group 1!')",
    },
    letterGroup: {
      type: Type.NUMBER,
      description: "Which letter group (1, 2, 3, or 4)",
    },
    cumulativeLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "All letters available in this group (lowercase)",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'ch1', 'ch2')",
          },
          mode: {
            type: Type.STRING,
            enum: ["see-hear", "hear-see", "keyword-match"],
            description: "Challenge mode",
          },
          remediationMove: {
            type: Type.STRING,
            enum: ["contrast_sound", "contrast_letter", "contrast_keyword"],
            description: "Private remediation trace; set only when remediation is active."
          },
          targetLetter: {
            type: Type.STRING,
            description: "The target letter (lowercase, e.g., 's', 'a'). Use 'qu' for the digraph.",
          },
          targetSound: {
            type: Type.STRING,
            description: "The phoneme for this letter using clean slash notation (e.g., '/s/', '/k/', '/ks/')",
          },
          keywordWord: {
            type: Type.STRING,
            description: "The keyword association word (e.g., 'sun' for s, 'apple' for a)",
          },
          keywordImage: {
            type: Type.STRING,
            description: "The keyword image identifier (same as keywordWord, e.g., 'sun', 'apple')",
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                letter: { type: Type.STRING, description: "Letter option (for hear-see mode)" },
                sound: { type: Type.STRING, description: "Sound option (for see-hear mode) or keyword word (for keyword-match mode)" },
                isCorrect: { type: Type.BOOLEAN, description: "Whether this option is the correct answer" },
              },
              required: ["isCorrect"],
            },
            description: "Exactly 2 options with exactly one correct. For see-hear: {sound, isCorrect}. For hear-see: {letter, isCorrect}. For keyword-match: {sound (=keyword word), isCorrect}.",
          },
          sharedSoundLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Letters that share the same sound (e.g., ['c', 'k'] both make /k/). Only needed when relevant.",
          },
        },
        required: ["id", "mode", "targetLetter", "targetSound", "keywordWord", "keywordImage", "options"],
      },
      description: "Challenges mixing see-hear, hear-see and keyword-match modes. One letter per challenge — never repeat a target letter.",
    },
  },
  required: ["title", "letterGroup", "cumulativeLetters", "challenges"],
};

// ============================================================================
// Letter Group Definitions
// ============================================================================

const LETTER_GROUPS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b'],
  4: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'qu'],
};

const LETTER_SOUNDS: Record<string, string> = {
  s: '/s/', a: '/\u0103/', t: '/t/', i: '/\u012d/', p: '/p/', n: '/n/',
  c: '/k/', k: '/k/', e: '/\u0115/', h: '/h/', r: '/r/', m: '/m/', d: '/d/',
  g: '/g/', o: '/\u014f/', u: '/\u016d/', l: '/l/', f: '/f/', b: '/b/',
  j: '/j/', z: '/z/', w: '/w/', v: '/v/', y: '/y/', x: '/ks/', qu: '/kw/',
};

/**
 * The anchor word for each letter — one lookup into the script module's
 * `LETTER_KEYWORDS`, which owns the WORD and its PICTURE together.
 *
 * It used to be a local map here while the pictures lived in the component, so
 * a pair that disagreed rendered the 📝 fallback with nothing to catch it. Six
 * anchors changed when the two halves were joined (the picture has to read as
 * the word in keyword-match): t tent, g goat, f fish, j juice, z zebra, l leaf.
 */
const KEYWORD_MAP: Record<string, string> = Object.fromEntries(
  Object.keys(LETTER_SOUNDS).map((letter) => [letter, keywordFor(letter)]),
);

// Letters that share the same sound
const SHARED_SOUND_MAP: Record<string, string[]> = {
  c: ['c', 'k'],
  k: ['c', 'k'],
};

// ============================================================================
// WHICH LETTERS EACH MODE MAY TARGET — the DI port's content gate (2026-08-11)
//
// Under the judged loop each mode asks for a different KIND of answer, and two
// of the three constrain which letters are askable. Enforced in CODE after the
// parse, never left to the prompt: the pool is code's business (letterGroups'
// ruling), and a single illegal draw here is a child asked for a sound no
// judge has been benched on.
//
//  · see-hear      the child PRODUCES the sound → held sounds only. Stops,
//                  affricates, glides and clusters (t p c k d g b j w y h x qu)
//                  are unbenched for child production — standing gate 1. They
//                  are not lost: they keep full coverage in the other two
//                  directions, where the TUTOR makes the sound and the child
//                  taps or says a whole word. `PRODUCIBLE_LETTERS` is the same
//                  list the script speaks from, imported rather than copied.
//  · keyword-match the ask is "which picture STARTS with this letter's sound"
//                  and the answer is SAID ALOUD, so the anchor has to clear two
//                  bars: the word must start with the sound, and the PICTURE
//                  must read as the word. `x` fails the first (/ks/ never
//                  begins an English word) and `i` fails the second (there is
//                  no short-/ĭ/-initial word a five-year-old names from a
//                  picture — igloo has no emoji, iguana reads "lizard"). Both
//                  are `namesItsPicture: false` in `LETTER_KEYWORDS`, which is
//                  the single gate now; the probe that drew `i` → 🤏 → "itch"
//                  is what generalised the old `x`-only rule.
//  · hear-see      no constraint — the tutor produces the sound, the child taps.
// ============================================================================

const MODE_TARGETABLE: Record<LetterSoundMode, (letter: string) => boolean> = {
  'see-hear': (letter) => canProduceSound(letter),
  'hear-see': () => true,
  'keyword-match': (letter) => keywordNamesItsPicture(letter),
};

/** Is this letter askable in this mode at all? Exported for the unit test —
 *  live Gemini honors the prompt constraint, so the retarget path below is a
 *  safety net that would otherwise never execute. */
export const isTargetableInMode = (mode: LetterSoundMode, letter: string): boolean =>
  MODE_TARGETABLE[mode]?.(letter) ?? true;

/**
 * A legal target for `mode` inside the cumulative group, preferring one this
 * session has not used yet (N challenges = N problems). Returns null when the
 * mode's pool is empty for this group, in which case the caller leaves the
 * challenge alone rather than inventing an out-of-group letter.
 *
 * Exported so the gate is unit-testable without calling Gemini (the same
 * reason `resolveLetterSoundSupportScaffold` is).
 */
export function retargetForMode(
  mode: LetterSoundMode,
  cumulativeLetters: string[],
  used: Set<string>,
): string | null {
  const legal = cumulativeLetters.filter((l) => MODE_TARGETABLE[mode](l));
  if (legal.length === 0) return null;
  return legal.find((l) => !used.has(l)) ?? legal[0];
}

// ============================================================================
// Confusable Sound Pairs — pedagogically meaningful distractors
// ============================================================================

/**
 * For each letter, the best distractor letter(s) whose sound is phonologically
 * similar but distinct. Ordered by confusion likelihood.
 *
 * Principles:
 * - Voiced/unvoiced pairs: t↔d, p↔b, s↔z, f↔v, k↔g
 * - Short vowel confusions: a↔e, i↔e, o↔u
 * - Place-of-articulation: m↔n, l↔r
 * - NEVER pair c↔k (identical /k/ sound — impossible to distinguish)
 */
const CONFUSABLE_DISTRACTORS: Record<string, string[]> = {
  s: ['z', 'f'],       // voiceless fricatives
  a: ['e', 'o'],       // short vowels
  t: ['d', 'p'],       // voiced/unvoiced alveolar stops
  i: ['e', 'u'],       // short vowels
  p: ['b', 't'],       // voiced/unvoiced bilabial stops
  n: ['m', 'l'],       // nasals / liquids
  c: ['g', 't'],       // velar stops — NOT k (same sound!)
  k: ['g', 't'],       // velar stops — NOT c (same sound!)
  e: ['i', 'a'],       // short vowels
  h: ['f', 'w'],       // breathy / fricatives
  r: ['l', 'w'],       // liquids
  m: ['n', 'b'],       // nasals
  d: ['t', 'b'],       // voiced/unvoiced alveolar stops
  g: ['k', 'd'],       // velar stops (k here is fine — different letter, same sound class)
  o: ['u', 'a'],       // short vowels
  u: ['o', 'i'],       // short vowels
  l: ['r', 'n'],       // liquids
  f: ['v', 's'],       // voiced/unvoiced labiodental fricatives
  b: ['p', 'd'],       // voiced/unvoiced bilabial stops
  j: ['z', 'g'],       // voiced fricative/affricates
  z: ['s', 'j'],       // voiced/unvoiced sibilants
  w: ['r', 'y'],       // glides
  v: ['f', 'b'],       // voiced/unvoiced labiodentals
  y: ['w', 'l'],       // glides
  x: ['s', 'z'],       // /ks/ vs similar fricatives
  qu: ['k', 'w'],      // /kw/ components
};

/**
 * Pick the best confusable distractor letter for a given target,
 * filtering to only letters in the current cumulative group.
 *
 * `spent` holds the letters this session has already ANSWERED. A distractor
 * drawn from that set is a wrong choice the child can eliminate without
 * hearing the sound at all — the tutor named it out loud one item ago, and the
 * choice here is binary. Excluded first, then honoured only if the group has
 * nothing left (the pack's session gate drops the item in that case rather
 * than shipping an eliminable one).
 */
function pickDistractor(
  targetLetter: string,
  cumulativeLetters: string[],
  spent: Set<string> = new Set(),
  alreadyShown: Set<string> = new Set(),
): string {
  const usable = (candidate: string) =>
    candidate !== targetLetter && LETTER_SOUNDS[candidate] !== LETTER_SOUNDS[targetLetter];

  const candidates = CONFUSABLE_DISTRACTORS[targetLetter] || [];
  const inGroup = candidates.filter((c) => cumulativeLetters.includes(c) && usable(c));
  const confusable = inGroup.filter((c) => !spent.has(c));
  const freshConfusable = confusable.find((c) => !alreadyShown.has(c));
  if (freshConfusable) return freshConfusable;
  if (confusable.length > 0) return confusable[0];

  // No in-group confusable — group 1 has almost none, because the table is
  // built on voiced/unvoiced pairs and short-vowel confusions that only appear
  // from group 2 on. Fall back to any group letter with a different sound,
  // preferring one this session has not ANSWERED and has not already SHOWN as
  // a wrong choice: the probe drew ⛺ as the wrong picture on three of four
  // items, and by the third the child can rule it out without decoding.
  const fallbacks = cumulativeLetters.filter(usable);
  const unspent = fallbacks.filter((l) => !spent.has(l));
  const unshown = unspent.filter((l) => !alreadyShown.has(l));
  const pool = unshown.length > 0 ? unshown : unspent.length > 0 ? unspent : fallbacks;
  return pool[Math.floor(Math.random() * pool.length)] || inGroup[0] || cumulativeLetters[0];
}

/**
 * Generate Letter Sound Link data using Gemini AI
 *
 * Creates interactive letter-sound correspondence activities with three modes:
 * - See-Hear: See a letter displayed, hear two sounds via speaker buttons, pick the right one
 * - Hear-See: Hear a phoneme (auto-played), identify which of two letters makes that sound
 * - Keyword-Match: See a letter, match to the correct keyword from two options
 *
 * Audio-first design: sounds are played through AI tutor, not shown as text.
 * Binary discrimination (2 options) for developmentally appropriate K-1 assessment.
 * Distractors are phonologically confusable pairs (t/d, p/b, a/e, etc.).
 *
 * @param topic - Theme or context for the activity
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional config with letterGroup override and targetEvalMode
 * @returns LetterSoundLinkData with challenges across all three modes
 */
type LetterSoundLinkConfig = Partial<{
  letterGroup: number;
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode: string;
}>;

/**
 * Resolve the canonical grade key for the pre-reader band-gate.
 * Prefer `ctx.grade` (canonical 'K'|'1'…); fall back to gradeContext prose.
 * Returns 'K' ONLY when confidently kindergarten — never over-gates non-K lessons.
 */
function resolvePreReaderGradeKey(ctx: GenerationContext): string {
  const canonical = (ctx.grade ?? '').toString().trim().toLowerCase();
  if (canonical === 'k' || canonical === '0' || canonical === 'kindergarten') return 'K';
  if (/^\d+$/.test(canonical)) return canonical;
  const prose = (ctx.gradeContext ?? '').toString().toLowerCase();
  if (prose.includes('kindergarten') || /\bgrade\s*k\b/.test(prose) || /^\s*k\b/.test(prose)) return 'K';
  const proseNum = prose.match(/\b(?:grade\s*)?(\d{1,2})\b/);
  if (proseNum) return proseNum[1];
  return canonical || '1';
}

export const generateLetterSoundLink = async (
  ctx: GenerationContext,
): Promise<LetterSoundLinkData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const gradeKey = resolvePreReaderGradeKey(ctx);
  const config = ctx.raw as LetterSoundLinkConfig;
  // Normalized upstream in resolveGenerationContext (never re-parsed here).
  // Support tier NEVER enters the prompt — it is stamped in code post-parse so
  // it cannot steer which letters/sounds/keywords Gemini picks.
  // The OBJECTIVE outranks the manifest's tier on one axis: "assess without
  // first saying its sound" / "independently produce" means the model line is
  // withdrawn (hard), whatever the student-property tier says. The manifest
  // passed the objective; the generator reads it (2026-09-05 journey ruling).
  const objectiveText = [ctx.objective?.text, intent, topic].filter(Boolean).join('\n');
  const coldAsk = asksIndependentProduction(objectiveText);
  const supportTier = coldAsk ? 'hard' : ctx.supportTier;
  if (coldAsk && ctx.supportTier !== 'hard') {
    console.log(`[letter-sound-link] objective asks for independent production — support tier ${ctx.supportTier ?? 'unset'} → hard`);
  }

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'letter-sound-link',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('LetterSoundLink', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(letterSoundLinkSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : letterSoundLinkSchema;

  // -------------------------------------------------------------------------
  // Letter group setup
  // -------------------------------------------------------------------------
  // The manifest never stamps `letterGroup`; the objective names the group
  // ("Letter-Sound Group 2: c, k, e, h, r, m, d"), so the generator reads it.
  const groupResolution = resolveObjectiveLetterGroup(config?.letterGroup, [ctx.objective?.text, intent, topic]);
  const letterGroup = groupResolution.group;
  console.log(`[letter-sound-link] letter group ${letterGroup} (${groupResolution.source})`);

  const cumulativeLetters = LETTER_GROUPS[letterGroup];

  // Build a letter-sound reference string for the prompt
  const letterSoundRef = cumulativeLetters
    .map(l => `${l} = ${LETTER_SOUNDS[l]} (keyword: ${KEYWORD_MAP[l]})`)
    .join(', ');

  // Build confusable pairs reference for the prompt
  const confusablePairsRef = cumulativeLetters
    .map(l => {
      const distractor = pickDistractor(l, cumulativeLetters);
      return `${l}(${LETTER_SOUNDS[l]}) ↔ ${distractor}(${LETTER_SOUNDS[distractor]})`;
    })
    .join(', ');

  // -------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );
  const remediationSection = buildRemediationPrompt(ctx.remediationFocus);

  // ── How many challenges this group can actually carry ─────────────────────
  // A letter may be answered ONCE per session, and hear-see / keyword-match
  // each need a second unspent letter for the distractor — so the ceiling is
  // the mode's legal pool (minus one where there is a distractor to find), not
  // a flat 6-8. Group 1 has four producible letters, so a pinned see-hear
  // session is FOUR items; asking for eight there produced four duplicates
  // that the pack gate would then drop one by one.
  const pinnedMode = evalConstraint?.allowedTypes[0] as LetterSoundMode | undefined;
  const legalTargets = pinnedMode
    ? cumulativeLetters.filter((l) => MODE_TARGETABLE[pinnedMode]?.(l) ?? true)
    : cumulativeLetters;
  const burnsADistractor = pinnedMode ? pinnedMode !== 'see-hear' : true;
  const maxChallenges = Math.max(
    1,
    Math.min(8, burnsADistractor ? legalTargets.length - 1 : legalTargets.length),
  );
  const minChallenges = Math.min(maxChallenges, 5);
  const countAsk = minChallenges === maxChallenges
    ? `exactly ${maxChallenges} challenges`
    : `${minChallenges}-${maxChallenges} challenges`;

  const generationPrompt = `Create an interactive letter-sound correspondence activity for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean word/letter choices toward "${intent}" when possible — but ALWAYS prioritize the phonics/decoding accuracy rules below over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevel}
LETTER GROUP: ${letterGroup}
CUMULATIVE LETTERS (all available): ${cumulativeLetters.join(', ')}

LETTER-SOUND-KEYWORD REFERENCE:
${letterSoundRef}

Generate ${countAsk}. Each challenge links a letter to its sound and keyword.

ONE LETTER, ONE CHALLENGE (hard rule — a repeat is silently dropped in code):
Every challenge must target a DIFFERENT letter, and no challenge may use as its
DISTRACTOR a letter (or that letter's keyword) that an EARLIER challenge answered.
The tutor says each answer out loud when it affirms, so the second ask on a letter
is answered from memory of the first, and a distractor the tutor already named is
eliminated without hearing the sound at all. There are only ${legalTargets.length}
letters this direction can target in group ${letterGroup}, which is why the count
above is what it is — do not pad it by reusing a letter.

${challengeTypeSection}
${remediationSection}

HOW THIS ACTIVITY IS ANSWERED (it is a live SPOKEN lesson, not a clicking exercise):
A live AI tutor asks each challenge out loud and judges the child's answer from the audio.
- see-hear: the child SAYS the sound the letter makes. No options at all.
- hear-see: the tutor says the sound; the child TAPS one of 2 letters.
- keyword-match: the child SAYS the picture word that starts with the letter's sound (2 pictures shown).
Nothing on screen prints the answer, so a distractor is never a support — it is a real contrast.

BINARY DISCRIMINATION FORMAT (the two modes that HAVE options):
hear-see and keyword-match each have EXACTLY 2 options — one correct, one distractor.
The distractor must be a phonologically confusable sound — not random.

DISTRACTOR RULES (CRITICAL):
- Pick distractors that sound SIMILAR but are DISTINCT to train real phonological discrimination.
- GOOD confusable pairs: t↔d (voiced/unvoiced), p↔b, s↔z, f↔v, a↔e (short vowels), i↔e, o↔u, m↔n, l↔r
- NEVER pair c and k as distractor options — they make the SAME sound /k/ and are impossible to tell apart!
- NEVER pair letters that produce identical phonemes.
- For hear-see mode: the two letter options must make DIFFERENT sounds.
- For keyword-match: BOTH pictures must be nameable by a pre-reader. A wrong picture the child
  cannot name turns the task into "pick the one you recognise" — draw the distractor keyword only
  from: ${cumulativeLetters.filter(keywordNamesItsPicture).map((l) => KEYWORD_MAP[l]).join(', ')}
- Suggested confusable pairs for this group: ${confusablePairsRef}

MODE-SPECIFIC OPTION FORMATS:
- see-hear: NO options — the child speaks the sound
- hear-see: options are {letter: "x", isCorrect: boolean} — exactly 2 options
- keyword-match: options are {sound: "keyword_word", isCorrect: boolean} — exactly 2 options

TARGETABLE LETTERS BY MODE (hard rule — a wrong draw is silently corrected in code):
- see-hear: ONLY ${cumulativeLetters.filter(canProduceSound).join(', ') || '(none in this group)'}
- keyword-match: ONLY ${cumulativeLetters.filter(keywordNamesItsPicture).join(', ') || '(none in this group)'}
- hear-see: any group letter

RULES:
${ctx.remediationFocus ? '- REMEDIATION TRACE: see-hear uses remediationMove="contrast_sound"; hear-see uses "contrast_letter"; keyword-match uses "contrast_keyword". Make the wrong option encode the diagnosed confusion.' : ''}
- Use IDs: ch1, ch2, ch3, etc.
- Use ONLY letters from the cumulative group: [${cumulativeLetters.join(', ')}]
- Use clean slash notation for sounds: /s/, /t/, /k/, etc. Short vowels use the plain letter.
- keywordImage is always identical to keywordWord.
- For c and k challenges, always include sharedSoundLetters: ["c", "k"].
- EXACTLY 2 options per challenge — no more, no less.
${!evalConstraint ? '- Order challenges so modes alternate (don\'t cluster the same mode together).' : ''}

LETTER GROUP DATA:
- letterGroup: ${letterGroup}
- cumulativeLetters: [${cumulativeLetters.map(l => `"${l}"`).join(', ')}]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 literacy specialist designing letter-sound correspondence activities. You understand phonics instruction and the alphabetic principle. You create engaging, developmentally appropriate challenges that help young students learn the sounds letters make, using keyword associations (s=sun, a=apple, etc.) to anchor learning. You always use letters and sounds only from the specified cumulative group. You use clean phoneme notation with slashes (e.g., /s/, /k/). CRITICAL: Each challenge has exactly 2 options (binary discrimination). Distractors must be phonologically confusable — never pair letters that make the same sound (like c and k).`,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as LetterSoundLinkData;

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    // Ensure letterGroup is correct
    result.letterGroup = letterGroup as 1 | 2 | 3 | 4;

    // Enforce correct cumulative letter set
    result.cumulativeLetters = cumulativeLetters;

    // Stamp the canonical grade key so the component can band-gate (pre-reader UI).
    result.gradeLevel = gradeKey;

    // Validate challenges
    if (result.challenges) {
      /**
       * Letters this session has already ANSWERED. Two jobs, and the second is
       * new (19h-i-b port 7): a retarget prefers an unused letter, AND a
       * distractor is drawn away from the set entirely. The pack enforces the
       * same invariant at the runner boundary — a letter is answered once, and
       * once answered it never comes back as the wrong choice — so what this
       * loop buys is that the gate rarely has to DROP anything.
       */
      const usedTargets = new Set<string>();
      /** Letters whose ANCHOR WORD the session has spoken or revealed — the
       *  see-hear and keyword-match targets. hear-see never names its anchor,
       *  so its letters stay out (see `validateOptions`). */
      const namedAnchors = new Set<string>();
      /** Letters already offered as the WRONG choice, so a third ⛺ never
       *  becomes eliminable by repetition alone. */
      const shownAsWrong = new Set<string>();
      const retargeted: string[] = [];
      const unaskable: string[] = [];
      const kept: LetterSoundLinkChallenge[] = [];

      /** A legal target for this mode that the session has not spent yet. */
      const freshTargetFor = (mode: LetterSoundMode): string | null =>
        cumulativeLetters.find((l) => MODE_TARGETABLE[mode](l) && !usedTargets.has(l)) ?? null;

      result.challenges.forEach((ch: LetterSoundLinkChallenge, i: number) => {
        // Ensure IDs exist
        if (!ch.id) ch.id = `ch${i + 1}`;

        // Ensure targetLetter is lowercase and within group
        ch.targetLetter = (ch.targetLetter || 's').toLowerCase();
        if (!cumulativeLetters.includes(ch.targetLetter)) {
          ch.targetLetter = cumulativeLetters[i % cumulativeLetters.length];
        }

        // DI content gate: the mode decides which letters are askable at all,
        // and the session decides which are still FRESH. Runs before every
        // downstream fixup so the sound, keyword and options are all rebuilt
        // around the legal target.
        const mode = ch.mode as LetterSoundMode;
        const illegal = !MODE_TARGETABLE[mode]?.(ch.targetLetter);
        const repeated = usedTargets.has(ch.targetLetter);
        if (illegal || repeated) {
          const replacement = freshTargetFor(mode);
          if (!replacement) {
            // The mode's pool is exhausted for this group. Dropping beats
            // shipping the same letter twice: at easy and medium the DISTAR
            // model re-hands the answer over anyway, so a repeat measures
            // nothing at all (N challenges = N problems).
            unaskable.push(`${ch.id}: ${ch.mode} "${ch.targetLetter}"`);
            return;
          }
          retargeted.push(
            `${ch.id}: ${ch.mode} "${ch.targetLetter}" → "${replacement}" `
            + `(${illegal ? 'unaskable in this direction' : 'already answered this session'})`,
          );
          ch.targetLetter = replacement;
        }

        // Ensure targetSound uses the canonical sound
        ch.targetSound = LETTER_SOUNDS[ch.targetLetter] || ch.targetSound || '/s/';

        // Ensure keyword word and image are correct
        ch.keywordWord = KEYWORD_MAP[ch.targetLetter] || ch.keywordWord || 'sun';
        ch.keywordImage = ch.keywordWord;

        // Populate sharedSoundLetters for c/k
        if (SHARED_SOUND_MAP[ch.targetLetter]) {
          ch.sharedSoundLetters = SHARED_SOUND_MAP[ch.targetLetter];
        }

        // Validate options: exactly 2, exactly 1 correct, and a distractor the
        // child cannot eliminate from an earlier verdict.
        ch.options = validateOptions(
          ch, cumulativeLetters, usedTargets, namedAnchors, shownAsWrong,
        );
        const contrastAvailable = ch.mode !== 'hear-see'
          || hearSeeContrastAvailable(ctx.remediationFocus, cumulativeLetters);
        const remediationMove = letterSoundRemediationMoveFor(ch.mode, ctx.remediationFocus, contrastAvailable);
        if (remediationMove) ch.remediationMove = remediationMove;
        else delete ch.remediationMove;

        usedTargets.add(ch.targetLetter);
        if (ch.mode !== 'hear-see') namedAnchors.add(ch.targetLetter);
        kept.push(ch);
      });

      result.challenges = kept;

      // Objective letters NO mode in this session can ask for (stops under a
      // pinned see-hear). Reported in the data, never silently dropped: the
      // lesson bench / journey reads it as "no surface" from the generator's
      // own mouth rather than from a copied list.
      const sessionModes = new Set<LetterSoundMode>(kept.map((ch) => ch.mode as LetterSoundMode));
      if (sessionModes.size === 0 && pinnedMode) sessionModes.add(pinnedMode);
      const unaskableLetters = lettersNamedIn(objectiveText)
        .filter((l) => cumulativeLetters.includes(l))
        .filter((l) => !Array.from(sessionModes).some((m) => MODE_TARGETABLE[m]?.(l)));
      if (unaskableLetters.length > 0) {
        result.unaskableLetters = unaskableLetters;
        console.warn(
          `[letter-sound-link] objective names ${unaskableLetters.join(', ')} but no mode in this session `
          + `(${Array.from(sessionModes).join('/')}) can ask a child for them — reported as unaskableLetters`,
        );
      }

      if (retargeted.length > 0) {
        console.log(
          `[letter-sound-link] DI content gate retargeted ${retargeted.length} challenge(s): `
          + retargeted.join('; '),
        );
      }
      if (unaskable.length > 0) {
        console.warn(
          `[letter-sound-link] dropped ${unaskable.length} challenge(s) — the mode's letter `
          + `pool for group ${letterGroup} is exhausted: ${unaskable.join('; ')}`,
        );
      }

      // Fallback: ensure at least one challenge exists
      if (result.challenges.length === 0) {
        const fallbackMode = (evalConstraint?.allowedTypes[0] ?? 'see-hear') as LetterSoundMode;
        const targetLetter = retargetForMode(fallbackMode, cumulativeLetters, new Set())
          ?? cumulativeLetters[0];
        const distractor = pickDistractor(targetLetter, cumulativeLetters);
        result.challenges = [{
          id: 'ch1',
          mode: fallbackMode as 'see-hear' | 'hear-see' | 'keyword-match',
          targetLetter,
          targetSound: LETTER_SOUNDS[targetLetter],
          keywordWord: KEYWORD_MAP[targetLetter],
          keywordImage: KEYWORD_MAP[targetLetter],
          options: fallbackMode === 'see-hear'
            ? [] // the child speaks the sound — nothing to pick from
            : fallbackMode === 'hear-see'
              ? [
                  { letter: targetLetter, isCorrect: true },
                  { letter: distractor, isCorrect: false },
                ]
              : [
                  { sound: KEYWORD_MAP[targetLetter], isCorrect: true },
                  { sound: KEYWORD_MAP[distractor], isCorrect: false },
                ],
        }];
      }
    }

    // ------------------------------------------------------------------
    // Within-mode support tier: withdraw scaffolding ONLY. Runs AFTER every
    // structural fixup so it can never change the item — gated ONLY on the
    // support tier (never on the pinned eval mode, which would be a silent
    // no-op in blended sessions). Applied PER CHALLENGE from each challenge's
    // OWN mode, because the answer dimension differs by mode.
    // ------------------------------------------------------------------
    if (supportTier && result.challenges) {
      for (const ch of result.challenges) {
        const sc = resolveLetterSoundSupportScaffold(ch.mode as LetterSoundMode, supportTier, gradeKey);
        ch.showKeywordAnchor = sc.showKeywordAnchor;
        ch.strategyHint = sc.strategyHint;
        ch.protocolHint = sc.protocolHint;
        ch.showSharedSoundHint = sc.showSharedSoundHint;
        ch.auditionBeforeCommit = sc.auditionBeforeCommit;
      }
      result.supportTier = supportTier;
      result.maxAttempts = MAX_ATTEMPTS_BY_TIER[supportTier];
      console.log(
        `[letter-sound-link] Support tier "${supportTier}" applied per-challenge `
        + `(grade ${gradeKey}${gradeKey === 'K' ? ' — audition lever forced inert by the PRE band' : ''}; `
        + `maxAttempts ${result.maxAttempts})`,
      );
    }

    console.log('Letter Sound Link Generated:', {
      title: result.title,
      letterGroup: result.letterGroup,
      cumulativeLetters: result.cumulativeLetters.join(', '),
      challengeCount: result.challenges?.length || 0,
      modes: result.challenges?.map(ch => ch.mode) || [],
      optionCounts: result.challenges?.map(ch => ch.options?.length || 0) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating letter sound link:", error);
    throw error;
  }
};

// ============================================================================
// Validation Helpers
// ============================================================================

/** The anchor words, as a set — an option word outside it has no picture. */
const ANCHOR_WORDS = new Set(Object.values(KEYWORD_MAP));

/**
 * Ensure options array has exactly 2 entries with exactly 1 correct, that the
 * correct one matches the challenge's target, and that the DISTRACTOR is both
 * renderable and not already spent.
 *
 * The old version wrote a PHONEME into the keyword-match distractor
 * (`wrongOpt.sound = LETTER_SOUNDS[distractor]`) whenever Gemini emitted a
 * distractor equal to the answer: the `sound` field carries a phoneme in the
 * deleted see-hear option shape and a WORD in keyword-match, and the repair
 * path took the wrong reading. The card would have shown 📝 and the tutor would
 * have read *"The other picture's word — /z/ — is NOT the answer."* see-hear no
 * longer has options at all, so `sound` means the anchor word, full stop.
 */
function validateOptions(
  ch: LetterSoundLinkChallenge,
  cumulativeLetters: string[],
  answeredLetters: Set<string>,
  namedAnchors: Set<string>,
  shownAsWrong: Set<string>,
): Array<{ letter?: string; sound?: string; isCorrect: boolean }> {
  const opts = ch.options || [];

  if (ch.mode === 'see-hear') {
    // DI port: the child SAYS the sound, so there is nothing to choose from.
    // Any options Gemini emitted here are dropped rather than rendered — a
    // printed distractor sound is the old "support net" that made the task
    // recognition instead of production.
    return [];
  }

  const isLetterMode = ch.mode === 'hear-see';
  const field: 'letter' | 'sound' = isLetterMode ? 'letter' : 'sound';
  const correctValue = isLetterMode ? ch.targetLetter : ch.keywordWord;
  /**
   * ⭐ THE DISTRACTOR HAS TO BE NAMEABLE TOO, and gating only the TARGET was not
   * enough — the re-probe drew "sun vs 🤏" twice. A child who cannot name the
   * wrong picture answers by picking the one they CAN name, which turns a
   * sound discrimination into a picture-recognition task. hear-see is exempt:
   * its options are letters and the child taps rather than names.
   */
  const distractorPool = isLetterMode
    ? cumulativeLetters
    : cumulativeLetters.filter(keywordNamesItsPicture);
  const nameableAnchors = new Set(distractorPool.map((l) => KEYWORD_MAP[l]));
  /** Is this option value a legal distractor value at all? */
  const renderable = (value: string | undefined): value is string =>
    !!value
    && value !== correctValue
    && (isLetterMode
      ? cumulativeLetters.includes(value)
      : ANCHOR_WORDS.has(value) && nameableAnchors.has(value));
  /**
   * Has this value already been handed to the child as an ANSWER? The two
   * directions spend different currency, and conflating them stranded items:
   * a LETTER is named by every direction (the affirmation, the tap, the
   * printed stimulus), but an ANCHOR WORD is only named by the two that speak
   * or reveal it. hear-see never says its keyword, so `tent` is still a live
   * distractor after a hear-see item on `t` — matching the pack's own rule.
   * With them merged, a group-1 blended session ran out of legal distractors
   * on its fifth item and shipped a spent one for the pack to drop.
   */
  const spent = isLetterMode ? answeredLetters : namedAnchors;
  const isSpent = (value: string) =>
    isLetterMode ? spent.has(value) : spent.has(letterOfAnchor(value) ?? value);

  const wrongOpt = opts.find((o) => !o.isCorrect);
  const wrongLetter = (value: string) =>
    isLetterMode ? value : letterOfAnchor(value) ?? value;
  const keptWrong = renderable(wrongOpt?.[field])
    && !isSpent(wrongOpt![field]!)
    && !shownAsWrong.has(wrongLetter(wrongOpt![field]!))
    ? wrongOpt![field]!
    : (() => {
        const letter = pickDistractor(ch.targetLetter, distractorPool, spent, shownAsWrong);
        return isLetterMode ? letter : KEYWORD_MAP[letter];
      })();
  shownAsWrong.add(wrongLetter(keptWrong));

  const options = [
    { [field]: correctValue, isCorrect: true },
    { [field]: keptWrong, isCorrect: false },
  ] as Array<{ letter?: string; sound?: string; isCorrect: boolean }>;

  // Shuffle
  if (Math.random() > 0.5) {
    [options[0], options[1]] = [options[1], options[0]];
  }

  return options;
}

/** Which letter does this anchor word belong to? */
function letterOfAnchor(word: string): string | undefined {
  return Object.keys(KEYWORD_MAP).find((letter) => KEYWORD_MAP[letter] === word);
}
