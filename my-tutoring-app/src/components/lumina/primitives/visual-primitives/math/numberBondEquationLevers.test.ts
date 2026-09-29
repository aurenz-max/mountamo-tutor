/**
 * The number-bond equation levers (handoff 21 M1, slice 2): which lever answers which equation miss, the move
 * strip and frame leak rules, and the smaller-bond builder over every bond and move.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { buildBondItems, familyFormKeyFor, type BondModelAction, type NumberBondItem } from './numberBondScript';
import { expandNumberBondInteractions } from './numberBondModes';
import { EQ_FRAME_LEVER, MOVE_LEVER, SMALLER_BOND_LEVER, STRIP_LEVER, leverFacts, moveStrip, numberBondLevers,
  smallerBond } from './numberBondLevers';

const items = (challenges: object[]) =>
  expandNumberBondInteractions(buildBondItems(challenges as never, { band: '1', maxNumber: 10 }).items);
const family = (whole: number, p1: number) => items([{ id: `f${whole}-${p1}`, type: 'fact-family', whole, part1: p1, part2: whole - p1 }]);
const equation = (whole: number, p1: number) => items([{ id: `e${whole}-${p1}`, type: 'build-equation', whole, part1: p1, part2: whole - p1 }]);
const build = (steps: NumberBondItem[]) => steps.filter(i => i.interactionPhase === 'family-build' || i.interactionPhase === 'equation-build');
const none = { pairsMade: 0, countersOpen: false };
const ids = (l: { id: string }[]) => l.map(x => x.id);
const bondOf = (i: NumberBondItem) => `${i.whole}:${Math.min(i.knownPart, i.otherPart)}:${Math.max(i.knownPart, i.otherPart)}`;

const payload = (mode: string) => JSON.parse(readFileSync(join(process.cwd(),
  `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/number-bond.${mode}.json`), 'utf-8')).data;
const payloadItems = (mode: string) =>
  expandNumberBondInteractions(buildBondItems(payload(mode).challenges, { band: '1', maxNumber: payload(mode).maxNumber ?? 10 }).items);

describe('which lever answers which equation miss', () => {
  const step = build(family(10, 3))[0];
  it.each([
    ['unfinished_equation', 'help', EQ_FRAME_LEVER], ['other_numbers', 'help', EQ_FRAME_LEVER],
    ['false_equation', 'help', STRIP_LEVER], ['other_fact', 'help', STRIP_LEVER],
  ] as const)('after %s the %s lever is %s', (miss, kind, lever) => {
    expect(nextLever(numberBondLevers(step, [], { ...none, session: [step] }), miss, kind)).toBe(lever);
  });
  it.each(['false_equation', 'other_numbers'])('with help on screen, %s gets the smaller bond next', miss => {
    const levers = numberBondLevers(step, [EQ_FRAME_LEVER, STRIP_LEVER], { ...none, session: [step] });
    expect(nextLever(levers, miss, 'simplify')).toBe(SMALLER_BOND_LEVER);
  });
  it('fact_family model steps offer show_move; build_equation model steps offer nothing', () => {
    for (const s of family(10, 3).filter(i => i.interactionPhase === 'family-model'))
      expect(nextLever(numberBondLevers(s, [], none), 'other_move')).toBe(MOVE_LEVER);
    for (const s of equation(10, 4).filter(i => i.interactionPhase === 'equation-model'))
      expect(numberBondLevers(s, [], none)).toEqual([]);
  });
  it('every build step of both modes offers the frame, the strip and the smaller bond', () => {
    for (const s of [...build(family(10, 3)), ...build(equation(9, 4))])
      expect(ids(numberBondLevers(s, [], { ...none, session: [s], committed: 'join' })))
        .toEqual([EQ_FRAME_LEVER, STRIP_LEVER, SMALLER_BOND_LEVER]);
  });
});

describe('smaller_bond: same move, whole of five or less, never a session bond', () => {
  const moves: BondModelAction[] = ['join', 'separate-left', 'separate-right'];
  const cases: Array<[number, number]> = [];
  for (let whole = 3; whole <= 10; whole++) for (let p1 = 1; p1 < whole; p1++) cases.push([whole, p1]);

  it.each(cases)('fact family %i with a first part of %i: every form', (whole, p1) => {
    for (const step of build(family(whole, p1))) {
      const easier = smallerBond(step, [step]);
      if (!easier) { expect(whole).toBeLessThanOrEqual(3); continue; }
      expect(easier).toMatchObject({ interactionPhase: 'family-build', familyForm: step.familyForm, bondAction: step.bondAction });
      expect(easier.whole).toBeLessThanOrEqual(Math.min(5, whole - 1));
      expect(bondOf(easier)).not.toBe(bondOf(step));
      expect(easier.id).not.toBe(step.id);
      // The answer is the family builder's own: the key is a true equation over the new bond's numbers.
      const [lhs, rhs] = familyFormKeyFor(easier.familyForm!, easier.whole, easier.knownPart, easier.otherPart).split('=');
      expect(Function(`return ${lhs}`)()).toBe(Number(rhs));
    }
  });

  it.each(moves)('build_equation after a %s: the easier step keeps that move', move => {
    const step = build(equation(9, 4))[0];
    expect(smallerBond(step, [step], move)?.bondAction).toBe(move);
  });

  it('skips every bond anywhere in a session of several bonds', () => {
    const session = [...family(5, 2), ...family(5, 1), ...family(4, 1), ...family(10, 3)];
    const step = build(family(10, 3))[0];
    const easier = smallerBond(step, session)!;
    const used = new Set(session.map(bondOf));
    expect(used.has(bondOf(easier))).toBe(false);
    expect(easier.whole).toBeLessThanOrEqual(5);
  });

  it('a swap or second take-away never lands on an equal-parts bond', () => {
    for (const step of build(family(9, 4)).filter(s => s.familyForm === 'add-right' || s.familyForm === 'subtract-right')) {
      const easier = smallerBond(step, [step])!;
      expect(easier.knownPart).not.toBe(easier.otherPart);
    }
  });
});

describe('leak rules', () => {
  it.each(['join', 'swap', 'separate-left', 'separate-right'] as const)('the %s strip is dots only: no text, and the dots match the bond', move => {
    const step = build(family(7, 3))[0];
    const frames = moveStrip(step, move);
    expect(frames).toHaveLength(2);
    for (const f of frames) {
      const dots = f.inWhole.red + f.inWhole.blue + f.aside.reduce((n, g) => n + g.count, 0);
      expect(dots).toBe(7);
      expect(Object.values(f.inWhole).every(n => Number.isInteger(n))).toBe(true);
    }
  });

  it.each(['fact_family', 'build_equation'])('%s payload: no lever text or scene fact carries a digit, a number word or a sign', mode => {
    const all = payloadItems(mode);
    expect(all.length).toBeGreaterThan(0);
    for (const item of all) {
      const facts = leverFacts(item, [EQ_FRAME_LEVER, STRIP_LEVER, MOVE_LEVER]);
      expect(facts).not.toMatch(/\d|[+−]|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
      for (const l of numberBondLevers(item, [], { ...none, session: all, committed: 'join' }))
        expect(`${l.when} ${l.does}`).not.toMatch(/\d|[+−]|\b(one|three|four|six|seven|eight|nine|ten)\b/i);
    }
  });

  it.each(['fact_family', 'build_equation'])('%s payload: the smaller bond is never a bond of the saved session', mode => {
    const all = payloadItems(mode);
    const used = new Set(all.map(bondOf));
    for (const step of build(all)) {
      const easier = smallerBond(step, all, 'join');
      if (easier) expect(used.has(bondOf(easier))).toBe(false);
    }
  });
});
