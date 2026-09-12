import React from 'react';
import { numberLineLabel, numberLineLandings, type DiagramVisual } from './diagramVisual';

export function StructuredDiagram({ visual, altText }: { visual: DiagramVisual; altText: string }) {
  const base = { role: 'img', 'aria-label': altText, className: 'w-full h-auto text-slate-200' } as const;
  if (visual.kind === 'number-line') {
    const x = (n: number) => 35 + (n - visual.min) / (visual.max - visual.min) * 570;
    const landings = numberLineLandings(visual);
    const labelEvery = Math.max(1, Math.ceil(visual.divisions / 10));
    return <svg {...base} viewBox="0 0 640 190">
      <line x1="35" y1="125" x2="605" y2="125" stroke="currentColor" strokeWidth="2" />
      {Array.from({ length: visual.divisions + 1 }, (_, i) => {
        const n = visual.min + (visual.max - visual.min) * i / visual.divisions;
        return <g key={i}><line x1={x(n)} y1="119" x2={x(n)} y2="132" stroke="currentColor" />
          {(i % labelEvery === 0 || i === visual.divisions) && <text x={x(n)} y="155" textAnchor="middle" fill="currentColor" fontSize="16">{numberLineLabel(visual, n)}</text>}
        </g>;
      })}
      {visual.jumps.map((jump, i) => {
        const from = x(landings[i]), to = x(landings[i + 1]);
        const y = 40 + (i % 3) * 15;
        const color = i % 2 ? '#fbbf24' : '#38bdf8';
        return <g key={i} data-testid="number-line-jump">
          <path d={`M ${from} 112 Q ${(from + to) / 2} ${y} ${to} 112`} fill="none" stroke={color} strokeWidth="3" />
          <circle cx={to} cy="112" r="4" fill={color} />
          <text x={(from + to) / 2} y={(112 + y) / 2 - 10} textAnchor="middle" fill={color} fontSize="17">{jump >= 0 ? '+' : ''}{numberLineLabel(visual, jump)}</text>
        </g>;
      })}
      {landings.map((n, i) => <g key={i}><circle cx={x(n)} cy="125" r="4" fill="#38bdf8" /><text x={x(n)} y="180" textAnchor="middle" fill="#38bdf8" fontSize="16">{numberLineLabel(visual, n)}</text></g>)}
    </svg>;
  }
  if (visual.kind === 'groups') {
    const columns = Math.min(visual.counts.length, 4);
    const cellWidth = 640 / columns;
    const height = Math.ceil(visual.counts.length / columns) * 170 + 35;
    return <svg {...base} viewBox={`0 0 640 ${height}`}>
      <text x="320" y="24" textAnchor="middle" fill="currentColor" fontSize="18">Each dot is one {visual.itemLabel}</text>
      {visual.counts.map((count, i) => <g key={i} transform={`translate(${i % columns * cellWidth}, ${Math.floor(i / columns) * 170 + 35})`} data-testid="counted-group">
        <rect x="8" y="5" width={cellWidth - 16} height="150" rx="14" fill="#0f172a" stroke="#475569" />
        {Array.from({ length: count }, (_, n) => <circle key={n} data-testid="group-counter" cx={cellWidth / 2 - 44 + (n % 5) * 22} cy={30 + Math.floor(n / 5) * 25} r="8" fill="#38bdf8" />)}
        <text x={cellWidth / 2} y="140" textAnchor="middle" fill="currentColor" fontSize="17">Group {i + 1}</text>
      </g>)}
    </svg>;
  }
  if (visual.kind === 'fraction-bar') return <svg {...base} viewBox="0 0 640 130">
    {Array.from({ length: visual.denominator }, (_, i) => <rect key={i} data-testid={i < visual.numerator ? 'filled-fraction-part' : 'fraction-part'} x={25 + i * 590 / visual.denominator} y="25" width={590 / visual.denominator} height="55" fill={i < visual.numerator ? '#38bdf8' : '#0f172a'} stroke="#cbd5e1" strokeWidth="2" />)}
    <text x="320" y="113" textAnchor="middle" fill="currentColor" fontSize="20">{visual.numerator} of {visual.denominator} equal parts</text>
  </svg>;
  return <svg {...base} viewBox="0 0 640 360">{visual.shapes.map((s, i) => {
    if (s.kind === 'line') return <line key={i} x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke="#38bdf8" strokeWidth="3" />;
    if (s.kind === 'rect') return <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} fill="#38bdf8" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="3" />;
    if (s.kind === 'circle') return <circle key={i} cx={s.x} cy={s.y} r={s.radius} fill="#38bdf8" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="3" />;
    return <text key={i} x={s.x} y={s.y} fill="currentColor" fontSize="18">{s.text}</text>;
  })}</svg>;
}
