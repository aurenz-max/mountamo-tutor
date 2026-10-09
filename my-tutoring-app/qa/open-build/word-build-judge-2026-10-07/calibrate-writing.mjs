// Runs the labelled builds through the production route (judgeWordBuild) on the dev server, once with Jev and once
// forced to the flash-latest fallback; prints raw probabilities and agreement. Usage: node calibrate.mjs <tag>
import { readFileSync, writeFileSync } from 'node:fs';

const cases = JSON.parse(readFileSync(new URL('./labelled-writing.json', import.meta.url), 'utf8'));
const call = async (c, judge) => {
  const res = await fetch('http://localhost:3000/api/lumina', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'judgeWordBuild',
      params: { ask: c.ask, made: c.made, unit: 'writing', context: c.context, grade: 'Grade 2', ...(judge ? { judge } : {}) } }),
  });
  return res.ok ? res.json() : { error: res.status };
};
const rows = [];
for (let i = 0; i < cases.length; i += 6) {
  const batch = cases.slice(i, i + 6);
  rows.push(...await Promise.all(batch.map(async c => ({ ...c, jev: await call(c), flash: await call(c, 'flash') }))));
}
const got = v => (v.error ? 'error' : v.met ? 'pass' : v.miss);
const score = k => rows.filter(r => got(r[k]) === r.expect).length;
for (const r of rows) {
  console.log(`${r.expect.padEnd(13)} ${r.made.slice(0,40).padEnd(40)} jev=${got(r.jev).padEnd(13)} rw=${r.jev.realWord?.toFixed(2)} `
    + `fit=${r.jev.fits?.toFixed(2)} (${r.jev.judge})  flash=${got(r.flash)}`);
}
console.log(`jev ${score('jev')}/${rows.length}  flash ${score('flash')}/${rows.length}`);
writeFileSync(new URL(`./calibration-writing-${process.argv[2] ?? 'run'}.json`, import.meta.url), JSON.stringify(rows, null, 2) + '\n');
