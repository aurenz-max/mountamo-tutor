import { createHmac, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { openLearningObservations, type LearningObservationPacket } from './learningObservationPacket';

/** What a generation request carries besides its body: the learner's token and the backend-signed observation packet. */
export interface GenerationRequestInit { authorization?: string | null; learningObservations?: unknown }

// Request-local only. Never put learner credentials or the packet in config, globals or output.
const requests = new AsyncLocalStorage<{ authorization: string; lessonId: string; observations: LearningObservationPacket | null }>();

/**
 * Run one generation request. The observation packet is verified once here,
 * against the same key the backend signed it with; consumers read it through
 * `deliveredLearningObservations()` and make no backend call. A bare
 * authorization string is accepted for callers that carry no packet.
 */
export function withGenerationRequest<T>(init: GenerationRequestInit | string | null, run: () => T): T {
  const { authorization = null, learningObservations } = init !== null && typeof init === 'object' ? init : { authorization: init };
  const observations = openLearningObservations(learningObservations, process.env.LUMINA_GENERATION_SIGNING_KEY);
  return requests.run({ authorization: authorization ?? '', lessonId: randomUUID(), observations }, run);
}

/** This request's lesson id, or null outside a wrapped request. */
export function currentLessonId(): string | null {
  return requests.getStore()?.lessonId ?? null;
}

/** The verified observation packet this request arrived with, or null (unadapted generation). */
export function deliveredLearningObservations(): LearningObservationPacket | null {
  return requests.getStore()?.observations ?? null;
}

/** Signed, request-scoped generation-server call; only a write with authority (retest receipts) still uses it. */
export async function backend(path: string, value: unknown) {
  const ctx = requests.getStore();
  const key = process.env.LUMINA_GENERATION_SIGNING_KEY;
  if (!ctx?.authorization.startsWith('Bearer ') || !key || key.length < 32) return null;
  const body = JSON.stringify(value);
  const time = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', key).update(`${path}\n${time}\n${ctx.authorization}\n${body}`).digest('hex');
  const response = await fetch(`${process.env.LUMINA_BACKEND_URL || 'http://localhost:8000'}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: ctx.authorization,
      'x-lumina-time': time, 'x-lumina-signature': signature }, body, signal: AbortSignal.timeout(5000),
  });
  return response.ok ? response.json() : null;
}
