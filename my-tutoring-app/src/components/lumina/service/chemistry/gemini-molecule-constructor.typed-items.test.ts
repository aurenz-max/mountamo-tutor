/**
 * molecule-constructor identify / formula_write items show a drawn molecule and take its name or formula, so the
 * generator replaces an instruction or hint that states the key (EVAL_TRACKER MC-1/MOLC-1). Other items keep their words.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import { generateMoleculeConstructor } from './gemini-molecule-constructor';
import type { GenerationContext } from '../generation/generationContext';

const ch = (id: string, type: string, instruction: string, targetFormula: string, targetName: string, hint = '') =>
  ({ id, type, instruction, targetFormula, targetName, targetAtoms: [], hint, narration: '' });

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue({ text: JSON.stringify({
    title: 'Molecules', description: 'Build molecules.', gradeBand: '6-8',
    challenges: [
      ch('c1', 'identify', 'Name this molecule. Hint: it is methane!', 'CH4', 'Methane', 'Methane is natural gas.'),
      ch('c2', 'formula_write', 'Write the formula for water, H₂O.', 'H2O', 'Water', 'It is H2O.'),
      ch('c3', 'identify', 'Name the molecule drawn on the canvas.', 'NH3', 'Ammonia', 'It smells sharp.'),
      ch('c4', 'build_target', 'Build water (H2O).', 'H2O', 'Water', 'Oxygen makes two bonds.'),
      ch('c5', 'formula_write', 'Write the formula for sulfuric acid, which has two hydrogens, one sulfur and four oxygens.',
        'H2SO4', 'Sulfuric Acid', 'There are four oxygen atoms.'),
    ],
  }) });
});

const ctx = { componentId: 'molecule-constructor', instanceId: 'mc', topic: 'molecules', gradeLevel: 'middle school',
  gradeContext: 'grade 7 students', grade: '7', raw: {} } as unknown as GenerationContext;

describe('typed items never state their key', () => {
  it('replaces a key-stating instruction or hint, and keeps every other word', async () => {
    const data = await generateMoleculeConstructor(ctx);
    const [name, write, plain, build, counts] = data.challenges;
    // A formula_write instruction that spells out the atom counts states the formula without its letters.
    expect(counts).toMatchObject({ instruction: 'Write the formula for this molecule.', hint: 'Count the atoms of each element in the drawing.' });
    expect(name).toMatchObject({ instruction: 'Name this molecule.', hint: 'Count the atoms of each element in the drawing.' });
    expect(write).toMatchObject({ instruction: 'Write the formula for this molecule.', hint: 'Count the atoms of each element in the drawing.' });
    expect(plain).toMatchObject({ instruction: 'Name the molecule drawn on the canvas.', hint: 'It smells sharp.' });
    expect(build).toMatchObject({ instruction: 'Build water (H2O).', hint: 'Oxygen makes two bonds.' });
    expect(write.targetAtoms).toEqual([{ element: 'H', count: 2 }, { element: 'O', count: 1 }]);
  });
});
