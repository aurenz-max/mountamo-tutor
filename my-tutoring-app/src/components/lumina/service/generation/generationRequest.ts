import { createHmac, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

// Request-local only. Never put learner credentials in config, globals or output.
const requests = new AsyncLocalStorage<{ authorization: string; lessonId: string }>();

/** Run one generation request so signed backend calls inside it carry the learner's own credentials. */
export function withGenerationRequest<T>(authorization: string | null, run: () => T): T {
  return requests.run({ authorization: authorization ?? '', lessonId: randomUUID() }, run);
}

/** This request's lesson id, or null outside a wrapped request. */
export function currentLessonId(): string | null {
  return requests.getStore()?.lessonId ?? null;
}

/** Signed, request-scoped generation-server call; shared by every observation consumer. */
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
