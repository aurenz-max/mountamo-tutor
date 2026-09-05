import { describe, expect, it } from 'vitest';
import type { ComponentDefinition } from '../../../types';
import { UNIVERSAL_CATALOG } from './index';
import {
  AFFORDANCE_ANSWERS,
  AFFORDANCE_AUDIENCES,
  AFFORDANCE_READERS,
  AFFORDANCE_REPRESENTATIONS,
  AFFORDANCE_ROLES,
  affordanceCoverage,
  renderAffordanceTag,
  resolveAffordances,
} from './affordances';

const asList = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

describe('affordances — resolver and renderer', () => {
  it('renders nothing for an untagged primitive (the rollout is ablation-free by construction)', () => {
    const def: ComponentDefinition = { id: 'x' as ComponentDefinition['id'], description: 'd' };
    expect(renderAffordanceTag(def)).toBe('');
    expect(resolveAffordances(def).declared).toBe(false);
  });

  it('derives answers: spoken from audioInput even when nothing is declared', () => {
    const def: ComponentDefinition = {
      id: 'x' as ComponentDefinition['id'],
      description: 'd',
      audioInput: { manual_activity: true },
    };
    expect(resolveAffordances(def).answers).toEqual(['spoken']);
  });

  it('applies a mode override to that mode only', () => {
    const def: ComponentDefinition = {
      id: 'x' as ComponentDefinition['id'],
      description: 'd',
      affordances: { representation: 'concrete', answers: ['spoken', 'build'], role: 'apply', minutes: 5 },
      evalModes: [
        { evalMode: 'build', label: 'b', beta: 1, scaffoldingMode: 1, challengeTypes: [], description: '', affordances: { answers: ['build'] } },
        { evalMode: 'say', label: 's', beta: 2, scaffoldingMode: 2, challengeTypes: [], description: '' },
      ],
    };
    expect(resolveAffordances(def, 'build').answers).toEqual(['build']);
    expect(resolveAffordances(def, 'build').fromMode).toEqual(['answers']);
    expect(resolveAffordances(def, 'say').answers).toEqual(['spoken', 'build']);
    expect(resolveAffordances(def, 'build').representation).toEqual(['concrete']);
  });

  it('renders a terse tag with only the axes present', () => {
    const def: ComponentDefinition = {
      id: 'x' as ComponentDefinition['id'],
      description: 'd',
      affordances: { audience: 'caregiver', representation: 'concrete', answers: ['manipulate'], role: 'apply', minutes: 10, maxPerLesson: 1 },
    };
    expect(renderAffordanceTag(def)).toBe('{for: caregiver · shows: concrete · answers: manipulate · role: apply · ~10 min · max 1/lesson}');
    const minimal: ComponentDefinition = { id: 'y' as ComponentDefinition['id'], description: 'd', affordances: { reader: 'none' } };
    expect(renderAffordanceTag(minimal)).toBe('{reads: none}');
  });
});

describe('affordances — catalog consistency', () => {
  const tagged = UNIVERSAL_CATALOG.filter((c) => c.affordances);

  it('every declared value is in its enum', () => {
    for (const c of tagged) {
      const a = c.affordances!;
      if (a.audience) expect(AFFORDANCE_AUDIENCES, c.id).toContain(a.audience);
      for (const r of asList(a.representation)) expect(AFFORDANCE_REPRESENTATIONS, c.id).toContain(r);
      if (a.reader) expect(AFFORDANCE_READERS, c.id).toContain(a.reader);
      for (const ans of a.answers ?? []) expect(AFFORDANCE_ANSWERS, c.id).toContain(ans);
      for (const r of asList(a.role)) expect(AFFORDANCE_ROLES, c.id).toContain(r);
      if (a.minutes !== undefined) expect(a.minutes, c.id).toBeGreaterThan(0);
      if (a.maxPerLesson !== undefined) expect(a.maxPerLesson, c.id).toBeGreaterThan(0);
      for (const m of c.evalModes ?? []) {
        const ma = m.affordances;
        if (!ma) continue;
        for (const r of asList(ma.representation)) expect(AFFORDANCE_REPRESENTATIONS, `${c.id}/${m.evalMode}`).toContain(r);
        if (ma.reader) expect(AFFORDANCE_READERS, `${c.id}/${m.evalMode}`).toContain(ma.reader);
        for (const ans of ma.answers ?? []) expect(AFFORDANCE_ANSWERS, `${c.id}/${m.evalMode}`).toContain(ans);
      }
    }
  });

  it('a judged pack (audioInput) that declares answers includes spoken', () => {
    for (const c of tagged) {
      if (c.audioInput && c.affordances!.answers) {
        expect(c.affordances!.answers, c.id).toContain('spoken');
      }
    }
  });

  it('a spoken answer needs a tutoring scaffold (the tutor is the judge)', () => {
    for (const c of tagged) {
      if (resolveAffordances(c).answers.includes('spoken')) {
        expect(c.tutoring, c.id).toBeDefined();
      }
    }
  });

  it('a caregiver block is never the one that measures the child', () => {
    for (const c of tagged) {
      if (c.affordances!.audience === 'caregiver') {
        expect(asList(c.affordances!.role), c.id).not.toContain('assess');
        expect(c.evalModes ?? [], c.id).toHaveLength(0);
      }
    }
  });

  it('mode overrides name modes the primitive actually has', () => {
    for (const c of tagged) {
      for (const m of c.evalModes ?? []) {
        if (m.affordances) expect(c.evalModes!.map((x) => x.evalMode), c.id).toContain(m.evalMode);
      }
    }
  });

  it('the math pilot set is tagged', () => {
    const { tagged: ids } = affordanceCoverage(UNIVERSAL_CATALOG);
    for (const id of [
      'counting-board', 'ten-frame', 'addition-subtraction-scene', 'number-sequencer', 'number-tracer',
      'hundreds-chart', 'fast-fact', 'knowledge-check', 'take-home-activity', 'concept-card-grid', 'di-spoken-practice',
    ]) expect(ids, id).toContain(id);
  });
});
