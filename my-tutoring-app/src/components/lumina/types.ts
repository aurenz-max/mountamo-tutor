
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

export interface FeatureSection {
  heading: string;
  content: string;
}

export interface FeatureExhibitData {
  title: string;
  sections: FeatureSection[];
  relatedTerms: string[];
  visualPrompt: string;
}

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
}

// True/False Problem
export interface TrueFalseProblemData extends BaseProblemData {
  type: 'true_false';
  statement: string;
  visual?: VisualPrimitive;
  correct: boolean;
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

export interface ComparisonData {
  title: string;
  intro: string;
  item1: ComparisonItem;
  item2: ComparisonItem;
  synthesis: string;
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

export interface ImagePanelData {
  title: string;
  description?: string;
  imageUrl: string | null;
  imagePrompt?: string;
  category?: 'geography' | 'history' | 'science' | 'literature' | 'art' | 'general';
  attribution?: string;
}

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

// Media Player Types (Audio-Visual Lesson Player)
export interface LessonSegment {
  title: string;
  script: string;
  imagePrompt: string;
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

export interface ExhibitData {
  topic: string;
  intro: IntroData; // Legacy simple intro (hook + objectives)
  introBriefing?: IntroBriefingData; // New comprehensive intro briefing
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
  | 'geometric-shape'    // Shape properties and attributes

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

  // Assessment
  | 'knowledge-check'   // Quiz

  // Science Visualization
  | 'molecule-viewer'    // 3D molecular structure viewer
  | 'periodic-table'     // Interactive periodic table of elements

  // Media & Multimedia
  | 'media-player'       // Audio-visual lesson player with synchronized narration and images

  // Study & Practice Tools
  | 'flashcard-deck';    // Interactive flashcard deck for rapid-fire memorization

export interface ComponentDefinition {
  id: ComponentId;
  description: string;
  constraints?: string; // e.g. "Max 1 per page" or "Requires numeric data"
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
}

export interface ExhibitManifest {
  topic: string;
  gradeLevel: string;
  themeColor: string;
  layout: ManifestItem[];
}