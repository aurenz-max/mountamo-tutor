/**
 * food-web-builder's boss (`components/live-activity/boss.ts`), bespoke because both modes are arrows the learner
 * draws and the activity checks: the card is `foodWebBuilder.card.ts`; this file validates a lesson, lists its items,
 * asks one, carries the lever set and plays the harness.
 */
import type { FoodWebBuilderData, FoodWebChallenge } from './FoodWebBuilder';
import { defineBoss } from '../../../components/live-activity/boss';
import { WEB_ITEM, feedingChains, feedingRelations, foodWebAsk, foodWebHarnessInputs, foodWebItems } from './foodWebWorkspace';
import { FOOD_WEB_LEVERS, shorterChain, smallerWeb } from './foodWebLevers';
import { foodWebBuilderCard, type FoodChainMiss, type FoodWebMiss } from './foodWebBuilder.card';

/** The food web as the live adapter reads it: its ecosystem is the workspace title. */
export type FoodWebBossData = FoodWebBuilderData & { title: string };

/**
 * Reject a food web that cannot be attempted: no organisms or feeding relations, an arrow to an unknown organism, or
 * (build_chain) a chain target the lesson's own feeding relations cannot make.
 */
export function validateFoodWebBuilderData(value: unknown): FoodWebBossData {
  const d = value as FoodWebBuilderData;
  if (!d || typeof d.ecosystem !== 'string' || !Array.isArray(d.organisms) || d.organisms.length < 2
      || !Array.isArray(d.correctConnections) || !d.correctConnections.length)
    throw new Error('Generated food web has invalid lesson content.');
  const ids = new Set(d.organisms.map(o => o?.id));
  if (d.correctConnections.some(c => !ids.has(c?.fromId) || !ids.has(c?.toId)))
    throw new Error('A generated food web arrow names an organism that is not in the web.');
  if (d.challengeType === 'build_chain') {
    const chains = feedingChains(d.organisms, feedingRelations(d.organisms, d.correctConnections), 8);
    const items = d.challenges ?? [];
    if (!items.length || items.length > 8 || new Set(items.map(c => c?.id)).size !== items.length)
      throw new Error('Generated food chain lesson has no askable chains.');
    for (const c of items) {
      if (c?.type !== 'build_chain' || !chains.some(p => p.length === c.length && p[p.length - 1] === c.endId))
        throw new Error(`A food chain target (${c?.id}) cannot be built from this web's feeding relations.`);
    }
  }
  return { ...d, title: d.ecosystem };
}

export const foodWebBuilderBoss = defineBoss<FoodWebBossData, FoodWebChallenge, FoodChainMiss | FoodWebMiss>({
  card: foodWebBuilderCard,
  validate: validateFoodWebBuilderData,
  items: foodWebItems,
  ask: (c, d) => foodWebAsk(c, d.ecosystem),
  // The ask needs the lesson's ecosystem, so the component builds each gesture assignment from `ask` (no key).
  levers: FOOD_WEB_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/biology/FoodWebBuilder.tsx',
    instanceId: 'food-web',
    defaults: { grade: 'Grade 5', mode: 'build_chain', topic: 'Food chains: energy moves from producers to consumers' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~shorter`, `~smaller`), rebuilt from its
    // parent with the same builder.
    current: ctx => {
      const d = ctx.data as FoodWebBuilderData;
      const itemId = String(ctx.itemId ?? '');
      if (itemId.endsWith('~smaller')) return smallerWeb(WEB_ITEM, d.organisms ?? [], d.correctConnections ?? []) ?? undefined;
      const items = foodWebItems(d);
      const parent = items.find(c => `${c.id}~shorter` === itemId);
      if (parent) return shorterChain(parent, d.organisms ?? [], feedingRelations(d.organisms ?? [], d.correctConnections ?? [])) ?? undefined;
      return items.find(c => c.id === itemId) ?? (d.challengeType === 'build_chain' ? undefined : WEB_ITEM);
    },
    // build_chain clears a kept scene, puts in a chain the lesson's relations make, draws its arrows and presses I'm
    // done! (wrong: every arrow turned round). complete_web taps each relation food then eater and presses Check (wrong:
    // the first turned round).
    play: (right, c, ctx) => foodWebHarnessInputs(ctx.data as never, c, !right, ctx.demand),
  },
});
