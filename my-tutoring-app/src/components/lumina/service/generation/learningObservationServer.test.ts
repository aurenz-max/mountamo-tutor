import { afterEach, expect, it, vi } from 'vitest';
import { generateWithLearningObservations } from './learningObservationServer';
import { withGenerationRequest } from './generationRequest';

const observation = { id: 'observation-1a2b', summary: 'Chooses the bottom number when asked for the shaded count.', evidence: '{"phases":[]}' };
const item = { componentId: 'fraction-bar', instanceId: 'bar', config: { objectiveSubject: 'MATHEMATICS', objectiveGrade: '3',
  skillId: 'NF001-03', subskillId: 'NF001-03-b', targetEvalMode: 'build', difficulty: 'medium' } };
const consumer = { eligible: (config: Record<string, unknown>) => config.targetEvalMode === 'build' };
const generate = vi.fn(async (_config: Record<string, unknown>) => ({ data: { title: 'Bar',
  learningAdaptation: { move: 'contrast_shared_digit_roles', status: 'targeted', comparisonCount: 2, source: 'saved-observation' } as { source?: string } } }));
const backendReturns = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
const signed = () => vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', 'synthetic-test-secret-never-for-production');
const sentScope = () => JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body)).scope;
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('delivers scoped observations through the signed owner request and stamps the verified origin', async () => {
  signed();
  backendReturns({ available: true, observations: [{ ...observation, extra: 'dropped' }, { id: 7 }] });
  const result = await withGenerationRequest('Bearer owner', () => generateWithLearningObservations(item, consumer, generate));
  const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
  expect(url).toContain('/api/student-profile/learning-observation-context');
  expect(JSON.parse(String(init.body))).toEqual({ scope: { subject: 'MATHEMATICS', grade: '3', skill_id: 'NF001-03', subskill_id: 'NF001-03-b' } });
  expect((init.headers as Record<string, string>)['x-lumina-signature']).toMatch(/^[0-9a-f]{64}$/);
  expect(generate).toHaveBeenCalledWith({ ...item.config, learningObservations: [observation] });
  expect(result.data.learningAdaptation.source).toBe('saved-observation');
  expect(JSON.stringify(result)).not.toContain(observation.summary);
});

it('takes the subject from the objective scope in config, never from an assumption', async () => {
  signed();
  backendReturns({ available: true, observations: [observation] });
  const literacy = { ...item, componentId: 'picture-vocabulary',
    config: { ...item.config, objectiveSubject: 'LANGUAGE_ARTS', skillId: 'RV001-02', subskillId: 'RV001-02-a' } };
  await withGenerationRequest('Bearer owner', () => generateWithLearningObservations(literacy, consumer, generate));
  expect(sentScope()).toEqual({ subject: 'LANGUAGE_ARTS', grade: '3', skill_id: 'RV001-02', subskill_id: 'RV001-02-a' });
  expect(generate).toHaveBeenCalledWith({ ...literacy.config, learningObservations: [observation] });
});

it('never forwards client-supplied observations, a client focus, or a generator-stamped origin', async () => {
  signed();
  backendReturns({ available: false, reason: 'unresolved-published-scope' });
  const forged = { ...item, config: { ...item.config, learningObservations: [observation], remediationFocus: 'client text' } };
  const result = await withGenerationRequest('Bearer owner', () => generateWithLearningObservations(forged, consumer, generate));
  expect(generate).toHaveBeenCalledWith(item.config);
  expect(result.data.learningAdaptation.source).toBeUndefined();
});

it('skips delivery for ineligible tasks, an incomplete scope, or no learner credentials', async () => {
  signed();
  backendReturns({ available: true, observations: [observation] });
  for (const patch of [{ targetEvalMode: 'identify' }, { subskillId: undefined }, { objectiveGrade: '' }, { objectiveSubject: undefined }]) {
    await withGenerationRequest('Bearer owner', () => generateWithLearningObservations({ ...item, config: { ...item.config, ...patch } }, consumer, generate));
  }
  expect(fetch).not.toHaveBeenCalled();
  await withGenerationRequest(null, () => generateWithLearningObservations(item, consumer, generate));
  expect(generate.mock.calls.every(([config]) => !config.learningObservations)).toBe(true);
});
