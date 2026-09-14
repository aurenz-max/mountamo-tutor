// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSpeechScope } from './useSpeechScope';

describe('useSpeechScope', () => {
  it('belongs to the scope where speech started, not the scope it runs into', () => {
    const { result, rerender } = renderHook(({ scope, speaking }) => useSpeechScope(scope, speaking),
      { initialProps: { scope: 'a', speaking: false } });
    expect(result.current).toBe(false);
    rerender({ scope: 'a', speaking: true });
    expect(result.current).toBe(true);
    rerender({ scope: 'b', speaking: true });
    expect(result.current).toBe(false);
    rerender({ scope: 'b', speaking: false });
    rerender({ scope: 'b', speaking: true });
    expect(result.current).toBe(true);
  });
});
