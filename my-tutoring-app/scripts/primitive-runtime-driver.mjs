// Actual mounted primitive + runtime; family-specific learner input stays in this driver. JSDOM paint and
// audio/hardware edges are simulated; model transcripts are supplied by Python.
import readline from 'node:readline';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as vite from 'vite';

// Keep the line protocol separate from component diagnostics.
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
const primitiveId = process.argv[3] || 'ten-frame';
const families = {
  'ten-frame': { component: 'TenFrame', instanceId: 'frame' },
  'number-line': { component: 'NumberLine', instanceId: 'line' },
};
const family = families[primitiveId];
if (!family) throw new Error('Unsupported driver primitive');
const { instanceId } = family;
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'SVGElement', 'MutationObserver', 'localStorage']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
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
const { default: Primitive } = await load.import(base + 'primitives/visual-primitives/math/' + family.component + '.tsx');
const { DriverContext, submissions } = await load.import('/scripts/primitive-runtime-seams.tsx');
const { LiveLessonRuntime } = await load.import(base + 'components/live-activity/runtime/LiveLessonRuntime.ts');
const { LiveRuntimeContext } = await load.import(base + 'components/live-activity/runtime/LiveRuntimeContext.tsx');
const { LiveRuntimeSurface } = await load.import(base + 'components/live-activity/runtime/LiveRuntimeSurface.tsx');
const { RuntimeTransport, runtimePacket } = await load.import(base + 'components/live-activity/runtime/runtimeTransport.ts');
const { generatedActivityState } = await load.import(base + 'components/live-activity/activityContract.ts');
const runtime = new LiveLessonRuntime(process.argv[2], { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true });
let messages = [], data, close, controls, listening = false;
const transport = new RuntimeTransport(runtime, message => messages.push(message));
const sharedVoiceTurns = { subscribe: listener => { close = listener.onTurnClose; return () => { close = null; }; },
  isVoiceActive: () => false, reset() {}, lastTurnOpenAtRef: { current: null }, floorsRef: { current: {} }, config: {} };
let context = { isConnected: true, isListening: true, sessionMode: 'lesson', activePrimitiveId: instanceId, lessonModeRef: { current: true }, switchPrimitive() {},
  sessionResumeCount: 0, conversation: [], isAudioPlaying: false, sharedVoiceTurns,
  holdVoiceTurns: () => () => {}, startListening() {}, stopListening() {},
  sendText: (content, options) => messages.push({ type: 'text', content, ...options }),
  updateContext: primitive_data => messages.push({ type: 'update_context', primitive_data }),
};
const root = createRoot(document.getElementById('root'));
function render() {
  if (!data) return;
  context = { ...context, isListening: listening };
  flushSync(() => root.render(React.createElement(DriverContext.Provider, { value: context },
    React.createElement(LiveRuntimeContext.Provider, { value: runtime },
      React.createElement(LiveRuntimeSurface, { runtime }, React.createElement(Primitive, { data, autoStart: true, onControlsReady: value => { controls = value; } }))))));
}
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
emit({ ready: true });
try {
  for await (const line of readline.createInterface({ input: process.stdin })) {
    const input = JSON.parse(line);
    if (input.type === 'mount') { data = { ...input.data, instanceId }; render(); }
    if (input.type === 'start') { listening = true; render(); }
    if (input.type === 'command') await transport.command(input.command);
    if (input.type === 'answer' && primitiveId === 'ten-frame') {
      close?.({ kind: 'close', startedAt: performance.now() - 900, durationMs: 900, peak: .2, duringTutorAudio: false, belowMinVoice: false });
      context.conversation = [...context.conversation, { role: 'user', content: input.text, isAudio: true, timestamp: performance.now() }]; render();
    }
    if (input.type === 'place' && primitiveId === 'number-line') {
      const svg = document.querySelector('svg[viewBox="0 0 760 240"]');
      if (!svg) throw new Error('Number line is not mounted');
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 760, height: 240 });
      const state = controls.getState();
      const x = 60 + ((input.value - state.visibleMin) / (state.visibleMax - state.visibleMin)) * 640;
      flushSync(() => svg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: x })));
    }
    if (input.type === 'check' && primitiveId === 'number-line') {
      const button = [...document.querySelectorAll('button')].find(b => /check/i.test(b.textContent));
      if (!button || button.disabled) throw new Error('No enabled Check button');
      flushSync(() => button.click());
    }
    if (input.type === 'output') {
      transport.beginTurn(); context.isAudioPlaying = true;
      if (input.text) context.conversation = [...context.conversation, { role: 'assistant', content: input.text, isAudio: true, timestamp: performance.now() }];
      render();
    }
    if (input.type === 'end') { transport.endTurn(false); context.isAudioPlaying = false; render(); }
    if (input.type === 'stop') runtime.stop();
    await new Promise(resolve => setTimeout(resolve, 5));
    const outgoing = messages; messages = [];
    emit({ state: runtimePacket(runtime.getSnapshot()), messages: outgoing, submissions: submissions.length,
      activityState: data ? controls?.getState() ?? generatedActivityState(primitiveId, data) : null,
      dom: { promptFocused: document.activeElement?.getAttribute('aria-label') === 'Current instruction', numberLinePresent: !!document.querySelector('svg[viewBox="0 0 760 240"]'), framePresent: !!document.querySelector('[data-pip-object="frame"]'), support: !!document.querySelector('[aria-label="Worked example"]') } });
  }
} finally { flushSync(() => root.unmount()); transport.close(); await server.close(); dom.window.close(); }
