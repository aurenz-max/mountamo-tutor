'use client';

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { UNGRADED_MODE } from '../pinnedModes';

/**
 * The lesson's eval-mode pin for a teaching-workspace mount (handoff 19, slice 1).
 *
 * The family wrapper (`withWorkspaceOnly`, `withWorkspaceController`, `withTeachingWorkspace`,
 * `DiTeachingStage`) decides the mount binds from `runtimeEvalMode`, so it provides that same pin
 * here, and the workspace hooks read it. A primitive never passes an eval mode to a workspace hook:
 * a mode rebuilt from the first item or a hard-coded default can differ from the pin the lesson
 * planned and scores against.
 */
const WorkspacePinContext = createContext<string | null>(null);

/** Provides the pin to the hooks below. An ungraded surface binds only unpinned content, mounted as `mixed`. */
export function WorkspacePin({ pin, children }: { pin: string | undefined; children: ReactNode }) {
  return createElement(WorkspacePinContext.Provider, { value: pin || UNGRADED_MODE }, children);
}

/** The pin this mount's wrapper provides. A workspace hook outside a wrapper is a wiring bug, so it throws. */
export function useWorkspacePin(): string {
  const pin = useContext(WorkspacePinContext);
  if (!pin) throw new Error('A teaching-workspace hook ran outside its family wrapper, which provides the lesson\'s eval-mode pin.');
  return pin;
}
