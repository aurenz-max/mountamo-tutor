// One line per Pip transition from a pipdrive log: node summarize.mjs <out-dir>/log.json
import fs from 'node:fs';

const log = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t0 = log[0]?.t ?? 0;
let speech = null;
for (const e of log) {
  const s = e.state || e.beforeStart || e.afterRegenerate;
  const at = ((e.t - t0) / 1000).toFixed(1).padStart(5);
  if (s) {
    const kind = e.state ? 'state ' : e.beforeStart ? 'before' : 'regen ';
    const said = s.speech !== speech && s.speech ? ` said="${s.speech.slice(0, 60)}"` : '';
    speech = s.speech;
    console.log(at, kind, `dock=${s.dock?.slice(-22)} anchor=${s.dock === s.anchor} bodies=${s.bodies} inDock=${s.inDock}`,
      `${s.phase}/${s.gesture}`, s.pointedAt ? `point@${s.pointedAt}` : '', s.overlaps.length ? `OVERLAP=${s.overlaps}` : '',
      s.pageOverflowX ? 'PAGE-OVERFLOW-X' : '', e.previousDock ? `prevDock=${e.previousDock.slice(-22)}` : '', said);
  } else if (e.console) {
    if (!/Expected length/.test(e.console)) console.log(at, 'console', e.console.slice(0, 160));
  } else console.log(at, JSON.stringify(e).slice(0, 160));
}
const lengthErrors = log.filter((e) => e.console && /Expected length/.test(e.console)).length;
if (lengthErrors) console.log(`(${lengthErrors} SVG "Expected length" console errors — pre-existing, also on Counting Board)`);
