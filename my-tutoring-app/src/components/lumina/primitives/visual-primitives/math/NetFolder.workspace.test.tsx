// @vitest-environment jsdom
/**
 * Net folder on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { NetFolderChallenge, NetFolderData } from './NetFolder';
import { NET_MISSES_BY_MODE, matchItem, netFolderMiss, validItem } from './netFolderWorkspace';
import {
  CROSS_NET, INVALID_CUBE_NETS, LAYOUT_CELLS, VALID_CUBE_NETS, cellsOf, foldCubeCells, projectSolid, shapeKey, solidCounts, solidModel,
} from './netFolderGeometry';
import { solidOf } from './netFolderLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, label).toBeTruthy();
  fireEvent.change(input!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');

const count: NetFolderChallenge = { id: 'k1', type: 'count_faces_edges_vertices', instruction: 'Count the faces, edges and vertices.',
  targetAnswer: 'check-solid', hint: '', narration: '', solid: solidOf('square_pyramid') };
const identify: NetFolderChallenge = { id: 'i1', type: 'identify_solid', instruction: 'What is the name of this solid?',
  targetAnswer: 'triangular_prism', options: ['triangular_prism', 'square_pyramid', 'cube', 'triangular_pyramid'], hint: '', narration: '',
  solid: solidOf('triangular_prism') };
// The cross folds around its middle square (front); the square above it is labelled top; the yellow square is right.
const match = matchItem('m1', cellsOf(CROSS_NET), 2, 0, 3)!;
const valid = validItem('v1', cellsOf('XXXX/X..X'));
const surface: NetFolderChallenge = { id: 's1', type: 'surface_area', instruction: 'Find the total surface area of this box.',
  targetAnswer: 52, hint: '', narration: '', unitLabel: 'square units',
  faceDimensions: [{ width: 4, height: 3 }, { width: 4, height: 3 }, { width: 4, height: 2 }, { width: 4, height: 2 }, { width: 3, height: 2 }, { width: 3, height: 2 }] };
const lesson = (challenges: NetFolderChallenge[]): NetFolderData => ({ title: '3D Shapes', solid: solidOf('cube'),
  net: { layout: 'cross', faceLabels: [], gridOverlay: false }, challenges, gradeBand: '4-5' });

type Answer = { counts: [string, string, string] } | { choose: string } | { total: string };
type Case = { mode: string; data: NetFolderData; wrong: Answer; miss: string; right: Answer; secret: RegExp };
const CASES: Case[] = [
  { mode: 'count_faces_edges_vertices', data: lesson([count]), wrong: { counts: ['8', '5', '5'] }, miss: 'swapped_counts',
    right: { counts: ['5', '8', '5'] }, secret: /faces 5|edges 8|"5"|"8"/ },
  { mode: 'identify_solid', data: lesson([identify]), wrong: { choose: 'square pyramid' }, miss: 'prism_pyramid',
    right: { choose: 'triangular prism' }, secret: /triangular_prism|this is a triangular prism/i },
  { mode: 'match_faces', data: lesson([match]), wrong: { choose: 'left' }, miss: 'opposite_face', right: { choose: 'right' },
    secret: /becomes? the right|"right"/ },
  { mode: 'valid_net', data: lesson([valid]), wrong: { choose: 'Valid net' }, miss: 'missed_overlap', right: { choose: 'Invalid net' },
    secret: /does not fold|same face|NOT fold/ },
  { mode: 'surface_area', data: lesson([surface]), wrong: { total: '26' }, miss: 'half_the_faces', right: { total: '52' }, secret: /\b52\b/ },
];
const answer = (h: WorkspaceHarness, a: Answer) => {
  if ('counts' in a) { write(h, 'Faces', a.counts[0]); write(h, 'Edges', a.counts[1]); write(h, 'Vertices', a.counts[2]); }
  else if ('total' in a) write(h, 'Total surface area', a.total);
  else h.press(a.choose);
  check(h);
};

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('net-folder')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(NET_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'net-folder', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity with no key published; a wrong answer names its miss and Try again clears it; the right one completes once',
  async ({ mode, data, wrong, miss, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'net-folder', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    const { options: _options, ...facts } = task.demand as Record<string, unknown>;
    expect(JSON.stringify(facts)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/targetAnswer|isValidNet|highlightCell|netExplanation/);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/Next Challenge/);

    answer(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(h.view.container.textContent).not.toMatch(secret);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input:not([disabled]), button:not([disabled])'))
      .filter(el => /Faces|Edges|Vertices|Total|net|prism|pyramid|cube|left|right|top|bottom|back|Check Answer/i
        .test((el.getAttribute('aria-label') ?? '') + el.textContent) && !/Unfold|Fold/.test(el.textContent ?? ''));
    expect(open).toEqual([]);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/nothing|no .* chosen/);

    answer(h, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'net-folder', evalMode: 'valid_net', data: lesson([valid]) as unknown as Record<string, unknown> });
  h.press('Invalid net'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('an identify lesson never prints the solid\'s name in the header; each solid is drawn as itself', () => {
  const h = mountWorkspace({ primitiveId: 'net-folder', evalMode: 'identify_solid',
    data: { ...lesson([identify]), title: '3D Shape Identification: Triangular Prism', solid: solidOf('triangular_prism') } as unknown as Record<string, unknown> });
  // The options print it in lower case; the title and the badge printed it capitalised.
  expect(h.view.container.textContent).not.toMatch(/Triangular Prism/);
  // A triangular prism shows two of its five faces from the opening view; it is not drawn as a box.
  expect(h.view.container.querySelectorAll('svg[aria-label="The solid"] polygon[data-face]').length).toBe(2);
  expect(h.state().task!.demand.solid).toMatch(/naming it is the question/);
});

it('match_faces draws the net with only its two labels, the yellow square unlabelled, and no face-match taps', () => {
  const h = mountWorkspace({ primitiveId: 'net-folder', evalMode: 'match_faces', data: lesson([match]) as unknown as Record<string, unknown> });
  const net = h.view.container.querySelector('svg[aria-label="The net"]')!;
  const labels = Array.from(net.querySelectorAll('text')).map(t => t.textContent);
  expect(labels.sort()).toEqual(['?', 'front', 'top']);
  expect(net.querySelector('[data-highlight="true"]')?.getAttribute('data-net-face')).toBe('cell-3');
  expect(h.state().task!.demand.net).toMatch(/the squares named front and top are labelled/);
});

it('netFolderMiss names the pattern in the boxes or the tap', () => {
  const w = (over: Partial<{ selected: string | null; total: string; faces: string; edges: string; vertices: string }>) =>
    ({ selected: null, total: '', faces: '', edges: '', vertices: '', ...over });
  const pyramid = solidOf('square_pyramid'), box = solidOf('cube');
  expect(netFolderMiss(count, pyramid, w({ faces: '5', edges: '8', vertices: '5' }))).toBeUndefined();
  expect(netFolderMiss(count, pyramid, w({ faces: '4', edges: '8', vertices: '5' }))).toBe('faces_off');
  expect(netFolderMiss(count, pyramid, w({ faces: '5', edges: '6', vertices: '5' }))).toBe('edges_off');
  expect(netFolderMiss(count, pyramid, w({ faces: '5', edges: '8', vertices: '4' }))).toBe('vertices_off');
  expect(netFolderMiss(count, pyramid, w({ faces: '4', edges: '6', vertices: '4' }))).toBe('several_off');
  expect(netFolderMiss({ ...count, solid: box }, box, w({ faces: '6', edges: '8', vertices: '12' }))).toBe('swapped_counts');
  expect(netFolderMiss(identify, box, w({ selected: 'cube' }))).toBe('base_shape');
  expect(netFolderMiss(identify, box, w({ selected: 'triangular_pyramid' }))).toBe('prism_pyramid');
  expect(netFolderMiss(identify, box, w({ selected: 'cylinder' }))).toBe('curved_solid');
  expect(netFolderMiss(match, box, w({ selected: 'left' }))).toBe('opposite_face');
  expect(netFolderMiss(match, box, w({ selected: 'bottom' }))).toBe('adjacent_face');
  expect(netFolderMiss(valid, box, w({ selected: 'valid' }))).toBe('missed_overlap');
  expect(netFolderMiss(validItem('v2', cellsOf('.X../XXXX')), box, w({ selected: 'valid' }))).toBe('missed_count');
  expect(netFolderMiss(validItem('v3', cellsOf(CROSS_NET)), box, w({ selected: 'invalid' }))).toBe('rejected_valid');
  expect(netFolderMiss(surface, box, w({ total: '26' }))).toBe('half_the_faces');
  expect(netFolderMiss(surface, box, w({ total: '46' }))).toBe('missed_a_face');
  expect(netFolderMiss(surface, box, w({ total: '64' }))).toBe('extra_face');
  expect(netFolderMiss(surface, box, w({ total: '24' }))).toBe('volume');
  expect(netFolderMiss(surface, box, w({ total: '50' }))).toBe('other_total');
});

it('the geometry: the eleven nets fold, the others do not, every layout folds, and each solid has its own counts', () => {
  expect(VALID_CUBE_NETS.map(n => foldCubeCells(cellsOf(n)).valid)).toEqual(VALID_CUBE_NETS.map(() => true));
  expect(new Set(VALID_CUBE_NETS.map(n => shapeKey(cellsOf(n)))).size).toBe(11);
  expect(INVALID_CUBE_NETS.map(n => foldCubeCells(cellsOf(n)).valid)).toEqual(INVALID_CUBE_NETS.map(() => false));
  for (const cells of Object.values(LAYOUT_CELLS)) expect(foldCubeCells(cells).valid).toBe(true);
  const counts = (t: string) => solidCounts(solidModel(solidOf(t)));
  expect(counts('cube')).toEqual({ faces: 6, edges: 12, vertices: 8 });
  expect(counts('triangular_prism')).toEqual({ faces: 5, edges: 9, vertices: 6 });
  expect(counts('square_pyramid')).toEqual({ faces: 5, edges: 8, vertices: 5 });
  expect(counts('triangular_pyramid')).toEqual({ faces: 4, edges: 6, vertices: 4 });
  // The opening view shows the cube's front, right and top.
  expect(projectSolid(solidModel(solidOf('cube')), { x: -25, y: 35 }, 220).faces.filter(f => f.visible).map(f => f.label).sort())
    .toEqual(['front', 'right', 'top']);
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['net-folder'].validate;
  expect(() => validate(lesson([{ ...identify, options: ['cube', 'square_pyramid'] }]))).toThrow();
  expect(() => validate(lesson([{ ...match, faceOptions: ['top', 'bottom'] }]))).toThrow();
  expect(() => validate(lesson([{ ...surface, faceDimensions: surface.faceDimensions!.slice(0, 5) }]))).toThrow();
  expect(validate(lesson([count, identify, match, valid, surface]))).toBeTruthy();
});
