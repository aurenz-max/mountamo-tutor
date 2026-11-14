// Before/after for the coverage lean in the word-space picker (queue 8.3q). No model call, no backend.
// A simulated child plays consecutive sessions of one lesson and reads every word right. After each session the
// words' letter-sound pairs are added to the child's tallies, and the next session is drawn through the real picker
// with those tallies in a signed launch packet. The script counts how much of the lesson's pair inventory the child
// has read at least twice (the point where a pair can be called weak or known), with the lean and without it.
//   node scripts/coverage-lean-bench.mjs [--children 20] [--sessions 10]
import { resolve } from 'node:path';
import * as vite from 'vite';

const root = process.cwd();
const arg = (name, dflt) => { const at = process.argv.indexOf(name); return at > 0 ? Number(process.argv[at + 1]) : dflt; };
const CHILDREN = arg('--children', 20), SESSIONS = arg('--sessions', 10), N = 5;

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
  const { unitPairs } = await loader.import(`${S}/componentMastery/registry.ts`);
  process.env.LUMINA_GENERATION_SIGNING_KEY = TEST_SIGNING_KEY;

  const lessons = [
    ['phonics-blender cvc (K), reading', 'letter_sound', () => blendSpace('cvc', 'K', null)],
    ['cvc-speller spell-word (K, group 4), spelling', 'spelling', () => cvcSpellerSpace('spell-word', cvcScope(cvcUsableLetters(4), null, null), 'K')],
  ];

  for (const [name, kind, space] of lessons) {
    const all = space();
    console.log(`\n${name}: ${all.length} words`);
    console.log('  tier | pairs in the tier | arm | read twice after 3 / 5 / 10 sessions | never read after 10 | distinct words in 10');
    for (const tier of ['easy', 'medium', 'hard']) {
      // The tier's inventory: the pairs of the words 200 plain draws of this tier can reach.
      const reach = new Set();
      for (let s = 1; s <= 200; s++) for (const it of tierPick(space(), tier, N, mulberry32(s * 104729))) for (const id of unitPairs(it.words[0])) reach.add(id);
      for (const arm of ['plain', 'lean']) {
        const twice = { 3: 0, 5: 0, 10: 0 }; let never = 0, words = 0;
        for (let child = 1; child <= CHILDREN; child++) {
          const tallies = {}, seen = new Set();
          for (let session = 1; session <= SESSIONS; session++) {
            const draw = () => tierPick(space(), tier, N, mulberry32(child * 7919 + session * 31)).map((it) => it.words[0]);
            const packet = arm === 'lean' && Object.keys(tallies).length
              ? signLearningObservations({ ...packetFixture([], []), components: { [kind]: tallies } }, TEST_SIGNING_KEY) : null;
            const picks = packet ? withGenerationRequest({ authorization: null, learningObservations: packet }, draw) : draw();
            for (const w of picks) { seen.add(w); for (const id of unitPairs(w)) tallies[id] = [(tallies[id]?.[0] ?? 0) + 1, (tallies[id]?.[1] ?? 0) + 1]; }
            if (twice[session] !== undefined) twice[session] += [...reach].filter((id) => (tallies[id]?.[0] ?? 0) >= 2).length;
          }
          never += [...reach].filter((id) => !tallies[id]).length; words += seen.size;
        }
        const avg = (x) => (x / CHILDREN).toFixed(1);
        console.log(`  ${tier} | ${reach.size} | ${arm} | ${avg(twice[3])} / ${avg(twice[5])} / ${avg(twice[10])} | ${avg(never)} | ${avg(words)}`);
      }
    }
  }
} finally { await server.close(); }
