'use client';

import React from 'react';

/**
 * The counting board's open-build surface (`build_n`): an empty scene the child fills by tapping, one
 * object per tap, and empties by tapping an object again. One svg, so the build layer's picture
 * (`svgPicture`) is exactly what the child sees. Nothing here counts for the child: the running count
 * and the order tags are levers the board passes in, off until pulled.
 */
export const SCENE_W = 480;
export const SCENE_H = 320;
const OBJ = 36;
/** Taps closer than this to an object already placed are ignored, so no object hides another. */
const MIN_GAP = 30;
export const MAX_BUILT = 30;

export interface BuiltSpot { x: number; y: number }

/** Where a tap lands, or null when it would sit on top of an object already there. */
export function spotFor(built: readonly BuiltSpot[], x: number, y: number): BuiltSpot | null {
  const cx = Math.max(OBJ / 2, Math.min(SCENE_W - OBJ / 2, x)), cy = Math.max(OBJ / 2, Math.min(SCENE_H - OBJ / 2, y));
  if (built.length >= MAX_BUILT || built.some(b => Math.hypot(b.x - cx, b.y - cy) < MIN_GAP)) return null;
  return { x: Math.round(cx), y: Math.round(cy) };
}

const Backdrop: React.FC<{ objectWord: string }> = ({ objectWord }) => {
  switch (objectWord) {
    case 'apples':
      return <>
        <rect width={SCENE_W} height={SCENE_H} fill="#d7ecf5" />
        <rect y={270} width={SCENE_W} height={50} fill="#9cc58a" />
        <rect x={222} y={170} width={36} height={110} rx={8} fill="#8a5a3c" />
        <ellipse cx={240} cy={120} rx={190} ry={105} fill="#6fae5c" />
        <ellipse cx={160} cy={100} rx={90} ry={70} fill="#7dbb69" opacity={0.7} />
        <ellipse cx={320} cy={110} rx={90} ry={70} fill="#7dbb69" opacity={0.7} />
      </>;
    case 'fish':
      return <>
        <rect width={SCENE_W} height={SCENE_H} fill="#cfe9f2" />
        <rect y={40} width={SCENE_W} height={280} rx={30} fill="#5fa8d3" />
        {[30, 70, 420, 450].map(x => <path key={x} d={`M ${x} 320 Q ${x - 8} 250 ${x + 4} 200`} stroke="#3f8c57" strokeWidth={6} fill="none" />)}
      </>;
    case 'stars':
      return <>
        <rect width={SCENE_W} height={SCENE_H} fill="#1f2347" />
        <circle cx={420} cy={50} r={26} fill="#f4efc8" />
        <circle cx={432} cy={42} r={24} fill="#1f2347" />
        <path d={`M 0 300 Q 120 240 240 290 T ${SCENE_W} 280 V ${SCENE_H} H 0 Z`} fill="#2d3a5c" />
      </>;
    case 'bears':
      return <>
        <rect width={SCENE_W} height={SCENE_H} fill="#a9cf8f" />
        <rect x={50} y={40} width={380} height={240} rx={14} fill="#f2f0ea" />
        {Array.from({ length: 6 }, (_, i) => <rect key={`v${i}`} x={50 + i * 66} y={40} width={33} height={240} fill="#e06a5b" opacity={0.35} />)}
        {Array.from({ length: 4 }, (_, i) => <rect key={`h${i}`} x={50} y={40 + i * 66} width={380} height={33} fill="#e06a5b" opacity={0.35} />)}
      </>;
    case 'butterflies':
      return <>
        <rect width={SCENE_W} height={SCENE_H} fill="#dcefff" />
        <rect y={280} width={SCENE_W} height={40} fill="#9cc58a" />
        {[40, 120, 200, 280, 360, 440].map((x, i) => <g key={x}>
          <line x1={x} y1={320} x2={x} y2={272} stroke="#3f8c57" strokeWidth={4} />
          <circle cx={x} cy={266} r={11} fill={['#f29bb8', '#f6c453', '#b39ad6'][i % 3]} />
        </g>)}
      </>;
    case 'blocks':
      return <>
        <rect width={SCENE_W} height={SCENE_H} fill="#e9e1d3" />
        <rect x={30} y={30} width={420} height={260} rx={20} fill="#9ec9e2" />
        <rect x={50} y={50} width={380} height={220} rx={14} fill="#bfe0c5" />
      </>;
    default:
      return <rect width={SCENE_W} height={SCENE_H} rx={12} fill="#eef3f6" />;
  }
};

export const CountingBuildScene = React.forwardRef<SVGSVGElement, {
  objectWord: string;
  emoji: string;
  built: readonly BuiltSpot[];
  /** The order-tags lever: each object carries the number of the tap that put it in. */
  tags: boolean;
  disabled: boolean;
  onPlace: (spot: BuiltSpot) => void;
  onRemove: (index: number) => void;
}>(({ objectWord, emoji, built, tags, disabled, onPlace, onRemove }, ref) => {
  const place = (e: React.MouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const svg = e.currentTarget, ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const spot = spotFor(built, p.x, p.y);
    if (spot) onPlace(spot);
  };
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H}
      role="group" aria-label={`Build scene: tap to put ${objectWord} in`} data-build-scene={objectWord}
      className={`h-auto max-w-full rounded-xl ${disabled ? '' : 'cursor-pointer'}`} onClick={place}>
      <Backdrop objectWord={objectWord} />
      {built.map((b, i) => (
        <g key={`${b.x},${b.y}`} data-built-index={i} role="button" aria-label={`Take out ${objectWord} ${i + 1}`}
          onClick={(e) => { e.stopPropagation(); if (!disabled) onRemove(i); }} style={{ cursor: disabled ? 'default' : 'pointer' }}>
          <text x={b.x} y={b.y} fontSize={OBJ} textAnchor="middle" dominantBaseline="central"
            style={{ fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif' }}>{emoji}</text>
          {tags && (
            <g data-aid="tag">
              <circle cx={b.x + OBJ / 2 - 4} cy={b.y - OBJ / 2 + 4} r={9} fill="#f97316" />
              <text x={b.x + OBJ / 2 - 4} y={b.y - OBJ / 2 + 4} fontSize={11} fill="white" fontWeight="bold"
                textAnchor="middle" dominantBaseline="central">{i + 1}</text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
});
CountingBuildScene.displayName = 'CountingBuildScene';
