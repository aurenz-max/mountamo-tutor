/**
 * The structure-first pick shared by the time and money spaces (principle 6 of /add-item-space): in the
 * band, draw a structure least-used first, then an item of it. `key` names what two picks must not share
 * (one time, one coin set, one price per session); `also` adds a second such key (one hour per session).
 */
export function pickSpread<I extends { beta: number; structure: string }>(
  items: readonly I[], n: number, lo: number, hi: number, rand: () => number = Math.random,
  accept?: (it: I) => boolean, key: (it: I) => string = (it) => JSON.stringify(it), also?: (it: I) => string,
): I[] {
  const byStructure = new Map<string, I[]>();
  for (const it of items) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const seenAlso = new Set<string>();
  const picks: I[] = [];
  for (let guard = 0; picks.length < n && guard < n * 40; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const s = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(s)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(s, (used.get(s) ?? 0) + 1);
    if (seen.has(key(it)) || (also && seenAlso.has(also(it)) && guard < n * 20)) continue;
    seen.add(key(it));
    if (also) seenAlso.add(also(it));
    picks.push(it);
  }
  return picks;
}

/** A linear logistic prediction: base + sum of weight x feature, rounded to hundredths. */
export const linearBeta = <F extends object>(f: F, w: Record<keyof F | 'base', number>): number =>
  Math.round((Object.keys(f) as (keyof F)[]).reduce((s, k) => s + w[k] * (f[k] as number), w.base) * 100) / 100;
