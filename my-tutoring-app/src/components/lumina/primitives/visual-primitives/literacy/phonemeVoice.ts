/**
 * phonemeVoice — turn a WRITTEN phoneme into something a voice can actually
 * say. Shared by the literacy DI ports (phonics-blender, sound-swap).
 *
 * WHY THIS EXISTS (2026-08-09, caught by ear on the first live sound-swap run).
 * Our literacy generators emit phonemes in IPA-ish slash notation because that
 * is what the SCREEN shows: `/k/`, `/æ/`, `/t/`. Both DI ports then piped those
 * strings straight into `Speak exactly:` lines and into `[PRONOUNCE_SOUND]`, so
 * the tutor was handed `Listen: at. /æ/ … /n/.` and asked to say it aloud.
 * `/k/` and `/t/` survive that — the glyph IS the Latin letter and a voice
 * reaches the obvious reading. `/æ/`, `/ɪ/`, `/ʃ/`, `/θ/`, `/ŋ/` do not: they
 * are characters a speech model has no confident reading for, and the user's
 * ear caught it on the very first run.
 *
 * ⚠️ THE FIRST FIX FOR THIS WAS THE WRONG ONE, and the user's ear settled it.
 * The instinct was to make the sound-by-sound walk SAYABLE. The ruling was that
 * for sound-swap the walk should not be there at all: *"she does sound funny
 * during that part, i think not necessary — the 'an… Add /p/' works great and
 * the student can clearly hear the instructions, but the gibberish comes across
 * as a distraction."* So sound-swap's walk is DELETED (`soundSwapScript.ts`),
 * and this module now serves the two places a phoneme genuinely cannot be
 * removed: the ASK itself (`Change /æ/ to /ɛ/` — the phoneme IS the
 * instruction), and phonics-blender's model line, where running the sounds
 * together is the skill being taught rather than a scaffold around it.
 *
 * THE PRECEDENT IS ALREADY IN THIS CODEBASE, and it is the settled answer.
 * `di-letter-sounds` never writes IPA into a spoken line: its code-owned menu
 * carries a `spoken` field — `m` → "mmm", `s` → "sss", `a` → "aaa" — and the
 * script speaks THAT while the screen shows the letter. This module is the same
 * move for generator-authored phonemes: one code-owned map, applied at the
 * boundary between what is displayed and what is uttered.
 *
 * TWO RULES, both deliberate:
 *
 *  1. **ASCII passes through untouched.** `/k/`, `/t/`, `/sh/`, `/j/` are left
 *     exactly as the generator wrote them. This is not laziness — it is the
 *     only safe reading. `/j/` is the "yes" sound in IPA and the "jump" sound
 *     in the ad-hoc notation our K-2 prompts also invite, and code cannot tell
 *     which one a given generation meant. Rewriting it would be guessing at the
 *     phoneme, which is worse than leaving a glyph a voice can already read.
 *
 *  2. **An unspeakable sound is DROPPED FROM THE WALK, never spoken raw.**
 *     `speakableWalk` returns null if any phoneme is unmapped and non-ASCII, and
 *     the caller then omits the sound-by-sound model entirely — degrading to the
 *     line the `hard` support tier already speaks. The failure mode of an
 *     unknown glyph is therefore LESS SCAFFOLD, never gibberish in a
 *     five-year-old's ear. The ask itself (`Take away /æ/`) cannot be dropped,
 *     so `speakablePhoneme` falls back to the raw string there — which is why
 *     the map below covers the whole inventory our prompts instruct.
 */

/**
 * Code-owned spellings for the non-ASCII phoneme glyphs our K-2 literacy
 * generators are instructed to emit. Keys are the bare glyph, slashes stripped.
 *
 * The short-vowel spellings are di-letter-sounds' own ("aaa", "eee", "iii",
 * "ooo", "uuu") — the same sounds already benched and shipping in that pack, so
 * a child hears one consistent rendering across the two families.
 */
const SPEAKABLE: Record<string, string> = {
  // ── Short vowels (IPA + the breve notation the phonics prompts also invite)
  'æ': 'aaa', 'ă': 'aaa',
  'ɛ': 'eee', 'ĕ': 'eee',
  'ɪ': 'iii', 'ĭ': 'iii',
  'ɑ': 'ooo', 'ɒ': 'ooo', 'ŏ': 'ooo',
  'ʌ': 'uuu', 'ʊ': 'uuu', 'ŭ': 'uuu',
  'ə': 'uh',
  // ── Long vowels (macron notation) and their IPA diphthong equivalents
  'ā': 'ay', 'eɪ': 'ay',
  'ē': 'ee', 'iː': 'ee', 'i:': 'ee',
  'ī': 'eye', 'aɪ': 'eye',
  'ō': 'oh', 'oʊ': 'oh',
  'ū': 'ooo', 'uː': 'ooo', 'u:': 'ooo',
  // ── Other vowels our r-controlled / diphthong modes reach
  'ɔ': 'aw', 'ɔɪ': 'oy', 'aʊ': 'ow',
  'ɜ': 'er', 'ɝ': 'er', 'ɚ': 'er', 'ər': 'er', 'ɑr': 'ar', 'ɔr': 'or',
  // ── Consonant glyphs that are not their own Latin letter
  'ʃ': 'shh', 'ʒ': 'zhh',
  'tʃ': 'ch', 'dʒ': 'j',
  'θ': 'th', 'ð': 'th',
  'ŋ': 'ng',
};

/** Everything in printable ASCII is already readable by a voice as written. */
const isAscii = (value: string) => /^[\x20-\x7E]*$/.test(value);

/** The glyph with its slash wrapper removed: "/æ/" → "æ". */
const core = (raw: string) => raw.replace(/\//g, '').trim();

/**
 * Can this phoneme be spoken as written, or after mapping? False only for a
 * non-ASCII glyph we have no spelling for — the case that must never reach a
 * child's ear.
 */
export const isSpeakablePhoneme = (raw: string): boolean => {
  const glyph = core(raw);
  return glyph.length > 0 && (isAscii(glyph) || glyph in SPEAKABLE);
};

/**
 * The form the TUTOR should say. Display code must keep using the original
 * string — the screen wants `/æ/`, the voice wants "aaa".
 */
export const speakablePhoneme = (raw: string): string => {
  const glyph = core(raw);
  if (!glyph) return raw;
  const mapped = SPEAKABLE[glyph];
  if (mapped) return mapped;
  // ASCII is left EXACTLY as authored, slashes included: "/k/" reads fine, and
  // rewriting it would mean guessing which sound an ambiguous letter meant.
  return raw;
};

/**
 * "aaa … nnn" — the sound-by-sound walk, ellipses included so the tutor paces
 * it instead of running the sounds together.
 *
 * Returns **null** when any phoneme is unspeakable, so the caller drops the
 * walk rather than speaking a glyph. Losing a scaffold is recoverable; a tutor
 * reading punctuation at a five-year-old is not.
 */
export const speakableWalk = (phonemes: string[]): string | null => {
  if (!phonemes.length) return null;
  if (!phonemes.every(isSpeakablePhoneme)) return null;
  return phonemes.map(speakablePhoneme).join(' … ');
};
