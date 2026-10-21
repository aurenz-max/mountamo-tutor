// @vitest-environment jsdom
/**
 * atom-builder on the shared teaching workspace (its boss: `atomBuilder.boss.ts`) and its lever set: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every item is a build on the tray: no target count reaches the tutor, a wrong check names its miss in words with no
 * count, Try again keeps the atom, a right check completes once, and every miss has a lever.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/primitives/build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { AtomBuilderChallenge, AtomBuilderData } from './AtomBuilder';
import { atomAskInstruction, judgeAtomBuild, passingBuilds, type AtomAsk } from './atomBuild';
import {
  atomHarnessInputs, atomMiss, CLASSIC_ATOM_MISSES, CLASSIC_MISS_WORDS, MAKE_ATOM_MISSES, smallestPassing,
} from './atomBuilderWorkspace';
import { atomBuilderBoss } from './atomBuilder.boss';
import {
  ATOM_LEVERS, ISOTOPE_COMPARE_LEVER, MASS_METER_LEVER, ONE_PART_FIRST_LEVER, onePartFirst, PAIR_UP_LEVER, practiceFor,
  RING_COUNTS_LEVER, ringCounts, SIMPLER_ASK_LEVER, simplerAsk, TABLE_KEY_LEVER, tableKey,
} from './atomBuilderLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const classic = (id: string, type: AtomBuilderChallenge['type'], p: number | null, n: number | null, e: number | null, instruction: string): AtomBuilderChallenge =>
  ({ id, type, instruction, targetProtons: p, targetNeutrons: n, targetElectrons: e,
    hint: 'Carbon has 6 protons, 6 neutrons, and 6 electrons.', narration: '' });
const make = (id: string, ask: AtomAsk): AtomBuilderChallenge => ({ id, type: 'make_atom', instruction: atomAskInstruction(ask), ask,
  targetProtons: null, targetNeutrons: null, targetElectrons: null, hint: '', narration: '' });

const NEON = classic('ne', 'build_element', 10, 10, 10, 'Place 10 protons into the nucleus to discover neon!');
const SODIUM_ION = classic('na', 'make_ion', 11, 12, 10, 'Start with a sodium atom and remove 1 electron to make a sodium ion.');
const C14 = classic('c14', 'make_isotope', 6, 8, 6, 'Build carbon-14, a heavier isotope of carbon.');
const OXYGEN = classic('o', 'identify', 8, 8, 8, 'Examine this mysterious atom with 8 protons, 8 neutrons and 8 electrons. What element is it?');

const lesson = (challenges: AtomBuilderChallenge[], band: '3-5' | '6-8' = '6-8'): AtomBuilderData => ({
  title: 'Atoms', targetElement: { atomicNumber: null, massNumber: null, charge: 0, name: null }, challenges, gradeBand: band,
  showOptions: { showMiniPeriodicTable: true, showIdentityCard: true, showShellCapacity: true, showCharge: true,
    showMassNumber: true, showElectronConfiguration: true, showNucleusDetail: true },
  constraints: { maxProtons: 36, maxShells: 4, allowIons: true, allowIsotopes: true },
});
const MODES = ['build', 'identify', 'make_atom', 'ion_isotope'] as const;
const sessionFor = (mode: typeof MODES[number]) => mode === 'make_atom'
  ? [make('ma1', { kind: 'full_shell' }), make('ma2', { kind: 'charge', charge: -2 }), make('ma3', { kind: 'isotopes' })]
  : mode === 'ion_isotope' ? [SODIUM_ION, C14] : mode === 'identify' ? [OXYGEN] : [NEON];
const mount = (challenges: AtomBuilderChallenge[], evalMode = 'build') =>
  mountWorkspace({ primitiveId: 'atom-builder', evalMode, data: lesson(challenges) as never, instanceId: 'atom-builder' });

/** Drive the tray's real controls with the journey's inputs. */
const play = (h: WorkspaceHarness, c: AtomBuilderChallenge, wrong: boolean) => {
  for (const input of atomHarnessInputs(c, wrong, 36, h.state().task!.demand)) {
    if (input.type === 'check') h.press('Check Answer'); else h.press(input.label);
  }
};
const task = (h: WorkspaceHarness) => h.state().task!;
const last = (h: WorkspaceHarness) => task(h).workspace!.attempts.at(-1);
const demand = (h: WorkspaceHarness) => task(h).demand as Record<string, unknown>;
const levers = (h: WorkspaceHarness) => task(h).workspace!.levers ?? [];
/** A board with particles on it and a kept atom, so every lever with something to draw is offered. */
const FULL = { atom: { protons: 3, neutrons: 3, electrons: 3 }, kept: { protons: 3, neutrons: 4, electrons: 3 } };
const atomLevers = (c: AtomBuilderChallenge, pulled: readonly string[]) => ATOM_LEVERS.declare(c, FULL, pulled);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it.each(MODES)('%s binds as a gesture build with no published key and no scripted chrome', mode => {
  const challenges = sessionFor(mode);
  const h = mount(challenges, mode);
  expect(getComponentById('atom-builder')!.evalModes!.map(m => m.evalMode)).toEqual(['build', 'identify', 'make_atom', 'ion_isotope']);
  expect(h.state().owner).toBe('tutor');
  expect(task(h).task).toBe(atomBuilderBoss.assignment!(challenges[0]).task);
  expect(task(h).workspace!.expectedAnswer).toBeUndefined();
  expect(demand(h)).toMatchObject({ protons: 0, neutrons: 0, electrons: 0 });
  // No target count, mass number or passing atom is published beyond what the instruction says.
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/target|neon|sodium|carbon|oxygen|helium|\b1[02]\b/i);
  expect(text(h)).not.toMatch(/Hint:|Challenge 2\//);
  h.close();
});

it.each(MODES)('%s: a wrong build names its miss with no count; Try again keeps the atom; right completes once', mode => {
  seam.evaluationContext = { lesson: 'test' };
  const challenges = sessionFor(mode);
  const h = mount(challenges, mode);
  for (let i = 0; i < challenges.length; i++) {
    const c = challenges[i];
    play(h, c, true);
    expect(last(h)).toMatchObject({ itemId: c.id, correct: false });
    const miss = last(h)!.miss!;
    expect([...CLASSIC_ATOM_MISSES, ...MAKE_ATOM_MISSES]).toContain(miss);
    // The wrong check's words carry no count and no generated hint.
    expect(text(h)).not.toMatch(/Need \d|you have|Hint:|Carbon has/);
    if (miss in CLASSIC_MISS_WORDS) expect(text(h)).toContain(CLASSIC_MISS_WORDS[miss as keyof typeof CLASSIC_MISS_WORDS]);
    // The tray is shut until Try again.
    expect(q(h, 'button[aria-label="Add proton"]')[0]).toHaveProperty('disabled', true);
    const work = demand(h).learnerWork;
    h.dispatch('retry'); h.confirmVisible();
    expect(demand(h).learnerWork).toBe(work);
    play(h, c, false);
    expect(last(h)).toMatchObject({ itemId: c.id, correct: true });
    h.dispatch('advance'); h.confirmVisible();
    if (i < challenges.length - 1) expect(demand(h)).toMatchObject({ protons: 0, neutrons: 0, electrons: 0 });
  }
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, extra] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'atom-builder', elementsTotal: challenges.length });
  expect(extra.teachingAttempts).toHaveLength(challenges.length * 2);
  h.close();
});

describe('misses', () => {
  it.each([
    [NEON, { protons: 9, neutrons: 10, electrons: 10 }, 'protons_off'],
    [NEON, { protons: 10, neutrons: 9, electrons: 11 }, 'neutrons_off'],
    [SODIUM_ION, { protons: 11, neutrons: 12, electrons: 11 }, 'electrons_off'],
    [C14, { protons: 6, neutrons: 6, electrons: 6 }, 'neutrons_off'],
    [make('a', { kind: 'charge', charge: -2 }), { protons: 9, neutrons: 10, electrons: 10 }, 'charge_size'],
    [make('a', { kind: 'full_shell' }), { protons: 9, neutrons: 10, electrons: 9 }, 'shell_not_full'],
  ] as const)('%#: %o -> %s', (c, atom, miss) => {
    expect(atomMiss(c, { ...atom, kept: null, identityCard: true })).toBe(miss);
  });

  it('every catalog miss is answered by a lever, help before simplify', () => {
    const tw = getComponentById('atom-builder')!.teachingWorkspace!;
    for (const [mode, misses] of Object.entries(tw.misses ?? {})) {
      const items = sessionFor(mode as typeof MODES[number]);
      for (const miss of misses) {
        if ((tw.unanswered?.[mode] ?? []).includes(miss)) continue;
        const answered = items.some(c => atomLevers(c, []).some(l => l.answers?.includes(miss)));
        expect(answered, `${mode}: ${miss}`).toBe(true);
      }
    }
    expect(nextLever(atomLevers(C14, []), 'neutrons_off')).toBe(TABLE_KEY_LEVER);
    expect(nextLever(atomLevers(C14, [TABLE_KEY_LEVER]), 'neutrons_off')).toBe(MASS_METER_LEVER);
    expect(nextLever(atomLevers(SODIUM_ION, []), 'electrons_off')).toBe(PAIR_UP_LEVER);
    expect(nextLever(atomLevers(make('a', { kind: 'valence', outer: 3 }), []), 'valence_off')).toBe(RING_COUNTS_LEVER);
    expect(nextLever(atomLevers(make('a', { kind: 'isotopes' }), []), 'same_neutrons')).toBe(ISOTOPE_COMPARE_LEVER);
    expect(nextLever(atomLevers(make('a', { kind: 'isotopes' }), [TABLE_KEY_LEVER, ISOTOPE_COMPARE_LEVER]), 'same_neutrons')).toBe(SIMPLER_ASK_LEVER);
  });
});

describe('leak rules', () => {
  it('the table key is the same for every item and the practice items state no new count', () => {
    expect(tableKey(36)).toHaveLength(36);
    expect(tableKey(36).find(k => k.z === 10)).toEqual({ z: 10, symbol: 'Ne', mass: 20 });
    for (const c of [NEON, SODIUM_ION, C14, OXYGEN]) {
      const p = onePartFirst(c)!;
      expect(p.id).toBe(`${c.id}~first`);
      expect(p.instruction).not.toMatch(/\d/);
      expect(p.targetProtons).toBe(c.targetProtons);
    }
    expect(onePartFirst(SODIUM_ION)!.targetElectrons).toBe(11);
    expect(onePartFirst(NEON)!.targetElectrons).toBeNull();
  });

  it('a simpler ask is easier, still passable, and never the full ask', () => {
    const asks: AtomAsk[] = [{ kind: 'full_shell' }, { kind: 'valence', outer: 5 }, { kind: 'charge', charge: -2 }, { kind: 'charge', charge: 1 }, { kind: 'isotopes' }];
    for (const ask of asks) {
      const easier = simplerAsk(ask)!;
      expect(easier).not.toEqual(ask);
      expect(passingBuilds(easier, 20).length).toBeGreaterThan(0);
      expect(practiceFor(make('x', ask))!.instruction).toBe(atomAskInstruction(easier));
    }
    expect(simplerAsk({ kind: 'charge', charge: -2 })).toEqual({ kind: 'charge', charge: -1 });
    expect(simplerAsk({ kind: 'neutral' })).toBeNull();
  });

  it('ring labels count the learner\'s own rings; the harness atoms pass and fail as named', () => {
    expect(ringCounts(9)).toEqual(['2 of 2', '7 of 8']);
    expect(ringCounts(19)).toEqual(['2 of 2', '8 of 8', '8 of 18', '1 of 8']);
    for (const ask of [{ kind: 'full_shell' }, { kind: 'valence', outer: 7 }, { kind: 'charge', charge: 2 }] as AtomAsk[]) {
      const atom = smallestPassing(ask, 20) as { protons: number; neutrons: number; electrons: number };
      expect(judgeAtomBuild(ask, atom).pass).toBe(true);
    }
  });
});

describe('levers on the mounted workspace', () => {
  it('table key: the cells get symbols and usual mass numbers in the pull\'s commit; the next try records it', () => {
    const h = mount([NEON]);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    play(h, NEON, true);
    h.dispatch('retry'); h.confirmVisible();
    const receipt = h.dispatch('pull_lever', { lever: TABLE_KEY_LEVER });
    expect(receipt.status).toBe('committed');
    expect(q(h, '[data-lever="table-key"]')).toHaveLength(1);
    expect(q(h, '[data-table-symbol]')).toHaveLength(36);
    expect(String(receipt.state.task!.demand.onScreen)).toMatch(/usual mass number/);
    expect(h.dispatch('pull_lever', { lever: TABLE_KEY_LEVER }).status).toBe('blocked');
    play(h, NEON, false);
    expect(last(h)).toMatchObject({ itemId: 'ne', correct: true, assisted: true, levers: [TABLE_KEY_LEVER] });
    h.close();
  });

  it('mass meter and pair-up draw the learner\'s own counts, never the target', () => {
    const h = mount([SODIUM_ION]);
    play(h, SODIUM_ION, true);
    h.dispatch('retry'); h.confirmVisible();
    expect(h.dispatch('pull_lever', { lever: MASS_METER_LEVER }).status).toBe('committed');
    expect(q(h, '[data-lever="mass-meter"]')[0].textContent).toBe('mass number = protons + neutrons = 11 + 12 = 23');
    expect(h.dispatch('pull_lever', { lever: PAIR_UP_LEVER }).status).toBe('committed');
    // The wrong build kept every electron (11 protons, 11 electrons): 11 pairs, no particle alone.
    expect(q(h, '[data-pair="pair"]')).toHaveLength(11);
    expect(q(h, '[data-pair^="lone"]')).toHaveLength(0);
    h.press('Remove electron'); h.press('Remove electron');
    expect(q(h, '[data-pair="pair"]')).toHaveLength(9);
    expect(q(h, '[data-pair="lone-proton"]')).toHaveLength(2);
    h.press('Add electron'); h.press('Add electron'); h.press('Add electron');
    expect(q(h, '[data-pair="lone-electron"]')).toHaveLength(1);
    h.close();
  });

  it('ring counts are not offered on an empty atom and label the rings once there are electrons', () => {
    const h = mount([make('v', { kind: 'valence', outer: 3 })], 'make_atom');
    const before = JSON.stringify(demand(h));
    expect(levers(h).map(l => l.id)).not.toContain(RING_COUNTS_LEVER);
    expect(h.dispatch('pull_lever', { lever: RING_COUNTS_LEVER }).status).toBe('blocked');
    expect(JSON.stringify(demand(h))).toBe(before);
    h.press('Add proton'); h.press('Add electron'); h.press('Add electron'); h.press('Add electron');
    expect(h.dispatch('pull_lever', { lever: RING_COUNTS_LEVER }).status).toBe('committed');
    expect(q(h, '[data-lever="ring-count"]').map(t => t.textContent)).toEqual(['2 of 2', '1 of 8']);
    h.close();
  });

  it('isotope compare is offered once an atom is kept, then shows both nuclei', () => {
    const iso = make('i', { kind: 'isotopes' });
    const h = mount([iso], 'make_atom');
    expect(levers(h).map(l => l.id)).not.toContain(ISOTOPE_COMPARE_LEVER);
    expect(h.dispatch('pull_lever', { lever: ISOTOPE_COMPARE_LEVER }).status).toBe('blocked');
    play(h, iso, true);
    expect(last(h)).toMatchObject({ correct: false, miss: 'same_neutrons' });
    h.dispatch('retry'); h.confirmVisible();
    expect(h.dispatch('pull_lever', { lever: ISOTOPE_COMPARE_LEVER }).status).toBe('committed');
    expect(q(h, '[data-lever="isotope-compare"] td').map(t => t.textContent)).toEqual(['Protons', '1', '1', 'Neutrons', '0', '0']);
    h.close();
  });

  it('one part first is ungraded; the full item comes back blank and only its answer is credited', () => {
    const h = mount([SODIUM_ION], 'ion_isotope');
    play(h, SODIUM_ION, true);
    const receipt = h.dispatch('pull_lever', { lever: ONE_PART_FIRST_LEVER });
    expect(receipt.status).toBe('committed');
    expect(receipt.state.task).toMatchObject({ itemId: 'na~first' });
    expect(text(h)).toContain('A first step');
    expect(levers(h)).toEqual([]);
    play(h, onePartFirst(SODIUM_ION)!, false);
    expect(last(h)).toMatchObject({ itemId: 'na~first', correct: true });
    h.dispatch('advance'); h.confirmVisible();
    expect(task(h)).toMatchObject({ itemId: 'na' });
    expect(demand(h)).toMatchObject({ protons: 0, neutrons: 0, electrons: 0 });
    play(h, SODIUM_ION, false);
    const attempts = task(h).workspace!.attempts;
    expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
      ['na', false, false], ['na~first', true, true], ['na', true, false]]);
    expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [ONE_PART_FIRST_LEVER] });
    h.close();
  });

  it('a simpler ask on make_atom opens "any neutral atom", ungraded', () => {
    const shell = make('s', { kind: 'full_shell' });
    const h = mount([shell], 'make_atom');
    play(h, shell, true);
    const receipt = h.dispatch('pull_lever', { lever: SIMPLER_ASK_LEVER });
    expect(receipt.state.task).toMatchObject({ itemId: 's~simpler', task: 'Make any neutral atom.' });
    expect(demand(h)).toMatchObject({ protons: 0 });
    h.close();
  });
});

it('the identity card does not name the element before a build is checked', () => {
  const h = mount([NEON], 'build');
  for (let i = 0; i < 10; i++) h.press('Add proton');
  expect(text(h)).not.toContain('Neon');
  expect(text(h)).toContain('The name shows once your atom is checked.');
  expect(demand(h).identityCard).toBeUndefined();
  expect(String(demand(h).learnerWork)).not.toContain('Neon');
});

it('the identity card still names the element on an ion item, where the element is given', () => {
  const h = mount([SODIUM_ION], 'ion_isotope');
  for (let i = 0; i < 11; i++) h.press('Add proton');
  expect(demand(h).identityCard).toBe('Sodium');
});
