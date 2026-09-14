import type { LearningObservation, LearningActivityScope } from './learningObservations';

export const sampleActivity: LearningActivityScope = {
  componentId: 'place-value-chart', subject: 'MATHEMATICS', grade: '4',
  subskillId: 'NBT004-01-b', evalMode: 'compare',
};

// Synthetic examples only. Never infer these from the user's screenshot or persist them.
export const sampleLearningObservations: LearningObservation[] = [
  {
    id: 'sample-place-names', kind: 'pattern', status: 'suspected',
    summary: 'Place names and digit values may be getting mixed up.',
    subject: 'MATHEMATICS', grade: '4', subskillId: 'NBT004-01-b',
    evidence: [
      { attemptId: 'sample-attempt-1', task: 'In 2,258, name the place of the second 2.', response: 'Two hundred', support: 'First response, without a hint' },
      { attemptId: 'sample-attempt-2', task: 'In 3,397, name the place of the 9.', response: 'Ninety', support: 'First response; then said “tens” after correction' },
    ],
    updatedAt: '2026-09-12',
    teachingImplication: 'Contrast a place name with its numeric value using fresh examples. Keep the two questions distinct.',
    checkNext: 'Ask for a place name on a fresh item before giving a hint. A corrected response is not an independent check.',
  },
  {
    id: 'sample-digit-values', kind: 'strength', status: 'supported',
    summary: 'Numeric digit values were identified independently in these examples.',
    subject: 'MATHEMATICS', grade: '4', subskillId: 'NBT004-01-b',
    evidence: [{ attemptId: 'sample-attempt-3', task: 'What is the value of the 5 in 4,572?', response: 'Five hundred', support: 'First response, without a hint' }],
    updatedAt: '2026-09-12',
    teachingImplication: 'Use the observed success with numeric values as a bridge to naming places; do not assume mastery beyond these examples.',
    checkNext: 'Check the value of a digit in a different place.',
  },
  {
    id: 'sample-other-grade', kind: 'support', status: 'suspected',
    summary: 'Three-digit place-value work may benefit from a spoken prompt repeated once.',
    subject: 'MATHEMATICS', grade: '3', subskillId: 'NBT003-02-a',
    evidence: [{ attemptId: 'sample-attempt-4', task: 'Write the three-digit number you hear.', response: 'Asked to hear the prompt again', support: 'Prompt repeated; cause is unknown' }],
    updatedAt: '2026-09-11',
    teachingImplication: 'Offer a repeat of the prompt without revealing the answer.',
    checkNext: 'Observe whether a fresh prompt can be followed independently.',
  },
  {
    id: 'sample-resolved', kind: 'pattern', status: 'resolved',
    summary: 'An earlier digit-order concern is retained as history.',
    subject: 'MATHEMATICS', grade: '4', subskillId: 'NBT004-01-b',
    evidence: [{ attemptId: 'sample-attempt-5', task: 'Write 6,482 from dictation.', response: '6482', support: 'Fresh independent check in this synthetic example' }],
    updatedAt: '2026-09-12', teachingImplication: 'No active adaptation.', checkNext: 'Ordinary practice.',
  },
];
