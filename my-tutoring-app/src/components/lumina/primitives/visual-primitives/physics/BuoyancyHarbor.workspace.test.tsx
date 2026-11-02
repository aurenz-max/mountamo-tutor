// @vitest-environment jsdom
/**
 * The real BuoyancyHarbor on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D harbor (WebGL) is replaced by buttons for the three things;
 * the Live context, evaluation writes and sound are substituted. Timers are faked so a drop settles on demand.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  scene: { dropped: [false, false, false] as boolean[], evidence: null as number | null, thingsKey: '',
    boat: undefined as { build: unknown; launched: boolean; pennies: number } | undefined,
    xray: false as boolean | undefined, tags: false as boolean | undefined, extras: null as unknown, modelBoats: null as unknown,
    spoons: 0 as number | undefined } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'harbor',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./BuoyancyScene', () => ({
  default: function Stub(p: { onTap: (t: string) => void; disabled: boolean; dropped: boolean[]; evidence: number | null; thingsKey: string;
    boat?: { build: unknown; launched: boolean; pennies: number }; xray?: boolean; tags?: boolean; extras?: unknown; modelBoats?: unknown;
    spoons?: number }) {
    seam.scene = { dropped: p.dropped, evidence: p.evidence, thingsKey: p.thingsKey, boat: p.boat, xray: p.xray, tags: p.tags,
      extras: p.extras ?? null, modelBoats: p.modelBoats ?? null, spoons: p.spoons };
    return <div data-harbor-scene="stub">
      {[0, 1, 2].map(i => <button key={i} type="button" onClick={() => { if (!p.disabled) p.onTap(`thing:${i}`); }}>{`thing-${i}`}</button>)}
      <button type="button" onClick={() => { if (!p.disabled) p.onTap('water'); }}>water</button>
    </div>;
  },
}));
import BuoyancyHarbor, { type BuoyancyHarborData } from './BuoyancyHarbor';
import { buildDropTest, evidenceIndex, result, thingByKey, type BuoyancyChallenge, type DropTestChallenge } from './buoyancyModel';
import type { BoatChallenge } from './boatModel';
import { foodByKey, makeSaltChallenge } from './saltModel';
import { practiceItem } from './buoyancyLevers';
import { makeShapeChallenge } from './shapeModel';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

// A big log (floats) beside a test made of wood and a big sinker; then a paper clip (sinks).
const items = () => [
  buildDropTest(thingByKey('log')!, 'hard', () => 0, 'drop-1'),
  buildDropTest(thingByKey('paper-clip')!, 'hard', () => 0.99, 'drop-2'),
];

function mount(challenges: BuoyancyChallenge[] = items(), mode = 'drop_test') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: BuoyancyHarborData = { instanceId: 'harbor', title: 'Sink or Float?', description: 'Test it.',
    challengeType: mode as BuoyancyHarborData['challengeType'], gradeBand: 'K-2', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BuoyancyHarbor data={data} runtimePlanItemId="plan-harbor" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'harbor', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as NonNullable<typeof a>['action'] }); });
    return state();
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const demand = () => JSON.stringify(state().task!.demand);
  const testBoth = (c: ReturnType<typeof items>[number]) => {
    click(`Drop the ${c.tested[0].name} in the water`);
    click(`Drop the ${c.tested[1].name} in the water`);
    act(() => { vi.advanceTimersByTime(3000); });
  };
  return { state, dispatch, click, next, demand, testBoth };
}

it('binds under tutor ownership as a gesture item; the mystery\'s result never reaches the tutor', () => {
  const h = mount();
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain('will the big log float or sink?');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.demand()).toContain('big log (made of wood, big): on the yellow stand on the pier, not tested');
  expect(h.demand()).not.toMatch(/big log[^"]*(floated|sank)/);
});

it('a tap on a test then the water drops it (no tapped guess); the result goes in the notebook once it settles; then the decide step opens', () => {
  const [c] = items();
  const h = mount();
  expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Guess the/ })).toBeNull();
  h.click('thing-1');
  h.click('water');
  expect(seam.scene.dropped).toEqual([false, true, false]);
  expect(screen.getByText('Splash! Watch it…')).toBeTruthy();
  expect(h.demand()).toMatch(new RegExp(`${c.tested[1].name}[^"]*just dropped in the tank, still moving`));
  act(() => { vi.advanceTimersByTime(3000); });
  expect(h.demand()).toMatch(new RegExp(`${c.tested[1].name}[^"]*dropped in the tank; it (floated|sank)`));
  h.click('water'); // the other test is chosen next
  expect(seam.scene.dropped).toEqual([true, true, false]);
  h.click('water'); // nothing left to drop: the mystery never goes in on a water tap
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy();
  expect(seam.scene.dropped).toEqual([true, true, false]);
});

it('judging by size is a named miss; Try again keeps the tests; the right call and test completes once, then drops the mystery', () => {
  seam.evaluationContext = { lesson: 'test' };
  const [c, c2] = items();
  const ev = evidenceIndex(c);
  const h = mount();
  h.testBoth(c);
  h.click('The big log will sink');
  h.click(`the ${c.tested[ev].name}`);
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Big or small is not what decides it/)).toBeTruthy();
  expect(seam.scene.dropped).toEqual([true, true, false]);
  h.dispatch('retry');
  expect(seam.scene.dropped).toEqual([true, true, false]);
  expect(screen.getByRole('button', { name: 'Check' }).hasAttribute('disabled')).toBe(true);
  h.click('The big log will float');
  h.click('thing-' + ev); // the 3D tap picks the evidence too
  expect(seam.scene.evidence).toBe(ev);
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.dropped).toEqual([true, true, true]);
  expect(screen.getByText(/Yes! The big log is made of wood.*even though it is so big/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('drop-2');
  expect(seam.scene.dropped).toEqual([false, false, false]);
  expect(h.state().task!.task).toContain('paper clip');
  h.testBoth(c2);
  h.click('The paper clip will sink');
  h.click(`the ${c2.tested[(1 - evidenceIndex(c2)) as 0 | 1].name}`);
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/made of the same stuff as the paper clip/)).toBeTruthy();
});

it('unbound (no runtime) renders the needs-the-tutor card, never the harbor', () => {
  const data: BuoyancyHarborData = { instanceId: 'harbor', title: 'Harbor', description: '', challengeType: 'drop_test',
    gradeBand: 'K-2', challenges: items() };
  const { container } = render(<BuoyancyHarbor data={data} runtimeEvalMode="drop_test" />);
  expect(container.querySelector('[data-workspace-unbound="buoyancy-harbor"]')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'thing-0' })).toBeNull();
});

const boats = (): BoatChallenge[] => [
  { id: 'boat-1', type: 'build_boat', instruction: 'Build a boat that carries 6 pennies without sinking. You can use foil or clay.', goal: 6, materials: ['foil', 'clay'] },
  { id: 'boat-2', type: 'build_boat', instruction: 'Build a boat that carries 9 pennies without sinking. You can use foil or clay.', goal: 9, materials: ['foil', 'clay'] },
];

it('boat build: a lump that sinks is a named miss, Try again keeps the build, a test runs to the sink, a boat with sides passes and is loaded', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(boats(), 'build_boat');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('build a boat that carries 6 pennies without sinking');
  expect(screen.getByRole('button', { name: "I'm done!" }).hasAttribute('disabled')).toBe(true);
  // Nothing is chosen for the learner.
  expect(seam.scene.boat).toEqual({ build: null, launched: false, pennies: 0 });
  h.click('Make it of clay'); h.click('Shape: a ball'); h.click('Size: big');
  h.click('Put it in the water');
  expect(seam.scene.boat).toMatchObject({ launched: true, pennies: 0 });
  expect(h.demand()).toContain('sunk to the bottom of the tank');
  h.click('Fish it out');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/It sinks with nothing in it/)).toBeTruthy();
  h.dispatch('retry');
  expect(h.demand()).toContain('a big clay ball');
  // A small foil boat with low sides, tested to the sink.
  h.click('Make it of foil'); h.click('Shape: low sides'); h.click('Size: small');
  h.click('Put it in the water');
  for (let i = 0; i < 6; i++) h.click('Add a penny');
  expect(screen.getByText('It sank with 6 pennies!')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add a penny' }).hasAttribute('disabled')).toBe(true);
  expect(h.demand()).toContain('a small foil boat with low sides sank with 6 pennies in it');
  h.click('Fish it out');
  h.click('Shape: tall sides');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/It floats with all 6 pennies!/)).toBeTruthy();
  act(() => { vi.advanceTimersByTime(900 + 6 * 320 + 50); });
  expect(seam.scene.boat).toMatchObject({ launched: true, pennies: 6 });
  h.next();
  expect(h.state().task!.itemId).toBe('boat-2');
  expect(seam.scene.boat).toEqual({ build: null, launched: false, pennies: 0 });
});

const leverIds = (h: ReturnType<typeof mount>) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);

it('drop-test levers: x-ray once a test is in, tags and the same-stuff pair draw in one commit, and the pull is recorded', () => {
  const [c] = items();
  const h = mount();
  expect(leverIds(h)).toEqual([['material_tags', false], ['side_by_side', false], ['one_step_less', false]]);
  h.testBoth(c);
  expect(leverIds(h).map(([id]) => id)).toEqual(['xray', 'material_tags', 'side_by_side', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'xray' });
  expect(seam.scene.xray).toBe(true);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/red down for its weight, blue up/);
  h.dispatch('pull_lever', { lever: 'side_by_side' });
  expect(Array.isArray(seam.scene.extras) && (seam.scene.extras as unknown[]).length).toBe(2);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/both made of/);
  expect(h.demand()).not.toMatch(/big log[^"]*(floated|sank)/);
  h.click('The big log will sink');
  h.click(`the ${c.tested[evidenceIndex(c)].name}`);
  h.click('Check');
  const attempt = h.state().task!.workspace!.attempts.at(-1)!;
  expect(attempt).toMatchObject({ correct: false, miss: 'judged_by_size' });
  expect(attempt.levers).toEqual(['xray', 'side_by_side']);
});

it('the easier drop test is ungraded practice on a fresh pier; the full item comes back with its levers', () => {
  const [c] = items();
  const h = mount();
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('drop-1~easier');
  expect(screen.getByText('Practice')).toBeTruthy();
  expect(h.state().task!.workspace!.levers ?? []).toEqual([]);
  expect(h.demand()).toContain('An easier practice item');
  expect(h.demand()).not.toContain(c.mystery.name);
  expect(seam.scene.dropped).toEqual([false, false, false]);
  // Solve the practice: it is checked but never scored, and the full item comes back on a fresh pier.
  const p = practiceItem(c) as DropTestChallenge;
  h.testBoth(p);
  h.click(`The ${p.mystery.name} will ${result(p.mystery) === 'floats' ? 'float' : 'sink'}`);
  h.click(`the ${p.tested[evidenceIndex(p)].name}`);
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.itemId).toBe('drop-1');
  expect(screen.queryByText('Practice')).toBeNull();
  expect(seam.scene.dropped).toEqual([false, false, false]);
  expect(leverIds(h).find(([id]) => id === 'one_step_less')).toEqual(['one_step_less', true]);
});

it('boat levers: the model boats come before a launch, x-ray while it is in the water', () => {
  const h = mount(boats(), 'build_boat');
  expect(leverIds(h)).toEqual([['solved_boat', false], ['one_step_less', false]]);
  h.dispatch('pull_lever', { lever: 'solved_boat' });
  expect((seam.scene.modelBoats as unknown[]).length).toBe(2);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/lump of clay on the bottom/);
  h.click('Make it of foil'); h.click('Shape: low sides'); h.click('Size: small');
  h.click('Put it in the water');
  expect(leverIds(h).map(([id]) => id)).toEqual(['xray', 'solved_boat', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'xray' });
  expect(seam.scene.xray).toBe(true);
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('boat-1~easier');
  expect(h.state().task!.task).toContain('carries 3 pennies');
  expect(seam.scene.boat).toEqual({ build: null, launched: false, pennies: 0 });
  expect(seam.scene.xray).toBe(false);
});

const salts = () => [
  makeSaltChallenge('salt-1', [foodByKey('egg')!, foodByKey('potato')!], ['egg'], ['potato']),
  makeSaltChallenge('salt-2', [foodByKey('grape')!], ['grape'], []),
];

it('salt water: foods drop into fresh water and sink, too much salt is a named miss, Try again keeps the water, pouring some out passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(salts(), 'salt_water');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('make the egg float but keep the potato chunk on the bottom');
  expect(screen.queryByRole('button', { name: 'Add a spoon of salt' })).toBeNull();
  h.click('Guess the egg will float');
  h.click('Guess the potato chunk will sink');
  expect(seam.scene.dropped).toEqual([true, true, false]);
  act(() => { vi.advanceTimersByTime(3000); });
  expect(h.demand()).toContain('the egg: on the bottom of the tank (guessed it would float)');
  expect(leverIdsOf(h)).toEqual(['xray', 'one_step_less']);
  // The egg needs 3 spoons, the potato chunk 5: 5 spoons floats both.
  for (let i = 0; i < 5; i++) h.click('Add a spoon of salt');
  expect(seam.scene.spoons).toBe(5);
  expect(h.demand()).toContain('the potato chunk: floating at the top of the water');
  h.click("I'm done!");
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'too_much_salt' });
  expect(screen.getByText(/Now the potato chunk floats too!/)).toBeTruthy();
  h.dispatch('retry');
  expect(seam.scene.spoons).toBe(5);
  h.click('Pour some out, add fresh water');
  expect(seam.scene.spoons).toBe(4);
  expect(screen.getAllByText('4 spoons')).toHaveLength(2); // the notebook: 4 on the way up, 4 after pouring out
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/With 4 spoons of salt it holds up the egg but not the potato chunk/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('salt-2');
  expect(seam.scene.spoons).toBe(0);
  expect(seam.scene.dropped).toEqual([false, false, false]);
});

it('salt water: the easier item is one food to float, as ungraded practice in fresh water', () => {
  const h = mount(salts(), 'salt_water');
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('salt-1~easier');
  expect(h.state().task!.task).toBe('Make the egg float. Add salt to the water one spoon at a time.');
  expect(screen.getByText('Practice')).toBeTruthy();
});

const leverIdsOf = (h: ReturnType<typeof mount>) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);

// A twig floats, a key sinks and a boulder sinks; sort a big log and a pebble without testing.
const rules = (): BuoyancyChallenge[] => [
  { id: 'rule-1', type: 'find_the_rule', tested: ['twig', 'key', 'boulder'].map(k => thingByKey(k)!), toSort: ['log', 'pebble'].map(k => thingByKey(k)!),
    instruction: 'Test the twig, the key and the boulder. Then, without testing, will the big log and the pebble float or sink? What decides it?' },
  { id: 'rule-2', type: 'find_the_rule', tested: ['cork', 'nail'].map(k => thingByKey(k)!), toSort: ['cork-board', 'wrench'].map(k => thingByKey(k)!),
    instruction: 'x' },
];

it('find the rule: the sort stays on its stands, a size rule is a named miss, Try again keeps the work, the stuff rule passes and drops them in', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(rules(), 'find_the_rule');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(screen.queryByText('What decides float or sink?')).toBeNull();
  for (const [k, g] of [['twig', 'float'], ['key', 'float'], ['boulder', 'sink']]) h.click(`Guess the ${k} will ${g}`);
  expect(seam.scene.dropped).toEqual([true, true, true, false, false]);
  act(() => { vi.advanceTimersByTime(3000); });
  expect(h.demand()).toContain('the key (made of metal, small): dropped in the tank; it sank to the bottom of the tank (guessed it would float)');
  expect(h.demand()).toContain('the big log (made of wood, big): on a yellow stand, not tested; no call yet');
  expect(h.demand()).not.toMatch(/big log[^;"]*(floated|sank)/);
  h.click('The big log will float');
  h.click('The pebble will sink');
  h.click('What decides it: how big it is');
  h.click('Check');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'wrong_rule' });
  expect(seam.scene.dropped).toEqual([true, true, true, false, false]);
  h.dispatch('retry');
  expect(h.demand()).toContain('the learner says it will float');
  h.click('What decides it: what it is made of');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.dropped).toEqual([true, true, true, true, true]);
  expect(screen.getByText(/the big log is wood like the twig, so it floats/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('rule-2');
  expect(seam.scene.dropped).toEqual([false, false, false, false]);
});

it('find the rule: the easier sort is ungraded practice with one thing on a stand', () => {
  const h = mount(rules(), 'find_the_rule');
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('rule-1~easier');
  expect(screen.getByText('Practice')).toBeTruthy();
  expect(seam.scene.dropped).toHaveLength(3);
});

// Boat A is a small foil boat with low sides (carries 5); the learner's boat B gets tall sides (carries 11).
const cargos = (): BuoyancyChallenge[] => [
  { id: 'cargo-1', type: 'cargo_two_designs', materials: ['foil', 'clay'], given: { material: 'foil', shape: 'low_sides', size: 'small' },
    oneChange: true, question: null, instruction: 'Boat A is a small foil boat with low sides. Build boat B by changing just one thing.' },
  { id: 'cargo-2', type: 'cargo_two_designs', materials: ['foil', 'clay'], given: { material: 'clay', shape: 'low_sides', size: 'big' },
    oneChange: true, question: null, instruction: 'x' },
];

it('two boats: the guess kept against the tests is a named miss, a changed boat is tested again, the tested claim passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(cargos(), 'cargo_two_designs');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  h.click('Make it of foil'); h.click('Shape: tall sides'); h.click('Size: small');
  expect(h.demand()).toContain('"changed":"its shape"');
  expect(screen.getByRole('button', { name: 'Put boat B in the water' }).hasAttribute('disabled')).toBe(true);
  h.click('Guess: Boat A');
  h.click('Put boat B in the water');
  for (let i = 0; i < 12; i++) h.click('Add a penny');
  expect(screen.getByText('Boat B · It sank with 12 pennies!')).toBeTruthy();
  h.click('Fish it out');
  // The guess is locked once a boat is tested.
  expect(screen.getByRole('button', { name: 'Guess: Boat B' }).hasAttribute('disabled')).toBe(true);
  expect(h.demand()).not.toContain('boat A (');
  h.click('Show boat A');
  h.click('Put boat A in the water');
  for (let i = 0; i < 6; i++) h.click('Add a penny');
  h.click('Fish it out');
  expect(h.demand()).toContain('boat A (a small foil boat with low sides) carried 5 pennies and sank with the next one');
  h.click('Carried more: Boat A');
  h.click('Check');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'kept_prediction' });
  h.dispatch('retry');
  // Changing boat B clears its test: the claim waits for a new one.
  h.click('Show boat B');
  h.click('Size: big');
  expect(screen.queryByRole('button', { name: 'Carried more: Boat B' })).toBeNull();
  h.click('Size: small');
  h.click('Put boat B in the water');
  for (let i = 0; i < 12; i++) h.click('Add a penny');
  h.click('Fish it out');
  h.click('Carried more: Boat B');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/Boat B carried 11 pennies and boat A carried 5 pennies/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('cargo-2');
  expect(screen.queryByRole('table')).toBeNull();
});

it('two boats: the levers mark the change and draw the penny rows; the easier item builds both boats', () => {
  const h = mount(cargos(), 'cargo_two_designs');
  h.click('Make it of clay'); h.click('Shape: tall sides'); h.click('Size: small');
  h.dispatch('pull_lever', { lever: 'changes_marked' });
  expect(document.querySelectorAll('[data-harbor-changed]')).toHaveLength(2);
  h.click('Guess: Boat B');
  h.click('Put boat B in the water');
  for (let i = 0; i < 30 && !screen.queryByText(/It sank/); i++) h.click('Add a penny');
  h.click('Fish it out');
  h.dispatch('pull_lever', { lever: 'penny_rows' });
  expect(document.querySelector('[data-harbor-penny-row="b"]')!.querySelectorAll('span.rounded-full').length).toBeGreaterThan(0);
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('cargo-1~easier');
  expect(screen.getByText('Practice')).toBeTruthy();
  expect(screen.getByText('Built for you')).toBeTruthy();
});

// A small clay ball that must float carrying 3 pennies (only tall sides carry 3), then one to float empty.
const shapes = (): BuoyancyChallenge[] => [makeShapeChallenge('shape-1', 'small', 3), makeShapeChallenge('shape-2', 'big', 0)];

it('make it float: the clay starts a ball, goes in on a guess, low sides is a named miss, Try again keeps the shape, tall sides passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(shapes(), 'make_it_float');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('shape the clay so it floats carrying 3 pennies');
  // Only the shape can change: no stuff or size rows, and the clay is a ball on the stand.
  expect(screen.queryByRole('button', { name: 'Make it of clay' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Size: big' })).toBeNull();
  expect(seam.scene.boat).toEqual({ build: { material: 'clay', size: 'small', shape: 'ball' }, launched: false, pennies: 0 });
  // The ball goes in on a guess and sinks: the notebook records the guess.
  h.click('Guess the clay will float, and put it in the water');
  expect(h.demand()).toContain('a ball sank with 0 pennies in it');
  expect(screen.getByRole('cell', { name: 'float' })).toBeTruthy();
  h.click('Fish it out');
  h.click('Shape: low sides');
  h.click('Guess the clay will float, and put it in the water');
  expect(h.demand()).toContain('floating in the tank');
  h.click('Take it out');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/too many for these sides/)).toBeTruthy();
  h.dispatch('retry');
  expect(h.demand()).toContain('a boat with low sides');
  h.click('Shape: tall sides');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/same clay, just as heavy/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('shape-2');
  expect(seam.scene.boat).toEqual({ build: { material: 'clay', size: 'big', shape: 'ball' }, launched: false, pennies: 0 });
});

it('make it float: x-ray once the clay is in the water; the easier item floats the same clay empty', () => {
  const h = mount(shapes(), 'make_it_float');
  expect(leverIdsOf(h)).toEqual(['one_step_less']);
  h.click('Shape: flat');
  h.click('Guess the clay will sink, and put it in the water');
  expect(leverIdsOf(h)).toEqual(['xray', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'xray' });
  expect(seam.scene.xray).toBe(true);
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('shape-1~easier');
  expect(h.state().task!.task).toBe('This ball of clay sinks. Change only its shape so it floats.');
  expect(screen.getByText('Practice')).toBeTruthy();
});
