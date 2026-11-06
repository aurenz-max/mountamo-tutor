import React from 'react';
import {
  elementFacts,
  ionShells,
  layoutLewis,
  measureChem,
  MINI_TABLE,
  type ChemFigure,
} from './chemFigure';

const LABEL = { stroke: '#0f172a', strokeWidth: 5, paintOrder: 'stroke' as const };
const OUTER = '#fbbf24';
const ELECTRON = '#7dd3fc';

/** Charge as a superscript-ready string: "+", "2−". */
const chargeText = (c: number) => (c === 0 ? '' : `${Math.abs(c) === 1 ? '' : Math.abs(c)}${c > 0 ? '+' : '−'}`);

/** Bohr models side by side, every count computed from the element and charge. */
function AtomsView({ figure }: { figure: ChemFigure }) {
  const PANEL = 230, H = 278, CX = PANEL / 2, CY = 136;
  const facts = measureChem(figure);
  const centre = new Map(figure.species.map((s, i) => [s.id, i * PANEL + CX]));
  const width = figure.species.length * PANEL;
  return (
    <svg viewBox={`0 0 ${width} ${H}`} className="w-full h-auto max-h-[300px]" data-testid="chem-atoms">
      <defs>
        <marker id="chem-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={OUTER} />
        </marker>
      </defs>
      {figure.species.map((s, i) => {
        const el = elementFacts(s.symbol)!;
        const shells = ionShells(el, s.charge);
        const f = facts[i];
        const ox = i * PANEL;
        return (
          <g key={s.id} data-testid="chem-atom" data-species={f.label}>
            {shells.map((count, k) => {
              const r = 30 + k * 21;
              const outer = figure.showValence && k === shells.length - 1;
              return (
                <g key={k} data-testid="chem-shell" data-electrons={count}>
                  <circle cx={ox + CX} cy={CY} r={r} fill="none" stroke={outer ? OUTER : '#475569'} strokeWidth={outer ? 2 : 1.2} strokeDasharray={outer ? undefined : '3 4'} />
                  {Array.from({ length: count }, (_, e) => {
                    // Pairs sit together, as in a shell diagram: 2 per position, up to 4 positions per 8.
                    const slots = Math.max(4, Math.ceil(count / 2));
                    const pos = Math.floor(e / 2), side = e % 2 ? 1 : -1;
                    const a = -Math.PI / 2 + (pos * 2 * Math.PI) / slots + side * 0.13;
                    return <circle key={e} cx={ox + CX + r * Math.cos(a)} cy={CY + r * Math.sin(a)} r={4} fill={outer ? OUTER : ELECTRON} />;
                  })}
                </g>
              );
            })}
            <circle cx={ox + CX} cy={CY} r={19} fill="#be123c" fillOpacity={0.85} />
            <text x={ox + CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={700} fill="#fff">{s.symbol}</text>
            <text x={ox + CX} y={H - 32} textAnchor="middle" fontSize={20} fontWeight={700} fill="#e2e8f0">
              {s.symbol}{s.charge ? <tspan dy={-8} fontSize={13}>{chargeText(s.charge)}</tspan> : null}
            </text>
            <text x={ox + CX} y={H - 10} textAnchor="middle" fontSize={13} fill="#94a3b8">{f.protons} p⁺ · {f.neutrons} n · {f.electrons} e⁻</text>
          </g>
        );
      })}
      {figure.transfers.map((t, i) => {
        const x1 = centre.get(t.from)!, x2 = centre.get(t.to)!;
        // The arc peaks at y 22, above every shell (the widest reaches y 43); its label sits over the peak.
        const mx = (x1 + x2) / 2, top = 18;
        return (
          <g key={i} data-testid="chem-transfer">
            <path d={`M ${x1 + Math.sign(x2 - x1) * 40} ${top + 26} Q ${mx} ${top - 14} ${x2 - Math.sign(x2 - x1) * 40} ${top + 26}`} fill="none" stroke={OUTER} strokeWidth={2} markerEnd="url(#chem-arrow)" />
            <text x={mx} y={top - 4} textAnchor="middle" fontSize={13} fill={OUTER} {...LABEL}>{t.electrons} e⁻</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Lewis structure: bonds as lines, lone pairs as dot pairs, ions in brackets. */
function LewisView({ figure }: { figure: ChemFigure }) {
  const L = layoutLewis(figure);
  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} className="w-full h-auto max-h-[260px]" data-testid="chem-lewis">
      {L.bonds.map((b, i) => {
        const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) || 1;
        const ux = (b.x2 - b.x1) / len, uy = (b.y2 - b.y1) / len, nx = -uy, ny = ux;
        const inset = 15;
        const offsets = b.order === 1 ? [0] : b.order === 2 ? [-3.5, 3.5] : [-6, 0, 6];
        return (
          <g key={i} data-testid="chem-bond" data-order={b.order}>
            {offsets.map((o, k) => (
              <line key={k} x1={b.x1 + ux * inset + nx * o} y1={b.y1 + uy * inset + ny * o} x2={b.x2 - ux * inset + nx * o} y2={b.y2 - uy * inset + ny * o} stroke="#cbd5e1" strokeWidth={2.2} />
            ))}
          </g>
        );
      })}
      {L.atoms.map((a) => (
        <g key={a.id} data-testid="chem-lewis-atom" data-lone-pairs={a.pairs.length}>
          {a.pairs.map((p, k) => {
            const tx = -Math.sin(p.angle) * 4, ty = Math.cos(p.angle) * 4;
            return (
              <g key={k} data-testid="chem-lone-pair">
                <circle cx={p.x + tx} cy={p.y + ty} r={2.6} fill={ELECTRON} />
                <circle cx={p.x - tx} cy={p.y - ty} r={2.6} fill={ELECTRON} />
              </g>
            );
          })}
          <text x={a.x} y={a.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={20} fontWeight={700} fill="#e2e8f0">{a.label}</text>
          {a.bracket && (
            <>
              <path d={`M ${a.x - 26} ${a.y - 30} h -6 v 60 h 6`} fill="none" stroke="#94a3b8" strokeWidth={1.6} />
              <path d={`M ${a.x + 26} ${a.y - 30} h 6 v 60 h -6`} fill="none" stroke="#94a3b8" strokeWidth={1.6} />
            </>
          )}
          {a.charge !== 0 && (
            <text x={a.x + (a.bracket ? 38 : 16)} y={a.y - 22} fontSize={14} fontWeight={700} fill={OUTER}>{chargeText(a.charge)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** H to Kr in table position, with picked-out elements and an optional trend arrow. */
function PeriodicView({ figure }: { figure: ChemFigure }) {
  const C = 30, G = 2, LEFT = 22, TOP = 34;
  const width = LEFT + 18 * (C + G) + 8;
  const valenceRow = figure.trend === 'valence-electrons';
  const height = TOP + 4 * (C + G) + (valenceRow ? 26 : 8) + (figure.trend === 'none' || valenceRow ? 0 : 30);
  const any = figure.highlight.length > 0;
  const x = (group: number) => LEFT + (group - 1) * (C + G);
  const y = (period: number) => TOP + (period - 1) * (C + G);
  const arrowY = TOP + 4 * (C + G) + 18;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" data-testid="chem-periodic">
      <defs>
        <marker id="chem-trend" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={OUTER} />
        </marker>
      </defs>
      {Array.from({ length: 18 }, (_, i) => (
        <text key={i} x={x(i + 1) + C / 2} y={TOP - 8} textAnchor="middle" fontSize={10} fill="#64748b">{i + 1}</text>
      ))}
      {[1, 2, 3, 4].map((p) => (
        <text key={p} x={LEFT - 8} y={y(p) + C / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#64748b">{p}</text>
      ))}
      {MINI_TABLE.map((e) => {
        const on = figure.highlight.includes(e.symbol);
        return (
          <g key={e.symbol} data-testid={on ? 'chem-cell-highlight' : 'chem-cell'} opacity={any && !on ? 0.35 : 1}>
            <rect x={x(e.group)} y={y(e.period)} width={C} height={C} rx={3} fill={on ? 'rgba(251,191,36,0.25)' : 'rgba(148,163,184,0.12)'} stroke={on ? OUTER : '#334155'} strokeWidth={on ? 2 : 1} />
            <text x={x(e.group) + 3} y={y(e.period) + 8} fontSize={7} fill="#94a3b8">{e.z}</text>
            <text x={x(e.group) + C / 2} y={y(e.period) + C / 2 + 4} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#e2e8f0">{e.symbol}</text>
          </g>
        );
      })}
      {valenceRow && [1, 2, 13, 14, 15, 16, 17, 18].map((g) => (
        <text key={g} x={x(g) + C / 2} y={TOP + 4 * (C + G) + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={OUTER} data-testid="chem-valence-count">{g <= 2 ? g : g - 10}</text>
      ))}
      {(figure.trend === 'electronegativity' || figure.trend === 'atomic-radius') && (
        <g data-testid="chem-trend">
          {figure.trend === 'electronegativity'
            ? <line x1={x(1)} y1={arrowY} x2={x(18) + C} y2={arrowY} stroke={OUTER} strokeWidth={2} markerEnd="url(#chem-trend)" />
            : <line x1={x(18) + C} y1={arrowY} x2={x(1)} y2={arrowY} stroke={OUTER} strokeWidth={2} markerEnd="url(#chem-trend)" />}
          <text x={width / 2} y={arrowY + 16} textAnchor="middle" fontSize={11} fill={OUTER}>
            {figure.trend === 'electronegativity' ? 'electronegativity increases across a period (and up a group)' : 'atoms get larger toward the left (and down a group)'}
          </text>
        </g>
      )}
    </svg>
  );
}

/** A chemistry figure drawn from species, bonds and the element table (see chemFigure.ts). */
export function ChemFigureView({ figure, altText }: { figure: ChemFigure; altText: string }) {
  return (
    <div role="img" aria-label={altText} data-testid="chem-figure" data-view={figure.view}>
      {figure.view === 'atoms' && <AtomsView figure={figure} />}
      {figure.view === 'lewis' && <LewisView figure={figure} />}
      {figure.view === 'periodic' && <PeriodicView figure={figure} />}
    </div>
  );
}
