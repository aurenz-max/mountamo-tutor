/**
 * Agentic annotated-example author.
 *
 * One model (gemini-flash-latest) runs a function-calling loop: it writes the
 * problem, solves it, renders each move through the existing step generators,
 * reads what the renderer produced and the code checks, revises, adds
 * prediction gates, and calls finish. The legacy pipeline runs the same pieces
 * in a fixed order with no stage seeing the assembled result; here the author
 * sees every rendered step before it ships.
 *
 * Code still owns what code can check: arithmetic (mathjs), the authoring
 * contract, no-op transitions, gate/slot agreement and literal answer
 * disclosure. The independent prediction review (prediction-review.ts) runs in
 * the background as soon as gates exist, so finish rarely waits on it.
 *
 * Latency is bounded: a soft deadline tells the agent to finish, a hard
 * deadline stops the loop and ships what passes the checks.
 */

import { ThinkingLevel, type Content, type FunctionCall, type Part } from '@google/genai';
import { create, all } from 'mathjs';
import { ai } from '../../geminiClient';
import { PRIMITIVE_REGISTRY } from '../registry';
import { authorInset } from '../orchestrator';
import { isAuthorableInsetType } from '../inset-helpers';
import { mergeAssignmentsIntoSteps } from '../challenger';
import { directPredictionDisclosure, reviewPredictions } from '../prediction-review';
import {
  buildAnnotatedExampleAuthoringContract,
  buildPinnedSolverGuidance,
  extractNumericAnchors,
  validateTextAgainstAuthoringContract,
  type AnnotatedExampleAuthoringContract,
} from '../authoring-contract';
import { AGENT_TOOLS, buildAgentSystemPrompt } from './agent-prompt';
import type { GeneratedStep, StepGeneratorContext } from '../generators/_shared';
import type {
  AgentDebugPayload,
  ChallengeAssignment,
  RichAnnotatedExampleData,
  RichExampleStep,
  StepSpec,
  StepType,
} from '../../../primitives/annotated-example/types';
import type { Inset } from '../../../types';
import { measureGeometry } from '../../../primitives/annotated-example/geometryFigure';

const MODEL = 'gemini-flash-latest';
const SOFT_DEADLINE_MS = Number(process.env.LUMINA_AE_AGENT_SOFT_MS ?? 50_000);
const HARD_DEADLINE_MS = Number(process.env.LUMINA_AE_AGENT_HARD_MS ?? 90_000);
const MAX_TURNS = 10;
// Both reviewers are single thinking-HIGH calls whose p50 is ~8 s and whose
// tail reached 80-145 s in the 2026-11-04 bench; bound them.
const REVIEW_TIMEOUT_MS = 30_000;
const GATE_REVIEW_TIMEOUT_MS = 25_000;
const THINKING: Record<string, ThinkingLevel> = { LOW: ThinkingLevel.LOW, HIGH: ThinkingLevel.HIGH };
const thinkingLevel = () => THINKING[(process.env.LUMINA_AE_AGENT_THINKING ?? 'HIGH').toUpperCase()] ?? ThinkingLevel.HIGH;

const math = create(all);

// ── State ────────────────────────────────────────────────────────────

interface AgentStep {
  uid: number;
  spec: StepSpec;
  workProse: string;
  step: RichExampleStep;
}

/** A gate is stored against its step's uid so it moves with the step. */
type StoredGate = { stepUid: number; assignment: ChallengeAssignment };

interface AgentState {
  topic: string;
  gradeContext: string;
  contract: AnnotatedExampleAuthoringContract;
  guidance?: string;
  problem?: { title: string; subject: string; statement: string; strategy: string; inset?: Inset };
  steps: AgentStep[];
  gates: StoredGate[];
  nextUid: number;
  review?: { signature: string; result: Promise<Awaited<ReturnType<typeof reviewPredictions>>> };
}

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : []);

// ── Tools ────────────────────────────────────────────────────────────

function compute(args: Args) {
  const results = strs(args.expressions).map((expression) => {
    try {
      return { expression, value: math.format(math.evaluate(expression), { precision: 12 }) };
    } catch (error) {
      return { expression, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const integrals = (Array.isArray(args.integrals) ? args.integrals : []).map((raw) => {
    const { expression, variable, from, to } = raw as { expression: string; variable: string; from: number; to: number };
    try {
      const f = math.compile(expression);
      const n = 2000;
      const h = (to - from) / n;
      let sum = 0;
      for (let i = 0; i <= n; i++) {
        const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
        sum += w * Number(f.evaluate({ [variable]: from + i * h }));
      }
      return { expression, from, to, value: Number(((sum * h) / 3).toPrecision(10)) };
    } catch (error) {
      return { expression, error: error instanceof Error ? error.message : String(error) };
    }
  });
  return { results, integrals };
}

async function setProblem(state: AgentState, args: Args) {
  const statement = str(args.statement);
  if (!statement) return { error: 'statement is required' };
  const insetType = str(args.insetType);
  let inset: Inset | undefined;
  let insetNote: string | undefined;
  if (insetType && isAuthorableInsetType(insetType)) {
    inset = await authorInset(insetType, state.topic, state.gradeContext, statement, str(args.insetBrief) || `Author the ${insetType} inset coherent with this problem statement.`);
    if (!inset) insetNote = `The ${insetType} inset failed to author; the problem has no inset. Call set_problem again to retry or continue without one.`;
  }
  state.problem = { title: str(args.title) || state.topic, subject: str(args.subject) || 'Mathematics', statement, strategy: str(args.strategy), inset };
  // Contract anchors are checked over the whole example (exampleChecks), not
  // the statement alone: a required total belongs in the last step, and
  // demanding it in the statement puts the answer in the problem.
  return {
    ok: true,
    inset: inset ? compact(inset, 1200) : null,
    ...(insetNote ? { note: insetNote } : {}),
  };
}

function stepContext(state: AgentState, args: Args, position: number): StepGeneratorContext {
  return {
    topic: state.topic,
    gradeContext: state.gradeContext,
    problemStatement: state.problem?.statement ?? state.topic,
    solutionStrategy: state.problem?.strategy ?? '',
    priorStepSummaries: state.steps.slice(0, position).map((s) => s.spec.title),
    pedagogicalGoal: str(args.pedagogicalGoal),
    seedNotes: str(args.seedNotes),
    groundingProse: str(args.workProse),
    authoringGuidance: state.guidance,
    reviewTimeoutMs: REVIEW_TIMEOUT_MS,
  };
}

async function renderStep(state: AgentState, args: Args, position: number): Promise<AgentStep | { error: string }> {
  if (!state.problem) return { error: 'call set_problem before rendering steps' };
  const stepType = str(args.stepType) as StepType;
  const workProse = str(args.workProse);
  if (!workProse) return { error: 'workProse is required' };
  const def = PRIMITIVE_REGISTRY[stepType];
  if (!def) return { error: `unknown stepType ${stepType}` };
  let generated: GeneratedStep;
  try {
    generated = await def.generate(stepContext(state, args, position));
  } catch (error) {
    return { error: `the ${stepType} renderer failed: ${error instanceof Error ? error.message : String(error)}. Rewrite the workProse or choose another stepType.` };
  }
  const spec: StepSpec = { stepType, title: str(args.title), pedagogicalGoal: str(args.pedagogicalGoal), groundingBlockIndices: [], seedNotes: str(args.seedNotes) };
  return {
    uid: state.nextUid++,
    spec,
    workProse,
    step: {
      id: 0,
      title: spec.title,
      content: generated.content,
      annotations: { ...generated.annotations, narrative: workProse },
      ...(generated.generationReview ? { generationReview: generated.generationReview } : {}),
    } as RichExampleStep,
  };
}

function stepView(s: AgentStep, index: number) {
  const measured = s.step.content.type === 'geometry' ? { measured: measureGeometry(s.step.content.figure) } : {};
  return { index, stepType: s.spec.stepType, title: s.spec.title, content: compact(s.step.content, 1500), checks: stepChecks(s.step), ...measured };
}

function toAssignment(args: Args, stepIndex: number): ChallengeAssignment {
  const answers = [str(args.answer), ...strs(args.synonyms)].filter(Boolean);
  const base = { stepIndex, prompt: str(args.prompt), acceptableAnswers: answers, distractors: strs(args.distractors), rationale: str(args.rationale) };
  if (str(args.kind) === 'transition') {
    return { ...base, kind: 'transition', transitionIndex: Number(args.transitionIndex ?? 0), hide: str(args.hide) === 'operation' ? 'operation' : 'to' };
  }
  const format = str(args.answerFormat);
  return { ...base, kind: 'step', ...(format === 'katex' || format === 'text' ? { answerFormat: format } : {}) };
}

function addChallenge(state: AgentState, args: Args) {
  const index = Number(args.stepIndex);
  const target = state.steps[index];
  if (!target) return { error: `no step at index ${index}` };
  const assignment = toAssignment(args, index);
  const trial = structuredClone(currentSteps(state));
  const { dropped } = mergeAssignmentsIntoSteps(trial, [assignment]);
  if (dropped.length) return { error: dropped[0].reason };
  if (directPredictionDisclosure(predictionInput(state), assignment)) {
    return { error: 'the answer is already visible to the student before this gate (problem, inset or an earlier step); gate a different move' };
  }
  state.gates = state.gates.filter((g) => g.stepUid !== target.uid);
  state.gates.push({ stepUid: target.uid, assignment });
  return { ok: true, note: 'An independent review of all gates runs in the background; finish reports its verdict.' };
}

// ── Assembly and checks ──────────────────────────────────────────────

function currentSteps(state: AgentState): RichExampleStep[] {
  return state.steps.map((s, i) => ({ ...structuredClone(s.step), id: i + 1 }));
}

function currentGates(state: AgentState): ChallengeAssignment[] {
  return state.gates.flatMap((g) => {
    const index = state.steps.findIndex((s) => s.uid === g.stepUid);
    return index < 0 ? [] : [{ ...g.assignment, stepIndex: index }];
  });
}

function predictionInput(state: AgentState) {
  return {
    problemStatement: state.problem?.statement ?? '',
    problemTitle: state.problem?.title,
    problemInset: state.problem?.inset,
    solutionStrategy: state.problem?.strategy ?? '',
    steps: currentSteps(state),
  };
}

const norm = (s: string) => s.replace(/\\htmlClass\{[^}]*\}\{([^{}]*)\}/g, '$1').replace(/[\s$]/g, '').toLowerCase();

function stepChecks(step: RichExampleStep): string[] {
  const issues: string[] = [];
  if (step.content.type === 'algebra') {
    if (step.content.transitions.length === 0) issues.push('algebra step has no transitions');
    step.content.transitions.forEach((t, i) => {
      if (norm(t.from.latex) === norm(t.to.latex)) issues.push(`transition ${i} is a no-op: "from" equals "to" (${t.to.latex})`);
    });
  }
  return issues;
}

function visibleText(state: AgentState, steps: RichExampleStep[]): string {
  return [state.problem?.statement, state.problem?.strategy, JSON.stringify(steps.map((s) => ({ content: s.content, narrative: s.annotations.narrative, challenge: s.challenge })))].filter(Boolean).join('\n');
}

function exampleChecks(state: AgentState): { blocking: string[]; advisory: string[] } {
  const blocking: string[] = [];
  const advisory: string[] = [];
  if (!state.problem) blocking.push('no problem set');
  if (state.steps.length === 0) blocking.push('no steps');
  else if (state.steps.length === 1) blocking.push('one step is not a worked solution; add the moves that reach the answer');
  const lastType = state.steps.at(-1)?.step.content.type;
  if (state.steps.length > 1 && (lastType === 'geometry' || lastType === 'diagram')) blocking.push('the example ends on a figure; add the step that computes and states the answer');
  state.steps.forEach((s, i) => stepChecks(s.step).forEach((issue) => blocking.push(`step ${i}: ${issue}`)));
  for (let i = 1; i < state.steps.length; i++) {
    if (JSON.stringify(state.steps[i].step.content) === JSON.stringify(state.steps[i - 1].step.content)) blocking.push(`step ${i} repeats step ${i - 1}`);
  }
  for (const v of validateTextAgainstAuthoringContract(visibleText(state, currentSteps(state)), state.contract)) {
    blocking.push(`contract ${v.code}: ${v.detail}`);
  }
  const last = state.steps.at(-1)?.step.content;
  const result = last?.type === 'algebra' ? last.result : '';
  if (result && norm(result).length >= 2 && state.problem && norm(state.problem.strategy).includes(norm(result))) {
    blocking.push(`the strategy line states the final result (${result}); rewrite it with set_problem`);
  }
  const finalNumber = extractNumericAnchors(state.steps.at(-1)?.workProse ?? '').at(-1);
  if (finalNumber !== undefined && state.problem && extractNumericAnchors(state.problem.statement).includes(finalNumber)) {
    advisory.push(`the last step's final number (${finalNumber}) also appears in the problem statement; if it is the answer, remove it from the statement`);
  }
  if (state.gates.length === 0 && state.steps.length > 1) advisory.push('no prediction gates yet');
  return { blocking, advisory };
}

function gateSignature(state: AgentState): string {
  return JSON.stringify([state.problem, currentSteps(state).map((s) => s.content), currentGates(state)]);
}

/** Start (or reuse) the background prediction review for the current gates. */
function ensureReview(state: AgentState) {
  const gates = currentGates(state);
  if (gates.length === 0) return undefined;
  const signature = gateSignature(state);
  if (state.review?.signature !== signature) {
    const input = predictionInput(state);
    state.review = { signature, result: reviewPredictions(input, gates, { timeoutMs: GATE_REVIEW_TIMEOUT_MS }) };
    state.review.result.catch(() => undefined);
  }
  return state.review;
}

function assemble(state: AgentState, safe: ChallengeAssignment[], dropped: Array<{ assignment: ChallengeAssignment; reason: string }>, agent: AgentDebugPayload): RichAnnotatedExampleData {
  const problem = state.problem!;
  const steps = currentSteps(state);
  const merge = mergeAssignmentsIntoSteps(steps, safe);
  const body = state.steps.map((s) => s.workProse).join('\n---\n');
  return {
    title: problem.title,
    subject: problem.subject,
    problem: { statement: problem.statement, ...(problem.inset ? { inset: problem.inset } : {}) },
    solutionStrategy: problem.strategy,
    steps,
    solverDebug: {
      problemEcho: problem.statement,
      body,
      separatorCount: Math.max(0, state.steps.length - 1),
      blocks: state.steps.map((s, index) => ({ index, prose: s.workProse })),
      planner: {
        specs: state.steps.map((s, i) => ({ ...s.spec, groundingBlockIndices: [i] })),
        unusedBlockIndices: [],
        injectedCount: 0,
        mergedCount: 0,
        fallback: false,
      },
      challenger: { assignments: merge.merged, dropped: [...dropped, ...merge.dropped], failed: false },
      agent,
    },
  };
}

function compact(value: unknown, max: number): string {
  const text = JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ── Loop ─────────────────────────────────────────────────────────────

export interface GenerateAnnotatedExampleAgenticInput {
  topic: string;
  gradeContext: string;
  intent?: string;
  canonicalGrade?: string;
}

export async function generateAnnotatedExampleAgentic(input: GenerateAnnotatedExampleAgenticInput): Promise<RichAnnotatedExampleData> {
  const started = Date.now();
  const contract = buildAnnotatedExampleAuthoringContract({ intent: input.intent, canonicalGrade: input.canonicalGrade });
  const state: AgentState = { topic: input.topic, gradeContext: input.gradeContext, contract, guidance: buildPinnedSolverGuidance(contract), steps: [], gates: [], nextUid: 1 };
  const debug: AgentDebugPayload = { turns: 0, seconds: 0, deadline: 'none', toolCalls: [] };
  const systemInstruction = buildAgentSystemPrompt({ topic: input.topic, gradeContext: input.gradeContext, contract, softDeadlineSeconds: Math.round(SOFT_DEADLINE_MS / 1000) });
  const contents: Content[] = [{ role: 'user', parts: [{ text: `Author the worked example now.${input.intent ? ` Lesson intent: ${input.intent}` : ''}` }] }];
  let finishAttempts = 0;
  let shipped: RichAnnotatedExampleData | undefined;

  const elapsed = () => Date.now() - started;
  const finalize = async (allowRevise: boolean): Promise<{ status: 'shipped' } | { status: 'revise'; blocking: string[]; gateIssues: string[] }> => {
    const { blocking } = exampleChecks(state);
    if (blocking.length) return { status: 'revise', blocking, gateIssues: [] };
    const review = ensureReview(state);
    const verdict = review ? await review.result.catch(() => ({ safe: [], dropped: currentGates(state).map((assignment) => ({ assignment, reason: 'review failed' })) })) : { safe: [], dropped: [] };
    if (allowRevise && verdict.dropped.length && elapsed() < SOFT_DEADLINE_MS) {
      return { status: 'revise', blocking: [], gateIssues: verdict.dropped.map((d) => `step ${d.assignment.stepIndex} gate rejected: ${d.reason}`) };
    }
    debug.seconds = +(elapsed() / 1000).toFixed(1);
    shipped = assemble(state, verdict.safe, verdict.dropped, debug);
    return { status: 'shipped' };
  };

  while (!shipped && debug.turns < MAX_TURNS && elapsed() < HARD_DEADLINE_MS) {
    debug.turns++;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction, thinkingConfig: { thinkingLevel: thinkingLevel() }, tools: [{ functionDeclarations: AGENT_TOOLS }] },
    });
    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) break;
    contents.push(modelContent);
    const calls: FunctionCall[] = response.functionCalls ?? [];
    if (calls.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Use the tools. Call finish when the example is complete.' }] });
      continue;
    }

    const results = new Map<number, unknown>();
    const timed = async (i: number, fn: () => unknown) => {
      const t = Date.now();
      try {
        const value = await fn();
        results.set(i, value);
        debug.toolCalls.push({ turn: debug.turns, name: calls[i].name ?? '?', ms: Date.now() - t, ok: !(value && typeof value === 'object' && 'error' in value), note: value && typeof value === 'object' && 'error' in value ? String((value as { error: unknown }).error).slice(0, 160) : undefined });
      } catch (error) {
        results.set(i, { error: error instanceof Error ? error.message : String(error) });
        debug.toolCalls.push({ turn: debug.turns, name: calls[i].name ?? '?', ms: Date.now() - t, ok: false, note: String(error).slice(0, 160) });
      }
    };
    const byName = (name: string) => calls.map((c, i) => ({ c, i })).filter((x) => x.c.name === name);

    // Fixed phase order inside a turn: problem first, then structure edits,
    // then renders in parallel, then gates, then finish.
    for (const { i, c } of byName('compute')) await timed(i, () => compute(c.args ?? {}));
    for (const { i, c } of byName('set_problem')) await timed(i, () => setProblem(state, c.args ?? {}));
    for (const { i, c } of byName('remove_step').sort((a, b) => Number(b.c.args?.index) - Number(a.c.args?.index))) {
      await timed(i, () => {
        const index = Number(c.args?.index);
        if (!state.steps[index]) return { error: `no step at index ${index}` };
        const [removed] = state.steps.splice(index, 1);
        state.gates = state.gates.filter((g) => g.stepUid !== removed.uid);
        return { ok: true, stepCount: state.steps.length };
      });
    }
    const renders = [...byName('replace_step'), ...byName('add_step')].sort((a, b) => a.i - b.i);
    const appendBase = state.steps.length;
    let appended = 0;
    const placed = renders.map(({ c, i }) => {
      const args = c.args ?? {};
      const position = c.name === 'replace_step' ? Number(args.index) : appendBase + appended++;
      return { c, i, args, position };
    });
    const rendered = await Promise.all(placed.map(async (p) => {
      let out: AgentStep | { error: string } = { error: 'not rendered' };
      await timed(p.i, async () => {
        if (p.c.name === 'replace_step' && !state.steps[p.position]) return (out = { error: `no step at index ${p.position}` });
        out = await renderStep(state, p.args, p.position);
        return 'error' in out ? out : { ok: true };
      });
      return { ...p, out: out as AgentStep | { error: string } };
    }));
    // Apply in call order so add_step slots keep the order the agent wrote them.
    const appendedSteps: AgentStep[] = [];
    for (const r of rendered) {
      if ('error' in r.out) continue;
      if (r.c.name === 'replace_step') {
        const old = state.steps[r.position];
        state.gates = state.gates.filter((g) => g.stepUid !== old.uid);
        state.steps[r.position] = r.out;
      } else appendedSteps.push(r.out);
    }
    state.steps.push(...appendedSteps);
    for (const r of rendered) {
      if (!('error' in r.out)) {
        const uid = (r.out as AgentStep).uid;
        const index = state.steps.findIndex((s) => s.uid === uid);
        results.set(r.i, { ok: true, step: stepView(state.steps[index], index) });
      }
    }
    for (const { i, c } of byName('add_challenge')) await timed(i, () => addChallenge(state, c.args ?? {}));
    ensureReview(state);

    const finishes = byName('finish');
    for (const { i } of finishes) {
      finishAttempts++;
      await timed(i, () => finalize(finishAttempts === 1));
    }

    const checks = exampleChecks(state);
    const remainingMs = SOFT_DEADLINE_MS - elapsed();
    if (remainingMs <= 0 && debug.deadline === 'none') debug.deadline = 'soft';
    const parts: Part[] = calls.map((c, i) => ({
      functionResponse: {
        id: c.id,
        name: c.name,
        response: { output: results.get(i) ?? { error: 'not executed' } },
      },
    }));
    if (!shipped) {
      parts.push({
        text: JSON.stringify({
          example: state.steps.map((s, i) => ({ index: i, stepType: s.spec.stepType, title: s.spec.title, gate: state.gates.some((g) => g.stepUid === s.uid) })),
          exampleChecks: checks,
          time: remainingMs > 0 ? `${Math.round(remainingMs / 1000)}s left` : 'Time is up. Fix only blocking issues, then call finish now.',
        }),
      });
    }
    contents.push({ role: 'user', parts });
  }

  if (!shipped) {
    debug.deadline = elapsed() >= HARD_DEADLINE_MS ? 'hard' : debug.deadline;
    const outcome = await finalize(false);
    if (outcome.status !== 'shipped') {
      throw new Error(`[AnnotatedExampleAgent] stopped after ${debug.turns} turns without a valid example: ${outcome.blocking.join('; ')}`);
    }
  }
  console.log('[AnnotatedExampleAgent] shipped', { turns: debug.turns, seconds: shipped!.solverDebug?.agent?.seconds, steps: shipped!.steps.length, gates: shipped!.solverDebug?.challenger?.assignments.length });
  return shipped!;
}
