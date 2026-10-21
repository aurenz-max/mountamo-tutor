/**
 * What the tutor and the observer read on a ten-frame item: the spoken key and known misses of a spoken item, the
 * miss a wrong placement shows, and the scene. Pure and React-free: the boss, the component and the probes read it.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, offByMisses, spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { numberWordFor } from './countingBoardDomain';
import { cap, isPairKind, isTeenKind, judgeSplit, teenTargetFor, type TenFrameItem } from './tenFrameDomain';
import type { FrameMiss } from './tenFrame.card';

export { TEN_FRAME_MISSES, type FrameMiss, type SpokenFrameMiss, type TenFrameMiss } from './tenFrame.card';

/** Challenge types whose catalog eval mode has a different name; every other type is its own mode. */
export const evalModeForKind = (kind: TenFrameItem['kind']): string =>
  kind === 'split' ? 'decompose' : kind === 'add' || kind === 'subtract' ? 'operate' : kind;

/** What a flip mode counts: the counters turned yellow, not the counters on the frame. */
export const countsFlips = (item: TenFrameItem) => item.kind === 'split' || item.kind === 'decompose_teen';

/** The committed placement in the learner's terms, as the tutor and the observer read it. `yellow` is build_pair's. */
export function describeFrameResponse(item: TenFrameItem, value: number, yellow = 0): string {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (item.kind === 'build_pair') return `${value - yellow} red and ${yellow} yellow on the frame (${n(value, 'counter')})`;
  if (item.kind === 'split') return `${item.answer - value} red and ${value} yellow`;
  if (item.kind === 'decompose_teen') return `${n(value, 'counter')} turned yellow`;
  if (item.kind === 'build_teen') return `${n(value, 'counter')} placed below the full ten`;
  if (item.kind === 'make_ten') return `${n(value, 'counter')} added to the ${item.shown} already on the frame`;
  return `${n(value, 'counter')} on the frame`;
}

/**
 * What a wrong placement shows (`TeachingAttempt.miss`), from the count the frame commits (`FrameMiss` in the card).
 * Only the observable pattern; why the learner did it is the tutor's and the distiller's to judge. Undefined for a
 * right placement or a spoken item.
 */
export function frameMiss(item: TenFrameItem | null, work: { placed: number; yellow?: number; shownWays?: ReadonlySet<string> }):
  FrameMiss | undefined {
  if (!item || item.answerKind !== 'gesture') return undefined;
  const { placed } = work;
  if (item.kind === 'build_pair' && placed === item.answer) {
    const verdict = judgeSplit(item, { a: placed - (work.yellow ?? 0), b: work.yellow ?? 0 }, work.shownWays);
    return verdict === 'repeat' ? 'same_way_again' : verdict === 'correct' ? undefined : 'one_colour';
  }
  if (item.kind === 'split') {
    const verdict = judgeSplit(item, { a: item.answer - placed, b: placed }, work.shownWays);
    if (verdict === 'repeat') return 'same_way_again';
    if (verdict === 'correct') return undefined;
    return placed <= 0 ? 'none_flipped' : 'all_flipped';
  }
  const target = isTeenKind(item.kind) ? teenTargetFor(item) : item.answer;
  const off = placed - target;
  if (off === 0) return undefined;
  if (off === -1) return 'one_short';
  if (off === 1) return 'one_over';
  if (off > 0 && item.kind === 'decompose_teen' && placed === item.answer) return 'all_flipped';
  if (off > 0 && (item.kind === 'build' || item.kind === 'build_teen' || item.kind === 'build_pair')
    && placed === item.capacity - item.shown) return 'filled_frame';
  return off < 0 ? 'short_by_more' : 'over_by_more';
}

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the numbers on this
 * frame first, then the off-by misses. Quick look is the pilot's (qa/tutor-reports/spoken-miss/, empty boxes first).
 */
export function tenFrameSpokenMisses(item: TenFrameItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const n = item.answer, size = item.capacity;
  switch (item.kind) {
    case 'subitize': return [...numberMisses(n, [{ id: 'empty_count', value: size - n,
      pattern: v => `The learner's answer is ${v}, the number of EMPTY boxes on the frame rather than the counters.` }]),
      ...offByMisses(n, `the ${n} counters shown`)];
    case 'make_ten': return [...numberMisses(n, [
      { id: 'said_shown', value: item.shown, pattern: v => `The learner's answer is ${v}, the counters already on the frame, not how many more make ${size}.` },
      { id: 'said_capacity', value: size, pattern: v => `The learner's answer is ${v}, the number to make, not how many more are needed.` }]),
      ...offByMisses(n, `the ${n} more counters that make ${size}`)];
    case 'add': {
      const addends = [item.addend1, item.addend2].filter((a): a is number => !!a && a !== n);
      return [...(addends.length ? [{ id: 'said_addend', pattern: `The learner's answer is ${Array.from(new Set(addends)).join(' or ')}, `
        + 'one of the two numbers being added, not how many altogether.', examples: addends.map(spokenNumber) }] : []),
        ...offByMisses(n, `the ${n} altogether`)];
    }
    case 'subtract': return [...numberMisses(n, [
      { id: 'said_start', value: item.shown, pattern: v => `The learner's answer is ${v}, how many counters there were before any were taken away.` },
      { id: 'said_change', value: item.removed, pattern: v => `The learner's answer is ${v}, how many counters were taken away, not how many are left.` }]),
      ...offByMisses(n, `the ${n} counters left`)];
    default: return offByMisses(n, `the answer ${n}`);
  }
}

const NOT_IT = 'A different number is not the answer, however close it is.';

/**
 * The key a spoken item is judged against (`spokenKeyText` writes it); null on an item answered on the frame, which
 * the frame checks. The accept rule and the signature error are the scripted pack's judging contract, kept, except that
 * a quick look accepts a count that ends on the answer, as the workspace always has.
 */
export function tenFrameKey(item: TenFrameItem): SpokenKey | null {
  if (item.answerKind !== 'voice') return null;
  const word = numberWordFor(item.answer);
  const counted = `Counting aloud and ending on ${word} is that answer: the last number said tells the total.`;
  switch (item.kind) {
    case 'subitize':
      // The workspace key has always been the number: a count from memory that ends on it is that answer (the
      // spoken-miss pilot reads it as right). The empty boxes are the wrong number that comes from the same look.
      return { answer: word, alsoAccept: [], acceptRule: counted,
        signatureError: `The number of empty boxes is not how many counters there were. ${NOT_IT}` };
    case 'make_ten':
      return { answer: word, alsoAccept: [], acceptRule: `"${word} more" or "${word} counters" is ${word}.`,
        signatureError: `${cap(numberWordFor(item.capacity))}, the number to make, said back is not how many more are `
          + `needed. ${NOT_IT}` };
    case 'add':
      return { answer: word, alsoAccept: [], acceptRule: counted,
        signatureError: `${cap(numberWordFor(item.addend1 ?? 0))} or ${numberWordFor(item.addend2 ?? 0)}, a number being `
          + `added, said back is not how many altogether. ${NOT_IT}` };
    case 'subtract': {
      const start = cap(numberWordFor(item.shown));
      return { answer: word, alsoAccept: [], acceptRule: counted,
        signatureError: (item.removed === item.answer
          ? `${start}, the number before any were taken away, is not how many are left; here the number taken away is `
            + `also ${word}, so ${word} is right. `
          : `${start}, the number before any were taken away, or ${numberWordFor(item.removed ?? 0)}, the number taken `
            + 'away, is not how many are left. ') + NOT_IT };
    }
    default: return null;
  }
}

/** What the ask says by design, which may be the answer too: a make-ten of five says "five", a take-away its numbers. */
export function tenFrameGiven(item: TenFrameItem): string[] {
  switch (item.kind) {
    case 'make_ten': return [item.shown, item.capacity].map(numberWordFor);
    case 'add': return [item.addend1 ?? 0, item.addend2 ?? 0].map(numberWordFor);
    case 'subtract': return [item.shown, item.removed ?? 0].map(numberWordFor);
    default: return [];
  }
}

export interface TenFrameView {
  onFrame: number;
  yellow: number;
  /** Subitize counters are off screen until presented and after the flash. */
  hidden: boolean;
}

/** The frame as the tutor reads it. Only this primitive's own facts: how to answer is the card's `moves`. */
export function workspaceScene(item: TenFrameItem, view: TenFrameView): SceneOf {
  return {
    objects: [],
    facts: {
      kind: item.kind, frameSize: item.capacity,
      // Counts only where the frame is what is asked about. Beside a spoken sum, "0 on the frame"
      // reads to the observer as contradicting a credited answer (the LA-13 `counted: 0` finding).
      ...(item.shown > 0 && item.kind !== 'subitize' ? { countersAtStart: item.shown } : {}),
      ...(item.answerKind === 'gesture' || item.kind === 'subitize'
        ? { countersOnFrame: view.hidden ? 'hidden' : view.onFrame } : {}),
      ...(countsFlips(item) ? { turnedYellow: view.yellow } : {}),
      // build_pair: the made pair as numbers, so `workHistory` records where each turned back.
      ...(item.kind === 'build_pair' ? { redOnFrame: view.onFrame - view.yellow, yellowOnFrame: view.yellow, makeTotal: item.answer } : {}),
      ...(isTeenKind(item.kind) ? { teenNumber: item.teenTotal ?? item.answer } : {}),
      ...(item.kind === 'add' ? { addends: `${item.addend1} and ${item.addend2}` } : {}),
      ...(item.kind === 'subtract' ? { takeAway: item.removed ?? 0 } : {}),
      constraints: item.kind === 'subitize'
        ? 'Quick look: call present when the learner is ready. The counters show briefly, then hide.'
        : isPairKind(item.kind)
          ? 'Any two colour groups that make the number are right, except a pair already shown for this number while '
            + 'another remains. Naming a pair, or how many of a colour to use, answers the item.'
          : '',
    },
  };
}
