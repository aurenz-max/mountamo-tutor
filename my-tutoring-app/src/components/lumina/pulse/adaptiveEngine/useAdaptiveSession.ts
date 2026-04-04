'use client';

import { useRef, useCallback, useSyncExternalStore } from 'react';
import { SessionKernel } from './SessionKernel';
import type { PracticeItemResult } from '../../types';
import type { GradeLevel } from '../../components/GradeLevelSelector';
import type { ViewSlice } from './types';

// ---------------------------------------------------------------------------
// Return type — identical shape to the old hook so downstream is unaffected
// ---------------------------------------------------------------------------

export interface UseAdaptiveSessionReturn extends ViewSlice {
  getSessionHistory: () => Array<{ componentId: string; difficulty: string; score?: number; topic?: string; status: 'done' | 'active' | 'queued' }>;

  startSession: (topic: string, gradeLevel: GradeLevel, subject: string) => void;
  handleItemComplete: (result: PracticeItemResult) => void;
  handleTransitionEnd: () => void;
  acceptExtension: () => void;
  declineExtension: () => void;
  skipItem: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook — thin wrapper that delegates everything to SessionKernel
// ---------------------------------------------------------------------------

export function useAdaptiveSession(): UseAdaptiveSessionReturn {
  const kernelRef = useRef<SessionKernel | null>(null);
  if (!kernelRef.current) {
    kernelRef.current = new SessionKernel();
  }
  const kernel = kernelRef.current;

  const snapshot = useSyncExternalStore(
    kernel.subscribe,
    kernel.getSnapshot,
    kernel.getSnapshot,
  );

  // Stable callbacks — kernel ref never changes, so these never go stale
  const startSession = useCallback(
    (topic: string, gradeLevel: GradeLevel, subject: string) => {
      kernel.start(topic, gradeLevel, subject);
    },
    [kernel],
  );

  const handleItemComplete = useCallback(
    (result: PracticeItemResult) => {
      kernel.completeItem(result);
    },
    [kernel],
  );

  const handleTransitionEnd = useCallback(() => kernel.endTransition(), [kernel]);
  const acceptExtension = useCallback(() => { kernel.acceptExtension(); }, [kernel]);
  const declineExtension = useCallback(() => kernel.declineExtension(), [kernel]);
  const skipItem = useCallback(() => kernel.skipItem(), [kernel]);
  const reset = useCallback(() => kernel.reset(), [kernel]);
  const getSessionHistory = useCallback(() => kernel.getSessionHistory(), [kernel]);

  return {
    ...snapshot,
    getSessionHistory,
    startSession,
    handleItemComplete,
    handleTransitionEnd,
    acceptExtension,
    declineExtension,
    skipItem,
    reset,
  };
}
