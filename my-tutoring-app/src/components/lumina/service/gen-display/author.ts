/**
 * The create_display loop. A model writes a display as TSX against the kit and submits it with
 * its params and probes; code compiles it, runs it in headless Chromium, and returns the errors,
 * the probe results and screenshots, which the model sees and revises from. A second model that
 * did not write it judges the screenshots. Only a display that runs clean, passes every probe and
 * passes the judge is saved as a template.
 */
import { ThinkingLevel, Type, type Content, type FunctionDeclaration, type Part } from '@google/genai';
import { ai } from '../geminiClient';
import { compileDisplay } from './compile';
import { displayDocument } from './document';
import { runDisplay, type DisplayRun } from './harness';
import { SDK_REFERENCE } from './sdkSource';
import { saveTemplate } from './library';
import type { DisplayParam, DisplayProbe, DisplayTemplate } from './types';

const MODEL = process.env.LUMINA_GD_MODEL ?? 'gemini-flash-latest';
const MAX_TURNS = 6;
const MIN_PROBES = 2;

export interface DisplayAsk {
  /** The idea the display must show, one sentence. */
  idea: string;
  topic: string;
  gradeLevel: string;
  /** What the student should do with it, if the asker knows. */
  interaction?: string;
}

export interface AuthorLog {
  turns: number;
  seconds: number;
  attempts: Array<{ turn: number; stage: 'compile' | 'run' | 'probes' | 'judge' | 'passed'; notes: string[] }>;
}

const SUBMIT: FunctionDeclaration = {
  name: 'submit_display',
  description: 'Submit the display. Code compiles it, runs it in a browser, runs your probes, and returns errors, probe results and screenshots.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      idea: { type: Type.STRING, description: 'The idea it shows, one sentence, general enough to reuse on another lesson.' },
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-8 subject words and the grade band, e.g. "slope", "linear equations", "grades 7-9".' },
      source: { type: Type.STRING, description: 'TSX defining function Display({ params, lumina }). No imports.' },
      params: {
        type: Type.ARRAY, description: 'Every input the display reads. All numbers, words and cases come from params.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['number', 'string', 'boolean', 'number[]', 'string[]'] },
            description: { type: Type.STRING },
            defaultJson: { type: Type.STRING, description: 'The default value as JSON, e.g. 2 or "Mars" or [1,2,3].' },
          },
          required: ['name', 'type', 'description', 'defaultJson'],
        },
      },
      probes: {
        type: Type.ARRAY, description: `At least ${MIN_PROBES}. Each loads the display fresh, sets controls by label, then checks the page text. Cover the cases where the idea shows, including an edge case.`,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            set: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, valueJson: { type: Type.STRING } }, required: ['label', 'valueJson'] } },
            includes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Text that must be on the page afterwards (case-insensitive).' },
            excludes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Text that must not be on the page afterwards.' },
          },
          required: ['name', 'set', 'includes'],
        },
      },
    },
    required: ['title', 'idea', 'tags', 'source', 'params', 'probes'],
  },
};

function systemPrompt(ask: DisplayAsk): string {
  return `You build ONE interactive display for a ${ask.gradeLevel} on "${ask.topic}".
The idea it must show: ${ask.idea}${ask.interaction ? `\nWhat the student does with it: ${ask.interaction}` : ''}

A display is an ungraded explorable that sits in a lesson: the student moves something and sees the idea happen. It is not a quiz: no questions, no scoring, no right or wrong feedback on the student. The lesson asks the questions.

## How to write it
- TSX defining function Display({ params, lumina }). No imports or exports: React hooks (useState, useMemo, useEffect, useRef, useCallback) and the kit below are already in scope. Build with the kit; plain elements and SVG are fine for anything it lacks.
- Every number, word and case comes from params, so the display can be reused with other params. Nothing about this lesson is hard-coded in the source.
- Code computes every value shown; never write a result as a literal.
- Call lumina.scene({ ... }) in an effect whenever the state changes, with plain facts of what is on screen (the control values and what they produce).
- Short words for a ${ask.gradeLevel}. One clear control or two, a title, and a one-sentence caption that says what to try, never what will happen.
- Never show the conclusion as text before the student moves something.

## The kit
${SDK_REFERENCE}

## Probes
Your probes are how code checks the display works: each sets kit controls by their exact label and checks the page text. Write probes whose expected text follows from the maths or facts, including one edge case.

Submit with submit_display. Read the result and the screenshots, fix what is wrong, and submit again. A display passes when it runs with no errors, every probe passes, and a reviewer judges the screenshots.`;
}

const parseJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return s; } };

function readSubmission(args: Record<string, unknown>) {
  const params: Record<string, DisplayParam> = {};
  for (const p of (args.params as Array<Record<string, string>> | undefined) ?? []) {
    if (p?.name) params[p.name] = { type: p.type as DisplayParam['type'], description: p.description ?? '', default: parseJson(p.defaultJson ?? 'null') };
  }
  const probes: DisplayProbe[] = ((args.probes as Array<Record<string, unknown>> | undefined) ?? []).map((p) => ({
    name: String(p.name ?? 'probe'),
    set: Object.fromEntries(((p.set as Array<{ label: string; valueJson: string }>) ?? []).map((x) => [x.label, parseJson(x.valueJson)])),
    expect: { includes: (p.includes as string[]) ?? [], excludes: (p.excludes as string[]) ?? [] },
  }));
  return {
    title: String(args.title ?? ''), idea: String(args.idea ?? ''), tags: (args.tags as string[]) ?? [],
    source: String(args.source ?? ''), params, probes,
  };
}

const defaults = (params: Record<string, DisplayParam>) => Object.fromEntries(Object.entries(params).map(([k, p]) => [k, p.default]));

// ── Judge ────────────────────────────────────────────────────────────

interface Verdict { pass: boolean; showsIdea: boolean; looksCorrect: boolean; readable: boolean; notes: string }

async function judge(ask: DisplayAsk, run: DisplayRun): Promise<Verdict> {
  const images: Part[] = [run.screenshot, ...run.probes.slice(0, 3).map((p) => p.screenshot)]
    .map((data) => ({ inlineData: { mimeType: 'image/png', data } }));
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: [{ role: 'user', parts: [
      { text: `You review an interactive display for a ${ask.gradeLevel} on "${ask.topic}". It must show: ${ask.idea}
The first screenshot is the display at rest; the others are after these probes: ${run.probes.slice(0, 3).map((p) => `"${p.name}"`).join(', ')}.
Judge only what the screenshots show:
- showsIdea: moving the controls makes the idea visible.
- looksCorrect: graphs, numbers and labels agree with each other and with the facts (a line labelled y = 2x passes through (1, 2), a total adds up).
- readable: a ${ask.gradeLevel} can read it; nothing overlaps, is cut off or is too small.
pass is true only when all three hold. notes: what to fix, one or two sentences, or empty.` },
      ...images,
    ] }],
    config: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.OBJECT,
        properties: { showsIdea: { type: Type.BOOLEAN }, looksCorrect: { type: Type.BOOLEAN }, readable: { type: Type.BOOLEAN }, pass: { type: Type.BOOLEAN }, notes: { type: Type.STRING } },
        required: ['showsIdea', 'looksCorrect', 'readable', 'pass', 'notes'],
      },
    },
  });
  const v = JSON.parse(response.text ?? '{}') as Verdict;
  return { ...v, pass: !!(v.pass && v.showsIdea && v.looksCorrect && v.readable) };
}

// ── Loop ─────────────────────────────────────────────────────────────

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'display';

export async function authorDisplay(ask: DisplayAsk, opts: { save?: boolean } = {}): Promise<{ template?: DisplayTemplate; log: AuthorLog }> {
  const started = Date.now();
  const log: AuthorLog = { turns: 0, seconds: 0, attempts: [] };
  const note = (stage: AuthorLog['attempts'][number]['stage'], notes: string[]) => log.attempts.push({ turn: log.turns, stage, notes });
  const contents: Content[] = [{ role: 'user', parts: [{ text: 'Build the display now.' }] }];
  let template: DisplayTemplate | undefined;

  while (!template && log.turns < MAX_TURNS) {
    log.turns++;
    const response = await ai.models.generateContent({
      model: MODEL, contents,
      config: { systemInstruction: systemPrompt(ask), tools: [{ functionDeclarations: [SUBMIT] }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) break;
    contents.push(modelContent);
    const call = response.functionCalls?.find((c) => c.name === 'submit_display');
    if (!call) { contents.push({ role: 'user', parts: [{ text: 'Submit the display with submit_display.' }] }); continue; }

    const sub = readSubmission(call.args ?? {});
    const reply = (output: Record<string, unknown>, images: string[] = []): Content => ({
      role: 'user',
      parts: [
        { functionResponse: { id: call.id, name: call.name, response: { output } } },
        ...images.map((data): Part => ({ inlineData: { mimeType: 'image/png', data } })),
      ],
    });

    const problems: string[] = [];
    if (!Object.keys(sub.params).length) problems.push('declare the params the display reads; nothing about the lesson may be hard-coded');
    if (sub.probes.length < MIN_PROBES) problems.push(`write at least ${MIN_PROBES} probes`);
    const compiled = compileDisplay(sub.source);
    if (!compiled.ok) problems.push(...compiled.errors);
    if (problems.length || !compiled.ok) { note('compile', problems); contents.push(reply({ status: 'rejected', problems })); continue; }

    const run = await runDisplay(displayDocument(compiled.js, defaults(sub.params)), sub.probes);
    const failed = run.probes.filter((p) => !p.ok);
    const runProblems = [
      ...run.errors.map((e) => `runtime error: ${e.slice(0, 300)}`),
      ...(run.scene ? [] : ['lumina.scene was never called']),
      ...failed.map((p) => `probe "${p.name}" failed: ${p.detail}. Page text: ${p.text.replace(/\s+/g, ' ').slice(0, 300)}`),
    ];
    if (runProblems.length) {
      note(run.errors.length ? 'run' : 'probes', runProblems);
      contents.push(reply({ status: 'failed', problems: runProblems, textAtRest: run.text.replace(/\s+/g, ' ').slice(0, 400) }, [run.screenshot, ...failed.slice(0, 2).map((p) => p.screenshot)]));
      continue;
    }

    const verdict = await judge(ask, run);
    if (!verdict.pass) {
      note('judge', [verdict.notes]);
      contents.push(reply({ status: 'reviewer_rejected', verdict }, [run.screenshot]));
      continue;
    }
    note('passed', [verdict.notes].filter(Boolean));
    template = {
      id: `${slug(sub.title)}-${Date.now().toString(36)}`,
      title: sub.title, idea: sub.idea || ask.idea, tags: sub.tags, source: sub.source,
      params: sub.params, probes: sub.probes, createdAt: new Date().toISOString(), uses: 0,
    };
    if (opts.save !== false) saveTemplate(template);
  }
  log.seconds = +((Date.now() - started) / 1000).toFixed(1);
  return { template, log };
}
