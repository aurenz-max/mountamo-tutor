/**
 * figurative-language-finder's boss (`components/live-activity/boss.ts`), bespoke because every step is a tap pair or
 * typed words the activity checks: the card is `figurativeLanguageFinder.card.ts`; this file validates a lesson, lists
 * its items (finds and meanings in a passage, or figures to make), asks one, carries the lever set and plays the harness.
 */
import type { FigurativeLanguageFinderData } from './FigurativeLanguageFinder';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { figurativeLanguageFinderCard, type FigMiss } from './figurativeLanguageFinder.card';
import { FIG_LEVERS } from './figurativeLanguageFinderLevers';
import { askFor, figItems, sentenceOf, sentencesOf, typeChoices, type FigItem } from './figurativeSteps';

/** A passage needs 2+ figures that sit inside one sentence; a build needs 3+ subjects. */
export function validateFigurativeLanguageFinderData(value: unknown): FigurativeLanguageFinderData {
  const d = value as FigurativeLanguageFinderData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated figurative language finder has invalid lesson content.');
  const items = figItems(d);
  if (d.task === 'figurative_build' ? items.length < 3 : !items.some(i => i.kind === 'find'))
    throw new Error('A figurative language lesson needs figures to find or make.');
  return d;
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const figurativeLanguageFinderBoss = defineBoss<FigurativeLanguageFinderData, FigItem, FigMiss>({
  card: figurativeLanguageFinderCard,
  validate: validateFigurativeLanguageFinderData,
  items: figItems,
  ask: askFor,
  // Finds, meanings and made figures the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askFor(item), null),
  levers: FIG_LEVERS,
  stepOf: item => item.kind,
  drive: {
    component: 'primitives/visual-primitives/literacy/FigurativeLanguageFinder.tsx',
    instanceId: 'figures',
    defaults: { grade: 'Grade 4', mode: 'comparison', topic: 'A stormy day at the lake' },
    mounted: '[data-pip-object="workspace"]',
    // Find steps through the real passage and kind buttons: the first tagged figure not yet found, by its sentence and
    // kind, passes in code; wrong names a kind that sentence's tags do not hold (a wrong_type in code). Meaning and make
    // steps are checked by the writing judge (a model), so the dry journey cannot commit them;
    // FigurativeLanguageFinder.workspace.test.tsx drives them with a stubbed judge.
    play: (right, item, ctx) => {
      if (item.kind !== 'find') throw new Error('figurative-language-finder meaning and make steps are judged by the writing judge, not driven at W1');
      const data = ctx.data as FigurativeLanguageFinderData;
      const sentences = sentencesOf(data.passage ?? '');
      const foundSoFar = String(ctx.demand?.foundSoFar ?? '');
      const inst = (data.instances ?? []).find(i => sentenceOf(sentences, i.text) >= 0 && !foundSoFar.includes(`"${i.text.trim()}"`));
      if (!inst) throw new Error('No unfound figure left');
      const n = sentenceOf(sentences, inst.text);
      const tagged = (data.instances ?? []).filter(i => sentenceOf(sentences, i.text) === n).map(i => i.type);
      const kind = right ? inst.type : typeChoices(data).find(t => !tagged.includes(t))!;
      return [choose(`sentence ${n + 1}`), choose(`kind ${kind}`), choose("I'm done!")];
    },
  },
});
