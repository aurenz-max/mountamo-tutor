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
        // Enact the question (say it), never point the student at on-screen text —
        // a pre-reader cannot "re-read" anything. (reader-fit Audit B / indirect-script)
        level1:
          '"{{currentQuestion}} — what do you think? Take your time and look at each choice."',
        level2:
          '"Let\'s figure it out together. {{currentQuestion}} '
          + 'Say each choice out loud with me — which one feels right to you?"',
        level3:
          '"Here\'s a clue: think about what we just learned. {{currentQuestion}} '
          + 'Which choice matches that? You pick the one you think is right — you can always try again."',
      },
      commonStruggles: [
        { pattern: 'Student selects an answer very quickly without reading all options', response: 'No rush! Let\'s hear every choice first, then pick the one you like best.' },
        { pattern: 'Student makes the same mistake repeatedly after reset', response: 'Let\'s try it a new way. Listen again: {{currentQuestion}} Which one do you want to try this time?' },
        { pattern: 'Student requests hints without attempting an answer first', response: 'Give it your best try first! Even a guess helps you learn. You can always try again.' },
        { pattern: 'Student is stuck between two plausible options', response: 'Good thinking! Let\'s hear those two choices again — which one sounds right to you?' },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (K / early grade-1)',
          instruction:
            'When you receive [QUIZ_READ_ALOUD], a pre-reader is on this problem and CANNOT read it. '
            + 'Read the question aloud word for word, then read EACH choice slowly with its letter '
            + '(e.g. "A… cat. B… dog."), then ask which one they pick. Reading it all aloud IS your '
            + 'greeting for this problem — this OVERRIDES any instruction to keep it to one sentence. '
            + 'Never say or hint at which choice is correct. '
            + 'When you receive [QUIZ_RETRY], the child tapped a wrong choice: give ONE warm spoken hint '
            + 'without revealing the answer and invite them to tap another picture.',
        },
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
