// @vitest-environment jsdom
/**
 * Spatial scene answered aloud (ROLLOUT.md VB-1): identify and describe ask for one position word, so each is a spoken
 * item that still takes the tap. The observer credits a spoken word from the tutor's feedback; the tap stays checked by
 * the scene. Placing a thing (place, place_in, place_between, follow_directions) stays tap-only.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { SpatialSceneChallenge } from './SpatialScene';
import { spatialSpokenMisses, wordExpectedAnswer } from './spatialSceneWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const thing = (name: string, image: string, row: number, col: number) => ({ name, image, position: { row, col } });
const box = thing('box', '📦', 2, 1);

/** The ball two rows above the box: "above", with a gap, so "on" is not it. */
const IDENTIFY: SpatialSceneChallenge = { id: 'id1', type: 'identify', instruction: 'Where is the ball?',
  sceneObjects: [box, thing('ball', '⚽', 0, 1), thing('tree', '🌳', 0, 0), thing('star', '⭐', 2, 2)],
  targetObject: thing('ball', '⚽', 0, 1), correctPosition: 'above', referenceObjectName: 'box', options: ['below', 'above', 'beside'] };
/** The cat just left of the box (Grade 1): "left of"; a bare "beside" is true but names no side. */
const DESCRIBE: SpatialSceneChallenge = { id: 'de1', type: 'describe', instruction: 'Which word tells where the cat is?',
  sceneObjects: [box, thing('cat', '🐱', 2, 0), thing('tree', '🌳', 0, 0), thing('star', '⭐', 0, 2)],
  targetObject: thing('cat', '🐱', 2, 0), correctPosition: 'left_of', referenceObjectName: 'box', options: ['right_of', 'left_of', 'above'] };
/** The ball resting right on the box: "above" and "on" are both true. */
const TOUCHING: SpatialSceneChallenge = { ...IDENTIFY, id: 'id2', instruction: 'Where is the ball now?',
  sceneObjects: [box, thing('ball', '⚽', 1, 1), thing('tree', '🌳', 0, 0), thing('star', '⭐', 2, 2)],
  targetObject: thing('ball', '⚽', 1, 1) };

const SPOKEN: Array<[string, SpatialSceneChallenge, string, string, string]> = [
  ['identify', IDENTIFY, 'below the box', "it's above the box", 'Above'],
  ['describe', DESCRIBE, 'right of the box', 'to the left of the box', 'Left of'],
];
const scene = (challenges: SpatialSceneChallenge[]) => ({ title: 'Where?', gridSize: 3, gradeBand: '1', challenges });
const mount = (mode: string, challenges: SpatialSceneChallenge[]) =>
  mountWorkspace({ primitiveId: 'spatial-scene', evalMode: mode, data: scene(challenges) });
const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });

it.each(SPOKEN)('%s: a wrong spoken word retries, a right one credited by the tutor completes once', async (mode, c, wrong, right) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode, [c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  // The scene says how the learner answers, never the answer.
  expect(String(task.demand.constraints)).toMatch(/says the/);
  expect(task.task).not.toMatch(/above|left/);
  expect(JSON.stringify(task.demand)).not.toMatch(/above|left of|correctPosition/);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('a credited spoken word shows the word picked, and the next challenge still takes the tap', () => {
  const h = mount('identify', [IDENTIFY, TOUCHING]);
  h.say('above'); h.feedback('correct');
  expect(screen.getByText('Yes! The ball is above the box!')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Above' }).className).toMatch(/border-emerald-400/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('id2');
  press('Above'); press(/check/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it.each(SPOKEN)('%s: a tap after a spoken answer is checked by the scene and ends the pending speech', (mode, c, _wrong, right, tap) => {
  const h = mount(mode, [c]);
  h.say(right);
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  press(tap); press(/check/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct tap is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('describe', [DESCRIBE]);
  press('Left of'); press(/check/i);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengesCompleted: 1, challengesTotal: 1, totalAttempts: 1 });
});

it('placing a thing stays tap-only with no key', () => {
  const ball = thing('ball', '⚽', 0, 0);
  const cases: Array<[string, SpatialSceneChallenge]> = [
    ['place', { id: 'p', type: 'place', instruction: 'Put the ball above the box.', sceneObjects: [box], targetObject: ball,
      correctPosition: 'above', referenceObjectName: 'box', correctCell: { row: 1, col: 1 } }],
    ['follow_directions', { id: 'f', type: 'follow_directions', instruction: 'Follow the steps', sceneObjects: [box],
      targetObject: ball, correctPosition: 'above', steps: [{ instruction: 'Put the ball above the box', targetObject: ball,
        correctCell: { row: 1, col: 1 } }] }],
  ];
  for (const [mode, c] of cases) {
    const h = mount(mode, [c]);
    expect(h.state().task!.demand.response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    cleanup();
  }
});

it('expectedAnswer credits what the geometry makes true and names the near words that are not it', () => {
  // A gap: "on" means touching, so it is not it (contract R3).
  expect(wordExpectedAnswer(IDENTIFY)).toMatch(/"on" or "on top of" is not it: that word means touching/);
  // Touching: "on" is right too.
  expect(wordExpectedAnswer(TOUCHING)).toMatch(/Said as "above", "over", "on" or "on top of"/);
  // Left of, next to the box: a bare beside names no side.
  const left = wordExpectedAnswer(DESCRIBE);
  expect(left).toMatch(/A bare "beside" or "next to" is true but does not say which side/);
  expect(left).toMatch(/as the learner sees the screen/);
  expect(left).toMatch(/"right of".* is not it\.$/);
});

it('every spoken miss is one the catalog lists for its mode, and none is a word the scene makes true', () => {
  const lists = getComponentById('spatial-scene')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  for (const [mode, c, true_] of [['identify', IDENTIFY, ['above', 'over']], ['identify', TOUCHING, ['above', 'on', 'on top of']],
    ['describe', DESCRIBE, ['left of', 'to the left of', 'beside', 'next to']]] as const) {
    const misses = spatialSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    for (const m of misses) {
      expect(lists[mode]).toContain(m.id);
      for (const e of m.examples ?? []) for (const w of true_) expect(e).not.toContain(` is ${w} the `);
    }
  }
  expect(spatialSpokenMisses(IDENTIFY).map(m => m.id)).toEqual(['opposite_word', 'same_axis_word', 'other_axis_word']);
  expect(spatialSpokenMisses(TOUCHING).map(m => m.id)).toEqual(['opposite_word', 'other_axis_word']);
});
