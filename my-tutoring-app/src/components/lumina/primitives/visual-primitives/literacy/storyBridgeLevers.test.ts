/**
 * story-bridge's levers (`/add-support-tiers`, handoff 22 L4): one help lever per tap mode, none on the spoken modes;
 * no lever text names the correct choice or quotes story two's sentence; every tap miss is answered.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { FALLBACK_PAIR, challengesFromPair } from '../../../service/literacy/gemini-story-bridge';
import type { StoryBridgeChallengeType } from './StoryBridge';
import { itemsFromChallenges } from './storyBridgeScript';
import { ANCHOR_LEVER, SETTING_LEVER, TIMELINE_LEVER, TWO_QUESTIONS_LEVER, leverLeak, leverText, storyBridgeLevers } from './storyBridgeLevers';

const stories = [FALLBACK_PAIR.a, FALLBACK_PAIR.b];
const itemsOf = (mode: StoryBridgeChallengeType) =>
  ([0, 1] as const).flatMap(side => itemsFromChallenges(challengesFromPair(FALLBACK_PAIR, side, side, [mode]) as never, stories));
const entry = LITERACY_CATALOG.find(x => x.id === 'story-bridge')!.teachingWorkspace!;
const TAP: Array<[StoryBridgeChallengeType, string]> = [
  ['match_character', ANCHOR_LEVER], ['match_setting', SETTING_LEVER], ['venn_place', TWO_QUESTIONS_LEVER], ['sequence_two', TIMELINE_LEVER]];

describe('story-bridge levers', () => {
  it.each(TAP)('%s: one help lever, no leak, every catalog miss answered', (mode, id) => {
    const items = itemsOf(mode);
    expect(items.length).toBeGreaterThan(0);
    expect(entry.levers).toBe(true);
    for (const item of items) {
      const levers = storyBridgeLevers(item, []);
      expect(levers.map(l => l.id), item.id).toEqual([id]);
      expect(leverLeak(item, id)).toBe(false);
      if (mode === 'match_character' || mode === 'sequence_two') {
        expect(leverText(item, id)).not.toContain(item.target.name);
        for (const c of item.targetStory.characters) expect(leverText(item, id)).not.toContain(c.sentence);
      }
      for (const miss of entry.misses![mode]) expect(nextLever(levers, miss)).toBe(id);
    }
  });

  it.each(['say_alike', 'say_different', 'main_idea_compare'] as const)('%s: spoken, no misses, no lever', mode => {
    for (const item of itemsOf(mode)) expect(storyBridgeLevers(item, [])).toEqual([]);
    expect(entry.misses?.[mode] ?? []).toEqual([]);
  });

  it('the leak rule fires when a lever would name the right choice', () => {
    const [item] = itemsOf('match_character');
    const leaky = { ...item, anchor: { ...item.anchor, sentence: `${item.anchor.name} helped ${item.target.name}.` } };
    expect(leverLeak(leaky, ANCHOR_LEVER)).toBe(true);
    expect(storyBridgeLevers(leaky, [])).toEqual([]);
  });
});
