/**
 * distribution-explorer's boss (`components/live-activity/boss.ts`), bespoke because explore is a manipulation of the
 * workbench beside three tapped modes, every one checked by the activity: the card is `distributionExplorer.card.ts`;
 * this file validates a lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 */
import type { DistributionChallenge, DistributionExplorerData } from './types';
import { FAMILIES } from '../../lib/probability';
import { bossAssignment, defineBoss } from '../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../components/live-activity/liveJourneySpec';
import {
  distributionAsk, distributionChoices, distributionCorrect, distributionHarnessChoice, distributionHarnessSlider,
} from './distributionExplorerWorkspace';
import { DISTRIBUTION_LEVERS, practiceItem, practiceParent } from './distributionExplorerLevers';
import { distributionExplorerCard, type DistributionMiss } from './distributionExplorer.card';

const TYPES = ['guided_exploration', 'identify', 'compute', 'predict_shape'];
const isKey = (ch: DistributionChallenge, picked: string) =>
  distributionCorrect(ch, { picked, explored: false, family: 'binomial', params: {} });

/**
 * An item its own check can answer: a guided exploration always can; a choice item needs exactly one choice the check
 * credits, at least two choices, and labels that differ on screen (two values that format alike cannot be told apart).
 */
function answerable(ch: DistributionChallenge): boolean {
  if (ch.type === 'guided_exploration') return true;
  if (ch.type === 'identify' && !(ch.correctFamily in FAMILIES)) return false;
  const choices = distributionChoices(ch);
  return choices.length >= 2 && new Set(choices.map(c => c.label)).size === choices.length
    && choices.filter(c => isKey(ch, c.key)).length === 1;
}

/** Reject a distribution-explorer lesson whose challenges cannot be attempted. */
export function validateDistributionExplorerData(value: unknown): DistributionExplorerData {
  const d = value as DistributionExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !d.initial || !(d.initial.family in FAMILIES)
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.prompt !== 'string' || !c.prompt.trim()))
    throw new Error('Generated distribution explorer has invalid lesson content.');
  for (const c of d.challenges) {
    if (!answerable(c)) throw new Error(`A distribution-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session challenge, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): DistributionChallenge | undefined {
  const all = (ctx.data as DistributionExplorerData).challenges ?? [];
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const parent = all.find(c => c.id === parentId);
  return parent && parentId !== ctx.itemId ? practiceItem(parent) ?? undefined : parent;
}

/**
 * Every mode through its real controls. A choice item: the choice's button (its aria-label), then Check; a wrong answer
 * is the first other choice on screen. Explore: the first slider moved to a new value (read from the scene's workbench
 * fact), then Got it; a wrong answer is Got it with nothing moved.
 */
function play(right: boolean, c: DistributionChallenge, ctx: JourneyContext): DriverInput[] {
  if (c.type === 'guided_exploration') {
    if (!right) return [{ type: 'choose', label: 'Got it' }];
    const slider = distributionHarnessSlider(String(ctx.demand?.workbench ?? ''));
    if (!slider) throw new Error('distribution-explorer explore: no slider in the scene');
    return [{ type: 'write', label: slider.label, text: slider.text }, { type: 'choose', label: 'Got it' }];
  }
  const label = distributionHarnessChoice(c, right ? 'correct' : 'wrong');
  if (!label) throw new Error(`distribution-explorer ${c.type}: no choice to press`);
  return [{ type: 'choose', label }, { type: 'check' }];
}

export const distributionExplorerBoss = defineBoss<DistributionExplorerData, DistributionChallenge, DistributionMiss>({
  card: distributionExplorerCard,
  validate: validateDistributionExplorerData,
  items: d => d.challenges,
  ask: c => distributionAsk(c),
  // A family, value or shape tapped, or the workbench moved, the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, distributionAsk(c), null),
  levers: DISTRIBUTION_LEVERS,
  drive: {
    component: 'primitives/DistributionExplorer.tsx',
    instanceId: 'distribution',
    defaults: { grade: 'Grade 11', mode: 'identify', topic: 'Binomial and Poisson distributions' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
  },
});
