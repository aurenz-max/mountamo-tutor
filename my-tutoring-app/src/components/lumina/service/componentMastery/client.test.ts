import { afterEach, describe, expect, it, vi } from 'vitest';
import { componentEvidenceFor } from './client';

const TALLIES = [{ kind: 'letter_sound', units: [{ unit: 'ship', attempts: 1, correct: 1 }] }];
afterEach(() => { vi.unstubAllGlobals(); });

describe('componentEvidenceFor', () => {
  it('posts the tallies and returns the route\'s evidence', async () => {
    const evidence = [{ kind: 'letter_sound', id: 'sh/SH', attempts: 1, correct: 1 }];
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ evidence }) }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await componentEvidenceFor(TALLIES)).toEqual(evidence);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toBe('/api/lumina/component-evidence');
    expect(JSON.parse(init.body)).toEqual({ tallies: TALLIES });
  });

  it('makes no call without tallies, and gives nothing on an error or a bad reply', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchMock);
    expect(await componentEvidenceFor(undefined)).toEqual([]);
    expect(await componentEvidenceFor([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await componentEvidenceFor(TALLIES)).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await componentEvidenceFor(TALLIES)).toEqual([]);
  });
});
