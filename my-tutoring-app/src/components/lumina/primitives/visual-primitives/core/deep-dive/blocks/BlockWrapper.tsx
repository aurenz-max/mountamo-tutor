'use client';

import React from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  accentSolidBg,
  accentText,
  text,
  type LuminaAccent,
} from '../../../../../ui';

export type BlockVariant = 'compact' | 'default' | 'feature';
/**
 * Block accents map 1:1 onto the kit palette now that `indigo`/`teal` landed in
 * LUMINA_ACCENTS. `none` = no rail.
 */
export type BlockAccent = LuminaAccent | 'none';

interface BlockWrapperProps {
  children: React.ReactNode;
  /** Optional label shown as a subtle header inside the card */
  label?: string;
  /** Block index for scroll-snap targeting */
  index?: number;
  /** Visual weight: compact (tight padding), default, feature (extra padding + emphasis) */
  variant?: BlockVariant;
  /** Left-rail accent color for instant block-type recognition */
  accent?: BlockAccent;
  className?: string;
}

const VARIANT_PADDING: Record<BlockVariant, string> = {
  compact: 'p-4',
  default: 'p-6',
  feature: 'p-7',
};

/**
 * Shared wrapper for all DeepDive blocks.
 *
 * Frame = LuminaCard. The left rail + mono eyebrow are DeepDive's block-type
 * recognition system, now fully token-driven (accentSolidBg / accentText) — the
 * same accent-bar affordance LuminaCard's `topAccent` uses, mirrored to the left
 * edge. The lighter `shadow-lg` (vs the kit default shadow-2xl) preserves the
 * intentional hierarchy between blocks and the masthead header.
 */
const BlockWrapper: React.FC<BlockWrapperProps> = ({
  children,
  label,
  index,
  variant = 'default',
  accent = 'none',
  className,
}) => {
  const luminaAccent = accent === 'none' ? undefined : accent;
  const padding = VARIANT_PADDING[variant];

  return (
    <LuminaCard
      data-block-index={index}
      className={`relative shadow-lg overflow-hidden ${className || ''}`}
    >
      {luminaAccent && (
        <span className={`absolute inset-y-0 left-0 w-0.5 ${accentSolidBg[luminaAccent]}`} />
      )}
      <LuminaCardContent className={padding}>
        {label && (
          <div
            className={`text-xs font-mono uppercase tracking-widest mb-4 ${
              luminaAccent ? accentText[luminaAccent] : text.muted
            }`}
          >
            {label}
          </div>
        )}
        {children}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default BlockWrapper;
