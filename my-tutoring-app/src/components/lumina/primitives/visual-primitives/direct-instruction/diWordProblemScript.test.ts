/**
 * di-word-problem-setup — the pack's standing gates (through the shared
 * testkit) plus the pedagogy pins that are this pack's whole point: the big
 * number is PLACED and its verdict computed in code, the family is SAID and
 * judged on slots, the ask never states what the child must say or place, and
 * a move-on carries the step onto the page.
 */

import { describe, it, expect } from 'vitest';
import { checkDiCatalogEntry, checkPackGates } from '../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf, spokenSpansOf, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import {
  WORD_PROBLEM_BENCH_PROBES,
  WORD_PROBLEM_BENCH_PROBLEMS,
  WORD_PROBLEM_BENCH_THEME,
  wordProblemHarnessAnswers,
} from '../../../service/qa/di/wordProblemBench';
import {
  askLine,
  bigNumberVerdictCue,
  contextFor,
  correctionLines,
  diWordProblemSetupPackBase,
  itemCue,
  itemsFromProblems,
  moveOnCue,
  stepQuestion,
  verifyLine,
  type WordProblemItem,
  type WordProblemProblemSpec,
} from './diWordProblemScript';

const entry = DI_CATALOG.find((c) => c.id === 'di-word-problem-setup')!;

/** A real session shape: three stories in one mode, so the repeat-ask gate is
 *  awake across the story boundary. */
const SESSION: WordProblemProblemSpec[] = [
  { id: 'p1', frameId: 'comparison:more_person', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 8, challengeType: 'build_family' },
  { id: 'p2', frameId: 'change:gain_change', theme: WORD_PROBLEM_BENCH_THEME, first: 9, second: 15, challengeType: 'build_family' },
  { id: 'p3', frameId: 'part_whole:part', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 7, challengeType: 'build_family' },
];

const build = (specs: WordProblemProblemSpec[] = SESSION) => {
  const { items, dropped } = itemsFromProblems(specs);
  const pack: JudgedScriptPack<WordProblemItem> = { ...diWordProblemSetupPackBase(items) };
  return { items, dropped, pack };
};

const byId = (items: WordProblemItem[], id: string): WordProblemItem => {
  const it = items.find((i) => i.id === id);
  if (!it) throw new Error(`no item ${id} — have ${items.map((i) => i.id).join(', ')}`);
  return it;
};

const plain = { opening: false, howToPlay: false };

describe('standing gates — the shared testkit', () => {
  it('passes every pack gate on the real session shape', () => {
    const { pack, dropped } = build();
    expect(dropped).toBe(0);
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('passes the pack gates in every mode and at the easy tier (the story re-read)', () => {
    for (const challengeType of ['find_big_number', 'classify_and_build'] as const) {
      const { pack } = build(SESSION.map((s) => ({ ...s, challengeType })));
      expect(checkPackGates(pack), challengeType).toEqual([]);
    }
    const { pack } = build(SESSION.map((s) => ({ ...s, supportTier: 'easy' as const })));
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('matches the catalog entry: audio mode, contextKeys, template keys, sentinels', () => {
    const { pack, items } = build();
    expect(checkDiCatalogEntry(entry, pack, items[0])).toEqual([]);
  });
});

describe('the mode is the step list', () => {
  it('expands one story into its judged steps, hands first then voice', () => {
    const { items } = build([SESSION[0]]);
    expect(items.map((i) => i.kind)).toEqual(['big_number', 'family', 'operation', 'solve']);
    expect(items.map((i) => i.answerKind)).toEqual(['gesture', 'voice', 'voice', 'voice']);
    expect(items.map((i) => i.responseClass)).toEqual([
      'manipulation', 'equation_statement', 'closed_set_choice', 'number_word_to_20',
    ]);
    expect(items[0].isFirstStep).toBe(true);
    expect(items[3].isLastStep).toBe(true);
  });

  it('find_big_number is place + work; classify_and_build adds the kind first', () => {
    const find = build([{ ...SESSION[0], challengeType: 'find_big_number' }]).items;
    expect(find.map((i) => i.kind)).toEqual(['big_number', 'solve']);
    const classify = build([{ ...SESSION[1], challengeType: 'classify_and_build' }]).items;
    expect(classify.map((i) => i.kind)).toEqual(['classify', 'big_number', 'family', 'operation', 'solve']);
    expect(classify[0].responseClass).toBe('closed_set_choice');
  });

  it('gives every step one action contract for screen, speech, and modality', () => {
    const { items } = build([SESSION[0]]);
    for (const item of items) {
      expect(item.answerKind).toBe(item.actionContract.answerKind);
      expect(stepQuestion(item)).toBe(item.actionContract.instruction);
      expect(item.actionContract.label).not.toBe('');
      expect(item.actionContract.checkingInstruction).not.toBe('');
    }

    const focused = build([{ ...SESSION[0], challengeType: 'find_big_number' }]).items[0];
    expect(focused.actionContract.instruction).toBe(
      'Drag the story part that names the big amount into the big amount box.',
    );
  });

  it('rides the build-ahead number class only past twenty', () => {
    // 30 + 12 = 42: "forty-two" shares no token with "thirty" or "twelve".
    const { items } = build([{ ...SESSION[0], first: 30, second: 12, maxNumber: 100 }]);
    expect(byId(items, 'p1-solve').responseClass).toBe('number_word_to_120');
  });

  it('DROPS a story the plan gates refuse, and counts it', () => {
    const { items, dropped } = itemsFromProblems([
      { ...SESSION[0], id: 'zero', frameId: 'comparison:difference', first: 12, second: 12 },
      { ...SESSION[0], id: 'ok' },
    ]);
    expect(dropped).toBe(1);
    expect(new Set(items.map((i) => i.problemId))).toEqual(new Set(['ok']));
  });
});

describe('the ask never states what the child must say or place', () => {
  it('reads the story on the first step only, then names the step', () => {
    const { items } = build([SESSION[0]]);
    expect(askLine(items[0])).toBe(
      'Listen. Jen has twelve stickers. Tom has eight more stickers than Jen. How many stickers does Tom have? '
      + 'Drag all three story-part cards into small plus small equals big.',
    );
    expect(askLine(items[1])).toBe('Read the number family you built out loud. Say box for the unknown amount.');
    expect(askLine(items[2])).toBe('Say whether you add or subtract.');
    expect(askLine(items[3])).toBe('Solve it and say the answer aloud. How many stickers does Tom have?');
  });

  it('at easy every ask re-reads the story', () => {
    const { items } = build([{ ...SESSION[0], supportTier: 'easy' }]);
    expect(askLine(items[1])).toMatch(/^Listen\. Jen has twelve stickers\..*Read the number family you built out loud\. Say box for the unknown amount\.$/);
  });

  it('never carries the answer word, the big number, or the menu choice outside its exempt span', () => {
    const { items, pack } = build(SESSION.map((s) => ({ ...s, challengeType: 'classify_and_build' as const })));
    for (const item of items) {
      const spoken = spokenSpanOf(pack.itemCue(item, plain)).toLowerCase();
      const answers = wordProblemHarnessAnswers(item);
      const exempt = (answers.leakExemptSpan as string[]).map((s) => s.toLowerCase());
      const scrubbed = exempt.reduce((s, span) => s.replace(span, ' '), spoken);
      for (const token of answers.leakTokens) {
        expect(scrubbed, `${item.id}: "${spoken}" leaks "${token}"`).not.toMatch(new RegExp(`\\b${token}\\b`));
      }
      // The big number's label is never in the placement ask itself.
      if (item.kind === 'big_number') {
        expect(scrubbed).not.toContain(item.plan.big.label.toLowerCase());
      }
    }
  });

  it('the how-to-play rides inside the opening line and names the hands step', () => {
    const { items, pack } = build();
    const opening = spokenSpanOf(pack.itemCue(items[0], { opening: true, howToPlay: true }));
    expect(opening).toMatch(/^We are going to set up word problems\./);
    expect(opening).toContain('drag all three story parts');
    expect(opening).toContain('box for the amount we do not know');
    expect(spokenSpanOf(pack.itemCue(items[4], plain))).toMatch(/^Listen\. Jen had nine stickers/);
  });
});

describe('the big number is PLACED, and its verdict is computed in code', () => {
  it('the placement contract is a silence contract that never names the big number', () => {
    const { items, pack } = build([SESSION[0]]);
    const cue = pack.itemCue(items[0], plain);
    expect(cue).toContain('answers with their HANDS');
    expect(cue).toContain('all three story parts');
    expect(cue).not.toContain("Tom's stickers");
    expect(spokenSpansOf(cue)).toHaveLength(1);

    const focused = build([{ ...SESSION[0], challengeType: 'find_big_number' }]);
    const focusedCue = focused.pack.itemCue(focused.items[0], plain);
    expect(focusedCue).toContain('one story part into the big-amount box');
    expect(focusedCue).not.toContain('all three story parts');
  });

  it('a right placement hands the tutor the affirmation; a wrong one the correction', () => {
    const { items } = build([SESSION[0]]);
    const big = items[0];
    const right = bigNumberVerdictCue(big, 'q-b');
    expect(right).toContain('MATCHES');
    expect(spokenSpanOf(right)).toBe(
      "Yes, the big number is Tom's stickers — Tom has more than Jen, so Tom's stickers is the whole amount.",
    );
    const wrong = bigNumberVerdictCue(big, 'q-a');
    expect(wrong).toContain('does NOT match');
    expect(wrong).toContain("'Jen's stickers'");
    expect(spokenSpanOf(wrong)).toBe(
      "My turn: the big number is the whole amount, the one that has it all. Tom has more than Jen, so Tom's "
      + "stickers is the whole amount. The big number is Tom's stickers. Your turn. Drag all three story-part "
      + 'cards into small plus small equals big.',
    );
  });

  it('the harness gets the placed ids: the big number, and "the biggest number I see" as the wrong', () => {
    const { items } = build([SESSION[0]]);
    const answers = wordProblemHarnessAnswers(items[0]);
    expect(answers.tapped).toEqual({ correct: 'q-b', wrong: 'q-a' });
    expect(answers.signatureWrong?.why).toContain('biggest number I see');
  });
});

describe('the family is judged on slots', () => {
  it('affirms the canonical family and scripts misplaced → (not a family) → incomplete → general', () => {
    const { items, pack } = build([SESSION[1]]); // 9 + box = 15, a subtraction family
    const family = byId(items, 'p2-family');
    expect(verifyLine(family)).toBe('Yes, nine plus box equals fifteen.');
    const lines = correctionLines(family);
    expect(lines.misplaced).toBe(
      'My turn: the big number goes last, after equals. What Jen has now is the big number, so the family is '
      + 'nine plus box equals fifteen. Your turn. Read the number family you built out loud. Say box for the unknown amount.',
    );
    expect(lines.notFamily).toMatch(/^My turn: a family says small plus small equals big — we do not subtract yet\. Nine plus box equals fifteen\./);
    expect(lines.incomplete).toMatch(/^My turn: a family has all three/);
    expect(lines.fallback).toBe(
      'My turn: nine plus box equals fifteen. Your turn. Read the number family you built out loud. Say box for the unknown amount.',
    );
    const spans = spokenSpansOf(pack.itemCue(family, plain));
    expect(spans).toHaveLength(6);
    expect(spans[1]).toMatch(/^Yes, nine plus box/);
    expect(spans[2]).toMatch(/^My turn: the big number goes last/);
    expect(spans[3]).toMatch(/^My turn: a family says/);
    expect(spans[4]).toMatch(/^My turn: a family has all three/);
    expect(spans[5]).toBe(lines.fallback);
    const contract = pack.itemCue(family, plain);
    expect(contract).toContain('"fifteen plus nine equals box"');
    expect(contract).toContain('"fifteen minus nine equals box"');
    expect(contract).toContain('either order');
  });

  it('an addition family has no subtraction branch, and the misplaced form demotes the box', () => {
    const { items, pack } = build([SESSION[0]]);
    const family = byId(items, 'p1-family');
    expect(correctionLines(family).notFamily).toBeUndefined();
    expect(spokenSpansOf(pack.itemCue(family, plain))).toHaveLength(5);
    expect(pack.itemCue(family, plain)).toContain('"eight plus box equals twelve"');
  });
});

describe('the operation is decided by the family, not the verb', () => {
  it('scripts the from-the-story branch where the verb disagrees, and not where it agrees', () => {
    const { items } = build(SESSION);
    const gain = byId(items, 'p2-operation'); // "found" → add; the family says subtract
    expect(verifyLine(gain)).toBe('Yes, the box is a small number, so we subtract.');
    expect(correctionLines(gain).fromVerb).toBe(
      'My turn: the story says found, but the family decides. The box is a small number, so we subtract. '
      + 'Your turn. Say whether you add or subtract.',
    );
    expect(wordProblemHarnessAnswers(gain).signatureWrong?.text).toBe('add');
    const whole = byId(items, 'p1-operation'); // "more" → add; the family says add
    expect(correctionLines(whole).fromVerb).toBeUndefined();
    expect(verifyLine(whole)).toBe('Yes, the box is the big number, so we add.');
  });
});

describe('the solve step is a benched number word', () => {
  it('affirms the equation and the answer sentence; contrasts the wrong-way number', () => {
    const { items } = build([SESSION[0]]);
    const solve = byId(items, 'p1-solve');
    expect(verifyLine(solve)).toBe('Yes, twelve plus eight equals twenty. Tom has twenty stickers.');
    expect(correctionLines(solve).contrast).toBe(
      'My turn: not ⟨what they said⟩ — twelve plus eight equals twenty. Your turn. Solve it and say the answer aloud. How many stickers does Tom have?',
    );
    expect(wordProblemHarnessAnswers(solve).signatureWrong?.text).toBe('four');
  });
});

describe('a move-on carries the step', () => {
  it('states the big number before the family ask, so the page can place it', () => {
    const { items, pack } = build([SESSION[0]]);
    const spoken = spokenSpanOf(pack.moveOnCue(items[0], items[1], plain));
    expect(spoken).toBe(
      "Good try. The big number is Tom's stickers — Tom has more than Jen, so Tom's stickers is the whole "
      + 'amount. Read the number family you built out loud. Say box for the unknown amount.',
    );
  });

  it("closes a story with its answer before the next story's ask", () => {
    const { items, pack } = build();
    const last = byId(items, 'p1-solve');
    const next = byId(items, 'p2-big_number');
    expect(spokenSpanOf(moveOnCue(last, next, plain))).toBe(
      'Good try. Twelve plus eight equals twenty. Tom has twenty stickers. '
      + 'Listen. Jen had nine stickers. Then Jen found some more. Now Jen has fifteen stickers. How many '
      + 'stickers did Jen find? Drag all three story-part cards into small plus small equals big.',
    );
    expect(pack.moveOnCue(last, next, plain)).toContain('answers with their HANDS');
  });

  it('ends the run warmly when there is no next step', () => {
    const { items } = build([SESSION[2]]);
    const cue = moveOnCue(items[3], null, plain);
    expect(spokenSpanOf(cue)).toMatch(/^Good try\. Twelve minus seven equals five\. Five stickers are blue\. That's the end/);
  });
});

describe('runtime state is stimulus-side only', () => {
  it('pushes the printed story and the open step, never the big number, the family or the answer', () => {
    const { items } = build([SESSION[0]]);
    expect(contextFor(items[0])).toEqual({
      challengeType: 'build_family',
      story: 'Jen has 12 stickers. Tom has 8 more stickers than Jen. How many stickers does Tom have?',
      step: 'big_number',
      supportTier: 'medium',
    });
    const values = Object.values(contextFor(items[1])).join(' ');
    expect(values).not.toMatch(/\b(twenty|20|box|plus)\b/);
  });

  it('cues never speak a bracket tag or a performed WAIT', () => {
    const { items, pack } = build();
    for (const item of items) {
      const spoken = spokenSpanOf(itemCue(item, plain));
      expect(spoken).not.toMatch(/\[|\]/);
      expect(pack.itemCue(item, plain)).not.toMatch(/then wait/i);
    }
  });
});

describe('the bench fixture', () => {
  it('builds every fixture story through the shipped gates, with no drops', () => {
    const { items, dropped } = itemsFromProblems(WORD_PROBLEM_BENCH_PROBLEMS);
    expect(dropped).toBe(0);
    const ids = new Set(items.map((i) => i.id));
    for (const probeId of Object.keys(WORD_PROBLEM_BENCH_PROBES)) {
      expect(ids.has(probeId), `probe key ${probeId} names no built item`).toBe(true);
    }
  });

  it('passes the pack gates as a mixed-mode fixture', () => {
    const { pack } = build(WORD_PROBLEM_BENCH_PROBLEMS);
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('attaches probes by item id only, and hands every item its signature wrong', () => {
    const { items } = itemsFromProblems(WORD_PROBLEM_BENCH_PROBLEMS);
    for (const item of items) {
      const answers = wordProblemHarnessAnswers(item);
      expect(answers.correct).toBeTruthy();
      expect(answers.plainWrong).not.toBe(answers.correct);
      expect(answers.signatureWrong?.text).toBeTruthy();
      if (WORD_PROBLEM_BENCH_PROBES[item.id]) expect(answers.probes).toBe(WORD_PROBLEM_BENCH_PROBES[item.id]);
      else expect(answers.probes).toBeUndefined();
      if (item.kind === 'big_number') expect(answers.tapped?.correct).toBe(item.plan.big.id);
    }
    // The family key: every probe text in a family bucket is a real family
    // shape the contract names, so a miss is the judge's and never the key's.
    const family = byId(items, 'wpsb-cmp-diff-family');
    const texts = WORD_PROBLEM_BENCH_PROBES[family.id].map((p) => p.text);
    expect(texts).toContain(wordProblemHarnessAnswers(family).signatureWrong!.text);
  });
});
