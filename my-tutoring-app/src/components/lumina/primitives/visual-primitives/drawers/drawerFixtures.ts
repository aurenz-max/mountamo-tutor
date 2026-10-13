/**
 * One valid spec per drawer kind added after the pilot, for tests. Each must pass its checks.
 */
import type { DrawerBandScaleData, DrawerMagnitudeLadderData, DrawerMetricSwitchData, DrawerRangeBarsData } from './scaleSpecs';
import type { DrawerChanceRunData, DrawerGrowthRaceData, DrawerRatioScalerData, DrawerUnitChainData } from './growthSpecs';
import type {
  DrawerCycleWheelData, DrawerPerspectiveLensData, DrawerRhythmGridData, DrawerShadesOfMeaningData, DrawerStoryArcData,
  DrawerThenAndNowData, DrawerWordAnatomyData,
} from './textSpecs';

export const FIXTURES = {
  'magnitude-ladder': {
    title: 'From a blood cell to the Earth', caption: 'Switch scales.', unit: 'm',
    items: [{ label: 'Earth', value: 12742000 }, { label: 'Red blood cell', value: 8e-6 }, { label: 'Ant', value: 4e-3 }, { label: 'Blue whale', value: 30 }],
  } satisfies DrawerMagnitudeLadderData,
  'band-scale': {
    title: 'The pH scale', caption: 'Each step is ten times.', variable: 'pH', unit: '', min: 0, max: 14, step: 0.1, value: 3,
    bands: [
      { from: 0, to: 6.5, label: 'Acidic', text: '{10^(7-x)} times more acidic than pure water.' },
      { from: 6.5, to: 7.5, label: 'Neutral', text: 'Close to pure water.' },
      { from: 7.5, to: 14, label: 'Basic', text: '{10^(x-7)} times more basic than pure water.' },
    ],
    markers: [{ label: 'Lemon juice', value: 2 }, { label: 'Pure water', value: 7 }],
  } satisfies DrawerBandScaleData,
  'range-bars': {
    title: 'Who can hear this?', caption: 'Slide the pitch.', variable: 'Pitch', unit: 'Hz', min: 10, max: 150000, value: 440,
    items: [{ label: 'Human', from: 20, to: 20000 }, { label: 'Bat', from: 2000, to: 110000 }],
    landmarks: [{ label: 'Middle A', value: 440 }],
  } satisfies DrawerRangeBarsData,
  'metric-switch': {
    title: 'Which planet is biggest?', caption: 'It depends.', follow: 'Earth',
    metrics: [{ label: 'Diameter', unit: 'km', digits: 0 }, { label: 'Day length', unit: 'hours', digits: 1 }],
    items: [{ label: 'Earth', values: [12756, 24] }, { label: 'Jupiter', values: [142984, 9.9] }, { label: 'Venus', values: [12104, 2802] }],
  } satisfies DrawerMetricSwitchData,
  'unit-chain': {
    title: 'Heartbeats', caption: 'Multiply up.', finalNoun: 'heartbeats',
    inputs: [{ id: 'bpm', label: 'Beats per minute', unit: 'bpm', min: 50, max: 110, step: 1, value: 75 }, { id: 'years', label: 'Years', unit: 'years', min: 10, max: 100, step: 1, value: 80 }],
    startExpr: 'bpm', startLabel: 'Beats in a minute',
    steps: [{ times: '60', label: 'In an hour', why: '60 minutes in an hour' }, { times: '24', label: 'In a day', why: '24 hours' }, { times: '365', label: 'In a year', why: '365 days' }, { times: 'years', label: 'In a lifetime', why: 'years lived' }],
    check: { set: { bpm: 70 }, expect: 2943360000, tolerance: 1, fact: '70 bpm for 80 years is 2,943,360,000 beats.' },
  } satisfies DrawerUnitChainData,
  'ratio-scaler': {
    title: 'Pancakes', caption: 'Same ratio.', base: 8, unitLabel: 'pancakes', min: 4, max: 32, step: 4, value: 12,
    ingredients: [{ label: 'Flour', amount: 1, unit: 'cup' }, { label: 'Milk', amount: 0.75, unit: 'cup' }, { label: 'Egg', amount: 1, unit: '' }],
  } satisfies DrawerRatioScalerData,
  'growth-race': {
    title: '$10 a day or a doubling penny?', caption: 'Adding or doubling.', xLabel: 'Day', unit: '$', min: 1, max: 30, value: 8,
    series: [{ label: '$10 a day', expr: '10*x' }, { label: 'Doubling penny', expr: '0.01*(2^x-1)' }],
    check: { series: 1, at: 30, expect: 10737418.23, tolerance: 0.01, fact: 'By day 30 the penny has made $10,737,418.23.' },
  } satisfies DrawerGrowthRaceData,
  'chance-run': {
    title: 'Two dice', caption: 'Which sum comes up most?', combine: 'sum',
    sources: [{ label: 'Die 1', outcomes: ['1', '2', '3', '4', '5', '6'] }, { label: 'Die 2', outcomes: ['1', '2', '3', '4', '5', '6'] }],
  } satisfies DrawerChanceRunData,
  'cycle-wheel': {
    title: 'The water cycle', caption: 'Round and round.',
    stages: [{ label: 'Evaporation', text: 'Water warms and rises.' }, { label: 'Condensation', text: 'Vapor cools into clouds.' }, { label: 'Precipitation', text: 'Rain falls.' }],
  } satisfies DrawerCycleWheelData,
  'story-arc': {
    title: 'The Three Little Pigs', caption: 'Up and down.',
    events: { beginning: 'Three pigs build houses.', problem: 'A wolf blows two down.', climax: 'He climbs down the chimney.', solved: 'He lands in hot water.', ending: 'The pigs live safely.' },
  } satisfies DrawerStoryArcData,
  'then-and-now': {
    title: 'Home life', caption: 'What changed?', thenLabel: '1900', nowLabel: 'Today',
    rows: [{ aspect: 'Light', then: 'Oil lamps', now: 'Electric lights', same: false }, { aspect: 'Cold food', then: 'An icebox', now: 'A refrigerator', same: false }, { aspect: 'Meals', then: 'Family meals', now: 'Family meals', same: true }],
  } satisfies DrawerThenAndNowData,
  'perspective-lens': {
    title: 'The Boston Tea Party', caption: 'Three ways.', event: 'Boston, 1773: colonists dumped tea into the harbor.',
    prompts: ['What happened?', 'What did they want?'],
    views: [{ label: 'A Patriot', answers: ['We threw the tea in.', 'No tax without a vote.'] }, { label: 'The British government', answers: ['Property was destroyed.', 'Order restored.'] }],
  } satisfies DrawerPerspectiveLensData,
  'word-anatomy': {
    title: 'Unbreakable', caption: 'Switch parts on and off.',
    pieces: [{ text: 'un', type: 'prefix', meaning: 'not' }, { text: 'break', type: 'root', meaning: 'come apart' }, { text: 'able', type: 'suffix', meaning: 'can be' }],
    forms: [{ use: ['break'], word: 'break', meaning: 'to come apart' }, { use: ['break', 'able'], word: 'breakable', meaning: 'can be broken' }, { use: ['un', 'break', 'able'], word: 'unbreakable', meaning: 'cannot be broken' }],
  } satisfies DrawerWordAnatomyData,
  'shades-of-meaning': {
    title: 'How big was it?', caption: 'Stronger word.', frame: 'The pumpkin was ___.', words: ['small', 'big', 'huge', 'gigantic'], weakLabel: 'a little', strongLabel: 'a lot',
  } satisfies DrawerShadesOfMeaningData,
  'rhythm-grid': {
    title: 'Stomp, stomp, clap', caption: 'Count along.', tempo: 80, beats: 4, stepsPerBeat: 2,
    tracks: [{ label: 'Stomp', sound: 'stomp', pattern: 'xx..xx..' }, { label: 'Clap', sound: 'clap', pattern: '..x...x.' }],
  } satisfies DrawerRhythmGridData,
};
