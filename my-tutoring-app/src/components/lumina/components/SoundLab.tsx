'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  SoundManager,
  SOUND_SPECS,
  describeSound,
  type SoundSpec,
  type SoundGroup,
  type Waveform,
} from '../utils/SoundManager';

interface SoundLabProps {
  onBack: () => void;
}

const GROUP_META: Record<SoundGroup, { label: string; blurb: string; accent: string }> = {
  interaction: {
    label: 'Interaction',
    blurb: 'Tiny, frequent sounds. They confirm a touch without ever demanding attention.',
    accent: 'cyan',
  },
  feedback: {
    label: 'Feedback',
    blurb: 'Answer evaluation. Bright & rising for right; soft & low for wrong — never punishing.',
    accent: 'emerald',
  },
  celebration: {
    label: 'Celebration',
    blurb: 'Milestone moments. Longer, musical, earned — so they stay special.',
    accent: 'amber',
  },
};

const GROUP_ORDER: SoundGroup[] = ['interaction', 'feedback', 'celebration'];

const WAVEFORMS: Waveform[] = ['sine', 'triangle', 'square', 'sawtooth'];

// ── A single auditionable sound ─────────────────────────────────────────
const SoundCard: React.FC<{ spec: SoundSpec }> = ({ spec }) => {
  const [pulse, setPulse] = useState(0);
  const recipe = describeSound(spec);

  const handlePlay = () => {
    SoundManager.play(spec);
    setPulse((p) => p + 1);
  };

  return (
    <Card
      onClick={handlePlay}
      className="group relative cursor-pointer overflow-hidden backdrop-blur-xl bg-slate-900/40 border-white/10 hover:border-white/25 transition-all p-4"
    >
      {/* Play pulse ring */}
      <span
        key={pulse}
        className={pulse ? 'absolute inset-0 rounded-xl ring-2 ring-cyan-400/60 animate-ping pointer-events-none' : ''}
        style={pulse ? { animationDuration: '500ms', animationIterationCount: 1 } : undefined}
      />
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-bold text-slate-100">{spec.label}</h4>
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/15 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 group-hover:scale-110 transition-all">
          <svg className="w-4 h-4 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-snug mb-3 min-h-[2.5rem]">{spec.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {recipe.waveforms.map((w) => (
          <Badge key={w} variant="outline" className="text-[10px] border-white/15 text-slate-400 font-mono">
            {w}
          </Badge>
        ))}
        <Badge variant="outline" className="text-[10px] border-white/15 text-slate-400 font-mono">
          {recipe.durationMs}ms
        </Badge>
        <Badge variant="outline" className="text-[10px] border-white/15 text-slate-400 font-mono">
          {recipe.minFreq === recipe.maxFreq
            ? `${recipe.minFreq}Hz`
            : `${recipe.minFreq}–${recipe.maxFreq}Hz`}
        </Badge>
        {recipe.noteCount > 1 && (
          <Badge variant="outline" className="text-[10px] border-white/15 text-slate-400 font-mono">
            {recipe.noteCount} notes
          </Badge>
        )}
      </div>
    </Card>
  );
};

// ── Design-your-own experimenter ────────────────────────────────────────
const SoundDesigner: React.FC = () => {
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const [freq, setFreq] = useState(523);
  const [durationMs, setDurationMs] = useState(150);
  const [glide, setGlide] = useState(false);
  const [glideTo, setGlideTo] = useState(880);

  const play = () => {
    SoundManager.playNote({
      freq,
      start: 0,
      duration: durationMs / 1000,
      waveform,
      gain: 1,
      glideTo: glide ? glideTo : undefined,
    });
  };

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-5 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-100">Design your own</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Twist the knobs and listen. This is how every sound above was tuned — by ear, no MIDI.
        </p>
      </div>

      {/* Waveform */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Waveform</label>
        <div className="grid grid-cols-4 gap-2">
          {WAVEFORMS.map((w) => (
            <button
              key={w}
              onClick={() => setWaveform(w)}
              className={`px-2 py-2 rounded-lg text-xs font-mono border transition-all ${
                waveform === w
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-white/5 border-white/15 text-slate-400 hover:bg-white/10'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          sine = pure & soft · triangle = warm · square = retro · sawtooth = harsh / buzzy
        </p>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Pitch</label>
          <span className="text-xs font-mono text-slate-400">{freq} Hz</span>
        </div>
        <Slider value={[freq]} onValueChange={([v]) => setFreq(v)} min={100} max={1500} step={1} />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Length</label>
          <span className="text-xs font-mono text-slate-400">{durationMs} ms</span>
        </div>
        <Slider value={[durationMs]} onValueChange={([v]) => setDurationMs(v)} min={20} max={800} step={10} />
      </div>

      {/* Glide */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Pitch glide</label>
          <Switch checked={glide} onCheckedChange={setGlide} />
        </div>
        {glide && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-slate-500">slides to</span>
              <span className="text-xs font-mono text-slate-400">{glideTo} Hz</span>
            </div>
            <Slider value={[glideTo]} onValueChange={([v]) => setGlideTo(v)} min={100} max={1500} step={1} />
          </div>
        )}
      </div>

      <Button
        onClick={play}
        variant="ghost"
        className="w-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/25"
      >
        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Play
      </Button>
    </Card>
  );
};

// ── Main panel ──────────────────────────────────────────────────────────
export const SoundLab: React.FC<SoundLabProps> = ({ onBack }) => {
  const [enabled, setEnabled] = useState(SoundManager.isEnabled());
  const [volume, setVolume] = useState(Math.round(SoundManager.getVolume() * 100));

  const handleEnabledChange = (on: boolean) => {
    SoundManager.setEnabled(on);
    setEnabled(on);
    if (on) SoundManager.tap();
  };

  const handleVolumeChange = (v: number) => {
    SoundManager.setVolume(v / 100);
    setVolume(v);
  };

  return (
    <div className="flex-1 animate-fade-in max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>🔊</span> Sound Lab
          </h1>
          <p className="text-sm text-slate-400">
            Procedural UI sounds — Web Audio synthesis, no files, no MIDI. Click any card to hear it.
          </p>
        </div>
      </div>

      {/* Master controls */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
            <span className="text-sm font-semibold text-slate-200">
              Sound {enabled ? 'on' : 'off'}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-sm">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Volume</span>
            <Slider
              value={[volume]}
              onValueChange={([v]) => handleVolumeChange(v)}
              min={0}
              max={100}
              step={1}
              disabled={!enabled}
              className="flex-1"
            />
            <span className="text-xs font-mono text-slate-400 w-9 text-right">{volume}%</span>
          </div>
          <span className="text-[11px] text-slate-500 sm:ml-auto">Saved across sessions</span>
        </div>
      </Card>

      {/* Sound groups + designer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-8">
          {GROUP_ORDER.map((group) => {
            const specs = SOUND_SPECS.filter((s) => s.group === group);
            const meta = GROUP_META[group];
            return (
              <section key={group}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h2 className="text-lg font-bold text-slate-100">{meta.label}</h2>
                  <p className="text-xs text-slate-500">{meta.blurb}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {specs.map((spec) => (
                    <SoundCard key={spec.id} spec={spec} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <SoundDesigner />
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Wired into the app
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Per-challenge correct/incorrect sounds fire inside each primitive, and the
                completion celebration fires from{' '}
                <code className="text-slate-300">PhaseSummaryPanel</code> (tiered by score). To add
                an interaction sound anywhere, import{' '}
                <code className="text-slate-300">SoundManager</code> and call{' '}
                <code className="text-slate-300">.tap()</code>,{' '}
                <code className="text-slate-300">.select()</code>,{' '}
                <code className="text-slate-300">.snap()</code>, etc. on the event.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoundLab;
