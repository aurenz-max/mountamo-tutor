/**
 * The in-item levers on word-builder (`/add-support-tiers`, table `qa/support-levers/word-builder-lever-table-2026-10-03.md`,
 * lever plan 2026-10-03 step 1). The learner hears what a word means and says the whole word, built from the board of
 * parts. The parts in order ARE the word, so no lever marks, links or dims a part of the learner's word.
 *
 * - `part_slots` (help, shown): an empty frame under the clue, one box per part labelled only with its type (prefix,
 *   root, suffix), joined by "+" into one word box. Leak rule (`slotFrame`): types in order, nothing else.
 * - `model_word` (help, both): a solved card for a DIFFERENT word of the same shape and tier (clue, parts with
 *   meanings, the joined word). Leak rule (`modelLeak`): no session word, inside or around one, and no part text that
 *   is a part of any session item.
 * - `small_board_word` (simplify, both): an ungraded practice word of the same tier and shape (greek_latin: a 3-part
 *   item gets a 2-part word) on a practice board of its own parts plus one foil per slot type; then the full item
 *   returns. Leak rule (`practiceLeak`): as the model, plus never the model word and no foil that makes a pool word.
 *
 * Pools are hand-written (ruling R2): each word's parts spell it exactly and pass the same build gates
 * (`itemFromTarget`) a generated word does.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemFromTarget, type MorphemeType, type WordBuilderComplexity, type WordBuilderItem, type WordPartLike }
  from './wordBuilderScript';
import type { SpokenWordBuilderMiss } from './wordBuilderWorkspace';

export const SLOTS_LEVER = 'part_slots';
export const MODEL_LEVER = 'model_word';
export const SMALL_BOARD_LEVER = 'small_board_word';

type Tier = 'everyday' | 'academic' | 'greek';
type Part = [text: string, type: MorphemeType, meaning: string];
export interface PoolWord { word: string; clue: string; parts: Part[] }
const w = (word: string, clue: string, ...parts: Part[]): PoolWord => ({ word, clue, parts });
const P = (text: string, meaning: string): Part => [text, 'prefix', meaning];
const R = (text: string, meaning: string): Part => [text, 'root', meaning];
const S = (text: string, meaning: string): Part => [text, 'suffix', meaning];

/** Hand-written pools by tier. Shape = part types in order. */
export const POOL: Record<Tier, PoolWord[]> = {
  everyday: [
    w('unsafe', 'not free from harm', P('un', 'not'), R('safe', 'free from harm')),
    w('reread', 'to look at the words of a book again', P('re', 'again'), R('read', 'look at words')),
    w('preheat', 'to make an oven hot before cooking', P('pre', 'before'), R('heat', 'make hot')),
    w('unlock', 'to open something that was closed with a key', P('un', 'opposite of'), R('lock', 'close with a key')),
    w('dislike', 'to not enjoy something', P('dis', 'not'), R('like', 'enjoy')),
    w('misspell', 'to write the letters of a word wrongly', P('mis', 'wrongly'), R('spell', 'write the letters')),
    w('refill', 'to make a cup full again', P('re', 'again'), R('fill', 'make full')),
    w('prepay', 'to give money before you get something', P('pre', 'before'), R('pay', 'give money')),
    w('overeat', 'to take in too much food', P('over', 'too much'), R('eat', 'take in food')),
    w('subway', 'a train path under the ground', P('sub', 'under'), R('way', 'path')),
    w('outrun', 'to move faster than someone else', P('out', 'more than'), R('run', 'move fast')),
    w('hopeful', 'full of wishes that things will go well', R('hope', 'wish'), S('ful', 'full of')),
    w('painless', 'without any hurt', R('pain', 'hurt'), S('less', 'without')),
    w('singer', 'a person who makes music with their voice', R('sing', 'make music with voice'), S('er', 'one who')),
    w('quickly', 'in a fast way', R('quick', 'fast'), S('ly', 'in a way')),
    w('careful', 'paying close attention so nothing goes wrong', R('care', 'attention'), S('ful', 'full of')),
    w('fearless', 'not afraid of anything', R('fear', 'being afraid'), S('less', 'without')),
    w('softly', 'in a gentle, quiet way', R('soft', 'gentle'), S('ly', 'in a way')),
    w('endless', 'going on and on and never stopping', R('end', 'stop'), S('less', 'without')),
    w('farmer', 'a person who grows crops and raises animals', R('farm', 'land for crops'), S('er', 'one who')),
    w('cheerful', 'happy and bright', R('cheer', 'gladness'), S('ful', 'full of')),
    w('brightness', 'how much light something gives off', R('bright', 'full of light'), S('ness', 'state of being')),
    w('unbreakable', 'not able to be snapped apart', P('un', 'not'), R('break', 'snap apart'), S('able', 'able to be')),
    w('disrespectful', 'rude, not showing care for others', P('dis', 'not'), R('respect', 'care for others'), S('ful', 'full of')),
    w('overcooked', 'heated for too long, so the food burned', P('over', 'too much'), R('cook', 'heat food'), S('ed', 'already done')),
    w('unfriendly', 'not acting like a pal', P('un', 'not'), R('friend', 'pal'), S('ly', 'like a')),
    w('mistrustful', 'full of doubt and slow to believe people', P('mis', 'badly'), R('trust', 'believe in'), S('ful', 'full of')),
    w('replacement', 'a new thing put in the spot of one that broke', P('re', 'again'), R('place', 'put'), S('ment', 'thing that is')),
    w('rethinking', 'using your mind on something a second time', P('re', 'again'), R('think', 'use your mind'), S('ing', 'doing now')),
    w('outnumbered', 'having fewer people than the other side', P('out', 'more than'), R('number', 'count'), S('ed', 'already done')),
    w('preschooler', 'a young child not yet old enough for kindergarten', P('pre', 'before'), R('school', 'place to learn'), S('er', 'one who')),
    w('uncomfortable', 'not feeling at ease', P('un', 'not'), R('comfort', 'ease'), S('able', 'able to be')),
    w('hopefulness', 'the feeling that things will go well', R('hope', 'wish'), S('ful', 'full of'), S('ness', 'state of being')),
    w('carelessness', 'not paying attention, so mistakes happen', R('care', 'attention'), S('less', 'without'), S('ness', 'state of being')),
    w('thankfulness', 'being glad for what others did for you', R('thank', 'say you are glad'), S('ful', 'full of'), S('ness', 'state of being')),
  ],
  academic: [
    w('inspection', 'a careful look into something to check it', P('in', 'into'), R('spect', 'look'), S('ion', 'act of')),
    w('construction', 'the act of putting up a building', P('con', 'together'), R('struct', 'build'), S('ion', 'act of')),
    w('projection', 'an image thrown forward onto a screen', P('pro', 'forward'), R('ject', 'throw'), S('ion', 'act of')),
    w('contradiction', 'saying the opposite of what was said', P('contra', 'against'), R('dict', 'say'), S('ion', 'act of')),
    w('exportable', 'able to be shipped out to other countries', P('ex', 'out'), R('port', 'carry'), S('able', 'able to be')),
    w('injection', 'medicine pushed into the body with a needle', P('in', 'into'), R('ject', 'throw'), S('ion', 'act of')),
    w('subtraction', 'taking one number away from another', P('sub', 'away'), R('tract', 'pull'), S('ion', 'act of')),
    w('reflection', 'an image of you bounced back from a mirror', P('re', 'back'), R('flect', 'bend'), S('ion', 'act of')),
    w('attraction', 'a pull toward something', P('at', 'toward'), R('tract', 'pull'), S('ion', 'act of')),
    w('conductor', 'a person who leads an orchestra', P('con', 'together'), R('duct', 'lead'), S('or', 'one who')),
    w('inspector', 'a person whose job is to check things carefully', P('in', 'into'), R('spect', 'look'), S('or', 'one who')),
    w('transmission', 'sending a signal across a distance', P('trans', 'across'), R('miss', 'send'), S('ion', 'act of')),
    w('disruptive', 'tending to break up a quiet class with noise', P('dis', 'apart'), R('rupt', 'break'), S('ive', 'tending to')),
    w('retractable', 'able to be pulled back in, like a cat claw', P('re', 'back'), R('tract', 'pull'), S('able', 'able to be')),
    w('reversal', 'a change that turns things back the other way', P('re', 'back'), R('vers', 'turn'), S('al', 'act of')),
    w('detector', 'a machine that finds hidden metal or smoke', P('de', 'off'), R('tect', 'cover'), S('or', 'thing that')),
    w('protector', 'someone who keeps others safe from harm', P('pro', 'in front'), R('tect', 'cover'), S('or', 'one who')),
    w('exclusive', 'only for a few, keeping everyone else out', P('ex', 'out'), R('clus', 'shut'), S('ive', 'tending to')),
    w('expressive', 'showing feelings clearly', P('ex', 'out'), R('press', 'push'), S('ive', 'tending to')),
    w('procedure', 'the steps you follow to get a job done', P('pro', 'forward'), R('ced', 'go'), S('ure', 'act of')),
    w('disposal', 'getting rid of something you do not need', P('dis', 'away'), R('pos', 'put'), S('al', 'act of')),
    w('projector', 'a machine that shows pictures on a screen', P('pro', 'forward'), R('ject', 'throw'), S('or', 'thing that')),
  ],
  greek: [
    w('telephone', 'a device that carries a voice far away', P('tele', 'far'), R('phone', 'sound')),
    w('microscope', 'a tool for seeing very tiny things', P('micro', 'small'), R('scope', 'look at')),
    w('photograph', 'a picture made by a camera', P('photo', 'light'), R('graph', 'write')),
    w('telegraph', 'an old machine that sent written messages over wires', P('tele', 'far'), R('graph', 'write')),
    w('microphone', 'a device that picks up your voice to make it louder', P('micro', 'small'), R('phone', 'sound')),
    w('thermostat', 'a control that keeps a room at one temperature', P('thermo', 'heat'), R('stat', 'stay')),
    w('chronometer', 'a very exact clock used on ships', P('chrono', 'time'), R('meter', 'measure')),
    w('barometer', 'a tool that measures air pressure to predict weather', P('baro', 'weight'), R('meter', 'measure')),
    w('biology', 'the study of living things', P('bio', 'life'), R('logy', 'study of')),
    w('geology', 'the study of rocks and the ground', P('geo', 'earth'), R('logy', 'study of')),
    w('megaphone', 'a cone you shout into to make your voice loud', P('mega', 'large'), R('phone', 'sound')),
    w('periscope', 'a tube a submarine uses to look above the water', P('peri', 'around'), R('scope', 'look at')),
    w('biologist', 'a scientist who studies living things', P('bio', 'life'), R('log', 'study'), S('ist', 'one who')),
    w('geologist', 'a scientist who studies rocks', P('geo', 'earth'), R('log', 'study'), S('ist', 'one who')),
    w('photographic', 'having to do with taking pictures', P('photo', 'light'), R('graph', 'write'), S('ic', 'relating to')),
    w('microscopic', 'too tiny to see without a special tool', P('micro', 'small'), R('scop', 'look'), S('ic', 'relating to')),
    w('telescopic', 'able to stretch out long like a spyglass', P('tele', 'far'), R('scop', 'look'), S('ic', 'relating to')),
    w('biographer', 'a person who writes the story of a life', P('bio', 'life'), R('graph', 'write'), S('er', 'one who')),
    w('hydraulic', 'moved by water or oil pushed through pipes', P('hydr', 'water'), R('aul', 'pipe'), S('ic', 'relating to')),
    w('symphonic', 'having to do with music for a large orchestra', P('sym', 'together'), R('phon', 'sound'), S('ic', 'relating to')),
    w('telepathic', 'able to read minds from far away', P('tele', 'far'), R('path', 'feeling'), S('ic', 'relating to')),
  ],
};

const TIER_OF: Record<WordBuilderComplexity, Tier> = {
  simple_affix: 'everyday', compound_affix: 'everyday', multi_morpheme: 'academic', greek_latin: 'greek',
};
const low = (s: string) => s.trim().toLowerCase();
const shapeOf = (types: readonly MorphemeType[]) => types.join('+');
const poolShape = (p: PoolWord) => shapeOf(p.parts.map(x => x[1]));

// ── part_slots ───────────────────────────────────────────────────────────────

/** The empty frame: the item's part types in order, and nothing else (no text, meaning, letter or length). */
export const slotFrame = (item: WordBuilderItem): MorphemeType[] => item.parts.map(p => p.type);

// ── the leak rules ───────────────────────────────────────────────────────────

const sessionParts = (items: readonly WordBuilderItem[]) => new Set(items.flatMap(i => i.parts.map(p => low(p.text))));
const touchesSessionWord = (word: string, items: readonly WordBuilderItem[]) =>
  items.some(i => { const s = low(i.word), x = low(word); return s === x || s.includes(x) || x.includes(s); });

/** A model shares a word or a part with the session. */
export const modelLeak = (p: PoolWord, items: readonly WordBuilderItem[]): boolean => {
  const parts = sessionParts(items);
  return touchesSessionWord(p.word, items) || p.parts.some(([text]) => parts.has(low(text)));
};

/** Every word of every pool: a foil may not make one. */
const ALL_POOL_WORDS = new Set(Object.values(POOL).flat().map(p => p.word));

// ── model_word ───────────────────────────────────────────────────────────────

const candidates = (shape: string, tier: Tier, items: readonly WordBuilderItem[], board: readonly WordPartLike[]) => {
  const onBoard = new Set(board.map(b => low(b.text)));
  const fits = POOL[tier].filter(p => poolShape(p) === shape && !modelLeak(p, items));
  // Off-board parts first: a model that reuses a printed distractor teaches that card's use.
  return [...fits.filter(p => !p.parts.some(([t]) => onBoard.has(low(t)))), ...fits.filter(p => p.parts.some(([t]) => onBoard.has(low(t))))];
};

/** The model for `item`: a different word of its shape and tier, rotated by the item's place so items differ. */
export function modelFor(item: WordBuilderItem, items: readonly WordBuilderItem[], board: readonly WordPartLike[]): PoolWord | null {
  const list = candidates(shapeOf(slotFrame(item)), TIER_OF[item.complexity], items, board);
  if (!list.length) return null;
  return list[Math.max(0, items.findIndex(i => i.id === item.id)) % list.length];
}

// ── small_board_word ─────────────────────────────────────────────────────────

/** The practice shape: the item's, except a 3-part greek_latin item practises a 2-part word (still in the mode). */
const practiceShape = (item: WordBuilderItem) =>
  item.complexity === 'greek_latin' && item.parts.length === 3 ? 'prefix+root' : shapeOf(slotFrame(item));

export interface PracticeWord { item: WordBuilderItem; board: WordPartLike[] }

/** A practice word shares a word or part with the session, is the model word, or its board makes a pool word. */
export function practiceLeak(practice: PracticeWord, items: readonly WordBuilderItem[], model: PoolWord | null): boolean {
  const word = low(practice.item.word), parts = sessionParts(items);
  if (touchesSessionWord(word, items) || (model && low(model.word) === word)) return true;
  if (practice.board.some(b => parts.has(low(b.text)))) return true;
  if (practice.item.parts.map(p => low(p.text)).join('') !== word) return true;
  // A foil swapped into its slot must not make another pool word or a session word.
  return practice.item.parts.some((p, i) => practice.board.some(b => {
    if (b.type !== p.type || low(b.text) === low(p.text)) return false;
    const swapped = practice.item.parts.map((x, j) => (j === i ? b.text : x.text)).join('');
    return ALL_POOL_WORDS.has(low(swapped)) || touchesSessionWord(swapped, items);
  }));
}

const asParts = (p: PoolWord, tag: string): WordPartLike[] =>
  p.parts.map(([text, type, meaning]) => ({ id: `${tag}-${type}-${text}`, text, type, meaning }));

/** The practice word for `item` and its small board, or null when the pool has none that passes the leak rule. */
export function smallBoardWordFor(item: WordBuilderItem, items: readonly WordBuilderItem[], board: readonly WordPartLike[]): PracticeWord | null {
  const tier = TIER_OF[item.complexity], model = modelFor(item, items, board);
  const shape = practiceShape(item);
  const list = candidates(shape, tier, items, board).filter(p => p.word !== model?.word);
  const start = Math.max(0, items.findIndex(i => i.id === item.id));
  const used = sessionParts(items);
  for (let k = 0; k < list.length; k++) {
    const pick = list[(start + 1 + k) % list.length];
    const own = asParts(pick, 'practice');
    const foils: WordPartLike[] = [];
    for (const [, type] of pick.parts) {
      if (foils.some(f => f.type === type)) continue;
      const foil = POOL[tier].flatMap(p => asParts(p, 'foil')).find(f => f.type === type
        && !used.has(low(f.text)) && !own.some(o => low(o.text) === low(f.text)) && !foils.some(x => low(x.text) === low(f.text))
        && !pick.parts.some((q, i) => q[1] === type
          && ALL_POOL_WORDS.has(low(pick.parts.map((x, j) => (j === i ? f.text : x[0])).join('')))));
      if (foil) foils.push(foil);
    }
    const practiceBoard = [...own, ...foils];
    const built = itemFromTarget({ word: pick.word, parts: own.map(o => o.id), hint: pick.clue, definition: pick.clue },
      practiceBoard, item.complexity);
    if (!built) continue;
    const practice = { item: { ...built, id: `${item.id}~simpler` }, board: practiceBoard };
    if (!practiceLeak(practice, items, model)) return practice;
  }
  return null;
}

// ── the levers ───────────────────────────────────────────────────────────────

const ALL_MISSES: SpokenWordBuilderMiss[] = ['root_only', 'other_part_only', 'part_missing', 'parts_not_joined',
  'parts_out_of_order', 'swapped_part', 'meaning_word'];

/** What the pulled levers put on screen, for the tutor and the observer. Never the word or which parts make it. */
export function leversOnScreen(pulled: readonly string[], item: WordBuilderItem, items: readonly WordBuilderItem[],
  board: readonly WordPartLike[]): string | null {
  const model = pulled.includes(MODEL_LEVER) ? modelFor(item, items, board) : null;
  const parts = [
    pulled.includes(SLOTS_LEVER) && `an empty frame under the clue: ${item.parts.length} boxes labelled `
      + `${slotFrame(item).join(', ')}, joined by + into one word box. It shows how many parts and their kinds, not which parts`,
    model && `a model card with another word: "${model.clue}" is ${model.parts.map(p => `${p[0]} (${p[2]})`).join(' + ')}, `
      + `said "${model.word}". Say it as your turn on that word; it is not this word`,
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : null;
}

/** The levers on `item` with their pulled state. `starting` levers are on screen from the tier and are not offered. */
export function wordBuilderLevers(item: WordBuilderItem | null, items: readonly WordBuilderItem[], board: readonly WordPartLike[],
  pulled: readonly string[], starting: readonly string[] = []): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: SpokenWordBuilderMiss[],
    when: string, does: string) => {
    if (!starting.includes(id)) levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  };
  add(SLOTS_LEVER, 'help', 'shown', ALL_MISSES,
    'The learner says only some of the parts, says them apart, or says a word not built from the board.',
    'Draws an empty frame under the clue: one box per part, labelled only prefix, root or suffix, joined into one '
    + 'word box. It never shows a part, a meaning or a letter. Do not say which parts go in it.');
  if (modelFor(item, items, board)) add(MODEL_LEVER, 'help', 'both', ALL_MISSES,
    'The learner does not know how to start, or keeps saying only part of the word.',
    'Shows a solved card for a different word of the same shape: its clue, its parts with their meanings, and the '
    + 'joined word. Once it is on screen, say it as "My turn" on that word, the one the receipt names; never make up '
    + 'a model word of your own. Never say which board card or which part '
    + 'of this word matches a model part, and never walk this word\'s parts.');
  if (smallBoardWordFor(item, items, board)) add(SMALL_BOARD_LEVER, 'simplify', 'both',
    ['root_only', 'other_part_only', 'part_missing', 'swapped_part', 'meaning_word'],
    'The learner still cannot build the word after help.',
    `Opens an easier practice word first, on a small board of its own parts and one extra per kind`
    + `${item.complexity === 'greek_latin' && item.parts.length === 3 ? ', with two parts' : ''}. Say its clue. It is not `
    + 'graded; the full word comes back after it.');
  return levers;
}

/** The levers the tier puts on screen before any pull (Phase 6): easy starts with the empty frame. */
export const startingLevers = (tier: string | undefined): string[] => (tier === 'easy' ? [SLOTS_LEVER] : []);
