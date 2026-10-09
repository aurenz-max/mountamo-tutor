import { describe, expect, it, vi } from 'vitest';
import {
  atomShells, outerElectrons, outerShellFull, nucleusHolds, judgeAtomBuild, passingBuilds, buildAtomAsks,
  atomAskInstruction, type AtomAsk, type BuiltAtom,
} from './atomBuild';

vi.mock('../../../service/geminiClient', () => ({ ai: { models: { generateContent: vi.fn(() => { throw new Error('no model call on make_atom'); }) } } }));

const atom = (protons: number, neutrons: number, electrons: number): BuiltAtom => ({ protons, neutrons, electrons });
const miss = (ask: AtomAsk, a: BuiltAtom, kept?: BuiltAtom) => judgeAtomBuild(ask, a, kept).miss;

describe('atom shells (the board and the judge share them)', () => {
  it('fills subshells in order and groups them by shell', () => {
    expect(atomShells(0)).toEqual([]);
    expect(atomShells(2)).toEqual([2]);
    expect(atomShells(19)).toEqual([2, 8, 8, 1]);
    expect(atomShells(26)).toEqual([2, 8, 14, 2]);
    expect(atomShells(24)).toEqual([2, 8, 13, 1]);
    expect(atomShells(29)).toEqual([2, 8, 18, 1]);
    expect(atomShells(35)).toEqual([2, 8, 18, 7]);
    expect(atomShells(36)).toEqual([2, 8, 18, 8]);
  });
  it('a full outer shell is two on the first shell, eight after it', () => {
    expect([2, 10, 18, 36].every(outerShellFull)).toBe(true);
    expect([1, 9, 20, 30, 28].some(outerShellFull)).toBe(false);
    expect(outerElectrons(35)).toBe(7);
  });
  it('a nucleus holds with about as many neutrons as protons, or a few more', () => {
    expect(nucleusHolds(1, 0)).toBe(true);
    expect(nucleusHolds(10, 0)).toBe(false);
    expect(nucleusHolds(6, 6)).toBe(true);
    expect(nucleusHolds(20, 28)).toBe(true);
    expect(nucleusHolds(6, 20)).toBe(false);
  });
});

describe('make_atom judge', () => {
  it('full shell: neon passes, argon is a second different pass; fluorine is short, an ion is not neutral', () => {
    const ask: AtomAsk = { kind: 'full_shell' };
    expect(judgeAtomBuild(ask, atom(10, 10, 10)).pass).toBe(true);
    expect(judgeAtomBuild(ask, atom(18, 22, 18)).pass).toBe(true);
    expect(judgeAtomBuild(ask, atom(36, 48, 36)).pass).toBe(true);
    expect(miss(ask, atom(9, 10, 9))).toBe('shell_not_full');
    expect(miss(ask, atom(11, 12, 10))).toBe('not_neutral');
    expect(miss(ask, atom(10, 0, 10))).toBe('nucleus_off');
    expect(miss(ask, atom(0, 2, 2))).toBe('no_protons');
  });
  it('outer electrons: one under and one over miss; chlorine and bromine both pass seven', () => {
    const ask: AtomAsk = { kind: 'valence', outer: 7 };
    expect(judgeAtomBuild(ask, atom(17, 18, 17)).pass).toBe(true);
    expect(judgeAtomBuild(ask, atom(35, 45, 35)).pass).toBe(true);
    expect(miss(ask, atom(16, 16, 16))).toBe('valence_off');
    expect(miss(ask, atom(18, 22, 18))).toBe('valence_off');
    expect(miss(ask, atom(17, 18, 18))).toBe('not_neutral');
  });
  it('charge -1: F- and Cl- pass; one electron too many, the wrong sign and no charge each miss', () => {
    const ask: AtomAsk = { kind: 'charge', charge: -1 };
    expect(judgeAtomBuild(ask, atom(9, 10, 10)).pass).toBe(true);
    expect(judgeAtomBuild(ask, atom(17, 18, 18)).pass).toBe(true);
    expect(miss(ask, atom(8, 8, 10))).toBe('charge_size');
    expect(miss(ask, atom(11, 12, 10))).toBe('charge_sign');
    expect(miss(ask, atom(9, 10, 9))).toBe('still_neutral');
  });
  it('isotopes: carbon-12 then carbon-13 passes, oxygen-16 then oxygen-18 too; same nucleus or two elements miss', () => {
    const ask: AtomAsk = { kind: 'isotopes' };
    expect(judgeAtomBuild(ask, atom(6, 7, 6), atom(6, 6, 6)).pass).toBe(true);
    expect(judgeAtomBuild(ask, atom(8, 10, 8), atom(8, 8, 8)).pass).toBe(true);
    expect(miss(ask, atom(6, 6, 6))).toBe('need_two');
    expect(miss(ask, atom(6, 6, 6), atom(6, 6, 6))).toBe('same_neutrons');
    expect(miss(ask, atom(7, 7, 7), atom(6, 6, 6))).toBe('different_element');
  });
});

describe('make_atom asks', () => {
  const elements = (ask: AtomAsk, max: number) => {
    const builds = passingBuilds(ask, max);
    return new Set(builds.map(b => (Array.isArray(b) ? b[0].protons : b.protons)));
  };
  it('every ask a session can hold has at least two different elements that pass', () => {
    for (let k = 1; k <= 7; k++) expect(elements({ kind: 'valence', outer: k }, 20).size).toBeGreaterThanOrEqual(2);
    expect(Array.from(elements({ kind: 'full_shell' }, 20))).toEqual([2, 10, 18]);
    expect(Array.from(elements({ kind: 'full_shell' }, 36))).toEqual([2, 10, 18, 36]);
    for (const q of [-2, -1, 1, 2]) expect(elements({ kind: 'charge', charge: q }, 36).size).toBeGreaterThan(10);
    expect(elements({ kind: 'isotopes' }, 36).size).toBe(36);
  });
  it('a session holds distinct asks; grades 3-5 make neutral atoms only', () => {
    for (let seed = 0; seed < 20; seed++) {
      let x = seed / 20 + 0.013;
      const rand = () => (x = (x * 9301 + 0.49297) % 1);
      const small = buildAtomAsks('3-5', rand), big = buildAtomAsks('6-8', rand);
      for (const asks of [small, big]) expect(new Set(asks.map(a => JSON.stringify(a))).size).toBe(asks.length);
      expect(small.every(a => a.kind === 'valence' || a.kind === 'full_shell')).toBe(true);
      expect(big.map(a => a.kind)).toEqual(['valence', 'full_shell', 'charge', 'isotopes']);
    }
  });
  it('the ask states the property and never names an atom that has it', () => {
    expect(atomAskInstruction({ kind: 'valence', outer: 1 })).toBe('Make any neutral atom with one electron in its outer shell.');
    expect(atomAskInstruction({ kind: 'charge', charge: -2 })).toBe('Make any ion with a charge of -2.');
    const all = [atomAskInstruction({ kind: 'full_shell' }), atomAskInstruction({ kind: 'isotopes' })].join(' ');
    expect(all).not.toMatch(/helium|neon|argon|krypton|carbon|hydrogen|noble/i);
  });
});

describe('generator: pinned make_atom is code-written', () => {
  it('routes every item to make_atom with a code ask and no model call', async () => {
    const { generateAtomBuilder } = await import('../../../service/chemistry/gemini-atom-builder');
    for (const grade of ['4', '7']) {
      const data = await generateAtomBuilder({
        componentId: 'atom-builder', instanceId: 'ab', topic: 'Atoms', grade, gradeLevel: 'elementary', gradeContext: `Grade ${grade}`,
        intent: 'Make atoms', objective: {}, scope: { topic: 'Atoms', intent: 'Make atoms' }, targetEvalMode: 'make_atom',
        raw: { targetEvalMode: 'make_atom' },
      } as unknown as Parameters<typeof generateAtomBuilder>[0]);
      expect(data.gradeBand).toBe(grade === '4' ? '3-5' : '6-8');
      expect(data.challenges.every(c => c.type === 'make_atom' && c.ask && c.instruction === atomAskInstruction(c.ask))).toBe(true);
      expect(data.challenges.every(c => c.targetProtons === null && c.targetNeutrons === null && c.targetElectrons === null)).toBe(true);
      expect(data.showOptions.showCharge || data.showOptions.showMassNumber).toBe(false);
    }
  });
});
