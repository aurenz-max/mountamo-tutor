'use client';

/**
 * LuminaLanding — the public marketing front door for Lumina.
 *
 * Replaces the deprecated dashboard landing at `/`. It *introduces* the product
 * rather than cloning its home screen: a hero, a peek at real Lumina primitives
 * (composed from the `lumina/ui` kit — the same cards the app is built from),
 * the why, and the how. It shares the app's GenerativeBackground so the front
 * door and the product feel like one place. CTAs lead into /lumina, where the
 * real lesson pipeline lives.
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { GenerativeBackground } from '@/components/lumina/primitives/GenerativeBackground';
import { SoundManager } from '@/components/lumina/utils/SoundManager';
import {
  LuminaMark,
  LuminaCard,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaSectionLabel,
} from '@/components/lumina/ui';
import { CountingDemo, FillBlankDemo, TrueFalseDemo, WorksheetVsVisualDemo, AdaptiveDemo, CurriculumShowcase, HowItWorksDemo } from './LandingPrimitiveDemos';

// A few real K–5 topics — used for the "jump straight in" launch chips. Each
// hands its topic to /lumina, where the lesson builds itself.
const QUICK_TOPICS = ['the water cycle', 'adding fractions', 'telling time', 'why volcanoes erupt'];

export default function LuminaLanding() {
  const router = useRouter();
  // Auth-aware CTAs: a signed-in visitor should go straight into the app, never
  // bounce through /login. `loading` gates the auth-only buttons so they don't
  // flash "Sign in" before the session resolves.
  const { user, loading, logout } = useAuth();
  const signedOut = !loading && !user;
  const signedIn = !loading && !!user;

  // Account menu (only rendered when signed in) — the new Lumina chrome hides
  // the legacy nav, so this is the signed-in visitor's way to sign out.
  const [menuOpen, setMenuOpen] = useState(false);
  const handleSignOut = async () => {
    setMenuOpen(false);
    try {
      await logout();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  // Warm the (large) /lumina bundle on mount so the first click transitions
  // instantly instead of waiting on a cold chunk download.
  useEffect(() => {
    router.prefetch('/lumina');
  }, [router]);

  // Hand a topic to the product. Grade defaults to the elementary band; the app
  // refines from there.
  const go = (topic: string) => {
    SoundManager.navigate();
    router.push(`/lumina?${new URLSearchParams({ topic, grade: 'elementary' }).toString()}`);
  };

  const open = () => {
    SoundManager.navigate();
    router.push('/lumina');
  };

  // Create an account up front (vs. trying anonymously via `open`). The in-app
  // "save your progress" prompt is the primary signup on-ramp; this is the
  // explicit door for visitors who already know they want an account.
  const signup = () => {
    SoundManager.navigate();
    router.push('/login?mode=signup');
  };

  return (
    <div className="dark relative min-h-screen overflow-x-hidden text-slate-100 selection:bg-purple-500/30">
      {/* ── Shared background — the same canvas the app runs on, plus a faint grid ──
          The dark base sits at -z-20 (a pre-paint fallback); the GenerativeBackground
          canvas is -z-10. The root div must stay transparent — an opaque bg here
          would paint OVER the fixed canvas and hide it. */}
      <div aria-hidden className="fixed inset-0 -z-20 bg-slate-950" />
      <GenerativeBackground color="#8b5cf6" intensity={0.4} />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 35%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 35%, transparent 100%)',
        }}
      />

      {/* ── Top nav ── */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <LuminaMark size={34} />
          <span className="text-xl font-bold tracking-tight text-white">Lumina</span>
        </div>
        <div className="flex items-center gap-2">
          {signedOut && (
            <LuminaButton tone="subtle" onClick={() => router.push('/login')}>
              Sign in
            </LuminaButton>
          )}
          <LuminaButton tone="primary" onClick={open}>
            Open Lumina
          </LuminaButton>
          {signedIn && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
              >
                {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
              </button>
              {menuOpen && (
                <>
                  {/* click-away */}
                  <div
                    className="fixed inset-0 z-30"
                    aria-hidden
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
                    <div className="border-b border-white/5 px-4 py-3">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {user?.displayName || 'Signed in'}
                      </p>
                      <p className="truncate text-xs text-slate-400">{user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Hero — introduce the product ── */}
      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pt-16 pb-10 text-center sm:pt-24">
        <LuminaBadge accent="purple" className="mb-6 gap-1.5 px-3 py-1 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Adaptive learning for K–5
        </LuminaBadge>

        <h1 className="text-5xl font-bold leading-[1.05] tracking-tighter sm:text-7xl">
          <span className="bg-gradient-to-br from-white via-blue-100 to-slate-400 bg-clip-text text-transparent">
            Learn
          </span>{' '}
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            anything.
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-slate-400">
          Lumina turns any K–5 topic into an interactive, visual lesson — then
          adapts the difficulty to your child as they go. Learning they can
          touch, not worksheets they fill out.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <LuminaButton tone="primary" size="lg" className="gap-1.5" onClick={open}>
            Open Lumina
            <ArrowRight className="h-4 w-4" />
          </LuminaButton>
          {signedOut && (
            <LuminaButton tone="subtle" size="lg" onClick={() => router.push('/login')}>
              Sign in
            </LuminaButton>
          )}
        </div>

        {/* Jump straight in — a light nod to "learn anything", not the app's search */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Try
          </span>
          {QUICK_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => go(t)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* ── Peek inside — real Lumina design cards / primitives ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <LuminaSectionLabel accent="cyan" size="sm">
            A peek inside
          </LuminaSectionLabel>
          <p className="mt-3 max-w-lg text-sm text-slate-400">
            These are real Lumina primitives — go ahead, try them. Every topic
            becomes something you can play with like this.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          <CountingDemo onOpen={() => go('counting to 10')} />
          <FillBlankDemo onOpen={() => go('what plants need to grow')} />
          <TrueFalseDemo onOpen={() => go('states of matter')} />
        </div>
      </section>

      {/* ── Why Lumina ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Learning they can{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
              touch
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {/* Visual, not worksheets — shown live: the same sum, paper vs. primitive */}
          <WorksheetVsVisualDemo />

          {/* Adapts in real time — shown live */}
          <AdaptiveDemo />
        </div>
      </section>

      {/* ── Built for K–5 — shown, not told: the curriculum map itself ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <LuminaSectionLabel accent="emerald" size="sm">
            Built for K–5
          </LuminaSectionLabel>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A full curriculum,{' '}
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              every grade
            </span>
          </h2>
          <p className="mt-3 max-w-lg text-sm text-slate-400">
            Math, reading, science, and social studies — mapped, sequenced, and
            ready to route a learner through, Kindergarten to grade 5. Spin the
            wheel.
          </p>
        </div>
        <CurriculumShowcase />
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex justify-center">
          <LuminaSectionLabel accent="purple" size="sm">
            How it works
          </LuminaSectionLabel>
        </div>
        <HowItWorksDemo />
      </section>

      {/* ── Final CTA ── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <LuminaCard surface="elevated">
          <LuminaCardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center">
            <LuminaMark size={56} progress={100} />
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to learn{' '}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                anything
              </span>
              ?
            </h2>
            <p className="max-w-md text-slate-400">
              Open Lumina and start with a single topic. The lesson builds itself.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <LuminaButton tone="primary" size="lg" className="gap-1.5" onClick={open}>
                Open Lumina
                <ArrowRight className="h-4 w-4" />
              </LuminaButton>
              {signedOut && (
                <LuminaButton tone="subtle" size="lg" onClick={signup}>
                  Create free account
                </LuminaButton>
              )}
            </div>
          </LuminaCardContent>
        </LuminaCard>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <LuminaMark size={22} variant="bare" />
            <span className="font-semibold text-slate-300">Lumina</span>
            <span className="text-slate-600">— adaptive learning for K–5</span>
          </div>
          <span className="text-slate-600">Built on visual primitives, not worksheets.</span>
        </div>
      </footer>
    </div>
  );
}
