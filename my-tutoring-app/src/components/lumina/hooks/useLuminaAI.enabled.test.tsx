// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useLuminaAI } from './useLuminaAI';

const ctx = vi.hoisted(() => ({ sessionMode: 'lesson', isConnected: true,
  lessonModeRef: { current: true }, activePrimitiveId: 'bar-test', updateContext: vi.fn(),
  switchPrimitive: vi.fn(), sendText: vi.fn(),
}));
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ctx }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it('cancels legacy tutor context updates when a spoken runner takes over', () => {
  vi.useFakeTimers();
  const { rerender } = renderHook(({ enabled, index }) => useLuminaAI({
    primitiveType: 'bar-model', instanceId: 'bar-test', enabled, primitiveData: { index },
  }), { initialProps: { enabled: true, index: 0 } });
  rerender({ enabled: true, index: 1 });
  rerender({ enabled: false, index: 2 });
  act(() => vi.advanceTimersByTime(600));
  expect(ctx.updateContext).not.toHaveBeenCalled();
  rerender({ enabled: true, index: 3 });
  act(() => vi.advanceTimersByTime(600));
  expect(ctx.updateContext).toHaveBeenCalledWith({ index: 3 });
});

it('lets explicit silent help claim focus without enabling background activation or an automatic greeting', () => {
  const { result } = renderHook(() => useLuminaAI({
    primitiveType: 'reading-repair-studio', instanceId: 'repair-test', ownsOpening: true,
    primitiveData: { supportRecorded: true },
  }));
  act(() => result.current.sendText('[ALL_COMPLETE]', { silent: true }));
  expect(ctx.switchPrimitive).not.toHaveBeenCalled();
  act(() => result.current.sendText('[READING_HELP]', { silent: true, activate: true }));
  expect(ctx.switchPrimitive).toHaveBeenCalledWith(expect.objectContaining({
    instance_id: 'repair-test', owns_opening: true, primitive_data: { supportRecorded: true },
  }));
  expect(ctx.switchPrimitive.mock.invocationCallOrder[0]).toBeLessThan(ctx.sendText.mock.invocationCallOrder[1]);
});
