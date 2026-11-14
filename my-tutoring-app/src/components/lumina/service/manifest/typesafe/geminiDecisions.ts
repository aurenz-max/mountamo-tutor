import 'server-only';
import { assertBudget, currentSource, recordCall } from '../../spend/spendMeter';
import type { Question } from './typesafeClient';

/**
 * Gemini Decisions API (`gemini-decision-1`, launched 2026-11-11) behind the System One call shape, so a
 * JEV observation kind can run on either model with the same questions. Prototype: selected per call
 * with `model: 'gemini-decision-1'` or process-wide with LUMINA_SYSTEM_ONE_MODEL.
 *
 * Differences this adapter closes:
 *   - input is Content, not a JSON `state`: the state is sent as one text block of JSON, followed by any
 *     media blocks (audio of the learner's answer, a screenshot).
 *   - noul criteria keys are `true_description` / `false_description`; choice criteria have no null.
 *   - usage reports input tokens only (output is free).
 * Docs: https://aistudio.google.com/docs/decisions-api
 */
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/decisions';

export interface MediaBlock { type: 'audio' | 'image' | 'video' | 'document'; mime_type: string; data: string }

export const isGeminiDecisionModel = (model: string | undefined) => !!model && model.startsWith('gemini-decision');

function toGeminiQuestion(q: Question): Record<string, unknown> {
  if (q.type === 'noul') {
    const c = q.criteria;
    return { type: 'noul', instructions: q.instructions,
      ...(c ? { criteria: { ...(c.true ? { true_description: c.true } : {}), ...(c.false ? { false_description: c.false } : {}) } } : {}) };
  }
  if (q.type === 'choice') {
    return { type: 'choice', instructions: q.instructions,
      criteria: Object.fromEntries(Object.entries(q.criteria).map(([k, v]) => [k, v ?? ''])) };
  }
  return { type: 'score', instructions: q.instructions, criteria: q.criteria };
}

const instructionsText = (i: Question['instructions']) => typeof i === 'string' ? i : JSON.stringify(i);

export async function geminiDecisions(state: unknown, questions: Record<string, Question>,
    opts: { signal?: AbortSignal; model: string; media?: MediaBlock[] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const src = currentSource();
  assertBudget(src.source);
  const input = [
    { type: 'text', text: typeof state === 'string' ? state : JSON.stringify(state) },
    ...(opts.media ?? []),
  ];
  const body = { model: opts.model, input,
    questions: Object.fromEntries(Object.entries(questions).map(([k, q]) =>
      [k, toGeminiQuestion({ ...q, instructions: instructionsText(q.instructions) } as Question)])) };
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, { method: 'POST', signal: opts.signal,
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const ms = Math.round(performance.now() - t0);
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini Decisions HTTP ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as { answers: Record<string, any>; usage?: { total_input_tokens?: number } };
  const inputTokens = json.usage?.total_input_tokens ?? 0;
  recordCall(opts.model, { promptTokenCount: inputTokens }, { ...src, label: src.label ?? 'decisions' });
  return { model: opts.model, answers: json.answers, usage: { input_tokens: inputTokens, output_tokens: 0 }, ms };
}
