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

/** The step's own ask; a spoken step publishes its number, the trade does not. */
export function diWorkspaceAssignment(item: BaseTenItem): TeachingAssignment {
  const task = item.actionContract.instruction;
  if (item.answerKind === 'gesture') return { id: item.id, task, response: 'gesture' };
  return { id: item.id, task, response: 'speech', expectedAnswer: String(spokenAnswer(item)) };
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
