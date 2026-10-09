// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AtomBuilder, { type AtomBuilderData, type AtomBuilderChallenge } from './AtomBuilder';
import { ATOM_BUILD_MISS_WORDS, atomAskInstruction, type AtomAsk } from './atomBuild';

vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: false, activePrimitiveId: null }),
}));
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, resetAttempt: vi.fn() }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

afterEach(() => { cleanup(); vi.useRealTimers(); });

const item = (id: string, ask: AtomAsk): AtomBuilderChallenge => ({
  id, type: 'make_atom', instruction: atomAskInstruction(ask), ask,
  targetProtons: null, targetNeutrons: null, targetElectrons: null, hint: '', narration: '',
});
const data = (challenges: AtomBuilderChallenge[]): AtomBuilderData => ({
  title: 'Make Your Own Atom', targetElement: { atomicNumber: null, massNumber: null, charge: 0, name: null }, challenges,
  showOptions: { showMiniPeriodicTable: true, showIdentityCard: true, showShellCapacity: true, showCharge: true,
    showMassNumber: true, showElectronConfiguration: true, showNucleusDetail: true },
  constraints: { maxProtons: 36, maxShells: 4, allowIons: true, allowIsotopes: true }, gradeBand: '6-8', instanceId: 'ab',
});

const plus = (i: 0 | 1 | 2, times = 1) => { for (let k = 0; k < times; k++) fireEvent.click(screen.getAllByRole('button', { name: '+' })[i]); };
const minus = (i: 0 | 1 | 2) => fireEvent.click(screen.getAllByRole('button', { name: '-' })[i]);
const done = () => fireEvent.click(screen.getByRole('button', { name: "I'm done!" }));
const particles = (c: HTMLElement, kind: string, where = 'now') => c.querySelectorAll(`[data-atom="${where}"] [data-particle="${kind}"]`).length;

describe('atom-builder make_atom open build', () => {
  it('full shell, then isotopes: a miss keeps the build, a fix passes, Keep and Start over work', () => {
    vi.useFakeTimers();
    const { container } = render(<AtomBuilder data={data([item('a', { kind: 'full_shell' }), item('b', { kind: 'isotopes' })])} />);
    // Empty board; no readout that computes the asked property.
    expect(container.querySelector('svg[data-build-scene="atom"]')).toBeTruthy();
    expect(particles(container, 'proton') + particles(container, 'electron')).toBe(0);
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Charge')).toBeNull();
    expect(screen.queryByText('Valence e-')).toBeNull();
    expect(screen.queryByText('Mass #')).toBeNull();
    expect(screen.queryByText('Electron Configuration')).toBeNull();

    // Fluorine: nine protons, ten neutrons, nine electrons. Its outer shell is not full.
    plus(0, 9); plus(1, 10); plus(2, 9);
    done();
    expect(screen.getByText(ATOM_BUILD_MISS_WORDS.shell_not_full)).toBeTruthy();
    expect(particles(container, 'proton')).toBe(9);
    expect(screen.queryByText('Noble Gas')).toBeNull();

    // One electron more makes an ion: a different miss, and the words stay while the learner works.
    plus(2);
    done();
    expect(screen.getByText(ATOM_BUILD_MISS_WORDS.not_neutral)).toBeTruthy();
    plus(0);
    expect(screen.getByText(ATOM_BUILD_MISS_WORDS.not_neutral)).toBeTruthy();
    // Now neon: 10 protons, 10 neutrons, 10 electrons.
    done();
    expect(screen.getByText(/Yes! Your Neon fits the ask/)).toBeTruthy();
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(2100); });

    // Item 2 opens empty.
    expect(screen.getByText(atomAskInstruction({ kind: 'isotopes' }))).toBeTruthy();
    expect(particles(container, 'proton')).toBe(0);
    plus(0, 6); plus(1, 6); plus(2, 6);
    done();
    expect(screen.getByText(ATOM_BUILD_MISS_WORDS.need_two)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep this atom' }));
    expect(container.querySelector('[data-kept-atom]')).toBeTruthy();
    expect(particles(container, 'proton', 'kept')).toBe(6);
    expect(screen.queryByRole('button', { name: 'Keep this atom' })).toBeNull();
    // The build stays after Keep: the same atom twice is the same isotope.
    done();
    expect(screen.getByText(ATOM_BUILD_MISS_WORDS.same_neutrons)).toBeTruthy();
    plus(0);
    done();
    expect(screen.getByText(ATOM_BUILD_MISS_WORDS.different_element)).toBeTruthy();
    minus(0); plus(1);
    done();
    expect(screen.getByText(/Two isotopes of Carbon/)).toBeTruthy();
  });

  it('Start over clears the atom and the kept atom', () => {
    const { container } = render(<AtomBuilder data={data([item('b', { kind: 'isotopes' })])} />);
    plus(0, 2); plus(1, 2); plus(2, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Keep this atom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(container.querySelector('[data-kept-atom]')).toBeNull();
    expect(particles(container, 'proton')).toBe(0);
  });

  it('a make_atom item with no ask (an older payload) keeps the classic check', () => {
    const old: AtomBuilderChallenge = { ...item('o', { kind: 'full_shell' }), ask: undefined, targetProtons: 1, targetElectrons: 1 };
    const { container } = render(<AtomBuilder data={data([old])} />);
    expect(container.querySelector('svg[data-build-scene="atom"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeTruthy();
  });
});
