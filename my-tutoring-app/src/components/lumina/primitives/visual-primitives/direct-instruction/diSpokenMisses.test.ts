/**
 * Spoken misses of the spoken DI packs (handoff 20 Part B): each item's ids in precedence order, and no listed
 * example is the pack's own correct answer, on hand-built items and every saved payload.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { buildMathFactItems, mathFactSpokenMisses, mathFactsHarnessAnswers, type DiMathFactsChallenge } from './diMathFactsDomain';
import { diceSpokenMisses, diDiceRollHarnessAnswers } from './diDiceRollWorkspace';
import { diShapesHarnessAnswers, shapesSpokenMisses } from './diShapesWorkspace';
import { diSpokenPracticeHarnessAnswers, spokenPracticeSpokenMisses } from './diSpokenPracticeWorkspace';
import { diWordProblemHarnessAnswers, wordProblemAssignment, wordProblemItems, wordProblemSpokenMisses } from './diWordProblemWorkspace';
import { diWorkedProcedureHarnessAnswers, workedProcedureItems, workedProcedureSpokenMisses } from './diWorkedProcedureWorkspace';
import { deductionItems, deductionSpokenMisses, diDeductionHarnessAnswers } from './diDeductionWorkspace';

const PAYLOADS = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const payload = (file: string) => JSON.parse(readFileSync(join(PAYLOADS, `${file}.json`), 'utf-8')).data;
const ids = (misses: KnownMiss[]) => misses.map(m => m.id);
const OFF = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];

/** No listed example is the correct answer, and ids are unique within the item. */
function clean(item: { id: string }, misses: KnownMiss[], correct: string) {
  expect(new Set(ids(misses)).size, item.id).toBe(misses.length);
  for (const m of misses) for (const e of m.examples ?? []) expect(e.toLowerCase(), `${item.id} ${m.id}`).not.toBe(correct.toLowerCase());
}

const fact = (c: Partial<DiMathFactsChallenge>) => buildMathFactItems([{ id: 'f', supportTier: 'hard', ...c } as DiMathFactsChallenge])[0];

describe('mathFactSpokenMisses', () => {
  const items = Object.fromEntries(['answer_fact', 'counting_next', 'fact_review', 'name_numeral', 'subtraction_fact']
    .flatMap(mode => buildMathFactItems(payload(`di-math-facts.${mode}`).challenges).map(i => [i.id + ':' + mode, i])));
  it.each([
    ['4 + 1', items['dimf-1-4p1:answer_fact'], ['said_addend', 'one_over', 'short_by_more', 'over_by_more']],
    ['0 + 3', items['dimf-2-0p3:answer_fact'], ['said_addend', ...OFF]],
    ['after 3', items['dimf-1-n3:counting_next'], ['said_printed', 'said_before', 'said_two_after', 'short_by_more', 'over_by_more']],
    ['after 0', items['dimf-3-n0:counting_next'], ['said_printed', 'said_two_after', 'over_by_more']],
    ['name 5', items['dimf-1-id5:name_numeral'], ['recited_sequence', ...OFF]],
    ['2 - 1', items['dimf-1-2m1:subtraction_fact'], ['said_start', 'added_instead', 'over_by_more']],
    ['5 - 0', items['dimf-5-5m0:subtraction_fact'], ['said_change', ...OFF]],
    ['9 + 5', fact({ challengeType: 'answer_fact', a: 9, b: 5, display: '9 + 5', problem: 'nine plus five', answerWord: 'fourteen',
      answerNumeral: 14, solvedDisplay: '9 + 5 = 14' }), ['said_addend', 'teen_decade_swap', ...OFF]],
    ['after 39', fact({ challengeType: 'counting_next', a: 39, b: 1, display: '39 →', problem: 'the number after thirty-nine',
      answerWord: 'forty', answerNumeral: 40, solvedDisplay: '39 → 40' }),
      ['said_printed', 'said_before', 'said_two_after', 'decade_rollover', 'teen_decade_swap', 'short_by_more', 'over_by_more']],
    ['name 6', fact({ challengeType: 'name_numeral', a: 6, b: 0, display: '6', problem: 'this number', answerWord: 'six',
      answerNumeral: 6, solvedDisplay: '6' }), ['recited_sequence', 'look_alike_numeral', ...OFF]],
  ] as const)('%s', (_name, item, expected) => {
    expect(item, _name).toBeDefined();
    const misses = mathFactSpokenMisses(item);
    expect(ids(misses)).toEqual(expected);
    clean(item, misses, mathFactsHarnessAnswers(item).correct);
  });
  it('every payload item lists misses and none is its answer', () => {
    for (const item of Object.values(items)) {
      const misses = mathFactSpokenMisses(item);
      expect(misses.length, item.id).toBeGreaterThan(0);
      clean(item, misses, item.answerWord);
    }
  });
});

describe('diceSpokenMisses', () => {
  it.each([
    ['count_pips', 'didr-1', ['skipped_a_number', ...OFF]],
    ['count_pips', 'didr-4', ['one_over', 'over_by_more']],
    ['compare_dice', 'didr-1', ['other_die', 'said_same', 'said_number']],
    ['compare_dice', 'didr-3', ['picked_a_side', 'said_number']],
  ] as const)('%s %s', (mode, id, expected) => {
    const item = payload(`di-dice-roll.${mode}`).challenges.find((c: { id: string }) => c.id === id);
    const misses = diceSpokenMisses(item);
    expect(ids(misses)).toEqual(expected);
    clean(item, misses, diDiceRollHarnessAnswers(item).correct);
  });
});

describe('shapesSpokenMisses and spokenPracticeSpokenMisses', () => {
  it.each([
    ['di-shapes.count_sides', ['said_shape_name', ...OFF]],
    ['di-shapes.name_shape', ['near_name', 'other_shape_name']],
  ] as const)('%s: every item', (file, expected) => {
    for (const item of payload(file).challenges) {
      const misses = shapesSpokenMisses(item);
      expect(ids(misses), item.id).toEqual(expected);
      clean(item, misses, diShapesHarnessAnswers(item).correct);
    }
  });
  it.each([
    ['di-spoken-practice.count_and_say', (n: number) => n >= 3 ? ['skipped_a_number', ...OFF] : OFF.slice(1)],
    ['di-spoken-practice.compare_choice', () => ['other_menu_word', 'said_thing_name']],
  ] as const)('%s: every item', (file, expected) => {
    for (const item of payload(file).items) {
      const misses = spokenPracticeSpokenMisses(item);
      expect(ids(misses), item.id).toEqual(expected(item.stimulusCount));
      clean(item, misses, diSpokenPracticeHarnessAnswers(item).correct);
    }
  });
});

describe('wordProblemSpokenMisses', () => {
  const byKind: Record<string, (ids: string[]) => void> = {
    classify: found => expect(found).toEqual(['signature_kind', 'other_kind']),
    family: found => expect(found[0]).toBe('big_in_small_slot'),
    operation: found => expect(found).toEqual(['opposite_operation']),
    solve: found => { expect(['wrong_way', 'said_story_number']).toContain(found[0]); expect(found.at(-1)).toBe('over_by_more'); },
  };
  it.each(['find_big_number', 'build_family'])('%s payload', mode => {
    for (const item of wordProblemItems(payload(`di-word-problem-setup.${mode}`))) {
      if (item.kind === 'big_number') {
        expect(wordProblemAssignment(item).misses, 'the hands step names its miss in code').toBeUndefined();
        continue;
      }
      const misses = wordProblemSpokenMisses(item);
      byKind[item.kind](ids(misses));
      clean(item, misses, diWordProblemHarnessAnswers(item).correct);
    }
  });
});

describe('workedProcedureSpokenMisses', () => {
  it.each(['subtract_no_regroup', 'subtract_regroup'])('%s payload', mode => {
    for (const item of workedProcedureItems(payload(`di-worked-procedure.${mode}`))) {
      const found = ids(workedProcedureSpokenMisses(item));
      if (item.kind === 'decide' && item.regroup) expect(found).toEqual(['upside_down_column', 'no_decrement', 'said_no_regroup']);
      else if (item.kind === 'subtract') expect(found[0]).toBe('upside_down_column');
      else expect(found[0]).toBe('regrouped_needlessly');
      clean(item, workedProcedureSpokenMisses(item), diWorkedProcedureHarnessAnswers(item).correct);
    }
  });
});

describe('deductionSpokenMisses', () => {
  const expected: Record<string, string[]> = {
    conclude: ['said_negation', 'read_rule_back', 'read_case_back'],
    deny: ['said_member', 'said_cannot_tell', 'verdict_without_reason'],
    cannot_tell: ['backwards_yes', 'said_not_member', 'verdict_without_reason'],
  };
  it.each(['conclude', 'deny', 'cannot_tell'])('%s payload', mode => {
    for (const item of deductionItems(payload(`di-deduction.${mode}`))) {
      const misses = deductionSpokenMisses(item);
      expect(ids(misses), item.id).toEqual(expected[item.shape]);
      clean(item, misses, diDeductionHarnessAnswers(item).correct);
    }
  });
});
