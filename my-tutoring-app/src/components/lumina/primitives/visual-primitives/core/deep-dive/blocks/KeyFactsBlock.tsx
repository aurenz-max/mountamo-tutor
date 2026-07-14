'use client';

import React, { useState } from 'react';
import type { KeyFactsBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import { SoundManager } from '../../../../../utils/SoundManager';
import { useTapTutor, TapHint } from './TapTutor';

interface KeyFactsBlockProps {
  data: KeyFactsBlockData;
  index: number;
  /** Bridge to the DeepDive live tutor; revealing/tapping a fact asks it to expand. */
  onAskTutor?: (message: string) => void;
  /**
   * Pre-reader (K) presentation — the tap-hint protocol text is unreadable
   * chrome at this band (the [DEEP_DIVE_START] beat tells the child to tap
   * cards instead), and explore taps flag the reader so the tutor reads the
   * fact word for word first (catalog PRE-READER READ-ALOUD directive).
   */
  preReader?: boolean;
}

/**
 * KeyFacts with visual variety:
 * - First fact rendered as a "hero fact" (larger, prominent)
 * - Remaining facts in a responsive 2-column grid of mini-cards
 * - Facts WITH a headline render as flip cards: front = icon + headline teaser,
 *   tap flips to the full fact while the tutor narrates
 * - Facts without a headline stay flat cards; tapping asks the tutor to expand
 */

const FACT_TINTS = [
  'from-blue-500/10 to-blue-500/5 border-blue-500/15',
  'from-emerald-500/10 to-emerald-500/5 border-emerald-500/15',
  'from-amber-500/10 to-amber-500/5 border-amber-500/15',
  'from-purple-500/10 to-purple-500/5 border-purple-500/15',
  'from-rose-500/10 to-rose-500/5 border-rose-500/15',
];

type Fact = KeyFactsBlockData['facts'][number];

interface FactCardProps {
  fact: Fact;
  tint: string;
  hero?: boolean;
  onReveal?: () => void;
  active?: boolean;
}

/** Flat (non-flip) card — used when the fact has no headline teaser. */
const FlatFactCard: React.FC<FactCardProps> = ({ fact, tint, hero, onReveal, active }) => {
  const content = hero ? (
    <div className="flex items-start gap-4">
      <span className="text-3xl flex-shrink-0 mt-0.5">{fact.icon}</span>
      <p className="text-slate-100 text-[15px] leading-relaxed">{fact.text}</p>
    </div>
  ) : (
    <>
      <span className="text-2xl block mb-2">{fact.icon}</span>
      <p className="text-slate-200 text-sm leading-relaxed">{fact.text}</p>
    </>
  );

  const base = `p-4 rounded-xl bg-gradient-to-br ${tint} border transition-all`;
  if (!onReveal) return <div className={base}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onReveal}
      className={`${base} w-full text-left cursor-pointer hover:border-white/25 hover:brightness-125 active:scale-[0.99] ${
        active ? 'ring-1 ring-indigo-400/60' : ''
      }`}
    >
      {content}
    </button>
  );
};

/** Flip card — front teases with the headline, back reveals the full fact. */
const FlipFactCard: React.FC<FactCardProps> = ({ fact, tint, hero, onReveal, active }) => {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    SoundManager.tap();
    setFlipped((f) => {
      // Narrate only on reveal (front → back), not when flipping back
      if (!f) onReveal?.();
      return !f;
    });
  };

  return (
    <button
      type="button"
      onClick={handleFlip}
      className={`w-full text-left [perspective:1000px] cursor-pointer group ${
        active && flipped ? 'rounded-xl ring-1 ring-indigo-400/60' : ''
      }`}
      aria-label={flipped ? fact.text : `${fact.headline} — tap to reveal`}
    >
      <div
        className={`grid transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Front — teaser */}
        <div
          className={`[grid-area:1/1] [backface-visibility:hidden] p-4 rounded-xl bg-gradient-to-br ${tint} border transition-colors group-hover:border-white/25 flex ${
            hero ? 'items-center gap-4' : 'flex-col gap-2'
          }`}
        >
          <span className={hero ? 'text-3xl flex-shrink-0' : 'text-2xl'}>{fact.icon}</span>
          <div className="min-w-0">
            <p className={`font-semibold text-slate-100 ${hero ? 'text-lg' : 'text-[15px]'}`}>
              {fact.headline}
            </p>
            <p className="text-xs text-slate-500 italic mt-1">Tap to reveal</p>
          </div>
        </div>

        {/* Back — full fact */}
        <div
          className={`[grid-area:1/1] [backface-visibility:hidden] [transform:rotateY(180deg)] p-4 rounded-xl bg-gradient-to-br ${tint} border`}
        >
          <div className={hero ? 'flex items-start gap-4' : ''}>
            {hero && <span className="text-3xl flex-shrink-0 mt-0.5">{fact.icon}</span>}
            <p className={hero ? 'text-slate-100 text-[15px] leading-relaxed' : 'text-slate-200 text-sm leading-relaxed'}>
              {fact.text}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
};

const KeyFactsBlock: React.FC<KeyFactsBlockProps> = ({ data, index, onAskTutor, preReader = false }) => {
  const [heroFact, ...restFacts] = data.facts;
  const { enabled, activeKey, ask } = useTapTutor(onAskTutor);
  const hasFlipCards = data.facts.some((f) => !!f.headline);

  const askAboutFact = (key: string, fact: Fact) =>
    ask(
      key,
      `[FACT_EXPLORE] The student${preReader ? ' (a pre-reader — READ the fact aloud word for word first)' : ''} ${fact.headline ? `flipped open the "${fact.headline}" card and revealed` : 'tapped'} this fact in the "${data.label || 'Key Facts'}" section: "${fact.text}". Bring it to life in 2-3 short sentences — a vivid example or a connection to their everyday world — then end with one quick wonder question. Do not quiz them and do not mention cards or tapping.`,
    );

  const renderFact = (fact: Fact, key: string, tint: string, hero?: boolean) => {
    const Card = fact.headline ? FlipFactCard : FlatFactCard;
    return (
      <Card
        fact={fact}
        tint={tint}
        hero={hero}
        onReveal={enabled ? () => askAboutFact(key, fact) : fact.headline ? () => undefined : undefined}
        active={activeKey === key}
      />
    );
  };

  return (
    <BlockWrapper label={data.label} index={index} accent="blue">
      <div className="space-y-3">
        {/* Hero fact — full width, larger treatment */}
        {heroFact && renderFact(heroFact, 'hero', FACT_TINTS[0], true)}

        {/* Grid of remaining facts — 2-col on wider, 1-col on narrow */}
        {restFacts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {restFacts.map((fact, i) => (
              <React.Fragment key={i}>
                {renderFact(fact, `fact-${i}`, FACT_TINTS[(i + 1) % FACT_TINTS.length])}
              </React.Fragment>
            ))}
          </div>
        )}

        {!preReader && (enabled || hasFlipCards) && (
          <TapHint
            text={
              hasFlipCards
                ? 'Tap a card to reveal the fact — your tutor will tell you more'
                : 'Tap any card to hear more from your tutor'
            }
          />
        )}
      </div>
    </BlockWrapper>
  );
};

export default KeyFactsBlock;
