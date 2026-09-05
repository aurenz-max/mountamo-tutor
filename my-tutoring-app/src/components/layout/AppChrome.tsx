'use client';

import { lazy, Suspense, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const LegacyAppChrome = lazy(() => import('./LegacyAppChrome'));

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // These pages own their navigation and tutoring UI.
  if (pathname === '/' || pathname === '/login' ||
      pathname === '/lumina' || pathname?.startsWith('/lumina/')) {
    return children;
  }

  return (
    <Suspense fallback={null}>
      <LegacyAppChrome>{children}</LegacyAppChrome>
    </Suspense>
  );
}
