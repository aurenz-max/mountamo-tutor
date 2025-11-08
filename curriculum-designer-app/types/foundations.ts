/**
 * TypeScript types for AI Foundations System
 * Matches backend Pydantic models from curriculum-authoring-service
 */

// Character type for Context Primitives
export interface Character {
  name: string;
  age?: number;
  role?: string;
}

// Comparison Pair type for Context Primitives
export interface ComparisonPair {
  attribute: string;
  examples: string[];
}

// Category type for Context Primitives
export interface Category {
  name: string;
  items: string[];
}

// Attribute type for Context Primitives
export interface Attribute {
  name: string;
  values: string[];
}

// Master Context - Core conceptual understanding of a subskill
export interface MasterContext {
  core_concepts: string[];              // 4-6 key concepts
  key_terminology: Record<string, string>;  // term → definition mapping
  learning_objectives: string[];        // 4-6 learning objectives
  difficulty_level: string;             // difficulty descriptor
  grade_level: string;                  // grade level descriptor
  prerequisites: string[];              // prerequisite skills
  real_world_applications: string[];   // practical applications
}

// Context Primitives - 11 variety elements for problem generation
export interface ContextPrimitives {
  concrete_objects: string[];           // Physical objects (buildings, furniture, etc.)
  living_things: string[];              // Animals, plants, organisms
  locations: string[];                  // Settings and places
  tools: string[];                      // Instruments and equipment
  characters: Character[];              // People with names, ages, roles
  scenarios: string[];                  // Situations and contexts
  comparison_pairs: ComparisonPair[];   // Attributes with example pairs
  categories: Category[];               // Named groups with items
  sequences: string[][];                // Ordered arrays (steps, timelines)
  action_words: string[];               // Verbs for problem contexts
  attributes: Attribute[];              // Properties with possible values
}

// Complete Foundations Data Package
export interface FoundationsData {
  subskill_id: string;
  version_id: string;
  master_context: MasterContext;
  context_primitives: ContextPrimitives;
  approved_visual_schemas: string[];
  generation_status: 'pending' | 'generated' | 'edited';
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
}

// Foundation Status Response
export interface FoundationStatus {
  subskill_id: string;
  version_id: string;
  has_foundations: boolean;
  generation_status?: 'pending' | 'generated' | 'edited';
  last_updated?: string;
}

// Visual Schema Category
export interface VisualSchemaCategory {
  category: string;
  schemas: string[];
  description: string;
}

// Visual Schemas Response
export interface VisualSchemasResponse {
  categories: VisualSchemaCategory[];
  all_schemas: string[];
}

// API Response wrapper
export interface FoundationsApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// Request body for saving foundations
export interface SaveFoundationsRequest {
  master_context: MasterContext;
  context_primitives: ContextPrimitives;
  approved_visual_schemas: string[];
}
