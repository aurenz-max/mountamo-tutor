'use client';

import React from 'react';
import type { Organism } from './FoodWebBuilder';
import type { Arrow } from './foodWebWorkspace';
import { FOOD_TAG } from './foodWebLevers';

/**
 * Food-web-builder's open-build surface (`build_chain`): an empty scene the learner fills with living things from the
 * list and joins with arrows. One svg, so the build layer's picture (`svgPicture`) is exactly what the learner sees.
 * Every card has the same colour and sits in a scattered slot in the order it was put in, so neither colour nor
 * height says what eats what. The selection ring and the levers' words are aids (`data-aid`), left out of the picture.
 */
export const SCENE_W = 640;
export const SCENE_H = 400;
const CARD_W = 128;
const CARD_H = 46;
/** Scattered slots, filled lowest free first: no row or column order to read a trophic level from. */
const SLOTS: ReadonlyArray<[number, number]> = [
  [110, 70], [330, 200], [540, 80], [140, 330], [520, 320], [330, 60], [100, 200], [560, 200], [330, 340], [230, 135],
];
export const SCENE_CAPACITY = SLOTS.length;

export interface PlacedOrganism { id: string; slot: number }

/** The lowest slot no placed living thing holds. */
export const freeSlot = (placed: readonly PlacedOrganism[]) => SLOTS.findIndex((_, i) => !placed.some(p => p.slot === i));

/** The arrow from the edge of one card to the edge of the other. */
function edge(from: [number, number], to: [number, number]) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const t = Math.min((CARD_W / 2 + 6) / Math.max(Math.abs(dx), 1e-6), (CARD_H / 2 + 6) / Math.max(Math.abs(dy), 1e-6), 0.45);
  return { x1: from[0] + dx * t, y1: from[1] + dy * t, x2: to[0] - dx * t, y2: to[1] - dy * t };
}

export const FoodChainScene = React.forwardRef<SVGSVGElement, {
  organisms: readonly Organism[];
  placed: readonly PlacedOrganism[];
  arrows: readonly Arrow[];
  selected: string | null;
  /** Levers: "eaten by" along every arrow; a food tag under every card. */
  arrowWords: boolean;
  foodTags: boolean;
  disabled: boolean;
  onTapOrganism: (id: string) => void;
  onTapArrow: (arrow: Arrow) => void;
}>(({ organisms, placed, arrows, selected, arrowWords, foodTags, disabled, onTapOrganism, onTapArrow }, ref) => {
  const at = new Map(placed.map(p => [p.id, SLOTS[p.slot]]));
  const name = (id: string) => organisms.find(o => o.id === id)?.name ?? id;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H}
      role="group" aria-label="Your food chain scene" data-build-scene="food-chain" className="h-auto w-full max-w-full rounded-xl">
      <defs>
        <marker id="food-chain-head" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L10,5 L0,10 z" fill="#e2e8f0" />
        </marker>
      </defs>
      <rect width={SCENE_W} height={SCENE_H} rx={14} fill="#13202f" />
      {arrows.map(a => {
        const from = at.get(a.fromId), to = at.get(a.toId);
        if (!from || !to) return null;
        const e = edge(from, to);
        const label = `the arrow from ${name(a.fromId)} to ${name(a.toId)}`;
        return (
          <React.Fragment key={`${a.fromId}>${a.toId}`}>
            <line {...e} stroke="#e2e8f0" strokeWidth={3} markerEnd="url(#food-chain-head)" style={{ pointerEvents: 'none' }} />
            {/* The arrow's own hit area: a wide stroke of transparent paint, tapped to take the arrow out. */}
            <line {...e} stroke="#000" strokeOpacity={0} strokeWidth={22} role="button" aria-label={`Take out ${label}`}
              data-pip-object={`arrow-${a.fromId}-${a.toId}`} style={{ cursor: disabled ? 'default' : 'pointer', pointerEvents: 'stroke' }}
              onClick={() => { if (!disabled) onTapArrow(a); }} />
            {arrowWords && (
              <text data-aid="arrow-words" data-lever="arrow-words" x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 8} fontSize={14}
                fontWeight="bold" fill="#fdba74" textAnchor="middle" style={{ pointerEvents: 'none' }}>eaten by</text>
            )}
          </React.Fragment>
        );
      })}
      {placed.map(p => {
        const [cx, cy] = SLOTS[p.slot], o = organisms.find(x => x.id === p.id);
        if (!o) return null;
        const on = selected === p.id;
        return (
          <React.Fragment key={p.id}>
            {on && <rect data-aid="selected" x={cx - CARD_W / 2 - 5} y={cy - CARD_H / 2 - 5} width={CARD_W + 10} height={CARD_H + 10}
              rx={14} fill="none" stroke="#38bdf8" strokeWidth={3} style={{ pointerEvents: 'none' }} />}
            {/* The painted card is its own hit area. */}
            <rect x={cx - CARD_W / 2} y={cy - CARD_H / 2} width={CARD_W} height={CARD_H} rx={10} fill="#1e3a2f" stroke="#6ee7b7"
              strokeWidth={1.5} role="button" aria-label={`${o.name} in your scene`} aria-pressed={on} data-pip-object={`scene-${o.id}`}
              data-placed={o.id} onClick={() => { if (!disabled) onTapOrganism(o.id); }} style={{ cursor: disabled ? 'default' : 'pointer' }} />
            <text x={cx} y={cy + 6} fontSize={o.name.length > 12 ? 13 : 17} fontWeight="bold" fill="#ecfdf5" textAnchor="middle" style={{ pointerEvents: 'none' }}>
              {o.name}
            </text>
            {foodTags && (
              <text data-aid="food-tag" data-lever="food-tag" x={cx} y={cy + CARD_H / 2 + 16} fontSize={12} fill="#fdba74"
                textAnchor="middle" style={{ pointerEvents: 'none' }}>{FOOD_TAG[o.trophicLevel]}</text>
            )}
          </React.Fragment>
        );
      })}
    </svg>
  );
});
FoodChainScene.displayName = 'FoodChainScene';
