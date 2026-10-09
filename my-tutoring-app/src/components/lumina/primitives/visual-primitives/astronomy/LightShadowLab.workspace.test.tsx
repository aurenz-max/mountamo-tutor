// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real LightShadowLab on the shared teaching workspace, mounted the way a
 * lesson mounts it. One tapped choice and Check Answer commits a checked gesture with its named miss; Try again
 * clears the choice; the runtime owns progression; the shadow (or, on apply, the time) never reaches the tutor,
 * and what a mode hides while open is not drawn.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { ShadowChallenge, SunPosition } from './LightShadowLab';
import { keyOption, normalizeTime, openingSun, shadowHarnessAnswers, shadowMiss, shadowOptions } from './lightShadowWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const SUNS: SunPosition[] = [
  { time: '8:00 AM', altitude: 20, azimuth: 25 }, { time: '10:00 AM', altitude: 40, azimuth: 65 },
  { time: '12:00 PM', altitude: 65, azimuth: 90 }, { time: '2:00 PM', altitude: 40, azimuth: 120 }, { time: '4:00 PM', altitude: 20, azimuth: 155 },
];
const item = (id: string, type: ShadowChallenge['type'], sun: SunPosition, instruction: string): ShadowChallenge =>
  ({ id, type, instruction, sunPosition: sun, correctShadow: { direction: 'W', relativeLength: 'long' }, hint: 'The shadow is long and points west.' });
const CHALLENGES: Record<string, ShadowChallenge> = {
  observe: item('o', 'observe', SUNS[0], 'Drag the sun to the 8:00 AM mark. Which way does the shadow point, and how long is it?'),
  predict: item('p', 'predict', SUNS[3], 'The sun is at 2:00 PM. Predict which way the shadow points and how long it is.'),
  measure: item('m', 'measure', SUNS[2], 'Look at the shadow at noon. Which way does it point, and how long is it?'),
  apply: item('a', 'apply', SUNS[4], 'The shadow is long and points east. What time is it?'),
};

const mount = (mode: string, challenges: ShadowChallenge[]) =>
  mountWorkspace({ primitiveId: 'light-shadow-lab', evalMode: mode, instanceId: 'shadow',
    data: { title: 'Shadows', description: 'Sun and shadow', theme: 'playground', gradeLevel: '1',
      objects: [{ type: 'flagpole', height: 4 }], sunPositions: SUNS, challenges } });
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press('Check Answer'); h.settle(); };
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;

it.each(Object.keys(CHALLENGES))('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = CHALLENGES[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Next Challenge|See Results|Shadow: /);
  // The generator's hint states the shadow; it is never drawn.
  expect(h.view.container.textContent).not.toContain('points west');
  // The scene names the choices on screen but never which one is right, nor the shadow it reads from.
  const facts = JSON.stringify(demand(h));
  const key = keyOption(c);
  expect(facts.split(key).length - 1).toBe(1);
  expect(facts).not.toMatch(/correct|answer is/i);
  // Apply: the clock is not drawn, so the key's time is on screen once, as one of the choices.
  if (mode === 'apply') expect(h.view.container.textContent!.split(normalizeTime(c.sunPosition.time)).length - 1).toBe(1);
  // Every option is in the key's own form: no option stands out.
  const options = shadowOptions(c, SUNS);
  expect(options).toHaveLength(4);
  expect(new Set(options.map(o => o.replace(/[A-Za-z]+ \(\w+\)|Directly below|\d+:\d+ [AP]M|Short|Medium|Long/g, '#'))).size).toBe(1);
  // Right first time: checked by the activity, credited, then the runtime advances and the lesson completes.
  answer(h, key);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('predict: the shadow on the sun\'s side commits toward_sun, closes the choices, and Try again clears it', () => {
  seam.evaluationContext = { lesson: 'test' };
  const c = CHALLENGES.predict;
  const h = mount('predict', [c, { ...c, id: 'p2' }]);
  // No shadow drawn while the prediction is open.
  expect(h.view.container.querySelectorAll('line[stroke="rgba(0,0,0,0.5)"]')).toHaveLength(0);
  const wrong = shadowHarnessAnswers(c, SUNS).plainWrong;
  expect(wrong).toBe('West (right), Medium');
  answer(h, wrong);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'toward_sun' });
  expect(demand(h)).toMatchObject({ learnerWork: 'Chose "West (right), Medium"' });
  // Still no shadow, and the choice is closed until Try again.
  expect(h.view.container.querySelectorAll('line[stroke="rgba(0,0,0,0.5)"]')).toHaveLength(0);
  answer(h, keyOption(c));
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  answer(h, keyOption(c));
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.querySelectorAll('line[stroke="rgba(0,0,0,0.5)"]')).toHaveLength(1);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('p2');
  answer(h, keyOption(c));
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'p', phase: 'predict', miss: 'toward_sun' })]);
  h.close();
});

it('apply: the sun and the clock are hidden until the time is answered; the morning time for an evening shadow is mirror_time', () => {
  const c = CHALLENGES.apply;
  const h = mount('apply', [c]);
  expect(h.view.container.querySelector('circle[fill="#FFD700"]')).toBeNull();
  answer(h, '8:00 AM');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'mirror_time' });
  expect(h.view.container.querySelector('circle[fill="#FFD700"]')).toBeNull();
  h.dispatch('retry'); h.confirmVisible();
  answer(h, '4:00 PM');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.querySelector('circle[fill="#FFD700"]')).not.toBeNull();
  h.close();
});

it('observe: the sun opens where its shadow points the other way, and the time marks are drawn', () => {
  const c = CHALLENGES.observe;
  expect(openingSun(c)).toEqual({ altitude: 20, azimuth: 155 });
  const h = mount('observe', [c]);
  expect(h.view.container.textContent).toContain('10:00 AM');
  expect(demand(h).sunNow).toBe('the sun is low in the sky, on the west side (the right), on the 4:00 PM mark');
  h.close();
});

it('shadowMiss names each signature error', () => {
  const at = (sun: SunPosition, type: ShadowChallenge['type'] = 'predict') => item('x', type, sun, 'q');
  expect(shadowMiss(at(SUNS[0]), 'East (left), Long')).toBe('toward_sun');
  expect(shadowMiss(at(SUNS[0]), 'West (right), Short')).toBe('length_flipped');
  expect(shadowMiss(at(SUNS[0]), 'West (right), Medium')).toBe('length_off');
  expect(shadowMiss(at(SUNS[0]), 'Directly below, Long')).toBe('below_when_side');
  expect(shadowMiss(at(SUNS[0]), 'East (left), Short')).toBe('both_wrong');
  expect(shadowMiss(at(SUNS[2]), 'West (right), Short')).toBe('side_when_overhead');
  expect(shadowMiss(at(SUNS[0]), 'West (right), Long')).toBeUndefined();
  expect(shadowMiss(at(SUNS[1], 'apply'), '2:00 PM', SUNS)).toBe('mirror_time');
  expect(shadowMiss(at(SUNS[1], 'apply'), '8:00 AM', SUNS)).toBe('wrong_height');
  expect(shadowMiss(at(SUNS[1], 'apply'), '12:00 PM', SUNS)).toBe('other_time');
  // A wrong apply time always casts a different shadow from the key's.
  expect(shadowOptions(at(SUNS[1], 'apply'), SUNS)).not.toContain('11:00 AM');
});

it('every saved payload item offers four different choices, the key once, each wrong one a named miss', () => {
  for (const mode of ['observe', 'predict', 'measure', 'apply']) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { data } = require(`../../../components/live-activity/runtime/testing/w1-payloads/light-shadow-lab.${mode}.json`);
    for (const c of data.challenges as ShadowChallenge[]) {
      const options = shadowOptions(c, data.sunPositions);
      expect(new Set(options).size, `${mode} ${c.id}`).toBe(4);
      expect(options.filter(o => o === keyOption(c))).toHaveLength(1);
      options.filter(o => o !== keyOption(c)).forEach(o => expect(shadowMiss(c, o, data.sunPositions)).toBeTruthy());
    }
  }
});
