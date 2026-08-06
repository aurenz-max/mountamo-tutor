import { describe, expect, it } from 'vitest';
import { fastFactOracle } from '../fast-fact';
import type { OracleViolation } from '../types';

/**
 * Seeded-violation tests for the fast-fact oracle.
 *
 * Every fixture below is trimmed verbatim from a real /api/lumina/eval-test
 * generation on 2026-08-06 — four subjects, because fast-fact is explicitly not
 * a math primitive: state capitals (grade 4), element symbols (grade 7), sight
 * words (K) and counting to 20 (K).
 *
 * `litLeaky` and `mathLive` are NOT mutated. They are what the generator
 * actually shipped, and they carry the bugs this oracle exists to catch — the
 * sight-word drill leaks the answer in all ten items, and the counting drill
 * parks the correct button in slot 1 eight times out of ten. Each mutated
 * fixture below then proves one further check class fires.
 */

const ctxHist = { componentId: 'fast-fact', evalMode: 'default', topic: 'US state capitals', gradeLevel: 'elementary', grade: '4' };
const ctxSci = { componentId: 'fast-fact', evalMode: 'default', topic: 'Element symbols', gradeLevel: 'middle school', grade: '7' };
const ctxLit = { componentId: 'fast-fact', evalMode: 'default', topic: 'Sight words', gradeLevel: 'kindergarten', grade: 'K' };
const ctxMath = { componentId: 'fast-fact', evalMode: 'default', topic: 'Counting to 20', gradeLevel: 'kindergarten', grade: 'K' };
// Tighter ceiling on the same counting fixture — proves the scope check bites.
const ctxMathScope10 = { ...ctxMath, topic: 'Counting to 10' };

const checks = (v: OracleViolation[]) => v.map((x) => x.check).sort();

// --- CLEAN: history. Emoji are decorative, options are city names, the stem
// never names its own answer. Representation shift honored. -------------------
const histClean = {
  title: 'Capital Quest', subject: 'History',
  challenges: [
    { id: 'cap_1', type: 'recall', prompt: { text: 'What is the capital of Texas?', subtext: 'Choose the correct city.', visual: { type: 'emoji', emoji: '🤠', alt: 'Cowboy hat emoji' } }, correctAnswer: 'Austin', responseMode: 'choice', options: ['Houston', 'Austin', 'Dallas', 'San Antonio'] },
    { id: 'cap_2', type: 'recall', prompt: { text: 'What is the capital of California?', subtext: 'Choose the correct city.', visual: { type: 'emoji', emoji: '☀️', alt: 'Sun emoji' } }, correctAnswer: 'Sacramento', responseMode: 'choice', options: ['Los Angeles', 'San Francisco', 'Sacramento', 'San Diego'] },
    { id: 'cap_3', type: 'recall', prompt: { text: 'What is the capital of New York?', subtext: 'Choose the correct city.', visual: { type: 'emoji', emoji: '🗽', alt: 'Statue of Liberty emoji' } }, correctAnswer: 'Albany', responseMode: 'choice', options: ['New York City', 'Albany', 'Buffalo', 'Syracuse'] },
    { id: 'cap_4', type: 'recall', prompt: { text: 'What is the capital of Florida?', subtext: 'Choose the correct city.', visual: { type: 'emoji', emoji: '🌴', alt: 'Palm tree emoji' } }, correctAnswer: 'Tallahassee', responseMode: 'choice', options: ['Miami', 'Orlando', 'Tallahassee', 'Tampa'] },
    { id: 'cap_5', type: 'apply', prompt: { text: 'Which state has Salem as its capital?', subtext: 'Work backwards from the capital.', visual: { type: 'emoji', emoji: '🌲', alt: 'Pine tree emoji' } }, correctAnswer: 'Oregon', responseMode: 'choice', options: ['Washington', 'Oregon', 'Nevada', 'Idaho'] },
    { id: 'cap_6', type: 'apply', prompt: { text: 'Which state has Denver as its capital?', subtext: 'Work backwards from the capital.', visual: { type: 'emoji', emoji: '⛰️', alt: 'Mountain emoji' } }, correctAnswer: 'Colorado', responseMode: 'choice', options: ['Colorado', 'Utah', 'Wyoming', 'Montana'] },
    { id: 'cap_7', type: 'apply', prompt: { text: 'What is the capital of Illinois?', subtext: 'Choose the correct city.', visual: { type: 'emoji', emoji: '🌽', alt: 'Corn ear emoji' } }, correctAnswer: 'Springfield', responseMode: 'choice', options: ['Chicago', 'Springfield', 'Peoria', 'Rockford'] },
    { id: 'cap_8', type: 'apply', prompt: { text: 'What is the capital of Ohio?', subtext: 'Choose the correct city.', visual: { type: 'emoji', emoji: '🌰', alt: 'Chestnut emoji' } }, correctAnswer: 'Columbus', responseMode: 'choice', options: ['Cleveland', 'Cincinnati', 'Columbus', 'Dayton'] },
    { id: 'cap_9', type: 'rapid-recall', prompt: { text: 'What is the capital of Washington?', subtext: 'Watch out for the trick!', visual: { type: 'emoji', emoji: '☕', alt: 'Coffee cup emoji' } }, correctAnswer: 'Olympia', responseMode: 'choice', options: ['Seattle', 'Olympia', 'Spokane', 'Tacoma'] },
    { id: 'cap_10', type: 'rapid-recall', prompt: { text: 'What is the capital of Massachusetts?', subtext: 'Choose the correct city.', visual: { type: 'emoji', emoji: '🦞', alt: 'Lobster emoji' } }, correctAnswer: 'Boston', responseMode: 'choice', options: ['Boston', 'Salem', 'Cambridge', 'Plymouth'] },
  ],
};

// --- CLEAN: science. The PRD's canonical good shape — symbol → NAME and
// name → SYMBOL. The visual and the options are different representations. ----
const sciClean = {
  title: 'Element Symbol Flash', subject: 'Science',
  challenges: [
    { id: 'fs_1', type: 'recall', prompt: { text: 'What is the chemical symbol for Oxygen?', subtext: 'Identify the standard one- or two-letter symbol.', visual: { type: 'emoji', emoji: '🌬️', alt: 'Wind symbol representing oxygen' } }, correctAnswer: 'O', responseMode: 'choice', options: ['O', 'Ox', 'Om', 'C'] },
    { id: 'fs_2', type: 'recall', prompt: { text: 'What is the chemical symbol for Carbon?', subtext: 'Identify the standard element symbol.', visual: { type: 'emoji', emoji: '⬛', alt: 'Black square representing carbon' } }, correctAnswer: 'C', responseMode: 'choice', options: ['Ca', 'Cb', 'C', 'Co'] },
    { id: 'fs_3', type: 'recall', prompt: { text: 'What is the chemical symbol for Hydrogen?', subtext: 'Identify the standard element symbol.', visual: { type: 'emoji', emoji: '💧', alt: 'Water droplet' } }, correctAnswer: 'H', responseMode: 'choice', options: ['Hy', 'Hd', 'Hr', 'H'] },
    { id: 'fs_4', type: 'recall', prompt: { text: 'What is the chemical symbol for Nitrogen?', subtext: 'Identify the standard element symbol.' }, correctAnswer: 'N', responseMode: 'choice', options: ['Ni', 'N', 'Nt', 'Na'] },
    { id: 'fs_5', type: 'apply', prompt: { text: "Which element has the chemical symbol 'Na'?", subtext: 'Think about Latin roots for elements.', visual: { type: 'emoji', emoji: '🧂', alt: 'Salt shaker' } }, correctAnswer: 'Sodium', responseMode: 'choice', options: ['Sodium', 'Nitrogen', 'Neon', 'Nickel'] },
    { id: 'fs_6', type: 'apply', prompt: { text: "Which element has the chemical symbol 'K'?", subtext: 'Think about Latin roots for elements.', visual: { type: 'emoji', emoji: '🍌', alt: 'Banana' } }, correctAnswer: 'Potassium', responseMode: 'choice', options: ['Krypton', 'Potassium', 'Phosphorus', 'Cobalt'] },
    { id: 'fs_7', type: 'apply', prompt: { text: 'What is the correct chemical symbol for Iron?', subtext: 'Consider historical names for metals.' }, correctAnswer: 'Fe', responseMode: 'choice', options: ['Ir', 'In', 'Fe', 'F'] },
    { id: 'fs_8', type: 'apply', prompt: { text: 'What is the correct chemical symbol for Silver?', subtext: 'Consider historical names for precious metals.', visual: { type: 'emoji', emoji: '🥈', alt: 'Silver medal' } }, correctAnswer: 'Ag', responseMode: 'choice', options: ['Si', 'Sl', 'S', 'Ag'] },
    { id: 'fs_9', type: 'rapid-recall', prompt: { text: 'What is the chemical symbol for Gold?', subtext: 'Quick identification.', visual: { type: 'emoji', emoji: '🥇', alt: 'Gold medal' } }, correctAnswer: 'Au', responseMode: 'choice', options: ['Gd', 'Go', 'Au', 'Ag'] },
    { id: 'fs_10', type: 'rapid-recall', prompt: { text: 'What is the chemical symbol for Copper?', subtext: 'Quick identification.' }, correctAnswer: 'Cu', responseMode: 'choice', options: ['Co', 'C', 'Cp', 'Cu'] },
  ],
};

// --- UNMUTATED, LEAKY: the real sight-word drill. 7 items show the answer as
// the visual; 3 more quote it in the stem. Ten items, ten leaks. -------------
const litLeaky = {
  title: 'Sight Word Sprint', subject: 'Language Arts',
  challenges: [
    { id: 'sf_1', type: 'recall', prompt: { text: 'Which word is this?', subtext: 'Look at the letters', visual: { type: 'text-large', largeText: 'the', alt: 'The word the' } }, correctAnswer: 'the', responseMode: 'choice', options: ['the', 'and', 'big'] },
    { id: 'sf_2', type: 'recall', prompt: { text: 'Find the word:', subtext: 'Read the sight word', visual: { type: 'text-large', largeText: 'see', alt: 'The word see' } }, correctAnswer: 'see', responseMode: 'choice', options: ['cat', 'see', 'run'] },
    { id: 'sf_3', type: 'recall', prompt: { text: 'What word is shown here?', subtext: 'Look carefully', visual: { type: 'text-large', largeText: 'cat', alt: 'The word cat' } }, correctAnswer: 'cat', responseMode: 'choice', options: ['dog', 'cat', 'rat'] },
    { id: 'sf_4', type: 'recall', prompt: { text: 'Can you spot the word?', subtext: 'Identify the sight word', visual: { type: 'text-large', largeText: 'is', alt: 'The word is' } }, correctAnswer: 'is', responseMode: 'choice', options: ['it', 'in', 'is'] },
    { id: 'sf_5', type: 'apply', prompt: { text: "Which option spells 'and'?", subtext: 'Match the word' }, correctAnswer: 'and', responseMode: 'choice', options: ['and', 'dad', 'bad'] },
    { id: 'sf_6', type: 'apply', prompt: { text: "Choose the word 'you':", subtext: 'Find the match' }, correctAnswer: 'you', responseMode: 'choice', options: ['yoy', 'you', 'your'] },
    { id: 'sf_7', type: 'apply', prompt: { text: "Which word is 'to'?", subtext: 'Select the correct word' }, correctAnswer: 'to', responseMode: 'choice', options: ['do', 'go', 'to'] },
    { id: 'sf_8', type: 'rapid-recall', prompt: { text: 'What word is this?', subtext: 'Fast check', visual: { type: 'text-large', largeText: 'a', alt: 'The letter a' } }, correctAnswer: 'a', responseMode: 'choice', options: ['a', 'i', 'o'] },
    { id: 'sf_9', type: 'rapid-recall', prompt: { text: 'Find the word:', subtext: 'Fast check', visual: { type: 'text-large', largeText: 'it', alt: 'The word it' } }, correctAnswer: 'it', responseMode: 'choice', options: ['in', 'it', 'at'] },
    { id: 'sf_10', type: 'rapid-recall', prompt: { text: 'Select the correct sight word:', subtext: 'Fast check', visual: { type: 'text-large', largeText: 'run', alt: 'The word run' } }, correctAnswer: 'run', responseMode: 'choice', options: ['fun', 'sun', 'run'] },
  ],
};

// --- UNMUTATED: the real counting drill. Emoji→numeral is a proper
// representation shift and every count matches its key — but the correct button
// sits in slot 1 eight times out of ten. --------------------------------------
const mathLive = {
  title: 'Super Counting Within 20', subject: 'Math',
  challenges: [
    { id: 'count_1', type: 'count', prompt: { text: 'How many apples do you see?', subtext: 'Count carefully', visual: { type: 'emoji', emoji: '🍎🍎🍎🍎🍎', alt: '5 apples' } }, correctAnswer: '5', responseMode: 'choice', options: ['3', '5', '6'] },
    { id: 'count_2', type: 'count', prompt: { text: 'How many stars are shown?', subtext: 'Count the stars', visual: { type: 'emoji', emoji: '⭐✨⭐✨⭐✨⭐', alt: '7 stars' } }, correctAnswer: '7', responseMode: 'choice', options: ['6', '7', '8'] },
    { id: 'count_3', type: 'count', prompt: { text: 'Count the happy faces!', subtext: 'Count them up', visual: { type: 'emoji', emoji: '😀😀😀😀😀😀😀😀😀', alt: '9 happy faces' } }, correctAnswer: '9', responseMode: 'choice', options: ['9', '10', '8'] },
    { id: 'count_4', type: 'count', prompt: { text: 'How many balloons are here?', subtext: 'Count the balloons', visual: { type: 'emoji', emoji: '🎈🎈🎈🎈🎈🎈🎈🎈🎈🎈', alt: '10 balloons' } }, correctAnswer: '10', responseMode: 'choice', options: ['10', '9', '11'] },
    { id: 'sequence_1', type: 'sequence', prompt: { text: 'What number comes after 11?', subtext: 'Find the next number' }, correctAnswer: '12', responseMode: 'choice', options: ['10', '12', '13'] },
    { id: 'sequence_2', type: 'sequence', prompt: { text: 'Which number is missing: 13, __, 15', subtext: 'Fill in the blank' }, correctAnswer: '14', responseMode: 'choice', options: ['13', '14', '16'] },
    { id: 'sequence_3', type: 'sequence', prompt: { text: 'What number comes before 17?', subtext: 'Think backward' }, correctAnswer: '16', responseMode: 'choice', options: ['18', '16', '15'] },
    { id: 'advanced_1', type: 'challenge', prompt: { text: 'How many cats are shown?', subtext: 'Count the cats', visual: { type: 'emoji', emoji: '🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱', alt: '12 cats' } }, correctAnswer: '12', responseMode: 'choice', options: ['11', '12', '13'] },
    { id: 'advanced_2', type: 'challenge', prompt: { text: 'Which number is larger: 14 or 18?', subtext: 'Compare the numbers' }, correctAnswer: '18', responseMode: 'choice', options: ['14', '18'] },
    { id: 'advanced_3', type: 'challenge', prompt: { text: 'Count all the fish!', subtext: 'Count carefully up to 20', visual: { type: 'emoji', emoji: '🐠🐠🐠🐠🐠🐠🐠🐠🐠🐠🐠🐠🐠🐠🐠', alt: '15 fish' } }, correctAnswer: '15', responseMode: 'choice', options: ['14', '15', '16'] },
  ],
};

// A position-balanced counting fixture, so mutation tests below isolate the
// check under test instead of also tripping the live clustering finding.
// (Reversing would not do it: with three options, reversing leaves the middle
// slot fixed — which is exactly where this generator parked the answer.)
const mathBalanced = {
  ...mathLive,
  challenges: mathLive.challenges.map((c, i) => {
    const shift = i % c.options.length;
    return { ...c, options: [...c.options.slice(shift), ...c.options.slice(0, shift)] };
  }),
};

describe('fast-fact oracle — clean fixtures pass', () => {
  it('passes a real state-capitals drill (History)', () => {
    expect(fastFactOracle.verify(histClean, ctxHist).violations).toEqual([]);
  });

  it('passes a real element-symbol drill (Science) — symbol→name is a valid representation shift', () => {
    expect(fastFactOracle.verify(sciClean, ctxSci).violations).toEqual([]);
  });

  it('does not flag a decorative emoji beside a non-numeric answer', () => {
    // 🥇 next to "chemical symbol for Gold?" is a hint, not the answer.
    const one = { ...sciClean, challenges: sciClean.challenges.slice(8, 9) };
    const leaks = fastFactOracle.verify(one, ctxSci).violations.filter((v) => v.check === 'answer-leak');
    expect(leaks).toEqual([]);
  });

  it('does not flag a stem that mentions a distractor alongside the answer', () => {
    // "Which number is larger: 14 or 18?" names both — that is the problem
    // statement, not a giveaway.
    const one = { ...mathLive, challenges: mathLive.challenges.slice(8, 9) };
    const leaks = fastFactOracle.verify(one, ctxMath).violations.filter((v) => v.check === 'answer-leak');
    expect(leaks).toEqual([]);
  });

  it('does not flag an incidental short function word in the instructions', () => {
    // "Look at the letters" contains "the" but is not leaking the answer "the";
    // only the VISUAL leak should fire on this item.
    const one = { ...litLeaky, challenges: litLeaky.challenges.slice(0, 1) };
    const leaks = fastFactOracle.verify(one, ctxLit).violations.filter((v) => v.check === 'answer-leak');
    expect(leaks).toHaveLength(1);
    expect(leaks[0].detail).toContain('IS the answer');
  });
});

describe('fast-fact oracle — real generations that ship bugs', () => {
  it('flags every item of the real sight-word drill as an answer leak', () => {
    const result = fastFactOracle.verify(litLeaky, ctxLit);
    expect(result.violations).toHaveLength(10);
    expect(new Set(result.violations.map((v) => v.check))).toEqual(new Set(['answer-leak']));
    // 7 visual-identity leaks + 3 quoted-in-stem leaks.
    expect(result.violations.filter((v) => v.detail.includes('IS the answer'))).toHaveLength(7);
    expect(result.violations.filter((v) => v.detail.includes('quotes the answer'))).toHaveLength(3);
  });

  it('flags the real counting drill for parking the correct button in one slot', () => {
    const result = fastFactOracle.verify(mathLive, ctxMath);
    expect(checks(result.violations)).toEqual(['clustering']);
    expect(result.violations[0].where).toBe('correct-option position');
    expect(result.violations[0].detail).toContain('gameable by position');
  });

  it('passes the same counting drill once the correct button moves around', () => {
    expect(fastFactOracle.verify(mathBalanced, ctxMath).violations).toEqual([]);
  });
});

describe('fast-fact oracle — seeded violations, one per check class', () => {
  it('flags answer-leak — the visual IS the answer (the observed 2026-08-06 bug)', () => {
    // Exactly the shipped item: text-large "7" over "Which number is shown here?"
    const data = {
      ...mathBalanced,
      challenges: [
        {
          id: 'leak_1', type: 'recall',
          prompt: { text: 'Which number is shown here?', subtext: 'Look at the digit', visual: { type: 'text-large', largeText: '7', alt: 'The number 7' } },
          correctAnswer: '7', responseMode: 'choice', options: ['6', '7', '8'],
        },
        ...mathBalanced.challenges.slice(1),
      ],
    };
    const leaks = fastFactOracle.verify(data, ctxMath).violations.filter((v) => v.check === 'answer-leak');
    expect(leaks).toHaveLength(1);
    expect(leaks[0].where).toContain('leak_1');
    expect(leaks[0].detail).toContain('DIFFERENT representations');
  });

  it('flags answer-key-desync — the emoji count disagrees with the key', () => {
    const data = {
      ...mathBalanced,
      // 5 apples on screen, key says 6: a student who counts right is marked wrong.
      challenges: mathBalanced.challenges.map((c) => (
        c.id === 'count_1' ? { ...c, correctAnswer: '6', options: ['3', '6', '5'] } : c
      )),
    };
    const v = fastFactOracle.verify(data, ctxMath).violations.filter((x) => x.check === 'answer-key-desync');
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('visual shows 5 emoji but the key says 6');
  });

  it('flags answer-key-desync — acceptableAnswers collides with a distractor', () => {
    const data = {
      ...histClean,
      challenges: histClean.challenges.map((c) => (
        c.id === 'cap_1' ? { ...c, acceptableAnswers: ['Houston'] } : c
      )),
    };
    const v = fastFactOracle.verify(data, ctxHist).violations.filter((x) => x.check === 'answer-key-desync');
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('2 options grade correct');
  });

  it('flags answer-key-desync — no option grades correct', () => {
    const data = {
      ...histClean,
      challenges: histClean.challenges.map((c) => (
        c.id === 'cap_1' ? { ...c, correctAnswer: 'Waco' } : c
      )),
    };
    const v = fastFactOracle.verify(data, ctxHist).violations.filter((x) => x.check === 'answer-key-desync');
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('never be right');
  });

  it("flags answer-key-desync — the '???' sentinel ships as the key", () => {
    const data = {
      ...histClean,
      challenges: histClean.challenges.map((c) => (
        c.id === 'cap_1' ? { ...c, correctAnswer: '???' } : c
      )),
    };
    const v = fastFactOracle.verify(data, ctxHist).violations.filter((x) => x.check === 'answer-key-desync');
    expect(v.some((x) => x.detail.includes("'???' sentinel"))).toBe(true);
  });

  it('flags answer-leak — a single-option challenge is a freebie', () => {
    const data = {
      ...histClean,
      challenges: histClean.challenges.map((c) => (
        c.id === 'cap_1' ? { ...c, options: ['Austin'] } : c
      )),
    };
    const v = fastFactOracle.verify(data, ctxHist).violations.filter((x) => x.check === 'answer-leak');
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('single button');
  });

  it('flags schema — duplicate options', () => {
    const data = {
      ...histClean,
      challenges: histClean.challenges.map((c) => (
        c.id === 'cap_1' ? { ...c, options: ['Houston', 'Austin', 'Houston', 'Dallas'] } : c
      )),
    };
    const v = fastFactOracle.verify(data, ctxHist).violations.filter((x) => x.check === 'schema');
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('duplicate options');
  });

  it('flags schema — a drill too short to measure automaticity', () => {
    const data = { ...histClean, challenges: histClean.challenges.slice(0, 3) };
    const v = fastFactOracle.verify(data, ctxHist).violations.filter((x) => x.check === 'schema');
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('only 3 challenges');
  });

  it('flags schema — no challenges at all', () => {
    const v = fastFactOracle.verify({ ...histClean, challenges: [] }, ctxHist).violations;
    expect(checks(v)).toEqual(['schema']);
  });

  it('flags scope — answers exceed the topic ceiling', () => {
    // Same real counting fixture, retargeted at "Counting to 10".
    const v = fastFactOracle.verify(mathBalanced, ctxMathScope10).violations.filter((x) => x.check === 'scope');
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].detail).toContain('exceeds the topic ceiling 10');
  });

  it('honors an explicit scopeMax over the parsed topic ceiling', () => {
    const v = fastFactOracle.verify(mathBalanced, { ...ctxMath, scopeMax: 12 }).violations.filter((x) => x.check === 'scope');
    // 14, 15, 16 and 18 all breach a ceiling of 12.
    expect(v).toHaveLength(4);
  });

  it('flags clustering — every answer is the same value', () => {
    const data = {
      ...histClean,
      challenges: histClean.challenges.map((c) => ({ ...c, correctAnswer: 'Austin', options: ['Austin', 'Houston', 'Dallas'] })),
    };
    const v = fastFactOracle.verify(data, ctxHist).violations.filter((x) => x.check === 'clustering');
    expect(v.some((x) => x.where === 'correctAnswer values')).toBe(true);
  });

  it('reports an image visual as unchecked rather than silently passing it', () => {
    const data = {
      ...histClean,
      challenges: histClean.challenges.map((c) => (
        c.id === 'cap_1'
          ? { ...c, prompt: { ...c.prompt, visual: { type: 'image', imageUrl: 'https://example.test/austin.png', alt: 'a city' } } }
          : c
      )),
    };
    expect(fastFactOracle.verify(data, ctxHist).uncheckedTypes).toEqual(['image-visual']);
  });

  it('does not count glyphs for a DERIVED quantity (live false positive, 2026-08-06)', () => {
    // Real generation: 🖐️🖐️ with "How many fingers make up two full hands?" and
    // key 10. Counting glyphs gives 2, but the item is legitimate — the counted
    // noun ("fingers") is not what the picture depicts ("two hands").
    const data = {
      ...mathBalanced,
      challenges: [
        { id: 'd1', type: 'sequence', prompt: { text: 'How many fingers make up two full hands?', subtext: 'Think in tens', visual: { type: 'emoji', emoji: '🖐️🖐️', alt: 'two hands' } }, correctAnswer: '10', responseMode: 'choice', options: ['5', '10', '20'] },
        ...mathBalanced.challenges.slice(1),
      ],
    };
    const v = fastFactOracle.verify(data, ctxMath).violations.filter((x) => x.check === 'answer-key-desync');
    expect(v).toEqual([]);
  });

  it('still counts glyphs when the prompt counts what the picture depicts', () => {
    // Same shape, but now the counted noun IS attested in the alt text — so the
    // key must match the picture, and 15 stars against a key of 8 is a desync.
    const data = {
      ...mathBalanced,
      challenges: [
        { id: 'd2', type: 'count', prompt: { text: 'How many stars are shown?', subtext: 'Count them', visual: { type: 'emoji', emoji: '⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐', alt: '15 stars' } }, correctAnswer: '8', responseMode: 'choice', options: ['7', '8', '9'] },
        ...mathBalanced.challenges.slice(1),
      ],
    };
    const v = fastFactOracle.verify(data, ctxMath).violations.filter((x) => x.check === 'answer-key-desync');
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('visual shows 15 emoji but the key says 8');
  });

  it('reports an unverifiable count (no alt text) instead of guessing', () => {
    const data = {
      ...mathBalanced,
      challenges: [
        { id: 'd3', type: 'count', prompt: { text: 'How many stars are shown?', visual: { type: 'emoji', emoji: '⭐⭐⭐', alt: '' } }, correctAnswer: '9', responseMode: 'choice', options: ['8', '9', '10'] },
        ...mathBalanced.challenges.slice(1),
      ],
    };
    const result = fastFactOracle.verify(data, ctxMath);
    expect(result.violations.filter((x) => x.check === 'answer-key-desync')).toEqual([]);
    expect(result.uncheckedTypes).toContain('emoji-count-without-alt');
  });

  it('counts emoji grapheme clusters, not code units', () => {
    // ⭐✨ alternating (7 glyphs) and a VS16-bearing emoji must each count once.
    const data = {
      ...mathBalanced,
      challenges: [
        { id: 'g1', type: 'count', prompt: { text: 'How many suns?', visual: { type: 'emoji', emoji: '☀️☀️☀️', alt: '3 suns' } }, correctAnswer: '3', responseMode: 'choice', options: ['2', '3', '4'] },
        ...mathBalanced.challenges.slice(1),
      ],
    };
    const v = fastFactOracle.verify(data, ctxMath).violations.filter((x) => x.check === 'answer-key-desync');
    expect(v).toEqual([]);
  });
});
