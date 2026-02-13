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

  // AI assistance metadata (optional - only present if AI was enabled)
  aiAssistance?: {
    enabled: boolean;
    hintsUsed: {
      level1: number;
      level2: number;
      level3: number;
    };
    totalInteractions: number;      // Total messages exchanged (hints + questions)
    conversationTurns: number;       // Back-and-forth exchanges
    voiceInteractions: number;       // Voice-only interactions
    timeWithAI: number;              // Total milliseconds interacting with AI
  };
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

export interface ShapeStrengthTesterMetrics extends BasePrimitiveMetrics {
  type: 'shape-strength-tester';

  // Discovery achievement
  shapesTested: number;         // Unique shapes tested
  totalTests: number;           // Total test runs
  triangleDiscovered: boolean;  // Did student discover triangles are strong?
  bracingUsed: boolean;         // Did student add diagonal bracing?

  // Load testing
  maxLoadAchieved: number;      // Highest load achieved across all tests

  // Challenge completion
  targetShapeMet: boolean;      // If target shape specified, was it tested?
  targetLoadMet: boolean;       // If target load specified, was it achieved?

  // Test history for analysis
  testResults: Array<{
    shapeType: string;
    load: number;
    deformation: number;
    survived: boolean;
    withBracing: boolean;
  }>;
}

export interface FoundationBuilderMetrics extends BasePrimitiveMetrics {
  type: 'foundation-builder';

  // Soil and loading
  soilType: string;             // Soil type tested (rock, gravel, sand, clay, mud)
  buildingLoad: number;         // Building weight in kN
  soilCapacity: number;         // Bearing capacity of soil (kN/m²)

  // Foundation design
  footingArea: number;          // Footing area designed (m²)
  pressure: number;             // Calculated pressure (kN/m²)
  foundationType: string;       // Foundation type used (spread, strip, slab, piles)

  // Test results
  foundationPassed: boolean;    // Did foundation support the building?
  settlementAmount: number;     // Settlement observed (0 if passed, >0 if failed)
  safetyFactor: number;         // Ratio of capacity to actual pressure (>1 is good)

  // Design process
  designsAttempted: number;     // Number of designs tested
  successfulDesigns: number;    // Number of designs that passed

  // Challenge completion
  targetHeightMet: boolean;     // If target height specified, was it achieved?
  targetAreaMet: boolean;       // If target area specified, was it achieved?
  efficiency: number;           // How close to optimal area (0 = perfect, higher = less efficient)
}

export interface ExcavatorArmSimulatorMetrics extends BasePrimitiveMetrics {
  type: 'excavator-arm-simulator';

  // Goal achievement
  targetAmount: number;         // Target amount of material to excavate
  excavatedAmount: number;      // Actual amount excavated
  goalMet: boolean;             // Did student meet the excavation goal?

  // Efficiency
  digOperations: number;        // Number of dig operations performed
  dumpOperations: number;       // Number of dump operations performed
  efficiency: number;           // Excavated amount per dig operation

  // Control mastery
  boomAngleRange: number;       // Range of boom angles available
  stickAngleRange: number;      // Range of stick angles available
  bucketAngleRange: number;     // Range of bucket angles available

  // Final state
  finalBoomAngle: number;       // Final boom angle in degrees
  finalStickAngle: number;      // Final stick angle in degrees
  finalBucketAngle: number;     // Final bucket angle in degrees
}

export interface DumpTruckLoaderMetrics extends BasePrimitiveMetrics {
  type: 'dump-truck-loader';

  // Goal achievement
  targetLoads: number;          // Target number of loads to complete
  loadsCompleted: number;       // Actual loads completed
  totalMaterialMoved: number;   // Total material transported
  sourceSize: number;           // Total material available to move
  goalMet: boolean;             // Did student complete the challenge?

  // Capacity management
  truckCapacity: number;        // Maximum weight capacity
  bedVolume: number;            // Maximum volume capacity
  materialType: string;         // Type of material ('dirt', 'gravel', 'sand', 'debris')
  averageLoadSize: number;      // Average material per load

  // Efficiency
  efficiency: number;           // Material moved per operation
  overloadAttempts: number;     // Number of times student tried to overload
  operationCount: number;       // Total loading operations

  // Time
  timeElapsed: number;          // Time taken in seconds
}

export interface BlueprintCanvasMetrics extends BasePrimitiveMetrics {
  type: 'blueprint-canvas';

  // Drawing information
  viewType: 'plan' | 'elevation' | 'section';
  gridSize: [number, number];

  // Goal achievement
  roomsDrawn: number;
  targetRoomCount: number;
  targetMet: boolean;

  // Process metrics
  timeSpent: number;                // Total time spent drawing (ms)
  measurementsAdded: boolean;       // Whether measurements were shown
  gridUsed: boolean;                // Whether snap-to-grid was enabled

  // Quality
  completionScore: number;          // 0-100 based on target achievement
}

export interface ConstructionSequencePlannerMetrics extends BasePrimitiveMetrics {
  type: 'construction-sequence-planner';

  // Overall completion
  allPhasesCompleted: boolean;       // Did student complete all three phases
  finalSuccess: boolean;             // Did they correctly sequence all tasks

  // Phase completion tracking
  explorePhaseCompleted: boolean;    // Phase 1: Identified first task
  practicePhaseCompleted: boolean;   // Phase 2: Ordered initial sequence
  applyPhaseCompleted: boolean;      // Phase 3: Completed full sequence

  // Phase 1: Explore (Identify First Task)
  firstTaskQuestion: string;         // The question asked
  correctFirstTask: string;          // Correct first task
  studentFirstTask: string | null;   // Student's selection
  firstTaskCorrect: boolean;         // Did they identify it correctly
  exploreAttempts: number;           // Number of attempts in explore phase

  // Phase 2: Practice (Order 3-4 tasks with dependencies)
  practiceTasks: number;             // Number of tasks in practice sequence
  practiceSequenceCorrect: boolean;  // Was the practice sequence valid
  dependencyViolations: number;      // Number of dependency errors in practice
  practiceAttempts: number;          // Attempts in practice phase

  // Phase 3: Apply (Full Task Sequencing)
  totalTasks: number;                // Total construction tasks to sequence
  correctlyOrderedTasks: number;     // Tasks in valid positions
  sequenceAccuracy: number;          // 0-100: correctly ordered / total
  totalDependencyViolations: number; // Dependency rules violated
  criticalPathIdentified: boolean;   // For grades 3-5: Did they find critical path

  // Sequencing approach
  usedDependencyArrows: boolean;     // Did they draw dependency connections
  parallelTasksIdentified: number;   // Tasks recognized as parallelizable
  sequentialTasksCorrect: number;    // Sequential dependencies handled correctly

  // Interaction tracking
  totalAttempts: number;             // Total submission attempts
  tasksRearranged: number;           // Number of times tasks were reordered
  animationUsed: boolean;            // Did they run the sequence animation

  // Final sequence for replay
  studentSequence: string[];         // Task IDs in student's final order
  correctSequence: string[];         // Task IDs in a valid correct order
  dependenciesDrawn: Array<{         // Dependencies student identified
    fromTask: string;
    toTask: string;
  }>;

  // Efficiency
  solvedOnFirstTry: boolean;         // Got sequence right first time
  hintsUsed: number;                 // Number of hints requested
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

// -----------------------------------------------------------------------------
// Biology Primitives
// -----------------------------------------------------------------------------

export interface ClassificationSorterMetrics extends BasePrimitiveMetrics {
  type: 'classification-sorter';

  // Classification task
  sortingRule: string;                // The classification principle being applied

  // Overall performance
  totalItems: number;
  totalCorrectFirstAttempt: number;   // Items sorted correctly on first try
  totalCorrect: number;                // Total items sorted correctly (any attempt)
  allCorrect: boolean;

  // Detailed attempt tracking
  attempts: Array<{
    itemId: string;
    placedCategoryId: string;
    correctCategoryId: string;
    isCorrect: boolean;
    attemptNumber: number;
    timeMs: number;                   // Time when placed (ms since start)
  }>;

  // Category-level analysis
  categoryAccuracy: Record<string, number>; // categoryId -> accuracy percentage
}

export interface LifeCycleSequencerMetrics extends BasePrimitiveMetrics {
  type: 'life-cycle-sequencer';

  // Cycle information
  cycleType: 'linear' | 'circular';   // Type of sequence (developmental vs repeating)

  // Overall performance
  totalStages: number;
  totalCorrectFirstAttempt: number;   // Stages placed correctly on first check
  completionTimeMs: number;
  allStagesCorrect: boolean;

  // Detailed attempt tracking
  stageAttempts: Array<{
    stageId: string;
    placedPosition: number;           // Where student placed it (0-indexed)
    correctPosition: number;          // Correct position (0-indexed)
    isCorrect: boolean;
  }>;

  // Learning progression
  attemptsBeforeSuccess: number;      // How many times student checked before getting all correct
}

// -----------------------------------------------------------------------------
// Astronomy Primitives
// -----------------------------------------------------------------------------

export interface ScaleComparatorMetrics extends BasePrimitiveMetrics {
  type: 'scale-comparator';

  // Exploration tracking
  comparisonsViewed: number;      // How many object pairs compared
  objectsExplored: number;        // Number of unique objects viewed
  modesUsed: string[];            // ['comparison', 'scale-model', 'walk']

  // Feature usage
  scaleModelBuilt: boolean;       // Did they use the scale model builder
  walkModeUsed: boolean;          // Did they explore walk-through mode
  referenceObjectsToggled: number; // Number of times reference objects shown/hidden

  // Engagement
  timeSpent: number;              // Total seconds in primitive
  zoomInteractions: number;       // How many times they zoomed in/out
}

export interface DayNightSeasonsMetrics extends BasePrimitiveMetrics {
  type: 'day-night-seasons';

  // Learning focus
  focusMode: 'day-night' | 'seasons' | 'both';

  // Understanding assessment
  questionsAnswered: number;      // Number of questions attempted
  totalQuestions: number;         // Total questions available
  understandingScore: number;     // Percentage score on questions (0-100)

  // Exploration tracking
  locationsExplored: number;      // Number of different latitude locations viewed
  animationsViewed: boolean;      // Did they watch rotation/orbit animations

  // Concept mastery
  conceptsMastered: boolean;      // Did they demonstrate understanding of key concepts
}

export interface MoonPhasesLabMetrics extends BasePrimitiveMetrics {
  type: 'moon-phases-lab';

  // Exploration tracking
  phasesExplored: number;         // Number of unique phases viewed (0-8)
  totalPhases: number;            // Total phases (8)

  // Challenge completion (if applicable)
  challengeCompleted: boolean;    // Did they find the target phase

  // Engagement
  animationWatched: boolean;      // Did they watch the lunar cycle animation
  viewModesUsed: string[];        // Which view modes they used

  // Understanding
  comprehensionScore: number;     // 0-100 based on exploration and challenge
}

export interface RocketBuilderMetrics extends BasePrimitiveMetrics {
  type: 'rocket-builder';

  // Goal achievement
  targetAltitudeKm: number;       // Mission target altitude
  achievedAltitudeKm: number;     // Actual maximum altitude reached
  targetOrbitRequired: boolean;   // Whether orbit was required
  achievedOrbit: boolean;         // Whether orbit was achieved
  goalMet: boolean;               // Did student meet the mission objective

  // Rocket design
  totalMassKg: number;            // Total rocket mass at launch
  propellantMassKg: number;       // Total propellant mass
  totalThrustKN: number;          // Total thrust at launch
  thrustToWeightRatio: number;    // TWR at launch
  deltaVMs: number;               // Estimated delta-v in m/s

  // Staging
  stagesUsed: number;             // Number of stages in design
  componentsUsed: number;         // Total components placed
  stagingEventsCount: number;     // Number of staging separations during flight

  // Budget (if applicable)
  budgetUsed?: number;            // Total cost of components
  budgetLimit?: number;           // Budget constraint (if any)
  withinBudget: boolean;          // Did they stay within budget

  // Attempt tracking
  launchAttempts: number;         // Number of launch attempts
  hintsUsed: number;              // Number of hints requested
}

export interface OrbitMechanicsLabMetrics extends BasePrimitiveMetrics {
  type: 'orbit-mechanics-lab';

  // Challenge information
  challengeType: 'reach_altitude' | 'circularize' | 'rendezvous' | 'change_orbit' | 'reach_orbit' | 'free_exploration';
  challengeCompleted: boolean;    // Did student complete the challenge

  // Attempt tracking
  launchAttempts: number;         // Number of launch attempts
  burnsPerformed: number;         // Total orbital burns performed
  maxBurnsAllowed?: number;       // Maximum burns allowed (if constrained)

  // Final orbital state
  finalOrbitEccentricity: number; // Final orbit shape (0 = circular, <1 = elliptical, >=1 = escape)
  finalOrbitApogee: number;       // Final highest point (km)
  finalOrbitPerigee: number;      // Final lowest point (km)
  achievedStableOrbit: boolean;   // Did they achieve a stable (non-crashing) orbit

  // Rocket physics metrics (connects to RocketBuilder)
  totalMassKg?: number;           // Rocket mass at launch
  totalThrustKN?: number;         // Selected thrust
  thrustToWeightRatio?: number;   // TWR at launch
  propellantUsedKg?: number;      // Fuel consumed

  // Challenge-specific metrics
  targetAltitudeReached?: boolean;  // For reach_altitude challenges
  orbitCircularized?: boolean;      // For circularize challenges (e < 0.1)
  rendezvousAchieved?: boolean;     // For rendezvous challenges
  targetOrbitAchieved?: boolean;    // For change_orbit challenges
  reachedOrbit?: boolean;           // For reach_orbit challenges

  // Efficiency metrics (for advanced grades)
  deltaVUsed?: number;            // Total velocity change used
  optimalDeltaV?: number;         // Theoretical optimal delta-v
  efficiency?: number;            // deltaVUsed / optimalDeltaV (lower is better)
}

export interface MissionPlannerMetrics extends BasePrimitiveMetrics {
  type: 'mission-planner';

  // Mission configuration
  destination: string;            // Selected destination id
  missionType: string;            // flyby, orbit, landing, return
  trajectoryType: string;         // direct or gravity_assist
  crewed: boolean;                // Whether mission is crewed

  // Planning quality
  travelDays: number;             // Calculated travel time
  suppliesPacked: boolean;        // Whether sufficient supplies were packed
  launchWindowSelected: boolean;  // Whether a launch window was chosen
  optimalLaunchWindow: boolean;   // Whether the optimal window was selected
  gravityAssistUsed: boolean;     // Whether gravity assist trajectory was chosen
  fuelEfficiency: number;         // 0-100, how efficient the fuel usage was

  // Phase completion
  phasesCompleted: number;        // Number of learning phases completed
  totalPhases: number;            // Total available phases

  // Overall outcome
  missionSuccess: boolean;        // Whether mission reached destination
}

export interface TelescopeSimulatorMetrics extends BasePrimitiveMetrics {
  type: 'telescope-simulator';

  // Target finding performance
  targetObjectsTotal: number;       // Number of objects student must find
  targetObjectsFound: number;       // Number of targets successfully found
  allTargetsFound: boolean;         // Whether all targets were located

  // Observation logging
  observationsLogged: number;       // Number of journal entries created

  // Focus quality (for manual focus mode)
  focusAccuracy: number;            // Average focus quality 0-100
  focusMode: 'auto' | 'manual';     // Which focus mode was used
  manualFocusAttempts?: number;     // Number of focus adjustments (manual mode)

  // Exploration breadth
  objectsExplored: number;          // Total unique objects clicked/examined
  viewModesUsed: string[];          // View modes used (visible, infrared, radio)
  telescopeTypesUsed: string[];     // Telescope types used (binoculars, small, large, space)
  magnificationRange: [number, number]; // Min and max magnification used

  // Engagement
  timeSpent: number;                // Time spent in ms
  panDistance: number;              // Approximate pixels panned (exploration measure)
}

// -----------------------------------------------------------------------------
// Physics Primitives
// -----------------------------------------------------------------------------

export interface MotionDiagramMetrics extends BasePrimitiveMetrics {
  type: 'motion-diagram';

  // Motion identification
  motionType: 'uniform' | 'accelerated' | 'projectile' | 'circular' | 'custom';
  targetMotionType?: 'uniform' | 'accelerated' | 'projectile' | 'circular';
  motionTypeCorrect: boolean;     // If target specified, did student identify correctly?

  // Position markers
  markersPlaced: number;           // Number of position markers placed/analyzed
  markerCount: number;             // Target/expected number of markers

  // Vector analysis
  velocityVectorsShown: number;    // Number of velocity vectors displayed
  accelerationVectorsShown: number; // Number of acceleration vectors displayed
  averageVelocity: number;         // Average velocity magnitude (arbitrary units)
  averageAcceleration: number;     // Average acceleration magnitude (arbitrary units)
  uniformMotion: boolean;          // Is motion uniform (acceleration near zero)?

  // Interactive parameters
  timeInterval: number;            // Time between markers in seconds
  vectorsPlaced: number;           // Number of vectors student placed (evaluation mode)
  vectorsCorrect: boolean;         // If target specified, did student place correct vectors?
}

// -----------------------------------------------------------------------------
// Biology Primitives
// -----------------------------------------------------------------------------

export interface ProcessAnimatorMetrics extends BasePrimitiveMetrics {
  type: 'bio-process-animator';

  // Process identification
  processName: string;
  scale: 'molecular' | 'cellular' | 'organ' | 'organism' | 'ecosystem';

  // Scope
  totalStages: number;
  totalCheckpoints: number;

  // Checkpoint performance
  checkpointResponses: Array<{
    checkpointIndex: number;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    timeMs: number;
  }>;

  // Completion
  completedFullAnimation: boolean;
  replayCount: number;

  // Overall performance
  allCheckpointsCorrect: boolean;
}

export interface CompareContrastMetrics extends BasePrimitiveMetrics {
  type: 'bio-compare-contrast';

  // Mode and scope
  mode: 'side-by-side' | 'venn-interactive';
  totalAttributes: number;

  // Performance (venn-interactive mode only)
  correctPlacements: number;
  accuracy: number;             // 0-100 percentage correct

  // Detailed placements (venn-interactive mode)
  placements: Array<{
    attributeValue: string;
    placedRegion: string;       // 'A-only' | 'B-only' | 'shared' | 'unplaced'
    correctRegion: string;      // 'A-only' | 'B-only' | 'shared'
    isCorrect: boolean;
  }>;
}

export interface MicroscopeViewerMetrics extends BasePrimitiveMetrics {
  type: 'microscope-viewer';

  // Specimen info
  specimenName: string;
  specimenType: string;

  // Exploration
  totalZoomLevels: number;
  zoomLevelsExplored: number;

  // Labeling performance
  totalStructures: number;
  correctlyLabeled: number;
  labelingAttempts: Array<{
    structureId: string;
    studentLabel: string;
    correctLabel: string;
    isCorrect: boolean;
  }>;
  labelAccuracy: number;               // 0-100

  // Observation responses
  observationResponses: Array<{
    zoomLevel: string;
    prompt: string;
    studentResponse: string;
  }>;
  observationsSubmitted: number;
}

export interface AdaptationInvestigatorMetrics extends BasePrimitiveMetrics {
  type: 'adaptation-investigator';

  // Organism and adaptation info
  organism: string;
  adaptationType: 'structural' | 'behavioral' | 'physiological';
  gradeBand: '2-4' | '5-6' | '7-8';

  // Exploration tracking
  panelsExplored: number;             // 0-3: how many panels clicked
  allPanelsExplored: boolean;         // Did they explore trait, environment, and connection

  // What If? scenario performance
  totalWhatIfScenarios: number;
  correctWhatIfResponses: number;
  whatIfAccuracy: number;             // 0-100 percentage

  // Per-scenario results
  whatIfResponses: Array<{
    scenarioIndex: number;
    studentAnswer: boolean | null;    // true = "still useful", false = "not useful"
    correctAnswer: boolean;
    isCorrect: boolean;
  }>;

  // Engagement
  misconceptionViewed: boolean;       // Did they open the misconception section

  // Overall
  allCorrect: boolean;
}

export type CellZone =
  | 'center'
  | 'peripheral'
  | 'near-nucleus'
  | 'membrane-associated'
  | 'large-central'
  | 'scattered';

export type QuantityLevel = 'few' | 'some' | 'many' | 'lots';

export interface CellBuilderMetrics extends BasePrimitiveMetrics {
  type: 'cell-builder';

  // Cell information
  cellType: 'animal' | 'plant' | 'prokaryotic' | 'fungal';
  cellContext: string;            // "muscle cell", "nerve cell", "generic animal cell"
  gradeBand: '4-5' | '6-8';

  // Phase completion
  phase1Completed: boolean;       // Sort phase
  phase2Completed: boolean;       // Place phase
  phase3Completed: boolean;       // Function match phase
  allPhasesCompleted: boolean;

  // Phase 1: Sort (Belongs vs Doesn't Belong)
  totalOrganelles: number;        // Total organelles including distractors
  validOrganelles: number;        // Organelles that belong
  distractorOrganelles: number;   // Organelles that don't belong
  correctlySorted: number;        // Correctly classified (both accepted valid + rejected distractors)
  sortAccuracy: number;           // 0-100
  sortResults: Array<{
    organelleId: string;
    belongsInCell: boolean;       // Ground truth
    studentSaidBelongs: boolean;  // Student's answer
    isCorrect: boolean;
  }>;

  // Phase 2: Place (Zone-Based Placement)
  totalToPlace: number;           // Number of organelles to place
  correctZonePlacements: number;  // Placed in correct zone
  incorrectZonePlacements: number;
  unplacedOrganelles: number;
  zoneAccuracy: number;           // 0-100
  zonePlacements: Array<{
    organelleId: string;
    correctZone: CellZone;
    placedZone: CellZone | null;
    isCorrect: boolean;
  }>;

  // Quantity reasoning (for specialized cells)
  quantityQuestionsTotal: number;
  quantityQuestionsCorrect: number;
  quantityAccuracy: number;       // 0-100
  quantityResults: Array<{
    organelleId: string;
    expectedQuantity: QuantityLevel;
    studentQuantity: QuantityLevel | null;
    isCorrect: boolean;
  }>;

  // Phase 3: Function Matching
  totalFunctionMatches: number;
  correctFunctionMatches: number;
  functionMatchAccuracy: number;  // 0-100
  functionMatchResults: Array<{
    organelleId: string;
    selectedFunctionId: string | null;
    correctFunctionId: string;
    isCorrect: boolean;
  }>;

  // Overall
  allCorrect: boolean;
  accuracy: number;               // 0-100, weighted across phases (sort 30%, place 40%, match 30%)
}

export interface FoodWebBuilderMetrics extends BasePrimitiveMetrics {
  type: 'food-web-builder';

  // Web construction performance
  totalConnections: number;         // Number of correct connections in the food web
  correctConnections: number;       // Number of connections student got right
  missingConnections: number;       // Number of correct connections student didn't make
  extraConnections: number;         // Number of incorrect connections student made
  webComplete: boolean;             // Did student build the complete web correctly

  // Accuracy
  accuracy: number;                 // 0-100 percentage of correct connections

  // Connection attempts
  connectionAttempts: Array<{
    fromId: string;
    toId: string;
    isCorrect: boolean;
  }>;

  // Disruption scenario performance (optional - for grades 6-8)
  disruptionPredictions?: Array<{
    removedOrganismId: string;
    studentPredictions: string[];
    matchedExpected: number;
    totalExpected: number;
  }>;
}

// =============================================================================
// Discriminated Union of All Metrics
// =============================================================================

export interface InheritanceLabMetrics extends BasePrimitiveMetrics {
  type: 'inheritance-lab';

  // Cross information
  crossType: 'monohybrid' | 'dihybrid' | 'x-linked';
  inheritancePattern: 'complete-dominance' | 'incomplete-dominance' | 'codominance' | 'x-linked';
  gradeBand: '6-7' | '8';

  // Punnett square performance
  totalCells: number;
  correctCells: number;
  allCellsCorrect: boolean;
  punnettSquareAccuracy: number;  // 0-100

  // Per-cell results
  punnettSquareFilled: Array<{
    row: number;
    col: number;
    studentGenotype: string;
    correctGenotype: string;
    isCorrect: boolean;
  }>;

  // Simulation engagement
  simulationRun: boolean;
  simulationPopulation: number;
}

export interface DnaExplorerMetrics extends BasePrimitiveMetrics {
  type: 'dna-explorer';

  // Mode and configuration
  mode: 'structure' | 'base-pairing' | 'transcription' | 'replication';
  gradeBand: '5-6' | '7-8';
  sequenceLength: number;

  // Base pairing attempts
  basePairingAttempts: Array<{
    position: number;
    givenBase: string;
    studentBase: string;
    correctBase: string;
    isCorrect: boolean;
  }>;

  // Build challenge results
  buildChallengeResults: Array<{
    challengeIndex: number;
    studentAnswer: string;
    correctAnswer: string;
    accuracy: number; // 0-1
  }>;

  // Exploration tracking
  zoomLevelsExplored: string[];

  // Overall performance
  totalChallenges: number;
  correctChallenges: number;
  accuracy: number; // 0-100
}

export interface ProteinFolderMetrics extends BasePrimitiveMetrics {
  type: 'protein-folder';

  // Protein info
  proteinName: string;

  // Folding performance
  totalResidues: number;
  correctPlacements: number;
  foldingAccuracy: number;           // 0-100

  // Per-residue folding results
  foldingPredictions: Array<{
    residueId: number;
    studentPlacement: 'interior' | 'surface';
    correctPlacement: 'interior' | 'surface';
    isCorrect: boolean;
  }>;

  // Mutation challenge performance
  totalMutationChallenges: number;
  mutationPredictions: Array<{
    challengeIndex: number;
    studentPredictedEffect: string;
    accuracyScore: number;           // 0-1
  }>;
  mutationAccuracy: number;          // 0-100

  // Overall
  overallAccuracy: number;           // 0-100 (weighted: 60% folding, 40% mutation)
}

export interface EvolutionTimelineMetrics extends BasePrimitiveMetrics {
  type: 'evolution-timeline';

  // Exploration scope
  totalEvents: number;
  eventsExplored: number;
  totalLineages: number;
  lineagesTraced: number;
  totalExtinctions: number;
  extinctionsExplored: number;
  scaleAnchorsViewed: boolean;

  // Overall engagement
  explorationScore: number;        // 0-100 weighted exploration percentage
  zoomInteractions: number;        // Number of zoom/pan operations
}

export interface EnergyCycleEngineMetrics extends BasePrimitiveMetrics {
  type: 'energy-cycle-engine';

  // Mode and context
  mode: 'photosynthesis' | 'respiration' | 'coupled';
  gradeBand: '5-6' | '7-8';

  // Experiment performance
  totalExperiments: number;
  experimentsCompleted: number;
  experimentsCorrect: number;
  experimentAccuracy: number;           // 0-100

  // Exploration tracking
  couplingPointsExplored: number;       // How many coupling points were visible
  photosynthesisExplored: boolean;      // Did student view photosynthesis tab
  respirationExplored: boolean;         // Did student view respiration tab
  coupledModeUsed: boolean;             // Did student use coupled view

  // Interaction depth
  inputsAdjusted: boolean;              // Did they adjust any sliders
  processDisrupted: boolean;            // Did they break a process via experiment
}

// -----------------------------------------------------------------------------
// Literacy Primitives (Wave 3)
// -----------------------------------------------------------------------------

export interface SpellingPatternExplorerMetrics extends BasePrimitiveMetrics {
  type: 'spelling-pattern-explorer';
  patternIdentified: boolean;
  ruleFormulatedCorrectly: boolean;
  wordsSpelledCorrectly: number;
  wordsTotal: number;
  patternType: 'short-vowel' | 'long-vowel' | 'r-controlled' | 'suffix-change' | 'latin-root' | 'silent-letter';
  dictationAccuracy: number;            // 0-100
  attemptsCount: number;
}

export interface GenreExplorerMetrics extends BasePrimitiveMetrics {
  type: 'genre-explorer';
  genresIdentifiedCorrectly: number;
  genresTotal: number;
  featuresCheckedCorrectly: number;
  featuresTotal: number;
  comparisonMade: boolean;
  attemptsCount: number;
}

export interface RevisionWorkshopMetrics extends BasePrimitiveMetrics {
  type: 'revision-workshop';
  revisionSkill: 'add-details' | 'word-choice' | 'combine-sentences' | 'transitions' | 'reorganize' | 'concision';
  revisionsApplied: number;
  revisionTargets: number;
  improvementScore: number;           // 0-100
  beforeAfterCompared: boolean;
  readAloudUsed: boolean;
  attemptsCount: number;
}

export interface StoryPlannerMetrics extends BasePrimitiveMetrics {
  type: 'story-planner';
  elementsPlanned: number;
  elementsRequired: number;
  characterDepth: 'surface' | 'moderate' | 'deep';
  eventCount: number;
  conflictIdentified: boolean;
  resolutionConnectsToConflict: boolean;
  descriptiveLanguageUsed: number;
}

export interface ReadAloudStudioMetrics extends BasePrimitiveMetrics {
  type: 'read-aloud-studio';
  modelListened: boolean;
  studentRecordingMade: boolean;
  recordingDurationSeconds: number;
  estimatedWPM: number;
  comparisonUsed: boolean;
  selfAssessmentRating: number;         // 1-5
  passageLexileLevel: string;
}

export interface PoetryLabMetrics extends BasePrimitiveMetrics {
  type: 'poetry-lab';
  mode: 'analysis' | 'composition';
  figurativeLanguageIdentified: number;
  figurativeLanguageTotal: number;
  rhymeSchemeCorrect: boolean;
  syllableCountAccurate: boolean;
  elementsExplored: number;
  poemCompleted: boolean;
  templateType: 'haiku' | 'limerick' | 'acrostic' | 'free-verse' | 'sonnet-intro';
}

export interface FigurativeLanguageFinderMetrics extends BasePrimitiveMetrics {
  type: 'figurative-language-finder';
  instancesFound: number;
  instancesTotal: number;
  classificationsCorrect: number;
  classificationsTotal: number;
  literalTranslationAccuracy: number;     // 0-100
  typesEncountered: string[];             // figurative language types in the passage
  falsePositives: number;
  attemptsCount: number;
}

export interface CharacterWebMetrics extends BasePrimitiveMetrics {
  type: 'character-web';
  charactersProfiled: number;
  charactersRequired: number;
  traitsWithEvidence: number;
  traitsTotal: number;
  relationshipsIdentified: number;
  relationshipsTotal: number;
  characterChangeIdentified: boolean;
  analysisDepth: 'surface' | 'moderate' | 'deep';
  attemptsCount: number;
}

export interface TextStructureAnalyzerMetrics extends BasePrimitiveMetrics {
  type: 'text-structure-analyzer';
  structureIdentifiedCorrectly: boolean;
  signalWordsFound: number;
  signalWordsTotal: number;
  templateMappingAccuracy: number;        // 0-100
  structureType: 'cause-effect' | 'compare-contrast' | 'problem-solution' | 'chronological' | 'description';
  attemptsCount: number;
}

export interface OpinionBuilderMetrics extends BasePrimitiveMetrics {
  type: 'opinion-builder';
  framework: 'oreo' | 'cer';
  gradeLevel: string;
  claimPresent: boolean;
  reasonsProvided: number;
  evidenceForEachReason: boolean;
  counterArgumentPresent: boolean;
  linkingWordsUsed: number;
  structureComplete: boolean;
  startersUsed: number;
  startersAvailable: number;
}

// -----------------------------------------------------------------------------
// Literacy Primitives (Wave 2)
// -----------------------------------------------------------------------------

export interface ContextCluesDetectiveMetrics extends BasePrimitiveMetrics {
  type: 'context-clues-detective';

  // Grade context
  gradeLevel: string;

  // Phase accuracy
  clueHighlightedCorrectly: boolean;     // Found a valid clue sentence
  clueTypeIdentified: boolean;           // Correctly classified clue type
  meaningCorrect: boolean;               // Correct meaning provided

  // Clue info
  clueType: 'definition' | 'synonym' | 'antonym' | 'example' | 'inference';

  // Dictionary
  dictionaryComparisonViewed: boolean;

  // Challenge tracking
  attemptsCount: number;
  totalChallenges: number;
  challengesCorrect: number;
}

export interface EvidenceFinderMetrics extends BasePrimitiveMetrics {
  type: 'evidence-finder';

  // Grade context
  gradeLevel: string;

  // Evidence finding accuracy
  correctEvidenceFound: number;          // Correctly highlighted evidence sentences
  evidenceTotal: number;                 // Total evidence sentences in passage
  falseEvidenceSelected: number;         // Non-evidence sentences incorrectly highlighted

  // Strength rating
  evidenceStrengthRatingAccuracy: number;  // 0-100

  // CER framework
  reasoningProvided: boolean;            // Did they write reasoning
  cerFrameworkComplete: boolean;         // All three CER parts filled

  // Attempts
  attemptsCount: number;
}

export interface DecodableReaderMetrics extends BasePrimitiveMetrics {
  type: 'decodable-reader';

  // Grade context
  gradeLevel: string;

  // Reading tracking
  wordsTapped: number;                 // Words student tapped for help (lower = more independent)
  wordsTotal: number;                  // Total words in the passage

  // Comprehension
  comprehensionCorrect: boolean;

  // Pattern tracking
  phonicsPatternsInPassage: string[];  // Array of patterns represented

  // Sight word tracking
  sightWordsIdentified: number;        // Sight words read without tapping

  // Time
  readingTimeSeconds: number;

  // Attempts
  attemptsOnComprehension: number;
}

export interface PhonicsBlenderMetrics extends BasePrimitiveMetrics {
  type: 'phonics-blender';

  // Pattern info
  patternType: 'cvc' | 'cvce' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong';
  gradeLevel: string;

  // Word-level tracking
  wordsBlended: number;
  wordsTotal: number;

  // Phoneme accuracy
  phonemeAccuracy: number;             // 0-100
  averageBlendingSpeed: number;        // seconds from first tap to successful blend

  // First-try tracking
  soundsCorrectOnFirstTry: number;
  soundsTotal: number;

  // Attempts
  attemptsCount: number;
}

// -----------------------------------------------------------------------------
// Literacy Primitives (Wave 1)
// -----------------------------------------------------------------------------

export interface ParagraphArchitectMetrics extends BasePrimitiveMetrics {
  type: 'paragraph-architect';

  // Structure
  paragraphType: 'informational' | 'narrative' | 'opinion';
  structureComplete: boolean;
  topicSentencePresent: boolean;
  detailSentencesCount: number;
  concludingSentencePresent: boolean;

  // Writing quality
  linkingWordsUsed: number;
  sentenceFramesUsed: number;
  sentenceFramesAvailable: number;

  // Phases
  explorePhaseCompleted: boolean;
  practicePhaseCompleted: boolean;
  applyPhaseCompleted: boolean;
  allPhasesCompleted: boolean;

  // Revision
  revisionsAfterReadBack: number;

  // Accuracy
  accuracy: number;               // 0-100
  attemptsCount: number;
}

export interface SentenceBuilderMetrics extends BasePrimitiveMetrics {
  type: 'sentence-builder';

  // Sentence type and grade
  sentenceType: 'simple' | 'compound' | 'complex' | 'compound-complex';
  gradeLevel: string;

  // Challenge tracking
  totalChallenges: number;
  challengesCompleted: number;

  // Phases
  explorePhaseCompleted: boolean;
  practicePhaseCompleted: boolean;
  applyPhaseCompleted: boolean;

  // Attempts and hints
  totalAttempts: number;
  totalHintsUsed: number;
  averageAttemptsPerChallenge: number;

  // Per-challenge results
  challengeResults: Array<{
    challengeId: string;
    completed: boolean;
    attempts: number;
    hintsUsed: number;
  }>;

  // Accuracy
  accuracy: number;               // 0-100
}

export interface StoryMapMetrics extends BasePrimitiveMetrics {
  type: 'story-map';

  // Structure info
  structureType: 'bme' | 'story-mountain' | 'plot-diagram' | 'heros-journey';
  gradeLevel: string;

  // Phase 1: Identify
  charactersIdentified: number;
  totalCharacters: number;
  charactersCorrect: boolean;
  settingCorrect: boolean;
  identifyPhaseComplete: boolean;

  // Phase 2: Sequence
  totalEvents: number;
  eventsPlaced: number;
  eventsCorrectlyPlaced: number;
  allEventsCorrect: boolean;
  sequencePhaseComplete: boolean;

  // Per-event placement results
  eventPlacementResults: Array<{
    eventId: string;
    placedPosition: string;
    correctPosition: string;
    isCorrect: boolean;
  }>;

  // Phase 3: Analyze (grades 4+)
  conflictTypeCorrect: boolean;
  selectedConflictType?: string;
  correctConflictType?: string;
  analyzePhaseComplete: boolean;

  // Overall
  totalAttempts: number;
  completionTimeMs: number;
  overallAccuracy: number;         // 0-100
}

export interface ListenAndRespondMetrics extends BasePrimitiveMetrics {
  type: 'listen-and-respond';

  // Listening comprehension
  questionsCorrect: number;
  questionsTotal: number;

  // Replay behavior
  replaysUsed: number;
  answeredBeforeReplay: number;

  // Passage info
  passageType: 'narrative' | 'informational' | 'persuasive' | 'dialogue';
  listeningDurationSeconds: number;
  speedUsed: number;

  // Per-question results
  questionResults: Array<{
    questionId: string;
    difficulty: 'literal' | 'inferential' | 'evaluative';
    isCorrect: boolean;
    answeredBeforeReplay: boolean;
  }>;

  // Phases
  listenPhaseCompleted: boolean;
  respondPhaseCompleted: boolean;
  reviewPhaseCompleted: boolean;

  // Accuracy
  accuracy: number;               // 0-100
  attemptsCount: number;
}

export type PrimitiveMetrics =
  // Engineering
  | TowerStackerMetrics
  | BridgeBuilderMetrics
  | LeverLabMetrics
  | PulleySystemMetrics
  | GearTrainMetrics
  | RampLabMetrics
  | ShapeStrengthTesterMetrics
  | FoundationBuilderMetrics
  | ExcavatorArmSimulatorMetrics
  | DumpTruckLoaderMetrics
  | ConstructionSequencePlannerMetrics
  | BlueprintCanvasMetrics
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
  | MediaPlayerMetrics
  // Biology
  | ClassificationSorterMetrics
  | LifeCycleSequencerMetrics
  | CompareContrastMetrics
  | ProcessAnimatorMetrics
  | MicroscopeViewerMetrics
  | FoodWebBuilderMetrics
  | AdaptationInvestigatorMetrics
  | CellBuilderMetrics
  | InheritanceLabMetrics
  | DnaExplorerMetrics
  | ProteinFolderMetrics
  | EnergyCycleEngineMetrics
  | EvolutionTimelineMetrics
  // Astronomy
  | ScaleComparatorMetrics
  | DayNightSeasonsMetrics
  | MoonPhasesLabMetrics
  | RocketBuilderMetrics
  | OrbitMechanicsLabMetrics
  | MissionPlannerMetrics
  | TelescopeSimulatorMetrics
  // Physics
  | MotionDiagramMetrics
  // Literacy (Wave 1)
  | ParagraphArchitectMetrics
  | SentenceBuilderMetrics
  | StoryMapMetrics
  | ListenAndRespondMetrics
  // Literacy (Wave 2)
  | PhonicsBlenderMetrics
  | DecodableReaderMetrics
  | EvidenceFinderMetrics
  | ContextCluesDetectiveMetrics
  // Literacy (Wave 3)
  | OpinionBuilderMetrics
  | TextStructureAnalyzerMetrics
  | CharacterWebMetrics
  | FigurativeLanguageFinderMetrics
  // Literacy (Wave 4)
  | PoetryLabMetrics
  | ReadAloudStudioMetrics
  | StoryPlannerMetrics
  | RevisionWorkshopMetrics
  | GenreExplorerMetrics
  | SpellingPatternExplorerMetrics;

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
