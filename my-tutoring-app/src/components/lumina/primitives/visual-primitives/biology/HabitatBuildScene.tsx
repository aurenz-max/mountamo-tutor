'use client';

import React from 'react';
import { pieceById, pieceTag, spotsFor, type HabitatAnimal } from './habitatBuild';

/**
 * habitat-diorama's open-build surface (`build_habitat`): bare brown ground under a dark blue sky with the animal in
 * the middle. The learner's pieces fill fixed spots (weather in the sky, the rest on the ground), so no two overlap;
 * tapping a piece takes it out. One svg, so the build layer's picture (`svgPicture`) is exactly what the learner sees.
 * The animal, the sky and the ground are scenery; the piece tags (a lever) are `data-aid` and stay out of the picture.
 */
const W = 480;
const H = 320;

export const HabitatBuildScene = React.forwardRef<SVGSVGElement, {
  animal: HabitatAnimal;
  placed: readonly string[];
  /** The piece-tags lever: under each piece, what it gives this animal. */
  tags: boolean;
  disabled: boolean;
  onRemove: (index: number) => void;
}>(({ animal, placed, tags, disabled, onRemove }, ref) => (
  <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}
    role="group" aria-label={`The ${animal.name}'s habitat`} data-build-scene="habitat-diorama"
    className="h-auto w-full max-w-[560px] rounded-2xl">
    <rect width={W} height={H * 0.45} fill="#1e3a5f" />
    <rect y={H * 0.45} width={W} height={H * 0.55} fill="#5b4632" />
    <text x={240} y={172} fontSize={64} textAnchor="middle" dominantBaseline="central" data-scenery="animal"
      aria-hidden="true">{animal.emoji}</text>
    {spotsFor(placed).map((spot, i) => {
      const id = placed[i], piece = pieceById(id);
      if (!piece || !spot) return null;
      return (
        <React.Fragment key={`${id}-${i}`}>
          {/* The circle is the hit area: a tap takes the piece out. */}
          <circle cx={spot.x} cy={spot.y} r={30} fill="#0f172a" fillOpacity={0.35} stroke="#94a3b8" strokeOpacity={0.4}
            role="button" aria-label={`Take out ${piece.name}`} data-pip-object={`piece-${i}`} data-piece={id}
            onClick={() => { if (!disabled) onRemove(i); }} style={{ cursor: disabled ? 'default' : 'pointer' }} />
          <text x={spot.x} y={spot.y} fontSize={34} textAnchor="middle" dominantBaseline="central"
            pointerEvents="none" aria-hidden="true">{piece.emoji}</text>
          <text x={spot.x} y={spot.y + 40} fontSize={12} fill="#e2e8f0" textAnchor="middle" pointerEvents="none"
            aria-hidden="true">{piece.name}</text>
          {tags && (
            <text data-aid="piece-tag" data-lever="piece-tag" x={spot.x} y={spot.y - 38} fontSize={11} fontWeight="bold"
              fill="#fbbf24" textAnchor="middle" pointerEvents="none">{pieceTag(animal, id)}</text>
          )}
        </React.Fragment>
      );
    })}
  </svg>
));
HabitatBuildScene.displayName = 'HabitatBuildScene';
