/**
 * Code-owned rhyme words for teaching the rule and for practice items, shared by rhyme-studio's levers and the
 * phonemic-awareness primitives after it (handoff 22 L2: phoneme-explorer, sound-swap, syllable-clapper,
 * poetry-lab). Dependency-free, so any primitive or generator can import it.
 *
 * Two pools, kept apart on purpose:
 * - `MODEL_RHYME_SETS`: families no K rhyme item uses, for MODELS (help levers). A model teaches the rule on
 *   words the session never asks about, so it answers nothing.
 * - `K_RHYME_FAMILIES` + `PRACTICE_EXTRA_FAMILIES`: the picturable menu the generator writes K items from, and
 *   families no item uses. Practice items (simplify levers) draw from them, a family the session does not use.
 * Both exclude by FAMILY, not only by word: a model or practice pair from the -at family gives away every -at
 * item in the session even though it shares no spelling with them.
 */

export interface PicturedWord { word: string; emoji: string }

/**
 * A model of rhyming: `words` rhyme with each other (the first is the anchor), and `onsetFoil` starts like the
 * anchor but ends differently, the error rhyme-studio's recognition and identification items catch (cat/cap).
 * `swap` is set when the first three words differ only in one first sound (sock, rock, lock), so the family can
 * model putting a new first sound on an ending.
 */
export interface RhymeModelSet { rime: string; words: readonly PicturedWord[]; onsetFoil: PicturedWord; swap?: true }

export const MODEL_RHYME_SETS: readonly RhymeModelSet[] = [
  { rime: 'ee', words: [{ word: 'bee', emoji: '🐝' }, { word: 'tree', emoji: '🌳' }], onsetFoil: { word: 'bus', emoji: '🚌' } },
  { rime: 'ar', words: [{ word: 'car', emoji: '🚗' }, { word: 'star', emoji: '⭐' }, { word: 'jar', emoji: '🫙' }],
    onsetFoil: { word: 'cup', emoji: '🥤' } },
  { rime: 'ake', words: [{ word: 'snake', emoji: '🐍' }, { word: 'cake', emoji: '🎂' }, { word: 'lake', emoji: '🏞️' }],
    onsetFoil: { word: 'snail', emoji: '🐌' } },
  { rime: 'oon', words: [{ word: 'moon', emoji: '🌙' }, { word: 'spoon', emoji: '🥄' }], onsetFoil: { word: 'mouse', emoji: '🐭' } },
  { rime: 'ock', words: [{ word: 'sock', emoji: '🧦' }, { word: 'rock', emoji: '🪨' }, { word: 'lock', emoji: '🔒' }],
    onsetFoil: { word: 'soap', emoji: '🧼' }, swap: true },
  { rime: 'ing', words: [{ word: 'king', emoji: '🤴' }, { word: 'ring', emoji: '💍' }, { word: 'wing', emoji: '🪽' }],
    onsetFoil: { word: 'kite', emoji: '🪁' }, swap: true },
  { rime: 'oat', words: [{ word: 'goat', emoji: '🐐' }, { word: 'boat', emoji: '⛵' }, { word: 'coat', emoji: '🧥' }],
    onsetFoil: { word: 'girl', emoji: '👧' }, swap: true },
  { rime: 'ail', words: [{ word: 'mail', emoji: '📬' }, { word: 'nail', emoji: '💅' }, { word: 'pail', emoji: '🪣' }],
    onsetFoil: { word: 'milk', emoji: '🥛' }, swap: true },
  { rime: 'ish', words: [{ word: 'fish', emoji: '🐟' }, { word: 'dish', emoji: '🍽️' }], onsetFoil: { word: 'fork', emoji: '🍴' } },
];

/**
 * The picturable CVC families K items are written from (the generator injects this menu and attaches each emoji
 * in code: flash-lite drops a nested array when asked for emoji, RF-3). Every family has three or more members.
 */
export const K_RHYME_FAMILIES: ReadonlyArray<{ family: string; words: ReadonlyArray<readonly [string, string]> }> = [
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

/**
 * Practice-only families: picturable, with rhymes a child knows, used by no K item and no model. A K session can
 * use all twelve K families (the saved recognition payload does), and a practice item still needs one it does not.
 */
export const PRACTICE_EXTRA_FAMILIES: ReadonlyArray<{ family: string; words: ReadonlyArray<readonly [string, string]> }> = [
  { family: '-ag', words: [['bag', '👜'], ['flag', '🚩'], ['tag', '🏷️']] },
  { family: '-ook', words: [['book', '📖'], ['hook', '🪝'], ['cook', '🧑‍🍳']] },
  { family: '-ell', words: [['bell', '🔔'], ['shell', '🐚']] },
  { family: '-ie', words: [['pie', '🥧'], ['tie', '👔'], ['fly', '🪰']] },
  { family: '-ick', words: [['chick', '🐥'], ['brick', '🧱']] },
];

/** Spellings of one ending sound, folded to one key so a session "whale" excludes a model "mail". */
const SAME_SOUND: Record<string, string> = { ale: 'ail', ea: 'ee', ey: 'ee', ote: 'oat', une: 'oon', ache: 'ake', el: 'ell', ie: 'y', igh: 'y' };

/** The ending a word rhymes on, as a sound key: the last vowel group and what follows ("cake" → "ake"). */
export function rimeOfWord(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const rime = w.match(/[aeiou][^aeiou]e$/)?.[0] ?? w.match(/[aeiou]+[^aeiou]*$/)?.[0] ?? w.match(/y$/)?.[0] ?? w;
  return SAME_SOUND[rime] ?? rime;
}

/** The first sound of a word as spelled: a digraph or a single consonant, '' for a vowel start. */
export function onsetOf(word: string): string {
  const w = word.toLowerCase();
  return w.match(/^(sh|ch|th|wh|kn)/)?.[0] ?? w.match(/^[^aeiou]/)?.[0] ?? '';
}

/** What a session already uses: every word and every ending sound. A model or practice word may use neither. */
export interface SessionWords { words: ReadonlySet<string>; rimes: ReadonlySet<string> }

export function sessionWords(words: readonly string[], families: readonly string[] = []): SessionWords {
  const clean = words.map(w => w.trim().toLowerCase()).filter(Boolean);
  return { words: new Set(clean),
    rimes: new Set([...clean.map(rimeOfWord), ...families.map(f => rimeOfWord(`x${f.replace(/^-+/, '')}`))]) };
}

const usesSession = (w: string, used: SessionWords) => used.words.has(w) || used.rimes.has(rimeOfWord(w));

/**
 * The first model set whose words, onset foil and endings the session does not use, or null. `swap` asks for a
 * set that can model changing the first sound. Never falls back to a used family: a model on the session's
 * family answers its items.
 */
export function pickModelRhymeSet(used: SessionWords, opts: { swap?: boolean } = {}): RhymeModelSet | null {
  return MODEL_RHYME_SETS.find(m => (!opts.swap || m.swap)
    && ![...m.words, m.onsetFoil].some(w => usesSession(w.word, used))) ?? null;
}

/** The practice families no session word uses, K menu first, with their words pictured. */
export function freeFamilies(used: SessionWords): Array<{ rime: string; words: PicturedWord[] }> {
  return [...K_RHYME_FAMILIES, ...PRACTICE_EXTRA_FAMILIES]
    .map(f => ({ rime: rimeOfWord(`x${f.family.replace(/^-+/, '')}`), words: f.words.map(([word, emoji]) => ({ word, emoji })) }))
    .filter(f => !used.rimes.has(f.rime) && !f.words.some(w => used.words.has(w.word)));
}
