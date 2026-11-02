/**
 * The harbor's find-the-rule test, pure: the items code builds and their check. The learner tests a few things, then,
 * without testing, sorts things on yellow stands into float or sink and says what decides it: how big it is, how heavy
 * it is, or what it is made of. Every thing to sort is made of the same stuff as one test but is a different size, so
 * the stuff sorts them and the size does not. Both the sort and the rule must be right; a right check drops them in.
 *
 * Every item's tests show the size does not decide it: at least one test is a big floater or a small sinker.
 */
import {
  MATERIAL_WORD, THINGS, floats, result, sizeSurprise,
  type Call, type HarborThing, type Material, type Rng, type Tier,
} from './buoyancyModel';

export const RULES = ['size', 'weight', 'material'] as const;
export type Rule = typeof RULES[number];
export const RULE_LABEL: Record<Rule, string> = { size: 'how big it is', weight: 'how heavy it is', material: 'what it is made of' };

export interface RuleChallenge {
  id: string;
  type: 'find_the_rule';
  instruction: string;
  /** Dropped first, after a guess each (never graded). */
  tested: HarborThing[];
  /** Sorted without testing; each shares its stuff with exactly one test, in another size. Never dropped before a right check. */
  toSort: HarborThing[];
  /** The lesson's support tier on this item: when the model levers come (`HARBOR_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

const list = (ts: readonly HarborThing[]) =>
  ts.length === 1 ? `the ${ts[0].name}` : `${ts.slice(0, -1).map(t => `the ${t.name}`).join(', ')} and the ${ts[ts.length - 1].name}`;

export function ruleInstruction(tested: readonly HarborThing[], toSort: readonly HarborThing[]): string {
  return `Test ${list(tested)}. Then, without testing, will ${list(toSort)} float or sink? What decides it?`;
}

/** The test made of the same stuff as a thing to sort (the evidence for it). */
export const partnerOf = (c: Pick<RuleChallenge, 'tested'>, t: HarborThing): HarborThing | undefined =>
  c.tested.find(x => x.material === t.material);

// ============================================================================
// Items
// ============================================================================

const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];
const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
const ofStuff = (m: Material) => THINGS.filter(t => t.material === m);
const harborStuff = (floater: boolean) => Array.from(new Set(THINGS.filter(t => floats(t) === floater).map(t => t.material)));

/**
 * One item. Easy: a floater and a sinker to sort, sized as the eye expects, each beside a test of its stuff in another
 * size (at least one a surprise). Medium: a third stuff is tested too, and at least one thing to sort fools the eye.
 * Hard: both things to sort fool the eye (a big floater, a small sinker), their tests do not, and the third test is
 * the one surprise that shows size is not the rule. Null when the draw finds no fit.
 */
export function buildRuleChallenge(tier: Tier, rng: Rng, id: string, seen: ReadonlySet<string> = new Set()): RuleChallenge | null {
  const fresh = (xs: HarborThing[]) => (xs.some(t => !seen.has(t.key)) ? xs.filter(t => !seen.has(t.key)) : xs);
  const toSort: HarborThing[] = [], tested: HarborThing[] = [];
  for (const floater of [true, false]) {
    const m = pick(harborStuff(floater), rng);
    const pool = ofStuff(m).filter(t => (tier === 'easy' ? !sizeSurprise(t) : tier === 'hard' ? sizeSurprise(t) : true)
      && ofStuff(m).some(p => p.size !== t.size));
    if (!pool.length) return null;
    const s = pick(fresh(pool), rng);
    const partners = ofStuff(m).filter(p => p.size !== s.size);
    // Easy: the partner should be the surprise when it can; hard: it must not be one.
    const pref = tier === 'easy' ? partners.filter(sizeSurprise) : tier === 'hard' ? partners.filter(p => !sizeSurprise(p)) : [];
    toSort.push(s);
    tested.push(pick(fresh(pref.length ? pref : partners), rng));
  }
  if (tier !== 'easy') {
    const used = new Set(tested.map(t => t.material));
    const third = THINGS.filter(t => !used.has(t.material) && (tier === 'hard' ? sizeSurprise(t) : true));
    tested.push(pick(fresh(third), rng));
  }
  if (!tested.some(sizeSurprise)) return null;
  if (tier === 'medium' && !toSort.some(sizeSurprise)) {
    // Swap one thing to sort for a same-stuff surprise in another size than its test, where one exists.
    const i = toSort.findIndex(s => ofStuff(s.material).some(t => sizeSurprise(t) && t.size !== partnerOf({ tested }, s)!.size));
    if (i < 0) return null;
    toSort[i] = pick(ofStuff(toSort[i].material).filter(t => sizeSurprise(t) && t.size !== partnerOf({ tested }, toSort[i])!.size), rng);
  }
  const t = shuffle(tested, rng), s = shuffle(toSort, rng);
  const c: RuleChallenge = { id, type: 'find_the_rule', instruction: ruleInstruction(t, s), tested: t, toSort: s };
  return ruleFair(c) ? c : null;
}

/** N rule items: no thing to sort twice, and tests repeated only where the library runs out. */
export function pickRuleChallenges(n: number, tier: Tier, rng: Rng, idPrefix = 'rule'): RuleChallenge[] {
  const seen = new Set<string>(), sorted = new Set<string>();
  const out: RuleChallenge[] = [];
  for (let tries = 0; out.length < n && tries < 400; tries++) {
    const c = buildRuleChallenge(tier, rng, `${idPrefix}-${out.length + 1}`, seen);
    if (!c || (tries < 300 && c.toSort.some(x => sorted.has(x.key)))) continue;
    [...c.tested, ...c.toSort].forEach(x => seen.add(x.key));
    c.toSort.forEach(x => sorted.add(x.key));
    out.push(c);
  }
  return out;
}

/** Whether an item is one the check can judge fairly: what `validate` and the tests hold every item to. */
export function ruleFair(c: RuleChallenge): boolean {
  if (!c.tested.length || !c.toSort.length) return false;
  if (!c.tested.some(sizeSurprise)) return false;
  return c.toSort.every(s => {
    const same = c.tested.filter(x => x.material === s.material);
    return same.length === 1 && same[0].size !== s.size && same[0].key !== s.key;
  }) && new Set([...c.tested, ...c.toSort].map(x => x.key)).size === c.tested.length + c.toSort.length;
}

// ============================================================================
// The check
// ============================================================================

export interface RuleAnswer {
  /** The learner's call on each thing to sort, in order. */
  calls: ReadonlyArray<Call | null>;
  rule: Rule | null;
}
export type RuleMiss = 'sorted_by_size' | 'sort_slip' | 'wrong_rule';

const callRight = (c: RuleChallenge, a: RuleAnswer, i: number) => a.calls[i] === result(c.toSort[i]);
export const ruleMatches = (c: RuleChallenge, a: RuleAnswer): boolean =>
  c.toSort.every((_, i) => callRight(c, a, i)) && a.rule === 'material';

/** The named miss: a wrong call on a thing whose size fools the eye, else another wrong call, else the wrong rule. */
export function ruleMiss(c: RuleChallenge, a: RuleAnswer): RuleMiss | undefined {
  const wrong = c.toSort.filter((_, i) => !callRight(c, a, i));
  if (wrong.some(sizeSurprise)) return 'sorted_by_size';
  if (wrong.length) return 'sort_slip';
  return a.rule === 'material' ? undefined : 'wrong_rule';
}

const verb = (call: Call) => (call === 'floats' ? 'float' : 'sink');

/** The learner's answer in words, never the key. */
export function describeRule(c: RuleChallenge, a: RuleAnswer): string {
  const calls = c.toSort.map((t, i) => (a.calls[i] ? `the ${t.name} will ${verb(a.calls[i]!)}` : `nothing for the ${t.name}`));
  return `said ${calls.join(' and ')}, and ${a.rule ? `picked "${RULE_LABEL[a.rule]}" as what decides it` : 'picked nothing as what decides it'}`;
}

export function ruleFeedback(c: RuleChallenge, a: RuleAnswer): string {
  const miss = ruleMiss(c, a);
  if (!miss) {
    const why = c.toSort.map(t => `the ${t.name} is ${MATERIAL_WORD[t.material]} like the ${partnerOf(c, t)!.name}, so it ${result(t) === 'floats' ? 'floats' : 'sinks'}`);
    return `Yes! What a thing is made of decides it, not its size: ${why.join('; ')}.`;
  }
  if (miss === 'sorted_by_size') return 'Big or small did not decide it in your tests. Which test is made of the same stuff as each thing on a stand?';
  if (miss === 'sort_slip') return 'Look again: which test is made of the same stuff as each thing on a stand, and what did that test do?';
  const surprise = c.tested.find(sizeSurprise)!;
  return a.rule === 'size' || a.rule === 'weight'
    ? `Your sorting is right! Now look at the ${surprise.name}. Did ${a.rule === 'size' ? 'its size' : 'how heavy it is'} decide what it did?`
    : 'Your sorting is right! Now pick what decides it.';
}
