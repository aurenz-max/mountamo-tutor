import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type {
  PulseSessionHistoryResponse,
  PulseSessionHistoryItem,
  PulseSessionThetaPoint,
} from '@/lib/studentAnalyticsAPI';
import { bandSuccessLabel, formatDuration } from './helpers';

// ---------------------------------------------------------------------------
// Theta trajectory chart (shown only when data exists)
// ---------------------------------------------------------------------------

function ThetaTrajectoryChart({ points }: { points: PulseSessionThetaPoint[] }) {
  if (!points.length) return null;

  const bySkill = new Map<string, PulseSessionThetaPoint[]>();
  for (const p of points) {
    const arr = bySkill.get(p.skill_id) || [];
    arr.push(p);
    bySkill.set(p.skill_id, arr);
  }
  Array.from(bySkill.values()).forEach(arr => {
    arr.sort((a: PulseSessionThetaPoint, b: PulseSessionThetaPoint) => a.timestamp.localeCompare(b.timestamp));
  });

  let minTheta = Infinity, maxTheta = -Infinity;
  for (const p of points) {
    minTheta = Math.min(minTheta, p.theta_before, p.theta_after);
    maxTheta = Math.max(maxTheta, p.theta_before, p.theta_after);
  }
  const thetaRange = Math.max(maxTheta - minTheta, 0.5);
  const allTimestamps = Array.from(new Set(points.map(p => p.timestamp))).sort();

  const w = 500, h = 140;
  const pad = { top: 10, right: 10, bottom: 24, left: 36 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const xScale = (ts: string) => pad.left + (allTimestamps.indexOf(ts) / Math.max(allTimestamps.length - 1, 1)) * chartW;
  const yScale = (theta: number) => pad.top + chartH - ((theta - minTheta) / thetaRange) * chartH;

  const COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c'];
  const skills = Array.from(bySkill.keys());

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-100">Ability (θ) Trajectory</CardTitle>
      </CardHeader>
      <CardContent>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
          {[minTheta, (minTheta + maxTheta) / 2, maxTheta].map((v, i) => (
            <React.Fragment key={i}>
              <text x={pad.left - 6} y={yScale(v)} textAnchor="end" dominantBaseline="central" className="fill-slate-600" fontSize="9">
                {v.toFixed(1)}
              </text>
              <line x1={pad.left} x2={w - pad.right} y1={yScale(v)} y2={yScale(v)} stroke="#334155" strokeWidth="0.5" />
            </React.Fragment>
          ))}
          {skills.map((skillId, si) => {
            const pts = bySkill.get(skillId)!;
            const pathPoints: { x: number; y: number }[] = [];
            pts.forEach((p, i) => {
              if (i === 0) pathPoints.push({ x: xScale(p.timestamp), y: yScale(p.theta_before) });
              pathPoints.push({ x: xScale(p.timestamp), y: yScale(p.theta_after) });
            });
            const d = pathPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
            return (
              <g key={skillId}>
                <path d={d} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" />
                {pathPoints.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="2" fill={COLORS[si % COLORS.length]} />
                ))}
              </g>
            );
          })}
          {allTimestamps.length > 0 && (
            <>
              <text x={xScale(allTimestamps[0])} y={h - 4} textAnchor="start" className="fill-slate-500" fontSize="8">
                {allTimestamps[0].slice(0, 10)}
              </text>
              {allTimestamps.length > 1 && (
                <text x={xScale(allTimestamps[allTimestamps.length - 1])} y={h - 4} textAnchor="end" className="fill-slate-500" fontSize="8">
                  {allTimestamps[allTimestamps.length - 1].slice(0, 10)}
                </text>
              )}
            </>
          )}
        </svg>
        <div className="flex flex-wrap gap-3 mt-2">
          {skills.map((skillId, si) => (
            <div key={skillId} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[si % COLORS.length] }} />
              <span className="text-[10px] text-slate-500 font-mono">{skillId}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Score sparkline across sessions
// ---------------------------------------------------------------------------

function SessionScoreSparkline({ sessions }: { sessions: PulseSessionHistoryItem[] }) {
  const scored = sessions.filter(s => s.avg_score != null).slice().reverse();
  if (scored.length < 2) return null;

  const w = 500, h = 80;
  const pad = { top: 8, right: 8, bottom: 20, left: 30 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const points = scored.map((s, i) => ({
    x: pad.left + (i / Math.max(scored.length - 1, 1)) * chartW,
    y: pad.top + chartH - ((s.avg_score! / 10) * chartH),
    date: s.created_at.slice(0, 10),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-slate-100">Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
          {[0, 5, 10].map(v => (
            <React.Fragment key={v}>
              <text x={pad.left - 4} y={pad.top + chartH - (v / 10) * chartH}
                textAnchor="end" dominantBaseline="central" className="fill-slate-600" fontSize="8">{v}</text>
              <line x1={pad.left} x2={w - pad.right}
                y1={pad.top + chartH - (v / 10) * chartH}
                y2={pad.top + chartH - (v / 10) * chartH}
                stroke="#334155" strokeWidth="0.5" />
            </React.Fragment>
          ))}
          <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#a78bfa" />
          ))}
          <text x={points[0].x} y={h - 4} textAnchor="start" className="fill-slate-500" fontSize="7">{points[0].date}</text>
          <text x={points[points.length - 1].x} y={h - 4} textAnchor="end" className="fill-slate-500" fontSize="7">{points[points.length - 1].date}</text>
        </svg>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function PulseSessionsPanel({ data }: { data: PulseSessionHistoryResponse | null }) {
  if (!data) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">
          No pulse session data. Load a student first.
        </CardContent>
      </Card>
    );
  }

  // Compact summary values
  const avgScore = data.avg_session_score != null ? data.avg_session_score.toFixed(1) : '—';
  const frontierRate = bandSuccessLabel(data.overall_frontier_success_rate);

  return (
    <div className="space-y-4">
      {/* Compact summary — one card, not 12 pills */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-4">
          <div className="flex items-baseline gap-6 flex-wrap">
            <div>
              <span className="text-3xl font-bold text-slate-100">{data.total_sessions}</span>
              <span className="text-sm text-slate-500 ml-1.5">sessions</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-3xl font-bold text-cyan-400">{data.total_items_completed}</span>
              <span className="text-sm text-slate-500 ml-1.5">items</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-3xl font-bold text-purple-400">{avgScore}</span>
              <span className="text-sm text-slate-500 ml-1.5">avg score</span>
            </div>
            {data.total_leapfrogs > 0 && (
              <>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <span className="text-3xl font-bold text-teal-400">{data.total_skills_inferred}</span>
                  <span className="text-sm text-slate-500 ml-1.5">skills inferred</span>
                  <span className="text-[10px] text-slate-600 ml-1">({data.total_leapfrogs} leapfrogs)</span>
                </div>
              </>
            )}
            {data.overall_frontier_success_rate != null && (
              <>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <span className="text-3xl font-bold text-amber-400">{frontierRate}</span>
                  <span className="text-sm text-slate-500 ml-1.5">frontier success</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts — only render when there's meaningful data */}
      <SessionScoreSparkline sessions={data.sessions} />
      <ThetaTrajectoryChart points={data.theta_trajectory} />

      {/* Session list */}
      {data.sessions.length > 0 ? (
        <Accordion type="multiple" className="space-y-2">
          {data.sessions.map((session: PulseSessionHistoryItem) => {
            const itemPct = session.items_total > 0
              ? Math.round((session.items_completed / session.items_total) * 100) : 0;
            return (
              <AccordionItem key={session.session_id} value={session.session_id} className="border-0">
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors [&[data-state=open]]:bg-white/5">
                    <div className="flex-1 text-left space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100">{session.subject}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            session.status === 'completed'
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                              : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                          }`}>
                            {session.status}
                          </span>
                          {session.is_cold_start && (
                            <span className="text-[10px] text-blue-400">cold start</span>
                          )}
                          {session.skills_inferred > 0 && (
                            <span className="text-[10px] text-teal-400">{session.skills_inferred} inferred</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          {session.duration_ms != null && <span>{formatDuration(session.duration_ms)}</span>}
                          <span>{session.items_completed}/{session.items_total}</span>
                          {session.avg_score != null && <span className="font-mono">{session.avg_score.toFixed(1)}</span>}
                          <span className="text-slate-500">{new Date(session.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                          style={{ width: `${itemPct}%` }}
                        />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-3">
                      {/* Band breakdown */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Frontier', items: session.band_breakdown.frontier_items, rate: session.band_breakdown.frontier_success_rate, color: 'amber' },
                          { label: 'Current', items: session.band_breakdown.current_items, rate: session.band_breakdown.current_success_rate, color: 'blue' },
                          { label: 'Review', items: session.band_breakdown.review_items, rate: session.band_breakdown.review_success_rate, color: 'purple' },
                        ].map(band => (
                          <div key={band.label} className={`p-2 rounded-lg bg-${band.color}-500/10 border border-${band.color}-500/20 text-center`}>
                            <div className={`text-sm font-bold text-${band.color}-400`}>{band.items}</div>
                            <div className="text-[10px] text-slate-500">{band.label}</div>
                            <div className={`text-[10px] text-${band.color}-400 font-mono`}>{bandSuccessLabel(band.rate)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Leapfrogs */}
                      {session.leapfrogs.length > 0 && (
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            Leapfrogs ({session.leapfrogs.length})
                          </div>
                          <div className="space-y-1">
                            {session.leapfrogs.map((lf, i) => (
                              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-teal-500/5 border border-teal-500/10">
                                <span className="text-[10px] text-teal-400 font-mono">{lf.lesson_group_id}</span>
                                <span className="text-[10px] text-slate-500">
                                  probed {lf.probed_skills.length} → inferred {lf.inferred_skills.length}
                                </span>
                                <span className="text-[10px] text-teal-400 ml-auto font-mono">
                                  score {lf.aggregate_score.toFixed(1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1 border-t border-white/5">
                        <span className="font-mono">{session.session_id.slice(0, 12)}…</span>
                        {session.completed_at && (
                          <span>Completed {new Date(session.completed_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-8 text-center text-slate-500">
            No pulse sessions found for this student.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
