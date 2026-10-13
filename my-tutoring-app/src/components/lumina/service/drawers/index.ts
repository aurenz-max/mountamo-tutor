/**
 * Every drawer kind's generator, keyed by catalog id. coreGenerators registers each one, so a
 * new kind needs an entry here, a catalog entry and a registry entry.
 */
import type { DrawerAsk } from './gemini-drawers';
import { generateDrawerCauseChain, generateDrawerModelSlider, generateDrawerPartWhole } from './gemini-drawers';
import { generateDrawerBandScale, generateDrawerMagnitudeLadder, generateDrawerMetricSwitch, generateDrawerRangeBars } from './gemini-scale-drawers';
import { generateDrawerChanceRun, generateDrawerGrowthRace, generateDrawerRatioScaler, generateDrawerUnitChain } from './gemini-growth-drawers';
import {
  generateDrawerCycleWheel, generateDrawerPerspectiveLens, generateDrawerRhythmGrid, generateDrawerShadesOfMeaning,
  generateDrawerStoryArc, generateDrawerThenAndNow, generateDrawerWordAnatomy,
} from './gemini-text-drawers';

export const DRAWER_GENERATORS: Record<string, (ask: DrawerAsk) => Promise<unknown>> = {
  'drawer-model-slider': generateDrawerModelSlider,
  'drawer-part-whole': generateDrawerPartWhole,
  'drawer-cause-chain': generateDrawerCauseChain,
  'drawer-magnitude-ladder': generateDrawerMagnitudeLadder,
  'drawer-band-scale': generateDrawerBandScale,
  'drawer-range-bars': generateDrawerRangeBars,
  'drawer-metric-switch': generateDrawerMetricSwitch,
  'drawer-unit-chain': generateDrawerUnitChain,
  'drawer-ratio-scaler': generateDrawerRatioScaler,
  'drawer-growth-race': generateDrawerGrowthRace,
  'drawer-chance-run': generateDrawerChanceRun,
  'drawer-cycle-wheel': generateDrawerCycleWheel,
  'drawer-story-arc': generateDrawerStoryArc,
  'drawer-then-and-now': generateDrawerThenAndNow,
  'drawer-perspective-lens': generateDrawerPerspectiveLens,
  'drawer-word-anatomy': generateDrawerWordAnatomy,
  'drawer-shades-of-meaning': generateDrawerShadesOfMeaning,
  'drawer-rhythm-grid': generateDrawerRhythmGrid,
};
