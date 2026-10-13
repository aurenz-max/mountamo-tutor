/**
 * Registry entries for every drawer kind, spread into PRIMITIVE_REGISTRY. All drawers share the
 * same section chrome; only the component and the section title differ.
 */
import type React from 'react';
import type { PrimitiveConfig } from '../../../config/primitiveRegistry';
import DrawerModelSlider from './DrawerModelSlider';
import DrawerPartWhole from './DrawerPartWhole';
import DrawerCauseChain from './DrawerCauseChain';
import DrawerMagnitudeLadder from './DrawerMagnitudeLadder';
import DrawerBandScale from './DrawerBandScale';
import DrawerRangeBars from './DrawerRangeBars';
import DrawerMetricSwitch from './DrawerMetricSwitch';
import DrawerUnitChain from './DrawerUnitChain';
import DrawerRatioScaler from './DrawerRatioScaler';
import DrawerGrowthRace from './DrawerGrowthRace';
import DrawerChanceRun from './DrawerChanceRun';
import DrawerCycleWheel from './DrawerCycleWheel';
import DrawerStoryArc from './DrawerStoryArc';
import DrawerThenAndNow from './DrawerThenAndNow';
import DrawerPerspectiveLens from './DrawerPerspectiveLens';
import DrawerWordAnatomy from './DrawerWordAnatomy';
import DrawerShadesOfMeaning from './DrawerShadesOfMeaning';
import DrawerRhythmGrid from './DrawerRhythmGrid';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entry = (component: React.FC<any>, sectionTitle: string): PrimitiveConfig => ({
  component,
  sectionTitle,
  showDivider: true,
  dividerStyle: 'left',
  allowMultiple: true,
  containerClassName: 'max-w-4xl mx-auto mb-20',
});

export const DRAWER_REGISTRY = {
  'drawer-model-slider': entry(DrawerModelSlider, 'Explore the Model'),
  'drawer-part-whole': entry(DrawerPartWhole, 'Parts of the Whole'),
  'drawer-cause-chain': entry(DrawerCauseChain, 'Chain of Effects'),
  'drawer-magnitude-ladder': entry(DrawerMagnitudeLadder, 'Sizes Across Scales'),
  'drawer-band-scale': entry(DrawerBandScale, 'Explore the Scale'),
  'drawer-range-bars': entry(DrawerRangeBars, 'Compare the Ranges'),
  'drawer-metric-switch': entry(DrawerMetricSwitch, 'It Depends What You Measure'),
  'drawer-unit-chain': entry(DrawerUnitChain, 'Multiply It Up'),
  'drawer-ratio-scaler': entry(DrawerRatioScaler, 'Scale the Recipe'),
  'drawer-growth-race': entry(DrawerGrowthRace, 'The Growth Race'),
  'drawer-chance-run': entry(DrawerChanceRun, 'Try It Many Times'),
  'drawer-cycle-wheel': entry(DrawerCycleWheel, 'Around the Cycle'),
  'drawer-story-arc': entry(DrawerStoryArc, 'The Shape of the Story'),
  'drawer-then-and-now': entry(DrawerThenAndNow, 'Then and Now'),
  'drawer-perspective-lens': entry(DrawerPerspectiveLens, 'Different Points of View'),
  'drawer-word-anatomy': entry(DrawerWordAnatomy, 'Inside the Word'),
  'drawer-shades-of-meaning': entry(DrawerShadesOfMeaning, 'Shades of Meaning'),
  'drawer-rhythm-grid': entry(DrawerRhythmGrid, 'Play the Rhythm'),
} as const;
