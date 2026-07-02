'use client';

import React, { createContext, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════
// StudentContext — the single place student identity is resolved in Lumina.
//
// Every consumer (daily session, evaluation attribution, generation
// personalization, tutor) reads the id from here, never from a literal.
//
// Resolution order (step 4 of the personalization plan — auth is live):
//   1. NEXT_PUBLIC_LUMINA_DEV_STUDENT_ID — explicit dev pin. Wins over auth
//      so IRT/persona paths can be tested against a seeded student (e.g.
//      1004); StudentBadge shows the amber "dev:N" marker when it diverges
//      from the signed-in user's mapping.
//   2. The authenticated user's student_id (firebase_uid → student_id,
//      resolved by get_user_context on the backend and carried on
//      AuthContext.userProfile).
//   3. FALLBACK_STUDENT_ID — unauthenticated / profile still loading. Auth
//      loading briefly resolves here, then flips to the real id; sessions
//      started after load (the normal path) never see the fallback.
// ═══════════════════════════════════════════════════════════════════════

const DEV_PIN = process.env.NEXT_PUBLIC_LUMINA_DEV_STUDENT_ID;
const FALLBACK_STUDENT_ID = '1';

interface StudentContextValue {
  studentId: string;
  /**
   * True when no real student is behind this session — no signed-in user and
   * no dev pin, so studentId is the shared FALLBACK. Consumers use this to
   * invite the visitor to create an account (the "sign up to save" on-ramp)
   * before their progress is attributed to the anonymous fallback and lost.
   */
  isAnonymous: boolean;
  /**
   * True once identity is RESOLVED: dev pin, confirmed signed-out (anonymous),
   * or the signed-in user's student mapping has arrived. While auth/profile
   * are in flight, studentId is still the shared fallback — surfaces that
   * fetch student-scoped data must wait for ready instead of firing requests
   * for the fallback id (they 403 and get cached as empty).
   */
  ready: boolean;
}

const StudentContext = createContext<StudentContextValue>({
  studentId: DEV_PIN || FALLBACK_STUDENT_ID,
  isAnonymous: !DEV_PIN,
  ready: true,
});

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile, loading } = useAuth();

  const studentId =
    DEV_PIN ||
    (userProfile?.student_id != null ? String(userProfile.student_id) : FALLBACK_STUDENT_ID);

  // A dev pin is a real (seeded) student for testing; only treat a session as
  // anonymous when there's neither a pin nor a signed-in Firebase user.
  const isAnonymous = !DEV_PIN && !user;

  // Signed-in but profile not yet loaded (initial fetch or background retry
  // after a transient failure) → not ready; AuthContext keeps retrying, so
  // this resolves rather than sticking.
  const ready = !!DEV_PIN || (!loading && (!user || userProfile?.student_id != null));

  return (
    <StudentContext.Provider value={{ studentId, isAnonymous, ready }}>
      {children}
    </StudentContext.Provider>
  );
};

export function useStudent(): StudentContextValue {
  return useContext(StudentContext);
}
