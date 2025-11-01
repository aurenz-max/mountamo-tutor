'use client';

import React, { useImperativeHandle, forwardRef } from 'react';
import ComposableProblemComponent from './ComposableProblemComponent';
import DrawingProblemComponent from './DrawingProblemComponent';

// Import the unified primitives
import {
  MCQPrimitive,
  MatchingPrimitive,
  TrueFalsePrimitive,
  FillInBlankPrimitive,
  SequencingPrimitive,
  CategorizationPrimitive,
  ScenarioQuestionPrimitive,
  ShortAnswerPrimitive,
  LiveInteractionPrimitive
} from './primitives';

interface Problem {
  problem_id?: string;
  problem_type?: string;
  prompt?: string;
  problem?: string;
  answer?: string;
  interaction?: {
    type: string;
    parameters: any;
  };
  success_criteria?: string[];
  teaching_note?: string;
  learning_objective?: string;
  metadata?: {
    skill?: {
      id?: string;
      description?: string;
    };
    subskill?: {
      id?: string;
      description?: string;
    };
    difficulty?: number;
    concept_group?: string;
  };
  // MCQ fields
  id?: string;
  subject?: string;
  unit_id?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  question?: string;
  options?: Array<{
    id: string;
    text: string;
  }>;
  correct_option_id?: string;
  rationale?: string;
  // Fill-in-the-blank fields
  text_with_blanks?: string;
  blanks?: Array<{
    id: string;
    correct_answers: string[];
    case_sensitive: boolean;
    tolerance?: number;
    hint?: string;
  }>;
  // Matching fields
  left_items?: Array<{
    id: string;
    text: string;
    image_url?: string;
    metadata?: any;
  }>;
  right_items?: Array<{
    id: string;
    text: string;
    image_url?: string;
    metadata?: any;
  }>;
  mappings?: Array<{
    left_id: string;
    right_ids: string[];
    rationale?: string;
  }>;
  allow_many_to_one?: boolean;
  include_distractors?: boolean;
  rationale_global?: string;
  // True/False fields
  statement?: string;
  correct?: boolean;
  allow_explain_why?: boolean;
  trickiness?: string;
  // Sequencing fields
  instruction?: string;
  items?: string[];
  // Categorization fields
  categories?: string[];
  categorization_items?: Array<{
    id: string;
    text: string;
    correct_category: string;
    image_url?: string;
  }>;
  // Scenario Question fields
  scenario?: string;
  // Short Answer fields
  // (uses common fields like question, correct answer patterns, etc.)
}

export interface ProblemRendererRef {
  submitProblem: () => Promise<void>;
}

interface ProblemRendererProps {
  problem: Problem;
  isSubmitted: boolean;
  onSubmit: (data: any) => Promise<void>;
  onUpdate: (data: any) => void;
  currentResponse: any;
  feedback: any;
  submitting: boolean;
  isAssessmentMode?: boolean; // New prop for assessment mode
}

// Helper function to map backend problem types to frontend component keys
const getProblemType = (problem: Problem): string => {
  // 1. Prioritize the explicit problem_type from the backend
  if (problem.problem_type) {
    switch (problem.problem_type) {
      case 'multiple_choice':
        return 'mcq';
      case 'true_false':
        return 'trueFalse';
      case 'fill_in_blanks':
        return 'fillInBlank';
      case 'matching_activity':
        return 'matching';
      case 'sequencing_activity':
        return 'sequencing';
      case 'categorization_activity':
        return 'categorization';
      case 'scenario_question':
        return 'scenarioQuestion';
      case 'short_answer':
        return 'shortAnswer';
      case 'live_interaction':
        return 'liveInteraction';
      case 'composable':
      case 'interactive':
        return 'composable';
    }
  }

  // 2. Check for interactive problem based on interaction type
  if (problem.interaction?.type) {
    return 'composable';
  }

  // 3. Fallback to legacy "duck typing" for backward compatibility
  if (problem.options && problem.correct_option_id) return 'mcq';
  if (problem.text_with_blanks && problem.blanks) return 'fillInBlank';
  if (problem.left_items && problem.right_items) return 'matching';
  if (problem.statement && problem.correct !== undefined) return 'trueFalse';
  if (problem.items && problem.instruction) return 'sequencing';
  if (problem.categories && problem.categorization_items) return 'categorization';
  if (problem.scenario) return 'scenarioQuestion';

  // 4. Default to the drawing component
  console.warn("Could not determine specific problem type, defaulting to 'drawing'. Problem data:", problem);
  return 'drawing';
};

const ProblemRenderer = forwardRef<ProblemRendererRef, ProblemRendererProps>(
  (
    { problem, isSubmitted, onSubmit, onUpdate, currentResponse, feedback, submitting, isAssessmentMode = false },
    ref
  ) => {
    const problemType = getProblemType(problem);

    const handleSubmission = async () => {
      console.log('=== UNIFIED PROBLEM SUBMISSION ===');
      console.log('Problem type:', problemType);
      console.log('Current response:', currentResponse);
      
      // For all structured problems, pass the response data to the unified handler
      if (currentResponse) {
        await onSubmit({
          primitive_response: currentResponse,
          student_answer: JSON.stringify(currentResponse),
          canvas_used: false
        });
        return;
      }
      
      // For problems without a response (shouldn't happen), show error
      throw new Error('No response data available for submission');
    };

    useImperativeHandle(ref, () => ({
      submitProblem: handleSubmission
    }));

    const handleUpdate = (data: any) => {
      onUpdate(data);
    };

    // Render the appropriate component based on problem type
    switch (problemType) {
      case 'mcq':
        return (
          <MCQPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'fillInBlank':
        return (
          <FillInBlankPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'matching':
        return (
          <MatchingPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'trueFalse':
        return (
          <TrueFalsePrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'sequencing':
        return (
          <SequencingPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'categorization':
        return (
          <CategorizationPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'scenarioQuestion':
        return (
          <ScenarioQuestionPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'shortAnswer':
        return (
          <ShortAnswerPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'liveInteraction':
        return (
          <LiveInteractionPrimitive
            problem={problem}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            currentResponse={currentResponse}
            disableFeedback={isAssessmentMode}
          />
        );

      case 'composable':
        return (
          <ComposableProblemComponent
            problem={problem}
            onSubmit={onSubmit}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            submitting={submitting}
          />
        );

      case 'drawing':
      default:
        return (
          <DrawingProblemComponent
            problem={problem}
            onSubmit={onSubmit}
            onUpdate={handleUpdate}
            isSubmitted={isSubmitted}
            feedback={feedback}
            submitting={submitting}
          />
        );
    }
  }
);

ProblemRenderer.displayName = 'ProblemRenderer';

export default ProblemRenderer;