'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { LuminaCallout } from '../../../ui';

/**
 * The shared sign of a credited practice item (VB-F1). A simplify lever puts an easier item on screen; a credit on it
 * records nothing and never fires `onSolved`, so a spoken credit while the tutor holds the item changed nothing on
 * screen in 40 families (sweep rule J15, 2026-10-16). Every bound mount runs under this scope, and the teaching
 * workspace reports whether its practice item is credited, so the screen says so in every family. It names no answer:
 * the full item comes back blank, and a primitive may also show the credited answer on its own practice surface.
 */
const PracticeCreditContext = createContext<((credited: boolean) => void) | null>(null);

export function PracticeCreditScope({ children }: { children: React.ReactNode }) {
  const [credited, setCredited] = useState(false);
  return <PracticeCreditContext.Provider value={setCredited}>
    {children}
    {credited && <LuminaCallout accent="emerald" label="Practice question" className="mt-3 p-4" data-practice-credited
      role="status">That's right. Next, the tutor brings back the full question.</LuminaCallout>}
  </PracticeCreditContext.Provider>;
}

/** Reports the open practice item's credit to the enclosing scope; none outside a bound mount. */
export function useReportPracticeCredit(credited: boolean) {
  const report = useContext(PracticeCreditContext);
  useEffect(() => { report?.(credited); }, [report, credited]);
  useEffect(() => () => report?.(false), [report]);
}
