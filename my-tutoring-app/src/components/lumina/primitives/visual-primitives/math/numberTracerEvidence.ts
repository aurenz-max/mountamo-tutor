import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

/** One checked drawing, recorded as it happened; never inferred afterwards. */
export interface NumberTracerResponse {
  challengeId: string;
  type: 'trace' | 'copy' | 'write' | 'sequence';
  /** 1-based try on this item. */
  attempt: number;
  target: number;
  sequenceNumbers?: number[];
  missingIndex?: number;
  /** The number the judge read in the drawing ('?' when unreadable); null when no trusted judge reading exists. */
  writtenAs: string | null;
  /** The score the decision used: the judge's when trusted, otherwise geometry. */
  score: number;
  correct: boolean;
  guideShown: boolean;
  modelShown: boolean;
  hintShown: boolean;
  supportTier?: string;
}

const readAsOther = (r: NumberTracerResponse) => r.writtenAs !== null && r.writtenAs !== '?' && r.writtenAs !== String(r.target);
const runText = (r: NumberTracerResponse) => (r.sequenceNumbers ?? []).map((n, i) => (i === r.missingIndex ? '?' : String(n))).join(', ');

function question(r: NumberTracerResponse): string {
  switch (r.type) {
    case 'sequence': return `Counting run ${runText(r)}: write the hidden number.`;
    case 'copy': return `Copy the numeral ${r.target} shown beside the canvas.`;
    case 'write': return `Write the numeral ${r.target} named in the instruction.`;
    case 'trace': return `Trace the numeral ${r.target}.`;
  }
}

function outcome(r: NumberTracerResponse): string {
  const verdict = r.correct ? 'Correct' : 'Incorrect';
  if (r.writtenAs === null) return `${verdict}: geometry score ${r.score}; no judge reading`;
  if (r.writtenAs === '?') return `${verdict}: the judge could not read a number (score ${r.score})`;
  if (readAsOther(r)) return `${verdict}: the judge read the drawing as ${r.writtenAs} (score ${r.score})`;
  return `${verdict}: the judge read ${r.writtenAs} (handwriting score ${r.score})`;
}

const label = (r: NumberTracerResponse) => (r.type === 'sequence' ? `run ${runText(r)}` : `${r.type} ${r.target}`);

/** Factual evidence for the shared distiller, or undefined unless some drawing was read as a different
 *  number. A rejection for legibility alone is handwriting, not evidence about which number belongs. */
export function numberTracerDiagnosisEvidence(
  challengeIds: readonly string[], responses: readonly NumberTracerResponse[],
): DiagnosisEvidence | undefined {
  const other = responses.filter(r => !r.correct && readAsOther(r));
  if (!other.length || !challengeIds.length) return undefined;
  const wrong = responses.filter(r => !r.correct);
  const clean = challengeIds.filter(id => responses.some(r => r.challengeId === id) && !wrong.some(r => r.challengeId === id)).length;
  const types = Array.from(new Set(responses.map(r => r.type)));
  const sequence = types.length === 1 && types[0] === 'sequence';
  const legibility = wrong.length - other.length;
  // The store keeps 12 phases: every drawing read as another number, then other rejections, then
  // first-try accepted items, then accepted retries; emitted in the order they happened.
  const kept = new Set([...other, ...wrong.filter(r => !readAsOther(r)), ...responses.filter(r => r.correct && r.attempt === 1),
    ...responses.filter(r => r.correct && r.attempt > 1)].slice(0, 12));
  return {
    firstResponseScore: Math.round((clean / challengeIds.length) * 100),
    challengeSummary: (sequence
      ? `Number tracer (sequence): ${challengeIds.length} counting runs of four consecutive numbers, each with one inner number shown as ?; the student writes the hidden number by hand, retrying until the drawing is accepted.`
      : `Number tracer (${types.join(', ')}): ${challengeIds.length} numerals written by hand on a canvas, retrying until the drawing is accepted.`)
      + ` A vision judge reads each drawing and scores its handwriting. ${clean} of ${challengeIds.length} were accepted first time.`,
    expected: sequence
      ? 'Each hidden number is one more than the number before the gap and one less than the number after it.'
      : 'Each drawing shows the numeral asked for.',
    observed: (other.map(r => `${label(r)}, try ${r.attempt}: wrote ${r.writtenAs}`).join('; ')
      + (legibility ? `; ${legibility} other rejected drawing(s) were not read as a different number` : '')).slice(0, 2000),
    phases: responses.filter(r => kept.has(r)).map(r => ({
      itemId: r.challengeId, phase: r.type, challenge: question(r), expected: String(r.target), observed: outcome(r),
      support: `Try ${r.attempt}; ${r.guideShown ? 'tracing guide on the canvas' : 'no tracing guide'}${r.modelShown ? '; model numeral shown' : ''}; `
        + `hint ${r.hintShown ? 'shown' : 'not shown'}; support tier ${r.supportTier ?? 'none'}.`,
    })),
  };
}
