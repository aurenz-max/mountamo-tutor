/**
 * di-deduction — the pack's standing gates (through the shared testkit) plus
 * the pedagogy pins that are this pack's whole point: a DEDUCTION is judged
 * (verdict + reason, on meaning), the ask never states what the child must
 * say, the confident yes has its own branch, a verdict with no reason is
 * refused with the "how do you know?" firm-up, and a move-on carries the
 * conclusion onto the page.
 */

import { describe, it, expect } from 'vitest';
import { checkDiCatalogEntry, checkPackGates } from '../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf, spokenSpansOf, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import {
  DEDUCTION_BENCH_PROBES,
  DEDUCTION_BENCH_RULES,
  deductionHarnessAnswers,
} from '../../../service/qa/di/deductionBench';
import {
  askLine,
  contextFor,
  correctionLines,
  diDeductionPackBase,
  HOW_TO_PLAY,
  itemCue,
  itemsFromRules,
  moveOnCue,
  verifyLine,
  withDeductionAction,
  type DeductionItem,
  type DeductionRuleSpec,
  type DeductionSupportTier,
} from './diDeductionScript';

const entry = DI_CATALOG.find((c) => c.id === 'di-deduction')!;

/** The mixed session — three rules, each worked through its shapes. */
const SESSION: DeductionRuleSpec[] = DEDUCTION_BENCH_RULES;
/** A single-shape session: two deny cases back to back on one rule, then two
 *  more on another, so the repeat-ask gate is awake. */
const DENY_SESSION: DeductionRuleSpec[] = DEDUCTION_BENCH_RULES.map((r) => ({ ...r, shapes: ['deny'] as const }));

const build = (specs: DeductionRuleSpec[] = SESSION, tier?: DeductionSupportTier) => {
  const { items, dropped } = itemsFromRules(specs, tier);
  const pack: JudgedScriptPack<DeductionItem> = { ...diDeductionPackBase(items) };
  return { items, dropped, pack };
};

const byId = (items: DeductionItem[], id: string): DeductionItem => {
  const it = items.find((i) => i.id === id);
  if (!it) throw new Error(`no item ${id} — have ${items.map((i) => i.id).join(', ')}`);
  return it;
};

describe('standing gates — the shared testkit', () => {
  it('passes every pack gate on the mixed session shape', () => {
    const { pack, dropped } = build();
    expect(dropped).toBe(0);
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('passes every pack gate on a single-shape session (same-action asks back to back)', () => {
    const { pack, items } = build(DENY_SESSION);
    expect(items.map((i) => i.shape)).toEqual(['deny', 'deny', 'deny', 'deny', 'deny', 'deny']);
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('passes the pack gates at the easy tier too (every ask re-reads the rule)', () => {
    const { pack } = build(SESSION, 'easy');
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('matches the catalog entry: audio mode, contextKeys, template keys, sentinels', () => {
    const { pack, items } = build();
    expect(checkDiCatalogEntry(entry, pack, items[0])).toEqual([]);
  });
});

describe('a rule becomes cases', () => {
  it('works each rule through its shapes in the DI order, one judged item per case', () => {
    const { items } = build();
    expect(items.map((i) => i.id)).toEqual([
      'ddb-insects-c0-conclude', 'ddb-insects-c1-deny',
      'ddb-birds-c0-conclude', 'ddb-birds-c1-deny', 'ddb-birds-c2-cannot_tell',
      'ddb-fish-c0-conclude', 'ddb-fish-c1-deny', 'ddb-fish-c2-cannot_tell',
    ]);
    expect(items.every((i) => i.answerKind === 'voice' && i.responseClass === 'deduction' && i.action === 'deduce')).toBe(true);
    expect(items.every((i) => i.answerKind === i.actionContract?.answerKind)).toBe(true);
    expect(items[0].isFirstCase).toBe(true);
    expect(items[1].isLastCase).toBe(true);
  });

  it('DROPS a rule the gates refuse, and a rule that promises a shape it cannot build', () => {
    const { items, dropped } = itemsFromRules([
      { ...SESSION[1], id: 'bad', propertyNegated: 'lays eggs' },
      { ...SESSION[0], id: 'no-lookalike', shapes: ['cannot_tell'] },
      { ...SESSION[1], id: 'ok', shapes: ['conclude'] },
    ]);
    expect(dropped).toBe(2);
    expect(items.map((i) => i.ruleId)).toEqual(['ok', 'ok']);
  });
});

describe('the ask gives a complete response format without revealing the conclusion', () => {
  it('reads the rule on the first case only, then says "Same rule."', () => {
    const { items } = build([SESSION[1]]);
    expect(askLine(items[0])).toBe('Here is the rule: All birds lay eggs. A robin is a bird. Say what the rule tells you about a robin.');
    expect(askLine(items[1])).toBe("Same rule. A dog does not lay eggs. Is a dog a bird? Say yes, no, or can't tell—then explain using the rule.");
    expect(askLine(items[2])).toBe("Same rule. This animal lays eggs. Is this animal a bird? Say yes, no, or can't tell—then explain using the rule.");
    for (const item of items) {
      expect(askLine(item)).toContain(withDeductionAction(item).actionContract.instruction);
    }
  });

  it('never carries the case\'s answer in the spoken ask (medium/hard), the rule sentence exempt', () => {
    const { items, pack } = build();
    for (const item of items) {
      const spoken = spokenSpanOf(pack.itemCue(item, { opening: false, howToPlay: false })).toLowerCase();
      const answers = deductionHarnessAnswers(item);
      const exempt = (answers.leakExemptSpan as string[]).map((s) => s.toLowerCase());
      const scrubbed = exempt.reduce((s, span) => s.replace(span, ' '), spoken);
      for (const token of answers.leakTokens) {
        expect(scrubbed, `${item.id}: "${spoken}" leaks "${token}"`).not.toMatch(new RegExp(`\\b${token}\\b`));
      }
    }
  });

  it('at easy every ask re-reads the rule', () => {
    const { items } = build([SESSION[1]], 'easy');
    expect(askLine(items[1])).toBe("The rule: All birds lay eggs. A dog does not lay eggs. Is a dog a bird? Say yes, no, or can't tell—then explain using the rule.");
  });

  it('keeps the complete verdict menu visible and spoken on verdict cases', () => {
    const { items, pack } = build();
    expect(HOW_TO_PLAY).toMatch(/can't tell/);
    expect(spokenSpanOf(pack.itemCue(items[0], { opening: true, howToPlay: true }))).toMatch(/^We are going to use rules/);
    const later = spokenSpanOf(pack.itemCue(items[4], { opening: false, howToPlay: false }));
    expect(later).toMatch(/^Same rule\./);
    expect(later).toContain("Say yes, no, or can't tell—then explain using the rule.");
  });
});

describe('a conclude case is judged on the conclusion', () => {
  it('affirms with the reasoning, contrasts a wrong conclusion, and routes the echo to the general branch', () => {
    const { items } = build([SESSION[0]]);
    const beetle = items[0];
    expect(verifyLine(beetle)).toBe('Yes, a beetle is an insect, so a beetle has six legs.');
    const lines = correctionLines(beetle);
    expect(lines.contrast).toBe(
      'My turn: not ⟨what they said⟩ — The rule says all insects have six legs. A beetle is an insect, so a beetle has six legs. '
      + 'Your turn. Say what the rule tells you about a beetle.',
    );
    expect(lines.fallback).toMatch(/^My turn: The rule says all insects have six legs\./);
    const cue = itemCue(beetle, { opening: false, howToPlay: false });
    expect(cue).toContain('The rule read back — "all insects have six legs" — says nothing about a beetle');
    expect(spokenSpansOf(cue)).toHaveLength(4);
  });
});

describe('a deny case is judged on the VERDICT and the REASON', () => {
  it('accepts the short form in the contract and refuses a verdict with no reason via its own branch', () => {
    const { items } = build([SESSION[0]]);
    const spider = byId(items, 'ddb-insects-c1-deny');
    expect(verifyLine(spider)).toBe('Yes, a spider is not an insect, because all insects have six legs and a spider does not have six legs.');
    const lines = correctionLines(spider);
    expect(lines.noReason).toBe(
      'My turn: how do you know? The rule says all insects have six legs. A spider does not have six legs, so a spider is not an insect. '
      + "Your turn. Is a spider an insect? Say yes, no, or can't tell—then explain using the rule.",
    );
    const cue = itemCue(spider, { opening: false, howToPlay: false });
    expect(cue).toContain('The short form counts');
    expect(cue).toContain('the verdict is right and the reason is missing');
    const spans = spokenSpansOf(cue);
    expect(spans).toHaveLength(5);
    expect(spans[1]).toMatch(/^Yes, a spider is not an insect/);
    expect(spans[2]).toMatch(/^My turn: how do you know\?/);
    expect(spans[3]).toMatch(/^My turn: not ⟨what they said⟩/);
    expect(spans[4]).toMatch(/^My turn: The rule says/);
  });
});

describe('a cannot_tell case names the signature error first', () => {
  it('writes its contract in the family order: ask, affirm, signature, wrong verdict, no reason, general last', () => {
    const { items } = build([SESSION[1]]);
    const egg = byId(items, 'ddb-birds-c2-cannot_tell');
    expect(egg.case.subject).toBe('this animal');
    expect(verifyLine(egg)).toBe(
      "Yes, you can't tell. All birds lay eggs, but the rule does not say only birds lay eggs — a turtle lays eggs too, and a turtle is not a bird.",
    );
    const lines = correctionLines(egg);
    expect(lines.affirmedConsequent).toMatch(/^My turn: the rule does not work backwards\. The rule says all birds lay eggs\. It does not say only birds lay eggs — a turtle lays eggs too, and a turtle is not a bird\. So the rule can't tell you\. Your turn\./);
    const cue = itemCue(egg, { opening: false, howToPlay: false });
    expect(cue).toContain('THE SIGNATURE ERROR is a confident yes — "yes, because it lays eggs"');
    expect(cue).toContain('"No, because other things lay eggs too" carries that reason and counts');
    const spans = spokenSpansOf(cue);
    expect(spans).toHaveLength(6);
    expect(spans[2]).toMatch(/^My turn: the rule does not work backwards/);
    expect(spans[3]).toMatch(/^My turn: not ⟨what they said⟩/);
    expect(spans[4]).toMatch(/^My turn: how do you know\?/);
    expect(spans[5]).toMatch(/^My turn: The rule says/);
  });
});

describe('a move-on carries the conclusion', () => {
  it('states the conclusion before the next ask, so the page can write it', () => {
    const { items, pack } = build([SESSION[1]]);
    const spoken = spokenSpanOf(pack.moveOnCue(items[0], items[1], { opening: false, howToPlay: false }));
    expect(spoken).toBe("Good try. A robin is a bird, so a robin lays eggs. Same rule. A dog does not lay eggs. Is a dog a bird? Say yes, no, or can't tell—then explain using the rule.");
  });

  it('states a can\'t-tell with its counterexample, then opens the next rule', () => {
    const { items } = build();
    const egg = byId(items, 'ddb-birds-c2-cannot_tell');
    const next = byId(items, 'ddb-fish-c0-conclude');
    expect(spokenSpanOf(moveOnCue(egg, next, { opening: false, howToPlay: false }))).toBe(
      "Good try. You can't tell. All birds lay eggs, but the rule does not say only birds lay eggs — a turtle lays eggs too, and a turtle is not a bird. "
      + 'Here is the rule: All fish live in water. A shark is a fish. Say what the rule tells you about a shark.',
    );
  });

  it('ends the run warmly when there is no next case', () => {
    const { items } = build([SESSION[0]]);
    expect(spokenSpanOf(moveOnCue(items[1], null, { opening: false, howToPlay: false }))).toMatch(
      /^Good try\. A spider is not an insect, because all insects have six legs and a spider does not have six legs\. That's the end/,
    );
  });
});

describe('runtime state is stimulus-side only', () => {
  it('pushes the printed rule and case, never a conclusion or a verdict', () => {
    const { items } = build([SESSION[1]]);
    expect(contextFor(items[2])).toEqual({
      challengeType: 'cannot_tell', rule: 'All birds lay eggs.', case: 'This animal lays eggs.', supportTier: 'medium',
    });
    const values = Object.values(contextFor(items[1])).join(' ');
    expect(values).not.toMatch(/\b(no|not a bird|can't tell)\b/);
  });

  it('cues never speak a bracket tag or a performed WAIT; tap-to-hear reads the question side only', () => {
    const { items, pack } = build();
    for (const item of items) {
      const spoken = spokenSpanOf(itemCue(item, { opening: false, howToPlay: false }));
      expect(spoken).not.toMatch(/\[|\]/);
      expect(pack.itemCue(item, { opening: false, howToPlay: false })).not.toMatch(/then wait/i);
      const hear = spokenSpanOf(pack.pronounceCue!(item));
      expect(hear).toBe(`${item.ruleText} ${item.case.caseText}`);
    }
  });
});

describe('the bench fixture', () => {
  it('builds every fixture rule through the shipped gates, with no drops, and no cannot_tell where no lookalike exists', () => {
    const { items, dropped } = itemsFromRules(DEDUCTION_BENCH_RULES);
    expect(dropped).toBe(0);
    expect(items.filter((i) => i.ruleId === 'ddb-insects').map((i) => i.shape)).toEqual(['conclude', 'deny']);
    const ids = new Set(items.map((i) => i.id));
    for (const probeId of Object.keys(DEDUCTION_BENCH_PROBES)) {
      expect(ids.has(probeId), `probe key ${probeId} names no built item`).toBe(true);
    }
  });

  it('attaches probes by item id only, and hands every item its signature wrong', () => {
    const { items } = itemsFromRules(DEDUCTION_BENCH_RULES);
    for (const item of items) {
      const answers = deductionHarnessAnswers(item);
      expect(answers.correct).toBeTruthy();
      expect(answers.plainWrong).not.toBe(answers.correct);
      expect(answers.signatureWrong?.text).toBeTruthy();
      if (DEDUCTION_BENCH_PROBES[item.id]) expect(answers.probes).toBe(DEDUCTION_BENCH_PROBES[item.id]);
      else expect(answers.probes).toBeUndefined();
    }
    expect(deductionHarnessAnswers(byId(items, 'ddb-birds-c2-cannot_tell')).signatureWrong?.text).toBe('yes, because it lays eggs');
  });

  it('the affirmed-consequent bucket exists on every cannot_tell key and is REFUSE throughout', () => {
    for (const [id, probes] of Object.entries(DEDUCTION_BENCH_PROBES)) {
      if (!id.endsWith('cannot_tell')) continue;
      const bucket = probes.filter((p) => p.bucket === 'affirmed-consequent');
      expect(bucket.length, id).toBeGreaterThan(0);
      expect(bucket.every((p) => p.expect === 'refuse')).toBe(true);
    }
  });
});
