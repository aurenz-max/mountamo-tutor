'use client';

/**
 * SaveProgressPrompt — the anonymous → account on-ramp inside Lumina.
 *
 * An anonymous visitor runs as the shared fallback student, so the XP, streak,
 * and competency they earn is never attributed to them. This prompt appears at
 * the natural "you've done real work" moment (first competency update / lesson
 * completion) and invites them to create a free account — carrying the *live*
 * topic + grade into signup so they land straight back in the exact lesson,
 * now personalized. This is the seam that ties signup + profile creation to the
 * Lumina experience.
 */
import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaButton,
  LuminaMark,
} from '../ui';
import type { GradeLevel } from './GradeLevelSelector';
import { SoundManager } from '../utils/SoundManager';

interface SaveProgressPromptProps {
  /** The lesson the visitor is currently in — carried into signup so they resume it. */
  topic: string;
  /** The grade band of the current lesson — carried alongside the topic. */
  gradeLevel: GradeLevel;
  /** Dismiss without signing up ("keep exploring"). */
  onDismiss: () => void;
}

export const SaveProgressPrompt: React.FC<SaveProgressPromptProps> = ({
  topic,
  gradeLevel,
  onDismiss,
}) => {
  const router = useRouter();

  // Where the visitor returns to *after* signup — the exact lesson they were in.
  // Grade rides along for the resumed lesson; at signup they pick their real
  // K–5 grade, which becomes their personalization grade going forward.
  const resume = topic
    ? `/lumina?${new URLSearchParams({ topic, grade: gradeLevel }).toString()}`
    : '/lumina';

  const goToSignup = () => {
    SoundManager.navigate();
    router.push(`/login?mode=signup&redirect=${encodeURIComponent(resume)}`);
  };

  const goToSignin = () => {
    SoundManager.navigate();
    router.push(`/login?redirect=${encodeURIComponent(resume)}`);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-progress-title"
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden
      />

      <LuminaCard surface="elevated" className="relative z-10 w-full max-w-md">
        <LuminaCardContent className="flex flex-col items-center gap-5 px-6 py-8 text-center">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-4 top-4 text-slate-500 transition-colors hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>

          <LuminaMark size={52} progress={100} />

          <div className="flex flex-col gap-2">
            <h2
              id="save-progress-title"
              className="text-2xl font-bold tracking-tight text-white"
            >
              Nice work — want to{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
                save it
              </span>
              ?
            </h2>
            <p className="mx-auto max-w-sm text-sm text-slate-400">
              Create a free account to keep your XP and streak, and let Lumina
              adapt each lesson to you. You&apos;ll pick up right where you left
              off.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <LuminaButton
              tone="primary"
              size="lg"
              className="w-full gap-1.5"
              onClick={goToSignup}
            >
              <Sparkles className="h-4 w-4" />
              Create free account
            </LuminaButton>
            <LuminaButton
              tone="subtle"
              className="w-full"
              onClick={onDismiss}
            >
              Keep exploring
            </LuminaButton>
          </div>

          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={goToSignin}
              className="font-medium text-cyan-300 transition-colors hover:text-cyan-200"
            >
              Sign in
            </button>
          </p>
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

export default SaveProgressPrompt;
