'use client';

import React, { useEffect } from 'react';
import { LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle } from '../../../ui';

/**
 * What a workspace-only primitive shows when its host did not bind it (no live runtime, or a pin
 * the family does not run). There is no fallback teaching path to run instead: an unbound section
 * is a defect to fix at its host (`workspaceBinding` in lessonWorkspacePlan.ts), never a mode to
 * route around (09-20 ruling). Logs why in development.
 */
export function NeedsTutor({ primitiveId, evalMode, title, className }:
    { primitiveId: string; evalMode?: string; title: string; className?: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.warn(`[${primitiveId}] mounted without a teaching workspace `
      + `(pin "${evalMode ?? ''}"). Its host did not bind this section; see workspaceBinding in lessonWorkspacePlan.ts.`);
  }, [primitiveId, evalMode]);
  return <LuminaCard className={className} data-workspace-unbound={primitiveId}>
    <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
    <LuminaCardContent>
      <p className="text-center text-slate-300">This activity needs the tutor. Start it from a lesson or practice session.</p>
    </LuminaCardContent>
  </LuminaCard>;
}
