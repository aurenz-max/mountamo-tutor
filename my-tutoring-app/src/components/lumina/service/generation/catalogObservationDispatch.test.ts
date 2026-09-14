import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateComponentContent } from '../geminiService';
import { withGenerationRequest } from './generationRequest';
import { UNIVERSAL_CATALOG } from '../manifest/catalog';
import { compiledSharedDigitRoleContrast } from '../math/fractionBarRemediation';
import type { FractionBarData } from '../../primitives/visual-primitives/math/FractionBar';

// fraction-bar had its own `componentId ===` branch in the generation service; it is
// now reached only through its catalog declaration, like every other consumer.
const observation = { id: 'observation-9f0a', summary: 'The student swaps the roles of the two numbers in a fraction, choosing the bottom number as the shaded count.' };
const item = { componentId: 'fraction-bar', instanceId: 'bar', title: 'Bars', intent: 'Build fractions on a bar', config: {
  objectiveSubject: 'MATHEMATICS', objectiveGrade: '3', skillId: 'NF001-03', subskillId: 'NF001-03-b', targetEvalMode: 'build', difficulty: 'medium' } };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });
function stubEngines(move: string) {
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', 'synthetic-test-secret-never-for-production');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true, observations: [observation] }) }));
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(String(args.contents).startsWith('Select ONE')
    ? { move, observationIds: [observation.id] }
    : { title: 'Building Fractions on a Bar', description: 'Shade parts to build each fraction.', challengeType: 'build' }) }) as never);
}
const run = async (patch: Record<string, unknown> = {}, authorization: string | null = 'Bearer owner') =>
  (await withGenerationRequest(authorization, () => generateComponentContent({ ...item, config: { ...item.config, ...patch } } as never,
    'Building fractions on a bar', 'Grade 3')) as { data: FractionBarData }).data;

it('dispatches on the catalog declaration: fraction-bar reads its objective scope and shapes the bars', async () => {
  stubEngines('contrast_shared_digit_roles');
  let seed = 7;
  vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  const data = await run();
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/student-profile/learning-observation-context');
  expect(JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body)))
    .toEqual({ scope: { subject: 'MATHEMATICS', grade: '3', skill_id: 'NF001-03', subskill_id: 'NF001-03-b' } });
  expect(data.learningAdaptation).toMatchObject({ move: 'contrast_shared_digit_roles', comparisonCount: 2, source: 'saved-observation' });
  expect(['targeted', 'already-targeted']).toContain(data.learningAdaptation!.status);
  expect(compiledSharedDigitRoleContrast(data.challenges).count).toBe(2);
  expect(JSON.stringify(data)).not.toContain(observation.summary);
});

it('a declared consumer is a server-delivered skill-scoped source, and ineligible or anonymous tasks never read', async () => {
  const consumers = UNIVERSAL_CATALOG.filter(c => c.learningObservations);
  expect(consumers.map(c => c.id)).toContain('fraction-bar');
  for (const c of consumers) expect([c.id, c.observationDelivery, c.misconceptionScope]).toEqual([c.id, 'server', 'skill']);
  stubEngines('contrast_shared_digit_roles');
  expect((await run({ targetEvalMode: 'identify' })).learningAdaptation).toBeUndefined();
  expect((await run({}, null)).learningAdaptation).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
