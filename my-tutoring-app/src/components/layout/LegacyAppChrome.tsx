'use client';

import type { ReactNode } from 'react';
import NavHeader from '@/components/NavHeader';
import { AICoachProvider } from '@/contexts/AICoachContext';
import { GlobalAICoachProvider } from './GlobalAICoachToggle';

export default function LegacyAppChrome({ children }: { children: ReactNode }) {
  return (
    <AICoachProvider>
      <GlobalAICoachProvider>
        <NavHeader />
        {children}
      </GlobalAICoachProvider>
    </AICoachProvider>
  );
}
