// @vitest-environment jsdom
/**
 * deep-dive's `check` block on the shared teaching workspace: a check on a kit answer surface is an item like any
 * other. The learner taps a part of a chart (point) or sorts cards, presses Check Answer, and the lesson moves on.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import { readDraft } from '../../../../service/agent-kit/itemLoop';
import { rightAnswer, surfaceTaps, wrongAnswer, type SurfaceItem } from '../../../../service/agent-kit/surfaces';
import { deepDiveBoss, validateDeepDiveData } from './deepDive.boss';
import { deepDiveItems, deepDiveKey, deepDiveSpokenMisses, workspaceScene } from './deepDiveWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const CO2 = { kind: 'chart', chart_type: 'line', title: 'CO2 in the air', x_label: 'Year', y_label: 'ppm',
  points: [{ label: '1960', value: 317 }, { label: '1980', value: 339 }, { label: '2000', value: 370 }, { label: '2020', value: 414 }] };
const POINT = readDraft({ surface: 'point', prompt: 'Tap the first year the line is above 350.', board: CO2, key: '2000',
  misconceptions: { '1980': 'Read that point against the axis.' } }, 'point', 5).item;
const SORT = readDraft({ surface: 'categorize', prompt: 'Sort each animal by what it eats.', categories: ['Plants', 'Animals'],
  options: [{ id: 'a', label: 'rabbit' }, { id: 'b', label: 'hawk' }, { id: 'c', label: 'deer' }], key: { a: 'Plants', b: 'Animals', c: 'Plants' } }, 'sort', 5).item;
const POINTS_PICK = { kind: 'chart', chart_type: 'bar', title: 'Rainfall', points: [{ label: 'May', value: 2 }, { label: 'June', value: 9 }, { label: 'July', value: 4 }] };
const WORDED = readDraft({ surface: 'choose', prompt: 'Which month was wettest?', stimulus: [POINTS_PICK],
  options: [{ id: 'a', label: 'May' }, { id: 'b', label: 'June' }, { id: 'c', label: 'July' }], key: 'b' }, 'worded', 5).item;
const clock = (hour: number) => ({ kind: 'clock', hour, minute: 0 });
const PICTURES = readDraft({ surface: 'choose', prompt: 'Which clock shows three?',
  options: [{ id: 'a', display: clock(1) }, { id: 'b', display: clock(3) }, { id: 'c', display: clock(5) }], key: 'b' }, 'pictures', 5).item;
const PASSAGE = readDraft({ surface: 'point', prompt: 'Tap the sentence that gives evidence.', key: 'Sentence 2',
  board: { kind: 'passage', sentences: ['Otters are clever.', 'They crack shells with stones.', 'They live in kelp.'] } }, 'passage', 5).item;
const check = (id: string, item: SurfaceItem) => ({ id, blockType: 'check', label: `Check ${id}`, item, explanation: `Explained ${id}.` });
const DATA = {
  title: 'A rising line', topic: 'Carbon dioxide', gradeLevel: 'Grade 5',
  blocks: [check('k1', POINT), check('k2', SORT), { id: 'after', blockType: 'prose', label: 'What comes next', paragraphs: ['The closing section of this lesson.'] }],
};

const mount = () => {
  const h = mountWorkspace({ primitiveId: 'deep-dive', evalMode: 'recall', instanceId: 'deep-dive', data: DATA });
  h.settle(1000);
  return h;
};
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const play = (h: WorkspaceHarness, item: SurfaceItem, right: boolean) => {
  for (const tap of surfaceTaps(item, right ? rightAnswer(item) : wrongAnswer(item), 'Check Answer')) {
    if (tap.type === 'touch') h.touch(tap.target); else h.press(new RegExp(tap.label));
  }
  h.settle();
};
const next = async (h: WorkspaceHarness, move: 'advance' | 'retry' = 'advance') => {
  let done = false;
  void h.transport.learnerProgress(move).then(() => { done = true; });
  for (let i = 0; i < 40 && !done; i++) { h.settle(50); await flush(); }
  h.settle();
  await flush();
};

it('a lesson of kit checks passes the boss: every check is an item, answered on screen, with no key for the tutor', () => {
  const data = validateDeepDiveData(DATA);
  const items = deepDiveItems(data);
  expect(items.map(i => i.kind)).toEqual(['check', 'check']);
  expect(items.map(deepDiveKey)).toEqual([null, null]);
  const scene = JSON.stringify(workspaceScene(data, items[0], { work: '', sections: [], asked: [] }));
  expect(scene).toContain('tap one part of the picture');
  expect(scene).toContain('317');
  expect(scene).not.toMatch(/Read that point against the axis|Explained k1/);
  expect(deepDiveBoss.assignment(items[0]).response).toBe('gesture');
  expect(() => validateDeepDiveData({ ...DATA, blocks: [check('bad', { ...POINT, key: '1990' })] })).toThrow(/cannot run/);
});

it('a choose check whose cards carry words can be said; cards told apart by pictures cannot', () => {
  const [worded, pictures] = deepDiveItems(validateDeepDiveData({ ...DATA, blocks: [check('w', WORDED), check('p', PICTURES)] }));
  const key = deepDiveKey(worded);
  expect(key?.answer).toBe('June');
  expect(key?.alsoAccept).toEqual([`card ${worded.choice!.correctIndex + 1}`]);
  expect(deepDiveBoss.assignment(worded).response).toBe('speech');
  expect([...(deepDiveSpokenMisses(worded)[0].examples ?? [])].sort()).toEqual(['July', 'May']);
  expect(worded.choice!.options[worded.choice!.correctIndex]).toBe('June');
  expect(JSON.stringify(workspaceScene({ title: 'Rain' }, worded, { work: '', sections: [], asked: [] }))).not.toMatch(/Explained/);
  expect(deepDiveKey(pictures)).toBeNull();
  expect(deepDiveBoss.assignment(pictures).response).toBe('gesture');
  // A letter on a picture card is a tag, and the words a child would say are the picture's.
  const tagged = { ...PICTURES, options: PICTURES.options.map((o, i) => ({ ...o, label: 'ABC'[i] })) };
  expect(deepDiveItems({ blocks: [check('l', tagged)] as never })[0].choice).toBeNull();
  // Two cards with the same words could not be told apart aloud.
  const twin = { ...WORDED, options: WORDED.options.map(o => ({ ...o, label: 'Same' })) };
  expect(deepDiveItems({ blocks: [check('t', twin)] as never })[0].choice).toBeNull();
});

it('a said check still solves by tap, and a passage board takes a tap on a sentence', async () => {
  const h = mountWorkspace({ primitiveId: 'deep-dive', evalMode: 'recall', instanceId: 'deep-dive', data: { ...DATA, blocks: [check('w', WORDED), check('s', PASSAGE)] } });
  h.settle(1000);
  play(h, WORDED, true);
  expect(text(h)).toContain('Explained w.');
  await next(h);
  expect(h.state().task!.itemId).toBe('s');
  expect(h.view.container.querySelectorAll('[data-pip-object^="part-Sentence"]').length).toBe(3);
  play(h, PASSAGE, true);
  expect(text(h)).toContain('Explained s.');
});

it('a wrong tap on the chart is a miss with its hint, the right tap solves it, and the next check opens', async () => {
  const h = mount();
  expect(h.state().task!.itemId).toBe('k1');
  expect(h.view.container.querySelectorAll('[data-pip-object^="part-"]').length).toBe(4);

  play(h, POINT, false);
  expect(text(h)).toContain('Not yet.');
  expect(text(h)).not.toContain('Explained k1.');
  expect(h.view.container.querySelector('[data-pip-object="part-1960"]')?.getAttribute('aria-pressed')).toBe('true');

  await next(h, 'retry');
  play(h, POINT, true);
  expect(h.state().task!.phase).toBe('checked');
  expect(text(h)).toContain('Explained k1.');

  await next(h);
  expect(h.state().task!.itemId).toBe('k2');
  play(h, SORT, true);
  expect(text(h)).toContain('Explained k2.');
  await next(h);
  expect(text(h)).toContain('The closing section');
  expect(text(h)).toContain('Deep Dive Complete!');
});
