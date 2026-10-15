/**
 * Knowledge-check problems from an item space (service/itemSpace, skill /add-item-space): code picks
 * each problem at the requested difficulty, computes its answer and its wrong options; the LLM writes
 * the question and the rationale around the given quantities. A question the LLM gets wrong (a missing
 * quantity, an extra number, the answer stated, no question) is replaced by the space's plain question,
 * so a problem never ships off its spec. Works for any space; nothing here is strand-specific.
 */
import { Type } from '@google/genai';
import { ai } from '../geminiClient';
import type { MultipleChoiceProblemData, ProblemDifficulty } from '../../types';
import { getItemSpace, tierPick, type ItemSpaceId } from '../itemSpace';

const tierOf = (beta: number): ProblemDifficulty => (beta < -0.6 ? 'easy' : beta < 0.6 ? 'medium' : 'hard');
const LABELS = ['A', 'B', 'C', 'D'];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The written question keeps every given quantity, states no other number, asks a question, and does
 * not state the answer. Quantities are compared as tokens ("15", "3/4", "2:30").
 */
const TAKE_CUES = /\b(left|leftover|remain\w*|gave|give|gives|away|used|uses|use|ate|eat|eats|spent|spend|spends|lost|lose|loses|fewer|less|more than|difference|minus|took|take|takes|sold|sell|sells|subtract\w*|drank|drink|drinks|removed?|removes|broke|popped|melted|still need|change)\b|[−-]\s*\d/i;
const COMPARE_OR_TAKE = /\b(left|leftover|remain\w*|difference|fewer|how many more|how much more|minus|subtract\w*)\b/i;

/**
 * Whether the story reads as the item's one operation: a subtraction needs a take-away or compare cue,
 * an addition must not ask what is left or how many more. Items with no single operation pass.
 */
export function questionMatchesOperation(question: string, operation?: '+' | '-'): boolean {
  if (operation === '-') return TAKE_CUES.test(question);
  if (operation === '+') return !COMPARE_OR_TAKE.test(question);
  return true;
}

export function questionFitsSpec(question: string, shown: string[], answer: string): boolean {
  const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);
  const count = (xs: number[], v: number) => xs.filter((x) => x === v).length;
  const asked = numbersIn(question);
  const given = shown.flatMap(numbersIn);
  const keepsGiven = shown.every((tok) => question.includes(tok)) && given.every((v) => count(asked, v) >= count(given, v));
  const statesAnswer = !shown.includes(answer) && new RegExp(`(^|[^\\d/:.])${escape(answer)}($|[^\\d/:.])`).test(question);
  const extra = asked.filter((v) => !given.includes(v));
  return keepsGiven && !statesAnswer && extra.length === 0 && question.trim().endsWith('?');
}

export async function buildItemSpaceMcProblems(opts: {
  space: ItemSpaceId;
  count: number;
  band: [number, number];
  gradeLevel: string;
  /** The objective, for the part of the strand it names (`scopeOf`). */
  objective?: string;
  /** The requested tier, stamped on every problem (a beta on a band edge is still the tier asked for). */
  tier?: ProblemDifficulty;
}): Promise<MultipleChoiceProblemData[]> {
  const space = getItemSpace(opts.space);
  const scope = opts.objective ? space.scopeOf?.(opts.objective) : undefined;
  const items = scope
    ? tierPick(space, (m) => console.log(`[KC ItemSpace] ${opts.space}: ${m}`), scope)(opts.count, opts.band[0], opts.band[1], undefined, scope)
    : space.pick(opts.count, opts.band[0], opts.band[1]);
  if (!items.length) return [];
  const specs = items.map((it, i) => ({ it, sol: space.solve(it), id: `p${i + 1}` }));

  let written: Record<string, { question: string; rationale: string }> = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Write one short word problem for each spec, for a ${space.wordingGrade} learner: one to three short sentences `
        + 'about everyday things, ending with a question. Each problem must be exactly its computation, using ONLY the '
        + 'given quantities (every one of them, written as given), and must never state the answer. Vary the people and '
        + 'objects across problems.\nAlso write a one-sentence rationale that explains how to get the answer.\n\n'
        + specs.map(({ id, sol }) => (sol.equation
          ? `${id}: no story. Print the equation ${sol.equation} exactly and ask what number goes in the box. Answer: ${sol.answer}.`
          : `${id}: ${sol.spec}. Given: ${sol.shown.join(', ')}. Answer: ${sol.answer}.`)).join('\n'),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { problems: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
            id: { type: Type.STRING }, question: { type: Type.STRING }, rationale: { type: Type.STRING } },
            required: ['id', 'question', 'rationale'] } } },
          required: ['problems'],
        },
      },
    });
    for (const p of JSON.parse(response.text ?? '{}').problems ?? []) written[p.id] = p;
  } catch (err) {
    console.warn('[KC ItemSpace] wording call failed; plain questions used:', err);
    written = {};
  }

  return specs.map(({ it, sol, id }) => {
    const w = written[id];
    const fits = !!w && questionFitsSpec(w.question, sol.shown, sol.answer) && questionMatchesOperation(w.question, sol.operation)
      && (!sol.equation || w.question.includes(sol.equation)) && (!sol.asks || sol.asks.test(w.question));
    if (!fits) console.log(`[KC ItemSpace] ${id} ${sol.spec}: written question missed its spec; plain question used`);
    const choices = [{ value: sol.answer, distance: 'key' as const }, ...space.distractors(it)]
      .sort(() => Math.random() - 0.5);
    const options = choices.map((c, i) => ({ id: LABELS[i], text: c.value, distance: c.distance }));
    return {
      type: 'multiple_choice' as const,
      id,
      difficulty: opts.tier ?? tierOf(it.beta),
      gradeLevel: opts.gradeLevel,
      question: fits ? w.question : space.plainQuestion(it),
      options,
      correctOptionId: options.find((o) => o.distance === 'key')!.id,
      rationale: w?.rationale ?? '',
      teachingNote: '',
      successCriteria: [space.criterion],
      itemSpace: { space: opts.space, structure: it.structure, beta: Number(it.beta.toFixed(2)) },
    };
  });
}
