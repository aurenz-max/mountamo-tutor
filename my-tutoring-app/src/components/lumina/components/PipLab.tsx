'use client';

/**
 * PipLab — audition surface for the Curator's character.
 *
 * Pip only appears inside a live lesson behind auth + an open Gemini session,
 * which makes "does the new listening pose read right?" an expensive question.
 * This is the same answer Sound Lab gives sounds: every mood side by side, a
 * size dial, and a mic level you can drive by hand OR with your actual voice —
 * fed by the same AudioCaptureService + RMS math the lesson uses, so the halo
 * you tune here is the halo the student gets.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import AudioCaptureService from '@/lib/AudioCaptureService';
import { usePerchAnchor } from '../hooks/usePerchAnchor';
import { PipCharacter, type PipMood } from './PipCharacter';

interface PipLabProps {
  onBack: () => void;
}

const MOODS: { mood: PipMood; label: string; when: string }[] = [
  { mood: 'happy', label: 'Happy', when: 'Idle — connected, nothing in flight' },
  { mood: 'listening', label: 'Listening', when: 'micLevel above the voice floor' },
  { mood: 'thinking', label: 'Thinking', when: 'isAIResponding, before audio starts' },
  { mood: 'speaking', label: 'Speaking', when: 'isAudioPlaying — the whole audio tail' },
  { mood: 'excited', label: 'Excited', when: 'Just finished a turn, or poked' },
  { mood: 'sleeping', label: 'Sleeping', when: 'Session ended / not connected' },
];

export const PipLab: React.FC<PipLabProps> = ({ onBack }) => {
  const [mood, setMood] = useState<PipMood>('happy');
  const [size, setSize] = useState(180);
  const [level, setLevel] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [pokes, setPokes] = useState(0);
  const serviceRef = useRef<AudioCaptureService | null>(null);

  // Perch preview. These mock cards carry the real data-primitive-instance-id
  // attribute and go through the real hook, so what you see here is the same
  // geometry a lesson produces — including the hop when the active card changes.
  const [activeCard, setActiveCard] = useState('lab-card-1');
  const perch = usePerchAnchor(activeCard, true);

  // Real mic → the same RMS the provider publishes as micLevel.
  useEffect(() => {
    if (!micOn) return;
    const service = new AudioCaptureService();
    serviceRef.current = service;
    service.setCallbacks({
      onAudioData: (frame: Float32Array) => {
        let sum = 0;
        for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
        setLevel(frame.length ? Math.sqrt(sum / frame.length) : 0);
      },
      onError: () => setMicOn(false),
    });
    void service.startCapture().catch(() => setMicOn(false));
    return () => {
      service.destroy();
      serviceRef.current = null;
      setLevel(0);
    };
  }, [micOn]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Pip Lab</h1>
          <p className="text-sm text-slate-400">
            Every mood of the Curator&apos;s character, driveable without a lesson.
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>

      {/* Stage */}
      <Card className="flex flex-col items-center gap-6 border-white/10 bg-slate-900/40 p-10 backdrop-blur-xl">
        <PipCharacter
          mood={mood}
          level={level}
          size={size}
          onPoke={() => setPokes((n) => n + 1)}
        />
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">{mood}</p>
          <p className="mt-1 text-sm text-slate-400">
            {MOODS.find((m) => m.mood === mood)?.when}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Tap Pip — {pokes} poke{pokes === 1 ? '' : 's'}. Move the pointer around the page to check the gaze.
          </p>
        </div>
      </Card>

      {/* Mood picker */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {MOODS.map((m) => (
          <button
            key={m.mood}
            onClick={() => setMood(m.mood)}
            className={`rounded-xl border p-3 text-left transition-all ${
              mood === m.mood
                ? 'border-cyan-400/60 bg-cyan-500/15 text-slate-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <span className="block text-sm font-bold">{m.label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{m.when}</span>
          </button>
        ))}
      </div>

      {/* Dials */}
      <Card className="mt-6 space-y-6 border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-200">Size</span>
            <span className="text-slate-500">{size}px</span>
          </div>
          <Slider value={[size]} min={64} max={320} step={4} onValueChange={([v]) => setSize(v)} />
          <p className="mt-1 text-[11px] text-slate-600">
            Lesson uses 124px docked, 152px asleep, 76px collapsed.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-200">Mic level (RMS)</span>
            <span className="text-slate-500">{level.toFixed(3)}</span>
          </div>
          <Slider
            value={[level]}
            min={0}
            max={0.15}
            step={0.002}
            onValueChange={([v]) => {
              if (!micOn) setLevel(v);
            }}
          />
          <div className="mt-3 flex items-center gap-3">
            <Button
              variant={micOn ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setMicOn((on) => !on)}
            >
              {micOn ? 'Stop my mic' : 'Use my mic'}
            </Button>
            <span className="text-[11px] text-slate-500">
              The halo only shows in the <strong className="text-slate-300">listening</strong> mood —
              that is how the lesson wires it.
            </span>
          </div>
        </div>
      </Card>

      {/* ── Perch preview ─────────────────────────────────────────────── */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-slate-100">Perch</h2>
        <p className="mb-4 text-sm text-slate-400">
          In a lesson Pip sits on the rim of whatever primitive the student is working on and hops
          across when they move on. Switch the active card and watch it travel — scroll too: the
          perch rides the rim, and lets go when the card leaves the screen.
        </p>

        <div className="mb-4 flex gap-2">
          {['lab-card-1', 'lab-card-2'].map((id, i) => (
            <Button
              key={id}
              size="sm"
              variant={activeCard === id ? 'default' : 'outline'}
              onClick={() => setActiveCard(id)}
            >
              Card {i + 1} {activeCard === id && '← active'}
            </Button>
          ))}
          <span className="self-center text-[11px] text-slate-500">
            {perch ? `perched at ${Math.round(perch.x)}, ${Math.round(perch.y)}` : 'docked (nothing to sit on)'}
          </span>
        </div>

        {['lab-card-1', 'lab-card-2'].map((id, i) => (
          <div
            key={id}
            data-primitive-instance-id={id}
            className="mb-20 flex h-64 items-center justify-center rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl"
          >
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-600">
              Mock primitive {i + 1}
            </span>
          </div>
        ))}

        {perch && (
          <motion.div
            className="pointer-events-none fixed left-0 top-0 z-40"
            initial={false}
            animate={{ x: perch.x, y: perch.y }}
            transition={{ type: 'spring', stiffness: 170, damping: 20, mass: 0.9 }}
          >
            <div className="flex -translate-x-full -translate-y-full items-end gap-2">
              <div className="pointer-events-auto translate-y-[36%]">
                <PipCharacter mood={mood} level={level} size={108} onPoke={() => setPokes((n) => n + 1)} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-slate-600">
        Every loop here is gated on <code>prefers-reduced-motion</code>. Flip it on in your OS to see
        the still poses — mood must still read from brow, eye and mouth shape alone.
      </p>
    </div>
  );
};

export default PipLab;
