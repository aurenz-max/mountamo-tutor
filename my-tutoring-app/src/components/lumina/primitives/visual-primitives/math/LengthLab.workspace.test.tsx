// @vitest-environment jsdom
/**
 * Length lab on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { LengthLabChallenge } from './LengthLab';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const base = { hint: 'Look again.', narration: '', objectColor0: '#f00', objectColor1: '#0f0', objectName1: 'crayon', objectLength1: 3 };
type Case = { c: LengthLabChallenge; wrong: string[]; right: string[]; miss: string; blank: string; secret: RegExp };
const add = (unit: string, n: number) => Array.from({ length: n }, () => `Add ${unit}`);
const CASES: Record<LengthLabChallenge['type'], Case> = {
  compare: {
    c: { ...base, id: 'c1', type: 'compare', instruction: 'Which is longer?', objectName0: 'pencil', objectLength0: 5, correctAnswer: 'longer' },
    wrong: ['pencil is shorter'], right: ['pencil is longer'], miss: 'reversed', blank: 'No choice yet', secret: /\b5\b|\b3\b/,
  },
  estimate_then_tile: {
    c: { ...base, id: 'e1', type: 'estimate_then_tile', instruction: 'Guess, then measure the pencil.', objectName0: 'pencil',
      objectLength0: 5, correctAnswer: '5', correctUnitCount: 5, unitType: 'cubes', estimateOptions: [3, 4, 5, 6] },
    wrong: ['3', ...add('cubes', 3), 'Check'], right: add('cubes', 5).concat('Check'), miss: 'tiled_to_guess',
    blank: 'Guessed 3. No tiles laid yet', secret: /correct/i,
  },
  two_unit_compare: {
    c: { ...base, id: 't1', type: 'two_unit_compare', instruction: 'Measure the straw twice.', objectName0: 'straw', objectLength0: 6,
      correctAnswer: 'cubes', correctUnitCount: 6, unitType: 'cubes', unitTypeB: 'bears', correctUnitCountB: 2 },
    wrong: [...add('cubes', 6), 'Check', ...add('bears', 2), 'Check', 'bears'],
    right: [...add('cubes', 6), 'Check', ...add('bears', 2), 'Check', 'cubes'], miss: 'chose_bigger_unit',
    blank: 'Measuring with the first unit', secret: /\b6\b|\b2\b/,
  },
  tile_and_count: {
    c: { ...base, id: 'k1', type: 'tile_and_count', instruction: 'How many cubes long is the crayon?', objectName0: 'crayon',
      objectLength0: 4, correctAnswer: '4', correctUnitCount: 4, unitType: 'cubes' },
    wrong: [...add('cubes', 5), 'Check'], right: [...add('cubes', 4), 'Check'], miss: 'one_over', blank: 'No tiles laid yet', secret: /\b4\b/,
  },
  order: {
    c: { ...base, id: 'o1', type: 'order', instruction: 'Shortest to longest.', objectName0: 'pencil', objectLength0: 5,
      objectName2: 'marker', objectLength2: 7, objectColor2: '#00f', correctAnswer: 'crayon,pencil,marker', correctOrderCsv: 'crayon,pencil,marker' },
    wrong: ['marker', 'pencil', 'crayon', 'Check Order'], right: ['crayon', 'pencil', 'marker', 'Check Order'], miss: 'reversed_order',
    blank: 'No object placed yet', secret: /crayon, pencil, marker|crayon,pencil|\b7\b/,
  },
  indirect: {
    c: { ...base, id: 'i1', type: 'indirect', instruction: 'Which is longer?', objectName0: 'pencil', objectLength0: 4, objectName1: 'ribbon',
      objectLength1: 8, correctAnswer: 'ribbon', clue0: 'The pencil is shorter than the string.', clue1: 'The ribbon is longer than the string.',
      referenceObjectName: 'string', referenceObjectLength: 6, referenceObjectColor: '#888' },
    wrong: ['pencil is longer'], right: ['ribbon is longer'], miss: 'chose_shorter', blank: 'No choice yet', secret: /\b8\b|\b4\b/,
  },
};
const lab = (challenges: LengthLabChallenge[]) => ({ title: 'Lengths', description: '', unitType: 'cubes', gradeBand: 'K', challenges });

it('every catalog mode binds', () => {
  const modes = (getComponentById('length-lab')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(CASES).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'length-lab', pin: mode, objectiveIds: ['o'],
      data: lab([CASES[mode as LengthLabChallenge['type']].c]) }), mode).not.toBeNull();
  }
});

it.each(Object.values(CASES))('$c.type: a checked gesture that publishes no key; a wrong check names its miss and reopens clean on Try again, the right one completes once',
  async ({ c, wrong, right, miss, blank, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'length-lab', evalMode: c.type, data: lab([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(task.demand)).not.toMatch(/correctAnswer|correctUnitCount|correctOrderCsv|objectLength/);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/next challenge/i);

    for (const label of wrong) h.press(label);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(JSON.stringify(h.state().task)).toContain(`"${miss}"`);
    // The miss does not print the answer on screen: Try again follows.
    if (c.type === 'tile_and_count') expect(h.view.container.textContent).not.toMatch(/is 4 cubes long/);
    // Input is closed until Try again; Try again clears the rejected work.
    const closed = Array.from(h.view.container.querySelectorAll('button')).filter(b => !b.disabled
      && /longer|shorter|same|Add |pencil|crayon|marker|ribbon|cubes|bears/.test(b.textContent + (b.getAttribute('aria-label') ?? '')));
    expect(closed).toEqual([]);
    h.dispatch('retry');
    expect(h.state().task!.demand).toMatchObject({ learnerWork: blank });

    for (const label of right) h.press(label);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'length-lab', evalMode: 'compare', data: lab([CASES.compare.c]) });
  h.press('pencil is longer');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn: the objects, the units, the clues, and whether aids are on screen', () => {
  const h = mountWorkspace({ primitiveId: 'length-lab', evalMode: 'indirect', data: lab([CASES.indirect.c]) });
  expect(h.state().task!.demand).toMatchObject({ clues: expect.stringContaining('shorter than the string'),
    reference: 'string, drawn as a bar', choices: 'pencil is longer | ribbon is longer | Same length' });
  cleanup();
  const t = mountWorkspace({ primitiveId: 'length-lab', evalMode: 'tile_and_count',
    data: lab([{ ...CASES.tile_and_count.c, showAlignmentFeedback: false }]) });
  expect(t.state().task!.demand).toMatchObject({ unit: 'cubes', fitCheck: 'hidden' });
  t.press('Add cubes'); t.press('Add cubes');
  expect(t.state().task!.demand).toMatchObject({ learnerWork: 'Laid 2 cubes along the crayon' });
});

it('the adapter refuses a challenge its own check cannot read', () => {
  expect(() => LIVE_ADAPTERS['length-lab'].validate(lab([{ ...CASES.order.c, correctOrderCsv: 'crayon,pencil' }]))).toThrow();
  expect(() => LIVE_ADAPTERS['length-lab'].validate(lab([{ ...CASES.estimate_then_tile.c, estimateOptions: [1, 2, 3] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['length-lab'].validate(lab([{ ...CASES.indirect.c, correctAnswer: 'string' }]))).toThrow();
  expect(LIVE_ADAPTERS['length-lab'].validate(lab(Object.values(CASES).map(x => x.c)))).toBeTruthy();
});
