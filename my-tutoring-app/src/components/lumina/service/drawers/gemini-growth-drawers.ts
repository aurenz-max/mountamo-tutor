/**
 * Generators for the growth and chance drawers (growthSpecs.ts). Same contract as
 * gemini-drawers.ts: code checks the spec, failures go back to the model, and the generator
 * throws after the last attempt.
 */
import { Type, type Schema } from '@google/genai';
import { brief, generateChecked, parseSettings, type DrawerAsk } from './gemini-drawers';
import {
  chanceRunProblems, growthRaceProblems, ratioScalerProblems, unitChainProblems,
  type DrawerChanceRunData, type DrawerGrowthRaceData, type DrawerRatioScalerData, type DrawerUnitChainData,
} from '../../primitives/visual-primitives/drawers/growthSpecs';

const S = Type.STRING, N = Type.NUMBER;

// ---------------------------------------------------------------------------

const unitChainSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S, description: 'A question, e.g. "How many times will your heart beat?"' },
    caption: { type: S, description: 'One sentence, e.g. "Start with one minute and multiply your way to a lifetime."' },
    finalNoun: { type: S, description: 'What the final number counts, e.g. "heartbeats".' },
    inputs: {
      type: Type.ARRAY, description: '1-2 quantities on sliders: the starting rate, and optionally how long.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: S, description: 'Letters only, e.g. "bpm".' }, label: { type: S }, unit: { type: S },
          min: { type: N }, max: { type: N }, step: { type: N }, value: { type: N },
        },
        required: ['id', 'label', 'unit', 'min', 'max', 'step', 'value'],
      },
    },
    startExpr: { type: S, description: 'The starting amount as a formula over input ids, usually just one id.' },
    startLabel: { type: S, description: 'What the starting amount is, e.g. "Beats in a minute".' },
    steps: {
      type: Type.ARRAY, description: '2-6 multiplications, in order.',
      items: {
        type: Type.OBJECT,
        properties: {
          times: { type: S, description: 'The multiplier: a number like "60", or an input id like "years".' },
          label: { type: S, description: 'What the running total is after this step, e.g. "Beats in an hour".' },
          why: { type: S, description: 'Why it multiplies, e.g. "60 minutes in an hour".' },
        },
        required: ['times', 'label', 'why'],
      },
    },
    checkSettings: { type: S, description: 'Input settings for the check, as "id=value; id=value".' },
    checkExpect: { type: N, description: 'The final value at those settings, worked out step by step.' },
    checkTolerance: { type: N, description: 'At most 5% of checkExpect.' },
    checkFact: { type: S, description: 'The check in one sentence with its numbers.' },
  },
  required: ['title', 'caption', 'finalNoun', 'inputs', 'startExpr', 'startLabel', 'steps', 'checkSettings', 'checkExpect', 'checkTolerance', 'checkFact'],
};

type UnitChainRaw = Omit<DrawerUnitChainData, 'check'> & { checkSettings: string; checkExpect: number; checkTolerance: number; checkFact: string };

export const generateDrawerUnitChain = (ask: DrawerAsk) =>
  generateChecked<UnitChainRaw, DrawerUnitChainData>('unit-chain', unitChainSchema,
    `You are designing a unit chain: a small familiar rate multiplied step by step into a large total, each step saying `
    + `why it multiplies.\n${brief(ask)}\nUse real conversion factors (60 minutes in an hour, 365 days in a year). Keep every `
    + `step a plain multiplication. Use words the audience knows.`,
    raw => ({
      title: raw.title, caption: raw.caption, finalNoun: raw.finalNoun, inputs: raw.inputs,
      startExpr: raw.startExpr, startLabel: raw.startLabel, steps: raw.steps,
      check: { set: parseSettings(raw.checkSettings), expect: raw.checkExpect, tolerance: raw.checkTolerance, fact: raw.checkFact },
    }),
    unitChainProblems);

// ---------------------------------------------------------------------------

const ratioScalerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S, description: 'One sentence on what to watch as the amount changes.' },
    base: { type: N, description: 'How much the original recipe or mix makes.' },
    unitLabel: { type: S, description: 'What base counts, plural: "pancakes", "liters of paint".' },
    min: { type: N }, max: { type: N }, step: { type: N, description: 'Slider step; choose it so base is on a step.' },
    value: { type: N, description: 'Starting amount, different from base.' },
    ingredients: {
      type: Type.ARRAY, description: '2-7 parts of the recipe or mixture for the base amount.',
      items: { type: Type.OBJECT, properties: { label: { type: S }, amount: { type: N }, unit: { type: S, description: 'e.g. "cup", "g", or empty for a count.' } }, required: ['label', 'amount', 'unit'] },
    },
  },
  required: ['title', 'caption', 'base', 'unitLabel', 'min', 'max', 'step', 'value', 'ingredients'],
};

export const generateDrawerRatioScaler = (ask: DrawerAsk) =>
  generateChecked<DrawerRatioScalerData, DrawerRatioScalerData>('ratio-scaler', ratioScalerSchema,
    `You are designing a ratio scaler: a real recipe or mixture whose amounts all scale by the same factor as the learner `
    + `changes how much to make.\n${brief(ask)}\nUse a realistic recipe or mix with simple amounts. base must lie between `
    + `min and max.`,
    raw => raw, ratioScalerProblems);

// ---------------------------------------------------------------------------

const growthRaceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S, description: 'e.g. "$10 a day, or a penny that doubles?"' },
    caption: { type: S, description: 'One sentence describing both options, without saying which wins.' },
    xLabel: { type: S, description: 'What x counts, e.g. "Day".' },
    unit: { type: S, description: 'Unit of the values, e.g. "$" or "bacteria".' },
    min: { type: Type.INTEGER }, max: { type: Type.INTEGER, description: 'At most 200 more than min.' },
    value: { type: Type.INTEGER, description: 'Starting x, before the crossing.' },
    seriesA: { type: S, description: 'Label of the first option, which grows by adding.' },
    exprA: { type: S, description: 'Its value as a formula in x, e.g. "10*x". Only numbers, x, + - * / ^ and parentheses.' },
    seriesB: { type: S, description: 'Label of the second option, which grows by multiplying.' },
    exprB: { type: S, description: 'Its value as a formula in x, e.g. "0.01*2^(x-1)".' },
    checkSeries: { type: S, enum: ['A', 'B'] },
    checkAt: { type: Type.INTEGER },
    checkExpect: { type: N, description: 'That option\'s value at checkAt, worked out by hand.' },
    checkTolerance: { type: N },
    checkFact: { type: S, description: 'The check in one sentence with its numbers.' },
  },
  required: ['title', 'caption', 'xLabel', 'unit', 'min', 'max', 'value', 'seriesA', 'exprA', 'seriesB', 'exprB', 'checkSeries', 'checkAt', 'checkExpect', 'checkTolerance', 'checkFact'],
};

interface GrowthRaceRaw {
  title: string; caption: string; xLabel: string; unit: string; min: number; max: number; value: number;
  seriesA: string; exprA: string; seriesB: string; exprB: string;
  checkSeries: 'A' | 'B'; checkAt: number; checkExpect: number; checkTolerance: number; checkFact: string;
}

export const generateDrawerGrowthRace = (ask: DrawerAsk) =>
  generateChecked<GrowthRaceRaw, DrawerGrowthRaceData>('growth-race', growthRaceSchema,
    `You are designing a growth race: two quantities over time, one growing by adding the same amount each step, the other `
    + `by multiplying. The adding one must lead at first and the multiplying one must overtake it before max.\n${brief(ask)}\n`
    + `Use a real situation from the lesson and numbers the audience can follow.`,
    raw => ({
      title: raw.title, caption: raw.caption, xLabel: raw.xLabel, unit: raw.unit, min: raw.min, max: raw.max, value: raw.value,
      series: [{ label: raw.seriesA, expr: raw.exprA }, { label: raw.seriesB, expr: raw.exprB }],
      check: { series: raw.checkSeries === 'B' ? 1 : 0, at: raw.checkAt, expect: raw.checkExpect, tolerance: raw.checkTolerance, fact: raw.checkFact },
    }),
    growthRaceProblems);

// ---------------------------------------------------------------------------

const chanceRunSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S, description: 'One sentence inviting a prediction, without giving the answer.' },
    combine: { type: S, enum: ['sum', 'together'], description: 'sum: add the numbers that come up (dice). together: the result is which outcomes came up, order ignored (two coins, a genetics cross).' },
    sources: {
      type: Type.ARRAY, description: '1-3 things used at once: dice, coins, spinners, bags, parents.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: S, description: 'e.g. "Die 1", "Coin", "Spinner".' },
          outcomes: { type: Type.ARRAY, items: { type: S }, description: '2-12 equally likely outcomes. Repeat an outcome to make it more likely. Numbers only when combine is sum.' },
        },
        required: ['label', 'outcomes'],
      },
    },
  },
  required: ['title', 'caption', 'combine', 'sources'],
};

export const generateDrawerChanceRun = (ask: DrawerAsk) =>
  generateChecked<DrawerChanceRunData, DrawerChanceRunData>('chance-run', chanceRunSchema,
    `You are designing a chance run: a chance experiment the learner repeats in batches (10, 100, 1000 times) and watches `
    + `settle toward the expected results.\n${brief(ask)}\nPick the experiment from this lesson. Keep the number of `
    + `possible results at 24 or fewer.`,
    raw => raw, chanceRunProblems);
