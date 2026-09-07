'use client';

/**
 * number-sentence — a printed equation as addressable tokens (KC redesign P1).
 *
 * STIMULUS ONLY by default: `NumberSentenceInsetRenderer` is static — no
 * token is pre-highlighted, nothing commits an answer (item 17 ruling).
 * `NumberSentenceTokens` is the same drawing with an OPTIONAL tap handler,
 * for the ONE surface that owns a pointing gesture (knowledge-check
 * `point_to`): the child touches a token, the container decides what that
 * means. The reveal highlight is post-verdict only and container-driven.
 */

import React from 'react';
import type { NumberSentenceInset, NumberSentenceToken } from '../../../types';

interface NumberSentenceTokensProps {
  data: NumberSentenceInset;
  /** When set, tokens render as buttons and this fires with the token id. */
  onTokenTap?: (tokenId: string) => void;
  /** Container-owned: the token the child committed (pre-verdict). */
  tappedId?: string | null;
  /** Container-owned: the affirmed target, shown only after the verdict. */
  revealId?: string | null;
  disabled?: boolean;
  size?: 'md' | 'lg';
}

const tokenClass = (token: NumberSentenceToken, size: 'md' | 'lg'): string => {
  const base = size === 'lg' ? 'text-5xl md:text-6xl min-w-[3.5rem]' : 'text-4xl min-w-[3rem]';
  const kind = token.kind === 'operator'
    ? 'text-slate-200'
    : token.kind === 'blank'
      ? 'text-slate-500'
      : 'text-white';
  return `${base} ${kind} font-black leading-none tabular-nums text-center`;
};

export const NumberSentenceTokens: React.FC<NumberSentenceTokensProps> = ({
  data, onTokenTap, tappedId, revealId, disabled, size = 'lg',
}) => {
  const interactive = !!onTokenTap;
  return (
    <div className="flex items-center justify-center gap-3 md:gap-5 flex-wrap py-2" role={interactive ? 'group' : undefined}>
      {data.tokens.map((token) => {
        const isReveal = revealId != null && token.id === revealId;
        const isTapped = tappedId != null && token.id === tappedId && !isReveal;
        const frame = `rounded-2xl border-2 px-4 py-3 transition-all duration-200 ${
          isReveal
            ? 'border-emerald-400/70 bg-emerald-500/15 ring-2 ring-emerald-400/40'
            : isTapped
              ? 'border-blue-400/60 bg-blue-500/15'
              : 'border-white/10 bg-slate-800/40'
        }`;
        const inner = <span className={tokenClass(token, size)} aria-hidden={token.kind === 'blank'}>{token.text}</span>;
        if (!interactive) {
          return <div key={token.id} className={frame}>{inner}</div>;
        }
        return (
          <button
            key={token.id}
            type="button"
            disabled={disabled}
            onClick={() => onTokenTap?.(token.id)}
            aria-label={token.kind === 'blank' ? 'blank' : token.text}
            className={`${frame} ${disabled ? 'opacity-80' : 'cursor-pointer hover:border-white/30 active:scale-95'}`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
};

interface NumberSentenceInsetRendererProps {
  data: NumberSentenceInset;
}

export const NumberSentenceInsetRenderer: React.FC<NumberSentenceInsetRendererProps> = ({ data }) => (
  <NumberSentenceTokens data={data} size="lg" />
);
