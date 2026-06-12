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
}

const StudentContext = createContext<StudentContextValue>({
  studentId: DEV_PIN || FALLBACK_STUDENT_ID,
});

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();

  const studentId =
    DEV_PIN ||
    (userProfile?.student_id != null ? String(userProfile.student_id) : FALLBACK_STUDENT_ID);

  return (
    <StudentContext.Provider value={{ studentId }}>
      {children}
    </StudentContext.Provider>
  );
};

export function useStudent(): StudentContextValue {
  return useContext(StudentContext);
}
