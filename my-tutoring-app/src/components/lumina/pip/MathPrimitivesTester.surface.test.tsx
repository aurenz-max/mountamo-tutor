// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MathPrimitivesTester from '../components/MathPrimitivesTester';

const session = vi.hoisted(() => ({
  connect: (_id: string) => {},
  disconnect: vi.fn(),
  tutorSpeaking: true,
}));

// Keep the real helper, Counting Board, surface registry, companion and actor.
// Only the network/audio session, judged runner and evaluation services are faked.
// Like the real provider, a connection is one more claim on Pip, never a gate.
vi.mock('@/contexts/LuminaAIContext', async () => {
  const React = await import('react');
  const { PipSurfaceContext } = await import('./PipSurfaceContext');
  const { PipSurfaceStore } = await import('./PipSurfaceStore');
  const Context = React.createContext({});
  return {
    LuminaAIProvider: ({ children }: { children: React.ReactNode }) => {
      const [store] = React.useState(() => new PipSurfaceStore());
      const [activeId, setActiveId] = React.useState<string | null>(null);
      const disconnect = React.useCallback(() => { session.disconnect(); setActiveId(null); }, []);
      session.connect = (id) => { setActiveId(id); store.setActive(id); };
      return <Context.Provider value={{
        isConnected: activeId !== null, activePrimitiveId: activeId,
        activePrimitiveType: activeId ? 'counting-board' : null,
        activePrimitiveData: null, isAIResponding: false, isAudioPlaying: false,
        isListening: false, sessionEnded: false, conversation: [], disconnect,
      }}><PipSurfaceContext.Provider value={store}>{children}</PipSurfaceContext.Provider></Context.Provider>;
    },
    useLuminaAIContext: () => React.useContext(Context),
    useMicLevel: () => 0,
  };
});
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => ({
    currentItem: pack.items[0], currentIndex: 0, cuedItemId: pack.items[0]?.id,
    tutorSpeaking: session.tutorSpeaking, stage: 'asking', currentSolved: false,
    canAttempt: true, running: true, preparing: false, summary: null, revealHeld: false,
    start: vi.fn(), isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
  }),
}));
vi.mock('../evaluation', () => ({
  EvaluationProvider: ({ children }: { children: React.ReactNode }) => children,
  useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }),
}));
vi.mock('../contexts/ExhibitContext', () => ({
  ExhibitProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../service/manifest/catalog', () => ({ getComponentById: () => undefined }));
vi.mock('../config/primitiveRegistry', () => ({ getPrimitive: () => undefined }));
// The catalog mock declares no workspace families, so the tester renders its own preview (TesterWorkspace passes through).
vi.mock('../components/live-activity/TesterWorkspace', () => ({ TesterWorkspace: ({ children }: any) => children, testerBinds: () => false }));

const data = {
  title: 'Count the apples', objects: { type: 'apples' }, gradeBand: 'K',
  challenges: [{ id: 'first', type: 'count_all', count: 3, targetAnswer: 3, arrangement: 'line', instruction: '', hint: '', narration: '' }],
};

beforeEach(() => {
  session.disconnect.mockClear();
  session.tutorSpeaking = true;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function generate() {
  fireEvent.click(screen.getByRole('button', { name: /Generate with AI/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Generate with AI/ }).hasAttribute('disabled')).toBe(false));
}

describe('Math helper Pip integration', () => {
  it('puts one Pip in the real board from the board’s own phase, with no tutor session', async () => {
    const { container } = render(<MathPrimitivesTester onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Counting Board/ }));
    await generate();
    const dock = container.querySelector<HTMLElement>('[data-pip-dock]')!;
    const instanceId = dock.dataset.pipDock!;
    expect(container.querySelector('[data-primitive-instance-id]')?.getAttribute('data-primitive-instance-id')).toBe(instanceId);
    expect(container.querySelectorAll('[data-pip-surface-body]')).toHaveLength(1);
    expect(dock.querySelector('[data-pip-surface-body]')?.getAttribute('data-pip-gesture')).toBe('point');

    session.tutorSpeaking = false;
    fireEvent.click(screen.getByRole('button', { name: /Raw JSON/ }));
    expect(container.querySelector('[data-pip-dock]')).toBe(dock);
    fireEvent.click(container.querySelector('[data-pip-object="object-1"]')!);
    expect(dock.querySelector('[data-pip-surface-body]')?.getAttribute('data-pip-gesture')).toBe('look');
    expect(container.textContent).toContain('Counted: 1');

    // A session that starts later changes nothing about where Pip is.
    act(() => session.connect(instanceId));
    expect(container.querySelectorAll('[data-pip-surface-body]')).toHaveLength(1);
    expect(dock.querySelector('[data-pip-surface-body]')).not.toBeNull();
  }, 15000);

  it('replaces the actor and ends the old session on regeneration or primitive selection', async () => {
    const { container } = render(<MathPrimitivesTester onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Counting Board/ }));
    await generate();
    const firstDock = container.querySelector<HTMLElement>('[data-pip-dock]')!;
    act(() => session.connect(firstDock.dataset.pipDock!));
    session.disconnect.mockClear();
    await generate();
    expect(session.disconnect).toHaveBeenCalledOnce();
    expect(firstDock.isConnected).toBe(false);
    const nextDock = container.querySelector<HTMLElement>('[data-pip-dock]')!;
    expect(nextDock.dataset.pipDock).not.toBe(firstDock.dataset.pipDock);
    expect(container.querySelectorAll('[data-pip-surface-body]')).toHaveLength(1);
    expect(nextDock.querySelector('[data-pip-surface-body]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ten Frame/ }));
    expect(session.disconnect).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-pip-surface-body]')).toBeNull();
    expect(container.querySelector('[data-pip-dock]')).toBeNull();
  }, 15000);
});
