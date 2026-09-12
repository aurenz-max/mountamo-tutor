import { describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../../generation/generationContext';
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../../geminiClient', () => ({ ai: { models: { generateContent } } }));
import { generateBalanceScale } from '../gemini-balance-scale';
import { equalityProblem, usesEqualityPilot } from '../../../primitives/visual-primitives/math/balanceEqualityModel';
import { equalityItems } from '../../../primitives/visual-primitives/math/balanceEqualityScript';
import { MATH_CATALOG } from '../../manifest/catalog/math';
import { resolvePrimitiveAudioInput } from '../../../hooks/primitiveAudioInput';

const context = (raw: Record<string, unknown>): GenerationContext => ({
  componentId: 'balance-scale', instanceId: 'test', topic: 'Changing both sides of a balance scale',
  grade: '2', gradeLevel: 'elementary', gradeContext: 'Grade 2', objective: {},
  scope: {} as GenerationContext['scope'], raw,
});

describe('equality pilot generation and routing', () => {
  it.each(['easy', 'medium', 'hard'])('keeps real balance feedback and private bag contents at %s', async (difficulty) => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Keep It Balanced', description: 'Explore equality.', challengeType: 'equality' }) });
    const data = await generateBalanceScale(context({ targetEvalMode: 'equality', difficulty }));
    expect(data.showSideValues).toBe(false);
    expect(data.showTilt).toBe(true);
    expect(data.showBalanceStatus).toBe(difficulty === 'easy');
    expect(usesEqualityPilot(data)).toBe(true);
    const problems = data.challenges!.map(equalityProblem);
    expect(problems.length).toBe(5);
    expect(equalityItems(problems)).toHaveLength(15);
    expect(resolvePrimitiveAudioInput(MATH_CATALOG.find((entry) => entry.id === 'balance-scale'), data)).toEqual({ manual_activity: true });
  });
  it('honors an equality pin even if the wrapper model emits a different valid type', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Balance', description: 'Explore.', challengeType: 'two_step' }) });
    const data = await generateBalanceScale(context({ targetEvalMode: 'equality', instanceCount: 3 }));
    expect(usesEqualityPilot(data)).toBe(true);
    expect(data.challenges).toHaveLength(3);
  });
  it('routes the hard equality mode through matching weights and manual DI audio', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Balance', description: 'Explore.', challengeType: 'equality_hard' }) });
    const data = await generateBalanceScale(context({ targetEvalMode: 'equality_hard', difficulty: 'hard' }));
    expect(usesEqualityPilot(data)).toBe(true);
    expect(data.showTilt).toBe(true);
    expect(data.showSideValues).toBe(false);
    expect(data.title).toBe('Make It Another Way');
    expect(data.challenges!.map(equalityProblem).every((problem) => problem.mode === 'equality_hard')).toBe(true);
    expect(data.challenges!.every((challenge) => !challenge.instruction.includes('mystery'))).toBe(true);
    expect(resolvePrimitiveAudioInput(MATH_CATALOG.find((entry) => entry.id === 'balance-scale'), data)).toEqual({ manual_activity: true });
  });
  it('routes the redesigned one-step mode to manual audio with a live scale', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Solve', description: 'Explore.', challengeType: 'one_step' }) });
    const data = await generateBalanceScale(context({ targetEvalMode: 'one_step', difficulty: 'hard' }));
    expect(usesEqualityPilot(data)).toBe(false);
    expect(data.showTilt).toBe(true);
    expect(resolvePrimitiveAudioInput(MATH_CATALOG.find((entry) => entry.id === 'balance-scale'), data)).toEqual({ manual_activity: true });
  });
});
