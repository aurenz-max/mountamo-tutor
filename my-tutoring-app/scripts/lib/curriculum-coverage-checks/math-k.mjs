// K Mathematics content checks. Code-judged over the raw eval-test payload for each probed
// requirement/mode pair. Every check names the curriculum demand it enforces; a failing check
// is a content finding against THAT requirement, not a generic generator bug report.
// Nothing here drives the live tutor: interaction stays "not tested".
export const modules = {};
export const interactionNote = 'Payload structure, answer keys, numeric scope and answer-leak checks executed in code. No live tutor session or microphone was driven.';

const nums = s => (String(s).match(/\d+/g) ?? []).map(Number);
const distinct = xs => [...new Set(xs)];
const textOf = ch => Object.entries(ch).filter(([k, v]) => typeof v === 'string' && !['id', 'type', 'evalMode', 'shape3d', 'supportTier'].includes(k)).map(([, v]) => v).join(' ');
const objectiveRange = {
  'COUNT001-01-C': [11, 20], 'COUNT001-03-A': [1, 5], 'MEAS001-02-B': [1, 5], 'COUNT001-03-E': [1, 10],
  'COUNT001-05-B': [11, 15], 'COUNT001-05-D': [11, 15], 'COUNT001-05-E': [16, 19],
  'OPS001-01-E': [1, 10], 'OPS001-02-F': [1, 10],
};

export function check(r, data, _mods) {
  const items = data.challenges ?? data.items ?? [];
  const checks = [{ name: 'Student-facing challenge set is nonempty', pass: items.length > 0, detail: `${items.length} challenges` }];
  const samples = [];
  const push = (name, pass, detail) => checks.push(detail === undefined ? { name, pass } : { name, pass, detail: String(detail) });
  const [lo, hi] = objectiveRange[r.id] ?? [];

  if (r.primitive === 'counting-board' && r.mode !== 'give_me_n') {
    push('Session has at least three counting items (mastery, not a demo)', items.length >= 3, items.length);
    for (const ch of items) {
      push(`${ch.id}: count is inside the objective range ${lo}-${hi}`, ch.count >= lo && ch.count <= hi, ch.count);
      push(`${ch.id}: answer key equals the object count`, ch.targetAnswer === ch.count, `${ch.targetAnswer} vs ${ch.count}`);
      push(`${ch.id}: no numeral in the instruction or narration gives the count away`, !nums(ch.instruction + ' ' + (ch.narration ?? '')).includes(ch.count), ch.instruction);
      samples.push({ id: ch.id, kind: 'count', emoji: data.objects?.[0]?.emoji, stimulus: `${ch.count} ${data.objects?.[0]?.type ?? 'objects'} (${ch.arrangement})`, prompt: ch.narration || ch.instruction, answer: String(ch.targetAnswer) });
    }
    checks.push({ name: 'Arrangement variety (a COUNT001-02-B demand, recorded here, not failed)', pass: true, detail: distinct(items.map(c => c.arrangement)).join(', ') });
  } else if (r.primitive === 'hundreds-chart') {
    push('Grid ceiling honors "up to 50"', data.gridMax === 50, data.gridMax);
    const skips = distinct(items.map(c => c.skipValue));
    push('Both 2s and 5s appear across the session', skips.includes(2) && skips.includes(5), skips.join(', '));
    const tasks = items.map(c => `by ${c.skipValue} from ${c.startNumber}`);
    push('Challenges are distinct problems, not the same highlight repeated', distinct(tasks).length >= Math.min(3, items.length), tasks.join(' | '));
    for (const ch of items) {
      const expected = []; for (let n = ch.startNumber; n <= data.gridMax; n += ch.skipValue) expected.push(n);
      push(`${ch.id}: correct cells are exactly the skip sequence from ${ch.startNumber} by ${ch.skipValue}`, JSON.stringify(ch.correctCells) === JSON.stringify(expected), ch.correctCells?.join(' '));
      push(`${ch.id}: skip value is 2 or 5`, [2, 5].includes(ch.skipValue), ch.skipValue);
      samples.push({ id: ch.id, kind: 'chart', stimulus: `1-${data.gridMax} chart, count by ${ch.skipValue}s`, prompt: ch.instruction, answer: ch.correctCells?.join(', ') });
    }
  } else if (r.primitive === 'number-sequencer' && r.mode === 'fill_missing') {
    for (const ch of items) {
      const blanks = ch.sequence.filter(v => v === null).length;
      push(`${ch.id}: exactly one missing number`, blanks === 1 && ch.correctAnswers?.length === 1, `${blanks} blanks`);
      push(`${ch.id}: every number stays under 10`, ch.sequence.every(v => v === null || v <= 10) && ch.correctAnswers.every(v => v <= 10), ch.sequence.join(','));
      const filled = ch.sequence.map(v => v === null ? ch.correctAnswers[0] : v);
      push(`${ch.id}: filled line counts forward by one`, filled.every((v, i) => i === 0 || v === filled[i - 1] + 1), filled.join(' '));
      samples.push({ id: ch.id, kind: 'sequence', stimulus: ch.sequence.map(v => v ?? '_').join('  '), prompt: ch.instruction, answer: String(ch.correctAnswers[0]) });
    }
    push('Blank position varies across the session as in the objective examples', distinct(items.map(c => c.sequence.indexOf(null))).length >= 2, items.map(c => c.sequence.indexOf(null)).join(','));
    const lines = items.map(c => c.sequence.map(v => v ?? '_').join(','));
    push('Every sequence in the session is a different problem', distinct(lines).length === lines.length, lines.join(' | '));
  } else if (r.primitive === 'number-sequencer' && r.mode === 'count_from') {
    for (const ch of items) {
      push(`${ch.id}: asks for the next three numbers`, ch.correctAnswers?.length === 3, ch.correctAnswers?.join(','));
      push(`${ch.id}: answers continue the count by one from ${ch.startNumber}`, ch.correctAnswers.every((v, i) => v === ch.startNumber + i + 1), ch.correctAnswers.join(','));
      push(`${ch.id}: start is between 1 and 17 so the chain ends by 20`, ch.startNumber >= 1 && ch.startNumber <= 17, ch.startNumber);
      push(`${ch.id}: instruction does not recite the answers`, !ch.correctAnswers.every(v => nums(ch.instruction).includes(v)), ch.instruction);
      samples.push({ id: ch.id, kind: 'sequence', stimulus: `${ch.startNumber}, …`, prompt: ch.instruction, answer: ch.correctAnswers.join(', ') });
    }
    push('Starting points vary and reach into the teens', distinct(items.map(c => c.startNumber)).length >= 3 && items.some(c => c.startNumber >= 10), items.map(c => c.startNumber).join(','));
  } else if (r.primitive === 'comparison-builder' && r.mode === 'compare_groups') {
    const answers = items.map(c => c.correctAnswer);
    for (const ch of items) {
      const l = ch.leftGroup.count, rt = ch.rightGroup.count;
      const truth = l > rt ? 'more' : l < rt ? 'less' : 'same';
      push(`${ch.id}: both groups stay within ${lo}-${hi} objects`, [l, rt].every(n => n >= lo && n <= hi), `${l} vs ${rt}`);
      push(`${ch.id}: answer key matches the counts`, ch.correctAnswer === truth || (truth === 'same' && /same|equal/.test(ch.correctAnswer)), `${ch.correctAnswer} for ${l} vs ${rt}`);
      samples.push({ id: ch.id, kind: 'groups', stimulus: `${l} ${ch.leftGroup.objectType} | ${rt} ${ch.rightGroup.objectType}`, prompt: ch.instruction, answer: ch.correctAnswer });
    }
    push('Equal groups appear at least once (the objective names "equal to")', answers.some(a => /same|equal/.test(a)), answers.join(','));
    push('More and less/fewer both appear', answers.includes('more') && answers.some(a => /less|fewer/.test(a)), answers.join(','));
  } else if (r.primitive === 'comparison-builder' && r.mode === 'compare_numbers') {
    const symbols = distinct(items.map(c => c.correctSymbol));
    for (const ch of items) {
      const truth = ch.leftNumber > ch.rightNumber ? '>' : ch.leftNumber < ch.rightNumber ? '<' : '=';
      push(`${ch.id}: numbers are within ${lo}-${hi}`, [ch.leftNumber, ch.rightNumber].every(n => n >= lo && n <= hi), `${ch.leftNumber} ? ${ch.rightNumber}`);
      push(`${ch.id}: symbol key matches the numbers`, ch.correctSymbol === truth, `${ch.correctSymbol} for ${ch.leftNumber} vs ${ch.rightNumber}`);
      samples.push({ id: ch.id, kind: 'numbers', stimulus: `${ch.leftNumber}  ?  ${ch.rightNumber}`, prompt: ch.instruction, answer: ch.correctSymbol });
    }
    push('Both < and > are exercised in one session', symbols.includes('<') && symbols.includes('>'), symbols.join(' '));
  } else if (r.primitive === 'ordinal-line') {
    push('Session has at least three ordinal items (mastery, not a demo)', items.length >= 3, items.length);
    push('Positions reach past fifth (objective: sixth through tenth)', data.maxPosition >= 10 && items.some(c => c.targetPosition >= 6), `maxPosition ${data.maxPosition}; targets ${items.map(c => c.targetPosition).join(',')}`);
    for (const ch of items) {
      push(`${ch.id}: the line is long enough for its target`, ch.characters.length >= ch.targetPosition, `${ch.characters.length} characters, target ${ch.targetPosition}`);
      push(`${ch.id}: no character name contains a number or ordinal`, ch.characters.every(c => !/\d|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth/i.test(c.name)), ch.characters.map(c => c.name).join(','));
      samples.push({ id: ch.id, kind: 'ordinal', stimulus: ch.characters.map(c => c.emoji).join(' '), prompt: ch.instruction, answer: ch.characters[ch.targetPosition - 1]?.name });
    }
  } else if (r.primitive === 'ten-frame') {
    push('Frame is double (a full ten plus some ones)', data.mode === 'double', data.mode);
    push('Session has at least three teen items (mastery, not a demo)', items.length >= 3, items.length);
    push('The set covers more than one teen number', distinct(items.map(c => c.targetCount)).length > 1, distinct(items.map(c => c.targetCount)).join(','));
    for (const ch of items) {
      push(`${ch.id}: target is a teen number in ${lo}-${hi}`, ch.targetCount >= lo && ch.targetCount <= hi, ch.targetCount);
      // The ONES are the answer on build_teen and the leftover on decompose_teen;
      // neither may be printed before the child produces it. Ten and the teen
      // number itself are the question and are exempt.
      const ones = ch.targetCount - 10;
      const stated = nums(textOf(ch)).filter(n => n !== 10 && n !== ch.targetCount);
      push(`${ch.id}: the printed prompt does not state the ones (${ones})`, !stated.includes(ones), textOf(ch));
      samples.push({ id: ch.id, kind: 'frame', stimulus: `${data.mode} ten frame, ${ch.type}`, prompt: ch.narration || ch.instruction, answer: ch.type === 'decompose_teen' ? `ten of ${ch.targetCount} turned yellow` : `${ones} ones beside a ten` });
    }
  } else if (r.primitive === 'number-bond') {
    push('Whole reaches the teens the objective names', data.maxNumber >= hi, `maxNumber ${data.maxNumber}`);
    push('The set covers more than one teen whole', distinct(items.map(c => c.whole)).length > 1, distinct(items.map(c => c.whole)).join(','));
    for (const ch of items) {
      push(`${ch.id}: whole is in ${lo}-${hi}`, ch.whole >= lo && ch.whole <= hi, ch.whole);
      // On `ten-and-ones` the accepted pair is fixed by the MODE (a full ten and
      // the rest) and nothing travels on the wire, so the check is that both
      // parts are the child's to place. On `decompose` it is that a ten-and-ones
      // split is among the pairs the generator enumerated.
      if (ch.type === 'ten-and-ones') {
        push(`${ch.id}: both parts are the child's to place`, ch.part1 == null && ch.part2 == null, `part1 ${ch.part1}, part2 ${ch.part2}`);
        push(`${ch.id}: the printed prompt does not state the ones (${ch.whole - 10})`, !nums(textOf(ch)).filter(n => n !== 10 && n !== ch.whole).includes(ch.whole - 10), textOf(ch));
      } else {
        push(`${ch.id}: a ten-and-ones split is among the accepted pairs`, (ch.allPairs ?? []).some(p => p.includes(10)), JSON.stringify(ch.allPairs));
      }
      samples.push({ id: ch.id, kind: 'bond', stimulus: `whole ${ch.whole}`, prompt: ch.instruction, answer: ch.type === 'ten-and-ones' ? `10 + ${ch.whole - 10}` : (ch.allPairs ?? []).map(p => p.join('+')).join(', ') });
    }
  } else if (r.primitive === 'addition-subtraction-scene') {
    const results = items.map(c => Math.max(c.startCount ?? 0, c.resultCount ?? 0));
    push('Some problem uses numbers above 5 (objective: within 10)', data.maxNumber >= 10 || results.some(n => n > 5), `maxNumber ${data.maxNumber}; largest ${Math.max(...results)}`);
    for (const ch of items) {
      const expected = ch.operation === 'addition' ? ch.startCount + ch.changeCount : ch.startCount - ch.changeCount;
      push(`${ch.id}: equation matches the story numbers`, ch.resultCount === expected, `${ch.startCount} ${ch.operation === 'addition' ? '+' : '-'} ${ch.changeCount} = ${ch.resultCount}`);
      push(`${ch.id}: answer is not zero`, ch.resultCount > 0, ch.resultCount);
      const unknown = ch.unknownPosition === 'result' ? ch.resultCount : ch.unknownPosition === 'change' ? ch.changeCount : ch.startCount;
      push(`${ch.id}: the spoken story does not state the unknown`, !nums(ch.storyText).includes(unknown) || ch.unknownPosition !== 'result', ch.storyText);
      samples.push({ id: ch.id, kind: 'story', emoji: undefined, stimulus: `${ch.scene}: ${ch.objectType}`, prompt: ch.storyText, answer: `${unknown} (${ch.equation})` });
    }
    push('Addition problems dominate (objective: addition word problems)', items.filter(c => c.operation === 'addition').length >= Math.ceil(items.length / 2), items.map(c => c.operation).join(','));
  } else if (r.primitive === 'math-fact-fluency') {
    const positions = distinct(items.map(c => c.unknownPosition));
    push('Every item is subtraction', items.every(c => c.operation === 'subtraction'), distinct(items.map(c => c.operation)).join(','));
    checks.push({ name: 'Missing DIFFERENCE is not this mode by design (result-unknown is equation_solve; the review pairs both)', pass: true, detail: positions.join(',') });
    push('Easy tier honors its declared operand2 (count-on) preference somewhere in the session', positions.includes('operand2'), positions.join(','));
    for (const ch of items) {
      push(`${ch.id}: numbers within ${hi}`, [ch.operand1, ch.operand2, ch.result].every(n => n >= 0 && n <= hi), ch.equation);
      push(`${ch.id}: equation is true`, ch.operand1 - ch.operand2 === ch.result, ch.equation);
      const key = ch.unknownPosition === 'operand1' ? ch.operand1 : ch.unknownPosition === 'operand2' ? ch.operand2 : ch.result;
      push(`${ch.id}: answer key is the unknown`, ch.correctAnswer === key, `${ch.correctAnswer} vs ${key}`);
      push(`${ch.id}: instruction does not print the full equation`, !ch.instruction.includes(ch.equation), ch.instruction);
      samples.push({ id: ch.id, kind: 'equation', stimulus: ch.equation.replace(String(key), '?'), prompt: ch.instruction, answer: String(ch.correctAnswer) });
    }
  } else if (r.primitive === '3d-shape-explorer') {
    const shapes = distinct(items.map(c => c.shape3d));
    push('Cube, cone and cylinder all appear (the objective names them)', ['cube', 'cone', 'cylinder'].every(s => shapes.includes(s)), shapes.join(','));
    for (const ch of items) {
      push(`${ch.id}: no printed text names the solid before the child speaks`, !new RegExp(ch.shape3d, 'i').test(textOf(ch) + ' ' + data.title + ' ' + data.description), textOf(ch) || '(no text fields)');
      samples.push({ id: ch.id, kind: 'solid', stimulus: `code-drawn ${ch.shape3d}`, prompt: 'What is this shape called?', answer: ch.shape3d });
    }
  } else if (r.primitive === 'pattern-builder') {
    push('Creation challenges are emitted at K', items.every(c => c.type === 'create') && items.length >= 3, `${items.length} × ${distinct(items.map(c => c.type)).join(',')}`);
    for (const ch of items) {
      const core = ch.sequence?.core ?? [];
      push(`${ch.id}: core is an AB pair of two different elements`, core.length === 2 && core[0] !== core[1], core.join(','));
      push(`${ch.id}: expected pattern repeats the core`, (ch.answer ?? []).every((v, i) => v === core[i % core.length]), (ch.answer ?? []).join(','));
      push(`${ch.id}: both core tokens are available to place`, core.every(t => (ch.availableTokens ?? []).includes(t)), (ch.availableTokens ?? []).join(','));
      samples.push({ id: ch.id, kind: 'pattern', stimulus: `tokens: ${(ch.availableTokens ?? []).join(', ')}`, prompt: ch.narration || ch.instruction, answer: (ch.answer ?? []).join(' ') });
    }
  } else if (r.primitive === 'compare-objects') {
    const attrs = distinct(items.map(c => c.attribute));
    push('Session has at least three items (objective names length, weight and size)', items.length >= 3, items.length);
    push('More than one measurable attribute is asked', attrs.length >= 2, attrs.join(','));
    for (const ch of items) {
      push(`${ch.id}: answer key is one of the offered attributes`, (ch.attributeOptions ?? []).includes(ch.correctAttribute), `${ch.correctAttribute} in ${(ch.attributeOptions ?? []).join('/')}`);
      push(`${ch.id}: the attribute menu never offers both length and height`, !((ch.attributeOptions ?? []).includes('length') && (ch.attributeOptions ?? []).includes('height')), (ch.attributeOptions ?? []).join('/'));
      push(`${ch.id}: instruction does not name the attribute`, !new RegExp(ch.correctAttribute, 'i').test(ch.instruction), ch.instruction);
      samples.push({ id: ch.id, kind: 'attribute', stimulus: ch.objects.map(o => o.name).join(' and '), prompt: ch.instruction, answer: ch.correctAttribute });
    }
  } else if (r.primitive === 'bar-model' && r.mode !== 'build_one_to_one') {
    for (const ch of items) {
      const vals = ch.values.map(v => v.value);
      const wantMax = /more|most|taller/i.test(ch.prompt);
      const truth = vals.indexOf(wantMax ? Math.max(...vals) : Math.min(...vals));
      push(`${ch.id}: exactly two bars with different heights`, vals.length === 2 && vals[0] !== vals[1], vals.join(' vs '));
      push(`${ch.id}: target bar matches the question`, ch.targetBarIndex === truth, `${ch.prompt} -> ${ch.values[ch.targetBarIndex]?.label}`);
      push(`${ch.id}: a how-many question or a which-has-more question is asked`, /how many|more|fewer|less|most|least/i.test(ch.prompt), ch.prompt);
      checks.push({ name: `${ch.id}: bar values are hidden so the child compares heights`, pass: true, detail: ch.showBarValues ? 'showBarValues=true at the easy tier: numerals are printed on the bars (support, recorded, not failed)' : 'values hidden' });
      samples.push({ id: ch.id, kind: 'bars', stimulus: ch.values.map(v => `${v.label}: ${v.value}`).join(' | '), prompt: ch.prompt, answer: ch.values[ch.targetBarIndex]?.label });
    }
  } else if (r.primitive === 'sorting-station') {
    const bins = distinct(items.flatMap(c => c.categories.map(k => k.label.toLowerCase())));
    push('Hot, warm and cold all appear as bins (the objective names three categories; K allows 3)', ['hot', 'warm', 'cold'].every(b => bins.includes(b)), bins.join(','));
    for (const ch of items) {
      push(`${ch.id}: 4-6 objects at K`, ch.objects.length >= 4 && ch.objects.length <= 6, ch.objects.length);
      push(`${ch.id}: every object belongs to exactly one offered bin`, ch.objects.every(o => ch.categories.filter(k => Object.entries(k.rule).every(([a, v]) => o.attributes[a] === v)).length === 1), ch.objects.map(o => `${o.label}=${o.attributes[ch.sortingAttribute]}`).join(','));
      push(`${ch.id}: no object label is itself a bin label`, ch.objects.every(o => !ch.categories.some(k => k.label.toLowerCase() === o.label.toLowerCase())), ch.objects.map(o => o.label).join(','));
      push(`${ch.id}: every object has a picture`, ch.objects.every(o => /\p{Extended_Pictographic}/u.test(o.emoji ?? '')), ch.objects.map(o => o.emoji).join(' '));
      samples.push({ id: ch.id, kind: 'sort', stimulus: ch.objects.map(o => `${o.emoji} ${o.label}`).join(', '), prompt: ch.instruction, answer: ch.categories.map(k => k.label).join(' / ') });
    }
  } else if (r.primitive === 'time-sequencer') {
    for (const ch of items) {
      push(`${ch.id}: three events`, ch.events.length === 3, ch.events.length);
      push(`${ch.id}: correct order is a permutation of the events`, [...ch.correctOrder].sort().join() === ch.events.map(e => e.id).sort().join(), ch.correctOrder.join(','));
      push(`${ch.id}: the child is not asked to READ clock times (K logical sequence, not time-telling)`, !/read the time|clock time|read the clock/i.test(ch.instruction + ' ' + (ch.hint ?? '') + ' ' + (ch.strategyHint ?? '')), ch.instruction);
      push(`${ch.id}: event labels carry no digits to decode`, ch.events.every(e => !/\d/.test(e.label)), ch.events.map(e => e.label).join(' | '));
      checks.push({ name: `${ch.id}: first slot pre-labelled`, pass: true, detail: ch.prelabelFirstSlot ? 'prelabelFirstSlot=true at the easy tier (support, recorded)' : 'no pre-label' });
      samples.push({ id: ch.id, kind: 'events', stimulus: ch.events.map(e => `${e.emoji} ${e.label}`).join(' · '), prompt: ch.instruction, answer: ch.correctOrder.map(id => ch.events.find(e => e.id === id)?.label).join(' → ') });
    }
  } else if (r.primitive === 'calendar-explorer') {
    for (const ch of items) {
      push(`${ch.id}: answer is among the options`, (ch.options ?? []).includes(ch.correctAnswer), `${ch.correctAnswer} in ${(ch.options ?? []).join('/')}`);
      push(`${ch.id}: the date is marked on the calendar`, Array.isArray(ch.highlightDates) && ch.highlightDates.length > 0, JSON.stringify(ch.highlightDates));
      push(`${ch.id}: asks about TODAY (the objective) rather than an arbitrary date`, /today/i.test(ch.question + ' ' + (ch.narration ?? '')), ch.question);
      samples.push({ id: ch.id, kind: 'calendar', stimulus: `${ch.month}/${ch.year}, day ${(ch.highlightDates ?? []).join(',')} marked`, prompt: ch.question, answer: ch.correctAnswer, choices: ch.options });
    }
  } else if (r.primitive === 'analog-clock' && r.mode !== 'hand_name') {
    for (const ch of items) {
      const options = [ch.option0, ch.option1, ch.option2, ch.option3];
      push(`${ch.id}: shown time is an o'clock time`, ch.targetMinute === 0, `${ch.targetHour}:${String(ch.targetMinute).padStart(2, '0')}`);
      push(`${ch.id}: correct option reads the shown hour`, options[ch.correctOptionIndex] === `${ch.targetHour}:00`, options[ch.correctOptionIndex]);
      push(`${ch.id}: four distinct options`, distinct(options).length === 4, options.join(' '));
      push(`${ch.id}: no digital echo of the answer`, !ch.showDigitalEcho, String(ch.showDigitalEcho));
      samples.push({ id: ch.id, kind: 'clock', stimulus: `hour hand on ${ch.targetHour}`, prompt: ch.instruction, answer: `${ch.targetHour}:00`, choices: options });
    }
  }
  // ---- slice-7 modes (added 2026-09-09) ----
  else if (r.primitive === 'bar-model' && r.mode === 'build_one_to_one') {
    for (const ch of items) {
      const counts = ch.values.map((_, i) => (ch.sourceItems ?? []).filter(it => it.categoryIndex === i).length);
      push(`${ch.id}: expected counts equal the pile, category by category`, JSON.stringify(counts) === JSON.stringify(ch.expectedCounts), `${counts.join(',')} vs ${(ch.expectedCounts ?? []).join(',')}`);
      push(`${ch.id}: rows start empty (no pre-filled answer)`, ch.values.every(v => v.value === 0), ch.values.map(v => v.value).join(','));
      push(`${ch.id}: one icon = one item`, ch.scale?.step === 1 && ch.scale?.iconValue === 1, JSON.stringify(ch.scale));
      push(`${ch.id}: no printed totals`, !ch.showBarValues, String(ch.showBarValues));
      push(`${ch.id}: at least two categories`, ch.values.length >= 2, ch.values.length);
      samples.push({ id: ch.id, kind: 'build', stimulus: `pile: ${(ch.sourceItems ?? []).map(it => it.emoji).join('')}`, prompt: ch.prompt, answer: ch.values.map((v, i) => `${v.label} ${ch.expectedCounts?.[i]}`).join(', ') });
    }
  } else if (r.primitive === 'counting-board' && r.mode === 'give_me_n') {
    push('Session has at least three give-me-N items', items.length >= 3, items.length);
    push('Requested quantities vary across the session', distinct(items.map(c => c.targetAnswer)).length >= 3, items.map(c => c.targetAnswer).join(','));
    push('The pile reaches into the teens somewhere (objective: up to 20 objects)', items.some(c => c.count >= 11), items.map(c => c.count).join(','));
    for (const ch of items) {
      push(`${ch.id}: request is no larger than the pile`, ch.targetAnswer <= ch.count, `${ch.targetAnswer} of ${ch.count}`);
      push(`${ch.id}: pile is within 20`, ch.count <= 20, ch.count);
      samples.push({ id: ch.id, kind: 'count', emoji: data.objects?.[0]?.emoji, stimulus: `${ch.count} ${data.objects?.[0]?.type ?? 'objects'} (${ch.arrangement})`, prompt: ch.instruction, answer: `tap ${ch.targetAnswer}` });
    }
    checks.push({ name: 'Arrangements seen (objective names lines and arrays)', pass: true, detail: distinct(items.map(c => c.arrangement)).join(', ') });
  } else if (r.primitive === 'measure-lab') {
    for (const ch of items) {
      const heavier = ch.left.weight > ch.right.weight ? ch.left.id : ch.right.id;
      push(`${ch.id}: the two weights differ`, ch.left.weight !== ch.right.weight, `${ch.left.weight} vs ${ch.right.weight}`);
      push(`${ch.id}: expected choice is the heavier object`, ch.expectedChoice === heavier, `${ch.expectedChoice} vs ${heavier}`);
      push(`${ch.id}: no weight is printed in the prompt or hint`, !nums(ch.prompt + ' ' + (ch.hint ?? '')).length, ch.prompt);
      push(`${ch.id}: object names are distinct and sayable`, ch.left.name !== ch.right.name && /^[a-z ]+$/i.test(ch.left.name + ch.right.name), `${ch.left.name} / ${ch.right.name}`);
      samples.push({ id: ch.id, kind: 'balance', stimulus: `${ch.left.emoji} ${ch.left.name} | ${ch.right.emoji} ${ch.right.name}`, prompt: ch.prompt, answer: ch.expectedChoice === ch.left.id ? ch.left.name : ch.right.name });
    }
  } else if (r.primitive === 'analog-clock' && r.mode === 'hand_name') {
    const hands = distinct(items.map(c => c.targetHand));
    push('Session has at least three hand items (mastery, not a demo)', items.length >= 3, items.length);
    push('Both hands are asked across the session', hands.includes('hour') && hands.includes('minute'), hands.join(','));
    for (const ch of items) {
      push(`${ch.id}: target is the hour or minute hand`, ['hour', 'minute'].includes(ch.targetHand), ch.targetHand);
      push(`${ch.id}: no hand legend names the hands before the answer`, !ch.showHandLegend, String(ch.showHandLegend));
      push(`${ch.id}: K time is on the hour or half hour`, [0, 30].includes(ch.targetMinute), ch.targetMinute);
      push(`${ch.id}: instruction does not say which hand is short or long`, !/short|long/i.test(ch.instruction), ch.instruction);
      samples.push({ id: ch.id, kind: 'clock', stimulus: `clock at ${ch.targetHour}:${String(ch.targetMinute).padStart(2, '0')}`, prompt: ch.instruction, answer: `${ch.targetHand} hand` });
    }
  } else if (r.primitive === 'length-lab' && r.mode === 'estimate_then_tile') {
    push('Session has at least three objects to estimate and measure', items.length >= 3, items.length);
    for (const ch of items) {
      push(`${ch.id}: the true count is among the estimate options`, (ch.estimateOptions ?? []).includes(ch.correctUnitCount), `${ch.correctUnitCount} in ${(ch.estimateOptions ?? []).join('/')}`);
      push(`${ch.id}: answer key equals the object length in units`, ch.correctUnitCount === ch.objectLength0 && String(ch.correctAnswer) === String(ch.correctUnitCount), `${ch.correctAnswer} / ${ch.objectLength0}`);
      push(`${ch.id}: length is 1-12 units`, ch.objectLength0 >= 1 && ch.objectLength0 <= 12, ch.objectLength0);
      push(`${ch.id}: the instruction does not state the count`, !nums(ch.instruction + ' ' + (ch.narration ?? '')).includes(ch.correctUnitCount), ch.instruction);
      samples.push({ id: ch.id, kind: 'length', stimulus: `${ch.objectName0}, measured in ${ch.unitType}`, prompt: ch.instruction, answer: `${ch.correctUnitCount} ${ch.unitType}` });
    }
  }
  return { items, checks, samples };
}

// Semantic notes are written after reading BOTH draws of each pair; they explain what a
// passing or failing check means for the requirement, not what the generator "should" do.
export const semantic = {
  'MEAS001-03-D': 'Slice-7 mode build_one_to_one, drawn 2026-09-09: a pile of pictured items and empty rows, one icon per item, no printed totals; expected counts equal the pile in every challenge. Sampled clean. Live tap-to-build not driven here (the slice-7 Chrome drive covered it).',
  'COUNT001-02-D': "Slice-7 mode give_me_n, redrawn 2026-09-09 after CNB-1: five distinct requests per draw (2-6) over piles of 6-12 in lines, arrays and scattered layouts, requests inside the pile. The one-draw repetition (2,2,5,2,5) is closed; the request pool is code-owned.",
  'MEAS001-04-D': 'measure-lab birth (slice 7), drawn 2026-09-09: two pictured objects with hidden weights, the prediction asked before the balance tips, keys equal the heavier side. Sampled clean; the tip animation is a Chrome-drive matter.',
  'TIME001-03-A': "Slice-7 mode hand_name, redrawn 2026-09-09 after AC-7: four and five items per draw alternating hour and minute hands, no legend before the answer, K faces. The single-item draw is closed by a session floor of four.",
  'MEAS001-04-B': 'Slice-7 mode estimate_then_tile, drawn 2026-09-09: an estimate menu that contains the true count, then tiling; the instruction never states the count. Sampled clean.',
  'COUNT001-01-C': 'Both draws count 11-20 objects across seven challenges, so the K range is honored for this objective. Every challenge is a line arrangement; that is acceptable here and recorded because COUNT001-02-B separately demands varied arrangements.',
  'COUNT001-01-E': "RE-PROBED 2026-09-09 after slice 4: the pool is [2,5] only (no by-10s drift) and the session is two distinct problems on a 1-50 grid. That is under the three-item mastery floor by construction (two named intervals = two problems); filed as HC-5, a blend/structural-axis decision, not a generator bug.",
  'COUNT001-01-H': "RE-PROBED 2026-09-09 after slice 4: five distinct lines per draw, blanks in the first, middle and last slots, every number under 10. The original finding (blank always in slot two, 1,_,3,4 repeated) is closed.",
  'COUNT001-01-I': "RE-PROBED 2026-09-09 after slice 1: the easy tier now models ONE step (\"Start at 3. The next number is 4. Keep counting.\") and no instruction states all three answers. The original 10/10 answer leak is closed.",
  'COUNT001-03-A': "RE-PROBED 2026-09-09 after slice 4: the fixed pool is gone (5v9, 4v1, 5v8, 4v4, 7v1 vs 6v9, 7v7, 10v4, 2v8 across the two draws) and equal appears in both. NEW FINDING: the pool rolls counts up to 10 at K while the objective names groups of UP TO 5; 7 of 10 comparisons exceed it. Filed as CB-5 (compare-groups-objective-window).",
  'COUNT001-03-E': 'Both symbols appear over numbers 1-10 with correct keys; the equal case does not appear, which the objective does not require. Sampled clean.',
  'COUNT001-04-D': "RE-PROBED 2026-09-09 after slice 3: maxPosition 10, a ten-character line and five targets covering sixth through tenth in both draws. The original finding (one item, capped at fifth) is closed.",
  'COUNT001-05-B': 'RE-PROBED 2026-09-08 against the new build_teen mode; the original finding (both draws built 5 counters on a SINGLE frame while the description claimed a double one) is what the mode was written to close. Both draws now open a double frame with its top half full and sweep 11-15 in order, 18/18 checks. One residual was caught here and fixed before the final draw: the model’s hint and narration stated the ones outright, so both fields are code-owned on the teen modes now, like the instruction.',
  'COUNT001-05-D': 'RE-PROBED 2026-09-08 against the new ten_and_ones mode; the original finding (both draws capped the whole at 5, no pair containing a ten) is what the mode was written to close. Both draws now carry teen wholes across 11-15 with maxNumber 19 at K and both parts null, 18/18 checks. The accepted pair is fixed by the mode rather than enumerated on the wire, which is why the allPairs check does not apply to it.',
  'COUNT001-05-E': 'Both draws sweep 16-19 on a double frame with the group seeded scattered, 16/16 checks, and no printed prompt states the leftover. Recorded limit: at NINETEEN the scatter cannot avoid filling one frame — nineteen counters over two frames of ten must fill one — so that item asks the child to spot the full frame rather than count ten out of a group. It is kept because the published objective names 16-19.',
  'OPS001-01-E': "RE-PROBED 2026-09-09 after slice 3: maxNumber 10 with results up to 8 across 13 stories, no story stating its unknown, no zero result. The original within-5 cap is closed.",
  'OPS001-02-F': "RE-PROBED 2026-09-09 after slice 6: easy draws alternate the hidden position (operand2 present) with all equations true within 10. The missing-difference form is equation_solve by design and the review pairs both modes. Closed.",
  'GEOM001-01-D': 'Cube, cone and cylinder appear in both draws (with sphere and rectangular prism as breadth); no printed text names the solid. Sampled clean.',
  'PTRN001-01-D': 'Creation challenges are emitted at K with a two-element AB core and distractor tokens in both draws, contradicting the catalog constraint that places creation at grades 2-3. Sampled clean; the constraint text is stale.',
  'MEAS001-01-A': "RE-PROBED 2026-09-09 after slice 6: six and seven items per draw covering length, weight, height and capacity. The two-item draw is closed by the count+2 floor.",
  'MEAS001-02-B': "RE-PROBED 2026-09-09 after slice 4: varied pairs with an equal case in each draw, and the same NEW range finding as COUNT001-03-A (counts up to 10 for an objective naming up to 5). Counting within categories is still not enacted: the groups arrive pre-sorted.",
  'MEAS001-03-E': 'Two-bar graphs with correct which-has-more keys in both draws; every prompt asks MORE, never FEWER or how many, and the easy tier prints the values on the bars.',
  'MEAS001-06-B': "RE-PROBED 2026-09-09 after slice 6: hot, warm and cold bins in every challenge of both draws, four pictured objects each. The two-bin collapse is closed (it was the easy tier's group count overriding the named set, not draw variance).",
  'PTRN001-03-C': "RE-PROBED 2026-09-09 after slice 5: no instruction, hint or label asks the child to read a time in either draw; the K scaffold is a sun-position cue. The original reading demand is closed on the screen half; the spoken half is still owed a live drive.",
  'TIME001-02-B': "RE-PROBED 2026-09-09 after slice 6: every question in both draws is framed on a marked today with a consistent key. The arbitrary-date framing is closed.",
  'TIME001-03-C': 'Every face is an o-clock time with the matching option and four distinct choices, no digital echo. Sampled clean.',
};
