/**
 * counting-board's boss, on the spoken preset (`components/live-activity/boss.ts`): eight modes are a spoken number
 * the tutor judges against the key; the hand match, the handover and the build have no key and the board checks
 * them, so they play through `show`. The card is `countingBoard.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { CountingBoardData } from './CountingBoard';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { countingBoardCard, type CountingBoardMiss } from './countingBoard.card';
import { COUNTING_LEVERS, practiceFromId } from './countingBoardLevers';
import {
  askFor, countingBoardHarnessAnswers, countingBoardSpokenMisses, countingKey, itemsFromChallenges, objectWordFor,
  type CountingItem,
} from './countingBoardDomain';

/**
 * The board's spoken noun, resolved as the component resolves it: a themed board carries its own plural, an enum
 * board falls back to the map, and `custom` without a triple lands on "objects" (contract R12).
 */
export const countingObjectWord = (board: Pick<CountingBoardData, 'objects'>) =>
  board.objects?.word || objectWordFor(board.objects?.type ?? 'custom');

/** The session's items, built through the family's own gate (an unaskable challenge is dropped). */
export const countingBoardItems = (board: CountingBoardData): CountingItem[] =>
  itemsFromChallenges(board.challenges ?? [], { objectWord: countingObjectWord(board), objectSingular: board.objects?.wordSingular });

/** Reject a board whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateCountingBoardData(value: unknown): CountingBoardData {
  const d = value as CountingBoardData;
  if (!d || typeof d.title !== 'string' || !d.objects || typeof d.objects.type !== 'string'
      || !['K', '1'].includes(d.gradeBand ?? '') || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.type !== 'string'
        || !Number.isInteger(c.count) || !Number.isInteger(c.targetAnswer)))
    throw new Error('Generated counting board has invalid lesson content.');
  if (countingBoardItems(d).length !== d.challenges.length) throw new Error('A counting-board challenge cannot run in the live lesson.');
  return d;
}

const touch = (index: number): DriverInput => ({ type: 'touch', target: `object-${index}` });
const range = (from: number, n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => from + i);
const done = (ctx: { demand?: Record<string, unknown> | null }, fact: string) => Number(ctx.demand?.[fact] ?? 0);

export const countingBoardBoss = spokenBoss<CountingBoardData, CountingItem, CountingBoardMiss>({
  card: countingBoardCard,
  validate: validateCountingBoardData,
  items: countingBoardItems,
  levers: COUNTING_LEVERS,
  speech: {
    ask: askFor,
    // The hand, the handover and the build have no key: the board checks them, and their misses come from that check.
    key: countingKey,
    misses: countingBoardSpokenMisses,
    say: item => { const { correct, plainWrong } = countingBoardHarnessAnswers(item); return { correct, plainWrong }; },
    // The board work a spoken item asks for before there is a number to say, when it is not done yet.
    before: (item, ctx) => {
      if (item.kind === 'take_away') return range(done(ctx, 'takenOff'), (item.changeBy ?? 0) - done(ctx, 'takenOff')).map(touch);
      if (item.kind === 'add_more') return range(item.count + done(ctx, 'putOn'), (item.changeBy ?? 0) - done(ctx, 'putOn')).map(touch);
      if (item.kind === 'recount_moved' && ctx.demand?.moved !== 'yes') return range(0, item.count).map(touch);
      return [];
    },
    // The board's own items through its real controls: a hand by its finger count, a handover object by object.
    show: (right, item) => {
      const placed = countingBoardHarnessAnswers(item).placed!;
      const n = right ? placed.correct : placed.wrong;
      if (item.kind === 'subitize_perceptual') return [{ type: 'touch', target: `hand-${n}` }];
      if (item.kind === 'give_me_n') return [...range(0, n).map(touch), { type: 'choose', label: 'Give them to me' }];
      throw new Error(`counting-board ${item.kind}: the driver has no input that puts objects into an open scene`);
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/CountingBoard.tsx',
    instanceId: 'board',
    defaults: { grade: 'Kindergarten', mode: 'give_me_n', topic: 'Giving a requested number of objects from a larger collection' },
    // The board's Pip region: always drawn, also on a quick look whose objects are hidden.
    mounted: '[data-pip-object="workspace"]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
    // The session item, or an easier practice item (`~smaller`, `~simpler`) rebuilt from its parent.
    current: ctx => {
      const items = countingBoardItems(ctx.data as CountingBoardData);
      return items.find(i => i.id === ctx.itemId) ?? practiceFromId(ctx.itemId ?? '', items) ?? undefined;
    },
  },
});
