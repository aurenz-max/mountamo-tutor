'use client';

import React from 'react';
import type { Piece } from './fractionEqualBuild';

/**
 * The fraction-circles open-build surface (`build_equal`): the learner's circle, as cut and shaded so far. One svg
 * with its own background, so the build layer's picture (`svgPicture`) is exactly what the learner sees. Tapping a
 * piece shades it, or with the knife on cuts it in half; the component owns both. Nothing here judges or counts.
 */
export const BUILD_SIZE = 200;
const R = BUILD_SIZE / 2 - 8;
const C = BUILD_SIZE / 2;

const point = (turn: number) =>
  [C + R * Math.cos(turn * 2 * Math.PI - Math.PI / 2), C + R * Math.sin(turn * 2 * Math.PI - Math.PI / 2)] as const;

function piecePath(p: Piece): string {
  const span = p.end - p.start;
  if (span >= 1 - 1e-9) return `M ${C - R} ${C} A ${R} ${R} 0 1 1 ${C + R} ${C} A ${R} ${R} 0 1 1 ${C - R} ${C} Z`;
  const [x1, y1] = point(p.start), [x2, y2] = point(p.end);
  return `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${span > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

export const FractionEqualBuildScene = React.forwardRef<SVGSVGElement, {
  pieces: readonly Piece[];
  knife: boolean;
  disabled: boolean;
  onPiece: (index: number) => void;
}>(({ pieces, knife, disabled, onPiece }, ref) => (
  <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={BUILD_SIZE} height={BUILD_SIZE} viewBox={`0 0 ${BUILD_SIZE} ${BUILD_SIZE}`}
    role="group" aria-label={knife ? 'Your circle: tap a piece to cut it in half' : 'Your circle: tap a piece to shade it'}
    data-build-scene="fraction-circle" className="drop-shadow-lg">
    <rect width={BUILD_SIZE} height={BUILD_SIZE} rx={16} fill="#0f172a" />
    {pieces.map((p, i) => (
      <path key={`${p.start.toFixed(6)}-${p.end.toFixed(6)}`} d={piecePath(p)} data-pip-object={`slice-${i}`}
        role="button" aria-label={knife ? `Cut piece ${i + 1} in half` : `${p.shaded ? 'Unshade' : 'Shade'} piece ${i + 1}`}
        fill={p.shaded ? '#ec4899' : '#1e293b'} fillOpacity={p.shaded ? 0.75 : 1}
        stroke="#e2e8f0" strokeOpacity={0.85} strokeWidth={2}
        style={{ cursor: disabled ? 'default' : knife ? 'crosshair' : 'pointer' }}
        onClick={() => { if (!disabled) onPiece(i); }} />
    ))}
    <circle cx={C} cy={C} r={R} fill="none" stroke="#f9a8d4" strokeWidth={3} pointerEvents="none" />
  </svg>
));
FractionEqualBuildScene.displayName = 'FractionEqualBuildScene';
