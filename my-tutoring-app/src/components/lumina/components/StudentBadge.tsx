'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, BarChart3, LogOut, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStudent } from '../contexts/StudentContext';

// ═══════════════════════════════════════════════════════════════════════
// StudentBadge — the header user menu. Shows who is signed in and, on click,
// opens a dropdown with a quick glance at progression (level / XP / streak),
// a link into the full activity panel, and sign-out.
//
// Identity comes from two places:
//   - useAuth().userProfile  → the authenticated Firebase user (+ their
//     backend student_id mapping, plus engagement totals: XP/level/streak)
//   - useStudent().studentId → the student the Lumina app actually drives
//     (auth-resolved since step 4; NEXT_PUBLIC_LUMINA_DEV_STUDENT_ID pins it)
// They agree in production. When a dev pin diverges from the signed-in
// user's mapping, the chip shows a small amber "dev" marker so the pinning
// is visible instead of silently misleading.
// ═══════════════════════════════════════════════════════════════════════

interface StudentBadgeProps {
  /**
   * Open the full activity / progress panel. When omitted, the "My activity"
   * menu item is hidden (the dropdown still shows quick stats + sign-out).
   */
  onOpenActivity?: () => void;
}

/** A single quick-stat tile inside the dropdown header. */
const QuickStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col items-center rounded-lg bg-white/5 border border-white/10 py-1.5">
    <span className="text-sm font-bold text-slate-100 leading-none">{value}</span>
    <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

export const StudentBadge: React.FC<StudentBadgeProps> = ({ onOpenActivity }) => {
  const { user, userProfile, loading, logout } = useAuth();
  const { studentId } = useStudent();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
        <div className="w-2 h-2 rounded-full bg-slate-600" />
        <span className="text-xs text-slate-500">Not signed in</span>
      </div>
    );
  }

  const name =
    userProfile?.displayName ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'Student';
  const initial = name.charAt(0).toUpperCase();

  // The authenticated user's own student mapping vs. the student the app drives
  const authStudentId = userProfile?.student_id;
  const isDevPinned =
    authStudentId !== undefined && String(authStudentId) !== studentId;

  // Engagement totals (may be absent for a brand-new profile).
  const level = userProfile?.current_level ?? userProfile?.level;
  const xp = userProfile?.total_xp ?? userProfile?.total_points;
  const streak = userProfile?.current_streak ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.email ?? undefined}
        className={`flex items-center gap-2 px-2 py-1 pr-2.5 rounded-full border transition-colors ${
          open ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
        }`}
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-sm">
          <span className="text-[11px] font-bold text-white leading-none">{initial}</span>
        </div>
        <span className="text-xs text-slate-200 font-medium max-w-[120px] truncate">{name}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {isDevPinned && (
          <span
            className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded"
            title={`Signed-in user maps to student ${authStudentId}, but the app is dev-pinned to student ${studentId}`}
          >
            dev:{studentId}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-black/40 overflow-hidden z-50 animate-fade-in"
        >
          {/* Identity + quick progression glance */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-sm shrink-0">
                <span className="text-sm font-bold text-white leading-none">{initial}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">{name}</p>
                {user.email && (
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <QuickStat label="Level" value={level ?? '—'} />
              <QuickStat label="XP" value={xp ?? '—'} />
              <QuickStat
                label="Streak"
                value={
                  <span className="flex items-center gap-0.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    {streak}
                  </span>
                }
              />
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            {onOpenActivity && (
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpenActivity();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 transition-colors"
              >
                <BarChart3 className="w-4 h-4 text-slate-400" />
                My activity
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentBadge;
