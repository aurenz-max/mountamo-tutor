/**
 * adaptation-investigator's boss, bespoke and ungraded (`components/live-activity/boss.ts`): the card is
 * `adaptationInvestigator.card.ts`. There are no graded items; `items` are the three cards the tutor teaches from (the
 * opening state counts them), and the harness opens a card, then opens the rest and presses Done.
 */
import type { AdaptationInvestigatorData } from './AdaptationInvestigator';
import { defineBoss } from '../../../components/live-activity/boss';
import { adaptationInvestigatorCard } from './adaptationInvestigator.card';
import { TEACHING_CARDS, teachingTask, validateAdaptationTeaching } from './adaptationInvestigatorWorkspace';

type Investigation = AdaptationInvestigatorData & { title: string };

export const adaptationInvestigatorBoss = defineBoss({
  card: adaptationInvestigatorCard,
  validate: (value: unknown): Investigation => {
    const d = validateAdaptationTeaching(value);
    return { ...d, title: `${d.organism}: ${d.adaptation.trait}` };
  },
  items: (_data: Investigation) => TEACHING_CARDS,
  ask: (_card, data) => teachingTask(data),
  drive: {
    component: 'primitives/visual-primitives/biology/AdaptationInvestigator.tsx',
    instanceId: 'adapt',
    defaults: { grade: 'Grade 1', mode: 'mixed', topic: 'Why pink flowers have bright pink petals' },
    mounted: '[data-pip-object="trait"]',
    probes: { demonstration: { selector: '[data-tutor-ring]', kind: 'count' },
      closed: { selector: '[aria-label^="Open The"]', kind: 'count' } },
    // A young learner's own questions: what the picture is, why, and asking to be shown.
    prompts: { opening: 'What is that flower?', hint: 'Why is it so pink?', example: 'Can you show me?' },
    // Nothing is graded: the learner opens a card still closed (the tutor may already have shown one), and later opens
    // the rest and presses Done. A card already open is tapped again harmlessly.
    teach: (intent, ctx) => (intent === 'explore'
      ? [{ type: 'touch', target: TEACHING_CARDS.find(c => !String(ctx.demand?.cardsOpen ?? '').includes(c)) ?? 'trait' }]
      : [...TEACHING_CARDS.map(target => ({ type: 'touch' as const, target })), { type: 'choose', label: 'Done' }]),
    play: () => { throw new Error('adaptation-investigator is ungraded: there is no right or wrong answer to play'); },
  },
});
