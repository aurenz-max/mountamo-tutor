import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions, containsWord } from './helpers';

/**
 * measure-lab oracle — a PHYSICS oracle for the K weight-and-capacity bench.
 *
 * The component's whole promise is that the child finds out by testing: the pan
 * tips because of the weights, the container fills because of the capacity. So
 * the contract to check is that the stored answer key AGREES with the physics
 * the component will actually run, and that the challenge can be got wrong.
 *
 * How the component judges (MeasureLab.tsx):
 *  - balance_predict: the child commits a prediction, then places both objects;
 *    the beam tips by `tiltFor(left.weight, right.weight)` and the prediction is
 *    graded against `expectedChoice`. So `expectedChoice` MUST be the id of the
 *    heavier object, and the weights must differ — equal weights leave the beam
 *    level and the question unanswerable.
 *  - capacity_predict: both containers fill to their own capacity and the
 *    prediction is graded against `expectedChoice` — which must be the larger.
 *    The capacities must differ, and the SHAPES must differ too: two identical
 *    shapes make the question a coin toss rather than a conservation test.
 *  - pour_count: the child pours until full; the answer is the count, so
 *    `expectedCount` must equal the container's capacity and be among `options`.
 *  - order_capacity: the child taps three identical jars least → most, graded
 *    against `expectedOrder`. The fill levels must be distinct (a tie has no
 *    order) and `expectedOrder` must be the ascending sort of them.
 *
 * THE INDEPENDENCE RULE: the oracle never trusts a stored key as its own proof.
 * It re-derives the heavier object, the bigger container and the sorted order
 * from the physical quantities and checks the key agrees.
 *
 * Checks:
 *  - answer-key-desync : the key matches the physics, per mode.
 *  - answer-leak       : no prompt or hint names the winning object/container by
 *                        the word the child is about to say, and no prompt states
 *                        a count. (Unlike counting-board, the answer here is NOT
 *                        the manipulative — it is a claim about it — so a leak
 *                        test is honest.)
 *  - scope             : cup counts stay countable for a K child (≤ 12), and
 *                        honor an explicit harness ceiling when one is given.
 *  - clustering        : answers spread (the heavier object is not always the
 *                        left one; the counts are not all the same), and no
 *                        exact-duplicate card.
 *  - schema            : ≥3 challenges (mastery-over-demo); each mode carries the
 *                        fields its render path reads.
 */

const KNOWN_TYPES = new Set([
  'balance_predict', 'capacity_predict', 'pour_count', 'order_capacity',
]);

/** A K child counts these; more is a different lesson. */
const MAX_K_CUPS = 12;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

interface ObjLike { id: string; name: string; weight: number }
interface ContainerLike { id: string; name: string; shape: string; capacity: number; filled?: number }

function readObject(v: unknown): ObjLike | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isInt(r.weight)) return null;
  return { id: r.id, name: String(r.name ?? ''), weight: r.weight as number };
}

function readContainer(v: unknown): ContainerLike | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isInt(r.capacity)) return null;
  return {
    id: r.id,
    name: String(r.name ?? ''),
    shape: String(r.shape ?? ''),
    capacity: r.capacity as number,
    filled: isInt(r.filled) ? (r.filled as number) : undefined,
  };
}

export const measureLabOracle: ContentOracle = {
  componentId: 'measure-lab',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);
    const ceiling = ctx.scopeMax ?? MAX_K_CUPS;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const answersByMode: Record<string, Array<string | number>> = {};
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }
      const prompt = String(c.prompt ?? '');
      const hint = String(c.hint ?? '');

      if (type === 'balance_predict') {
        const left = readObject(c.left);
        const right = readObject(c.right);
        if (!left || !right) {
          violations.push({ check: 'schema', where: id, detail: 'balance_predict needs left and right objects with integer weights' });
          continue;
        }
        if (left.weight === right.weight) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `both objects weigh ${left.weight} — the beam stays level and "which is heavier" has no answer`,
          });
        } else {
          // Independence: re-derive the winner from the weights.
          const heavier = left.weight > right.weight ? left : right;
          if (c.expectedChoice !== heavier.id) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `"${heavier.name}" is heavier (${heavier.weight} vs ${Math.min(left.weight, right.weight)}) but expectedChoice is ${JSON.stringify(c.expectedChoice)} — the beam would contradict the grading`,
            });
          }
          // Leak: the prompt must not say which one wins.
          const lighter = left.weight > right.weight ? right : left;
          for (const [label, text] of [['prompt', prompt], ['hint', hint]] as const) {
            if (/\bheavier than\b|\bis the heaviest\b/i.test(text)
              || (containsWord(text, heavier.name) && /\bheavier\b/i.test(text.split(heavier.name)[1] ?? ''))) {
              violations.push({ check: 'answer-leak', where: id, detail: `${label} names the heavier object: "${text}"` });
            }
            void lighter;
          }
          checked++;
          (answersByMode.balance_predict ??= []).push(c.expectedChoice === left.id ? 'left' : 'right');
          bump(cardSeen, `b|${left.name}|${right.name}|${left.weight}|${right.weight}`);
        }
        continue;
      }

      if (type === 'capacity_predict') {
        const a = readContainer(c.containerA);
        const b = readContainer(c.containerB);
        if (!a || !b) {
          violations.push({ check: 'schema', where: id, detail: 'capacity_predict needs containerA and containerB with integer capacities' });
          continue;
        }
        if (a.capacity === b.capacity) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `both containers hold ${a.capacity} — "which holds more" has no answer`,
          });
        } else {
          const bigger = a.capacity > b.capacity ? a : b;
          if (c.expectedChoice !== bigger.id) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `"${bigger.name}" holds more (${bigger.capacity}) but expectedChoice is ${JSON.stringify(c.expectedChoice)} — filling them would contradict the grading`,
            });
          }
          if (a.shape === b.shape) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `both containers are drawn as "${a.shape}" — with identical shapes the child is guessing, not comparing`,
            });
          }
          if (bigger.capacity > ceiling) {
            violations.push({ check: 'scope', where: id, detail: `${bigger.capacity} cups exceeds the ceiling ${ceiling}` });
          }
          for (const [label, text] of [['prompt', prompt], ['hint', hint]] as const) {
            if (/\bholds more than\b/i.test(text)) {
              violations.push({ check: 'answer-leak', where: id, detail: `${label} says which holds more: "${text}"` });
            }
          }
          checked++;
          (answersByMode.capacity_predict ??= []).push(c.expectedChoice === a.id ? 'A' : 'B');
          bump(cardSeen, `c|${a.name}|${b.name}|${a.capacity}|${b.capacity}`);
        }
        continue;
      }

      if (type === 'pour_count') {
        const container = readContainer(c.container);
        const expected = c.expectedCount;
        const options = Array.isArray(c.options) ? (c.options as unknown[]) : null;
        if (!container) {
          violations.push({ check: 'schema', where: id, detail: 'pour_count needs a container with an integer capacity' });
          continue;
        }
        if (!isInt(expected) || (expected as number) < 1) {
          violations.push({ check: 'schema', where: id, detail: `pour_count needs a positive integer expectedCount; got ${JSON.stringify(expected)}` });
          continue;
        }
        // Independence: the answer IS how many cups the container takes.
        if (expected !== container.capacity) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the ${container.name} holds ${container.capacity} cups but expectedCount says ${expected} — pouring it full would be marked wrong`,
          });
        }
        if (!options || options.length === 0) {
          violations.push({ check: 'schema', where: id, detail: 'pour_count needs a non-empty options array' });
        } else {
          const dup = checkUniqueOptions(options, id);
          if (dup) violations.push(dup);
          if (!options.some((o) => isInt(o) && o === expected)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `expectedCount ${expected} is not among options ${JSON.stringify(options)} — the correct answer can never be chosen`,
            });
          }
        }
        if ((expected as number) > ceiling) {
          violations.push({ check: 'scope', where: id, detail: `${expected} cups exceeds the ceiling ${ceiling}` });
        }
        // Leak: the count must not be stated before the child pours.
        for (const [label, text] of [['prompt', prompt], ['hint', hint]] as const) {
          if (new RegExp(`\\b${expected}\\b`).test(text)) {
            violations.push({ check: 'answer-leak', where: id, detail: `${label} states the count "${expected}": "${text}"` });
          }
        }
        checked++;
        (answersByMode.pour_count ??= []).push(expected as number);
        bump(cardSeen, `p|${container.name}|${container.capacity}`);
        continue;
      }

      // order_capacity
      const containers = Array.isArray(c.containers)
        ? (c.containers as unknown[]).map(readContainer)
        : null;
      if (!containers || containers.length < 3 || containers.some((x) => x === null)) {
        violations.push({ check: 'schema', where: id, detail: 'order_capacity needs at least three well-formed containers' });
        continue;
      }
      const jars = containers as ContainerLike[];
      const levels = jars.map((j) => j.filled ?? 0);
      if (levels.some((l) => !isInt(l))) {
        violations.push({ check: 'schema', where: id, detail: 'every jar needs an integer `filled` amount' });
        continue;
      }
      if (new Set(levels).size !== levels.length) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `two jars hold the same amount (${levels.join(', ')}) — "least to most" has more than one right order`,
        });
      } else {
        // Independence: re-sort by amount and check the stored order agrees.
        const derived = [...jars].sort((x, y) => (x.filled ?? 0) - (y.filled ?? 0)).map((j) => j.id);
        const stored = Array.isArray(c.expectedOrder) ? (c.expectedOrder as unknown[]).map(String) : [];
        if (derived.join('>') !== stored.join('>')) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `amounts ${JSON.stringify(levels)} sort to ${JSON.stringify(derived)} but expectedOrder is ${JSON.stringify(stored)} — the right order would be marked wrong`,
          });
        }
        // Identical jars are the contract: with different shapes the level is
        // not the amount, and the K row this serves says identical containers.
        if (new Set(jars.map((j) => j.shape)).size !== 1) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the jars have different shapes (${jars.map((j) => j.shape).join(', ')}) — the water level then does not rank the amounts`,
          });
        }
      }
      for (const l of levels) {
        if (l > ceiling) violations.push({ check: 'scope', where: id, detail: `a jar holds ${l}, above the ceiling ${ceiling}` });
      }
      checked++;
      (answersByMode.order_capacity ??= []).push(levels.join(','));
      bump(cardSeen, `o|${levels.slice().sort().join(',')}`);
    }

    for (const [mode, vals] of Object.entries(answersByMode)) {
      const variety = checkAnswerVariety(vals, `${mode}[].answer`);
      if (variety) violations.push(variety);
    }
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical card "${key}" appears ${count}× — a duplicated challenge` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
