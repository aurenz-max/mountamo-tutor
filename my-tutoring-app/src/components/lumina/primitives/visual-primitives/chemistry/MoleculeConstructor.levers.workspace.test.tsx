// @vitest-environment jsdom
/**
 * molecule-constructor `build` mode levers (`moleculeConstructorLevers.ts`), mounted the way a lesson mounts it: the
 * atom tally and bond count draw on the classic canvas in the pull's commit, a pull with nothing to draw is refused
 * and changes nothing, the smaller molecule is ungraded and gives the full item back blank, and only the full
 * item's answer is credited, with the levers recorded.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/primitives/build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { MoleculeConstructorChallenge, MoleculeConstructorData } from './MoleculeConstructor';
import { ATOM_TALLY_LEVER, BOND_TALLY_LEVER, FEWER_ATOMS_LEVER, JOIN_RINGS_LEVER } from './moleculeConstructorLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const WATER: MoleculeConstructorChallenge = { id: 'w', type: 'build_target', instruction: 'Build water (H2O).', targetFormula: 'H2O',
  targetName: 'Water', targetAtoms: [{ element: 'H', count: 2 }, { element: 'O', count: 1 }], hint: '', narration: '' };
const CO2: MoleculeConstructorChallenge = { id: 'c', type: 'build_target', instruction: 'Build carbon dioxide (CO2).', targetFormula: 'CO2',
  targetName: 'Carbon dioxide', targetAtoms: [{ element: 'C', count: 1 }, { element: 'O', count: 2 }], hint: '', narration: '' };
const FREE: MoleculeConstructorChallenge = { id: 'f', type: 'free_build', instruction: 'Build any molecule you like.', targetFormula: null,
  targetName: null, targetAtoms: [], hint: '', narration: '' };
const lesson = (challenges: MoleculeConstructorChallenge[]): MoleculeConstructorData => ({ title: 'Molecules', challenges, gradeBand: '3-5',
  targetMolecule: { name: null, formula: null, atoms: [], bonds: [], realWorldUse: '', imagePrompt: '' },
  palette: { availableElements: ['H', 'C', 'N', 'O'], showValence: true, showElectronDots: false }, moleculeGallery: [],
  showOptions: { showFormula: true, showName: false, showRealWorldImage: false, showValenceSatisfaction: true, show3DToggle: false,
    showElectronDots: false, showBondType: false } });
const mount = (challenges: MoleculeConstructorChallenge[]) =>
  mountWorkspace({ primitiveId: 'molecule-constructor', evalMode: 'build', data: lesson(challenges) as never });
const add = (h: WorkspaceHarness, ...els: string[]) => els.forEach(e => h.press(`Add ${e}`));
/** Join two classic atoms (numbered from 1 in the order added) `times` times. */
const join = (h: WorkspaceHarness, x: number, y: number, times = 1) => { for (let i = 0; i < times; i++) { h.touch(`atom-${x}`); h.touch(`atom-${y}`); } };
const check = (h: WorkspaceHarness) => h.press(/check answer/i);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const atoms = (h: WorkspaceHarness) => q(h, '[data-pip-object^="atom-"]').length;
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);

it('an atom short, then the tally: drawn under the formula in the same commit, recorded on the next try', () => {
  const h = mount([WATER]);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([
    [ATOM_TALLY_LEVER, 'help', false], [BOND_TALLY_LEVER, 'help', false], [FEWER_ATOMS_LEVER, 'simplify', false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  add(h, 'O', 'H'); join(h, 1, 2);
  check(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'atoms_off' });
  h.dispatch('retry');
  const receipt = h.dispatch('pull_lever', { lever: ATOM_TALLY_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="atom-tally"]')).toHaveLength(1);
  expect(q(h, '[data-tally-slot]').map(s => s.getAttribute('data-tally-slot'))).toEqual(['filled', 'empty', 'filled']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/one circle for each atom/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/water|H2O|\d/i);
  expect(h.dispatch('pull_lever', { lever: ATOM_TALLY_LEVER }).status).toBe('blocked');
  add(h, 'H');
  expect(q(h, '[data-tally-slot]').map(s => s.getAttribute('data-tally-slot'))).toEqual(['filled', 'filled', 'filled']);
  join(h, 1, 3);
  check(h);
  expect(last(h)).toMatchObject({ itemId: 'w', correct: true, assisted: true, levers: [ATOM_TALLY_LEVER] });
  h.close();
});

it('a refused pull changes nothing; the bond count shows made of makes, a double counting two', () => {
  const h = mount([CO2]);
  const before = JSON.stringify(h.state().task!.demand);
  expect(h.dispatch('pull_lever', { lever: BOND_TALLY_LEVER }).status).toBe('blocked');
  expect(JSON.stringify(h.state().task!.demand)).toBe(before);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  expect(levers(h).find(l => l.id === BOND_TALLY_LEVER)!.pulled).toBe(false);
  add(h, 'C', 'O', 'O'); join(h, 1, 2); join(h, 1, 3);
  check(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'open_valence' });
  h.dispatch('retry');
  expect(h.dispatch('pull_lever', { lever: BOND_TALLY_LEVER }).status).toBe('committed');
  expect(q(h, '[data-lever="bond-tally"]').map(t => t.textContent)).toEqual(['2 of 4', '1 of 2', '1 of 2']);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/how many bonds it has made/);
  join(h, 1, 2);
  expect(q(h, '[data-lever="bond-tally"]').map(t => t.textContent)).toEqual(['3 of 4', '2 of 2', '1 of 2']);
  h.close();
});

it('the smaller molecule is ungraded and keeps its atoms on Try again; the full item comes back blank and is credited', () => {
  const h = mount([CO2]);
  add(h, 'C', 'O'); check(h);
  expect(last(h)).toMatchObject({ miss: 'atoms_off' });
  const receipt = h.dispatch('pull_lever', { lever: FEWER_ATOMS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'c~simpler', task: 'Build oxygen gas, O2.' });
  expect(receipt.state.task!.demand).toMatchObject({ asked: 'O2', atomsPlaced: 0 });
  expect(atoms(h)).toBe(0);
  expect(levers(h)).toEqual([]);
  add(h, 'O', 'O'); join(h, 1, 2); check(h);
  expect(last(h)).toMatchObject({ itemId: 'c~simpler', correct: false, miss: 'open_valence' });
  h.dispatch('retry');
  expect(atoms(h)).toBe(2);
  join(h, 1, 2); check(h);
  expect(last(h)).toMatchObject({ itemId: 'c~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'c' });
  expect(atoms(h)).toBe(0);
  add(h, 'C', 'O', 'O'); join(h, 1, 2, 2); join(h, 1, 3, 2); check(h);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c', false, false], ['c~simpler', false, true], ['c~simpler', true, true], ['c', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [FEWER_ATOMS_LEVER] });
  h.close();
});

it('free build: atoms never joined, then the rings on every atom that can still bond', () => {
  const h = mount([FREE]);
  add(h, 'H');
  expect(h.dispatch('pull_lever', { lever: JOIN_RINGS_LEVER }).status).toBe('blocked');
  expect(q(h, '[data-lever]')).toHaveLength(0);
  add(h, 'H');
  check(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'no_bonds' });
  expect(observerLever(h.state(), true)).toBe(JOIN_RINGS_LEVER);
  h.dispatch('retry');
  expect(h.dispatch('pull_lever', { lever: JOIN_RINGS_LEVER }).status).toBe('committed');
  expect(q(h, '[data-lever="join-rings"]')).toHaveLength(2);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/green ring/);
  join(h, 1, 2);
  expect(q(h, '[data-lever="join-rings"]')).toHaveLength(0);
  check(h);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [JOIN_RINGS_LEVER] });
  h.close();
});

// ── The identify mode: a drawn molecule, a typed name or formula ──

const METHANE: MoleculeConstructorChallenge = { id: 'n', type: 'identify', instruction: 'Name this molecule.', targetFormula: 'CH4',
  targetName: 'Methane', targetAtoms: [{ element: 'C', count: 1 }, { element: 'H', count: 4 }], hint: '', narration: '' };
const ETHANE: MoleculeConstructorChallenge = { id: 'e', type: 'formula_write', instruction: 'Write the formula for this molecule.',
  targetFormula: 'C2H6', targetName: 'Ethane', targetAtoms: [{ element: 'C', count: 2 }, { element: 'H', count: 6 }], hint: '', narration: '' };
/** The lesson with the Target panel on, as the generator ships it: a typed item must still name nothing. */
const mountShown = (challenges: MoleculeConstructorChallenge[]) => mountWorkspace({ primitiveId: 'molecule-constructor', evalMode: 'identify',
  data: { ...lesson(challenges), showOptions: { ...lesson(challenges).showOptions, showName: true, showBondType: true } } as never });
const type = (h: WorkspaceHarness, label: string, text: string) =>
  act(() => { fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: text } }); });
const shown = (h: WorkspaceHarness) => q(h, '[data-pip-object^="shown-"]').map(a => a.textContent).join('');
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('identify: the molecule is drawn and nothing names it; a wrong name, then the formula beside it, recorded on the next try', () => {
  const h = mountShown([METHANE]);
  expect(shown(h)).toBe('CHHHH');
  expect(text(h)).not.toMatch(/methane|CH4|Target Molecule|Atoms Placed|e\.g\./i);
  expect(q(h, 'button').some(b => /^Add /.test(b.getAttribute('aria-label') ?? ''))).toBe(false);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['show_formula', 'help', false], [FEWER_ATOMS_LEVER, 'simplify', false]]);
  type(h, 'Name this molecule', 'ethane'); check(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'name_off' });
  expect(observerLever(h.state(), true)).toBe('show_formula');
  h.dispatch('retry');
  const receipt = h.dispatch('pull_lever', { lever: 'show_formula' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="show-formula"]').map(e => e.textContent)).toEqual(['Its formulaCH4']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/its formula/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/methane|CH4/i);
  // A refused pull (already pulled) changes nothing on the screen, the scene or the levers.
  const before = [JSON.stringify(h.state().task!.demand), JSON.stringify(levers(h)), h.view.container.innerHTML, h.state().task!.workspace!.attempts.length];
  expect(h.dispatch('pull_lever', { lever: 'show_formula' }).status).toBe('blocked');
  expect([JSON.stringify(h.state().task!.demand), JSON.stringify(levers(h)), h.view.container.innerHTML, h.state().task!.workspace!.attempts.length]).toEqual(before);
  type(h, 'Name this molecule', 'Methane'); check(h);
  expect(last(h)).toMatchObject({ itemId: 'n', correct: true, assisted: true, levers: ['show_formula'] });
  h.close();
});

it('formula_write: the model molecule beside it; the smaller molecule is ungraded and the full item comes back blank and is credited', () => {
  const h = mountShown([ETHANE]);
  expect(shown(h)).toBe('CCHHHHHH');
  expect(text(h)).not.toMatch(/ethane|C2H6|Target Molecule|Molecular Formula|e\.g\./i);
  type(h, 'Write the formula', 'CH3'); check(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'formula_off' });
  h.dispatch('retry');
  expect(h.dispatch('pull_lever', { lever: 'formula_model' }).status).toBe('committed');
  expect(q(h, '[data-lever="formula-model"]').map(e => e.textContent)).toEqual(['A different moleculeOHHH2O']);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/different molecule/);
  const receipt = h.dispatch('pull_lever', { lever: FEWER_ATOMS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'e~simpler', task: 'Write the formula for this molecule.' });
  expect(shown(h)).toBe('CHHHH');
  expect(q(h, '[data-lever]')).toHaveLength(0);
  expect(levers(h)).toEqual([]);
  type(h, 'Write the formula', 'CH3'); check(h);
  expect(last(h)).toMatchObject({ itemId: 'e~simpler', correct: false, miss: 'formula_off' });
  h.dispatch('retry');
  type(h, 'Write the formula', 'CH4'); check(h);
  expect(last(h)).toMatchObject({ itemId: 'e~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'e' });
  expect(shown(h)).toBe('CCHHHHHH');
  expect((h.view.container.querySelector('input[aria-label="Write the formula"]') as HTMLInputElement).value).toBe('');
  expect(q(h, '[data-lever="formula-model"]')).toHaveLength(1);
  type(h, 'Write the formula', 'C2H6'); check(h);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['e', false, false], ['e~simpler', false, true], ['e~simpler', true, true], ['e', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['formula_model', FEWER_ATOMS_LEVER] });
  h.close();
});
