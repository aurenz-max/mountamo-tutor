/**
 * The in-item levers on di-spoken-practice (`/add-support-tiers`, DI family 9; table
 * qa/support-levers/di-spoken-practice-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `spokenPracticeSpokenMisses` names, the explain bench probes, and the catalog's `commonStruggles`.
 *
 * The pack is content-generic: code knows the structure of count_and_say, compare_choice and read_aloud, and builds
 * their levers; say_answer and explain_concept get only what the generator wrote at generation time (ruling R3:
 * spare items, and one marked easier), swapped in by code with no LLM call at runtime.
 *
 * count_and_say: `model_count` (a different picture in a count more than one away, its total said), `touch_marks`
 *   (tap a picture to ring it), `five_rows` (rows of five above five); simplify `smaller_group` (about half, at least 2).
 * compare_choice: `word_model` (R1: one model pair per menu word, fixed per menu, so the card points at no answer);
 *   simplify `far_pair` (a far-apart pair whose answer is the OTHER word; none when the answer is "same").
 * read_aloud: `model_read` (a different word or numeral, read), `sound_dots`, `word_underline` (2+ words); simplify
 *   `short_word` (a shorter decodable word or a one-digit numeral).
 * say_answer: `model_answer` (a spare item, solved); simplify `easier_item` (the spare marked easier).
 * explain_concept: `model_explain` (a spare with a DIFFERENT concept); simplify `easier_item`. Neither when every spare
 *   has the item's concept (a named-concept session): the model's sentence would be the answer.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { diSpokenPracticeCard } from './diSpokenPractice.card';
import { PRACTICE_WORDS } from '../literacy/cvcSpellerLevers';
import { numberWordFor, type SpokenPracticeItem } from './diSpokenPracticeScript';

export const MODEL_COUNT = 'model_count';
export const TOUCH_MARKS = 'touch_marks';
export const FIVE_ROWS = 'five_rows';
export const SMALLER_GROUP = 'smaller_group';
export const WORD_MODEL = 'word_model';
export const FAR_PAIR = 'far_pair';
export const MODEL_READ = 'model_read';
export const SOUND_DOTS = 'sound_dots';
export const WORD_UNDERLINE = 'word_underline';
export const SHORT_WORD = 'short_word';
export const MODEL_ANSWER = 'model_answer';
export const MODEL_EXPLAIN = 'model_explain';
export const EASIER_ITEM = 'easier_item';

const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const low = (s: string) => s.trim().toLowerCase();
const words = (s: string) => low(s).split(/[^a-z0-9']+/).filter(Boolean);
const coming = (item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]) => {
  const at = items.findIndex(i => i.id === item.id);
  return at < 0 ? [] : items.slice(at + 1);
};

// ── count_and_say ───────────────────────────────────────────────────────────

const MODEL_PICTURES: ReadonlyArray<readonly [string, string]> = [['🍎', 'apples'], ['⭐', 'stars'], ['🐟', 'fish'], ['🎈', 'balloons'],
  ['🐞', 'ladybugs'], ['🌸', 'flowers'], ['🚗', 'cars'], ['🦆', 'ducks']];

export interface CountModel { emoji: string; noun: string; count: number }

/** A different picture, in a count more than one from the item's and from any count still to come. */
export function countModelFor(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]): CountModel | null {
  if (item.mode !== 'count_and_say') return null;
  const n = item.stimulusCount, later = new Set(coming(item, items).map(i => i.stimulusCount));
  const used = new Set(items.map(i => i.stimulusEmoji));
  const picture = MODEL_PICTURES.find(([e, noun]) => !used.has(e) && !items.some(i => low(i.stimulusText) === noun));
  const count = [2, 3, 4, 5, 6, 7, 8, 9, 10].filter(c => Math.abs(c - n) > 1 && !later.has(c))
    .sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b)[0];
  return picture && count ? { emoji: picture[0], noun: picture[1], count } : null;
}

/** About half as many of the same picture, at least 2, never the item's count, preferring no other session count. */
export function smallerGroupFor(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]): SpokenPracticeItem | null {
  if (item.mode !== 'count_and_say' || item.stimulusCount < 4) return null;
  const others = new Set(items.map(i => i.stimulusCount));
  const half = Math.max(2, Math.floor(item.stimulusCount / 2));
  const k = [half, half - 1, half + 1].find(c => c >= 2 && c < item.stimulusCount && !others.has(c)) ?? half;
  const noun = item.stimulusText;
  return { ...item, id: `${item.id}~simpler`, stimulusCount: k, expectedAnswer: numberWordFor(k), alternates: [String(k)],
    ask: `Count the ${noun} out loud. How many ${noun} are there?` };
}

// ── compare_choice ──────────────────────────────────────────────────────────

/** Things ordered by the dimension, most first; "a is <first word> than b" when a comes first. */
const DIMENSIONS: ReadonlyArray<{ words: readonly [string, string]; things: ReadonlyArray<readonly [string, string]> }> = [
  { words: ['longer', 'shorter'], things: [['a train', '🚆'], ['a bus', '🚌'], ['a crocodile', '🐊'], ['a snake', '🐍'], ['a broom', '🧹'],
    ['a pencil', '✏️'], ['a key', '🔑'], ['an ant', '🐜']] },
  { words: ['taller', 'shorter'], things: [['a giraffe', '🦒'], ['a tree', '🌳'], ['a house', '🏠'], ['a horse', '🐎'], ['a dog', '🐕'],
    ['a cat', '🐈'], ['a mouse', '🐁'], ['an ant', '🐜']] },
  { words: ['bigger', 'smaller'], things: [['a whale', '🐋'], ['an elephant', '🐘'], ['a horse', '🐎'], ['a dog', '🐕'], ['a cat', '🐈'],
    ['a frog', '🐸'], ['a bee', '🐝'], ['an ant', '🐜']] },
  { words: ['heavier', 'lighter'], things: [['an elephant', '🐘'], ['a car', '🚗'], ['a horse', '🐎'], ['a dog', '🐕'], ['an apple', '🍎'],
    ['a pencil', '✏️'], ['a leaf', '🍃'], ['a feather', '🪶']] },
  { words: ['faster', 'slower'], things: [['a rocket', '🚀'], ['a plane', '✈️'], ['a car', '🚗'], ['a horse', '🐎'], ['a bike', '🚲'],
    ['a dog', '🐕'], ['a turtle', '🐢'], ['a snail', '🐌']] },
  { words: ['hotter', 'colder'], things: [['a fire', '🔥'], ['a candle', '🕯️'], ['a cup of cocoa', '☕'], ['a bath', '🛁'], ['a glass of milk', '🥛'],
    ['a snowman', '⛄'], ['an ice cube', '🧊']] },
];
const SAME = /^(the )?same$|^equal$/i;

const dimensionOf = (item: SpokenPracticeItem) => {
  const menu = (item.choices ?? []).map(low).filter(c => !SAME.test(c));
  return DIMENSIONS.find(d => menu.length === 2 && d.words.every(w => menu.includes(w))) ?? null;
};
const ARTICLES = new Set(['a', 'an', 'the']);
const nouns = (s: string) => words(s).filter(w => !ARTICLES.has(w));
const sessionThings = (items: readonly SpokenPracticeItem[]) =>
  new Set(items.flatMap(i => [i.stimulusText, i.stimulusText2 ?? ''].flatMap(nouns)));
const usable = (thing: string, items: readonly SpokenPracticeItem[]) => !nouns(thing).some(w => sessionThings(items).has(w));

export interface PairModel { word: string; a: readonly [string, string]; b: readonly [string, string] }

/** R1: one model pair per menu word, in the menu's order, from the dimension's table. Null when the menu is not in it. */
export function wordModelFor(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]): PairModel[] | null {
  const dim = dimensionOf(item);
  if (!dim) return null;
  const free = dim.things.filter(([t]) => usable(t, items));
  if (free.length < 2) return null;
  const [hi, lo] = [free[0], free[free.length - 1]];
  return (item.choices ?? []).map(word => SAME.test(word.trim())
    ? { word, a: hi, b: hi }
    : low(word) === dim.words[0] ? { word, a: hi, b: lo } : { word, a: lo, b: hi });
}

/** A far pair whose answer is the OTHER menu word; never for an answer of "same". */
export function farPairFor(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]): SpokenPracticeItem | null {
  const dim = dimensionOf(item);
  if (!dim || SAME.test(item.expectedAnswer.trim())) return null;
  const free = dim.things.filter(([t]) => usable(t, items));
  if (free.length < 2) return null;
  const other = low(item.expectedAnswer) === dim.words[0] ? dim.words[1] : dim.words[0];
  const [first, last] = [free[0], free[free.length - 1]];
  // "a" is the thing the question asks about; it is `other` than "b".
  const [a, b] = other === dim.words[0] ? [first, last] : [last, first];
  const menu = item.choices ?? [];
  const ask = `Here is ${a[0]}, and here is ${b[0]}. Is ${a[0].replace(/^(a|an) /, 'the ')} ${menu.slice(0, -1).join(', ')} or ${menu[menu.length - 1]}?`;
  return { ...item, id: `${item.id}~simpler`, stimulusText: a[0], stimulusEmoji: a[1], stimulusText2: b[0], stimulusEmoji2: b[1],
    expectedAnswer: menu.find(c => low(c) === other) ?? other, alternates: [], acceptRule: '', signatureError: '', ask };
}

// ── read_aloud ──────────────────────────────────────────────────────────────

const isNumeral = (t: string) => /^\d+$/.test(t.trim());
const sharesLetter = (a: string, b: string) => a.split('').some(ch => /[a-z0-9]/.test(ch) && b.includes(ch));

/** A different word (sharing no letter with the item's print) or numeral (sharing no digit), never a session word. */
export function readModelFor(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]): string | null {
  if (item.mode !== 'read_aloud') return null;
  const printed = low(item.stimulusText), session = new Set(items.flatMap(i => words(i.stimulusText)));
  if (isNumeral(printed)) {
    return Array.from({ length: 20 }, (_, i) => String(i + 1))
      .find(n => !sharesLetter(n, printed) && !session.has(n)) ?? null;
  }
  return PRACTICE_WORDS.map(p => p.word).find(w => !sharesLetter(w, printed) && !session.has(w)) ?? null;
}

/** A shorter decodable word or a one-digit numeral; refused when the item is already one CVC word or one digit. */
export function shortWordFor(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]): SpokenPracticeItem | null {
  if (item.mode !== 'read_aloud') return null;
  const printed = low(item.stimulusText), session = new Set(items.flatMap(i => words(i.stimulusText)));
  const model = readModelFor(item, items);
  let text: string | undefined;
  if (isNumeral(printed)) {
    if (printed.length < 2) return null;
    text = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].find(n => !printed.includes(n) && !session.has(n) && n !== model);
  } else {
    if (words(printed).length === 1 && printed.length <= 3) return null;
    text = PRACTICE_WORDS.map(p => p.word).find(w => !sharesLetter(w, printed) && !session.has(w) && w !== model);
  }
  if (!text) return null;
  const spoken = isNumeral(text) ? numberWordFor(Number(text)) : text;
  return { ...item, id: `${item.id}~simpler`, stimulusText: text, expectedAnswer: spoken, alternates: isNumeral(text) ? [text] : [],
    acceptRule: '', signatureError: '' };
}

// ── say_answer and explain_concept: the generator's spares (R3) ─────────────

const answersOf = (i: SpokenPracticeItem) => [i.expectedAnswer, ...i.alternates].map(low).filter(Boolean);

/** A spare leaks when it shares an answer or a stimulus with the session, says the item's answer anywhere, or (explain)
 *  has the item's concept or one of its anchors. Checked at generation and again at mount. */
export function spareLeaks(spare: SpokenPracticeItem, item: SpokenPracticeItem, items: readonly SpokenPracticeItem[]): boolean {
  const theirs = new Set(items.flatMap(answersOf));
  if (answersOf(spare).some(a => theirs.has(a))) return true;
  if (items.some(i => low(i.stimulusText) === low(spare.stimulusText))) return true;
  const said = low([spare.stimulusText, spare.ask, spare.expectedAnswer, spare.conceptStatement ?? ''].join(' '));
  if (answersOf(item).some(a => a.length > 1 && new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(said))) return true;
  if (item.mode === 'explain_concept') {
    if (low(spare.conceptStatement ?? '') === low(item.conceptStatement ?? '')) return true;
    if (answersOf(spare).some(a => answersOf(item).some(b => a.includes(b) || b.includes(a)))) return true;
  }
  return false;
}

const spareFor = (item: SpokenPracticeItem, items: readonly SpokenPracticeItem[], spares: readonly SpokenPracticeItem[], easier: boolean) =>
  spares.find(s => s.mode === item.mode && !!s.easier === easier && !spareLeaks(s, item, items)) ?? null;

export const answerModelFor = (item: SpokenPracticeItem, items: readonly SpokenPracticeItem[], spares: readonly SpokenPracticeItem[]) =>
  item.mode === 'say_answer' || item.mode === 'explain_concept' ? spareFor(item, items, spares, false) : null;

export function easierItemFor(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[], spares: readonly SpokenPracticeItem[]): SpokenPracticeItem | null {
  if (item.mode !== 'say_answer' && item.mode !== 'explain_concept') return null;
  const spare = spareFor(item, items, spares, true);
  return spare ? { ...spare, id: `${item.id}~simpler`, supportTier: item.supportTier } : null;
}

// ── declarations ────────────────────────────────────────────────────────────

/** What the levers read beyond the item: the session's items and the generator's spares (R3). */
export interface SpokenLeverContext { items: readonly SpokenPracticeItem[]; spares: readonly SpokenPracticeItem[] }

const SAY = 'Say it as your turn ("My turn: …"), then ask the learner\'s own question again. Never apply it to their question.';
const PRACTICE = 'Opens an easier one of the same kind first. It is not graded; the full question comes back after it.';

/** Every lever of the pack, by type, in the order the tutor sees them. */
export const SPOKEN_LEVERS = leverSet<SpokenPracticeItem, SpokenLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => diSpokenPracticeCard.modes[mode]?.misses ?? [],
  specs: [
    { id: MODEL_COUNT, type: 'model', modes: ['count_and_say'], answers: 'all',
      when: 'The learner gets the count wrong or does not know how to start.',
      does: `Shows a small card with a DIFFERENT group of pictures (onScreen says how many). Say only its total as your turn; never count it aloud. ${SAY}`,
      content: (item, { items }) => countModelFor(item, items),
      fact: (count: CountModel) => `Beside the pictures, a model card shows a different group: ${count.count} ${count.noun}, answered ${numberWordFor(count.count)}. It is not this group.` },
    { id: WORD_MODEL, type: 'model', modes: ['compare_choice'], answers: 'all',
      when: 'The learner says the wrong word, a picture\'s name, or does not know how to start.',
      does: 'Shows a card with one model pair for EACH menu word (onScreen names them). Say every one as your turn, in order ("My turn: this train is longer…"); never only one, and never point at the learner\'s pictures. Then ask their question again.',
      content: (item, { items }) => wordModelFor(item, items),
      fact: (pairs: PairModel[]) => `Beside the pictures, a model card shows one pair for each menu word: ${pairs.map(p => `${p.a[0]} and ${p.b[0]}: "${p.word}" fits ${p.a[0]}`).join('; ')}. None is this pair.` },
    { id: MODEL_READ, type: 'model', modes: ['read_aloud'], answers: 'all',
      when: 'The learner misreads the print or does not know how to start.',
      does: `Shows a small card with a DIFFERENT word (onScreen gives it). Read it as your turn. Never read or sound out the learner's print. ${SAY}`,
      content: (item, { items }) => readModelFor(item, items),
      fact: (read: string) => `Beside the print, a model card shows a different ${isNumeral(read) ? 'numeral' : 'word'}: "${read}". It is not this print.` },
    { id: MODEL_ANSWER, type: 'model', modes: ['say_answer'], answers: 'all',
      when: 'The learner gives a wrong answer or does not know how to start.',
      does: `Shows a small card with a DIFFERENT question of the same kind, solved (onScreen gives it). ${SAY}`,
      content: (item, { items, spares }) => answerModelFor(item, items, spares),
      fact: (spare: SpokenPracticeItem) => `Beside the question, a model card shows a different one, "${spare.ask}", answered "${spare.expectedAnswer}". It is not this question.` },
    { id: MODEL_EXPLAIN, type: 'model', modes: ['explain_concept'], answers: 'all',
      when: 'The learner reads the example back, only names it, or does not know how to start.',
      does: `Shows a small card with a DIFFERENT example and its idea in one sentence (onScreen gives it). ${SAY}`,
      content: (item, { items, spares }) => answerModelFor(item, items, spares),
      fact: (spare: SpokenPracticeItem) => `Beside the example, a model card shows a different one, "${spare.stimulusText}", explained: "${spare.conceptStatement}". It is not this example.` },
    { id: TOUCH_MARKS, type: 'marks', modes: ['count_and_say'], answers: ['skipped_a_number', 'one_short', 'one_over'],
      when: 'The learner skips a picture or counts one twice.',
      does: 'Lets the learner tap each picture as they count it; a tapped picture gets a ring. No numbers.',
      fact: 'The learner can tap each picture; a tapped picture gets a ring.' },
    { id: FIVE_ROWS, type: 'layout', modes: ['count_and_say'], answers: ['short_by_more', 'over_by_more'],
      when: 'The learner loses track in a big group.', does: 'Lays the same pictures out in rows of five. None added or taken away.',
      offer: item => item.stimulusCount > 5, fact: 'The same pictures are laid out in rows of five.' },
    { id: SMALLER_GROUP, type: 'easier', modes: ['count_and_say'], answers: ['skipped_a_number', ...OFF_BY],
      when: 'This many is too many to count yet.', does: PRACTICE, content: (item, { items }) => smallerGroupFor(item, items) },
    { id: FAR_PAIR, type: 'easier', modes: ['compare_choice'], answers: ['other_menu_word', 'said_same'],
      when: 'These two are too close to tell apart yet.', does: PRACTICE, content: (item, { items }) => farPairFor(item, items) },
    { id: SOUND_DOTS, type: 'marks', modes: ['read_aloud'], answers: ['sounds_not_blended', 'letter_names', 'misread'],
      when: 'The learner sounds it out without blending, or misreads.',
      does: 'Puts a dot under each letter (or digit) of the print. Nothing is said or played.',
      fact: 'A dot sits under each printed letter or digit.' },
    { id: WORD_UNDERLINE, type: 'marks', modes: ['read_aloud'], answers: ['word_dropped'],
      when: 'The learner drops a word.', does: 'Draws a line under each printed word, left to right.',
      offer: item => words(item.stimulusText).length > 1, fact: 'A line sits under each printed word.' },
    { id: SHORT_WORD, type: 'easier', modes: ['read_aloud'], carrier: 'shown', answers: ['misread', 'sounds_not_blended'],
      when: 'This print is too long to read yet.',
      does: 'Opens a shorter word first; the learner reads it, you do not. It is not graded; the full print comes back after it.',
      content: (item, { items }) => shortWordFor(item, items) },
    { id: EASIER_ITEM, type: 'easier', modes: ['say_answer', 'explain_concept'], answers: 'all',
      when: 'This question is too hard yet.', does: PRACTICE,
      content: (item, { items, spares }) => easierItemFor(item, items, spares) },
  ],
});
