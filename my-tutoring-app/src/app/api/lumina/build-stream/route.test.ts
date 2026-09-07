import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { build, judge } = vi.hoisted(() => ({ build: vi.fn(), judge: vi.fn() }));
vi.mock('@/components/lumina/service/geminiService', () => ({
  buildCompleteExhibitFromManifest: build,
}));
vi.mock('@/components/lumina/service/manifest/gemini-manifest', () => ({}));
vi.mock('@/components/lumina/service/curator-brief/gemini-curator-brief', () => ({}));
vi.mock('@/components/lumina/service/knowledge-check/gemini-knowledge-check', () => ({}));
vi.mock('@/components/lumina/service/scratch-pad/gemini-scratch-pad', () => ({}));
vi.mock('@/components/lumina/service/qa/lessonCoverage/shadow', () => ({
  runLessonCoverageShadowEval: judge,
}));
vi.mock('@/components/lumina/service/qa/lessonCoverage/evaluateLessonCoverage', () => ({
  evaluateLessonCoverage: judge,
}));
import { POST as streamPost } from './route';
import { POST as apiPost } from '../route';

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
const request = (body: unknown) => new NextRequest('http://localhost/api/lumina', {
  method: 'POST', body: JSON.stringify(body),
});

it('delivers streamed components and the exhibit without a judge, even with the old flag enabled', async () => {
  vi.stubEnv('LUMINA_COVERAGE_EVAL', '1');
  const exhibit = { orderedComponents: [{ instanceId: 'one' }] };
  build.mockImplementationOnce(async (_manifest, _brief, onComplete) => {
    await onComplete('one', 'ten-frame', 0, 1);
    return exhibit;
  });
  const response = await streamPost(request({ manifest: {}, curatorBrief: {} }));
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  expect(events).toEqual([
    { type: 'component-complete', instanceId: 'one', componentId: 'ten-frame', index: 0, total: 1 },
    { type: 'exhibit-complete', exhibit },
  ]);
  expect(judge).not.toHaveBeenCalled();
});

it('delivers the non-streaming exhibit without a judge', async () => {
  vi.stubEnv('LUMINA_COVERAGE_EVAL', '1');
  const exhibit = { orderedComponents: [{ instanceId: 'one' }] };
  build.mockResolvedValueOnce(exhibit);
  const response = await apiPost(request({ action: 'buildCompleteExhibitFromManifest', params: { manifest: {}, curatorBrief: {} } }));
  expect(await response.json()).toEqual(exhibit);
  expect(judge).not.toHaveBeenCalled();
});

it('returns Gone for the retired evaluation action without invoking the judge', async () => {
  const response = await apiPost(request({ action: 'evaluateLessonCoverage', params: {} }));
  expect(response.status).toBe(410);
  expect(judge).not.toHaveBeenCalled();
});
