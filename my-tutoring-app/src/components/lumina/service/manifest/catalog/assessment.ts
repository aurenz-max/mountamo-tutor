/**
 * Assessment Catalog - Component definitions for knowledge assessment primitives
 *
 * Contains components for quizzes, knowledge checks, and learning assessment.
 */

import { ComponentDefinition } from '../../../types';

export const ASSESSMENT_CATALOG: ComponentDefinition[] = [
  {
    id: 'knowledge-check',
    description: 'Multiple choice quiz question. RECOMMENDED: Include at the end to assess understanding.',
    constraints: 'Typically one per exhibit, at the end',
    supportsEvaluation: true,
  },
  {
    id: 'scale-spectrum',
    description: 'Interactive spectrum for placing items along a continuum. Use for teaching nuanced judgments, degrees of intensity, moral/ethical reasoning, or comparative analysis.',
    constraints: 'Best for middle-school and above. Requires items that can be meaningfully positioned on a spectrum.'
  },
];
