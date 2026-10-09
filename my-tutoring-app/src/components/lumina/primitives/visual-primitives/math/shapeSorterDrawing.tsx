import React from 'react';

const SHAPE_COLORS: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  purple: '#a855f7', orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4',
};

/** The fill a colour name is drawn in (also the `mat_pictures` swatch, so a mat and a shape never disagree). */
export const shapeFill = (color: string): string => SHAPE_COLORS[color] || color || '#94a3b8';

/**
 * A polygon's corners before rotation, in drawing order, or null for a curved shape. The one source of the
 * drawn geometry: the polygon, its corner dots and every lever mark read it.
 */
export function shapeCorners(shape: string, cx: number, cy: number, s: number): number[][] | null {
  switch (shape) {
    case 'square': {
      const half = s / 2;
      return [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]];
    }
    case 'triangle': {
      const h = s * 0.866;
      return [[cx, cy - h / 2], [cx - s / 2, cy + h / 2], [cx + s / 2, cy + h / 2]];
    }
    case 'rectangle': {
      // Drawn 2:1 on purpose — a rectangle and a square must never both be
      // defensible names for one drawing (the K convention di-shapes states).
      const w = s * 1.4, h = s * 0.7;
      return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
    }
    case 'diamond':
    case 'rhombus': {
      // ONE branch, so these are the SAME drawing — which is why the script
      // accepts either name for either item rather than judging one wrong.
      const half = s / 2;
      return [[cx, cy - half * 1.2], [cx + half, cy], [cx, cy + half * 1.2], [cx - half, cy]];
    }
    case 'hexagon':
    case 'pentagon': {
      const n = shape === 'hexagon' ? 6 : 5, r = s / 2;
      return Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI / n) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
    }
    default:
      return null;
  }
}

/** Lever marks drawn on a polygon, inside its rotation. Never a numeral, never an order. */
export interface ShapeMarks {
  /** A tick across the middle of every side (`side_ticks`, and the `model_count` card on a sides count). */
  ticks?: boolean;
  /** `start_mark`: one dot on the first side or corner. */
  start?: 'side' | 'corner';
  /** `touch_marks`: each side or corner is a tap target; a tapped one is marked. */
  tap?: { kind: 'side' | 'corner'; marked: ReadonlySet<number>; onTap: (index: number) => void };
}

export function renderShapeSVG(
  shape: string, cx: number, cy: number, baseSize: number,
  color: string, rotation: number,
  opts?: { dimmed?: boolean; showCorners?: boolean; emoji?: string; marks?: ShapeMarks },
): React.ReactNode {
  // A real-world stimulus is drawn AS the object: the child has to see the
  // shape in the clock face, which is the whole task. Drawing the outline too
  // would hand them the answer.
  if (opts?.emoji) {
    return (
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={baseSize}
        opacity={opts.dimmed ? 0.25 : 1}
        className="select-none"
      >
        {opts.emoji}
      </text>
    );
  }
  const fill = shapeFill(color);
  const opacity = opts?.dimmed ? 0.25 : 1;
  const stroke = 'rgba(255,255,255,0.3)';
  const s = baseSize;
  const transform = `rotate(${rotation} ${cx} ${cy})`;
  const corners = shapeCorners(shape, cx, cy, s);

  let shapeEl: React.ReactNode;
  if (corners) {
    shapeEl = <polygon points={corners.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
      strokeWidth={1.5} opacity={opacity} transform={transform} />;
  } else if (shape === 'oval') {
    shapeEl = <ellipse cx={cx} cy={cy} rx={s * 0.65} ry={s * 0.4} fill={fill}
      stroke={stroke} strokeWidth={1.5} opacity={opacity} transform={transform} />;
  } else {
    shapeEl = <circle cx={cx} cy={cy} r={s / 2} fill={fill} stroke={stroke}
      strokeWidth={1.5} opacity={opacity} transform={transform} />;
  }

  /** Corner dots mark WHERE to count, never HOW MANY — no number is printed,
   *  and the child still has to enumerate them out loud. */
  const cornerDots = corners && opts?.showCorners
    ? corners.map(([x, y], i) => <circle key={`corner-${i}`} data-shape-corner-dot={i} cx={x} cy={y} r={4} fill="#fbbf24"
      stroke="#000" strokeWidth={1} transform={transform} />)
    : null;

  const marks = corners && opts?.marks ? <g transform={transform}><MarksLayer corners={corners} marks={opts.marks} /></g> : null;
  return <g>{shapeEl}{cornerDots}{marks}</g>;
}

const sidesOf = (points: number[][]) => points.map((p, i) => [p, points[(i + 1) % points.length]] as const);
const midpoint = ([a, b]: readonly [number[], number[]]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;

function MarksLayer({ corners, marks }: { corners: number[][]; marks: ShapeMarks }) {
  const sides = sidesOf(corners);
  return <>
    {marks.ticks && sides.map((side, i) => {
      const [[x1, y1], [x2, y2]] = side, [mx, my] = midpoint(side);
      const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      return <line key={`t${i}`} data-shape-tick={i} x1={mx - nx * 7} y1={my - ny * 7} x2={mx + nx * 7} y2={my + ny * 7}
        stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" />;
    })}
    {marks.tap?.kind === 'side' && sides.map((side, i) => {
      const [[x1, y1], [x2, y2]] = side, on = marks.tap!.marked.has(i);
      return <line key={`s${i}`} data-shape-tap="side" data-tap-index={i} data-marked={on} role="button" aria-label="A side"
        x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? '#fbbf24' : 'rgba(0,0,0,0)'} strokeWidth={on ? 6 : 16}
        strokeLinecap="round" style={{ cursor: 'pointer', pointerEvents: 'stroke' }} onClick={() => marks.tap!.onTap(i)} />;
    })}
    {marks.tap?.kind === 'corner' && corners.map(([x, y], i) => {
      const on = marks.tap!.marked.has(i);
      return <circle key={`k${i}`} data-shape-tap="corner" data-tap-index={i} data-marked={on} role="button" aria-label="A corner"
        cx={x} cy={y} r={9} fill="rgba(0,0,0,0)" stroke={on ? '#fbbf24' : 'none'} strokeWidth={3}
        style={{ cursor: 'pointer', pointerEvents: 'all' }} onClick={() => marks.tap!.onTap(i)} />;
    })}
    {marks.start && (() => {
      const [x, y] = marks.start === 'side' ? midpoint(sides[0]) : corners[0];
      return <circle data-shape-start={marks.start} cx={x} cy={y} r={6} fill="#f472b6" stroke="#fdf2f8" strokeWidth={2}
        style={{ pointerEvents: 'none' }} />;
    })()}
  </>;
}
