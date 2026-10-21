// @vitest-environment jsdom
/**
 * atom-builder's open build (make_atom) on the teaching workspace: an empty board with no readout that computes the
 * asked property, a miss that keeps the build, Keep and Start over, and an older make_atom item with no ask.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/primitives/build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { AtomBuilderChallenge, AtomBuilderData } from './AtomBuilder';
import { ATOM_BUILD_MISS_WORDS, atomAskInstruction, type AtomAsk } from './atomBuild';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const item = (id: string, ask: AtomAsk): AtomBuilderChallenge => ({
  id, type: 'make_atom', instruction: atomAskInstruction(ask), ask,
  targetProtons: null, targetNeutrons: null, targetElectrons: null, hint: '', narration: '',
});
const data = (challenges: AtomBuilderChallenge[]): AtomBuilderData => ({
  title: 'Make Your Own Atom', targetElement: { atomicNumber: null, massNumber: null, charge: 0, name: null }, challenges,
  showOptions: { showMiniPeriodicTable: true, showIdentityCard: true, showShellCapacity: true, showCharge: true,
    showMassNumber: true, showElectronConfiguration: true, showNucleusDetail: true },
  constraints: { maxProtons: 36, maxShells: 4, allowIons: true, allowIsotopes: true }, gradeBand: '6-8',
});
const mount = (challenges: AtomBuilderChallenge[]) =>
  mountWorkspace({ primitiveId: 'atom-builder', evalMode: 'make_atom', data: data(challenges) as never, instanceId: 'ab' });

// The tray's buttons are named by what they do ("Add proton"), so the journey's `choose` and a screen reader find them.
const KINDS = ['proton', 'neutron', 'electron'] as const;
const plus = (h: WorkspaceHarness, i: 0 | 1 | 2, times = 1) => { for (let k = 0; k < times; k++) h.press(`Add ${KINDS[i]}`); };
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const button = (h: WorkspaceHarness, label: string) =>
  Array.from(h.view.container.querySelectorAll('button')).find(b => (b.textContent ?? '').trim() === label) as HTMLButtonElement | undefined;
const particles = (h: WorkspaceHarness, kind: string, where = 'now') =>
  h.view.container.querySelectorAll(`[data-atom="${where}"] [data-particle="${kind}"]`).length;
const retry = (h: WorkspaceHarness) => { h.dispatch('retry'); h.confirmVisible(); };

describe('atom-builder make_atom open build', () => {
  it('full shell, then isotopes: a miss keeps the build, a fix passes, Keep works', () => {
    const h = mount([item('a', { kind: 'full_shell' }), item('b', { kind: 'isotopes' })]);
    // Empty board; no readout that computes the asked property.
    expect(h.view.container.querySelector('svg[data-build-scene="atom"]')).toBeTruthy();
    expect(particles(h, 'proton') + particles(h, 'electron')).toBe(0);
    expect(button(h, "I'm done!")!.disabled).toBe(true);
    for (const readout of ['Charge', 'Valence e-', 'Mass #', 'Electron Configuration']) expect(text(h)).not.toContain(readout);

    // Fluorine: nine protons, ten neutrons, nine electrons. Its outer shell is not full.
    plus(h, 0, 9); plus(h, 1, 10); plus(h, 2, 9);
    h.press("I'm done!");
    expect(text(h)).toContain(ATOM_BUILD_MISS_WORDS.shell_not_full);
    expect(particles(h, 'proton')).toBe(9);
    expect(text(h)).not.toContain('Noble Gas');

    // One electron more makes an ion: a different miss, and the words stay while the learner works.
    retry(h);
    plus(h, 2);
    h.press("I'm done!");
    expect(text(h)).toContain(ATOM_BUILD_MISS_WORDS.not_neutral);
    retry(h);
    plus(h, 0);
    expect(text(h)).toContain(ATOM_BUILD_MISS_WORDS.not_neutral);
    // Now neon: 10 protons, 10 neutrons, 10 electrons.
    h.press("I'm done!");
    expect(text(h)).toMatch(/Yes! Your Neon fits the ask/);
    expect(button(h, "I'm done!")!.disabled).toBe(true);

    // Item 2 opens empty.
    h.dispatch('advance'); h.confirmVisible();
    expect(text(h)).toContain(atomAskInstruction({ kind: 'isotopes' }));
    expect(particles(h, 'proton')).toBe(0);
    plus(h, 0, 6); plus(h, 1, 6); plus(h, 2, 6);
    h.press("I'm done!");
    expect(text(h)).toContain(ATOM_BUILD_MISS_WORDS.need_two);
    retry(h);
    h.press('Keep this atom');
    expect(h.view.container.querySelector('[data-kept-atom]')).toBeTruthy();
    expect(particles(h, 'proton', 'kept')).toBe(6);
    expect(button(h, 'Keep this atom')).toBeUndefined();
    // The build stays after Keep: the same atom twice is the same isotope.
    h.press("I'm done!");
    expect(text(h)).toContain(ATOM_BUILD_MISS_WORDS.same_neutrons);
    retry(h);
    plus(h, 0);
    h.press("I'm done!");
    expect(text(h)).toContain(ATOM_BUILD_MISS_WORDS.different_element);
    retry(h);
    h.press('Remove proton'); plus(h, 1);
    h.press("I'm done!");
    expect(text(h)).toMatch(/Two isotopes of Carbon/);
    h.close();
  });

  it('Start over clears the atom and the kept atom', () => {
    const h = mount([item('b', { kind: 'isotopes' })]);
    plus(h, 0, 2); plus(h, 1, 2); plus(h, 2, 2);
    h.press('Keep this atom');
    h.press('Start over');
    expect(h.view.container.querySelector('[data-kept-atom]')).toBeNull();
    expect(particles(h, 'proton')).toBe(0);
    h.close();
  });

  it('a make_atom item with no ask (an older payload) keeps the classic check', () => {
    const old: AtomBuilderChallenge = { ...item('o', { kind: 'full_shell' }), ask: undefined, targetProtons: 1, targetElectrons: 1 };
    const h = mount([old]);
    expect(h.view.container.querySelector('svg[data-build-scene="atom"]')).toBeNull();
    expect(button(h, 'Check Answer')).toBeTruthy();
    h.close();
  });
});
