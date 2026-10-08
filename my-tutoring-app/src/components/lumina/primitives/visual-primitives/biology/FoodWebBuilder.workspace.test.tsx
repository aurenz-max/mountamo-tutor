// @vitest-environment jsdom
/**
 * food-web-builder on the shared teaching workspace (W1, plain shape) and its open build `build_chain`: the real
 * FoodWebBuilder, TeachingSession and LiveLessonRuntime. Both modes are checked gestures with a named miss and no
 * published key; the build starts on an empty scene, commits at "I'm done!", keeps the build through Try again, and
 * its levers come on a miss.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { getComponentById } from '../../../service/manifest/catalog';
import { foodWebBuilderOracle } from '../../../service/qa/oracles/food-web-builder';
import {
  chainAsk, feedingRelations, foodChainMiss, foodWebMiss, pickChainTargets, workspaceAssignment,
} from './foodWebWorkspace';
import { foodWebLevers, shorterChain } from './foodWebLevers';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), watch: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'food-web',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, resetAttempt: vi.fn(), elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
// The live line is the shared layer's (its own leak rules are tested there): here only what the scene asks it.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import FoodWebBuilder, { type FoodWebBuilderData, type FoodWebChallenge, type Organism } from './FoodWebBuilder';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); seam.evaluationContext = null; });

const org = (id: string, name: string, trophicLevel: Organism['trophicLevel']): Organism =>
  ({ id, name, trophicLevel, imagePrompt: name, position: { x: '50%', y: '50%' } });
const ORGANISMS = [org('g', 'Grass', 'producer'), org('b', 'Berries', 'producer'), org('h', 'Grasshopper', 'primary-consumer'),
  org('m', 'Mouse', 'primary-consumer'), org('r', 'Rabbit', 'primary-consumer'), org('f', 'Frog', 'secondary-consumer'),
  org('s', 'Snake', 'secondary-consumer'), org('k', 'Hawk', 'tertiary-consumer'), org('x', 'Bacteria', 'decomposer')];
const rel = (fromId: string, toId: string) => ({ fromId, toId, relationship: `${toId} eats ${fromId}` });
const RELATIONS = [rel('g', 'h'), rel('g', 'm'), rel('g', 'r'), rel('b', 'm'), rel('b', 'r'), rel('h', 'f'), rel('m', 's'), rel('f', 's'),
  rel('m', 'k'), rel('r', 'k'), rel('s', 'k'), rel('f', 'k'), rel('k', 'x'), rel('s', 'x'), rel('r', 'x')];
const HAWK4: FoodWebChallenge = { id: 'c1', type: 'build_chain', length: 4, endId: 'k', instruction: chainAsk(4, 'Hawk') };
const SNAKE3: FoodWebChallenge = { id: 'c2', type: 'build_chain', length: 3, endId: 's', instruction: chainAsk(3, 'Snake') };

function mount(mode: 'build_chain' | 'complete_web', challenges: FoodWebChallenge[] = []) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data: FoodWebBuilderData = { primitiveType: 'food-web-builder', ecosystem: 'Grassland', organisms: ORGANISMS,
    correctConnections: mode === 'complete_web' ? RELATIONS.slice(0, 4) : RELATIONS, gradeBand: '3-5', instanceId: 'food-web',
    challengeType: mode, ...(mode === 'build_chain' ? { challenges } : {}) };
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FoodWebBuilder data={data} runtimePlanItemId="plan-food-web" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'food-web',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const touch = (target: string) => act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="${target}"]`)!); });
  /** Put the living things in, then draw each arrow first → second. */
  const build = (ids: string[], arrows: Array<[string, string]>) => {
    ids.forEach(id => touch(`list-${id}`));
    arrows.forEach(([a, b]) => { touch(`scene-${a}`); touch(`scene-${b}`); });
  };
  const cards = () => view.container.querySelectorAll('[data-placed]').length;
  const drawn = () => view.container.querySelectorAll('[data-pip-object^="arrow-"]').length;
  const demand = () => state().task!.demand as Record<string, unknown>;
  const last = () => state().task!.workspace!.attempts.at(-1);
  const levers = () => state().task!.workspace!.levers ?? [];
  return { state, dispatch, confirmVisible, press, touch, build, cards, drawn, demand, last, levers, view };
}

it.each(['build_chain', 'complete_web'] as const)('%s mounts under tutor ownership as a gesture item with no published key', mode => {
  const h = mount(mode, [HAWK4]);
  expect(h.state().owner).toBe('tutor');
  const item = mode === 'build_chain' ? HAWK4 : { id: 'web', type: 'complete_web' as const };
  expect(h.state().task!.task).toBe(workspaceAssignment(item, 'Grassland').task);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // No feeding relation reaches the tutor: no arrow, no "eats".
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/→|\beats\b/);
  expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
});

it('build: opens on an empty scene with no Check, tags or count; levers start bare; the watcher may not judge or name a link', () => {
  const h = mount('build_chain', [HAWK4]);
  expect(h.cards()).toBe(0);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
  expect(document.body.textContent).not.toMatch(/producer|consumer|eats plants|makes its own food|longest line/i);
  expect(h.demand()).toMatchObject({ kind: 'build_chain', livingThingsPlaced: 0, arrowsDrawn: 0, chainLength: 0,
    learnerWork: 'Nothing in the scene yet' });
  expect(h.demand()).not.toHaveProperty('length');
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['arrow_words', 'help', false], ['food_tags', 'help', false], ['chain_count', 'help', false], ['shorter_chain', 'simplify', false]]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', task: HAWK4.instruction,
      neverSay: expect.arrayContaining(['eat', 'chain', 'Grass', 'Hawk']) }) }));
  h.touch('list-g');
  // A living thing in the scene may be named; one still in the list may not.
  const req = seam.watch.mock.calls.at(-1)![0].request;
  expect(req.neverSay).not.toContain('Grass');
  expect(req.neverSay).toContain('Hawk');
});

it('build: a left-out living thing is named, Try again keeps the build, taking it out passes, and the work history shows it', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount('build_chain', [HAWK4, SNAKE3]);
  // Past the host window of the item opening, so the taps count as the learner's own work.
  vi.setSystemTime(Date.now() + 2000);
  h.build(['g', 'm', 's', 'k', 'r'], [['g', 'm'], ['m', 's'], ['s', 'k']]);
  expect(h.demand()).toMatchObject({ livingThingsPlaced: 5, arrowsDrawn: 3, chainLength: 4 });
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'broken_chain' });
  // The verdict names no living thing and no direction.
  const verdict = screen.getByText(/^Not yet./).textContent!;
  expect(verdict).not.toMatch(/grass|mouse|snake|hawk|rabbit|eaten by|\bfrom\b|\bto the\b/i);
  h.dispatch('retry');
  expect([h.cards(), h.drawn()]).toEqual([5, 3]);
  expect(screen.getByText(/^Not yet./)).toBeTruthy();
  vi.setSystemTime(Date.now() + 2000);
  h.touch('list-r');
  expect(h.demand()).toMatchObject({ livingThingsPlaced: 4, workHistory: expect.stringContaining('livingThingsPlaced 0 → 5 → 4') });
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ itemId: 'c1', correct: true, response: 'Put in Grass, Mouse, Snake, Hawk. Arrows: Grass → Mouse, Mouse → Snake, Snake → Hawk' });
  h.dispatch('advance'); h.confirmVisible();
  // A new item opens an empty scene.
  expect(h.state().task!.itemId).toBe('c2');
  expect([h.cards(), h.drawn()]).toEqual([0, 0]);
});

it('backwards arrows are named; help levers draw on the scene and stay out of the picture; tapping the right way turns an arrow', () => {
  const h = mount('build_chain', [HAWK4]);
  h.build(['g', 'm', 's', 'k'], [['k', 's'], ['s', 'm'], ['m', 'g']]);
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'arrow_backwards' });
  expect(h.dispatch('pull_lever', { lever: 'arrow_words' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="arrow-words"]')).toHaveLength(3);
  expect(h.dispatch('pull_lever', { lever: 'food_tags' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('svg [data-lever="food-tag"]')).map(t => t.textContent))
    .toEqual(['makes its own food', 'eats plants', 'eats animals', 'eats animals']);
  expect(String(h.demand().onScreen)).toMatch(/eaten by/);
  expect(h.dispatch('pull_lever', { lever: 'arrow_words' }).status).toBe('blocked');
  // What the watcher sees: the svg less its `data-aid` parts holds only the learner's cards.
  const picture = h.view.container.querySelector('svg[data-build-scene="food-chain"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.textContent).toBe('GrassMouseSnakeHawk');
  h.dispatch('retry');
  h.build([], [['g', 'm'], ['m', 's'], ['s', 'k']]);
  expect(h.drawn()).toBe(3);
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: true, levers: ['arrow_words', 'food_tags'] });
});

it('the simplify lever opens an ungraded shorter chain on an empty scene, then the full item comes back empty', () => {
  const h = mount('build_chain', [HAWK4]);
  h.build(['g', 'k'], [['g', 'k']]);
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ miss: 'not_a_feeding_pair' });
  const receipt = h.dispatch('pull_lever', { lever: 'shorter_chain' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('c1~shorter');
  expect(receipt.state.task!.task).toBe('Make a food chain with 3 living things that ends at the Hawk.');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  expect(h.cards()).toBe(0);
  h.build(['b', 'r', 'k'], [['b', 'r'], ['r', 'k']]);
  h.press("I'm done!");
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c1');
  expect(h.cards()).toBe(0);
  h.build(['g', 'h', 'f', 'k'], [['g', 'h'], ['h', 'f'], ['f', 'k']]);
  h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['c1', false, false], ['c1~shorter', true, true], ['c1', true, false]]);
});

it('complete_web: a backwards arrow is named, Try again keeps the arrows, turning it passes and the lesson submits once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('complete_web');
  // RELATIONS.slice(0, 4): g→h, g→m, g→r, b→m. The first drawn backwards.
  [['h', 'g'], ['g', 'm'], ['g', 'r'], ['b', 'm']].forEach(([a, b]) => { h.touch(`web-${a}`); h.touch(`web-${b}`); });
  h.press(/check/i);
  expect(h.last()).toMatchObject({ correct: false, miss: 'backwards_arrows' });
  h.dispatch('retry');
  expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(4);
  h.touch('web-g'); h.touch('web-h');
  h.press(/check/i);
  expect(h.last()).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , metrics, work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(metrics).toMatchObject({ type: 'food-web-builder', challengeType: 'complete_web', webComplete: true });
  expect(work.teachingAttempts).toHaveLength(2);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'web', miss: 'backwards_arrows' })]);
});

it('build, scripted path (the tester, no tutor): a miss keeps the build, Next chain opens an empty scene, the session submits once', () => {
  const data: FoodWebBuilderData = { primitiveType: 'food-web-builder', ecosystem: 'Grassland', organisms: ORGANISMS,
    correctConnections: RELATIONS, gradeBand: '3-5', instanceId: 'food-web', challengeType: 'build_chain', challenges: [HAWK4, SNAKE3] };
  const view = render(<FoodWebBuilder data={data} />);
  const touch = (target: string) => act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="${target}"]`)!); });
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  ['g', 'm', 'k'].forEach(id => touch(`list-${id}`));
  [['g', 'm'], ['m', 'k']].forEach(([a, b]) => { touch(`scene-${a}`); touch(`scene-${b}`); });
  press("I'm done!");
  expect(screen.getByText(/^Not yet\./).textContent).toMatch(/count the living things/i);
  touch('list-s'); touch('scene-m'); touch('scene-s'); touch('scene-s'); touch('scene-k');
  // Mouse -> Hawk is still drawn beside Mouse -> Snake -> Hawk: a branch.
  touch('arrow-m-k');
  press("I'm done!");
  expect(screen.getByText(/^Yes!/)).toBeTruthy();
  press(/next chain/i);
  expect(view.container.querySelectorAll('[data-placed]')).toHaveLength(0);
  ['b', 'm', 's'].forEach(id => touch(`list-${id}`));
  [['b', 'm'], ['m', 's']].forEach(([a, b]) => { touch(`scene-${a}`); touch(`scene-${b}`); });
  press("I'm done!");
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengeType: 'build_chain', chainsBuilt: 2, firstTryCount: 1 });
  expect(seam.send).not.toHaveBeenCalled();
});

it('the checks name every miss; targets, levers and catalog wiring', () => {
  const miss = (ids: string[], arrows: Array<[string, string]>, target = HAWK4 as { length: number; endId: string }) =>
    foodChainMiss(target, ORGANISMS, RELATIONS, ids, arrows.map(([fromId, toId]) => ({ fromId, toId })));
  // Many chains pass.
  expect(miss(['g', 'm', 's', 'k'], [['g', 'm'], ['m', 's'], ['s', 'k']])).toBeUndefined();
  expect(miss(['b', 'm', 's', 'k'], [['b', 'm'], ['m', 's'], ['s', 'k']])).toBeUndefined();
  expect(miss(['g', 'h', 'f', 'k'], [['g', 'h'], ['h', 'f'], ['f', 'k']])).toBeUndefined();
  expect(miss(['g', 'm', 's', 'k'], [['m', 'g'], ['m', 's'], ['s', 'k']])).toBe('arrow_backwards');
  expect(miss(['g', 's', 'k'], [['g', 's'], ['s', 'k']])).toBe('not_a_feeding_pair');
  expect(miss(['g', 'm', 's', 'k'], [['g', 'm'], ['s', 'k']])).toBe('broken_chain');
  expect(miss(['g', 'm', 'k', 's'], [['g', 'm'], ['m', 'k'], ['m', 's']])).toBe('broken_chain');
  expect(miss(['g', 'h', 'f', 's'], [['g', 'h'], ['h', 'f'], ['f', 's']])).toBe('wrong_end');
  expect(miss(['h', 'f', 's', 'k'], [['h', 'f'], ['f', 's'], ['s', 'k']])).toBe('no_producer');
  expect(miss(['g', 'm', 'k'], [['g', 'm'], ['m', 'k']])).toBe('too_short');
  expect(miss(['g', 'h', 'f', 's', 'k'], [['g', 'h'], ['h', 'f'], ['f', 's'], ['s', 'k']])).toBe('too_long');
  const arrows = (pairs: Array<[string, string]>) => pairs.map(([fromId, toId]) => ({ fromId, toId }));
  const web = RELATIONS.slice(0, 3);
  expect(foodWebMiss(web, arrows([['g', 'h'], ['g', 'm'], ['g', 'r']]))).toBeUndefined();
  expect(foodWebMiss(web, arrows([['h', 'g'], ['g', 'm'], ['g', 'r']]))).toBe('backwards_arrows');
  expect(foodWebMiss(web, arrows([['g', 'k'], ['g', 'h'], ['g', 'm'], ['g', 'r']]))).toBe('wrong_arrows');
  expect(foodWebMiss(web, arrows([['g', 'h']]))).toBe('missing_arrows');

  // Code cleans the ecology: nothing eats a plant, and a decomposer feeds no consumer.
  expect(feedingRelations(ORGANISMS, [rel('m', 'g'), rel('x', 'k'), rel('g', 'g'), rel('g', 'm'), rel('g', 'm'), rel('q', 'm')]))
    .toEqual([rel('g', 'm')]);
  // Targets: distinct, makeable, shorter first, asks stating the length and end only; the oracle agrees.
  const targets = pickChainTargets(ORGANISMS, RELATIONS, '3-5', 3, () => 0.5);
  expect(targets).toHaveLength(3);
  expect(targets.map(t => t.type === 'build_chain' && t.length)).toEqual([...targets.map(t => t.type === 'build_chain' && t.length)].sort());
  const data = { organisms: ORGANISMS, correctConnections: RELATIONS, challengeType: 'build_chain', challenges: targets };
  expect(foodWebBuilderOracle.verify(data as never, { componentId: 'food-web-builder', evalMode: 'build_chain', topic: 'Food chains', gradeLevel: 'grade 4' }).violations).toEqual([]);
  const leaky = { ...data, challenges: [{ ...HAWK4, instruction: 'Make a food chain with 4 living things, Grass first, that ends at the Hawk.' }] };
  expect(foodWebBuilderOracle.verify(leaky as never, { componentId: 'food-web-builder', evalMode: 'build_chain', topic: '', gradeLevel: '' })
    .violations.map(v => v.check)).toContain('answer-leak');

  const levers = foodWebLevers(HAWK4, ORGANISMS, RELATIONS, []);
  // The text names the build, never a living thing, a number or another mode's action.
  for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/grass|mouse|hawk|snake|\b4\b|check|type/i);
  expect(shorterChain(HAWK4, ORGANISMS, RELATIONS)).toMatchObject({ id: 'c1~shorter', length: 3, endId: 'k' });
  // No chain of 2 ends at the Snake: a 3-chain to it has no easier ask, and no simplify lever.
  expect(shorterChain(SNAKE3, ORGANISMS, RELATIONS)).toBeNull();
  expect(foodWebLevers(SNAKE3, ORGANISMS, RELATIONS, []).map(l => l.id)).not.toContain('shorter_chain');
  expect(foodWebLevers({ id: 'web', type: 'complete_web' }, ORGANISMS, RELATIONS, [])).toEqual([]);

  const entry = getComponentById('food-web-builder')!;
  expect(entry.evalModes!.find(m => m.evalMode === 'build_chain')).toMatchObject({ beta: 3.6, challengeTypes: ['build_chain'],
    affordances: { answers: ['build'] } });
  // Every miss the check names is answered by a lever, or listed as unanswered by decision (J9).
  const misses = entry.teachingWorkspace!.misses!.build_chain, unanswered = entry.teachingWorkspace!.unanswered!.build_chain;
  for (const m of misses) expect(levers.some(l => l.answers?.includes(m)) || unanswered.includes(m), m).toBe(true);
});
