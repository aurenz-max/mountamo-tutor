// Types for the per-student generation context returned by the backend
// (POST /api/student-profile/generation-context).
//
// Kept in a standalone module with no runtime imports so server-side code
// (gemini-manifest.ts via the Next manifest-stream route) can `import type`
// without pulling the client-side auth stack into the server bundle.

export type ObjectiveResolutionTier = 'exact' | 'none';

export interface ObjectiveStudentState {
  objectiveId: string;
  objectiveText: string;
  /** 'exact' = resolved to a curriculum subskill; 'none' = retrieval abstained */
  tier: ObjectiveResolutionTier;
  subskillId?: string;
  subskillDescription?: string;
  skillId?: string;
  /** Retrieval cosine confidence for the resolution */
  confidence?: number;
  /** Mastery gate 0–4 */
  masteryGate?: number;
  retentionState?: string;
  /** Blended competency score 0–10 */
  competencyScore?: number;
  credibility?: number;
  totalAttempts?: number;
  /** IRT ability estimate, 0–10 scale */
  theta?: number | null;
  /** Estimated P(correct) at typical item difficulty for this skill */
  pCorrect?: number | null;
  /** One prompt-embeddable sentence describing this objective's state */
  summary: string;
}

export interface StudentGenerationContext {
  available: boolean;
  studentId?: string;
  subject?: string | null;
  gradeLevel?: string | null;
  /** Set when available=false (e.g. 'no_subject_scope', 'internal_error') */
  reason?: string;
  overallSummary?: string;
  objectives: ObjectiveStudentState[];
}
