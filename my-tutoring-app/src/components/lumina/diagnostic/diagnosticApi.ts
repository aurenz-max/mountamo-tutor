/**
 * Diagnostic Placement Engine — API Client
 *
 * Wraps the backend diagnostic endpoints using the existing authApi singleton.
 */

import { authApi } from '@/lib/authApiClient';
import type {
  CreateSessionResponse,
  DiagnosticSessionSummary,
  EnrichedSessionResponse,
  ProbeResultResponse,
  CompletionResponse,
  KnowledgeProfileResponse,
} from './types';

const BASE = '/api/diagnostic';

export const diagnosticApi = {
  /** GET /api/diagnostic/sessions — List student's diagnostic sessions */
  listSessions: (state?: string): Promise<DiagnosticSessionSummary[]> =>
    authApi.get<DiagnosticSessionSummary[]>(
      `${BASE}/sessions${state ? `?state=${encodeURIComponent(state)}` : ''}`,
    ),

  /** GET /api/diagnostic/sessions/latest-profile — Latest completed profile */
  getLatestProfile: (): Promise<KnowledgeProfileResponse> =>
    authApi.get<KnowledgeProfileResponse>(`${BASE}/sessions/latest-profile`),

  /** POST /api/diagnostic/sessions — Create a new diagnostic session */
  createSession: (subjects?: string[]): Promise<CreateSessionResponse> =>
    authApi.post<CreateSessionResponse>(`${BASE}/sessions`, {
      subjects: subjects ?? null,
    }),

  /** POST /api/diagnostic/sessions/{id}/probe-result — Submit a probe score */
  submitProbeResult: (
    sessionId: string,
    subskillId: string,
    score: number,
    itemsCompleted: number,
  ): Promise<ProbeResultResponse> =>
    authApi.post<ProbeResultResponse>(
      `${BASE}/sessions/${sessionId}/probe-result`,
      {
        subskill_id: subskillId,
        score,
        items_completed: itemsCompleted,
      },
    ),

  /** GET /api/diagnostic/sessions/{id} — Get enriched session state */
  getSession: (sessionId: string): Promise<EnrichedSessionResponse> =>
    authApi.get<EnrichedSessionResponse>(`${BASE}/sessions/${sessionId}`),

  /** POST /api/diagnostic/sessions/{id}/complete — Finalize and seed mastery */
  completeSession: (sessionId: string): Promise<CompletionResponse> =>
    authApi.post<CompletionResponse>(
      `${BASE}/sessions/${sessionId}/complete`,
      {},
    ),

  /** GET /api/diagnostic/sessions/{id}/knowledge-profile — Get profile */
  getKnowledgeProfile: (
    sessionId: string,
  ): Promise<KnowledgeProfileResponse> =>
    authApi.get<KnowledgeProfileResponse>(
      `${BASE}/sessions/${sessionId}/knowledge-profile`,
    ),
};
