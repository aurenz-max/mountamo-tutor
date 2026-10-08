// Harder open-build cases for the facts / raw / vision comparison: crowded counts, subtle asymmetry, exact heights.
const W = (id, kind, x, y) => ({ id, kind, x, y });
const B = (id, kind, col, row, color = 'yellow') => ({ id, kind, col, row, color });
const fishAt = (n) => Array.from({ length: n }, (_, i) => W(`fish${i + 1}`, 'fish', 8 + (i * 37) % 86, 10 + ((i * 53) % 70)));
const clutter = [W('weed1', 'seaweed', 15, 90), W('weed2', 'seaweed', 45, 92), W('weed3', 'seaweed', 80, 90), W('heart1', 'heart', 60, 30), W('heart2', 'heart', 25, 55), W('daisy1', 'daisy', 90, 70)];
const bigSym = [B('g1', 'small', 1, 0), B('g2', 'long', 2, 0, 'blue'), B('g3', 'small', 5, 0), B('m1', 'small', 2, 1), B('m2', 'small', 3, 1, 'coral'), B('m3', 'small', 4, 1), B('t1', 'small', 2, 2), B('t2', 'small', 4, 2), B('t3', 'small', 2, 3, 'coral'), B('t4', 'small', 4, 3, 'coral')];
export const cases = [
  { name: 'count-12-crowded-yes', goal: 'Put exactly 12 fish in the sea.', world: { theme: 'undersea', stickers: [...fishAt(12), ...clutter] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'count-12-crowded-13', goal: 'Put exactly 12 fish in the sea.', world: { theme: 'undersea', stickers: [...fishAt(13), ...clutter] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  { name: 'count-12-crowded-11', goal: 'Put exactly 12 fish in the sea.', world: { theme: 'undersea', stickers: [...fishAt(11), ...clutter] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  { name: 'big-symmetric-yes', goal: 'Build something that looks the same on both sides.', build: { blocks: bigSym }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'big-symmetric-one-off', goal: 'Build something that looks the same on both sides.', build: { blocks: bigSym.filter(b => b.id !== 't4') }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  { name: 'taller-than-5-exactly-5', goal: 'Build a tower taller than 5 blocks.', build: { blocks: [B('big1', 'big', 3, 0, 'blue'), B('a', 'small', 3, 2), B('b', 'small', 3, 3), B('c', 'small', 3, 4)] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  { name: 'taller-than-5-six', goal: 'Build a tower taller than 5 blocks.', build: { blocks: [B('big1', 'big', 3, 0, 'blue'), B('a', 'small', 3, 2), B('b', 'small', 3, 3), B('c', 'small', 3, 4), B('d', 'small', 3, 5)] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'same-height-5-vs-6', goal: 'Build two towers that are the same height.', build: { blocks: [B('big1', 'big', 0, 0, 'blue'), B('a', 'small', 0, 2), B('b', 'small', 0, 3), B('c', 'small', 0, 4), B('s1', 'small', 5, 0), B('s2', 'small', 5, 1), B('s3', 'small', 5, 2), B('s4', 'small', 5, 3), B('s5', 'small', 5, 4), B('s6', 'small', 5, 5)] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  { name: 'same-height-mixed-yes', goal: 'Build two towers that are the same height.', build: { blocks: [B('big1', 'big', 0, 0, 'blue'), B('a', 'small', 0, 2), B('b', 'small', 0, 3), B('s1', 'small', 5, 0), B('s2', 'small', 5, 1), B('s3', 'small', 5, 2), B('s4', 'small', 5, 3)] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
];
