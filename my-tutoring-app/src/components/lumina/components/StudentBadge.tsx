'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStudent } from '../contexts/StudentContext';

// ═══════════════════════════════════════════════════════════════════════
// StudentBadge — header chip showing who is signed in and which student
// the app is driving.
//
// Identity comes from two places:
//   - useAuth().userProfile  → the authenticated Firebase user (+ their
//     backend student_id mapping)
//   - useStudent().studentId → the student the Lumina app actually drives
//     (auth-resolved since step 4; NEXT_PUBLIC_LUMINA_DEV_STUDENT_ID pins it)
// They agree in production. When a dev pin diverges from the signed-in
// user's mapping, the chip shows a small amber "dev" marker so the pinning
// is visible instead of silently misleading.
// ═══════════════════════════════════════════════════════════════════════

export const StudentBadge: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const { studentId } = useStudent();

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

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 pr-3 rounded-full bg-white/5 border border-white/10"
      title={user.email ?? undefined}
    >
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-sm">
        <span className="text-[11px] font-bold text-white leading-none">{initial}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-200 font-medium max-w-[120px] truncate">
          {name}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </div>
      {isDevPinned && (
        <span
          className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded"
          title={`Signed-in user maps to student ${authStudentId}, but the app is dev-pinned to student ${studentId}`}
        >
          dev:{studentId}
        </span>
      )}
    </div>
  );
};

export default StudentBadge;
