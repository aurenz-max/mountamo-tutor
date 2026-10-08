// @vitest-environment jsdom
/**
 * The dry journey (tier 0 of `/tutor-sweep`): every bound family's live-journey row
 * (`liveJourneySpec.ts`), driven over every saved payload (`testing/w1-payloads/`) with a scripted
 * observer in place of the Live model and JEV. Free, deterministic, and run on every family at once.
 *
 * It exists because the paid Live bench kept finding the same defect one primitive at a time: a
 * miss that shows the answer (math-fact-fluency, equation-builder, oral-sentence-studio, push-pull),
 * a credit that never moves on (comparison-builder, ramp-lab, the one-step advance), a journey row
 * that cannot drive its own content (LB-5, LB-10, the act_out "wrong" scene, the hands step). None of
 * those needed a model; each cost at least one Live session. Here each is a rule checked on all of
 * them. The tutor's wording and JEV's verdicts are NOT checked here: those are tier 1.
 *
 * The program mirrors `workspace_journey` in `run_live_runtime.py`, on every item rather than the
 * first: a wrong answer, the observer's retry, a correct answer, the observer's advance.
 *
 * Known findings live in `testing/journey-sweep-baseline.json`, each with the queue row that owns it.
 * The test fails on a finding NOT in the baseline (a regression, or a new family with a defect), and on
 * a baseline entry that no longer occurs (fixed: delete it). `JOURNEY_SWEEP_OUT=<file>` writes the
 * full result for the sweep report.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
// The real submission hook (J10, J11 read the record the backend would receive); only the store's write is the seam.
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).submittedEvaluationSeam());
vi.mock('@/components/lumina/evaluation/contexts/EvaluationContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationContextSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { LIVE_JOURNEYS, type DriverInput, type JourneyContext, type LearnerIntent } from '../liveJourneySpec';
import type { LivePrimitiveId } from '../activityContract';
import { installRuntimeTimers, recordingEvaluationContext, restoreRuntimeTimers, seam } from './testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from './testing/workspaceHarness';
import { UNIVERSAL_CATALOG, getComponentById } from '../../../service/manifest/catalog';
import { buildLiveActivitySpec } from '../liveActivitySpec';
import { helpBeforeLastWrong, lastMiss, nextLever } from './observerLever';
import { leverPulledMessage } from './runtimeTransport';
import { validSpokenMissRequest, type SpokenMissRequest } from './spokenMissContract';
import { pinAllowsMissFromWords } from '../pinnedModes';

/** The rules every bound family owes on the dry journey. Ids are stable: the baseline and the sweep report cite them. */
export const JOURNEY_INVARIANTS = {
  'J1-drivable': 'The journey row produces a wrong and a correct input for every item, and each one performs on screen',
  'J2-miss-committed': 'A complete wrong answer is committed as a miss: not credited, no advance, no completion',
  'J3-miss-reveals-nothing': 'A miss and its retry do not newly put the answer on screen, in the scene facts or in a host message',
  'J4-retry-reopens': 'After a miss the observer can reopen the same item for another try',
  'J5-credit-moves-on': 'A credited answer moves to the next item or completes the lesson: no dead end',
  'J6-completes-once': 'Answering every item completes the lesson, with at most one submission per evaluated instance',
  'J7-commit-visible': 'A committed verdict, retry or advance is confirmed on screen by the real visibility wait: a later render of the same item and phase does not supersede it',
  'J8-miss-named': "On a mode whose catalog entry lists misses, every checked miss names one from that list; a spoken item's known misses are all on the list and a wrong spoken answer records one",
  'J9-miss-answered': "On a mode with levers, every catalog miss is in some lever's answers or in the catalog's unanswered list",
  'J10-clean-record': 'A clean program (every item right first time) submits once, and the record says so: passed, score 100, every item first try, no assistance',
  'J11-recovery-record': 'The wrong-then-right program submits once, and the record says so: every item solved, each miss in teachingAttempts before its correct try, the score and first-response score set by the first-response gate',
} as const;
type Invariant = keyof typeof JOURNEY_INVARIANTS;

interface Payload { primitiveId: LivePrimitiveId; evalMode: string; data: Record<string, any> }
interface Finding { invariant: Invariant; detail: string }
interface Result { payload: string; items: number; skipped?: string; findings: Finding[]; advisories: string[];
  /**
   * Checked gesture misses on this payload, and how many named a miss (handoff 20 coverage). `spoken`: wrong spoken
   * answers, and how many had a known-miss list to name one from (handoff 20 Part B).
   */
  misses?: { checked: number; named: number; declared: boolean; spoken: { answered: number; named: number } };
  /** What each program's submission recorded (J10, J11), for the sweep report. */
  records?: Partial<Record<Program, { sent: number; success?: boolean; score?: number; firstResponseScore?: number; attempts?: number }>> }

const DIR = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing');
const PAYLOADS: Array<Payload & { file: string }> = readdirSync(join(DIR, 'w1-payloads')).filter(f => f.endsWith('.json')).sort()
  .map(f => ({ ...(JSON.parse(readFileSync(join(DIR, 'w1-payloads', f), 'utf-8')) as Payload), file: f.replace(/\.json$/, '') }));
const BASELINE_FILE = join(DIR, 'journey-sweep-baseline.json');
/** `{ "<payload file>": { "<invariant>": "<queue row>" } }` */
const BASELINE: Record<string, Record<string, string>> = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf-8')) : {};
const RESULTS: Result[] = [];
/** Per `<primitive>.<mode>`, every lever `answers` id seen on its payloads' items (J9). */
const ANSWERED = new Map<string, Set<string>>();
/** Per `<primitive>.<mode>`, every lever seen on its payloads' items, by id (the lever inventory). */
const LEVERS_SEEN = new Map<string, Map<string, { kind: string; answers: readonly string[] }>>();
const MAX_ITEMS = 24;
/**
 * Every `spoken_miss` request the runtime sent. The sweep has no model: its stand-in names the first listed miss
 * of a valid request, so what is checked is the wiring (the list reaches the observer, its ids are the catalog's,
 * a not-credited verdict records the named one), never which miss a transcript shows (`scripts/spoken-miss-probe.mjs`).
 */
const SPOKEN_MISS: SpokenMissRequest[] = [];
/** The payload each request came from, by index. */
const SPOKEN_MISS_FROM: string[] = [];
let driving = '';
function stubObservationRoutes() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).endsWith('/api/lumina/observe-spoken-miss')) return { ok: false, json: async () => ({}) };
    const body = JSON.parse(String(init?.body ?? '{}'));
    SPOKEN_MISS.push(body); SPOKEN_MISS_FROM.push(driving);
    const miss = validSpokenMissRequest(body) ? body.misses[0].id : null;
    return { ok: true, json: async () => ({ miss, reading: miss, p: miss ? 0.9 : null, accepted: !!miss, reason: miss ? 'named' : 'invalid', ms: 0 }) };
  }));
}
/** A finished learner turn, then the observation requests it started (resolved promises, not timers). */
async function hear(h: WorkspaceHarness, text: string) {
  h.say(text);
  await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); });
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** A number's digit and word forms ("4", "four"); any other phrase alone. */
const forms = (phrase: string) => {
  const n = NUMBER_WORDS.includes(phrase) ? NUMBER_WORDS.indexOf(phrase) : Number(phrase);
  return Number.isInteger(n) && NUMBER_WORDS[n] ? [String(n), NUMBER_WORDS[n]] : [phrase];
};

/**
 * The answer as phrases the screen could show: the published key, and what the correct input says or types.
 * Only the form given: a key of 2 is not looked for as "two", which prose uses ("the two sides aren't equal").
 */
function keyPhrases(expected: string | null | undefined, correct: DriverInput[], wrong: DriverInput[], root: HTMLElement): string[] {
  const phrases = new Set<string>();
  const add = (value: unknown) => {
    const text = String(value ?? '').trim().toLowerCase();
    if (text) phrases.add(text);
  };
  add(expected);
  // A gesture item publishes no key (the tutor must not have it), so the key is what the correct input names:
  // its words, its value, or the text of the element it taps (`option-8` is a button reading "8").
  const named = (a: DriverInput): string[] => {
    if (a.type === 'answer' || a.type === 'write') return [a.text];
    if (a.type === 'place') return [String(a.value)];
    if (a.type === 'choose') return [a.label];
    if (a.type === 'touch') {
      const el = a.target ? root.querySelector(`[data-pip-object="${a.target}"]`) : root.querySelectorAll('[data-pip-object^="object-"]')[a.index ?? 0];
      return [el?.textContent ?? '', el?.getAttribute('aria-label') ?? ''].filter(t => t.trim().length <= 40);
    }
    return [];
  };
  for (const a of correct) named(a).forEach(add);
  // Whatever the wrong input also says, picks or presses (Submit, One more, the apples it counts) is not the key.
  const own = new Set(wrong.flatMap(named).map(t => t.trim().toLowerCase()));
  return Array.from(phrases).filter(p => !own.has(p) && !/^check$/.test(p));
}

const phraseRegex = (phrase: string) => new RegExp(`(?<![a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'g');
const occurrences = (text: string, phrase: string) => (text.toLowerCase().match(phraseRegex(phrase)) ?? []).length;
/** The text around the last occurrence, for the report: a finding has to be triaged without re-running it. */
const around = (text: string, phrase: string) => {
  const at = Array.from(text.toLowerCase().matchAll(phraseRegex(phrase))).at(-1)?.index ?? 0;
  return text.slice(Math.max(0, at - 60), at + phrase.length + 60).replace(/\s+/g, ' ').trim();
};

/** Visible text, one text node per word boundary (textContent runs "4" and "5" together into "45"). */
function screenText(h: WorkspaceHarness): string {
  const walker = document.createTreeWalker(h.view.container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ');
}

const sentText = (from: number) => seam.send.mock.calls.slice(from).map(c => typeof c[0] === 'string' ? c[0] : '').join(' ');

/** The driver's learner vocabulary (`scripts/primitive-runtime-driver.mjs`), in jsdom. Returns the spoken text, if any. */
function perform(h: WorkspaceHarness, inputs: DriverInput[]): string | null {
  let spoken: string | null = null;
  let strokes: Array<{ canvas: HTMLCanvasElement; stroke: { x: number; y: number }[] }> = [];
  const root = h.view.container;
  const buttons = () => Array.from(root.querySelectorAll('button'));
  for (const a of inputs) {
    if (a.type === 'answer') { spoken = a.text; continue; }
    act(() => {
      if (a.type === 'place') {
        const svg = root.querySelector('svg[viewBox="0 0 760 240"]');
        const view = h.controls()?.getState();
        if (!svg || !view) throw new Error('place: no placement surface or controls');
        fireEvent.click(svg, { clientX: 60 + ((a.value - view.visibleMin) / (view.visibleMax - view.visibleMin)) * 640 });
      } else if (a.type === 'check' || a.type === 'give') {
        const pattern = a.type === 'check' ? /check/i : /give them to me/i;
        const button = buttons().find(b => pattern.test(b.textContent ?? ''));
        if (!button || button.disabled) throw new Error(`${a.type}: no enabled button`);
        fireEvent.click(button);
      } else if (a.type === 'choose') {
        const button = buttons().find(b => (b.textContent ?? '').trim() === a.label || b.getAttribute('aria-label') === a.label);
        if (!button || button.disabled) throw new Error(`choose: no enabled button "${a.label}"; buttons: ${buttons()
          .map(b => `"${(b.textContent ?? '').trim() || b.getAttribute('aria-label')}"${b.disabled ? ' (disabled)' : ''}`).join(', ')}`);
        fireEvent.click(button);
      } else if (a.type === 'touch') {
        const target = a.target ? root.querySelector(`[data-pip-object="${a.target}"]`)
          : root.querySelectorAll('[data-pip-object^="object-"]')[a.index ?? 0];
        if (!target) throw new Error(`touch: no object ${a.target ?? a.index}`);
        fireEvent.click(target);
      } else if (a.type === 'write') {
        const input = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')).find(i => i.getAttribute('aria-label') === a.label);
        if (!input || input.disabled) throw new Error(`write: no enabled input "${a.label}"`);
        fireEvent.change(input, { target: { value: a.text } });
      } else if (a.type === 'draw') {
        const canvas = (root.querySelector('canvas[data-pip-object="canvas"]') ?? root.querySelector('canvas')) as HTMLCanvasElement | null;
        if (!canvas) throw new Error('draw: no canvas');
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height,
          right: canvas.width, bottom: canvas.height, x: 0, y: 0, toJSON: () => ({}) });
        strokes = a.strokes.map(stroke => ({ canvas, stroke }));
      }
    });
    // One act per pointer event: a move renders before the next one, as the driver yields a task per move.
    for (const { canvas, stroke } of strokes) {
      act(() => { fireEvent.mouseDown(canvas, { clientX: stroke[0].x, clientY: stroke[0].y }); });
      for (const p of stroke.slice(1)) act(() => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
      act(() => { fireEvent.mouseUp(canvas); });
    }
    strokes = [];
  }
  return spoken;
}

/**
 * J10 / J11: the records the backend receives, read against what the program did. Most families send one; a family
 * that records per problem (knowledge-check, R7/R8) sends one per `::pN` instance, each with its own items' attempts.
 * `missed`: each item the recover program committed a miss on, with the miss the workspace named then (null when unnamed).
 */
function checkRecord(program: Program, items: readonly string[], missed: ReadonlyMap<string, string | null>, sent: any[],
  find: (invariant: Invariant, detail: string) => void) {
  const invariant: Invariant = program === 'clean' ? 'J10-clean-record' : 'J11-recovery-record';
  if (!sent.length) { find(invariant, 'the lesson completed but nothing was submitted'); return; }
  const many = sent.length > 1;
  const name = (r: any) => many ? `${r.instanceId}: ` : '';
  const all: any[] = [];
  for (const record of sent) {
    const attempts: any[] | undefined = record.studentWork?.teachingAttempts;
    if (record.success !== true) find(invariant, `${name(record)}every item was solved, but the record says success ${record.success}`);
    if (!Array.isArray(attempts)) { find(invariant, `${name(record)}the record carries no teachingAttempts`); continue; }
    all.push(...attempts);
    // The items this record covers: all of them, or, per problem, the ones its attempts name.
    const own = many ? items.filter(item => attempts.some(a => a?.itemId === item)) : items;
    if (!own.length) continue;
    // The first-response gate (`itemScoringContract.scoreSession`): 100 first try, 67 after one miss.
    const score = Math.round(own.reduce((sum, item) => sum + (missed.has(item) ? 67 : 100), 0) / own.length);
    if (record.score !== score) find(invariant, `${name(record)}score ${record.score}, not ${score} (${own.filter(i => missed.has(i)).length}/${own.length} items missed once)`);
  }
  // The first-response score is the session's: on every record that carries evidence, and on the one record of a single send.
  const firstTry = Math.round((items.length - missed.size) / items.length * 100);
  for (const record of sent) {
    const firstResponse = record.diagnosisEvidence?.firstResponseScore;
    if ((firstResponse !== undefined || !many) && firstResponse !== firstTry) find(invariant, `${name(record)}firstResponseScore ${firstResponse}, not ${firstTry}`);
  }
  if (sent.some(r => !Array.isArray(r.studentWork?.teachingAttempts))) return;
  const mine = (item: string) => all.filter(a => a?.itemId === item);
  if (program === 'clean') {
    const late = items.filter(item => mine(item)[0]?.correct !== true);
    if (late.length) find(invariant, `${items.length - late.length}/${items.length} items first try; not: ${late.slice(0, 4).join(', ')}`);
    const helped = all.filter(a => a?.assisted || a?.levers?.length || (a?.answerExposure ?? 'none') !== 'none');
    if (helped.length) find(invariant, `${helped.length} attempts record assistance on an unassisted run (${helped[0].itemId})`);
    return;
  }
  for (const [item, miss] of Array.from(missed)) {
    const own = mine(item), solvedAt = own.findIndex(a => a?.correct);
    if (solvedAt < 0) { find(invariant, `${item}: solved after a miss, but recorded unsolved (${own.length} attempts)`); continue; }
    if (solvedAt === 0) { find(invariant, `${item}: solved after a miss, but recorded first try`); continue; }
    if (miss && !own.slice(0, solvedAt).some(a => a.miss === miss)) find(invariant, `${item}: the miss "${miss}" is not on its wrong attempt in teachingAttempts`);
  }
}

/** `recover`: a wrong answer, the retry, then the correct one, on every item. `clean`: the correct answer first, on every item. */
type Program = 'recover' | 'clean';

async function drive({ primitiveId, evalMode, data, file }: Payload & { file: string }, program: Program = 'recover'): Promise<Result> {
  const result: Result = { payload: file, items: 0, findings: [], advisories: [] };
  driving = file;
  const find = (invariant: Invariant, detail: string) => result.findings.push({ invariant, detail });
  const row = LIVE_JOURNEYS[primitiveId];
  const workspaceEntry = getComponentById(primitiveId)?.teachingWorkspace;
  const declared = workspaceEntry?.misses?.[evalMode];
  // A blended or mixed pin is no catalog mode: its spoken misses are checked against every mode's list.
  const anyModeDeclared = Object.values(workspaceEntry?.misses ?? {}).flat();
  const spokenDeclared = getComponentById(primitiveId)?.evalModes?.some(m => m.evalMode === evalMode) ? declared : anyModeDeclared;
  const tally = { checked: 0, named: 0, declared: !!declared, spoken: { answered: 0, named: 0 } };
  const modeKey = `${primitiveId}.${evalMode}`;
  const noteLevers = () => {
    const levers = h.state().task?.workspace?.levers;
    if (!levers?.length) return;
    if (!ANSWERED.has(modeKey)) ANSWERED.set(modeKey, new Set());
    levers.forEach(l => l.answers?.forEach(m => ANSWERED.get(modeKey)!.add(m)));
    if (!LEVERS_SEEN.has(modeKey)) LEVERS_SEEN.set(modeKey, new Map());
    // A lever's answers can differ by item (a two-jump item adds one), so every sighting adds to it.
    levers.forEach(l => { const had = LEVERS_SEEN.get(modeKey)!.get(l.id)?.answers ?? [];
      LEVERS_SEEN.get(modeKey)!.set(l.id, { kind: l.kind, answers: Array.from(new Set([...had, ...(l.answers ?? [])])) }); });
  };
  result.misses = tally;
  if (!row) return { ...result, skipped: 'no journey row' };
  if (row.execution === 'teaching') return { ...result, skipped: 'ungraded teaching surface (explore/finish program)' };
  seam.evaluationContext = recordingEvaluationContext();
  const submittedFrom = seam.submit.mock.calls.length;
  const itemsSeen: string[] = [];
  const missed = new Map<string, string | null>();
  const h = mountWorkspace({ primitiveId, evalMode, data });
  h.settle();
  const context = (): JourneyContext => {
    const task = h.state().task!;
    return { data: { ...data, instanceId: 'ws' }, challenge: (data.challenges ?? []).find((c: { id: string }) => c.id === task.itemId) ?? null,
      diItems: [], itemId: task.itemId, demand: task.demand ?? null, expectedAnswer: task.workspace?.expectedAnswer ?? null };
  };
  const inputs = (intent: LearnerIntent, item: string): DriverInput[] | null => {
    try { return row.inputsFor(intent, context()); } catch (e) { find('J1-drivable', `${item} ${intent}: ${(e as Error).message}`); return null; }
  };
  /**
   * The transport's receipt path (`waitForVisible`), not a direct `confirmVisibleResponse`: a scene republish after
   * the commit used to supersede the receipt, and the lesson stalled with no tool result and no completion.
   * A failed wait is recorded, then released by hand so the other rules still run.
   */
  const commitVisible = async (receipt: ReturnType<WorkspaceHarness['dispatch']>, what: string) => {
    const status = await h.visible(receipt);
    if (receipt.status === 'committed' && status !== 'visible') {
      find('J7-commit-visible', `${what}: the visibility wait ended "${status}"`);
      h.confirmVisible();
    }
    h.settle();
  };
  /**
   * Performs a learner answer and, for speech, has the scripted observer commit `verdict`. `exploration`: a
   * gesture move the primitive treats as unfinished, then a spoken claim, committed nothing (balance-scale's
   * hands steps; `workspace_journey` records it as guidance without a verdict). Null when it could not perform.
   */
  const answer = async (list: DriverInput[], item: string, intent: string, verdict: 'correct' | 'incorrect',
    moved = list.some(a => a.type !== 'answer')): Promise<'spoken' | 'gesture' | 'exploration' | null> => {
    let spoken: string | null;
    const attempts = h.state().task?.evidence.attemptNumber;
    try { spoken = perform(h, list); } catch (e) { find('J1-drivable', `${item} ${intent}: ${(e as Error).message}`); return null; }
    // A stimulus the gesture started (a quick look's flash) finishes before the learner answers.
    h.settle();
    // The gesture itself was checked (balance-scale's weights), so the spoken claim after it is talk, not the answer.
    if (spoken === null || h.state().task?.evidence.attemptNumber !== attempts) return 'gesture';
    await hear(h, spoken);
    if (!h.state().task?.workspace?.pendingResponse) {
      // A gesture item (no spoken key published) hears speech as talk, never as the answer.
      const gestureItem = h.state().task?.workspace?.expectedAnswer === undefined;
      if ((moved || gestureItem) && h.state().task?.evidence.attemptNumber === attempts) return 'exploration';
      find(verdict === 'correct' ? 'J5-credit-moves-on' : 'J2-miss-committed', `${item} ${intent}: the spoken answer "${spoken}" opened no pending response (phase ${h.state().task?.phase}, `
        + `attempts ${attempts} -> ${h.state().task?.evidence.attemptNumber}, facts ${JSON.stringify(h.state().task?.demand ?? {}).slice(0, 300)})`);
      return null;
    }
    await commitVisible(h.feedback(verdict, verdict === 'correct' ? 'advance' : 'retry'), `${item} ${intent} verdict`);
    return 'spoken';
  };

  for (let n = 0; n < MAX_ITEMS && h.state().status === 'active' && h.state().task; n++) {
    const item = h.state().task!.itemId;
    result.items++; itemsSeen.push(item);
    noteLevers();
    const expected = h.state().task!.workspace?.expectedAnswer;
    const warmup = inputs('warmup', item);
    if (warmup?.length) try { perform(h, warmup); h.settle(); } catch (e) { find('J1-drivable', `${item} warmup: ${(e as Error).message}`); break; }
    // The clean program never answers wrong, so a family with no wrong input still gets its record checked.
    const wrong = program === 'clean' ? [] : inputs('wrong', item), correct = inputs('correct', item);
    if (!wrong || !correct) break;
    if (!correct.length) { find('J1-drivable', `${item}: the row has no correct input`); break; }
    // A key the ask itself states ("Give me four bears") is the assignment, not a secret.
    const ask = h.state().task!.task;
    const keys = keyPhrases(expected, correct, wrong, h.view.container).filter(k => !forms(k).some(f => occurrences(ask, f)));
    const inFacts = keys.filter(k => k.length > 1 && !/^(yes|no|true|false)$/.test(k) && occurrences(JSON.stringify(h.state().task!.demand ?? {}), k));
    if (expected && inFacts.length)
      result.advisories.push(`${item}: the scene facts contain the key "${inFacts[0]}" before any try (fine only when it is the stimulus, e.g. a word to read)`);

    if (wrong.length && program === 'recover') {
      // The learner's own work before the committing action (counted apples, the hop drawn before Check) is on
      // screen before any verdict, so it belongs to the baseline: only what the MISS adds is checked.
      const commitAt = wrong.some(a => a.type === 'answer') ? wrong.findIndex(a => a.type === 'answer') : wrong.length - 1;
      try { perform(h, wrong.slice(0, commitAt)); } catch (e) { find('J1-drivable', `${item} wrong: ${(e as Error).message}`); break; }
      const before = { screen: screenText(h), facts: JSON.stringify(h.state().task!.demand ?? {}), sends: seam.send.mock.calls.length };
      const heardBefore = SPOKEN_MISS.length;
      const how = await answer(wrong.slice(commitAt), item, 'wrong', 'incorrect', wrong.some(a => a.type !== 'answer'));
      if (!how) break;
      const s = h.state();
      if (how === 'spoken' || how === 'gesture' && s.task?.itemId === item && s.task.evidence.correctness === 'incorrect')
        missed.set(item, s.task?.workspace?.attempts.at(-1)?.miss ?? null);
      if (how === 'spoken') {
        const request = SPOKEN_MISS.slice(heardBefore).at(-1), miss = s.task?.workspace?.attempts.at(-1)?.miss;
        tally.spoken.answered++;
        if (request) {
          tally.spoken.named++;
          const ids = Array.isArray(request.misses) ? request.misses.map(m => m?.id) : [];
          const unlisted = ids.filter(id => !spokenDeclared?.includes(id));
          if (!validSpokenMissRequest(request)) find('J8-miss-named', `${item}: the spoken_miss request is invalid (misses ${JSON.stringify(ids)})`);
          else if (unlisted.length) find('J8-miss-named', `${item}: known spoken misses ${unlisted.map(m => `"${m}"`).join(', ')} are not in the catalog's list for ${evalMode}`);
          else if (miss !== ids[0]) find('J8-miss-named', `${item}: the not-credited spoken answer recorded ${miss ? `"${miss}"` : 'no miss'}, not the named "${ids[0]}"`);
        }
      }
      if (how === 'exploration') result.advisories.push(`${item}: the wrong input is exploration (no verdict), so the miss checks did not run`);
      if (s.status === 'completed' || s.task?.itemId !== item) { find('J2-miss-committed', `${item}: a wrong answer moved the lesson on`); break; }
      if (how === 'gesture') {
        const correctness = s.task!.evidence.correctness;
        if (correctness !== 'incorrect') {
          find('J2-miss-committed', `${item}: a wrong ${wrong.map(a => a.type).join('+')} left correctness "${correctness}"`);
          if (correctness === 'correct') break;
        }
      }
      // Item ids carry digits ("show_jump-2"); they are not the answer.
      // JSON booleans in a host message (`"correct":false`) are not a true/false answer either.
      const clean = (text: string) => text.split(item).join(' ').replace(/":\s*(true|false)/g, '":');
      const reveal = (where: string, was: string, now: string) => keys.filter(k => occurrences(clean(now), k) > occurrences(clean(was), k))
        .forEach(k => find('J3-miss-reveals-nothing', `${item}: "${k}" newly appears in ${where}: …${around(clean(now), k)}…`));
      reveal('the host message', '', sentText(before.sends));
      if (how === 'gesture' && s.task!.evidence.correctness === 'incorrect') {
        reveal('the screen after the miss', before.screen, screenText(h));
        reveal('the scene facts after the miss', before.facts, JSON.stringify(s.task!.demand ?? {}));
        noteLevers();
        const miss = s.task!.workspace?.attempts.at(-1)?.miss;
        tally.checked++; if (miss) tally.named++;
        if (declared && (!miss || !declared.includes(miss)))
          find('J8-miss-named', `${item}: the checked miss named ${miss ? `"${miss}", not in the catalog's list` : 'nothing'} (${wrong.map(a => a.type).join('+')})`);
        if (!h.offer('retry')) { find('J4-retry-reopens', `${item}: no retry is offered after a checked miss`); break; }
        await commitVisible(h.dispatch('retry'), `${item} retry`);
      }
      if (how !== 'exploration') reveal('the screen after the retry', before.screen, screenText(h));
      // Correctness keeps the last verdict; the phase says whether the item is open again (`workspace_journey` reads the same).
      if (how !== 'exploration' && (h.state().task?.itemId !== item || h.state().task?.phase !== 'working'))
        find('J4-retry-reopens', `${item}: after the retry the item is ${h.state().task?.itemId} in phase ${h.state().task?.phase}`);
    }

    const again = inputs('correct', item);
    if (!again) break;
    const how = await answer(again, item, 'correct', 'correct');
    if (!how) break;
    if (how === 'gesture' && h.state().task?.itemId === item) {
      const correctness = h.state().task!.evidence.correctness;
      if (correctness !== 'correct') { find('J5-credit-moves-on', `${item}: the correct ${again.map(a => a.type).join('+')} was checked "${correctness}"`); break; }
      if (!h.offer('advance')) { find('J5-credit-moves-on', `${item}: no advance is offered after a checked success`); break; }
      await commitVisible(h.dispatch('advance'), `${item} advance`);
    }
    const after = h.state();
    if (after.status === 'active' && after.task?.itemId === item) { find('J5-credit-moves-on', `${item}: credited, but the lesson stayed on the item`); break; }
  }
  // Checked on the mode's last payload, over all of them: a lever for one item shape (two jumps) is on some items only.
  const answeredSet = ANSWERED.get(modeKey);
  const lastOfMode = PAYLOADS.filter(p => `${p.primitiveId}.${p.evalMode}` === modeKey).at(-1)?.file === file;
  if (answeredSet && declared && lastOfMode) {
    const unanswered = workspaceEntry?.unanswered?.[evalMode] ?? [];
    const open = declared.filter(m => !answeredSet.has(m) && !unanswered.includes(m));
    if (open.length) find('J9-miss-answered', `no lever answers ${open.map(m => `"${m}"`).join(', ')}, and the catalog does not list ${open.length > 1 ? 'them' : 'it'} as unanswered`);
  }
  // The scoring pass and the submission it releases resolve in promises.
  await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); });
  h.settle();
  await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); });
  const end = h.state();
  const sent = seam.submit.mock.calls.slice(submittedFrom).map(c => c[0]);
  if (!result.findings.length && end.status !== 'completed') find('J6-completes-once', `after ${result.items} items the lesson is ${end.status}`);
  // One per instance: a family that records per problem sends one per `::pN`.
  const instances = sent.map(r => r?.instanceId);
  const twice = instances.filter((id, i) => instances.indexOf(id) !== i);
  if (twice.length) find('J6-completes-once', `${sent.length} submissions (${twice.length} repeat an instance: ${twice[0]})`);
  if (end.status === 'completed') checkRecord(program, itemsSeen, missed, sent, find);
  const record = sent[0];
  result.records = { [program]: { sent: sent.length, success: record?.success, score: record?.score,
    firstResponseScore: record?.diagnosisEvidence?.firstResponseScore, attempts: record?.studentWork?.teachingAttempts?.length } };
  h.close();
  return result;
}

/**
 * Tutor replay moments (handoff 20 Part C). With `TUTOR_REPLAY_OUT=<file>`, each payload's first item is driven once
 * more and every point where the Live tutor would take a turn is saved: lesson start, the miss, "I'm stuck", the lever
 * the observer pulls, and the credit. Each moment carries the packet and host text the tutor would get, and the key
 * phrases a reply must not say before a try. `backend/tests/tutor_live/tutor_replay.py` sends them to a Gemini text
 * model with the Live session's real instructions and scores the replies in code.
 */
const LESSON_ENTRY = '[LESSON_START] The current lesson workspace is mounted. Call observe_runtime for its task and ongoing state updates, then teach naturally.';
const STUCK = "I'm stuck. I don't know how to do this one.";
type MomentKind = 'start' | 'miss' | 'stuck' | 'lever' | 'credit';
interface Moment { kind: MomentKind; itemId: string; packet: unknown; host: string[]; learner?: string; miss?: string;
  lever?: { id: string; kind: string; does: string }; spoken: boolean;
  /** The observer's request for this exchange without the tutor's reply (spoken answers only). */
  dialogue?: Record<string, unknown>;
  /** The runtime's `spoken_miss` request for this answer, and whether the mode records a miss from the words (RP-2). */
  spokenMiss?: SpokenMissRequest; missFromWords?: boolean }
interface MomentRecord { payload: string; primitiveId: string; evalMode: string; guidance: string; topic: string;
  gradeLevel: string | null; leakTokens: string[]; ask: string; keys: string[]; moments: Moment[]; stopped?: string }
const MOMENTS: MomentRecord[] = [];

async function recordMoments({ primitiveId, evalMode, data, file }: Payload & { file: string }): Promise<MomentRecord | null> {
  const row = LIVE_JOURNEYS[primitiveId];
  if (!row || row.execution === 'teaching') return null;
  seam.evaluationContext = { lesson: 'replay' };
  const h = mountWorkspace({ primitiveId, evalMode, data });
  h.settle();
  const task = () => h.state().task!;
  const record: MomentRecord = { payload: file, primitiveId, evalMode,
    guidance: buildLiveActivitySpec([primitiveId]).activities[0].guidance, topic: row.defaults.topic,
    gradeLevel: (data.gradeLevel as string) ?? row.defaults.grade, leakTokens: row.leakTokens, ask: task().task, keys: [], moments: [] };
  const context = (): JourneyContext => ({ data: { ...data, instanceId: 'ws' },
    challenge: (data.challenges ?? []).find((c: { id: string }) => c.id === task().itemId) ?? null,
    diItems: [], itemId: task().itemId, demand: task().demand ?? null, expectedAnswer: task().workspace?.expectedAnswer ?? null });
  const mark = () => ({ sends: seam.send.mock.calls.length, sent: h.sent.length });
  const hostSince = (m: ReturnType<typeof mark>) => [
    ...seam.send.mock.calls.slice(m.sends).map(c => c[0]).filter((c): c is string => typeof c === 'string'),
    ...h.sent.slice(m.sent).filter(s => s.type === 'text').map(s => String(s.content))];
  const dialogue = (learner: string) => {
    const s = h.state(), w = s.task!.workspace!;
    return { scope: { sessionEpoch: s.sessionEpoch, instanceId: s.instanceId, itemId: s.task!.itemId, revision: s.revision },
      task: s.task!.task, phase: s.task!.phase, learner,
      ...(w.expectedAnswer !== undefined ? { expectedAnswer: w.expectedAnswer } : {}),
      ...(w.pendingResponse ? { pendingResponse: w.pendingResponse } : {}), lastResponse: w.lastResponse,
      activity: { responseSource: s.task!.evidence.recentResponses.at(-1)?.source ?? null, attemptNumber: s.task!.evidence.attemptNumber,
        objects: w.objects, demonstration: w.demonstration, facts: s.task!.demand,
        assistance: { level: s.task!.support.level, answerExposure: s.task!.support.answerExposure } } };
  };
  const moment = (kind: MomentKind, extra: Partial<Moment> & { host?: string[] } = {}) =>
    record.moments.push({ kind, itemId: task().itemId, packet: h.packet(), host: [], spoken: false, ...extra });
  /** Performs an answer. Spoken: the learner's words open a pending response, recorded before the observer commits. */
  const answer = (inputs: DriverInput[], kind: 'miss' | 'credit') => {
    const commitAt = inputs.some(a => a.type === 'answer') ? inputs.findIndex(a => a.type === 'answer') : inputs.length - 1;
    perform(h, inputs.slice(0, commitAt));
    const at = mark(), attempts = task().evidence.attemptNumber, heard = SPOKEN_MISS.length;
    const spoken = perform(h, inputs.slice(commitAt));
    h.settle();
    if (spoken !== null && task().evidence.attemptNumber === attempts) {
      h.say(spoken);
      if (!task().workspace?.pendingResponse) { record.stopped = `${kind}: the spoken answer opened no pending response`; return false; }
      const request = SPOKEN_MISS.slice(heard).at(-1);
      moment(kind, { learner: spoken, spoken: true, host: hostSince(at), dialogue: dialogue(spoken),
        ...(request ? { spokenMiss: request, missFromWords: pinAllowsMissFromWords(primitiveId, evalMode) } : {}) });
      h.feedback(kind === 'credit' ? 'correct' : 'incorrect', kind === 'credit' ? 'advance' : 'retry');
      h.confirmVisible(); h.settle();
      return true;
    }
    if (task().evidence.attemptNumber === attempts) { record.stopped = `${kind}: the input was not checked`; return false; }
    moment(kind, { host: hostSince(at), miss: kind === 'miss' ? task().workspace?.attempts.at(-1)?.miss : undefined });
    return true;
  };
  try {
    const item = task().itemId;
    moment('start', { host: [LESSON_ENTRY] });
    const warmup = row.inputsFor('warmup', context());
    if (warmup.length) { perform(h, warmup); h.settle(); }
    const wrong = row.inputsFor('wrong', context()), correct = row.inputsFor('correct', context());
    record.keys = keyPhrases(task().workspace?.expectedAnswer, correct, wrong, h.view.container)
      .filter(k => !forms(k).some(f => occurrences(record.ask, f)));
    // A gesture key no input names (a fraction build's slice count): the challenge's own answer fields.
    if (!record.keys.length) for (const [field, value] of Object.entries(context().challenge ?? {}))
      if (/target|answer|correct|numerator/i.test(field) && typeof value === 'number') record.keys.push(String(value));
    if (LADDER === 'second_wrong' && wrong.length && answer(wrong, 'miss') && task().itemId === item) {
      // The ladder's auto-pull (handoff 21 S2): a second wrong answer, no "I'm stuck"; the transport pulls help itself.
      if (task().phase !== 'working' && h.offer('retry')) { h.dispatch('retry'); h.confirmVisible(); h.settle(); }
      const before = new Set((task().workspace?.levers ?? []).filter(l => l.pulled).map(l => l.id));
      if (answer(row.inputsFor('wrong', context()), 'miss')) {
        // The transport pulls after the commit's notification, in a microtask of its own.
        await act(async () => { await Promise.resolve(); });
        h.settle(); h.confirmVisible(); h.settle();
        const declared = (task().workspace?.levers ?? []).find(l => l.pulled && !before.has(l.id));
        if (!declared) { record.stopped = 'the second wrong answer pulled no lever'; return record; }
        moment('lever', { host: [leverPulledMessage(declared, helpBeforeLastWrong(task().workspace!, item) ? 'wrong_with_help' : 'second_wrong')],
          lever: { id: declared.id, kind: declared.kind, does: declared.does } });
        if (task().workspace?.practice) { record.stopped = 'a simplify lever opened a practice item'; return record; }
        if (task().phase !== 'working' && h.offer('retry')) { h.dispatch('retry'); h.confirmVisible(); h.settle(); }
      }
    } else if (wrong.length && answer(wrong, 'miss') && task().itemId === item && h.state().status === 'active') {
      if (task().phase !== 'working' && h.offer('retry') && !task().workspace?.levers?.some(l => !l.pulled)) {
        h.dispatch('retry'); h.confirmVisible(); h.settle();
      }
      moment('stuck', { learner: STUCK });
      const levers = task().workspace?.levers ?? [];
      const lever = nextLever(levers, lastMiss(task().workspace?.attempts ?? [], item));
      if (lever && h.offer('pull_lever')) {
        const declared = levers.find(l => l.id === lever)!;
        h.dispatch('pull_lever', { lever }); h.confirmVisible(); h.settle();
        moment('lever', { host: [leverPulledMessage(declared)], lever: { id: declared.id, kind: declared.kind, does: declared.does } });
        if (task().workspace?.practice) { record.stopped = 'a simplify lever opened a practice item'; return record; }
      }
      if (task().phase !== 'working' && h.offer('retry')) { h.dispatch('retry'); h.confirmVisible(); h.settle(); }
    }
    if (task().itemId === item) answer(row.inputsFor('correct', context()), 'credit');
    // A gesture item's key is often in no input (taps of "One more"): take the numbers its credited response adds.
    const responses = h.state().task?.workspace?.attempts.filter(a => a.itemId === item) ?? [];
    const numbers = (text?: string) => text?.match(/\d+(?:\.\d+)?/g) ?? [];
    const wrongNumbers = new Set(responses.filter(a => !a.correct).flatMap(a => numbers(a.response)));
    for (const n of numbers(responses.find(a => a.correct)?.response))
      if (!wrongNumbers.has(n) && !occurrences(record.ask, n) && !record.keys.includes(n)) record.keys.push(n);
  } catch (e) {
    record.stopped = (e as Error).message;
  } finally {
    h.close();
  }
  return record;
}

beforeEach(() => {
  installRuntimeTimers();
  stubObservationRoutes();
  // Animations that time themselves with performance.now() (ramp-lab's trials) advance with the fake clock too.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  // The driver's jsdom: no 2D context (a trial bench then measures at once), and a paint callback that throws on the
  // missing context is reported, not raised. Here it would throw out of act and read as a binding defect.
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => { try { fn(performance.now()); } catch { /* paint only */ } }, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 480,
    right: 760, bottom: 480, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });
/**
 * Every graded bound family and catalog mode: the levers seen on its saved payloads, and each catalog miss as
 * answered (by which levers), unanswered by decision, or open. A mode with no saved payload is `unmeasured`:
 * the sweep never drove it, so "no levers" there is unknown, not absent.
 */
function leverInventory() {
  return UNIVERSAL_CATALOG.filter(c => c.teachingWorkspace && !c.teachingWorkspace.ungraded).flatMap(c => {
    const tw = c.teachingWorkspace!;
    const modes = c.evalModes?.length ? c.evalModes.map(m => m.evalMode) : ['mixed'];
    return modes.map(mode => {
      const key = `${c.id}.${mode}`, seen = LEVERS_SEEN.get(key);
      const payloads = PAYLOADS.filter(p => `${p.primitiveId}.${p.evalMode}` === key).map(p => p.file);
      const misses = tw.misses?.[mode] ?? [], unanswered = tw.unanswered?.[mode] ?? [];
      const levers = seen ? Array.from(seen).map(([id, l]) => ({ id, kind: l.kind, answers: l.answers })) : [];
      return { primitiveId: c.id, evalMode: mode, declaresLevers: !!tw.levers, payloads,
        status: !payloads.length ? 'unmeasured' : levers.length ? 'levers' : 'none',
        levers, misses: misses.map(m => ({ miss: m, answeredBy: levers.filter(l => l.answers.includes(m)).map(l => l.id),
          unanswered: unanswered.includes(m) })) };
    });
  });
}

afterAll(() => {
  if (process.env.JOURNEY_SWEEP_OUT) writeFileSync(process.env.JOURNEY_SWEEP_OUT,
    JSON.stringify({ invariants: JOURNEY_INVARIANTS, results: RESULTS, leverInventory: leverInventory() }, null, 1));
  if (process.env.TUTOR_REPLAY_OUT) writeFileSync(process.env.TUTOR_REPLAY_OUT, JSON.stringify({ lessonEntry: LESSON_ENTRY, records: MOMENTS }, null, 1));
  // The runtime's own spoken_miss requests, one per item, for `scripts/spoken-miss-probe.mjs --requests <file>`.
  // Each item is heard wrong first and right last, so the last words heard on it are the journey's correct answer.
  if (process.env.SPOKEN_MISS_OUT) writeFileSync(process.env.SPOKEN_MISS_OUT, JSON.stringify(Array.from(new Map(SPOKEN_MISS
    .map((r, i) => [`${SPOKEN_MISS_FROM[i]}/${r.scope?.itemId}`, { payload: SPOKEN_MISS_FROM[i], ...r, learner: undefined,
      correctSaid: r.learner }])).values()), null, 1));
});

/** `TUTOR_REPLAY_LADDER=second_wrong` records the auto-pull path (two wrong answers, no "I'm stuck") in place of stuck-then-pull. */
const LADDER = process.env.TUTOR_REPLAY_LADDER;
/** `TUTOR_REPLAY_ONLY=number-line,ten-frame` limits recording to those families. */
const REPLAY_ONLY = (process.env.TUTOR_REPLAY_ONLY ?? '').split(',').filter(Boolean);
describe.runIf(!!process.env.TUTOR_REPLAY_OUT)('tutor replay moments', () => {
  it.each(PAYLOADS.filter(p => !REPLAY_ONLY.length || REPLAY_ONLY.includes(p.primitiveId)).map(p => [p.file, p] as const))('%s', async (_file, payload) => {
    const record = await recordMoments(payload);
    if (record) MOMENTS.push(record);
  }, 30_000);
});

describe('dry journey, every saved payload', () => {
  it.each(PAYLOADS.map(p => [p.file, p] as const))('%s', async (file, payload) => {
    let result: Result;
    try { result = await drive(payload); } catch (e) {
      result = { payload: file, items: 0, findings: [{ invariant: 'J1-drivable', detail: `mount or drive threw: ${(e as Error).message}` }], advisories: [] };
    }
    // A second mount, the passing student (J10). Its findings on the shared rules join the recover program's.
    try {
      cleanup();
      const clean = await drive(payload, 'clean');
      result.findings.push(...clean.findings.map(f => ({ ...f, detail: `clean program: ${f.detail}` })));
      result.records = { ...result.records, ...clean.records };
    } catch (e) {
      result.findings.push({ invariant: 'J10-clean-record', detail: `clean program: mount or drive threw: ${(e as Error).message}` });
    }
    RESULTS.push(result);
    const known = BASELINE[file] ?? {};
    const seen = new Set(result.findings.map(f => f.invariant));
    expect(result.findings.filter(f => !known[f.invariant]), 'a finding not in journey-sweep-baseline.json').toEqual([]);
    expect(Object.keys(known).filter(k => !seen.has(k as Invariant)), 'fixed: delete it from journey-sweep-baseline.json').toEqual([]);
  }, 30_000);
});
