'use client';

import React, { useImperativeHandle, forwardRef } from 'react';
import ComposableProblemComponent from './ComposableProblemComponent';
import DrawingProblemComponent from './DrawingProblemComponent';
import { authApi } from '@/lib/authApiClient';

// Import the unified primitives
import {
  MCQPrimitive,
  MatchingPrimitive,
  TrueFalsePrimitive,
  FillInBlankPrimitive,
  SequencingPrimitive,
  CategorizationPrimitive,
  ScenarioQuestionPrimitive,
  ShortAnswerPrimitive
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
  prompt?: string;
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
    item_text: string;
    correct_category: string;
  }>;
  // Scenario question fields
  scenario?: string;
  scenario_question?: string;
  scenario_answer?: string;
  // Short answer fields - question field already exists above
}

type ProblemType = 'mcq' | 'fillInBlank' | 'matching' | 'trueFalse' | 'sequencing' | 'categorization' | 'scenarioQuestion' | 'shortAnswer' | 'composable' | 'drawing';

interface ProblemRendererProps {
  problem: Problem;
  isSubmitted: boolean;
  onSubmit: (submission: any) => Promise<void>;
  onUpdate?: (value: any) => void;
  currentResponse?: any;
  feedback?: any;
  submitting?: boolean;
}

interface ProblemRendererRef {
  submitProblem: () => Promise<void>;
}

// Clean problem type detection
const getProblemType = (problem: Problem): ProblemType => {
  if (problem.question && problem.options) return 'mcq';
  if (problem.text_with_blanks && problem.blanks) return 'fillInBlank';
  if (problem.prompt && problem.left_items && problem.right_items) return 'matching';
  if (problem.statement && problem.correct !== undefined) return 'trueFalse';
  if (problem.instruction && problem.items) return 'sequencing';
  if (problem.categories && problem.categorization_items) return 'categorization';
  if (problem.scenario && problem.scenario_question) return 'scenarioQuestion';
  if (problem.question && !problem.options && !problem.text_with_blanks) return 'shortAnswer';
  if (problem.interaction) return 'composable';
  return 'drawing'; // fallback
};

const ProblemRenderer = forwardRef<ProblemRendererRef, ProblemRendererProps>((
  {
    problem,
    isSubmitted,
    onSubmit,
    onUpdate,
    currentResponse,
    feedback,
    submitting = false
  },
  ref
) => {
  const problemType = getProblemType(problem);

  const handleSubmission = async () => {
    // For MCQ problems
    if (problemType === 'mcq' && currentResponse?.selected_option_id) {
      const mcqSubmission = {
        mcq: problem,
        selected_option_id: currentResponse.selected_option_id
      };
      
      console.log('=== MCQ SUBMISSION ===');
      console.log('Submitting MCQ:', mcqSubmission);
      
      const mcqReview = await authApi.submitMCQ(mcqSubmission);
      
      // Convert MCQ review to standard feedback format
      const review = {
        evaluation: { score: mcqReview.is_correct ? 10 : 0 },
        feedback: {
          praise: mcqReview.is_correct ? "Correct! Well done!" : "Not quite right, but good try!",
          guidance: mcqReview.explanation || problem.rationale,
          encouragement: mcqReview.is_correct ? "Keep up the great work!" : "Review the explanation and try similar problems."
        },
        correct: mcqReview.is_correct,
        score: mcqReview.is_correct ? 10 : 0,
        accuracy_percentage: mcqReview.is_correct ? 100 : 0
      };
      
      await onSubmit({ review, mcqReview });
      return;
    }
    
    // For Fill-in-the-Blank problems
    if (problemType === 'fillInBlank' && currentResponse?.student_answers) {
      const fibSubmission = {
        fill_in_blank: problem,
        student_answers: currentResponse.student_answers
      };
      
      console.log('=== FILL-IN-THE-BLANK SUBMISSION ===');
      console.log('Submitting Fill-in-the-Blank:', fibSubmission);
      
      const fibReview = await authApi.submitFillInBlank(fibSubmission);
      
      // Convert Fill-in-the-Blank review to standard feedback format
      const review = {
        evaluation: { score: fibReview.total_score },
        feedback: {
          praise: fibReview.overall_correct ? "Excellent! All blanks correct!" : "Good effort! Some answers need work.",
          guidance: fibReview.explanation,
          encouragement: fibReview.overall_correct ? "Keep up the fantastic work!" : "Review the explanations and try similar problems."
        },
        correct: fibReview.overall_correct,
        score: fibReview.total_score,
        accuracy_percentage: fibReview.percentage_correct
      };
      
      await onSubmit({ review, fibReview });
      return;
    }
    
    // For True/False problems
    if (problemType === 'trueFalse' && currentResponse?.selected_answer !== undefined) {
      const trueFalseSubmission = {
        true_false: problem,
        selected_answer: currentResponse.selected_answer,
        ...(problem.allow_explain_why && currentResponse.explanation && { explanation: currentResponse.explanation })
      };
      
      console.log('=== TRUE/FALSE SUBMISSION ===');
      console.log('Submitting True/False:', trueFalseSubmission);
      
      const trueFalseReview = await authApi.submitTrueFalse(trueFalseSubmission);
      
      // Convert True/False review to standard feedback format
      const review = {
        evaluation: { score: trueFalseReview.is_correct ? 10 : 0 },
        feedback: {
          praise: trueFalseReview.is_correct ? "Correct! Well done!" : "Not quite right, but good effort!",
          guidance: trueFalseReview.explanation,
          encouragement: trueFalseReview.is_correct ? "Keep up the great work!" : "Review the explanation and try similar problems."
        },
        correct: trueFalseReview.is_correct,
        score: trueFalseReview.is_correct ? 10 : 0,
        accuracy_percentage: trueFalseReview.is_correct ? 100 : 0
      };
      
      await onSubmit({ review, trueFalseReview });
      return;
    }
    
    // For Matching problems
    if (problemType === 'matching' && currentResponse?.student_matches) {
      const matchingSubmission = {
        matching: problem,
        student_matches: currentResponse.student_matches
      };
      
      console.log('=== MATCHING SUBMISSION ===');
      console.log('Submitting Matching:', matchingSubmission);
      
      const matchingReview = await authApi.submitMatching(matchingSubmission);
      
      // Convert Matching review to standard feedback format
      const review = {
        evaluation: { score: matchingReview.total_score },
        feedback: {
          praise: matchingReview.overall_correct ? "Perfect Match! All correct!" : "Good effort! Some matches need work.",
          guidance: matchingReview.explanation,
          encouragement: matchingReview.overall_correct ? "Keep up the fantastic work!" : "Review the explanations and try similar matching problems."
        },
        correct: matchingReview.overall_correct,
        score: matchingReview.total_score,
        accuracy_percentage: matchingReview.percentage_correct
      };
      
      await onSubmit({ review, matchingReview });
      return;
    }
    
    // For Sequencing problems
    if (problemType === 'sequencing' && currentResponse?.student_sequence) {
      const sequencingSubmission = {
        sequencing: problem,
        student_sequence: currentResponse.student_sequence
      };
      
      console.log('=== SEQUENCING SUBMISSION ===');
      console.log('Submitting Sequencing:', sequencingSubmission);
      
      const sequencingReview = await authApi.submitSequencing(sequencingSubmission);
      
      // Convert Sequencing review to standard feedback format
      const review = {
        evaluation: { score: sequencingReview.total_score },
        feedback: {
          praise: sequencingReview.is_correct ? "Perfect Sequence!" : "Good effort! Some ordering needs work.",
          guidance: sequencingReview.explanation,
          encouragement: sequencingReview.is_correct ? "Keep up the fantastic work!" : "Review the explanations and try similar sequencing problems."
        },
        correct: sequencingReview.is_correct,
        score: sequencingReview.total_score,
        accuracy_percentage: sequencingReview.percentage_correct
      };
      
      await onSubmit({ review, sequencingReview });
      return;
    }
    
    // For Categorization problems
    if (problemType === 'categorization' && currentResponse?.student_categorization) {
      const categorizationSubmission = {
        categorization: problem,
        student_categorization: currentResponse.student_categorization
      };
      
      console.log('=== CATEGORIZATION SUBMISSION ===');
      console.log('Submitting Categorization:', categorizationSubmission);
      
      const categorizationReview = await authApi.submitCategorization(categorizationSubmission);
      
      // Convert Categorization review to standard feedback format
      const review = {
        evaluation: { score: categorizationReview.total_score },
        feedback: {
          praise: categorizationReview.is_correct ? "Perfect Categorization!" : "Good effort! Some categories need work.",
          guidance: categorizationReview.explanation,
          encouragement: categorizationReview.is_correct ? "Keep up the fantastic work!" : "Review the explanations and try similar categorization problems."
        },
        correct: categorizationReview.is_correct,
        score: categorizationReview.total_score,
        accuracy_percentage: categorizationReview.percentage_correct
      };
      
      await onSubmit({ review, categorizationReview });
      return;
    }
    
    // For Scenario Question problems
    if (problemType === 'scenarioQuestion' && currentResponse?.student_answer) {
      const scenarioSubmission = {
        scenario_question: problem,
        student_answer: currentResponse.student_answer
      };
      
      console.log('=== SCENARIO QUESTION SUBMISSION ===');
      console.log('Submitting Scenario Question:', scenarioSubmission);
      
      const scenarioReview = await authApi.submitScenarioQuestion(scenarioSubmission);
      
      // Convert Scenario review to standard feedback format
      const review = {
        evaluation: { score: scenarioReview.score },
        feedback: {
          praise: scenarioReview.is_correct ? "Excellent Answer!" : "Good effort!",
          guidance: scenarioReview.explanation,
          encouragement: scenarioReview.is_correct ? "Keep up the fantastic work!" : "Review the feedback and try similar scenario problems."
        },
        correct: scenarioReview.is_correct,
        score: scenarioReview.score,
        accuracy_percentage: scenarioReview.similarity_score
      };
      
      await onSubmit({ review, scenarioReview });
      return;
    }
    
    // For Short Answer problems
    if (problemType === 'shortAnswer' && currentResponse?.student_answer) {
      const shortAnswerSubmission = {
        short_answer: problem,
        student_answer: currentResponse.student_answer
      };
      
      console.log('=== SHORT ANSWER SUBMISSION ===');
      console.log('Submitting Short Answer:', shortAnswerSubmission);
      
      const shortAnswerReview = await authApi.submitShortAnswer(shortAnswerSubmission);
      
      // Convert Short Answer review to standard feedback format
      const review = {
        evaluation: { score: shortAnswerReview.score },
        feedback: {
          praise: shortAnswerReview.score >= 7 ? "Great Answer!" : "Good effort!",
          guidance: shortAnswerReview.explanation,
          encouragement: shortAnswerReview.score >= 7 ? "Keep up the fantastic work!" : "Review the feedback and try similar problems."
        },
        correct: shortAnswerReview.is_correct,
        score: shortAnswerReview.score,
        accuracy_percentage: shortAnswerReview.score * 10
      };
      
      await onSubmit({ review, shortAnswerReview });
      return;
    }
    
    // For other problem types (composable, drawing)
    await onSubmit({
      primitive_response: currentResponse,
      student_answer: JSON.stringify(currentResponse || '')
    });
  };

  // Expose the submit function to parent via ref
  useImperativeHandle(ref, () => ({
    submitProblem: handleSubmission
  }));

  switch (problemType) {
    case 'mcq':
      return (
        <MCQPrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'fillInBlank':
      return (
        <FillInBlankPrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'trueFalse':
      return (
        <TrueFalsePrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'matching':
      return (
        <MatchingPrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'sequencing':
      return (
        <SequencingPrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'categorization':
      return (
        <CategorizationPrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'scenarioQuestion':
      return (
        <ScenarioQuestionPrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'shortAnswer':
      return (
        <ShortAnswerPrimitive
          problem={problem}
          isSubmitted={isSubmitted}
          currentResponse={currentResponse}
          feedback={feedback}
          onUpdate={onUpdate}
          disabled={submitting}
        />
      );

    case 'composable':
      return (
        <ComposableProblemComponent
          problem={problem}
          isSubmitted={isSubmitted}
          onSubmit={handleSubmission}
          onUpdate={onUpdate}
          currentResponse={currentResponse}
          feedback={feedback}
          submitting={submitting}
        />
      );

    case 'drawing':
    default:
      return (
        <DrawingProblemComponent
          problem={problem}
          isSubmitted={isSubmitted}
          onSubmit={handleSubmission}
          feedback={feedback}
          submitting={submitting}
        />
      );
  }
});

ProblemRenderer.displayName = 'ProblemRenderer';

export { ProblemRenderer as default, type ProblemRendererProps, type ProblemRendererRef };