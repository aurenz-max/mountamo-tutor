import { describe, expect, it } from 'vitest';
import { analogClockOracle } from '../analog-clock';

/**
 * Seeded-violation tests for the analog-clock oracle. Clean fixtures mirror real
 * /api/lumina/eval-test generations (read + elapsed, grade 2-3), plus one mutated
 * fixture per implemented check class that MUST fire.
 */

const readCtx = { componentId: 'analog-clock', evalMode: 'read', topic: 'telling time', gradeLevel: 'grade 2' };
const elapsedCtx = { ...readCtx, evalMode: 'elapsed', topic: 'elapsed time' };

const readClean = {
  title: 'What Time?', description: 'Read the clock.',
  challenges: [
    { id: 'c1', type: 'read', instruction: 'What time?', targetHour: 2, targetMinute: 5, hint: '?', correctOptionIndex: 0, option0: '2:05', option1: '2:25', option2: '5:02', option3: '3:05' },
    { id: 'c2', type: 'read', instruction: 'What time?', targetHour: 7, targetMinute: 20, hint: '?', correctOptionIndex: 2, option0: '7:04', option1: '4:07', option2: '7:20', option3: '8:20' },
    { id: 'c3', type: 'read', instruction: 'What time?', targetHour: 11, targetMinute: 35, hint: '?', correctOptionIndex: 1, option0: '11:07', option1: '11:35', option2: '12:35', option3: '7:55' },
    { id: 'c4', type: 'read', instruction: 'What time?', targetHour: 4, targetMinute: 50, hint: '?', correctOptionIndex: 3, option0: '5:50', option1: '4:10', option2: '5:10', option3: '4:50' },
  ],
};

const elapsedClean = {
  title: 'How Much Time?', description: 'Elapsed time.',
  challenges: [
    { id: 'e1', type: 'elapsed', instruction: 'Start 1:00, end 1:30.', targetHour: 1, targetMinute: 30, hint: '?', correctOptionIndex: 0, elapsedDescription: '30 minutes later', option0: '30 minutes', option1: '15 minutes', option2: '45 minutes', option3: '1 hour', startHour: 1, startMinute: 0 },
    { id: 'e2', type: 'elapsed', instruction: 'Start 2:15, end 3:00.', targetHour: 3, targetMinute: 0, hint: '?', correctOptionIndex: 1, elapsedDescription: '45 minutes later', option0: '30 minutes', option1: '45 minutes', option2: '1 hour', option3: '15 minutes', startHour: 2, startMinute: 15 },
    { id: 'e3', type: 'elapsed', instruction: 'Start 4:00, end 5:00.', targetHour: 5, targetMinute: 0, hint: '?', correctOptionIndex: 3, elapsedDescription: '1 hour later', option0: '15 minutes', option1: '20 minutes', option2: '30 minutes', option3: '1 hour', startHour: 4, startMinute: 0 },
    // Stopwatch "H:MM" duration framing — "1:15" = 75 minutes, NOT a clock time.
    { id: 'e4', type: 'elapsed', instruction: 'Start 7:10, end 8:25. How much time passed?', targetHour: 8, targetMinute: 25, hint: '?', correctOptionIndex: 2, elapsedDescription: '1 hour 15 minutes later', option0: '0:30', option1: '0:45', option2: '1:15', option3: '1:00', startHour: 7, startMinute: 10 },
  ],
};

describe('analog-clock oracle', () => {
  it('passes clean read', () => {
    expect(analogClockOracle.verify(readClean, readCtx).violations).toEqual([]);
  });
  it('passes clean elapsed', () => {
    expect(analogClockOracle.verify(elapsedClean, elapsedCtx).violations).toEqual([]);
  });

  // ── answer-key-desync ──
  it('flags answer-key-desync — the correct read option misreads the shown time', () => {
    const data = { ...readClean, challenges: readClean.challenges.map((c) => c.id === 'c1' ? { ...c, option0: '3:05' } : c) };
    const v = analogClockOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /read as the shown time/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — correctOptionIndex out of range', () => {
    const data = { ...readClean, challenges: readClean.challenges.map((c) => c.id === 'c1' ? { ...c, correctOptionIndex: 4 } : c) };
    const v = analogClockOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /present option/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — the elapsed option ≠ (end − start)', () => {
    const data = { ...elapsedClean, challenges: elapsedClean.challenges.map((c) => c.id === 'e1' ? { ...c, correctOptionIndex: 2 } : c) };
    const v = analogClockOracle.verify(data, elapsedCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'e1' && /true elapsed/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — a stopwatch "H:MM" elapsed option with the wrong duration', () => {
    const data = { ...elapsedClean, challenges: elapsedClean.challenges.map((c) => c.id === 'e4' ? { ...c, option2: '2:00' } : c) };
    const v = analogClockOracle.verify(data, elapsedCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'e4' && /true elapsed/.test(x.detail))).toBe(true);
  });
  it('passes a stopwatch "H:MM"-duration elapsed challenge', () => {
    const single = { ...elapsedClean, challenges: [elapsedClean.challenges[3], elapsedClean.challenges[1], elapsedClean.challenges[2]] };
    expect(analogClockOracle.verify(single, elapsedCtx).violations).toEqual([]);
  });
  it('flags answer-key-desync — elapsedDescription contradicts start→end', () => {
    const data = { ...elapsedClean, challenges: elapsedClean.challenges.map((c) => c.id === 'e1' ? { ...c, elapsedDescription: '45 minutes later' } : c) };
    const v = analogClockOracle.verify(data, elapsedCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'e1' && /elapsedDescription/.test(x.detail))).toBe(true);
  });

  // ── scope ──
  it('flags scope — a "to the hour" topic with a non-zero minute', () => {
    const v = analogClockOracle.verify(readClean, { ...readCtx, topic: 'telling time to the hour' }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  // ── clustering ──
  it('flags clustering — every read answer is the same time', () => {
    const data = { ...readClean, challenges: readClean.challenges.map((c, i) => ({ ...c, id: `k${i}`, targetHour: 3, targetMinute: 0, correctOptionIndex: 0, option0: '3:00', option1: '4:00', option2: '5:00', option3: '6:00' })) };
    const v = analogClockOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });
  it('flags clustering — an exact-duplicate card', () => {
    const dup = { ...readClean.challenges[0], id: 'c-dup' };
    const data = { ...readClean, challenges: [...readClean.challenges, dup] };
    const v = analogClockOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  // ── schema ──
  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { ...readClean, challenges: [readClean.challenges[0]] };
    const v = analogClockOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
  it('flags schema — an out-of-range targetHour', () => {
    const data = { ...readClean, challenges: readClean.challenges.map((c) => c.id === 'c1' ? { ...c, targetHour: 13 } : c) };
    const v = analogClockOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });
});
