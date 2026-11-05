import React from 'react';
import { layoutGeometry, type GeometryFigure } from './geometryFigure';

const SHADE_FILL = { a: '#38bdf8', b: '#fbbf24', none: '#38bdf8' } as const;
const SHADE_OPACITY = { a: 0.2, b: 0.2, none: 0.06 } as const;
const LABEL = { fill: '#e2e8f0', stroke: '#0f172a', strokeWidth: 5, paintOrder: 'stroke' as const, fontSize: 17 };

/** A to-scale figure drawn from named points (see geometryFigure.ts). */
export function GeometryFigureView({ figure, altText }: { figure: GeometryFigure; altText: string }) {
  const L = layoutGeometry(figure);
  const at = new Map(figure.points.map((p) => [p.name, L.toSvg(p)]));
  const away = (x: number, y: number, d: number) => {
    const dx = x - L.centroid.x, dy = y - L.centroid.y, n = Math.hypot(dx, dy) || 1;
    return { x: x + (dx / n) * d, y: y + (dy / n) * d };
  };

  return (
    <svg role="img" aria-label={altText} viewBox={`0 0 ${L.width} ${L.height}`} className="w-full h-auto text-slate-200" data-testid="geometry-figure">
      {figure.polygons.map((g, i) => {
        const pts = g.vertices.map((n) => at.get(n)!);
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        return (
          <g key={`poly-${i}`} data-testid="geometry-polygon">
            <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill={SHADE_FILL[g.shade]} fillOpacity={SHADE_OPACITY[g.shade]} stroke="#cbd5e1" strokeWidth="2.5" strokeLinejoin="round" />
            {g.label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" {...LABEL} fill={g.shade === 'b' ? '#fcd34d' : g.shade === 'a' ? '#7dd3fc' : LABEL.fill}>{g.label}</text>}
          </g>
        );
      })}
      {figure.segments.map((s, i) => {
        const a = at.get(s.from)!, b = at.get(s.to)!;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        if (nx * (mx - L.centroid.x) + ny * (my - L.centroid.y) < 0) { nx = -nx; ny = -ny; }
        return (
          <g key={`seg-${i}`} data-testid="geometry-segment">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={s.style === 'dashed' ? '#fbbf24' : '#cbd5e1'} strokeWidth="2.5" strokeDasharray={s.style === 'dashed' ? '7 6' : undefined} />
            {s.label && <text x={mx + nx * 18} y={my + ny * 18} textAnchor="middle" dominantBaseline="middle" {...LABEL} fill={/\?/.test(s.label) ? '#fbbf24' : LABEL.fill}>{s.label}</text>}
          </g>
        );
      })}
      {figure.angles.map((g, i) => {
        const v = at.get(g.vertex)!, p = at.get(g.from)!, q = at.get(g.to)!;
        const a1 = Math.atan2(p.y - v.y, p.x - v.x), a2 = Math.atan2(q.y - v.y, q.x - v.x);
        if (g.kind === 'right') {
          const s = 14;
          const u = { x: Math.cos(a1) * s, y: Math.sin(a1) * s }, w = { x: Math.cos(a2) * s, y: Math.sin(a2) * s };
          return <path key={`ang-${i}`} data-testid="geometry-right-angle" d={`M ${v.x + u.x} ${v.y + u.y} L ${v.x + u.x + w.x} ${v.y + u.y + w.y} L ${v.x + w.x} ${v.y + w.y}`} fill="none" stroke="#cbd5e1" strokeWidth="2" />;
        }
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta <= -Math.PI) delta += 2 * Math.PI;
        const r = 28, mid = a1 + delta / 2;
        return (
          <g key={`ang-${i}`} data-testid="geometry-angle">
            <path d={`M ${v.x + Math.cos(a1) * r} ${v.y + Math.sin(a1) * r} A ${r} ${r} 0 0 ${delta > 0 ? 1 : 0} ${v.x + Math.cos(a2) * r} ${v.y + Math.sin(a2) * r}`} fill="none" stroke="#a78bfa" strokeWidth="2" />
            {g.label && <text x={v.x + Math.cos(mid) * (r + 18)} y={v.y + Math.sin(mid) * (r + 18)} textAnchor="middle" dominantBaseline="middle" {...LABEL} fontSize={15} fill="#c4b5fd">{g.label}</text>}
          </g>
        );
      })}
      {figure.points.map((pt) => {
        const s = at.get(pt.name)!, o = away(s.x, s.y, 16);
        return (
          <g key={`pt-${pt.name}`}>
            <circle cx={s.x} cy={s.y} r="3" fill="#e2e8f0" />
            <text x={o.x} y={o.y} textAnchor="middle" dominantBaseline="middle" {...LABEL} fontSize={15} fontStyle="italic" fill="#94a3b8">{pt.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
