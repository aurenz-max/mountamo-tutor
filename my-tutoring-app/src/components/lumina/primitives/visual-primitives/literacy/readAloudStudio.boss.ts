/**
 * read-aloud-studio's boss, bespoke and stepped (`components/live-activity/boss.ts`): the card is
 * `readAloudStudio.card.ts`. accuracy and dialogue items are one spoken read; an expression item is one step of a line
 * (`stepOf`: the phrase plan, the first read, the reread). This file holds the content check, the items, the ask and
 * key, the levers and the harness play; the assignment is `readAloudAssignment` (a spoken key, or the plan's gesture).
 */
import type { ReadAloudStudioData } from './ReadAloudStudio';
import { defineBoss } from '../../../components/live-activity/boss';
import { readAloudStudioCard } from './readAloudStudio.card';
import { READ_ALOUD_LEVERS, shortLine } from './readAloudStudioLevers';
import { scoredReadingItems, type StudioItem } from './readAloudPhrasing';
import {
  readAloudAsk, readAloudAssignment, readAloudGiven, readAloudItems, readAloudJourneyAnswers, readAloudKey, readAloudStep,
} from './readAloudStudioWorkspace';

type Payload = ReadAloudStudioData & { title: string };

/** Reject a passage with no line that can be asked honestly: the build gates drop a line outside the 3-8 word
 *  window, a sentinel-opening line, dialogue with no speaker. */
export function validateReadAloudStudioData(value: unknown): Payload {
  const d = value as ReadAloudStudioData;
  if (!d || !Array.isArray(d.lines)) throw new Error('Generated read aloud studio has invalid lesson content.');
  if (!scoredReadingItems(readAloudItems(d)).length) throw new Error('No read aloud line can be asked.');
  return { ...d, title: d.title || 'Read Aloud Studio' };
}

export const readAloudStudioBoss = defineBoss({
  card: readAloudStudioCard,
  validate: validateReadAloudStudioData,
  items: (data: Payload) => readAloudItems(data),
  ask: (item: StudioItem) => readAloudAsk(item),
  assignment: readAloudAssignment,
  // A dialogue line and the expression reread carry the tutor's model in the ask, by design.
  spoken: { key: readAloudKey, given: readAloudGiven },
  stepOf: readAloudStep,
  levers: READ_ALOUD_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/literacy/ReadAloudStudio.tsx',
    instanceId: 'read-aloud-studio',
    defaults: { grade: 'Grade 2', mode: 'accuracy', topic: 'A day at the pond' },
    mounted: '[data-pip-object="stimulus"]',
    leakTokens: ['RA_ITEM', 'RA_MOVE', 'RA_COMPLETE', 'RA_HEAR', 'RA_PLAN'],
    // The session item, or a practice line (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const all = readAloudItems(ctx.data as ReadAloudStudioData);
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      return parent ? shortLine(parent, all) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
    // Every scored item is the printed line read aloud. The phrase plan accepts any plan, so it has no wrong answer:
    // the driver commits the plan as it stands.
    play: (right, item) => {
      if (item.step === 'mark') return right ? [{ type: 'choose', label: 'Use my phrase plan' }] : [];
      const answers = readAloudJourneyAnswers(item);
      return [{ type: 'answer', text: right ? answers.correct : answers.plainWrong }];
    },
  },
});
