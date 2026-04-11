'use client';

import React from 'react';
import type { ImageInset } from '../../../types';

interface ImageInsetRendererProps {
  data: ImageInset;
}

const SIZE_MAP = {
  small: 'max-w-[200px]',
  medium: 'max-w-[400px]',
  full: 'max-w-full',
} as const;

export const ImageInsetRenderer: React.FC<ImageInsetRendererProps> = ({ data }) => {
  const sizeClass = SIZE_MAP[data.size ?? 'medium'];
  const src = data.src.startsWith('data:') ? data.src : `data:image/png;base64,${data.src}`;

  return (
    <figure className={`${sizeClass} mx-auto`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={data.altText}
        className="w-full rounded-lg"
      />
      {data.caption && (
        <figcaption className="text-xs text-slate-500 mt-2 text-center">
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
};
