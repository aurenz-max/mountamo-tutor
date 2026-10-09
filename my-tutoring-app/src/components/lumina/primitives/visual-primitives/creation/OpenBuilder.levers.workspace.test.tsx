// @vitest-environment jsdom
/**
 * open-builder levers (`openBuilderLevers.ts`), mounted the way a lesson mounts it, with the buddy's HTTP call and the
 * board picture substituted. A help lever changes the board and the scene fact in one commit and draws no block; the
 * smaller practice project is ungraded and gives the full project back on an empty board; only the full project's
 * met build is credited, with the levers recorded.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/primitives/build-layer/buildLayer', async orig => ({
  ...(await orig<typeof import('../../build-layer/buildLayer')>()), svgPicture: async () => 'P'.repeat(200) }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import { presetProjects, type OpenBuilderChallenge, type OpenBuilderVerdict, type SceneId } from './openBuilderModel';
import { MARKS_LEVER, PARTS_LEVER, SIMPLER_LEVER } from './openBuilderLevers';

let verdicts: OpenBuilderVerdict[] = [];
const judged: { sceneId: string }[] = [];
beforeEach(() => {
  installRuntimeTimers(); verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    if (body.action !== 'judgeOpenBuild') return { ok: false, status: 404 };
    judged.push(body.params);
    return { ok: true, json: async () => verdicts.shift() };
  }));
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const project = (id: string, sceneId: SceneId, supportTier?: 'easy'): OpenBuilderChallenge =>
  ({ ...presetProjects([sceneId as never])[0], id, ...(supportTier ? { supportTier } : {}) });
const mount = (challenges: OpenBuilderChallenge[]) => mountWorkspace({ primitiveId: 'open-builder', evalMode: 'build_to_goal',
  data: { title: 'Little Builders', description: 'Build.', challengeType: 'build_to_goal', gradeBand: 'K-2', challenges } });
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const drop = (h: WorkspaceHarness, block: string, col: number) => { h.press(`Choose ${block}`); h.press(`Drop in column ${col}`); };
const done = async (h: WorkspaceHarness, verdict: OpenBuilderVerdict) => {
  verdicts.push(verdict);
  h.press("I'm done!");
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
};
const miss = (m: 'missing_part' | 'does_not_work'): OpenBuilderVerdict => ({ met: false, miss: m, noticed: 'I see blocks.', nudge: 'What does the goal need?' });
const met: OpenBuilderVerdict = { met: true, noticed: 'I see your build.', nudge: '' };

it('a miss, then the job marks: flags on the banks in the same commit, nothing where blocks go, recorded on the next try', async () => {
  const h = mount([project('ob-1', 'bridge')]);
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[MARKS_LEVER, false], [SIMPLER_LEVER, false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  drop(h, 'plank', 4);
  await done(h, miss('does_not_work'));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'ob-1', correct: false, miss: 'does_not_work' });
  expect(observerLever(h.state(), true)).toBe(MARKS_LEVER);

  const receipt = h.dispatch('pull_lever', { lever: MARKS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="job-marks"] [data-mark="flag"]')).toHaveLength(2);
  // An aid: stripped from the picture the buddy judges.
  expect(q(h, '[data-lever="job-marks"]')[0].getAttribute('data-aid')).toBe('job-marks');
  expect(String(receipt.state.task!.demand.onScreen)).toBe('A flag on each river bank, at the edge of the water');
  expect(q(h, '[data-block-id]')).toHaveLength(1);

  // A refused pull changes nothing on screen, in the levers or in the attempts.
  const before = { levers: JSON.stringify(levers(h)), attempts: attempts(h).length, html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: MARKS_LEVER }).status).toBe('blocked');
  expect({ levers: JSON.stringify(levers(h)), attempts: attempts(h).length, html: h.view.container.innerHTML }).toEqual(before);

  h.dispatch('retry');
  drop(h, 'long block', 6);
  await done(h, met);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'ob-1', correct: true, assisted: true, levers: [MARKS_LEVER] });
  h.close();
});

it('parts cards, then the smaller job: an ungraded kitten roof, then the puppy house back on an empty board, credited', async () => {
  const h = mount([project('ob-1', 'puppy-house'), project('ob-2', 'giraffe')]);
  expect(levers(h).map(l => l.id)).toEqual([PARTS_LEVER, SIMPLER_LEVER]);
  drop(h, 'tall block', 4);
  await done(h, miss('missing_part'));
  const parts = h.dispatch('pull_lever', { lever: PARTS_LEVER });
  expect(Array.from(q(h, '[data-lever="goal-parts"] [data-part]')).map(n => n.textContent)).toEqual(['🧱walls', '☂️a roof']);
  expect(String(parts.state.task!.demand.onScreen)).toMatch(/walls, a roof/);

  const simpler = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(simpler.status).toBe('committed');
  expect(h.state().task).toMatchObject({ itemId: 'ob-1~simpler' });
  expect(h.state().task!.demand).toMatchObject({ project: 'Shade for Kitten' });
  expect(q(h, '[data-block-id]')).toHaveLength(0);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  expect(q(h, '[data-practice]')).toHaveLength(1);
  expect(levers(h)).toEqual([]);

  drop(h, 'long block', 5);
  await done(h, miss('missing_part'));
  h.dispatch('retry');
  expect(q(h, '[data-block-id]')).toHaveLength(1);
  drop(h, 'long block', 5);
  await done(h, met);
  expect(judged.map(j => j.sceneId)).toEqual(['puppy-house', 'kitten-shade', 'kitten-shade']);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'ob-1~simpler', correct: true, practice: true });

  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'ob-1' });
  expect(q(h, '[data-block-id]')).toHaveLength(0);
  expect(q(h, '[data-lever="goal-parts"]')).toHaveLength(1);
  drop(h, 'tall block', 4);
  await done(h, met);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['ob-1', false, false], ['ob-1~simpler', false, true], ['ob-1~simpler', true, true], ['ob-1', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ assisted: true, levers: [PARTS_LEVER, SIMPLER_LEVER] });
  h.close();
});

it('easy starts with the help shown, and that is not a pull', async () => {
  const h = mount([project('ob-1', 'giraffe', 'easy')]);
  expect(levers(h).find(l => l.id === MARKS_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-mark="line"]')).toHaveLength(1);
  drop(h, 'tall block', 2);
  await done(h, met);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect(attempts(h).at(-1)!.levers).toBeUndefined();
  h.close();
});
