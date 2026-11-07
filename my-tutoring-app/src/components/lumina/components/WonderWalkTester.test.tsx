// @vitest-environment jsdom
/**
 * The Wonder Walk tester end to end with the API mocked (free): Generate posts the tester's config, the reviewer
 * panel shows the key and the traps, and the offline workspace plays the walk with real taps.
 */
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'test-token' } } }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({ available: false }) } }));
vi.mock('../contexts/StudentContext', () => ({ useStudent: () => ({ studentId: '123', ready: true, isAnonymous: false }) }));
vi.mock('@/contexts/LuminaAIContext', async () => ({
  ...(await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam(),
  LuminaAIProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import WonderWalkTester from './WonderWalkTester';

const payload = JSON.parse(readFileSync(join(__dirname, 'live-activity/runtime/testing/w1-payloads/wonder-walk.which-one.json'), 'utf8'));
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ type: 'wonder-walk', data: { ...payload.data, agentDebug: { turns: 3, seconds: 21.4, toolCalls: [{ turn: 1, name: 'write_stop', ok: false, note: 'stop 1 blocked' }], review: [{ stop: 1, pick: 'ball', alsoFits: [], note: '' }], advisories: ['check these words are known at K: yard'] } } }) }));

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('generates with the tester config, shows the reviewer view, and plays offline', async () => {
  const view = render(<WonderWalkTester onBack={() => {}} />);
  fireEvent.click(view.getByRole('button', { name: 'What plants need to grow' }));
  fireEvent.click(view.getByLabelText(/Scene images/));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Generate walk' })); });

  const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
  expect(body.params).toMatchObject({ componentId: 'wonder-walk', topic: 'What plants need to grow', gradeLevel: 'kindergarten', config: { images: false } });

  await waitFor(() => expect(view.getByText('Alive or Not?')).toBeTruthy());
  // Reviewer view: trace numbers, the failed tool call, the solve, an advisory, and every stop's key.
  expect(view.container.textContent).toContain('1/1');
  expect(view.container.textContent).toContain('stop 1 blocked');
  expect(view.container.textContent).toContain('known at K: yard');
  expect(view.getAllByText(/✓ key/)).toHaveLength(payload.data.challenges.length);

  // The child's view: the first stop's pictures, playable offline; a right tap is accepted.
  const first = payload.data.challenges[0];
  const right = view.container.querySelector(`[data-pip-object="option-${first.correctOptionId}"]`) as HTMLButtonElement;
  await waitFor(() => expect(right).toBeTruthy());
  expect(view.container.querySelectorAll('[data-pip-object^="option-"]')).toHaveLength(first.options.length);
  expect(right.disabled).toBe(false);
  await act(async () => { fireEvent.click(right); });
  expect(right.disabled).toBe(true);
});
