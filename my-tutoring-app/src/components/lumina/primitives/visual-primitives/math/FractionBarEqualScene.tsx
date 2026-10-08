'use client';

import React from 'react';
import type { Piece } from './fractionEqualBuild';

/**
 * The fraction-bar open-build surface (`build_equal`): the learner's bar, as split and shaded so far. One svg with
 * its own background, so the build layer's picture (`svgPicture`) is exactly what the learner sees. Tapping a part
 * shades it, or with the knife on cuts it in half; the component owns both. Nothing here judges or counts.
 */
export const BAR_W = 480;
export const BAR_H = 112;
const PAD = 12;
const INNER = BAR_W - 2 * PAD;

/** A bar of `pieces` (each a span of the whole), for the learner's bar and the reference lever. */
export function barParts(pieces: readonly Piece[], y: number, h: number, props: (p: Piece, i: number) => React.SVGProps<SVGRectElement>,
  fill: string) {
  return pieces.map((p, i) => (
    <rect key={`${p.start.toFixed(6)}-${p.end.toFixed(6)}`} x={PAD + p.start * INNER} y={y} width={(p.end - p.start) * INNER} height={h}
      fill={p.shaded ? fill : '#1e293b'} fillOpacity={p.shaded ? 0.85 : 1} stroke="#e2e8f0" strokeOpacity={0.85} strokeWidth={2}
      {...props(p, i)} />
  ));
}

export const FractionBarEqualScene = React.forwardRef<SVGSVGElement, {
  pieces: readonly Piece[];
  knife: boolean;
  disabled: boolean;
  onPiece: (index: number) => void;
}>(({ pieces, knife, disabled, onPiece }, ref) => (
  <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width="100%" viewBox={`0 0 ${BAR_W} ${BAR_H}`} style={{ maxWidth: BAR_W }}
    role="group" aria-label={knife ? 'Your bar: tap a part to cut it in half' : 'Your bar: tap a part to shade it'}
    data-build-scene="fraction-bar" className="drop-shadow-lg">
    <rect width={BAR_W} height={BAR_H} rx={16} fill="#0f172a" />
    {barParts(pieces, 24, BAR_H - 48, (p, i) => ({
      'data-pip-object': `part-${i}`, role: 'button',
      'aria-label': knife ? `Cut part ${i + 1} in half` : `${p.shaded ? 'Unshade' : 'Shade'} part ${i + 1}`,
      style: { cursor: disabled ? 'default' : knife ? 'crosshair' : 'pointer' },
      onClick: () => { if (!disabled) onPiece(i); },
    } as React.SVGProps<SVGRectElement>), '#a855f7')}
    <rect x={PAD} y={24} width={INNER} height={BAR_H - 48} fill="none" stroke="#c4b5fd" strokeWidth={3} pointerEvents="none" />
  </svg>
));
FractionBarEqualScene.displayName = 'FractionBarEqualScene';
