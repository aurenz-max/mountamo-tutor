import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateRampLab } from './gemini-ramp-lab';
const generated = vi.mocked(ai.models.generateContent);
function ctx(mode: string, grade = '3'): GenerationContext {
  return { componentId: 'ramp-lab', instanceId: 'test', topic: 'Ramp investigations', gradeLevel: grade,
    gradeContext: `Grade ${grade}`, grade, intent: 'Investigate how surface friction affects push',
    objective: { text: 'Investigate how surface friction affects push' }, scope: { topic: 'Ramp investigations' },
    targetEvalMode: mode, raw: { challengeCount: 5 }, supportTier: 'hard' } as GenerationContext;
}
beforeEach(() => {
  generated.mockReset();
  generated.mockResolvedValue({ text: JSON.stringify({ title: 'The smooth ramp needs less push', description: 'The smooth ramp is easier.', investigationVariable: 'surface',
    rampLength: 10, rampAngle: 25, loadWeight: 4, loadType: 'box', frictionLevel: 'low', theme: 'generic', adjustableAngle: true, showMeasurements: true }) } as never);
});
describe('Ramp Lab generation and routing', () => {
  it.each(['plan_fair_test', 'explain_from_trials'])('pins %s without a resolver call and honors the variable and requested count', async mode => {
    const data = await generateRampLab(ctx(mode));
    expect(generated).toHaveBeenCalledTimes(1);
    expect(data.challenges).toHaveLength(5);
    expect(data.challenges!.every(ch => ch.mode === mode && 'variable' in ch && ch.variable === 'surface')).toBe(true);
    expect(new Set(data.challenges!.map(ch => ch.id)).size).toBe(5);
    expect(data.title).not.toContain('less push'); expect(data.description).not.toContain('easier');
    expect(data.supportTier).toBe('hard');
  });
  it('covers all five identities in mixed and suppresses one-mode tier assumptions', async () => {
    const data = await generateRampLab(ctx('mixed'));
    expect(new Set(data.challenges!.map(ch => ch.mode)).size).toBe(5);
    expect(data.supportTier).toBeUndefined();
  });
  it('round-robins a curated blend', async () => {
    const data = await generateRampLab(ctx('plan_fair_test|explain_from_trials'));
    expect(data.challenges!.map(ch => ch.mode)).toEqual(['plan_fair_test', 'explain_from_trials', 'plan_fair_test', 'explain_from_trials', 'plan_fair_test']);
  });
  it('keeps new investigation modes out of younger mixed sessions', async () => {
    const data = await generateRampLab(ctx('mixed', 'K'));
    expect(data.challenges!.some(ch => ch.mode === 'plan_fair_test' || ch.mode === 'explain_from_trials')).toBe(false);
    await expect(generateRampLab(ctx('plan_fair_test', '2'))).rejects.toThrow('Grade 3');
  });
});
