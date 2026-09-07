'use client';

/**
 * glyph-card — ONE large printed symbol (KC redesign P1): a numeral, a letter,
 * a short word, an operator, or a shape outline. The glyph's NAME is never
 * printed; the card is the stimulus the child names.
 *
 * Shapes draw from the di-shapes geometry table when `shapeName` is set
 * (rectangle, rhombus, trapezoid and oval have no regular-polygon form — the
 * invariants that keep them unambiguous live in `diShapesGeometry.ts`); a
 * bare `sides` count falls back to a regular polygon.
 */

import React from 'react';
import type { GlyphCardInset } from '../../../types';
import { shapeOutlinePoints } from '../../../service/insets/build';
import {
  SHAPE_GEOMETRY,
  pointsAttr,
} from '../../visual-primitives/direct-instruction/diShapesGeometry';
import type { DiShapeName } from '../../visual-primitives/direct-instruction/diShapesScript';

interface GlyphCardInsetRendererProps {
  data: GlyphCardInset;
}

const STROKE = 'rgba(226, 232, 240, 0.95)';
const FILL = 'rgba(96,165,250,0.12)';

const isDiShapeName = (name: string | undefined): name is DiShapeName =>
  !!name && Object.prototype.hasOwnProperty.call(SHAPE_GEOMETRY, name);

const ShapeOutline: React.FC<{ sides: number; shapeName?: string }> = ({ sides, shapeName }) => {
  const geometry = isDiShapeName(shapeName) ? SHAPE_GEOMETRY[shapeName].prototype : null;
  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40 md:w-48 md:h-48" role="img" aria-label="shape">
      {geometry?.kind === 'circle' && (
        <circle cx={100} cy={100} r={geometry.r} fill={FILL} stroke={STROKE} strokeWidth={6} />
      )}
      {geometry?.kind === 'ellipse' && (
        <ellipse cx={100} cy={100} rx={geometry.rx} ry={geometry.ry} fill={FILL} stroke={STROKE} strokeWidth={6} />
      )}
      {geometry?.kind === 'polygon' && (
        <polygon points={pointsAttr(geometry.points)} fill={FILL} stroke={STROKE} strokeWidth={6} strokeLinejoin="round" />
      )}
      {!geometry && (sides === 0 ? (
        <circle cx={100} cy={100} r={78} fill={FILL} stroke={STROKE} strokeWidth={6} />
      ) : (
        <polygon
          points={shapeOutlinePoints(sides).map(([x, y]) => `${x},${y}`).join(' ')}
          fill={FILL}
          stroke={STROKE}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
};

export const GlyphCardInsetRenderer: React.FC<GlyphCardInsetRendererProps> = ({ data }) => {
  const isShape = data.glyphKind === 'shape';
  const isWord = data.glyphKind === 'word';
  return (
    <div className="flex justify-center py-2">
      <div className="rounded-3xl border-2 border-white/15 bg-slate-800/40 px-10 py-8 min-w-[10rem] flex flex-col items-center gap-3">
        {isShape ? (
          <ShapeOutline sides={data.sides ?? 3} shapeName={data.shapeName} />
        ) : (
          <span
            className={`font-black text-white leading-none tracking-wide ${
              isWord ? 'text-5xl md:text-6xl' : 'text-7xl md:text-8xl'
            } ${data.glyphKind === 'letter' ? 'font-mono' : ''}`}
            aria-label={data.glyphKind}
          >
            {data.glyph}
          </span>
        )}
        {isWord && data.phonemeBoxes && (
          <div className="flex gap-2" aria-hidden>
            {Array.from(data.glyph).map((_, i) => (
              <span key={i} className="w-8 h-3 rounded-sm border border-white/30" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
