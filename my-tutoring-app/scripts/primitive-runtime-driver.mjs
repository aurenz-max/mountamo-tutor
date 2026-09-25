// Actual mounted primitive + runtime. JSDOM paint and audio/hardware edges are simulated;
// model transcripts are supplied by Python.
//
// NO PRIMITIVE NAMES LIVE HERE. The driver owns a vocabulary of real learner actions
// (place, check, touch, give, write, draw, answer) and a generic probe reader; `liveJourneySpec.ts`
// declares which of them each primitive uses, how to derive their values from the
// mounted content, and whether a drawn example taught what it claims. Adding a
// primitive is a row in that spec — this file and `run_live_runtime.py` do not change.
import readline from 'node:readline';
import { resolve } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import React from 'react';
import * as vite from 'vite';

// Keep the line protocol separate from component diagnostics.
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
// Required, never defaulted: a default here is a silent per-primitive assumption
// in shared code, which is the thing this driver exists not to have.
const primitiveId = process.argv[3];
if (!primitiveId) throw new Error('Usage: primitive-runtime-driver.mjs <epoch> <primitive-id>');
// jsdom reports every canvas getContext() as "Not implemented"; a canvas primitive repaints on each
// pointer move, and that stream filled the stderr pipe the harness does not drain, hanging the drive.
const virtualConsole = new VirtualConsole();
virtualConsole.forwardTo(console, { jsdomErrors: 'none' });
virtualConsole.on('jsdomError', error => { if (!/^Not implemented: HTMLCanvasElement/.test(error.message)) process.stderr.write(`${error.stack ?? error.message}
`); });
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true, virtualConsole });
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, options) => nativeFetch(typeof input === 'string' && input.startsWith('/')
  ? new URL(input, process.env.LIVE_FRONTEND || 'http://localhost:3000') : input, options);
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'SVGElement', 'MutationObserver', 'localStorage']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
// Radix primitives (Accordion's presence) read computed styles on mount.
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
// react-dom detects DOM features (the `input` event among them) when it first loads, so it loads
// only once the JSDOM globals exist. A static import ran first and left React on its legacy IE path.
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const seams = resolve('scripts/primitive-runtime-seams.tsx');
const server = await vite.createServer({ root: process.cwd(), configFile: false, appType: 'custom', logLevel: 'error',
  plugins: [{ name: 'driver-hardware-boundaries', enforce: 'pre', load(id) {
    const normalized = id.replaceAll('\\', '/');
    if (/\/(?:LuminaAIContext|useLiveVoiceTurns|JudgedMicPanel|SoundManager|firebase)\.tsx?$/.test(normalized)
        || normalized.endsWith('/lumina/evaluation/index.ts')) {
      return `export * from '/scripts/primitive-runtime-seams.tsx'; export { default } from '/scripts/primitive-runtime-seams.tsx';`;
    }
  } }],
  esbuild: { jsx: 'automatic' }, resolve: { alias: [
    { find: '@/contexts/LuminaAIContext', replacement: seams },
    { find: /.*\/lib\/firebase(?:\.ts)?$/, replacement: seams },
    { find: /.*\/contexts\/LuminaAIContext(?:\.tsx)?$/, replacement: seams },
    { find: /.*\/useLiveVoiceTurns(?:\.ts)?$/, replacement: seams },
    { find: /.*\/utils\/SoundManager(?:\.ts)?$/, replacement: seams },
    { find: /.*\/components\/JudgedMicPanel(?:\.tsx)?$/, replacement: seams },
    { find: /.*\/evaluation\/index\.ts$/, replacement: seams },
    { find: '../../../evaluation', replacement: seams },
    { find: '@', replacement: resolve('src') },
  ] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const load = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const base = '/src/components/lumina/';
const { LIVE_JOURNEYS, SHARED_PROBES, journeyDescriptor } = await load.import(base + 'components/live-activity/liveJourneySpec.ts');
const journey = LIVE_JOURNEYS[primitiveId];
if (!journey) throw new Error('No live journey declared for ' + primitiveId);
const instanceId = journey.instanceId;
const { default: Primitive } = await load.import(base + journey.component);
const { DriverContext, submissions } = await load.import('/scripts/primitive-runtime-seams.tsx');
const { LiveLessonRuntime } = await load.import(base + 'components/live-activity/runtime/LiveLessonRuntime.ts');
const { LiveRuntimeContext } = await load.import(base + 'components/live-activity/runtime/LiveRuntimeContext.tsx');
const { LiveRuntimeSurface } = await load.import(base + 'components/live-activity/runtime/LiveRuntimeSurface.tsx');
const { RuntimeTransport, runtimePacket } = await load.import(base + 'components/live-activity/runtime/runtimeTransport.ts');
const { generatedActivityState, LIVE_ADAPTERS } = await load.import(base + 'components/live-activity/activityContract.ts');
const runtime = new LiveLessonRuntime(process.argv[2], { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true });
let messages = [], data, evalMode, diItems = [], close, controls, listening = false;
let inputStream = null, inputSequence = 0;
const transport = new RuntimeTransport(runtime, message => messages.push(message), async (request, signal) => {
  const response = await fetch((process.env.LIVE_FRONTEND || 'http://localhost:3000') + '/api/lumina/observe-dialogue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
  if (!response.ok) throw new Error('Dialogue observer unavailable');
  return response.json();
}, async (request, signal) => {
  // The advisory learner-turn observation, through the same real route the browser host uses.
  const response = await fetch((process.env.LIVE_FRONTEND || 'http://localhost:3000') + '/api/lumina/observe-learner', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
  if (!response.ok) throw new Error('Learner observer unavailable');
  return response.json();
});
const sharedVoiceTurns = { subscribe: listener => { close = listener.onTurnClose; return () => { close = null; }; },
  isVoiceActive: () => false, reset() {}, lastTurnOpenAtRef: { current: null }, floorsRef: { current: {} }, config: {} };
let context = { isConnected: true, isListening: true, sessionMode: 'lesson', activePrimitiveId: instanceId, lessonModeRef: { current: true }, switchPrimitive() {},
  sessionResumeCount: 0, conversation: [], isAudioPlaying: false, sharedVoiceTurns,
  holdVoiceTurns: () => () => {}, startListening() {}, stopListening() {},
  // Routes a non-silent send the way LuminaAIContext does: host-written text opens an exchange, anything else is learner words.
  sendText: (content, options) => {
    if (!options?.silent) options?.author === 'host' ? transport.hostText() : transport.learnerText(content, true);
    const { author, ...wire } = options ?? {};
    messages.push({ type: 'text', content, ...wire });
  },
  updateContext: primitive_data => messages.push({ type: 'update_context', primitive_data }),
};
const root = createRoot(document.getElementById('root'));
function render() {
  if (!data) return;
  context = { ...context, isListening: listening };
  flushSync(() => root.render(React.createElement(DriverContext.Provider, { value: context },
    React.createElement(LiveRuntimeContext.Provider, { value: runtime },
      React.createElement(LiveRuntimeSurface, { runtime }, React.createElement(Primitive, { data, runtimeEvalMode: evalMode,
        autoStart: true, onControlsReady: value => { controls = value; } }))))));
}

/**
 * The generated challenge the runtime is currently on, so the spec derives values
 * from live content.
 *
 * A JUDGED ITEM IS NOT A CHALLENGE. Six adopted primitives expand one generated
 * challenge into several judged asks with derived ids (`seq1` -> `seq1:1-answer`),
 * so this lookup returns null for them and any spec resolving by challenge id alone
 * silently falls back to the first item's answer — which is then judged wrong on
 * every item but the first. `itemId` is passed alongside for that reason.
 */
const currentChallenge = () => {
  const itemId = runtime.getSnapshot().task?.itemId;
  return (data?.challenges ?? []).find(c => c.id === itemId) ?? null;
};

// The driver's whole learner vocabulary. A journey selects from it; nothing here
// knows which primitive it is serving.
const PERFORM = {
  place: ({ value }) => {
    const svg = document.querySelector('svg[viewBox="0 0 760 240"]');
    if (!svg) throw new Error('No placement surface is mounted');
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 760, height: 240 });
    const state = controls.getState();
    const x = 60 + ((value - state.visibleMin) / (state.visibleMax - state.visibleMin)) * 640;
    flushSync(() => svg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: x })));
  },
  check: () => {
    const button = [...document.querySelectorAll('button')].find(b => /check/i.test(b.textContent));
    if (!button || button.disabled) throw new Error('No enabled Check button');
    flushSync(() => button.click());
  },
  // A labelled choice: the button whose whole text is the label, exactly.
  choose: ({ label }) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.getAttribute('aria-label') === label);
    if (!button || button.disabled) throw new Error(`No enabled choice labelled ${label}; buttons: ${[...document.querySelectorAll('button')]
      .map(b => `"${b.textContent.trim() || b.getAttribute('aria-label')}"${b.disabled ? ' (disabled)' : ''}`).join(', ')}`);
    flushSync(() => button.click());
  },
  // A named object (`target`, its `data-pip-object` id) or the index-th counted object.
  touch: ({ index, target: id }) => {
    const target = id ? document.querySelector(`[data-pip-object="${id}"]`)
      : [...document.querySelectorAll('[data-pip-object^="object-"]')][index ?? 0];
    if (!target) throw new Error('No tappable object ' + (id ?? 'at index ' + index));
    flushSync(() => target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  },
  // Typed text into the input with this `aria-label`, through the value setter React tracks.
  write: ({ label, text }) => {
    const input = [...document.querySelectorAll('input')].find(i => i.getAttribute('aria-label') === label);
    if (!input || input.disabled) throw new Error('No enabled input labelled ' + label);
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    flushSync(() => { setValue.call(input, text); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  },
  // Strokes on the canvas, in its own pixel coordinates: its client rect is pinned to its size.
  // `mousemove` is a continuous event, so React schedules its render rather than flushing it:
  // each move yields a task, as a real pointer does, or `mouseup` reads a one-point stroke.
  draw: async ({ strokes }) => {
    const canvas = document.querySelector('canvas[data-pip-object="canvas"]') ?? document.querySelector('canvas');
    if (!canvas) throw new Error('No canvas to draw on');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height, right: canvas.width, bottom: canvas.height });
    const at = (type, p) => flushSync(() => canvas.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, clientX: p?.x ?? 0, clientY: p?.y ?? 0 })));
    for (const stroke of strokes) {
      at('mousedown', stroke[0]);
      for (const p of stroke.slice(1)) { at('mousemove', p); await new Promise(resolve => setTimeout(resolve, 0)); }
      at('mouseup');
    }
  },
  give: () => {
    const button = [...document.querySelectorAll('button')].find(b => /give them to me/i.test(b.textContent));
    if (!button || button.disabled) throw new Error('No enabled handover button');
    flushSync(() => button.click());
  },
  answer: ({ text }) => {
    transport.learnerText(text, true);
    close?.({ kind: 'close', startedAt: performance.now() - 900, durationMs: 900, peak: .2, duringTutorAudio: false, belowMinVoice: false });
    context.conversation = [...context.conversation, { role: 'user', content: text, isAudio: true, timestamp: performance.now() }];
    render();
  },
};

const readProbes = () => Object.fromEntries(Object.entries({ ...SHARED_PROBES, ...(journey.probes ?? {}) })
  .map(([name, { selector, kind }]) => [name,
    kind === 'count' ? document.querySelectorAll(selector).length
      : kind === 'focused' ? !!document.activeElement?.matches?.(selector)
        : !!document.querySelector(selector)]));

const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
emit({ ready: true, journey: journeyDescriptor(primitiveId) });
try {
  for await (const line of readline.createInterface({ input: process.stdin })) {
    const input = JSON.parse(line);
    let performed = null, verdict = null;
    if (input.type === 'mount') {
      if (typeof input.evalMode !== 'string' || !input.evalMode) throw new Error('Mount needs the resolved session evalMode');
      evalMode = input.evalMode;
      data = { ...input.data, instanceId };
      diItems = input.diItems ?? [];
      render();
    }
    if (input.type === 'start') { listening = true; render(); }
    if (input.type === 'utterance') PERFORM.answer({ text: input.text });
    // A raw microphone/VAD start does not establish a new semantic turn.
    // Actual provider transcription below, or interruption, invalidates dialogue.
    if (input.type === 'audio_fragment') {
      transport.learnerText(input.text, input.finished === true);
      inputStream ??= ++inputSequence;
      context.conversation = [...context.conversation, { role: 'user', content: input.text, isAudio: true,
        timestamp: performance.now(), streamId: inputStream, transcriptFinished: input.finished === true }];
      if (input.finished) inputStream = null;
      render();
    }
    if (input.type === 'command') await transport.command(input.command);
    // The learner's own Try again / Next challenge on the shared shell (LiveRuntimeSurface).
    if (input.type === 'learner_progress') await transport.learnerProgress(input.action);
    // ONE learner opcode. The spec turns an intent into this primitive's real actions.
    if (input.type === 'learner') {
      performed = journey.inputsFor(input.intent,
        { data, challenge: currentChallenge(), diItems, itemId: runtime.getSnapshot().task?.itemId ?? null,
          demand: runtime.getSnapshot().task?.demand ?? null,
          expectedAnswer: runtime.getSnapshot().task?.workspace?.expectedAnswer ?? null });
      for (const action of performed) {
        if (input.deferAnswers && action.type === 'answer') continue;
        const run = PERFORM[action.type];
        if (!run) throw new Error('Unknown learner action ' + action.type);
        await run(action);
      }
    }
    // Primitive-owned pedagogy check, run beside the primitive rather than in Python.
    if (input.type === 'assert' && input.check === 'exampleTaught') {
      // The artifact the CALLER names wins: the detour may already have closed by
      // the time the turn that described it can be judged.
      const artifact = input.artifact ?? runtime.getSnapshot().supportArtifact;
      if (!journey.exampleTaught) verdict = { skipped: true };
      else if (!artifact) verdict = { ok: false, reason: 'No prepared example was on screen' };
      else {
        const reason = journey.exampleTaught(artifact, input.spoken ?? '');
        // The judged text belongs in the report: a verdict without it cannot be
        // told apart from a capture bug in the phase program that fed it.
        verdict = { ok: !reason, reason, artifact, spoken: input.spoken ?? '' };
      }
    }
    if (input.type === 'output') {
      transport.beginTurn(input.text || ''); context.isAudioPlaying = true;
      if (input.text) context.conversation = [...context.conversation, { role: 'assistant', content: input.text, isAudio: true, timestamp: performance.now() }];
      render();
    }
    if (input.type === 'end') { transport.endTurn(false); context.isAudioPlaying = false; render(); }
    if (input.type === 'stop') runtime.stop();
    await new Promise(resolve => setTimeout(resolve, 5));
    const outgoing = messages; messages = [];
    emit({ observing: transport.dialogue.pending, state: runtimePacket(runtime.getSnapshot()), messages: outgoing, submissions: submissions.length,
      activityState: data ? controls?.getState() ?? generatedActivityState(primitiveId, data) : null,
      tutoring: LIVE_ADAPTERS[primitiveId].tutoring,
      // The scoring pass's trace entries (what the record carries per attempt); empty until a session completes.
      scoring: runtime.trace.getSnapshot().filter(entry => entry.stage === 'item_scoring'),
      ...(performed ? { performed } : {}), ...(verdict ? { verdict } : {}),
      dom: readProbes() });
  }
} finally { flushSync(() => root.unmount()); transport.close(); await server.close(); dom.window.close(); }
