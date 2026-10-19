/**
 * story-ribbon's lever set (`/add-support-tiers`, handoff 22 L4): offered only where the tier withdrew the aid, no
 * lever or fact names an event, and every card miss is answered or unanswered by decision.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { STORY_RIBBON_FALLBACKS } from '../../../service/literacy/gemini-story-ribbon';
import type { StoryRibbonChallengeType } from './StoryRibbon';
import { STORY_RIBBON_MISSES, storyRibbonCard } from './storyRibbon.card';
import { storyRibbonBoss } from './storyRibbon.boss';
import { itemsFromChallenges } from './storyRibbonDomain';
import { ARROWS_LEVER, FRAME_LEVER, LABELS_LEVER, STORY_RIBBON_LEVERS } from './storyRibbonLevers';

const MODES = Object.keys(STORY_RIBBON_MISSES) as StoryRibbonChallengeType[];
const CUE: Partial<Record<StoryRibbonChallengeType, 'Today' | 'Tomorrow' | 'Yesterday'>> =
  { tell_present_account: 'Today', tell_future_account: 'Tomorrow', tell_past_account: 'Yesterday' };
const items = (type: StoryRibbonChallengeType, supportTier?: 'easy' | 'medium' | 'hard') => itemsFromChallenges(
  STORY_RIBBON_FALLBACKS.map(c => ({ ...c, type, supportTier, support: undefined, timeCue: CUE[type] })));
const declare = (item: ReturnType<typeof items>[number]) => STORY_RIBBON_LEVERS.declare(item, undefined, []);

describe('story-ribbon levers', () => {
  it('the tier is the starting position: untiered and easy offer none; hard offers what it withdrew', () => {
    expect(declare(items('tell_connected_account')[0])).toEqual([]);
    expect(declare(items('tell_connected_account', 'easy')[0])).toEqual([]);
    expect(declare(items('tell_connected_account', 'medium')[0]).map(l => l.id)).toEqual([ARROWS_LEVER]);
    expect(declare(items('tell_past_account', 'hard')[0]).map(l => l.id)).toEqual([LABELS_LEVER, ARROWS_LEVER]);
    expect(declare(items('story_to_experience', 'hard')[0]).map(l => l.id)).toEqual([FRAME_LEVER]);
  });

  it.each(MODES)('%s: carriers shown; no lever text or fact names an event or picture', mode => {
    for (const item of items(mode, 'hard')) {
      const levers = declare(item);
      const text = [...levers.map(l => `${l.when} ${l.does}`),
        STORY_RIBBON_LEVERS.onScreen(item, undefined, levers.map(l => l.id))].join(' ');
      for (const l of levers) expect(l.carrier).toBe('shown');
      for (const e of item.challenge.events) {
        expect(text).not.toContain(e.pictureLabel);
        expect(text).not.toContain(e.modelSentence.replace(/[.!?]$/, ''));
      }
    }
  });

  it.each(MODES)('%s: the spoken misses are the card\'s; each is answered on hard or unanswered by decision', mode => {
    const item = items(mode, 'hard')[0];
    expect(storyRibbonBoss.assignment(item).misses!.map(m => m.id)).toEqual(STORY_RIBBON_MISSES[mode]);
    const levers = declare(item);
    const unanswered: readonly string[] = storyRibbonCard.modes[mode].unanswered ?? [];
    for (const miss of STORY_RIBBON_MISSES[mode]) {
      const answered = levers.some(l => l.answers?.includes(miss));
      expect(answered !== unanswered.includes(miss), miss).toBe(true);
    }
  });

  it('a named miss picks its lever', () => {
    const levers = declare(items('tell_past_account', 'hard')[0]);
    expect(nextLever(levers, 'events_missing')).toBe(LABELS_LEVER);
    expect(nextLever(levers, 'labels_listed')).toBe(ARROWS_LEVER);
    expect(nextLever(declare(items('story_to_experience', 'hard')[0]), 'event_only')).toBe(FRAME_LEVER);
  });
});
