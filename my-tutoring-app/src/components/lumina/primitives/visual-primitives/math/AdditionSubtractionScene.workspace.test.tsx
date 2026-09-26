// @vitest-environment jsdom
/**
 * Addition-subtraction scene on the teaching workspace: the stage pins the runner-era reader-fit suite
 * held (re-based onto the real runtime), plus the binding's own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 *
 *  - act-out at K and create-story are direct manipulation: seeded start group, a tapped object leaves
 *    and the survivors keep their positions, and a hands turn commits on STILLNESS whether or not it
 *    is right (the click era auto-judged only a match, so it could never be wrong).
 *  - solve-story answers with the mouth at every band: no keyboard, no numeral menu.
 *  - Grade 1 act-out subtraction enacts the departure up to changeCount, then taps count survivors.
 *  - A change group that waits for the story arrives only on `present` (the tutor) or Show me.
 *  - The ten frame mirrors what is visible; the number sentence shows only after credit.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';
import type { AddSubChallenge } from './AdditionSubtractionScene';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const ch = (over: Partial<AddSubChallenge>): AddSubChallenge => ({
  id: 'c1', type: 'act-out', instruction: '', storyText: '2 ducks are swimming in the pond. 1 more duck joins them.',
  scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join',
  startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3', ...over,
});
const data = (gradeBand: 'K' | '1', challenges: AddSubChallenge[], over: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'Story stage', gradeBand, maxNumber: gradeBand === 'K' ? 5 : 10, showTenFrame: false, showEquationBar: true,
  challenges, ...over,
});
const mount = (d: Record<string, unknown>, evalMode = 'act_out', pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'addition-subtraction-scene', evalMode, data: d, instanceId: 'story', pipStore });
const objects = () => Array.from(document.querySelectorAll('[data-pip-object^="object-"]'));
const positions = () => objects().map(g => { const c = g.querySelector('circle')!; return `${c.getAttribute('cx')},${c.getAttribute('cy')}`; });
const addButton = (noun: string) => screen.getByRole('button', { name: `Add one ${noun}` });
const correctness = (h: ReturnType<typeof mount>) => h.state().task!.evidence.correctness;
const tiles = (list: string[]) => list.forEach(t => fireEvent.click(screen.getByRole('button', { name: `Add tile ${t}` })));

describe('binding', () => {
  const modes: Array<[string, AddSubChallenge, 'K' | '1']> = [
    ['act_out', ch({}), 'K'],
    ['solve_story', ch({ type: 'solve-story', unknownPosition: 'result' }), '1'],
    ['build_equation', ch({ type: 'build-equation' }), '1'],
    ['create_story', ch({ type: 'create-story', storyText: '' }), 'K'],
  ];
  it.each(modes)('%s binds; a spoken key is published, a hands key is not', (mode, challenge, band) => {
    const d = data(band, [challenge]);
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'addition-subtraction-scene', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
    const h = mount(d, mode);
    const key = h.state().task!.workspace!.expectedAnswer;
    if (mode === 'solve_story') expect(key).toMatch(/^three \(3\)/);
    else expect(key).toBeUndefined();
  });

  it('the adapter refuses a story whose arithmetic does not add up', () => {
    expect(() => LIVE_ADAPTERS['addition-subtraction-scene'].validate(data('K', [ch({ resultCount: 4 })]))).toThrow();
  });
});

describe('act-out at Kindergarten stays enacted', () => {
  const minus = () => data('K', [ch({ operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2, equation: '4 - 2 = 2',
    storyText: '4 ducks are on the pond. 2 ducks swim away.' })]);

  it('seeds startCount, sends THAT object away, survivors keep their positions, no number entry', () => {
    mount(minus());
    expect(objects()).toHaveLength(4);
    expect(document.querySelector('input')).toBeNull();
    expect(screen.queryByRole('button', { name: /check|next/i })).toBeNull();
    const before = positions();
    fireEvent.click(objects()[1]);
    expect(positions()).toEqual([before[0], before[2], before[3]]);
  });

  it('commits on STILLNESS, and a wrong scene commits exactly as readily; Try again reseeds', () => {
    const h = mount(data('K', [ch({ startCount: 2, changeCount: 2, resultCount: 4, equation: '2 + 2 = 4' })]));
    fireEvent.click(addButton('ducks'));
    expect(correctness(h)).toBe('unknown');
    h.settle(3000);
    expect(correctness(h)).toBe('incorrect');
    expect(h.state().task!.workspace!.lastResponse?.response).toBe('The picture ends with 3 ducks.');
    h.dispatch('retry'); h.confirmVisible();
    expect(objects()).toHaveLength(2);
  });

  it('resets the stillness window on every touch, then credits a matching scene', () => {
    const h = mount(data('K', [ch({ startCount: 1, changeCount: 2, resultCount: 3, equation: '1 + 2 = 3' })]));
    fireEvent.click(addButton('ducks'));
    h.settle(2500);
    fireEvent.click(addButton('ducks'));
    h.settle(2500);
    expect(correctness(h)).toBe('unknown');
    h.settle(600);
    expect(correctness(h)).toBe('correct');
  });
});

describe('solve-story answers with the mouth', () => {
  const solve = (band: 'K' | '1') => data(band, [ch({ type: 'solve-story', operation: 'subtraction', objectType: 'bunnies',
    storyText: '5 bunnies are in the garden. 2 bunnies hop away.', startCount: 5, changeCount: 2, resultCount: 3,
    equation: '5 - 2 = 3', unknownPosition: 'result' })], { maxNumber: 5 });

  it.each(['K', '1'] as const)('offers no keyboard and no numeral menu at %s', band => {
    mount(solve(band), 'solve_story');
    expect(document.querySelector('input')).toBeNull();
    for (const n of ['0', '1', '2', '3', '4', '5']) expect(screen.queryByRole('button', { name: n })).toBeNull();
  });

  it('counts a tapped object with a highlight; the number sentence shows only after credit', () => {
    const h = mount(solve('1'), 'solve_story');
    const circles = document.querySelectorAll('svg circle').length;
    fireEvent.click(objects()[0]);
    expect(document.querySelectorAll('svg circle').length).toBeGreaterThan(circles);
    expect(screen.queryByText('5 - 2 = 3')).toBeNull();
    expect(screen.queryByText(/How many/)).toBeNull();
    h.say('three'); h.feedback('correct');
    expect(screen.getByText('5 - 2 = 3')).toBeTruthy();
  });
});

describe('create-story builds the scene', () => {
  const create = (band: 'K' | '1', over: Partial<AddSubChallenge> = {}) => data(band, [ch({ type: 'create-story', storyText: '',
    objectType: 'birds', scene: 'farm', startCount: 3, changeCount: 2, resultCount: 5, equation: '3 + 2 = 5', ...over })], { maxNumber: 10 });

  it('starts empty on an addition equation and credits what was built', () => {
    const h = mount(create('K'), 'create_story');
    expect(objects()).toHaveLength(0);
    for (let i = 0; i < 5; i++) fireEvent.click(addButton('birds'));
    h.settle(3000);
    expect(correctness(h)).toBe('correct');
    expect(h.state().task!.demand.inPicture).toBe(5);
  });

  it('seeds startCount on a subtraction equation, and Grade 1 builds the same way', () => {
    mount(create('K', { operation: 'subtraction', startCount: 5, changeCount: 2, resultCount: 3, equation: '5 - 2 = 3' }), 'create_story');
    expect(objects()).toHaveLength(5);
    cleanup();
    mount(create('1'), 'create_story');
    expect(addButton('birds')).toBeTruthy();
  });
});

describe('act-out at Grade 1 enacts, then speaks', () => {
  const minus = () => data('1', [ch({ operation: 'subtraction', objectType: 'frogs', scene: 'farm',
    storyText: '6 frogs sit on a log. 2 frogs hop away.', startCount: 6, changeCount: 2, resultCount: 4, equation: '6 - 2 = 4' })]);

  it('sends objects away up to changeCount, then counts survivors; the picture never commits', () => {
    const h = mount(minus());
    fireEvent.click(objects()[0]); fireEvent.click(objects()[0]);
    expect(objects()).toHaveLength(4);
    fireEvent.click(objects()[0]);
    expect(objects()).toHaveLength(4);
    h.settle(6000);
    expect(correctness(h)).toBe('unknown');
    // The count is not a fact beside a spoken answer.
    expect(h.state().task!.demand.inPicture).toBeUndefined();
  });
});

describe('the change group waits for the story', () => {
  const join = (over: Record<string, unknown> = {}) => data('1', [ch({})], { groupedReveal: true, showTenFrame: true, ...over });
  const filled = () => document.querySelectorAll('.bg-amber-400\\/60').length;

  it('shows only the start group until the tutor presents the join; the ten frame follows', () => {
    const h = mount(join());
    h.settle(30_000);
    expect(objects()).toHaveLength(2);
    expect(filled()).toBe(2);
    expect(h.state().task!.demand.presentation).toBe('not ready');
    h.dispatch('present');
    expect(objects()).toHaveLength(3);
    expect(filled()).toBe(3);
    expect(h.offer('present')).toBeUndefined();
  });

  it('the learner can bring it in with Show me', () => {
    mount(join());
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(objects()).toHaveLength(3);
  });

  it('holds nothing back without groupedReveal, or on a scene the child builds', () => {
    const h = mount(join({ groupedReveal: false }));
    expect(objects()).toHaveLength(3);
    expect(h.offer('present')).toBeUndefined();
    cleanup();
    mount(data('K', [ch({})], { groupedReveal: true }));
    expect(objects()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
  });
});

describe('build-equation', () => {
  const equation = () => data('1', [ch({ type: 'build-equation', objectType: 'apples', scene: 'kitchen',
    storyText: '4 apples are on the table. 2 more apples are placed on the table.',
    startCount: 4, changeCount: 2, resultCount: 6, equation: '4 + 2 = 6' })]);

  it('a finished sentence commits itself, right or wrong', () => {
    const h = mount(equation(), 'build_equation');
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    tiles(['4', '+', '2', '=', '9']);
    h.settle(1200);
    expect(correctness(h)).toBe('incorrect');
    h.dispatch('retry'); h.confirmVisible();
    tiles(['4', '+', '2', '=', '6']);
    h.settle(1200);
    expect(correctness(h)).toBe('correct');
  });

  it('waits longer while the sentence is unfinished, then commits it', () => {
    const h = mount(equation(), 'build_equation');
    tiles(['4', '+']);
    h.settle(1500);
    expect(correctness(h)).toBe('unknown');
    h.settle(3100);
    expect(correctness(h)).toBe('incorrect');
  });
});

it('Hear the story again asks silently, as the host, never the answer', () => {
  mount(data('1', [ch({ type: 'solve-story', unknownPosition: 'result' })]), 'solve_story');
  fireEvent.click(screen.getByRole('button', { name: 'Hear the story again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('2 ducks are swimming');
  expect(text).not.toMatch(/three|\b3\b/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('Pip never publishes a change group still waiting, and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('story');
  const h = mount(data('1', [ch({})], { groupedReveal: true }), 'act_out', store);
  expect(store.getActive()?.targets.map(t => t.id)).not.toContain('object-2');
  h.dispatch('present');
  expect(store.getActive()?.targets.map(t => t.id)).toContain('object-2');
  h.say('three'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('a spoken answer and a hands answer complete the lesson once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(data('1', [ch({ type: 'solve-story', unknownPosition: 'result', id: 's1' }),
    ch({ id: 'c2', type: 'build-equation' })]), 'mixed');
  h.say('three'); h.feedback('correct', 'advance'); h.confirmVisible();
  tiles(['2', '+', '1', '=', '3']);
  h.settle(1200);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
});
