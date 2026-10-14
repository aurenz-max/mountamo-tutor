// Per-tier picks of equivalence-20 inside equation-builder balance-both-sides' scope (no Gemini).
//   node scripts/difficulty-lab/eq-scope-table.mjs [maxNumber]
import { resolve } from 'node:path';
import * as vite from 'vite';

process.env.GEMINI_API_KEY ??= 'unused-no-calls';
const max = Number(process.argv[2] ?? 20);
const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { getItemSpace, TIER_BANDS, tierPick } = await loader.import('/src/components/lumina/service/itemSpace/index.ts');
  const { equivalenceFitsLesson, balanceSidesOf } = await loader.import('/src/components/lumina/service/math/equationBuilderItemSpace.ts');
  const space = getItemSpace('equivalence-20');
  const scope = (it) => equivalenceFitsLesson(it, max, true);
  const all = space.items().filter(scope);
  for (const [tier, [lo, hi]] of Object.entries(TIER_BANDS)) {
    const n = all.filter((it) => it.beta >= lo && it.beta <= hi).length;
    console.log(`\n${tier} [${lo}, ${hi}] ${n} items in scope`);
    for (const p of tierPick(space, console.log, scope)(8, lo, hi, Math.random, scope)) {
      const { left, right } = balanceSidesOf(p);
      console.log(`  β ${p.beta.toFixed(2).padStart(5)}  ${p.structure.padEnd(24)} ${left} = ${right}  [${p.answer}]`);
    }
  }
} finally { await server.close(); }
