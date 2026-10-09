// @vitest-environment jsdom
/**
 * story-bridge's levers on the shared teaching workspace (handoff 22 L4; spoken modes 2026-10-09). A pull changes the
 * screen and the scene fact in the same commit; candidates stay unmarked; the next tap or spoken answer carries the
 * lever; a refused pull changes nothing. There is no simplify lever.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { FALLBACK_PAIR, challengesFromPair } from '../../../service/literacy/gemini-story-bridge';
import { itemsFromChallenges } from './storyBridgeScript';
import type { StoryBridgeChallengeType } from './StoryBridge';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const stories = [FALLBACK_PAIR.a, FALLBACK_PAIR.b];
const data = (mode: StoryBridgeChallengeType) =>
  ({ title: 'Two stories', description: '', gradeLevel: 'K', challengeType: mode, stories,
    challenges: challengesFromPair(FALLBACK_PAIR, 0, 0, [mode, mode]) }) as unknown as Record<string, unknown>;
const mount = (mode: StoryBridgeChallengeType) => {
  const d = data(mode);
  return { h: mountWorkspace({ primitiveId: 'story-bridge', evalMode: mode, data: d }), items: itemsFromChallenges(d.challenges as never, stories) };
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const wrongTap = (h: WorkspaceHarness, item: { choiceIds: string[]; correctChoiceId: string }) => {
  h.touch(`choice-${item.choiceIds.find(id => id !== item.correctChoiceId)}`);
  h.dispatch('retry'); h.confirmVisible();
};

it('match_character: the anchor card alone shows its event picture; the right tap is credited as assisted', () => {
  const { h, items: [item] } = mount('match_character');
  wrongTap(h, item);
  const receipt = h.dispatch('pull_lever', { lever: 'anchor_action' });
  const marks = q(h, '[data-lever="anchor-action"]');
  expect(marks).toHaveLength(1);
  expect(marks[0].closest('button')!.getAttribute('aria-label')).toMatch(new RegExp(`^${item.anchor.name}, the friend to compare`));
  expect(String(receipt.state.task!.demand.levers_on_screen)).toContain(item.anchor.sentence);
  expect(String(receipt.state.task!.demand.levers_on_screen)).not.toContain(item.target.sentence);
  h.touch(`choice-${item.correctChoiceId}`);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['anchor_action'] });
  h.close();
});

it('match_setting: both pictures get their place label; a second pull is refused; gone on the next item', () => {
  const { h, items: [item] } = mount('match_setting');
  h.dispatch('pull_lever', { lever: 'setting_focus' });
  expect(q(h, '[data-lever="setting-label"]').map(e => e.textContent)).toEqual([`📍 ${item.storyA.setting}`, `📍 ${item.storyB.setting}`]);
  expect(h.offer('pull_lever')).toBeFalsy();
  h.touch(`choice-${item.correctChoiceId}`); h.dispatch('advance'); h.confirmVisible();
  expect(q(h, '[data-lever="setting-label"]')).toHaveLength(0);
  h.close();
});

it('venn_place: two empty checks, one per friend, nothing filled', () => {
  const { h, items: [item] } = mount('venn_place');
  h.dispatch('pull_lever', { lever: 'two_questions' });
  const box = q(h, '[data-lever="two-questions"]')[0];
  expect(box.textContent).toContain(`${item.anchor.name}?`);
  expect(box.textContent).toContain(`${item.target.name}?`);
  expect(box.textContent).not.toMatch(/only|both|✓|✔/i);
  h.close();
});

it('sequence_two: story one in order with the asked event lit; story two stays mixed', () => {
  const { h, items: [item] } = mount('sequence_two');
  const before = q(h, '[data-pip-object^="choice-"]').map(e => e.getAttribute('data-pip-object'));
  h.dispatch('pull_lever', { lever: 'anchor_timeline' });
  const lit = q(h, '[data-lever="anchor-timeline"] [data-lit]');
  expect(lit).toHaveLength(1);
  expect(lit[0].textContent).toContain(item.anchor.eventEmoji);
  expect(q(h, '[data-pip-object^="choice-"]').map(e => e.getAttribute('data-pip-object'))).toEqual(before);
  h.close();
});

const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.levers_on_screen ?? '');

it('say_alike: friend_events puts each named friend\'s event picture on its card in one commit; a second pull changes nothing; the next answer records it', () => {
  const { h, items: [item] } = mount('say_alike');
  expect(levers(h)).toEqual([['friend_events', false], ['ask_sign', false]]);
  h.say(`${item.anchor.name} was in one story.`); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(q(h, '[data-lever="friend-event"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'friend_events' });
  expect(receipt.status).toBe('committed');
  const marks = q(h, '[data-lever="friend-event"]');
  expect(marks.map(m => m.textContent).sort()).toEqual([item.anchor.eventEmoji, item.target.eventEmoji].sort());
  expect(marks.map(m => m.closest('button')!.textContent)).toEqual(expect.arrayContaining(
    [expect.stringContaining(item.anchor.name), expect.stringContaining(item.target.name)]));
  const fact = String(receipt.state.task!.demand.levers_on_screen);
  expect(fact).toContain(item.anchor.sentence);
  expect(fact).toContain(item.target.sentence);
  expect(fact).not.toContain(item.comparisonSummary);
  expect(levers(h)).toEqual([['friend_events', true], ['ask_sign', false]]);
  // A refused pull: the screen, the levers and the attempts are unchanged (the runtime revision may still move).
  const before = { html: h.view.container.innerHTML, levers: levers(h), attempts: attempts(h).length, item: h.state().task!.itemId };
  expect(h.dispatch('pull_lever', { lever: 'friend_events' }).status).toBe('blocked');
  expect({ html: h.view.container.innerHTML, levers: levers(h), attempts: attempts(h).length, item: h.state().task!.itemId }).toEqual(before);
  h.say(item.comparisonSummary); h.feedback('correct');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: item.id, correct: true, assisted: true, levers: ['friend_events'] });
  h.close();
});

it('say_different: ask_sign draws both faces with the different sign in the bridge, and the scene says so', () => {
  const { h, items: [item] } = mount('say_different');
  expect(q(h, '[data-lever="ask-sign"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'ask_sign' });
  expect(receipt.status).toBe('committed');
  const sign = q(h, '[data-lever="ask-sign"]');
  expect(sign).toHaveLength(1);
  expect(sign[0].textContent).toBe(`${item.anchor.emoji}↔️${item.target.emoji}`);
  expect(onScreen(h)).toMatch(/the different sign ↔️ between them/);
  h.close();
});

it('main_idea_compare: two_ideas puts one empty check under each story, naming neither big idea', () => {
  const { h, items: [item] } = mount('main_idea_compare');
  expect(levers(h)).toEqual([['two_ideas', false]]);
  h.say(item.storyA.mainIdea); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.dispatch('pull_lever', { lever: 'two_ideas' }).status).toBe('committed');
  const checks = q(h, '[data-lever="idea-check"]');
  expect(checks).toHaveLength(2);
  for (const c of checks) expect(c.textContent).not.toMatch(/sharing|helping|safe|happy/i);
  expect(onScreen(h)).toMatch(/^Under each story picture, an empty check/);
  h.say(item.comparisonSummary); h.feedback('correct');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['two_ideas'] });
  h.close();
});
