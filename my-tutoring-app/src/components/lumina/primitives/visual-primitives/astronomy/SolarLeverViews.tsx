'use client';

/**
 * What the solar levers draw beside or below the sky (`solarSystemLevers.ts`). Every picture is wordless except the
 * fact strip, which lays the research cards flat (names and values, in order from the Sun, none marked). The models
 * are fixed drawings, never the sky's own planets.
 */
import React from 'react';
import type { CelestialBody } from './SolarSystemExplorer';
import type { SolarItem } from './solarSystemScript';

const Panel: React.FC<{ lever: string; label: string; children: React.ReactNode; extra?: Record<string, string> }> = ({ lever, label, children, extra }) => (
  <div data-lever={lever} {...extra} aria-label={label}
    className="mt-4 flex items-center justify-center gap-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
    {children}
  </div>
);

/** close_up: the glowing planet big, in its own colours. No name. */
export const CloseUp: React.FC<{ body: CelestialBody }> = ({ body }) => (
  <Panel lever="close-up" label="a close look at the glowing planet">
    <div className="h-32 w-32 rounded-full shadow-2xl" style={{ background: body.textureGradient || body.color, backgroundColor: body.color }} />
  </Panel>
);

const ModelSun = () => <circle cx={70} cy={70} r={12} fill="#FDB813" />;

/** near_far_model: a model sun, a near and a far ring, the asked end's dot glowing. The same for every item. */
export const NearFarModel: React.FC<{ glow: 'near' | 'far' }> = ({ glow }) => (
  <Panel lever="near-far-model" label="a model of near and far" extra={{ 'data-glow': glow }}>
    <svg width={140} height={140} viewBox="0 0 140 140">
      <ModelSun />
      <circle cx={70} cy={70} r={28} fill="none" stroke="rgba(255,255,255,0.3)" />
      <circle cx={70} cy={70} r={60} fill="none" stroke="rgba(255,255,255,0.3)" />
      {[28, 60].map(r => {
        const lit = (r === 28) === (glow === 'near');
        return <circle key={r} data-dot={r === 28 ? 'near' : 'far'} cx={70 + r} cy={70} r={lit ? 7 : 5}
          fill={lit ? '#facc15' : '#94a3b8'} stroke={lit ? 'white' : 'none'} strokeWidth={2} />;
      })}
    </svg>
  </Panel>
);

/** trip_model: in the same time the near dot has gone a long way round and the far dot a short way. */
export const TripModel: React.FC = () => {
  const arc = (r: number, turn: number) => {
    const a = turn * 2 * Math.PI;
    return `M ${70 + r} 70 A ${r} ${r} 0 ${turn > 0.5 ? 1 : 0} 0 ${70 + r * Math.cos(a)} ${70 - r * Math.sin(a)}`;
  };
  return (
    <Panel lever="trip-model" label="a model of two trips around a sun">
      <svg width={140} height={140} viewBox="0 0 140 140">
        <ModelSun />
        <circle cx={70} cy={70} r={28} fill="none" stroke="rgba(255,255,255,0.2)" />
        <circle cx={70} cy={70} r={60} fill="none" stroke="rgba(255,255,255,0.2)" />
        <path data-trail="near" d={arc(28, 0.7)} fill="none" stroke="#38bdf8" strokeWidth={4} strokeLinecap="round" />
        <path data-trail="far" d={arc(60, 0.12)} fill="none" stroke="#38bdf8" strokeWidth={4} strokeLinecap="round" />
      </svg>
    </Panel>
  );
};

/** kind_model: model worlds not from this sky. Rocky / giant: a cratered rock and a striped gas world; dwarf: a tiny
 *  world beside a full planet. */
export const KindModel: React.FC<{ dwarf: boolean }> = ({ dwarf }) => (
  <Panel lever="kind-model" label="model worlds">
    {dwarf ? (
      <svg width={180} height={100} viewBox="0 0 180 100">
        <circle cx={50} cy={50} r={40} fill="#64748b" />
        <circle cx={140} cy={50} r={6} fill="#a8a29e" />
      </svg>
    ) : (
      <svg width={220} height={110} viewBox="0 0 220 110">
        <circle cx={40} cy={55} r={20} fill="#78716c" />
        <circle cx={33} cy={48} r={4} fill="#57534e" /><circle cx={47} cy={62} r={3} fill="#57534e" />
        <circle cx={160} cy={55} r={50} fill="#d6a76c" />
        {[-30, -12, 6, 24].map(y => <rect key={y} x={112} y={55 + y} width={96} height={7} fill="#b07a45" opacity={0.7} />)}
      </svg>
    )}
  </Panel>
);

/** size_row: the planets side by side at their true sizes, in order from the Sun, no names. */
export const SizeRow: React.FC<{ bodies: readonly CelestialBody[] }> = ({ bodies }) => {
  const max = Math.max(...bodies.map(b => b.radiusKm), 1);
  return (
    <Panel lever="size-row" label="the planets at their true sizes">
      <div className="flex items-end gap-3">
        {bodies.map(b => {
          const d = Math.max(3, Math.round((b.radiusKm / max) * 96));
          return <div key={b.id} data-size-of={b.id} className="rounded-full" style={{ width: d, height: d, backgroundColor: b.color }} />;
        })}
      </div>
    </Panel>
  );
};

/** fact_strip: every planet's temperature or moon count side by side, in order from the Sun, none marked. */
export const FactStrip: React.FC<{ bodies: readonly CelestialBody[]; facet: SolarItem['facet'] }> = ({ bodies, facet }) => (
  <Panel lever="fact-strip" label={facet === 'hottest' ? 'how hot each planet is' : 'how many moons each planet has'}>
    <div className="flex flex-wrap justify-center gap-2">
      {bodies.map(b => (
        <div key={b.id} data-fact-of={b.id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
          <div className="text-[10px] text-slate-400">{b.name}</div>
          <div className="text-sm text-slate-100">{facet === 'hottest' ? `${b.temperatureC}°C` : b.moons}</div>
        </div>
      ))}
    </div>
  </Panel>
);
