// Word-space lab: does a code-only word library serve the published K/G1 literacy subskills?
//
// For every subskill: parse its scope from the curriculum text (scope.mjs), build every item the
// scope allows from the library (lexicon.mjs), give each a predicted beta from its structure, pick
// 5 items at easy / medium / hard across structures, then RE-CHECK every pick with an independent
// check (decodable under the scope, the answer correct, distractors wrong, nothing banned).
// No LLM anywhere. Output: qa/word-space-lab/<date>/REPORT.md + results.json.
//
//   node scripts/word-space-lab/lab.mjs [--grades K,1] [--out <dir>] [--seeds 3]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLexicon, harvestRepoPictures, rimeOf, onsetOf, VOWEL_PHONES, CONTINUANTS } from './lexicon.mjs';
import { parseScope, gpcsForLetters, BASIC_SOUND, ALPHABET } from './scope.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GRADES = arg('--grades', 'K,1').split(',').map((g) => (g === 'K' ? 'Kindergarten' : g));
const OUT = arg('--out', path.join(APP, 'qa', 'word-space-lab', new Date().toISOString().slice(0, 10)));
const SEEDS = Number(arg('--seeds', '3'));
const N = 5;
// Familiarity: subtitle-frequency rank. A K pool word must be at least this common.
const FAM = 15000;

// ---------------------------------------------------------------------------------------------
// Library
const L = loadLexicon(path.join(HERE, '.cache'));
const harvested = harvestRepoPictures(APP, L);
const ALL = [...L.words.values()];
// Build-time ratings (rate-words.mjs): grade known by, kid-safe, picture fits the word, category.
const RATINGS = JSON.parse(fs.readFileSync(path.join(HERE, '.cache', 'ratings.json'), 'utf8'));
let ALLOWED = new Set(['K']); // grades whose words a subskill may use; set per subskill
const rating = (e) => (e ? RATINGS[e.w] : null);
const familiar = (e) => { const r = rating(e); return !!r && r.kidSafe && r.teachable !== false && ALLOWED.has(r.knownBy) && !e.proper; };
const pictured = (e) => !!e?.picture && rating(e)?.pictureOk === true;
const STOP_PAIR = { P: 'B', B: 'P', T: 'D', D: 'T', K: 'G', G: 'K', M: 'N', N: 'M', F: 'V', V: 'F', S: 'Z', Z: 'S', CH: 'JH', JH: 'CH' };
const NEAR_VOWEL = { EH: ['IH', 'AE'], IH: ['EH', 'IY'], AE: ['EH', 'AA'], AA: ['AH', 'AO'], AO: ['AA', 'AH'], AH: ['AA', 'AO'] };
const oneSyl = (e) => e.syllables === 1;
const SHORT_V = new Set(['AE', 'EH', 'IH', 'AA', 'AO', 'AH']);
const vowelOf = (e) => e.phones.find((p) => VOWEL_PHONES.has(p));
const phoneKey = (ps) => ps.join(' ');
const allPronSet = new Set([...L.prons.values()].flat().map(phoneKey));

// Independent decodability check (re-derives from the alignment, not from the filter that chose it).
const missingGpcs = (e, known) => (e.gpcs ?? ['<no alignment>']).filter((g) => !known.has(g));

// ---------------------------------------------------------------------------------------------
// Picking: rank by beta, split into thirds, take structures least-used first (as math tierPick).
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function tierPick(items, tier, rand, n = N, quota) {
  if (quota) {
    // Focus words and review words are tiered separately: 2 of 3 picks use a new letter-sound, at the
    // tier's difficulty WITHIN the focus words (the new letters may all sit in harder words).
    const nf = Math.ceil((2 * n) / 3);
    const f = tierPick(items.filter(quota), tier, rand, nf);
    const r = tierPick(items.filter((it) => !quota(it)), tier, rand, n - nf);
    if (f.note) return f;
    const seen = new Set(f.picks.flatMap((p) => p.words));
    return { picks: [...f.picks, ...(r.picks.length ? r.picks : tierPick(items.filter(quota), tier, rand, n).picks).filter((p) => !p.words.some((w) => seen.has(w)))].slice(0, n) };
  }
  const sorted = [...items].sort((a, b) => a.beta - b.beta || a.id.localeCompare(b.id));
  const third = Math.floor(sorted.length / 3);
  if (sorted.length < 3 * Math.max(n, 3)) return { picks: [], note: `only ${sorted.length} items: fewer than ${3 * n}, tiers not separable` };
  const band = tier === 0 ? sorted.slice(0, third) : tier === 1 ? sorted.slice(third, 2 * third) : sorted.slice(2 * third);
  const byStruct = new Map();
  for (const it of band) { const l = byStruct.get(it.structure) ?? []; l.push(it); byStruct.set(it.structure, l); }
  for (const l of byStruct.values()) l.sort(() => rand() - 0.5);
  const used = new Map(); const picks = []; const seenWords = new Set();
  const structs = [...byStruct.keys()].sort(() => rand() - 0.5);
  let guard = 0;
  while (picks.length < n && guard++ < 500) {
    structs.sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0));
    let progressed = false;
    for (const s of structs) {
      const l = byStruct.get(s);
            const idx = l.findIndex((it) => !it.words.some((w) => seenWords.has(w)));
      if (idx < 0) continue;
      const [it] = l.splice(idx, 1);
      picks.push(it); it.words.forEach((w) => seenWords.add(w)); used.set(s, (used.get(s) ?? 0) + 1); progressed = true;
      break;
    }
    if (!progressed) break;
  }
  return { picks };
}

// ---------------------------------------------------------------------------------------------
// Task builders. Each returns { items, check(item) -> string[] (violations), poolNote, hopperWords }.
const show = (e) => `${e.w}${e.picture ? ' ' + e.picture.emoji : ''}`;
const famBeta = (e) => ({ K: 0, G1: 0.4, G2: 0.8 }[rating(e)?.knownBy] ?? 1) + (e.rank > 5000 ? 0.2 : 0);

function wordDecodeItems(scope, { needPicture = false } = {}) {
  const known = scope.known;
  const out = [];
  for (const e of ALL) {
    if (!familiar(e) || !e.gpcs || !oneSyl(e)) continue;
    if (missingGpcs(e, known).length) continue;
    if (scope.shapes && !scope.shapes.includes(e.shape)) continue;
    if (scope.singleLetters && !e.singleLetters) continue;
    if (e.shape === 'CVCe' && e.w.at(-2) === 'r') continue; // here, care: r-controlled, not silent-e
    if (scope.focus && scope.focusRule !== 'most' && !e.gpcs.some((g) => scope.focus.has(g))) continue;
    if (scope.onsetClusters && !scope.onsetClusters.includes(e.w.slice(0, 2))) continue;
    if (scope.codaClusters && !scope.codaClusters.includes(e.w.slice(-2))) continue;
    if (needPicture && !pictured(e)) continue;
    const v = vowelOf(e);
    const beta = 0.4 * (e.phones.length - 3) + (CONTINUANTS.has(e.phones[0]) ? 0 : 0.3)
      + ({ EH: 0.4, IH: 0.2, AH: 0.2, AA: 0.1, AO: 0.1 }[v] ?? 0) + (e.singleLetters ? 0 : 0.3) + famBeta(e);
    out.push({ id: e.w, words: [e.w], beta, structure: `${e.shape}:${v}:${CONTINUANTS.has(e.phones[0]) ? 'cont' : 'stop'}`,
      show: show(e), answer: e.w, focusHit: !!scope.focus && e.gpcs.some((g) => scope.focus.has(g)) });
  }
  const check = (it) => {
    const e = L.words.get(it.answer); const v = [];
    const miss = missingGpcs(e, known); if (miss.length) v.push(`not decodable: ${miss.join(',')}`);
    if (L.bad.has(e.w) || e.proper) v.push('banned or proper noun');
    if (scope.shapes && !scope.shapes.includes(e.shape)) v.push(`shape ${e.shape}`);
    if (scope.focusRule === 'every' && scope.focus && !e.gpcs.some((g) => scope.focus.has(g))) v.push('no focus GPC');
    return v;
  };
  return { items: out, check, quota: scope.focusRule === 'most' && scope.focus ? (it) => it.focusHit : null };
}

// A nonsense CVC: pronounceable, spelled with known letters, not a real word, a name or a homophone of one.
const isNonsense = (s) => /^[bcdfghjklmnprstwyz][aeiou][bcdfgklmnprstxz]$/.test(s) && !L.prons.has(s) && !L.dicLower.has(s) && !L.dicUpper.has(s)
  && !L.bad.has(s) && !allPronSet.has(phoneKey([...s].flatMap((ch) => BASIC_SOUND[ch][0].split(' '))));
function realNonsenseItems(scope) {
  // Items are PAIRS: the nonsense partner sets the difficulty. far = 2-3 letters differ; consonant = one
  // consonant differs; vowel = only the vowel differs (cat vs cet: the careful-decoding case).
  const base = wordDecodeItems({ ...scope, singleLetters: true }).items;
  const cons = ALPHABET.filter((l) => l.length === 1 && !'aeiou'.includes(l));
  const items = [];
  for (const it of base) {
    const real = it.answer; const byKind = { far: [], consonant: [], vowel: [] };
    for (const a of cons) for (const v of 'aeiou') for (const b of cons) {
      const s = a + v + b; if (!isNonsense(s)) continue;
      const diff = [0, 1, 2].filter((i) => s[i] !== real[i]);
      if (diff.length >= 2) byKind.far.push(s); else if (diff.length === 1) byKind[diff[0] === 1 ? 'vowel' : 'consonant'].push(s);
    }
    for (const [kind, list] of Object.entries(byKind)) {
      if (!list.length) continue;
      const fake = list[[...real].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length];
      items.push({ ...it, id: `${real}/${fake}`, words: [real], nonsense: fake, beta: it.beta + { far: -0.6, consonant: 0.2, vowel: 0.8 }[kind],
        structure: `${kind}:${it.structure.split(':')[1]}`, show: `${real} vs ${fake}`, answer: real });
    }
  }
  const check = (it) => (isNonsense(it.nonsense) && !isNonsense(it.answer) ? [] : ['nonsense partner is a real word or the real word is not']);
  return { items, check };
}

function rhymeItems(kind) {
  const pool = ALL.filter((e) => familiar(e) && pictured(e) && oneSyl(e) && e.alignment);
  const byRime = new Map();
  for (const e of pool) { const r = rimeOf(e.phones); const l = byRime.get(r) ?? []; l.push(e); byRime.set(r, l); }
  const items = [];
  const rhymes = (a, b) => rimeOf(a.phones) === rimeOf(b.phones);
  const sharesOnset = (a, b) => phoneKey(onsetOf(a.phones)) === phoneKey(onsetOf(b.phones)) && onsetOf(a.phones).length > 0;
  const sharesVowel = (a, b) => vowelOf(a) === vowelOf(b);
  const distractorKind = (t, d) => (sharesOnset(t, d) ? 'onset' : sharesVowel(t, d) ? 'vowel' : 'far');
  if (kind === 'rhyme-produce') {
    // Accepted answers = every familiar word with the same rime (pictured or not): the judge key.
    const famRime = new Map();
    for (const e of ALL) if (familiar(e) && oneSyl(e)) { const r = rimeOf(e.phones); famRime.set(r, (famRime.get(r) ?? 0) + 1); }
    for (const e of pool) {
      const size = famRime.get(rimeOf(e.phones)) - 1;
      if (size < 3) continue;
      items.push({ id: e.w, words: [e.w], beta: -0.5 * Math.log2(size) + famBeta(e) + 2, structure: `${vowelOf(e)}:${size >= 12 ? 'big' : 'small'}`,
        show: `${show(e)} -> say a rhyme`, answer: `${size} accepted rhymes` });
    }
    return { items, check: () => [] };
  }
  if (kind === 'rhyme-family') {
    for (const [r, l] of byRime) {
      const cvc = l.filter((e) => e.shape === 'CVC' && e.singleLetters);
      if (cvc.length < 3) continue;
      const tail = cvc[0].w.slice(1);
      const fam = cvc.filter((e) => e.w.slice(1) === tail);
      if (fam.length < 3) continue;
      items.push({ id: r, words: fam.slice(0, 3).map((e) => e.w), beta: { AE: 0, IH: 0.2, AA: 0.3, AO: 0.3, AH: 0.4, EH: 0.5 }[vowelOf(fam[0])] ?? 0.5,
        structure: vowelOf(fam[0]), show: `-${tail}: ${fam.slice(0, 3).map(show).join(', ')}`, answer: fam.map((e) => e.w).join('/') });
    }
    return { items, check: (it) => (it.words.every((w) => rimeOf(L.words.get(w).phones) === it.id) ? [] : ['family member does not rhyme']) };
  }
  for (const [, fam] of byRime) {
    for (const t of fam.slice(0, 6)) {
      const partner = fam.find((e) => e !== t && !sharesOnset(e, t));
      if (!partner) continue;
      const others = pool.filter((e) => !rhymes(e, t) && e.w !== t.w);
      const onsetD = others.filter((d) => distractorKind(t, d) === 'onset');
      const vowelD = others.filter((d) => distractorKind(t, d) === 'vowel');
      const farD = others.filter((d) => distractorKind(t, d) === 'far');
      const pick = (l, k) => l[(t.w.length * 7 + k * 13 + partner.w.length) % l.length];
      if (kind === 'rhyme-recognize') {
        items.push({ id: `${t.w}+${partner.w}`, words: [t.w, partner.w], beta: -0.6 + famBeta(t), structure: 'yes', show: `${show(t)} / ${show(partner)}`, answer: 'yes', pair: [t, partner] });
        if (farD.length) { const d = pick(farD, 1); items.push({ id: `${t.w}-${d.w}`, words: [t.w, d.w], beta: -0.4, structure: 'no-far', show: `${show(t)} / ${show(d)}`, answer: 'no', pair: [t, d] }); }
        if (vowelD.length) { const d = pick(vowelD, 2); items.push({ id: `${t.w}-${d.w}`, words: [t.w, d.w], beta: 0.4, structure: 'no-vowel', show: `${show(t)} / ${show(d)}`, answer: 'no', pair: [t, d] }); }
        if (onsetD.length) { const d = pick(onsetD, 3); items.push({ id: `${t.w}-${d.w}`, words: [t.w, d.w], beta: 0.9, structure: 'no-onset', show: `${show(t)} / ${show(d)}`, answer: 'no', pair: [t, d] }); }
      } else {
        // identify: target + rhyme + 2 distractors; harder = nearer distractors.
        const sets = [
          { s: 'far', ds: [pick(farD, 1), pick(farD, 2)], beta: -0.5 },
          { s: 'vowel', ds: vowelD.length ? [pick(vowelD, 1), pick(farD, 2)] : null, beta: 0.2 },
          { s: 'onset+vowel', ds: onsetD.length && vowelD.length ? [pick(onsetD, 1), pick(vowelD, 2)] : null, beta: 0.9 },
        ];
        for (const { s, ds, beta } of sets) {
          if (!ds || ds.some((d) => !d) || ds[0] === ds[1]) continue;
          items.push({ id: `${t.w}:${partner.w}:${s}`, words: [t.w, partner.w, ...ds.map((d) => d.w)], beta: beta + famBeta(t), structure: s,
            show: `${show(t)} -> ${[partner, ...ds].map(show).join(' | ')}`, answer: partner.w, target: t, options: [partner, ...ds] });
        }
      }
    }
  }
  const check = (it) => {
    const v = [];
    if (kind === 'rhyme-recognize') { const yes = rhymes(it.pair[0], it.pair[1]); if ((it.answer === 'yes') !== yes) v.push('answer key wrong'); }
    else { const right = it.options.filter((o) => rhymes(o, it.target)); if (right.length !== 1 || right[0].w !== it.answer) v.push(`options that rhyme: ${right.map((o) => o.w)}`); }
    return v;
  };
  return { items, check };
}

function compoundSplit(e) {
  for (let i = 2; i <= e.w.length - 2; i++) {
    const a = L.words.get(e.w.slice(0, i)); const b = L.words.get(e.w.slice(i));
    if (!familiar(a) || !familiar(b) || a.w.length < 3 || b.w.length < 3) continue;
    for (const pa of a.allPhones) for (const pb of b.allPhones) if (phoneKey([...pa, ...pb]) === phoneKey(e.phones)) return [a.w, b.w];
  }
  return null;
}
function syllableItems(kind) {
  const items = [];
  for (const e of ALL) {
    if (!familiar(e) || !pictured(e) || e.syllables < 1 || e.syllables > 4) continue;
    const parts = compoundSplit(e);
    if (kind === 'syllable-blend' && !(parts && e.syllables === 2)) continue;
    if (kind === 'syllable-segment' && e.syllables < 2) continue;
    const beta = e.syllables === 2 ? (parts ? 0 : 0.5) : e.syllables === 3 ? 1.0 : 1.5;
    items.push({ id: e.w, words: [e.w], beta: beta + famBeta(e), structure: `${e.syllables}:${parts ? 'compound' : 'plain'}`,
      show: kind === 'syllable-blend' ? `${parts.join(' ... ')} ${e.picture.emoji}` : show(e), answer: kind === 'syllable-blend' ? e.w : String(e.syllables) });
  }
  return { items, check: (it) => (kind === 'syllable-segment' && Number(it.answer) !== L.words.get(it.id).phones.filter((p) => VOWEL_PHONES.has(p)).length ? ['count wrong'] : []) };
}

function soundPositionItems(kind) {
  const pool = ALL.filter((e) => familiar(e) && pictured(e) && oneSyl(e) && e.alignment && e.phones.length >= 2 && e.phones.length <= 4);
  const at = (e) => (kind === 'sound-initial' ? e.phones[0] : kind === 'sound-final' ? e.phones[e.phones.length - 1] : vowelOf(e));
  const items = [];
  for (const t of pool) {
    if (kind === 'sound-medial' && !(t.phones.length === 3 && t.shape === 'CVC' && SHORT_V.has(t.phones[1]) && t.phones[2] !== 'R')) continue;
    const T = at(t);
    if (kind !== 'sound-medial' && VOWEL_PHONES.has(T)) continue;
    const others = pool.filter((d) => at(d) !== T && (kind !== 'sound-medial' || (d.phones.length === 3 && d.shape === 'CVC' && SHORT_V.has(d.phones[1]) && d.phones[2] !== 'R')));
    const near = others.filter((d) => (kind === 'sound-medial' ? (NEAR_VOWEL[T] ?? []).includes(at(d)) : STOP_PAIR[T] === at(d)));
    const far = others.filter((d) => !near.includes(d));
    if (far.length < 3) continue;
    const h = [...t.w].reduce((a, c) => a + c.charCodeAt(0), 0);
    const pickFrom = (l, k) => l[(h * 31 + k * 17) % l.length];
    const cont = CONTINUANTS.has(T);
    const posBeta = kind === 'sound-initial' ? 0 : kind === 'sound-final' ? 0.6 : 1.2;
    const variants = [{ s: 'far', ds: [pickFrom(far, 1), pickFrom(far, 2), pickFrom(far, 3)], b: 0 }];
    if (near.length) variants.push({ s: 'near', ds: [pickFrom(near, 1), pickFrom(far, 2), pickFrom(far, 3)], b: 0.7 });
    for (const { s, ds, b } of variants) {
      if (new Set(ds.map((d) => d.w)).size < 3) continue;
      items.push({ id: `${t.w}:${s}`, words: [t.w, ...ds.map((d) => d.w)], beta: posBeta + b + (cont || kind === 'sound-medial' ? 0 : 0.3) + famBeta(t),
        structure: `${s}:${cont ? 'cont' : 'stop'}`, show: `/${T}/ ? ${[t, ...ds].map(show).join(' | ')}`, answer: t.w, T, options: [t, ...ds] });
    }
  }
  const check = (it) => { const hits = it.options.filter((o) => at(o) === it.T); return hits.length === 1 && hits[0].w === it.answer ? [] : [`${hits.length} options have /${it.T}/`]; };
  return { items, check };
}

function phonemeItems(kind) {
  const items = [];
  for (const e of ALL) {
    if (!familiar(e) || !pictured(e) || !oneSyl(e) || !e.alignment || e.phones.length < 2 || e.phones.length > 4) continue;
    if (kind === 'onset-rime-blend' || kind === 'onset-rime-split') {
      const on = onsetOf(e.phones); if (!on.length) continue;
      items.push({ id: e.w, words: [e.w], beta: (on.length > 1 ? 0.6 : 0) + (CONTINUANTS.has(on[0]) ? -0.3 : 0) + famBeta(e), structure: `onset${on.length}`,
        show: kind === 'onset-rime-blend' ? `/${on.join(' ')}/ + /${rimeOf(e.phones)}/ ${e.picture.emoji}` : show(e), answer: kind === 'onset-rime-blend' ? e.w : `${on.join(' ')} + ${rimeOf(e.phones)}` });
      continue;
    }
    if (e.phones.length !== 3 || !VOWEL_PHONES.has(e.phones[1]) || e.shape !== 'CVC') continue; // "three phonemes ... CVC word"
    const conts = e.phones.filter((p) => CONTINUANTS.has(p)).length;
    const beta = (SHORT_V.has(e.phones[1]) ? 0.3 : 0) + ({ EH: 0.3, IH: 0.2 }[e.phones[1]] ?? 0) - 0.25 * conts + famBeta(e);
    items.push({ id: e.w, words: [e.w], beta, structure: `${e.phones.length}:${e.shape}`,
      show: kind === 'phoneme-blend' ? `/${e.phones.join('/ /')}/ ${e.picture.emoji}` : show(e), answer: kind === 'phoneme-blend' ? e.w : `${e.phones.length}: ${e.phones.join(' ')}` });
  }
  return { items, check: () => [] };
}

function swapItems(kind) {
  const pool = ALL.filter((e) => familiar(e) && oneSyl(e) && e.alignment && e.phones.length <= 5);
  const items = [];
  const seen = new Set();
  for (const a of pool) {
    const P = a.phones;
    if (kind === 'swap-add' || kind === 'swap-delete') {
      // a + one phoneme = b.  add: say a, add /x/; delete: say b, take away /x/.
      for (const b of pool) {
        const Q = b.phones; if (Q.length !== P.length + 1 || a.w === b.w) continue;
        let pos = null;
        if (phoneKey(Q.slice(1)) === phoneKey(P)) pos = 'initial'; else if (phoneKey(Q.slice(0, -1)) === phoneKey(P)) pos = 'final';
        if (!pos) continue;
        if (pos === 'final' && (b.w === a.w + 's' || b.w === a.w + 'es' || b.w === a.w + 'ed' || b.w === a.w + 'd')) continue;
        const x = pos === 'initial' ? Q[0] : Q[Q.length - 1];
        const cluster = pos === 'initial' ? !VOWEL_PHONES.has(P[0]) : !VOWEL_PHONES.has(P[P.length - 1]);
        const key = `${a.w}|${b.w}`; if (seen.has(key)) continue; seen.add(key);
        const beta = (pos === 'final' ? 0.4 : 0) + (cluster ? 0.6 : 0) + (kind === 'swap-delete' ? 0.3 : 0) + famBeta(b);
        items.push(kind === 'swap-add'
          ? { id: key, words: [a.w, b.w], beta, structure: `${pos}:${cluster ? 'cluster' : 'simple'}`, show: `${a.w} + /${x}/ (${pos})`, answer: b.w, from: a, to: b, x, pos }
          : { id: key, words: [a.w, b.w], beta, structure: `${pos}:${cluster ? 'cluster' : 'simple'}`, show: `${b.w} - /${x}/ (${pos})`, answer: a.w, from: b, to: a, x, pos });
      }
    } else {
      for (const b of pool) {
        const Q = b.phones; if (Q.length !== P.length || P.length !== 3 || a.w >= b.w) continue;
        const diff = [0, 1, 2].filter((i) => P[i] !== Q[i]); if (diff.length !== 1) continue;
        const pos = ['initial', 'medial', 'final'][diff[0]];
        items.push({ id: `${a.w}>${b.w}`, words: [a.w, b.w], beta: { initial: 0, final: 0.4, medial: 0.8 }[pos] + famBeta(b), structure: pos,
          show: `${a.w}: change /${P[diff[0]]}/ to /${Q[diff[0]]}/`, answer: b.w, from: a, to: b });
      }
    }
  }
  const check = (it) => {
    const p = it.from.phones; const q = it.to.phones;
    if (kind === 'swap-substitute') return p.filter((x, i) => x !== q[i]).length === 1 ? [] : ['not one-phoneme change'];
    const ok = kind === 'swap-add' ? (it.pos === 'initial' ? phoneKey(q) === phoneKey([it.x, ...p]) : phoneKey(q) === phoneKey([...p, it.x]))
      : (it.pos === 'initial' ? phoneKey(p) === phoneKey([it.x, ...q]) : phoneKey(p) === phoneKey([...q, it.x]));
    return ok ? [] : ['phonemes do not add up'];
  };
  return { items, check };
}

function vowelLengthItems() {
  // Oral: hear a pictured one-syllable word, say whether its vowel is long or short.
  const LONG = new Set(['EY', 'IY', 'AY', 'OW', 'UW']);
  const items = [];
  for (const e of ALL) {
    if (!familiar(e) || !pictured(e) || !oneSyl(e) || !e.alignment) continue;
    const v = vowelOf(e); const len = LONG.has(v) ? 'long' : SHORT_V.has(v) ? 'short' : null;
    if (!len || e.phones.includes('R')) continue;
    items.push({ id: e.w, words: [e.w], beta: (len === 'long' ? 0.2 : 0) + ({ EH: 0.4, IH: 0.3 }[v] ?? 0) + (e.phones.length > 3 ? 0.3 : 0) + famBeta(e),
      structure: `${len}:${v}`, show: show(e), answer: `${len} (${v})` });
  }
  return { items, check: (it) => (it.answer.startsWith(SHORT_V.has(vowelOf(L.words.get(it.id))) ? 'short' : 'long') ? [] : ['length wrong']) };
}

function longShortItems() {
  const items = [];
  for (const e of ALL) {
    if (!familiar(e) || e.shape !== 'CVC' || !e.singleLetters || !SHORT_V.has(e.phones[1])) continue;
    const l = L.words.get(e.w + 'e');
    if (!familiar(l) || l.shape !== 'CVCe') continue;
    const v = e.w[1];
    items.push({ id: e.w, words: [e.w, l.w], beta: ({ a: 0, i: 0.1, o: 0.2, u: 0.5, e: 0.6 }[v]) + famBeta(l), structure: v, show: `${show(e)} / ${show(l)}`, answer: `${e.gpcs[1]} vs ${l.gpcs[1]}`, short: e, long: l });
  }
  return { items, check: (it) => (it.short.gpcs[1].endsWith('_e') || !it.long.gpcs[1].includes('_e') ? ['pair not short/long'] : []) };
}

function sightItems() {
  // Tricky words = the most frequent words a learner cannot sound out with basic sounds, short vowels,
  // digraphs and double letters. Computed, not listed.
  const decodable = new Set([...gpcsForLetters(ALPHABET), 'sh/SH', 'ch/CH', 'th/TH', 'th/DH', 'wh/W', 'ng/NG', 'ss/S', 'll/L', 'ff/F', 'zz/Z', 'a_e/EY', 'i_e/AY', 'o_e/OW', 'u_e/UW', 'ee/IY', 'ay/EY']);
  const items = [];
  for (const [w, r] of L.rank) {
    if (r > 400) continue;
    const e = L.words.get(w); if (!e || e.proper || w.length < 2 && w !== 'a' && w !== 'i') continue;
    if (e.gpcs && !missingGpcs(e, decodable).length) continue;
    items.push({ id: w, words: [w], beta: Math.log10(r) - 1.5 + 0.1 * w.length, structure: e.gpcs ? 'irregular-part' : 'no-alignment', show: w, answer: w,
      why: e.gpcs ? missingGpcs(e, decodable).join(',') : e.phones.join(' ') });
  }
  return { items, check: () => [] };
}

// Concrete K categories from the build-time ratings; a picture must show the word. "Near" pairs are
// categories a child confuses more (food vs drink), so an odd one from a near category is harder.
const CONCEPT_CATS = ['animal', 'food', 'drink', 'clothing', 'vehicle', 'body', 'home', 'toy', 'nature', 'weather', 'tool', 'music', 'sport', 'school', 'color', 'place'];
const NEAR_CATS = [['food', 'drink'], ['clothing', 'body'], ['toy', 'sport'], ['nature', 'weather'], ['home', 'tool'], ['school', 'home'], ['toy', 'music'], ['animal', 'nature']];
// Categories children sort reliably (animals, food) vs ones that need more knowledge (tools, weather, places).
const CAT_BETA = { animal: 0, food: 0, clothing: 0, vehicle: 0, body: 0.1, color: 0.1, toy: 0.3, home: 0.3, drink: 0.3, sport: 0.4, music: 0.4,
  school: 0.6, tool: 0.6, nature: 0.6, weather: 0.7, place: 0.7 };
const nearCats = (a, b) => NEAR_CATS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
function conceptItems(kind) {
  const byCat = new Map();
  for (const e of ALL) {
    const r = rating(e);
    if (!familiar(e) || !pictured(e) || !CONCEPT_CATS.includes(r.category)) continue;
    const l = byCat.get(r.category) ?? []; l.push(e); byCat.set(r.category, l);
  }
  const cats = [...byCat.keys()].filter((c) => byCat.get(c).length >= 4);
  const items = [];
  for (const a of cats) for (const b of cats) {
    if (a === b) continue;
    const near = nearCats(a, b);
    const A = byCat.get(a).sort((x, y) => x.rank - y.rank); const B = byCat.get(b).sort((x, y) => x.rank - y.rank);
    for (let k = 0; k + 3 <= Math.min(A.length, 12); k += 3) {
      const three = A.slice(k, k + 3);
      const odd = B.find((o, i) => i >= k % B.length && !three.some((m) => m.w.startsWith(o.w.slice(0, 4)) || o.w.startsWith(m.w.slice(0, 4))));
      if (!odd) continue;
      const beta = (near ? 0.8 : 0) + CAT_BETA[a] + 0.5 * CAT_BETA[b] + three.concat(odd).reduce((s2, e) => s2 + famBeta(e), 0) / 4 + (kind === 'concept-sort' ? -0.2 : 0);
      items.push({ id: `${a}/${b}/${k}`, words: [...three, odd].map((e) => e.w), beta, structure: `${near ? 'near' : 'far'}:${a}`,
        show: kind === 'concept-picture-match' ? `${three[0].w} -> ${[three[0], odd, B[(k + 1) % B.length], three[1]].map((e) => e.picture.emoji).join(' ')}`
          : `${[...three, odd].map(show).join(', ')}${kind === 'concept-sort' ? ` (sort: ${a} vs ${b})` : ''}`,
        answer: kind === 'concept-picture-match' ? three[0].picture.emoji : odd.w, odd, cat: a, three });
    }
  }
  const check = (it) => {
    const v = [];
    if (rating(it.odd).category === it.cat) v.push('odd one is in the category');
    if (it.three.some((e) => rating(e).category !== it.cat)) v.push('a member is outside the category');
    return v;
  };
  return { items, check, note: `categories: ${cats.map((c) => `${c}(${byCat.get(c).length})`).join(', ')}` };
}

function letterItems(scope) {
  // Letters are the items; the library supplies keyword pictures (letter-sound) and the decodable
  // word hopper the same group opens for blending/spelling (the "s a t i p n -> words" question).
  const kw = [];
  for (const l of scope.focusLetters) {
    const sounds = (BASIC_SOUND[l] ?? []).map((p) => p.split(' ')[0]);
    const cands = ALL.filter((e) => familiar(e) && pictured(e) && e.gpcs && e.gpcs[0].startsWith(`${l}/`) && sounds.includes(e.phones[0]))
      .sort((a, b) => (onsetOf(a.phones).length - onsetOf(b.phones).length) || (a.syllables - b.syllables) || (a.rank - b.rank));
    kw.push({ letter: l, count: cands.length, sample: cands.slice(0, 4).map(show) });
  }
  return kw;
}

// ---------------------------------------------------------------------------------------------
function exampleRecall(examples, items, scope) {
  if (!examples.length) return null;
  const inHop = new Set(items.flatMap((it) => it.words));
  return examples.map((x) => {
    const w = x.split('/')[0];
    if (inHop.has(w)) return { w: x, ok: true };
    const e = L.words.get(w);
    let why = 'not in library';
    if (e) {
      const rr = rating(e); if (e.proper) why = 'proper noun'; else if (!rr) why = `unrated (rank ${e.rank})`; else if (!rr.kidSafe) why = 'not kid-safe'; else if (!ALLOWED.has(rr.knownBy)) why = `known by ${rr.knownBy}`; else if (!e.gpcs) why = `no alignment (${e.phones.join(' ')})`;
      else if (scope.known && missingGpcs(e, scope.known).length) why = `not decodable: ${missingGpcs(e, scope.known).join(',')}`;
      else if (scope.shapes && !scope.shapes.includes(e.shape)) why = `shape ${e.shape}`;
      else if (!pictured(e)) why = e.picture ? `picture does not fit (${e.picture.emoji})` : 'no picture'; else why = 'filtered by task rule';
    } else if (L.bad.has(w)) why = 'deny list';
    else if (L.prons.has(w)) why = `rank ${L.rank.get(w) ?? '>50k'}`;
    return { w: x, ok: false, why };
  });
}

function lettersOnlyContrast(scope) {
  // What today's letter filter admits for this group that the GPC filter rejects.
  const letters = new Set(scope.knownLetters.flatMap((l) => (l === 'qu' ? ['q', 'u'] : [l])));
  const admitted = ALL.filter((e) => familiar(e) && e.w.length >= 2 && [...e.w].every((c) => letters.has(c)));
  const rejected = admitted.filter((e) => !e.gpcs || missingGpcs(e, scope.known).length).sort((a, b) => a.rank - b.rank);
  return { admitted: admitted.length, rejected: rejected.length,
    sample: rejected.slice(0, 14).map((e) => `${e.w} (${e.gpcs ? missingGpcs(e, scope.known).join(',') : 'irregular'})`) };
}

// ---------------------------------------------------------------------------------------------
const subs = JSON.parse(fs.readFileSync(path.join(HERE, '.cache', 'la_subskills.json'), 'utf8'))
  .filter((s) => GRADES.includes(s.grade))
  .filter((s) => /phon|alphabet|word recognition|reading foundations|vocabulary|decoding|word study/i.test(s.unit));

const results = [];
for (const sub of subs) {
  const scope = parseScope(sub);
  ALLOWED = new Set(sub.grade === 'Kindergarten' ? ['K'] : ['K', 'G1']);
  if (scope.task.startsWith('letter-') || (scope.task.startsWith('concept') && sub.grade === 'Kindergarten')) scope.examples = [];
  const r = { id: sub.subskill_id, grade: sub.grade === 'Kindergarten' ? 'K' : sub.grade, unit: sub.unit, primitive: sub.target_primitive,
    title: scope.title, task: scope.task, why: scope.why };
  if (scope.task === 'none') { results.push(r); continue; }

  let built;
  if (scope.task.startsWith('letter-')) {
    r.letters = { known: scope.knownLetters, focus: scope.focusLetters };
    if (scope.task === 'letter-sound') r.keywords = letterItems(scope);
    // The decodable hopper this group opens (focus = new letters, 2 of 3 picks must use one).
    built = wordDecodeItems({ ...scope, focusRule: 'most', shapes: ['VC', 'CVC', 'CCVC', 'CVCC'] });
    r.contrast = lettersOnlyContrast(scope);
  } else if (['decode', 'encode', 'decode-picture'].includes(scope.task)) built = wordDecodeItems(scope, { needPicture: scope.task === 'decode-picture' });
  else if (scope.task === 'real-vs-nonsense') built = realNonsenseItems(scope);
  else if (scope.task.startsWith('rhyme')) built = rhymeItems(scope.task);
  else if (scope.task.startsWith('syllable')) built = syllableItems(scope.task);
  else if (scope.task.startsWith('sound-')) built = soundPositionItems(scope.task);
  else if (scope.task.startsWith('phoneme') || scope.task.startsWith('onset-rime')) built = phonemeItems(scope.task);
  else if (scope.task.startsWith('swap')) built = swapItems(scope.task);
  else if (scope.task === 'long-short-pairs') built = longShortItems();
  else if (scope.task === 'vowel-length') built = vowelLengthItems();
  else if (scope.task === 'sight') built = sightItems();
  else if (scope.task.startsWith('concept')) built = conceptItems(scope.task);

  r.hopper = built.items.length;
  r.hopperPictured = new Set(built.items.flatMap((it) => it.words).filter((w) => pictured(L.words.get(w)))).size;
  r.hopperWords = new Set(built.items.flatMap((it) => it.words)).size;
  r.note = built.note;
  r.examples = exampleRecall(scope.examples, built.items, scope);
  r.tiers = [];
  r.violations = [];
  const distinctAcrossSeeds = [new Set(), new Set(), new Set()];
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (let tier = 0; tier < 3; tier++) {
      const rand = mulberry32(seed * 1000 + tier);
      const { picks, note } = tierPick(built.items, tier, rand, N, built.quota);
      if (note) { r.tierNote = note; continue; }
      picks.forEach((p) => distinctAcrossSeeds[tier].add(p.id));
      for (const p of picks) for (const v of built.check(p)) r.violations.push(`${p.id}: ${v}`);
      if (picks.length < N) r.violations.push(`seed ${seed} tier ${tier}: only ${picks.length} picks`);
      if (built.quota && picks.filter(built.quota).length < Math.ceil((2 * N) / 3)) r.violations.push(`seed ${seed} tier ${tier}: focus quota missed`);
      if (seed === 1) r.tiers[tier] = { range: picks.length ? [Math.min(...picks.map((p) => p.beta)), Math.max(...picks.map((p) => p.beta))] : null, meanBeta: picks.length ? picks.reduce((s, p) => s + p.beta, 0) / picks.length : null, picks: picks.map((p) => ({ show: p.show, answer: p.answer, beta: +p.beta.toFixed(2) })) };
    }
  }
  r.variety = distinctAcrossSeeds.map((s) => s.size);
  const mb = r.tiers.map((t) => t?.meanBeta);
  r.ordered = mb.length === 3 && mb.every((x) => x != null) ? mb[0] < mb[1] && mb[1] < mb[2] : null;
  results.push(r);
}

// ---------------------------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
const md = [];
const lex = ALL.filter((e) => e.gpcs && familiar(e));
md.push(`# Word-space lab: K/G1 literacy subskills vs a code-only word library`, '',
  `Run ${new Date().toISOString()} · grades ${GRADES.join(', ')} · ${subs.length} subskills · ${SEEDS} seeds × 3 tiers × ${N} picks · no LLM.`, '',
  `Library: ${ALL.length} words (CMU ∩ subtitle top-40k, deny-listed removed); ${Object.keys(RATINGS).length} rated (${Object.values(RATINGS).filter((r) => r.knownBy === 'K' && r.kidSafe).length} known by K and kid-safe); ${lex.length} usable at K with a letter-sound alignment; `
  + `${ALL.filter((e) => e.picture).length} with a picture (Unicode names + ${harvested.size} repo table entries).`, '');
const covered = results.filter((r) => r.task !== 'none');
md.push(`## Summary`, '', `| | count |`, `|---|---|`,
  `| subskills scanned | ${results.length} |`, `| served by the library | ${covered.length} |`,
  `| not a word-level task (LLM band / needs a curated table) | ${results.length - covered.length} |`,
  `| served, all picks pass the independent re-check | ${covered.filter((r) => !r.violations.length).length} |`,
  `| served, easy < medium < hard by predicted β | ${covered.filter((r) => r.ordered).length} |`, '');
md.push(`| G | subskill | task | hopper (words / pictured) | examples in hopper | E<M<H | variety E/M/H over ${SEEDS} seeds | violations |`, `|---|---|---|---|---|---|---|---|`);
for (const r of results) {
  if (r.task === 'none') continue;
  const ex = r.examples ? `${r.examples.filter((e) => e.ok).length}/${r.examples.length}` : '-';
  md.push(`| ${r.grade} | ${r.title.replace(/\|/g, '/')} | ${r.task} | ${r.hopper} items · ${r.hopperWords} / ${r.hopperPictured} | ${ex} | ${r.ordered == null ? r.tierNote ?? '-' : r.ordered ? 'yes' : 'NO'} | ${r.variety.join('/')} | ${r.violations.length} |`);
}
md.push('', '## Detail', '');
for (const r of results) {
  if (r.task === 'none') continue;
  md.push(`### ${r.grade} · ${r.title}`, '', `task \`${r.task}\` · curriculum primitive \`${r.primitive}\` · hopper ${r.hopper} items over ${r.hopperWords} words (${r.hopperPictured} pictured)`, '');
  if (r.letters) md.push(`- letters known: ${r.letters.known?.join(' ')} · focus: ${r.letters.focus.join(' ')}`);
  if (r.keywords) md.push(`- keyword pictures per focus letter: ${r.keywords.map((k) => `**${k.letter}** ${k.count} (${k.sample.join(', ')})`).join(' · ')}`);
  if (r.contrast) md.push(`- letters-only filter admits ${r.contrast.admitted} familiar words; GPC filter rejects ${r.contrast.rejected} of them, e.g. ${r.contrast.sample.join(', ')}`);
  if (r.note) md.push(`- ${r.note}`);
  if (r.examples) md.push(`- curriculum examples: ${r.examples.map((e) => (e.ok ? e.w : `~~${e.w}~~ (${e.why})`)).join(', ')}`);
  if (r.tierNote) md.push(`- ${r.tierNote}`);
  ['Easy', 'Medium', 'Hard'].forEach((name, i) => { const t = r.tiers[i]; if (t) md.push(`- **${name}** (β̄ ${t.meanBeta?.toFixed(2)}): ${t.picks.map((p) => `${p.show}${p.answer && !p.show.startsWith(p.answer) ? ` → ${p.answer}` : ''}`).join(' · ')}`); });
  if (r.violations.length) md.push(`- **violations:** ${r.violations.slice(0, 8).join('; ')}`);
  md.push('');
}
md.push('## Not served by the library', '', '| G | subskill | why |', '|---|---|---|');
for (const r of results.filter((x) => x.task === 'none')) md.push(`| ${r.grade} | ${r.title.replace(/\|/g, '/')} | ${r.why} |`);
fs.writeFileSync(path.join(OUT, 'REPORT.md'), md.join('\n'));
console.log(`wrote ${path.join(OUT, 'REPORT.md')}`);
console.log(`served ${covered.length}/${results.length}; clean ${covered.filter((r) => !r.violations.length).length}; ordered ${covered.filter((r) => r.ordered).length}`);
