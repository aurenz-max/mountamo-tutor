import type { NumberBondItem } from './numberBondDomain';
import { numberWordFor } from './countingBoardDomain';
import type { JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';

export type BondPlace = 'whole' | 'left' | 'right';
export type BondCounters = BondPlace[];
export type BondPair = readonly [number, number];
export const splitCounts = (counters: BondCounters) => ({ left: counters.filter((place) => place === 'left').length,
  right: counters.filter((place) => place === 'right').length, whole: counters.filter((place) => place === 'whole').length });
export const wholeCounters = (whole: number): BondCounters => Array(whole).fill('whole');
export function moveBondCounter(counters: BondCounters, index: number, destination: BondPlace): BondCounters | null {
  if (!Number.isInteger(index) || index < 0 || index >= counters.length || !['whole', 'left', 'right'].includes(destination)
    || counters[index] === destination) return null;
  return counters.map((place, i) => i === index ? destination : place);
}
export const sortedPair = (counters: BondCounters): [number, number] => {
  const { left, right } = splitCounts(counters); return [Math.min(left, right), Math.max(left, right)];
};
export const hasPair = (pairs: readonly BondPair[], pair: BondPair) => pairs.some(([a, b]) => a === pair[0] && b === pair[1]);
export function validSplit(item: NumberBondItem, counters: BondCounters, found: readonly BondPair[]): boolean {
  const { left, right, whole } = splitCounts(counters);
  return counters.length === item.whole && whole === 0 && (item.kind === 'ten-and-ones'
    ? left === 10 || right === 10 : !hasPair(found, sortedPair(counters)));
}
/** Pick an unused mathematical pair only when the hand turn was capped. */
export function prepareSplit(item: NumberBondItem, counters: BondCounters, found: readonly BondPair[]) {
  if (validSplit(item, counters, found)) return { counters, modeled: false };
  const left = item.kind === 'ten-and-ones' ? 10 : Array.from({ length: Math.floor(item.whole / 2) + 1 }, (_, n) => n)
    .find((n) => !hasPair(found, [n, item.whole - n])) ?? 0;
  return { counters: Array.from({ length: item.whole }, (_, i) => i < left ? 'left' as const : 'right' as const), modeled: true };
}
export function splitQuestion(item: NumberBondItem, counters: BondCounters) {
  const { left, right } = splitCounts(counters);
  // Empty parts remain valid decompositions without eliciting unbenched spoken zero.
  const answerSide: 'left' | 'right' = item.kind === 'ten-and-ones' ? (left === 10 ? 'right' : 'left') : right > 0 ? 'right' : 'left';
  const answer = answerSide === 'left' ? left : right;
  const known = answerSide === 'left' ? right : left;
  const ask = item.kind === 'ten-and-ones' ? 'One ten and how many ones?'
    : `${known === 0 ? 'This part is empty.' : `This part has ${numberWordFor(known)}.`} How many are in the highlighted part?`;
  return { answerSide, answer, known, ask };
}
export const expandSplitAndSay = (items: NumberBondItem[]): NumberBondItem[] => items.flatMap((item) =>
  item.kind === 'decompose' || item.kind === 'ten-and-ones' ? [
    { ...item, id: `${item.id}::build`, splitPhase: 'build' as const },
    { ...item, id: `${item.id}::say`, splitPhase: 'say' as const, answerKind: 'voice' as const,
      responseClass: 'number_word_to_20' as const, action: 'say-your-part' },
  ] : [item]);
/** Score each construction + spoken interpretation once, without doubling the pair count. */
export function splitAndSaySummary(items: NumberBondItem[], summary: JudgedRunSummary): JudgedRunSummary {
  const outcomes = items.filter((item) => item.splitPhase !== 'build').map((item) => {
    const own = summary.outcomes.find((outcome) => outcome.id === item.id);
    if (!own || item.splitPhase !== 'say') return own;
    const build = summary.outcomes.find((outcome) => outcome.id === item.id.replace(/::say$/, '::build'));
    return { ...own, solved: own.solved && !!build?.solved, score: Math.min(own.score, build?.score ?? 0),
      corrections: own.corrections + (build?.corrections ?? 0), seconds: (own.seconds ?? 0) + (build?.seconds ?? 0) };
  }).filter((outcome): outcome is JudgedRunSummary['outcomes'][number] => !!outcome);
  const accuracy = outcomes.length ? Math.round(outcomes.reduce((sum, outcome) => sum + outcome.score, 0) / outcomes.length) : 0;
  return { ...summary, outcomes, accuracy, passed: outcomes.length > 0 && outcomes.every((o) => o.solved),
    solvedCount: outcomes.filter((o) => o.solved).length, firstTryCount: outcomes.filter((o) => o.score === 100).length,
    attemptsCount: outcomes.reduce((sum, outcome) => sum + 1 + outcome.corrections, 0) };
}
