'use client';

import React from 'react';
import type { CoinType } from './CoinCounter';

/**
 * Coin-counter's open-build surface (`show-amount`): an empty tray the learner fills from the coin bins, one coin per
 * tap, and empties by tapping a coin in it. One svg, so the build layer's picture (`svgPicture`) is exactly what the
 * learner sees. Coins sit in the order put in, one per cell, so none hides another. Nothing here adds up for the
 * learner: each coin's printed value (a tier aid) and the value tags (a lever) are `data-aid`, left out of the picture.
 */
export const TRAY_COLS = 10;
export const TRAY_ROWS = 4;
export const MAX_TRAY = TRAY_COLS * TRAY_ROWS;
const CELL = 48;
const PAD = 8;
const W = TRAY_COLS * CELL + PAD * 2;
const H = TRAY_ROWS * CELL + PAD * 2;

const LOOK: Record<CoinType, { r: number; fill: string; rim: string; name: string; value: string }> = {
  penny: { r: 16, fill: '#b06a3b', rim: '#7c4524', name: 'penny', value: '1¢' },
  nickel: { r: 19, fill: '#b9bec6', rim: '#868c96', name: 'nickel', value: '5¢' },
  dime: { r: 14, fill: '#d3d7dd', rim: '#9aa0a8', name: 'dime', value: '10¢' },
  quarter: { r: 21, fill: '#c3c8cf', rim: '#8b919a', name: 'quarter', value: '25¢' },
  'half-dollar': { r: 23, fill: '#aab0b9', rim: '#7a808a', name: 'half', value: '50¢' },
  dollar: { r: 23, fill: '#d9b24a', rim: '#9c7a22', name: 'dollar', value: '$1' },
};

export const CoinBuildTray = React.forwardRef<SVGSVGElement, {
  coins: readonly CoinType[];
  /** The tier's value labels on each coin. */
  valuesShown: boolean;
  /** The value-tags lever: what the coins add up to at each coin, in the order put in. */
  tags: readonly number[] | null;
  disabled: boolean;
  onRemove: (index: number) => void;
}>(({ coins, valuesShown, tags, disabled, onRemove }, ref) => (
  <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}
    role="group" aria-label="Your coin tray" data-build-scene="coin-tray" className="h-auto max-w-full rounded-xl">
    <rect width={W} height={H} rx={14} fill="#5b3a29" />
    <rect x={PAD / 2} y={PAD / 2} width={W - PAD} height={H - PAD} rx={11} fill="#2f6b4f" />
    {coins.map((type, i) => {
      const look = LOOK[type], cx = PAD + (i % TRAY_COLS) * CELL + CELL / 2, cy = PAD + Math.floor(i / TRAY_COLS) * CELL + CELL / 2;
      return (
        <g key={i} data-tray-index={i} role="button" aria-label={`Take out ${type} ${i + 1}`}
          onClick={() => { if (!disabled) onRemove(i); }} style={{ cursor: disabled ? 'default' : 'pointer' }}>
          {/* The painted coin is its own hit area. */}
          <circle cx={cx} cy={cy} r={look.r} fill={look.fill} stroke={look.rim} strokeWidth={2} />
          <text x={cx} y={cy + (valuesShown ? 6 : 0)} fontSize={8} fill="#1f2937" textAnchor="middle"
            dominantBaseline="central" style={{ pointerEvents: 'none' }}>{look.name}</text>
          {valuesShown && (
            <text data-aid="value" x={cx} y={cy - 5} fontSize={9} fontWeight="bold" fill="#111827" textAnchor="middle"
              dominantBaseline="central" style={{ pointerEvents: 'none' }}>{look.value}</text>
          )}
          {tags && (
            <g data-aid="tag" data-lever="value-tag" style={{ pointerEvents: 'none' }}>
              <circle cx={cx + 15} cy={cy - 15} r={9} fill="#f97316" />
              <text x={cx + 15} y={cy - 15} fontSize={9} fill="white" fontWeight="bold" textAnchor="middle"
                dominantBaseline="central">{tags[i]}</text>
            </g>
          )}
        </g>
      );
    })}
  </svg>
));
CoinBuildTray.displayName = 'CoinBuildTray';
