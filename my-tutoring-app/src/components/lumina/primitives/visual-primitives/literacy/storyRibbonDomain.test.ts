/**
 * story-ribbon's domain (`storyRibbonDomain.ts`): the item gates, the mixed board, and the ask and key the boss
 * hands the tutor. The key is judged on meaning; the ask never carries an event sentence.
 */
import { describe, expect, it } from 'vitest';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';
import { STORY_RIBBON_FALLBACKS } from '../../../service/literacy/gemini-story-ribbon';
import { storyRibbonBoss } from './storyRibbon.boss';
import { askFor, itemsFromChallenges, mixedEventIds, storyRibbonKey } from './storyRibbonDomain';
import { resolveSupportStructure } from './storyRibbonSupport';

const items = itemsFromChallenges(STORY_RIBBON_FALLBACKS.slice(0, 3));
const as = (type: 'tell_future_account' | 'story_to_experience') => itemsFromChallenges([{ ...STORY_RIBBON_FALLBACKS[0],
  id: type, type, ...(type === 'tell_future_account' ? { timeCue: 'Tomorrow' as const } : { timeCue: undefined }) }])[0];

describe('story-ribbon domain', () => {
  it('builds three connected-account items', () => {
    expect(items).toHaveLength(3);
    expect(items.every(item => item.responseClass === 'connected_account')).toBe(true);
  });

  it('starts every board away from the canonical answer order', () => {
    for (const random of [() => 0, () => 0.5, () => 0.999999]) {
      const mixed = mixedEventIds(items[0], random);
      expect(mixed).not.toEqual(items[0].challenge.events.map(event => event.id));
      expect(new Set(mixed)).toEqual(new Set(items[0].challenge.events.map(event => event.id)));
    }
  });

  it('drops malformed or incomplete event ribbons', () => {
    const missing = { ...STORY_RIBBON_FALLBACKS[0], events: STORY_RIBBON_FALLBACKS[0].events.slice(0, 2) };
    const scriptedLabel = { ...STORY_RIBBON_FALLBACKS[1], events: STORY_RIBBON_FALLBACKS[1].events.map((event, index) =>
      index === 0 ? { ...event, pictureLabel: 'First Omar flew the kite.' } : event) };
    expect(itemsFromChallenges([missing])).toEqual([]);
    expect(itemsFromChallenges([scriptedLabel])).toEqual([]);
  });

  it('the ask carries no event sentence; the key carries all three, in order, on meaning', () => {
    for (const item of [...items, as('tell_future_account'), as('story_to_experience')]) {
      const ask = askFor(item);
      for (const event of item.challenge.events) expect(ask).not.toContain(event.modelSentence);
      const key = storyRibbonKey(item);
      expect(key.meaning).toBeTruthy();
      const text = spokenKeyText(key);
      const at = item.challenge.events.map(e => text.indexOf(e.modelSentence.replace(/[.!?]$/, '')));
      expect(at.every(i => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      expect(storyRibbonBoss.assignment(item)).toMatchObject({ response: 'speech', expectedAnswer: text });
    }
  });

  it('a tense key names its time; story to experience never judges a memory or asks for private detail', () => {
    expect(spokenKeyText(storyRibbonKey(as('tell_future_account')))).toContain('future time');
    expect(spokenKeyText(storyRibbonKey(items[0]))).toContain('any consistent tense');
    const experience = spokenKeyText(storyRibbonKey(as('story_to_experience')));
    expect(experience).toContain('never judge whether a memory is true');
    expect(experience).toContain('Never ask for private detail');
    expect(askFor(as('story_to_experience'))).toContain('did, saw, heard about, or imagined');
  });

  it('a hard-tier ask withdraws the First/Next/Last wording', () => {
    const [hard] = itemsFromChallenges([{ ...STORY_RIBBON_FALLBACKS[0], id: 'hard', supportTier: 'hard',
      support: resolveSupportStructure('tell_connected_account', 'hard') }]);
    const ask = askFor(hard);
    expect(ask).toContain('Plan with the picture ribbon');
    for (const word of ['First', 'Next', 'Last']) expect(ask).not.toContain(word);
  });
});
