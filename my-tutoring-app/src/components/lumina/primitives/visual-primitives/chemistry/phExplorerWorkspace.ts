/**
 * ph-explorer on the shared tutor/JEV teaching workspace (W1, plain shape; ROLLOUT C26).
 *
 * Every item is built and keyed by code from the lesson's substances; the generator writes only the substances (name,
 * pH, a real-world line). Each mode is one closed choice the learner taps and checks, or says (J14):
 * - test: a named substance; dip the blue and red litmus papers, then say acid, base or neutral. Key: the pH.
 * - indicator: an unnamed sample in red cabbage juice; say which pH range its colour shows. Key: the band of its pH.
 * - neutralize: 1 cup of hydrochloric acid at a given pH; choose how many cups of sodium hydroxide at a given pH make
 *   it neutral. Key: 10^(14 - acid pH - base pH) cups, from the two pH values (strong acid and strong base only).
 *
 * Pure: the component, the adapter, the journey row and the tests read the same items, checks, misses and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { PhExplorerData, Substance } from './PhExplorer';

export type PhMode = 'test' | 'indicator' | 'neutralize';
export const PH_MODES: PhMode[] = ['test', 'indicator', 'neutralize'];
export type PhKind = 'acid' | 'base' | 'neutral';

/** Code's reading of a pH: within 0.25 of 7 is neutral. */
export const kindOf = (pH: number): PhKind => (Math.abs(pH - 7) < 0.25 ? 'neutral' : pH < 7 ? 'acid' : 'base');

// ── Indicator colours (code-owned; the generator's colour fields are not read) ─────────────

/** Red cabbage juice: six colour bands across the scale. */
export const CABBAGE_BANDS = [
  { label: 'pH 0-2', color: 'red', hex: '#e53e3e', below: 2.5 },
  { label: 'pH 3-4', color: 'pink', hex: '#ed64a6', below: 4.5 },
  { label: 'pH 5-7', color: 'purple', hex: '#9f7aea', below: 7.5 },
  { label: 'pH 8-9', color: 'blue', hex: '#4299e1', below: 9.5 },
  { label: 'pH 10-12', color: 'green', hex: '#48bb78', below: 12.5 },
  { label: 'pH 13-14', color: 'yellow', hex: '#ecc94b', below: 99 },
] as const;
export const bandOf = (pH: number) => CABBAGE_BANDS.findIndex(b => pH < b.below);
/** A pH within 0.25 of a band edge reads as either colour: not asked. */
export const nearBandEdge = (pH: number) => CABBAGE_BANDS.slice(0, -1).some(b => Math.abs(pH - b.below) < 0.25);

/** Universal indicator colour of a pH (the mixed beaker), with the colour word the tutor is told. */
export const PH_COLORS: Record<number, string> = {
  0: '#ff0000', 1: '#ff4400', 2: '#ff8800', 3: '#ffaa00', 4: '#ffcc00', 5: '#dddd00', 6: '#aaee00', 7: '#00cc00',
  8: '#00aaaa', 9: '#0088cc', 10: '#0066dd', 11: '#4444ee', 12: '#6622ee', 13: '#8800cc', 14: '#660088',
};
export const universalHex = (pH: number) => PH_COLORS[Math.round(Math.min(14, Math.max(0, pH)))];
export const universalWord = (pH: number) =>
  pH < 3 ? 'red' : pH < 5 ? 'orange' : pH < 6.5 ? 'yellow' : pH < 7.5 ? 'green' : pH < 10 ? 'blue' : 'purple';

/** Litmus papers after a dip: an acid turns blue paper red, a base turns red paper blue, neutral changes neither. */
export const litmusAfter = (kind: PhKind) => ({ bluePaper: kind === 'acid' ? 'red' : 'blue', redPaper: kind === 'base' ? 'blue' : 'red' });

// ── Items ─────────────────────────────────────────────────────────────────────────────────

export const KIND_CHOICES = ['Acid', 'Base', 'Neutral'] as const;
export const AMOUNTS = [
  { label: '1/100 cup', cups: 0.01, said: 'one hundredth of a cup' },
  { label: '1/10 cup', cups: 0.1, said: 'one tenth of a cup' },
  { label: '1 cup', cups: 1, said: 'one cup' },
  { label: '10 cups', cups: 10, said: 'ten cups' },
  { label: '100 cups', cups: 100, said: 'a hundred cups' },
] as const;

export interface PhLiquid { name: string; pH: number }
interface ItemBase { id: string; mode: PhMode; choices: readonly string[] }
export interface TestItem extends ItemBase { mode: 'test'; substance: Substance }
export interface IndicatorItem extends ItemBase { mode: 'indicator'; substance: Substance; sample: string }
export interface NeutralizeItem extends ItemBase { mode: 'neutralize'; acid: PhLiquid; base: PhLiquid }
export type PhItem = TestItem | IndicatorItem | NeutralizeItem;

/** A name that says what it is ("Acetic acid", "Sodium bicarbonate (base)") answers the test item. */
const NAMES_KIND = /\b(acid|acidic|base|basic|alkal\w*|neutral|lye)\b/i;
/** Never mixed: bleach with an acid releases chlorine gas. */
const NEVER_MIX = /bleach|hypochlor/i;
const STRONG_ACID = /hydrochloric|\bhcl\b|sulfuric|nitric/i;
const STRONG_BASE = /sodium hydroxide|\bnaoh\b|potassium hydroxide|\bkoh\b/i;

const byName = (a: Substance, b: Substance) => a.name.localeCompare(b.name);
const valid = (s: Substance) => !!s && typeof s.id === 'string' && !!s.name?.trim() && Number.isFinite(s.pH) && s.pH >= 0 && s.pH <= 14;

/** test: substances litmus reads plainly (not within 0.25-1 of 7) whose names do not say acid or base. */
export const testSubstances = (subs: readonly Substance[]) =>
  subs.filter(valid).filter(s => !NAMES_KIND.test(s.name) && !(Math.abs(s.pH - 7) >= 0.25 && Math.abs(s.pH - 7) < 1)).sort(byName);

/** indicator: substances whose pH is not on a colour edge. */
export const indicatorSubstances = (subs: readonly Substance[]) => subs.filter(valid).filter(s => !nearBandEdge(s.pH)).sort(byName);

export const SAMPLE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** The strong acid and strong base the mixing station uses: the lesson's own when it has them, else hydrochloric acid and sodium hydroxide. */
export function mixingPair(subs: readonly Substance[]): { acid: string; base: string } {
  const acid = subs.filter(valid).find(s => STRONG_ACID.test(s.name) && s.pH < 7 && !NEVER_MIX.test(s.name));
  const base = subs.filter(valid).find(s => STRONG_BASE.test(s.name) && s.pH > 7 && !NEVER_MIX.test(s.name));
  return { acid: acid?.name ?? 'Hydrochloric acid', base: base?.name ?? 'Sodium hydroxide' };
}

/** The pH pairs a neutralize session asks, by band: (acid pH, base pH). Same strength first, then a ten-times step. */
const PAIRS: Record<'4-6' | '7-8', Array<[number, number]>> = {
  '4-6': [[1, 13], [2, 12], [1, 12]],
  '7-8': [[1, 13], [1, 12], [2, 13]],
};
/** Cups of base that neutralize 1 cup of acid: hydrogen ions 10^-a per cup against hydroxide 10^(b-14) per cup. */
export const cupsToNeutral = (acidPH: number, basePH: number) => 10 ** (14 - acidPH - basePH);
export const amountIndex = (cups: number) => AMOUNTS.findIndex(a => Math.abs(Math.log10(a.cups) - Math.log10(cups)) < 1e-6);

export function neutralizeItem(names: { acid: string; base: string }, acidPH: number, basePH: number, choices: readonly string[] = AMOUNTS.map(a => a.label), suffix = ''): NeutralizeItem {
  return { id: `neutralize-${acidPH}-${basePH}${suffix}`, mode: 'neutralize', choices,
    acid: { name: names.acid, pH: acidPH }, base: { name: names.base, pH: basePH } };
}

/** The modes a payload asks for: its pin, else test and indicator, with neutralize at grades 7-8. */
export function resolvePhModes(data: Pick<PhExplorerData, 'challengeTypes' | 'gradeBand'>): PhMode[] {
  const asked = (data.challengeTypes ?? []).filter((m): m is PhMode => (PH_MODES as string[]).includes(m));
  if (asked.length) return PH_MODES.filter(m => asked.includes(m));
  return data.gradeBand === '7-8' ? PH_MODES : ['test', 'indicator'];
}

const CAP: Record<PhMode, [number, number]> = { test: [5, 3], indicator: [4, 3], neutralize: [3, 2] };

/** Every item of the session, in mode order. A pinned mode gets more items than a blended one. */
export function phItems(data: Pick<PhExplorerData, 'substances' | 'challengeTypes' | 'gradeBand'>): PhItem[] {
  const modes = resolvePhModes(data);
  const subs = data.substances ?? [];
  const cap = (m: PhMode) => CAP[m][modes.length === 1 ? 0 : 1];
  const out: PhItem[] = [];
  for (const mode of modes) {
    if (mode === 'test') {
      out.push(...testSubstances(subs).slice(0, cap(mode)).map((substance): TestItem =>
        ({ id: `test-${substance.id}`, mode, substance, choices: KIND_CHOICES })));
    } else if (mode === 'indicator') {
      out.push(...indicatorSubstances(subs).slice(0, cap(mode)).map((substance, i): IndicatorItem =>
        ({ id: `indicator-${substance.id}`, mode, substance, sample: `Sample ${SAMPLE_LETTERS[i]}`, choices: CABBAGE_BANDS.map(b => b.label) })));
    } else {
      const names = mixingPair(subs);
      out.push(...PAIRS[data.gradeBand === '7-8' ? '7-8' : '4-6'].slice(0, cap(mode)).map(([a, b]) => neutralizeItem(names, a, b)));
    }
  }
  return out;
}

// ── Keys and checks (never published to the tutor) ───────────────────────────────────────

export function keyChoice(item: PhItem): string {
  if (item.mode === 'test') return KIND_CHOICES[['acid', 'base', 'neutral'].indexOf(kindOf(item.substance.pH))];
  if (item.mode === 'indicator') return CABBAGE_BANDS[bandOf(item.substance.pH)].label;
  return AMOUNTS[amountIndex(cupsToNeutral(item.acid.pH, item.base.pH))].label;
}
export const phCorrect = (item: PhItem | undefined, choice: string | null) => !!item && choice !== null && choice === keyChoice(item);

/** The pH of 1 cup of the acid with `cups` of the base: the excess ions over the total volume. */
export function mixedPH(acidPH: number, basePH: number, cups: number): number {
  const h = 10 ** -acidPH, oh = 10 ** (basePH - 14) * cups, vol = 1 + cups;
  if (Math.abs(h - oh) <= 1e-9 * Math.max(h, oh)) return 7;
  return h > oh ? -Math.log10((h - oh) / vol) : 14 + Math.log10((oh - h) / vol);
}

// ── Misses: the pattern of the wrong choice, never a guessed cause ───────────────────────

/** test: acid called base or base called acid; an acid or base called neutral; a neutral one called acid or base. */
export type TestMiss = 'acid_base_swapped' | 'said_neutral' | 'missed_neutral';
/** indicator: a band on the other side of the purple middle; the band next to the key; a band further along. */
export type IndicatorMiss = 'other_side' | 'next_band' | 'far_band';
/** neutralize: 1 cup when the key is not 1 cup; less base than the key; more. */
export type NeutralizeMiss = 'equal_amounts' | 'too_little' | 'too_much';
export type PhExplorerMiss = TestMiss | IndicatorMiss | NeutralizeMiss;

export const PH_MISSES: Record<PhMode, readonly PhExplorerMiss[]> = {
  test: ['acid_base_swapped', 'said_neutral', 'missed_neutral'],
  indicator: ['other_side', 'next_band', 'far_band'],
  neutralize: ['equal_amounts', 'too_little', 'too_much'],
};

const PURPLE = 2;
export function phMiss(item: PhItem | undefined, choice: string | null): PhExplorerMiss | undefined {
  if (!item || choice === null || phCorrect(item, choice) || !item.choices.includes(choice)) return undefined;
  if (item.mode === 'test') {
    const key = kindOf(item.substance.pH), said = choice.toLowerCase();
    return key === 'neutral' ? 'missed_neutral' : said === 'neutral' ? 'said_neutral' : 'acid_base_swapped';
  }
  if (item.mode === 'indicator') {
    const key = bandOf(item.substance.pH), said = CABBAGE_BANDS.findIndex(b => b.label === choice);
    if (key !== PURPLE && said !== PURPLE && (key < PURPLE) !== (said < PURPLE)) return 'other_side';
    return Math.abs(key - said) === 1 ? 'next_band' : 'far_band';
  }
  const key = cupsToNeutral(item.acid.pH, item.base.pH), said = AMOUNTS.find(a => a.label === choice)!.cups;
  if (said === 1) return 'equal_amounts';
  return said < key ? 'too_little' : 'too_much';
}

// ── Assignment, spoken answers ───────────────────────────────────────────────────────────

export function askOf(item: PhItem): string {
  if (item.mode === 'test') return `Test ${item.substance.name} with litmus paper. Is it an acid, a base, or neutral?`;
  if (item.mode === 'indicator') return `${item.sample} was tested with red cabbage juice. Which pH range does its colour show?`;
  return `The beaker holds 1 cup of ${item.acid.name} at pH ${item.acid.pH}. How many cups of ${item.base.name} at pH ${item.base.pH} make it neutral?`;
}

const SAY: Record<PhKind, string> = {
  acid: '"acid", "acidic" or "an acid"',
  base: '"base", "basic", "a base" or "alkaline"',
  neutral: '"neutral" or "neither an acid nor a base"',
};
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function phExpectedAnswer(item: PhItem): string {
  const key = keyChoice(item), at = item.choices.indexOf(key);
  const place = `its place in the list ("the ${ORDINAL[at]} one")`;
  const others = item.choices.filter(c => c !== key).map(c => `"${c}"`).join(', ');
  if (item.mode === 'test') {
    const kind = kindOf(item.substance.pH);
    return `${kind}: ${SAY[kind]} or ${place} count. ${others} are wrong, and so is naming two or hedging between them.`;
  }
  if (item.mode === 'indicator') {
    const [lo, hi] = key.replace('pH ', '').split('-');
    return `"${key}": the range said any way ("${lo} to ${hi}", "between ${lo} and ${hi}"), one whole number from ${lo} to ${hi}, `
      + `or ${place} counts. ${others} are wrong, and so is a number outside ${lo} to ${hi}.`;
  }
  const amount = AMOUNTS.find(a => a.label === key)!;
  return `"${key}" of ${item.base.name} (${amount.said}): that amount said any way, or ${place}, counts. ${others} are wrong.`;
}

const quoted = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(', ');

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function phSpokenMisses(item: PhItem): KnownMiss[] {
  const key = keyChoice(item);
  const groups = new Map<PhExplorerMiss, string[]>();
  for (const c of item.choices) {
    const m = phMiss(item, c);
    if (m) groups.set(m, [...(groups.get(m) ?? []), c]);
  }
  const fact = item.mode === 'test' ? `${item.substance.name} is ${kindOf(item.substance.pH) === 'acid' ? 'an acid' : kindOf(item.substance.pH) === 'base' ? 'a base' : 'neutral'}.`
    : `The right choice is "${key}".`;
  const what: Record<PhExplorerMiss, string> = {
    acid_base_swapped: 'calls it the opposite kind',
    said_neutral: 'calls it neutral',
    missed_neutral: 'calls it an acid or a base',
    other_side: 'is a range on the other side of the purple middle of the chart',
    next_band: 'is the range next to it',
    far_band: 'is a range further along the same side',
    equal_amounts: 'is the same amount as the acid, 1 cup',
    too_little: 'is less base than that',
    too_much: 'is more base than that',
  };
  return PH_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({ id: m,
    pattern: `${fact} The learner's answer ${what[m]}: ${quoted(groups.get(m)!)}.`, examples: groups.get(m)!.slice(0, 6) }));
}

const HOW: Record<PhMode, string> = {
  test: 'The learner answers by saying it, or tapping Acid, Base or Neutral and pressing Check Answer.',
  indicator: 'The learner answers by saying it, or tapping one pH range and pressing Check Answer.',
  neutralize: 'The learner answers by saying it, or tapping one amount and pressing Mix and check.',
};

export function workspaceAssignment(item: PhItem): TeachingAssignment {
  const misses = phSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} ${HOW[item.mode]}`, response: 'speech', acceptsGesture: true,
    expectedAnswer: phExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface PhView {
  choice: string | null;
  /** test: the litmus papers have been dipped. */
  dipped: boolean;
  /** neutralize: the amount last mixed, if any. */
  mixedCups: number | null;
  /** The item is credited (its reveal is on screen). */
  solved: boolean;
}

export const describePhWork = (item: PhItem | undefined, view: Pick<PhView, 'choice'>) =>
  item && view.choice ? `Chose "${view.choice}"` : 'Nothing chosen yet';

const CONSTRAINTS = 'The learner answers by saying it, or by tapping one choice and checking it; the activity judges the tap. '
  + 'You cannot tap, check, dip or mix for the learner.';

/** What is drawn and asked. The choices are named, never which is right. */
export function workspaceScene(item: PhItem, view: PhView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item), choices: item.choices.map((c, i) => `${i + 1}) ${c}`).join('  ') };
  if (item.mode === 'test') {
    const after = litmusAfter(kindOf(item.substance.pH));
    facts.shown = `${item.substance.name} beside a blue litmus paper and a red litmus paper.`;
    facts.papers = view.dipped
      ? `Dipped: the blue paper is now ${after.bluePaper}; the red paper is now ${after.redPaper}.`
      : 'Not dipped yet: the learner presses "Dip the litmus papers" to see them change, or not.';
  } else if (item.mode === 'indicator') {
    facts.shown = `${item.sample}, unnamed, in a test tube of red cabbage juice. The juice in the tube is ${CABBAGE_BANDS[bandOf(item.substance.pH)].color}. `
      + 'No pH scale is on screen.';
  } else {
    facts.shown = `A beaker with 1 cup of ${item.acid.name} (pH ${item.acid.pH}) and a bottle of ${item.base.name} (pH ${item.base.pH}), `
      + 'with universal indicator in the beaker. The pH scale is drawn with both liquids marked.';
    if (view.mixedCups !== null) {
      const pH = mixedPH(item.acid.pH, item.base.pH, view.mixedCups);
      facts.mixed = `The learner mixed in ${AMOUNTS.find(a => a.cups === view.mixedCups)?.label ?? `${view.mixedCups} cups`}; `
        + `the beaker turned ${universalWord(pH)}.`;
    }
  }
  facts.learnerWork = describePhWork(item, view);
  facts.constraints = CONSTRAINTS;
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and the wrong choice that shows the most telling miss. */
export function phHarnessAnswers(item: PhItem): { correct: string; plainWrong: string } {
  const rank = PH_MISSES[item.mode];
  const wrong = item.choices.filter(c => !phCorrect(item, c))
    .sort((a, b) => rank.indexOf(phMiss(item, a)!) - rank.indexOf(phMiss(item, b)!));
  return { correct: keyChoice(item), plainWrong: wrong[0] ?? '' };
}
