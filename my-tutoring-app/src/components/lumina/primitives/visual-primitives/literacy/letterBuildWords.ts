/**
 * Common, kid-safe CVC words by word family, for WRITING letter-build asks (`letterBuild.ts`): a code-owned ask
 * ("rhymes with cat", "change one letter in cat") is only offered when several real words in the lesson's letter
 * group answer it. This list never JUDGES a build: any real word the learner makes passes (the shared word judge
 * decides), including words that are not here.
 */
export const CVC_FAMILIES: Record<string, readonly string[]> = {
  at: ['bat', 'cat', 'fat', 'hat', 'mat', 'pat', 'rat', 'sat', 'vat'],
  an: ['can', 'fan', 'man', 'pan', 'ran', 'tan', 'van'],
  ap: ['cap', 'gap', 'lap', 'map', 'nap', 'sap', 'tap', 'zap'],
  ag: ['bag', 'nag', 'rag', 'sag', 'tag', 'wag'],
  ad: ['bad', 'dad', 'had', 'lad', 'mad', 'pad', 'sad'],
  am: ['dam', 'ham', 'jam', 'ram', 'yam'],
  ed: ['bed', 'fed', 'led', 'red', 'wed'],
  en: ['den', 'hen', 'men', 'pen', 'ten'],
  et: ['bet', 'get', 'jet', 'let', 'met', 'net', 'pet', 'set', 'vet', 'wet'],
  eg: ['beg', 'keg', 'leg', 'peg'],
  ig: ['big', 'dig', 'fig', 'jig', 'pig', 'rig', 'wig'],
  in: ['bin', 'fin', 'pin', 'tin', 'win'],
  it: ['bit', 'fit', 'hit', 'kit', 'lit', 'pit', 'sit'],
  ip: ['dip', 'hip', 'lip', 'nip', 'rip', 'sip', 'tip', 'zip'],
  id: ['bid', 'did', 'hid', 'kid', 'lid', 'rid'],
  og: ['bog', 'dog', 'fog', 'hog', 'jog', 'log'],
  op: ['cop', 'hop', 'mop', 'pop', 'top'],
  ot: ['cot', 'dot', 'got', 'hot', 'lot', 'not', 'pot', 'rot'],
  ug: ['bug', 'dug', 'hug', 'jug', 'mug', 'rug', 'tug'],
  un: ['bun', 'fun', 'run', 'sun'],
  ut: ['but', 'cut', 'hut', 'nut', 'rut'],
  ub: ['cub', 'hub', 'rub', 'sub', 'tub'],
  um: ['gum', 'hum', 'sum'],
};

export const CVC_WORDS: readonly string[] = Object.values(CVC_FAMILIES).flat();

/** Words a young child knows and can picture: the only words an ask GIVES ("rhymes with cat", "change one letter in
 *  dog"). A rare given word ("rhymes with rut") tests vocabulary instead of the spelling pattern. */
export const GIVEN_WORDS: ReadonlySet<string> = new Set(['cat', 'hat', 'bat', 'man', 'can', 'fan', 'map', 'cap', 'bag', 'dad',
  'sad', 'jam', 'bed', 'red', 'hen', 'pen', 'ten', 'jet', 'net', 'wet', 'pet', 'leg', 'pig', 'big', 'wig', 'pin', 'sit',
  'hit', 'zip', 'lip', 'lid', 'kid', 'dog', 'log', 'mop', 'top', 'hop', 'hot', 'pot', 'dot', 'bug', 'hug', 'mug', 'rug',
  'sun', 'run', 'fun', 'cut', 'nut', 'hut', 'tub', 'cub', 'gum']);

/** Blend words as [start tile, ending tile]: the blend at the start (bl + ack) for `blend_start`, at the end of the
 *  ending (l + amp) for `blend_end`. They write asks only; any real word the learner makes passes. */
export const BLEND_START: readonly (readonly [string, string])[] = [
  ['bl', 'ack'], ['bl', 'ock'], ['cl', 'ap'], ['cl', 'ip'], ['cl', 'ock'], ['fl', 'ag'], ['fl', 'ip'], ['fl', 'ap'], ['fr', 'og'],
  ['gl', 'ad'], ['pl', 'an'], ['pl', 'ug'], ['sl', 'ip'], ['sl', 'ap'], ['sl', 'ug'], ['cr', 'ab'], ['cr', 'op'], ['dr', 'ip'],
  ['dr', 'op'], ['dr', 'um'], ['gr', 'ab'], ['gr', 'in'], ['tr', 'ap'], ['tr', 'ip'], ['st', 'op'], ['st', 'ep'], ['sp', 'in'],
  ['sp', 'ot'], ['sn', 'ap'], ['sk', 'ip'], ['sw', 'im'], ['st', 'ack'], ['sn', 'ack'], ['tr', 'ack'], ['cr', 'ack'],
];
export const BLEND_END: readonly (readonly [string, string])[] = [
  ['l', 'amp'], ['c', 'amp'], ['j', 'ump'], ['b', 'ump'], ['p', 'ump'], ['h', 'and'], ['s', 'and'], ['b', 'and'], ['l', 'and'],
  ['p', 'ond'], ['b', 'end'], ['s', 'end'], ['f', 'ast'], ['l', 'ast'], ['p', 'ast'], ['b', 'est'], ['n', 'est'], ['r', 'est'],
  ['t', 'est'], ['d', 'ust'], ['m', 'ust'], ['m', 'ilk'], ['g', 'ift'], ['l', 'ift'], ['s', 'oft'], ['t', 'ent'], ['h', 'unt'],
  ['b', 'ent'], ['m', 'int'], ['h', 'int'], ['w', 'ind'], ['m', 'ask'], ['d', 'esk'],
];

/** Real words a learner could make that a lesson should not credit or say back. Checked in code, before any judge. */
export const NOT_FOR_LESSONS: ReadonlySet<string> = new Set(['sex', 'fag', 'tit', 'cum', 'jiz', 'gun', 'kkk', 'nob', 'wop']);
