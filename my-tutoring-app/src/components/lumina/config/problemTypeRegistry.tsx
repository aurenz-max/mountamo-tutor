import React from 'react';
import {
  MultipleChoiceProblem,
  TrueFalseProblem,
  FillInBlanksProblem,
  MatchingActivityProblem,
  SequencingActivityProblem,
  CategorizationActivityProblem,
  ScenarioQuestionProblem,
  ShortAnswerProblem
} from '../primitives/problem-primitives';
import { ProblemType } from '../types';

/**
 * Problem Type Configuration
 * Mirrors backend/app/generators/problem_type_schemas.py PROBLEM_TYPE_METADATA
 */
export interface ProblemTypeConfig {
  component: React.ComponentType<any>;
  complexity: 'simple' | 'medium' | 'complex' | 'very_complex';
  bestFor: string;
  description: string;
  exampleUseCase: string;
}

/**
 * Problem Type Registry
 * Maps problem types to their rendering components and metadata
 * This mirrors the backend PROBLEM_TYPE_METADATA structure
 */
export const PROBLEM_TYPE_REGISTRY: Record<ProblemType, ProblemTypeConfig> = {
  multiple_choice: {
    component: MultipleChoiceProblem,
    complexity: 'medium',
    bestFor: 'Comprehension testing, concept assessment, identifying correct answers from options',
    description: 'Present a question with multiple answer choices where one or more are correct',
    exampleUseCase: 'Testing understanding of definitions, facts, or simple applications'
  },

  true_false: {
    component: TrueFalseProblem,
    complexity: 'simple',
    bestFor: 'Quick fact checking, misconception identification, binary understanding',
    description: 'Present a statement that students evaluate as true or false',
    exampleUseCase: 'Verifying basic comprehension or identifying common misconceptions'
  },

  fill_in_blanks: {
    component: FillInBlanksProblem,
    complexity: 'simple',
    bestFor: 'Vocabulary practice, key term recall, context-based learning',
    description: 'Text with missing words that students must fill in',
    exampleUseCase: 'Practicing vocabulary in context or recalling key terms from a passage'
  },

  matching_activity: {
    component: MatchingActivityProblem,
    complexity: 'complex',
    bestFor: 'Building relationships, connecting concepts, pairing terms with definitions',
    description: 'Match items from one column with corresponding items in another',
    exampleUseCase: 'Connecting vocabulary terms to definitions or matching causes to effects'
  },

  sequencing_activity: {
    component: SequencingActivityProblem,
    complexity: 'simple',
    bestFor: 'Process understanding, chronological ordering, step-by-step thinking',
    description: 'Arrange items in the correct order or sequence',
    exampleUseCase: 'Ordering historical events, steps in a process, or stages of development'
  },

  categorization_activity: {
    component: CategorizationActivityProblem,
    complexity: 'complex',
    bestFor: 'Classification skills, grouping by attributes, organizing concepts',
    description: 'Sort items into appropriate categories based on shared characteristics',
    exampleUseCase: 'Classifying animals by species, sorting words by part of speech, or grouping shapes'
  },

  scenario_question: {
    component: ScenarioQuestionProblem,
    complexity: 'complex',
    bestFor: 'Real-world application, critical thinking, contextual problem solving',
    description: 'Present a realistic scenario and ask students to apply their knowledge',
    exampleUseCase: 'Applying scientific concepts to real situations or analyzing historical decisions'
  },

  short_answer: {
    component: ShortAnswerProblem,
    complexity: 'simple',
    bestFor: 'Open-ended responses, explanation practice, brief written expression',
    description: 'Ask students to provide a brief written response to a question',
    exampleUseCase: 'Explaining a concept in their own words or providing reasoning'
  }
};

/**
 * Get problem type configuration
 */
export function getProblemTypeConfig(type: ProblemType): ProblemTypeConfig | undefined {
  return PROBLEM_TYPE_REGISTRY[type];
}

/**
 * Get all available problem types
 */
export function getAllProblemTypes(): ProblemType[] {
  return Object.keys(PROBLEM_TYPE_REGISTRY) as ProblemType[];
}

/**
 * Get problem types by complexity
 */
export function getProblemTypesByComplexity(complexity: 'simple' | 'medium' | 'complex' | 'very_complex'): ProblemType[] {
  return Object.entries(PROBLEM_TYPE_REGISTRY)
    .filter(([_, config]) => config.complexity === complexity)
    .map(([type, _]) => type as ProblemType);
}

/**
 * Problem Renderer Component
 * Dynamically renders the appropriate problem component based on type
 */
interface ProblemRendererProps {
  problemData: any; // Union of all problem data types
  className?: string;
}

export const ProblemRenderer: React.FC<ProblemRendererProps> = ({ problemData, className }) => {
  const config = getProblemTypeConfig(problemData.type);

  if (!config) {
    console.warn(`Unknown problem type: ${problemData.type}`);
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
        Unknown problem type: {problemData.type}
      </div>
    );
  }

  const ProblemComponent = config.component;

  return (
    <div className={className}>
      <ProblemComponent data={problemData} />
    </div>
  );
};

/**
 * Problem Collection Renderer
 * Renders multiple problems with consistent styling
 */
interface ProblemCollectionRendererProps {
  problems: any[]; // Array of problem data
  showProblemNumbers?: boolean;
  containerClassName?: string;
}

export const ProblemCollectionRenderer: React.FC<ProblemCollectionRendererProps> = ({
  problems,
  showProblemNumbers = true,
  containerClassName = ''
}) => {
  return (
    <div className={`space-y-12 ${containerClassName}`}>
      {problems.map((problem, index) => (
        <div key={problem.id || index} className="relative">
          {showProblemNumbers && (
            <div className="absolute -left-12 top-0 text-slate-600 font-mono text-sm">
              {index + 1}.
            </div>
          )}
          <ProblemRenderer problemData={problem} />
        </div>
      ))}
    </div>
  );
};
