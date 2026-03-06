/**
 * Lumina Pulse — API Client
 *
 * Wraps the backend Pulse endpoints using the existing authApi singleton.
 * See: Lumina_PRD_Pulse.md §8
 */

import { authApi } from '@/lib/authApiClient';
import type {
  PulseSessionResponse,
  PulseResultRequest,
  PulseResultResponse,
  PulseSessionSummary,
} from './types';

const BASE = '/api/pulse';

export const pulseApi = {
  /** POST /api/pulse/sessions — Create a new Pulse session */
  createSession: (
    subject: string,
    itemCount?: number,
  ): Promise<PulseSessionResponse> =>
    authApi.post<PulseSessionResponse>(`${BASE}/sessions`, {
      subject,
      item_count: itemCount ?? 6,
    }),

  /** GET /api/pulse/sessions/{id} — Get session state (for resume) */
  getSession: (sessionId: string): Promise<PulseSessionResponse> =>
    authApi.get<PulseSessionResponse>(`${BASE}/sessions/${sessionId}`),

  /** POST /api/pulse/sessions/{id}/result — Submit one item result */
  submitResult: (
    sessionId: string,
    result: PulseResultRequest,
  ): Promise<PulseResultResponse> =>
    authApi.post<PulseResultResponse>(
      `${BASE}/sessions/${sessionId}/result`,
      result,
    ),

  /** GET /api/pulse/sessions/{id}/summary — Get completed session summary */
  getSummary: (sessionId: string): Promise<PulseSessionSummary> =>
    authApi.get<PulseSessionSummary>(
      `${BASE}/sessions/${sessionId}/summary`,
    ),
};
