/**
 * push-pull-arena's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken word the
 * tutor judges against its key. The card is `pushPullArena.card.ts`; this file holds the content check, the items, the
 * ask and key, the levers and the harness play.
 */
import type { PushPullArenaData } from './PushPullArena';
import { spokenBoss } from '../../../components/live-activity/boss';
import { pushPullArenaCard } from './pushPullArena.card';
import { ARENA_LEVERS, practiceFromId } from './pushPullArenaLevers';
import {
  askFor, itemsFromChallenges, pushPullArenaHarnessAnswers, pushPullArenaKey, pushPullSpokenMisses,
  type ArenaItem, type SpokenPushPullMiss,
} from './pushPullArenaDomain';

/** The session's items: one spoken word each; a challenge whose answer is not decisive is dropped. */
export const pushPullArenaItems = (d: PushPullArenaData): ArenaItem[] => itemsFromChallenges(d.challenges ?? [], d.supportTier);

/** Reject an arena with nothing decisive to ask: the build gates drop a predict on the friction boundary, a compare
 *  of equal weights, a design inside the murky band. What they drop stays dropped; the arena runs if anything is left. */
export function validatePushPullArenaData(value: unknown): PushPullArenaData {
  const d = value as PushPullArenaData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated push-pull arena has invalid lesson content.');
  if (!pushPullArenaItems(d).length) throw new Error('No push-pull arena challenge can be asked.');
  return d;
}

export const pushPullArenaBoss = spokenBoss<PushPullArenaData, ArenaItem, SpokenPushPullMiss>({
  card: pushPullArenaCard,
  validate: validatePushPullArenaData,
  items: pushPullArenaItems,
  levers: ARENA_LEVERS,
  speech: {
    ask: askFor,
    key: pushPullArenaKey,
    misses: pushPullSpokenMisses,
    say: pushPullArenaHarnessAnswers,
    // observe: the learner presses Go and watches the preset force before there is anything to say.
    before: (item, ctx) => (item.kind === 'observe' && ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Go!' }] : []),
  },
  drive: {
    component: 'primitives/visual-primitives/physics/PushPullArena.tsx',
    instanceId: 'arena',
    defaults: { grade: 'Grade 1', mode: 'observe', topic: 'Pushes and pulls move objects' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, pushPullArenaLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as PushPullArenaData;
      return pushPullArenaItems(data).find(i => i.id === ctx.itemId) ?? practiceFromId(ctx.itemId ?? '', data.challenges ?? []);
    },
  },
});
