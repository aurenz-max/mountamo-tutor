/**
 * base-ten-blocks' boss (`components/live-activity/boss.ts`), bespoke and stepped: the card is `baseTenBlocks.card.ts`.
 * A read_blocks or regroup session runs on the spoken mat, whose items are steps: the count, worth and predict steps
 * are spoken numbers the tutor judges against their key, the trade is a tap the mat checks. Every other payload runs on
 * the click mat, whose items are the challenges, each checked by the mat. Bespoke rather than `spokenBoss` because the
 * microphone is per mode (the catalog's `audioInputByMode`): the spoken preset sets it for every mode, and the click
 * mat must keep the default turn-taking. This file holds the content check, the items, the ask and key, the levers and
 * the harness play.
 */
import type { BaseTenBlocksData } from './BaseTenBlocks';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { baseTenBlocksCard, type BaseTenBlocksMiss } from './baseTenBlocks.card';
import { BASE_TEN_LEVERS, FEWER_LEVER, SMALL_START_LEVER, practiceFromId, problemsOf, spokenPracticeItem } from './baseTenLevers';
import { blockNoun, blockNounPlural, readCount, type BtMode } from './baseTenModel';
import { baseTenHarnessAnswers, itemsFromChallenges, usesBaseTenDi, wrongTradePlace, type BaseTenItem } from './baseTenScript';
import { baseTenAsk, baseTenGiven, baseTenKey, baseTenSpokenMisses, baseTenStepOf, clickItemsOf, isSpokenItem,
  type BaseTenBlocksItem, type BaseTenClickItem } from './baseTenWorkspace';

const CHALLENGE_TYPES = ['build_number', 'read_blocks', 'regroup', 'add_with_blocks', 'subtract_with_blocks', 'build_two_ways'];

/** The session's items, built exactly as the components build them: the spoken mat's steps, or the click mat's challenges. */
export function baseTenBlocksItems(d: Pick<BaseTenBlocksData, 'challenges' | 'supportTier'>): BaseTenBlocksItem[] {
  const challenges = d.challenges ?? [];
  return usesBaseTenDi(challenges)
    ? itemsFromChallenges(challenges, challenges[0].type as BtMode, d.supportTier)
    : clickItemsOf(challenges);
}

/** Reject a mat whose challenges cannot be asked before it reaches a child. */
export function validateBaseTenData(value: unknown): BaseTenBlocksData {
  const d = value as BaseTenBlocksData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !d.challenges.every(c => c && CHALLENGE_TYPES.includes(c.type) && typeof c.instruction === 'string'
        && typeof c.targetNumber === 'number' && Number.isFinite(c.targetNumber)))
    throw new Error('Generated base-ten blocks has invalid lesson content.');
  // A read/regroup payload the spoken mat cannot ask (every number dropped) falls back to the click mat, which still
  // checks it, so only a payload with nothing at all is refused above.
  return d;
}

const ask = (item: BaseTenBlocksItem) => baseTenAsk(item);

/** The current item: the session item, or the easier practice item a simplify lever opened, rebuilt from its parent. */
function currentItem(ctx: JourneyContext): BaseTenBlocksItem | undefined {
  const items = baseTenBlocksItems(ctx.data as BaseTenBlocksData);
  const itemId = String(ctx.itemId ?? '');
  const found = items.find(i => i.id === itemId);
  if (found || !itemId.includes('~')) return found;
  const parent = items.find(i => i.id === itemId.split('~')[0]);
  if (!parent) return undefined;
  if (!isSpokenItem(parent)) return practiceFromId(parent, itemId) ?? undefined;
  const problems = problemsOf(items);
  return spokenPracticeItem(parent, FEWER_LEVER, problems) ?? spokenPracticeItem(parent, SMALL_START_LEVER, problems) ?? undefined;
}

const COLUMNS = ['Thousands', 'Hundreds', 'Tens', 'Ones'];
const digitsOf = (n: number) => String(n).padStart(4, '0').split('').map(Number);
const press = (label: string): DriverInput => ({ type: 'choose', label });
const presses = (digits: number[]) => COLUMNS.flatMap((column, i) => Array.from({ length: digits[i] }, () => press(`Add one to ${column}`)));

/** The spoken mat's trade: tap the asked block (wrong: another size, or the asked size twice). */
function playTrade(right: boolean, item: BaseTenItem): DriverInput[] {
  const tap = (place: number) => press(`Trade one ${blockNoun(place, 1)} for ten ${blockNounPlural(place - 1)}`);
  if (right) return [tap(item.problem.place)];
  const other = wrongTradePlace(item.problem);
  if (other >= 1) return [tap(other)];
  if (readCount(item.problem) >= 2) return [tap(item.problem.place), tap(item.problem.place)];
  throw new Error('base-ten-blocks regroup: this mat has no wrong trade the driver can tap');
}

/**
 * The click mat. build_number presses each column's "Add one to ..." (wrong: a ten left as ten ones), then Check My
 * Blocks; build_two_ways builds, I'm done, swaps one block for ten smaller and I'm done again (wrong: a ten short);
 * a mixed payload's regroup trades with the buttons, then Check My Trade (wrong: no trade); operate types the result
 * on the keypad (wrong: a ten off; on addition after modelling both numbers), then the check key.
 */
function playClick(right: boolean, c: BaseTenClickItem, data: BaseTenBlocksData): DriverInput[] {
  const wrong = !right;
  if (data.decimalMode) throw new Error(`base-ten-blocks ${c.type}: decimal mats are not driven`);
  if (c.type === 'build_number') {
    const digits = digitsOf(c.targetNumber);
    if (wrong && digits[2] > 0) { digits[2] -= 1; digits[3] += 10; } else if (wrong) digits[3] += 1;
    return [...presses(digits), press('Check My Blocks')];
  }
  if (c.type === 'build_two_ways') {
    // Correct: clear the mat (Try again keeps the build), build the standard form, I'm done (the first way, no commit),
    // then swap the largest block for ten of the next size and I'm done.
    const digits = digitsOf(c.targetNumber);
    if (wrong && digits[2] > 0) digits[2] -= 1; else if (wrong) digits[3] += 1;
    const done = press("I'm done!");
    if (wrong) return [...presses(digits), done];
    const top = digits.findIndex(d => d > 0);
    if (top < 0 || top === 3) throw new Error(`base-ten-blocks build_two_ways ${c.targetNumber}: no block above the ones to swap`);
    const swap = [press(`Take one from ${COLUMNS[top]}`), ...Array.from({ length: 10 }, () => press(`Add one to ${COLUMNS[top + 1]}`))];
    return [press('Reset'), ...presses(digits), done, ...swap, done];
  }
  if (c.type === 'regroup') {
    const digits = digitsOf(c.targetNumber);
    const from = digits.findIndex((d, i) => d > 0 && i < 3);
    if (from < 0) throw new Error(`base-ten-blocks regroup ${c.targetNumber}: no block above the ones to break`);
    return [...(wrong ? [] : [press(`1 → 10 ${COLUMNS[from + 1].slice(0, 4)}`)]), press('Check My Trade')];
  }
  // read_blocks on the click mat types the number the blocks show; operate types the result.
  const add = c.type === 'add_with_blocks';
  const second = c.secondNumber ?? 0;
  const modelled = wrong && add ? [c.targetNumber - second, second].flatMap(n => presses(digitsOf(n))) : [];
  const typed = String(wrong ? c.targetNumber + (add ? -10 : 10) : c.targetNumber);
  return [...modelled, ...typed.split('').map(press), press('✓')];
}

export const baseTenBlocksBoss = defineBoss<BaseTenBlocksData, BaseTenBlocksItem, BaseTenBlocksMiss>({
  card: baseTenBlocksCard,
  validate: validateBaseTenData,
  items: baseTenBlocksItems,
  ask,
  // A spoken step carries its key and known misses; a trade and every click-mat item has none: the mat checks them.
  assignment: item => bossAssignment(item.id, ask(item), baseTenKey(item), baseTenSpokenMisses(item)),
  spoken: { key: baseTenKey, given: baseTenGiven },
  stepOf: baseTenStepOf,
  levers: BASE_TEN_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/BaseTenBlocks.tsx',
    instanceId: 'blocks',
    defaults: { grade: 'Grade 1', mode: 'build_number', topic: 'Building two-digit numbers with tens and ones' },
    mounted: '[data-base-ten-mat]',
    current: currentItem,
    play: (right, item, ctx) => {
      if (!isSpokenItem(item)) return playClick(right, item, ctx.data as BaseTenBlocksData);
      if (item.answerKind === 'gesture') return playTrade(right, item);
      const answers = baseTenHarnessAnswers(item);
      return [{ type: 'answer', text: right ? answers.correct : answers.plainWrong }];
    },
  },
});
