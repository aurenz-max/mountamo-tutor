import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { buildTrack, loopFair, loopMiss, lowestWorking, makeLoop, pegOutcomes, runFrom, type Tier } from './marbleModel';
import { EASIER_LEVER, LOOP_TOP_LEVER, MARBLE_LEVERS, PEG_RESULTS_LEVER, XRAY_LEVER, energyAt, practiceItem } from './marbleLevers';
import { buildMarbleRunPark } from '../../../service/physics/marble-run-park-generator';
import { validateMarbleRunParkData } from './marbleRunPark.boss';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const items = () => TIERS.flatMap(t => [1, 2, 3].flatMap(seed => buildMarbleRunPark({ gradeLevel: 'Grade 4', supportTier: t }, seed).challenges));
const ITEM = makeLoop('loop-1', 1, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], false, 'lowest');
const ran = { onPeg: true, runs: [{ peg: 1, outcome: 'stopped' as const }] };

describe('marble levers', () => {
  it('each miss gets its lever: too_low the loop-top line, top_height_only the energy bar, not_lowest the peg rings', () => {
    const low = lowestWorking(ITEM);
    const levers = MARBLE_LEVERS.declare(ITEM, ran, []);
    expect(levers.map(l => l.id)).toEqual([LOOP_TOP_LEVER, XRAY_LEVER, PEG_RESULTS_LEVER, EASIER_LEVER]);
    const cases: Array<[number, string, string]> = [[1, 'too_low', LOOP_TOP_LEVER], [3, 'top_height_only', XRAY_LEVER], [low + 1, 'not_lowest', PEG_RESULTS_LEVER]];
    for (const [peg, miss, lever] of cases) {
      expect(loopMiss(ITEM, { peg, runs: [] })).toBe(miss);
      expect(nextLever(levers, miss)).toBe(lever);
    }
    // With the line drawn, too_low goes on to the energy bar.
    expect(nextLever(MARBLE_LEVERS.declare(ITEM, ran, [LOOP_TOP_LEVER]), 'too_low')).toBe(XRAY_LEVER);
  });

  it('the bar needs the marble on a peg; the rings need a run', () => {
    expect(MARBLE_LEVERS.declare(ITEM, { onPeg: false, runs: [] }, []).map(l => l.id)).toEqual([LOOP_TOP_LEVER, EASIER_LEVER]);
  });

  it('the easier item is the same task on a different loop, fair, valid, and has no easier item of its own', () => {
    for (const c of items()) {
      const p = practiceItem(c);
      if (c.goal === 'any') { expect(p).toBeNull(); continue; }
      expect(p).not.toBeNull();
      expect(p!.type).toBe(c.type);
      expect(p!.id).toBe(`${c.id}~easier`);
      expect(p!.loopR).not.toBe(c.loopR);
      expect(p!.carpet).toBe(false);
      expect(c.carpet ? p!.goal === 'lowest' : p!.goal === 'any').toBe(true);
      expect(loopFair(p!)).toBe(true);
      expect(() => validateMarbleRunParkData({ title: 'x', challenges: [{ ...p!, id: 'p' }] })).not.toThrow();
      expect(practiceItem(p!)).toBeNull();
    }
  });

  it('the energy bar: all height on the peg; a start level with the top has little speed left at the top of the loop', () => {
    const t = buildTrack(ITEM);
    const top = ITEM.pegs[ITEM.pegs.length - 1];
    const speedAtTop = (peg: number) => {
      const run = runFrom(t, ITEM.pegs[peg]);
      // The frame where the marble is highest after the ramp (the top of the loop, or where it fell from).
      const after = run.motion.findIndex(m => m.h < 0.05);
      let best = after;
      for (let i = after; i < run.motion.length; i++) if (run.motion[i].h > run.motion[best].h) best = i;
      return energyAt(run.motion, best, top);
    };
    const run = runFrom(t, ITEM.pegs[5]);
    const first = energyAt(run.motion, 0, top);
    expect(first.speed).toBeLessThan(0.02);
    expect(first.height).toBeGreaterThan(0.6);
    // Every part stays within the start's energy, and what rubbing took away only grows on the way to the bell.
    let lost = 0;
    for (let i = 0; i < run.motion.length; i += 3) {
      const e = energyAt(run.motion, i, top);
      expect(e.height + e.speed + e.lost).toBeLessThanOrEqual(first.height + 0.001);
      expect(e.lost).toBeGreaterThanOrEqual(lost - 0.01);
      lost = e.lost;
    }
    // At the bell it is still moving: mostly speed, a little rubbed away.
    const end = energyAt(run.motion, run.motion.length - 1, top);
    expect(end.speed).toBeGreaterThan(0.5);
    expect(end.lost).toBeLessThan(0.2);
    expect(pegOutcomes(ITEM)[3]).not.toBe('made_it');
    expect(speedAtTop(3).speed).toBeLessThan(speedAtTop(lowestWorking(ITEM)).speed);
  });

  it('easy items start with the loop-top line drawn; medium and hard do not', () => {
    expect(buildMarbleRunPark({ gradeLevel: 'Grade 4', supportTier: 'easy' }, 7).challenges.every(c => c.startLevers?.includes(LOOP_TOP_LEVER))).toBe(true);
    expect(buildMarbleRunPark({ gradeLevel: 'Grade 4', supportTier: 'medium' }, 7).challenges.some(c => c.startLevers)).toBe(false);
  });

  it('no lever fact names a peg', () => {
    for (const c of items()) {
      const all = MARBLE_LEVERS.declare(c, ran, []).map(l => l.id);
      const words = MARBLE_LEVERS.onScreen(c, ran, all) + MARBLE_LEVERS.declare(c, ran, []).map(l => l.does).join(' ');
      expect(words).not.toMatch(/peg \d/);
    }
  });
});
