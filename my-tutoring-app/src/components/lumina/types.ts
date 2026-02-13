// Note: Math primitive and engineering primitive data types are defined in their
// respective component files (e.g., primitives/visual-primitives/math/BarModel.tsx).
// Components access these types via orderedComponents.data which is typed as 'any'.
// The specific types remain in their source files for type-safety within generators.

export enum GameState {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}

export interface ConceptElement {
  label: string;
  detail: string;
  type: 'primary' | 'secondary' | 'highlight';
}

export interface ConceptCardData {
  title: string;
  subheading: string;
  definition: string;
  originStory: string;
  conceptElements: ConceptElement[];
  timelineContext: string;
  curiosityNote: string;
  visualPrompt: string;
  themeColor: string;
}

// --- FOUNDATION EXPLORER (Objective-Driven Concept Teaching) ---

export interface FoundationConcept {
  id: string;
  name: string;                 // "Fulcrum"
  briefDefinition: string;      // One sentence max

  // Where to find it in the diagram
  diagramHighlight: string;     // "center triangle marker"

  // Contextual understanding
  inContext: {
    scenario: string;           // "On a seesaw at the playground..."
    whereToFind: string;        // "The fulcrum is the center post"
  };

  // Self-check (verb-appropriate)
  selfCheck: {
    prompt: string;             // "Can you point to the fulcrum?"
    hint: string;               // "Look for the triangle in the middle"
  };

  // Visual identity
  color: string;                // Accent color for this concept
}

export interface FoundationExplorerData {
  // What objective this serves
  objectiveId: string;
  objectiveText: string;
  objectiveVerb: 'identify' | 'explain' | 'apply' | 'analyze' | 'compare';

  // The central diagram
  diagram: {
    description: string;        // "A simple lever with all three parts labeled"
    imagePrompt: string;        // For AI image generation
    style: 'schematic' | 'realistic' | 'animated';
  };

  // The foundational concepts (2-4)
  concepts: FoundationConcept[];

  // Theme
  themeColor: string;
}

// --- SPECIALIZED MODULES ---

// Step 1: Exhibit Intents (lightweight requests)
export interface SpecializedExhibitIntent {
  id: string;
  type: 'sentence' | 'math-visual' | 'custom-svg' | 'custom-web';
  title: string;
  purpose: string; // What this exhibit should demonstrate
  visualType?: MathVisualType; // For math-visual type
}

// Step 2: Generated Exhibit Data

// Module A: Math/Science Formula
export interface FormulaSegment {
  text: string;
  meaning?: string;
  isVariable: boolean;
}

export interface FormulaParameter {
  symbol: string;
  name: string;
  description: string;
  unit?: string;
  isHighlighted?: boolean; // LLM marks most important parameters
}

export interface FormulaRelationship {
  description: string; // e.g., "F is directly proportional to both m and a"
  type?: 'proportional' | 'inverse' | 'complex';
}

export interface FormulaExample {
  scenario: string;
  calculation?: string;
  result: string;
}

export interface EquationData {
  type: 'equation'; // Discriminator
  title: string;
  description: string;
  formula: string; // The actual formula as text (e.g., "F = ma")
  segments: FormulaSegment[]; // For interactive display
  parameters: FormulaParameter[]; // Detailed parameter cards
  relationships?: FormulaRelationship[]; // Key relationships in the formula
  examples?: FormulaExample[]; // Real-world examples
  applicationContext?: string; // When/where this formula is used
}

// Module B: Language/Grammar Sentence
export interface SentencePart {
  text: string;
  role: string; // e.g. "Subject", "Predicate", "Direct Object"
  partOfSpeech: string; // e.g. "Noun", "Verb", "Adjective"
  definition: string; // Brief grammar explanation
}

export interface SentenceSchemaData {
  type: 'sentence'; // Discriminator
  id: string; // Links back to intent
  title: string; // e.g. "Diagramming the Sentence"
  description: string;
  parts: SentencePart[];
}

// Module C: Math Tool Visuals
export type MathVisualType = 'bar-model' | 'number-line' | 'base-ten-blocks' | 'fraction-circles' | 'geometric-shape';

export interface MathVisualData {
  type: 'math-visual';
  id: string; // Links back to intent
  visualType: MathVisualType;
  title: string;
  description: string;
  data: {
    // Flexible container for tool arguments
    values?: { label: string; value: number; color?: string }[]; // Bar model
    range?: { min: number; max: number }; // Number line
    highlights?: { value: number; label: string }[]; // Number line
    numberValue?: number; // Base ten
    fractions?: { numerator: number; denominator: number; label?: string }[]; // Fractions
    shapeName?: string; // Geometric
    attributes?: { label: string; value: string }[]; // Geometric
  };
}

// Module D: Custom SVG
export interface CustomSVGData {
  type: 'custom-svg';
  id: string; // Links back to intent
  title: string;
  description: string;
  svgCode: string;
}

// Module E: Custom Web (Self-contained HTML)
export interface CustomWebData {
  type: 'custom-web';
  id: string; // Links back to intent
  title: string;
  description: string;
  htmlContent: string; // Complete self-contained HTML document with embedded CSS/JS
}

// Module F: Early Learning Visuals
export type EarlyLearningType = 'reading-basics' | 'writing-practice' | 'counting-visuals' | 'arithmetic-basics';

export interface EarlyLearningData {
  type: 'early-learning';
  visualType: EarlyLearningType;
  title: string;
  description: string;
  data: {
    // Reading
    text?: string;
    imagePrompt?: string;

    // Writing
    traceText?: string;

    // Counting
    count?: number;
    objectName?: string;
    objectEmoji?: string;

    // Arithmetic
    equation?: string; // e.g. "2 + 3 = 5"
    operands?: number[];
    operator?: '+' | '-';
    result?: number;
  };
}

// Module G: Chemistry 3D Molecular Visualization
export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface MoleculeAtom {
  id: string;
  element: string; // Symbol, e.g., 'C', 'H'
  name: string; // Full name, e.g., 'Carbon'
  position: Position;
  color?: string; // Hex code override, optional
  radius?: number; // Relative size, optional
  atomicNumber?: number;
  description?: string; // Short fun fact
}

export interface MoleculeBond {
  sourceId: string;
  targetId: string;
  order: number; // 1 = single, 2 = double, 3 = triple, 1.5 = resonant/aromatic
  type: 'covalent' | 'ionic' | 'hydrogen' | 'metallic' | 'unknown';
}

export interface MoleculeViewerData {
  name: string;
  description: string;
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  category: 'organic' | 'inorganic' | 'protein' | 'crystal' | 'other';
}

// Union Type for the Exhibit
export type SpecializedExhibit = EquationData | SentenceSchemaData | MathVisualData | CustomSVGData | CustomWebData | EarlyLearningData;

// ---------------------------

// FeatureExhibit types now defined in generator service (single source of truth)
export type {
  FeatureSection,
  EvidenceClaim,
  SynthesisOption,
  FeatureExhibitData,
} from './service/feature-exhibit/gemini-feature-exhibit';

export interface RelatedTopic {
  title: string;
  topic: string;
  teaser: string;
  category: string;
}

export interface TableData {
  type: 'table';
  headers: string[];
  rows: string[][];
  title?: string;
}

export interface QuizOption {
  id: string;
  text: string;
}

// Visual Primitive Types for Knowledge Checks
export interface VisualObjectItem {
  name: string;
  count: number;
  icon?: string;
  attributes?: string[];
}

export interface VisualObjectCollection {
  instruction?: string;
  items: VisualObjectItem[];
  layout?: 'grid' | 'scattered' | 'row';
}

export interface VisualComparisonPanel {
  label: string;
  collection: VisualObjectCollection;
}

export interface VisualComparisonData {
  panels: [VisualComparisonPanel, VisualComparisonPanel];
}

// ABCs/Early Literacy Visual Primitives
export interface StrokeOrder {
  path: string;
  number: number;
}

export interface LetterTracingData {
  letter: string;
  case: 'uppercase' | 'lowercase';
  showDirectionArrows?: boolean;
  showDottedGuide?: boolean;
  strokeOrder?: StrokeOrder[];
}

export interface LetterPictureItem {
  name: string;
  image: string;
  highlight: boolean;
}

export interface LetterPictureData {
  letter: string;
  items: LetterPictureItem[];
}

export interface AlphabetSequenceData {
  sequence: string[];
  missing: string[];
  highlightMissing?: boolean;
  showImages?: boolean;
}

export interface RhymingPair {
  word1: string;
  image1?: string;
  word2: string;
  image2?: string;
}

export interface RhymingPairsData {
  pairs: RhymingPair[];
  showConnectingLines?: boolean;
}

export interface SightWordCardData {
  word: string;
  fontSize?: 'small' | 'medium' | 'large';
  showInContext?: boolean;
  sentence?: string;
  highlightWord?: boolean;
}

export interface SoundSortCategory {
  label: string;
  words: string[];
}

export interface SoundSortData {
  targetSound: string;
  categories: SoundSortCategory[];
  showPictures?: boolean;
}

export type VisualPrimitiveType =
  | 'object-collection'
  | 'comparison-panel'
  | 'letter-picture'
  | 'alphabet-sequence'
  | 'rhyming-pairs'
  | 'sight-word-card'
  | 'sound-sort';

export interface VisualPrimitive {
  type: VisualPrimitiveType;
  data: VisualObjectCollection
    | VisualComparisonData
    | LetterTracingData
    | LetterPictureData
    | AlphabetSequenceData
    | RhymingPairsData
    | SightWordCardData
    | SoundSortData;
}

export interface KnowledgeCheckData {
  question: string;
  options: QuizOption[];
  correctAnswerId: string;
  explanation: string;
  visual?: VisualPrimitive; // Optional visual component

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// ============================================================================
// PROBLEM PRIMITIVES (Knowledge Check System)
// ============================================================================
// These types mirror the backend problem_type_schemas.py structure
// to enable consistent problem generation across multiple problem types

export type ProblemType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_in_blanks'
  | 'matching_activity'
  | 'sequencing_activity'
  | 'categorization_activity'
  | 'scenario_question'
  | 'short_answer';

export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

// Base interface for all problem types
export interface BaseProblemData {
  id: string;
  difficulty: ProblemDifficulty;
  gradeLevel: string;
  rationale: string;
  teachingNote: string;
  successCriteria: string[];
}

// Multiple Choice Problem
export interface MultipleChoiceOption {
  id: string;
  text: string;
}

export interface MultipleChoiceProblemData extends BaseProblemData {
  type: 'multiple_choice';
  question: string;
  visual?: VisualPrimitive;
  options: MultipleChoiceOption[];
  correctOptionId: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// True/False Problem
export interface TrueFalseProblemData extends BaseProblemData {
  type: 'true_false';
  statement: string;
  visual?: VisualPrimitive;
  correct: boolean;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// Fill in Blanks Problem
export interface BlankItem {
  id: string;
  correctAnswer: string; // Single correct answer for word bank matching
  caseSensitive: boolean;
}

export interface FillInBlanksProblemData extends BaseProblemData {
  type: 'fill_in_blanks';
  textWithBlanks: string;
  blanks: BlankItem[];
  wordBank: string[]; // All words including correct answers and distractors
}

// Matching Activity Problem
export interface MatchingItem {
  id: string;
  text: string;
}

export interface MatchingMapping {
  leftId: string;
  rightIds: string[];
}

export interface MatchingActivityProblemData extends BaseProblemData {
  type: 'matching_activity';
  prompt: string;
  leftItems: MatchingItem[];
  rightItems: MatchingItem[];
  mappings: MatchingMapping[];
}

// Sequencing Activity Problem
export interface SequencingActivityProblemData extends BaseProblemData {
  type: 'sequencing_activity';
  instruction: string;
  items: string[];
}

// Categorization Activity Problem
export interface CategorizationItem {
  itemText: string;
  correctCategory: string;
}

export interface CategorizationActivityProblemData extends BaseProblemData {
  type: 'categorization_activity';
  instruction: string;
  categories: string[];
  categorizationItems: CategorizationItem[];
}

// Scenario Question Problem
export interface ScenarioQuestionProblemData extends BaseProblemData {
  type: 'scenario_question';
  scenario: string;
  scenarioQuestion: string;
  scenarioAnswer: string;
}

// Short Answer Problem
export interface ShortAnswerProblemData extends BaseProblemData {
  type: 'short_answer';
  question: string;
}

// Union type for all problem data
export type ProblemData =
  | MultipleChoiceProblemData
  | TrueFalseProblemData
  | FillInBlanksProblemData
  | MatchingActivityProblemData
  | SequencingActivityProblemData
  | CategorizationActivityProblemData
  | ScenarioQuestionProblemData
  | ShortAnswerProblemData;

// Type selection for parallel generation (mirrors backend TYPE_SELECTION_SCHEMA)
export interface ProblemTypeSelection {
  type: ProblemType;
  count: number;
  reasoning: string;
}

export interface ProblemTypeSelectionResult {
  selectedTypes: ProblemTypeSelection[];
  overallReasoning: string;
}

export interface ComparisonItem {
  name: string;
  description: string;
  visualPrompt: string;
  points: string[];
}

export interface ComparisonGate {
  question: string;           // The true/false question to unlock next section
  correctAnswer: boolean;     // The correct answer
  rationale: string;          // Explanation shown after answering
  unlocks: string;            // What this gate unlocks: 'synthesis' | 'complete'
}

export interface ComparisonData {
  title: string;
  intro: string;
  item1: ComparisonItem;
  item2: ComparisonItem;
  synthesis: {
    mainInsight: string;
    keyDifferences: string[];
    keySimilarities: string[];
    whenToUse?: {
      item1Context: string;
      item2Context: string;
    };
    commonMisconception?: string;
  };

  // Comprehension gates (progressive reveal)
  gates?: ComparisonGate[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

export interface ItemDetailData {
  title: string;
  description: string;
  realWorldApplication: string;
  funFact: string;
  visualPrompt: string;
}

export interface IntroData {
  hook: string;
  objectives: string[];
}

// Intro Briefing Types (comprehensive lesson introduction)
export interface HookData {
  type: 'scenario' | 'question' | 'surprising_fact' | 'story';
  content: string;
  visual: string; // emoji
}

export interface BigIdeaData {
  statement: string;
  whyItMatters: string;
}

export interface ObjectiveData {
  id: string;
  text: string;
  verb: 'identify' | 'explain' | 'create' | 'analyze' | 'compare' | 'apply' | 'evaluate';
  icon: string;
}

export interface QuickCheckData {
  question: string;
  answer: string;
  hint: string;
}

export interface PrerequisitesData {
  shouldKnow: string[];
  quickCheck: QuickCheckData;
}

export interface RoadmapPhase {
  phase: string;
  description: string;
  activities: string[];
}

export interface ConnectionsData {
  buildingFrom: string[];
  leadingTo: string[];
  realWorld: string[];
}

export interface MindsetData {
  encouragement: string;
  growthTip: string;
}

export interface IntroBriefingData {
  primitive: 'intro_briefing';
  topic: string;
  subject: string;
  gradeLevel: string;
  estimatedTime: string;
  hook: HookData;
  bigIdea: BigIdeaData;
  objectives: ObjectiveData[];
  prerequisites: PrerequisitesData;
  roadmap: RoadmapPhase[];
  connections: ConnectionsData;
  mindset: MindsetData;
}

export interface GraphBoardData {
  title: string;
  description: string;
  initialPoints?: { x: number; y: number }[];
  gridRange?: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface SpectrumAnchor {
  position: number;
  label: string;
  example: string;
}

export interface SpectrumItem {
  id: number;
  title: string;
  description: string;
  correctPosition: number;
  tolerance: number;
  explanation: string;
  metadata?: string; // Optional metadata like date, step number, etc. displayed in top-right
}

export interface ScaleSpectrumData {
  title: string;
  description: string;
  spectrum: {
    leftLabel: string;
    rightLabel: string;
    leftColor: string;
    rightColor: string;
    anchors: SpectrumAnchor[];
  };
  items: SpectrumItem[];
  mode?: string;
}

export interface AnnotationLayer {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export interface WorkLine {
  text: string;
  annotation?: string;
}

export interface ResultLine {
  text: string;
}

export interface StepAnnotations {
  [layerId: string]: string;
}

export interface ExampleStep {
  id: number;
  title: string;
  work: WorkLine[];
  result?: ResultLine[];
  annotations: StepAnnotations;
}

export interface ProblemStatement {
  statement: string;
  equations?: string[];
  context?: string;
}

export interface AnnotatedExampleData {
  title: string;
  subject: string;
  problem: ProblemStatement;
  layers: AnnotationLayer[];
  steps: ExampleStep[];
}

export interface HierarchyNode {
  id: string;
  label: string;
  type?: string;
  icon: string;
  description: string;
  children?: HierarchyNode[];
}

export interface NestedHierarchyData {
  title: string;
  description?: string;
  root_node: HierarchyNode;
  defaultExpanded?: string[];
}

// Re-export from component (single source of truth)
export type { ImagePanelData, ImageAnnotation, StudentPlacement } from './primitives/ImagePanel';

// Take Home Activity Types
export interface MaterialItem {
  item: string;
  quantity: string;
  essential: boolean;
  substitutes?: string[];
  examples?: string[];
}

export interface ActivityStep {
  stepNumber: number;
  title: string;
  instruction: string;
  tip?: string;
  scienceNote?: string;
  checkpoint?: {
    question: string;
    type: 'confirm' | 'count' | 'reflection';
  };
}

export interface ReflectionPrompt {
  question: string;
  hint?: string;
  connectionTo?: string;
}

export interface ActivityExtension {
  title: string;
  description: string;
  difficulty: 'intermediate' | 'advanced';
}

export interface DocumentationPrompt {
  instruction: string;
  suggestedCaption: string;
}

export interface TakeHomeActivityData {
  id: string;
  title: string;
  subject: string;
  topic: string;
  gradeRange: string;
  estimatedTime: string;
  overview: string;
  learningObjectives: string[];
  materials: MaterialItem[];
  safetyNotes?: string[];
  steps: ActivityStep[];
  reflectionPrompts: ReflectionPrompt[];
  extensions?: ActivityExtension[];
  documentationPrompt?: DocumentationPrompt;
}

// Interactive Passage Types (Language Arts Suite)
export interface HighlightTarget {
  id: string;
  textSegment: string; // The exact text to match
  correct: boolean;
  feedback: string;
}

export interface VocabularyTerm {
  word: string;
  definition: string;
  partOfSpeech: string;
}

export interface PassageSegment {
  text: string;
  type: 'text' | 'vocabulary';
  vocabData?: VocabularyTerm;
}

export interface PassageSection {
  id: string;
  segments: PassageSegment[];
  inlineQuestion?: {
    prompt: string;
    options: string[];
    correctIndex: number;
  };
}

export interface InteractivePassageData {
  title: string;
  author?: string;
  readingLevel?: string; // e.g., "Lexile 800L"
  sections: PassageSection[];
  highlightTask?: {
    instruction: string; // e.g., "Highlight the sentence that shows the character is angry."
    targets: HighlightTarget[];
  };
}

// Word Builder Types (Language Arts Suite)
export interface WordPart {
  id: string;
  text: string;
  type: 'prefix' | 'root' | 'suffix';
  meaning: string; // e.g., "Life" for "Bio"
}

export interface TargetWord {
  word: string;
  parts: string[]; // IDs of the correct parts
  definition: string;
  sentenceContext: string;
}

export interface WordBuilderData {
  title: string; // e.g., "Constructing Scientific Terms"
  availableParts: WordPart[]; // Pool of parts to drag from
  targets: TargetWord[]; // Words to build
}

// Periodic Table Types
export interface PeriodicTableData {
  title?: string;
  description?: string;
  highlightElements?: number[]; // Array of atomic numbers to highlight
  focusCategory?: string; // Optional category to focus on
}

// Media Player Types (Audio-Visual Lesson Player with Knowledge Checks)
export interface SegmentKnowledgeCheck {
  question: string;              // Comprehension question about segment content
  options: string[];             // 2-4 answer choices
  correctOptionIndex: number;    // Index of correct answer (0-based)
  explanation?: string;          // Why this answer is correct
}

export interface LessonSegment {
  title: string;
  script: string;
  imagePrompt: string;
  knowledgeCheck?: SegmentKnowledgeCheck;  // Optional knowledge check per segment
}

export interface GeneratedMediaAsset {
  audioBase64: string | null; // Raw base64 audio data (PCM) from Gemini TTS
  imageUrl: string | null; // Base64 data URL or null if generation failed
}

export interface FullLessonSegment extends LessonSegment, GeneratedMediaAsset {}

export interface MediaPlayerData {
  title?: string;
  description?: string;
  segments: FullLessonSegment[];
  imageResolution?: '1K' | '2K' | '4K';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// Flashcard Types (Rapid-Fire Study Tool)
export interface FlashcardItem {
  id: string;
  term: string;
  definition: string;
  category: string;
}

export interface FlashcardDeckData {
  title?: string;
  description?: string;
  cards: FlashcardItem[];
}

// Image Comparison Types (Before/After Slider)
export interface ImageComparisonData {
  title?: string;
  description?: string;
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  detailedExplanation?: string;
  keyTakeaways?: string[];
}

/**
 * Shape of each ordered component in exhibitData.orderedComponents
 * Preserves the manifest layout order for rendering
 */
export interface OrderedComponent {
  componentId: ComponentId;
  instanceId: string;
  title: string;
  data: any;
  objectiveIds?: string[];
}

export interface ExhibitData {
  topic: string;
  intro: IntroData; // Legacy simple intro (hook + objectives)
  introBriefing?: IntroBriefingData; // New comprehensive intro briefing
  manifest?: ExhibitManifest; // The manifest used to generate this exhibit
  // NEW: Ordered components array preserving manifest layout order
  orderedComponents?: OrderedComponent[];
  specializedExhibits?: SpecializedExhibit[];
  featureExhibit: FeatureExhibitData;
  comparison: ComparisonData;
  cards: ConceptCardData[];
  tables: TableData[];
  graphBoards?: GraphBoardData[];
  scaleSpectrums?: ScaleSpectrumData[];
  annotatedExamples?: AnnotatedExampleData[];
  nestedHierarchies?: NestedHierarchyData[];
  imagePanels?: ImagePanelData[];
  takeHomeActivities?: TakeHomeActivityData[];
  interactivePassages?: InteractivePassageData[];
  wordBuilders?: WordBuilderData[];
  moleculeViewers?: MoleculeViewerData[];
  periodicTables?: PeriodicTableData[];
  mediaPlayers?: MediaPlayerData[];
  flashcardDecks?: FlashcardDeckData[];
  imageComparisons?: ImageComparisonData[];
  // Note: Math visualization primitives (barModels, numberLines, etc.) and
  // engineering primitives (leverLabs, etc.) have been removed.
  // All components now render exclusively from orderedComponents array.
  knowledgeCheck: KnowledgeCheckData;
  relatedTopics: RelatedTopic[];
}

// Walk-Through Types
export interface WalkThroughRequest {
  type: 'curator-brief' | 'concept-card' | 'feature-exhibit'; // Extensible
  content: WalkThroughContent;
  componentId: string; // Unique identifier for targeting
}

export interface WalkThroughContent {
  brief?: string;
  objectives?: string[];
  title?: string;
  description?: string;
  // Extensible for future component types
}

export interface WalkThroughProgress {
  section: 'brief' | 'objectives';
  objectiveIndex?: number | null;
  isComplete?: boolean;
}

export interface WalkThroughState {
  active: boolean;
  componentId: string | null;
  currentSection: 'brief' | 'objectives' | null;
  highlightIndex: number | null;
}

// --- MANIFEST-FIRST ARCHITECTURE ---

export type ComponentId =
  // Core Narrative
  | 'curator-brief'      // The hook/intro
  | 'concept-card-grid'  // The 3-card layout
  | 'feature-exhibit'    // The deep dive editorial
  | 'detail-drawer'      // (Usually triggered by interaction, but can be pre-seeded)

  // Data & Analysis
  | 'comparison-panel'   // A vs B
  | 'generative-table'   // Structured data
  | 'sentence-analyzer'  // Linguistic breakdown
  | 'graph-board'        // Interactive polynomial graphing tool
  | 'nested-hierarchy'   // Hierarchical tree structure with detailed views

  // Math & Science Engines
  | 'formula-card'       // LaTeX/Math display
  | 'custom-visual'      // The SVG/HTML wildcard

  // Math Visualization Primitives (Elementary Math)
  | 'bar-model'          // Comparative bar visualization for values
  | 'number-line'        // Linear number line with highlights
  | 'base-ten-blocks'    // Place value visualization (hundreds, tens, ones)
  | 'fraction-circles'   // Fractional parts shown as pie charts
  | 'fraction-bar'       // Rectangular bar divided into parts to represent fractions
  | 'geometric-shape'    // Shape properties and attributes
  | 'place-value-chart'  // Place value chart for reading and writing numbers
  | 'area-model'         // Area model for multiplication and distributive property
  | 'array-grid'         // Array/grid for multiplication and combinatorics
  | 'double-number-line' // Two parallel number lines showing proportional relationships
  | 'tape-diagram'       // Tape diagram / bar model for part-whole and comparison word problems
  | 'factor-tree'        // Tree diagram showing prime factorization
  | 'function-machine'   // Visual machine with input hopper, rule display, and output chute for function concepts
  | 'ratio-table'        // Table showing equivalent ratios
  | 'percent-bar'        // Horizontal bar model with percentage markings
  | 'balance-scale'      // Interactive balance scale for equation solving
  | 'coordinate-graph'   // 2D Cartesian coordinate plane for plotting points, lines, curves, and regions
  | 'slope-triangle'     // Right triangle overlay showing rise/run for slope visualization
  | 'systems-equations-visualizer' // Systems of linear equations with graphical and algebraic solution methods
  | 'matrix-display'     // Matrix display and editor with step-by-step operations (determinant, inverse, transpose, etc.)
  | 'dot-plot'           // Dot plot / line plot with stacked dots representing data values and frequency
  | 'histogram'          // Bar chart showing frequency distribution with adjustable bin widths
  | 'two-way-table'      // Two-way table / contingency table with Venn diagram view for categorical data analysis

  // Deprecated (kept for backward compatibility)
  | 'math-visual'        // @deprecated Use specific primitives: bar-model, number-line, base-ten-blocks, fraction-circles, geometric-shape

  // Interactive Learning Tools
  | 'scale-spectrum'     // Spectrum/continuum for nuanced judgments
  | 'annotated-example'  // Worked examples with multi-layer annotations
  | 'image-panel'        // AI-generated images for any subject (maps, diagrams, illustrations)
  | 'take-home-activity' // Hands-on activities using household materials

  // Language Arts Suite
  | 'interactive-passage' // Reading comprehension with evidence highlighting
  | 'word-builder'        // Vocabulary & Morphology - construct words from roots, prefixes, suffixes

  // Language Arts Suite (K-6 ELA Expansion — PRD_LANGUAGE_ARTS_SUITE.md)
  | 'phonics-blender'           // Sound-by-sound word building with phoneme tiles and audio (K-2)
  | 'decodable-reader'          // Controlled-vocabulary reading with per-word TTS and comprehension (K-2)
  | 'story-map'                 // Interactive plot structure diagram (K-6)
  | 'character-web'             // Character analysis and relationship mapping (grades 2-6)
  | 'poetry-lab'                // Poetry analysis and composition (grades 1-6)
  | 'genre-explorer'            // Text genre classification with feature checklists (grades 1-6)
  | 'text-structure-analyzer'   // Informational text organizational pattern identification (grades 2-6)
  | 'evidence-finder'           // Text evidence citing with CER framework (grades 2-6)
  | 'paragraph-architect'       // Scaffolded paragraph construction (grades 1-6)
  | 'story-planner'             // Narrative pre-writing organizer (K-6)
  | 'opinion-builder'           // Argument/persuasive writing scaffold (grades 2-6)
  | 'revision-workshop'         // Edit and revise drafts with targeted feedback (grades 2-6)
  | 'listen-and-respond'        // Audio comprehension with hidden text (K-6)
  | 'read-aloud-studio'         // Fluency practice with model reading and recording (grades 1-6)
  | 'sentence-builder'          // Construct grammatical sentences from word tiles (grades 1-6)
  | 'context-clues-detective'   // Determine word meaning from context clues (grades 2-6)
  | 'figurative-language-finder' // Identify and interpret figurative language (grades 3-6)
  | 'spelling-pattern-explorer' // Discover spelling rules through pattern investigation (grades 1-6)

  // Assessment
  | 'knowledge-check'   // Quiz

  // Science Visualization
  | 'molecule-viewer'    // 3D molecular structure viewer
  | 'periodic-table'     // Interactive periodic table of elements

  // Biology Primitives
  | 'species-profile'    // Comprehensive species information with taxonomy, habitat, and characteristics (perfect for dinosaurs!)
  | 'organism-card'      // Foundational organism card with key biological attributes (K-8, scales by grade)
  | 'classification-sorter' // Interactive drag-and-drop categorization for organisms and characteristics (K-8)
  | 'life-cycle-sequencer' // Interactive temporal sequencing for life cycles, cellular processes, and ecological cycles (K-8)
  | 'body-system-explorer' // Interactive layered anatomy diagram with organ details and pathway tracing (grades 2-8)
  | 'habitat-diorama'    // Interactive ecosystem explorer with organisms, relationships, and environmental features (K-8)
  | 'bio-compare-contrast' // Side-by-side or Venn diagram comparison of biological entities (organisms, cells, organs, processes, biomes) (K-8)
  | 'bio-process-animator' // Step-through animation of biological processes with narrated stages and checkpoint questions (grades 2-8)
  | 'microscope-viewer'   // Simulated microscope experience with zoom levels, labeling tasks, and guided observation prompts (grades 3-8)
  | 'food-web-builder'    // Interactive food web construction by drawing energy-flow connections between organisms (grades 3-8)
  | 'adaptation-investigator' // Structure-function-environment reasoning: why organisms have specific traits (grades 2-8)
  | 'cell-builder'           // Interactive cell diagram builder for placing and identifying organelles (grades 4-8)
  | 'inheritance-lab'        // Interactive Punnett square and trait prediction tool for genetics inheritance (grades 6-8)
  | 'dna-explorer'           // Interactive DNA structure explorer with base pairing, zoom levels, and build challenges (grades 5-8)
  | 'protein-folder'         // Interactive protein folding simulator with amino acid placement, structure visualization, and mutation challenges (grades 7-8)
  | 'energy-cycle-engine'    // Interactive photosynthesis-respiration cycle engine showing coupled energy processes with input manipulation and experiments (grades 5-8)
  | 'evolution-timeline'     // Interactive deep-time timeline showing evolutionary events, branching points, mass extinctions, and lineage tracing (grades 4-8)

  // Media & Multimedia
  | 'media-player'       // Audio-visual lesson player with synchronized narration and images

  // Study & Practice Tools
  | 'flashcard-deck'     // Interactive flashcard deck for rapid-fire memorization

  // Visual Comparison Tools
  | 'image-comparison'   // Before/After image slider for visual transformations

  // Engineering Primitives (K-5 STEM)
  | 'lever-lab'          // Interactive lever/fulcrum system for simple machines education
  | 'pulley-system-builder' // Interactive pulley system for teaching mechanical advantage
  | 'ramp-lab'           // Interactive inclined plane/ramp for teaching simple machines
  | 'wheel-axle-explorer' // Interactive wheel and axle for force multiplication and simple machines
  | 'gear-train-builder' // Interactive gear train sandbox for teaching speed/torque trade-offs
  | 'bridge-builder'     // Interactive 2D bridge construction for structural engineering concepts
  | 'tower-stacker'      // Interactive vertical building challenge for stability and center of gravity
  | 'shape-strength-tester' // Interactive shape testing rig for teaching triangulation and structural rigidity
  | 'foundation-builder' // Interactive soil/foundation simulator for teaching pressure, soil capacity, and foundation design
  | 'excavator-arm-simulator' // Multi-jointed excavator arm with boom, stick, and bucket for teaching hydraulics and kinematics
  | 'dump-truck-loader' // Interactive dump truck loading and hauling simulation for teaching capacity and material handling
  | 'construction-sequence-planner' // Interactive timeline/flowchart tool for ordering construction tasks and understanding dependencies
  | 'blueprint-canvas' // Grid-based drawing surface for creating technical drawings and floor plans

  // Astronomy Primitives (K-5)
  | 'solar-system-explorer' // Interactive solar system model with orbits, zoom, and planet details
  | 'scale-comparator' // Interactive scale comparison tool for celestial objects with familiar references
  | 'day-night-seasons' // Interactive Earth model showing rotation (day/night) and orbit (seasons) with tilt visualization
  | 'moon-phases-lab' // Interactive Earth-Moon-Sun model showing why Moon phases occur, with multiple view perspectives
  | 'rocket-builder' // Comprehensive rocket design and simulation tool for spaceflight education
  | 'orbit-mechanics-lab' // Interactive orbital mechanics sandbox for learning orbits, burns, and transfers
  | 'mission-planner' // Interactive mission design tool for planning trips to the Moon, Mars, and beyond
  | 'telescope-simulator' // Virtual telescope experience for exploring the night sky with adjustable telescopes, magnification, and view modes

  // Foundational Concept Teaching
  | 'foundation-explorer' // Objective-driven concept exploration with diagrams and self-checks

  // Physics Primitives (Middle School - High School)
  | 'motion-diagram'     // Strobe diagram visualization for teaching kinematics and motion concepts

/**
 * Tutoring scaffold metadata for AI-assisted learning.
 * Embedded in the catalog so scaffolding instructions live alongside
 * component definitions (single source of truth).
 *
 * Template variables use {{key}} syntax (Mustache-style).
 * Keys reference fields in primitive_data at runtime.
 * Example: "Help student blend phonemes ({{patternType}} pattern)"
 */
export interface TutoringScaffold {
  /** Template describing the task. Supports {{key}} interpolation from primitive_data. */
  taskDescription: string;

  /**
   * Which primitive_data keys to include in the AI context.
   * If omitted, all primitive_data keys are passed.
   */
  contextKeys?: string[];

  /** Three progressive levels of scaffolding strategy */
  scaffoldingLevels: {
    level1: string;
    level2: string;
    level3: string;
  };

  /** Common student struggles and recommended responses */
  commonStruggles?: Array<{
    pattern: string;
    response: string;
  }>;
}

export interface ComponentDefinition {
  id: ComponentId;
  description: string;
  constraints?: string; // e.g. "Max 1 per page" or "Requires numeric data"
  /** Optional AI tutoring scaffold. When present, sent to backend during WebSocket auth. */
  tutoring?: TutoringScaffold;
}

/**
 * Configuration object for manifest items
 * Provides hints and educational context for content generation
 */
export interface ManifestItemConfig {
  // General configuration
  visualType?: string;      // Type of visualization (e.g., 'bar-model', 'number-line')
  itemCount?: number;       // Number of items to generate
  difficulty?: string;      // Difficulty level

  // Educational context (especially useful for custom-visual)
  subject?: string;         // Subject area (e.g., 'Mathematics', 'Science', 'Language Arts')
  unitTitle?: string;       // Broader unit context
  keyTerms?: string[];      // Key vocabulary terms to emphasize
  conceptsCovered?: string[]; // Core concepts to illustrate

  // Allow additional properties for component-specific needs
  [key: string]: any;
}

export interface ManifestItem {
  componentId: ComponentId;
  instanceId: string; // Unique ID for the builder to use later
  title: string;      // The heading for this section
  intent: string;     // Instructions for the content generator
  config?: ManifestItemConfig; // Optional hints and educational context
  objectiveIds?: string[]; // Learning objective IDs this component addresses (legacy)
}

/**
 * A component within an objective block - knows which objective it serves
 */
export interface ObjectiveComponent {
  componentId: ComponentId;
  instanceId: string;
  title: string;
  intent: string;
  config?: ManifestItemConfig;
}

/**
 * An objective block containing all components dedicated to teaching ONE objective
 */
export interface ObjectiveBlock {
  objectiveId: string;      // e.g., 'obj1', 'obj2'
  objectiveText: string;    // The full learning objective text
  objectiveVerb: string;    // Bloom's taxonomy verb (identify, explain, apply, etc.)
  components: ObjectiveComponent[];
}

/**
 * Curator brief component - introduces all objectives
 */
export interface CuratorBriefManifest {
  instanceId: string;
  title: string;
  intent: string;
}

/**
 * Final assessment component - covers all objectives
 */
export interface FinalAssessmentManifest {
  componentId: 'knowledge-check' | 'flashcard-deck';
  instanceId: string;
  title: string;
  intent: string;
  config?: ManifestItemConfig;
}

/**
 * OBJECTIVE-CENTRIC ExhibitManifest
 * Each objective gets its own dedicated set of components (1-to-many)
 */
export interface ExhibitManifest {
  topic: string;
  gradeLevel: string;
  themeColor: string;

  // The curator brief introduces all objectives
  curatorBrief: CuratorBriefManifest;

  // Each objective has its own dedicated components
  objectiveBlocks: ObjectiveBlock[];

  // Optional final assessment covering all objectives
  finalAssessment?: FinalAssessmentManifest;

  // Legacy flat layout - computed from objectiveBlocks for backward compatibility
  layout?: ManifestItem[];
}

// Re-export component data types for external use
export type { CounterexamplePairData } from './primitives/visual-primitives/core/CounterexamplePair';
export type { DecisionFlowchartData, DecisionNode } from './primitives/visual-primitives/core/DecisionFlowchart';
export type { ScaleComparatorData, CelestialObject, ReferenceObject } from './primitives/visual-primitives/astronomy/ScaleComparator';
export type { DayNightSeasonsData, LocationMarker } from './primitives/visual-primitives/astronomy/DayNightSeasons';
export type { MoonPhasesLabData, ViewMode, MoonPhase, MoonPhaseInfo } from './primitives/visual-primitives/astronomy/MoonPhasesLab';
export type { RocketBuilderData, RocketComponent } from './primitives/visual-primitives/astronomy/RocketBuilder';
export type { OrbitMechanicsLabData, OrbitConfig, OrbitalBody } from './primitives/visual-primitives/astronomy/OrbitMechanicsLab';
export type { TelescopeSimulatorData, CelestialTarget, JournalEntry, TelescopeType, SkyViewMode } from './primitives/visual-primitives/astronomy/TelescopeSimulator';
export type { MotionDiagramData, PositionMarker, MotionType } from './primitives/visual-primitives/physics/MotionDiagram';
export type { OrganismCardData, OrganismInfo, OrganismAttributes, OrganismClassification } from './primitives/visual-primitives/biology/OrganismCard';
export type { ClassificationSorterData, ClassificationCategory, ClassificationItem } from './primitives/visual-primitives/biology/ClassificationSorter';
export type { LifeCycleSequencerData, LifeCycleStage, MisconceptionTrap } from './primitives/visual-primitives/biology/LifeCycleSequencer';
export type { BodySystemExplorerData, OrganInfo, Pathway, PathwayStep, Layer, BodySystem } from './primitives/visual-primitives/biology/BodySystemExplorer';
export type { HabitatDioramaData, Organism, Relationship, EnvironmentalFeature, DisruptionScenario } from './primitives/visual-primitives/biology/HabitatDiorama';
export type { CompareContrastData, EntityAttribute, EntityInfo, SharedAttribute } from './primitives/visual-primitives/biology/CompareContrast';
export type { ProcessAnimatorData, ProcessStage, CheckpointQuestion } from './primitives/visual-primitives/biology/ProcessAnimator';
export type { MicroscopeViewerData, VisibleStructure, ZoomLevel } from './primitives/visual-primitives/biology/MicroscopeViewer';
export type { FoodWebBuilderData, Organism as FoodWebOrganism, Connection as FoodWebConnection, DisruptionChallenge } from './primitives/visual-primitives/biology/FoodWebBuilder';
export type { AdaptationInvestigatorData, AdaptationInfo, EnvironmentInfo, ConnectionInfo, WhatIfScenario, MisconceptionInfo } from './primitives/visual-primitives/biology/AdaptationInvestigator';
export type { CellBuilderData, OrganelleInfo, CellMembraneInfo, CellWallInfo, CellZone, FunctionMatch } from './primitives/visual-primitives/biology/CellBuilder';
export type { InheritanceLabData, TraitInfo, ParentInfo, PunnettCell, AlleleInfo, ExpectedRatios } from './primitives/visual-primitives/biology/InheritanceLab';
export type { DnaExplorerData, NucleotideInfo, SequenceInfo, StructuralFeatures, ZoomLevelInfo, BuildChallenge, HighlightedRegion } from './primitives/visual-primitives/biology/DnaExplorer';
export type { ProteinFolderData, AminoAcidResidue, KeyInteraction, FoldingLevels, MutationChallenge } from './primitives/visual-primitives/biology/ProteinFolder';
export type { EnergyCycleEngineData, MoleculeInput, MoleculeOutput, PhotosynthesisData, CellularRespirationData, CouplingPoint, ExperimentScenario } from './primitives/visual-primitives/biology/EnergyCycleEngine';
export type { EvolutionTimelineData, TimelineEra, TimelineEvent, Lineage, ScaleAnchor, MassExtinction } from './primitives/visual-primitives/biology/EvolutionTimeline';