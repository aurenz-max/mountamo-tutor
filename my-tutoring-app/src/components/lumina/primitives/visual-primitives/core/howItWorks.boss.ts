/**
 * how-it-works's boss, on the spoken preset (`components/live-activity/boss.ts`): every mode is SAY_OR_SHOW, split per
 * item. An item whose answer is a step's name (identify, predict) has a key (`howKey`): the learner says it (the tutor
 * judges it) or taps it and presses Check Answer (the activity checks it). An order of cards (sequence) or a purpose
 * (explain) has no key, gets the gesture assignment, and plays through `show`. Before the first item the learner reads
 * the process, then presses Start the questions. The card is `howItWorks.card.ts`; this file holds the content check,
 * the items, the ask and key, the levers and the harness play.
 */
import type { HowItWorksData } from './HowItWorks';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss, hasText } from '../../../components/live-activity/boss';
import { howItWorksCard, type HowMiss } from './howItWorks.card';
import { HOW_LEVERS, practiceParent, simplerItem } from './howItWorksLevers';
import {
  asCheck, askOfCheck, choiceText, howChecks, howHarnessAnswers, howItems, howKey, howPresses, howSpokenMisses, processSteps,
  resolveHowModes, validHowItem, type HowCheck,
} from './howItWorksWorkspace';

/** The Start button's name: the journey presses it by this label. */
export const START_LABEL = 'Start the questions';

/**
 * Reject a process the questions cannot be asked on: no title, fewer than three steps, a stored item code could not
 * have built over these steps (every key is a step index or the steps' order, so nothing else is trusted), or a
 * requested mode with no item.
 */
export function validateHowItWorksData(value: unknown): HowItWorksData {
  const d = value as HowItWorksData;
  if (!d || !hasText(d.title)) throw new Error('Generated how-it-works has invalid lesson content.');
  const steps = processSteps(d);
  if (steps.length < 3) throw new Error('A how-it-works process needs at least three steps to ask about.');
  if (Array.isArray(d.items) && d.items.some(i => !validHowItem(i, steps))) throw new Error('A generated how-it-works item is not one code can key.');
  const items = howItems(d);
  if (!items.length) throw new Error('No how-it-works question could be built from these steps.');
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated how-it-works items repeat an id.');
  for (const mode of resolveHowModes(d) ?? []) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The how-it-works ${mode} mode has no item.`);
  }
  return d;
}

/** While the steps are being read (scene phase `reading`): press Start the questions. */
const readFirst = (ctx: JourneyContext): DriverInput[] =>
  (ctx.demand?.phase === 'reading' ? [{ type: 'choose', label: START_LABEL }] : []);

export const howItWorksBoss = spokenBoss<HowItWorksData, HowCheck, HowMiss>({
  card: howItWorksCard,
  validate: validateHowItWorksData,
  items: howChecks,
  levers: HOW_LEVERS,
  speech: {
    ask: askOfCheck,
    // An order (sequence) or a purpose (explain) has no key: the activity checks it.
    key: howKey,
    misses: c => (c.kind === 'identify' || c.kind === 'predict' ? howSpokenMisses(c.steps, c) : []),
    // The key's own name, or the wrong choice whose miss comes first.
    say: c => {
      if (c.kind === 'sequence') throw new Error('how-it-works sequence: an order is placed, not said');
      const { correct, plainWrong } = howHarnessAnswers(c);
      return { correct: choiceText(c.steps, c, correct.choice!), plainWrong: choiceText(c.steps, c, plainWrong.choice!) };
    },
    before: (_c, ctx) => readFirst(ctx),
    modeOf: c => c.mode,
    // A keyless item through its real controls: tap the choice (its aria-label) or each card into the next slot, then
    // Check Answer (a pre-reader's tap checks itself). A wrong answer is the item's first-listed miss: a neighbouring
    // step, or the first two cards swapped.
    show: (right, c, ctx) => {
      const answers = howHarnessAnswers(c), work = right ? answers.correct : answers.plainWrong;
      return [...readFirst(ctx), ...howPresses(c.steps, c, work).map((label): DriverInput => ({ type: 'choose', label })),
        ...(c.pictures ? [] : [{ type: 'check' } as DriverInput])];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/core/HowItWorks.tsx',
    instanceId: 'how-it-works',
    defaults: { grade: 'Grade 4', mode: 'sequence', topic: 'How a bicycle turns pedaling into motion' },
    mounted: '[data-how-it-works]',
    probes: { mounted: { selector: '[data-how-it-works]' } },
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const items = howChecks(ctx.data as HowItWorksData);
      const parent = practiceParent(String(ctx.itemId ?? ''));
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      if (!parent || !full) return full;
      const easier = simplerItem(full.steps, full, full.pictures);
      return easier ? asCheck(easier, full.steps, full.pictures, full.question) : undefined;
    },
  },
});
