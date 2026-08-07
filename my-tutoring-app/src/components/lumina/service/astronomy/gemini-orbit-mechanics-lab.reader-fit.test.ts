/**
 * Reader-fit: orbit-mechanics-lab SCAFFOLD-GAP + PRIMITIVE-GAP + prose-grade — 2026-08-07
 *
 * Item 15A / S2. Queued as WRONG-BAND on the theory that a catalog BAND FLOOR
 * was the whole fix. That was rejected by a user ruling — if the curator routes
 * a primitive at a grade, make it work at that grade — and the live evidence
 * agreed: a real `topic-trace` at Kindergarten on "Things that go around and
 * around in space" selected `orbit-mechanics-lab`. A floor would have deleted a
 * card the curator actively wanted.
 *
 * Three defects closed here:
 *
 *   1. PROSE GRADE. `gradeLevel = ctx.gradeContext` fed every structural default.
 *      Probed live at `grade=1` pre-fix, the generator returned
 *      "Rocket to Orbit! - Grade 3 Orbit Mechanics Lab" with showTWR, fuel gauge,
 *      burns and gravity field lines on.
 *   2. LEXICAL RUNG COMPARISON. Even with the rung resolved correctly,
 *      `gradeLevel >= '3'` is TRUE for 'K' — 'K' sorts after '3' — so burns and
 *      field lines stayed on at Kindergarten. Two bugs, one symptom.
 *   3. SCAFFOLD-GAP. No catalog `tutoring` block and no `useLuminaAI` in the
 *      component, so `lumina_tutor.py` served the literal string "No specific
 *      scaffolding instructions for this primitive type."
 *
 * Non-vacuity: the resolver did not exist pre-fix; the prose regex returns '3'
 * for every canonical input below; and the preset outcomes are re-derived from
 * the real `orbitStep` on every run rather than asserted from a comment.
 */
import { describe, it, expect } from 'vitest';
import {
  orbitMechanicsGradeFromGrade,
  applyOrbitDisplayDefaults,
  orbitRungIndex,
} from './gemini-orbit-mechanics-lab';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';
import {
  simulateLaunch,
  speedChoicesFor,
  orbitPathPoints,
  calculateOrbitalElements,
  initialLaunchState,
  orbitStep,
  CORRECT_SPEED_CHOICE,
  type OrbitCraftConfig,
} from './orbitPhysics';

const EARTH = { bodyRadiusKm: 6371, surfaceGravity: 9.81 };

/** The Kindergarten rocket rung the generator emits. */
const K_ROCKET = { rocketMassKg: 2000, propellantMassKg: 1200 };

const cfgFor = (thrustKN: number, launchAngle = 90): OrbitCraftConfig => ({
  ...EARTH,
  ...K_ROCKET,
  thrustKN,
  launchAngle,
});

describe('orbit-mechanics-lab — reader-fit scaffold + grade resolution + K speed choices', () => {
  describe('orbitMechanicsGradeFromGrade — canonical grade, NO floor', () => {
    it('resolves Kindergarten to its own rung', () => {
      expect(orbitMechanicsGradeFromGrade('K')).toBe('K');
      expect(orbitMechanicsGradeFromGrade('k')).toBe('K');
      expect(orbitMechanicsGradeFromGrade('kindergarten')).toBe('K');
      expect(orbitMechanicsGradeFromGrade('preschool')).toBe('K');
    });

    it('passes every served grade through unclamped', () => {
      expect(orbitMechanicsGradeFromGrade('1')).toBe('1');
      expect(orbitMechanicsGradeFromGrade('2')).toBe('2');
      expect(orbitMechanicsGradeFromGrade('3')).toBe('3');
      expect(orbitMechanicsGradeFromGrade('4')).toBe('4');
      expect(orbitMechanicsGradeFromGrade('5')).toBe('5');
    });

    it('tops out at 5 above the primitive ceiling', () => {
      expect(orbitMechanicsGradeFromGrade('6')).toBe('5');
      expect(orbitMechanicsGradeFromGrade('12')).toBe('5');
    });

    it('returns null with no canonical grade so the prose fallback stands', () => {
      expect(orbitMechanicsGradeFromGrade(undefined)).toBeNull();
      expect(orbitMechanicsGradeFromGrade('')).toBeNull();
      expect(orbitMechanicsGradeFromGrade('nonsense')).toBeNull();
    });

    it('NEVER silently defaults a low grade to the Grade 3 rung (the exact bite)', () => {
      for (const g of ['K', 'k', 'kindergarten', '1', '2']) {
        expect(orbitMechanicsGradeFromGrade(g)).not.toBe('3');
      }
    });

    it('never returns a floored rung — K is served, not routed away', () => {
      expect(orbitMechanicsGradeFromGrade('K')).not.toBe('2');
      expect(orbitMechanicsGradeFromGrade('1')).not.toBe('2');
    });
  });

  /**
   * The SECOND bug, which survives a correct resolver: `gradeLevel >= '3'` is
   * true for 'K'. Asserted against the generator's own default-application
   * function, so reintroducing a string compare fails the build.
   */
  describe('applyOrbitDisplayDefaults — ordinal rung, not lexical', () => {
    it('places K below every numbered grade (a string compare does the opposite)', () => {
      expect(orbitRungIndex('K')).toBeLessThan(orbitRungIndex('1'));
      expect(orbitRungIndex('K')).toBeLessThan(orbitRungIndex('3'));
      // The bug being guarded: lexically, 'K' > '3'.
      expect('K' >= '3').toBe(true);
    });

    it('keeps burns and gravity field lines OFF at Kindergarten', () => {
      const d = applyOrbitDisplayDefaults({}, 'K');
      expect(d.allowBurns).toBe(false);
      expect(d.gravityVisualization).toBe('none');
    });

    it('keeps burns and gravity field lines OFF at grade 1', () => {
      const d = applyOrbitDisplayDefaults({}, '1');
      expect(d.allowBurns).toBe(false);
      expect(d.gravityVisualization).toBe('none');
    });

    it('keeps every numeric readout OFF at K and grade 1', () => {
      for (const g of ['K', '1'] as const) {
        const d = applyOrbitDisplayDefaults({}, g);
        expect(d.showTWR).toBe(false);
        expect(d.showFuelGauge).toBe(false);
        expect(d.showVelocityVector).toBe(false);
        expect(d.showApogeePerigee).toBe(false);
        expect(d.showOrbitalPeriod).toBe(false);
      }
    });

    it('turns the instrument back ON from grade 2, and burns from grade 3', () => {
      const g2 = applyOrbitDisplayDefaults({}, '2');
      expect(g2.showTWR).toBe(true);
      expect(g2.showVelocityVector).toBe(true);
      expect(g2.allowBurns).toBe(false);

      const g3 = applyOrbitDisplayDefaults({}, '3');
      expect(g3.allowBurns).toBe(true);
      expect(g3.gravityVisualization).toBe('field_lines');
    });

    it('honours the K rung promise: showOrbitPath is on at every grade', () => {
      for (const g of ['K', '1', '2', '3', '4', '5'] as const) {
        expect(applyOrbitDisplayDefaults({}, g).showOrbitPath).toBe(true);
      }
    });

    it('gives K the K hints, not the grade 3 hints it used to fall through to', () => {
      const d = applyOrbitDisplayDefaults({}, 'K');
      expect(d.hints!.join(' ')).not.toMatch(/elliptical|circular|gravity/i);
    });

    it('never overwrites a value Gemini already supplied', () => {
      const d = applyOrbitDisplayDefaults({ allowBurns: true, showTWR: true }, 'K');
      expect(d.allowBurns).toBe(true);
      expect(d.showTWR).toBe(true);
    });

    /**
     * The one exception to "never overwrite": the rung itself. The component
     * band-gates on `data.gradeLevel`, so if Gemini's echo were trusted, a
     * grade-1 lesson that came back "3" would render the full adult instrument
     * with every new gate technically present and never running.
     */
    it('STAMPS the resolved rung over whatever Gemini echoed', () => {
      expect(applyOrbitDisplayDefaults({ gradeLevel: '3' }, 'K').gradeLevel).toBe('K');
      expect(applyOrbitDisplayDefaults({ gradeLevel: '3' }, '1').gradeLevel).toBe('1');
      expect(applyOrbitDisplayDefaults({}, 'K').gradeLevel).toBe('K');
    });

    it('reproduces the exact live G1 failure: a "3" echo must not reach the component', () => {
      // Verbatim shape of the pre-fix probe at grade=1.
      const geminiEcho = { gradeLevel: '3' as const, showTWR: true, allowBurns: true };
      const fixed = applyOrbitDisplayDefaults({ ...geminiEcho }, '1');
      expect(fixed.gradeLevel).toBe('1');
    });
  });

  /**
   * The K interaction replaces a thrust slider in kN and an angle slider in
   * degrees with three tappable pictures. That is only a real task if the three
   * genuinely do different things — so simulate them with the SAME `orbitStep`
   * the child's rocket flies on.
   */
  describe('K speed choices produce three genuinely different outcomes', () => {
    const choices = speedChoicesFor(K_ROCKET.rocketMassKg, EARTH.surfaceGravity);
    const outcomeOf = (id: string) => {
      const c = choices.find((x) => x.id === id)!;
      return simulateLaunch(cfgFor(c.thrustKN, c.launchAngle));
    };

    it('offers exactly three choices, each picture-primary', () => {
      expect(choices).toHaveLength(3);
      for (const c of choices) {
        expect(c.emoji).toBeTruthy();
        expect(c.thrustKN).toBeGreaterThan(0);
      }
    });

    it('"slow" falls back to the ground — a real, visible failure', () => {
      expect(outcomeOf('slow').outcome).toBe('crash');
    });

    it('"just right" reaches a stable orbit that stays near the planet', () => {
      const r = outcomeOf('justRight');
      expect(r.outcome).toBe('orbit');
      // Round enough to read as "around and around", and inside the viewport.
      expect(r.eccentricity!).toBeLessThan(0.25);
      expect(r.apogeeKm!).toBeLessThan(9556);
    });

    it('"super fast" flings the rocket far outside the drawn area', () => {
      const r = outcomeOf('fast');
      expect(r.outcome).toBe('orbit');
      expect(r.apogeeKm!).toBeGreaterThan(9556);
    });

    it('exactly ONE choice is the answer, so the task is not guessable-by-shape', () => {
      const nearOrbits = choices.filter((c) => {
        const r = simulateLaunch(cfgFor(c.thrustKN, c.launchAngle));
        return r.outcome === 'orbit' && r.apogeeKm! < 9556;
      });
      expect(nearOrbits).toHaveLength(1);
      expect(nearOrbits[0].id).toBe(CORRECT_SPEED_CHOICE);
    });

    it('generalises across every grade rocket rung, not just the K one', () => {
      // Propellant is 60% of mass at every rung, so TWR alone decides outcome.
      for (const [mass, prop] of [[2500, 1500], [3000, 1800], [5000, 3000]]) {
        const cs = speedChoicesFor(mass, EARTH.surfaceGravity);
        const slow = cs.find((c) => c.id === 'slow')!;
        const right = cs.find((c) => c.id === 'justRight')!;
        expect(simulateLaunch({ ...EARTH, rocketMassKg: mass, propellantMassKg: prop, thrustKN: slow.thrustKN, launchAngle: slow.launchAngle }).outcome).toBe('crash');
        expect(simulateLaunch({ ...EARTH, rocketMassKg: mass, propellantMassKg: prop, thrustKN: right.thrustKN, launchAngle: right.launchAngle }).outcome).toBe('orbit');
      }
    });

    /**
     * CLAUDE.md #1: a student must not be able to solve the task from labels or
     * default state. The first draft labelled the orbiting choice "Just right",
     * which named the answer outright — and worse, the tutor reads those labels
     * aloud to the very child who cannot read them.
     */
    it('no label names the answer — captions describe SPEED, not correctness', () => {
      for (const c of choices) {
        expect(c.label).not.toMatch(/just right|correct|best|right one|winner/i);
      }
    });

    it('the correct choice is not identifiable from label text alone', () => {
      const correct = choices.find((c) => c.id === CORRECT_SPEED_CHOICE)!;
      const others = choices.filter((c) => c.id !== CORRECT_SPEED_CHOICE);
      // Its caption must not stand out as approving where the others do not.
      for (const o of others) {
        expect(correct.label.length).toBeLessThan(o.label.length + 12);
      }
      expect(correct.label).toBe('Medium');
    });

    it('does NOT clamp the too-slow option up into the generated thrust range', () => {
      // Clamping into thrustOptions would erase the failure the task is built on.
      const slow = choices.find((c) => c.id === 'slow')!;
      const twr = (slow.thrustKN * 1000) / (K_ROCKET.rocketMassKg * EARTH.surfaceGravity);
      expect(twr).toBeLessThan(1);
    });
  });

  /**
   * `showOrbitPath` was declared and generated for every grade but never read by
   * the component, so the catalog's K rung ("showOrbitPath only") promised a
   * feature that did not exist.
   */
  describe('projected orbit path — the K rung promise', () => {
    const orbitState = () => {
      const c = speedChoicesFor(K_ROCKET.rocketMassKg, EARTH.surfaceGravity)
        .find((x) => x.id === 'justRight')!;
      const cfg = cfgFor(c.thrustKN, c.launchAngle);
      // Fly until coasting in a closed orbit.
      let s = initialLaunchState(cfg);
      for (let i = 0; i < 40000; i++) {
        s = orbitStep(s, 1, s.isLaunching, cfg);
        if (!s.isLaunching && calculateOrbitalElements(s, cfg).isInOrbit) break;
      }
      return { s, cfg };
    };

    it('returns a closed loop of points once in orbit', () => {
      const { s, cfg } = orbitState();
      const pts = orbitPathPoints(s, cfg);
      expect(pts).not.toBeNull();
      expect(pts!.length).toBeGreaterThan(50);
    });

    it('every path point clears the planet surface', () => {
      const { s, cfg } = orbitState();
      const pts = orbitPathPoints(s, cfg)!;
      for (const p of pts) {
        expect(Math.hypot(p.x, p.y)).toBeGreaterThan(cfg.bodyRadiusKm * 0.95);
      }
    });

    it('returns null on the pad, so no phantom loop is drawn before launch', () => {
      const cfg = cfgFor(20);
      expect(orbitPathPoints(initialLaunchState(cfg), cfg)).toBeNull();
    });
  });

  describe('catalog tutoring scaffold', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'orbit-mechanics-lab')!;

    it('exists and has a tutoring block (was the SCAFFOLD-GAP)', () => {
      expect(entry).toBeDefined();
      expect(entry.tutoring).toBeDefined();
    });

    it('defines all three scaffolding levels and common struggles', () => {
      expect(entry.tutoring!.scaffoldingLevels.level1).toBeTruthy();
      expect(entry.tutoring!.scaffoldingLevels.level2).toBeTruthy();
      expect(entry.tutoring!.scaffoldingLevels.level3).toBeTruthy();
      expect(entry.tutoring!.commonStruggles!.length).toBeGreaterThanOrEqual(3);
    });

    it('carries the pre-reader read-aloud directive that survives the lesson cap', () => {
      const preReader = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /PRE-READER/i.test(d.title));
      expect(preReader).toBeDefined();
      expect(preReader!.instruction).toMatch(/OVERRIDES/i);
      expect(preReader!.instruction).toMatch(/ORBIT_ORIENT/);
      expect(preReader!.instruction).toMatch(/ORBIT_READ_ALOUD/);
    });

    it('forbids measurements and orbital vocabulary to a pre-reader', () => {
      const preReader = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /PRE-READER/i.test(d.title))!;
      expect(preReader.instruction).toMatch(/kilomet|kilonewton/i);
      expect(preReader.instruction).toMatch(/apogee/i);
      // and supplies the replacement register rather than only banning words
      expect(preReader.instruction).toMatch(/going around and around/i);
    });

    it('forbids naming which speed is correct — the answer, not the question', () => {
      const answerRule = (entry.tutoring!.aiDirectives ?? [])
        .find((d) => /NEVER SAY IT/i.test(d.title));
      expect(answerRule).toBeDefined();
      expect(answerRule!.instruction).toMatch(/NEVER name the correct picture/i);
      expect(answerRule!.instruction).toMatch(/elimination/i);
    });

    it('every contextKey referenced in the task description is declared', () => {
      const keys = entry.tutoring!.contextKeys ?? [];
      const referenced = (entry.tutoring!.taskDescription.match(/\{\{\w+\}\}/g) ?? [])
        .map((m) => m.slice(2, -2));
      expect(referenced.length).toBeGreaterThan(0);
      for (const k of referenced) expect(keys).toContain(k);
    });

    it('has no handlebars conditionals — the backend interpolator cannot render them', () => {
      const blob = JSON.stringify(entry.tutoring);
      expect(blob).not.toMatch(/\{\{#/);
    });
  });

  describe('catalog band claim', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'orbit-mechanics-lab')!;

    it('does NOT carry a band floor — K is served by making it age-fit', () => {
      expect(entry.constraints).not.toMatch(/BAND FLOOR/i);
      expect(entry.constraints).not.toMatch(/Grade 2\+ ONLY/i);
    });

    it('tells the curator the K-1 controls are pictures, not sliders', () => {
      expect(entry.constraints).toMatch(/tap/i);
      expect(entry.constraints).toMatch(/K and Grade 1 are fully supported/i);
    });
  });
});
