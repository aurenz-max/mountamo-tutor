/**
 * curator-brief's boss, bespoke and ungraded (`components/live-activity/boss.ts`): the card is `curatorBrief.card.ts`.
 * There are no graded items; `items` are the three beats the tutor opens the lesson with (the opening state counts
 * them), and the harness looks at an "I wonder" choice, then presses Start.
 */
import type { IntroBriefingData } from '../types';
import { defineBoss } from '../components/live-activity/boss';
import { curatorBriefCard } from './curatorBrief.card';
import { teachingTask, validateBriefTeaching } from './curatorBriefWorkspace';

type Brief = IntroBriefingData & { title: string };

/** The three beats of the opening, in speaking order (`briefCaptions`). */
const BEATS = ['hook', 'bigIdea', 'today'] as const;

export const curatorBriefBoss = defineBoss({
  card: curatorBriefCard,
  validate: (value: unknown): Brief => { const d = validateBriefTeaching(value); return { ...d, title: d.topic }; },
  items: (_data: Brief) => BEATS,
  ask: (_beat, data) => teachingTask(data),
  drive: {
    component: 'primitives/CuratorBrief.tsx',
    instanceId: 'brief',
    defaults: { grade: 'Kindergarten', mode: 'mixed',
      topic: 'Recognizing and Creating Patterns: extend AB patterns with colors, shapes, or sounds' },
    mounted: '[data-pip-object="hook"]',
    probes: { demonstration: { selector: '[data-tutor-ring]', kind: 'count' },
      picture: { selector: '[data-pip-object="picture"] img', kind: 'count' } },
    // The retired section-reading tag: a model that voices it is reading the old scaffold.
    leakTokens: ['READ_SECTION'],
    prompts: { opening: 'What are we doing today?', hint: 'What does that mean?', example: 'Can you show me?' },
    // Nothing is graded: the learner taps an "I wonder" choice, and later presses Start.
    teach: intent => (intent === 'explore' ? [{ type: 'touch', target: 'wonder-0' }]
      : [{ type: 'touch', target: 'wonder-0' }, { type: 'choose', label: 'Start' }]),
    play: () => { throw new Error('curator-brief is ungraded: there is no right or wrong answer to play'); },
  },
});
