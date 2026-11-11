/**
 * The canvas tester's route: author one agent canvas (streamed, one JSON object per line: `progress` for each kit step,
 * then `result` or `error`), list the saved canvases in qa/canvas with what the gallery shows of each, serve one
 * screenshot of a saved canvas (`?shot=<name>&problem=<n>&kind=rest|miss|proof`), and read one back as a lesson
 * (`?name=`). Authoring calls Gemini and needs Chromium on the host, so this is a development tool, not a lesson path.
 */
import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { authorCanvas } from '@/components/lumina/service/agent-kit/canvas/canvasAuthor';
import { withKitTrace } from '@/components/lumina/service/agent-kit/trace';
import { canvasLesson } from '@/components/lumina/service/core/agent-canvas/canvasLesson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIR = () => join(process.cwd(), 'qa', 'canvas');
const LIBRARY = () => join(process.cwd(), 'src', 'components', 'lumina', 'service', 'core', 'agent-canvas', 'library');
const NAME = /^[a-z0-9][a-z0-9-]{0,80}$/;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'canvas';

type ShotKind = 'rest' | 'miss' | 'proof';
const KINDS: ShotKind[] = ['rest', 'miss', 'proof'];
interface SavedPlay { version: number; steps: unknown[]; afterGoal: boolean | null; errors?: string[]; stepErrors?: string[]; kept?: string; png?: string }
interface SavedCanvas {
  title?: string; ask?: string; goal?: string;
  request?: { topic?: string; grade?: string; objective?: string };
  problems?: Array<{ ask?: string; goal?: string }>;
  agentDebug?: { spec?: string; costUsd?: number; seconds?: number; playLog?: SavedPlay[] };
}

/**
 * Where one screenshot of a saved canvas lives. A spec keeps three files per problem (written by `canvas-check`); an
 * authored run keeps its plays inside the JSON; the first three runs kept two files beside the JSON.
 */
function findShot(name: string, saved: SavedCanvas, problem: number, kind: ShotKind): { file: string } | { b64: string } | null {
  const specFile = join(DIR(), 'specs', name, 'plays', `${problem}-${kind}.png`);
  if (existsSync(specFile)) return { file: specFile };
  const plays = (saved.agentDebug?.playLog ?? []).filter(p => p.png);
  if (saved.problems?.length) {
    const play = plays.find(p => p.kept === `problem ${problem} ${kind}`);
    return play?.png ? { b64: play.png } : null;
  }
  if (problem !== 1) return null;
  const clean = plays.filter(p => !p.errors?.length && !p.stepErrors?.length);
  const last = Math.max(0, ...clean.map(p => p.version));
  const play = kind === 'rest' ? clean.filter(p => !p.steps.length).at(-1)
    : kind === 'proof' ? clean.filter(p => p.afterGoal === true).at(-1)
    : clean.filter(p => p.version === last && p.steps.length && p.afterGoal === false).at(-1);
  if (play?.png) return { b64: play.png };
  const legacy = join(DIR(), `${name}-${kind}.png`);
  return existsSync(legacy) ? { file: legacy } : null;
}

/** What the gallery shows of one saved canvas. Cached by the file's modified time: each file is 0.2-0.8 MB. */
const listed = new Map<string, { modified: number; entry: Record<string, unknown> }>();
function listEntry(name: string): Record<string, unknown> | null {
  const file = join(DIR(), `${name}.json`);
  try {
    const modified = statSync(file).mtimeMs;
    const hit = listed.get(name);
    if (hit?.modified === modified) return { ...hit.entry, library: existsSync(join(LIBRARY(), `${name}.json`)) };
    const d = JSON.parse(readFileSync(file, 'utf8')) as SavedCanvas;
    const problems = (d.problems?.length ? d.problems : [{ ask: d.ask, goal: d.goal }]).map((p, i) => ({
      ask: p.ask ?? d.ask ?? '', goal: p.goal ?? d.goal ?? '', shots: KINDS.filter(kind => findShot(name, d, i + 1, kind)),
    }));
    const entry = {
      name, title: d.title ?? name, topic: d.request?.topic ?? '', grade: d.request?.grade ?? '', objective: d.request?.objective ?? '',
      kind: d.problems?.length ? 'spec' : 'run', problems, modified,
      ...(typeof d.agentDebug?.costUsd === 'number' ? { costUsd: d.agentDebug.costUsd } : {}),
      ...(typeof d.agentDebug?.seconds === 'number' ? { seconds: d.agentDebug.seconds } : {}),
    };
    listed.set(name, { modified, entry });
    return { ...entry, library: existsSync(join(LIBRARY(), `${name}.json`)) };
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams;

  const shot = query.get('shot');
  if (shot) {
    const file = join(DIR(), `${shot}.json`);
    const kind = query.get('kind') as ShotKind;
    const problem = Number(query.get('problem') ?? 1);
    if (!NAME.test(shot) || !existsSync(file) || !KINDS.includes(kind) || !Number.isInteger(problem)) return NextResponse.json({ error: 'no such screenshot' }, { status: 404 });
    // A spec's screenshot is a file, so the 0.2-0.8 MB JSON is read only for a run that keeps its plays inside it.
    const specFile = join(DIR(), 'specs', shot, 'plays', `${problem}-${kind}.png`);
    const found = existsSync(specFile) ? { file: specFile } : findShot(shot, JSON.parse(readFileSync(file, 'utf8')) as SavedCanvas, problem, kind);
    if (!found) return NextResponse.json({ error: 'no such screenshot' }, { status: 404 });
    const bytes = 'file' in found ? readFileSync(found.file) : Buffer.from(found.b64, 'base64');
    // The gallery adds the file's modified time to the URL, so a re-checked spec gets fresh screenshots.
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400' } });
  }

  const name = query.get('name');
  if (name) {
    const file = join(DIR(), `${name}.json`);
    if (!NAME.test(name) || !existsSync(file)) return NextResponse.json({ error: 'no such saved canvas' }, { status: 404 });
    // The lesson is rebuilt from the saved source, so an older run plays in the current page shell.
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    try { return NextResponse.json({ ...saved, lesson: canvasLesson(saved, { grade: saved.request?.grade, rebuild: true }) }); }
    catch (e) { return NextResponse.json({ ...saved, lessonError: e instanceof Error ? e.message : String(e) }); }
  }

  const runs = !existsSync(DIR()) ? [] : readdirSync(DIR()).filter(f => f.endsWith('.json'))
    .map(f => listEntry(f.replace(/\.json$/, ''))).filter((r): r is Record<string, unknown> => !!r)
    .sort((a, b) => (b.modified as number) - (a.modified as number));
  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { topic?: string; grade?: string; objective?: string };
  const ask = { topic: String(body.topic ?? '').trim(), grade: String(body.grade ?? 'grade 4').trim(), ...(body.objective?.trim() ? { objective: body.objective.trim() } : {}) };
  if (!ask.topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // A closed tab must not stop or crash the run, so a failed send is ignored.
      const send = (event: Record<string, unknown>) => { try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { /* the reader left */ } };
      void withKitTrace(event => send({ type: 'progress', event }), () => authorCanvas(ask))
        .then((data) => {
          // The canvas ships as written: `ask` is the tutor's line, so the request rides beside it as `request`.
          const saved = { request: ask, ...data };
          let name: string | undefined;
          try {
            mkdirSync(DIR(), { recursive: true });
            name = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${slug(data.title)}`;
            writeFileSync(join(DIR(), `${name}.json`), JSON.stringify(saved, null, 2));
          } catch { name = undefined; }
          send({ type: 'result', result: { ...saved, savedAs: name, lesson: canvasLesson(data, { grade: ask.grade }) } });
        }, (error: unknown) => send({ type: 'error', error: error instanceof Error ? error.message : String(error) }))
        .finally(() => { try { controller.close(); } catch { /* already closed */ } });
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
