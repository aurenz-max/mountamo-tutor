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
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
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

/** The model lever of an item's mode, if one passes. */
function modelLever(item: SpokenPracticeItem, items: readonly SpokenPracticeItem[], spares: readonly SpokenPracticeItem[]): string | null {
  switch (item.mode) {
    case 'count_and_say': return countModelFor(item, items) ? MODEL_COUNT : null;
    case 'compare_choice': return wordModelFor(item, items) ? WORD_MODEL : null;
    case 'read_aloud': return readModelFor(item, items) ? MODEL_READ : null;
    case 'say_answer': return answerModelFor(item, items, spares) ? MODEL_ANSWER : null;
    case 'explain_concept': return answerModelFor(item, items, spares) ? MODEL_EXPLAIN : null;
    default: return null;
  }
}

export const startingLevers = (item: SpokenPracticeItem, items: readonly SpokenPracticeItem[], spares: readonly SpokenPracticeItem[]): string[] => {
  const model = modelLever(item, items, spares);
  return (item.supportTier ?? 'easy') === 'easy' && model ? [model] : [];
};

export const MODE_MISSES: Readonly<Record<string, readonly string[]>> = {
  count_and_say: ['skipped_a_number', ...OFF_BY],
  compare_choice: ['other_menu_word', 'said_same', 'said_thing_name'],
  read_aloud: ['misread', 'sounds_not_blended', 'letter_names', 'word_dropped'],
  say_answer: ['signature_error', 'said_stimulus'],
  explain_concept: ['read_back', 'named_only', 'bare_number', 'opposite_idea'],
};

export function spokenLevers(item: SpokenPracticeItem | null, pulled: readonly string[], items: readonly SpokenPracticeItem[],
    spares: readonly SpokenPracticeItem[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers: [...answers], when, does });
  const practice = 'Opens an easier one of the same kind first. It is not graded; the full question comes back after it.';
  const misses = MODE_MISSES[item.mode] ?? [];
  const out: WorkspaceLever[] = [];
  const model = modelLever(item, items, spares);
  const say = 'Say it as your turn ("My turn: …"), then ask the learner\'s own question again. Never apply it to their question.';
  if (model === MODEL_COUNT) out.push(lever(MODEL_COUNT, 'help', 'both', misses, 'The learner gets the count wrong or does not know how to start.',
    `Shows a small card with a DIFFERENT group of pictures (onScreen says how many). Say only its total as your turn; never count it aloud. ${say}`));
  if (model === WORD_MODEL) out.push(lever(WORD_MODEL, 'help', 'both', misses, 'The learner says the wrong word, a picture\'s name, or does not know how to start.',
    'Shows a card with one model pair for EACH menu word (onScreen names them). Say every one as your turn, in order ("My turn: this train is longer…"); never only one, and never point at the learner\'s pictures. Then ask their question again.'));
  if (model === MODEL_READ) out.push(lever(MODEL_READ, 'help', 'both', misses, 'The learner misreads the print or does not know how to start.',
    `Shows a small card with a DIFFERENT word (onScreen gives it). Read it as your turn. Never read or sound out the learner's print. ${say}`));
  if (model === MODEL_ANSWER) out.push(lever(MODEL_ANSWER, 'help', 'both', misses, 'The learner gives a wrong answer or does not know how to start.',
    `Shows a small card with a DIFFERENT question of the same kind, solved (onScreen gives it). ${say}`));
  if (model === MODEL_EXPLAIN) out.push(lever(MODEL_EXPLAIN, 'help', 'both', misses, 'The learner reads the example back, only names it, or does not know how to start.',
    `Shows a small card with a DIFFERENT example and its idea in one sentence (onScreen gives it). ${say}`));
  if (item.mode === 'count_and_say') {
    out.push(lever(TOUCH_MARKS, 'help', 'shown', ['skipped_a_number', 'one_short', 'one_over'], 'The learner skips a picture or counts one twice.',
      'Lets the learner tap each picture as they count it; a tapped picture gets a ring. No numbers.'));
    if (item.stimulusCount > 5) out.push(lever(FIVE_ROWS, 'help', 'shown', ['short_by_more', 'over_by_more'], 'The learner loses track in a big group.',
      'Lays the same pictures out in rows of five. None added or taken away.'));
    if (smallerGroupFor(item, items)) out.push(lever(SMALLER_GROUP, 'simplify', 'both', ['skipped_a_number', ...OFF_BY], 'This many is too many to count yet.', practice));
  }
  if (item.mode === 'compare_choice' && farPairFor(item, items)) out.push(lever(FAR_PAIR, 'simplify', 'both', ['other_menu_word', 'said_same'],
    'These two are too close to tell apart yet.', practice));
  if (item.mode === 'read_aloud') {
    out.push(lever(SOUND_DOTS, 'help', 'shown', ['sounds_not_blended', 'letter_names', 'misread'], 'The learner sounds it out without blending, or misreads.',
      'Puts a dot under each letter (or digit) of the print. Nothing is said or played.'));
    if (words(item.stimulusText).length > 1) out.push(lever(WORD_UNDERLINE, 'help', 'shown', ['word_dropped'], 'The learner drops a word.',
      'Draws a line under each printed word, left to right.'));
    if (shortWordFor(item, items)) out.push(lever(SHORT_WORD, 'simplify', 'shown', ['misread', 'sounds_not_blended'], 'This print is too long to read yet.',
      'Opens a shorter word first; the learner reads it, you do not. It is not graded; the full print comes back after it.'));
  }
  if (easierItemFor(item, items, spares)) out.push(lever(EASIER_ITEM, 'simplify', 'both', misses, 'This question is too hard yet.', practice));
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Gives the model; never this item's answer. */
export function spokenLeverFacts(item: SpokenPracticeItem | null, pulled: readonly string[], items: readonly SpokenPracticeItem[],
    spares: readonly SpokenPracticeItem[]): string {
  if (!item) return '';
  const count = pulled.includes(MODEL_COUNT) ? countModelFor(item, items) : null;
  const pairs = pulled.includes(WORD_MODEL) ? wordModelFor(item, items) : null;
  const read = pulled.includes(MODEL_READ) ? readModelFor(item, items) : null;
  const spare = pulled.includes(MODEL_ANSWER) || pulled.includes(MODEL_EXPLAIN) ? answerModelFor(item, items, spares) : null;
  return [
    count && `Beside the pictures, a model card shows a different group: ${count.count} ${count.noun}, answered ${numberWordFor(count.count)}. It is not this group.`,
    pairs && `Beside the pictures, a model card shows one pair for each menu word: ${pairs.map(p => `${p.a[0]} and ${p.b[0]}: "${p.word}" fits ${p.a[0]}`).join('; ')}. None is this pair.`,
    read && `Beside the print, a model card shows a different ${isNumeral(read) ? 'numeral' : 'word'}: "${read}". It is not this print.`,
    spare && (spare.mode === 'explain_concept'
      ? `Beside the example, a model card shows a different one, "${spare.stimulusText}", explained: "${spare.conceptStatement}". It is not this example.`
      : `Beside the question, a model card shows a different one, "${spare.ask}", answered "${spare.expectedAnswer}". It is not this question.`),
    pulled.includes(TOUCH_MARKS) && 'The learner can tap each picture; a tapped picture gets a ring.',
    pulled.includes(FIVE_ROWS) && 'The same pictures are laid out in rows of five.',
    pulled.includes(SOUND_DOTS) && 'A dot sits under each printed letter or digit.',
    pulled.includes(WORD_UNDERLINE) && 'A line sits under each printed word.',
  ].filter((s): s is string => !!s).join(' ');
}
