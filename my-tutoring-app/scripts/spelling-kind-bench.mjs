// Before/after for the `spelling` component kind (user ruling 2026-11-11). No model call, no backend.
// A simulated child reads c correctly every time and spells it with k (cat built as kat). Three ways to store that:
//   today     the build is not recorded: no tally changes
//   shared    spelling builds are added to the letter-sound grid
//   separate  spelling has its own kind
// For each, the real word spaces are drawn through the real picker with a signed launch packet, and the script counts
// how many words with c the child gets in a spelling session (cvc-speller spell_word) and in a reading session
// (phonics-blender cvc). Child B is the same child after more reading: the shared grid then stops seeing the miss.
//   node scripts/spelling-kind-bench.mjs [--sessions 40]
import { resolve } from 'node:path';
import * as vite from 'vite';

const root = process.cwd();
const at = process.argv.indexOf('--sessions');
const SESSIONS = at > 0 ? Number(process.argv[at + 1]) : 40;
const N = 5;

const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const S = '/src/components/lumina/service';
  const { withGenerationRequest } = await loader.import(`${S}/generation/generationRequest.ts`);
  const { signLearningObservations } = await loader.import(`${S}/generation/learningObservationPacket.ts`);
  const { TEST_SIGNING_KEY, packetFixture } = await loader.import(`${S}/generation/learningObservationPacket.fixtures.ts`);
  const { tierPick, mulberry32 } = await loader.import(`${S}/wordSpace/pick.ts`);
  const { cvcScope, cvcSpellerSpace } = await loader.import(`${S}/wordSpace/cvcSpellerSpaces.ts`);
  const { blendSpace } = await loader.import(`${S}/wordSpace/phonicsSpaces.ts`);
  const { cvcUsableLetters } = await loader.import(`${S}/literacy/letterGroups.ts`);
  const { expandTallies } = await loader.import(`${S}/componentMastery/registry.ts`);
  process.env.LUMINA_GENERATION_SIGNING_KEY = TEST_SIGNING_KEY;

  const tally = (kind, units) => Object.fromEntries(expandTallies([{ kind, units }]).map((r) => [r.id, [r.attempts, r.correct]]));
  const add = (a, b) => { const out = { ...a }; for (const [id, [n, c]] of Object.entries(b)) out[id] = [(out[id]?.[0] ?? 0) + n, (out[id]?.[1] ?? 0) + c]; return out; };
  const right = (words) => words.map((w) => ({ unit: w, attempts: 1, correct: 1 }));

  // What the child did. Spelling: five c words, four built with k; three other words built right.
  const spelled = tally('spelling', [
    ...['cat>kat', 'cup>kup', 'cot>kot', 'cap>kap'].map((unit) => ({ unit, attempts: 1, correct: 0 })),
    ...right(['can', 'sit', 'hen', 'mop']),
  ]);
  const readA = tally('letter_sound', right(['cat', 'cup', 'cot', 'can', 'sun', 'pig', 'hen', 'dog']));
  const readB = tally('letter_sound', right(['cat', 'cup', 'cot', 'can', 'cap', 'cub', 'cab', 'cod', 'cop', 'cut', 'cat', 'cup', 'cot', 'can',
    'cap', 'cub', 'cab', 'cod', 'cop', 'cut', 'sun', 'pig', 'hen', 'dog']));

  const spellSpace = () => cvcSpellerSpace('spell-word', cvcScope(cvcUsableLetters(4), null, null), 'K');
  const readSpace = () => blendSpace('cvc', 'K', null);
  const hasC = (w) => w.includes('c');
  const base = (space) => { const all = space().map((it) => it.words[0]); return `${all.filter(hasC).length} of ${all.length}`; };

  const run = (components, space, tier) => {
    let c = 0, total = 0, sessionsWithC = 0;
    for (let seed = 1; seed <= SESSIONS; seed++) {
      const draw = () => tierPick(space(), tier, N, mulberry32(seed * 7919)).map((it) => it.words[0]);
      const picks = components ? withGenerationRequest({ authorization: null,
        learningObservations: signLearningObservations({ ...packetFixture([], []), components }, TEST_SIGNING_KEY) }, draw) : draw();
      const n = picks.filter(hasC).length;
      c += n; total += picks.length; if (n) sessionsWithC++;
    }
    return { perSession: +(c / SESSIONS).toFixed(2), share: `${Math.round((100 * c) / total)}%`, sessionsWithC: `${sessionsWithC}/${SESSIONS}` };
  };

  console.log(`word spaces (K, letter group 4): spelling ${base(spellSpace)} words have c; reading ${base(readSpace)}`);
  for (const [name, read] of [['A: 4 c words read, all right', readA], ['B: 20 c words read, all right', readB]]) {
    const shared = add(read, spelled);
    const arms = {
      today: { letter_sound: read },
      // One grid: the merged tallies are what both a reading draw and a spelling draw would see.
      shared: { letter_sound: shared, spelling: shared },
      separate: { letter_sound: read, spelling: spelled },
    };
    console.log(`\nchild ${name}; spelled c right 1 of 5`);
    console.log(`  c on the reading grid: today ${read['c/K']}, shared ${shared['c/K']}, separate ${read['c/K']} (spelling grid ${spelled['c/K']})`);
    console.log('  arm | tier | spelling session: c words of 5 (sessions with any) | reading session: c words of 5 (sessions with any)');
    for (const [arm, components] of Object.entries(arms)) for (const tier of ['easy', 'medium', 'hard']) {
      const s = run(components, spellSpace, tier), r = run(components, readSpace, tier);
      console.log(`  ${arm} | ${tier} | ${s.perSession} (${s.sessionsWithC}) | ${r.perSession} (${r.sessionsWithC})`);
    }
  }
} finally { await server.close(); }
