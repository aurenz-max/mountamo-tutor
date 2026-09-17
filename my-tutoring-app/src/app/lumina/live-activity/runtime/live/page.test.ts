import { afterEach, expect, it, vi } from 'vitest';
const navigation = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error('redirect'); }),
  notFound: vi.fn(() => { throw new Error('not-found'); }) }));
vi.mock('next/navigation', () => navigation);
import LiveRuntimeConnectedPage from './page';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('returns the previously shared demo URL to the established real-activity host', () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(() => LiveRuntimeConnectedPage()).toThrow('redirect');
  expect(navigation.redirect).toHaveBeenCalledWith('/lumina/live-activity');
});

it('keeps the development demo unavailable in production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(() => LiveRuntimeConnectedPage()).toThrow('not-found');
  expect(navigation.redirect).not.toHaveBeenCalled();
});
