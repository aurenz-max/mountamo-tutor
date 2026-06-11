'use client';

import React, { createContext, useContext } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// StudentContext — the single place student identity is resolved in Lumina.
//
// Every consumer (daily session, evaluation attribution, generation
// personalization, tutor) reads the id from here, never from a literal.
//
// STEP-4 SWAP POINT: replace DEV_STUDENT_ID with the authenticated user's
// student mapping. The backend already resolves firebase_uid → student_id
// in get_user_context (backend/app/core/middleware.py), so the swap is a
// resolver change in this file only.
// ═══════════════════════════════════════════════════════════════════════

const DEV_STUDENT_ID = '1';

interface StudentContextValue {
  studentId: string;
}

const StudentContext = createContext<StudentContextValue>({
  studentId: DEV_STUDENT_ID,
});

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <StudentContext.Provider value={{ studentId: DEV_STUDENT_ID }}>
      {children}
    </StudentContext.Provider>
  );
};

export function useStudent(): StudentContextValue {
  return useContext(StudentContext);
}
