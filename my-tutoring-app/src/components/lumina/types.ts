
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

// Module A: Math/Science Formula (Legacy/Fallback)
export interface FormulaSegment {
  text: string;
  meaning?: string;
  isVariable: boolean;
}

export interface EquationData {
  type: 'equation'; // Discriminator
  title: string;
  description: string;
  segments: FormulaSegment[];
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

export interface GraphBoardData {
  title: string;
  description: string;
  initialPoints?: { x: number; y: number }[];
  gridRange?: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface ExhibitData {
  topic: string;
  intro: IntroData;
  specializedExhibits?: SpecializedExhibit[];
  featureExhibit: FeatureExhibitData;
  comparison: ComparisonData;
  cards: ConceptCardData[];
  tables: TableData[];
  graphBoards?: GraphBoardData[];
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

  // Math & Science Engines
  | 'formula-card'       // LaTeX/Math display
  | 'math-visual'        // Your React math primitives (blocks, circles, etc.)
  | 'custom-visual'      // The SVG/HTML wildcard

  // Assessment
  | 'knowledge-check';   // Quiz

export interface ComponentDefinition {
  id: ComponentId;
  description: string;
  constraints?: string; // e.g. "Max 1 per page" or "Requires numeric data"
}

export interface ManifestItem {
  componentId: ComponentId;
  instanceId: string; // Unique ID for the builder to use later
  title: string;      // The heading for this section
  intent: string;     // Instructions for the content generator
  config?: any;       // Optional hints (e.g., { visualType: 'bar-model' })
}

export interface ExhibitManifest {
  topic: string;
  gradeLevel: string;
  themeColor: string;
  layout: ManifestItem[];
}