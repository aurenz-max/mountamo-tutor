import React from 'react';
import { ConceptCard } from '../primitives/ConceptCard';
import { GenerativeTable } from '../primitives/GenerativeTable';
import { KnowledgeCheck } from '../primitives/KnowledgeCheck';
import { FeatureExhibit } from '../primitives/FeatureExhibit';
import { ComparisonPanel } from '../primitives/ComparisonPanel';
import { FormulaCard } from '../primitives/FormulaCard';
import { MathVisuals } from '../primitives/MathVisuals';
import { SentenceAnalyzer } from '../primitives/SentenceAnalyzer';
import { CustomVisual } from '../primitives/CustomVisual';
import GraphBoard from '../primitives/GraphBoard';
import BarModel from '../primitives/visual-primitives/math/BarModel';
import NumberLine from '../primitives/visual-primitives/math/NumberLine';
import BaseTenBlocks from '../primitives/visual-primitives/math/BaseTenBlocks';
import FractionCircles from '../primitives/visual-primitives/math/FractionCircles';
import FractionBar from '../primitives/visual-primitives/math/FractionBar';
import GeometricShape from '../primitives/visual-primitives/math/GeometricShape';
import PlaceValueChart from '../primitives/visual-primitives/math/PlaceValueChart';
import AreaModel from '../primitives/visual-primitives/math/AreaModel';
import ArrayGrid from '../primitives/visual-primitives/math/ArrayGrid';
import DoubleNumberLine from '../primitives/visual-primitives/math/DoubleNumberLine';
import PercentBar from '../primitives/visual-primitives/math/PercentBar';
import FactorTree from '../primitives/visual-primitives/math/FactorTree';
import RatioTable from '../primitives/visual-primitives/math/RatioTable';
import TapeDiagram from '../primitives/visual-primitives/math/TapeDiagram';
import BalanceScale from '../primitives/visual-primitives/math/BalanceScale';
import FunctionMachine from '../primitives/visual-primitives/math/FunctionMachine';
import CoordinateGraph from '../primitives/visual-primitives/math/CoordinateGraph';
import SlopeTriangle from '../primitives/visual-primitives/math/SlopeTriangle';
import SystemsEquationsVisualizer from '../primitives/visual-primitives/math/SystemsEquationsVisualizer';
import MatrixDisplay from '../primitives/visual-primitives/math/MatrixDisplay';
import DotPlot from '../primitives/visual-primitives/math/DotPlot';
import Histogram from '../primitives/visual-primitives/math/Histogram';
import TwoWayTable from '../primitives/visual-primitives/math/TwoWayTable';
import ScaleSpectrum from '../primitives/ScaleSpectrum';
import AnnotatedExample from '../primitives/AnnotatedExample';
import NestedHierarchy from '../primitives/NestedHierarchy';
import ImagePanel from '../primitives/ImagePanel';
import TakeHomeActivity from '../primitives/TakeHomeActivity';
import InteractivePassage from '../primitives/InteractivePassage';
import WordBuilder from '../primitives/WordBuilder';
import MoleculeViewer from '../primitives/MoleculeViewer';
import PeriodicTable from '../primitives/PeriodicTable';
import SpeciesProfile from '../primitives/biology-primitives/SpeciesProfile';
import MediaPlayer from '../primitives/MediaPlayer';
import FlashcardDeck from '../primitives/FlashcardDeck';
import ImageComparison from '../primitives/ImageComparison';
// Engineering Primitives
import LeverLab from '../primitives/visual-primitives/engineering/LeverLab';
import PulleySystemBuilder from '../primitives/visual-primitives/engineering/PulleySystemBuilder';
import RampLab from '../primitives/visual-primitives/engineering/RampLab';
import WheelAxleExplorer from '../primitives/visual-primitives/engineering/WheelAxleExplorer';
import GearTrainBuilder from '../primitives/visual-primitives/engineering/GearTrainBuilder';
import BridgeBuilder from '../primitives/visual-primitives/engineering/BridgeBuilder';
import TowerStacker from '../primitives/visual-primitives/engineering/TowerStacker';
import ShapeStrengthTester from '../primitives/visual-primitives/engineering/ShapeStrengthTester';
import FoundationBuilder from '../primitives/visual-primitives/engineering/FoundationBuilder';
import ExcavatorArmSimulator from '../primitives/visual-primitives/engineering/ExcavatorArmSimulator';
import DumpTruckLoader from '../primitives/visual-primitives/engineering/DumpTruckLoader';
import ConstructionSequencePlanner from '../primitives/visual-primitives/engineering/ConstructionSequencePlanner';
// Foundational Concept Teaching
import FoundationExplorer from '../primitives/FoundationExplorer';
import { ComponentId } from '../types';

/**
 * Configuration for rendering a primitive component
 */
export interface PrimitiveConfig {
  /**
   * The React component to render
   */
  component: React.ComponentType<any>;

  /**
   * Optional wrapper component (e.g., for adding headers, managing state)
   */
  wrapper?: React.ComponentType<{ children: React.ReactNode; data: any; index?: number }>;

  /**
   * Section title displayed above the primitive
   */
  sectionTitle?: string;

  /**
   * Whether to render a header divider
   */
  showDivider?: boolean;

  /**
   * Divider style: 'left' (one-sided) or 'center' (both sides)
   */
  dividerStyle?: 'left' | 'center';

  /**
   * Custom container className
   */
  containerClassName?: string;

  /**
   * Whether this primitive supports multiple instances
   */
  allowMultiple?: boolean;

  /**
   * Whether this primitive supports evaluation tracking.
   * When true, the ManifestOrderRenderer will automatically inject
   * evaluation props (instanceId, skillId, exhibitId, etc.) from the manifest.
   */
  supportsEvaluation?: boolean;
}

/**
 * Registry mapping component IDs to their rendering configurations
 */
export const PRIMITIVE_REGISTRY: Record<ComponentId, PrimitiveConfig> = {
  'curator-brief': {
    component: () => null, // Handled separately in App.tsx
    allowMultiple: false,
  },

  'concept-card-grid': {
    component: ConceptCard,
    allowMultiple: true,
    containerClassName: 'grid grid-cols-1 lg:grid-cols-3 gap-8 justify-items-center max-w-7xl mx-auto mb-20',
  },

  'feature-exhibit': {
    component: FeatureExhibit,
    allowMultiple: false,
    supportsEvaluation: true, // 3-phase comprehension assessment
  },

  'detail-drawer': {
    component: () => null, // Managed as modal/drawer, not in flow
    allowMultiple: false,
  },

  'comparison-panel': {
    component: ComparisonPanel,
    allowMultiple: false,
    supportsEvaluation: true,
  },

  'generative-table': {
    component: GenerativeTable,
    sectionTitle: 'Data Analysis',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'sentence-analyzer': {
    component: SentenceAnalyzer,
    allowMultiple: true,
  },

  'graph-board': {
    component: GraphBoard,
    sectionTitle: 'Interactive Graph',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: false, // Standalone component, typically one per exhibit
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'scale-spectrum': {
    component: ScaleSpectrum,
    sectionTitle: 'Spectrum Analysis',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'annotated-example': {
    component: AnnotatedExample,
    sectionTitle: 'Worked Example',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-4xl mx-auto mb-20',
  },

  'nested-hierarchy': {
    component: NestedHierarchy,
    sectionTitle: 'System Structure',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'image-panel': {
    component: ImagePanel,
    sectionTitle: 'Visual Context',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'formula-card': {
    component: FormulaCard,
    sectionTitle: 'Formula Decoder',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  // Math Visualization Primitives
  'bar-model': {
    component: BarModel,
    sectionTitle: 'Bar Model',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'number-line': {
    component: NumberLine,
    sectionTitle: 'Number Line',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'base-ten-blocks': {
    component: BaseTenBlocks,
    sectionTitle: 'Base Ten Blocks',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'fraction-circles': {
    component: FractionCircles,
    sectionTitle: 'Fraction Circles',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'fraction-bar': {
    component: FractionBar,
    sectionTitle: 'Fraction Bar',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'geometric-shape': {
    component: GeometricShape,
    sectionTitle: 'Geometric Shape',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'place-value-chart': {
    component: PlaceValueChart,
    sectionTitle: 'Place Value Chart',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'area-model': {
    component: AreaModel,
    sectionTitle: 'Area Model',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'array-grid': {
    component: ArrayGrid,
    sectionTitle: 'Array / Grid',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'double-number-line': {
    component: DoubleNumberLine,
    sectionTitle: 'Double Number Line',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'percent-bar': {
    component: PercentBar,
    sectionTitle: 'Percent Bar',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'factor-tree': {
    component: FactorTree,
    sectionTitle: 'Factor Tree',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'ratio-table': {
    component: RatioTable,
    sectionTitle: 'Ratio Table',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'tape-diagram': {
    component: TapeDiagram,
    sectionTitle: 'Tape Diagram',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'balance-scale': {
    component: BalanceScale,
    sectionTitle: 'Balance Scale',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'function-machine': {
    component: FunctionMachine,
    sectionTitle: 'Function Machine',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'coordinate-graph': {
    component: CoordinateGraph,
    sectionTitle: 'Coordinate Graph',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'slope-triangle': {
    component: SlopeTriangle,
    sectionTitle: 'Slope Triangle',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'systems-equations-visualizer': {
    component: SystemsEquationsVisualizer,
    sectionTitle: 'Systems of Equations',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'matrix-display': {
    component: MatrixDisplay,
    sectionTitle: 'Matrix Operations',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'dot-plot': {
    component: DotPlot,
    sectionTitle: 'Dot Plot',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'histogram': {
    component: Histogram,
    sectionTitle: 'Histogram',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'two-way-table': {
    component: TwoWayTable,
    sectionTitle: 'Two-Way Table',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  // Deprecated: Use specific math primitives instead
  'math-visual': {
    component: MathVisuals,
    allowMultiple: true,
  },

  'custom-visual': {
    component: CustomVisual,
    allowMultiple: true,
  },

  'knowledge-check': {
    component: KnowledgeCheck,
    sectionTitle: 'Knowledge Assessment',
    showDivider: true,
    dividerStyle: 'center',
    allowMultiple: false,
    containerClassName: 'max-w-4xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'take-home-activity': {
    component: TakeHomeActivity,
    sectionTitle: 'Take Home Activity',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'interactive-passage': {
    component: InteractivePassage,
    sectionTitle: 'Interactive Reading',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'word-builder': {
    component: WordBuilder,
    sectionTitle: 'Word Construction Lab',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'molecule-viewer': {
    component: MoleculeViewer,
    sectionTitle: 'Molecular Structure',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-7xl mx-auto mb-20',
  },

  'periodic-table': {
    component: PeriodicTable,
    sectionTitle: 'Periodic Table of Elements',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: false,
    containerClassName: 'max-w-7xl mx-auto mb-20',
  },

  'species-profile': {
    component: SpeciesProfile,
    sectionTitle: 'Species Profile',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  'media-player': {
    component: MediaPlayer,
    sectionTitle: 'Interactive Lesson',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-7xl mx-auto mb-20',
    supportsEvaluation: true,  // Enable evaluation for knowledge checks
  },

  'flashcard-deck': {
    component: FlashcardDeck,
    sectionTitle: 'Study Flashcards',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
  },

  'image-comparison': {
    component: ImageComparison,
    sectionTitle: 'Visual Transformation',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

  // Engineering Primitives (K-5 STEM)
  'lever-lab': {
    component: LeverLab,
    sectionTitle: 'Lever Lab',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'pulley-system-builder': {
    component: PulleySystemBuilder,
    sectionTitle: 'Pulley System Lab',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'ramp-lab': {
    component: RampLab,
    sectionTitle: 'Ramp Lab',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'wheel-axle-explorer': {
    component: WheelAxleExplorer,
    sectionTitle: 'Wheel & Axle Explorer',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'gear-train-builder': {
    component: GearTrainBuilder,
    sectionTitle: 'Gear Train Builder',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'bridge-builder': {
    component: BridgeBuilder,
    sectionTitle: 'Bridge Builder',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'tower-stacker': {
    component: TowerStacker,
    sectionTitle: 'Tower Stacker',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'shape-strength-tester': {
    component: ShapeStrengthTester,
    sectionTitle: 'Shape Strength Tester',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'foundation-builder': {
    component: FoundationBuilder,
    sectionTitle: 'Foundation Builder',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'excavator-arm-simulator': {
    component: ExcavatorArmSimulator,
    sectionTitle: 'Excavator Arm Simulator',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'dump-truck-loader': {
    component: DumpTruckLoader,
    sectionTitle: 'Dump Truck Loader',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  'construction-sequence-planner': {
    component: ConstructionSequencePlanner,
    sectionTitle: 'Construction Sequence Planner',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,
  },

  // Foundational Concept Teaching
  'foundation-explorer': {
    component: FoundationExplorer,
    sectionTitle: 'Foundational Concepts',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

};

/**
 * Section header component - left-aligned with right divider
 */
export const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-4 mb-8">
    <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">
      {title}
    </span>
    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
  </div>
);

/**
 * Centered section header with dividers on both sides
 */
export const CenteredSectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-4 mb-8">
    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
    <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">
      {title}
    </span>
    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
  </div>
);

/**
 * Register a new primitive component
 * Use this to add custom primitives without modifying the core registry
 */
export function registerPrimitive(id: ComponentId, config: PrimitiveConfig) {
  PRIMITIVE_REGISTRY[id] = config;
}

/**
 * Get primitive configuration by ID
 */
export function getPrimitive(id: ComponentId): PrimitiveConfig | undefined {
  return PRIMITIVE_REGISTRY[id];
}
