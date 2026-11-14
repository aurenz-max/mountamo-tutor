// What the help levers can do for each named miss, read from every lever set and its boss card. No model call.
// For each primitive and mode: the misses with no help lever, with one, and with two or more (a second wrong still
// has help); how many help levers only mark or rearrange what is on screen; how many read which miss happened
// (`lastMiss` in content/offer, or `answersOn`); and how many show one screen for several different misses.
// Upper bound: a lever counts as offered whenever its spec lists the mode and miss; `offer` and null content only
// lower the numbers.
//   node scripts/lever-coverage-bench.mjs [--only literacy,direct-instruction] [--out qa/lever-bench/coverage.json]
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, basename, dirname, relative } from 'node:path';
import * as vite from 'vite';

const root = process.cwd();
const arg = (name) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : null; };
const only = arg('--only')?.split(',');
const out = arg('--out');
const SRC = resolve(root, 'src/components/lumina');

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  (e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(join(dir, e.name))) : [join(dir, e.name)]));
const leverFiles = walk(SRC).filter((f) => /Levers\.ts$/.test(f) && !/\.test\./.test(f))
  .filter((f) => !only || only.some((o) => f.replaceAll('\\', '/').includes(`/${o}/`)));

const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const rows = [];
const skipped = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const load = (file) => loader.import('/' + relative(root, file).replaceAll('\\', '/'));
  for (const file of leverFiles) {
    const stem = basename(file).replace(/Levers\.ts$/, '');
    const cardFile = join(dirname(file), `${stem}.card.ts`);
    let mod, cardMod;
    try { mod = await load(file); cardMod = existsSync(cardFile) ? await load(cardFile) : null; }
    catch (e) { skipped.push(`${stem}: ${String(e.message).split('\n')[0]}`); continue; }
    const sets = Object.values(mod).filter((v) => v && Array.isArray(v.specs) && typeof v.declare === 'function');
    const card = cardMod && Object.values(cardMod).find((v) => v && v.modes && typeof v.modes === 'object' && v.id);
    if (!sets.length || !card) { skipped.push(`${stem}: ${sets.length ? 'no card beside it' : 'no lever set exported'}`); continue; }
    const specs = sets.flatMap((s) => s.specs);
    const help = specs.filter((s) => s.type !== 'easier');
    const reads = (s) => (s.content?.length ?? 0) >= 3 || (s.offer?.length ?? 0) >= 3 || !!s.answersOn;
    let misses = 0, none = 0, one = 0, twoPlus = 0, declaredUnanswered = 0;
    const sameScreen = new Set();
    const noHelp = [];
    for (const [mode, def] of Object.entries(card.modes)) {
      const list = (def.misses ?? []).map((m) => (typeof m === 'string' ? m : m.id ?? m.miss)).filter(Boolean);
      const unanswered = new Set(def.unanswered ?? []);
      const inMode = help.filter((s) => !s.modes || s.modes.includes(mode));
      for (const s of inMode) {
        const n = s.answers === 'all' ? list.length : s.answers.filter((m) => list.includes(m)).length;
        if (n >= 2 && !reads(s)) sameScreen.add(s.id);
      }
      for (const miss of list) {
        misses++;
        const n = inMode.filter((s) => s.answers === 'all' || s.answers.includes(miss)).length;
        if (n === 0) { none++; noHelp.push(`${mode}:${miss}`); if (unanswered.has(miss)) declaredUnanswered++; }
        else if (n === 1) one++; else twoPlus++;
      }
    }
    const ids = [...new Set(help.map((s) => s.id))];
    const typeOf = (id) => help.find((s) => s.id === id).type;
    rows.push({
      primitive: card.id, family: basename(dirname(file)), modes: Object.keys(card.modes).length, misses, none, one, twoPlus,
      declaredUnanswered, helpLevers: ids.length,
      marksOnly: ids.filter((id) => ['marks', 'layout'].includes(typeOf(id))).length,
      model: ids.filter((id) => typeOf(id) === 'model').length,
      readsMiss: ids.filter((id) => help.some((s) => s.id === id && reads(s))).length,
      sameScreen: [...sameScreen], noHelp,
    });
  }
} finally { await server.close(); }

const sum = (key) => rows.reduce((s, r) => s + (Array.isArray(r[key]) ? r[key].length : r[key]), 0);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
rows.sort((a, b) => a.family.localeCompare(b.family) || a.primitive.localeCompare(b.primitive));
console.log('primitive | misses | no help | 1 help | 2+ help | help levers | marks only | model | reads the miss | one screen for several misses');
for (const r of rows) {
  console.log(`${r.primitive} | ${r.misses} | ${r.none} | ${r.one} | ${r.twoPlus} | ${r.helpLevers} | ${r.marksOnly} | ${r.model} | ${r.readsMiss} | ${r.sameScreen.length}`);
}
const total = { primitives: rows.length, misses: sum('misses'), none: sum('none'), one: sum('one'), twoPlus: sum('twoPlus'),
  declaredUnanswered: sum('declaredUnanswered'), helpLevers: sum('helpLevers'), marksOnly: sum('marksOnly'), model: sum('model'),
  readsMiss: sum('readsMiss'), sameScreen: sum('sameScreen') };
console.log(`\nTOTAL ${total.primitives} primitives, ${total.misses} named misses: no help ${total.none} (${pct(total.none, total.misses)}; `
  + `${total.declaredUnanswered} declared unanswered), one help ${total.one} (${pct(total.one, total.misses)}), `
  + `two or more ${total.twoPlus} (${pct(total.twoPlus, total.misses)})`);
console.log(`${total.helpLevers} help levers: ${total.marksOnly} only mark or rearrange the screen (${pct(total.marksOnly, total.helpLevers)}), `
  + `${total.model} model another item, ${total.readsMiss} read which miss happened (${pct(total.readsMiss, total.helpLevers)}), `
  + `${total.sameScreen} show one screen for two or more different misses (${pct(total.sameScreen, total.helpLevers)})`);
if (skipped.length) console.log(`\nskipped ${skipped.length}:\n  ${skipped.join('\n  ')}`);
if (out) writeFileSync(resolve(root, out), JSON.stringify({ generatedAt: new Date().toISOString(), total, rows, skipped }, null, 2) + '\n');
