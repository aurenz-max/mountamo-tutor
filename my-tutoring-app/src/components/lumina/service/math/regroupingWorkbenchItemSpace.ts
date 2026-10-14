/**
 * regrouping-workbench problems from the multi-digit item spaces (service/itemSpace, skill /add-item-space).
 *
 * The LLM chose the problems, and every tier and every run of add_regroup gave 27 + 45, 38 + 24, 19 + 36
 * (12 of 12 runs, 10-13 probe). The code tier lever that rebuilt operands capped a 2-digit problem at one
 * regroup, so its hard tier equalled easy, and a Grade-3 "within 1000" lesson still drew 2-digit problems
 * because the LLM set maxPlace. With a tier and an objective the resolver fits to add-sub-100 or
 * add-sub-1000, code picks each problem at the tier's band.
 *
 * Which items each mode can draw (contract, item-space clause): the mode's operation; at least one
 * regrouped column for the `_regroup` modes, none for the `_no_regroup` modes. Within a mode the tier
 * moves what else the column work asks: how many columns regroup, a chain, a borrow across a zero, a
 * one-digit second number (easier), a third column.
 */
import type { MultiDigitItem } from '../itemSpace/multiDigit';

export type RwMode = 'add_no_regroup' | 'subtract_no_regroup' | 'add_regroup' | 'subtract_regroup';
export const RW_SPACE_MODES: readonly string[] = ['add_no_regroup', 'subtract_no_regroup', 'add_regroup', 'subtract_regroup'];

export function itemFitsMode(it: MultiDigitItem, mode: RwMode): boolean {
  const op = mode.startsWith('add') ? '+' : '-';
  const regroup = !mode.includes('no_regroup');
  return it.op === op && (it.features.regroups > 0) === regroup;
}

export interface RwChallenge {
  id: string;
  type: RwMode;
  problem: string;
  requiresRegrouping: boolean;
  regroupCount: number;
  hint: string;
  narration: string;
  itemSpace: { space: string; structure: string; beta: number };
}

/** The challenge for a picked item. The hint names the method, never a digit of the answer. */
export function rwChallenge(it: MultiDigitItem, mode: RwMode, space: string, id: string): RwChallenge {
  const add = it.op === '+';
  return {
    id,
    type: mode,
    problem: `${it.a} ${it.op} ${it.b}`,
    requiresRegrouping: it.features.regroups > 0,
    regroupCount: it.features.regroups,
    hint: add
      ? 'Start with the ones column. If a column makes 10 or more, trade 10 for one in the next column.'
      : 'Start with the ones column. If the top digit is too small, trade one from the next column for 10.',
    narration: add ? `Let's add ${it.a} and ${it.b}, starting with the ones.` : `Let's find ${it.a} minus ${it.b}, starting with the ones.`,
    itemSpace: { space, structure: it.structure, beta: it.beta },
  };
}
