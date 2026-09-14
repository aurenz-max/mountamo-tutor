/** Provisional observations, never an automatic self-correction mastery claim. */
export interface ReadingTranscript {
  transcript: string;
  confidence: 'high' | 'low';
  complete: boolean;
}

export interface ReadingRepairVerdict {
  status: 'matched' | 'mismatch' | 'uncertain';
  transcripts: ReadingTranscript[];
  mismatchIndexes: number[];
  reason: string;
}

export type ReadingRepairOutcome = 'accurate_first_read' | 'independent_repair'
  | 'supported_repair' | 'unresolved_error' | 'unassessable';

export interface ReadingRepairAttempt {
  verdict: ReadingRepairVerdict;
  selectedIndexes: number[];
  supportBeforeReading: boolean;
  capturedAt: string;
  durationMs: number;
}

export interface ReadingRepairEvidence {
  challengeId: string;
  text: string;
  attempts: ReadingRepairAttempt[];
  supportRequested: boolean;
  replayCount: number;
  reflection: string;
  outcome: ReadingRepairOutcome;
}

export const readingWords = (text: string): string[] => text.trim().split(/\s+/);
export const normalizeReading = (text: string): string[] =>
  text.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z'\s-]/g, '').trim().split(/\s+/).filter(Boolean);

// Audio cannot identify the intended spelling of homophones. These common
// grade-two pairs are excluded as error evidence, even when ASR agrees.
const HOMOPHONES = [
  ['read', 'red'], ['rode', 'road', 'rowed'], ['to', 'too', 'two'], ['there', 'their', "they're"],
  ['here', 'hear'], ['see', 'sea'], ['one', 'won'], ['no', 'know'], ['blue', 'blew'],
  ['right', 'write', 'rite'], ['for', 'four', 'fore'], ['by', 'buy', 'bye'], ['sun', 'son'],
  ['night', 'knight'], ['new', 'knew'], ['ate', 'eight'], ['be', 'bee'], ['I', 'eye'],
  ['would', 'wood'], ['week', 'weak'], ['tail', 'tale'], ['pair', 'pear'], ['meet', 'meat'],
  ['plain', 'plane'], ['whole', 'hole'], ['flower', 'flour'], ['our', 'hour'],
];

export function compareReading(text: string, transcripts: ReadingTranscript[]): ReadingRepairVerdict {
  const uncertain = (reason: string): ReadingRepairVerdict => ({ status: 'uncertain', transcripts, mismatchIndexes: [], reason });
  if (transcripts.length !== 2 || transcripts.some(t => t.confidence !== 'high' || !t.complete || !t.transcript.trim())) {
    return uncertain('The recording was unclear or incomplete.');
  }
  const print = normalizeReading(text);
  const heard = transcripts.map(t => normalizeReading(t.transcript));
  if (heard[0].join(' ') !== heard[1].join(' ')) return uncertain('The two audio checks disagreed.');
  // Insertions, omissions and within-clip restarts need alignment evidence we
  // do not yet have. Never infer their location by shifting token indexes.
  if (heard[0].length !== print.length) return uncertain('This reading needs a person to review the recording.');
  const mismatchIndexes = print.flatMap((word, i) => word === heard[0][i] ? [] : [i]);
  // Bench finding: both blind passes heard "walked to" in a synthetic "walk
  // to" recording. Final consonants can merge at word boundaries; agreement
  // cannot validate these short inflections. Leave them for human review.
  const inflectionAmbiguous = (a: string, b: string) => {
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= 3 && ['s', 'es', 'ed', 'd'].some(suffix => long === short + suffix);
  };
  if (mismatchIndexes.some(i => inflectionAmbiguous(print[i], heard[0][i]))) {
    return uncertain('A short word ending needs a person to review the recording.');
  }
  if (mismatchIndexes.some(i => HOMOPHONES.some(group => group.map(w => w.toLowerCase()).includes(print[i])
    && group.map(w => w.toLowerCase()).includes(heard[0][i])))) return uncertain('Audio cannot distinguish these spellings.');
  return { status: mismatchIndexes.length ? 'mismatch' : 'matched', transcripts, mismatchIndexes,
    reason: mismatchIndexes.length ? 'Both audio checks heard the same word substitution.' : 'Both audio checks matched the printed words.' };
}

export function classifyReadingRepair(attempts: ReadingRepairAttempt[]): ReadingRepairOutcome {
  const first = attempts[0];
  if (!first || first.verdict.status === 'uncertain' || first.supportBeforeReading) return 'unassessable';
  if (first.verdict.status === 'matched') return 'accurate_first_read';
  // Only an actual rereading of the full print can establish a repair.
  const repaired = attempts.slice(1).find(a => a.verdict.status === 'matched');
  if (repaired) {
    if (repaired.supportBeforeReading) return 'supported_repair';
    const noticed = repaired.selectedIndexes.length === first.verdict.mismatchIndexes.length
      && first.verdict.mismatchIndexes.every(i => repaired.selectedIndexes.includes(i));
    return noticed ? 'independent_repair' : 'unassessable';
  }
  if (attempts.slice(1).some(a => a.verdict.status === 'uncertain')) return 'unassessable';
  return 'unresolved_error';
}

export function repairSummary(evidence: ReadingRepairEvidence[]) {
  const count = (outcome: ReadingRepairOutcome) => evidence.filter(e => e.outcome === outcome).length;
  const accurateFirstReadCount = count('accurate_first_read');
  const independentRepairCount = count('independent_repair');
  const supportedRepairCount = count('supported_repair');
  const unresolvedErrorCount = count('unresolved_error');
  const unassessableCount = count('unassessable');
  const assessableCount = evidence.length - unassessableCount;
  const repairOpportunities = independentRepairCount + supportedRepairCount + unresolvedErrorCount;
  const correctCount = accurateFirstReadCount + independentRepairCount + supportedRepairCount;
  return { accurateFirstReadCount, independentRepairCount, supportedRepairCount, unresolvedErrorCount,
    unassessableCount, assessableCount, repairOpportunities, correctCount,
    overallAccuracy: assessableCount ? Math.round(100 * correctCount / assessableCount) : 0,
    independentRepairRate: repairOpportunities ? Math.round(100 * independentRepairCount / repairOpportunities) : null };
}

export const REPAIR_OUTCOME_COPY: Record<ReadingRepairOutcome, string> = {
  accurate_first_read: 'Your first reading matched the print. There was nothing to repair!',
  independent_repair: 'You chose a word to revisit and your rereading matched the print.',
  supported_repair: 'Your rereading matched after help. That was useful practice!',
  unresolved_error: 'Some words may still need another look. Check the letters and the whole sentence with a reading partner.',
  unassessable: 'We cannot be sure from this recording. It does not count as a reading mistake.',
};
