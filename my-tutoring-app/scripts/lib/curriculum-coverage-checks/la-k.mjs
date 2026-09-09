// K Language Arts content checks, moved verbatim from the original curriculum-coverage-check.mjs
// pilot. Code-judged checks over production item conversion; no live microphone is driven.
export const modules = {
  pv: '/src/components/lumina/primitives/visual-primitives/literacy/pictureVocabularyScript.ts',
  ws: '/src/components/lumina/primitives/visual-primitives/literacy/wordSorterScript.ts',
};
export const interactionNote = 'Production item converters and cue builders executed. No live microphone/session was driven.';
export const semantic = {
  'LA005-01-H': 'Reviewed both draws: size and temperature scales appear and their rungs are ordered. The task elicits missing vocabulary in an ordered list; it does not independently establish using all words in sentences.',
  'LA005-03-A': 'Pairs are everyday associations, but the student produces a partner aloud. No cards are matched. Draw 2 also contains baseEmoji="pillows", plain text instead of a picture.',
  'LA005-02-I': 'Every generated riddle displays an icon of its answer. The child can name the picture without interpreting the clues. This candidate fails the curriculum evidence requirement in both draws.',
  'LA004-06-E': 'Both draws return an empty items array. The component renders its no-practice state. The eval-test API pass is a false positive for actual usable content; this candidate cannot currently support the objective.',
  'LA004-01-A': 'Both draws supply nouns and action verbs with labels and emoji cues. The student says the category; there is no card manipulation. Noun examples do not systematically cover places, and ambiguous stand-alone verbs need context. This is partial support.',
  'LA005-02-H': 'The frames are reasonable sentence-context noun completions. Source rendering deliberately hides the answer emoji until solved; there is no contextual scene illustration. Picture-clue reasoning remains unmet.',
};
export function check(r, data, { pv, ws }) {
  let items = data.items ?? data.challenges ?? [];
  if (r.primitive === 'picture-vocabulary') items = pv.itemsFromChallenges(data.challenges ?? []);
  if (r.primitive === 'word-sorter') items = ws.itemsFromChallenges(data.challenges ?? []);
  const checks = [{ name: 'Student-facing item set is nonempty after production item conversion', pass: items.length > 0, detail: `${items.length} usable items` }];
  const samples = [];
  for (const item of items) {
    if (r.mode === 'gradable_scale') {
      checks.push({ name: `${item.id}: scale target agrees with answer`, pass: item.scaleWords?.[item.scaleTargetIndex] === item.word });
      const spoken = pv.scaleSpokenFor(item);
      checks.push({ name: `${item.id}: spoken scale omits target`, pass: !spoken.toLowerCase().split(/[^a-z]+/).includes(item.word.toLowerCase()) });
      samples.push({ id: item.id, kind: 'scale', scale: item.scaleWords, targetIndex: item.scaleTargetIndex, prompt: spoken, answer: item.word });
    } else if (r.mode === 'association') {
      checks.push({ name: `${item.id}: picture stimulus is a pictograph`, pass: /\p{Extended_Pictographic}/u.test(item.baseEmoji ?? ''), detail: item.baseEmoji });
      checks.push({ name: `${item.id}: partner differs from stimulus`, pass: item.word !== item.baseWord });
      samples.push({ id: item.id, kind: 'association', emoji: item.baseEmoji, stimulus: item.baseWord, prompt: `What goes with ${item.baseWord}?`, answer: item.word });
    } else if (r.mode === 'sentence_frame') {
      checks.push({ name: `${item.id}: spoken frame omits target`, pass: !item.frameSpoken.toLowerCase().split(/[^a-z]+/).includes(item.word.toLowerCase()) });
      samples.push({ id: item.id, kind: 'frame', prompt: item.frameSpoken, answer: item.word });
    } else if (r.primitive === 'di-spoken-practice') {
      if (r.id === 'LA005-02-I') checks.push({ name: `${item.id}: riddle requires clue reasoning rather than an answer picture`, pass: item.stimulusKind !== 'emoji', detail: 'Source rendering shows stimulusEmoji before the answer; these icons depict the riddle solutions.' });
      samples.push({ id: item.id, kind: 'riddle', emoji: item.stimulusEmoji, prompt: item.ask, answer: item.expectedAnswer });
    } else if (r.primitive === 'word-sorter') {
      samples.push({ id: item.id, kind: 'sort', prompt: ws.askFor(item), answer: item.answer, choices: item.choices, stimulus: item.word, emoji: item.emoji });
    }
  }
  if (r.primitive === 'word-sorter') for (const ch of data.challenges ?? []) for (const w of ch.words ?? []) checks.push({ name: `${ch.id}/${w.id}: answer names an existing group`, pass: ch.bucketLabels.includes(w.correctBucket) });
  return { items, checks, samples };
}
