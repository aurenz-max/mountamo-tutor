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
import ScaleSpectrum from '../primitives/ScaleSpectrum';
import AnnotatedExample from '../primitives/AnnotatedExample';
import NestedHierarchy from '../primitives/NestedHierarchy';
import ImagePanel from '../primitives/ImagePanel';
import TakeHomeActivity from '../primitives/TakeHomeActivity';
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
  },

  'detail-drawer': {
    component: () => null, // Managed as modal/drawer, not in flow
    allowMultiple: false,
  },

  'comparison-panel': {
    component: ComparisonPanel,
    allowMultiple: false,
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
  },

  'formula-card': {
    component: FormulaCard,
    sectionTitle: 'Formula Decoder',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
  },

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
  },

  'take-home-activity': {
    component: TakeHomeActivity,
    sectionTitle: 'Take Home Activity',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-5xl mx-auto mb-20',
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
