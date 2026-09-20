'use client';

import { useEffect, useRef } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';

/**
 * Start a judged runner once, when the LIVE HOST has mounted it.
 *
 * The host mounts a primitive without the mic-panel click a learner would give
 * it, so an adopted primitive starts itself — but only when the session is
 * actually listening and this instance owns the lesson, never on a bare render.
 *
 * Shared because every judged adoption needs exactly this effect, and because the
 * session has to be read OPTIONALLY: a primitive rendered outside a
 * `LuminaAIProvider` — which is every one of its own unit and Pip-surface tests —
 * must still render, and must simply never auto-start.
 *
 * The try/catch is deliberate, and it is around a HOOK on purpose.
 * `useLuminaAIContext` calls `useContext` and only then throws, so the hook itself
 * has already run when the error is caught and the hook order is unaffected.
 * Exporting a non-throwing accessor from the context module instead would break
 * the 70-odd test files that mock that module with a partial factory — the mock
 * would be missing the new export, which is a much wider blast radius than this.
 */
export function useLiveAutoStart(autoStart: boolean, instanceId: string, start: () => void | Promise<void>) {
  let live: ReturnType<typeof useLuminaAIContext> | null = null;
  try { live = useLuminaAIContext(); } catch { live = null; }
  const started = useRef(false);
  const startRef = useRef(start); startRef.current = start;
  const connected = !!live?.isConnected, listening = !!live?.isListening;
  const mode = live?.sessionMode ?? null, active = live?.activePrimitiveId ?? null;
  useEffect(() => {
    if (!autoStart || started.current || !connected || !listening
        || (mode === 'lesson' && active !== instanceId)) return;
    started.current = true;
    void startRef.current();
  }, [autoStart, connected, listening, mode, active, instanceId]);
}
