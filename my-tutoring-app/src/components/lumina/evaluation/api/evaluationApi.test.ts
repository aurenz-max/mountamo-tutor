import { describe, expect, it } from 'vitest';
import { buildRemediationProblemMetadata } from '../remediation/remediationTransport';

describe('convertToProblemSubmission remediation tag', () => {
  it('places only the scope-matched remediation identity in problem metadata', () => {
    const payload = buildRemediationProblemMetadata({ primitiveType: 'tape-diagram' });
    expect(payload).toEqual({ metadata: {
      remediation_for_primitive_type: 'tape-diagram',
    }});
    expect(JSON.stringify(payload)).not.toContain('smaller quantity');
  });

  it('preserves the baseline problem shape when remediation is absent', () => {
    expect(buildRemediationProblemMetadata()).toEqual({});
  });
});
