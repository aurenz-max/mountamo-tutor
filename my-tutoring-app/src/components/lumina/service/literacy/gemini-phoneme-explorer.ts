import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext, SupportTier } from "../generation/generationContext";
import { clampGradeToK2 } from "../scopeContext";
import { PhonemeExplorerData } from "../../primitives/visual-primitives/literacy/PhonemeExplorer";
import {
  resolveEvalModes,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildRemediationPrompt } from '../generation/remediationPrompt';

// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------
//
// PhonemeExplorer has five structurally-distinct challenge modes (isolate,
// medial, blend, segment, manipulate), each with its own field set. A SINGLE
// Gemini call juggling all of them in one mode-multiplexed schema (~15 conditional
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
// live tutor in-band. Only the MENU modes (`isolate`, `medial`) carry 4 choices
// — they are the on-screen MENU (the question side, unmarked); the other three
// modes emit the ANSWER as a field and no choices at all.
// `phonemeExplorerScript.ts` owns the leak/sayability gates that drop an item
// the tutor could not honestly ask.
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
  // Added 2026-09-05 (lesson-bench BACKLOG item 23). The supply gap it closes:
  // two independent K "Decoding CVC words with short a" draws produced an
  // objective shaped "identify the short 'a' sound in spoken words" and BOTH
  // came back off_target_assessment, because every mode this primitive had was
  // an INITIAL-sound or whole-word task. Shape ruled by the user: a minimal-pair
  // CHOICE answered aloud, NOT "say the middle sound" — producing an isolated
  // vowel is an unbenched response class, and the menu keeps this on the already
  // benched `short_spoken_word` judge.
  medial: {
    promptDoc:
      `"medial": The tutor SAYS one CVC word (never printed — the child hears it and sees only a picture) `
      + `and reads a 4-word menu aloud; the student SAYS which menu word has the same MIDDLE sound. `
      + `Set ONLY targetWord (the spoken CVC stimulus), targetEmoji and vowel (the single SHORT vowel letter `
      + `in the middle of targetWord — one of a, e, i, o, u). YOU DO NOT WRITE THE MENU — `
      + `the four cards are built from a curated word bank in code, so do not attempt to supply choices. `
      + `Your whole job is a stimulus a five-year-old knows and can picture, fitted to the topic. `
      + `Use a DIFFERENT middle vowel across the challenges wherever the topic allows it. `
      + `targetWord must be a real, concrete, picturable CVC word with a true SHORT vowel — never a long vowel, `
      + `never a silent-e word ("cake", "bike"), never an r-controlled word ("car", "bird") — and its `
      + `targetEmoji must depict it unmistakably, because the word is NEVER PRINTED and the picture is the `
      + `child's only way to recover it.`,
    schemaDescription: "'medial' (say the menu word with the same middle vowel sound)",
  },
  blend: {
    promptDoc:
      `"blend": The tutor says the sounds one at a time and the student SAYS the blended word aloud. `
      + `Set phonemeSequence (array of individual sounds, e.g., ["k","a","t"]), word (the word those `
      + `sounds make, e.g., "cat") and emoji (depicting the word). No choices — the spoken word IS the answer. `
      // The clause `segment` has always carried, arriving here after a probe
      // caught the walk being SPELLED rather than sounded: "cow" came back as
      // ["c","o","w"] and "duck" as ["d","u","c"]. The tutor SPEAKS this array
      // one sound at a time and the child blends what they hear, so a spelled
      // sequence asks a question whose answer is not the word — and unlike
      // segment, where the walk is only a correction scaffold, here the walk IS
      // the ask and there is nothing to degrade to.
      + `The array is SOUNDS, not letters: "cow" is 2 sounds ["k","ow"] and "duck" is 3 ["d","u","k"] — `
      + `never use "c", "q" or "x", which are letters that stand for other sounds (/k/, /s/, /kw/, /ks/) `
      + `and cannot be said aloud on their own. Blending your array out loud must land exactly on word. `
      // Root cause, one level up from the spelling: measured over four draws the
      // model reliably CHOSE "cow" for a farm topic and then spelled it
      // ["c","o","w"], so the build gate dropped that slot every time (1-2 of 5
      // per draw, always the same position). Steering the WORD is what actually
      // stops it — the sounds-not-letters clause alone only fixed the spelling
      // some of the time.
      + `PICK WORDS THAT DO NOT CONTAIN c, q or x at all (choose "pig", "hen", "dog", "rat", "duck" over `
      + `"cow", "cat", "fox", "chick") — a word spelled with one of those letters is the case the model `
      + `most often spells out instead of sounding out. `
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

// Order IS the ladder: buildModePlan filters this list and round-robins in it,
// so a blended plan runs easy→hard. medial sits between isolate (β 1.5) and
// blend (β 2.5) at β 2.0 — the same closed-set act, one step further into the
// word.
const ALL_MODES = ['isolate', 'medial', 'blend', 'segment', 'manipulate'] as const;
type PhonemeMode = typeof ALL_MODES[number];
export type PhonemeRemediationMove = 'contrast_phoneme' | 'blend_through' | 'segment_boundary' | 'isolate_operation';

export function phonemeRemediationMoveFor(
  mode: PhonemeMode,
  remediationFocus?: string,
): PhonemeRemediationMove | undefined {
  if (!remediationFocus?.trim()) return undefined;
  // medial IS a phoneme contrast — a wrong card differs from the answer in
  // exactly the sound under test, which is what contrast_phoneme remediates.
  if (mode === 'isolate' || mode === 'medial') return 'contrast_phoneme';
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
    case 'medial':
    case 'segment':
      // Neither has instruction furniture of its own — the spoken target word IS
      // the stimulus. Their tier lever is the shared pair above: at hard (and
      // above K) the picture cue goes and the tutor stops enumerating the menu,
      // so a medial item's four cards must be READ rather than heard.
      break;
  }

  return scaffold;
}

// ---------------------------------------------------------------------------
// medial — the MENU IS BUILT IN CODE. (2026-09-05)
//
// Three prompt iterations could not stop flash-lite inventing a word to finish
// a rhyming set: told to hold the rime, it completed "rim/rum/…" with "rom",
// "ran/run/…" with "ren" and "rin", and "map/mop/…" with "mep". Measured across
// draws that was 8 of 20 cards on the first pass and still 4 of 15 with an
// explicit real-words rule AND a word bank in the prompt.
//
// It matters more here than it would elsewhere because of WHO reads the card: a
// pre-reader's access to a menu word is its picture, and an invented word gets
// an invented picture — "dag" shipped as 🎒, "rud" as 🪵. The child sees a
// backpack and hears a non-word.
//
// So the model no longer authors the menu. It authors what it is good at — a
// topic-fitting, picturable STIMULUS word and the vowel in it — and code fills
// the four cards from this bank. A non-word is then structurally impossible
// rather than discouraged. (This is the family's standing division of labour:
// the LLM emits scope, code builds structure and the answer.)
//
// Ordered so that the common consonant frames line up across vowels (hat/hot/
// hut/hit, cap/cop/cup/…): `buildMedialChoices` prefers a distractor sharing the
// target's ending, which is what makes the item a VOWEL test rather than a
// whole-word test — and falls back to any real word of the right vowel, which
// is exactly the fallback the model refused to take.
const MEDIAL_WORD_BANK: Record<string, { word: string; emoji: string }[]> = {
  a: [
    { word: 'hat', emoji: '🎩' }, { word: 'cat', emoji: '🐱' }, { word: 'bat', emoji: '🦇' },
    { word: 'cap', emoji: '🧢' }, { word: 'map', emoji: '🗺️' }, { word: 'bag', emoji: '👜' },
    { word: 'pan', emoji: '🍳' }, { word: 'fan', emoji: '🪭' }, { word: 'can', emoji: '🥫' },
    { word: 'jam', emoji: '🍓' }, { word: 'rat', emoji: '🐀' }, { word: 'tag', emoji: '🏷️' },
  ],
  e: [
    { word: 'net', emoji: '🥅' }, { word: 'jet', emoji: '✈️' }, { word: 'bed', emoji: '🛏️' },
    { word: 'pen', emoji: '🖊️' }, { word: 'hen', emoji: '🐔' }, { word: 'ten', emoji: '🔟' },
    { word: 'leg', emoji: '🦵' }, { word: 'web', emoji: '🕸️' }, { word: 'egg', emoji: '🥚' },
    { word: 'vet', emoji: '🩺' }, { word: 'bell', emoji: '🔔' }, { word: 'nest', emoji: '🪺' },
  ],
  i: [
    { word: 'hit', emoji: '🏏' }, { word: 'pig', emoji: '🐷' }, { word: 'wig', emoji: '👱' },
    { word: 'lip', emoji: '👄' }, { word: 'zip', emoji: '🤐' }, { word: 'dig', emoji: '⛏️' },
    { word: 'pin', emoji: '📌' }, { word: 'fin', emoji: '🐟' }, { word: 'win', emoji: '🏆' },
    { word: 'six', emoji: '6️⃣' }, { word: 'lid', emoji: '🫙' }, { word: 'fish', emoji: '🐠' },
  ],
  o: [
    { word: 'hot', emoji: '🔥' }, { word: 'dog', emoji: '🐶' }, { word: 'log', emoji: '🪵' },
    { word: 'mop', emoji: '🧹' }, { word: 'top', emoji: '🔝' }, { word: 'hop', emoji: '🐰' },
    { word: 'pot', emoji: '🍲' }, { word: 'fox', emoji: '🦊' }, { word: 'box', emoji: '📦' },
    { word: 'sock', emoji: '🧦' }, { word: 'rock', emoji: '🪨' }, { word: 'frog', emoji: '🐸' },
  ],
  u: [
    { word: 'hut', emoji: '🛖' }, { word: 'sun', emoji: '☀️' }, { word: 'run', emoji: '🏃' },
    { word: 'bun', emoji: '🍞' }, { word: 'cup', emoji: '🥤' }, { word: 'pup', emoji: '🐶' },
    { word: 'bug', emoji: '🐛' }, { word: 'rug', emoji: '🧶' }, { word: 'mug', emoji: '☕' },
    { word: 'nut', emoji: '🥜' }, { word: 'duck', emoji: '🦆' }, { word: 'drum', emoji: '🥁' },
  ],
};

const VOWEL_KEYS = ['a', 'e', 'i', 'o', 'u'];

/**
 * Rotation seed for one item's menu. Keyed to the STIMULUS, not to the item's
 * position, for two reasons: the same word drawn at slot 1 and slot 4 would
 * otherwise get two different menus, and — the one that matters — an item whose
 * cards change between draws is a DIFFERENT item wearing the same id, which is
 * exactly what an IRT β estimate cannot absorb. Same stimulus ⇒ same four cards,
 * every time.
 */
const menuSeedFor = (targetWord: string): number => {
  let h = 0;
  for (const ch of targetWord.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 100003;
  return h;
};

/** The part of a word after its middle vowel — "cat" → "t". Used to prefer a
 *  menu that varies ONLY the vowel, the sharpest form of the ask. */
const codaAfterVowel = (word: string, vowel: string): string => {
  const at = word.toLowerCase().indexOf(vowel.toLowerCase());
  return at < 0 ? '' : word.toLowerCase().slice(at + 1);
};

/**
 * The four cards for ONE medial item: 1 correct (same vowel as the stimulus,
 * never the stimulus itself) and 3 distractors, one from each of three other
 * vowels. `rotation` walks the bank across a session's items so five challenges
 * do not all reach for "hat".
 *
 * Returns null when the vowel is unknown — the caller drops the item rather
 * than shipping a menu it could not build.
 */
function buildMedialChoices(
  targetWord: string,
  vowel: string,
  rotation: number,
): { word: string; emoji: string; correct: boolean }[] | null {
  const v = vowel.trim().toLowerCase();
  const target = targetWord.trim().toLowerCase();
  const bank = MEDIAL_WORD_BANK[v];
  if (!bank) return null;
  const coda = codaAfterVowel(target, v);

  // Same vowel, not the stimulus, ending-match first — "cat" pulls "hat".
  const sameVowel = bank.filter((e) => e.word !== target);
  if (sameVowel.length === 0) return null;
  const matched = sameVowel.filter((e) => coda && codaAfterVowel(e.word, v) === coda);
  const pool = matched.length ? matched : sameVowel;
  const correct = pool[rotation % pool.length];

  const others = VOWEL_KEYS.filter((k) => k !== v);
  const distractors: { word: string; emoji: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const otherVowel = others[(rotation + i) % others.length];
    const otherBank = (MEDIAL_WORD_BANK[otherVowel] ?? []).filter(
      (e) => e.word !== target && !distractors.some((d) => d.word === e.word) && e.word !== correct.word,
    );
    if (otherBank.length === 0) return null;
    // Prefer the minimal pair — "cat" → "hot", "hut", "hit" — then anything real.
    const rimeMatch = otherBank.filter(
      (e) => coda && codaAfterVowel(e.word, otherVowel) === coda,
    );
    const from = rimeMatch.length ? rimeMatch : otherBank;
    distractors.push(from[rotation % from.length]);
  }

  const cards = [
    { ...correct, correct: true },
    ...distractors.map((d) => ({ ...d, correct: false })),
  ];
  // Deterministic placement — the answer must not always sit first.
  const at = rotation % cards.length;
  const [answer] = cards.splice(0, 1);
  cards.splice(at, 0, answer);
  return cards;
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
- For medial: SHORT vowels in 3-letter CVC words ONLY (cat, pig, bed, hop, sun) — never long vowels, silent-e or r-controlled words
- For blend: 3-phoneme CVC words ONLY
- For segment: 3-phoneme CVC words ONLY
- For manipulate: initial consonant substitution ONLY`,
  "1": `GRADE 1 GUIDELINES:
- Can include blends and digraphs (SH, CH, TH) as target phonemes
- Use a wider vocabulary but keep words concrete and picturable
- Words can be up to 5 letters
- Include a mix of consonant and vowel sounds
- For isolate: initial/beginning sounds ONLY (isolate cannot present final or medial sounds — middle sounds have their own "medial" mode, and there is no ending-sound mode here at all)
- For medial: SHORT vowels; CVC or simple CVCC words (fast, jump) — never long vowels, silent-e or r-controlled words
- For blend: 3-4 phoneme words
- For segment: 3-4 phoneme words
- For manipulate: initial and final substitution, simple deletion`,
  "2": `GRADE 2 GUIDELINES:
- Include a wider range of phonemes including vowel sounds
- Can include less common consonant sounds and digraphs
- Words can be up to 6 letters but must still be concrete and picturable
- Use grade-appropriate vocabulary
- For isolate: initial/beginning sounds ONLY (isolate cannot present final or medial sounds — middle sounds have their own "medial" mode, and there is no ending-sound mode here at all)
- For medial: SHORT vowels still, but a wider word shape (CVC, CVCC, CCVC — stamp, brush, clock)
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
    case 'medial':
      return {
        type: Type.OBJECT,
        properties: {
          remediationMove,
          targetWord: { type: Type.STRING, description: "The SPOKEN stimulus word — a real, concrete, picturable CVC word with a short vowel (e.g. 'cat'). Never printed on screen." },
          targetEmoji: { type: Type.STRING, description: "A single emoji depicting targetWord. MUST visually match — it is the child's only on-screen access to the word." },
          // The letter, not free text. The script maps it to a spoken vowel
          // ("a" -> "aaa"); asking the model to write the sound invites the
          // mnemonic form ("aaa, as in apple") that leaked a card word out of
          // isolate's phonemeSound.
          vowel: {
            type: Type.STRING,
            enum: ["a", "e", "i", "o", "u"],
            description: "The single SHORT vowel letter in the MIDDLE of targetWord.",
          },
        },
        required: ["targetWord", "targetEmoji", "vowel"],
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

/**
 * One mode's challenges, retried once if the first attempt yields nothing.
 *
 * The retry is the third leg of the flash-lite template (bound arrays → 8192
 * tokens → retry+degrade) and this generator only ever had the first two. It
 * matters more here than the token bump did, because of what an empty pool
 * COSTS: `generatePhonemeExplorer` falls back to a single hardcoded isolate item
 * about a Bear and a Ball, so one flaky call turns a five-item lesson on the
 * requested topic into a one-item lesson on neither. Probe draws of `isolate`
 * came back 0, 0, 3, 5 and 0 of 5 — the same call, the same prompt, the same
 * grade. A second attempt is far cheaper than shipping that fallback to a child.
 */
async function generateModeChallenges(
  mode: PhonemeMode,
  count: number,
  gradeKey: string,
  topic: string,
  intent: string | undefined,
  remediationFocus: string | undefined,
): Promise<RawChallenge[]> {
  const first = await generateModeAttempt(mode, count, gradeKey, topic, intent, remediationFocus);
  if (first.length > 0) return first;
  console.warn(`[PhonemeExplorer] ${mode} returned no usable challenges — retrying once`);
  return generateModeAttempt(mode, count, gradeKey, topic, intent, remediationFocus);
}

async function generateModeAttempt(
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
${mode === 'isolate' ? '- Use a DIFFERENT target phoneme for each challenge (do not repeat the same letter).\n' : ''}${mode === 'isolate' ? '- The correct choice MUST start with the same sound as the phoneme; distractors start with DIFFERENT sounds. The exampleWord must NOT appear among the choices.\n' : ''}${mode === 'medial' ? '- Use a DIFFERENT middle vowel across the challenges where the topic allows it (do not make every item short a).\n- The correct choice has the SAME middle vowel as targetWord; ALL THREE distractors have a DIFFERENT middle vowel. targetWord must NOT appear among the choices.\n- ALL FOUR cards must be REAL words a five-year-old knows. Never invent a word to complete a rhyming set — change the onset and keep the word real ("sun" -> run, ran, hen, pin), because each card is shown with a picture and an invented word has no picture.\n' : ''}${mode === 'blend' ? '- phonemeSequence must be accurate phonemes and word must be EXACTLY the word they blend into.\n' : ''}${mode === 'segment' ? '- segments must be the word\'s true SOUNDS in order, not its letters ("sheep" → ["sh","ee","p"], 3 sounds).\n' : ''}${mode === 'manipulate' ? '- operationDescription must be clear and must NEVER contain resultWord (it is spoken with the microphone open); resultWord is the true result of the operation.\n' : ''}
Relate words to the topic "${topic}" when possible, but prioritize phonological accuracy and emoji availability.`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: modeSchema(mode, count),
      // 8192, not 4096 (the flash-lite truncation template: bound every schema
      // array, then give the call room). `isolate` is by far the widest payload
      // in this family — 5 challenges x (4 scalar fields + 4 choices x 3 fields)
      // — and at 4096 it was running out mid-object. The failure was SILENT and
      // graded as success: a truncated body fails JSON.parse, `generateModeChallenges`
      // returns [], every pool comes back empty and `buildFallbackChallenge`
      // ships a ONE-ITEM activity built on "Bear / Ball, Cat, Dog, Sun" — the
      // same hardcoded item whatever the topic was. Three probe draws of
      // `isolate` returned 0, 0 and 3 of the 5 requested; the other three modes,
      // which carry no `choices` array, were unaffected at 5/5.
      maxOutputTokens: 8192,
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
      if (mode === 'medial') {
        // The menu is OURS, not the model's — see MEDIAL_WORD_BANK. Anything the
        // model sent under `choices` is discarded, and an item whose vowel the
        // bank does not know gets no menu and fails validation below (drop,
        // never backfill).
        const built = typeof ch.targetWord === 'string' && typeof ch.vowel === 'string'
          ? buildMedialChoices(ch.targetWord, ch.vowel, menuSeedFor(ch.targetWord))
          : null;
        if (built) ch.choices = built;
        else delete ch.choices;
      }
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
  /** Target eval mode from the IRT calibration system. Wins over intent, no LLM call. */
  targetEvalMode: string;
  /** Parent objective text (stamped by flattenManifestToLayout) — the secondary
   *  routing signal when nothing is pinned. */
  objectiveText: string;
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
  //
  // Migrated off the pin-only `resolveEvalModeConstraint` with the `medial`
  // slice, because a pin-only resolver is half the supply fix: an objective
  // shaped "identify the short 'a' sound in spoken words" that arrives WITHOUT
  // a pin fell straight through to mixed, and mixed spends 1 of 5 items on the
  // mode the objective actually asked for. `resolveEvalModes` reads the intent
  // and the parent objective against this primitive's own catalog mode
  // descriptions, so the new mode is reachable on the unpinned path too.
  const resolution = await resolveEvalModes(
    'phoneme-explorer',
    {
      targetEvalMode: config?.targetEvalMode,
      intent,
      objectiveText: config?.objectiveText,
    },
    CHALLENGE_TYPE_DOCS,
  );
  console.log(
    `[PhonemeExplorer] modes: ${resolution
      ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})`
      : 'mixed'} → types [${(resolution?.allowedTypes ?? ['all']).join(', ')}]`,
  );

  // Ladder rung from the canonical curriculum grade (ctx.grade) first; the prose
  // gradeLevel band never matched ["K","1","2"] and pinned every objective to "K".
  const gradeKey = clampGradeToK2(
    ctx.grade,
    (["K", "1", "2"].includes(gradeLevel.toUpperCase()) ? gradeLevel.toUpperCase() : "K") as "K" | "1" | "2",
  );

  const allowed = resolution?.allowedTypes ?? [...ALL_MODES];
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

const SHORT_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

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
    case 'medial': {
      if (!isWord(ch.targetWord) || !isNonEmptyString(ch.targetEmoji)) return false;
      if (typeof ch.vowel !== 'string' || !SHORT_VOWELS.has(ch.vowel.trim().toLowerCase())) return false;
      const choices = ch.choices;
      if (!Array.isArray(choices) || choices.length !== 4) return false;
      const typed = choices as { word?: unknown; emoji?: unknown; correct?: unknown }[];
      if (!typed.every((c) => isWord(c.word) && isNonEmptyString(c.emoji))) return false;
      if (typed.filter((c) => c.correct === true).length !== 1) return false;
      const words = typed.map((c) => (c.word as string).trim().toLowerCase());
      if (new Set(words).size !== words.length) return false;
      // The stimulus is SPOKEN in the ask — a card carrying it is answerable by
      // repeating what was just heard, with no vowel work at all.
      if (words.includes((ch.targetWord as string).trim().toLowerCase())) return false;
      // The vowel must genuinely be IN the stimulus. The model reaches for a
      // plausible-looking letter under a topic constraint, and a mismatch makes
      // the CORRECTION ("cat has ooo in the middle") teach the wrong thing.
      if (!(ch.targetWord as string).toLowerCase().includes(ch.vowel.trim().toLowerCase())) return false;
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
