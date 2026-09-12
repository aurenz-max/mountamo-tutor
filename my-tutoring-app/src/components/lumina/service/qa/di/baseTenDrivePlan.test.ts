/**
 * base-ten-blocks headless drive plan (`/tutor-test --di base-ten-blocks`).
 *
 * The port shipped its judged loop with NO adapter, so `--di`, `--di-cap` and
 * `--di-wrong` could not reach it at all and the only way to exercise the loop
 * was a human at a browser. This pins the plan the harness replays: the same
 * cues the stage sends, the answer material the contract claims it refuses, and
 * the code-computed verdict for the hands turn.
 *
 * What it does NOT establish is the same for every port: a green plan is the
 * LOOP and the JUDGE'S SEMANTICS, never acoustics, ASR, VAD or the mic.
 */
import { describe, expect, it } from 'vitest';
import { buildDiDrivePlan, DI_PORTS, isDiPort } from './diDrivePlan';

const payload = (type: 'read_blocks' | 'regroup', ...targets: number[]) => ({
  title: 'Place value with blocks',
  gradeBand: '2-3',
  challenges: targets.map((targetNumber, index) => ({
    id: `c${index + 1}`,
    type,
    targetNumber,
    instruction: 'unused — the pack owns every ask',
    hint: 'unused',
  })),
});

describe('base-ten-blocks DI drive plan', () => {
  it('is registered, so the port can be driven headlessly at all', () => {
    expect(isDiPort('base-ten-blocks')).toBe(true);
    expect(DI_PORTS['base-ten-blocks'].gestureVerdictCue).toBeTypeOf('function');
  });

  it('read_blocks drives count then value, both by mouth', () => {
    const plan = buildDiDrivePlan('base-ten-blocks', payload('read_blocks', 247), 'Grade 2');

    expect(plan.primitiveType).toBe('base-ten-blocks');
    expect(plan.items.map((item) => item.answerKind)).toEqual(['voice', 'voice']);
    expect(plan.items.map((item) => item.action)).toEqual(['read-count', 'read-worth']);
    expect(plan.items.map((item) => item.responseClass))
      .toEqual(['number_word_to_20', 'place_value_word']);
    expect(plan.items[0].answers.correct).toBe('two');
    expect(plan.items[1].answers.correct).toBe('two hundred');
    expect(plan.packGateIssues).toEqual([]);
    expect(plan.droppedChallenges).toBe(0);
  });

  it('⭐ every voice item carries a real affirm AND correction line', () => {
    // The defect this bites: the pack wrote `say exactly "…"` without the colon
    // the shared span parser anchors on, so the plan read `affirmLine` as
    // undefined and `correctionLine` as the ASK — the harness would have
    // compared the tutor's correction against the question it just asked.
    const plan = buildDiDrivePlan('base-ten-blocks', payload('read_blocks', 247, 35), 'Grade 2');
    for (const item of plan.items) {
      expect(item.askLine).not.toBe('');
      expect(item.affirmLine).toBeTruthy();
      expect(item.correctionLine).toBeTruthy();
      expect(item.affirmLine).not.toBe(item.askLine);
      expect(item.correctionLine).not.toBe(item.askLine);
      expect(item.affirmLine!.toLowerCase().startsWith('yes')).toBe(true);
      expect(item.correctionLine!.startsWith('My turn:')).toBe(true);
    }
  });

  it('regroup drives a spoken prediction and then a hands trade', () => {
    const plan = buildDiDrivePlan('base-ten-blocks', payload('regroup', 247), 'Grade 2');

    expect(plan.items.map((item) => item.answerKind)).toEqual(['voice', 'gesture']);
    expect(plan.items.map((item) => item.action)).toEqual(['trade-predict', 'trade-make']);
    expect(plan.items[0].answers.correct).toBe('fourteen');
    expect(plan.items[0].answers.signatureWrong?.text).toBe('ten');

    // The hands turn is judged in code and handed to the tutor as fact.
    const gesture = plan.items[1];
    expect(gesture.answers.placed).toEqual({ correct: 2, wrong: 1 });
    expect(gesture.gestureVerdict?.correct).toContain('Code computed solved=true');
    expect(gesture.gestureVerdict?.wrong).toContain('Code computed solved=false');
    // …and a gesture item is owed no spoken verdict lines.
    expect(gesture.affirmLine).toBeUndefined();
    expect(gesture.correctionLine).toBeUndefined();
    expect(plan.packGateIssues).toEqual([]);
  });

  it('the opening item recites the how-to-play and no later item repeats it', () => {
    const plan = buildDiDrivePlan('base-ten-blocks', payload('read_blocks', 247, 35), 'Grade 2');
    expect(plan.items[0].askLine).toContain('Let us read the blocks together.');
    for (const item of plan.items.slice(1)) {
      expect(item.askLine).not.toContain('Let us read the blocks together.');
    }
    // The re-anchor form drops the opening even on item 0.
    expect(plan.items[0].reanchorCue).not.toContain('Let us read the blocks together.');
  });

  it('a number that cannot carry an honest ask is counted as DROPPED', () => {
    const plan = buildDiDrivePlan('base-ten-blocks', payload('read_blocks', 7, 247), 'Grade 2');
    expect(plan.items).toHaveLength(2);
    expect(plan.droppedChallenges).toBe(1);
  });

  it('⭐ a payload the component would not route here builds NO session', () => {
    // `usesBaseTenDi` is all-or-nothing: a mixed deck gets the click surface, so
    // a drive of one would be exercising a session no child can be given.
    const mixed = buildDiDrivePlan('base-ten-blocks', {
      ...payload('read_blocks', 247),
      challenges: [
        { id: 'a', type: 'read_blocks', targetNumber: 247, instruction: '', hint: '' },
        { id: 'b', type: 'build_number', targetNumber: 12, instruction: '', hint: '' },
      ],
    }, 'Grade 2');
    expect(mixed.items).toHaveLength(0);
    expect(mixed.droppedChallenges).toBe(2);
    expect(mixed.packGateIssues).toEqual(['no items survived the build gates']);

    // Same for a regroup deck of multiples of ten, every one of which would
    // make the ask state its own answer.
    const degenerate = buildDiDrivePlan('base-ten-blocks', payload('regroup', 40, 100), 'Grade 2');
    expect(degenerate.items).toHaveLength(0);
    expect(degenerate.droppedChallenges).toBe(2);
  });

  it('the context bag the harness resolves {{keys}} against carries no answer', () => {
    const plan = buildDiDrivePlan('base-ten-blocks', payload('read_blocks', 247), 'Grade 2');
    const context = plan.items[0].context;
    for (const key of ['numberValue', 'currentTotal', 'columns', 'targetNumber']) {
      expect(context[key]).toContain('withheld');
    }
    expect(Object.values(context).join(' ')).not.toContain('247');
  });
});
