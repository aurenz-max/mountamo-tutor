import { describe, expect, it } from 'vitest';

import { validateChallengeTypes } from './route';

describe('eval-test usable-content validation', () => {
  it('fails an empty item array even when the root challenge type is allowed', () => {
    expect(validateChallengeTypes(
      { challengeType: 'say_answer', items: [] },
      'di-spoken-practice',
      'say_answer',
    )).toMatchObject({
      valid: false,
      challengeCount: 0,
      error: 'Generated items array is empty; no usable evaluation content was produced',
    });
  });

  it('passes a populated item array whose item modes match the catalog', () => {
    expect(validateChallengeTypes(
      { challengeType: 'say_answer', items: [{ mode: 'say_answer' }] },
      'di-spoken-practice',
      'say_answer',
    )).toMatchObject({
      valid: true,
      challengeCount: 1,
      typesFound: ['say_answer'],
    });
  });
});
