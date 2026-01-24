/**
 * Lumina Primitive Evaluation System
 *
 * Standardized types for capturing and tracking student performance
 * across all interactive primitives.
 */

import type { ComponentId } from '../types';
import type { PlacedPiece } from '../primitives/visual-primitives/engineering/TowerStacker';

// =============================================================================
// Core Evaluation Result
// =============================================================================

/**
 * Universal evaluation result produced by all interactive primitives.
 * This is the primary data structure sent to the backend for tracking.
 */
export interface PrimitiveEvaluationResult<TMetrics extends PrimitiveMetrics = PrimitiveMetrics> {
  // Identity
  primitiveType: ComponentId;
  instanceId: string;
  attemptId: string;

  // Timing
  startedAt: string;      // ISO timestamp
  completedAt: string;    // ISO timestamp
  durationMs: number;

  // Outcome
  success: boolean;
  score: number;          // Normalized 0-100
  partialCredit?: number; // For multi-objective tasks (0-100)

  // Primitive-specific metrics
  metrics: TMetrics;

  // Learning context
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;

  // Student work artifact (serializable state for replay)
  studentWork?: unknown;
}

// =============================================================================
// Primitive-Specific Metrics (Discriminated Union)
// =============================================================================

/**
 * Base interface for all primitive metrics.
 * Each primitive type extends this with its specific measurements.
 */
export interface BasePrimitiveMetrics {
  type: string;
}

// -----------------------------------------------------------------------------
// Engineering Primitives
// -----------------------------------------------------------------------------

export interface TowerStackerMetrics extends BasePrimitiveMetrics {
  type: 'tower-stacker';

  // Goal achievement
  targetHeight: number;
  achievedHeight: number;
  heightGoalMet: boolean;

  // Stability analysis
  stabilityScore: number;       // 0-100
  windTestPassed: boolean;
  windStrength: number;

  // Efficiency
  piecesUsed: number;
  piecesAvailable: number;
  efficiency: number;           // height / pieces used

  // Engineering concepts demonstrated
  baseWidth: number;
  centerOfGravityOffset: number;

  // Final state for replay
  placedPieces: PlacedPiece[];
}

export interface BridgeBuilderMetrics extends BasePrimitiveMetrics {
  type: 'bridge-builder';

  // Goal achievement
  bridgeConnected: boolean;       // Path exists from left to right anchor
  loadTestPassed: boolean;        // Did the bridge survive the load test

  // Load testing
  loadType: 'car' | 'truck' | 'train' | 'point_load';
  loadWeight: number;             // Applied load (1-100)
  maxStressObserved: number;      // Highest stress on any member (0-100)
  failedMembers: number;          // Number of members that broke

  // Efficiency
  membersUsed: number;            // Total members placed
  membersBudget?: number;         // Budget limit (if applicable)
  budgetEfficiency: number;       // 1 - (membersUsed / budget), or 1 if no budget

  // Structural composition
  beamCount: number;
  cableCount: number;
  supportCount: number;
  jointCount: number;             // Non-anchor joints added

  // Structural analysis
  triangleCount: number;          // Approximation of triangulation (stability indicator)
  averageStress: number;          // Average stress across all members (0-100)
  structuralIntegrity: number;    // 100 - averageStress

  // Final state for replay
  finalJoints: Array<{ id: string; x: number; y: number; isAnchor: boolean }>;
  finalMembers: Array<{ id: string; type: string; startJointId: string; endJointId: string }>;
}

export interface LeverLabMetrics extends BasePrimitiveMetrics {
  type: 'lever-lab';

  // Balance achievement
  isBalanced: boolean;
  balanceError: number;         // How far from balanced (0 = perfect)

  // Problem solving
  targetConfiguration: string;  // e.g., "lift 10N with 5N effort"
  solutionFound: boolean;

  // Efficiency
  attemptsToSolve: number;
  hintsUsed: number;

  // Concept demonstration
  mechanicalAdvantageCalculated: number;
  mechanicalAdvantageTarget: number;
  fulcrumPosition: number;
  effortDistance: number;
  loadDistance: number;
}

export interface PulleySystemMetrics extends BasePrimitiveMetrics {
  type: 'pulley-system';

  // Goal achievement
  targetMechanicalAdvantage: number;
  achievedMechanicalAdvantage: number;
  goalMet: boolean;

  // System configuration
  pulleyCount: number;
  isMovablePulley: boolean;
  ropeConfiguration: string;

  // Efficiency
  idealEffort: number;
  actualEffort: number;
  systemEfficiency: number;
}

export interface GearTrainMetrics extends BasePrimitiveMetrics {
  type: 'gear-train';

  // Goal achievement
  targetGearRatio: number;
  achievedGearRatio: number;
  ratioGoalMet: boolean;

  // Direction
  targetOutputDirection: 'clockwise' | 'counter-clockwise';
  achievedOutputDirection: 'clockwise' | 'counter-clockwise';
  directionCorrect: boolean;

  // Configuration
  gearCount: number;
  gearSizes: number[];

  // Speed/torque tradeoff understanding
  speedMultiplier: number;
  torqueMultiplier: number;
}

export interface RampLabMetrics extends BasePrimitiveMetrics {
  type: 'ramp-lab';

  // Experiment results
  rampAngle: number;
  objectMass: number;
  frictionCoefficient: number;

  // Predictions vs actual
  predictedAcceleration: number;
  actualAcceleration: number;
  predictionAccuracy: number;   // 0-100

  // Concept exploration
  experimentCount: number;
  variablesExplored: string[];  // ['angle', 'mass', 'friction']
}

// -----------------------------------------------------------------------------
// Assessment Primitives (Problem Types)
// -----------------------------------------------------------------------------

export interface MultipleChoiceMetrics extends BasePrimitiveMetrics {
  type: 'multiple-choice';

  isCorrect: boolean;
  selectedOptionId: string;
  correctOptionId: string;
  attemptCount: number;
  timeToFirstAnswer: number;    // ms
  changedAnswer: boolean;
}

export interface FillInBlanksMetrics extends BasePrimitiveMetrics {
  type: 'fill-in-blanks';

  totalBlanks: number;
  correctBlanks: number;
  incorrectBlanks: number;
  accuracy: number;             // correctBlanks / totalBlanks

  // Per-blank details
  blankResults: Array<{
    blankId: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }>;
}

export interface MatchingActivityMetrics extends BasePrimitiveMetrics {
  type: 'matching-activity';

  totalPairs: number;
  correctPairs: number;
  incorrectPairs: number;
  accuracy: number;

  // Matching details
  matchResults: Array<{
    itemId: string;
    selectedMatchId: string;
    correctMatchId: string;
    isCorrect: boolean;
  }>;
}

export interface SequencingActivityMetrics extends BasePrimitiveMetrics {
  type: 'sequencing-activity';

  totalItems: number;
  correctlyPlaced: number;
  sequenceAccuracy: number;     // Percentage of items in correct position

  studentSequence: string[];    // IDs in student's order
  correctSequence: string[];    // IDs in correct order
}

export interface CategorizationActivityMetrics extends BasePrimitiveMetrics {
  type: 'categorization-activity';

  totalItems: number;
  correctlyCategorized: number;
  accuracy: number;

  categoryResults: Array<{
    categoryId: string;
    categoryName: string;
    itemsPlaced: string[];
    correctItems: string[];
    precision: number;          // Correct in category / Total in category
  }>;
}

export interface TrueFalseMetrics extends BasePrimitiveMetrics {
  type: 'true-false';

  isCorrect: boolean;
  selectedAnswer: boolean;
  correctAnswer: boolean;
  confidence?: number;          // If confidence tracking is enabled
}

export interface ShortAnswerMetrics extends BasePrimitiveMetrics {
  type: 'short-answer';

  studentResponse: string;
  wordCount: number;

  // AI evaluation (filled by backend)
  aiScore?: number;
  aiFeedback?: string;
  keyConceptsCovered?: string[];
  misconceptionsIdentified?: string[];
}

// -----------------------------------------------------------------------------
// Math Visualization Primitives
// -----------------------------------------------------------------------------

export interface BalanceScaleMetrics extends BasePrimitiveMetrics {
  type: 'balance-scale';

  targetEquation: string;       // e.g., "2x + 3 = 7"
  solutionFound: boolean;
  solutionValue: number;

  operationsPerformed: Array<{
    operation: 'add' | 'subtract' | 'multiply' | 'divide';
    value: number;
    side: 'left' | 'right' | 'both';
  }>;

  stepsToSolve: number;
  optimalSteps: number;
  efficiency: number;           // optimalSteps / stepsToSolve
}

export interface FractionCirclesMetrics extends BasePrimitiveMetrics {
  type: 'fraction-circles';

  targetFraction: string;       // e.g., "3/4"
  selectedFraction: string;
  isCorrect: boolean;

  // Equivalence understanding
  equivalentFormsExplored: string[];
  understoodEquivalence: boolean;
}

export interface NumberLineMetrics extends BasePrimitiveMetrics {
  type: 'number-line';

  targetValue: number;
  placedValue: number;
  error: number;                // Absolute difference
  accuracy: number;             // 0-100 based on proximity

  // Scale understanding
  scaleMin: number;
  scaleMax: number;
  scaleType: 'integer' | 'decimal' | 'fraction';
}

export interface CoordinateGraphMetrics extends BasePrimitiveMetrics {
  type: 'coordinate-graph';

  taskType: 'plot-point' | 'draw-line' | 'identify-slope' | 'find-intercept';
  isCorrect: boolean;

  // Point plotting
  targetPoints?: Array<{ x: number; y: number }>;
  placedPoints?: Array<{ x: number; y: number }>;

  // Line analysis
  targetSlope?: number;
  identifiedSlope?: number;
  targetIntercept?: number;
  identifiedIntercept?: number;
}

// -----------------------------------------------------------------------------
// Exploration Primitives
// -----------------------------------------------------------------------------

export interface FunctionMachineMetrics extends BasePrimitiveMetrics {
  type: 'function-machine';

  functionRule: string;         // e.g., "2x + 1"
  ruleDiscovered: boolean;

  inputsExplored: number[];
  outputsObserved: number[];

  attemptsToDiscover: number;
  hintsUsed: number;
}

// =============================================================================
// Discriminated Union of All Metrics
// =============================================================================

export type PrimitiveMetrics =
  // Engineering
  | TowerStackerMetrics
  | BridgeBuilderMetrics
  | LeverLabMetrics
  | PulleySystemMetrics
  | GearTrainMetrics
  | RampLabMetrics
  // Assessment
  | MultipleChoiceMetrics
  | FillInBlanksMetrics
  | MatchingActivityMetrics
  | SequencingActivityMetrics
  | CategorizationActivityMetrics
  | TrueFalseMetrics
  | ShortAnswerMetrics
  // Math
  | BalanceScaleMetrics
  | FractionCirclesMetrics
  | NumberLineMetrics
  | CoordinateGraphMetrics
  // Exploration
  | FunctionMachineMetrics;

// =============================================================================
// Session & Summary Types
// =============================================================================

/**
 * Summary of all evaluations within a session (e.g., an exhibit).
 */
export interface SessionEvaluationSummary {
  sessionId: string;
  exhibitId?: string;
  studentId?: string;

  // Timing
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;

  // Aggregate scores
  totalAttempts: number;
  successfulAttempts: number;
  averageScore: number;

  // By primitive type
  byPrimitiveType: Record<string, {
    attempts: number;
    successes: number;
    averageScore: number;
  }>;

  // By skill
  bySkill: Record<string, {
    attempts: number;
    successes: number;
    averageScore: number;
  }>;

  // Individual results
  evaluations: PrimitiveEvaluationResult[];
}

/**
 * Competency update suggestion based on evaluation results.
 */
export interface CompetencyUpdateSuggestion {
  skillId: string;
  subskillId?: string;

  currentScore: number;
  suggestedScore: number;
  scoreDelta: number;

  basedOnAttempts: number;
  successRate: number;
  averageScore: number;

  confidence: 'low' | 'medium' | 'high';
}

// =============================================================================
// Evaluation State Management
// =============================================================================

export type EvaluationStatus = 'pending' | 'submitting' | 'submitted' | 'failed';

export interface QueuedEvaluation {
  result: PrimitiveEvaluationResult;
  status: EvaluationStatus;
  retryCount: number;
  lastError?: string;
  queuedAt: string;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isTowerStackerMetrics(metrics: PrimitiveMetrics): metrics is TowerStackerMetrics {
  return metrics.type === 'tower-stacker';
}

export function isBridgeBuilderMetrics(metrics: PrimitiveMetrics): metrics is BridgeBuilderMetrics {
  return metrics.type === 'bridge-builder';
}

export function isMultipleChoiceMetrics(metrics: PrimitiveMetrics): metrics is MultipleChoiceMetrics {
  return metrics.type === 'multiple-choice';
}

// Add more type guards as needed...
