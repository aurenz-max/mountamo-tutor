'use client';

/**
 * Charts for the progress report: minutes per week with masteries marked,
 * weekly accuracy against the 70-85% learning band, and the grade map (one
 * cell per subskill, colored by mastery gate). Hand-built SVG; hover shows the
 * week's numbers. Data: ProgressReportResponse (studentAnalyticsAPI).
 */

import React, { useRef, useState } from 'react';
import { surface } from '../../ui/tokens';
import type { ProgressReportCell, ProgressReportSubject, ProgressReportWeek } from '@/lib/studentAnalyticsAPI';

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const W = 800;
const LEFT = 44;
const RIGHT = 790;

function WeekTip({ week }: { week: ProgressReportWeek | null }) {
  if (!week) return <p className="text-xs text-slate-500 h-5">Hover a week for its numbers.</p>;
  return (
    <p className="text-xs text-slate-300 h-5 tabular-nums">
      <span className="font-semibold text-slate-100">Week of {shortDate(week.week_of)}:</span>{' '}
      {week.minutes} min · {week.active_days} day{week.active_days === 1 ? '' : 's'} · {week.answers} answers
      {week.accuracy != null && ` · ${week.accuracy}% right`} · {week.mastered} mastered · {week.checks_passed} checks passed
    </p>
  );
}

export function MinutesChart({ weeks }: { weeks: ProgressReportWeek[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = 34;
  const base = 172;
  const max = Math.max(60, Math.ceil(Math.max(...weeks.map((w) => w.minutes)) / 60) * 60);
  const step = (RIGHT - LEFT) / weeks.length;
  const bw = Math.min(30, step - 8);
  const ticks = [0, max / 3, (2 * max) / 3, max];
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} 200`} className="w-full h-auto" role="img" aria-label="Minutes practiced per week">
        {ticks.map((v) => {
          const y = base - (v / max) * (base - top);
          return (
            <g key={v}>
              <line x1={LEFT} x2={RIGHT} y1={y} y2={y} className="stroke-white/10" />
              <text x={LEFT - 8} y={y + 4} textAnchor="end" className="fill-slate-500 text-[12px]">{Math.round(v)}</text>
            </g>
          );
        })}
        {weeks.map((w, i) => {
          const x = LEFT + i * step + (step - bw) / 2;
          const h = (w.minutes / max) * (base - top);
          const dotY = Math.max(top - 12, base - h - 11);
          return (
            <g key={w.week_of} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {w.minutes > 0 && (
                <rect x={x} y={base - h} width={bw} height={Math.max(h, 2)} rx={4}
                  className={hover === i ? 'fill-emerald-300' : 'fill-emerald-500/80'} />
              )}
              {w.mastered > 0 && (
                <>
                  <circle cx={x + bw / 2} cy={dotY} r={5} className="fill-amber-400 stroke-slate-900" strokeWidth={2} />
                  {w.mastered > 1 && (
                    <text x={x + bw / 2 + 9} y={dotY + 4} className="fill-amber-300 text-[12px] font-bold">{w.mastered}</text>
                  )}
                </>
              )}
              {(i % 2 === 0 || i === weeks.length - 1) && (
                <text x={x + bw / 2} y={base + 18} textAnchor="middle" className="fill-slate-500 text-[12px]">{shortDate(w.week_of)}</text>
              )}
              <rect x={LEFT + i * step} y={top - 20} width={step} height={base - top + 20} fill="transparent" />
            </g>
          );
        })}
      </svg>
      <WeekTip week={hover != null ? weeks[hover] : null} />
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/80" />Minutes</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" />Skills mastered that week (number shown when more than one)</span>
      </div>
    </div>
  );
}

export function AccuracyChart({ weeks }: { weeks: ProgressReportWeek[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = 14;
  const base = 140;
  const y = (v: number) => base - ((Math.max(v, 50) - 50) / 50) * (base - top);
  const step = (RIGHT - LEFT) / weeks.length;
  const pts = weeks
    .map((w, i) => ({ w, i, x: LEFT + i * step + step / 2 }))
    .filter((p) => p.w.accuracy != null);
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} 170`} className="w-full h-auto" role="img" aria-label="Share of answers correct each week">
        <rect x={LEFT} y={y(85)} width={RIGHT - LEFT} height={y(70) - y(85)} className="fill-emerald-400/10" />
        {[50, 70, 85, 100].map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={RIGHT} y1={y(v)} y2={y(v)} className="stroke-white/10" />
            <text x={LEFT - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[12px]">{v}%</text>
          </g>
        ))}
        <path
          d={pts.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${y(p.w.accuracy!)}`).join(' ')}
          fill="none" className="stroke-cyan-300" strokeWidth={2}
        />
        {pts.map((p, k) => (
          <circle key={p.w.week_of} cx={p.x} cy={y(p.w.accuracy!)} r={k === pts.length - 1 || hover === p.i ? 5.5 : 4}
            className="fill-cyan-300 stroke-slate-900" strokeWidth={2} />
        ))}
        {weeks.map((w, i) => (
          <g key={w.week_of}>
            {(i % 2 === 0 || i === weeks.length - 1) && (
              <text x={LEFT + i * step + step / 2} y={base + 18} textAnchor="middle" className="fill-slate-500 text-[12px]">{shortDate(w.week_of)}</text>
            )}
            <rect x={LEFT + i * step} y={top} width={step} height={base - top} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>
      <WeekTip week={hover != null ? weeks[hover] : null} />
    </div>
  );
}

type CellState = ProgressReportCell['state'];
const CELL_CLASS: Record<string, string> = {
  none: 'bg-slate-700/50', tried: 'bg-emerald-900/80', learning: 'bg-emerald-700/80',
  shown: 'bg-emerald-500/80', mastered: 'bg-emerald-300',
};
const cellClass = (s: CellState) => CELL_CLASS[s ?? 'none'];
// Older payloads carry gates only.
const fromGate = (g: number | null): ProgressReportCell => ({
  state: g == null ? null : g === 0 ? 'tried' : g < 4 ? 'learning' : 'mastered', gate: g, via: null,
});
const STATE_NAME: Record<string, string> = {
  none: 'Not started', tried: 'Tried', learning: 'Learning', shown: 'Shown', mastered: 'Mastered',
};
function cellDetail(c: ProgressReportCell): string {
  switch (c.state) {
    case 'mastered': return 'Shown and kept over time.';
    case 'shown': return 'Shown, not yet checked over time.';
    case 'learning': return c.gate ? `${c.gate} of 4 checks passed.` : 'Practising now.';
    case 'tried': return 'Tried, no checks passed yet.';
    default: return 'Not practised yet.';
  }
}
const cellLabel = (c: ProgressReportCell, skill: string) =>
  `${STATE_NAME[c.state ?? 'none']}: ${skill}. ${cellDetail(c)}${c.via ? ` Through a harder skill: ${c.via}.` : ''}`;

type Tip = { cell: ProgressReportCell; skill: string; x: number; y: number; id: string };
const TIP_W = 288;

/** Glass hover card for one grid cell, anchored above it inside the grade map. */
function CellTip({ tip, width }: { tip: Tip; width: number }) {
  const x = Math.min(Math.max(tip.x, TIP_W / 2), Math.max(TIP_W / 2, width - TIP_W / 2));
  return (
    <div role="tooltip"
      className={`pointer-events-none absolute z-20 rounded-xl border px-3.5 py-3 space-y-1.5 ${surface.elevated}`}
      style={{ left: x, top: tip.y - 10, width: TIP_W, transform: 'translate(-50%, -100%)' }}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-[3px] ${cellClass(tip.cell.state)}`} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
          {STATE_NAME[tip.cell.state ?? 'none']}
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug text-slate-100">{tip.skill}</p>
      <p className="text-xs text-slate-400">{cellDetail(tip.cell)}</p>
      {tip.cell.via && (
        <p className="border-t border-white/10 pt-1.5 text-xs leading-snug text-slate-300">
          <span className="text-slate-500">Through a harder skill: </span>{tip.cell.via}
        </p>
      )}
    </div>
  );
}

export const GATE_LEGEND: Array<[string, string]> = [
  ['Not started', cellClass(null)],
  ['Tried', cellClass('tried')],
  ['Learning', cellClass('learning')],
  ['Shown (by this skill or a harder one)', cellClass('shown')],
  ['Mastered (shown and kept over time)', cellClass('mastered')],
];

export function GradeMap({ subjects }: { subjects: ProgressReportSubject[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(subjects.map((s) => [s.subject, s.mastered + (s.shown ?? 0) + s.learning > 0 && s.subject !== 'SOCIAL_STUDIES'])),
  );
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (e: React.SyntheticEvent<HTMLElement>, cell: ProgressReportCell, skill: string, id: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    const b = box.current?.getBoundingClientRect();
    if (b) setTip({ cell, skill, id, x: r.left + r.width / 2 - b.left, y: r.top - b.top });
  };
  return (
    <div ref={box} className="relative divide-y divide-white/10" onMouseLeave={() => setTip(null)}>
      {tip && <CellTip tip={tip} width={box.current?.clientWidth ?? TIP_W} />}
      {subjects.map((s) => {
        const pct = (n: number) => `${(n / Math.max(1, s.total)) * 100}%`;
        const shown = s.shown ?? 0;
        return (
          <div key={s.subject} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-base font-semibold text-slate-100">{s.name}</h4>
              <span className="text-xs text-slate-400 tabular-nums">
                {s.mastered} mastered · {shown} shown · {s.learning} learning · {s.total} skills
              </span>
            </div>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-700/50"
              role="img" aria-label={`${s.name}: ${s.mastered} mastered, ${shown} shown, ${s.learning} learning, ${s.tried} tried`}>
              {s.mastered > 0 && <i className={`block h-full ${cellClass('mastered')}`} style={{ width: pct(s.mastered) }} />}
              {shown > 0 && <i className={`block h-full ${cellClass('shown')}`} style={{ width: pct(shown) }} />}
              {s.learning > 0 && <i className={`block h-full ${cellClass('learning')}`} style={{ width: pct(s.learning) }} />}
              {s.tried > 0 && <i className={`block h-full ${cellClass('tried')}`} style={{ width: pct(s.tried) }} />}
            </div>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [s.subject]: !o[s.subject] }))}
              className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
              aria-expanded={!!open[s.subject]}
            >
              {open[s.subject] ? '▾' : '▸'} Units
            </button>
            {open[s.subject] && (
              <div className="space-y-2">
                {s.units.map((u) => (
                  <div key={u.title} className="grid grid-cols-[minmax(0,1fr)_3rem] sm:grid-cols-[13rem_minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-slate-400">{u.title}</span>
                    <span className="col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto flex flex-wrap gap-[3px]">
                      {u.skills.flatMap((sk, si) =>
                        (sk.cells ?? sk.gates.map(fromGate)).map((c, gi) => {
                          const id = `${s.subject}-${u.title}-${si}-${gi}`;
                          return (
                            <i key={id} tabIndex={0} aria-label={cellLabel(c, sk.description)}
                              onMouseEnter={(e) => show(e, c, sk.description, id)} onFocus={(e) => show(e, c, sk.description, id)}
                              onBlur={() => setTip(null)}
                              className={`block h-[9px] w-[9px] cursor-default rounded-[2px] outline-none transition-transform duration-150 ${cellClass(c.state)} ${
                                tip?.id === id ? 'scale-150 ring-1 ring-white/70' : 'hover:scale-125'}`} />
                          );
                        }),
                      )}
                    </span>
                    <span className="text-right text-xs text-slate-500 tabular-nums row-start-1 col-start-2 sm:col-start-auto sm:row-start-auto">
                      {u.mastered + (u.shown ?? 0)}/{u.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
