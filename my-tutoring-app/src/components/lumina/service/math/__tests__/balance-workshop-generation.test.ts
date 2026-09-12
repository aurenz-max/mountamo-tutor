import { describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../../generation/generationContext';
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../../geminiClient', () => ({ ai: { models: { generateContent } } }));
import { generateBalanceScale } from '../gemini-balance-scale';
import { MATH_CATALOG } from '../../manifest/catalog/math';
import { resolvePrimitiveAudioInput } from '../../../hooks/primitiveAudioInput';
import { STAGES, usesBalanceWorkshop, WORKSHOP_MODES, workshopProblem } from '../../../primitives/visual-primitives/math/balanceWorkshopModel';
import { workshopItems } from '../../../primitives/visual-primitives/math/balanceWorkshopScript';

describe('workshop generation, curriculum mode and audio routing', () => {
  for (const mode of WORKSHOP_MODES) it.each(['easy', 'medium', 'hard'])(`${mode} at %s`, async (difficulty) => {
    // Deliberately return a conflicting wrapper type: the explicit mode must win.
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Solve x', description: 'Type an answer.', challengeType: 'equality' }) });
    const data = await generateBalanceScale({ componentId: 'balance-scale', instanceId: 'test', topic: 'Build with weights',
      grade: '4', gradeLevel: 'elementary', gradeContext: 'Grade 4', objective: {}, scope: {} as GenerationContext['scope'],
      raw: { targetEvalMode: mode, difficulty, instanceCount: 3 } });
    expect(usesBalanceWorkshop(data)).toBe(true);
    const problems = data.challenges!.map(workshopProblem);
    expect(problems).toHaveLength(3);
    expect(problems.every((problem) => problem.mode === mode)).toBe(true);
    expect(workshopItems(problems)).toHaveLength(STAGES[mode].length * 3);
    expect(data.showTilt).toBe(true); expect(data.showSideValues).toBe(false);
    expect(data.title).not.toContain('Solve x'); expect(data.description).not.toContain('Type');
    if (mode === 'equality_hard') expect(problems.every((p) => p.target >= 2)).toBe(true);
    if (mode === 'one_step') expect(problems.every((p) => p.known > 0)).toBe(true);
    if (mode === 'two_step') expect(problems.map((p) => p.reverse)).toEqual([false, true, false]);
    const definition = MATH_CATALOG.find((entry) => entry.id === 'balance-scale')!;
    expect(definition.evalModes!.find((entry) => entry.evalMode === mode)?.affordances?.answers).toContain('spoken');
    expect(resolvePrimitiveAudioInput(definition, data)).toEqual({ manual_activity: true });
  });
  it('keeps unsupported mixed payloads off the homogeneous workshop audio path', () => {
    const definition = MATH_CATALOG.find((entry) => entry.id === 'balance-scale')!;
    const data = { challenges: [{ type: 'one_step' }, { type: 'two_step' }] };
    expect(resolvePrimitiveAudioInput(definition, data)).toBeUndefined();
  });
});
