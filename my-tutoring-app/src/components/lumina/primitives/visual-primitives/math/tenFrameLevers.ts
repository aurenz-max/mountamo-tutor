/**
 * The in-item levers on a ten-frame item (`/add-support-tiers`; handoff 18 B1 built `build`, handoff 32 the rest).
 * Tables: qa/support-levers/m4-lever-tables-2026-09-29.md. No real-learner evidence: the misses are what `frameMiss`
 * and `tenFrameSpokenMisses` observe.
 *
 * Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * - build / build_teen: `running_count` (placed counters only; starts withdrawn at every tier, user ruling
 *   2026-09-29), `five_frame` (never on five), `smaller_build` (about half, never the item's number).
 * - decompose: `split_model` (a model frame of a total no split item still ahead uses), `ways_shown` (the learner's
 *   own ways for this total, never an unshown way), `smaller_total` (a smaller total no split item still ahead uses).
 * - decompose_teen: `running_count` (the yellow counters only; the ten is public), `ten_model` (a full model frame of
 *   ten beside the item, never on its counters), `smaller_teen` (about half the ones, never the item's teen number).
 * - make_ten: K fills the frame, so `empty_glow` (the empty boxes pulse, no count); grades 1-2 say the complement, so
 *   `fill_model` (a five-frame model, never a make-ten fact) and `five_frame` (never on five). Both: `near_ten`
 *   (1-3 missing, not a make-ten still ahead).
 * - subitize: `hide_empty` (empty boxes fade during the look), `five_frame` (above five only), `longer_look` (the
 *   next look lasts twice as long; the counters still hide), `fewer_dots` (about half, no look still ahead).
 * - operate: `operation_model` (a model problem of the same operation whose result no operate item still ahead
 *   answers), `five_frame` (never on five), `smaller_numbers` (second number 1 or 2, smaller answer, none still ahead).
 * A number "still ahead" is the current item's or a later item's: an answer the learner has already given leaks nothing.
 * Every simpler item has the id `<item>~smaller`, the same mode, and is built by `practiceItem`.
 * `frameMiss` names what a wrong placement shows on every gesture kind (handoff 20).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemsFromChallenges, judgeSplit, teenTargetFor, waysToSplit, teenTotalFor, type TenFrameBand, type TenFrameChallengeLike,
  type TenFrameItem, type TenFrameSplit } from './tenFrameScript';

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
/** Every simplify lever: each kind has one, and `practiceItem` builds it. */
export const SIMPLIFY_LEVERS: ReadonlySet<string> = new Set([SMALLER_LEVER, SMALLER_TOTAL_LEVER, SMALLER_TEEN_LEVER,
  NEAR_TEN_LEVER, FEWER_DOTS_LEVER, SMALLER_NUMBERS_LEVER]);

/**
 * What a wrong placement shows (`TeachingAttempt.miss`), from the count the frame commits: counters placed
 * (build), added to the seeded ones (make_ten, build_teen) or turned yellow (split, decompose_teen).
 * - `one_short` / `one_over`: one fewer or one more than the number to produce;
 * - `short_by_more` / `over_by_more`: two or more off;
 * - `filled_frame`: every empty box filled (build, build_teen), when that is more than one over;
 * - `all_flipped` / `none_flipped`: the whole group turned yellow, or none of it (split; decompose_teen's
 *   whole group when that is more than one over);
 * - `same_way_again`: a split already shown for this total while another way remains.
 * Only the observable pattern; why the learner did it is the tutor's and the distiller's to judge.
 * Undefined for a right placement or a spoken item.
 */
export type FrameMiss = 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more' | 'filled_frame'
  | 'all_flipped' | 'none_flipped' | 'same_way_again';

export function frameMiss(item: TenFrameItem | null, work: { placed: number; shownWays?: ReadonlySet<string> }): FrameMiss | undefined {
  if (!item || item.answerKind !== 'gesture') return undefined;
  const { placed } = work;
  if (item.kind === 'split') {
    const verdict = judgeSplit(item, { a: item.answer - placed, b: placed }, work.shownWays);
    if (verdict === 'repeat') return 'same_way_again';
    if (verdict === 'correct') return undefined;
    return placed <= 0 ? 'none_flipped' : 'all_flipped';
  }
  const target = item.kind === 'build_teen' || item.kind === 'decompose_teen' ? teenTargetFor(item) : item.answer;
  const off = placed - target;
  if (off === 0) return undefined;
  if (off === -1) return 'one_short';
  if (off === 1) return 'one_over';
  if (off > 0 && item.kind === 'decompose_teen' && placed === item.answer) return 'all_flipped';
  if (off > 0 && (item.kind === 'build' || item.kind === 'build_teen') && placed === item.capacity - item.shown) return 'filled_frame';
  return off < 0 ? 'short_by_more' : 'over_by_more';
}

/** What a lever needs beyond the item. */
export interface LeverContext {
  /** Every item of the session, in order: a number still ahead of the learner stays out of a model or practice item. */
  session?: readonly TenFrameItem[];
  /** decompose: the ways the learner already showed for this item's total (`splitKey`s). */
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
  if (item.kind !== 'split') return null;
  const used = answersAhead(item, session, ['split']);
  const total = [6, 7, 2, 8, 9, 10].find(t => !used.has(t));
  if (total === undefined) return null;
  const yellow = total >= 6 ? 2 : 1;
  return { whole: 10, red: total - yellow, yellow, crossed: 0, says: `${total - yellow} red and ${yellow} yellow make ${total}.` };
}

/** The ways the learner already showed for this total, in order; never a way they have not shown. Empty once every
 *  way is shown: then any split is right again (`judgeSplit`), so the shown ways would be answers. */
export function waysShown(item: TenFrameItem, shownWays: ReadonlySet<string> = new Set()): TenFrameSplit[] {
  if (item.kind !== 'split' || item.answer > 10 || shownWays.size >= waysToSplit(item.answer)) return [];
  return Array.from(shownWays).map(key => key.split('+').map(Number)).filter(([a, b]) => a >= 1 && b >= 1 && a + b === item.answer)
    .map(([a, b]) => ({ a, b }));
}

/** A split of a smaller total (2 or more) that no split item still ahead asks for. */
export function smallerTotal(item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[] = []): TenFrameItem | null {
  if (item.kind !== 'split' || item.answer < 3) return null;
  const used = answersAhead(item, session, ['split']);
  const total = smallerOrder(item.answer, 2).find(t => !used.has(t));
  return total === undefined ? null : simpler(item, band, { type: 'split', targetCount: total });
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

/** The simpler item a simplify lever opens on `item`, or null when it has none. */
export function practiceItem(item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[] = []): TenFrameItem | null {
  switch (item.kind) {
    case 'build': case 'build_teen': return smallerBuild(item, band);
    case 'split': return smallerTotal(item, band, session);
    case 'decompose_teen': return smallerTeen(item, band);
    case 'make_ten': return nearTen(item, band, session);
    case 'subitize': return fewerDots(item, band, session);
    default: return smallerNumbers(item, band, session);
  }
}

// ── The declared levers ────────────────────────────────────────────────────

export function tenFrameLevers(item: TenFrameItem | null, pulled: readonly string[], band: TenFrameBand,
  ctx: LeverContext = {}): WorkspaceLever[] {
  if (!item) return [];
  const session = ctx.session ?? [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const five = (answers: string[]) => lever(FIVE_LEVER, 'help', 'shown', answers, 'The learner loses track past five.',
    'Outlines the top row of the frame and marks it 5, so the learner can see a full row of five.');
  const back = 'It is not graded; the full item comes back after it.';
  const levers: WorkspaceLever[] = [];
  const push = (on: unknown, l: () => WorkspaceLever) => { if (on) levers.push(l()); };

  switch (item.kind) {
    case 'build': case 'build_teen': {
      if (item.answerKind !== 'gesture') return [];
      const teen = item.kind === 'build_teen';
      push(true, () => lever(COUNT_LEVER, 'help', 'both', ['one_short', 'one_over', 'filled_frame'],
        'The learner miscounts while placing: one too many, one too few, or loses track.',
        teen ? 'Shows under the frames how many counters are on them so far, the ten included. Never the number to make.'
          : 'Shows under the frame how many counters the learner has placed so far. Never the number to build.'));
      push(!fiveFrameLeaks(item), () => lever(FIVE_LEVER, 'help', 'shown', ['short_by_more', 'over_by_more', 'filled_frame'],
        'The learner counts one by one and loses track past five.',
        teen ? 'Outlines the top row of the second frame and marks it 5, so the learner can count the ones on from a full row.'
          : 'Outlines the top row of the frame and marks it 5, so the learner can count on from a full row.'));
      push(smallerBuild(item, band), () => lever(SMALLER_LEVER, 'simplify', 'shown', ['short_by_more', 'over_by_more'],
        teen ? 'The learner cannot place this many ones beside the ten yet.' : 'The learner cannot build a number this big yet.',
        teen ? `Opens an easier teen number first, with about half as many ones beside the ten. ${back}`
          : `Opens an easier build first, about half as many counters. ${back}`));
      return levers;
    }
    case 'split':
      push(splitModel(item, session), () => lever(SPLIT_MODEL_LEVER, 'help', 'both', ['none_flipped', 'all_flipped'],
        'The learner turns every counter yellow, or none, so there is only one group.',
        'Shows a small model frame beside this one with a different number split into red and yellow. Never a split of this number.'));
      push(waysShown(item, ctx.shownWays).length, () => lever(WAYS_LEVER, 'help', 'shown', ['same_way_again'],
        'The learner shows a way they already showed.',
        'Shows beside the frame small pictures of the ways the learner already showed for this number. Never a way they have not shown.'));
      push(smallerTotal(item, band, session), () => lever(SMALLER_TOTAL_LEVER, 'simplify', 'shown', ['none_flipped', 'all_flipped'],
        'The learner cannot make two groups from this many yet.', `Opens a split of a smaller group first. ${back}`));
      return levers;
    case 'decompose_teen':
      push(true, () => lever(COUNT_LEVER, 'help', 'both', ['one_short', 'one_over'],
        'The learner miscounts the ten: one yellow too many or too few.',
        'Shows under the frames how many counters are yellow so far. Never how many are left over.'));
      push(true, () => lever(TEN_MODEL_LEVER, 'help', 'both', ['all_flipped', 'short_by_more', 'over_by_more'],
        'The learner turns the whole group yellow, or far from ten.',
        'Shows a small full frame beside the item: ten yellow counters. The item\'s counters are unchanged.'));
      push(smallerTeen(item, band), () => lever(SMALLER_TEEN_LEVER, 'simplify', 'shown', ['short_by_more', 'over_by_more', 'all_flipped'],
        'The learner cannot find the ten in a group this big yet.',
        `Opens a smaller teen group first, with fewer left over beside the ten. ${back}`));
      return levers;
    case 'make_ten': {
      const spoken = item.answerKind !== 'gesture';
      push(!spoken, () => lever(EMPTY_GLOW_LEVER, 'help', 'shown', ['one_short', 'short_by_more'],
        'The learner stops before the frame is full.', 'Makes the empty boxes on the frame pulse. No count.'));
      push(spoken && fillModel(item), () => lever(FILL_MODEL_LEVER, 'help', 'both', ['said_shown', 'said_capacity'],
        'The learner says the counters already there, or the whole, instead of how many more.',
        'Shows a small five-frame beside the item with some counters and the more that fill it. Never a fact about ten.'));
      push(spoken && !fiveFrameLeaks(item), () => five(['one_short', 'one_over']));
      push(nearTen(item, band, session), () => lever(NEAR_TEN_LEVER, 'simplify', 'shown',
        spoken ? ['short_by_more', 'over_by_more'] : ['short_by_more'],
        'The learner is far off on how many more make ten.', `Opens a frame with only one to three boxes missing first. ${back}`));
      return levers;
    }
    case 'subitize':
      push(item.answer < item.capacity, () => lever(HIDE_EMPTY_LEVER, 'help', 'shown', ['empty_count'],
        'The learner counts the empty boxes instead of the counters.',
        'Fades the empty boxes during the quick look, so only the counters stand out.'));
      push(item.answer > 5, () => five(['one_short', 'one_over', 'short_by_more', 'over_by_more']));
      push(true, () => lever(LONGER_LOOK_LEVER, 'help', 'shown', ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
        'The look is too quick for the learner to take in.',
        'The next quick look lasts twice as long. The counters still hide before the learner answers.'));
      push(fewerDots(item, band, session), () => lever(FEWER_DOTS_LEVER, 'simplify', 'shown', ['short_by_more', 'over_by_more'],
        'The learner cannot take in this many at a glance yet.', `Opens a quick look at fewer counters first. ${back}`));
      return levers;
    default: {
      const add = item.kind === 'add';
      push(operationModel(item, session), () => lever(OPERATION_MODEL_LEVER, 'help', 'both',
        add ? ['said_addend'] : ['said_start', 'said_change'],
        add ? 'The learner says one of the numbers being added, not how many altogether.'
          : 'The learner says how many there were, or how many were taken away, not how many are left.',
        add ? 'Shows a small model frame beside the item with a different adding problem in red and yellow, and its total. Never this problem.'
          : 'Shows a small model frame beside the item with a different take-away, the taken counters crossed out, and what is left. Never this problem.'));
      push(item.answer !== 5, () => five(['one_short', 'one_over']));
      push(smallerNumbers(item, band, session), () => lever(SMALLER_NUMBERS_LEVER, 'simplify', 'shown', ['short_by_more', 'over_by_more'],
        'The learner is far off with numbers this big.',
        `Opens the same kind of problem with smaller numbers first. ${back}`));
      return levers;
    }
  }
}

// ── What the pulled levers put on screen ───────────────────────────────────

export interface LeverView {
  /** The frame whose top row is outlined and marked 5, or -1. */
  five: number;
  models: ModelFrame[];
  /** decompose: the learner's own ways for this total. */
  ways: TenFrameSplit[];
  emptyGlow: boolean;
  hideEmpty: boolean;
  longLook: boolean;
  /** decompose_teen: the count of yellow counters. */
  yellowCount: boolean;
}

export function leverView(item: TenFrameItem | null, pulled: readonly string[], band: TenFrameBand, ctx: LeverContext = {}): LeverView {
  const on = new Set(tenFrameLevers(item, pulled, band, ctx).filter(l => l.pulled).map(l => l.id));
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

/** What the pulled levers on a non-build item put on screen, as a scene fact. Never the item's answer. */
export function leverFacts(item: TenFrameItem | null, pulled: readonly string[], band: TenFrameBand, ctx: LeverContext = {}): string {
  if (!item || BUILD_KINDS.includes(item.kind)) return '';
  const view = leverView(item, pulled, band, ctx);
  return [
    view.five >= 0 && 'The top row of the frame is outlined and marked 5.',
    ...view.models.map(m => `A small model ${m.whole === 5 ? 'five-frame' : 'frame'} beside the item shows: ${m.says}`),
    view.ways.length && `Beside the frame, the ways the learner already showed: ${view.ways.map(w => `${w.a} red and ${w.b} yellow`).join('; ')}.`,
    view.emptyGlow && 'The empty boxes on the frame pulse.',
    view.hideEmpty && 'During the quick look the empty boxes fade, so only the counters stand out.',
    view.longLook && 'The next quick look lasts twice as long.',
    view.yellowCount && 'Under the frames, a count shows how many counters are yellow.',
  ].filter((s): s is string => !!s).join(' ');
}
