/**
 * dot-cards' boss, on the spoken preset (`components/live-activity/boss.ts`): every card's total is said (the tutor
 * judges the words against the key) or tapped on the pad (the activity checks the tap), a SAY_OR_SHOW card. The card
 * is face down until the learner flips it, so the harness flips it first. The card is `dotCards.card.ts`; this file
 * holds the content check, the items, the ask and key and the harness play.
 */
import type { DotCardsChallenge, DotCardsData } from './DotCards';
import { spokenBoss } from '../../../components/live-activity/boss';
import { dotCardsCard, type DotCardsMiss } from './dotCards.card';
import { dotCardsAsk, dotCardsHarnessWords, dotCardsKey, dotCardsSpokenMisses } from './dotCardsWorkspace';

const groupSize = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;

/** Reject a session the card cannot draw or the pad cannot answer: two groups of 1-5, a total that matches, one dot per unit. */
export function validateDotCardsData(value: unknown): DotCardsData {
  const d = value as DotCardsData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated dot cards has invalid lesson content.');
  if (new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !Array.isArray(c.parts)
        || !groupSize(c.parts[0]) || !groupSize(c.parts[1]) || c.total !== c.parts[0] + c.parts[1] || c.total > 10
        || !Array.isArray(c.dots) || c.dots.length !== c.total
        || c.dots.filter(dot => dot.part === 0).length !== c.parts[0]))
    throw new Error('A dot card cannot be checked.');
  return d;
}

export const dotCardsBoss = spokenBoss<DotCardsData, DotCardsChallenge, DotCardsMiss>({
  card: dotCardsCard,
  validate: validateDotCardsData,
  items: data => data.challenges,
  speech: {
    ask: dotCardsAsk,
    key: dotCardsKey,
    misses: dotCardsSpokenMisses,
    say: dotCardsHarnessWords,
    // The card is face down until the learner flips it.
    before: (_item, ctx) => (ctx.demand?.looked === 'yes' ? [] : [{ type: 'choose', label: 'Flip the card' }]),
  },
  drive: {
    component: 'primitives/visual-primitives/math/DotCards.tsx',
    instanceId: 'dot-cards',
    defaults: { grade: 'Kindergarten', mode: 'quick_total', topic: 'Seeing small groups of dots at a glance' },
    mounted: '[data-dot-card]',
  },
});
