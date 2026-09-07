// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppChrome from './AppChrome';

const route = vi.hoisted(() => ({ pathname: '/' }));
const audio = vi.hoisted(() => ({ destroy: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, userProfile: null }) }));
vi.mock('@/lib/authApiClient', () => ({ authApi: {} }));
vi.mock('@/lib/AudioCaptureService', () => ({
  default: class {
    setCallbacks() {}
    destroy = audio.destroy;
  },
}));
vi.mock('@/components/dashboard/AICoach', () => ({ default: () => <p>Legacy tutor</p> }));
vi.mock('@/components/NavHeader', async () => {
  const { useAICoach } = await import('@/contexts/AICoachContext');
  return {
    default: function NavHeader() {
      const { connectToAI } = useAICoach();
      return <button onClick={() => void connectToAI(1, async () => 'token')}>Connect legacy coach</button>;
    },
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('route-owned application chrome', () => {
  it.each(['/', '/login', '/lumina', '/lumina/lesson'])('keeps %s free of legacy navigation and shortcuts', (pathname) => {
    route.pathname = pathname;
    render(<AppChrome><p>Page content</p></AppChrome>);
    expect(screen.getByText('Page content')).toBeTruthy();
    expect(screen.queryByText('Connect legacy coach')).toBeNull();
    // No hidden coach intercepts the browser's shortcut.
    expect(fireEvent.keyDown(document, { key: 'k', ctrlKey: true })).toBe(true);
    expect(screen.queryByText('Legacy tutor')).toBeNull();
  });

  // Test-level timeout raised to give the 8000ms findByText below headroom —
  // vitest's 5000ms default would otherwise kill the test before that wait
  // could ever resolve.
  it('preserves the coach across older routes, then removes it on entering Lumina', async () => {
    route.pathname = '/practice';
    const view = render(<AppChrome><p>Page content</p></AppChrome>);
    // First render in the suite to hit the Suspense branch: LegacyAppChrome's
    // lazy() import is cold here (later renders reuse the resolved module).
    // It transitively pulls in NavHeader + AICoachContext + GlobalAICoachToggle,
    // which measured >3s under jsdom on a loaded machine — 3000ms was still
    // marginal (observed 3007ms), not just the old 1000ms default.
    await screen.findByText('Connect legacy coach', {}, { timeout: 8000 });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByText('Legacy tutor')).toBeTruthy();

    route.pathname = '/packages/example/learn';
    view.rerender(<AppChrome><p>Package content</p></AppChrome>);
    expect(screen.getByText('Legacy tutor')).toBeTruthy();
    expect(screen.getByText('Package content')).toBeTruthy();

    route.pathname = '/lumina';
    view.rerender(<AppChrome><p>Lumina lesson</p></AppChrome>);
    expect(screen.getByText('Lumina lesson')).toBeTruthy();
    expect(screen.queryByText('Legacy tutor')).toBeNull();
    expect(fireEvent.keyDown(document, { key: 'k', ctrlKey: true })).toBe(true);

    route.pathname = '/practice';
    view.rerender(<AppChrome><p>Practice content</p></AppChrome>);
    await screen.findByText('Connect legacy coach', {}, { timeout: 3000 });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByText('Legacy tutor')).toBeTruthy();
  }, 10000);

  it('closes the old connection and prevents an in-flight retry from following the student into Lumina', async () => {
    const sockets: FakeSocket[] = [];
    class FakeSocket {
      static OPEN = 1;
      readyState = 0;
      onclose?: (event: { code: number; reason: string }) => void;
      close = vi.fn((code: number, reason: string) => this.onclose?.({ code, reason }));
      constructor() { sockets.push(this); }
    }
    vi.stubGlobal('WebSocket', FakeSocket);
    route.pathname = '/practice';
    const view = render(<AppChrome><p>Practice content</p></AppChrome>);
    // Same cold lazy-import margin as the previous test's first render.
    await screen.findByText('Connect legacy coach', {}, { timeout: 8000 });
    vi.useFakeTimers();
    fireEvent.click(screen.getByText('Connect legacy coach'));
    expect(sockets).toHaveLength(1);

    act(() => sockets[0].onclose?.({ code: 1006, reason: 'Connection lost' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    // The retry has started its own delay; clearing the first timer isn't enough.
    route.pathname = '/lumina';
    view.rerender(<AppChrome><p>Lumina lesson</p></AppChrome>);
    expect(sockets[0].close).toHaveBeenCalledWith(1000, 'Manual disconnect');
    expect(audio.destroy).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(sockets).toHaveLength(1);
  }, 10000);
});
