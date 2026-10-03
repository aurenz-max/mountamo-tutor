/**
 * diLetterSoundsMenu — the curated letter-sound table, pure, so the generator and the runtime
 * levers (`diLetterSoundsLevers.ts`) read one table. Moved out of `gemini-di-letter-sounds.ts` 2026-10-03.
 */

/** One curated menu entry: everything the tutor and the picture need. */
export interface LetterSoundMenuEntry {
  letter: string;
  spoken: string;
  keyword: string;
  emoji: string;
  elicitation: 'isolated' | 'keyword';
  /** Stops release once; absent = a held continuant (see the script's field). */
  articulation?: 'clipped';
  asrAliases: string[];
}

/**
 * The curated letter-sound menu. Every letter is asked for its sound; a short
 * vowel or a stop also accepts its keyword (a short vowel distorts in isolation).
 * Every keyword is concrete and picturable, and its FIRST sound is the target.
 */
export const LETTER_SOUND_MENU: Record<string, LetterSoundMenuEntry> = {
  // ── Continuous consonants (held ~2s) ─────────────────────────────
  m: { letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated', asrAliases: ['m', 'mm', 'mmm', 'hm', 'hmm', 'mhm', 'um'] },
  s: { letter: 's', spoken: 'sss', keyword: 'sun', emoji: '☀️', elicitation: 'isolated', asrAliases: ['s', 'ss', 'sss', 'ess', 'sh', 'shh', 'hiss'] },
  f: { letter: 'f', spoken: 'fff', keyword: 'fish', emoji: '🐟', elicitation: 'isolated', asrAliases: ['f', 'ff', 'fff', 'ef', 'huff'] },
  r: { letter: 'r', spoken: 'rrr', keyword: 'ring', emoji: '💍', elicitation: 'isolated', asrAliases: ['r', 'rr', 'rrr', 'ar', 'are', 'er'] },
  n: { letter: 'n', spoken: 'nnn', keyword: 'nest', emoji: '🪺', elicitation: 'isolated', asrAliases: ['n', 'nn', 'nnn', 'en', 'un'] },
  l: { letter: 'l', spoken: 'lll', keyword: 'leaf', emoji: '🍃', elicitation: 'isolated', asrAliases: ['l', 'll', 'lll', 'el', 'ull'] },
  v: { letter: 'v', spoken: 'vvv', keyword: 'van', emoji: '🚐', elicitation: 'isolated', asrAliases: ['v', 'vv', 'vvv', 'vee'] },
  z: { letter: 'z', spoken: 'zzz', keyword: 'zebra', emoji: '🦓', elicitation: 'isolated', asrAliases: ['z', 'zz', 'zzz', 'zee', 'buzz'] },
  // ── Short vowels (keyword elicitation) ───────────────────────────
  a: { letter: 'a', spoken: 'aaa', keyword: 'apple', emoji: '🍎', elicitation: 'keyword', asrAliases: ['apple', 'a'] },
  e: { letter: 'e', spoken: 'eee', keyword: 'egg', emoji: '🥚', elicitation: 'keyword', asrAliases: ['egg', 'e'] },
  i: { letter: 'i', spoken: 'iii', keyword: 'igloo', emoji: '🧊', elicitation: 'keyword', asrAliases: ['igloo', 'i'] },
  o: { letter: 'o', spoken: 'ooo', keyword: 'octopus', emoji: '🐙', elicitation: 'keyword', asrAliases: ['octopus', 'o'] },
  u: { letter: 'u', spoken: 'uuu', keyword: 'umbrella', emoji: '☂️', elicitation: 'keyword', asrAliases: ['umbrella', 'u'] },
  // ── Stops (clipped — released once, never held) ───────────────────
  // Slash notation is what the voice reads correctly for an ASCII consonant
  // (phonemeVoice rule 1, proven live on letter-sound-link); the keywords are
  // letter-sound-link's own LETTER_KEYWORDS so a child meets ONE anchor per
  // letter across both packs. Aliases include the schwa release and the
  // keyword — the ruling's two accepted forms — never the letter NAME.
  t: { letter: 't', spoken: '/t/', keyword: 'tent', emoji: '⛺', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['t', 'tuh', 'ta', 'tent'] },
  p: { letter: 'p', spoken: '/p/', keyword: 'pig', emoji: '🐷', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['p', 'puh', 'pa', 'pig'] },
  c: { letter: 'c', spoken: '/k/', keyword: 'cat', emoji: '🐱', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['k', 'c', 'kuh', 'ka', 'cat'] },
  k: { letter: 'k', spoken: '/k/', keyword: 'kite', emoji: '🪁', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['k', 'kuh', 'ka', 'kite'] },
  h: { letter: 'h', spoken: '/h/', keyword: 'hat', emoji: '🎩', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['h', 'huh', 'ha', 'hat'] },
  d: { letter: 'd', spoken: '/d/', keyword: 'dog', emoji: '🐶', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['d', 'duh', 'da', 'dog'] },
  g: { letter: 'g', spoken: '/g/', keyword: 'goat', emoji: '🐐', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['g', 'guh', 'ga', 'goat'] },
  b: { letter: 'b', spoken: '/b/', keyword: 'bat', emoji: '🦇', elicitation: 'isolated', articulation: 'clipped', asrAliases: ['b', 'buh', 'ba', 'bat'] },
};

