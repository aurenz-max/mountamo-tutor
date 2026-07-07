import { describe, expect, it } from 'vitest';
import { placeValueChartOracle } from '../place-value-chart';

/**
 * Seeded-violation tests for the place-value-chart oracle. One clean fixture
 * (trimmed from a real eval-test generation: build mode, "Place value to 1000")
 * that passes with zero violations, plus one mutated fixture per implemented
 * check class that MUST fire. Mirrors the math-fact-fluency test block.
 */

const pvcCtx = {
  componentId: 'place-value-chart',
  evalMode: 'build',
  topic: 'Place value to 1000',
  gradeLevel: 'grade 2',
};

// Trimmed from a real generation (targetNumbers 973 / 269 / 502).
const pvcClean = {
  title: 'Place Value Practice — Building 3-Digit Numbers',
  description: 'Explore three different numbers across three phases.',
  challengeType: 'build',
  showExpandedForm: true,
  showMultipliers: true,
  challenges: [
    {
      id: 'pvc-1',
      targetNumber: 973,
      highlightedDigitPlace: 1,
      minPlace: 0,
      maxPlace: 2,
      placeNameChoices: ['Ones', 'Hundreds', 'Tens', 'Thousands'],
      digitValueChoices: [
        { value: 7, wordForm: 'Seven' },
        { value: 700, wordForm: 'Seven Hundred' },
        { value: 70, wordForm: 'Seventy' },
        { value: 0.7, wordForm: 'Seven Tenths' },
      ],
    },
    {
      id: 'pvc-2',
      targetNumber: 269,
      highlightedDigitPlace: 1,
      minPlace: 0,
      maxPlace: 2,
      placeNameChoices: ['Ones', 'Tens', 'Hundreds', 'Thousands'],
      digitValueChoices: [
        { value: 6, wordForm: 'Six' },
        { value: 600, wordForm: 'Six Hundred' },
        { value: 0.6, wordForm: 'Six Tenths' },
        { value: 60, wordForm: 'Sixty' },
      ],
    },
    {
      id: 'pvc-3',
      targetNumber: 502,
      highlightedDigitPlace: 2,
      minPlace: 0,
      maxPlace: 2,
      placeNameChoices: ['Tens', 'Thousands', 'Ones', 'Hundreds'],
      digitValueChoices: [
        { value: 50, wordForm: 'Fifty' },
        { value: 5000, wordForm: 'Five Thousand' },
        { value: 500, wordForm: 'Five Hundred' },
        { value: 5, wordForm: 'Five' },
      ],
    },
  ],
};

describe('place-value-chart oracle', () => {
  it('passes clean data', () => {
    expect(placeValueChartOracle.verify(pvcClean, pvcCtx).violations).toEqual([]);
  });

  it('flags answer-key desync — correct place name missing from placeNameChoices', () => {
    const data = JSON.parse(JSON.stringify(pvcClean));
    // place 1 → "Tens"; drop it so the student can never pass Phase 1.
    data.challenges[0].placeNameChoices = ['Ones', 'Hundreds', 'Fifties', 'Thousands'];
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pvc-1')).toBe(true);
  });

  it('flags answer-key desync — correct digit value missing from digitValueChoices', () => {
    const data = JSON.parse(JSON.stringify(pvcClean));
    // digit 6 in Tens = 60; remove it (Phase 2 unpassable).
    data.challenges[1].digitValueChoices = [
      { value: 6, wordForm: 'Six' },
      { value: 600, wordForm: 'Six Hundred' },
      { value: 0.6, wordForm: 'Six Tenths' },
      { value: 66, wordForm: 'Sixty Six' },
    ];
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pvc-2')).toBe(true);
  });

  it('flags answer-key desync — target unbuildable within the rendered columns', () => {
    const data = JSON.parse(JSON.stringify(pvcClean));
    // Shrink the chart so the Hundreds column (2) that 269 needs is not rendered:
    // [0,1] reconstructs to 69, not 269. Highlight stays at Tens (in range).
    data.challenges[1].maxPlace = 1;
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pvc-2' && /unbuildable/.test(x.detail))).toBe(true);
  });

  it('flags answer-key desync — duplicate value in digitValueChoices (ambiguous key)', () => {
    const data = JSON.parse(JSON.stringify(pvcClean));
    // Two tiles both worth 500 — the component grades on value, so the key is ambiguous.
    data.challenges[2].digitValueChoices[0] = { value: 500, wordForm: 'Five Hundred (dup)' };
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pvc-3')).toBe(true);
  });

  it('flags scope — targetNumbers exceed the objective ceiling (the "to 100 taught to 1000" class)', () => {
    // Same clean data, but the objective caps at 100 — every 3-digit number blows it.
    const v = placeValueChartOracle.verify(pvcClean, { ...pvcCtx, topic: 'Place value to 100' }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'pvc-1')).toBe(true);
  });

  it('flags schema — highlighted place lands on a zero digit (degenerate card)', () => {
    const data = JSON.parse(JSON.stringify(pvcClean));
    // 502 has a 0 in the Tens place; highlight it → no visible highlighted digit.
    data.challenges[2].highlightedDigitPlace = 1;
    data.challenges[2].placeNameChoices = ['Ones', 'Tens', 'Hundreds', 'Thousands'];
    data.challenges[2].digitValueChoices = [
      { value: 0, wordForm: 'Zero' },
      { value: 5, wordForm: 'Five' },
      { value: 50, wordForm: 'Fifty' },
      { value: 500, wordForm: 'Five Hundred' },
    ];
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'pvc-3' && /degenerate|0/.test(x.detail))).toBe(true);
  });

  it('flags clustering — every number is the same value', () => {
    const data = {
      challengeType: 'build',
      challenges: [1, 2, 3, 4].map((i) => ({
        id: `c${i}`,
        targetNumber: 500,
        highlightedDigitPlace: 2,
        minPlace: 0,
        maxPlace: 2,
        placeNameChoices: ['Ones', 'Tens', 'Hundreds', 'Thousands'],
        digitValueChoices: [
          { value: 5, wordForm: 'Five' },
          { value: 50, wordForm: 'Fifty' },
          { value: 500, wordForm: 'Five Hundred' },
          { value: 5000, wordForm: 'Five Thousand' },
        ],
      })),
    };
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate challenge (same number + same place)', () => {
    const dup = JSON.parse(JSON.stringify(pvcClean.challenges[0]));
    dup.id = 'pvc-dup'; // same 973 @ place 1
    const data = { ...pvcClean, challenges: [...pvcClean.challenges, dup] };
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('does NOT flag the same number highlighted at a DIFFERENT place (legitimate multi-column practice)', () => {
    // 973 already appears highlighted at Tens (pvc-1); add it highlighted at Hundreds.
    const data = {
      ...pvcClean,
      challenges: [
        ...pvcClean.challenges,
        {
          id: 'pvc-4',
          targetNumber: 973,
          highlightedDigitPlace: 2,
          minPlace: 0,
          maxPlace: 2,
          placeNameChoices: ['Ones', 'Tens', 'Hundreds', 'Thousands'],
          digitValueChoices: [
            { value: 9, wordForm: 'Nine' },
            { value: 90, wordForm: 'Ninety' },
            { value: 900, wordForm: 'Nine Hundred' },
            { value: 9000, wordForm: 'Nine Thousand' },
          ],
        },
      ],
    };
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...pvcClean, challenges: [pvcClean.challenges[0]] };
    const v = placeValueChartOracle.verify(data, pvcCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });
});
