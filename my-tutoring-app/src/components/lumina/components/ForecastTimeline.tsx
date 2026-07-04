'use client';

/**
 * ForecastTimeline — "The road ahead": the student's skill-level forecast.
 *
 * First consumer of GET /api/weekly-planner/{id}/forecast (ForecastService).
 * Renders the materialized daily forecast as:
 *   - a unit-level Gantt across the school year (solid = best estimate,
 *     faded tail = pessimistic; selector-ordered units are the near-term,
 *     high-confidence stretch),
 *   - an "up next" strip of per-subskill ETAs tagged with their order basis,
 *   - a week scrubber ("what will the week of Nov 9 look like?"),
 *   - drift chips when units moved vs the prior forecast.
 *
 * Fails quietly (renders null) so My Progress never blocks on it. The
 * forecast is a projection — the daily session plan is the plan of record.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchStudentForecast,
  type StudentForecast,
  type SubskillEta,
} from '@/lib/forecastAPI';
import { LuminaBadge, LuminaSectionLabel } from '../ui';

// Validated categorical palette (dark surface) — assigned by subject index.
const PALETTE = ['#4188E0', '#9F63DC', '#2FAE76', '#BE8026', '#5EA9BF', '#C4708C'];

const DAY = 86_400_000;
const parseISO = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

interface Props {
  studentId: number;
}

export default function ForecastTimeline({ studentId }: Props) {
  const [forecast, setForecast] = useState<StudentForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrubWeek, setScrubWeek] = useState(8);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStudentForecast(studentId)
      .then(f => { if (!cancelled) setForecast(f); })
      .catch(err => console.warn('[Forecast] unavailable:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  const model = useMemo(() => {
    if (!forecast || forecast.subjects.length === 0) return null;
    const t0 = parseISO(forecast.year_start);
    const yearEnd = parseISO(forecast.year_end);
    let tMax = yearEnd;
    for (const s of forecast.subjects) {
      for (const u of s.units) tMax = Math.max(tMax, parseISO(u.eta_end.pessimistic));
    }
    const t1 = tMax + 7 * DAY;
    const finishBest = Math.max(
      ...forecast.subjects.map(s => parseISO(s.projected_finish.best)),
    );
    const totalRate = forecast.subjects.reduce((a, s) => a + s.weekly_rate.best, 0);
    const totalRemaining = forecast.subjects.reduce((a, s) => a + s.remaining_subskills, 0);
    // Up next: each subject's head, merged and sorted by arrival
    const upNext: (SubskillEta & { color: string })[] = forecast.subjects
      .flatMap((s, i) =>
        s.subskill_etas.slice(0, 3).map(e => ({ ...e, color: PALETTE[i % PALETTE.length] })),
      )
      .sort((a, b) => a.eta_week.localeCompare(b.eta_week))
      .slice(0, 8);
    return { t0, t1, yearEnd, finishBest, totalRate, totalRemaining, upNext };
  }, [forecast]);

  if (loading) {
    return (
      <div className="h-48 w-full max-w-5xl animate-pulse rounded-2xl border border-white/10 bg-slate-900/40" />
    );
  }
  if (!forecast || !model) return null;

  const { t0, t1, yearEnd, finishBest, totalRate, totalRemaining, upNext } = model;

  // ---- Gantt geometry ----
  const W = 960, LABEL = 200, RPAD = 16, TOP = 26, ROW = 19, HDR = 26;
  const x = (t: number) => LABEL + ((t - t0) / (t1 - t0)) * (W - LABEL - RPAD);
  const nRows = forecast.subjects.reduce((a, s) => a + s.units.length, 0);
  const H = TOP + forecast.subjects.length * HDR + nRows * ROW + 30;

  // Month tick positions
  const months: { t: number; label: string }[] = [];
  {
    const d = new Date(t0);
    d.setUTCDate(1);
    while (d.getTime() < t1) {
      if (d.getTime() >= t0) {
        months.push({
          t: d.getTime(),
          label: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        });
      }
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }

  const today = Date.now();
  const scrubStart = t0 + scrubWeek * 7 * DAY;
  const scrubEnd = scrubStart + 7 * DAY;
  const maxScrub = Math.max(1, Math.floor((yearEnd - t0) / (7 * DAY)) - 1);

  const slackWeeks = (yearEnd - finishBest) / (7 * DAY);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <LuminaSectionLabel accent="cyan">The road ahead</LuminaSectionLabel>
        <LuminaBadge accent={slackWeeks >= 0 ? 'emerald' : 'amber'}>
          {slackWeeks >= 1
            ? `On pace — projected done ${fmtDate(finishBest)}`
            : slackWeeks >= 0
              ? 'On pace, closely'
              : `Projected ${Math.ceil(-slackWeeks)} wks past year end`}
        </LuminaBadge>
        {forecast.drift?.units?.length ? (
          <LuminaBadge accent="purple">{forecast.drift.units.length} units moved since {forecast.drift.compared_to}</LuminaBadge>
        ) : null}
      </div>
      <p className="mt-2 mb-3 max-w-xl text-sm text-slate-400">
        Where the year is headed: every unit with its projected window — solid is the best
        estimate, the faded tail is the cautious one. Near-term order comes from today&apos;s
        live lesson selector; further out follows the curriculum&apos;s prerequisite structure.
      </p>

      {/* ---- summary chips ---- */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-400 [font-variant-numeric:tabular-nums]">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          {totalRemaining} skills to go · {forecast.weeks_remaining} school weeks
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          pace {totalRate.toFixed(1)} skills/wk
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          needs {forecast.required_minutes_per_day.toFixed(0)} min/day of {forecast.budget_minutes} budgeted
        </span>
      </div>

      {/* ---- Gantt ---- */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-2">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Unit forecast timeline">
          {months.map(m => (
            <g key={m.t}>
              <line x1={x(m.t)} y1={TOP - 6} x2={x(m.t)} y2={H - 22} stroke="rgba(255,255,255,0.05)" />
              <text x={x(m.t) + 3} y={TOP - 10} fontSize={10} fill="#64748B">{m.label}</text>
            </g>
          ))}
          <line x1={x(yearEnd)} y1={TOP - 6} x2={x(yearEnd)} y2={H - 22} stroke="rgba(224,106,106,0.55)" strokeDasharray="3 3" />
          <text x={x(yearEnd)} y={TOP - 10} fontSize={10} fill="#E06A6A" textAnchor="middle">year end</text>
          {today > t0 && today < t1 && (
            <>
              <line x1={x(today)} y1={TOP - 6} x2={x(today)} y2={H - 22} stroke="rgba(106,178,255,0.5)" strokeDasharray="3 3" />
              <text x={x(today)} y={TOP - 10} fontSize={10} fill="#6AB2FF" textAnchor="middle">today</text>
            </>
          )}
          {(() => {
            let y = TOP;
            return forecast.subjects.map((s, si) => {
              const color = PALETTE[si % PALETTE.length];
              const header = (
                <g key={`h-${s.subject}`}>
                  <text x={4} y={y + 15} fontSize={12} fontWeight={700} fill={color}>
                    {s.subject.replace(/_/g, ' ')}
                  </text>
                  <text x={LABEL - 8} y={y + 15} fontSize={10} fill="#64748B" textAnchor="end">
                    {s.allocated_minutes_per_day.toFixed(0)}m/day · {s.weekly_rate.best.toFixed(1)}/wk
                  </text>
                </g>
              );
              y += HDR;
              const rows = s.units.map(u => {
                const ys = y;
                y += ROW;
                const xs = x(parseISO(u.eta_start));
                const xb = x(parseISO(u.eta_end.best));
                const xp = x(parseISO(u.eta_end.pessimistic));
                return (
                  <g key={`${s.subject}-${u.unit_title}-${ys}`}>
                    <title>
                      {`${u.unit_title} — ${u.subskills} skills · ${fmtDate(parseISO(u.eta_start))} → ${fmtDate(parseISO(u.eta_end.best))} (cautious ${fmtDate(parseISO(u.eta_end.pessimistic))})${u.past_year_end ? ' · cautious case passes year end' : ''}`}
                    </title>
                    <rect x={xs} y={ys + 3} width={Math.max(2, xp - xs)} height={ROW - 8} rx={3} fill={color} opacity={0.22} />
                    <rect x={xs} y={ys + 3} width={Math.max(2, xb - xs)} height={ROW - 8} rx={3} fill={color} opacity={0.85} />
                    <text x={LABEL - 8} y={ys + 12} fontSize={10.5} fill="#A6B3C7" textAnchor="end">
                      {u.unit_title.length > 27 ? `${u.unit_title.slice(0, 25)}…` : u.unit_title}
                    </text>
                  </g>
                );
              });
              return [header, ...rows];
            });
          })()}
        </svg>
      </div>

      {/* ---- up next ---- */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Up next</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {upNext.map(e => (
            <div key={e.subskill_id} className="w-44 flex-none rounded-xl border border-white/10 bg-white/5 p-3" title={e.reason || undefined}>
              <div className="text-[11px] text-slate-500 [font-variant-numeric:tabular-nums]">
                ≈ week of {fmtDate(parseISO(e.eta_week))}
              </div>
              <div className="mt-1 line-clamp-2 text-xs font-medium text-slate-200">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-baseline" style={{ background: e.color }} />
                {e.description || e.subskill_id}
              </div>
              <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                e.order_basis === 'selector'
                  ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : 'border border-dashed border-white/20 bg-white/5 text-slate-500'
              }`}>
                {e.order_basis === 'selector' ? 'picked for you' : 'coming later'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- week scrubber ---- */}
      <div className="mt-4">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Peek at a week</p>
          <input
            type="range"
            min={0}
            max={maxScrub}
            value={Math.min(scrubWeek, maxScrub)}
            onChange={e => setScrubWeek(Number(e.target.value))}
            className="w-64 accent-cyan-400"
            aria-label="Scrub to a future week"
          />
          <span className="text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
            week of {fmtDate(scrubStart)}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {forecast.subjects.map((s, si) => {
            const inFlight = s.units.filter(u =>
              parseISO(u.eta_start) < scrubEnd && parseISO(u.eta_end.best) > scrubStart,
            );
            return (
              <div key={s.subject} className="rounded-xl border border-white/10 bg-white/5 p-3" style={{ borderTopColor: `${PALETTE[si % PALETTE.length]}80`, borderTopWidth: 2 }}>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: PALETTE[si % PALETTE.length] }}>
                  {s.subject.replace(/_/g, ' ')}
                </p>
                {inFlight.length ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
                    {inFlight.map(u => <li key={u.unit_title}>{u.unit_title}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    {parseISO(s.projected_finish.best) < scrubStart ? 'done by then 🎉' : '—'}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-slate-500 [font-variant-numeric:tabular-nums]">
                  ≈{s.review_load.due_per_week.toFixed(0)} reviews/wk · {s.review_load.dedicated_blocks.toFixed(1)} need their own block
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- drift ---- */}
      {forecast.drift?.units?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Moved since {forecast.drift.compared_to}
          </p>
          <div className="flex flex-wrap gap-2">
            {forecast.drift.units.slice(0, 8).map(d => (
              <span key={`${d.subject}-${d.unit_title}`} className={`rounded-full border px-3 py-1 text-xs [font-variant-numeric:tabular-nums] ${
                d.delta_days > 0
                  ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                  : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              }`}>
                {d.unit_title}: {d.delta_days > 0 ? '+' : ''}{d.delta_days}d
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
