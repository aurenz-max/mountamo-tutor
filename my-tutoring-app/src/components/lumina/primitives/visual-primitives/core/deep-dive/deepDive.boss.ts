/**
 * deep-dive's boss, on the spoken preset (`components/live-activity/boss.ts`): every mode is SAY_OR_SHOW, split per
 * item. A choice whose options can all be said has a key (`deepDiveKey`): the learner says it (the tutor judges it) or
 * taps it and presses Check (the block checks it). A sort, an order, a labeling, a lab or a choice that cannot be said
 * has no key, gets the gesture assignment, and plays through `show`. The card is `deepDive.card.ts`; this file holds the
 * content check, the items, the ask and key, and the harness play.
 */
import type { CheckBlockData, DeepDiveData } from './types';
import { itemErrors, rightAnswer, surfaceTaps, wrongAnswer } from '../../../../service/agent-kit/surfaces';
import { spokenBoss, hasText } from '../../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../../components/live-activity/liveJourneySpec';
import { deepDiveCard, type DeepDiveMiss } from './deepDive.card';
import {
  deepDiveAsk, deepDiveHarnessAnswers, deepDiveItems, deepDiveKey, deepDiveSpokenMisses, type DeepDiveItem,
} from './deepDiveWorkspace';

/** Reject a dive the checks cannot run on: no title, no graded block, a repeated id, or a choice whose key is not a choice. */
export function validateDeepDiveData(value: unknown): DeepDiveData {
  const d = value as DeepDiveData;
  if (!d || !hasText(d.title) || !Array.isArray(d.blocks) || !d.blocks.length) throw new Error('Generated deep dive has invalid lesson content.');
  if (new Set(d.blocks.map(b => b?.id)).size !== d.blocks.length) throw new Error('Generated deep dive blocks repeat an id.');
  const items = deepDiveItems(d);
  if (!items.length) throw new Error('A deep dive needs at least one graded check.');
  for (const item of items) {
    if (item.kind === 'check') {
      const bad = itemErrors((item.block as CheckBlockData).item);
      if (bad.length) throw new Error(`The deep-dive check "${item.label}" cannot run: ${bad[0]}`);
    }
    const c = item.choice;
    if (c && (!hasText(c.question) || c.options.length < 2 || !Number.isInteger(c.correctIndex) || !c.options[c.correctIndex]))
      throw new Error(`The deep-dive check "${item.label}" cannot be answered as generated.`);
  }
  return d;
}

/** The learner's taps through the sections still standing before the open check. */
const throughSections = (ctx: JourneyContext): DriverInput[] =>
  Array.from({ length: Number(ctx.demand?.sectionsLeftBeforeCheck ?? 0) }, () => ({ type: 'choose' as const, label: 'Next' }));

export const deepDiveBoss = spokenBoss<DeepDiveData, DeepDiveItem, DeepDiveMiss>({
  card: deepDiveCard,
  validate: validateDeepDiveData,
  items: deepDiveItems,
  speech: {
    ask: deepDiveAsk,
    key: deepDiveKey,
    misses: deepDiveSpokenMisses,
    say: item => { const { correct, wrong } = deepDiveHarnessAnswers(item); return { correct, plainWrong: wrong }; },
    // Every mode is SAY_OR_SHOW and wired alike; the generator's tier sets which blocks are graded.
    modeOf: () => 'recall',
    // A keyless choice through its real controls: tap the choice, then Check Answer. A sort, an order, a labeling or a
    // lab is not driven at W1 (multi-step placements; the diagram is judged by a vision call).
    show: (right, item) => {
      // A check on a kit surface plays through the kit's own taps (a part, cards, a tray, a board), then Check Answer.
      if (item.kind === 'check') { const it = (item.block as CheckBlockData).item; return surfaceTaps(it, right ? rightAnswer(it) : wrongAnswer(it), 'Check Answer'); }
      if (!item.choice) throw new Error(`deep-dive ${item.kind} is not driven at W1 (placed on screen, step by step)`);
      // Tapped by the printed choice (the spoken form is for `say`).
      const c = item.choice;
      const label = right ? c.options[c.correctIndex] : c.options.find((_, i) => i !== c.correctIndex);
      if (!label) throw new Error(`deep-dive ${item.kind}: the item has no choice to answer`);
      return [{ type: 'choose', label }, { type: 'choose', label: 'Check Answer' }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/core/deep-dive/DeepDive.tsx',
    instanceId: 'deep-dive',
    defaults: { grade: 'Grade 4', mode: 'recall', topic: 'The water cycle' },
    warmup: throughSections,
    mounted: '[data-pip-object="workspace"]',
    // The scripted cue tags the component sent before the workspace; the tutor must never say one.
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'DEEP_DIVE_START', 'ALL_COMPLETE', 'STUDENT_QUESTION', 'FOLLOW_UP_READY'],
  },
});
