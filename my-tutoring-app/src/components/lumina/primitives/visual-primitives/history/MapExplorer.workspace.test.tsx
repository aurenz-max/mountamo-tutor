// @vitest-environment jsdom
/**
 * The real MapExplorer on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell, and the real compass rose. The WebGL map (MapLibre) is
 * replaced by buttons for its pins and regions that report taps the way the map does; the Live context,
 * evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  map: { view: '', bearing: 0, labels: [] as string[], flightPoints: 0 } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'map',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./map/LiveMap', () => ({
  LiveMap: function Stub(p: { view: string; bearing: number; town?: { places: { id: string; name: string }[] };
    labels: ReadonlySet<string>; disabled?: boolean; flight?: { points: unknown[] } | null;
    onTapPlace?: (id: string, b: number) => void; onTapRegion?: (id: string) => void }) {
    seam.map = { view: p.view, bearing: p.bearing, labels: Array.from(p.labels), flightPoints: p.flight?.points.length ?? 0 };
    const regions = ['africa', 'asia', 'europe', 'north_america', 'south_america', 'australia', 'antarctica', 'pacific', 'atlantic', 'indian'];
    return <div data-live-map={p.view}>
      {p.view === 'town' && p.town?.places.map(pl => <button key={pl.id} type="button" data-pip-object={pl.id} aria-label={pl.name}
        onClick={() => { if (!p.disabled) p.onTapPlace?.(pl.id, p.bearing); }}>{pl.name}</button>)}
      {p.view === 'world' && regions.map(r => <button key={r} type="button" data-pip-object={`region-${r}`}
        onClick={() => { if (!p.disabled) p.onTapRegion?.(r); }}>{r}</button>)}
    </div>;
  },
}));
import MapExplorer, { type MapExplorerData } from './MapExplorer';
import { COMPASS_LEVER } from './mapExplorerLevers';
import { NATIONAL_MALL, buildSession, buildTownChallenges, buildWorldChallenges, flyRoute, type MapTask } from './map/mapModel';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; });
afterEach(cleanup);

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function cityData(task: MapTask, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): MapExplorerData {
  return { instanceId: 'map', title: 'Find Your Way', description: 'Use the compass.', challengeType: task, townMap: NATIONAL_MALL,
    challenges: buildTownChallenges(NATIONAL_MALL, task, 4, difficulty, seeded(4)) };
}

function mount(data: MapExplorerData, pin: string = data.challengeType) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <MapExplorer data={data} runtimePlanItemId="plan-map" runtimeEvalMode={pin} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'map', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as never }); });
  };
  const touch = (id: string) => act(() => {
    const el = document.querySelector(`[data-pip-object="${id}"]`);
    expect(el, `no ${id} on screen`).toBeTruthy();
    fireEvent.click(el!);
  });
  const press = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { state, dispatch, touch, press, next };
}

const evidence = (h: ReturnType<typeof mount>) => h.state().task!.evidence.correctness;

it.each(['find_by_direction', 'name_direction', 'build_route'] as const)('%s binds; the tutor gets the ask, never the key', task => {
  const data = cityData(task);
  const h = mount(data);
  const c = data.challenges[0];
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain(c.instruction);
  // "Which way?" is one sayable word: spoken (the tutor judges it against the key) with the arm tap beside it. The rest stay gesture.
  if (task === 'name_direction') expect(h.state().task!.workspace!.expectedAnswer).toMatch(new RegExp(`^"${c.direction}"`));
  else expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const demand = JSON.stringify(h.state().task!.demand);
  expect(demand).not.toMatch(/targetId|"direction"/);
  if (task === 'name_direction') expect(demand).not.toMatch(new RegExp(`\\b${c.direction}\\b(?! of the map)`, 'i'));
  expect(demand).toContain('north points up the screen');
});

it('find_by_direction: the starting place is a named miss; Try again reopens; the right place completes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const data = cityData('find_by_direction');
  const h = mount(data);
  const [c1, c2] = data.challenges;
  h.touch(c1.fromId!);
  expect(evidence(h)).toBe('incorrect');
  expect(screen.getByText(/itself\. Look/)).toBeTruthy();
  h.touch(c1.targetId!);  // input closed until the runtime reopens the item
  expect(evidence(h)).toBe('incorrect');
  h.dispatch('retry');
  h.touch(c1.targetId!);
  expect(evidence(h)).toBe('correct');
  expect(screen.getByText(/^Yes!/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe(c2.id);
  expect(screen.queryByText(/^Yes!/)).toBeNull();
  h.touch(c2.targetId!);
  expect(evidence(h)).toBe('correct');
});

it('name_direction: the compass arms are the answer; a turned map tells the tutor up is not north', () => {
  const data = cityData('name_direction', 'hard');
  const h = mount(data);
  const c = data.challenges[0];
  expect(seam.map.bearing).toBe(c.rotation);
  expect(JSON.stringify(h.state().task!.demand)).toContain('up is not north');
  const wrong = ({ north: 'South', south: 'North', east: 'West', west: 'East' } as const)[c.direction!];
  h.press(wrong);
  expect(evidence(h)).toBe('incorrect');
  h.dispatch('retry');
  h.press(c.direction!.charAt(0).toUpperCase() + c.direction!.slice(1));
  expect(evidence(h)).toBe('correct');
});

it('build_route: Land checks the plan at once; Try again plans again from the start', () => {
  const data = cityData('build_route');
  const h = mount(data);
  const c = data.challenges[0];
  const { wanted } = flyRoute(NATIONAL_MALL, c, []);
  const e = Math.round(wanted.east), n = Math.round(wanted.north);
  const ew = e > 0 ? 'East' : 'West', ns = n > 0 ? 'North' : 'South';
  for (let i = 0; i < Math.abs(e); i++) h.press(ew === 'East' ? 'West' : 'East');
  for (let i = 0; i < Math.abs(n); i++) h.press(ns);
  expect(seam.map.flightPoints).toBe(Math.abs(e) + Math.abs(n) + 1);
  h.press('Land!');
  expect(evidence(h)).toBe('incorrect');
  h.dispatch('retry');
  expect(seam.map.flightPoints).toBe(1);
  for (let i = 0; i < Math.abs(e); i++) h.press(ew);
  for (let i = 0; i < Math.abs(n); i++) h.press(ns);
  h.press('Land!');
  expect(evidence(h)).toBe('correct');
});

it('find_on_globe: no names until found; water for land is a miss; the found continent is named', () => {
  const challenges = buildWorldChallenges('find_on_globe', 4, 'easy', seeded(2));
  const h = mount({ instanceId: 'map', title: 'Spin the Globe', description: '', challengeType: 'find_on_globe', challenges });
  const target = challenges[0].targetId!;
  expect(seam.map.view).toBe('world');
  expect(seam.map.labels).toEqual([]);
  h.touch('region-pacific');
  expect(evidence(h)).toBe('incorrect');
  h.dispatch('retry');
  h.touch(`region-${target}`);
  expect(evidence(h)).toBe('correct');
  expect(seam.map.labels).toEqual([target]);
});

it('a mixed session starts on the globe and moves to the city', () => {
  const challenges = buildSession(['find_on_globe', 'find_by_direction'], NATIONAL_MALL, 2, 'medium', seeded(6));
  const h = mount({ instanceId: 'map', title: 'Maps', description: '', challengeType: 'find_on_globe', challenges,
    townMap: NATIONAL_MALL }, 'find_on_globe|find_by_direction');
  expect(seam.map.view).toBe('world');
  h.touch(`region-${challenges[0].targetId}`);
  h.next();
  expect(seam.map.view).toBe('town');
  h.touch(challenges[1].targetId!);
  expect(evidence(h)).toBe('correct');
});

it('unbound (no runtime) renders the needs-the-tutor card, never the map', () => {
  const { container } = render(<MapExplorer data={cityData('find_by_direction')} runtimeEvalMode="find_by_direction" />);
  expect(container.querySelector('[data-workspace-unbound="map-explorer"]')).not.toBeNull();
  expect(container.querySelector('[data-live-map]')).toBeNull();
});

const glowing = () => document.querySelector('circle[stroke="rgba(250,204,21,0.75)"]');

it('compass_glow: offered where the compass does not already glow; a pull draws the glow and tells the tutor', () => {
  const h = mount(cityData('name_direction'));
  const levers = () => h.state().task!.workspace!.levers ?? [];
  expect(levers().map(l => [l.id, l.pulled])).toEqual([[COMPASS_LEVER, false]]);
  expect(glowing()).toBeNull();
  h.dispatch('pull_lever', { lever: COMPASS_LEVER });
  expect(levers().map(l => [l.id, l.pulled])).toEqual([[COMPASS_LEVER, true]]);
  expect(glowing()).not.toBeNull();
  expect(JSON.stringify(h.state().task!.demand)).toContain('read N on it first');
  cleanup();
  // Easy starts glowing (the tier's compassGlow): the lever would add nothing.
  const easy = mount(cityData('find_by_direction', 'easy'));
  expect(easy.state().task!.workspace!.levers ?? []).toEqual([]);
  expect(glowing()).not.toBeNull();
});
