// @vitest-environment jsdom
/**
 * net-folder levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the easier item is ungraded practice with the full
 * item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { NetFolderChallenge, NetFolderData } from './NetFolder';
import { matchItem, validItem } from './netFolderWorkspace';
import { cellsOf } from './netFolderGeometry';
import { solidOf } from './netFolderLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const count: NetFolderChallenge = { id: 'k1', type: 'count_faces_edges_vertices', instruction: 'Count the faces, edges and vertices.',
  targetAnswer: 'check-solid', hint: '', narration: '', solid: solidOf('square_pyramid') };
const identify: NetFolderChallenge = { id: 'i1', type: 'identify_solid', instruction: 'What is the name of this solid?',
  targetAnswer: 'square_pyramid', options: ['triangular_prism', 'square_pyramid', 'cube', 'triangular_pyramid'], hint: '', narration: '',
  solid: solidOf('square_pyramid') };
// An L-shaped net (a row of four, one square above its first and one below its last): front, top labelled; yellow on
// the row's last square.
const match = matchItem('m1', cellsOf('X.../XXXX/...X'), 1, 0, 4)!;
const surface: NetFolderChallenge = { id: 's1', type: 'surface_area', instruction: 'Find the total surface area of this box.',
  targetAnswer: 52, hint: '', narration: '', unitLabel: 'square units',
  faceDimensions: [{ width: 4, height: 3 }, { width: 4, height: 3 }, { width: 4, height: 2 }, { width: 4, height: 2 }, { width: 3, height: 2 }, { width: 3, height: 2 }] };
// The hard tier's starting position: no fold lines.
const lesson = (c: NetFolderChallenge, foldLines = false): NetFolderData => ({ title: '3D Shapes', solid: solidOf('cube'),
  net: { layout: 'cross', faceLabels: [], gridOverlay: false }, challenges: [c], gradeBand: '4-5',
  showOptions: { showFoldGuides: foldLines, showFaceMatchHints: false } });
const mount = (mode: string, c: NetFolderChallenge, foldLines = false) => {
  const h = mountWorkspace({ primitiveId: 'net-folder', evalMode: mode, data: lesson(c, foldLines) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};
const counts = (h: WorkspaceHarness, f: string, e: string, v: string) => { write(h, 'Faces', f); write(h, 'Edges', e); write(h, 'Vertices', v); check(h); };

it('count: see_through draws the hidden edges in the same commit, no digit; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('count_faces_edges_vertices', count);
  expect(levers(h)).toEqual([['see_through', false], ['part_names', false], ['net_beside', false], ['smaller_solid', false]]);
  counts(h, '4', '6', '4');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'several_off' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'several_off')).toBe('see_through');
  expect(q(h, '[data-hidden-edge]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'see_through' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/back edges of the solid are dashed/);
  // A square pyramid seen from above hides its base's back edges.
  expect(q(h, '[data-hidden-edge]').length).toBeGreaterThan(0);
  expect(q(h, '[data-hidden-corner]').length).toBeGreaterThan(0);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'see_through' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'part_names' }).status).toBe('committed');
  expect(q(h, '[data-lever="part-names"]')[0].textContent).not.toMatch(/\d/);
  expect(h.dispatch('pull_lever', { lever: 'net_beside' }).status).toBe('committed');
  expect(q(h, 'svg[aria-label="The net"]')).toHaveLength(1);
  h.dispatch('retry');
  counts(h, '5', '8', '5');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'k1', correct: true, levers: ['see_through', 'part_names', 'net_beside'] });
});

it('identify: the base outlined and turned to, the family pictures, none naming the solid', () => {
  const h = mount('identify_solid', identify);
  const named = () => (h.view.container.textContent!.match(/square pyramid/gi) ?? []).length;
  h.press('triangular prism'); check(h);
  const before = named();
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'prism_pyramid' });
  expect(h.dispatch('pull_lever', { lever: 'base_outline' }).status).toBe('committed');
  // The base faces away at the opening view: the outline shows once the solid turns to it.
  expect(h.dispatch('pull_lever', { lever: 'turn_to_base' }).status).toBe('committed');
  expect(q(h, 'svg[aria-label="The solid"] [data-lever="base-outline"]').map(p => p.getAttribute('data-face'))).toEqual(['base']);
  expect(h.dispatch('pull_lever', { lever: 'family_model' }).status).toBe('committed');
  expect(q(h, '[data-lever^="family-model"]')).toHaveLength(2);
  // Only the option button names it, as before the pulls.
  expect(named()).toBe(before);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/square pyramid/i);
  h.dispatch('retry');
  h.press('square pyramid'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['base_outline', 'turn_to_base', 'family_model'] });
});

it('match: fold lines drawn, one more square named (never the yellow one), the opposite rule beside the net', () => {
  const h = mount('match_faces', match);
  const target = String(match.targetAnswer);
  const wrong = (match.faceOptions ?? []).find(o => o !== target)!;
  h.press(wrong); check(h);
  expect(q(h, '[data-fold-line]')).toHaveLength(0);
  expect(h.dispatch('pull_lever', { lever: 'fold_guides' }).status).toBe('committed');
  expect(q(h, '[data-fold-line]')).toHaveLength(5);
  const named = () => q(h, 'svg[aria-label="The net"] text').map(t => t.textContent).filter(t => t !== '?');
  expect(named()).toHaveLength(2);
  expect(h.dispatch('pull_lever', { lever: 'third_label' }).status).toBe('committed');
  expect(named()).toHaveLength(3);
  expect(named()).not.toContain(target);
  expect(q(h, 'svg[aria-label="The net"] [data-highlight="true"] text')[0].textContent).toBe('?');
  expect(h.dispatch('pull_lever', { lever: 'opposite_rule' }).status).toBe('committed');
  expect(q(h, '[data-lever="opposite-rule"]')[0].textContent).toMatch(/opposite faces/);
  h.dispatch('retry');
  h.press(target); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['fold_guides', 'third_label', 'opposite_rule'] });
});

it('valid: the tier already drew the fold lines, so that lever is not offered and a pull of it changes nothing', () => {
  const item = validItem('v1', cellsOf('XXXX/X..X'));
  const h = mount('valid_net', item, true);
  expect(levers(h).map(([id]) => id)).toEqual(['six_faces_model', 'wrap_model', 'valid_model', 'easier_net']);
  h.press('Valid net'); check(h);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'fold_guides' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'wrap_model' }).status).toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'valid_model' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="valid-model"]')).not.toBeNull();
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\b(in)?valid\b/i);
});

it('surface: the net numbered to the face list and the pairs coloured alike, no area or total written', () => {
  const h = mount('surface_area', surface);
  write(h, 'Total surface area', '26'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'half_the_faces' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'half_the_faces')).toBe('match_list');
  expect(h.dispatch('pull_lever', { lever: 'match_list' }).status).toBe('committed');
  const net = q(h, 'svg[aria-label="The net"] text').map(t => t.textContent);
  expect(net.sort()).toEqual(['1', '2', '3', '4', '5', '6']);
  expect(h.dispatch('pull_lever', { lever: 'pair_colors' }).status).toBe('committed');
  expect(new Set(q(h, 'svg[aria-label="The net"] polygon').map(p => p.getAttribute('fill'))).size).toBe(3);
  expect(h.view.container.textContent).not.toMatch(/\b52\b/);
  h.dispatch('retry');
  write(h, 'Total surface area', '52'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['match_list', 'pair_colors'] });
});

it('the easier item is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount('match_faces', match);
  const target = String(match.targetAnswer);
  h.press((match.faceOptions ?? []).find(o => o !== target)!); check(h);
  const r = h.dispatch('pull_lever', { lever: 'easier_net' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('m1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'm1' });
  expect(r.state.task!.demand.learnerWork).toBe('no face chosen yet');
  // The practice net is the cross.
  expect(q(h, 'svg[aria-label="The net"] [data-net-face]')).toHaveLength(6);
  const practice = (r.state.task!.demand.options as string).split(', ');
  // Answer the practice by trying its options until the activity credits one (the test does not read its key).
  for (const option of practice) {
    if (h.state().task!.workspace!.lastResponse?.correct) break;
    if (h.state().task!.phase !== 'working') h.dispatch('retry');
    h.press(option); check(h);
  }
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m1');
  expect(h.state().task!.demand.learnerWork).toBe('no face chosen yet');
  h.press(target); check(h);
  const record = attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice]);
  expect(record[0]).toEqual(['m1', false, false]);
  expect(record.at(-1)).toEqual(['m1', true, false]);
  expect(record.slice(1, -1).every(([id, , p]) => id === 'm1~simpler' && p)).toBe(true);
});
