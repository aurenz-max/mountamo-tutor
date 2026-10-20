/**
 * story-bridge's levers (`/add-support-tiers`, handoff 22 L4; spoken modes 2026-10-09), as one lever set: one help
 * lever per tap mode, two per friend comparison, one for big ideas; no lever's words name the correct choice or the
 * reference comparison; every card miss is answered on every item, on the fallback pair and on the saved payloads.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { FALLBACK_PAIR, challengesFromPair } from '../../../service/literacy/gemini-story-bridge';
import type { StoryBridgeChallengeType } from './StoryBridge';
import { itemsFromChallenges, storyBridgeSpokenMisses, type StoryBridgeItem } from './storyBridgeDomain';
import {
  ANCHOR_LEVER, ASK_SIGN_LEVER, FRIENDS_LEVER, SETTING_LEVER, STORY_BRIDGE_LEVERS, TIMELINE_LEVER, TWO_IDEAS_LEVER,
  TWO_QUESTIONS_LEVER,
} from './storyBridgeLevers';

const stories = [FALLBACK_PAIR.a, FALLBACK_PAIR.b];
const itemsOf = (mode: StoryBridgeChallengeType) =>
  ([0, 1] as const).flatMap(side => itemsFromChallenges(challengesFromPair(FALLBACK_PAIR, side, side, [mode, mode, mode]) as never, stories));
const PAYLOADS = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const savedItems = (mode: StoryBridgeChallengeType): StoryBridgeItem[] => {
  const { data } = JSON.parse(readFileSync(join(PAYLOADS, `story-bridge.${mode}.json`), 'utf-8'));
  return itemsFromChallenges(data.challenges, data.stories);
};
const entry = LITERACY_CATALOG.find(x => x.id === 'story-bridge')!.teachingWorkspace!;
const declared = (item: StoryBridgeItem) => STORY_BRIDGE_LEVERS.declare(item, undefined, []);
const factOf = (item: StoryBridgeItem, id: string) => STORY_BRIDGE_LEVERS.onScreen(item, undefined, [id]);
const TAP: Array<[StoryBridgeChallengeType, string]> = [
  ['match_character', ANCHOR_LEVER], ['match_setting', SETTING_LEVER], ['venn_place', TWO_QUESTIONS_LEVER], ['sequence_two', TIMELINE_LEVER]];
const SPOKEN: Array<[StoryBridgeChallengeType, string[]]> = [
  ['say_alike', [FRIENDS_LEVER, ASK_SIGN_LEVER]], ['say_different', [FRIENDS_LEVER, ASK_SIGN_LEVER]], ['main_idea_compare', [TWO_IDEAS_LEVER]]];

describe('story-bridge levers', () => {
  it.each(TAP)('%s: one help lever, no leak, every card miss answered', (mode, id) => {
    const items = [...itemsOf(mode), ...savedItems(mode)];
    expect(items.length).toBeGreaterThan(0);
    expect(entry.levers).toBe(true);
    for (const item of items) {
      const levers = declared(item);
      expect(levers.map(l => l.id), item.id).toEqual([id]);
      if (mode === 'match_character' || mode === 'sequence_two') {
        expect(factOf(item, id)).not.toContain(item.target.name);
        for (const c of item.targetStory.characters) expect(factOf(item, id)).not.toContain(c.sentence);
      }
      for (const miss of entry.misses![mode]) expect(nextLever(levers, miss)).toBe(id);
    }
  });

  it.each(SPOKEN)('%s: help levers on every item (fallback and saved payload), no leak, each spoken miss answered', (mode, ids) => {
    const items = [...itemsOf(mode), ...savedItems(mode)];
    expect(items.length).toBeGreaterThan(2);
    for (const item of items) {
      const levers = declared(item);
      expect(levers.map(l => l.id), item.id).toEqual(ids);
      expect(levers.every(l => l.kind === 'help')).toBe(true);
      // The item's own misses are exactly the card's, and each one has a lever on THIS item (J12).
      const misses = storyBridgeSpokenMisses(item).map(m => m.id);
      expect(misses).toEqual(entry.misses![mode]);
      for (const miss of misses) expect(levers.some(l => l.answers?.includes(miss)), `${item.id} ${miss}`).toBe(true);
    }
  });

  it.each([
    ['say_alike', 'one_friend_only', FRIENDS_LEVER], ['say_alike', 'told_difference', ASK_SIGN_LEVER],
    ['say_different', 'one_friend_only', FRIENDS_LEVER], ['say_different', 'told_likeness', ASK_SIGN_LEVER],
    ['main_idea_compare', 'one_story_only', TWO_IDEAS_LEVER],
  ] as const)('%s: after %s the next lever is %s', (mode, miss, id) => {
    expect(nextLever(declared(itemsOf(mode)[0]), miss)).toBe(id);
  });

  it('friend_events points at each friend\'s own sentence and says nothing of how they compare', () => {
    for (const item of [...itemsOf('say_alike'), ...savedItems('say_alike'), ...savedItems('say_different')]) {
      const text = factOf(item, FRIENDS_LEVER);
      expect(text).toContain(`the sentence about ${item.anchor.name} in ${item.anchorStory.title}`);
      expect(text).toContain(`the sentence about ${item.target.name} in ${item.targetStory.title}`);
      expect(text).not.toMatch(/\b(both|same|alike|different)\b/i);
      expect(text).not.toContain(item.comparisonSummary);
    }
  });

  it('two_ideas names neither big idea; ask_sign names the ask, not a way', () => {
    for (const item of savedItems('main_idea_compare')) {
      const text = factOf(item, TWO_IDEAS_LEVER);
      expect(text).not.toContain(item.storyA.mainIdea);
      expect(text).not.toContain(item.storyB.mainIdea);
    }
    const [alike] = savedItems('say_alike'), [different] = savedItems('say_different');
    expect(factOf(alike, ASK_SIGN_LEVER)).toMatch(/the alike sign 🟰/);
    expect(factOf(different, ASK_SIGN_LEVER)).toMatch(/the different sign ↔️/);
  });

  it('a lever whose words would name the right choice or the reference comparison is not offered', () => {
    const [item] = itemsOf('match_character');
    const leaky = { ...item, anchor: { ...item.anchor, sentence: `${item.anchor.name} helped ${item.target.name}.` } };
    expect(declared(leaky)).toEqual([]);
    // A spoken item whose friend's unique detail is in the lever's own words drops that lever only.
    const [spoken] = itemsOf('say_different');
    const named = { ...spoken, target: { ...spoken.target, uniqueDetail: 'face with' } };
    expect(declared(named).map(l => l.id)).toEqual([FRIENDS_LEVER]);
  });
});
