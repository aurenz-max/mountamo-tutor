'use client';

// Shown instantly during navigation into /lumina while the (large) app bundle
// loads — so the click gives immediate feedback instead of feeling frozen.
// Imported directly from the file (not the kit barrel) to stay lightweight.
import { LuminaMark } from '@/components/lumina/ui/LuminaMark';

export default function LuminaLoading() {
  return (
    <div className="dark fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-slate-950">
      <div className="absolute -z-10 h-72 w-72 rounded-full bg-purple-600/15 blur-[120px]" />
      <LuminaMark size={64} className="animate-pulse" />
      <p className="text-sm font-medium tracking-wide text-slate-400">Loading Lumina…</p>
    </div>
  );
}
