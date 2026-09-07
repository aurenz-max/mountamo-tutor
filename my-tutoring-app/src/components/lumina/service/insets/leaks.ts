/**
 * `findInsetAnswerLeaks` — one rule per admitted stimulus inset type
 * (qa/di/BACKLOG.md item 17: "Admitting insets without a per-type leak rule
 * silently retires the guarantee that `expectedAnswer` is a field and leaks
 * are mechanically catchable. This is the feature.").
 *
 * A string scan over the ask cannot see a picture. These rules read the inset
 * STRUCTURE — the token that is the target, the count that is the answer, the
 * glyph whose name is asked — and say whether the stimulus or the ask hands
 * the answer over. Returned strings are reasons; empty means clean.
 */

import type { Inset, ProductionKind } from '../../types';

export interface InsetLeakContext {
  kind: ProductionKind;
  ask: string;
  expectedAnswer: string;
  alternates?: string[];
  /** point_to: the token the child must touch. */
  targetTokenId?: string;
}

const normalize = (s: string): string =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9−+=<>×÷□' -]/g, ' ').replace(/\s+/g, ' ').trim();

const tokensOf = (s: string): Set<string> => new Set(normalize(s).split(/[\s-]+/).filter(Boolean));

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

const numberWordOf = (n: number): string | undefined => NUMBER_WORDS[n];

/** Does the ask SAY the answer (any accepted form) as a whole token? */
function askNamesAnswer(ask: string, answers: string[]): string | null {
  const askTokens = tokensOf(ask);
  for (const answer of answers) {
    const a = normalize(answer);
    if (!a) continue;
    // Multi-word answers ("take away") leak as a phrase; single words as a token.
    if (a.includes(' ') ? ` ${normalize(ask)} `.includes(` ${a} `) : askTokens.has(a)) return a;
  }
  return null;
}

export function findInsetAnswerLeaks(inset: Inset, ctx: InsetLeakContext): string[] {
  const reasons: string[] = [];
  const answers = [ctx.expectedAnswer, ...(ctx.alternates ?? [])].filter(Boolean);

  // The ask must not name the answer for ANY production kind. (point_to is the
  // one exemption: naming the sign and asking the child to find its FORM is the
  // task — "point to the minus sign" — so the spoken NAME may appear; the
  // token's printed TEXT may not.)
  if (ctx.kind !== 'point_to') {
    const named = askNamesAnswer(ctx.ask, answers);
    if (named) reasons.push(`the ask names the answer ("${named}")`);
  }

  switch (inset.insetType) {
    case 'number-sentence': {
      const blanks = inset.tokens.filter((t) => t.kind === 'blank');
      if (ctx.kind === 'how_many') {
        if (blanks.length !== 1) {
          reasons.push(`how_many over a number sentence needs exactly one blank, got ${blanks.length}`);
        } else {
          // The result must not survive as a printed token.
          const printed = new Set(inset.tokens.filter((t) => t.kind === 'number').map((t) => t.text));
          const leaked = new Set<string>();
          for (const a of answers) {
            const digits = /^\d+$/.test(a) ? a : String(NUMBER_WORDS.indexOf(normalize(a)));
            if (digits !== '-1' && printed.has(digits)) leaked.add(digits);
          }
          Array.from(leaked).forEach((d) => reasons.push(`the answer ${d} is printed as a token`));
        }
      } else if (blanks.length > 0) {
        reasons.push(`a blank token sits in a ${ctx.kind} item (blanks only for how_many)`);
      }
      if (ctx.kind === 'point_to') {
        const target = inset.tokens.find((t) => t.id === ctx.targetTokenId);
        if (!target) reasons.push(`targetTokenId "${ctx.targetTokenId}" is not a token`);
        else if (tokensOf(ctx.ask).has(normalize(target.text)) && target.kind !== 'number') {
          reasons.push(`the ask prints the target token "${target.text}"`);
        } else if (target.kind === 'number' && tokensOf(ctx.ask).has(target.text)) {
          reasons.push(`the ask prints the target numeral "${target.text}"`);
        }
        // A target that appears twice has no single position to point at.
        if (target && inset.tokens.filter((t) => t.text === target.text).length > 1) {
          reasons.push(`the target "${target.text}" appears more than once — no single position`);
        }
      }
      break;
    }

    case 'arrangement': {
      const removed = inset.removed ?? 0;
      if (!Number.isInteger(inset.count) || inset.count < 1 || inset.count > 10) reasons.push(`count ${inset.count} is outside 1..10`);
      if (removed < 0 || removed >= inset.count) reasons.push(`removed ${removed} must satisfy 0 ≤ removed < count`);
      const remaining = inset.count - removed;
      if (ctx.kind === 'how_many') {
        // The answer is the count the child produces — it must not be spoken in
        // the ask as a numeral or a number word, and zero is not a benched answer.
        if (remaining < 1) reasons.push('remaining count is zero — not a benched spoken answer');
        const askTokens = tokensOf(ctx.ask);
        const word = numberWordOf(remaining);
        if (askTokens.has(String(remaining)) || (word && askTokens.has(word))) reasons.push(`the ask states the count (${remaining})`);
        if (removed > 0) {
          const removedWord = numberWordOf(removed);
          // Saying how many were taken away is fine ("two were eaten") — but
          // saying the START count as well gives a subtraction the child can do
          // without looking. Flag only when BOTH are spoken.
          const startWord = numberWordOf(inset.count);
          if ((askTokens.has(String(inset.count)) || (startWord && askTokens.has(startWord)))
            && (askTokens.has(String(removed)) || (removedWord && askTokens.has(removedWord)))) {
            reasons.push('the ask states both the start count and the removed count — the picture is not needed');
          }
        }
      }
      if (inset.layout === 'groups') {
        const groups = inset.groups ?? [];
        if (groups.length < 2 || groups.some((g) => g < 1) || groups.reduce((a, b) => a + b, 0) !== inset.count) {
          reasons.push(`groups [${groups.join(',')}] must be ≥2 clusters of ≥1 summing to count ${inset.count}`);
        } else if (ctx.kind === 'how_many') {
          // Saying every addend hands over a mental sum; the picture is not needed.
          const askTokens = tokensOf(ctx.ask);
          const allSpoken = groups.every((g) => askTokens.has(String(g)) || (numberWordOf(g) ? askTokens.has(numberWordOf(g)!) : false));
          if (allSpoken) reasons.push('the ask states every group count — the picture is not needed');
        }
      }
      if (/\d/.test(inset.emoji)) reasons.push('the arrangement emoji contains a digit');
      break;
    }

    case 'glyph-card': {
      if (inset.glyphKind === 'shape') {
        const sides = inset.sides ?? -1;
        if (sides !== 0 && (sides < 3 || sides > 8)) reasons.push(`shape sides ${sides} is outside {0, 3..8}`);
        // The side count is the discriminating fact; it must not be spoken.
        const askTokens = tokensOf(ctx.ask);
        const word = numberWordOf(sides);
        if (sides > 0 && (askTokens.has(String(sides)) || (word && askTokens.has(word)))) reasons.push(`the ask states the side count (${sides})`);
      } else if (!inset.glyph.trim()) {
        reasons.push('an empty glyph on a non-shape card');
      }
      if (inset.label && askNamesAnswer(inset.label, answers)) reasons.push('the card label names the answer');
      break;
    }

    default:
      // Reading insets (katex, passage, chart, …) are band-gated out of the
      // production kinds; a production item over one is a routing defect.
      reasons.push(`inset type "${inset.insetType}" is not a stimulus inset for production items`);
  }

  return reasons;
}
