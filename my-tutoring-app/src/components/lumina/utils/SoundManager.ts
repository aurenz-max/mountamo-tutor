/**
 * SoundManager — Procedural UI sounds via the Web Audio API.
 *
 * No audio files, no MIDI. Every sound is a small data spec (a list of notes,
 * each with a frequency, waveform, start offset and duration). `play()`
 * schedules those notes on an AudioContext with a click-free volume envelope.
 *
 * One source of truth: the same SOUND_SPECS array drives both real playback
 * and the Sound Lab dev tool, so what you audition is exactly what ships.
 *
 * Design rules for "intuitive" UI sound:
 *   - Keep it short (50–250ms) so repetition never grates.
 *   - Consonant musical intervals (3rds, 5ths, octaves) read as "good".
 *   - Soft, low, short tones read as "neutral / no" without punishing.
 *   - Rising pitch = progress / on; falling pitch = undo / off.
 *
 * Singleton — import { SoundManager } and call directly.
 */

export type Waveform = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface Note {
  /** Frequency in Hz. */
  freq: number;
  /** Start offset from the trigger moment, in seconds. */
  start: number;
  /** How long the note rings, in seconds. */
  duration: number;
  /** Oscillator shape. Defaults to 'sine'. */
  waveform?: Waveform;
  /** Relative loudness 0–1 (multiplied by master volume). Defaults to 1. */
  gain?: number;
  /** Optional pitch glide target in Hz (sweeps from `freq` to this over the note). */
  glideTo?: number;
}

export type SoundGroup = 'feedback' | 'interaction' | 'celebration';

export interface SoundSpec {
  id: string;
  label: string;
  group: SoundGroup;
  /** Plain-language description of when to play this and what it conveys. */
  description: string;
  notes: Note[];
}

// ── Note frequencies (equal temperament) ────────────────────────────────
const NOTE = {
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
} as const;

// ── The palette ─────────────────────────────────────────────────────────
// Everything the app can play lives here. Add a sound = add an entry.

export const SOUND_SPECS: SoundSpec[] = [
  // ── Interaction: tiny, frequent, must never annoy ──
  {
    id: 'tap',
    label: 'Tap',
    group: 'interaction',
    description: 'Neutral button / card press. The everyday click.',
    notes: [{ freq: NOTE.E5, start: 0, duration: 0.06, waveform: 'sine', gain: 0.5 }],
  },
  {
    id: 'select',
    label: 'Select',
    group: 'interaction',
    description: 'Confirms an option was chosen — a touch brighter than a tap.',
    notes: [{ freq: NOTE.A5, start: 0, duration: 0.08, waveform: 'triangle', gain: 0.5 }],
  },
  {
    id: 'toggleOn',
    label: 'Toggle On',
    group: 'interaction',
    description: 'Switching something on — two quick rising blips.',
    notes: [
      { freq: NOTE.E5, start: 0, duration: 0.05, waveform: 'sine', gain: 0.5 },
      { freq: NOTE.A5, start: 0.05, duration: 0.06, waveform: 'sine', gain: 0.5 },
    ],
  },
  {
    id: 'toggleOff',
    label: 'Toggle Off',
    group: 'interaction',
    description: 'Switching something off — two quick falling blips.',
    notes: [
      { freq: NOTE.A5, start: 0, duration: 0.05, waveform: 'sine', gain: 0.5 },
      { freq: NOTE.E5, start: 0.05, duration: 0.06, waveform: 'sine', gain: 0.5 },
    ],
  },
  {
    id: 'navigate',
    label: 'Navigate',
    group: 'interaction',
    description: 'Moving between screens / panels — a soft rising whoosh.',
    notes: [{ freq: NOTE.G4, start: 0, duration: 0.18, waveform: 'sine', gain: 0.35, glideTo: NOTE.A5 }],
  },
  {
    id: 'pop',
    label: 'Pop',
    group: 'interaction',
    description: 'An element appears / opens — a quick bubble pop.',
    notes: [{ freq: NOTE.C5, start: 0, duration: 0.07, waveform: 'sine', gain: 0.45, glideTo: NOTE.G5 }],
  },
  {
    id: 'snap',
    label: 'Snap / Drop',
    group: 'interaction',
    description: 'A dragged item lands in place — low thunk plus a high click.',
    notes: [
      { freq: NOTE.G3, start: 0, duration: 0.09, waveform: 'triangle', gain: 0.55 },
      { freq: NOTE.E6, start: 0.01, duration: 0.04, waveform: 'sine', gain: 0.3 },
    ],
  },
  {
    id: 'tick',
    label: 'Tick',
    group: 'interaction',
    description: 'Slider / stepper increment — barely-there click for rapid repeats.',
    notes: [{ freq: NOTE.C6, start: 0, duration: 0.025, waveform: 'square', gain: 0.18 }],
  },
  {
    id: 'invalid',
    label: 'Invalid',
    group: 'interaction',
    description: 'A blocked / not-allowed action — soft low "uh-uh" (not a wrong answer).',
    notes: [
      { freq: NOTE.A3, start: 0, duration: 0.07, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.A3, start: 0.1, duration: 0.07, waveform: 'sine', gain: 0.4 },
    ],
  },

  // ── Feedback: answer evaluation ──
  {
    id: 'correct',
    label: 'Correct',
    group: 'feedback',
    description: 'A correct answer — bright ascending C-major arpeggio (C5 E5 G5).',
    notes: [
      { freq: NOTE.C5, start: 0, duration: 0.3, waveform: 'sine', gain: 0.9 },
      { freq: NOTE.E5, start: 0.09, duration: 0.3, waveform: 'sine', gain: 0.9 },
      { freq: NOTE.G5, start: 0.18, duration: 0.32, waveform: 'sine', gain: 0.9 },
    ],
  },
  {
    id: 'incorrect',
    label: 'Incorrect',
    group: 'feedback',
    description: 'A wrong answer — gentle low tone that dips. Feedback, not punishment.',
    notes: [{ freq: NOTE.E4, start: 0, duration: 0.25, waveform: 'sine', gain: 0.5, glideTo: 260 }],
  },

  // ── Celebration: milestones ──
  {
    id: 'streak',
    label: 'Streak',
    group: 'celebration',
    description: 'Several correct in a row — an accelerating "level-up" run that lands bright, with a sparkle on top.',
    notes: [
      // Bass launch — gives the run body
      { freq: NOTE.C4, start: 0, duration: 0.28, waveform: 'sine', gain: 0.45 },
      // Accelerating major-pentatonic climb (warm triangle)
      { freq: NOTE.C5, start: 0, duration: 0.16, waveform: 'triangle', gain: 0.85 },
      { freq: NOTE.E5, start: 0.06, duration: 0.16, waveform: 'triangle', gain: 0.85 },
      { freq: NOTE.G5, start: 0.12, duration: 0.16, waveform: 'triangle', gain: 0.85 },
      { freq: NOTE.A5, start: 0.18, duration: 0.16, waveform: 'triangle', gain: 0.85 },
      { freq: NOTE.C6, start: 0.24, duration: 0.32, waveform: 'triangle', gain: 0.95 },
      // Sparkle shimmer on the landing
      { freq: NOTE.E6, start: 0.3, duration: 0.35, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.G6, start: 0.36, duration: 0.35, waveform: 'sine', gain: 0.3 },
    ],
  },
  {
    id: 'perfect',
    label: 'Perfect',
    group: 'celebration',
    description: 'A perfect score — triumphant arpeggio (C5 E5 G5 C6) into a sustained chord.',
    notes: [
      { freq: NOTE.C5, start: 0, duration: 0.5, waveform: 'triangle', gain: 0.8 },
      { freq: NOTE.E5, start: 0.12, duration: 0.5, waveform: 'triangle', gain: 0.8 },
      { freq: NOTE.G5, start: 0.24, duration: 0.5, waveform: 'triangle', gain: 0.8 },
      { freq: NOTE.C6, start: 0.36, duration: 0.5, waveform: 'triangle', gain: 0.8 },
      // Sustained closing chord
      { freq: NOTE.C5, start: 0.48, duration: 0.7, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.E5, start: 0.48, duration: 0.7, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.G5, start: 0.48, duration: 0.7, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.C6, start: 0.48, duration: 0.7, waveform: 'sine', gain: 0.4 },
    ],
  },
];

const SPECS_BY_ID: Record<string, SoundSpec> = Object.fromEntries(
  SOUND_SPECS.map((s) => [s.id, s]),
);

/** Derived "recipe" metadata for display in the Sound Lab. */
export function describeSound(spec: SoundSpec) {
  const waveforms = Array.from(new Set(spec.notes.map((n) => n.waveform ?? 'sine')));
  const freqs = spec.notes.flatMap((n) => [n.freq, n.glideTo].filter((f): f is number => f != null));
  const totalDuration = Math.max(...spec.notes.map((n) => n.start + n.duration));
  return {
    noteCount: spec.notes.length,
    waveforms,
    minFreq: Math.round(Math.min(...freqs)),
    maxFreq: Math.round(Math.max(...freqs)),
    durationMs: Math.round(totalDuration * 1000),
  };
}

const STORAGE_KEY = 'lumina.sound.prefs';
const ATTACK = 0.008; // seconds — short fade-in so onsets don't click

class SoundManagerImpl {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.3; // 0–1 master

  constructor() {
    this.loadPrefs();
  }

  // ── Preferences (persisted) ──
  private loadPrefs() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { enabled?: boolean; volume?: number };
      if (typeof p.enabled === 'boolean') this.enabled = p.enabled;
      if (typeof p.volume === 'number') this.volume = Math.max(0, Math.min(1, p.volume));
    } catch {
      /* ignore corrupt prefs */
    }
  }

  private savePrefs() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ enabled: this.enabled, volume: this.volume }),
      );
    } catch {
      /* storage may be unavailable */
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    // Browsers start contexts suspended until a user gesture.
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // ── Public settings API ──
  setEnabled(on: boolean) {
    this.enabled = on;
    this.savePrefs();
  }

  isEnabled() {
    return this.enabled;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.savePrefs();
  }

  getVolume() {
    return this.volume;
  }

  // ── Core scheduler ──
  /** Play an arbitrary sound spec. Used by the named helpers and the Sound Lab. */
  play(spec: SoundSpec) {
    if (!this.enabled) {
      console.debug('[SoundManager] skip (muted):', spec.id);
      return;
    }
    const ctx = this.getContext();
    if (!ctx) {
      console.debug('[SoundManager] skip (no AudioContext / SSR):', spec.id);
      return;
    }
    console.debug('[SoundManager] play:', spec.id, '| ctx.state =', ctx.state, '| volume =', this.volume);

    const now = ctx.currentTime;
    for (const note of spec.notes) {
      this.scheduleNote(ctx, note, now);
    }
  }

  /** Play a single ad-hoc note (used by the Sound Lab's design-your-own panel). */
  playNote(note: Note) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.scheduleNote(ctx, note, ctx.currentTime);
  }

  /** Play by id — convenient for the Sound Lab buttons. */
  playById(id: string) {
    const spec = SPECS_BY_ID[id];
    if (spec) this.play(spec);
  }

  private scheduleNote(ctx: AudioContext, note: Note, now: number) {
    const t = now + note.start;
    const peak = Math.max(0.0001, this.volume * (note.gain ?? 1) * 0.5);

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    // Click-free envelope: fast exponential attack, then decay to silence.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + ATTACK);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.duration);

    const osc = ctx.createOscillator();
    osc.type = note.waveform ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, t);
    if (note.glideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, note.glideTo), t + note.duration);
    }
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + note.duration + 0.02);
  }

  // ── Named helpers (stable API for the rest of the app) ──
  tap() { this.play(SPECS_BY_ID.tap); }
  select() { this.play(SPECS_BY_ID.select); }
  toggle(on: boolean) { this.play(SPECS_BY_ID[on ? 'toggleOn' : 'toggleOff']); }
  navigate() { this.play(SPECS_BY_ID.navigate); }
  pop() { this.play(SPECS_BY_ID.pop); }
  snap() { this.play(SPECS_BY_ID.snap); }
  tick() { this.play(SPECS_BY_ID.tick); }
  invalid() { this.play(SPECS_BY_ID.invalid); }

  playCorrect() { this.play(SPECS_BY_ID.correct); }
  playIncorrect() { this.play(SPECS_BY_ID.incorrect); }
  playStreak() { this.play(SPECS_BY_ID.streak); }
  playPerfect() { this.play(SPECS_BY_ID.perfect); }
}

export const SoundManager = new SoundManagerImpl();
