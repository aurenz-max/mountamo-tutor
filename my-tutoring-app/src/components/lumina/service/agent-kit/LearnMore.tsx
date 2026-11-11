'use client';

/** The kit's Learn more drawer: the hard words on the current question, opened by the child. It shows nothing when the question has none. */
import React from 'react';
import { LuminaHintDisclosure, LuminaPanel } from '../../ui';
import { DISPLAY_CSS } from './displays';
import { KitDisplay } from './KitDisplay';
import type { Term } from './terms';

export const LearnMore: React.FC<{ terms?: readonly Term[]; onOpen?: () => void }> = ({ terms, onOpen }) => {
  if (!terms?.length) return null;
  return (
    <div data-learn-more="">
      <LuminaHintDisclosure label="Learn more" accent="cyan" onOpenChange={open => { if (open) onOpen?.(); }}>
        <LuminaPanel className="space-y-3 p-3">
          <style>{DISPLAY_CSS}</style>
          {terms.map(t => (
            <div key={t.term} className="flex items-start gap-3" data-learn-term="">
              {t.display && <KitDisplay display={t.display} className="w-24 shrink-0" />}
              <p className="text-sm text-slate-200"><span className="font-semibold text-slate-100">{t.term}</span>: {t.means}</p>
            </div>
          ))}
        </LuminaPanel>
      </LuminaHintDisclosure>
    </div>
  );
};
