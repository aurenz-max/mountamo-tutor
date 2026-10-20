/**
 * ph-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. A test item's papers are dipped first. The card is `phExplorer.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play.
 */
import type { PhExplorerData } from './PhExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { phExplorerCard } from './phExplorer.card';
import { fewerChoices, PH_LEVERS, practiceParent } from './phExplorerLevers';
import {
  askOf, phGiven, phHarnessAnswers, phItems, phKey, phMode, phSpokenMisses, resolvePhModes, type PhExplorerMiss, type PhItem,
} from './phExplorerWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no substances, duplicate ids, a pH off the 0-14 scale, or a requested mode
 * with no item (test needs a substance litmus reads plainly; indicator one off a colour edge). Every key is computed
 * from the pH values, so nothing else is trusted from the generator.
 */
export function validatePhExplorerData(value: unknown): PhExplorerData {
  const d = value as PhExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || !Array.isArray(d.substances) || !d.substances.length)
    throw new Error('Generated pH explorer has invalid lesson content.');
  const ids = d.substances.map(s => s?.id);
  if (new Set(ids).size !== ids.length || d.substances.some(s => !s || typeof s.id !== 'string' || !s.name?.trim()
      || !Number.isFinite(s.pH) || s.pH < 0 || s.pH > 14))
    throw new Error('A generated pH-explorer substance has no id, name or pH on the scale.');
  const items = phItems(d);
  for (const mode of resolvePhModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The pH-explorer ${mode} mode has no item to ask on these substances.`);
  }
  return d;
}

export const phExplorerBoss = spokenBoss<PhExplorerData, PhItem, PhExplorerMiss>({
  card: phExplorerCard,
  validate: validatePhExplorerData,
  items: phItems,
  levers: PH_LEVERS,
  speech: {
    ask: askOf,
    key: phKey,
    given: phGiven,
    misses: phSpokenMisses,
    say: phHarnessAnswers,
    // A test item: the papers are dipped before there is anything to read.
    before: (item, ctx) => (item.mode === 'test' && /^Not dipped/.test(String(ctx.demand?.papers ?? 'Not dipped'))
      ? [{ type: 'choose', label: 'Dip the litmus papers' }] : []),
    modeOf: phMode,
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/PhExplorer.tsx',
    instanceId: 'ph-explorer',
    defaults: { grade: 'Grade 5', mode: 'test', topic: 'Acids, bases and the pH scale' },
    mounted: '[data-pip-object="workspace"]',
    // The simpler practice item (`~fewer`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const items = phItems(ctx.data as PhExplorerData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? fewerChoices(full, (ctx.data as PhExplorerData).substances ?? [], items) ?? undefined : full;
    },
  },
});
