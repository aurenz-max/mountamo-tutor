import { describe, expect, it } from 'vitest';
import type { ManifestItem } from '../../types';
import { resolveRemediationIdentity } from '../remediation/remediationTransport';

const item: ManifestItem = {
  componentId: 'tape-diagram',
  instanceId: 'td-1',
  title: 'Compare',
  intent: 'Find the difference',
  config: {
    remediationFocus: 'Private diagnosis',
    remediationForPrimitiveType: 'tape-diagram',
  },
};

describe('resolveRemediationIdentity', () => {
  it('tags only the matching remediating primitive instance', () => {
    expect(resolveRemediationIdentity([item], 'td-1', 'tape-diagram', 'SKILL-1'))
      .toEqual({ primitiveType: 'tape-diagram', skillId: undefined });
    expect(resolveRemediationIdentity([item], 'other', 'tape-diagram', 'SKILL-1')).toBeUndefined();
  });

  it('never emits a tag for a sibling primitive', () => {
    expect(resolveRemediationIdentity([item], 'td-1', 'comparison-builder', 'SKILL-1')).toBeUndefined();
  });

  it('does not tag an affordance-abstained tape-diagram mode', () => {
    expect(resolveRemediationIdentity(
      [item], 'td-1', 'tape-diagram', 'SKILL-1', 'solve_part_whole',
    )).toBeUndefined();
  });
});
