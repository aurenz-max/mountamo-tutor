'use client';

import React from 'react';
import type { KeyFactsBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

interface KeyFactsBlockProps {
  data: KeyFactsBlockData;
  index: number;
}

/**
 * KeyFacts with visual variety:
 * - First fact rendered as a "hero fact" (larger, prominent)
 * - Remaining facts in a responsive 2-column grid of mini-cards
 * - Each card has a large emoji, distinct background tint
 */

const FACT_TINTS = [
  'from-blue-500/10 to-blue-500/5 border-blue-500/15',
  'from-emerald-500/10 to-emerald-500/5 border-emerald-500/15',
  'from-amber-500/10 to-amber-500/5 border-amber-500/15',
  'from-purple-500/10 to-purple-500/5 border-purple-500/15',
  'from-rose-500/10 to-rose-500/5 border-rose-500/15',
];

const KeyFactsBlock: React.FC<KeyFactsBlockProps> = ({ data, index }) => {
  const [heroFact, ...restFacts] = data.facts;

  return (
    <BlockWrapper label={data.label} index={index} accent="blue">
      <div className="space-y-3">
        {/* Hero fact — full width, larger treatment */}
        {heroFact && (
          <div className={`p-4 rounded-xl bg-gradient-to-br ${FACT_TINTS[0]} border transition-colors`}>
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0 mt-0.5">{heroFact.icon}</span>
              <p className="text-slate-100 text-[15px] leading-relaxed">{heroFact.text}</p>
            </div>
          </div>
        )}

        {/* Grid of remaining facts — 2-col on wider, 1-col on narrow */}
        {restFacts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {restFacts.map((fact, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl bg-gradient-to-br ${FACT_TINTS[(i + 1) % FACT_TINTS.length]} border transition-colors`}
              >
                <span className="text-2xl block mb-2">{fact.icon}</span>
                <p className="text-slate-200 text-sm leading-relaxed">{fact.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </BlockWrapper>
  );
};

export default KeyFactsBlock;
