// @vitest-environment jsdom
/**
 * molecule-constructor on the shared teaching workspace (W1, plain shape) and its open build `make_molecule`: the real
 * MoleculeConstructor, TeachingSession and LiveLessonRuntime. Every challenge is a checked gesture with its named miss
 * and no published key; the build starts on an empty board, commits at "I'm done!", keeps the molecule through Try
 * again, and its levers come on a miss.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { getComponentById } from '../../../service/manifest/catalog';
import { moleculeLevers, simplerMolecule } from './moleculeConstructorLevers';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), legacy: vi.fn(), watch: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'molecules',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy('enabled');
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'molecules' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, resetAttempt: () => {}, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
// The live line is the shared layer's (its own leak rules are tested there): here only what the board asks it.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import MoleculeConstructor, { type MoleculeConstructorChallenge, type MoleculeConstructorData } from './MoleculeConstructor';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); seam.evaluationContext = null; });

const blank = { targetFormula: null, targetName: null, targetAtoms: [], hint: 'Count bonds.', narration: 'Nice.' };
const MAKE: MoleculeConstructorChallenge = { id: 'm', type: 'make_molecule', instruction: 'Make a molecule with a double bond.', ask: { doubleBonds: 1 }, ...blank };
const MAKE2: MoleculeConstructorChallenge = { id: 'm2', type: 'make_molecule', instruction: 'Make a molecule with a double bond and exactly 2 carbon atoms.',
  ask: { doubleBonds: 1, carbons: 2 }, ...blank };
const WATER: MoleculeConstructorChallenge = { id: 'w', type: 'build_target', instruction: 'Build water, H2O.', targetFormula: 'H2O', targetName: 'Water',
  targetAtoms: [{ element: 'H', count: 2 }, { element: 'O', count: 1 }], hint: 'O makes 2 bonds.', narration: 'Water!' };
const NAME: MoleculeConstructorChallenge = { id: 'n', type: 'identify', instruction: 'Name the molecule with one carbon and four hydrogens.',
  targetFormula: 'CH4', targetName: 'Methane', targetAtoms: [], hint: '', narration: '' };
const ITEM: Record<string, MoleculeConstructorChallenge> = { build: WATER, identify: NAME, predict: { ...WATER, id: 'p', type: 'predict_bonds' }, make_molecule: MAKE };

function mount(mode: string, challenges: MoleculeConstructorChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data: MoleculeConstructorData = { title: 'Molecules', description: 'Molecules', instanceId: 'molecules', challenges, gradeBand: '3-5',
    targetMolecule: { name: null, formula: null, atoms: [], bonds: [], realWorldUse: '', imagePrompt: '' },
    palette: { availableElements: ['H', 'C', 'N', 'O'], showValence: true, showElectronDots: false }, moleculeGallery: [],
    showOptions: { showFormula: true, showName: false, showRealWorldImage: false, showValenceSatisfaction: true, show3DToggle: false,
      showElectronDots: false, showBondType: false } };
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <MoleculeConstructor data={data} runtimePlanItemId="plan-molecules" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'molecules',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const tap = (id: string) => act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="${id}"]`)!); });
  /** Join two atoms `times` times (a double bond is two joins). */
  const join = (x: string, y: string, times = 1) => { for (let i = 0; i < times; i++) { tap(x); tap(y); } };
  const atoms = () => view.container.querySelectorAll('[data-element]').length;
  const demand = () => state().task!.demand as Record<string, unknown>;
  const last = () => state().task!.workspace!.attempts.at(-1);
  const levers = () => state().task!.workspace!.levers ?? [];
  return { state, dispatch, confirmVisible, press, tap, join, atoms, demand, last, levers, view };
}

/** Ethene through the board: C=C, two hydrogens on each carbon (slots 0 and 1 are the carbons). */
function buildEthene(h: ReturnType<typeof mount>, hydrogens = 4) {
  h.press('Add C'); h.press('Add C');
  for (let i = 0; i < hydrogens; i++) h.press('Add H');
  h.join('atom-0', 'atom-1', 2);
  h.join('atom-0', 'atom-2'); h.join('atom-0', 'atom-3');
  if (hydrogens > 2) h.join('atom-1', 'atom-4');
  if (hydrogens > 3) h.join('atom-1', 'atom-5');
}

it.each(Object.keys(ITEM))('%s mounts under tutor ownership as a gesture item with no published key', mode => {
  const h = mount(mode, [ITEM[mode]]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(ITEM[mode].instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/methane/i);
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
});

it('build: atoms one short are named, Try again keeps the atoms, the fix completes and submits once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build', [WATER]);
  h.press('Add O'); h.press('Add H'); h.join('atom-1', 'atom-2');
  h.press(/check answer/i);
  expect(h.last()).toMatchObject({ correct: false, miss: 'atoms_off' });
  expect(screen.getByRole('button', { name: /check answer/i })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect(h.demand()).toMatchObject({ atomsPlaced: 2, bondsFormed: 1, asked: 'H2O' });
  h.press('Add H'); h.join('atom-1', 'atom-3');
  h.press(/check answer/i);
  expect(h.last()).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , metrics, work] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(metrics).toMatchObject({ type: 'molecule-constructor', moleculesBuiltCorrectly: 1 });
  expect(work.teachingAttempts).toHaveLength(2);
});

it('make: opens on an empty board with no Check, formula, count or target; levers start bare; the watcher may say no number', () => {
  const h = mount('make_molecule', [MAKE]);
  expect(h.atoms()).toBe(0);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
  expect(document.body.textContent).not.toMatch(/Molecular Formula|Atoms Placed|Target Molecule|Gallery/i);
  expect(h.demand()).toMatchObject({ kind: 'make_molecule', atomsPlaced: 0, bondsMade: 0, doubleBonds: 0, openBonds: 0,
    learnerWork: 'No atoms on the board yet' });
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['open_bonds', 'help', false], ['bond_tally', 'help', false], ['piece_colors', 'help', false], ['fewer_atoms', 'simplify', false]]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', task: MAKE.instruction, neverSay: expect.arrayContaining(['ethene', 'water', 'open']) }) }));
  // No aid is drawn before a lever is pulled.
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
});

it('make: one hydrogen short is named, Try again keeps the molecule, the fix passes, the work history shows it, a new item opens empty', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount('make_molecule', [MAKE, MAKE2]);
  vi.setSystemTime(Date.now() + 2000);
  buildEthene(h, 3);
  expect(h.demand()).toMatchObject({ atomsPlaced: 5, doubleBonds: 1, openBonds: 1 });
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'open_valence' });
  // The verdict names no atom and no molecule.
  const verdict = h.view.container.querySelector('[data-testid="make-verdict"]')!.textContent!;
  expect(verdict).not.toMatch(/carbon|hydrogen|ethene|\d/i);
  h.dispatch('retry');
  expect(h.atoms()).toBe(5);
  expect(h.view.container.querySelector('[data-testid="make-verdict"]')).toBeTruthy();
  vi.setSystemTime(Date.now() + 2000);
  h.press('Add H'); h.join('atom-1', 'atom-5');
  expect(h.demand()).toMatchObject({ openBonds: 0, workHistory: expect.stringContaining('openBonds 0 → 11 → 1 → 2 → 0') });
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ itemId: 'm', correct: true, response: 'Made C2H4: 6 atoms in one piece, 5 bonds (1 double); no bonds left open' });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('m2');
  expect(h.atoms()).toBe(0);
});

it('make: a single bond where a double fits is named apart; help levers draw only on the learner\'s atoms and stay out of the picture', () => {
  const h = mount('make_molecule', [MAKE]);
  h.press('Add O'); h.press('Add O'); h.join('atom-0', 'atom-1');
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ miss: 'bond_order_short' });
  expect(h.dispatch('pull_lever', { lever: 'open_bonds' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="open-bonds"]')).toHaveLength(2);
  expect(h.dispatch('pull_lever', { lever: 'bond_tally' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="bond-tally"]')).map(t => t.textContent)).toEqual(['1 of 2', '1 of 2']);
  expect(String(h.demand().onScreen)).toMatch(/hollow dot/i);
  // What the watcher sees: the svg less its `data-aid` parts carries only the element letters.
  const picture = h.view.container.querySelector('svg[data-build-scene="molecule-constructor"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.textContent).toBe('OO');
  h.dispatch('retry');
  h.join('atom-0', 'atom-1');
  expect(h.view.container.querySelectorAll('[data-lever="open-bonds"]')).toHaveLength(0);
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: true, levers: ['open_bonds', 'bond_tally'] });
});

it('make: two pieces are named and tinted apart; tapping a bond takes one step of it away', () => {
  const h = mount('make_molecule', [MAKE]);
  h.press('Add O'); h.press('Add O'); h.press('Add H'); h.press('Add H');
  h.join('atom-0', 'atom-1', 2); h.join('atom-2', 'atom-3');
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ miss: 'not_connected' });
  h.dispatch('pull_lever', { lever: 'piece_colors' });
  const tints = Array.from(h.view.container.querySelectorAll('[data-lever="piece-colors"]')).map(c => c.getAttribute('fill'));
  expect(new Set(tints).size).toBe(2);
  h.dispatch('retry');
  h.tap('bond-0-1');
  expect(h.demand()).toMatchObject({ doubleBonds: 0, bondsMade: 2 });
});

it('the simplify lever opens an ungraded smaller ask on an empty board, then the full item comes back empty', () => {
  const h = mount('make_molecule', [MAKE2]);
  h.press('Add O'); h.press("I'm done!");
  const receipt = h.dispatch('pull_lever', { lever: 'fewer_atoms' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('m2~simpler');
  expect(receipt.state.task!.task).toBe('Make a molecule with a double bond.');
  expect(h.atoms()).toBe(0);
  h.press('Add O'); h.press('Add O'); h.join('atom-0', 'atom-1', 2); h.press("I'm done!");
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m2');
  expect(h.atoms()).toBe(0);
});

it('lever text, misses and catalog wiring for the build', () => {
  const levers = moleculeLevers(MAKE, []);
  // The text names the board and the learner's own atoms, never a molecule or which atom is short.
  for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/ethene|water|oxygen|carbon atom needs|type|check answer/i);
  expect(simplerMolecule(MAKE)).toMatchObject({ id: 'm~simpler', ask: { doubleBonds: 1, maxAtoms: 3 } });
  expect(simplerMolecule(simplerMolecule(MAKE)!)).toBeNull();
  // build_target's and identify's own levers (`MoleculeConstructor.levers.workspace.test.tsx`); predict items have none.
  expect(moleculeLevers(WATER, []).map(l => l.id)).toEqual(['atom_tally', 'bond_tally', 'fewer_atoms']);
  expect(moleculeLevers(NAME, []).map(l => l.id)).toEqual(['show_formula', 'fewer_atoms']);
  expect(moleculeLevers(ITEM.predict, [])).toEqual([]);

  const entry = getComponentById('molecule-constructor')!;
  expect(entry.evalModes!.find(m => m.evalMode === 'make_molecule')).toMatchObject({ beta: -0.4, challengeTypes: ['make_molecule'],
    affordances: { answers: ['build'] } });
  const misses = entry.teachingWorkspace!.misses!.make_molecule, unanswered = entry.teachingWorkspace!.unanswered!.make_molecule;
  for (const m of misses) expect(levers.some(l => l.answers?.includes(m)) || unanswered.includes(m), m).toBe(true);
});
