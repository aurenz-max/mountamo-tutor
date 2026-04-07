'use client';

import React from 'react';
import type { HeroImageBlockData } from '../types';

interface HeroImageBlockProps {
  data: HeroImageBlockData;
  index: number;
}

/**
 * Full-bleed hero image — no card wrapper.
 * Acts as the visual anchor for the entire DeepDive experience.
 * Taller than other blocks, edge-to-edge, with gradient caption overlay.
 */
const HeroImageBlock: React.FC<HeroImageBlockProps> = ({ data, index }) => {
  if (!data.imageBase64) {
    return (
      <div
        data-block-index={index}
        className="relative w-full rounded-2xl overflow-hidden bg-slate-800/60 border border-white/5"
        style={{ minHeight: 240 }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
            <p className="text-slate-600 text-sm">Image unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-block-index={index}
      className="relative w-full rounded-2xl overflow-hidden group"
      style={{ minHeight: 280 }}
    >
      {/* Full-bleed image */}
      <img
        src={data.imageBase64}
        alt={data.altText}
        className="w-full h-full min-h-[280px] max-h-[420px] object-cover"
      />

      {/* Gradient overlay — stronger for caption readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Caption positioned at bottom with breathing room */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-5">
        <p className="text-white/90 text-base leading-relaxed font-light max-w-2xl">
          {data.caption}
        </p>
      </div>
    </div>
  );
};

export default HeroImageBlock;
