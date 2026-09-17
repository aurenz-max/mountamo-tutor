import 'server-only';

/**
 * Minimal typed client for TypeSafe's System One endpoint.
 *
 * TypeSafe is NOT a text generator. It evaluates a `state` against a map of
 * typed questions and returns one structured answer per question:
 *   choice → the picked option + a probability per option + confidence
 *   score  → a probability-weighted position on ordered levels + confidence
 *   noul   → P(yes) in [0, 1]
 * Docs: https://docs.typesafe.ai/api.md
 *
 * Plain fetch, no SDK: the request shape is three fields and the answer shape
 * is closed, so the types below are the whole contract. Server-only so the key
 * never reaches a client bundle.
 */

const ENDPOINT = process.env.TYPESAFE_ENDPOINT || 'https://api.typesafe.ai/v1/systemone';
const MODEL = process.env.TYPESAFE_MODEL || 'jev-latest';

export type Instructions = string | Record<string, unknown> | unknown[];

export interface ChoiceQuestion {
  type: 'choice';
  instructions: Instructions;
  /** option → rubric description (null when the option name is enough). */
  criteria: Record<string, string | null>;
}
export interface ScoreQuestion {
  type: 'score';
  instructions: Instructions;
  /** Ordered level descriptions, at least two. */
  criteria: string[];
}
export interface NoulQuestion {
  type: 'noul';
  instructions: Instructions;
  criteria?: { true?: string; false?: string };
}
export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}
export interface ScoreAnswer {
  type: 'score';
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}
export interface NoulAnswer {
  type: 'noul';
  noul: number;
}
export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export interface SystemOneUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface SystemOneResponse<Q extends Record<string, Question>> {
  model: string;
  answers: { [K in keyof Q]: AnswerFor<Q[K]> };
  usage: SystemOneUsage;
  /** Wall-clock for the HTTP round trip, added by this client. */
  ms: number;
}

export type AnswerFor<Q extends Question> = Q extends ChoiceQuestion
  ? ChoiceAnswer
  : Q extends ScoreQuestion
    ? ScoreAnswer
    : NoulAnswer;

export class TypeSafeError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`TypeSafe HTTP ${status}: ${body.slice(0, 400)}`);
    this.name = 'TypeSafeError';
  }
}

export function typesafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export async function systemOne<Q extends Record<string, Question>>(
  state: unknown,
  questions: Q,
  opts: { signal?: AbortSignal; model?: string } = {},
): Promise<SystemOneResponse<Q>> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is not set');
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, model: opts.model ?? MODEL, questions }),
    signal: opts.signal,
  });
  const ms = Math.round(performance.now() - t0);
  const text = await res.text();
  if (!res.ok) throw new TypeSafeError(res.status, text);
  const json = JSON.parse(text) as Omit<SystemOneResponse<Q>, 'ms'>;
  return { ...json, ms };
}

/** Options of a Choice answer sorted by probability, highest first. */
export function rankChoice(answer: ChoiceAnswer): Array<{ id: string; p: number; rank: number }> {
  return Object.entries(answer.probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([id, p], i) => ({ id, p, rank: i + 1 }));
}
