'use client';

/**
 * arrangement — a set of emoji objects in a code-built layout (KC redesign P1).
 * No digits anywhere: the count is the thing the child produces. Crossed-out
 * objects (take-away) stay visible and dimmed with an ✕, so "how many are
 * left?" is answerable by looking and the start set is still countable.
 */

import React from 'react';
import type { ArrangementInset } from '../../../types';

interface ArrangementInsetRendererProps {
  data: ArrangementInset;
}

/** Deterministic pseudo-scatter so a re-render never shuffles the picture. */
const scatterOffsets = (count: number): Array<{ x: number; y: number }> =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i * 137.5 * Math.PI) / 180; // golden-angle spiral
    const r = 12 + (i % 3) * 9;
    return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
  });

export const ArrangementInsetRenderer: React.FC<ArrangementInsetRendererProps> = ({ data }) => {
  const removed = data.removed ?? 0;
  const items = Array.from({ length: data.count }, (_, i) => ({ i, crossed: i >= data.count - removed }));
  const glyph = (crossed: boolean, key: number) => (
    <span
      key={key}
      className={`relative inline-flex items-center justify-center text-4xl md:text-5xl leading-none select-none ${crossed ? 'opacity-40' : ''}`}
      aria-label={crossed ? 'taken away' : 'object'}
    >
      <span aria-hidden>{data.emoji}</span>
      {crossed && (
        <span className="absolute inset-0 flex items-center justify-center text-rose-400 text-5xl md:text-6xl font-black" aria-hidden>
          ✕
        </span>
      )}
    </span>
  );

  if (data.layout === 'groups' && data.groups && data.groups.length >= 2) {
    // Put-together picture: clusters with a clear gap and a faint divider —
    // no plus sign, no digits; the child counts across the gap.
    let offset = 0;
    const clusters = data.groups.map((size) => {
      const cluster = items.slice(offset, offset + size);
      offset += size;
      return cluster;
    });
    return (
      <div className="flex items-center justify-center gap-4 md:gap-6 py-2 flex-wrap">
        {clusters.map((cluster, ci) => (
          <React.Fragment key={ci}>
            {ci > 0 && <span className="h-12 w-px bg-white/15" aria-hidden />}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 rounded-2xl border border-white/10 bg-slate-800/30 px-4 py-3">
              {cluster.map((it) => glyph(it.crossed, it.i))}
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (data.layout === 'ten-frame') {
    const cells = Array.from({ length: 10 }, (_, i) => items[i]);
    return (
      <div className="grid grid-cols-5 gap-2 max-w-md mx-auto py-2">
        {cells.map((cell, i) => (
          <div key={i} className="aspect-square rounded-xl border-2 border-white/15 bg-slate-800/40 flex items-center justify-center">
            {cell ? glyph(cell.crossed, i) : null}
          </div>
        ))}
      </div>
    );
  }

  if (data.layout === 'array') {
    const columns = Math.max(2, Math.min(5, data.columns ?? 3));
    return (
      <div className="flex justify-center py-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {items.map((it) => glyph(it.crossed, it.i))}
        </div>
      </div>
    );
  }

  if (data.layout === 'scattered') {
    const offsets = scatterOffsets(data.count);
    return (
      <div className="relative w-full max-w-md mx-auto aspect-[2/1]">
        {items.map((it) => (
          <div
            key={it.i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${offsets[it.i].x}%`, top: `${offsets[it.i].y}%` }}
          >
            {glyph(it.crossed, it.i)}
          </div>
        ))}
      </div>
    );
  }

  // row · before-after (a row with the taken-away tail crossed out)
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 py-2">
      {items.map((it) => glyph(it.crossed, it.i))}
    </div>
  );
};
