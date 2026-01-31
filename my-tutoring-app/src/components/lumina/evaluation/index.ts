/**
 * Lumina Evaluation System
 *
 * Provides standardized evaluation tracking for interactive primitives
 * with automatic prop injection for evaluable primitives.
 *
 * Quick Start:
 * ```tsx
 * import {
 *   EvaluationProvider,
 *   usePrimitiveEvaluation,
 *   type TowerStackerMetrics,
 * } from '@/components/lumina/evaluation';
 *
 * // 1. Wrap your app with EvaluationProvider
 * <EvaluationProvider studentId="123" exhibitId="abc">
 *   <ManifestOrderRenderer orderedComponents={...} />
 * </EvaluationProvider>
 *
 * // 2. Mark primitive as evaluable in registry
 * 'tower-stacker': {
 *   component: TowerStacker,
 *   supportsEvaluation: true,  // ← Add this
 * }
 *
 * // 3. Use the hook in your primitive (props auto-injected)
 * const { submitResult } = usePrimitiveEvaluation<TowerStackerMetrics>({
 *   primitiveType: 'tower-stacker',
 *   instanceId: data.instanceId,  // ← Auto-injected by renderer
 *   skillId: data.skillId,        // ← Auto-injected by renderer
 * });
 * ```
 *
 * For detailed integration guide, see:
 * - INTEGRATION_GUIDE.md - Auto-injection pattern and setup
 * - README.md - Full evaluation system documentation
 */

// Types
export type {
  PrimitiveEvaluationResult,
  PrimitiveMetrics,
  BasePrimitiveMetrics,
  // Engineering metrics
  TowerStackerMetrics,
  BridgeBuilderMetrics,
  LeverLabMetrics,
  PulleySystemMetrics,
  GearTrainMetrics,
  RampLabMetrics,
  ShapeStrengthTesterMetrics,
  FoundationBuilderMetrics,
  ExcavatorArmSimulatorMetrics,
  DumpTruckLoaderMetrics,
  BlueprintCanvasMetrics,
  // Assessment metrics
  MultipleChoiceMetrics,
  FillInBlanksMetrics,
  MatchingActivityMetrics,
  SequencingActivityMetrics,
  CategorizationActivityMetrics,
  TrueFalseMetrics,
  ShortAnswerMetrics,
  ComparisonPanelMetrics,
  FeatureExhibitMetrics,
  // Math metrics
  BalanceScaleMetrics,
  FractionCirclesMetrics,
  FractionBarMetrics,
  AreaModelMetrics,
  NumberLineMetrics,
  DoubleNumberLineMetrics,
  PercentBarMetrics,
  CoordinateGraphMetrics,
  PlaceValueChartMetrics,
  FactorTreeMetrics,
  FormulaCardMetrics,
  ArrayGridMetrics,
  RatioTableMetrics,
  TapeDiagramMetrics,
  // Exploration metrics
  FunctionMachineMetrics,
  // Visual Annotation metrics
  ImagePanelMetrics,
  // Media metrics
  MediaPlayerMetrics,
  // Session types
  SessionEvaluationSummary,
  CompetencyUpdateSuggestion,
  QueuedEvaluation,
  EvaluationStatus,
} from './types';

// Type guards
export {
  isTowerStackerMetrics,
  isBridgeBuilderMetrics,
  isMultipleChoiceMetrics,
} from './types';

// Hook
export {
  usePrimitiveEvaluation,
  type UsePrimitiveEvaluationOptions,
  type UsePrimitiveEvaluationReturn,
} from './hooks/usePrimitiveEvaluation';

// Context
export {
  EvaluationProvider,
  useEvaluationContext,
  useRequiredEvaluationContext,
  type EvaluationContextType,
  type EvaluationProviderProps,
} from './contexts/EvaluationContext';

// API
export {
  submitEvaluationToBackend,
  submitBatchEvaluations,
  submitSessionSummary,
  getEvaluationHistory,
  getEvaluationStats,
  getEvaluationReplay,
  type EvaluationSubmitResponse,
  type BatchEvaluationResponse,
  type SessionSummaryResponse,
} from './api/evaluationApi';
