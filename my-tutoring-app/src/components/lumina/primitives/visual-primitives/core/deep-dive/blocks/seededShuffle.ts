/**
 * Deterministic Fisher-Yates keyed by a string seed (block id).
 *
 * Sort/order challenge blocks shuffle their content client-side. The shuffle
 * must be stable across server render + hydration (Math.random would mismatch
 * and throw hydration errors) and across re-renders without extra state — so
 * it is a pure function of the block id.
 */
export function seededShuffle<T>(items: readonly T[], seedStr: string): T[] {
  // FNV-1a hash of the seed string → 32-bit state
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // mulberry32 PRNG
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  // A shuffle that lands on the identity order would make an ordering
  // challenge trivially pre-solved — rotate by one so the student always
  // has real work to do.
  if (out.length > 1 && out.every((item, i) => item === items[i])) {
    out.push(out.shift() as T);
  }

  return out;
}
