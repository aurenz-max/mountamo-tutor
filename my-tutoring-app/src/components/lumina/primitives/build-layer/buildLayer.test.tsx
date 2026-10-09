// @vitest-environment jsdom
/**
 * `useBuildWatcher`: the line always describes the latest build. An empty reply (the code filter kept nothing)
 * clears the line rather than leaving one about an older build on screen (tower-stacker drive, 2026-10-08:
 * "red rectangles are stepping up" stayed under a straight column).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import * as layer from './buildLayer';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('an empty reply for the latest build clears the last line', async () => {
  vi.useFakeTimers();
  const replies = ['Ooh, red rectangles are stepping up!', ''];
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ seeing: replies.shift() }) })));
  // The picture itself needs a real canvas; the line logic does not.
  const svg = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => {} } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
  const OriginalImage = globalThis.Image;
  vi.stubGlobal('Image', class { onload: (() => void) | null = null; set src(_: string) { setTimeout(() => this.onload?.(), 0); } });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
  const request = { task: 'Build a tower', sceneNote: 'An area', numbers: 'never' as const };
  const { result, rerender } = renderHook(({ k }) => layer.useBuildWatcher({ buildKey: k, enabled: true, svg, request }), { initialProps: { k: 'a' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(layer.WATCH_DEBOUNCE_MS + 50); });
  expect(result.current).toBe('Ooh, red rectangles are stepping up!');
  rerender({ k: 'b' });
  await act(async () => { await vi.advanceTimersByTimeAsync(layer.WATCH_DEBOUNCE_MS + 50); });
  expect(result.current).toBe('');
  vi.stubGlobal('Image', OriginalImage);
});
