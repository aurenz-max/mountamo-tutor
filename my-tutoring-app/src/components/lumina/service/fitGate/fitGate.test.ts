import { describe, expect, it } from 'vitest';
import { activityView } from './activityView';
import { decideFit } from './fitGate';

describe('activityView', () => {
  it('keeps prompts and answer keys, drops scaffolding text and ids', () => {
    const view = activityView({ type: 'ten-frame', data: { title: 'Teens', challenges: [
      { id: 'c1', type: 'build_teen', targetCount: 11, hint: 'Count on from ten.', narration: 'Here we go', instruction: 'Make 11!' },
    ] } });
    expect(view.title).toBe('Teens');
    expect(view.tasks).toEqual(['build_teen | Make 11! | targetCount=11']);
    expect(JSON.stringify(view)).not.toMatch(/Count on from ten|Here we go|c1/);
  });

  it('reads an answer key written in ids as labels', () => {
    const view = activityView({ challenges: [{ type: 'sequence', instruction: 'Order the day.',
      events: [{ id: 'e1', label: 'Wake up' }, { id: 'e2', label: 'Lunch' }], correctOrder: ['e2', 'e1'] }] });
    expect(view.tasks[0]).toContain('correctOrder=[Lunch, Wake up]');
  });

  it('caps the number of tasks', () => {
    const view = activityView({ challenges: Array.from({ length: 10 }, (_, i) => ({ type: 't', instruction: `Q${i}` })) });
    expect(view.tasks).toHaveLength(6);
    expect(view.more).toBe(4);
  });
});

describe('decideFit', () => {
  const ok = { teaches: { noul: 0.6 }, numbers: { choice: 'all_inside', probabilities: { all_inside: 0.9 } }, grade_fit: { noul: 0.9 } };

  it('passes an activity that teaches the objective inside its numbers', () => {
    expect(decideFit(ok, []).pass).toBe(true);
  });

  it('fails a different skill, numbers outside the objective, or an out-of-grade task', () => {
    expect(decideFit({ ...ok, teaches: { noul: 0.05 } }, []).pass).toBe(false);
    expect(decideFit({ ...ok, numbers: { choice: 'some_outside', probabilities: { some_outside: 0.95 } } }, []).pass).toBe(false);
    expect(decideFit({ ...ok, grade_fit: { noul: 0.1 } }, []).pass).toBe(false);
  });

  it('fails on a blocking oracle violation even when Jev is unavailable', () => {
    const v = decideFit(null, [{ check: 'scope', where: 'c2', detail: 'target 49 > ceiling 20' }]);
    expect(v.pass).toBe(false);
    expect(v.notes[0]).toContain('scope');
  });

  it('never fails for lack of a judgment', () => {
    expect(decideFit(null, []).pass).toBe(true);
  });
});
