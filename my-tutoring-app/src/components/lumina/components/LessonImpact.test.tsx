// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LessonImpact from './LessonImpact';
import type { LearnerCause, LearnerCauseLink, LearnerInfluenceResponse } from '@/lib/studentAnalyticsAPI';

const link = (over: Partial<LearnerCauseLink>): LearnerCauseLink => ({
  key: 'Kindergarten:X', label: 'x', grade: 'Kindergarten', rel: 'prerequisite', hops: 1,
  pc: [0.7, 0.75], pm: [0.6, 0.7], d_pc: 0.05, d_own: 0.02, became_ready: false, ...over,
});

const cause = (over: Partial<LearnerCause>): LearnerCause => ({
  key: 'Kindergarten:C', subject: 'MATHEMATICS', label: 'Counts backward from 10.', grade: 'Kindergarten',
  answers: 3, first_try: 1, pc: [0.74, 0.95], foundations: [], check: [], next: [], further: [], ...over,
});

const influence = (by_cause: LearnerCause[], unlocked: LearnerInfluenceResponse['unlocked'] = []): LearnerInfluenceResponse => ({
  since: '2026-10-12T00:00:00Z', until: null, answers: 6, practised: [], upstream: [], downstream: [],
  per_answer: [], by_cause, unlocked,
});

describe('LessonImpact', () => {
  it('groups what each practised skill moved, before and after it', () => {
    render(<LessonImpact influence={influence([cause({
      foundations: [link({ key: 'Kindergarten:A', label: 'Counts backward and finds missing numbers up to 20.' })],
      next: [link({ key: '1:B', grade: '1', rel: 'unlocks', label: 'Finds the difference between two numbers within 10.', became_ready: true })],
    })], [{ key: '1:B', label: 'Finds the difference between two numbers within 10.', grade: '1', ready: [0.3, 0.6] }])} />);
    expect(screen.getByText('Counts backward from 10.')).toBeTruthy();
    expect(screen.getByText('3 activities · 100% right first try')).toBeTruthy();
    expect(screen.getByText('Shows these are in place')).toBeTruthy();
    expect(screen.getByText('Closer now')).toBeTruthy();
    expect(screen.getByText('Ready to learn')).toBeTruthy();
    expect(screen.getByText('Now ready to learn:')).toBeTruthy();
    expect(screen.queryByText('Worth checking')).toBeNull();
  });

  it('says so when the lesson only confirmed what was expected', () => {
    render(<LessonImpact influence={influence([cause({ label: 'Orders items first through tenth.', first_try: 0.2 })])} />);
    expect(screen.getByText('This matched what we already expected, so nothing else moved.')).toBeTruthy();
  });

  it('renders nothing without by_cause (older backend)', () => {
    const { container } = render(<LessonImpact influence={{ ...influence([]), by_cause: undefined }} />);
    expect(container.innerHTML).toBe('');
  });
});
