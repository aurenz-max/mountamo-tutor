/**
 * Assessment Catalog - Component definitions for knowledge assessment primitives
 *
 * Contains components for quizzes, knowledge checks, and learning assessment.
 */

import { ComponentDefinition } from '../../../types';

export const ASSESSMENT_CATALOG: ComponentDefinition[] = [
  {
    id: 'knowledge-check',
    description: 'Assessment checkpoint with single or multiple problems of various types (multiple choice, true/false, fill-in-blanks, matching, sequencing, categorization, scenario, short answer).',
    constraints: 'Typically one per exhibit, at the end',
    tutoring: {
      taskDescription:
        'Guide the student through an assessment checkpoint. '
        + 'Problem count: {{problemCount}}. Current problem: {{currentProblemIndex}} of {{problemCount}}. '
        + 'Problem type: {{currentProblemType}}. Question: "{{currentQuestion}}". '
        + 'The student must answer each problem. Encourage careful thinking without revealing answers.',
      contextKeys: [
        'problemCount', 'currentProblemIndex', 'currentProblemType',
        'currentQuestion', 'attemptNumber', 'lastAnswerCorrect',
        'completedCount', 'correctCount',
      ],
      scaffoldingLevels: {
        level1:
          '"Read the question carefully. What do you already know about this topic?"',
        level2:
          '"Let\'s break this down. Think about {{currentQuestion}} — '
          + 'what key words or concepts stand out? Can you eliminate any options that don\'t fit?"',
        level3:
          '"Let me walk you through this step by step. First, re-read the question. '
          + 'Now think about what we learned earlier in the lesson. '
          + 'Focus on the most important detail in the question and match it to what you know."',
      },
      commonStruggles: [
        { pattern: 'Student selects an answer very quickly without reading all options', response: 'Slow down and read every option before choosing. Sometimes the best answer isn\'t the first one you see.' },
        { pattern: 'Student makes the same mistake repeatedly after reset', response: 'Let\'s try a different approach. Instead of jumping to an answer, tell me what the question is asking in your own words.' },
        { pattern: 'Student requests hints without attempting an answer first', response: 'Give it your best try first! Even a guess helps you learn. You can always try again.' },
        { pattern: 'Student is stuck between two plausible options', response: 'Good narrowing! Now compare those two options side by side. Which one more precisely answers what the question is asking?' },
      ],
      aiDirectives: [
        {
          title: 'ANSWER FEEDBACK',
          instruction:
            'When you receive [ANSWER_CORRECT], briefly celebrate the student\'s success. '
            + 'Reinforce WHY the answer is correct in 1-2 sentences. Do not be overly verbose. '
            + 'If there are more problems, smoothly transition to encouraging them for the next one.',
        },
        {
          title: 'INCORRECT ANSWER GUIDANCE',
          instruction:
            'When you receive [ANSWER_INCORRECT], do NOT reveal the correct answer. '
            + 'Provide encouragement and a focused hint based on the scaffolding level. '
            + 'If the student has attempted multiple times, escalate to a more specific hint '
            + 'but still do not give the answer directly.',
        },
        {
          title: 'HINT WALKTHROUGH',
          instruction:
            'When you receive [HINT_REQUESTED], provide a progressive hint based on the level indicated. '
            + 'Level 1: Ask a guiding question to redirect thinking. '
            + 'Level 2: Break the problem into smaller parts and point to key details. '
            + 'Level 3: Walk through the reasoning step by step, stopping just short of the answer. '
            + 'NEVER reveal the correct answer in any hint level.',
        },
        {
          title: 'PROBLEM INTRODUCTION',
          instruction:
            'When you receive [PROBLEM_SHOWN], briefly read the question aloud in an encouraging way. '
            + 'For multi-problem sets, acknowledge the student\'s progress. '
            + 'Keep it to 1-2 sentences. Do NOT hint at the answer.',
        },
        {
          title: 'ASSESSMENT COMPLETION',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate the student\'s effort. '
            + 'Mention how many they got correct out of the total. '
            + 'Highlight their growth if they improved over multiple attempts. '
            + 'Keep it to 2-3 encouraging sentences.',
        },
        {
          title: 'SCRATCH PAD WORK REVIEW',
          instruction:
            'When you receive [SCRATCH_PAD_ANALYSIS], the student has used the scratch pad '
            + 'to work through the problem by hand. The message includes a Gemini Flash Lite '
            + 'vision analysis of their handwritten work (summary, feedback, LaTeX if any, next steps). '
            + 'Use this context to give more targeted guidance: acknowledge their work, '
            + 'address any errors spotted in their scratch work, and connect their working '
            + 'to the current problem. Do NOT repeat the analysis verbatim — weave it naturally '
            + 'into your tutoring. If their scratch work shows a correct approach, encourage them '
            + 'to apply it to select the answer.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'recall',
        label: 'Recall (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity'],
        description: 'Fact retrieval: "What is X?" — definitions, simple recognition, obvious distractors.',
      },
      {
        evalMode: 'apply',
        label: 'Apply (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity', 'sequencing_activity'],
        description: 'Application: "Use X to solve Y" — standard problems, plausible procedural-error distractors.',
      },
      {
        evalMode: 'analyze',
        label: 'Analyze (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['multiple_choice', 'fill_in_blanks', 'sequencing_activity', 'categorization_activity'],
        description: 'Analysis: "Why does X happen?" — multi-step reasoning, highly plausible distractors, 4-5 options.',
      },
      {
        evalMode: 'evaluate',
        label: 'Evaluate (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 4,
        challengeTypes: ['multiple_choice', 'fill_in_blanks', 'categorization_activity'],
        description: 'Evaluation: "Which approach is best?" — expert reasoning, defensible-but-inferior distractors, 5 options.',
      },
    ],
  },
  {
    id: 'scale-spectrum',
    description: 'Interactive spectrum for placing items along a continuum. Use for teaching nuanced judgments, degrees of intensity, moral/ethical reasoning, or comparative analysis.',
    constraints: 'Best for middle-school and above. Requires items that can be meaningfully positioned on a spectrum.'
  },
];
