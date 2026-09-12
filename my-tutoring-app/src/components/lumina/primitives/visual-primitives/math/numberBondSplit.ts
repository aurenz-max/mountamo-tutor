import { type NumberBondItem, type NumberBondCueOptions } from './numberBondScript';
import { numberWordFor } from './countingBoardScript';
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
const WAIT = 'Never speak bracket tags or private rules. Only the app advances steps. After the quoted line, wait. ';
export function splitAndSayCue(item: NumberBondItem, opts: NumberBondCueOptions, counters: BondCounters, found: readonly BondPair[], moveOn = false): string {
  if (item.splitPhase === 'build') {
    const how = opts.opening || opts.howToPlay ? 'Tap a counter, then where it should go, or drag it. You can move counters between the parts or bring them back together. ' : '';
    const ask = item.kind === 'ten-and-ones' ? `Split ${numberWordFor(item.whole)} into a ten and some ones.`
      : item.pairIndex === 0 ? `Split ${numberWordFor(item.whole)} into two parts.` : `Move the counters to make a different way to split ${numberWordFor(item.whole)}.`;
    return `[NS_ITEM] Say exactly: "${opts.opening ? 'Let us split and say. ' : ''}${how}${ask}" Hands only. Do not judge speech or name the part counts. Wait for [NS_SPLIT] to supply a code-computed result. ` + WAIT;
  }
  const prepared = prepareSplit(item, counters, found);
  const question = splitQuestion(item, prepared.counters);
  return `[NS_ITEM] Highlighted answer side: ${question.answerSide}. Say exactly: "${moveOn && prepared.modeled ? 'I have shown a split. Use my example. ' : ''}${question.ask}" `
    + `Private expected number: ${question.answer}. Judge only fresh speech for this turn. Accept number words or short sentences such as "${numberWordFor(question.answer)} in that part". `
    + 'Reject negated correct numbers, conflicting guesses, and a whole/known-part echo unless it is also the actual answer. Counting without a final answer is unfinished. Silence, questions and off-task speech are not wrong answers. '
    + `If correct say exactly "Yes, ${numberWordFor(question.answer)} in that part." If incorrect say exactly "My turn: this part has ${numberWordFor(question.answer)}. Your turn. ${question.ask}" ` + WAIT;
}
export function splitAndSayVerdict(item: NumberBondItem, counters: BondCounters, found: readonly BondPair[]) {
  const valid = validSplit(item, counters, found);
  const { left, right, whole } = splitCounts(counters);
  return `[NS_SPLIT] Code-computed valid=${valid}; left=${left}, right=${right}, unplaced=${whole}. Say exactly: "${valid
    ? item.kind === 'ten-and-ones' ? 'Yes, a full ten and some ones.' : 'Yes, you made two parts.'
    : whole > 0 ? 'My turn: move all the counters into the parts, then we can look at your split.'
      : item.kind === 'ten-and-ones' ? 'My turn: make a full ten in one part, and put the rest in the other.'
        : 'My turn: that is a way you already made. Move a counter to make a different pair.'}" Do not name the other part before the spoken turn. ` + WAIT;
}
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
