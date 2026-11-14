import { describe, expect, it } from 'vitest';
import type { ExhibitManifest } from '../../types';
import type { StudentGenerationContext } from '../studentContext/types';
import { resolveGenerationContext } from '../generation/resolveGenerationContext';
import { flattenManifestToLayout, misconceptionMatchesComponent } from './flattenManifest';

const manifest: ExhibitManifest = {
  topic: 'Comparing quantities',
  gradeLevel: 'elementary',
  themeColor: 'blue',
  objectiveBlocks: [{
    objectiveId: 'obj-compare',
    objectiveText: 'Compare two quantities',
    objectiveVerb: 'apply',
    components: [{
      componentId: 'tape-diagram',
      instanceId: 'td-1',
      title: 'Compare with bars',
      intent: 'Find the difference',
    }],
  }],
};

const objectives = [{
  id: 'obj-compare',
  text: 'Compare two quantities',
  verb: 'apply',
  subskillId: 'SUB-1',
  skillId: 'SKILL-1',
}];

describe('flattenManifestToLayout misconception threading', () => {
  it('stamps the matching objective diagnosis into private generator config', () => {
    const studentContext: StudentGenerationContext = {
      available: true,
      objectives: [{
        objectiveId: 'obj-compare',
        objectiveText: 'Compare two quantities',
        tier: 'exact',
        summary: 'resolved',
        subskillDescription: 'Compare quantities by finding the difference',
      }],
      activeMisconceptions: [{
          text: 'The student treats the smaller quantity as the difference.',
          primitiveType: 'tape-diagram',
          scope: 'primitive',
        }],
    };

    const [item] = flattenManifestToLayout(manifest, objectives, studentContext);
    expect(item.config?.remediationFocus)
      .toBe('The student treats the smaller quantity as the difference.');
    expect(item.config?.remediationLabel)
      .toBe('Compare two quantities');
    expect(item.config?.remediationForPrimitiveType).toBe('tape-diagram');
  });

  it('is shape-preserving when no misconception is active', () => {
    const baseline = flattenManifestToLayout(manifest, objectives);
    const withoutSignal = flattenManifestToLayout(manifest, objectives, {
      available: true,
      objectives: [{
        objectiveId: 'obj-compare',
        objectiveText: 'Compare two quantities',
        tier: 'exact',
        summary: 'resolved',
      }],
    });
    expect(withoutSignal).toEqual(baseline);
  });

  it('does not bleed a primitive diagnosis into a sibling component', () => {
    const siblingManifest: ExhibitManifest = {
      ...manifest,
      objectiveBlocks: [{
        ...manifest.objectiveBlocks![0],
        components: [{
          componentId: 'comparison-builder',
          instanceId: 'cb-1',
          title: 'Compare objects',
          intent: 'Compare quantities',
        }],
      }],
    };
    const [item] = flattenManifestToLayout(siblingManifest, objectives, {
      available: true,
      objectives: [],
      activeMisconceptions: [{
        text: 'Private diagnosis',
        primitiveType: 'tape-diagram',
        scope: 'primitive',
      }],
    });
    expect(item.config?.remediationFocus).toBeUndefined();
  });

  it('recovers the lesson grade when the manifest uses synthetic objectiveIds', () => {
    // Daily-session shape: objectives are keyed by subskillId and carry a grade,
    // but the manifest LLM emitted a synthetic 'obj1' objectiveId that does not
    // join. Grade must still reach config so ctx.grade → pre-reader gating works.
    const syntheticManifest: ExhibitManifest = {
      ...manifest,
      objectiveBlocks: [{
        ...manifest.objectiveBlocks![0],
        objectiveId: 'obj1',
      }],
    };
    const gradedObjectives = [{
      id: 'SUB-K-PLANTS-01',
      text: 'Compare two quantities',
      verb: 'apply',
      subskillId: 'SUB-K-PLANTS-01',
      skillId: 'SKILL-K-1',
      grade: 'K',
    }];
    const [item] = flattenManifestToLayout(syntheticManifest, gradedObjectives);
    expect(item.config?.objectiveGrade).toBe('K');
  });

  it('stamps a topic-driven manifest numeric grade for canonical downstream parsing', () => {
    const numericGradeManifest: ExhibitManifest = {
      ...manifest,
      gradeLevel: 'Grade 1',
      finalAssessment: {
        componentId: 'knowledge-check',
        instanceId: 'kc-1',
        title: 'Check understanding',
        intent: 'Assess comparing quantities',
      },
    };

    const layout = flattenManifestToLayout(numericGradeManifest, objectives);
    expect(layout[0].config?.objectiveGrade).toBe('Grade 1');
    expect(resolveGenerationContext(layout[0], manifest.topic, 'band prose', 'elementary').grade)
      .toBe('1');
    expect(layout[1].config?.objectiveGrade).toBe('Grade 1');
    expect(layout[1].config?.lessonObjectives).toEqual([
      expect.objectContaining({ id: 'obj-compare', grade: 'Grade 1' }),
    ]);
  });

  it('stamps the objective\'s evidence spec into every component of its block, the final check and the generation context', () => {
    const evidence = { act: 'explain' as const, on: 'a friend who counts on from eight', credit: 'the child says ten plus three is quicker', notCredit: 'names making ten without saying what it does' };
    const twoBlocks: ExhibitManifest = {
      ...manifest,
      objectiveBlocks: [
        { ...manifest.objectiveBlocks![0], components: [
          { componentId: 'ten-frame', instanceId: 'tf-1', title: 'Fill', intent: 'Make ten', config: { evidence: { act: 'set', credit: 'a tester sent this', notCredit: 'x' } } },
          { componentId: 'practice-studio', instanceId: 'ps-1', title: 'Say', intent: 'Explain it' },
        ] },
        { objectiveId: 'obj-other', objectiveText: 'Count to ten', objectiveVerb: 'apply', components: [
          { componentId: 'counting-board', instanceId: 'cb-1', title: 'Count', intent: 'Count' },
        ] },
      ],
      finalAssessment: { componentId: 'knowledge-check', instanceId: 'kc-1', title: 'Check', intent: 'Check' },
    };
    const layout = flattenManifestToLayout(twoBlocks, [{ ...objectives[0], evidence }, { id: 'obj-other', text: 'Count to ten', verb: 'apply' }]);
    // The lesson's spec wins over a per-item one; a block whose objective has none stamps none.
    expect(layout[0].config?.evidence).toEqual(evidence);
    expect(layout[1].config?.evidence).toEqual(evidence);
    expect(layout[2].config?.evidence).toBeUndefined();
    expect(layout[3].config?.lessonObjectives).toEqual([
      expect.objectContaining({ id: 'obj-compare', evidence }),
      expect.not.objectContaining({ evidence: expect.anything() }),
    ]);
    expect(resolveGenerationContext(layout[1], manifest.topic, 'band prose', 'elementary').objective.evidence).toEqual(evidence);
    expect(resolveGenerationContext(layout[2], manifest.topic, 'band prose', 'elementary').objective.evidence).toBeUndefined();
  });

  it('matches skill scope only inside the canonical skill', () => {
    const misconception = {
      text: 'Private diagnosis',
      primitiveType: 'knowledge-check',
      scope: 'skill' as const,
      skillId: 'SKILL-1',
    };
    expect(misconceptionMatchesComponent(
      misconception, 'knowledge-check', 'skill', 'SKILL-1',
    )).toBe(true);
    expect(misconceptionMatchesComponent(
      misconception, 'knowledge-check', 'skill', 'SKILL-2',
    )).toBe(false);
    expect(misconceptionMatchesComponent(
      misconception, 'knowledge-check', 'skill', undefined,
    )).toBe(false);
  });
});
