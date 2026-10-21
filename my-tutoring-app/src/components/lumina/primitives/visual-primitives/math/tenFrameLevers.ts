/**
 * The in-item levers on a ten-frame item, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 18 B1 built
 * `build`, handoff 32 the rest; tables qa/support-levers/m4-lever-tables-2026-09-29.md). No real-learner evidence: the
 * misses are what `frameMiss` and `tenFrameSpokenMisses` observe. Pure: the component draws a pulled lever, the
 * workspace publishes the set.
 * - build / build_teen: `running_count` (marks: placed counters only; starts withdrawn at every tier, user ruling
 *   2026-09-29), `five_frame` (marks, never on five), `smaller_build` (easier: about half, never the item's number).
 * - decompose: `split_model` (model: a total no split item still ahead uses), `ways_shown` (custom: the learner's own
 *   ways for this total, never an unshown way), `smaller_total` (easier: a smaller total no split item still ahead uses).
 * - build_pair (open build): `running_count` (all the counters on the frame; the total is public), and decompose's
 *   `split_model`, `ways_shown` and `smaller_total`, each kept to build_pair items (a split's ways are not a pair's).
 * - decompose_teen: `running_count` (the yellow counters only; the ten is public), `ten_model` (custom: a full model
 *   frame of ten beside the item, never on its counters), `smaller_teen` (easier: about half the ones).
 * - make_ten: K fills the frame, so `empty_glow` (marks: the empty boxes pulse, no count); grades 1-2 say the
 *   complement, so `fill_model` (model: a five-frame, never a make-ten fact) and `five_frame` (never on five). Both:
 *   `near_ten` (easier: 1-3 missing, not a make-ten still ahead).
 * - subitize: `hide_empty` (layout: empty boxes fade during the look), `five_frame` (above five only), `longer_look`
 *   (custom: the next look lasts twice as long; the counters still hide), `fewer_dots` (easier: about half).
 * - operate: `operation_model` (model: a problem of the same operation whose result no operate item still ahead
 *   answers), `five_frame` (never on five), `smaller_numbers` (easier: second number 1 or 2, a smaller answer).
 * A number "still ahead" is the current item's or a later item's: an answer the learner has already given leaks nothing.
 * Every simpler item has the id `<item>~smaller`, the same mode, and is built through the family's own item gate.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { OFF_BY } from '../../../components/live-activity/boss';
import { tenFrameCard } from './tenFrame.card';
import { isPairKind, itemsFromChallenges, teenTotalFor, waysToSplit, type TenFrameBand, type TenFrameChallengeLike,
  type TenFrameItem, type TenFrameSplit } from './tenFrameDomain';
import { evalModeForKind } from './tenFrameWorkspace';

export const COUNT_LEVER = 'running_count';
export const FIVE_LEVER = 'five_frame';
export const SMALLER_LEVER = 'smaller_build';
export const SPLIT_MODEL_LEVER = 'split_model';
export const WAYS_LEVER = 'ways_shown';
export const SMALLER_TOTAL_LEVER = 'smaller_total';
export const TEN_MODEL_LEVER = 'ten_model';
export const SMALLER_TEEN_LEVER = 'smaller_teen';
export const EMPTY_GLOW_LEVER = 'empty_glow';
export const FILL_MODEL_LEVER = 'fill_model';
export const NEAR_TEN_LEVER = 'near_ten';
export const HIDE_EMPTY_LEVER = 'hide_empty';
export const LONGER_LOOK_LEVER = 'longer_look';
export const FEWER_DOTS_LEVER = 'fewer_dots';
export const OPERATION_MODEL_LEVER = 'operation_model';
export const SMALLER_NUMBERS_LEVER = 'smaller_numbers';

/** The lesson's lever state for the item on screen. */
export interface TenFrameLeverContext {
  band: TenFrameBand;
  /** Every item of the session, in order: a number still ahead of the learner stays out of a model or practice item. */
  session: readonly TenFrameItem[];
  /** decompose, build_pair: the ways the learner already showed for this item's total (`splitKey`s). */
  shownWays?: ReadonlySet<string>;
}

/** A small frame drawn BESIDE the item, never on it: red counters, then yellow, then red ones crossed out. */
export interface ModelFrame { whole: 5 | 10; red: number; yellow: number; crossed: number; says: string }

/** The item and the items after it: their answers are still to be given. */
const ahead = (item: TenFrameItem, session: readonly TenFrameItem[]): TenFrameItem[] => {
  const at = session.findIndex(i => i.id === item.id);
  return at < 0 ? [item, ...session] : session.slice(at);
};
const answersAhead = (item: TenFrameItem, session: readonly TenFrameItem[], kinds: readonly TenFrameItem['kind'][]) =>
  new Set(ahead(item, session).filter(i => kinds.includes(i.kind)).map(i => i.answer));
const OPERATE: readonly TenFrameItem['kind'][] = ['add', 'subtract'];
const isOperate = (item: TenFrameItem) => OPERATE.includes(item.kind);

/** One simpler item of the same mode, with the practice id, or null when the build gates drop it. */
function simpler(item: TenFrameItem, band: TenFrameBand, ch: Omit<TenFrameChallengeLike, 'id'>): TenFrameItem | null {
  return itemsFromChallenges([{ ...ch, id: `${item.id}~smaller` }], { capacity: item.capacity, band })[0] ?? null;
}

/** About half first, then smaller, then up to one below `n`; at least `floor`. */
const smallerOrder = (n: number, floor: number): number[] => {
  const half = Math.ceil(n / 2), out: number[] = [];
  for (let v = half; v >= floor; v--) out.push(v);
  for (let v = half + 1; v < n; v++) out.push(v);
  return out.filter(v => v < n);
};

// ── build / build_teen ─────────────────────────────────────────────────────

const BUILD_KINDS: readonly TenFrameItem['kind'][] = ['build', 'build_teen'];

/** Leak rule for the five-frame: outlining a row of five marks the answer when five is what to produce
 *  (`answer` is the ones on `build_teen`, so fifteen is refused too; on make_ten five shown means five missing). */
export const fiveFrameLeaks = (item: TenFrameItem) => item.answer === 5 || (item.kind === 'make_ten' && item.shown === 5);

/** Which frame the five-frame outlines: the one the learner fills (the ones frame on `build_teen`). */
export const fiveFrameIndex = (item: TenFrameItem) => (item.kind === 'build_teen' ? 1 : 0);

/** The easier item for `item`, or null: about half as many to place, never the same number, same mode and frame. */
export function smallerBuild(item: TenFrameItem, band: TenFrameBand): TenFrameItem | null {
  if (!BUILD_KINDS.includes(item.kind) || item.answer < 2) return null;
  const place = Math.ceil(item.answer / 2);
  if (place === item.answer) return null;
  const targetCount = item.kind === 'build_teen' ? teenTotalFor(item) - item.answer + place : place;
  return simpler(item, band, { type: item.kind, targetCount });
}

// ── decompose (split) ──────────────────────────────────────────────────────

/** A model split of a total no split item still ahead asks for, so it shows no pair of any of them. */
export function splitModel(item: TenFrameItem, session: readonly TenFrameItem[] = []): ModelFrame | null {
  if (!isPairKind(item.kind)) return null;
  const used = answersAhead(item, session, [item.kind]);
  const total = [6, 7, 2, 8, 9, 10].find(t => !used.has(t));
  if (total === undefined) return null;
  const yellow = total >= 6 ? 2 : 1;
  return { whole: 10, red: total - yellow, yellow, crossed: 0, says: `${total - yellow} red and ${yellow} yellow make ${total}.` };
}

/** The ways the learner already showed for this total, in order; never a way they have not shown. Empty once every
 *  way is shown: then any split is right again (`judgeSplit`), so the shown ways would be answers. */
export function waysShown(item: TenFrameItem, shownWays: ReadonlySet<string> = new Set()): TenFrameSplit[] {
  if (!isPairKind(item.kind) || item.answer > 10 || shownWays.size >= waysToSplit(item.answer)) return [];
  return Array.from(shownWays).map(key => key.split('+').map(Number)).filter(([a, b]) => a >= 1 && b >= 1 && a + b === item.answer)
    .map(([a, b]) => ({ a, b }));
}

/** A split of a smaller total (2 or more) that no split item still ahead asks for. */
export function smallerTotal(item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[] = []): TenFrameItem | null {
  if (!isPairKind(item.kind) || item.answer < 3) return null;
  const used = answersAhead(item, session, [item.kind]);
  const total = smallerOrder(item.answer, 2).find(t => !used.has(t));
  return total === undefined ? null : simpler(item, band, { type: item.kind, targetCount: total });
}

// ── decompose_teen ─────────────────────────────────────────────────────────

/** The model of ten: a full frame beside the item. Ten is public (the ask states it); the leftover is not. */
export const TEN_MODEL: ModelFrame = { whole: 10, red: 0, yellow: 10, crossed: 0, says: 'A full frame is ten: ten yellow counters.' };

/** A teen number with about half the ones, never the item's teen number. */
export function smallerTeen(item: TenFrameItem, band: TenFrameBand): TenFrameItem | null {
  if (item.kind !== 'decompose_teen') return null;
  const ones = item.answer - 10;
  if (ones < 2) return null;
  return simpler(item, band, { type: 'decompose_teen', targetCount: 10 + Math.ceil(ones / 2) });
}

// ── make_ten ───────────────────────────────────────────────────────────────

/** A five-frame model of "how many more fill it". Never a make-ten fact (every pair to ten may be an item ahead), and
 *  none of its numbers is the item's: none on five, whose model would say "make 5". */
export function fillModel(item: TenFrameItem): ModelFrame | null {
  if (item.kind !== 'make_ten' || item.answer === 5 || item.shown === 5) return null;
  const own = [item.answer, item.shown];
  const red = [3, 2, 4, 1].find(m => !own.includes(m) && !own.includes(5 - m));
  if (red === undefined) return null;
  return { whole: 5, red, yellow: 5 - red, crossed: 0, says: `${red} counters, and ${5 - red} more fill the five-frame: ${red} and ${5 - red} more make 5.` };
}

/** A make-ten with 1-3 missing, fewer than the item, and no make-ten still ahead of the learner. */
export function nearTen(item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[] = []): TenFrameItem | null {
  if (item.kind !== 'make_ten') return null;
  const used = answersAhead(item, session, ['make_ten']);
  for (let missing = Math.min(3, item.answer - 1); missing >= 1; missing--) {
    if (!used.has(missing)) return simpler(item, band, { type: 'make_ten', targetCount: item.capacity - missing });
  }
  return null;
}

// ── subitize ───────────────────────────────────────────────────────────────

/** A quick look at about half as many (2 or more), no look still ahead of the learner. */
export function fewerDots(item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[] = []): TenFrameItem | null {
  if (item.kind !== 'subitize' || item.answer < 3) return null;
  const used = answersAhead(item, session, ['subitize']);
  const n = smallerOrder(item.answer, 2).find(t => !used.has(t));
  return n === undefined ? null : simpler(item, band, { type: 'subitize', targetCount: n });
}

// ── operate (add, subtract) ────────────────────────────────────────────────

/** A model problem of the same operation whose result is no operate answer still ahead and none of whose numbers is
 *  the item's answer, drawn beside the frame. */
export function operationModel(item: TenFrameItem, session: readonly TenFrameItem[] = []): ModelFrame | null {
  if (!isOperate(item)) return null;
  const used = answersAhead(item, session, OPERATE);
  if (item.kind === 'add') {
    for (const a of [3, 2, 4, 1, 5]) for (const b of [2, 1, 3, 4]) {
      const sum = a + b;
      if (sum <= 10 && !used.has(sum) && a !== item.answer && b !== item.answer && !(a === item.addend1 && b === item.addend2))
        return { whole: 10, red: a, yellow: b, crossed: 0, says: `${a} and ${b} make ${sum}.` };
    }
    return null;
  }
  for (const start of [6, 5, 8, 7, 9, 4, 3]) for (const take of [2, 1, 3]) {
    const left = start - take;
    if (left >= 1 && !used.has(left) && start !== item.answer && take !== item.answer && !(start === item.shown && take === item.removed))
      return { whole: 10, red: left, yellow: 0, crossed: take, says: `${start} take away ${take} leaves ${left}.` };
  }
  return null;
}

/** The same operation with a second number of 1 or 2, a smaller answer, and no operate answer still ahead. */
export function smallerNumbers(item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[] = []): TenFrameItem | null {
  if (!isOperate(item)) return null;
  const used = answersAhead(item, session, OPERATE);
  if (item.kind === 'add') {
    for (const a of [3, 2, 4, 5]) for (const b of [2, 1]) {
      const sum = a + b;
      if (sum < item.answer && !used.has(sum)) return simpler(item, band, { type: 'add', targetCount: sum, addend1: a, addend2: b });
    }
    return null;
  }
  for (const start of [5, 4, 3]) for (const take of [2, 1]) {
    const left = start - take;
    if (start < item.shown && left < item.answer && !used.has(left))
      return simpler(item, band, { type: 'subtract', targetCount: left, startCount: start });
  }
  return null;
}

/** The simpler item a simplify lever opens on `item`, or null when it has none (the harness rebuilds it from the id). */
export function practiceItem(item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[] = []): TenFrameItem | null {
  switch (item.kind) {
    case 'build': case 'build_teen': return smallerBuild(item, band);
    case 'split': case 'build_pair': return smallerTotal(item, band, session);
    case 'decompose_teen': return smallerTeen(item, band);
    case 'make_ten': return nearTen(item, band, session);
    case 'subitize': return fewerDots(item, band, session);
    default: return smallerNumbers(item, band, session);
  }
}

// ── The lever set ──────────────────────────────────────────────────────────

const BACK = 'It is not graded; the full item comes back after it.';
const spoken = (item: TenFrameItem) => item.answerKind !== 'gesture';
const modelFact = (m: ModelFrame) => `A small model ${m.whole === 5 ? 'five-frame' : 'frame'} beside the item shows: ${m.says}`;
const fiveFact = (_on: unknown, item: TenFrameItem) =>
  `The top row of the ${item.kind === 'build_teen' ? 'second frame' : 'frame'} is outlined and marked 5.`;
const FIVE_DOES = 'Outlines the top row of the frame and marks it 5, so the learner can see a full row of five.';
const PAIR_MODES = ['decompose', 'build_pair'];

export const TEN_FRAME_LEVERS = leverSet<TenFrameItem, TenFrameLeverContext>({
  modeOf: item => evalModeForKind(item.kind),
  missesOf: mode => tenFrameCard.modes[mode]?.misses ?? [],
  support: { tier: item => item.supportTier ?? 'medium', different: 'a different number, worked on a small frame beside this one',
    own: 'this item\'s answer' },
  specs: [
    // ── running_count: the learner's own counters, never the number to make ──
    { id: COUNT_LEVER, type: 'marks', modes: ['build'], carrier: 'both', answers: ['one_short', 'one_over', 'filled_frame'],
      when: 'The learner miscounts while placing: one too many, one too few, or loses track.',
      does: 'Shows under the frame how many counters the learner has placed so far. Never the number to build.',
      fact: 'Under the frame, a count shows how many counters are on it so far.' },
    { id: COUNT_LEVER, type: 'marks', modes: ['build_teen'], carrier: 'both', answers: ['one_short', 'one_over', 'filled_frame'],
      when: 'The learner miscounts while placing: one too many, one too few, or loses track.',
      does: 'Shows under the frames how many counters are on them so far, the ten included. Never the number to make.',
      fact: 'Under the frames, a count shows how many counters are on them so far, the ten included.' },
    // Bare at every tier: the count of what is on the frame is half the task, so it comes on a miss.
    { id: COUNT_LEVER, type: 'marks', modes: ['build_pair'], carrier: 'both', answers: ['one_short', 'one_over', 'filled_frame'],
      when: 'The learner miscounts while making the number: one too many, one too few, or loses track.',
      does: 'Shows under the frame how many counters are on it so far, red and yellow together. Never how many of each colour.',
      fact: 'Under the frame, a count shows how many counters are on it, both colours together.' },
    { id: COUNT_LEVER, type: 'marks', modes: ['decompose_teen'], carrier: 'both', answers: ['one_short', 'one_over'],
      when: 'The learner miscounts the ten: one yellow too many or too few.',
      does: 'Shows under the frames how many counters are yellow so far. Never how many are left over.',
      fact: 'Under the frames, a count shows how many counters are yellow.' },
    // ── five_frame: never where five is what to produce ──
    { id: FIVE_LEVER, type: 'marks', modes: ['build', 'build_teen'], answers: ['short_by_more', 'over_by_more', 'filled_frame'],
      offer: item => !fiveFrameLeaks(item), when: 'The learner counts one by one and loses track past five.',
      does: item => (item.kind === 'build_teen'
        ? 'Outlines the top row of the second frame and marks it 5, so the learner can count the ones on from a full row.'
        : 'Outlines the top row of the frame and marks it 5, so the learner can count on from a full row.'),
      fact: fiveFact },
    { id: SMALLER_LEVER, type: 'easier', carrier: 'shown', modes: ['build', 'build_teen'], answers: ['short_by_more', 'over_by_more'],
      content: (item, { band }) => smallerBuild(item, band),
      when: item => (item.kind === 'build_teen' ? 'The learner cannot place this many ones beside the ten yet.'
        : 'The learner cannot build a number this big yet.'),
      does: item => (item.kind === 'build_teen'
        ? `Opens an easier teen number first, with about half as many ones beside the ten. ${BACK}`
        : `Opens an easier build first, about half as many counters. ${BACK}`) },
    // ── decompose and build_pair: a model of another total, the learner's own ways, a smaller total ──
    { id: SPLIT_MODEL_LEVER, type: 'model', modes: ['decompose'], answers: ['none_flipped', 'all_flipped'],
      content: (item, { session }) => splitModel(item, session), fact: modelFact,
      when: 'The learner turns every counter yellow, or none, so there is only one group.',
      does: 'Shows a small model frame beside this one with a different number split into red and yellow. Never a split of this number.' },
    { id: SPLIT_MODEL_LEVER, type: 'model', modes: ['build_pair'], answers: ['one_colour'],
      content: (item, { session }) => splitModel(item, session), fact: modelFact,
      when: 'The learner makes the number all in one colour, so there is only one group.',
      does: 'Shows a small model frame beside this one with a different number made of red and yellow. Never a pair for this number.' },
    { id: WAYS_LEVER, type: 'custom', modes: PAIR_MODES, carrier: 'shown', answers: ['same_way_again'],
      why: 'It shows the learner\'s own earlier answers for this number; no stock type replays the learner\'s work.',
      content: (item, { shownWays }) => { const ways = waysShown(item, shownWays); return ways.length ? ways : null; },
      when: 'The learner shows a way they already showed.',
      does: 'Shows beside the frame small pictures of the ways the learner already showed for this number. Never a way they have not shown.',
      fact: (ways: TenFrameSplit[]) => `Beside the frame, the ways the learner already showed: ${ways.map(w => `${w.a} red and ${w.b} yellow`).join('; ')}.` },
    { id: SMALLER_TOTAL_LEVER, type: 'easier', carrier: 'shown', modes: ['decompose'], answers: ['none_flipped', 'all_flipped'],
      content: (item, { band, session }) => smallerTotal(item, band, session),
      when: 'The learner cannot make two groups from this many yet.', does: `Opens a split of a smaller group first. ${BACK}` },
    { id: SMALLER_TOTAL_LEVER, type: 'easier', carrier: 'shown', modes: ['build_pair'], answers: ['short_by_more', 'over_by_more', 'one_colour'],
      content: (item, { band, session }) => smallerTotal(item, band, session),
      when: 'The learner cannot make this number from two colours yet.',
      does: `Opens a smaller number to make from red and yellow first. ${BACK}` },
    // ── decompose_teen ──
    { id: TEN_MODEL_LEVER, type: 'custom', modes: ['decompose_teen'], carrier: 'both',
      answers: ['all_flipped', 'short_by_more', 'over_by_more'],
      why: 'It draws a reference frame of ten beside the item, not a different item worked; no stock type shows a reference quantity.',
      when: 'The learner turns the whole group yellow, or far from ten.',
      does: 'Shows a small full frame beside the item: ten yellow counters. The item\'s counters are unchanged.',
      fact: modelFact(TEN_MODEL) },
    { id: SMALLER_TEEN_LEVER, type: 'easier', carrier: 'shown', modes: ['decompose_teen'], answers: ['short_by_more', 'over_by_more', 'all_flipped'],
      content: (item, { band }) => smallerTeen(item, band),
      when: 'The learner cannot find the ten in a group this big yet.',
      does: `Opens a smaller teen group first, with fewer left over beside the ten. ${BACK}` },
    // ── make_ten: Kindergarten fills the frame, Grades 1-2 say how many more ──
    { id: EMPTY_GLOW_LEVER, type: 'marks', modes: ['make_ten'], answers: ['one_short', 'short_by_more'],
      offer: item => !spoken(item), when: 'The learner stops before the frame is full.',
      does: 'Makes the empty boxes on the frame pulse. No count.', fact: 'The empty boxes on the frame pulse.' },
    { id: FILL_MODEL_LEVER, type: 'model', modes: ['make_ten'], answers: ['said_shown', 'said_capacity'],
      content: item => (spoken(item) ? fillModel(item) : null), fact: modelFact,
      when: 'The learner says the counters already there, or the whole, instead of how many more.',
      does: 'Shows a small five-frame beside the item with some counters and the more that fill it. Never a fact about ten.' },
    { id: FIVE_LEVER, type: 'marks', modes: ['make_ten'], answers: ['one_short', 'one_over'],
      offer: item => spoken(item) && !fiveFrameLeaks(item), when: 'The learner loses track past five.', does: FIVE_DOES, fact: fiveFact },
    { id: NEAR_TEN_LEVER, type: 'easier', carrier: 'shown', modes: ['make_ten'], answers: ['short_by_more', 'over_by_more'],
      answersOn: item => (spoken(item) ? ['short_by_more', 'over_by_more'] : ['short_by_more']),
      content: (item, { band, session }) => nearTen(item, band, session),
      when: 'The learner is far off on how many more make ten.', does: `Opens a frame with only one to three boxes missing first. ${BACK}` },
    // ── subitize ──
    { id: HIDE_EMPTY_LEVER, type: 'layout', modes: ['subitize'], answers: ['empty_count'], offer: item => item.answer < item.capacity,
      when: 'The learner counts the empty boxes instead of the counters.',
      does: 'Fades the empty boxes during the quick look, so only the counters stand out.',
      fact: 'During the quick look the empty boxes fade, so only the counters stand out.' },
    { id: FIVE_LEVER, type: 'marks', modes: ['subitize'], answers: OFF_BY, offer: item => item.answer > 5,
      when: 'The learner loses track past five.', does: FIVE_DOES, fact: fiveFact },
    { id: LONGER_LOOK_LEVER, type: 'custom', modes: ['subitize'], carrier: 'shown', answers: OFF_BY,
      why: 'It changes how long the next look lasts; no stock type changes the timing of what is shown.',
      when: 'The look is too quick for the learner to take in.',
      does: 'The next quick look lasts twice as long. The counters still hide before the learner answers.',
      fact: 'The next quick look lasts twice as long.' },
    { id: FEWER_DOTS_LEVER, type: 'easier', carrier: 'shown', modes: ['subitize'], answers: ['short_by_more', 'over_by_more'],
      content: (item, { band, session }) => fewerDots(item, band, session),
      when: 'The learner cannot take in this many at a glance yet.', does: `Opens a quick look at fewer counters first. ${BACK}` },
    // ── operate ──
    { id: OPERATION_MODEL_LEVER, type: 'model', modes: ['operate'], answers: ['said_addend', 'said_start', 'said_change'],
      answersOn: item => (item.kind === 'add' ? ['said_addend'] : ['said_start', 'said_change']),
      content: (item, { session }) => operationModel(item, session), fact: modelFact,
      when: item => (item.kind === 'add' ? 'The learner says one of the numbers being added, not how many altogether.'
        : 'The learner says how many there were, or how many were taken away, not how many are left.'),
      does: item => (item.kind === 'add'
        ? 'Shows a small model frame beside the item with a different adding problem in red and yellow, and its total. Never this problem.'
        : 'Shows a small model frame beside the item with a different take-away, the taken counters crossed out, and what is left. Never this problem.') },
    { id: FIVE_LEVER, type: 'marks', modes: ['operate'], answers: ['one_short', 'one_over'], offer: item => item.answer !== 5,
      when: 'The learner loses track past five.', does: FIVE_DOES, fact: fiveFact },
    { id: SMALLER_NUMBERS_LEVER, type: 'easier', carrier: 'shown', modes: ['operate'], answers: ['short_by_more', 'over_by_more'],
      content: (item, { band, session }) => smallerNumbers(item, band, session),
      when: 'The learner is far off with numbers this big.', does: `Opens the same kind of problem with smaller numbers first. ${BACK}` },
  ],
});

// ── What the pulled levers put on screen ───────────────────────────────────

export interface LeverView {
  /** The frame whose top row is outlined and marked 5, or -1. */
  five: number;
  models: ModelFrame[];
  /** decompose, build_pair: the learner's own ways for this total. */
  ways: TenFrameSplit[];
  emptyGlow: boolean;
  hideEmpty: boolean;
  longLook: boolean;
  /** decompose_teen: the count of yellow counters. */
  yellowCount: boolean;
}

/** What the component draws for the levers pulled on `item`. */
export function leverView(item: TenFrameItem | null, pulled: readonly string[], ctx: TenFrameLeverContext): LeverView {
  const on = new Set(TEN_FRAME_LEVERS.declare(item, ctx, pulled).filter(l => l.pulled).map(l => l.id));
  const model = !item ? null
    : on.has(SPLIT_MODEL_LEVER) ? splitModel(item, ctx.session)
      : on.has(TEN_MODEL_LEVER) ? TEN_MODEL
        : on.has(FILL_MODEL_LEVER) ? fillModel(item)
          : on.has(OPERATION_MODEL_LEVER) ? operationModel(item, ctx.session) : null;
  return {
    five: item && on.has(FIVE_LEVER) ? fiveFrameIndex(item) : -1,
    models: model ? [model] : [],
    ways: item && on.has(WAYS_LEVER) ? waysShown(item, ctx.shownWays) : [],
    emptyGlow: on.has(EMPTY_GLOW_LEVER),
    hideEmpty: on.has(HIDE_EMPTY_LEVER),
    longLook: on.has(LONGER_LOOK_LEVER),
    yellowCount: on.has(COUNT_LEVER) && item?.kind === 'decompose_teen',
  };
}
