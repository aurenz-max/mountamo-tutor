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

export interface ComparisonPanelMetrics extends BasePrimitiveMetrics {
  type: 'comparison-panel';

  // Content exploration
  item1Explored: boolean;           // Did student click on item 1
  item2Explored: boolean;           // Did student click on item 2
  bothItemsExplored: boolean;       // Required to unlock first gate

  // Gate performance
  totalGates: number;               // Number of comprehension gates
  gatesCompleted: number;           // Gates successfully passed
  gateAttempts: number;             // Total attempts across all gates

  // Per-gate results
  gateResults: Array<{
    gateIndex: number;              // 0-based index
    question: string;               // The gate question
    correctAnswer: boolean;         // What the correct answer was
    studentAnswer: boolean;         // What student answered
    isCorrect: boolean;             // Did they get it right
    attemptNumber: number;          // Which attempt for this gate (1-based)
    timeToAnswer: number;           // ms from gate appearance to submission
  }>;

  // Comprehension quality
  firstAttemptSuccessRate: number;  // Percentage of gates passed on first try (0-100)
  overallAccuracy: number;          // Percentage of correct answers (0-100)

  // Content engagement
  timeSpentExploring: number;       // ms spent before first gate attempt
  sectionsRevealed: number;         // How many sections unlocked (max = totalGates + 1)
}

export interface FeatureExhibitMetrics extends BasePrimitiveMetrics {
  type: 'feature-exhibit';

  // Overall completion
  allPhasesCompleted: boolean;      // Did student complete all three phases
  finalSuccess: boolean;            // Did they successfully complete Phase 3

  // Phase completion tracking
  explorePhaseCompleted: boolean;   // Phase 1: True/False completed
  practicePhaseCompleted: boolean;  // Phase 2: Evidence matching completed
  applyPhaseCompleted: boolean;     // Phase 3: Synthesis question completed

  // Phase 1: Explore (True/False) performance
  exploreQuestion: string;          // The true/false statement
  exploreCorrectAnswer: boolean;    // Correct answer
  exploreStudentAnswer: boolean | null; // Student's answer
  exploreIsCorrect: boolean;        // Did they get it right
  exploreAttempts: number;          // Number of attempts (should be 1 with no retry)

  // Phase 2: Practice (Evidence Matching) performance
  totalClaims: number;              // Number of claims to match (typically 2-3)
  correctMatches: number;           // Number of correct matches made
  evidenceMatchingAccuracy: number; // 0-100: correctMatches / totalClaims
  matchAttempts: number;            // Number of times they submitted matches

  // Per-claim matching results
  claimMatchResults: Array<{
    claimIndex: number;
    claimText: string;
    correctSectionIndex: number;
    studentSectionIndex: number | null;
    isCorrect: boolean;
  }>;

  // Phase 3: Apply (Multiple Choice Synthesis) performance
  synthesisQuestion: string;        // The synthesis question asked
  synthesisCorrectOptionId: string; // ID of correct answer
  synthesisStudentOptionId: string | null; // Student's selected option
  synthesisIsCorrect: boolean;      // Did they get it right
  synthesisAttempts: number;        // Number of attempts (should be 1)
  timeToAnswerSynthesis: number;    // ms from question display to answer

  // Overall performance metrics
  totalAttempts: number;            // Sum of attempts across all phases
  overallAccuracy: number;          // 0-100: weighted average of phase performance
  comprehensionScore: number;       // 0-100: quality of understanding demonstrated

  // Engagement metrics
  totalTimeSpent: number;           // ms spent on entire exhibit
  sectionsRead: number;             // Number of sections navigated through
  relatedTermsExplored: number;     // Number of related term buttons clicked

  // Reading behavior
  pagesNavigated: number;           // Total page turns in the exhibit
  timePerSection: number[];         // ms spent on each section page

  // Efficiency
  completedWithoutErrors: boolean;  // True if all phases correct on first try
  phaseProgressionSmooth: boolean;  // True if completed phases in order without reset
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

export interface DoubleNumberLineMetrics extends BasePrimitiveMetrics {
  type: 'double-number-line';

  // Goal achievement
  totalTargetPoints: number;      // Number of points student must find
  correctPoints: number;          // Number of points student got right
  allPointsCorrect: boolean;      // All target points found correctly

  // Proportional reasoning
  unitRateIdentified: boolean;    // Did they find the unit rate (top=1)?
  correctRatio: string;           // The ratio relationship (e.g., "1:4")

  // Per-point accuracy
  pointResults: Array<{
    index: number;
    targetTop: number;
    targetBottom: number;
    studentTop: number | null;
    studentBottom: number | null;
    topCorrect: boolean;
    bottomCorrect: boolean;
    bothCorrect: boolean;
  }>;

  // Problem-solving approach
  attemptsCount: number;          // Total value entries made
  hintsUsed: number;              // Number of hints requested
  usedGivenPoints: boolean;       // Whether they used hint points to solve

  // Accuracy metrics
  topValueAccuracy: number;       // 0-100: correct top values / total points
  bottomValueAccuracy: number;    // 0-100: correct bottom values / total points
  overallAccuracy: number;        // 0-100: both correct / total points
}

export interface PercentBarMetrics extends BasePrimitiveMetrics {
  type: 'percent-bar';

  // Goal achievement
  allPhasesCompleted: boolean;      // Did student complete all three phases
  finalSuccess: boolean;            // Did they successfully complete the main problem

  // Phase completion
  explorePhaseCompleted: boolean;   // Phase 1: Discovery completed
  practicePhaseCompleted: boolean;  // Phase 2: Practice completed
  applyPhaseCompleted: boolean;     // Phase 3: Main problem completed

  // Per-phase performance
  exploreAccuracy: number;          // 0-100: How close to target in explore phase
  exploreAttempts: number;          // Number of tries in explore phase
  exploreHintsUsed: number;         // Hints requested in explore

  practiceQuestionsCorrect: number; // Number of practice questions answered correctly
  practiceTotalQuestions: number;   // Total practice questions
  practiceAttempts: number;         // Total attempts across all practice questions
  practiceHintsUsed: number;        // Hints requested in practice

  mainProblemAccuracy: number;      // 0-100: How close to target in main problem
  mainProblemAttempts: number;      // Number of tries on main problem
  mainProblemHintsUsed: number;     // Hints requested on main problem

  // Overall performance
  totalAttempts: number;            // Total attempts across all phases
  totalHintsUsed: number;           // Total hints requested
  averageAccuracy: number;          // 0-100: Average accuracy across all attempts

  // Precision analysis
  targetPercent: number;            // The final target percentage
  finalStudentPercent: number;      // Student's final answer
  percentageError: number;          // Absolute difference from target

  // Efficiency
  solvedWithoutHints: boolean;      // Completed without using any hints
  firstAttemptSuccess: boolean;     // Got main problem right on first try
}

export interface FractionBarMetrics extends BasePrimitiveMetrics {
  type: 'fraction-bar';

  // Goal achievement
  targetFraction: string;        // e.g., "3/4" (from task description if applicable)
  selectedFraction: string;      // e.g., "6/8" (what student built)
  isCorrect: boolean;           // Matches target if provided

  // Fraction understanding
  numerator: number;            // Shaded parts
  denominator: number;          // Total partitions
  decimalValue: number;         // Student's fraction as decimal

  // Equivalence understanding
  simplifiedFraction: string;   // e.g., "3/4" if student made "6/8"
  recognizedEquivalence: boolean; // Did they create an equivalent fraction?

  // Interaction patterns
  partitionChanges: number;     // How many times they changed denominator
  shadingChanges: number;       // How many times they adjusted shading
  finalBarStates: Array<{       // State of each bar at submission
    partitions: number;
    shaded: number;
  }>;

  // Comparison tasks (if multiple bars)
  barsCompared: number;
  correctComparison?: boolean;  // If comparing fractions (e.g., which is larger)
}

export interface AreaModelMetrics extends BasePrimitiveMetrics {
  type: 'area-model';

  // Goal achievement
  targetProduct: number;
  studentProduct: number;
  correctFinalAnswer: boolean;

  // Partial products understanding
  totalPartialProducts: number;
  correctPartialProducts: number;
  incorrectPartialProducts: number;
  skippedPartialProducts: number;

  // Step 2: Addition verification
  attemptedSum: boolean;
  correctSum: boolean;

  // Accuracy
  partialProductAccuracy: number;  // 0-100 (correct partials / total partials)
  overallAccuracy: number;         // 0-100 (weighted: 70% partials, 30% sum)

  // Problem-solving approach
  completedInOrder: boolean;       // Did they do cells in sequence?
  attemptsPerCell: number;         // Average attempts per cell
  totalAttempts: number;

  // For algebraic mode
  isAlgebraic: boolean;
  usedDistributiveProperty: boolean;
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

export interface PlaceValueChartMetrics extends BasePrimitiveMetrics {
  type: 'place-value-chart';

  // Goal achievement
  targetValue?: number;         // Target number if specified in task
  finalValue: number;           // Number student created
  isCorrect: boolean;           // Matches target if provided

  // Place value understanding
  placeRange: {
    minPlace: number;           // Smallest place value used (e.g., -2 for hundredths)
    maxPlace: number;           // Largest place value used (e.g., 3 for thousands)
  };
  usesDecimals: boolean;        // Whether student worked with decimal places
  usesLargeNumbers: boolean;    // Whether number is >= 1000

  // Digit composition
  totalDigitsEntered: number;   // Count of non-zero digits
  digitsByPlace: { [place: number]: string }; // Final state of all digits

  // Expanded form accuracy (if shown)
  expandedFormCorrect: boolean; // Whether expanded form matches digits
  expandedFormParts: string[];  // Array of parts like ["400", "20", "5"]

  // Interaction patterns
  digitChanges: number;         // How many times digits were modified
  placeValueAccuracy: number;   // 0-100 score based on understanding shown
}

export interface FactorTreeMetrics extends BasePrimitiveMetrics {
  type: 'factor-tree';

  // Goal achievement
  targetNumber: number;           // The rootValue being factored
  factorizationComplete: boolean; // All leaves are prime
  finalFactorization: string;     // e.g., "2^3 × 3"

  // Correctness
  allFactorsValid: boolean;       // Every split was mathematically correct
  invalidSplitAttempts: number;   // Number of incorrect factor pairs entered

  // Prime factorization understanding
  totalPrimeFactors: number;      // Count of prime leaves (e.g., 4 for 2×2×2×3)
  uniquePrimes: number[];         // Distinct primes found (e.g., [2, 3])
  factorDistribution: Record<number, number>; // e.g., {2: 3, 3: 1} for 2^3 × 3

  // Strategy and approach
  totalSplits: number;            // Number of nodes split
  optimalSplits: number;          // Minimum splits needed
  efficiency: number;             // optimalSplits / totalSplits (1.0 = perfect)
  usedLargestFactorFirst: boolean; // Good strategy indicator

  // Interaction patterns
  hintsUsed: number;              // How many suggested factor pairs clicked
  manualInputs: number;           // How many times typed factors manually
  resetCount: number;             // Times tree was reset

  // Final tree state for replay
  treeDepth: number;              // Maximum depth of the tree
}

export interface FormulaCardMetrics extends BasePrimitiveMetrics {
  type: 'formula-card';

  // Content exploration
  parametersExplored: number;         // How many parameter cards clicked
  totalParameters: number;
  relationshipsViewed: boolean;       // Scrolled to relationships section
  examplesViewed: boolean;            // Scrolled to examples section

  // Gate performance
  totalGates: number;                 // Number of comprehension gates (2-3)
  gatesCompleted: number;             // Gates successfully passed
  gateAttempts: number;               // Total attempts across all gates

  // Per-gate results
  gateResults: Array<{
    gateIndex: number;                // 0-based index
    question: string;                 // The gate question
    questionType: 'parameter-unit' | 'relationship' | 'application' | 'example';
    correctAnswer: string;            // Correct answer text
    studentAnswer: string;            // Student's answer text
    isCorrect: boolean;               // Did they get it right
    attemptNumber: number;            // Which attempt for this gate (1-based)
    timeToAnswer: number;             // ms from gate appearance to submission
  }>;

  // Comprehension quality
  firstAttemptSuccessRate: number;    // Percentage of gates passed on first try (0-100)
  overallAccuracy: number;            // Percentage of correct answers (0-100)

  // Content engagement
  timeSpentExploring: number;         // ms spent before first gate attempt
  formulaTitle: string;               // For analytics
}

export interface ArrayGridMetrics extends BasePrimitiveMetrics {
  type: 'array-grid';

  // Goal achievement
  taskType: 'build' | 'partition' | 'skip-count' | 'explore';
  goalMet: boolean;

  // Array configuration
  finalRows: number;
  finalColumns: number;
  totalItems: number;

  // Build task metrics
  targetProduct?: number;
  productCorrect?: boolean;
  dimensionsCorrect?: boolean;      // Exact rows/cols match target
  commuteRecognized?: boolean;      // Built 4×3 when asked for 3×4 (still correct!)

  // Partition task metrics
  partitionsPlaced?: number;
  correctPartitions?: number;
  partitionAccuracy?: number;       // 0-100

  // Skip count metrics
  skipCountSequence?: number[];     // Numbers entered by student
  skipCountCorrect?: boolean;

  // Interaction tracking
  rowChanges: number;               // How many times they adjusted rows
  columnChanges: number;            // How many times they adjusted columns
  cellClicks: number;               // Exploration engagement
  partitionAttempts?: number;       // For partition tasks

  // Final state for replay
  finalConfiguration: {
    rows: number;
    columns: number;
    partitionLines: Array<{ type: 'row' | 'column'; index: number }>;
    highlightedCells: string[];     // Cell keys that were highlighted
  };
}

export interface RatioTableMetrics extends BasePrimitiveMetrics {
  type: 'ratio-table';

  // Goal achievement
  taskType: 'missing-value' | 'find-multiplier' | 'build-ratio' | 'unit-rate-challenge' | 'explore';
  goalMet: boolean;

  // Base ratio information
  baseRatio: [number, number];      // The reference ratio [qty1, qty2]
  unitRate: number;                 // qty2 / qty1

  // Missing-value task metrics
  targetMultiplier?: number;        // The multiplier for the hidden value
  targetValue?: number;             // The specific hidden value student should find
  studentAnswer?: number;           // What student entered
  answerCorrect?: boolean;          // Did they get it right
  answerPrecision?: number;         // How close they were (0-100)

  // Find-multiplier task metrics
  selectedMultiplier?: number;      // Multiplier student chose
  multiplierCorrect?: boolean;      // Matches target multiplier

  // Build-ratio task metrics
  finalScaledRatio?: [number, number]; // The ratio they built
  ratioCorrect?: boolean;           // Matches target

  // Performance tracking
  attempts: number;                 // Total attempts before success
  hintsRequested: number;           // How many hints student asked for

  // Strategy indicators
  sliderAdjustments: number;        // Times they moved the multiplier slider
  explorationRange?: [number, number]; // [min, max] multipliers explored
  usedCalculation?: boolean;        // Evidence they calculated vs trial-and-error
  strategyUsed?: 'calculation' | 'trial-and-error' | 'pattern-recognition' | 'unknown';

  // Final state for replay
  finalMultiplier: number;          // Where slider ended up
  finalScaledValues: [number, number]; // Final scaled quantities
}

export interface TapeDiagramMetrics extends BasePrimitiveMetrics {
  type: 'tape-diagram';

  // Goal achievement
  allPhasesCompleted: boolean;        // Did student complete all three phases
  finalSuccess: boolean;              // Did they solve all unknowns correctly

  // Phase completion tracking
  explorePhaseCompleted: boolean;     // Phase 1: Identified the whole correctly
  practicePhaseCompleted: boolean;    // Phase 2: Solved practice unknowns
  applyPhaseCompleted: boolean;       // Phase 3: Solved all remaining unknowns

  // Phase 1: Explore (Understanding the Whole)
  wholeCorrectlyIdentified: boolean;  // Did they calculate the total correctly
  exploreAttempts: number;            // Number of tries to find the whole
  exploreHintsUsed: number;           // Hints requested in explore phase

  // Phase 2: Practice (Guided Unknown Solving)
  practiceUnknownsTotal: number;      // Number of unknowns in practice phase (1-2)
  practiceUnknownsCorrect: number;    // How many they got right
  practiceAccuracy: number;           // 0-100: practiceCorrect / practiceTotal
  practiceAttempts: number;           // Total attempts in practice phase
  practiceHintsUsed: number;          // Hints requested in practice

  // Phase 3: Apply (Full Problem)
  totalUnknownSegments: number;       // Total unknowns across all bars
  correctUnknownSegments: number;     // How many unknowns solved correctly
  accuracyPercentage: number;         // 0-100: correct / total unknowns
  applyAttempts: number;              // Attempts in final phase
  applyHintsUsed: number;             // Hints in final phase

  // Overall performance
  totalAttempts: number;              // Total attempts across all phases
  totalHintsUsed: number;             // Total hints requested
  firstAttemptSuccess: boolean;       // Got all unknowns right on first submission

  // Problem-solving strategy
  solvedInSequence: boolean;          // Did they solve unknowns in order presented
  usedPartWholeStrategy: boolean;     // Evidence of whole - parts = unknown thinking
  segmentRelationships: Array<{       // Per-segment tracking
    barIndex: number;
    segmentIndex: number;
    segmentLabel: string;
    expectedValue: number;
    studentValue: number | null;
    correctOnFirstTry: boolean;
    attempts: number;
  }>;

  // Efficiency
  solvedWithoutHints: boolean;        // Completed without using any hints
  averageAttemptsPerUnknown: number;  // Total attempts / total unknowns
}

// -----------------------------------------------------------------------------
// Visual Annotation Primitives
// -----------------------------------------------------------------------------

export interface ImagePanelMetrics extends BasePrimitiveMetrics {
  type: 'image-panel';

  // Goal achievement
  allAnnotationsPlaced: boolean;       // Did student place all annotations
  finalSuccess: boolean;               // All annotations correctly placed

  // Annotation accuracy
  totalAnnotations: number;
  correctAnnotations: number;
  incorrectAnnotations: number;
  unplacedAnnotations: number;
  annotationAccuracy: number;          // 0-100

  // Per-annotation detailed results
  annotationResults: Array<{
    annotationId: string;
    label: string;
    isKey: boolean;
    expectedRegion?: string;
    studentPosition: { x: number; y: number } | null;
    placementCorrect: boolean;
    proximityScore: number;            // 0-100
  }>;

  // Overall performance
  averageProximityScore: number;

  // LLM evaluation metadata
  llmEvaluationUsed: boolean;
  llmConfidence?: number;
  llmFeedback?: string;
}

// -----------------------------------------------------------------------------
// Media Primitives
// -----------------------------------------------------------------------------

export interface MediaPlayerMetrics extends BasePrimitiveMetrics {
  type: 'media-player';

  // Overall completion
  totalSegments: number;
  segmentsCompleted: number;        // How many segments watched AND answered
  allSegmentsCompleted: boolean;

  // Knowledge check performance
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  knowledgeCheckAccuracy: number;   // 0-100

  // Per-segment detailed results
  segmentResults: Array<{
    segmentIndex: number;
    segmentTitle: string;
    audioPlayed: boolean;           // Did student listen to audio?
    questionAnswered: boolean;
    question: string;
    correctAnswer: string;
    studentAnswer: string | null;
    isCorrect: boolean;
    attempts: number;               // How many tries (1-3)
    maxAttemptsReached: boolean;    // Hit 3 attempts without correct answer
    skippedAfterMaxAttempts: boolean; // Clicked skip after seeing answer
    timeToAnswer?: number;          // ms from segment start to final answer/skip
  }>;

  // Engagement metrics
  totalAttempts: number;            // Sum of all question attempts
  firstAttemptSuccessRate: number;  // % answered correctly on first try
  averageAttemptsPerQuestion: number;

  // Learning quality indicators
  passedWithoutErrors: boolean;     // True if all first-attempt correct
  skippedSegments: number;          // Number of segments skipped after max attempts
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
  | ComparisonPanelMetrics
  | FeatureExhibitMetrics
  // Math
  | BalanceScaleMetrics
  | FractionCirclesMetrics
  | FractionBarMetrics
  | AreaModelMetrics
  | NumberLineMetrics
  | DoubleNumberLineMetrics
  | PercentBarMetrics
  | CoordinateGraphMetrics
  | PlaceValueChartMetrics
  | FactorTreeMetrics
  | FormulaCardMetrics
  | ArrayGridMetrics
  | RatioTableMetrics
  | TapeDiagramMetrics
  // Exploration
  | FunctionMachineMetrics
  // Visual Annotation
  | ImagePanelMetrics
  // Media
  | MediaPlayerMetrics;

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
