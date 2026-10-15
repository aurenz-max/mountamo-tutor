// Compact a probe file: one line per run, items joined. Usage: node summarize.mjs <file>
import fs from 'node:fs';
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
let head = null; let row = [];
const flush = () => { if (head) console.log(`${head}\n    ${row.join(' | ')}`); row = []; };
for (const l of lines) {
  if (/\| difficulty=/.test(l)) { flush(); head = l.replace(/ \| run \d+/, ''); continue; }
  const m = /^\s+\[[^\]]*\] (.*?)(?:  "[^"]*")?$/.exec(l);
  if (m) row.push(m[1].replace(/\s+\[([^\]]*)\]$/, ' [$1]'));
}
flush();
