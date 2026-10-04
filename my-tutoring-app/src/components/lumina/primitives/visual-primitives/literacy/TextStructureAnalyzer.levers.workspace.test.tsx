// @vitest-environment jsdom
/**
 * text-structure-analyzer's levers on the shared teaching workspace (lever plan 2026-10-03 step 4), mounted the way a
 * lesson mounts it. Help rings a whole sentence or shows another sentence or passage, never a word of the passage;
 * each practice item is ungraded and the full item comes back; only the full item is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { textStructureItems } from './textStructureAnalyzerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const PASSAGE = 'First, the caterpillar hatches from a tiny egg. Next, it eats leaves for two weeks. Then it hangs upside down '
  + 'from a twig. After that, it forms a hard green case. Finally, a butterfly pushes its way out and dries its wings.';
const DATA = (supportTier = 'hard') => ({
  title: 'How a butterfly grows', gradeLevel: '4', supportTier, passage: PASSAGE, structureType: 'chronological',
  signalWords: ['First', 'Next', 'Then', 'After', 'Finally'].map(word => ({ word, startIndex: 0, endIndex: 0 })),
  structureOptions: ['chronological', 'description', 'cause-effect', 'compare-contrast'].map(type => ({ type, label: type, description: '' })),
  templateRegions: [{ regionId: 'r1', label: 'Beginning' }, { regionId: 'r2', label: 'Middle' }, { regionId: 'r3', label: 'End' }],
  keyIdeas: [
    { ideaId: 'i1', text: 'The caterpillar hatches from a tiny egg', correctRegionId: 'r1' },
    { ideaId: 'i2', text: 'It eats leaves for two weeks', correctRegionId: 'r1' },
    { ideaId: 'i3', text: 'It hangs upside down from a twig', correctRegionId: 'r2' },
    { ideaId: 'i4', text: 'It forms a hard green case', correctRegionId: 'r2' },
    { ideaId: 'i5', text: 'A butterfly pushes its way out', correctRegionId: 'r3' },
    { ideaId: 'i6', text: 'The butterfly dries its wings', correctRegionId: 'r3' },
  ],
}) as unknown as Record<string, unknown>;
const mount = (tier?: string) => mountWorkspace({ primitiveId: 'text-structure-analyzer', evalMode: 'chronological_description',
  data: DATA(tier), instanceId: 'tsa' });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const ids = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const ITEMS = textStructureItems(DATA() as never, 'tsa').items;
const answerUpTo = (h: WorkspaceHarness, action: string) => {
  for (const item of ITEMS) { if (item.action === action) return item; h.say(item.answer); h.feedback('correct', 'advance'); h.confirmVisible(); }
  throw new Error(`no ${action}`);
};

it('find-signal: the focus ring and a link model; the practice sentence is on a card and the full item returns', () => {
  const h = mount();
  const first = ITEMS[0];
  expect(ids(h)).toEqual(['focus_sentence', 'link_model', 'short_link_sentence']);
  h.say('caterpillar'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'focus_sentence' });
  expect(q(h, '.ring-sky-400\\/40')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'link_model' });
  const card = q(h, '[data-lever="link-model"]')[0];
  expect(card.querySelectorAll('u')).toHaveLength(1);
  expect(PASSAGE.toLowerCase()).not.toContain(` ${card.querySelector('u')!.textContent!.toLowerCase()} `);
  h.dispatch('pull_lever', { lever: 'short_link_sentence' });
  expect(h.state().task).toMatchObject({ itemId: `${first.id}~simpler` });
  expect(h.state().task!.task).toMatch(/sentence on the card/);
  expect(q(h, '[data-lever="practice-card"]')).toHaveLength(1);
  const word = h.state().task!.workspace!.expectedAnswer!.split(',')[0];
  h.say(word); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: first.id });
  h.say(first.answer); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([[first.id, false], [`${first.id}~simpler`, true], [first.id, true]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['focus_sentence', 'link_model', 'short_link_sentence'] });
  h.close();
});

it('name-structure: say_choices marks the menu; the structure model names a different structure', () => {
  const h = mount();
  answerUpTo(h, 'name-structure');
  expect(ids(h)).toEqual(['structure_model', 'say_choices', 'structure_practice']);
  h.dispatch('pull_lever', { lever: 'say_choices' });
  expect(q(h, '[data-lever="say-choices"]').length).toBe(4);
  h.dispatch('pull_lever', { lever: 'structure_model' });
  expect(q(h, '[data-lever="structure-model"]')[0].textContent).not.toMatch(/Time Order/);
  h.dispatch('pull_lever', { lever: 'structure_practice' });
  expect(h.state().task!.task).toMatch(/short passage on the card/);
  expect(String(h.state().task!.demand.menu).split(',')).toHaveLength(2);
  h.close();
});

it('place-idea: an example filed, the source sentence ringed, a two-part practice', () => {
  const h = mount();
  const idea = answerUpTo(h, 'place-idea');
  expect(ids(h)).toEqual(expect.arrayContaining(['say_choices', 'anchor_idea', 'source_sentence', 'two_part_practice']));
  h.dispatch('pull_lever', { lever: 'anchor_idea' });
  expect(q(h, '[data-lever="anchor-idea"]')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'source_sentence' });
  expect(q(h, '.ring-sky-400\\/40')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'two_part_practice' });
  expect(h.state().task).toMatchObject({ itemId: `${idea.id}~simpler` });
  expect(q(h, 'h3.mb-2').map(e => e.textContent)).toHaveLength(2);
  h.close();
});

it('easy: the anchor, the ring and the spoken menu start as the tier draws them; none is offered', () => {
  const h = mount('easy');
  expect(ids(h)).not.toContain('focus_sentence');
  expect(q(h, '.ring-sky-400\\/40')).toHaveLength(1);
  h.close();
});
