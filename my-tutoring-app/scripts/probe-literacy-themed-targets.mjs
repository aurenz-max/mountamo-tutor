// Literacy themed-target probe — student-interests rollout row 0 (2026-09-16).
// Run from my-tutoring-app.
//
// Interests now reach the manifest, and at PreK EVERY component intent is
// themed. These literacy generators aim the intent at the TARGET words ("lean
// word/letter choices toward <intent>"). A theme is safe on the carrier (title,
// scene, instruction) and unsafe on the thing being taught: a K blending set
// that says "truck" is no longer a CVC set, and a sort whose groups turned into
// "Trucks / Diggers" no longer teaches the objective's categories.
//
// Each case sends a manifest-shaped themed intent ("... theme it around his
// dump trucks and excavators") to the LIVE generator, plus an unthemed control
// with the same objective, and counts:
//   phonics-blender  cvc@K        targets that are not C-V-C letters, or whose
//                                 phoneme letters do not spell the word
//   cvc-speller      fill/spell@K targets that are not C-V-C or leave the
//                                 letter group the generator stamped
//   decodable-reader literal@K    words the K reader cannot decode: not CVC and
//                                 not a sight word (tag-independent — a "cvc"
//                                 tag on "truck" is counted as the lie it is)
//   word-sorter      binary@K     challenges whose two groups are not the
//                                 objective's named groups (animals / food)
//
//   node scripts/probe-literacy-themed-targets.mjs [out.json] [--draws=4] [--controls=2] [--only=word-sorter,phonics-blender/auto]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const output = resolve(
  root,
  args.find((a) => a.endsWith('.json') && !a.startsWith('--'))
    || 'qa/personalization/literacy-themed-targets-2026-09-16.json',
);
const draws = Number(flag('draws', '4'));
const controls = Number(flag('controls', '2'));
// Comma list of generator or generator/mode keys (mode 'auto' = unpinned).
const only = flag('only', '').split(',').filter(Boolean);
const keyOf = (kase) => `${kase.generator}/${kase.mode || 'auto'}`;

const THEME = 'Theme it around his favorite dump trucks and excavators at the construction work site.';

const CONSONANT = '[b-df-hj-np-tv-z]';
const CVC = new RegExp(`^${CONSONANT}[aeiou]${CONSONANT}$`);
// K sight words the passage may lean on (Dolch pre-primer + the prompt's own list).
const SIGHT = new Set(('a and away big blue can come down find for funny go help here i in is it jump little look '
  + 'make me my not one play red run said see the three to two up we where yellow you are he she they was have '
  + 'with this that of on at do no so like what his her from be all went an am').split(' '));
const bare = (w) => String(w ?? '').toLowerCase().replace(/[^a-z']/g, '');

const CASES = [
  {
    generator: 'phonics-blender',
    mode: 'cvc',
    topic: 'Blending sounds into CVC words',
    objective: 'Guide Alex to blend three sounds into short-vowel CVC words and say each whole word aloud.',
  },
  {
    generator: 'cvc-speller',
    mode: 'fill_vowel',
    topic: 'Hearing the middle sound in CVC words',
    objective: 'Have Alex listen to short CVC words and say the middle vowel sound of each one.',
  },
  {
    generator: 'cvc-speller',
    mode: 'spell_word',
    topic: 'Spelling CVC words',
    objective: 'Have Alex spell short CVC words by placing each of the three letters in order.',
  },
  {
    generator: 'decodable-reader',
    mode: 'literal',
    topic: 'Reading short decodable sentences',
    objective: 'Alex reads a short decodable story with CVC words and sight words aloud, then answers a who/what question.',
  },
  {
    generator: 'word-sorter',
    mode: 'binary_sort',
    topic: 'Sorting words into categories',
    objective: 'Alex sorts picture words into two groups: animals and food.',
    groups: [/animal/, /food/],
  },
  // Unpinned: the K guideline block ("use words from the topic theme") only
  // reaches the prompt when no mode is pinned.
  {
    generator: 'phonics-blender',
    mode: '',
    topic: 'Blending sounds into CVC words',
    objective: 'Guide Alex to blend three sounds into short-vowel CVC words and say each whole word aloud.',
  },
  // Letter choice IS the target here. A generic objective leaves the model to
  // pick "the letters whose SOUNDS best match the topic/objective".
  {
    generator: 'di-letter-sounds',
    mode: '',
    topic: 'Letter sounds',
    objective: 'Alex practices saying letter sounds out loud.',
  },
  {
    generator: 'letter-sound-link',
    mode: 'see_hear',
    topic: 'Letter-sound correspondence',
    objective: 'Alex sees a letter and says the sound it makes.',
  },
  // The hidden word only carries the letter, and code already checks that its
  // first letter spells its first sound; blends are allowed ("stop" for s). An
  // everyday theme word there is fine. A rare one ("asphalt") is a leak.
  {
    generator: 'letter-spotter',
    mode: 'name_it',
    topic: 'Beginning letters',
    objective: 'Alex hears a sentence and names the first letter of the hidden word.',
  },
  // Word-picking phonological generators: the target words are the task.
  // "bad" = not a C-V-C word; read the themed rate against the control's.
  ...[
    ['phoneme-explorer', 'isolate', 'Alex hears a word and says its first sound.'],
    ['phoneme-explorer', 'segment', 'Alex breaks a short word into its separate sounds.'],
    ['sound-swap', 'substitution', 'Alex swaps one sound in a word to make a new word.'],
    ['rhyme-studio', 'recognition', 'Alex listens to two words and says whether they rhyme.'],
    ['word-workout', 'picture_match', 'Alex reads a short CVC word and matches it to its picture.'],
  ].map(([generator, mode, objective]) => ({ generator, mode, topic: 'Phonological awareness', objective, words: true })),
  {
    generator: 'syllable-clapper',
    mode: 'count_parts',
    topic: 'Counting syllables',
    objective: 'Alex hears a word and claps and counts its syllables.',
  },
  {
    generator: 'resolve:rhyme-studio',
    mode: '',
    topic: 'Rhyming words',
    objective: 'Alex listens to pairs of words and says whether they rhyme.',
  },
];

// Onset letters of the theme's nouns (dump, digger, truck, excavator).
const THEME_ONSETS = new Set(['d', 't', 'e', 'x']);
// Probe signal for the hidden word: longer than 5 letters. The controls never
// are; the pre-fix themed draws were (asphalt, steamroller, pavement).

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), theme: THEME, draws: [], summary: {} };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

/** Per generator: pull the targets and count the ones the child's task cannot use. */
function audit(generator, data, kase) {
  if (generator === 'phonics-blender') {
    const words = data.words ?? [];
    const bad = words.filter((w) => {
      const word = bare(w.targetWord);
      const spelled = (w.phonemes ?? []).map((p) => p.letters).join('').toLowerCase();
      return !CVC.test(word) || spelled !== word || (w.phonemes ?? []).length !== 3;
    }).map((w) => w.targetWord);
    return { targets: words.map((w) => w.targetWord), bad, total: words.length, patternType: data.patternType };
  }
  if (generator === 'cvc-speller') {
    const group = new Set((data.availableLetters ?? []).map((l) => l.toLowerCase()));
    const chs = data.challenges ?? [];
    const bad = chs.filter((c) => {
      const word = bare(c.targetWord);
      return !CVC.test(word) || [...word].some((l) => !group.has(l));
    }).map((c) => c.targetWord);
    return { targets: chs.map((c) => c.targetWord), bad, total: chs.length, letterGroup: data.letterGroup };
  }
  if (generator === 'decodable-reader') {
    const words = (data.passage?.sentences ?? []).flatMap((s) => s.words ?? []);
    const bad = words.filter((w) => {
      const word = bare(w.text);
      return word && !SIGHT.has(word) && !CVC.test(word);
    }).map((w) => `${bare(w.text)}(${w.phonicsPattern})`);
    const sentences = (data.passage?.sentences ?? []).map((s) => (s.words ?? []).map((w) => w.text).join(' '));
    return { targets: sentences, bad, total: words.length, readingMode: data.readingMode };
  }
  if (generator === 'word-sorter') {
    const chs = data.challenges ?? [];
    const bad = chs.filter((c) => {
      const labels = (c.bucketLabels ?? []).map((l) => l.toLowerCase());
      return !kase.groups.every((re) => labels.some((l) => re.test(l)));
    }).map((c) => (c.bucketLabels ?? []).join(' / '));
    const targets = chs.map((c) => `[${(c.bucketLabels ?? []).join(' / ')}] ${(c.words ?? []).map((w) => `${w.word}→${w.correctBucket}`).join(', ')}`);
    return { targets, bad, total: chs.length };
  }
  // Letter pickers: "bad" is a letter the theme's nouns start with. It is a
  // signal, not a verdict — read it against the control's rate.
  if (generator === 'di-letter-sounds') {
    const letters = (data.challenges ?? []).map((c) => c.letter);
    return { targets: letters, bad: letters.filter((l) => THEME_ONSETS.has(l)), total: letters.length };
  }
  if (generator === 'letter-sound-link') {
    const letters = (data.challenges ?? []).map((c) => c.targetLetter);
    return { targets: letters, bad: letters.filter((l) => THEME_ONSETS.has(l)), total: letters.length, letterGroup: data.letterGroup };
  }
  if (generator === 'letter-spotter') {
    const chs = (data.challenges ?? []).filter((c) => c.mode === 'name-it');
    const bad = chs.filter((c) => bare(c.targetWord).length > 5).map((c) => c.targetWord);
    return { targets: chs.map((c) => `${c.targetLetter} ← ${c.targetWord}: ${c.spokenSentence ?? c.sentence}`), bad, total: chs.length };
  }
  if (kase.words) {
    const WORD_KEYS = /^(targetWord|word|originalWord|resultWord|comparisonWord|realWord)$/;
    const found = [];
    const walk = (node, key) => {
      if (typeof node === 'string') { if (WORD_KEYS.test(key ?? '')) found.push(bare(node)); return; }
      if (Array.isArray(node)) { if (key === 'chain') node.forEach((w) => found.push(bare(w))); else node.forEach((n) => walk(n, key === 'options' ? 'opt' : key)); return; }
      if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, k === 'word' && key === 'opt' ? 'word' : k);
    };
    walk(data.challenges ?? [], 'challenges');
    const words = found.filter(Boolean);
    return { targets: [...new Set(words)], bad: [...new Set(words.filter((w) => !CVC.test(w)))], total: new Set(words).size,
      keys: Object.keys((data.challenges ?? [])[0] ?? {}) };
  }
  if (generator === 'syllable-clapper') {
    // K syllable words are 1-3 parts; the theme's own nouns are longer
    // ("ex-ca-va-tor").
    const chs = data.challenges ?? [];
    const bad = chs.filter((c) => (c.syllables ?? []).length > 3).map((c) => c.word);
    return { targets: chs.map((c) => `${c.word}(${(c.syllables ?? []).length})`), bad, total: chs.length };
  }
  if (generator === 'resolve:rhyme-studio') {
    const modes = data ? data.modes.map((m) => m.evalMode) : ['(mixed)'];
    return { targets: modes, bad: [], total: 1 };
  }
  throw new Error(`no audit for ${generator}`);
}

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/service/literacy/';
  const { generateDiLetterSounds } = await runner.import('/src/components/lumina/service/direct-instruction/gemini-di-letter-sounds.ts');
  const { resolveEvalModes } = await runner.import('/src/components/lumina/service/evalMode/index.ts');
  const { resolveGenerationContext } = await runner.import('/src/components/lumina/service/generation/resolveGenerationContext.ts');
  const gens = {
    'phonics-blender': (await runner.import(`${base}gemini-phonics-blender.ts`)).generatePhonicsBlender,
    'cvc-speller': (await runner.import(`${base}gemini-cvc-speller.ts`)).generateCvcSpeller,
    'decodable-reader': (await runner.import(`${base}gemini-decodable-reader.ts`)).generateDecodableReader,
    'word-sorter': (await runner.import(`${base}gemini-word-sorter.ts`)).generateWordSorter,
    'phoneme-explorer': (await runner.import(`${base}gemini-phoneme-explorer.ts`)).generatePhonemeExplorer,
    'sound-swap': (await runner.import(`${base}gemini-sound-swap.ts`)).generateSoundSwap,
    'rhyme-studio': (await runner.import(`${base}gemini-rhyme-studio.ts`)).generateRhymeStudio,
    'word-workout': (await runner.import(`${base}gemini-word-workout.ts`)).generateWordWorkout,
    'syllable-clapper': (await runner.import(`${base}gemini-syllable-clapper.ts`)).generateSyllableClapper,
    'letter-sound-link': (await runner.import(`${base}gemini-letter-sound-link.ts`)).generateLetterSoundLink,
    'letter-spotter': (await runner.import(`${base}gemini-letter-spotter.ts`)).generateLetterSpotter,
    // Registry-shaped call (diGenerators.ts).
    'di-letter-sounds': (ctx) => generateDiLetterSounds(ctx.topic, ctx.gradeContext, {
      ...ctx.raw, intent: ctx.intent, objectiveText: ctx.objective.text, targetEvalMode: ctx.targetEvalMode,
    }),
    // Only the resolver: theme text should name no skill.
    'resolve:rhyme-studio': (ctx) => resolveEvalModes('rhyme-studio', { intent: ctx.intent, objectiveText: ctx.objective.text }, {}),
  };

  const jobs = [];
  for (const kase of CASES) {
    if (only.length && !only.some((o) => o === kase.generator || o === keyOf(kase))) continue;
    for (let i = 1; i <= draws; i++) jobs.push({ kase, themed: true, i });
    for (let i = 1; i <= controls; i++) jobs.push({ kase, themed: false, i });
  }

  // Draws run in parallel per case; each result is audited as it lands.
  await Promise.all(jobs.map(async ({ kase, themed, i }) => {
    const intent = themed ? `${kase.objective} ${THEME}` : kase.objective;
    const label = `${keyOf(kase)} ${themed ? 'themed' : 'control'} #${i}`;
    let data;
    try {
      // Built the way production builds it (registry boundary).
      data = await gens[kase.generator](resolveGenerationContext({
        componentId: kase.generator,
        instanceId: `probe-${i}`,
        title: kase.topic,
        config: {
          intent,
          objectiveText: kase.objective,
          objectiveGrade: 'K',
          ...(kase.mode ? { targetEvalMode: kase.mode } : {}),
        },
      }, kase.topic, 'Kindergarten', 'kindergarten'));
    } catch (err) {
      evidence.draws.push({ label, key: keyOf(kase), themed, error: String(err) });
      console.log(`✗ ${label}: threw ${err}`);
      return;
    }
    const result = audit(kase.generator, data, kase);
    evidence.draws.push({ label, key: keyOf(kase), themed, title: data?.title, ...result });
    console.log(`${result.bad.length ? '✗' : '✓'} ${label} — ${result.bad.length}/${result.total} unusable${result.bad.length ? `: ${result.bad.join(', ')}` : ''}`);
    save();
  }));

  for (const d of evidence.draws) {
    const key = `${d.key} ${d.themed ? 'themed' : 'control'}`;
    const s = (evidence.summary[key] ??= { draws: 0, errors: 0, drawsWithLeak: 0, unusable: 0, total: 0 });
    s.draws++;
    if (d.error) { s.errors++; continue; }
    s.total += d.total;
    s.unusable += d.bad.length;
    if (d.bad.length) s.drawsWithLeak++;
  }
} finally {
  await server.close();
}
evidence.draws.sort((a, b) => a.label.localeCompare(b.label));
save();
console.log('\nSUMMARY');
for (const [key, s] of Object.entries(evidence.summary).sort()) {
  console.log(`  ${key.padEnd(40)} draws ${s.draws}  errors ${s.errors}  draws-with-leak ${s.drawsWithLeak}  unusable ${s.unusable}/${s.total}`);
}
console.log(`\n${output}`);
