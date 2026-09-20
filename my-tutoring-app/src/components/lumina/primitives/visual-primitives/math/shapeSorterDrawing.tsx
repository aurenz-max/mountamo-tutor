import React from 'react';

const SHAPE_COLORS: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  purple: '#a855f7', orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4',
};

export function renderShapeSVG(
  shape: string, cx: number, cy: number, baseSize: number,
  color: string, rotation: number,
  opts?: { dimmed?: boolean; showCorners?: boolean; emoji?: string },
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
  const fill = SHAPE_COLORS[color] || color || '#94a3b8';
  const opacity = opts?.dimmed ? 0.25 : 1;
  const stroke = 'rgba(255,255,255,0.3)';
  const s = baseSize;
  const transform = `rotate(${rotation} ${cx} ${cy})`;

  let shapeEl: React.ReactNode = null;
  const cornerDots: React.ReactNode[] = [];

  /** Corner dots mark WHERE to count, never HOW MANY — no number is printed,
   *  and the child still has to enumerate them out loud. */
  const addCornerDots = (corners: number[][]) => {
    if (!opts?.showCorners) return;
    corners.forEach(([x, y], i) => {
      cornerDots.push(
        <circle key={`corner-${i}`} cx={x} cy={y} r={4} fill="#fbbf24"
          stroke="#000" strokeWidth={1} transform={transform} />
      );
    });
  };

  switch (shape) {
    case 'circle': {
      shapeEl = <circle cx={cx} cy={cy} r={s / 2} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      break;
    }
    case 'oval': {
      shapeEl = <ellipse cx={cx} cy={cy} rx={s * 0.65} ry={s * 0.4} fill={fill}
        stroke={stroke} strokeWidth={1.5} opacity={opacity} transform={transform} />;
      break;
    }
    case 'square': {
      const half = s / 2;
      const c = [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'triangle': {
      const h = s * 0.866;
      const c = [[cx, cy - h / 2], [cx - s / 2, cy + h / 2], [cx + s / 2, cy + h / 2]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'rectangle': {
      // Drawn 2:1 on purpose — a rectangle and a square must never both be
      // defensible names for one drawing (the K convention di-shapes states).
      const w = s * 1.4, h = s * 0.7;
      const c = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'diamond':
    case 'rhombus': {
      // ONE branch, so these are the SAME drawing — which is why the script
      // accepts either name for either item rather than judging one wrong.
      const half = s / 2;
      const c = [[cx, cy - half * 1.2], [cx + half, cy], [cx, cy + half * 1.2], [cx - half, cy]];
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'hexagon': {
      const r = s / 2;
      const c = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    case 'pentagon': {
      const r = s / 2;
      const c = Array.from({ length: 5 }, (_, i) => {
        const a = (2 * Math.PI / 5) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      shapeEl = <polygon points={c.map(p => p.join(',')).join(' ')} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
      addCornerDots(c);
      break;
    }
    default: {
      shapeEl = <circle cx={cx} cy={cy} r={s / 2} fill={fill} stroke={stroke}
        strokeWidth={1.5} opacity={opacity} transform={transform} />;
    }
  }

  return <g>{shapeEl}{cornerDots}</g>;
}
