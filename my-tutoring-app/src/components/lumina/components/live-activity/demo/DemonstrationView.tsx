'use client';

/**
 * Draws a composed demonstration one frame at a time (LA-15 pilot). Every shape and caption
 * comes from `buildDemonstration`; this file only paints the view state it is given, so a
 * caption and its drawing cannot disagree. The kit frames the stepper; the pieces are bespoke.
 */
import React, { useEffect, useState } from 'react';
import { LuminaButton } from '../../../ui';
import { accentChipBg, accentStrongText, accentText } from '../../../ui/tokens';
import type { ClockView, Demonstration, DemoView, NumberLineView, PlaceValueView, Tone } from './demoContract';

const TONE_TEXT: Record<Tone, string> = {
  plain: 'text-slate-300',
  focus: accentText.cyan,
  done: accentText.emerald,
  faded: 'text-slate-500',
};

const label = (n: number, d: number) => (d === 1 ? String(n) : n === 0 ? '0' : n % d === 0 ? String(n / d) : `${n}/${d}`);

function NumberLinePiece({ view }: { view: NumberLineView }) {
  // A narrow canvas keeps tick labels readable when the card shrinks to phone width.
  const W = 440, PAD = 28, AXIS = 118;
  const span = Math.max(view.max - view.min, 1);
  const x = (v: number) => PAD + ((v - view.min) / span) * (W - 2 * PAD);
  const ticks = Array.from({ length: span + 1 }, (_, i) => view.min + i);
  const every = span > 20 ? 5 : 1;
  return <svg viewBox={`0 0 ${W} 160`} className="w-full max-w-2xl" data-demo-view="number-line" aria-hidden="true">
    <line x1={PAD - 12} x2={W - PAD + 12} y1={AXIS} y2={AXIS} stroke="currentColor" strokeWidth={2} className="text-slate-400" />
    {ticks.map(t => <g key={t} className="text-slate-400">
      <line x1={x(t)} x2={x(t)} y1={AXIS - (t % view.denominator === 0 ? 10 : 6)} y2={AXIS + (t % view.denominator === 0 ? 10 : 6)} stroke="currentColor" strokeWidth={2} />
      {(t - view.min) % every === 0 && <text x={x(t)} y={AXIS + 30} textAnchor="middle" fontSize={view.denominator > 1 ? 16 : 18} fill="currentColor"
        className="text-slate-200">{label(t, view.denominator)}</text>}
    </g>)}
    {view.hops.map(h => {
      const [a, b] = [x(h.from), x(h.to)];
      const mid = (a + b) / 2;
      const lift = Math.min(60, 18 + Math.abs(b - a) * 0.6);
      return <g key={`${h.from}-${h.to}`} className={accentText.amber}>
        <path d={`M ${a} ${AXIS - 4} Q ${mid} ${AXIS - lift} ${b} ${AXIS - 4}`} fill="none" stroke="currentColor" strokeWidth={2.5} markerEnd="url(#demo-arrow)" />
        <text x={mid} y={AXIS - lift / 2 - 8} textAnchor="middle" fontSize={17} fontWeight={700} fill="currentColor">{h.label}</text>
      </g>;
    })}
    {view.marks.map(m => <g key={m.at} className={TONE_TEXT[m.tone]}>
      <circle cx={x(m.at)} cy={AXIS} r={10} fill="currentColor" data-demo-mark={m.tone} />
    </g>)}
    <defs>
      <marker id="demo-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className={accentText.amber} />
      </marker>
    </defs>
  </svg>;
}

const SHORT_PLACE: Record<string, string> = { thousands: 'Th', hundreds: 'H', tens: 'T', ones: 'O' };

function PlaceValuePiece({ view }: { view: PlaceValueView }) {
  const cols = `minmax(3rem, 8rem) repeat(${view.places.length}, minmax(2.75rem, 6rem))`;
  const cell = (i: number) => `flex items-center justify-center rounded-lg border border-white/10 ${view.focusPlace === i ? `${accentChipBg.amber} ${accentStrongText.amber} ring-2 ring-amber-400/40` : 'bg-slate-900/40 text-slate-100'}`;
  return <div className="mx-auto w-fit max-w-full overflow-x-auto" data-demo-view="place-value">
    <div className="grid gap-2" style={{ gridTemplateColumns: cols }}>
      <span />
      {view.places.map((p, i) => <span key={p} data-demo-place={p} className={`${cell(i)} h-9 px-1 text-sm font-semibold capitalize`}>
        {/* Th H T O is the usual short form; full names return once the card is wide enough. */}
        <span className="sm:hidden">{SHORT_PLACE[p] ?? p}</span><span className="hidden sm:inline">{p}</span>
      </span>)}
      {view.rows.map(r => <React.Fragment key={r.label}>
        <span className="flex items-center text-base font-semibold text-slate-200 sm:text-lg">{r.label}</span>
        {r.digits.map((d, i) => <span key={i} className={`${cell(i)} h-14 text-2xl font-bold sm:text-3xl`}>{d ?? ''}</span>)}
      </React.Fragment>)}
      {(view.looseOnes !== undefined || view.bundles !== undefined) && <>
        <span className="flex items-center text-sm text-slate-400">blocks</span>
        {view.places.map((p, i) => <span key={p} className={`${cell(i)} min-h-24 flex-wrap content-center gap-1 p-2`}>
          {p === 'tens' && Array.from({ length: view.bundles ?? 0 }, (_, k) =>
            <span key={k} data-demo-bundle className={`h-16 w-3 rounded-sm ${accentText.cyan} bg-current`} />)}
          {p === 'ones' && Array.from({ length: view.looseOnes ?? 0 }, (_, k) =>
            <span key={k} data-demo-one className={`h-3 w-3 rounded-sm ${accentText.cyan} bg-current`} />)}
        </span>)}
      </>}
    </div>
  </div>;
}

function ClockPiece({ view }: { view: ClockView }) {
  // Padding past the rim leaves room for the ':05' minute labels drawn outside it.
  const C = 150, R = 100;
  const at = (n: number, r: number) => {
    const a = (n / 12) * 2 * Math.PI - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const [mx, my] = at(view.minuteNumeral, R - 22);
  const [hx, hy] = at(view.hour % 12 + view.minuteNumeral / 12, R - 50);
  return <svg viewBox={`0 0 ${2 * C} ${2 * C}`} className="w-full max-w-xs" data-demo-view="clock" aria-hidden="true">
    <circle cx={C} cy={C} r={R + 8} fill="none" stroke="currentColor" strokeWidth={3} className="text-slate-400" />
    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
      const [tx, ty] = at(n, R - 8);
      const [lx, ly] = at(n, R + 24);
      const lit = view.labelled.includes(n);
      return <g key={n}>
        <text x={tx} y={ty + 6} textAnchor="middle" fontSize={18} fontWeight={n === view.minuteNumeral ? 800 : 600} fill="currentColor"
          className={n === view.minuteNumeral ? accentText.cyan : 'text-slate-200'}>{n}</text>
        {lit && <text x={lx} y={ly + 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="currentColor" data-demo-minutes={n * 5}
          className={accentText.amber}>{`:${String(n * 5).padStart(2, '0')}`}</text>}
      </g>;
    })}
    <line x1={C} y1={C} x2={hx} y2={hy} stroke="currentColor" strokeWidth={6} strokeLinecap="round" className="text-slate-300" />
    <line x1={C} y1={C} x2={mx} y2={my} stroke="currentColor" strokeWidth={4} strokeLinecap="round" className={accentText.cyan} />
    <circle cx={C} cy={C} r={5} fill="currentColor" className="text-slate-200" />
  </svg>;
}

function Piece({ view }: { view: DemoView }) {
  return view.piece === 'number-line' ? <NumberLinePiece view={view} />
    : view.piece === 'place-value' ? <PlaceValuePiece view={view} />
      : <ClockPiece view={view} />;
}

export function DemonstrationView({ demonstration }: { demonstration: Demonstration }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [demonstration]);
  const frame = demonstration.frames[step];
  const last = demonstration.frames.length - 1;
  return <figure className="mx-auto max-w-2xl" data-demo-piece={demonstration.piece} data-demo-step={step}
    aria-label={demonstration.frames.map((f, i) => `Step ${i + 1}: ${f.caption}`).join(' ')}>
    <div className="flex min-h-[12rem] items-center justify-center py-4"><Piece view={frame.view} /></div>
    <figcaption className="text-center text-xl leading-relaxed text-slate-100" aria-live="polite">{frame.caption}</figcaption>
    <div className="mt-6 flex items-center justify-center gap-4">
      <LuminaButton tone="ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</LuminaButton>
      <span className="text-sm text-slate-400">Step {step + 1} of {last + 1}</span>
      <LuminaButton tone="primary" disabled={step === last} onClick={() => setStep(s => s + 1)}>Next step</LuminaButton>
    </div>
  </figure>;
}
