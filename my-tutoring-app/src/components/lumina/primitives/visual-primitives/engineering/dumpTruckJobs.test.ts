/**
 * Content contract for the dump-truck-loader eval-mode ladder.
 *
 * The jobs are CODE-OWNED because the density arithmetic IS the correctness —
 * so the pool has to be checked against the same physics the component runs,
 * not against prose. `bindingLimit` in DumpTruckLoader is exactly:
 *     bedVolume * density > truckCapacity ? 'weight' : 'volume'
 * with the shipped defaults bedVolume 30 / truckCapacity 50.
 */
import { describe, it, expect } from 'vitest';
import {
  selectDumpTruckJobs,
  selectMixedDumpTruckJobs,
  DENSITY_BY_MATERIAL as DENSITY,
  type DumpTruckJob,
  type DumpTruckJobMode,
} from './dumpTruckJobs';

// The shipped component defaults — DumpTruckLoader destructures these.
const BED_VOLUME = 30;
const TRUCK_CAPACITY = 50;

const bindingLimit = (material: keyof typeof DENSITY): 'weight' | 'volume' =>
  BED_VOLUME * DENSITY[material] > TRUCK_CAPACITY ? 'weight' : 'volume';

/** Units the truck can actually carry in one trip for this material. */
const loadSize = (material: keyof typeof DENSITY): number =>
  bindingLimit(material) === 'weight' ? TRUCK_CAPACITY / DENSITY[material] : BED_VOLUME;

const ALL_MODES: DumpTruckJobMode[] = ['load', 'predict', 'plan_trips'];
const pool = (): DumpTruckJob[] =>
  ALL_MODES.flatMap((m) => selectDumpTruckJobs([m], 99));

describe('dump-truck job pool — structure', () => {
  it('gives every rung at least 4 jobs (mastery, not demo)', () => {
    for (const mode of ALL_MODES) {
      expect(selectDumpTruckJobs([mode], 99).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('returns only the asked-for rung', () => {
    for (const mode of ALL_MODES) {
      for (const job of selectDumpTruckJobs([mode], 99)) {
        expect(job.mode).toBe(mode);
      }
    }
  });

  it('serves a curated blend from both rungs', () => {
    const blend = selectDumpTruckJobs(['load', 'plan_trips'], 99);
    expect(new Set(blend.map((j) => j.mode))).toEqual(new Set(['load', 'plan_trips']));
  });

  it('has unique job ids', () => {
    const ids = pool().map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('dump-truck job pool — the mixed path covers every rung (SP-21)', () => {
  it('touches all three rungs before repeating any', () => {
    const mixed = selectMixedDumpTruckJobs(6);
    expect(mixed).toHaveLength(6);
    expect(new Set(mixed.map((j) => j.mode))).toEqual(new Set(ALL_MODES));
  });

  it('still covers all three rungs at the minimum session length', () => {
    expect(new Set(selectMixedDumpTruckJobs(3).map((j) => j.mode))).toEqual(new Set(ALL_MODES));
  });

  it('never emits a duplicate job', () => {
    const ids = selectMixedDumpTruckJobs(12).map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('dump-truck job pool — physics agrees with the component', () => {
  it('spans both binding limits in every rung, so the contrast is teachable', () => {
    for (const mode of ALL_MODES) {
      const limits = new Set(
        selectDumpTruckJobs([mode], 99).map((j) => bindingLimit(j.material)),
      );
      expect(limits).toEqual(new Set(['weight', 'volume']));
    }
  });

  it('complete_loads jobs have a pile big enough for the loads they ask for', () => {
    for (const job of pool()) {
      if (job.goal !== 'complete_loads') continue;
      expect(job.targetLoads).toBeGreaterThan(0);
      expect(job.sourceSize).toBeGreaterThanOrEqual(
        (job.targetLoads ?? 1) * loadSize(job.material),
      );
    }
  });

  it('clear_source jobs are solvable and multi-trip', () => {
    for (const job of pool()) {
      if (job.goal !== 'clear_source') continue;
      expect(Math.ceil(job.sourceSize / loadSize(job.material))).toBeGreaterThan(1);
    }
  });

  it('plan_trips uses one pile size so trip count varies by density alone', () => {
    const trips = selectDumpTruckJobs(['plan_trips'], 99);
    expect(new Set(trips.map((j) => j.sourceSize)).size).toBe(1);
    const counts = trips.map((j) => Math.ceil(j.sourceSize / loadSize(j.material)));
    expect(new Set(counts).size).toBeGreaterThan(1);
    // Heavier material must never cost FEWER trips — that is the whole lesson.
    const byDensity = [...trips].sort((a, b) => DENSITY[a.material] - DENSITY[b.material]);
    const ordered = byDensity.map((j) => Math.ceil(j.sourceSize / loadSize(j.material)));
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
  });
});

describe('dump-truck job pool — pedagogy guards', () => {
  it('every predict job actually asks for the prediction', () => {
    for (const job of selectDumpTruckJobs(['predict'], 99)) {
      expect(job.predict).toBe(true);
    }
  });

  it('no non-predict rung silently turns on the predict gate', () => {
    for (const job of pool()) {
      if (job.mode !== 'predict') expect(job.predict).toBeFalsy();
    }
  });

  it('a predict brief never names the binding meter — that IS the question', () => {
    // The brief is on screen before the student commits. Naming the scale or the
    // bed as the limit there hands over the answer (CLAUDE.md pedagogy rule #1).
    const leak = /\b(scale|bed|weight|volume)\b[^.]{0,40}\b(fills?|limit|first|stops?)\b/i;
    for (const job of selectDumpTruckJobs(['predict'], 99)) {
      expect(job.brief, `${job.id} brief leaks the answer`).not.toMatch(leak);
    }
  });

  it('every job carries a hint and a post-solve explanation', () => {
    for (const job of pool()) {
      expect(job.hint.length).toBeGreaterThan(20);
      expect(job.explainOnSolve.length).toBeGreaterThan(20);
    }
  });
});

describe('dump-truck ladder — the catalog and the pool agree', () => {
  it('every catalog evalMode has jobs, and every job mode is in the catalog', async () => {
    const { getComponentById } = await import('../../../service/manifest/catalog');
    const modes = getComponentById('dump-truck-loader')?.evalModes ?? [];
    expect(modes.length).toBe(3);
    const catalogKeys = modes.map((m) => m.evalMode).sort();
    expect(catalogKeys).toEqual([...ALL_MODES].sort());
    for (const m of modes) {
      // challengeTypes is what resolveEvalModes hands the selector.
      expect(selectDumpTruckJobs(m.challengeTypes, 99).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('orders the rungs easiest-to-hardest by beta', async () => {
    const { getComponentById } = await import('../../../service/manifest/catalog');
    const betas = (getComponentById('dump-truck-loader')?.evalModes ?? []).map((m) => m.beta);
    expect(betas).toEqual([...betas].sort((a, b) => a - b));
  });
});
