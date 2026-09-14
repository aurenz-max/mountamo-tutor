import { afterEach, expect, it, vi } from 'vitest';
import { generateWithLearningObservations } from './learningObservationServer';
import { withGenerationRequest } from './generationRequest';
import { TEST_SIGNING_KEY, signedObservation, signedPacket } from './learningObservationPacket.fixtures';

const scope = { subject: 'MATHEMATICS', grade: '3', skillId: 'NF001-03', subskillId: 'NF001-03-b' };
const { signed, delivered } = signedObservation({ primitiveType: 'fraction-bar', scope,
  summary: 'Chooses the bottom number when asked for the shaded count.', evidence: { problem: 'Bars', evalMode: 'build', phases: [] } });
const item = { componentId: 'fraction-bar', instanceId: 'bar', config: { objectiveSubject: 'MATHEMATICS', objectiveGrade: '3',
  skillId: 'NF001-03', subskillId: 'NF001-03-b', targetEvalMode: 'build', difficulty: 'medium' } };
const consumer = { eligible: (config: Record<string, unknown>) => config.targetEvalMode === 'build' };
const generate = vi.fn(async (_config: Record<string, unknown>) => ({ data: { title: 'Bar',
  learningAdaptation: { move: 'contrast_shared_digit_roles', status: 'targeted', comparisonCount: 2, source: 'saved-observation' } as { source?: string } } }));
const keyed = () => vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', TEST_SIGNING_KEY);
const run = (request: Parameters<typeof withGenerationRequest>[0], target: { componentId: string; instanceId: string; config?: Record<string, unknown> } = item) =>
  withGenerationRequest(request, () => generateWithLearningObservations(target, consumer, generate));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('delivers the packet observations at the task scope, with no backend call, and stamps the verified origin', async () => {
  keyed();
  vi.stubGlobal('fetch', vi.fn());
  const result = await run({ authorization: 'Bearer owner', learningObservations: signed });
  expect(fetch).not.toHaveBeenCalled();
  expect(generate).toHaveBeenCalledWith({ ...item.config, learningObservations: [delivered] });
  expect(result.data.learningAdaptation.source).toBe('saved-observation');
  expect(JSON.stringify(result)).not.toContain(delivered.summary);
});

it('the packet is the credential: a learner token without one, or a packet under another key, delivers nothing', async () => {
  keyed();
  await run({ authorization: 'Bearer owner' });
  await run({ authorization: 'Bearer owner', learningObservations: { ...signed, payload: signed.payload.replace('bottom', 'top') } });
  await run({ authorization: 'Bearer owner', learningObservations: signedObservation({ primitiveType: 'fraction-bar', scope, summary: 'x' }, 'another-synthetic-secret-never-for-production').signed });
  await run('Bearer owner');
  await run(null);
  expect(generate.mock.calls.every(([config]) => !config.learningObservations)).toBe(true);
  expect(generate.mock.results.every(r => r.value.then((v: { data: { learningAdaptation: { source?: string } } }) => v.data.learningAdaptation.source === undefined))).toBe(true);
  vi.unstubAllEnvs();
  await run({ authorization: 'Bearer owner', learningObservations: signed });
  expect(generate.mock.calls.every(([config]) => !config.learningObservations)).toBe(true);
});

it('takes the subject from the objective scope in config, never from an assumption', async () => {
  keyed();
  const literacyScope = { subject: 'LANGUAGE_ARTS', grade: '3', skillId: 'RV001-02', subskillId: 'RV001-02-a' };
  const literacy = signedObservation({ primitiveType: 'picture-vocabulary', scope: literacyScope, summary: 'Reads the picture, not the word.' });
  const literacyItem = { ...item, componentId: 'picture-vocabulary', config: { ...item.config, objectiveSubject: 'LANGUAGE_ARTS', skillId: 'RV001-02', subskillId: 'RV001-02-a' } };
  await run({ authorization: 'Bearer owner', learningObservations: literacy.signed }, literacyItem);
  expect(generate).toHaveBeenLastCalledWith({ ...literacyItem.config, learningObservations: [literacy.delivered] });
  await run({ authorization: 'Bearer owner', learningObservations: literacy.signed }, { ...literacyItem, config: { ...literacyItem.config, objectiveSubject: 'MATHEMATICS' } });
  expect(generate.mock.calls.at(-1)![0].learningObservations).toBeUndefined();
});

it('never forwards client-supplied observations, a client focus, or a generator-stamped origin', async () => {
  keyed();
  const forged = { ...item, config: { ...item.config, learningObservations: [delivered], remediationFocus: 'client text' } };
  const result = await run({ authorization: 'Bearer owner' }, forged);
  expect(generate).toHaveBeenCalledWith(item.config);
  expect(result.data.learningAdaptation.source).toBeUndefined();
  const empty = signedPacket([]).signed;
  const stamped = await run({ authorization: 'Bearer owner', learningObservations: empty }, forged);
  expect(stamped.data.learningAdaptation.source).toBeUndefined();
});

it('skips delivery for ineligible tasks or an incomplete scope', async () => {
  keyed();
  for (const patch of [{ targetEvalMode: 'identify' }, { subskillId: undefined }, { objectiveGrade: '' }, { objectiveSubject: undefined }]) {
    await run({ authorization: 'Bearer owner', learningObservations: signed }, { ...item, config: { ...item.config, ...patch } });
  }
  expect(generate.mock.calls.every(([config]) => !config.learningObservations)).toBe(true);
});
