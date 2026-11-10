/**
 * The word-level record of oral reading, shared by the line-reading families (read-aloud-studio, decodable-reader,
 * di-sentence-reading): which printed words a learner misread, and the share of words read correctly on a cold
 * first read. Pure code over the session's own attempts; no model call.
 *
 * WHO DECIDES WHAT. The recorded verdict decides right or wrong: a credited read counts every printed word as read
 * correctly. Only a read that was NOT credited is aligned against the print, to locate the words. When the
 * transcript cannot locate them (it matches the print exactly, or fewer than half the printed words appear in it),
 * the read is `unlocated`: it names no word and is left out of the word count, never guessed.
 *
 * DISPUTED READS. The attempts are the scored session: `correct` is each spoken answer re-graded from its
 * transcript, and `flowCorrect` is the verdict of the tutor, who heard the audio. When the two disagree the read is
 * disputed and counts for nothing here, right or wrong (user ruling 2026-10-14: a disagreement is uncertain). Found
 * on the first real session (2026-11-10): the tutor credited "sun", the transcript said "sign", and the word was
 * tallied as misread.
 */
import type { ComponentTally } from '../../../service/componentMastery/contract';

export interface ReadLine {
  /** The item id the attempts carry. */
  id: string;
  /** The printed line. */
  text: string;
  /** False when the learner heard the line before reading it (a modeled reread, a dialogue echo). Default true. */
  cold?: boolean;
}

/** The fields of a teaching attempt this record reads. */
export interface ReadAttempt {
  itemId: string;
  response: string;
  source: 'speech' | 'gesture';
  correct: boolean;
  practice?: true;
  answerExposure?: 'none' | 'partial' | 'full';
  /** The tutor's verdict in the lesson, when the attempt was re-graded afterwards. */
  flowCorrect?: boolean;
}

/** The tutor and the re-grade disagree on this read. */
const disputed = (a: ReadAttempt): boolean => a.flowCorrect !== undefined && a.flowCorrect !== a.correct;

export interface Miscue {
  lineId: string;
  /** `swap`: a printed word read as another. `drop`: a printed word left out. `add`: a word said that is not printed. */
  kind: 'swap' | 'drop' | 'add';
  /** The printed word, lower case (absent on `add`). */
  printed?: string;
  /** What the learner said in its place (absent on `drop`). */
  said?: string;
  /** Index of the printed word (on `add`, the printed word it came before). */
  at: number;
  /** Which read of this line it was, from 1. */
  attempt: number;
  cold: boolean;
}

export interface ReadingRecord {
  /** Printed words on cold lines whose first read could be counted. */
  wordsCounted: number;
  /** Of those, the words read correctly on the first read. */
  wordsCorrect: number;
  /** wordsCorrect / wordsCounted as 0-100, or null when no cold first read could be counted. */
  wordAccuracy: number | null;
  miscues: Miscue[];
  /** Reads the tutor did not credit whose words the transcript could not locate. */
  unlocated: number;
  /** Reads the tutor and the re-grade disagree on: left out of every count above. */
  disputed: number;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'hmm', 'mm']);

/** A line as comparable words: lower case, no punctuation or apostrophes, digits to twenty as words. */
export function readWords(text: string): string[] {
  return text.toLowerCase().replace(/[‘’']/g, '').split(/[^a-z0-9]+/).filter(Boolean)
    .map(w => (/^\d+$/.test(w) && NUMBER_WORDS[Number(w)]) || w);
}

type Op = { kind: 'match' | 'swap' | 'drop' | 'add'; printed?: string; said?: string; at: number };

/** The cheapest word-level edit path from the printed words to the said words. */
function align(printed: string[], said: string[]): Op[] {
  const n = printed.length, m = said.length;
  const cost: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    cost[i][j] = Math.min(cost[i - 1][j - 1] + (printed[i - 1] === said[j - 1] ? 0 : 1), cost[i - 1][j] + 1, cost[i][j - 1] + 1);
  }
  const ops: Op[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (printed[i - 1] === said[j - 1] ? 0 : 1)) {
      ops.push(printed[i - 1] === said[j - 1] ? { kind: 'match', printed: printed[i - 1], at: i - 1 }
        : { kind: 'swap', printed: printed[i - 1], said: said[j - 1], at: i - 1 });
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) { ops.push({ kind: 'drop', printed: printed[i - 1], at: i - 1 }); i--; }
    else { ops.push({ kind: 'add', said: said[j - 1], at: i }); j--; }
  }
  return ops.reverse();
}

/**
 * The misread words of one read the tutor did not credit, or null when the transcript cannot locate them. A said
 * word that is also printed in the line (a repeat or a restart) and a filler ("um") are not additions.
 */
export function locateMiscues(printedLine: string, saidLine: string): Array<Omit<Miscue, 'lineId' | 'attempt' | 'cold'>> | null {
  const printed = readWords(printedLine), said = readWords(saidLine).filter(w => !FILLERS.has(w));
  if (!printed.length || !said.length) return null;
  const ops = align(printed, said);
  const matches = ops.filter(o => o.kind === 'match').length;
  if (matches < Math.ceil(printed.length / 2)) return null;
  const inLine = new Set(printed);
  const found = ops.filter(o => o.kind === 'swap' || o.kind === 'drop' || (o.kind === 'add' && !inLine.has(o.said!)))
    .map(({ kind, printed: p, said: s, at }) => ({ kind: kind as Miscue['kind'], ...(p ? { printed: p } : {}), ...(s ? { said: s } : {}), at }));
  return found.length ? found : null;
}

/**
 * Every printed word of the cold first reads that could be counted, with whether it was read correctly: the
 * word-level evidence the per-child tallies are built from (`service/componentMastery`). Same policy as
 * `readingRecord`: a credited read counts every word; an unlocated read counts none. A `line` may be one printed
 * word (a word-reading item): the verdict alone says whether it was read.
 */
export function firstReadWords(lines: readonly ReadLine[], attempts: readonly ReadAttempt[]): Array<{ word: string; correct: boolean }> {
  const out: Array<{ word: string; correct: boolean }> = [];
  for (const line of lines) {
    if (line.cold === false) continue;
    const first = attempts.find(a => a.itemId === line.id && a.source === 'speech' && !a.practice);
    // A read after the answer was shown or said (a lever, a demonstration) is not the learner's own decoding.
    if (!first || first.answerExposure === 'full' || disputed(first)) continue;
    const words = readWords(line.text);
    // One printed word: the tutor's verdict is the whole evidence, and there is nothing to align.
    if (words.length === 1) { out.push({ word: words[0], correct: first.correct }); continue; }
    const found = first.correct ? [] : locateMiscues(line.text, first.response);
    if (found === null) continue;
    const wrong = new Set(found.filter(m => m.kind !== 'add').map(m => m.at));
    words.forEach((word, at) => out.push({ word, correct: !wrong.has(at) }));
  }
  return out;
}

/** `firstReadWords` as one tally per distinct word, the unit the letter-sound kind expands into pairs. */
export function wordReadTally(lines: readonly ReadLine[], attempts: readonly ReadAttempt[]): ComponentTally[] {
  const byWord = new Map<string, { unit: string; attempts: number; correct: number }>();
  for (const { word, correct } of firstReadWords(lines, attempts)) {
    const t = byWord.get(word) ?? { unit: word, attempts: 0, correct: 0 };
    t.attempts++; if (correct) t.correct++;
    byWord.set(word, t);
  }
  return byWord.size ? [{ kind: 'letter_sound', units: Array.from(byWord.values()) }] : [];
}

/** The session's reading record: every located miscue, and word accuracy over cold first reads. */
export function readingRecord(lines: readonly ReadLine[], attempts: readonly ReadAttempt[]): ReadingRecord {
  const record: ReadingRecord = { wordsCounted: 0, wordsCorrect: 0, wordAccuracy: null, miscues: [], unlocated: 0, disputed: 0 };
  for (const line of lines) {
    const cold = line.cold !== false, words = readWords(line.text).length;
    const reads = attempts.filter(a => a.itemId === line.id && a.source === 'speech' && !a.practice);
    reads.forEach((read, index) => {
      if (disputed(read)) { record.disputed++; return; }
      const found = read.correct ? [] : locateMiscues(line.text, read.response);
      if (found === null) record.unlocated++;
      else record.miscues.push(...found.map(m => ({ lineId: line.id, ...m, attempt: index + 1, cold })));
      if (index > 0 || !cold || found === null) return;
      record.wordsCounted += words;
      record.wordsCorrect += Math.max(0, words - found.filter(m => m.kind !== 'add').length);
    });
  }
  if (record.wordsCounted) record.wordAccuracy = Math.round((record.wordsCorrect / record.wordsCounted) * 100);
  return record;
}
