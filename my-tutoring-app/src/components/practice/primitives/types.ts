/**
 * Unified Problem Primitive Types
 *
 * This file defines the standard interfaces for all problem primitives to ensure consistency
 * across the unified practice system. All primitives should use these interfaces.
 */
import React from 'react';

// Base problem primitive props interface
export interface ProblemPrimitiveProps<TProblem = any, TResponse = any> {
  /** The problem data to render */
  problem: TProblem;

  /** Whether the problem has been submitted and should show results */
  isSubmitted: boolean;

  /** Current student response/answer */
  currentResponse?: TResponse;

  /** Feedback from backend after submission */
  feedback?: any;

  /** Callback when student updates their answer (before submission) */
  onUpdate: (response: TResponse) => void;

  /** Whether submission is currently in progress */
  submitting?: boolean;

  /** Whether the primitive should be disabled for interaction */
  disabled?: boolean;

  /** Whether to disable immediate feedback (for assessments) */
  disableFeedback?: boolean;

  /** Ref to AI Coach for live interaction (optional - present when live_interaction_config is enabled) */
  aiCoachRef?: React.RefObject<{
    sendTargetSelection: (targetId: string) => void;
    sendSubmissionResult: (result: any) => void
  }>;
}

// Specific response types for different problem types
export interface MCQResponse {
  selected_option_id: string;
}

export interface MatchingResponse {
  student_matches: Array<{
    left_id: string;
    right_id: string;
  }>;
}

export interface TrueFalseResponse {
  selected_answer: boolean;
  explanation?: string;
}

export interface FillInBlankResponse {
  student_answers: Array<{
    blank_id: string;
    answer: string;
  }>;
}

export interface SequencingResponse {
  student_sequence: string[];
}

export interface CategorizationResponse {
  student_categorization: Record<string, string>; // item -> category
}

export interface ScenarioQuestionResponse {
  student_answer: string;
}

export interface ShortAnswerResponse {
  student_answer: string;
}

export interface LiveInteractionResponse {
  selected_target_id: string;
  interaction_mode: string;
}

// Problem data types (these should match backend schemas)
export interface MCQProblem {
  id?: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
  }>;
  correct_option_id: string;
  rationale?: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface MatchingProblem {
  id?: string;
  prompt: string;
  left_items: Array<{
    id: string;
    text: string;
    image_url?: string;
    metadata?: any;
  }>;
  right_items: Array<{
    id: string;
    text: string;
    image_url?: string;
    metadata?: any;
  }>;
  mappings: Array<{
    left_id: string;
    right_ids: string[];
    rationale?: string;
  }>;
  allow_many_to_one?: boolean;
  include_distractors?: boolean;
  rationale_global?: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface TrueFalseProblem {
  id?: string;
  statement: string;
  correct: boolean;
  allow_explain_why?: boolean;
  trickiness?: string;
  rationale?: string;
  statement_visual_data?: {
    type: string;
    data: any;
  };
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface FillInBlankProblem {
  id?: string;
  text_with_blanks: string;
  blanks: Array<{
    id: string;
    correct_answers: string[];
    case_sensitive: boolean;
    tolerance?: number;
    hint?: string;
  }>;
  rationale?: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface SequencingProblem {
  id?: string;
  instruction: string;
  items: string[];
  rationale?: string;
  teaching_note?: string;
  success_criteria?: string[];
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface CategorizationProblem {
  id?: string;
  categories: string[];
  categorization_items: Array<{
    item_text: string;
    correct_category: string;
  }>;
  rationale?: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface ScenarioQuestionProblem {
  id?: string;
  scenario: string;
  scenario_question: string;
  scenario_answer: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface ShortAnswerProblem {
  id?: string;
  question: string;
  answer?: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

export interface LiveInteractionProblem {
  id?: string;
  problem_type: 'live_interaction';
  prompt: {
    system: string;
    instruction: string;
    voice?: string;
  };
  // VISUAL CONTENT: Now only contains display_visual (informational content)
  visual_content?: {
    // Display visual (informational layer)
    display_visual?: {
      visual_type: string;
      visual_data: any;
    };
    // LEGACY: Old composite structure (backward compatibility)
    interaction_visual?: {
      visual_type: string;
      visual_data: any;
    };
    // LEGACY: Single visual format (oldest backward compatibility)
    visual_type?: string;
    visual_data?: any;
  };
  // INTERACTION CONFIG: Now includes interaction_visual (NEW LOCATION)
  interaction_config: {
    mode: 'click' | 'speech' | 'drag' | 'trace';
    // NEW: Interaction visual is now part of interaction_config
    interaction_visual?: {
      visual_type: string;
      visual_data: any;
    };
    targets: Array<{
      id: string;
      is_correct: boolean;
      description?: string;
    }>;
  };
  evaluation: {
    success_criteria?: string[];
    feedback: {
      correct: {
        audio: string;
        visual_effect?: string;
      };
      incorrect: {
        audio: string;
        hint?: string;
        visual_effect?: string;
      };
    };
  };
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  metadata?: any;
}

// Specific primitive props interfaces
export interface MCQPrimitiveProps extends ProblemPrimitiveProps<MCQProblem, MCQResponse> {}
export interface MatchingPrimitiveProps extends ProblemPrimitiveProps<MatchingProblem, MatchingResponse> {}
export interface TrueFalsePrimitiveProps extends ProblemPrimitiveProps<TrueFalseProblem, TrueFalseResponse> {}
export interface FillInBlankPrimitiveProps extends ProblemPrimitiveProps<FillInBlankProblem, FillInBlankResponse> {}
export interface SequencingPrimitiveProps extends ProblemPrimitiveProps<SequencingProblem, SequencingResponse> {}
export interface CategorizationPrimitiveProps extends ProblemPrimitiveProps<CategorizationProblem, CategorizationResponse> {}
export interface ScenarioQuestionPrimitiveProps extends ProblemPrimitiveProps<ScenarioQuestionProblem, ScenarioQuestionResponse> {}
export interface ShortAnswerPrimitiveProps extends ProblemPrimitiveProps<ShortAnswerProblem, ShortAnswerResponse> {}
export interface LiveInteractionPrimitiveProps extends ProblemPrimitiveProps<LiveInteractionProblem, LiveInteractionResponse> {
  aiCoachRef?: React.RefObject<{ sendTargetSelection: (targetId: string) => void }>;
}