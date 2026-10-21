/**
 * What the tutor and the observer read on a place-value-chart item: the spoken key and known misses of a printed
 * number's place and value asks, the miss a written chart shows, and the scene. Pure and React-free: the boss, the
 * component and the probes read it. A dictated number is written into the chart and checked by code, so it has no key
 * and the tutor is never handed its digits.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { namesChoices, type PlaceValueItem } from './placeValueDomain';
import type { PlaceValueMiss } from './placeValueChart.card';
import { digitValueWord, digitWord, MAX_SPOKEN_PLACE, placeWord, spokenIntegerWord } from './spokenNumberWords';

export { PLACE_VALUE_MISSES, type PlaceValueChartMiss, type PlaceValueMiss, type SpokenPlaceValueMiss } from './placeValueChart.card';

/** The chart's columns a spoken answer may name, low to high. */
const spokenPlaces = (item: PlaceValueItem) => [...item.chartPlaces].sort((a, b) => a - b).filter(p => p <= MAX_SPOKEN_PLACE);

/**
 * The key of a printed number's ask; null on a dictated number, which the chart checks. find_place answers with a
 * place name (from the menu the ask says, at the tiers that say one); say_value with the digit's worth, as a word, a
 * numeral, or the digit and its place ("four tens").
 */
export function placeValueKey(item: PlaceValueItem): SpokenKey | null {
  if (item.kind === 'build_number') return null;
  const { digit: d, place: p } = item, dw = digitWord(d), pw = placeWord(p), worth = digitValueWord(d, p);
  if (item.kind === 'find_place') {
    const column = p === 4 ? ' A bare "thousands" names the column next to it: this answer carries the "ten".'
      : p === 3 && item.chartPlaces.includes(4) ? ' "Ten thousands" is the column one further left.' : '';
    return { answer: pw, alsoAccept: [`${pw} place`],
      ...(namesChoices(item) ? { menu: spokenPlaces(item).map(placeWord) } : {}),
      signatureError: `${p > 0 ? `"${worth}", what the digit is worth, or ` : ''}"${dw}", the digit itself, names no place and is wrong.${column}` };
  }
  const unit = p > 0 ? [`${dw} ${d === 1 ? pw.replace(/s$/, '') : pw}`] : [];
  return { answer: worth, alsoAccept: [String(d * 10 ** p), ...unit.filter(u => u !== worth)],
    signatureError: p > 0
      ? `"${dw}" alone, the digit with no place, is wrong: it says how many ones, not what the digit is worth here.`
      : `"${digitValueWord(d, 1)}", the digit one column over, is wrong.` };
}

/**
 * A spoken ask's known wrong answers, in precedence order, for the `spoken_miss` observer, from the printed number
 * and its glowing digit: which place (the digit's worth or the digit for the place name, another column) and what it
 * is worth (the bare digit, the place name, the worth one column over, the whole number, a digit one away).
 */
export function placeValueSpokenMisses(item: PlaceValueItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const { digit: d, place: p, targetNumber: n } = item, dw = digitWord(d), pw = placeWord(p), worth = digitValueWord(d, p);
  const places = item.chartPlaces.filter(q => q !== p && q <= MAX_SPOKEN_PLACE);
  if (item.kind === 'find_place') {
    const next = places.filter(q => Math.abs(q - p) === 1), far = places.filter(q => Math.abs(q - p) > 1);
    const names = (qs: number[]) => qs.map(q => `the ${placeWord(q)} place`).join(' or ');
    return [
      ...(p > 0 ? [{ id: 'said_value', pattern: `The glowing ${dw} is worth ${worth}. The learner's answer is ${worth}, `
        + 'what the digit is worth, instead of the name of its place.', examples: [worth] }] : []),
      { id: 'said_digit', pattern: `The glowing digit is ${dw}. The learner's answer is ${dw}, the digit itself, instead of the name of its place.`,
        examples: [dw] },
      ...(next.length ? [{ id: 'next_place', pattern: `The glowing ${dw} is in the ${pw} place. The learner names ${names(next)}, a column next to it.`,
        examples: next.map(q => placeWord(q)) }] : []),
      ...(far.length ? [{ id: 'other_place', pattern: `The glowing ${dw} is in the ${pw} place. The learner names ${names(far)}, a column further away.`,
        examples: far.map(q => placeWord(q)) }] : []),
    ];
  }
  const shifted = [p - 1, p + 1].filter(q => q >= 0 && q <= MAX_SPOKEN_PLACE).map(q => digitValueWord(d, q));
  const near = [d - 1, d + 1].filter(x => x >= 1 && x <= 9).map(x => digitValueWord(x, p));
  const whole = spokenIntegerWord(n);
  return [
    ...(p > 0 ? [{ id: 'said_digit', pattern: `The glowing digit is ${dw}, in the ${pw} place. The learner's answer is ${dw}, the digit alone, `
      + `not what it is worth in the ${pw} place.`, examples: [dw] }] : []),
    ...(p > 0 ? [{ id: 'said_place', pattern: `The glowing digit is in the ${pw} place. The learner's answer is the place name, ${pw}, with no number.`,
      examples: [`the ${pw} place`] }] : []),
    { id: 'shifted_place', pattern: `The glowing ${dw} is in the ${pw} place. The learner's answer is ${shifted.join(' or ')}, `
      + 'what that digit would be worth one column over.', examples: shifted },
    ...(n >= 10 ? [{ id: 'said_number', pattern: `The whole printed number is ${whole}. The learner's answer is ${whole}, `
      + 'the whole number read aloud, instead of the worth of one digit.', examples: [whole] }] : []),
    ...(near.length ? [{ id: 'next_digit_value', pattern: `The glowing ${dw} is in the ${pw} place. The learner's answer is ${near.join(' or ')}, `
      + 'the worth of a digit one more or one less in that place.', examples: near }] : []),
  ];
}

/** The chart as written, one entry per column HIGH → LOW; `null` is an empty column. */
export type WrittenChart = ReadonlyArray<number | null>;

export const chartComplete = (item: PlaceValueItem, written: WrittenChart) =>
  written.length === item.chartPlaces.length && written.every(d => d !== null);

export const chartMatches = (item: PlaceValueItem, written: WrittenChart) =>
  chartComplete(item, written) && item.expectedDigits.every((d, i) => written[i] === d);

/** What a wrong chart shows (`PlaceValueMiss` in the card). Undefined for a right chart and for the spoken kinds. */
export function placeValueMiss(item: PlaceValueItem | null, written: WrittenChart): PlaceValueMiss | undefined {
  if (!item || item.kind !== 'build_number' || chartMatches(item, written)) return undefined;
  const want = item.expectedDigits;
  if (!chartComplete(item, written)) {
    return want.every((d, i) => (written[i] ?? null) !== null || d === 0) ? 'zero_left_empty' : 'column_empty';
  }
  const got = written as readonly number[];
  if ([...got].sort().join() === [...want].sort().join()) return 'digits_swapped';
  const n = want.length, head = (ds: readonly number[]) => ds.slice(0, n - 2).join();
  const [wt, wo] = want.slice(n - 2), [gt, go] = got.slice(n - 2);
  const teenTy = (t: number, o: number, t2: number, o2: number) => t === 1 && o > 0 && t2 === o && o2 === 0;
  if (head(got) === head(want) && (teenTy(wt, wo, gt, go) || teenTy(gt, go, wt, wo))) return 'teen_ty_swap';
  const off = Number(got.join('')) - item.targetNumber;
  if (off === -1) return 'one_short';
  if (off === 1) return 'one_over';
  if (Math.abs(off) === 10) return 'one_ten_off';
  return off < 0 ? 'short_by_more' : 'over_by_more';
}

/** The committed chart in the learner's terms, as the tutor and the observer read it. */
export const describeChart = (item: PlaceValueItem, written: WrittenChart) =>
  `Wrote ${item.chartPlaces.map((p, i) => `${placeWord(p)}: ${written[i] ?? 'empty'}`).join(', ')}`;

/** The scene of one item; `kind` names the card's step. */
export function workspaceScene(item: PlaceValueItem, view: { written: WrittenChart }): SceneOf {
  const build = item.kind === 'build_number';
  return {
    objects: [],
    facts: {
      kind: item.kind,
      ...(build ? { columns: item.chartPlaces.length, columnsFilled: view.written.filter(d => d !== null).length }
        : { printedNumber: item.targetNumber, glowingDigit: item.digit }),
      constraints: build
        ? 'The number is never printed: the learner hears it only in the ask.'
        : 'The number is printed without column labels: on a which-place step a label would be the answer, and the '
          + 'number read aloud says what its digits are worth.',
    },
  };
}
