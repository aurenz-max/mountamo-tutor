/**
 * Base-ten blocks on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B1).
 *
 * Pure: the components and the journey read the same assignment and scene. The family has
 * two surfaces, chosen by the payload (`usesBaseTenDi`), and each binds on its own:
 *   - the judged mat (`read_blocks`, `regroup`; BaseTenBlocksDi), whose items come from
 *     `itemsFromChallenges` in baseTenScript.ts. Its spoken steps are judged against the
 *     number they ask for; the trade is a tap checked in code, so its key is not published.
 *   - the click-era mat (`build_number`, `operate`, and any mixed payload; BaseTenBlocks),
 *     plain shape: its own Check My Blocks / Check My Trade / keypad stays the judge.
 * The workspace is both surfaces' only teaching path (the scripted path was deleted, LA-14).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberMisses, offByMisses, spokenNumber, type KnownMiss, type OffByMiss }
  from '../../../components/live-activity/runtime/spokenMissContract';
import type { BaseTenItem } from './baseTenScript';
import {
  blockNoun,
  blockNounPlural,
  occupiedPlaces,
  placeValueOf,
  predictedCount,
  readCount,
  tradeSolved,
  type BtColumns,
} from './baseTenModel';

// ── The judged mat (read_blocks, regroup) ───────────────────────────────────

/** The number a spoken step asks for, as the observer judges it. */
export function spokenAnswer(item: BaseTenItem): number {
  switch (item.step) {
    case 'count': return readCount(item.problem);
    case 'worth': return readCount(item.problem) * placeValueOf(item.problem.place);
    default: return predictedCount(item.problem);
  }
}

/** What a wrong spoken number on the judged mat shows (handoff 20 Part B). */
export type SpokenBaseTenMiss = OffByMiss | 'said_value' | 'said_count' | 'said_total' | 'other_block_count' | 'one_block_off'
  | 'said_ten' | 'said_start';

/**
 * A spoken step's known wrong answers, in precedence order, for the `spoken_miss` observer: the numbers on this
 * mat (the value for the count, the count for the value, the ten the trade makes), then the off-by misses.
 */
export function baseTenSpokenMisses(item: BaseTenItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const { problem } = item, answer = spokenAnswer(item), p = problem.place, count = readCount(problem);
  const many = blockNounPlural(p), unit = placeValueOf(p);
  if (item.step === 'predict') {
    const lower = blockNounPlural(p - 1), before = problem.start[p - 1] ?? 0;
    return [...numberMisses(answer, [
      { id: 'said_ten', value: 10, pattern: n => `Breaking one ${blockNoun(p, 1)} makes ${n} ${lower}, and ${before} are already on the mat. `
        + `The learner's answer is ${n}, only the new ${lower}, without the ${before} already there.` },
      { id: 'said_start', value: before, pattern: n => `The mat has ${n} ${lower} before the trade. The learner's answer is ${n}, the ${lower} before the trade, with none added.` }]),
      ...offByMisses(answer, `the ${answer} ${lower} after the trade`)];
  }
  const others = occupiedPlaces(problem.start).filter(q => q !== p).map(q => problem.start[q] ?? 0)
    .filter(n => n >= 1 && n !== answer && n !== count && n !== count * unit);
  const other: KnownMiss[] = others.length ? [{ id: 'other_block_count', pattern: `The mat also has other blocks: `
    + `${occupiedPlaces(problem.start).filter(q => q !== p).map(q => `${problem.start[q]} ${blockNoun(q, problem.start[q] ?? 0)}`).join(', ')}. `
    + `The learner's answer is ${Array.from(new Set(others)).join(' or ')}, the count of another kind of block, not the ${many}.`,
    examples: Array.from(new Set(others)).map(spokenNumber) }] : [];
  const total = { id: 'said_total', value: problem.target >= 10 ? problem.target : undefined,
    pattern: (n: number) => `All the blocks on the mat together make ${n}. The learner's answer is ${n}, the whole mat, not only the ${many}.` };
  if (item.step === 'count') return [...numberMisses(answer, [
    { id: 'said_value', value: count * unit, pattern: n => `The ${count} ${blockNoun(p, count)} are worth ${n}. The learner's answer is ${n}, what the blocks are worth, not how many blocks there are.` },
    total]), ...other, ...offByMisses(answer, `the ${answer} ${many} on the mat`)];
  const near = [count - 1, count + 1].filter(n => n >= 1).map(n => n * unit);
  return [...numberMisses(answer, [
    { id: 'said_count', value: count, pattern: n => `There are ${n} ${blockNoun(p, n)}. The learner's answer is ${n}, how many blocks there are, not what they are worth.` },
    total]), ...other,
    ...(unit > 1 ? [{ id: 'one_block_off', pattern: `The learner's answer is ${near.join(' or ')}, what one ${blockNoun(p, 1)} fewer or one more than the ${count} on the mat would be worth.`,
      examples: near.map(spokenNumber) }] : offByMisses(answer, `the ${answer} ${many} on the mat`))];
}

/** The step's own ask; a spoken step publishes its number, the trade does not. */
export function diWorkspaceAssignment(item: BaseTenItem): TeachingAssignment {
  const task = item.actionContract.instruction;
  if (item.answerKind === 'gesture') return { id: item.id, task, response: 'gesture' };
  const misses = baseTenSpokenMisses(item);
  return { id: item.id, task, response: 'speech', expectedAnswer: String(spokenAnswer(item)), ...(misses.length ? { misses } : {}) };
}

/** The mat in the learner's terms, largest block first. */
export const describeMat = (columns: BtColumns) => {
  const parts = [...occupiedPlaces(columns)].sort((a, b) => b - a)
    .map(place => `${columns[place]} ${blockNoun(place, columns[place] ?? 0)}`);
  return parts.length ? parts.join(', ') : 'no blocks';
};

/** The trade the learner committed, checked in code with the pack's own rule. */
export const tradeMatches = (item: BaseTenItem, columns: BtColumns) => tradeSolved(item.problem, columns);
export const describeTrade = (columns: BtColumns) => `Mat after the taps: ${describeMat(columns)}`;

/**
 * What a wrong answer on either mat shows (`TeachingAttempt.miss`, handoff 20). Only the observable pattern:
 * - a value built or typed: `digits_swapped` (the target's digits in reverse, 21 for 12), `one_short` /
 *   `one_over` (one of the smallest block), `one_ten_off` (ten of the smallest block, either way),
 *   `short_by_more` / `over_by_more`;
 * - build_number: `not_traded_up` (the right value, but a place holds ten or more);
 * - a trade: `no_trade` (checked before any trade), `value_changed` (blocks added or removed as well),
 *   `other_block` (a different size broken down), `traded_twice` (more than one of the asked block broken).
 */
export type BaseTenMiss = 'digits_swapped' | 'one_short' | 'one_over' | 'one_ten_off' | 'short_by_more' | 'over_by_more'
  | 'not_traded_up' | 'no_trade' | 'value_changed' | 'other_block' | 'traded_twice';

/** The judged mat's trade: the only wrong commit is a tap on the wrong block, or too many taps. */
export function tradeMiss(item: BaseTenItem | null, mat: BtColumns): BaseTenMiss | undefined {
  if (!item || item.step !== 'trade' || tradeSolved(item.problem, mat)) return undefined;
  const { place, start } = item.problem;
  return (mat[place] ?? 0) <= (start[place] ?? 0) - 2 ? 'traded_twice' : 'other_block';
}

/**
 * The click mat's check. `got` is the blocks' total (blocks) or the typed number (keypad); `unit` is the
 * smallest place's value; `standard` whether the columns are the target's standard form (build_number).
 */
export function plainMiss(type: string, work: { got: number; target: number; unit: number; trades: number; standard?: boolean }):
  BaseTenMiss | undefined {
  const { got, target, unit } = work;
  const near = (a: number, b: number) => Math.abs(a - b) < unit / 2;
  if (type === 'regroup') return work.trades === 0 ? 'no_trade' : near(got, target) ? undefined : 'value_changed';
  if (near(got, target)) return type === 'build_number' && work.standard === false ? 'not_traded_up' : undefined;
  if (Number.isInteger(target) && target >= 10 && String(got) === String(target).split('').reverse().join('')) return 'digits_swapped';
  // In smallest blocks, rounded so decimal mats compare exactly.
  const off = Math.round((got - target) / unit);
  if (off === -1) return 'one_short';
  if (off === 1) return 'one_over';
  if (Math.abs(off) === 10) return 'one_ten_off';
  return off < 0 ? 'short_by_more' : 'over_by_more';
}

export function diWorkspaceScene(item: BaseTenItem, view: { mat: BtColumns }): WorkspaceScene {
  const { problem } = item;
  if (problem.mode === 'read_blocks') {
    return { objects: [], facts: {
      kind: 'read_blocks', step: item.step, askedBlocks: blockNounPlural(problem.place),
      // The counts are the answers, so the mat prints none and this names none.
      constraints: 'The learner says the answer. The mat shows the blocks with no counts, values or total printed.',
    } };
  }
  const trade = `one ${blockNoun(problem.place, 1)} for ten ${blockNounPlural(problem.place - 1)}`;
  if (item.step === 'predict') {
    return { objects: [], facts: { kind: 'regroup', step: 'predict', trade,
      constraints: 'The learner says a prediction while the mat is still untraded.' } };
  }
  return { objects: [], facts: { kind: 'regroup', step: 'trade', trade, matNow: describeMat(view.mat),
    constraints: 'The learner taps a block to break it into ten of the next size down, and can put the blocks back. '
      + 'The mat checks the trade itself once the learner stops tapping.' } };
}

// ── The click-era mat (build_number, operate) ───────────────────────────────

export interface PlainBaseTenChallenge { id: string; type: string; instruction: string }

/** Blocks, a trade or the keypad: the primitive's own check is the judge, so no key is published. */
export const plainWorkspaceAssignment = (challenge: PlainBaseTenChallenge): TeachingAssignment =>
  ({ id: challenge.id, task: challenge.instruction, response: 'gesture' });

/** Which control carries the answer (BT-4): the blocks where the value is on screen, else the keypad. */
export const blocksAreTheAnswer = (type: string) => type === 'build_number' || type === 'regroup';

export interface PlainBaseTenView {
  /** The columns in words ("1 ten and 2 ones"). */
  blocks: string;
  typed: string;
  trades: number;
}

/** The learner's checked work in their terms, never the key. */
export function describePlainCheck(challenge: PlainBaseTenChallenge, view: PlainBaseTenView): string {
  if (!blocksAreTheAnswer(challenge.type)) return `Typed ${view.typed || 'nothing'}`;
  return `Checked the blocks: ${view.blocks}${view.trades ? ` after ${view.trades} trade${view.trades === 1 ? '' : 's'}` : ''}`;
}

const PLAIN_CONSTRAINTS: Record<string, string> = {
  build_number: 'The learner adds or removes blocks, can trade ten of one size for one of the next, and presses '
    + 'Check My Blocks. The mat checks for the number in standard form itself.',
  regroup: 'The learner makes a trade with the trade buttons and presses Check My Trade. The mat checks it itself.',
  read_blocks: 'The learner types the number the blocks show on the keypad; the activity checks it. The column counts '
    + 'and total are hidden because they are the answer.',
};

export function plainWorkspaceScene(challenge: PlainBaseTenChallenge, view: PlainBaseTenView): WorkspaceScene {
  return { objects: [], facts: {
    kind: challenge.type,
    // What the learner built is their work; on read_blocks the mat is the answer and is not described.
    ...(challenge.type === 'read_blocks' ? {} : { learnerBlocks: view.blocks }),
    constraints: PLAIN_CONSTRAINTS[challenge.type]
      ?? 'The learner may work with the blocks, then types the result on the keypad; the activity checks it.',
  } };
}
