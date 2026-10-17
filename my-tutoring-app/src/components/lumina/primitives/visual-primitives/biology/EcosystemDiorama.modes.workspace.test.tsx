// @vitest-environment jsdom
/**
 * The real EcosystemDiorama's other tasks on the shared teaching workspace, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D tank is a stub that exposes the sun (a button that ends
 * the day) and reports what the tank would draw; every other control is the diorama's own buttons.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { LifeState } from './ecosystemLife3d';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown, life: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'tank',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./EcosystemScene', () => ({
  default: function Stub(p: { onSun: (p: number) => void; sunActive: boolean; life: unknown; onTap: (t: string) => void; disabled: boolean }) {
    seam.life = p.life;
    return <div data-ecosystem-scene="stub">
      <button type="button" onClick={() => { if (p.sunActive) p.onSun(1); }}>sun-end</button>
      <button type="button" onClick={() => { if (!p.disabled) p.onTap('animal:bear'); }}>tank-bear</button>
      <button type="button" onClick={() => { if (!p.disabled) p.onTap('place:den'); }}>tank-den</button>
    </div>;
  },
}));
import EcosystemDiorama, { type EcosystemDioramaData } from './EcosystemDiorama';
import {
  buildCompareLogs, buildKeepCool, buildPlantNeeds, buildSeasonBehavior, buildSeasonLog, type EcosystemChallenge,
} from './ecosystemModel';
import { countWeather } from './ecosystemLife';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; seam.life = null; });
afterEach(cleanup);
const life = () => seam.life as LifeState;
const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function mount(challenges: EcosystemChallenge[], mode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: EcosystemDioramaData = { instanceId: 'tank', title: 'Island', description: 'Explore.', challengeType: challenges[0].type,
    gradeBand: 'K-2', islandName: 'Turtle Island', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <EcosystemDiorama data={data} runtimePlanItemId="plan-tank" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'tank', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const demand = () => JSON.stringify(state().task!.demand);
  const correctness = () => state().task!.evidence.correctness;
  return { state, dispatch, click, next, demand, correctness };
}

it('plant_needs: a plant in the hut droops (a named miss, never saying what is missing); fixed, it grows and completes', () => {
  const c = { ...buildPlantNeeds('sunflower', 'fix', 'eco-1'), start: { spot: 'hut' as const, fill: 'soil' as const, watered: true, extras: [] } };
  const h = mount([c, buildPlantNeeds('daisy', 'grow', 'eco-2')], 'plant_needs');
  expect(h.demand()).toContain('"potStandsIn":"the shade hut"');
  h.click('Watch it grow');
  expect(h.correctness()).toBe('incorrect');
  expect(life().plant!.droop).toBe(1);
  expect(screen.getByText(/drooped\. It is missing something/)).toBeTruthy();
  h.dispatch('retry');
  h.click('☀️ Sunny sand');
  h.click('Watch it grow');
  expect(h.correctness()).toBe('correct');
  expect(life().plant!.growth).toBe(1);
  h.next();
  expect(h.state().task!.itemId).toBe('eco-2');
  expect(life().plant!.setup.fill).toBe('empty');
  // A den grows nothing for a plant: it grows, but the check wants nothing it does not need.
  h.click('🟫 Soil'); h.click('💧 Water it'); h.click('🪵 Den');
  h.click('Watch it grow');
  expect(h.correctness()).toBe('incorrect');
  expect(screen.getByText(/did not need a den/)).toBeTruthy();
});

it('season_behavior: winter comes first; animals move by taps in the tank or the tray; Done is the check', () => {
  const h = mount([buildSeasonBehavior(['bear', 'bird'], 'eco-1')], 'season_behavior');
  expect(life().winter).toBe(0);
  expect(life().animals).toEqual([{ kind: 'bear', place: 'summer' }, { kind: 'bird', place: 'summer' }]);
  h.click('Bring winter ❄️');
  expect(life().winter).toBe(1);
  h.click('tank-bear'); h.click('tank-den');
  expect(life().animals![0]).toEqual({ kind: 'bear', place: 'den' });
  h.click('Done');
  expect(screen.getByText(/Some animals have not moved yet/)).toBeTruthy();
  h.click('Pick up the bird'); h.click('Winter place: den');
  h.click('Done');
  expect(h.correctness()).toBe('incorrect');
  expect(h.demand()).toContain("the bird: moved to the cave den"); // what is drawn, never where it belongs
  expect(h.demand()).not.toMatch(/bird[^;]*should|belongs|"answer"/);
  h.dispatch('retry');
  h.click('Pick up the bird'); h.click('Winter place: south');
  h.click('Done');
  expect(h.correctness()).toBe('correct');
});

it('season_from_log: days fill the log one by one; the season plus a weather that is there but not the most is a miss', () => {
  const c = buildSeasonLog('winter', 'eco-1', seeded(4));
  const h = mount([c], 'season_from_log');
  expect(h.demand()).not.toMatch(/winter/i);
  h.click('Next day');
  expect(life().weather).toBe(c.days[0]);
  for (let i = 1; i < 20; i++) h.click('Next day');
  expect(screen.getByText(/Which season was it\?/)).toBeTruthy();
  expect(h.demand()).toContain(`${countWeather(c.days).snowy} snowy days`);
  h.click('winter');
  h.click('sunny days row');
  expect(h.correctness()).toBe('incorrect');
  expect(screen.getByText(/Which weather happened the MOST/)).toBeTruthy();
  h.dispatch('retry');
  h.click('winter');
  h.click('snowy days row');
  expect(h.correctness()).toBe('correct');
});

it('compare_logs: both months fill two logs; picking the log with fewer is a named miss', () => {
  const c = buildCompareLogs(0, 'more', 'eco-1', seeded(9));
  const h = mount([c], 'compare_logs');
  for (let i = 0; i < 40; i++) h.click('Next day');
  const wrong = c.answer === 'a' ? c.b.label : c.a.label, right = c.answer === 'a' ? c.a.label : c.b.label;
  h.click(`Pick ${wrong}`);
  expect(h.correctness()).toBe('incorrect');
  h.dispatch('retry');
  h.click(`Pick ${right}`);
  expect(h.correctness()).toBe('correct');
});

it('keep_it_cool: a clear sheet lets the ice pop melt (named miss); an umbrella keeps it below the cool line', () => {
  const c = { ...buildKeepCool('ice pop', 'eco-1'), covers: ['clear sheet', 'umbrella', 'leaf roof'] as ('clear sheet' | 'umbrella' | 'leaf roof')[] };
  const h = mount([c], 'keep_it_cool');
  h.click('Cover: clear sheet');
  h.click('sun-end');
  expect(h.correctness()).toBe('incorrect');
  expect(life().cool!.fill).toBeGreaterThan(0.4);
  expect(screen.getByText(/Sunlight shines right through a clear sheet/)).toBeTruthy();
  h.dispatch('retry');
  expect(life().cool!.fill).toBeLessThan(0.15);
  h.click('Cover: umbrella');
  h.click('sun-end');
  expect(h.correctness()).toBe('correct');
  expect(life().cool!.fill).toBeLessThan(0.4);
});
