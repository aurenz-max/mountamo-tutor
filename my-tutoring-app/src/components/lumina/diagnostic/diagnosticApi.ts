/**
 * Diagnostic Placement Engine — API Client
 *
 * Wraps the 5 backend diagnostic endpoints using the existing authApi singleton.
 */

import { authApi } from '@/lib/authApiClient';
import type {
  CreateSessionResponse,
  ProbeResultResponse,
  CompletionResponse,
  KnowledgeProfileResponse,
} from './types';

const BASE = '/api/diagnostic';

export const diagnosticApi = {
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

  /** GET /api/diagnostic/sessions/{id} — Get full session state (for resume) */
  getSession: (sessionId: string): Promise<Record<string, unknown>> =>
    authApi.get<Record<string, unknown>>(`${BASE}/sessions/${sessionId}`),

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
