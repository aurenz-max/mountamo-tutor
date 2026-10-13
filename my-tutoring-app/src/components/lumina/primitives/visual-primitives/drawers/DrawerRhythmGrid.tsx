'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuminaButton, LuminaSlider } from '../../../ui';
import { rhythmCounts, rhythmGridProblems, rhythmSteps, type DrawerRhythmGridData, type RhythmSound } from './textSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerRhythmGridData } from './textSpecs';

/** One synthesized hit per sound; no audio files. */
function hit(ctx: AudioContext, sound: RhythmSound, at: number) {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  if (sound === 'stomp' || sound === 'tap') {
    const o = ctx.createOscillator();
    const [f0, f1, len] = sound === 'stomp' ? [140, 45, 0.25] : [420, 300, 0.08];
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + len);
    out.gain.setValueAtTime(0.9, at);
    out.gain.exponentialRampToValueAtTime(0.001, at + len);
    o.connect(out); o.start(at); o.stop(at + len);
    return;
  }
  if (sound === 'bell') {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, at);
    out.gain.setValueAtTime(0.35, at);
    out.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
    o.connect(out); o.start(at); o.stop(at + 0.6);
    return;
  }
  // clap and snap: a burst of filtered noise
  const len = sound === 'clap' ? 0.15 : 0.05;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = sound === 'clap' ? 'bandpass' : 'highpass';
  f.frequency.value = sound === 'clap' ? 1200 : 3000;
  out.gain.setValueAtTime(sound === 'clap' ? 0.8 : 0.5, at);
  src.connect(f); f.connect(out); src.start(at);
}

/**
 * Rhythm grid: a short beat on a grid of steps, one row per sound. The learner plays it,
 * changes the tempo and taps squares to edit it, and hears where each sound falls on the beat.
 * Ungraded.
 */
const DrawerRhythmGrid: React.FC<{ data: DrawerRhythmGridData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => rhythmGridProblems(data), [data]);
  const [grid, setGrid] = useState<boolean[][]>(() => (data.tracks ?? []).map(t => (t.pattern ?? '').split('').map(c => c === 'x')));
  const [tempo, setTempo] = useState(data.tempo);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(-1);
  const ctxRef = useRef<AudioContext | null>(null);
  const live = useRef({ grid, tempo });
  live.current = { grid, tempo };

  useEffect(() => {
    if (!playing || problems.length) return;
    const ctx = ctxRef.current ?? (ctxRef.current = new AudioContext());
    void ctx.resume();
    const steps = rhythmSteps(data);
    let step = 0;
    let next = ctx.currentTime + 0.05;
    const timers: number[] = [];
    // Look-ahead scheduler: queue hits a little ahead on the audio clock, move the playhead on time.
    const tick = window.setInterval(() => {
      while (next < ctx.currentTime + 0.12) {
        const s = step;
        data.tracks.forEach((t, r) => { if (live.current.grid[r]?.[s]) hit(ctx, t.sound, next); });
        timers.push(window.setTimeout(() => setNow(s), Math.max(0, (next - ctx.currentTime) * 1000)));
        next += 60 / live.current.tempo / data.stepsPerBeat;
        step = (step + 1) % steps;
      }
    }, 25);
    return () => { window.clearInterval(tick); timers.forEach(window.clearTimeout); setNow(-1); };
  }, [playing, data, problems]);

  useEffect(() => () => { void ctxRef.current?.close(); }, []);

  if (problems.length) return <DrawerFrame kind="rhythm-grid" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const counts = rhythmCounts(data);
  const steps = rhythmSteps(data);
  const flip = (r: number, s: number) => setGrid(g => g.map((row, ri) => (ri === r ? row.map((v, si) => (si === s ? !v : v)) : row)));
  const cols = `72px repeat(${steps}, minmax(24px, 1fr))`;

  return (
    <DrawerFrame kind="rhythm-grid" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-wrap items-center gap-4">
        <LuminaButton tone="primary" onClick={() => setPlaying(p => !p)}>{playing ? 'Stop' : 'Play'}</LuminaButton>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-400"><span>Tempo</span><span className="tabular-nums text-cyan-300">{tempo} beats a minute</span></div>
          <LuminaSlider accent="cyan" min={40} max={180} step={5} value={[tempo]} onValueChange={([v]) => setTempo(Math.round(v))} aria-label="Tempo" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 overflow-x-auto">
        <div className="grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
          <span />
          {counts.map((c, s) => (
            <span key={s} className={`text-center font-mono text-[11px] ${s === now ? 'text-amber-300' : s % data.stepsPerBeat === 0 ? 'text-slate-300' : 'text-slate-500'}`}>{c}</span>
          ))}
        </div>
        {data.tracks.map((t, r) => (
          <div key={t.label} className="grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
            <span className="truncate text-sm text-slate-200">{t.label}</span>
            {grid[r].map((on, s) => (
              <button key={s} type="button" aria-pressed={on} aria-label={`${t.label}, count ${counts[s]}`} onClick={() => flip(r, s)}
                className={`h-10 rounded-md border transition-colors ${on ? 'border-indigo-400 bg-indigo-400' : 'border-white/10 bg-white/5 hover:border-white/30'} ${s === now ? 'outline outline-2 outline-offset-1 outline-amber-400' : ''}`} />
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Tap a square to add or remove a sound.</p>
    </DrawerFrame>
  );
};

export default DrawerRhythmGrid;
