import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { itemsFromRules, type DeductionItem, type DeductionRuleSpec } from './diDeductionScript';
import { deductionSpokenMisses } from './diDeductionWorkspace';
import { ANSWER_FRAME, COUNTEREXAMPLE_CARD, MODEL_CASE, SHARED_TERM, contentWords, counterexampleFact, counterexampleFor,
  deductionLeverFacts, deductionLevers, frameText, modelCases, modelRuleFor, spareLeaks, sparesFor, startingLevers } from './diDeductionLevers';
import concludeP from '../../../components/live-activity/runtime/testing/w1-payloads/di-deduction.conclude.json';
import denyP from '../../../components/live-activity/runtime/testing/w1-payloads/di-deduction.deny.json';
import cannotP from '../../../components/live-activity/runtime/testing/w1-payloads/di-deduction.cannot_tell.json';

const rule = (id: string, category: string, plural: string, propPl: string, propSg: string, propNeg: string,
  members: string[], nonMembers: string[], lookalikes: string[], shapes?: DeductionRuleSpec['shapes']): DeductionRuleSpec =>
  ({ id, category, categoryPlural: plural, propertyPlural: propPl, propertySingular: propSg, propertyNegated: propNeg,
    kindNoun: 'animal', members, nonMembers, lookalikes, ...(shapes ? { shapes } : {}) });
const BIRDS = rule('b', 'bird', 'birds', 'lay eggs', 'lays eggs', 'does not lay eggs', ['robin', 'duck'], ['cow', 'horse'], ['turtle']);
const SPIDERS = rule('s', 'spider', 'spiders', 'have eight legs', 'has eight legs', 'does not have eight legs',
  ['tarantula'], ['ant'], ['scorpion']);
const INSECTS = rule('i', 'insect', 'insects', 'have six legs', 'has six legs', 'does not have six legs', ['beetle'], ['spider'], []);
const items = (rules: DeductionRuleSpec[]) => itemsFromRules(rules).items;
type Payload = { data: { rules: DeductionRuleSpec[]; spares?: DeductionRuleSpec[] } };
const SAVED = ([concludeP, denyP, cannotP] as unknown as Payload[]).map(p => ({ items: items(p.data.rules), spares: p.data.spares ?? [] }));
const CATALOG = DI_CATALOG.find(c => c.id === 'di-deduction')!.teachingWorkspace!;

describe('spares (R3): a different rule that shares no content word with the session', () => {
  it('content words are stemmed and skip the kind noun every animal rule shares', () => {
    expect(contentWords(INSECTS).has('insect')).toBe(true);
    expect(contentWords(INSECTS).has('animal')).toBe(false);
    expect(spareLeaks(SPIDERS, [INSECTS])).toBe(true); // "spider" is an insect non-member
    expect(spareLeaks(SPIDERS, [BIRDS])).toBe(false);
  });

  it('sparesFor keeps unused rules that do not leak, with all shapes', () => {
    const spares = sparesFor([BIRDS], [BIRDS, { ...SPIDERS, shapes: ['deny'] }, INSECTS]);
    expect(spares.map(s => s.id)).toEqual(['s', 'i']);
    expect(spares[0].shapes).toBeUndefined();
  });

  it('every saved payload\'s spares share no content word with its session', () => {
    for (const { items: session, spares } of SAVED) {
      const rules = Array.from(new Map(session.map(i => [i.ruleId, i.rule])).values());
      for (const spare of spares) expect(spareLeaks(spare, rules), spare.categoryPlural).toBe(false);
    }
  });
});

describe('model_case (R1): every verdict on the spare, so the card points at none', () => {
  it('the model works the spare through yes, no and can\'t tell, each with its reason; the subject stays anonymous', () => {
    const cases = modelCases(SPIDERS);
    expect(cases.map(c => c.shape)).toEqual(['conclude', 'deny', 'cannot_tell']);
    expect(cases[2].caseText).toBe('This animal has eight legs.');
    expect(cases[2].reason).toContain('scorpion');
    expect(cases[1].reason).toMatch(/^No:/);
  });

  it('a cannot_tell item needs a spare with a lookalike; a conclude item does not', () => {
    const [conclude] = items([BIRDS]);
    expect(modelRuleFor(conclude, [conclude], [INSECTS])?.id).toBe('i');
    const cannot = items([{ ...BIRDS, shapes: ['cannot_tell'] }])[0];
    expect(modelRuleFor(cannot, [cannot], [INSECTS])).toBeNull();
    expect(modelRuleFor(cannot, [cannot], [INSECTS, SPIDERS])?.id).toBe('s');
  });

  it('on every saved payload each item has a model, and its fact never states the item\'s conclusion', () => {
    for (const { items: session, spares } of SAVED) for (const it0 of session) {
      expect(modelRuleFor(it0, session, spares), it0.id).not.toBeNull();
      const fact = deductionLeverFacts(it0, [MODEL_CASE], session, spares);
      expect(fact).not.toContain(it0.case.conclusionText);
      for (const look of it0.rule.lookalikes) expect(fact.toLowerCase()).not.toMatch(new RegExp(`\\b${look}\\b`));
    }
  });
});

describe('help on the cards, and the counterexample practice case', () => {
  it('answer_frame prints the subject and an empty box (conclude) or "___ because ___"; never the property', () => {
    const [conclude, deny] = items([BIRDS]);
    expect(frameText(conclude)).toBe('A robin ___.');
    expect(frameText(deny)).toBe('___ because ___');
    expect(frameText(conclude)).not.toContain('eggs');
  });

  it('shared_term on conclude and deny only; never on cannot_tell', () => {
    const all = items([BIRDS]);
    expect(all.map(i => deductionLevers(i, [], all, []).some(l => l.id === SHARED_TERM))).toEqual([true, true, false]);
  });

  it('counterexample_card: a cannot_tell case on a spare, its lookalike printed; prefers a spare the model does not use', () => {
    const cannot = items([{ ...BIRDS, shapes: ['cannot_tell'] }])[0];
    const spares = [SPIDERS, rule('f', 'fish', 'fish', 'live in water', 'lives in water', 'does not live in water', ['trout'], ['cat'], ['whale'])];
    const easier = counterexampleFor(cannot, [cannot], spares)!;
    expect(easier.shape).toBe('cannot_tell');
    expect(easier.id.startsWith(`${cannot.id}~simpler`)).toBe(true);
    expect(easier.rule.category).toBe('fish');
    expect(counterexampleFact(easier)).toBe('A whale lives in water. A whale is not a fish.');
    const [conclude] = items([BIRDS]);
    expect(counterexampleFor(conclude, [conclude], spares)).toBeNull();
  });
});

describe('starting positions and which lever answers which miss', () => {
  it('easy or no tier starts with the model; medium and hard with nothing', () => {
    const [easy] = items([BIRDS]);
    expect(startingLevers(easy, [easy], [SPIDERS])).toEqual([MODEL_CASE]);
    const hard = itemsFromRules([BIRDS], 'hard').items[0];
    expect(startingLevers(hard, [hard], [SPIDERS])).toEqual([]);
  });

  it.each([
    ['backwards_yes', [MODEL_CASE], COUNTEREXAMPLE_CARD],
    ['verdict_without_reason', [MODEL_CASE], ANSWER_FRAME],
    ['said_not_member', [], MODEL_CASE],
  ] as const)('cannot_tell: %s with %j on screen → %s', (miss, pulled, expected) => {
    const cannot = items([{ ...BIRDS, shapes: ['cannot_tell'] }])[0];
    expect(nextLever(deductionLevers(cannot, pulled, [cannot], [SPIDERS, { ...SPIDERS, id: 's2' }]), miss)).toBe(expected);
  });

  it('every catalog miss is answered on every saved payload, and every named miss is listed', () => {
    for (const { items: session, spares } of SAVED) {
      const mode = session[0].shape;
      const answered = new Set(session.flatMap((i: DeductionItem) => deductionLevers(i, [], session, spares).flatMap(l => l.answers ?? [])));
      for (const miss of CATALOG.misses![mode]) expect(answered.has(miss), `${mode}: ${miss}`).toBe(true);
      for (const i of session) for (const m of deductionSpokenMisses(i)) expect(CATALOG.misses![mode], `${i.id} ${m.id}`).toContain(m.id);
    }
  });
});
