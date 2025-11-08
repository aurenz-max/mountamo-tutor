/**
 * TypeScript types for Content Generation System
 * Matches backend Pydantic models from curriculum-authoring-service
 */

// ==================== INTERACTIVE PRIMITIVES ====================

// Alert/Callout
export interface AlertPrimitive {
  type: 'alert';
  style: 'info' | 'warning' | 'success' | 'tip';
  title: string;
  content: string;
}

// Quiz/Quick Check
export interface QuizPrimitive {
  type: 'quiz';
  question: string;
  answer: string;
  explanation?: string;
}

// Definition/Glossary Term
export interface DefinitionPrimitive {
  type: 'definition';
  term: string;
  definition: string;
}

// Expandable/Accordion Item
export interface ExpandablePrimitive {
  type: 'expandable';
  title: string;
  content: string;
}

// Checklist Item
export interface ChecklistPrimitive {
  type: 'checklist';
  text: string;
  completed?: boolean;
}

// Table
export interface TablePrimitive {
  type: 'table';
  headers: string[];
  rows: string[][];
}

// Key-Value Pair
export interface KeyValuePrimitive {
  type: 'keyvalue';
  key: string;
  value: string;
}

// Interactive Timeline
export interface TimelinePrimitive {
  type: 'interactive_timeline';
  title: string;
  events: Array<{
    date: string;
    title: string;
    description: string;
  }>;
}

// Carousel/Step-by-Step
export interface CarouselPrimitive {
  type: 'carousel';
  title?: string;
  items: Array<{
    image_url: string;
    alt_text: string;
    caption?: string;
    description?: string;
  }>;
}

// Flip Card
export interface FlipCardPrimitive {
  type: 'flip_card';
  front_content: string;
  back_content: string;
}

// Categorization Activity
export interface CategorizationPrimitive {
  type: 'categorization';
  instruction: string;
  categories: string[];
  items: Array<{
    item_text: string;
    correct_category: string;
  }>;
}

// Fill in the Blank
export interface FillInTheBlankPrimitive {
  type: 'fill_in_the_blank';
  sentence: string;
  correct_answer: string;
  hint?: string;
}

// Scenario Question
export interface ScenarioQuestionPrimitive {
  type: 'scenario_question';
  scenario: string;
  question: string;
  answer_options?: string[];
  correct_answer: string;
  explanation: string;
}

// Union type for all interactive primitives
export type InteractivePrimitive =
  | AlertPrimitive
  | QuizPrimitive
  | DefinitionPrimitive
  | ExpandablePrimitive
  | ChecklistPrimitive
  | TablePrimitive
  | KeyValuePrimitive
  | TimelinePrimitive
  | CarouselPrimitive
  | FlipCardPrimitive
  | CategorizationPrimitive
  | FillInTheBlankPrimitive
  | ScenarioQuestionPrimitive;

// ==================== READING CONTENT ====================

// Individual section of reading content
export interface ReadingSection {
  section_id: string;
  section_order: number;
  heading: string;
  content_text: string;
  key_terms: string[];
  concepts_covered: string[];
  interactive_primitives: InteractivePrimitive[];
  has_visual_snippet: boolean;
  created_at: string;
  updated_at: string;
}

// Complete reading content package
export interface ReadingContent {
  subskill_id: string;
  version_id: string;
  title: string;
  sections: ReadingSection[];
  generation_status: 'pending' | 'generated' | 'edited';
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== VISUAL SNIPPETS ====================

// Visual snippet/HTML visualization
export interface VisualSnippet {
  snippet_id: string;
  subskill_id: string;
  section_id: string;
  html_content: string;
  generation_prompt?: string;
  created_at: string;
  updated_at: string;
}

// ==================== API REQUESTS/RESPONSES ====================

// Generate content request
export interface GenerateContentRequest {
  use_foundations?: boolean;
}

// Regenerate section request
export interface RegenerateSectionRequest {
  custom_prompt?: string;
}

// Update section request (all fields optional)
export interface UpdateSectionRequest {
  heading?: string;
  content_text?: string;
  key_terms?: string[];
  concepts_covered?: string[];
  interactive_primitives?: InteractivePrimitive[];
}

// Generate visual snippet request
export interface GenerateVisualRequest {
  section_id: string;
  custom_prompt?: string;
}

// Update visual snippet request
export interface UpdateVisualRequest {
  html_content: string;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ==================== UI STATE TYPES ====================

// Section editing state
export interface SectionEditState {
  isEditing: boolean;
  isRegenerating: boolean;
  customPrompt: string;
}

// Visual snippet modal state
export interface VisualModalState {
  isOpen: boolean;
  isGenerating: boolean;
  isEditing: boolean;
  snippet: VisualSnippet | null;
  error?: string;
}

// Content generation status
export type GenerationStatus = 'idle' | 'generating' | 'generated' | 'error';
