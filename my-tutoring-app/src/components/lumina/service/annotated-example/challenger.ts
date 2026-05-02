/**
 * Challenger — global challenge-layer pass for the annotated-example pipeline.
 *
 * Stage 4. Runs after per-spec generation. A single LLM call (thinking model)
 * sees every step in the example — algebra OR otherwise — and decides which
 * ones deserve a prediction prompt. The output is a list of
 * `ChallengeAssignment`s that the orchestrator merges into matching steps:
 *
 *   - kind="transition" (algebra only): hide the operation or the resulting
 *     KaTeX inside one transition. Existing fine-grained gating.
 *   - kind="step"       (everything else): hide the entire step body until
 *     the student commits a prediction. Universal across table,
 *     graph-sketch, case-split, diagram.
 *
 * Why one stage for both kinds:
 *   - Variety across an example only emerges with a global view — gate the
 *     algebra step on its operation, gate the graph-sketch on its
 *     y-intercept, leave the verification step alone. Per-step generators
 *     have no visibility into siblings.
 *   - Picking *which* slot to gate, *which* misconception to model, and
 *     writing a prompt is reasoning work; the per-step flash-lite generators
 *     reliably emit null when asked.
 *
 * Non-fatal: any failure short-circuits to `failed: true` with zero
 * assignments, and the existing render path is unaffected.
 */

import { Type, Schema, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  AlgebraStepContent,
  ChallengeAssignment,
  ChallengerDebugPayload,
  KaTeXTransitionChallenge,
  RichExampleStep,
  StepChallenge,
  StepContent,
} from '../../primitives/annotated-example/types';

// ── Schema ───────────────────────────────────────────────────────────
//
// Single flat shape with a `kind` discriminator. Gemini schemas don't
// express discriminated unions cleanly, so kind-specific fields are
// `nullable: true` and the merge step enforces shape per kind.

const CHALLENGER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    assignments: {
      type: Type.ARRAY,
      description:
        'One assignment per step you choose to gate. AT MOST ONE per step. Aim for variety: mix transition gates (on algebra steps) with step-level gates (on every other type). Skip pure verification or cosmetic restatement.',
      items: {
        type: Type.OBJECT,
        properties: {
          stepIndex: {
            type: Type.INTEGER,
            description:
              'Which step (0-indexed) this challenge belongs to. MUST be a real index from the step list.',
          },
          kind: {
            type: Type.STRING,
            enum: ['transition', 'step'],
            description:
              '"transition" → gate one slot inside an algebra step\'s transition (algebra ONLY). "step" → gate the whole step content until the student commits (use for table, graph-sketch, case-split, diagram).',
          },
          transitionIndex: {
            type: Type.INTEGER,
            nullable: true,
            description:
              'For kind="transition" ONLY. Which transition (0-indexed) within that algebra step gets gated. MUST be < the step\'s listed transition count. Omit / leave null for kind="step".',
          },
          hide: {
            type: Type.STRING,
            enum: ['operation', 'to'],
            nullable: true,
            description:
              'For kind="transition" ONLY. "operation" → student predicts the next move ("subtract 3 from both sides"). "to" → student predicts the resulting expression (KaTeX). Omit / leave null for kind="step".',
          },
          prompt: {
            type: Type.STRING,
            description:
              'Specific question tied to THIS step\'s actual content. Bad: "What\'s next?". Good: "Now that you\'ve isolated the x term, what undoes the coefficient 2?" or "Which case applies when 2x − 3 < 0?".',
          },
          canonicalAnswer: {
            type: Type.STRING,
            description:
              'The correct answer. For kind="transition" hide="operation": the operation string VERBATIM. For hide="to": the to-latex VERBATIM. For kind="step": the answer the student should type or pick. Whitespace and casing are normalized; the merge step rejects transition mismatches.',
          },
          acceptableSynonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Optional alternate phrasings ("add 3", "+3"). Real student wording, not paraphrases. Empty array is fine.',
          },
          distractors: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Misconception-driven wrong answers. Each MUST reflect a real student error (sign error, wrong inverse op, wrong case, wrong feature value). 2-3 for MCQ. Empty array → free-response.',
          },
          rationale: {
            type: Type.STRING,
            description:
              'One sentence explaining WHY the canonical answer is right and what error the distractors model. Shown after the student commits.',
          },
          answerFormat: {
            type: Type.STRING,
            enum: ['text', 'katex'],
            nullable: true,
            description:
              'For kind="step" ONLY. "katex" when the canonical answer is a math expression that should render as math ("y = 2x + 1", "x = 4", "(2, 3)"). "text" for word/conceptual answers ("the y-intercept", "Case 1: x ≤ 0"). Defaults to text. Omit / leave null for kind="transition".',
          },
        },
        required: [
          'stepIndex',
          'kind',
          'prompt',
          'canonicalAnswer',
          'acceptableSynonyms',
          'distractors',
          'rationale',
        ],
      },
    },
  },
  required: ['assignments'],
};

// ── Step summaries (universal) ───────────────────────────────────────

export interface ChallengerInput {
  topic: string;
  gradeContext: string;
  problemStatement: string;
  solutionStrategy: string;
  steps: RichExampleStep[];
}

interface AlgebraStepSummary {
  type: 'algebra';
  stepIndex: number;
  title: string;
  misconception: string;
  transitions: Array<{ transitionIndex: number; from: string; operation: string; to: string }>;
}

interface NonAlgebraStepSummary {
  type: 'table' | 'graph-sketch' | 'case-split' | 'diagram';
  stepIndex: number;
  title: string;
  misconception: string;
  bodyDescription: string;
}

type StepSummary = AlgebraStepSummary | NonAlgebraStepSummary;

const HTML_CLASS_RE = /\\htmlClass\{[^}]*\}\{([^}]*)\}/g;

function stripHtmlClass(latex: string): string {
  let prev = '';
  let curr = latex;
  while (prev !== curr) {
    prev = curr;
    curr = curr.replace(HTML_CLASS_RE, '$1');
  }
  return curr;
}

function stripDollars(s: string): string {
  return s.replace(/\$([^$]+)\$/g, '$1');
}

/** Compact, planner-friendly view of every step. Algebra steps surface
 *  their transitions; other types surface the salient content the LLM
 *  needs to design a prediction (table values, graph features, case
 *  conditions, diagram labels). */
function buildStepSummaries(steps: RichExampleStep[]): StepSummary[] {
  return steps.map((step, i) => {
    const misconception = step.annotations.misconceptions || '';
    if (step.content.type === 'algebra') {
      const algebra = step.content;
      return {
        type: 'algebra',
        stepIndex: i,
        title: step.title,
        misconception,
        transitions: algebra.transitions.map((t, ti) => ({
          transitionIndex: ti,
          from: stripHtmlClass(t.from.latex),
          operation: t.operation,
          to: stripHtmlClass(t.to.latex),
        })),
      };
    }
    return {
      type: step.content.type,
      stepIndex: i,
      title: step.title,
      misconception,
      bodyDescription: describeNonAlgebraContent(step.content),
    };
  });
}

function describeNonAlgebraContent(
  content: Exclude<StepContent, AlgebraStepContent>,
): string {
  switch (content.type) {
    case 'table': {
      const rows = content.rows.slice(0, 8).map((r, ri) => {
        const cells = r.map(stripDollars).join(' | ');
        const hl = content.highlightCell?.[0] === ri ? ' ← highlighted row' : '';
        return `      row ${ri}: ${cells}${hl}`;
      });
      const more = content.rows.length > 8 ? `\n      … +${content.rows.length - 8} more rows` : '';
      const hlInfo = content.highlightCell
        ? `\n    highlightCell: row=${content.highlightCell[0]} col=${content.highlightCell[1]}`
        : '';
      return `caption: "${content.caption}"
    headers: [${content.headers.map(stripDollars).join(' | ')}]${hlInfo}
    rows:
${rows.join('\n')}${more}`;
    }
    case 'graph-sketch': {
      const expr = content.expression || '(none)';
      const curves = (content.curves ?? [])
        .map((c) => `${c.expression}${c.label ? ` (label "${c.label}")` : ''}${c.style ? ` [${c.style}]` : ''}`)
        .join('; ') || '(none)';
      const points = content.keyPoints
        .map((p) => `(${p.x}, ${p.y}) "${p.label}"`)
        .join(', ') || '(none)';
      const feats = content.features
        .map((f) => `${f.kind}: ${f.label}=${f.value}`)
        .join(', ') || '(none)';
      const caption = content.caption ? `\n    caption: "${content.caption}"` : '';
      const shaded = (content.shadedRegions ?? [])
        .map((r) => `[${r.from}, ${r.to}] upper=${r.upper} lower=${r.lower}${r.label ? ` "${r.label}"` : ''}`)
        .join('; ');
      return `${caption ? caption + '\n   ' : ''} primary expression: ${expr}
    curves: ${curves}
    domain: [${content.domain[0]}, ${content.domain[1]}]  range: [${content.range[0]}, ${content.range[1]}]
    keyPoints: ${points}
    features: ${feats}${shaded ? `\n    shadedRegions: ${shaded}` : ''}`;
    }
    case 'case-split': {
      const cases = content.cases
        .map((c, i) => `      case ${i}: label="${c.label}" condition="${c.condition}" → result=${c.result}`)
        .join('\n');
      return `splitting on: "${content.condition}"
    cases:
${cases || '      (none)'}`;
    }
    case 'diagram': {
      const labels = content.labels
        .map((l, i) => `      label ${i}: "${l.text}" — ${l.description}`)
        .join('\n');
      return `altText: "${content.altText}"
    labels:
${labels || '      (none)'}`;
    }
  }
}

// ── Prompt ───────────────────────────────────────────────────────────

function buildChallengerPrompt(input: ChallengerInput, summaries: StepSummary[]): string {
  const stepView = summaries
    .map((s) => {
      const misc = s.misconception ? `\n    misconception annotation: ${s.misconception}` : '';
      if (s.type === 'algebra') {
        const transRows = s.transitions
          .map(
            (t) =>
              `    transition ${t.transitionIndex}: from="${t.from}"  op="${t.operation}"  to="${t.to}"`,
          )
          .join('\n');
        const tCount = s.transitions.length;
        return `step ${s.stepIndex} [algebra] "${s.title}" — ${tCount} transition${tCount === 1 ? '' : 's'} (valid transitionIndex range: 0..${tCount - 1})${misc}\n${transRows}`;
      }
      return `step ${s.stepIndex} [${s.type}] "${s.title}"${misc}\n    ${s.bodyDescription}`;
    })
    .join('\n\n');

  return `You are designing prediction challenges that turn a worked-example into guided practice. The student already has the problem statement and solution strategy in front of them. Your job: pick which steps to gate, decide what the student should predict, and author a prompt + distractors so the student must commit BEFORE the canonical answer reveals.

## Problem
"${input.problemStatement}"
Topic: ${input.topic}
Grade context: ${input.gradeContext}

## Strategy
${input.solutionStrategy}

## Steps in this example

${stepView}

## Two kinds of challenge

### kind="transition" — algebra steps ONLY
Gate one slot inside one transition. Use this when there's a meaningful local choice in the algebraic manipulation.
- transitionIndex: 0..(transition count − 1) for that step. Look at the step header above for the valid range.
- hide="operation": student predicts the NEXT MOVE. Use when the transition involves strategic choice (picking the right inverse, deciding to substitute, etc.). canonicalAnswer = the operation string VERBATIM.
- hide="to": student predicts the RESULTING expression. Use when the operation is named and the work is computational. canonicalAnswer = the to-latex VERBATIM.

The merge step rejects mismatches, so the canonicalAnswer must equal the slot byte-for-byte.

### kind="step" — every non-algebra type (table, graph-sketch, case-split, diagram)
Gate the WHOLE step content until the student commits. The content reveals on commit; the canonical answer is shown alongside their attempt.
- canonicalAnswer = exactly what the student should produce. Examples:
  - graph-sketch with a y-intercept feature: prompt "Predict where this curve crosses the y-axis." canonicalAnswer="(0, 5)"  answerFormat="katex"
  - case-split with two cases: prompt "Which case handles 2x − 3 < 0?" canonicalAnswer="Case 2: 2x − 3 < −5"  answerFormat="text"
  - table mapping n → n²: prompt "Predict the value when n = 4." canonicalAnswer="16"  answerFormat="katex"
- answerFormat="katex" if the answer should render as math (numbers, expressions, coordinate pairs). "text" for word answers ("the y-intercept", "Case 1").
- Distractors and synonyms work the same as transition challenges.

## Indexing rules — read carefully

1. stepIndex MUST be a real index from the step list above.
2. kind="transition" is ONLY valid on steps marked [algebra]. Other types have no transitions.
3. transitionIndex MUST be within the range listed in that step's header.
4. kind="step" is ONLY valid on non-algebra steps. Algebra has its own per-transition mechanism.
5. AT MOST ONE assignment per step. Variety across steps is the goal — don't pile two on the same step.

## When to skip a step entirely
- Pure verification (substitute back to check). No interesting prediction.
- Final-answer card / cosmetic restatement. The student already saw the work.
- Diagram steps where the labels describe an image the student hasn't seen — there's no fair prediction available.
- Steps where the misconception annotation is empty AND nothing about the content invites a wrong-but-plausible alternative.

## Hard rules

1. **canonicalAnswer matches the slot exactly** for kind="transition". Do not paraphrase. The merge step rejects mismatches.

2. **Distractors model real misconceptions**:
   - operation gates: wrong inverse ("add 3" when canonical is "subtract 3"), skipped step, wrong order
   - to gates: sign errors after distribution, dropped terms, wrong inverse application
   - step gates: wrong feature on a graph (intercept vs asymptote), wrong case, off-by-one on a table value
   Random alternatives are useless — leave distractors empty for free-response if you can't think of a real error.

3. **Rationale ties to the misconception.** One sentence. Reference what the right reasoning was, OR (when free-response) why the canonical answer is the right move.

4. **Prompts are SPECIFIC to THIS step.** "What's next?" is bad. "After clearing the constant, what undoes the coefficient on x?" is good. "Predict the answer" is bad. "Predict the value of f(3)" is good.

5. **Synonyms are real student phrasings**, not paraphrases. "subtract 3 from both sides" / "−3 each side" / "subtract 3" — yes. "remove three" — no.

## Output

Emit an \`assignments\` array. Empty array is acceptable if every step is verification or cosmetic. Otherwise expect roughly half the step count, mixing both kinds.`;
}

// ── Parse + merge ────────────────────────────────────────────────────

interface RawAssignment {
  stepIndex?: number;
  kind?: string;
  transitionIndex?: number | null;
  hide?: string | null;
  prompt?: string;
  canonicalAnswer?: string;
  acceptableSynonyms?: unknown;
  distractors?: unknown;
  rationale?: string;
  answerFormat?: string | null;
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function parseAssignments(data: Record<string, unknown>): ChallengeAssignment[] {
  const raw = Array.isArray(data.assignments) ? (data.assignments as RawAssignment[]) : [];
  const out: ChallengeAssignment[] = [];
  for (const r of raw) {
    if (
      typeof r.stepIndex !== 'number' ||
      typeof r.prompt !== 'string' ||
      typeof r.canonicalAnswer !== 'string' ||
      !r.canonicalAnswer.trim() ||
      typeof r.rationale !== 'string'
    ) {
      continue;
    }
    const acceptableAnswers = [r.canonicalAnswer.trim(), ...parseStringArray(r.acceptableSynonyms)];
    const distractors = parseStringArray(r.distractors);
    const common = {
      stepIndex: r.stepIndex,
      prompt: r.prompt.trim(),
      acceptableAnswers,
      distractors,
      rationale: r.rationale.trim(),
    };

    if (r.kind === 'transition') {
      if (
        typeof r.transitionIndex !== 'number' ||
        (r.hide !== 'operation' && r.hide !== 'to')
      ) {
        continue;
      }
      out.push({
        kind: 'transition',
        ...common,
        transitionIndex: r.transitionIndex,
        hide: r.hide,
      });
    } else if (r.kind === 'step') {
      const fmt: 'text' | 'katex' = r.answerFormat === 'katex' ? 'katex' : 'text';
      out.push({
        kind: 'step',
        ...common,
        answerFormat: fmt,
      });
    }
    // unknown kind → drop silently (parse-time filter; the LLM enum should
    // prevent this, but we don't trust the schema layer to be airtight)
  }
  return out;
}

/**
 * Merge assignments into the matching step or transition, mutating `steps`
 * in place. Drops assignments that violate kind/type matching, point at
 * out-of-range indices, or duplicate a step that already has a challenge.
 * Returns merged + dropped (with reasons) so the debug card surfaces what
 * got rejected.
 */
export function mergeAssignmentsIntoSteps(
  steps: RichExampleStep[],
  assignments: ChallengeAssignment[],
): { merged: ChallengeAssignment[]; dropped: Array<{ assignment: ChallengeAssignment; reason: string }> } {
  const merged: ChallengeAssignment[] = [];
  const dropped: Array<{ assignment: ChallengeAssignment; reason: string }> = [];
  const claimedSteps = new Set<number>();

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

  for (const a of assignments) {
    const step = steps[a.stepIndex];
    if (!step) {
      dropped.push({ assignment: a, reason: `stepIndex ${a.stepIndex} out of range` });
      continue;
    }
    if (claimedSteps.has(a.stepIndex)) {
      dropped.push({ assignment: a, reason: `step ${a.stepIndex} already has a challenge (one per step)` });
      continue;
    }

    if (a.kind === 'transition') {
      if (step.content.type !== 'algebra') {
        dropped.push({
          assignment: a,
          reason: `kind=transition requires an algebra step; step ${a.stepIndex} is ${step.content.type}`,
        });
        continue;
      }
      const algebra: AlgebraStepContent = step.content;
      const transition = algebra.transitions[a.transitionIndex];
      if (!transition) {
        dropped.push({
          assignment: a,
          reason: `transitionIndex ${a.transitionIndex} out of range (step has ${algebra.transitions.length} transition${algebra.transitions.length === 1 ? '' : 's'})`,
        });
        continue;
      }
      const canonical = a.hide === 'operation' ? transition.operation : stripHtmlClass(transition.to.latex);
      const provided = a.acceptableAnswers[0];
      if (norm(canonical) !== norm(provided)) {
        dropped.push({
          assignment: a,
          reason: `canonicalAnswer "${provided}" ≠ ${a.hide} slot "${canonical}"`,
        });
        continue;
      }
      const challenge: KaTeXTransitionChallenge = {
        hide: a.hide,
        prompt: a.prompt,
        acceptableAnswers: a.acceptableAnswers,
        rationale: a.rationale,
        ...(a.distractors.length > 0 ? { distractors: a.distractors } : {}),
      };
      algebra.transitions[a.transitionIndex] = { ...transition, challenge };
      merged.push(a);
      claimedSteps.add(a.stepIndex);
      continue;
    }

    // a.kind === 'step'
    if (step.content.type === 'algebra') {
      dropped.push({
        assignment: a,
        reason: `kind=step is for non-algebra steps; step ${a.stepIndex} is algebra (use kind=transition)`,
      });
      continue;
    }
    const challenge: StepChallenge = {
      prompt: a.prompt,
      acceptableAnswers: a.acceptableAnswers,
      rationale: a.rationale,
      ...(a.distractors.length > 0 ? { distractors: a.distractors } : {}),
      ...(a.answerFormat ? { answerFormat: a.answerFormat } : {}),
    };
    step.challenge = challenge;
    merged.push(a);
    claimedSteps.add(a.stepIndex);
  }

  return { merged, dropped };
}

// ── Public entry ─────────────────────────────────────────────────────

/**
 * Empty payload — used both as the failure short-circuit and as the
 * "nothing to gate" early return.
 */
function emptyPayload(failed: boolean): ChallengerDebugPayload {
  return { assignments: [], dropped: [], failed };
}

/**
 * Run the challenger pass. Mutates `steps` in place to attach `challenge`
 * fields where assignments succeed. Returns a debug payload. Never throws —
 * any error short-circuits to `{ failed: true }`.
 */
export async function assignChallenges(input: ChallengerInput): Promise<ChallengerDebugPayload> {
  if (input.steps.length === 0) {
    console.log('[Challenger] No steps — skipping.');
    return emptyPayload(false);
  }

  const summaries = buildStepSummaries(input.steps);
  const algebraCount = summaries.filter((s) => s.type === 'algebra').length;
  const otherCount = summaries.length - algebraCount;
  console.log(
    `[Challenger] Designing challenges across ${summaries.length} step(s) (${algebraCount} algebra, ${otherCount} other)...`,
  );

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: buildChallengerPrompt(input, summaries),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: 'application/json',
        responseSchema: CHALLENGER_SCHEMA,
      },
    });
  } catch (error) {
    console.warn('[Challenger] LLM call failed:', error);
    return emptyPayload(true);
  }

  const text = response.text;
  if (!text) {
    console.warn('[Challenger] Empty response.');
    return emptyPayload(true);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    console.warn('[Challenger] JSON parse failed:', error);
    return emptyPayload(true);
  }

  const proposed = parseAssignments(data);
  console.log(`[Challenger] Proposed ${proposed.length} assignment(s).`);

  const { merged, dropped } = mergeAssignmentsIntoSteps(input.steps, proposed);

  for (const a of merged) {
    if (a.kind === 'transition') {
      console.log(
        `[Challenger]   ✓ step ${a.stepIndex} transition ${a.transitionIndex} hide=${a.hide} (${a.distractors.length} distractor${a.distractors.length === 1 ? '' : 's'})`,
      );
    } else {
      console.log(
        `[Challenger]   ✓ step ${a.stepIndex} step-level gate (${a.distractors.length} distractor${a.distractors.length === 1 ? '' : 's'}, format=${a.answerFormat ?? 'text'})`,
      );
    }
  }
  for (const { assignment, reason } of dropped) {
    const locator =
      assignment.kind === 'transition'
        ? `step ${assignment.stepIndex} transition ${assignment.transitionIndex}`
        : `step ${assignment.stepIndex} step-level`;
    console.warn(`[Challenger]   ✗ ${locator}: ${reason}`);
  }

  return { assignments: merged, dropped, failed: false };
}
