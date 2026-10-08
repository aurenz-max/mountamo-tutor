/**
 * The `pattern` ask on the shared letter build (`letterBuild.ts`): spelling-pattern-explorer `pattern_build`
 * (qa/open-build/ROADMAP.md OB-8L). "Make a real word with the long a sound spelled ai." The learner puts letters from a
 * bank into up to six boxes and presses "I'm done!". Many words pass (rain, mail, paint).
 *
 * Code checks the pattern, in this order:
 *   - the asked spelling is in the word, in a place it can spell the sound (ai not at the end, a_e with one letter
 *     before a final e, kn at the start, mb at the end);
 *   - if not: the same sound spelled another way (`other_spelling`: rain for a_e), the pattern's letters out of place
 *     (`wrong_place`: "caek", "sink" for kn), or no sign of it (`no_pattern`);
 *   - if it is there: the letters do not make the asked sound in this word (`not_the_sound`: said, have, warm, hair).
 *     Code decides this from position rules (ai or ea before r, ar after w, a vowel or r after the r of ir/ur/er) and
 *     a short list of common exception words per pattern. A word missing from the list passes on the letters alone;
 *     the word judge is asked only whether the word is real (`only: 'real_word'`).
 * Seed words only WRITE asks (an ask ships when 3+ seed words are buildable from its bank); they never judge.
 *
 * Pure. Types only from `letterBuild.ts` (it imports the functions below).
 */
import type { LetterBuildItem, LetterBuildMiss } from './letterBuild';
import { NOT_FOR_LESSONS } from './letterBuildWords';

export type PatternId = 'ai' | 'ay' | 'a_e' | 'ee' | 'ea' | 'i_e' | 'igh' | 'oa' | 'o_e' | 'ar' | 'or' | 'er' | 'ir' | 'ur'
  | 'kn' | 'wr' | 'mb';

export type PatternMiss = 'other_spelling' | 'wrong_place' | 'no_pattern' | 'not_the_sound';

interface SpellingPattern {
  /** What the ask and the card print. */
  shown: string;
  /** The sound it spells, in words a child hears ("long a"); for a silent letter, what is silent. */
  sound: string;
  ask: string;
  /** The asked spelling in a place where it spells the sound. */
  at: RegExp;
  /** The pattern's letters present but out of place. */
  misplaced: RegExp;
  /** How to place it, for the miss words and the card. */
  place: string;
  /** The card: the shape with blanks, never a letter the learner must choose beyond the pattern. */
  card: string;
  /** The same sound spelled another way: [test, name]. */
  others: ReadonlyArray<readonly [RegExp, string]>;
  /** In these, the letters do not make the sound. */
  notSoundAt?: RegExp;
  notSoundWords?: readonly string[];
  /** Words the position rule would refuse that do make the sound (were, height). */
  alsoSound?: readonly string[];
  /** Kid-safe seed words (they write asks only). */
  words: readonly string[];
}

const C = '(?:ch|sh|th|[bcdfgjklmnpqrstvz])';
const vce = (v: string) => new RegExp(`${v}${C}e[sd]?$`);
const vceMisplaced = (v: string) => new RegExp(`${v}.*e|e${C}?${v}`);

export const PATTERNS: Record<PatternId, SpellingPattern> = {
  ai: { shown: 'ai', sound: 'long a', ask: 'Make a real word with the long a sound spelled ai.',
    at: /ai(?!$)/, misplaced: /ai$|ia/, place: 'a then i, side by side, with a letter after them',
    card: '_ a i _   (ai says long a; a letter comes after it)', others: [[/ay/, 'ay'], [vce('a'), 'a_e']],
    notSoundAt: /air/, notSoundWords: ['said', 'again', 'against', 'plaid', 'captain', 'mountain', 'fountain', 'certain', 'curtain', 'bargain', 'villain', 'aisle'],
    words: ['rain', 'mail', 'paint', 'tail', 'wait', 'pail', 'nail', 'sail', 'train', 'snail', 'maid', 'bait', 'pain', 'rail', 'aim', 'main', 'gain', 'paid', 'raid'] },
  ay: { shown: 'ay', sound: 'long a', ask: 'Make a real word with the long a sound spelled ay.',
    at: /ay/, misplaced: /ya/, place: 'a then y, side by side',
    card: '_ a y   (ay says long a)', others: [[/ai(?!$)/, 'ai'], [vce('a'), 'a_e']],
    notSoundWords: ['says'],
    words: ['day', 'play', 'say', 'may', 'stay', 'tray', 'way', 'pay', 'hay', 'lay', 'ray', 'gray', 'clay', 'pray', 'spray', 'stray'] },
  a_e: { shown: 'a_e', sound: 'long a', ask: 'Make a real word with the long a sound spelled a_e.',
    at: vce('a'), misplaced: vceMisplaced('a'), place: 'a, then one letter, then e at the very end',
    card: '_ a _ e   (one letter between a and the e at the end)', others: [[/ai(?!$)/, 'ai'], [/ay/, 'ay']],
    notSoundAt: /a[rw]e[sd]?$/, notSoundWords: ['have', 'axe', 'awe', 'are'],
    words: ['cake', 'game', 'lake', 'name', 'gate', 'tape', 'made', 'cave', 'plane', 'snake', 'late', 'same', 'bake', 'take', 'wave', 'save', 'date', 'lane', 'cape', 'shape', 'plate', 'grape', 'skate'] },
  ee: { shown: 'ee', sound: 'long e', ask: 'Make a real word with the long e sound spelled ee.',
    at: /ee/, misplaced: /e.+e/, place: 'two e letters side by side',
    card: '_ e e _   (ee says long e)', others: [[/ea/, 'ea']],
    notSoundAt: /eer/, notSoundWords: ['been'],
    words: ['tree', 'see', 'feet', 'seed', 'bee', 'green', 'sheep', 'meet', 'need', 'keep', 'deep', 'free', 'week', 'peel', 'feel', 'seen', 'teeth', 'sleep', 'beet', 'weed'] },
  ea: { shown: 'ea', sound: 'long e', ask: 'Make a real word with the long e sound spelled ea.',
    at: /ea/, misplaced: /ae/, place: 'e then a, side by side',
    card: '_ e a _   (ea says long e)', others: [[/ee/, 'ee']],
    notSoundAt: /ear/, notSoundWords: ['bread', 'head', 'dead', 'deaf', 'breath', 'sweat', 'thread', 'spread', 'ready', 'heavy', 'weather',
      'feather', 'leather', 'meant', 'health', 'wealth', 'instead', 'breakfast', 'meadow', 'sweater', 'treasure', 'measure', 'pleasant',
      'great', 'break', 'steak', 'ocean', 'idea', 'area', 'create'],
    words: ['eat', 'sea', 'leaf', 'team', 'bean', 'seat', 'meat', 'beat', 'heat', 'neat', 'read', 'tea', 'pea', 'peach', 'beach', 'clean', 'dream', 'leap', 'seal', 'meal'] },
  i_e: { shown: 'i_e', sound: 'long i', ask: 'Make a real word with the long i sound spelled i_e.',
    at: vce('i'), misplaced: vceMisplaced('i'), place: 'i, then one letter, then e at the very end',
    card: '_ i _ e   (one letter between i and the e at the end)', others: [[/igh/, 'igh']],
    notSoundWords: ['give', 'forgive', 'olive', 'machine', 'police', 'routine', 'magazine'],
    words: ['bike', 'kite', 'time', 'five', 'ride', 'line', 'pine', 'hide', 'like', 'mile', 'nine', 'side', 'tide', 'bite', 'dime', 'fine', 'pile', 'wide', 'smile', 'slide', 'white', 'prize'] },
  igh: { shown: 'igh', sound: 'long i', ask: 'Make a real word with the long i sound spelled igh.',
    at: /igh/, misplaced: /i.*g.*h|hgi|ghi/, place: 'i, g, h together, in that order',
    card: '_ i g h _   (igh says long i)', others: [[vce('i'), 'i_e']],
    notSoundAt: /eigh/, alsoSound: ['height'],
    words: ['light', 'night', 'high', 'right', 'sight', 'might', 'tight', 'fight', 'bright', 'thigh', 'sigh', 'flight'] },
  oa: { shown: 'oa', sound: 'long o', ask: 'Make a real word with the long o sound spelled oa.',
    at: /oa/, misplaced: /ao/, place: 'o then a, side by side',
    card: '_ o a _   (oa says long o)', others: [[vce('o'), 'o_e']],
    notSoundAt: /oar/, notSoundWords: ['broad', 'abroad'],
    words: ['boat', 'coat', 'road', 'soap', 'goat', 'toad', 'load', 'loaf', 'foam', 'moan', 'oak', 'oat', 'coal', 'goal', 'float', 'toast', 'roam'] },
  o_e: { shown: 'o_e', sound: 'long o', ask: 'Make a real word with the long o sound spelled o_e.',
    at: vce('o'), misplaced: vceMisplaced('o'), place: 'o, then one letter, then e at the very end',
    card: '_ o _ e   (one letter between o and the e at the end)', others: [[/oa/, 'oa']],
    notSoundAt: /o[rw]e[sd]?$/, notSoundWords: ['come', 'some', 'done', 'none', 'love', 'glove', 'dove', 'move', 'prove', 'lose', 'whose',
      'shove', 'gone', 'one', 'above'],
    words: ['home', 'rope', 'bone', 'nose', 'hole', 'note', 'pole', 'rode', 'robe', 'cone', 'hope', 'joke', 'poke', 'rose', 'stone', 'smoke', 'globe', 'stove'] },
  ar: { shown: 'ar', sound: 'ar sound', ask: 'Make a real word with the ar sound spelled ar.',
    at: /ar/, misplaced: /ra/, place: 'a then r, side by side',
    card: '_ a r _   (a then r)', others: [],
    notSoundAt: /[wq]u?ar|ar[aeiouyr]/, notSoundWords: ['dollar', 'collar', 'sugar', 'cellar', 'beggar', 'grammar', 'cedar', 'polar', 'solar',
      'lunar', 'regular', 'popular', 'calendar', 'lizard', 'wizard', 'standard', 'mustard', 'custard', 'orchard', 'backward', 'forward',
      'hazard', 'leopard', 'coward', 'vinegar', 'pillar', 'similar', 'circular'],
    words: ['car', 'star', 'farm', 'park', 'jar', 'barn', 'card', 'yard', 'arm', 'art', 'bark', 'dark', 'hard', 'harm', 'part', 'cart', 'tar', 'far', 'shark', 'start', 'smart', 'chart'] },
  or: { shown: 'or', sound: 'or sound', ask: 'Make a real word with the or sound spelled or.',
    at: /or/, misplaced: /ro/, place: 'o then r, side by side',
    card: '_ o r _   (o then r)', others: [],
    notSoundAt: /wor[dklmstry]|orr/, notSoundWords: ['doctor', 'color', 'actor', 'motor', 'sailor', 'tractor', 'mirror', 'error', 'favor', 'flavor', 'harbor',
      'major', 'minor', 'visitor', 'mayor', 'tutor', 'author', 'editor', 'neighbor', 'honor', 'humor', 'odor', 'labor', 'inventor', 'governor',
      'elevator', 'alligator', 'conductor', 'monitor', 'calculator'],
    words: ['corn', 'fork', 'horn', 'sort', 'born', 'storm', 'for', 'torn', 'worn', 'cord', 'port', 'fort', 'short', 'sport', 'north', 'porch', 'stork'] },
  er: { shown: 'er', sound: 'er sound', ask: 'Make a real word with the er sound spelled er.',
    at: /er/, misplaced: /re/, place: 'e then r, side by side',
    card: '_ e r _   (e then r)', others: [[/ir/, 'ir'], [/ur/, 'ur']],
    notSoundAt: /er[aeiouyr]/, alsoSound: ['were'],
    words: ['her', 'fern', 'herd', 'term', 'verb', 'perch', 'germ', 'jerk', 'stern', 'clerk', 'perk', 'nerd'] },
  ir: { shown: 'ir', sound: 'er sound', ask: 'Make a real word with the er sound spelled ir.',
    at: /ir/, misplaced: /ri/, place: 'i then r, side by side',
    card: '_ i r _   (i then r)', others: [[/er/, 'er'], [/ur/, 'ur']],
    notSoundAt: /ir[aeiouyr]/,
    words: ['bird', 'girl', 'first', 'shirt', 'dirt', 'sir', 'stir', 'fir', 'firm', 'skirt', 'third', 'birth', 'chirp', 'twirl', 'swirl'] },
  ur: { shown: 'ur', sound: 'er sound', ask: 'Make a real word with the er sound spelled ur.',
    at: /ur/, misplaced: /ru/, place: 'u then r, side by side',
    card: '_ u r _   (u then r)', others: [[/er/, 'er'], [/ir/, 'ir']],
    notSoundAt: /ur[aeiouy]/, notSoundWords: ['sure'],
    words: ['fur', 'turn', 'hurt', 'burn', 'curl', 'surf', 'burst', 'church', 'turf', 'purr', 'blur', 'hurl', 'curb', 'churn', 'spur'] },
  kn: { shown: 'kn', sound: 'silent k', ask: 'Make a real word that starts with a silent k, spelled kn.',
    at: /^kn/, misplaced: /kn|nk/, place: 'k then n, at the very start',
    card: 'k n _ _   (k, then n, at the start; the k is silent)', others: [[/^n/, 'n alone']],
    words: ['knee', 'knot', 'knit', 'know', 'knock', 'knife', 'knob', 'knew', 'kneel', 'knelt'] },
  wr: { shown: 'wr', sound: 'silent w', ask: 'Make a real word that starts with a silent w, spelled wr.',
    at: /^wr/, misplaced: /wr|rw/, place: 'w then r, at the very start',
    card: 'w r _ _   (w, then r, at the start; the w is silent)', others: [[/^r/, 'r alone']],
    words: ['write', 'wrap', 'wren', 'wrist', 'wrong', 'wreck', 'wrote', 'wring', 'wreath'] },
  mb: { shown: 'mb', sound: 'silent b', ask: 'Make a real word that ends with a silent b, spelled mb.',
    at: /mbs?$/, misplaced: /mb|bm/, place: 'm then b, at the very end',
    card: '_ _ m b   (m, then b, at the end; the b is silent)', others: [[/ms?$/, 'm alone']],
    words: ['lamb', 'comb', 'thumb', 'climb', 'crumb', 'limb', 'numb', 'bomb', 'tomb', 'plumb'] },
};

export const isPatternId = (p: unknown): p is PatternId => typeof p === 'string' && p in PATTERNS;

/** Up to six boxes: room for the longest seed word plus one. */
export const MAX_PATTERN_BOXES = 6;
export const patternBoxes = (item: Pick<LetterBuildItem, 'examples'>) =>
  Math.min(MAX_PATTERN_BOXES, Math.max(4, ...item.examples.map(w => w.length + 1)));

/** The word in the boxes: letters packed from the left, no gap. Null while a box before the last letter is empty. */
export function packedWord(row: readonly string[]): string | null {
  const last = row.map(Boolean).lastIndexOf(true);
  if (last < 1 || row.slice(0, last + 1).some(l => !l)) return null;
  return row.slice(0, last + 1).join('').toLowerCase();
}

/** Whether the letters spell the asked sound, given the asked spelling is in place. */
export function makesTheSound(pattern: PatternId, word: string): boolean {
  const p = PATTERNS[pattern];
  if (p.alsoSound?.includes(word)) return true;
  return !(p.notSoundAt?.test(word) || p.notSoundWords?.includes(word));
}

/** Everything the ask states, checked in code. Undefined: the pattern holds, waiting on "is it a real word?". */
export function patternMiss(item: LetterBuildItem, word: string, made: readonly string[] = []): LetterBuildMiss | undefined {
  if (!isPatternId(item.pattern)) return 'no_pattern';
  const p = PATTERNS[item.pattern];
  const w = word.toLowerCase();
  if (!p.at.test(w)) {
    if (p.others.some(([test]) => test.test(w))) return 'other_spelling';
    if (p.misplaced.test(w)) return 'wrong_place';
    return 'no_pattern';
  }
  if (!makesTheSound(item.pattern, w)) return 'not_the_sound';
  if (made.includes(w)) return 'same_word';
  if (NOT_FOR_LESSONS.has(w)) return 'pick_another';
  return undefined;
}

export function patternMissWords(miss: LetterBuildMiss | undefined, item: LetterBuildItem, word = ''): string | undefined {
  if (!isPatternId(item.pattern)) return undefined;
  const p = PATTERNS[item.pattern];
  switch (miss) {
    case 'other_spelling': {
      const found = p.others.find(([test]) => test.test(word.toLowerCase()))?.[1];
      return `Your word uses ${found ?? 'a different spelling'}, not ${p.shown}. This ask wants ${p.shown}.`;
    }
    case 'wrong_place': return `The letters ${p.shown} are not in the right place. Put ${p.place}.`;
    case 'no_pattern': return `Your word does not have ${p.shown}. Look at the ask again.`;
    case 'not_the_sound': return `In that word, ${p.shown.replace('_', '')} does not make the ${p.sound}. Say it out loud and listen.`;
    default: return undefined;
  }
}

export const patternCard = (item: LetterBuildItem) => (isPatternId(item.pattern) ? PATTERNS[item.pattern].card : '');

/** A solved example on another pattern with another sound: it shows how a pattern sits in a word, and passes nothing here. */
export function patternModel(item: LetterBuildItem): string | null {
  if (!isPatternId(item.pattern)) return null;
  const sound = PATTERNS[item.pattern].sound;
  for (const [id, p] of Object.entries(PATTERNS) as [PatternId, SpellingPattern][]) {
    if (p.sound === sound || id === item.pattern) continue;
    const w = p.words.find(x => patternMiss(item, x) !== undefined && !item.examples.includes(x) && makesTheSound(id, x));
    if (w) return `${p.shown}: ${w}`;
  }
  return null;
}

// ── Code-owned asks ──────────────────────────────────────────────────────────

const shuffle = <T,>(xs: readonly T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const VOWELS = 'aeiou';

/**
 * Which patterns an objective names, most specific first: spellings it names (ai, a_e, kn), else the sounds it names
 * (long a), else the families it names (vowel teams, silent e, r-controlled, silent letters). Empty: none named.
 */
export function patternsNamed(text: string): PatternId[] {
  const t = ` ${text.toLowerCase()} `;
  const hits = new Set<PatternId>();
  const add = (...ids: PatternId[]) => ids.forEach(id => hits.add(id));
  const tier = (): PatternId[] | null => (hits.size ? Array.from(hits) : null);
  for (const id of Object.keys(PATTERNS) as PatternId[]) {
    const g = id.replace('_', '[_-]');
    if (new RegExp(`[^a-z]${g}[^a-z]`).test(t) && !['ar', 'or', 'ay', 'ai'].includes(id)) add(id);
  }
  // Two-letter graphemes collide with words ("or", "ai"); count them only in a spelling phrase, or in a comma list
  // beside another named spelling ("ar, or, ir and ur").
  const listed = hits.size > 0;
  for (const id of ['ar', 'or', 'ay', 'ai'] as PatternId[]) {
    if (listed && new RegExp(`,\\s*${id}[^a-z]|[^a-z]${id}\\s*,`).test(t)) add(id);
    if (new RegExp(`(spelled|spelling|pattern|team)\\s+['"-]?${id}['"]?[^a-z]|['"-]${id}['"]?[^a-z]|\\b${id}\\s+(words?|pattern|team|spelling)`).test(t)) add(id);
  }
  const spellings = tier();
  if (spellings) return spellings;
  if (/long a\b|long-a\b/.test(t)) add('ai', 'ay', 'a_e');
  if (/long e\b|long-e\b/.test(t)) add('ee', 'ea');
  if (/long i\b|long-i\b/.test(t)) add('i_e', 'igh');
  if (/long o\b|long-o\b/.test(t)) add('oa', 'o_e');
  const sounds = tier();
  if (sounds) return sounds;
  if (/silent e|magic e|cvce|vce\b|final e/.test(t)) add('a_e', 'i_e', 'o_e');
  if (/vowel team|vowel pair|digraph/.test(t)) add('ai', 'ay', 'ee', 'ea', 'oa', 'igh');
  if (/r-controlled|r controlled|bossy r/.test(t)) add('ar', 'or', 'er', 'ir', 'ur');
  if (/silent letter|silent k|silent w|silent b/.test(t)) {
    if (/silent k/.test(t)) add('kn');
    if (/silent w/.test(t)) add('wr');
    if (/silent b/.test(t)) add('mb');
    if (/silent letter/.test(t)) add('kn', 'wr', 'mb');
  }
  return Array.from(hits);
}

/** The classic pattern type's patterns, for a lesson that names none. */
const BY_TYPE: Record<string, PatternId[]> = {
  'long-vowel': ['a_e', 'ai', 'ee', 'oa', 'i_e', 'igh'],
  'r-controlled': ['ar', 'or', 'ir', 'ur'],
  'silent-letter': ['kn', 'wr', 'mb'],
};
const BY_GRADE: Record<string, PatternId[]> = {
  '1': ['a_e', 'i_e', 'o_e', 'ee'],
  '2': ['ai', 'ay', 'ee', 'ea', 'oa', 'igh'],
  '3': ['ar', 'or', 'ir', 'ur', 'kn', 'wr'],
};

/** The same sound's other spellings, to fill a session whose objective names one pattern. */
const sameSound = (id: PatternId) => (Object.keys(PATTERNS) as PatternId[])
  .filter(x => x !== id && PATTERNS[x].sound === PATTERNS[id].sound);

/** The session's patterns in ask order. One named spelling opens the session and its same-sound spellings follow. */
export function sessionPatterns(named: readonly PatternId[], grade: string, patternType?: string): PatternId[] {
  if (named.length >= 2) return shuffle(named);
  if (named.length === 1) return [named[0], ...shuffle(sameSound(named[0]))];
  if (patternType && BY_TYPE[patternType]) return shuffle(BY_TYPE[patternType]);
  return shuffle(BY_GRADE[grade] ?? BY_GRADE[Number(grade) > 3 ? '3' : '1']);
}

/**
 * One item: 3-5 seed words that share letters (a small bank), the letters of the same sound's other spellings (so
 * `other_spelling` is a real choice), and one foil consonant. Every bank letter is unlimited.
 */
export function makePatternItem(pattern: PatternId, id: string): LetterBuildItem | null {
  const p = PATTERNS[pattern];
  // A seed word the ask itself prints ("make" in "Make a real word...") would be an answer on screen.
  const fits = p.words.filter(w => w.length < MAX_PATTERN_BOXES && !new RegExp(`\\b${w}\\b`).test(p.ask.toLowerCase()) && !patternMiss({ id, kind: 'pattern', pattern, ask: p.ask, bank: [], examples: [], ways: 1 }, w));
  if (fits.length < 3) return null;
  const picks: string[] = [shuffle(fits)[0]];
  const letters = new Set(picks[0].split(''));
  const added = (w: string) => w.split('').filter(l => !letters.has(l)).length;
  while (picks.length < 5) {
    const next = shuffle(fits.filter(w => !picks.includes(w))).sort((a, b) => added(a) - added(b))[0];
    if (!next || (picks.length >= 3 && letters.size + added(next) > 9)) break;
    picks.push(next); next.split('').forEach(l => letters.add(l));
  }
  if (picks.length < 3) return null;
  const otherLetters = p.others.flatMap(([, name]) => name.replace(' alone', '').replace('_', '').split(''));
  const foil = shuffle('bdfgklmnprst'.split('').filter(l => !letters.has(l) && !otherLetters.includes(l)))[0];
  const bank = Array.from(new Set([...Array.from(letters), ...otherLetters, ...(foil ? [foil] : [])]))
    .sort((a, b) => Number(VOWELS.includes(b)) - Number(VOWELS.includes(a)) || a.localeCompare(b));
  return { id, kind: 'pattern', pattern, ask: p.ask, bank, examples: picks, ways: 1 };
}

/** A session of `count` asks, cycling the patterns in order; adjacent items never share a pattern when there are two. */
export function makePatternItems(patterns: readonly PatternId[], count = 4): LetterBuildItem[] {
  const order = [...patterns];
  const out: LetterBuildItem[] = [];
  for (let n = 0; out.length < count && n < count * 4; n++) {
    const item = makePatternItem(order[n % order.length], `p${out.length + 1}`);
    if (item) out.push(item);
  }
  return out;
}
