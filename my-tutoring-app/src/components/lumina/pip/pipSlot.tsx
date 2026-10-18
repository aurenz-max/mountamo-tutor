'use client';

/**
 * The slot a bound surface's Pip markers read (`WorkspacePip.tsx`). Its own module, free of the AI context, so the
 * bound wrapper (`withWorkspaceOnly`) can provide it without loading the tutor client.
 */
import React, { createContext, useRef, type ReactNode } from 'react';
import type { useWorkspacePipSurface } from './useWorkspacePipSurface';

export type PipHandles = ReturnType<typeof useWorkspacePipSurface> & { live: boolean };
export const PipSlotContext = createContext<{ current: PipHandles | null } | null>(null);

/** `withWorkspaceOnly` puts one around every bound mount. */
export function PipSlot({ children }: { children: ReactNode }) {
  const slot = useRef<PipHandles | null>(null);
  return <PipSlotContext.Provider value={slot}>{children}</PipSlotContext.Provider>;
}
