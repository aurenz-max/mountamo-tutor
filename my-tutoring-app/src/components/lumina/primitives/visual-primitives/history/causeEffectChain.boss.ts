/**
 * cause-effect-chain's boss, on the spoken preset (`components/live-activity/boss.ts`): find the causes and root or
 * right before are spoken answers the tutor judges against `causeEffectKey`; a chain has no key (the board checks the
 * order, and the tutor is never told it), so the harness plays it through `show`. The card is
 * `causeEffectChain.card.ts`; this file holds the content check, the items, the ask and key, the levers and the
 * harness play.
 */
import type { CauseEffectChainData } from './CauseEffectChain';
import { spokenBoss } from '../../../components/live-activity/boss';
import { causeEffectChainCard, type ChainMiss, type SpokenChainMiss } from './causeEffectChain.card';
import { CHAIN_LEVERS, practiceItem, practiceParent, type ChainSession } from './causeEffectChainLevers';
import {
  askFor, askGiven, causeEffectHarnessAnswers, causeEffectItems, causeEffectKey, causeEffectSpokenMisses, chainOrderFor,
  placeLabel, type CauseEffectChainItem,
} from './causeEffectChainDomain';

/** Reject a lesson with nothing askable: the build gates drop an unspeakable card, an identify chain with no
 *  non-cause, a chain page with a stray non-cause, and a root pick whose cards cannot be told apart by ear. */
export function validateCauseEffectChainData(value: unknown): CauseEffectChainData {
  const d = value as CauseEffectChainData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated cause-effect chain has invalid lesson content.');
  if (!causeEffectItems(d).length) throw new Error('No cause-effect chain question can be asked.');
  return d;
}

/** The lever session for a payload: the shape the component, the boss and the tests build. */
export const chainSession = (data: Pick<CauseEffectChainData, 'challenges' | 'periodLabel' | 'gradeLevel' | 'supportTier'>,
  items: readonly CauseEffectChainItem[] = causeEffectItems(data)): ChainSession =>
  ({ items, gradeLevel: data.gradeLevel, tier: data.supportTier });

export const causeEffectChainBoss = spokenBoss<CauseEffectChainData, CauseEffectChainItem, ChainMiss | SpokenChainMiss>({
  card: causeEffectChainCard,
  validate: validateCauseEffectChainData,
  items: causeEffectItems,
  levers: CHAIN_LEVERS,
  speech: {
    ask: askFor,
    // A chain has no key: the board checks the order.
    key: causeEffectKey,
    given: askGiven,
    misses: causeEffectSpokenMisses,
    say: causeEffectHarnessAnswers,
    // The cards tapped into the slots in causal order, or reversed (the ordering mode's own signature error).
    show: (right, item) => {
      if (item.kind !== 'build_chain') throw new Error(`cause-effect-chain: item ${item.id} is said, not built`);
      return chainOrderFor(item, right).map(id => ({ type: 'choose' as const, label: placeLabel(item.cards.find(c => c.id === id)!) }));
    },
  },
  drive: {
    component: 'primitives/visual-primitives/history/CauseEffectChain.tsx',
    instanceId: 'cause-effect-chain',
    defaults: { grade: 'Grade 3', mode: 'build_chain', topic: 'How the railroad changed a river town' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, causeEffectChainLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as CauseEffectChainData;
      const all = causeEffectItems(data);
      const parent = ctx.itemId ? practiceParent(String(ctx.itemId), all) : null;
      return parent ? practiceItem(parent, chainSession(data, all)) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});
