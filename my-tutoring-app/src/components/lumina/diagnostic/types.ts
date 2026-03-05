/**
 * Diagnostic Placement Engine — Frontend Types
 *
 * Mirrors backend/app/models/diagnostic.py for type-safe API communication.
 */

// ---------------------------------------------------------------------------
// Backend mirror types
// ---------------------------------------------------------------------------

export type DiagnosticStatus =
  | 'unknown'
  | 'probed_mastered'
  | 'probed_not_mastered'
  | 'inferred_mastered'
  | 'inferred_not_mastered';

export type DiagnosticSessionState = 'in_progress' | 'completed' | 'abandoned';

export interface ProbeRequest {
  subskill_id: string;
  subject: string;
  skill_id: string;
  skill_description: string;
  description: string;
  items_needed: number; // 3-5
  depth: number;
  chain_length: number;
  reason: string;
}

export interface InferenceMade {
  source_probe: string;
  direction: 'upward' | 'downward';
  affected_node: string;
  new_status: DiagnosticStatus;
}

export interface SubjectSummary {
  subject: string;
  total_skills: number;
  mastered: number;
  not_mastered: number;
  unknown: number;
  mastery_pct: number;
  frontier_skills: string[];
}

// ---------------------------------------------------------------------------
// API request/response types
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  subjects?: string[];
}

export interface CreateSessionResponse {
  session_id: string;
  student_id: number;
  subjects: string[];
  total_nodes: number;
  probes: ProbeRequest[];
}

export interface ProbeResultResponse {
  status: 'continue' | 'complete';
  classified_count: number;
  total_count: number;
  coverage_pct: number;
  probes: ProbeRequest[];
  inferences_made: InferenceMade[];
}

export interface KnowledgeProfileResponse {
  session_id: string;
  student_id: number;
  state: DiagnosticSessionState;
  total_probed: number;
  total_inferred: number;
  total_classified: number;
  coverage_pct: number;
  by_subject: Record<string, SubjectSummary>;
  frontier_skills: string[];
}

export interface CompletionResponse {
  session_id: string;
  student_id: number;
  seeded_count: number;
  frontier_skills: string[];
  knowledge_profile: KnowledgeProfileResponse;
}

/** Lightweight session list item from GET /sessions */
export interface DiagnosticSessionSummary {
  session_id: string;
  student_id: number;
  state: string;
  subjects: string[];
  total_nodes: number;
  classified_count: number;
  probed_count: number;
  coverage_pct: number;
  created_at: string;
  completed_at: string | null;
}

/** Enriched session response from GET /sessions/{id} */
export interface EnrichedSessionResponse {
  session_id: string;
  student_id: number;
  state: string;
  subjects: string[];
  total_nodes: number;
  classified_count: number;
  probed_count: number;
  coverage_pct: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Next probes for in_progress sessions */
  probes: ProbeRequest[];
  /** Knowledge profile for completed sessions */
  knowledge_profile: KnowledgeProfileResponse | null;
}

// ---------------------------------------------------------------------------
// Frontend-only types
// ---------------------------------------------------------------------------

export type DiagnosticPhase =
  | 'welcome'      // Encouraging intro screen
  | 'generating'   // Generating items for a probe
  | 'probe-intro'  // Brief context card before each probe starts
  | 'probing'      // Student working through items
  | 'transition'   // Between probes (encouragement + progress)
  | 'completing'   // Calling /complete endpoint
  | 'profile'      // Showing knowledge profile results
  | 'error';

export interface ProbeProgress {
  probesCompleted: number;
  coveragePct: number;
  classifiedCount: number;
  totalCount: number;
  currentSubject: string;
}

/** Stored in localStorage for pause/resume */
export interface DiagnosticSessionStorage {
  sessionId: string;
  probeQueue: ProbeRequest[];
  probesCompleted: number;
  coveragePct: number;
  startedAt: string;
}

export const DIAGNOSTIC_STORAGE_KEY = 'lumina_diagnostic_session';

/** Persisted after diagnostic completion for the Knowledge Map panel */
export const DIAGNOSTIC_PROFILE_STORAGE_KEY = 'lumina_diagnostic_profile';

export interface StoredDiagnosticProfile {
  sessionId: string;
  profile: KnowledgeProfileResponse;
  completedAt: string;
}
