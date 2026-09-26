// @vitest-environment jsdom
/**
 * Solar system explorer on the teaching workspace: what is its own, plus its Pip surface. The
 * generic W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and
 * self-advance. The explore face is pinned by the reader-fit suite.
 *
 * Still NOT covered, jsdom is blind to it: whether the moving `<g>` targets are hittable in a real
 * browser ([[feedback_svg-g-unclickable-jsdom-blind]]).
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';
import type { CelestialBody } from './SolarSystemExplorer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const body = (id: string, name: string, distanceAu: number, radiusKm: number, type = 'planet'): CelestialBody => ({
  id, name, type: type as CelestialBody['type'], color: '#888', radiusKm, distanceAu,
  orbitalPeriodDays: distanceAu * 365, rotationPeriodHours: 24, moons: 1,
  description: `${name} is a planet.`,
  textureGradient: 'radial-gradient(circle, #888 0%, #444 100%)', temperatureC: 0,
});
const BODIES: CelestialBody[] = [
  { ...body('sun', 'Sun', 0, 696000, 'star'), orbitalPeriodDays: 0 },
  body('mercury', 'Mercury', 0.39, 2440),
  body('venus', 'Venus', 0.72, 6052),
  body('earth', 'Earth', 1.0, 6371),
  body('mars', 'Mars', 1.52, 3390),
  body('jupiter', 'Jupiter', 5.2, 69911),
  body('saturn', 'Saturn', 9.5, 58232),
];
const CHALLENGES = {
  identify: { id: 'ssc-id', type: 'identify', facet: 'name', answerBodyIds: ['earth'] },
  order_from_sun: { id: 'ssc-order', type: 'order_from_sun', facet: 'closest', answerBodyIds: ['mercury'] },
  classify: { id: 'ssc-class', type: 'classify', facet: 'giant' },
  compare_attribute: { id: 'ssc-big', type: 'compare_attribute', facet: 'biggest', answerBodyIds: ['jupiter'] },
  orbital_reasoning: { id: 'ssc-year', type: 'orbital_reasoning', facet: 'longest_year' },
} as const;
const KEYS: Record<string, RegExp> = { identify: /^Earth\./, order_from_sun: /^Mercury\./, classify: /^Any one of: Jupiter, Saturn\./,
  compare_attribute: /^Jupiter\./, orbital_reasoning: /^Saturn\./ };
const data = (...challenges: unknown[]): Record<string, unknown> => ({ title: 'Our Solar System', description: 'Explore the planets.',
  bodies: BODIES, gradeLevel: '3', challenges });
const mount = (d: Record<string, unknown>, mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'solar-system-explorer', evalMode: mode, data: d, instanceId: 'solar', pipStore });
const tap = (container: HTMLElement, id: string) => act(() => { fireEvent.click(container.querySelector(`[data-body-id="${id}"]`)!); });
const svgTexts = (container: HTMLElement) => Array.from(container.querySelectorAll('svg text')).map(t => t.textContent ?? '');

it.each(Object.keys(CHALLENGES))('%s binds: the code-computed name is the spoken key', mode => {
  const d = data(CHALLENGES[mode as keyof typeof CHALLENGES]);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'solar-system-explorer', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mount(d, mode);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(KEYS[mode]);
});

it('identify spotlights the planet, withholds every label and the research card, and reveals only on credit', () => {
  const h = mount(data(CHALLENGES.identify), 'identify');
  const c = h.view.container;
  expect(c.querySelector('[data-body-id="earth"] circle[stroke-dasharray="6 3"]')).not.toBeNull();
  expect(svgTexts(c)).not.toContain('Earth');
  tap(c, 'earth');
  expect(screen.queryByText('Earth is a planet.')).toBeNull();
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  h.say('Mars'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(c.querySelector('circle[stroke="#34d399"]')).toBeNull();
  h.say("it's Earth"); h.feedback('correct');
  expect(c.querySelector('[data-body-id="earth"] circle[stroke="#34d399"]')).not.toBeNull();
});

it('a tap on a compare item opens the card and answers nothing; right answers complete once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(data(CHALLENGES.order_from_sun, CHALLENGES.compare_attribute), 'order_from_sun|compare_attribute');
  expect(svgTexts(h.view.container)).toContain('Mercury');
  tap(h.view.container, 'jupiter');
  expect(screen.getByText('Jupiter is a planet.')).toBeTruthy();
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /hear the question|next|check/i })).toBeNull();
  h.say('Mercury'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('Jupiter'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'solar-system-explorer', totalChallenges: 2, correctChallenges: 2, bodiesExplored: 1 });
});

it('Pip outlines the sky and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('solar');
  const h = mount(data(CHALLENGES.order_from_sun), 'order_from_sun', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('Mercury'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a sky with nothing askable; the component degrades to exploration', () => {
  const adapter = LIVE_ADAPTERS['solar-system-explorer'];
  const broken = data({ ...CHALLENGES.order_from_sun, answerBodyIds: ['jupiter'] });
  expect(() => adapter.validate(broken)).toThrow();
  expect(adapter.validate(data(CHALLENGES.order_from_sun))).toBeTruthy();
  mount(broken, 'order_from_sun');
  expect(screen.getByText('EXPLORE')).toBeTruthy();
});
