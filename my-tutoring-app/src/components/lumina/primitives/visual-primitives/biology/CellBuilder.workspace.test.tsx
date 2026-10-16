// @vitest-environment jsdom
/**
 * cell-builder on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Each mission is one checked board: no key reaches the tutor, a wrong board shows only the count (no per-card marks),
 * Try again keeps the work, a right board completes once, and every miss has a lever.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { CellBuilderData, OrganelleInfo } from './CellBuilder';
import {
  boardCards, CELL_MISSES, cellHarnessInputs, cellMiss, namesOwnRegion, EMPTY_WORK, jobCardText, workspaceAssignment, type CellMission, type CellMissionPhase,
} from './cellBuilderWorkspace';
import {
  blankCellKinds, blankRegionWords, cellLevers, FEWER_LEVER, fewerStructures, HINTS_LEVER, hintLine, JOBS_LEVER, jobLine,
  LEVELS_LEVER, namesCellKind, namesRegion, sharesJobWords,
} from './cellBuilderLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const o = (id: string, name: string, extra: Partial<OrganelleInfo>): OrganelleInfo => ({
  id, name, function: `${name} does its job in the cell.`, analogy: 'Like a part of a machine', uniqueTo: null,
  belongsInCell: true, correctZone: 'peripheral', sizeRelative: 'medium', expectedQuantity: 'some', quantityReasoning: 'Because.', ...extra });

const ORGANELLES: OrganelleInfo[] = [
  o('nucleus', 'Nucleus', { function: 'Stores DNA and directs the work of the whole cell.', analogy: 'Like a school principal', correctZone: 'center', expectedQuantity: 'few' }),
  o('mito', 'Mitochondria', { function: 'Releases energy from food so the cell can work.', analogy: 'Like a power plant', correctZone: 'scattered', expectedQuantity: 'lots' }),
  o('ribo', 'Ribosome', { function: 'Builds proteins from instructions.', analogy: 'Like a tiny factory worker', correctZone: 'scattered', expectedQuantity: 'many' }),
  o('lyso', 'Lysosome', { function: 'Breaks down worn-out parts and waste.', analogy: 'Like a recycling truck', correctZone: 'peripheral', expectedQuantity: 'some' }),
  o('er', 'Endoplasmic Reticulum', { function: 'Moves proteins along folded tubes near the nucleus.', analogy: 'Like a highway system', correctZone: 'near-nucleus', expectedQuantity: 'some' }),
  o('chloro', 'Chloroplast', { belongsInCell: false, function: 'Captures light to make food in plant cells.', analogy: 'Like the solar panels of a plant', distractorExplanation: 'Muscle cells do not make food from light.', correctZone: null, expectedQuantity: null }),
  o('wall', 'Cell Wall', { belongsInCell: false, function: 'A stiff outer layer that holds the shape.', analogy: 'Like a brick wall', distractorExplanation: 'Animal cells have no wall.', correctZone: null, expectedQuantity: null }),
];

const data = (mode: CellMissionPhase | CellMissionPhase[]): CellBuilderData => ({
  title: 'Power a muscle cell', description: 'Build a cell that can contract all day.', cellType: 'animal', cellContext: 'muscle cell',
  gradeBand: '6-8', organelles: ORGANELLES,
  functionMatches: ORGANELLES.filter(x => x.belongsInCell).map(x => ({ organelleId: x.id, functionDescription: `Job card for the ${x.id === 'mito' ? 'Mitochondria: turns fuel into usable energy' : x.id}.` })),
  cellMembrane: { description: 'A thin boundary', function: 'Controls what enters and leaves' },
  cellWall: { present: false, description: null },
  ...(Array.isArray(mode) ? { challengeTypes: mode, challengeType: mode[0] } : { challengeType: mode, challengeTypes: [mode] }),
});

const mount = (mode: CellMissionPhase | CellMissionPhase[]) =>
  mountWorkspace({ primitiveId: 'cell-builder', evalMode: Array.isArray(mode) ? mode.join('|') : mode, data: data(mode) as never, instanceId: 'cell-builder' });

/** Drive the board's real controls with the journey's inputs. */
const play = (h: WorkspaceHarness, mission: CellMission, wrong: boolean) => {
  for (const input of cellHarnessInputs(data(mission.phase), mission, wrong)) {
    if (input.type === 'touch') h.touch(input.target); else h.press(input.label);
  }
};
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const MODES: CellMissionPhase[] = ['cell_inventory', 'organelle_placement', 'structure_function', 'cell_specialization'];

it.each(MODES)('%s binds as a gesture board with no published key and no scripted chrome', mode => {
  const h = mount(mode);
  expect(getComponentById('cell-builder')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(workspaceAssignment(data(mode), { id: mode, phase: mode }).task);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/belongsInCell|correctZone|expectedQuantity|distractor|does not belong|Because\./);
  expect(demand(h)).toMatchObject({ kind: mode, cell: 'muscle cell' });
  // Check mission is shut until every card has an answer; the runtime, not the board, moves on.
  expect(q(h, 'button').find(b => b.textContent?.trim() === 'Check mission')).toHaveProperty('disabled', true);
  expect(h.view.container.textContent).not.toMatch(/Next mission|Run cell report|first committed answer/);
  h.close();
});

it.each(MODES)('%s: a wrong board names its miss and shows only the count; Try again keeps the work; right completes once', mode => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode);
  h.settle(2000);
  play(h, { id: mode, phase: mode }, true);
  const miss = last(h)!.miss;
  expect(last(h)).toMatchObject({ itemId: mode, correct: false });
  expect(CELL_MISSES[mode]).toContain(miss);
  // No card is marked and nothing is revealed before Try again.
  expect(q(h, '.text-amber-200, .text-amber-100')).toHaveLength(0);
  expect(h.view.container.textContent).not.toMatch(/belongs in this cell|do not make food|→ (Control|Cytoplasm|Distributed)|Because\./);
  expect(h.view.container.textContent).toMatch(/\d+ of \d+/);
  const work = demand(h).learnerWork;
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe(work);
  h.settle(2000);
  play(h, { id: mode, phase: mode }, false);
  expect(last(h)).toMatchObject({ itemId: mode, correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, extra] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'cell-builder' });
  // The report scores the first committed board (contract 6), not the corrected one.
  expect(metrics.allCorrect).toBe(false);
  expect(extra.teachingAttempts).toHaveLength(2);
  h.close();
});

it('a blend runs its missions in canonical order, each its own board', () => {
  const h = mount(['cell_specialization', 'cell_inventory']);
  expect(h.state().task!.itemId).toBe('cell_inventory');
  play(h, { id: 'cell_inventory', phase: 'cell_inventory' }, false);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('cell_specialization');
  expect(demand(h).learnerWork).toMatch(/not chosen/);
  h.close();
});

it('Stock the cell: cards alphabetical, analogies say no kind of cell, and the membrane and wall lines are hidden', () => {
  const h = mount('cell_inventory');
  const names = q(h, '.font-semibold.text-slate-100').map(n => n.textContent).filter(n => n !== 'Power a muscle cell');
  expect(names).toEqual([...names].sort());
  expect(h.view.container.textContent).toContain('Like the solar panels of a ___');
  expect(h.view.container.textContent).not.toMatch(/Membrane:|Cell wall:/);
  h.close();
});

it('Build the model leaves off a structure named after its own region; a word of another region stays as a lure', () => {
  const extra = [...ORGANELLES, o('cyto', 'Cytoplasm', { correctZone: 'peripheral' }), o('mem', 'Cell Membrane', { correctZone: 'membrane-associated' }),
    o('vac', 'Large Central Vacuole', { correctZone: 'large-central' })];
  const ids = boardCards({ ...data('organelle_placement'), organelles: extra }, { id: 'organelle_placement', phase: 'organelle_placement' }).map(x => x.id);
  expect(ids).not.toContain('cyto');
  expect(ids).toEqual(expect.arrayContaining(['mem', 'vac']));
  expect(namesOwnRegion({ name: 'Cytoplasm', correctZone: 'peripheral' })).toBe(true);
  expect(namesOwnRegion({ name: 'Cell Membrane', correctZone: 'near-nucleus' })).toBe(true);
});

it('Wire the jobs: no job card names its structure', () => {
  const h = mount('structure_function');
  expect(h.view.container.textContent).toContain('Job card for the ___: turns fuel into usable energy');
  expect(jobCardText(data('structure_function'), 'The Mitochondrion and the Golgi apparatus')).toBe('The ___ and the Golgi apparatus');
  h.close();
});

describe('the miss rules', () => {
  const board = data('cell_inventory');
  const w = (patch: Partial<typeof EMPTY_WORK>) => ({ ...EMPTY_WORK, ...patch });
  const all = (v: boolean) => Object.fromEntries(ORGANELLES.map(x => [x.id, v ? x.belongsInCell : x.belongsInCell]));
  it('inventory', () => {
    const inv: CellMission = { id: 'cell_inventory', phase: 'cell_inventory' };
    expect(cellMiss(board, inv, w({ sortDecisions: all(true) }))).toBeUndefined();
    expect(cellMiss(board, inv, w({ sortDecisions: { ...all(true), chloro: true } }))).toBe('kept_impostor');
    expect(cellMiss(board, inv, w({ sortDecisions: { ...all(true), mito: false } }))).toBe('rejected_needed');
    expect(cellMiss(board, inv, w({ sortDecisions: { ...all(true), mito: false, wall: true } }))).toBe('kept_and_rejected');
  });
  it('placement', () => {
    const m: CellMission = { id: 'organelle_placement', phase: 'organelle_placement' };
    const right = { nucleus: 'center', mito: 'scattered', ribo: 'scattered', lyso: 'peripheral', er: 'near-nucleus' } as const;
    expect(cellMiss(board, m, w({ placements: right }))).toBeUndefined();
    expect(cellMiss(board, m, w({ placements: { ...right, mito: 'peripheral', lyso: 'scattered' } }))).toBe('cytoplasm_distributed_swap');
    expect(cellMiss(board, m, w({ placements: { ...right, nucleus: 'near-nucleus', er: 'center' } }))).toBe('core_network_swap');
    expect(cellMiss(board, m, w({ placements: { ...right, er: 'membrane-associated' } }))).toBe('one_misplaced');
    expect(cellMiss(board, m, w({ placements: { ...right, er: 'membrane-associated', nucleus: 'large-central' } }))).toBe('several_misplaced');
  });
  it('jobs and abundance', () => {
    const f: CellMission = { id: 'structure_function', phase: 'structure_function' };
    const ids = { nucleus: 'nucleus', mito: 'mito', ribo: 'ribo', lyso: 'lyso', er: 'er' };
    expect(cellMiss(board, f, w({ matchConnections: { ...ids, mito: 'ribo', ribo: 'mito' } }))).toBe('two_swapped');
    expect(cellMiss(board, f, w({ matchConnections: { ...ids, mito: 'ribo', ribo: 'lyso', lyso: 'mito' } }))).toBe('several_wrong');
    const s: CellMission = { id: 'cell_specialization', phase: 'cell_specialization' };
    const key = { nucleus: 'few', mito: 'lots', ribo: 'many', lyso: 'some', er: 'some' } as const;
    expect(cellMiss(board, s, w({ quantityAnswers: key }))).toBeUndefined();
    expect(cellMiss(board, s, w({ quantityAnswers: { ...key, mito: 'some' } }))).toBe('too_little');
    expect(cellMiss(board, s, w({ quantityAnswers: { ...key, nucleus: 'many' } }))).toBe('too_much');
    expect(cellMiss(board, s, w({ quantityAnswers: { ...key, nucleus: 'many', mito: 'few' } }))).toBe('both_ways');
  });
});

describe('the lever rules', () => {
  const board = data('cell_inventory');
  it('every catalog miss of every mode has a lever, help before simplify', () => {
    const entry = getComponentById('cell-builder')!;
    for (const mode of MODES) {
      const ls = cellLevers(board, { id: mode, phase: mode }, []);
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...CELL_MISSES[mode]].sort());
      for (const miss of CELL_MISSES[mode]) {
        expect(nextLever(ls, miss)).toBe(ls[0].id);
        expect(ls[0].kind).toBe('help');
        expect(nextLever(ls.map(l => (l.kind === 'help' ? { ...l, pulled: true } : l)), miss)).toBe(FEWER_LEVER);
      }
      for (const l of ls) expect(`${l.when} ${l.does}`).not.toMatch(/nucleus|mitochond|ribosom|lysosom|chloroplast|reticulum|wall/i);
    }
    expect(entry.teachingWorkspace!.levers).toBe(true);
  });

  it('leak rules: no job line names a kind of cell or a region; no hint shares words with its own job card', () => {
    for (const x of ORGANELLES) {
      const inv = jobLine(x, 'cell_inventory', board);
      if (inv) expect(namesCellKind(inv, board), inv).toBe(false);
      const place = jobLine(x, 'organelle_placement', board);
      if (place) expect(namesRegion(place), place).toBe(false);
      const hint = hintLine(x, board);
      const job = board.functionMatches.find(m => m.organelleId === x.id)?.functionDescription ?? '';
      if (hint) expect(sharesJobWords(hint, job), hint).toBe(false);
    }
    expect(blankCellKinds('Captures light to make food in plant cells.', board)).toBe('Captures light to make food in ___ cells.');
    expect(blankRegionWords('Moves proteins along folded tubes near the nucleus.')).toBe('Moves proteins along folded tubes near the ___.');
  });

  it('the smaller board is the same mission on fewer structures, keeps an impostor on Stock the cell, and never shrinks twice', () => {
    for (const mode of MODES) {
      const full = { id: mode, phase: mode };
      const small = fewerStructures(board, full)!;
      expect(small.id).toBe(`${mode}~fewer`);
      expect(small.phase).toBe(mode);
      expect(small.only!.length).toBeGreaterThanOrEqual(2);
      expect(small.only!.length).toBeLessThan(mode === 'cell_inventory' ? ORGANELLES.length : 5);
      expect(fewerStructures(board, small)).toBeNull();
      expect(cellLevers(board, small, [])).toEqual([]);
    }
    const inv = fewerStructures(board, { id: 'cell_inventory', phase: 'cell_inventory' })!;
    expect(inv.only!.some(id => !ORGANELLES.find(x => x.id === id)!.belongsInCell)).toBe(true);
  });
});

it.each([
  ['cell_inventory', JOBS_LEVER], ['organelle_placement', JOBS_LEVER], ['structure_function', HINTS_LEVER], ['cell_specialization', LEVELS_LEVER],
] as const)('%s: a wrong board, then %s changes the screen and the scene fact in one commit and rides the next attempt', (mode, id) => {
  const h = mount(mode);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([[id, 'help', false], [FEWER_LEVER, 'simplify', false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  h.settle(2000);
  play(h, { id: mode, phase: mode }, true);
  const receipt = h.dispatch('pull_lever', { lever: id });
  expect(receipt.status).toBe('committed');
  expect(q(h, `[data-lever="${id}"]`).length).toBeGreaterThan(0);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Under/);
  // A pulled lever again is refused and changes nothing.
  const before = q(h, '[data-lever]').length;
  expect(h.dispatch('pull_lever', { lever: id }).status).toBe('blocked');
  expect(q(h, '[data-lever]')).toHaveLength(before);
  h.dispatch('retry'); h.confirmVisible();
  h.settle(2000);
  play(h, { id: mode, phase: mode }, false);
  expect(last(h)).toMatchObject({ itemId: mode, correct: true, assisted: true, levers: [id] });
  h.close();
});

it('fewer_structures opens an ungraded smaller board; the full board comes back cleared and is credited with the lever', () => {
  const h = mount('cell_inventory');
  h.settle(2000);
  play(h, { id: 'cell_inventory', phase: 'cell_inventory' }, true);
  const receipt = h.dispatch('pull_lever', { lever: FEWER_LEVER });
  expect(receipt.status).toBe('committed');
  const small = fewerStructures(data('cell_inventory'), { id: 'cell_inventory', phase: 'cell_inventory' })!;
  expect(receipt.state.task).toMatchObject({ itemId: 'cell_inventory~fewer', task: workspaceAssignment(data('cell_inventory'), small).task });
  expect(q(h, '[data-practice="fewer-structures"]')).toHaveLength(1);
  expect(q(h, '[data-pip-object^="keep-"]')).toHaveLength(small.only!.length);
  expect(levers(h)).toEqual([]);
  h.settle(2000);
  play(h, small, false);
  expect(last(h)).toMatchObject({ itemId: 'cell_inventory~fewer', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'cell_inventory' });
  expect(demand(h).learnerWork).toMatch(/^Kept: none\. Rejected: none\./);
  h.settle(2000);
  play(h, { id: 'cell_inventory', phase: 'cell_inventory' }, false);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([
    ['cell_inventory', false], ['cell_inventory~fewer', true], ['cell_inventory', true]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [FEWER_LEVER] });
  h.close();
});
