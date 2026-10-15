// Downloads the public word sources the lab reads into .cache/ (gitignored). Text files only; the lab
// parses them as data. Run once: node scripts/word-space-lab/fetch-sources.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache');
const SOURCES = {
  // CMU Pronouncing Dictionary: spelling -> ARPAbet phonemes (American English).
  'cmudict.dict': 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict',
  // OpenSubtitles 2018 frequency (SUBTLEX-like): the familiarity proxy until an AoA list is added.
  'freq50k.txt': 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
  // Unicode emoji names + group/subgroup: the picture source and the concept taxonomy.
  'emoji-test.txt': 'https://unicode.org/Public/emoji/latest/emoji-test.txt',
  // LDNOOBW English list: words never offered to a child.
  'badwords.txt': 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en',
  // Hunspell en_US: a word that appears only capitalized is a proper noun (Spain).
  'en_US.dic': 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.dic',
};

fs.mkdirSync(CACHE, { recursive: true });
for (const [file, url] of Object.entries(SOURCES)) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  fs.writeFileSync(path.join(CACHE, file), await res.text());
  console.log('fetched', file);
}
console.log('Curriculum: run backend/venv/Scripts/python scripts/word-space-lab/export-curriculum.py');
