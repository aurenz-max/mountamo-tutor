/**
 * story-ribbon's levers and spoken misses (`/add-support-tiers`, handoff 22 L4): offered only where the tier withdrew
 * the aid, no lever or fact names an event, and every catalog miss is answered or unanswered by decision.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { STORY_RIBBON_FALLBACKS } from '../../../service/literacy/gemini-story-ribbon';
import type { StoryRibbonChallengeType } from './StoryRibbon';
import { itemsFromChallenges } from './storyRibbonScript';
import { ARROWS_LEVER, FRAME_LEVER, LABELS_LEVER, STORY_RIBBON_UNANSWERED, leversOnScreen, storyRibbonLevers } from './storyRibbonLevers';
import { STORY_RIBBON_MISSES, storyRibbonAssignment } from './storyRibbonWorkspace';

const MODES = Object.keys(STORY_RIBBON_MISSES) as StoryRibbonChallengeType[];
const CUE: Partial<Record<StoryRibbonChallengeType, 'Today' | 'Tomorrow' | 'Yesterday'>> =
  { tell_present_account: 'Today', tell_future_account: 'Tomorrow', tell_past_account: 'Yesterday' };
const items = (type: StoryRibbonChallengeType, supportTier?: 'easy' | 'medium' | 'hard') => itemsFromChallenges(
  STORY_RIBBON_FALLBACKS.map(c => ({ ...c, type, supportTier, support: undefined, timeCue: CUE[type] })));
const entry = LITERACY_CATALOG.find(x => x.id === 'story-ribbon')!.teachingWorkspace!;

describe('story-ribbon levers', () => {
  it('the tier is the starting position: untiered and easy offer none; hard offers what it withdrew', () => {
    expect(storyRibbonLevers(items('tell_connected_account')[0], [])).toEqual([]);
    expect(storyRibbonLevers(items('tell_connected_account', 'easy')[0], [])).toEqual([]);
    expect(storyRibbonLevers(items('tell_connected_account', 'medium')[0], []).map(l => l.id)).toEqual([ARROWS_LEVER]);
    expect(storyRibbonLevers(items('tell_past_account', 'hard')[0], []).map(l => l.id)).toEqual([LABELS_LEVER, ARROWS_LEVER]);
    expect(storyRibbonLevers(items('story_to_experience', 'hard')[0], []).map(l => l.id)).toEqual([FRAME_LEVER]);
  });

  it.each(MODES)('%s: carriers shown; no lever text or fact names an event or picture', mode => {
    for (const item of items(mode, 'hard')) {
      const levers = storyRibbonLevers(item, []);
      const text = [...levers.map(l => `${l.when} ${l.does}`), leversOnScreen(item, levers.map(l => l.id)) ?? ''].join(' ');
      for (const l of levers) expect(l.carrier).toBe('shown');
      for (const e of item.challenge.events) {
        expect(text).not.toContain(e.pictureLabel);
        expect(text).not.toContain(e.modelSentence.replace(/[.!?]$/, ''));
      }
    }
  });

  it.each(MODES)('%s: catalog misses match the spoken list; each is answered on hard or unanswered by decision', mode => {
    const item = items(mode, 'hard')[0];
    expect(entry.levers).toBe(true);
    expect(entry.misses![mode]).toEqual(STORY_RIBBON_MISSES[mode]);
    expect(storyRibbonAssignment(item).misses!.map(m => m.id)).toEqual(STORY_RIBBON_MISSES[mode]);
    const levers = storyRibbonLevers(item, []);
    const unanswered = entry.unanswered?.[mode] ?? [];
    for (const miss of STORY_RIBBON_MISSES[mode]) {
      const answered = levers.some(l => l.answers?.includes(miss));
      expect(answered !== unanswered.includes(miss), miss).toBe(true);
      if (unanswered.includes(miss)) expect(STORY_RIBBON_UNANSWERED).toContain(miss);
    }
  });

  it('a named miss picks its lever', () => {
    const levers = storyRibbonLevers(items('tell_past_account', 'hard')[0], []);
    expect(nextLever(levers, 'events_missing')).toBe(LABELS_LEVER);
    expect(nextLever(levers, 'labels_listed')).toBe(ARROWS_LEVER);
    expect(nextLever(storyRibbonLevers(items('story_to_experience', 'hard')[0], []), 'event_only')).toBe(FRAME_LEVER);
  });
});
