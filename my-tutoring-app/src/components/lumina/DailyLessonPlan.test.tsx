// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DailySessionPlan, LessonBlock } from '@/lib/sessionPlanAPI';
import { DailyLessonPlan } from './DailyLessonPlan';

vi.mock('@/lib/sessionPlanAPI', () => ({
  fetchDailySessionPlan: vi.fn(),
  prettySubject: (subject: string) => subject
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase()),
}));

afterEach(cleanup);

function makeBlock(overrides: Partial<LessonBlock>): LessonBlock {
  return {
    block_id: 'block-1',
    block_index: 1,
    type: 'pulse',
    lesson_group_id: 'group-1',
    title: 'Daily Pulse',
    subject: 'SCIENCE',
    estimated_minutes: 6,
    subskills: [
      {
        subskill_id: 'matter-1',
        subskill_name: 'Explore how light interacts with materials',
        bloom_phase: 'apply',
        gate: 1,
        status: 'review',
      },
      {
        subskill_id: 'matter-2',
        subskill_name: 'Recognize the three states of matter',
        bloom_phase: 'apply',
        gate: 1,
        status: 'review',
      },
    ],
    bloom_phases: [],
    priority_score: 1,
    insert_break_after: false,
    celebration_message: 'Nice work',
    ...overrides,
  };
}

const plan: DailySessionPlan = {
  student_id: 'student-1',
  date: '2026-08-05',
  day_of_week: 'Wednesday',
  grade_level: '3',
  budget_minutes: 30,
  review_budget_minutes: 15,
  intro_budget_minutes: 15,
  estimated_total_minutes: 24,
  total_subskills: 4,
  new_subskills: 2,
  review_subskills: 2,
  warnings: [],
  blocks: [
    makeBlock({}),
    makeBlock({
      block_id: 'block-2',
      block_index: 2,
      type: 'lesson',
      title: 'Places and Environments',
      subject: 'SOCIAL_STUDIES',
      estimated_minutes: 9,
      subskills: [],
    }),
    makeBlock({
      block_id: 'block-3',
      block_index: 3,
      type: 'practice',
      title: 'Multiplication Strategies',
      subject: 'MATH',
      estimated_minutes: 9,
      subskills: [],
    }),
  ],
};

describe('DailyLessonPlan embedded hierarchy', () => {
  it('leaves session summary and the primary action to the ribbon', () => {
    render(
      <DailyLessonPlan
        studentId="student-1"
        initialPlan={plan}
        embedded
        onBlockStart={vi.fn()}
      />,
    );

    expect(screen.queryByText("Wednesday's Session")).toBeNull();
    expect(screen.queryByRole('button', { name: /^start$/i })).toBeNull();
    expect(screen.queryByText(/total budget/i)).toBeNull();
    expect(screen.queryByText(/block metadata/i)).toBeNull();
  });

  it('shows one current block and keeps future blocks as an outline', () => {
    render(
      <DailyLessonPlan
        studentId="student-1"
        initialPlan={plan}
        embedded
      />,
    );

    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText(/what you'll explore/i)).toBeTruthy();
    expect(screen.getByText('+ 1 more goal')).toBeTruthy();
    expect(screen.getByText('Places and Environments')).toBeTruthy();
    expect(screen.getByText('Up next')).toBeTruthy();
    expect(screen.getByText('Multiplication Strategies')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('advances the focused card after the prior block is completed', () => {
    render(
      <DailyLessonPlan
        studentId="student-1"
        initialPlan={plan}
        completedBlockIds={new Set(['block-1'])}
        embedded
      />,
    );

    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Places and Environments')).toBeTruthy();
    expect(screen.getByText('Now')).toBeTruthy();
  });
});
