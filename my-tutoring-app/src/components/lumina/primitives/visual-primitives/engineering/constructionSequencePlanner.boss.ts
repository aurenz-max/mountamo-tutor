/**
 * construction-sequence-planner's boss, on the spoken preset (`components/live-activity/boss.ts`): a sequence,
 * dependency_chain or parallel item is a plan with no key, which the activity checks as a whole and the harness plays
 * through `show`; a critical_path item is one total the learner says (the tutor judges the words against the key) or
 * taps and checks (the activity checks the tap), a SAY_OR_SHOW mode. The card is
 * `constructionSequencePlanner.card.ts`; this file holds the content check, the items, the ask and key, the levers and
 * the harness play.
 */
import type { ConstructionSequencePlannerData } from './ConstructionSequencePlanner';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { constructionSequencePlannerCard } from './constructionSequencePlanner.card';
import { CSP_LEVERS, practiceParent, simplerItem } from './constructionSequenceLevers';
import {
  askOf, cspHarnessAnswers, cspHarnessWords, cspItems, cspKey, cspSpokenMisses, cspTaps, resolveCspModes, validCspItem,
  type CspItem, type CspMiss,
} from './constructionSequenceWorkspace';

/**
 * Reject a planner a mode cannot be asked on: no title, a stored item code could not have built (every key is
 * computed from the item's jobs and needs, so nothing else is trusted), or a requested mode with no item.
 */
export function validateConstructionSequenceData(value: unknown): ConstructionSequencePlannerData {
  const d = value as ConstructionSequencePlannerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated construction planner has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validCspItem(i))) throw new Error('A generated construction item is not one code can key.');
  const items = cspItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated construction items repeat an id.');
  for (const mode of resolveCspModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The construction-sequence-planner ${mode} mode has no item.`);
  }
  return d;
}

const check: DriverInput = { type: 'check' };

export const constructionSequencePlannerBoss = spokenBoss<ConstructionSequencePlannerData, CspItem, CspMiss>({
  card: constructionSequencePlannerCard,
  validate: validateConstructionSequenceData,
  items: cspItems,
  levers: CSP_LEVERS,
  speech: {
    ask: askOf,
    // A plan has no key: the activity checks the board.
    key: cspKey,
    misses: cspSpokenMisses,
    say: cspHarnessWords,
    modeOf: item => item.mode,
    // A plan through its real cards and week buttons (named by their `aria-label`), then the check. The wrong plan swaps
    // the last two jobs (sequence), puts the job that needs two right after its first need (dependency_chain) or moves
    // a job into its need's week (parallel).
    show: (right, item) => {
      if (item.mode === 'critical_path') throw new Error(`construction-sequence-planner: critical_path item ${item.id} is spoken, not shown`);
      const answers = cspHarnessAnswers(item);
      return [...cspTaps(item, right ? answers.correct : answers.plainWrong).map((label): DriverInput => ({ type: 'choose', label })), check];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/engineering/ConstructionSequencePlanner.tsx',
    instanceId: 'construction-sequence-planner',
    defaults: { grade: 'Grade 3', mode: 'dependency_chain', topic: 'Planning how to build a house: which jobs come first' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler practice item (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = cspItems(ctx.data as ConstructionSequencePlannerData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
