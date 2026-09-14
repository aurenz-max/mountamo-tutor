import { afterEach, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateWithLearningObservations } from './learningObservationServer';
import { withGenerationRequest } from './generationRequest';
import { getComponentById } from '../manifest/catalog';
import { certifyPlaceValueItems, placeValueContentIdentity } from '../math/placeValueOpportunityContract';
import { selectPlaceValueContrast } from '../math/placeValueRemediation';
import type { PlaceValueChartData } from '../../primitives/visual-primitives/math/PlaceValueChart';

// The retest consumer exactly as the catalog declares it; the server names no primitive.
const consumer = getComponentById('place-value-chart')!.learningObservations!;
const focus = 'The student gives the bare digit for its worth regardless of position.';
const baseline: PlaceValueChartData = { title: 'Place value', description: 'Say it.', challengeType: 'compare', supportTier: 'medium',
  challenges: [2345, 6789, 7526].map((n, i) => ({ id: `pvc-${i + 1}`, targetNumber: n,
    highlightedDigitPlace: 1, minPlace: 0, maxPlace: 3, placeNameChoices: [], digitValueChoices: [] })) };
const targeted = (): PlaceValueChartData => ({ ...baseline, learningAdaptation: { move: 'contrast_digit_worth' as const, comparisonCount: 2, status: 'targeted' as const }, challenges: [...selectPlaceValueContrast(baseline.challenges, 'contrast_digit_worth').challenges] });
const scope = { subject: 'MATHEMATICS', grade: '4', skill_id: 'S', subskill_id: 'SS', curriculum_version: 'synthetic-v1' };
const item = { componentId: 'place-value-chart', instanceId: 'instance', topic: 'Place value in four-digit whole numbers', config: {
  objectiveSubject: 'MATHEMATICS', skillId: 'S', subskillId: 'SS', objectiveGrade: '4', targetEvalMode: 'compare', difficulty: 'medium',
  remediationFocus: 'client-forged focus',
} };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function signedBackend() {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', 'synthetic-test-secret-never-for-production');
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const path = new URL(url).pathname;
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer synthetic');
    expect(headers['x-lumina-signature']).toBe(createHmac('sha256', process.env.LUMINA_GENERATION_SIGNING_KEY!)
      .update(`${path}\n${headers['x-lumina-time']}\nBearer synthetic\n${options.body}`).digest('hex'));
    requests.push({ path, body: JSON.parse(options.body as string) });
    return { ok: true, json: async () => path.endsWith('-context')
      ? { available: true, hypothesis_id: 'h', revision: 4, focus, scope }
      : { opportunity_set_id: 'receipt' } };
  }));
  return requests;
}

it('reads its own hypothesis through the primitive-keyed context, certifies surviving compiler items and returns only a public reference', async () => {
  const requests = signedBackend();
  const result = await withGenerationRequest('Bearer synthetic', () => generateWithLearningObservations(item, consumer, async config => {
    expect(config.learningObservations).toEqual([{ id: 'h', summary: focus }]);
    expect(config.remediationFocus).toBeUndefined();
    return { data: targeted() };
  }));
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual({ path: '/api/student-profile/misconception-opportunity-context',
    body: { primitive_type: 'place-value-chart', scope: { subject: 'MATHEMATICS', grade: '4', skill_id: 'S', subskill_id: 'SS' } } });
  const plan = requests[1].body;
  expect(plan).toMatchObject({ primitive_type: 'place-value-chart', hypothesis_id: 'h', revision: 4, scope, instance_id: 'instance',
    capability_id: 'digit_face_value_for_worth', capability_version: 1, policy_version: 'place-value-immediate-retest-v1',
    compiler_version: 'place-value-items-v1', mode: 'compare', tier: 'medium' });
  expect(plan.content_hash).toMatch(/^[0-9a-f]{64}$/);
  expect((plan.items as { eligible: boolean }[]).filter(i => i.eligible)).toHaveLength(2);
  expect(result.data.misconceptionOpportunity).toMatchObject({ id: 'receipt', grade: '4', curriculumVersion: 'synthetic-v1' });
  expect(result.data.learningAdaptation?.source).toBe('saved-observation');
  expect(JSON.stringify(result)).not.toMatch(/hypothesis|revision|answer_text|eligible|bare digit|client-forged/);
});

it('no-op generation with matching focus still has no certification (revert non-vacuity)', async () => {
  const requests = signedBackend();
  expect(certifyPlaceValueItems(baseline, focus)).toBeNull();
  const result = await withGenerationRequest('Bearer synthetic', () => generateWithLearningObservations(item, consumer, async () => ({ data: baseline })));
  expect(requests).toHaveLength(1);
  expect(result.data.misconceptionOpportunity).toBeUndefined();
});

it.each(['build', 'unrelated', 'saturated', 'objective', 'compiler-drop'])('rejects %s content', async reason => {
  const requests = signedBackend();
  const data = targeted();
  const requestItem = structuredClone(item);
  if (reason === 'build') data.challengeType = 'build';
  if (reason === 'unrelated') expect(certifyPlaceValueItems(data, 'The student shifts worth.')).toBeNull();
  if (reason === 'saturated') data.challenges = data.challenges.slice(0, 1);
  if (reason === 'objective') Object.assign(requestItem.config, { objectiveText: 'Worth in three-digit numbers' });
  if (reason === 'compiler-drop') data.challenges = [data.challenges[0], data.challenges[2]]; // second target now dictation
  if (reason === 'unrelated') return;
  const result = await withGenerationRequest('Bearer synthetic', () => generateWithLearningObservations(requestItem, consumer, async () => ({ data })));
  expect(requests).toHaveLength(1);
  expect(result.data.misconceptionOpportunity).toBeUndefined();
});

it('missing server authentication or backend outage preserves ordinary generation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const generate = vi.fn(async () => ({ data: targeted() }));
  const result = await generateWithLearningObservations(item, consumer, generate);
  expect(result.data.misconceptionOpportunity).toBeUndefined();
  expect(generate).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv('LUMINA_GENERATION_SIGNING_KEY', 'synthetic-test-secret-never-for-production');
  await withGenerationRequest('Bearer synthetic', () => generateWithLearningObservations(item, consumer, generate));
  expect(generate).toHaveBeenCalledTimes(2);
});

it('hash projection ignores injected attribution but detects changed numbers and item order', () => {
  const data = targeted();
  expect(placeValueContentIdentity({ ...data, instanceId: 'mounted', skillId: 'S' })).toBe(placeValueContentIdentity(data));
  const changed = structuredClone(data);
  changed.challenges[0].targetNumber++;
  expect(placeValueContentIdentity(changed)).not.toBe(placeValueContentIdentity(data));
  expect(placeValueContentIdentity({ ...data, challenges: [...data.challenges].reverse() })).not.toBe(placeValueContentIdentity(data));
});

it('rejects the saved real saturated draw after recompiling its duplicate worth', () => {
  const saved = JSON.parse(readFileSync('qa/misconception/place-value-opportunities/2026-09-12T20-53-11-606Z/targeted-2.json', 'utf8'));
  expect(saved.output.data.challenges.map((c: { targetNumber: number }) => c.targetNumber)).toEqual([4375, 3172, 1302]);
  expect(certifyPlaceValueItems(saved.output.data, focus)).toBeNull();
  expect(selectPlaceValueContrast(saved.output.data.challenges, 'contrast_digit_worth').reason).toBe('saturated');
});

it('recompiles the real positive draw used by the backend submission integration', () => {
  const saved = JSON.parse(readFileSync('qa/misconception/place-value-opportunities/2026-09-12T20-53-11-606Z/targeted-1.json', 'utf8'));
  // The saved artifact predates accepted_answers; the compiler now certifies them.
  expect(certifyPlaceValueItems(saved.output.data, focus)).toEqual(saved.candidateItems.map((i: { kind: string; answer_text: string; digit: number; place: number }) =>
    ({ ...i, accepted_answers: i.kind === 'say_value' ? [i.answer_text, String(i.digit * 10 ** i.place)] : [i.answer_text] })));
  expect(saved.candidateItems.filter((i: { eligible: boolean }) => i.eligible)).toHaveLength(2);
});
