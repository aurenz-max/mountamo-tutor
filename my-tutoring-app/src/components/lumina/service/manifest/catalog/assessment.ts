/**
 * Assessment Catalog - Component definitions for knowledge assessment primitives
 *
 * Contains components for quizzes, knowledge checks, and learning assessment.
 */

import { ComponentDefinition } from '../../../types';
import { bossEntry } from '../../../components/live-activity/boss';
import { knowledgeCheckCard } from '../../../primitives/knowledgeCheck.card';

export const ASSESSMENT_CATALOG: ComponentDefinition[] = [
  {
    id: 'knowledge-check',
    description:
      'Assessment checkpoint with single or multiple problems of various types (multiple choice, true/false, '
      + 'fill-in-blanks, matching, sequencing, categorization). SPOKEN-FIRST: the Live tutor reads each '
      + 'question aloud (and the choices, where there are choices) and the student ANSWERS OUT LOUD; the answer is '
      + 'judged from the audio and a credited answer advances. Symbol/KaTeX choices are answered by touching the one you '
      + 'mean, and a problem that cannot be asked aloud is worked on the screen.',
    constraints: 'Typically one per exhibit, at the end. The spoken form requires the live tutor and a microphone.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'tap', 'manipulate'], role: 'assess', minutes: 4, maxPerLesson: 1 },
    supportsEvaluation: true,
    // The live wiring is the boss card (`primitives/knowledgeCheck.card.ts`); the behavior is `knowledgeCheck.boss.ts`.
    ...bossEntry(knowledgeCheckCard),
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
    constraints: 'Best for middle-school and above. Requires items that can be meaningfully positioned on a spectrum.',
    affordances: { representation: ['pictorial', 'symbolic'], role: 'introduce', minutes: 3 },
  },
];
