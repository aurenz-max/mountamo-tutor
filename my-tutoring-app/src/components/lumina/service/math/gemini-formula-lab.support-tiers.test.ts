import { describe, expect, it, vi } from 'vitest';
import type {
  FormulaLabChallenge,
  FormulaLabChallengeType,
} from '../../primitives/visual-primitives/math/FormulaLab';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import {
  applyFormulaLabSupportTier,
  normalizeSupportTier,
  resolveSupportStructure,
} from './gemini-formula-lab';

const challenge = (type: FormulaLabChallengeType): FormulaLabChallenge => ({
  id: `challenge-${type}`,
  type,
  changedVariableSymbol: 'm',
  baselineValues: [4, 3],
  targetValues: [8, 3],
  expectedBaselineOutput: 12,
  expectedTargetOutput: 24,
  correctDirection: 'increase',
});

describe('Formula Lab support-tier harness', () => {
  it('normalizes only the three manifest tiers', () => {
    expect(normalizeSupportTier('easy')).toBe('easy');
    expect(normalizeSupportTier(' Medium ')).toBe('medium');
    expect(normalizeSupportTier('HARD')).toBe('hard');
    expect(normalizeSupportTier(undefined)).toBeNull();
    expect(normalizeSupportTier('expert')).toBeNull();
  });

  it('withdraws simulation overlays and strategy cues monotonically', () => {
    const easy = resolveSupportStructure('predict-direction', 'easy');
    const medium = resolveSupportStructure('predict-direction', 'medium');
    const hard = resolveSupportStructure('predict-direction', 'hard');

    expect(easy).toMatchObject({
      showLiveOutputReadout: true,
      strategyCue: 'visible',
      requireJustification: false,
    });
    expect(medium).toMatchObject({
      showLiveOutputReadout: false,
      strategyCue: 'hint',
      requireJustification: false,
    });
    expect(hard).toMatchObject({
      showLiveOutputReadout: false,
      strategyCue: 'none',
      requireJustification: true,
    });
  });

  it('uses mode-specific constructor and transfer scaffolds', () => {
    expect(resolveSupportStructure('construct-formula', 'easy')).toMatchObject({
      groupFormulaTokens: true,
      strategyCue: 'visible',
    });
    expect(resolveSupportStructure('construct-formula', 'hard')).toMatchObject({
      groupFormulaTokens: false,
      strategyCue: 'none',
    });
    expect(resolveSupportStructure('transfer-apply', 'easy')).toMatchObject({
      showSubstitutionSetup: true,
      requireJustification: false,
    });
    expect(resolveSupportStructure('transfer-apply', 'hard')).toMatchObject({
      showSubstitutionSetup: false,
      requireJustification: true,
    });
  });

  it('applies the tier per challenge in a blended session without changing numbers or answers', () => {
    const challenges = [
      challenge('free-explore'),
      challenge('predict-direction'),
      challenge('construct-formula'),
      challenge('transfer-apply'),
    ];
    const answerContractBefore = challenges.map((item) => ({
      type: item.type,
      changedVariableSymbol: item.changedVariableSymbol,
      baselineValues: item.baselineValues,
      targetValues: item.targetValues,
      expectedBaselineOutput: item.expectedBaselineOutput,
      expectedTargetOutput: item.expectedTargetOutput,
      correctDirection: item.correctDirection,
    }));

    applyFormulaLabSupportTier(challenges, 'easy');

    expect(challenges.every((item) => item.supportTier === 'easy')).toBe(true);
    expect(challenges.find((item) => item.type === 'construct-formula')?.groupFormulaTokens).toBe(true);
    expect(challenges.find((item) => item.type === 'transfer-apply')?.showSubstitutionSetup).toBe(true);
    expect(challenges.map((item) => ({
      type: item.type,
      changedVariableSymbol: item.changedVariableSymbol,
      baselineValues: item.baselineValues,
      targetValues: item.targetValues,
      expectedBaselineOutput: item.expectedBaselineOutput,
      expectedTargetOutput: item.expectedTargetOutput,
      correctDirection: item.correctDirection,
    }))).toEqual(answerContractBefore);
  });
});
