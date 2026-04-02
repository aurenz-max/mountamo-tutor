'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useEvaluationContext } from '../evaluation';
import { SoundManager } from '../utils/SoundManager';

// ── Celebration Config ──────────────────────────────────────────

const STREAK_THRESHOLD = 3; // Show streak celebration at 3+ correct in a row

// ── Edge glow flash ─────────────────────────────────────────────

const GlowFlash: React.FC<{
  color: 'emerald' | 'amber' | 'purple';
  trigger: number; // Increment to re-trigger
}> = ({ color, trigger }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 600);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!active) return null;

  const colorMap = {
    emerald: 'from-emerald-500/30',
    amber: 'from-amber-500/30',
    purple: 'from-purple-500/30',
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{ animation: 'celebrationGlow 600ms ease-out forwards' }}
    >
      <div className={`absolute inset-0 bg-gradient-to-t ${colorMap[color]} to-transparent opacity-0`}
        style={{ animation: 'celebrationGlow 600ms ease-out forwards' }}
      />
    </div>
  );
};

// ── Streak popup ────────────────────────────────────────────────

const StreakPopup: React.FC<{ streak: number; trigger: number }> = ({ streak, trigger }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div
        className="text-center"
        style={{ animation: 'streakPopIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards, streakFadeOut 400ms ease-in 1400ms forwards' }}
      >
        <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 drop-shadow-lg">
          {streak}x
        </div>
        <div className="text-lg font-bold text-amber-300/90 tracking-wider uppercase mt-1">
          Streak!
        </div>
      </div>
    </div>
  );
};

// ── Correct answer floating indicator ───────────────────────────

const CorrectFlash: React.FC<{ trigger: number }> = ({ trigger }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-end justify-center pb-32">
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm"
        style={{ animation: 'floatUp 1000ms ease-out forwards' }}
      >
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-semibold text-emerald-300">Correct!</span>
      </div>
    </div>
  );
};

// ── Confetti helpers ────────────────────────────────────────────

function fireSmallConfetti() {
  confetti({
    particleCount: 40,
    spread: 55,
    origin: { y: 0.7 },
    colors: ['#34d399', '#60a5fa', '#a78bfa', '#fbbf24'],
    zIndex: 9999,
    disableForReducedMotion: true,
  });
}

function fireStreakConfetti() {
  const defaults = { origin: { y: 0.65 }, zIndex: 9999, disableForReducedMotion: true };

  confetti({
    ...defaults,
    particleCount: 60,
    spread: 70,
    colors: ['#fbbf24', '#f59e0b', '#f97316', '#ef4444'],
  });

  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 40,
      spread: 90,
      startVelocity: 35,
      colors: ['#fbbf24', '#f59e0b', '#f97316'],
    });
  }, 150);
}

function firePerfectConfetti() {
  const count = 200;
  const defaults = { origin: { y: 0.7 }, zIndex: 9999, disableForReducedMotion: true };

  function fire(ratio: number, opts: confetti.Options) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * ratio) });
  }

  fire(0.25, { spread: 26, startVelocity: 55, colors: ['#a78bfa', '#818cf8', '#6366f1'] });
  fire(0.2, { spread: 60, colors: ['#34d399', '#10b981'] });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#fbbf24', '#f59e0b'] });

  setTimeout(() => {
    fire(0.15, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: ['#f472b6', '#ec4899'] });
    fire(0.1, { spread: 120, startVelocity: 45, colors: ['#60a5fa', '#3b82f6'] });
  }, 200);
}

// ── Main component ──────────────────────────────────────────────

export const CelebrationLayer: React.FC = () => {
  const context = useEvaluationContext();
  const prevCountRef = useRef(0);

  // Trigger counters (increment to re-fire animations)
  const [glowTrigger, setGlowTrigger] = useState(0);
  const [glowColor, setGlowColor] = useState<'emerald' | 'amber' | 'purple'>('emerald');
  const [streakTrigger, setStreakTrigger] = useState(0);
  const [correctTrigger, setCorrectTrigger] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  const computeStreak = useCallback((results: { success: boolean }[]) => {
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].success) streak++;
      else break;
    }
    return streak;
  }, []);

  const submittedResults = context?.submittedResults ?? [];

  useEffect(() => {
    if (submittedResults.length <= prevCountRef.current) {
      prevCountRef.current = submittedResults.length;
      return;
    }

    const latest = submittedResults[submittedResults.length - 1];
    const streak = computeStreak(submittedResults);
    setCurrentStreak(streak);
    prevCountRef.current = submittedResults.length;

    if (latest.success) {
      // Perfect score
      if (latest.score >= 100) {
        SoundManager.playPerfect();
        firePerfectConfetti();
        setGlowColor('purple');
        setGlowTrigger(t => t + 1);
      }
      // Streak milestone
      else if (streak >= STREAK_THRESHOLD && streak % 1 === 0) {
        SoundManager.playStreak();
        fireStreakConfetti();
        setGlowColor('amber');
        setGlowTrigger(t => t + 1);
        setStreakTrigger(t => t + 1);
      }
      // Normal correct
      else {
        SoundManager.playCorrect();
        fireSmallConfetti();
        setGlowColor('emerald');
        setGlowTrigger(t => t + 1);
      }
      setCorrectTrigger(t => t + 1);
    } else {
      SoundManager.playIncorrect();
    }
  }, [submittedResults.length, submittedResults, computeStreak]);

  return (
    <>
      {/* Inject keyframes */}
      <style>{`
        @keyframes celebrationGlow {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes streakPopIn {
          0%   { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes streakFadeOut {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.1) translateY(-20px); }
        }
        @keyframes floatUp {
          0%   { opacity: 0; transform: translateY(20px) scale(0.9); }
          30%  { opacity: 1; transform: translateY(0) scale(1); }
          80%  { opacity: 1; transform: translateY(-10px); }
          100% { opacity: 0; transform: translateY(-30px); }
        }
      `}</style>

      <GlowFlash color={glowColor} trigger={glowTrigger} />
      <CorrectFlash trigger={correctTrigger} />
      <StreakPopup streak={currentStreak} trigger={streakTrigger} />
    </>
  );
};

export default CelebrationLayer;
