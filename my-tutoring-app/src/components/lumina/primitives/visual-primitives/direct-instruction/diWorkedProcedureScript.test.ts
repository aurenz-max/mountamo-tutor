/**
 * di-worked-procedure — the pack's standing gates (through the shared testkit)
 * plus the pedagogy pins that are this pack's whole point: a MOVE is judged,
 * the ask never states what the child must say, half a move is a named
 * correction, and a move-on carries the step onto the page.
 */

import { describe, it, expect } from 'vitest';
import { checkDiCatalogEntry, checkPackGates } from '../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf, spokenSpansOf, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import {
  WORKED_PROCEDURE_BENCH_PROBES,
  WORKED_PROCEDURE_BENCH_PROBLEMS,
  workedProcedureHarnessAnswers,
} from '../../../service/qa/di/workedProcedureBench';
import {
  askLine,
  contextFor,
  correctionLines,
  diWorkedProcedurePackBase,
  itemCue,
  itemsFromProblems,
  moveOnCue,
  verifyLine,
  withWorkedProcedureAction,
  type WorkedProblemSpec,
  type WorkedProcedureItem,
} from './diWorkedProcedureScript';

const entry = DI_CATALOG.find((c) => c.id === 'di-worked-procedure')!;

/** A real session shape: three problems, the second two back to back in the
 *  same mode, so the repeat-ask gate is awake. */
const SESSION: WorkedProblemSpec[] = [
  { id: 'p1', minuend: 52, subtrahend: 28, challengeType: 'subtract_regroup' },
  { id: 'p2', minuend: 342, subtrahend: 168, challengeType: 'subtract_regroup' },
  { id: 'p3', minuend: 75, subtrahend: 32, challengeType: 'subtract_no_regroup' },
];

const build = (specs: WorkedProblemSpec[] = SESSION) => {
  const { items, dropped } = itemsFromProblems(specs);
  const pack: JudgedScriptPack<WorkedProcedureItem> = { ...diWorkedProcedurePackBase(items) };
  return { items, dropped, pack };
};

const byId = (items: WorkedProcedureItem[], id: string): WorkedProcedureItem => {
  const it = items.find((i) => i.id === id);
  if (!it) throw new Error(`no item ${id} — have ${items.map((i) => i.id).join(', ')}`);
  return it;
};

describe('standing gates — the shared testkit', () => {
  it('passes every pack gate on the real session shape', () => {
    const { pack, dropped } = build();
    expect(dropped).toBe(0);
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('passes the pack gates at the easy tier too (the ask states digits)', () => {
    const { pack } = build(SESSION.map((s) => ({ ...s, supportTier: 'easy' as const })));
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('matches the catalog entry: audio mode, contextKeys, template keys, sentinels', () => {
    const { pack, items } = build();
    expect(checkDiCatalogEntry(entry, pack, items[0])).toEqual([]);
  });
});

describe('the step chain becomes items', () => {
  it('expands one problem into one judged item per step, in working order', () => {
    const { items } = build([SESSION[0]]);
    expect(items.map((i) => `${i.place}:${i.kind}`)).toEqual([
      'ones:decide', 'ones:subtract', 'tens:decide',
    ]);
    expect(items.map((i) => i.responseClass)).toEqual([
      'procedure_step', 'number_word_to_20', 'procedure_step',
    ]);
    expect(items.every((i) => i.answerKind === 'voice' && i.action === 'talk_through')).toBe(true);
    expect(items.every((i) => i.answerKind === i.actionContract?.answerKind)).toBe(true);
    expect(items[0].isFirstStep).toBe(true);
    expect(items[2].isLastStep).toBe(true);
  });

  it('DROPS a problem the plan gates refuse, and one that contradicts its mode', () => {
    const { items, dropped } = itemsFromProblems([
      { id: 'flip', minuend: 53, subtrahend: 28, challengeType: 'subtract_regroup' },
      { id: 'lie', minuend: 75, subtrahend: 32, challengeType: 'subtract_regroup' },
      { id: 'ok', minuend: 75, subtrahend: 32, challengeType: 'subtract_no_regroup' },
    ]);
    expect(dropped).toBe(2);
    expect(items.map((i) => i.problemId)).toEqual(['ok', 'ok']);
  });
});

describe('the ask never states what the child must say', () => {
  it('states the problem on the first step only, then names the column', () => {
    const { items } = build([SESSION[0]]);
    expect(askLine(items[0])).toBe('Fifty-two minus twenty-eight. Look at the ones column. Say why you need to regroup and what the digits become.');
    expect(askLine(items[1])).toBe('Subtract the ones column, then say the result.');
    expect(askLine(items[2])).toBe('Look at the tens column. Say that you do not regroup, then subtract and say the result.');
    for (const item of items) {
      expect(askLine(item)).toContain(withWorkedProcedureAction(item).actionContract.instruction);
    }
  });

  it('never carries the step\'s answer in the spoken ask (medium/hard)', () => {
    const { items, pack } = build();
    for (const item of items) {
      const spoken = spokenSpanOf(pack.itemCue(item, { opening: false, howToPlay: false })).toLowerCase();
      const answers = workedProcedureHarnessAnswers(item);
      const exempt = (answers.leakExemptSpan as string[]).map((s) => s.toLowerCase());
      const scrubbed = exempt.reduce((s, span) => s.replace(span, ' '), spoken);
      for (const token of answers.leakTokens) {
        expect(scrubbed, `${item.id}: "${spoken}" leaks "${token}"`).not.toMatch(new RegExp(`\\b${token}\\b`));
      }
    }
  });

  it('at easy the ask reads the column digits — the decremented digit included', () => {
    const { items } = build([{ ...SESSION[0], supportTier: 'easy' }]);
    expect(askLine(items[0])).toBe('Fifty-two minus twenty-eight. Look at the ones column: two minus eight. Say why you need to regroup and what the digits become.');
    expect(askLine(items[1])).toBe('Subtract the ones column: twelve minus eight, then say the result.');
    expect(askLine(items[2])).toBe('Look at the tens column: four minus two. Say that you do not regroup, then subtract and say the result.');
  });

  it('the how-to-play rides inside the opening line only', () => {
    const { items, pack } = build();
    expect(spokenSpanOf(pack.itemCue(items[0], { opening: true, howToPlay: true }))).toMatch(/^We are going to work subtraction out loud/);
    expect(spokenSpanOf(pack.itemCue(items[3], { opening: false, howToPlay: false }))).toMatch(/^Three hundred forty-two minus/);
  });
});

describe('a regroup is judged on the MOVE and both numbers', () => {
  it('affirms the whole regroup, and every correction opens "My turn" and ends on the re-ask', () => {
    const { items } = build([SESSION[0]]);
    const regroup = items[0];
    expect(verifyLine(regroup)).toBe('Yes, regroup: four tens, twelve ones.');
    const lines = correctionLines(regroup);
    expect(lines.forgotDecrement).toBe(
      'My turn: when you regroup, the tens change too. Five tens becomes four: four tens, twelve ones. '
      + 'Your turn. Look at the ones column. Say why you need to regroup and what the digits become.',
    );
    expect(lines.contrast).toMatch(/^My turn: not ⟨what they said⟩ — two minus eight, I can't take eight from two, so I regroup\. One ten becomes ten ones: four tens, twelve ones\. Your turn\./);
    expect(lines.fallback).toMatch(/^My turn: two minus eight\. I can't take eight from two, so I regroup\./);
  });

  it('writes its contract in the family order: ask, affirm, specific corrections, general last', () => {
    const { items, pack } = build([SESSION[0]]);
    const spans = spokenSpansOf(pack.itemCue(items[0], { opening: false, howToPlay: false }));
    expect(spans).toHaveLength(5);
    expect(spans[1]).toMatch(/^Yes, regroup/);
    expect(spans[2]).toMatch(/^My turn: when you regroup/);
    expect(spans[3]).toMatch(/^My turn: not ⟨what they said⟩/);
    expect(spans[4]).toMatch(/^My turn: two minus eight\./);
    const contract = pack.itemCue(items[0], { opening: false, howToPlay: false });
    expect(contract).toContain('The signature error is turning the column upside down — "eight minus two is six"');
    expect(contract).toContain('forgot to decrement');
  });

  it('names the double mark: a column that lent AND regroups is judged on the decremented digit', () => {
    const { items } = build([SESSION[1]]);
    const tens = byId(items, 'p2-c1-decide');
    expect(tens.regroup).toBe(true);
    expect(tens.column.lent).toBe(true);
    expect(verifyLine(tens)).toBe('Yes, regroup: two hundreds, thirteen tens.');
    expect(correctionLines(tens).fallback).toMatch(/^My turn: three minus six\. I can't take six from three, so I regroup\. One hundred becomes ten tens: two hundreds, thirteen tens\./);
  });
});

describe('a no-regroup column is judged on the decision too', () => {
  it('on a column that lent, the forgot-to-decrement branch exists and names the crossed-out digit', () => {
    const { items } = build([SESSION[0]]);
    const tens = byId(items, 'p1-c1-decide');
    expect(tens.column.lent).toBe(true);
    const lines = correctionLines(tens);
    expect(lines.unneededRegroup).toMatch(/^My turn: you can take two from four, so you do not regroup\. Four minus two is two\./);
    expect(lines.forgotDecrement).toMatch(/^My turn: not ⟨what they said⟩ — this column lent one, so it is four now, not five\./);
    expect(verifyLine(tens)).toBe('Yes, no regrouping: four minus two is two. Fifty-two minus twenty-eight is twenty-four.');
  });

  it('on a column that did not lend, there is no forgot-to-decrement branch', () => {
    const { items } = build([SESSION[2]]);
    const ones = byId(items, 'p3-c0-decide');
    expect(ones.column.lent).toBe(false);
    expect(correctionLines(ones).forgotDecrement).toBeUndefined();
    expect(correctionLines(ones).unneededRegroup).toMatch(/^My turn: you can take two from five/);
  });
});

describe('after a regroup, the subtract step is a benched number word', () => {
  it('asks for the difference and contrasts a wrong number', () => {
    const { items } = build([SESSION[0]]);
    const sub = byId(items, 'p1-c0-subtract');
    expect(sub.responseClass).toBe('number_word_to_20');
    expect(verifyLine(sub)).toBe('Yes, twelve minus eight is four.');
    expect(correctionLines(sub).contrast).toBe('My turn: not ⟨what they said⟩ — twelve minus eight is four. Your turn. Subtract the ones column, then say the result.');
  });
});

describe('a move-on carries the step', () => {
  it('states the regroup before the next ask, so the page can write it', () => {
    const { items, pack } = build([SESSION[0]]);
    const spoken = spokenSpanOf(pack.moveOnCue(items[0], items[1], { opening: false, howToPlay: false }));
    expect(spoken).toBe('Good try. We regroup: four tens, twelve ones. Subtract the ones column, then say the result.');
  });

  it('closes a problem with its whole result before the next problem\'s ask', () => {
    const { items, pack } = build();
    const last = byId(items, 'p1-c1-decide');
    const next = byId(items, 'p2-c0-decide');
    expect(spokenSpanOf(moveOnCue(last, next, { opening: false, howToPlay: false }))).toBe(
      'Good try. No regrouping: four minus two is two. Fifty-two minus twenty-eight is twenty-four. '
      + 'Three hundred forty-two minus one hundred sixty-eight. Look at the ones column. Say why you need to regroup and what the digits become.',
    );
  });

  it('ends the run warmly when there is no next step', () => {
    const { items } = build([SESSION[2]]);
    const cue = moveOnCue(items[1], null, { opening: false, howToPlay: false });
    expect(spokenSpanOf(cue)).toMatch(/^Good try\. No regrouping: seven minus three is four\. Seventy-five minus thirty-two is forty-three\. That's the end/);
  });
});

describe('runtime state is stimulus-side only', () => {
  it('pushes the printed problem and the open column, never a difference or a regrouped digit', () => {
    const { items } = build([SESSION[0]]);
    expect(contextFor(items[0])).toEqual({
      challengeType: 'subtract_regroup', problem: '52 − 28', column: 'ones', supportTier: 'medium',
    });
    const values = Object.values(contextFor(items[1])).join(' ');
    expect(values).not.toMatch(/\b(four|twelve|24)\b/);
  });

  it('cues never speak a bracket tag or a performed WAIT', () => {
    const { items, pack } = build();
    for (const item of items) {
      const spoken = spokenSpanOf(itemCue(item, { opening: false, howToPlay: false }));
      expect(spoken).not.toMatch(/\[|\]/);
      expect(pack.itemCue(item, { opening: false, howToPlay: false })).not.toMatch(/then wait/i);
    }
  });
});

describe('the bench fixture', () => {
  it('builds every fixture problem through the shipped gates, with no drops', () => {
    const { items, dropped } = itemsFromProblems(WORKED_PROCEDURE_BENCH_PROBLEMS);
    expect(dropped).toBe(0);
    const ids = new Set(items.map((i) => i.id));
    for (const probeId of Object.keys(WORKED_PROCEDURE_BENCH_PROBES)) {
      expect(ids.has(probeId), `probe key ${probeId} names no built item`).toBe(true);
    }
  });

  it('attaches probes by item id only, and hands every item its signature wrong', () => {
    const { items } = itemsFromProblems(WORKED_PROCEDURE_BENCH_PROBLEMS);
    for (const item of items) {
      const answers = workedProcedureHarnessAnswers(item);
      expect(answers.correct).toBeTruthy();
      expect(answers.plainWrong).not.toBe(answers.correct);
      expect(answers.signatureWrong?.text).toBeTruthy();
      if (WORKED_PROCEDURE_BENCH_PROBES[item.id]) expect(answers.probes).toBe(WORKED_PROCEDURE_BENCH_PROBES[item.id]);
      else expect(answers.probes).toBeUndefined();
    }
    // The flip on a regroup column is never the right digit — the bench relies on it.
    const regroup = byId(items, 'wpb-52-28-c0-decide');
    expect(workedProcedureHarnessAnswers(regroup).signatureWrong?.text).toBe('eight minus two is six');
  });
});
