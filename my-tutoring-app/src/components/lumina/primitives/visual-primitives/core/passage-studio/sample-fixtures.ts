import type { PassageStudioData } from './types';

// ═══════════════════════════════════════════════════════════════════════
// Hand-crafted fixtures for the tester.
//
// These are deliberately authored — we're trying to make decisions about
// the shape of the primitive before wiring up generators. Each fixture
// exercises a different stimulus kind / layout / block mix.
// ═══════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────
// Helper: find a substring's offsets. Used so authoring stays readable
// (we write `findSpan(text, 'plodded along')` instead of hardcoding 47).
// Fails loudly if the substring isn't found — that's a fixture bug.
// ──────────────────────────────────────────────────────────────────────

function findSpan(text: string, needle: string, label?: string): { start: number; end: number; label?: string } {
  const start = text.indexOf(needle);
  if (start < 0) {
    throw new Error(`[passage-studio fixtures] needle not found in text: "${needle}"`);
  }
  return { start, end: start + needle.length, label };
}

// ──────────────────────────────────────────────────────────────────────
// Fixture 1 — Tortoise & Hare (prose, stack layout, elementary)
// Goal: validate the basic stack flow with mixed block types.
// ──────────────────────────────────────────────────────────────────────

const tortoiseText = `One day a Hare laughed at the Tortoise for being so slow. "Do you ever get anywhere?" he said with a long laugh.

"Yes," replied the Tortoise, "and I get there sooner than you think. I'll run you a race and prove it."

The Hare thought this was very funny indeed, but agreed. The Fox set the course and was the judge.

When the race began, the Hare ran so fast that the Tortoise was soon left far behind. The Hare reached the middle of the course, then decided he had so much time that he could afford to take a nap. The Tortoise plodded along, slow and steady, never once stopping.

When the Hare finally awoke, he saw the Tortoise crossing the finish line. The Hare had lost the race.`;

export const tortoiseFixture: PassageStudioData = {
  title: 'The Tortoise and the Hare',
  subtitle: 'A short fable about pace and persistence',
  gradeLevel: 'elementary',
  stimulus: {
    kind: 'prose',
    title: 'The Tortoise and the Hare',
    author: "Aesop's Fables",
    text: tortoiseText,
  },
  layout: 'stack',
  narrativeArc: 'Read the fable, find evidence for the moral, then test understanding of vocabulary in context.',
  blocks: [
    {
      id: 'b1',
      blockType: 'passage-display',
      label: 'The fable',
      tutoringBrief: 'The student is reading the fable. Wait for them to finish before discussing.',
    },
    {
      id: 'b2',
      blockType: 'comprehension-mcq',
      label: 'What happened?',
      question: 'Why did the Hare lose the race?',
      options: [
        'He got lost in the forest.',
        'He took a nap because he thought he had plenty of time.',
        'The Fox cheated as the judge.',
        'The Tortoise tricked him.',
      ],
      correctIndex: 1,
      explanation: 'The Hare was confident he had so much time that he stopped to nap, which let the Tortoise pass him.',
      evidenceAnchor: findSpan(tortoiseText, 'he could afford to take a nap'),
      transitionCue: 'Now find evidence for the moral of the fable.',
    },
    {
      id: 'b3',
      blockType: 'evidence-highlight',
      label: 'Find the evidence',
      claim: 'Steady effort can beat speed without effort.',
      candidateSpans: [
        {
          span: findSpan(tortoiseText, 'plodded along, slow and steady, never once stopping'),
          isEvidence: true,
          rationale: 'Direct description of the Tortoise\'s persistent effort.',
        },
        {
          span: findSpan(tortoiseText, 'he could afford to take a nap'),
          isEvidence: true,
          rationale: "The Hare's overconfidence is the flip side of the Tortoise's persistence — both prove the claim.",
        },
        {
          span: findSpan(tortoiseText, 'The Fox set the course and was the judge'),
          isEvidence: false,
          rationale: 'Just setup detail. Tells us nothing about effort vs. speed.',
        },
        {
          span: findSpan(tortoiseText, 'a Hare laughed at the Tortoise'),
          isEvidence: false,
          rationale: "The Hare's mocking is character setup, not evidence about the moral itself.",
        },
      ],
      minCorrect: 1,
      explanation: 'Strong evidence describes the actual race behaviors. The Tortoise\'s steady effort and the Hare\'s overconfidence are both directly tied to the outcome.',
      transitionCue: 'One more — what does a tricky word mean here?',
    },
    {
      id: 'b4',
      blockType: 'vocab-in-context',
      label: 'Word meaning',
      word: 'plodded',
      targetAnchor: findSpan(tortoiseText, 'plodded'),
      meanings: [
        'Walked slowly and heavily, putting in effort step after step',
        'Ran very quickly',
        'Stopped to rest',
        'Jumped over obstacles',
      ],
      correctIndex: 0,
      explanation: '"Plodded" means to walk steadily and a bit heavily — exactly what the Tortoise does in this story. The phrase "slow and steady, never once stopping" gives you the meaning right there.',
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────
// Fixture 2 — Frost poem (poem, split_passage, middle school)
// Goal: validate the split layout + multiple anchored evidence blocks.
// ──────────────────────────────────────────────────────────────────────

const frostLines = [
  'Two roads diverged in a yellow wood,',
  'And sorry I could not travel both',
  'And be one traveler, long I stood',
  'And looked down one as far as I could',
  'To where it bent in the undergrowth;',
];
const frostText = frostLines.join('\n');

export const frostFixture: PassageStudioData = {
  title: 'Choices in "The Road Not Taken"',
  subtitle: 'First stanza of the Frost classic',
  gradeLevel: 'middle-school',
  stimulus: {
    kind: 'poem',
    title: 'The Road Not Taken (excerpt)',
    author: 'Robert Frost',
    lines: frostLines,
    text: frostText,
  },
  layout: 'split_passage',
  narrativeArc: 'Read the stanza, decode metaphor, find evidence of regret, decode vocabulary.',
  blocks: [
    {
      id: 'f1',
      blockType: 'comprehension-mcq',
      label: 'Reading the metaphor',
      question: 'What do the "two roads" most likely represent in this stanza?',
      options: [
        'A literal hike through a forest the speaker is on.',
        'Two life choices the speaker is forced to pick between.',
        'Two friends arguing about which way to go.',
        'A poem the speaker is having trouble writing.',
      ],
      correctIndex: 1,
      explanation: 'The speaker treats the choice as significant — being "sorry I could not travel both" frames the roads as life paths, not literal trails.',
      evidenceAnchor: findSpan(frostText, 'And sorry I could not travel both'),
      anchors: [findSpan(frostText, 'Two roads diverged in a yellow wood,')],
    },
    {
      id: 'f2',
      blockType: 'evidence-highlight',
      label: 'Evidence of hesitation',
      claim: 'The speaker is hesitating before making a choice.',
      candidateSpans: [
        {
          span: findSpan(frostText, 'long I stood'),
          isEvidence: true,
          rationale: 'Standing for a long time = hesitation.',
        },
        {
          span: findSpan(frostText, 'And looked down one as far as I could'),
          isEvidence: true,
          rationale: 'Trying to see down the path is exactly what someone hesitating would do.',
        },
        {
          span: findSpan(frostText, 'in a yellow wood'),
          isEvidence: false,
          rationale: 'Setting detail, no signal of hesitation.',
        },
      ],
      minCorrect: 1,
      explanation: '"Long I stood" and the careful looking down the path are both signs the speaker is weighing the choice, not deciding quickly.',
    },
    {
      id: 'f3',
      blockType: 'vocab-in-context',
      label: 'Vocabulary',
      word: 'diverged',
      targetAnchor: findSpan(frostText, 'diverged'),
      meanings: [
        'Joined together into one path',
        'Split apart and went in different directions',
        'Were the same color',
        'Were dangerous to walk on',
      ],
      correctIndex: 1,
      explanation: 'If two roads "diverged in a yellow wood," they split apart — that\'s why the speaker has to pick one.',
    },
    {
      id: 'f4',
      blockType: 'pull-quote',
      label: 'Reflect',
      text: 'And sorry I could not travel both / And be one traveler…',
      attribution: 'Frost on the cost of choosing',
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────
// Fixture 3 — Dialogue (kindergarten, stack)
// Goal: smoke-test dialogue stimulus kind with very simple eval blocks.
// ──────────────────────────────────────────────────────────────────────

const dialogueText =
  'Sam: Look at the big red apple!\n' +
  'Pat: Is it sweet?\n' +
  'Sam: Yes, it is very sweet and crunchy.\n' +
  'Pat: I want one too!';

export const dialogueFixture: PassageStudioData = {
  title: 'Sam and Pat Talk About an Apple',
  gradeLevel: 'kindergarten',
  stimulus: {
    kind: 'dialogue',
    title: 'Sam and Pat',
    turns: [
      { speaker: 'Sam', text: 'Look at the big red apple!' },
      { speaker: 'Pat', text: 'Is it sweet?' },
      { speaker: 'Sam', text: 'Yes, it is very sweet and crunchy.' },
      { speaker: 'Pat', text: 'I want one too!' },
    ],
    text: dialogueText,
  },
  layout: 'stack',
  blocks: [
    {
      id: 'd1',
      blockType: 'passage-display',
      label: 'A short conversation',
    },
    {
      id: 'd2',
      blockType: 'comprehension-mcq',
      label: 'Who saw the apple?',
      question: 'Who first saw the apple?',
      options: ['Sam', 'Pat', 'Both at the same time'],
      correctIndex: 0,
      explanation: 'Sam says, "Look at the big red apple!" first.',
      evidenceAnchor: findSpan(dialogueText, 'Sam: Look at the big red apple!'),
    },
    {
      id: 'd3',
      blockType: 'vocab-in-context',
      label: 'Word meaning',
      word: 'crunchy',
      targetAnchor: findSpan(dialogueText, 'crunchy'),
      meanings: [
        'Soft and squishy',
        'Hard and makes a sound when you bite it',
        'Wet and slippery',
      ],
      correctIndex: 1,
      explanation: 'Crunchy apples make a sound when you bite them — that\'s what crunchy means.',
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────
// Registry
// ──────────────────────────────────────────────────────────────────────

export interface FixtureEntry {
  id: string;
  label: string;
  description: string;
  data: PassageStudioData;
}

export const SAMPLE_FIXTURES: FixtureEntry[] = [
  {
    id: 'tortoise',
    label: 'Tortoise & Hare (prose, stack)',
    description: 'Aesop\'s fable. Comprehension MCQ + evidence + vocab. Best for testing the basic stack flow.',
    data: tortoiseFixture,
  },
  {
    id: 'frost',
    label: 'Frost poem (poem, split)',
    description: '"The Road Not Taken" first stanza. Tests poem stimulus + split_passage layout with active-block highlighting.',
    data: frostFixture,
  },
  {
    id: 'dialogue',
    label: 'Sam & Pat (dialogue, stack)',
    description: 'Tiny dialogue stimulus for kindergarten. Smoke-tests the dialogue kind.',
    data: dialogueFixture,
  },
];
