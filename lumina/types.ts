
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
  title: string; // e.g. "Diagramming the Sentence"
  description: string;
  parts: SentencePart[];
}

// Module C: Math Tool Visuals
export type MathVisualType = 'bar-model' | 'number-line' | 'base-ten-blocks' | 'fraction-circles' | 'geometric-shape';

export interface MathVisualData {
  type: 'math-visual';
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
  title: string;
  description: string;
  svgCode: string;
}

// Module E: Custom Web (Libraries)
export interface CustomWebData {
  type: 'custom-web';
  title: string;
  description: string;
  library: 'chart.js' | 'd3' | 'echarts' | 'roughjs' | 'mermaid' | 'tone.js';
  html: string;
  script: string;
}

// Union Type for the Exhibit
export type SpecializedExhibit = EquationData | SentenceSchemaData | MathVisualData | CustomSVGData | CustomWebData;

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

export interface KnowledgeCheckData {
  question: string;
  options: QuizOption[];
  correctAnswerId: string;
  explanation: string;
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

export interface ExhibitData {
  topic: string;
  intro: IntroData; 
  modularExhibit?: SpecializedExhibit; // Polymorphic field
  featureExhibit: FeatureExhibitData;
  comparison: ComparisonData; 
  cards: ConceptCardData[];
  tables: TableData[];
  knowledgeCheck: KnowledgeCheckData;
  relatedTopics: RelatedTopic[];
}