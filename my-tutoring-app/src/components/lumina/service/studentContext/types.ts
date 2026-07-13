// Types for the per-student generation context returned by the backend
// (POST /api/student-profile/generation-context).
//
// Kept in a standalone module with no runtime imports so server-side code
// (gemini-manifest.ts via the Next manifest-stream route) can `import type`
// without pulling the client-side auth stack into the server bundle.

export type ObjectiveResolutionTier = 'exact' | 'none';

export interface ActiveMisconception {
  /** Private student-model diagnosis. Prompt input only; never render verbatim. */
  text: string;
  detectedAt?: string | null;
  sourceAttemptId?: string | null;
  primitiveType: string;
  scope: 'primitive' | 'skill';
  skillId?: string | null;
  subskillId?: string | null;
  misconceptionKey?: string;
}

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
  /** Active remediation signal for generation. Never student-visible copy. */
  activeMisconception?: ActiveMisconception;
}

/** Most recent calendar day of activity, from the durable attempt log. */
export interface StudentLastSession {
  /** YYYY-MM-DD */
  date: string;
  activityCount: number;
  /** 0–1 */
  successRate: number;
  primitiveTypes: string[];
  /** One prompt-embeddable sentence. */
  summary: string;
}

/**
 * Voice persona — identity/engagement facts for prompt FRAMING only (greeting
 * by name, interest theming, last-session continuity). Never carries model
 * quantities; difficulty/scope/phase decisions stay with the objective states.
 */
export interface StudentPersona {
  firstName?: string | null;
  interests?: string[];
  learningGoals?: string[];
  preferredLearningStyles?: string[];
  currentStreak?: number;
  lastSession?: StudentLastSession | null;
  /** One prompt-embeddable sentence rolling up the persona. */
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
  /** Voice persona; null/absent when nothing personally useful exists. */
  studentProfile?: StudentPersona | null;
  objectives: ObjectiveStudentState[];
  /** Session-level inventory; flattening applies exact component/scope joins. */
  activeMisconceptions?: ActiveMisconception[];
}
