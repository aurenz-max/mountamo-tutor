import { describe, expect, it } from 'vitest';
import type { ExhibitManifest } from '../../types';
import type { StudentGenerationContext } from '../studentContext/types';
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
