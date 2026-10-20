/**
 * stoichiometry-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): a which-runs-out-first item is
 * one choice from a menu the ask says in full, and a how-much-forms item one number; the learner says it (the tutor
 * judges the words against the key) or taps or types it and checks (the activity judges it), two SAY_OR_SHOW modes. A
 * conversion-chain item has no key: the learner places factor cards and the activity checks the chain, and it plays
 * through `show`. The card is `stoichiometryLab.card.ts`; this file holds the content check, the items, the ask and key,
 * the levers and the harness play.
 */
import type { StoichiometryLabData } from './StoichiometryLab';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { stoichiometryLabCard } from './stoichiometryLab.card';
import { easierItem, practiceParent, STOICH_LEVERS } from './stoichiometryLabLevers';
import {
  askOf, BOTH, convertValue, fmt, limitingOf, normalizeReaction, yieldOf, resolveStoichModes, stoichHarnessAnswers, stoichItems, stoichKey, stoichMode,
  stoichSpokenMisses, type StoichItem, type StoichiometryMiss,
} from './stoichiometryLabWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no title, a reaction code cannot read (a formula with no molar mass, a
 * repeated formula, a coefficient below 1), or a requested mode with no item (limiting and yield need two reactants).
 * Every key is computed from the reaction and the givens, so nothing else is trusted from the generator.
 */
export function validateStoichiometryLabData(value: unknown): StoichiometryLabData {
  const d = value as StoichiometryLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || !normalizeReaction(d.reaction))
    throw new Error('Generated stoichiometry lab has no readable reaction.');
  const items = stoichItems(d);
  if (!items.length) throw new Error('Generated stoichiometry lab has no item to ask.');
  for (const mode of resolveStoichModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The stoichiometry-lab ${mode} mode has no item on this reaction.`);
  }
  return d;
}

/** The journey's spoken answers: the key's own words, or the most telling wrong one. */
const say = (item: StoichItem) => {
  const answers = stoichHarnessAnswers(item);
  const spoken = (c: string | undefined) => (c === BOTH ? 'both' : c ?? '');
  return { correct: spoken(answers.correct[0]), plainWrong: spoken(answers.plainWrong[0]) };
};

export const stoichiometryLabBoss = spokenBoss<StoichiometryLabData, StoichItem, StoichiometryMiss>({
  card: stoichiometryLabCard,
  validate: validateStoichiometryLabData,
  items: stoichItems,
  levers: STOICH_LEVERS,
  speech: {
    ask: askOf,
    // A conversion chain has no key: the activity checks the cards.
    key: stoichKey,
    misses: stoichSpokenMisses,
    say,
    modeOf: stoichMode,
    // A chain through its real controls: the factor cards (their aria-labels) in order, then Check chain. Try again
    // clears the chain, so a retry starts empty. A wrong chain is the most telling miss of the item.
    show: (right, item) => {
      const answers = stoichHarnessAnswers(item);
      return [...(right ? answers.correct : answers.plainWrong).map((label): DriverInput => ({ type: 'choose', label })), { type: 'check' }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/StoichiometryLab.tsx',
    instanceId: 'stoichiometry-lab',
    defaults: { grade: 'Grade 10', mode: 'limiting', topic: 'Stoichiometry: limiting reactants and yield' },
    mounted: '[data-pip-object="workspace"]',
    // The whole answer as the screen prints it: the convert chain's result, the yield, the reactant that runs out.
    replayKeys: ctx => {
      const item = stoichItems(ctx.data as StoichiometryLabData).find(i => i.id === ctx.itemId);
      if (!item) return [];
      if (item.mode === 'convert') return [`${fmt(convertValue(item))} ${item.target.unit}`];
      if (item.mode === 'yield') return [fmt(yieldOf(item))];
      const key = limitingOf(item.rx, item.a, item.b), name = item.rx.subs.find(s => s.formula === key)?.name;
      return key === BOTH ? ['both run out together', 'run out at the same time']
        : [`${key} runs out first`, `${name} runs out first`, `${key} is the limiting`, `${name} is the limiting`];
    },
    // The easier practice item (`~easier`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const items = stoichItems(ctx.data as StoichiometryLabData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? easierItem(full, items) ?? undefined : full;
    },
  },
});
