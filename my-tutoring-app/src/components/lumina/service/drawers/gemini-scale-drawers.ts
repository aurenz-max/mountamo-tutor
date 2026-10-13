/**
 * Generators for the scale drawers (scaleSpecs.ts). Same contract as gemini-drawers.ts: Gemini
 * writes the spec, code checks it, a failing spec is sent back with its problems, and after the
 * last attempt the generator throws rather than show something wrong.
 */
import { Type, type Schema } from '@google/genai';
import { brief, generateChecked, type DrawerAsk } from './gemini-drawers';
import {
  bandScaleProblems, magnitudeLadderProblems, metricSwitchProblems, rangeBarsProblems,
  type DrawerBandScaleData, type DrawerMagnitudeLadderData, type DrawerMetricSwitchData, type DrawerRangeBarsData,
} from '../../primitives/visual-primitives/drawers/scaleSpecs';

const S = Type.STRING, N = Type.NUMBER;
const labelled = { type: Type.OBJECT, properties: { label: { type: S }, value: { type: N } }, required: ['label', 'value'] } satisfies Schema;
const REAL = 'Use real, published figures; round them sensibly. Use words the audience knows.';

// ---------------------------------------------------------------------------

const magnitudeLadderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S, description: 'e.g. "From a blood cell to the Earth"' },
    caption: { type: S, description: 'One sentence on what to look for, without giving values.' },
    unit: { type: S, description: 'The unit of every value, e.g. "m", "years", "people", "km/h".' },
    items: { type: Type.ARRAY, items: labelled, description: '4-8 real things of very different sizes, all measured in unit. The largest must be at least 1000 times the smallest.' },
  },
  required: ['title', 'caption', 'unit', 'items'],
};

export const generateDrawerMagnitudeLadder = (ask: DrawerAsk) =>
  generateChecked<DrawerMagnitudeLadderData, DrawerMagnitudeLadderData>('magnitude-ladder', magnitudeLadderSchema,
    `You are designing a magnitude ladder: real things of very different sizes on one ladder, which the learner sees on an `
    + `ordinary scale and then on a powers-of-ten scale.\n${brief(ask)}\n${REAL} Pick familiar things spread across many `
    + `powers of ten, all measured in the same unit.`,
    raw => raw, magnitudeLadderProblems);

// ---------------------------------------------------------------------------

const bandScaleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S, description: 'One sentence on what the scale shows.' },
    variable: { type: S, description: 'Name of the quantity, e.g. "pH", "Temperature".' },
    unit: { type: S, description: 'Unit, or empty string.' },
    min: { type: N }, max: { type: N }, step: { type: N },
    value: { type: N, description: 'Starting value.' },
    bands: {
      type: Type.ARRAY, description: '2-7 named zones in order. The first starts at min, each starts where the last ended, the last ends at max.',
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: N }, to: { type: N }, label: { type: S },
          text: { type: S, description: 'One sentence explaining a value in this zone. It may contain a formula in braces using x, the current value, e.g. "{10^(7-x)} times more acidic than pure water." Only + - * / ^ and parentheses.' },
        },
        required: ['from', 'to', 'label', 'text'],
      },
    },
    markers: { type: Type.ARRAY, items: labelled, description: '3-8 familiar examples with their real values on the scale.' },
  },
  required: ['title', 'caption', 'variable', 'unit', 'min', 'max', 'step', 'value', 'bands', 'markers'],
};

export const generateDrawerBandScale = (ask: DrawerAsk) =>
  generateChecked<DrawerBandScaleData, DrawerBandScaleData>('band-scale', bandScaleSchema,
    `You are designing a band scale: one quantity on a slider, divided into named zones, with familiar examples marked on it.\n`
    + `${brief(ask)}\n${REAL} Use the zones scientists or the standard scale actually use.`,
    raw => ({ ...raw, markers: raw.markers ?? [] }), bandScaleProblems);

// ---------------------------------------------------------------------------

const rangeBarsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S, description: 'One sentence inviting the learner to slide and compare.' },
    variable: { type: S, description: 'Name of the quantity, e.g. "Pitch".' }, unit: { type: S },
    min: { type: N }, max: { type: N }, value: { type: N, description: 'Starting value.' },
    items: {
      type: Type.ARRAY, description: '2-8 things, each with the range of values it covers.',
      items: { type: Type.OBJECT, properties: { label: { type: S }, from: { type: N }, to: { type: N } }, required: ['label', 'from', 'to'] },
    },
    landmarks: { type: Type.ARRAY, items: labelled, description: '0-6 familiar values worth jumping to.' },
  },
  required: ['title', 'caption', 'variable', 'unit', 'min', 'max', 'value', 'items', 'landmarks'],
};

export const generateDrawerRangeBars = (ask: DrawerAsk) =>
  generateChecked<DrawerRangeBarsData, DrawerRangeBarsData>('range-bars', rangeBarsSchema,
    `You are designing range bars: several things, each covering a range of one quantity, on one shared scale the learner `
    + `sweeps a slider across.\n${brief(ask)}\n${REAL} min and max must contain every range.`,
    raw => ({ ...raw, landmarks: raw.landmarks ?? [] }), rangeBarsProblems);

// ---------------------------------------------------------------------------

const metricSwitchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S, description: 'A question whose answer depends on the measure, e.g. "Which planet is the biggest?"' },
    caption: { type: S },
    follow: { type: S, description: 'The exact label of one item to follow through every ranking.' },
    metrics: {
      type: Type.ARRAY, description: '2-4 measures that rank the items in different orders.',
      items: { type: Type.OBJECT, properties: { label: { type: S }, unit: { type: S }, digits: { type: Type.INTEGER, description: 'Decimal places, 0-3.' } }, required: ['label', 'unit', 'digits'] },
    },
    items: {
      type: Type.ARRAY, description: '3-10 things.',
      items: { type: Type.OBJECT, properties: { label: { type: S }, values: { type: Type.ARRAY, items: { type: N }, description: 'One value per metric, in the same order as metrics.' } }, required: ['label', 'values'] },
    },
  },
  required: ['title', 'caption', 'follow', 'metrics', 'items'],
};

export const generateDrawerMetricSwitch = (ask: DrawerAsk) =>
  generateChecked<DrawerMetricSwitchData, DrawerMetricSwitchData>('metric-switch', metricSwitchSchema,
    `You are designing a metric switch: one set of things that the learner ranks by different measures, to see that the `
    + `order depends on what you measure.\n${brief(ask)}\n${REAL} Choose measures that put the items in clearly different orders.`,
    raw => raw, metricSwitchProblems);
