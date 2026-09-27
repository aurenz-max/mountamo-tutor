/**
 * What the mounted primitive knows about the learner's difficulty, read from the runtime
 * snapshot (LA-15). The demonstration author diagnoses from this, not from the tutor's
 * paraphrase: on the 2026-09-26 bench the author did as well with this alone (15/15) as with
 * the tutor's diagnosis added, and in live runs the tutor named the actual error in 3 of 7.
 *
 * Generic: every workspace binding publishes the task, its values, its facts, and the
 * learner's checked responses. Nothing here names a primitive.
 */
import type { RuntimeSnapshot } from '../runtime/contract';
import type { ComposedDemonstration } from '../runtime/runtimeTransport';

export interface DemonstrationEvidence {
  primitiveId: string;
  evalMode: string | null;
  task: string;
  /** The task's own quantities, when the adapter publishes them as data. */
  values?: Record<string, number>;
  /** The adapter's scene facts (what is drawn and asked, the learner's current work). */
  facts: Record<string, string | number>;
  /** Every response on THIS item, oldest first, as the activity words it. */
  attempts: Array<{ response: string; correct: boolean | null; source: string }>;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function demonstrationEvidence(state: RuntimeSnapshot): DemonstrationEvidence | null {
  const task = state.task;
  if (!task || !state.primitiveId) return null;
  const onItem = (task.workspace?.attempts ?? []).filter(a => a.itemId === task.itemId)
    .map(a => ({ response: clip(a.response, 200), correct: a.correct as boolean | null, source: a.source }));
  // Families without workspace attempts still publish their recent responses; the item's
  // checked correctness belongs to the latest of them only.
  const recent = task.evidence.recentResponses;
  const latest = task.evidence.correctness === 'unknown' ? null : task.evidence.correctness === 'correct';
  const attempts = onItem.length ? onItem : recent
    .map((r, i) => ({ response: clip(r.response, 200), correct: i === recent.length - 1 ? latest : null, source: r.source }));
  const facts = Object.fromEntries(Object.entries(task.demand ?? {})
    .map(([k, v]) => [k, typeof v === 'string' ? clip(v, 200) : v] as const).slice(0, 16));
  return { primitiveId: state.primitiveId, evalMode: state.evalMode, task: clip(task.task, 400),
    ...(task.values ? { values: task.values } : {}), facts, attempts: attempts.slice(-6) };
}

/** The evidence as the author reads it. */
export function describeEvidence(e: DemonstrationEvidence): string {
  const lines = [`TASK ON SCREEN: ${e.task}`];
  if (e.values && Object.keys(e.values).length) lines.push(`TASK VALUES: ${Object.entries(e.values).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  const facts = Object.entries(e.facts).filter(([k]) => !['constraints', 'response', 'presentation'].includes(k));
  if (facts.length) lines.push(`ACTIVITY FACTS: ${facts.map(([k, v]) => `${k}: ${v}`).join('; ')}`);
  lines.push(e.attempts.length
    ? `LEARNER'S RESPONSES ON THIS ITEM (oldest first):\n${e.attempts.map((a, i) => `  ${i + 1}. ${a.response}${a.correct === null ? '' : a.correct ? ' (correct)' : ' (incorrect)'}`).join('\n')}`
    : "LEARNER'S RESPONSES ON THIS ITEM: none yet");
  return lines.join('\n');
}

/** POST to the authoring route. `origin` is '' in the browser and the dev server URL in the headless driver. */
export async function requestDemonstration(origin: string, body: { lesson: object; evidence: DemonstrationEvidence; note?: string },
    signal: AbortSignal): Promise<ComposedDemonstration> {
  const response = await fetch(`${origin}/api/lumina/demonstration`, { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Demonstration failed');
  return result.kind === 'demonstration' ? { demonstration: result.demonstration, diagnosis: result.diagnosis }
    : { refused: 'No drawn demonstration fits this step. Teach it in words, with a different example.', diagnosis: result.diagnosis };
}
