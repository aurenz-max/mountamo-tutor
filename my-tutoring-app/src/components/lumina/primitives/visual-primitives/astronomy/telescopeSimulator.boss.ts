/**
 * telescope-simulator's boss, on the spoken preset (`components/live-activity/boss.ts`): object_type and
 * pick_instrument are said (the tutor judges the words against the key) or tapped and checked (the activity checks
 * it), SAY_OR_SHOW items; find_by_look and brightest have no key, the learner taps one object in the view and presses
 * Check Answer, and they play through `show`. The card is `telescopeSimulator.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play.
 */
import type { TelescopeSimulatorData } from './TelescopeSimulator';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { telescopeSimulatorCard, type TelescopeMiss } from './telescopeSimulator.card';
import { TELESCOPE_LEVERS } from './telescopeLevers';
import {
  askOf, choiceLabel, isTapItem, resolveTelescopeModes, skyTarget, telescopeHarnessAnswers, telescopeItems, telescopeKey,
  telescopeSpokenMisses, validTelescopeItem, type TelescopeItem,
} from './telescopeWorkspace';

/**
 * Reject a session a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's objects, clues or detail, so nothing else is trusted), or a requested mode with no item.
 */
export function validateTelescopeSimulatorData(value: unknown): TelescopeSimulatorData {
  const d = value as TelescopeSimulatorData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated telescope session has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validTelescopeItem(i))) throw new Error('A generated telescope item is not one code can key.');
  const items = telescopeItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated telescope items repeat an id.');
  for (const mode of resolveTelescopeModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The telescope-simulator ${mode} mode has no item.`);
  }
  return d;
}

const check: DriverInput = { type: 'check' };

export const telescopeSimulatorBoss = spokenBoss<TelescopeSimulatorData, TelescopeItem, TelescopeMiss>({
  card: telescopeSimulatorCard,
  validate: validateTelescopeSimulatorData,
  items: telescopeItems,
  levers: TELESCOPE_LEVERS,
  speech: {
    ask: askOf,
    key: telescopeKey,
    misses: item => (isTapItem(item) ? [] : telescopeSpokenMisses(item)),
    // The key's label, or the wrong choice showing the mode's first-listed miss it can.
    say: item => {
      if (isTapItem(item)) throw new Error(`telescope-simulator: ${item.id} is a tap item and is not said`);
      const { correct, plainWrong } = telescopeHarnessAnswers(item);
      return { correct: choiceLabel(item, correct.choice!), plainWrong: choiceLabel(item, plainWrong.choice!) };
    },
    // One unnamed object in the view (`sky-<n>`) and Check Answer; a wrong one shows the mode's first-listed miss.
    show: (right, item) => {
      const { correct, plainWrong } = telescopeHarnessAnswers(item);
      return [{ type: 'touch', target: skyTarget((right ? correct : plainWrong).pick!) }, check];
    },
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/astronomy/TelescopeSimulator.tsx',
    instanceId: 'telescope-simulator',
    defaults: { grade: 'Grade 4', mode: 'find_by_look', topic: 'Observing the night sky with a telescope' },
    mounted: '[data-pip-object="workspace"]',
  },
});
