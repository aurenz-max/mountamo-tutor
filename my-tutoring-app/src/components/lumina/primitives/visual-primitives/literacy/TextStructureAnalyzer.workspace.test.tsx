// @vitest-environment jsdom
/**
 * Text structure analyzer on the teaching workspace: what is its own, plus its Pip surface. The
 * generic W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';
import { textStructureAssignment, textStructureItems } from './textStructureAnalyzerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const OPTIONS = [
  { type: 'cause-effect', label: 'Cause and Effect', description: 'One thing makes another happen.' },
  { type: 'chronological', label: 'Time Order', description: 'Events in the order they happen.' },
  { type: 'description', label: 'Description', description: 'Facts and details about a topic.' },
  { type: 'compare-contrast', label: 'Compare and Contrast', description: 'How two things are alike and different.' },
  { type: 'problem-solution', label: 'Problem and Solution', description: 'A problem and how it is fixed.' },
];
const passage = (structureType: string, text: string, signals: string[], regions: [string, string], ideas: Array<[string, string]>) => ({
  title: 'Reading', gradeLevel: '4', passage: text, structureType, structureOptions: OPTIONS,
  signalWords: signals.map(word => ({ word, startIndex: 0, endIndex: 0 })),
  templateRegions: regions.map(label => ({ regionId: label.toLowerCase(), label })),
  keyIdeas: ideas.map(([t, region], i) => ({ ideaId: `i${i}`, text: t, correctRegionId: region.toLowerCase() })),
});
const PAYLOADS: Record<string, Record<string, unknown>> = {
  chronological_description: passage('chronological', 'First, you put a tiny seed into the dirt. Next, the warm sun shines down on the soil. '
    + 'After that, rain falls on the plant. Finally, green leaves pop up.', ['First', 'Next', 'After', 'Finally'], ['Before', 'After'],
  [['you put a tiny seed into the dirt', 'Before'], ['green leaves pop up', 'After']]),
  cause_effect: passage('cause-effect', 'Heavy rain fell for three days. Because the ground was full, the river rose over its banks. '
    + 'The water covered the road, so the town closed the bridge.', ['Because', 'so'], ['Cause', 'Effect'],
  [['heavy rain fell for three days', 'Cause'], ['the town closed the bridge', 'Effect']]),
  compare_contrast: passage('compare-contrast', 'Frogs live near ponds. Similarly, toads live near water in spring. '
    + 'However, toads have dry and bumpy skin.', ['Similarly', 'However'], ['Alike', 'Different'],
  [['both live near water', 'Alike'], ['toads have bumpy skin', 'Different']]),
  problem_solution: passage('problem-solution', 'The school garden kept drying out in summer. To fix this, the class built a rain barrel. '
    + 'As a result, the plants had water all season.', ['To fix this', 'As a result'], ['Problem', 'Solution'],
  [['the garden kept drying out', 'Problem'], ['the class built a rain barrel', 'Solution']]),
};
const mount = (mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'text-structure-analyzer', evalMode: mode, data: PAYLOADS[mode], instanceId: 'text-structure-analyzer', pipStore });
const itemsOf = (mode: string) => textStructureItems(PAYLOADS[mode] as never, 'text-structure-analyzer').items;

it.each(Object.keys(PAYLOADS))('%s binds: the build gates\' answer is the spoken key', mode => {
  const items = itemsOf(mode);
  expect(items.length).toBeGreaterThan(0);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'text-structure-analyzer', pin: mode, objectiveIds: ['o'], data: PAYLOADS[mode] })).not.toBeNull();
  const h = mount(mode);
  const task = h.state().task!;
  expect(task.workspace!.expectedAnswer!.startsWith(items[0].answer)).toBe(true);
  expect(task.task).not.toMatch(/Your turn/);
  expect(task.demand.passage).toBe((PAYLOADS[mode] as { passage: string }).passage);
});

it('no task says a sentence of the passage', () => {
  for (const mode of Object.keys(PAYLOADS)) {
    const sentences = (PAYLOADS[mode] as { passage: string }).passage.split(/(?<=\.)\s+/).map(t => t.replace(/\.$/, ''));
    for (const item of itemsOf(mode)) for (const sentence of sentences) expect(textStructureAssignment(item).task).not.toContain(sentence);
  }
});

it('a linking word lights up only after credit; a miss reopens the item', () => {
  const h = mount('cause_effect');
  const first = itemsOf('cause_effect')[0];
  expect(first.action).toBe('find-signal');
  expect(screen.queryByRole('button', { name: /hear the question|check|next/i })).toBeNull();
  const lit = () => document.querySelector('.underline')?.textContent ?? null;
  expect(lit()).toBeNull();
  h.say('river'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(first.id);
  expect(lit()).toBeNull();
  h.say(first.answer); h.feedback('correct');
  expect(lit()).toBe(first.answer);
});

it('right answers complete once and submit the structure metrics', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('problem_solution');
  for (let i = 0; i < itemsOf('problem_solution').length; i++) { h.say('answer'); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'text-structure-analyzer', structureIdentifiedCorrectly: true });
});

it('Pip outlines the passage and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('text-structure-analyzer');
  const h = mount('cause_effect', store);
  expect(store.getActive()?.targets.map(t => t.id)).toContain('stimulus');
  h.say('because'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a passage with nothing askable', () => {
  const adapter = LIVE_ADAPTERS['text-structure-analyzer'];
  expect(() => adapter.validate({ ...PAYLOADS.cause_effect, passage: '' })).toThrow();
  expect(adapter.validate(PAYLOADS.cause_effect)).toBeTruthy();
});
