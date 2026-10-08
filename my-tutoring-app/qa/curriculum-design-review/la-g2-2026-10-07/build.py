"""Build the LA Grade 2 curriculum design review: manifests, bundle, briefs, HTML.

Run from anywhere: python build.py. Reads sample.json, catalog.json and evidence/*.json
from this directory; writes manifests/, briefs/, manifest-bundle.json, lessons.json and
index.html. The lesson decisions below are authored review content, not generated.
"""
import hashlib
import html
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
sample = json.loads((HERE / 'sample.json').read_text(encoding='utf-8'))
catalog = {p['id']: p for p in json.loads((HERE / 'catalog.json').read_text(encoding='utf-8'))}
published = {s['id']: (g, s) for g in sample['selected'] for s in g['selectedSubskills']}

# ---------------------------------------------------------------------------
# Probe evidence: one draw per binding, judged by reading the payload.
# verdict: usable | partial | defect
# ---------------------------------------------------------------------------
PROBES = {
    ('LA002-02-a', 'paragraph-architect', 'informational'): ('partial',
        'Shark paragraph with four topic frames and a model paragraph. Only one frame has the form the objective asks for ("___ are fish that live in the ___."). Nothing the child types is checked.'),
    ('LA002-02-c', 'paragraph-architect', 'informational'): ('partial',
        'Honeybee frames; one conclusion frame matches the objective ("These are things to know about ___."). The task is to write a whole paragraph, so there is no choose-the-conclusion task.'),
    ('LA002-02-c', 'knowledge-check', 'apply'): ('usable',
        'One honeybee paragraph and four conclusions. The key ("Now you know how honeybees collect nectar") is right and the near miss adds a new fact. The other two distractors are about other animals, so they are too easy.'),
    ('LA001-03-c', 'word-builder', 'simple_affix'): ('partial',
        'Targets jumped, rewrite, quickly, preview, which match the objective exactly. The payload grade is "Grade 3": the generator raises simple_affix to a grade 3 floor, and the hints use grade 3 words ("inspect", "released").'),
    ('LA001-03-c', 'word-workout', 'read_inflected'): ('partial',
        'mixing, jumping, jumped, rested come from a code-owned list of 12 words with -s/-ing/-ed only. No prefixes, no -ly. The title prints the whole curriculum objective on screen.'),
    ('LA001-03-a', 'syllable-clapper', 'count_parts'): ('defect',
        'Eight words copied from the curriculum examples. Every one has 2 syllables (rabbit, tiger, basket, tunnel, magnet, button, candle, napkin), so "two" is always right and the count cannot discriminate.'),
    ('LA001-05-a', 'decodable-reader', 'literal'): ('partial',
        'Six sentences read cold and judged word by word. The story does not hold together (a bird sings, clouds come, "The smart rabbit ran to dig" with no period, the sun shines). Phonics tags are wrong: green and sweet are tagged digraph, song CVC, rain diphthong.'),
    ('LA001-05-a', 'read-aloud-studio', 'accuracy'): ('partial',
        'Five lines, four of them the curriculum example sentences copied word for word ("Sam had a fast car.", "They will reach the top."). The lines are not a connected passage even though the generator asks for one.'),
    ('LA001-05-a', 'di-sentence-reading', 'read_sentence'): ('partial',
        'Four separate CVC sentences ("Sam has a red cup.", "I can see the big pig."). This is kindergarten decoding; the grade 2 setting had no effect (gradeLevel came back "elementary").'),
    ('LA001-05-b', 'read-aloud-studio', 'expression'): ('defect',
        'The lines are about the objective wording: "Listen to the model voice.", "With steady pacing, we record.", "Clear intonation sounds so good.", "Great expression wins the prize." There is no dialogue, exclamation or feeling to express.'),
    ('LA001-05-b', 'read-aloud-studio', 'dialogue'): ('defect',
        'A Leo/Max knight dialogue, but no line has end punctuation, no ! and no ?. Punctuation is the main cue for expression, and every line reads as flat.'),
    ('LA003-01-b', 'media-player', 'story_analysis'): ('defect',
        'Segment 4\'s narration says "The sentence that truly summarizes the entire passage is: Kind actions and sharing bring happiness to everyone", and its question asks which sentence summarizes the passage. Segments 1 and 3 teach the method and quiz the script\'s own definitions. Source check: at grade 1+ the script stays printed during the question.'),
    ('LA003-01-b', 'passage-studio', 'recall'): ('partial',
        'A 118-word story with a clear central message, shown as text (listening is optional). The questions are a detail, a vocabulary item and an inference. There is no main-idea or best-summary item, which is the objective.'),
    ('LA003-01-a', 'media-player', 'listen_for_details'): ('usable',
        'Three 3-sentence Mars segments, each with one detail question (goal, problem, outcome). The details are well chosen, but one per question; nothing asks the child to judge which facts matter most.'),
    ('LA003-01-a', 'story-talk', 'who_what_where'): ('partial',
        'Five audio-only stories of 22 to 27 words, each asking one who/what/where answer word. Honest listening, but kindergarten length, a quarter of the objective\'s 100-word passages.'),
    ('LA001-02-b', 'phonics-blender', 'cvce_blend'): ('defect',
        'cake, bike, bone, cute, nine: zero blends. Source check: the generator pins the pattern to allowedTypes[0] = "cvce" (gemini-phonics-blender.ts:318), so this mode can never serve a blend.'),
    ('LA001-02-a', 'phonics-blender', 'digraph'): ('usable',
        'ship, chop, thin, dash, rich: initial and final digraphs, each digraph one tile. wh and ph do not appear; the prompt never mentions ph.'),
}

def binding(cid, mode, title, intent, role):
    return {'componentId': cid, 'mode': mode, 'title': title, 'intent': intent, 'role': role}

# ---------------------------------------------------------------------------
# Lessons (authored). Each binding uses a current catalog id + eval mode.
# ---------------------------------------------------------------------------
LESSONS = [
  dict(id='LA002-02-a', title='What Is It? Start With a Definition', verb='write',
    action='Write a first sentence that names the topic and says what kind of thing it is plus one feature ("A mammal is an animal with fur").',
    sequence=[
      binding('paragraph-architect', 'informational', 'Meet a Topic Sentence',
              'Grade 2 informational paragraph about one animal or object. The model topic sentence must define the topic: name its category and one feature (A ___ is a ___ that ___). Child taps the topic sentence in the model, then writes their own with a frame.', 'introduction + supported practice'),
      binding('knowledge-check', 'apply', 'Which Sentence Starts the Paragraph?',
              'Grade 2. Show a short informative paragraph with its first sentence missing. Options: one definition sentence (category + feature), one detail sentence from the body, one opinion, one off-topic sentence.', 'independent check (recognition)'),
    ],
    minutes=15,
    evidence=['Picks the defining sentence over a body detail (knowledge-check).',
              'Writes "A/An [topic] is a [category] that/with [feature]" with a true category and feature. NOT currently judged by any primitive.'],
    limits=['paragraph-architect scores parts present, not quality: an empty frame counts as content (ParagraphArchitect.tsx:540-545, 693-697).',
            'Its modes change only the prompt. Task and score are identical across informational, narrative and opinion.',
            'The only scored right/wrong act is tapping the topic sentence in the model.'],
    decision='new-mode', decisionText='Add a judged "define the topic" mode to paragraph-architect. The writing surface exists; what is missing is a check that the sentence names a category and a true feature. See brief 1.'),
  dict(id='LA002-02-c', title='Wrap It Up: Choosing a Closing Sentence', verb='evaluate',
    action='Read a short body paragraph and choose (then write) a closing sentence that restates the topic without adding a new fact.',
    sequence=[
      binding('paragraph-architect', 'informational', 'See How a Paragraph Ends',
              'Grade 2 informational paragraph. The model concluding sentence restates the topic with a closing phrase (Now you know..., That is how...) and adds no new fact.', 'introduction'),
      binding('knowledge-check', 'apply', 'Pick the Best Ending',
              'Grade 2. Show a 3-sentence informative paragraph. Options: one closing sentence that restates the topic; one that adds a NEW fact about the same topic; one that repeats only a single detail; one about a different topic.', 'independent check'),
      binding('knowledge-check', 'apply', 'Pick the Best Ending Again',
              'Grade 2, new topic. Same structure as before: restating close vs. new-fact sentence vs. single-detail sentence vs. off-topic.', 'fresh review'),
    ],
    minutes=14,
    evidence=['Chooses the restating close over a same-topic new-fact sentence on two fresh paragraphs.',
              'Writing their own close is practiced in paragraph-architect but not scored.'],
    limits=['knowledge-check gives an honest choose-the-ending item (probe), but left alone it writes two off-topic distractors. The intent above asks for same-topic distractors; not re-probed.',
            'Grade 2 has no length cap on the passage inset (prompt only).'],
    decision='reuse', decisionText='Reuse knowledge-check for the choice task the curriculum asks for. Writing a close is covered by brief 1 (same judged-sentence mode family).'),
  dict(id='LA001-03-c', title='Word Parts: un-, re-, pre-, -ed, -ing, -ly', verb='apply',
    action='Read and build words from a base word plus one prefix or suffix, and say what the affix changes.',
    sequence=[
      binding('word-workout', 'read_inflected', 'Read Words With Endings',
              'Grade 2. Cold-read base words with -ing and -ed; after each read the tutor shows base + ending.', 'warm-up (suffixes only)'),
      binding('word-builder', 'simple_affix', 'Build a Word From Its Meaning',
              'Grade 2 prefixes un-, re-, pre- and suffixes -ed, -ing, -ly on familiar base words with no spelling change (unhappy, redo, preview, jumped, playing, quickly).', 'main practice'),
      binding('word-builder', 'simple_affix', 'New Words, Same Parts',
              'Grade 2, fresh base words; same affixes. No word from the previous activity.', 'fresh review'),
    ],
    minutes=15,
    evidence=['Says the target word from its meaning with the parts board visible (word-builder).',
              'The objective says "attaching": the child never puts parts together; they only say the finished word.'],
    limits=['word-builder raises simple_affix to a grade 3 floor (gemini-word-builder.ts:197-199) and the workspace says grades 3-8, so the grade 2 vocabulary request is overridden (probe returned "Grade 3").',
            'word-workout read_inflected is a code-owned list of 12 CVC words with -s/-ing/-ed. No prefixes and no -ly.',
            'word-workout prints the whole curriculum objective as its title (probe).'],
    decision='new-mode', decisionText='Give word-builder a grade 2 band and a build response: the child taps prefix/root/suffix cards to make the word for a meaning. This is the open-build modality (OB-3 already lists word-builder). See brief 3.'),
  dict(id='LA001-03-a', title='Clap the Parts', verb='identify',
    action='Hear a word and clap and count its syllables (1-3), then say the parts.',
    sequence=[
      binding('syllable-clapper', 'blend_syllables', 'Put the Parts Together',
              'Grade 2 picturable words of 1-3 syllables; the tutor says the parts, the child says the word.', 'warm-up'),
      binding('syllable-clapper', 'count_parts', 'Clap and Count',
              'Grade 2 picturable words; MIX 1-, 2- and 3-syllable words so the count changes from word to word (cat, rabbit, banana, basket, elephant).', 'main practice'),
      binding('syllable-clapper', 'count_parts', 'Count New Words',
              'Grade 2, fresh words, mixed 1-3 syllables; no words from the previous activity.', 'fresh review'),
    ],
    minutes=12,
    evidence=['Says the correct syllable count across words whose counts differ.'],
    limits=['The probe drew eight 2-syllable words copied from the curriculum examples, so "two" is always right. The generator has no code rule that spreads the counts.',
            'The workspace lists grades K-1; the objective is grade 2 (the act is the same).'],
    decision='repair', decisionText='Repair, not new: count_parts needs a code rule that a session spans at least two different counts. Route to /eval-fix (SYC-1).'),
  dict(id='LA001-05-a', title='Read the Story Accurately', verb='apply',
    action='Read a short decodable passage aloud with accurate word recognition.',
    sequence=[
      binding('di-sentence-reading', 'read_sentence', 'Warm-Up Sentences',
              'Grade 2 decodable sentences with vowel teams and blends, read alone after a model.', 'warm-up'),
      binding('decodable-reader', 'literal', 'Read the Story',
              'Grade 2 decodable story of 6-8 connected sentences about ONE event; every sentence ends with punctuation; then one literal question.', 'main practice + mastery evidence'),
      binding('read-aloud-studio', 'accuracy', 'Cold Read a New Passage',
              'Grade 2 connected 5-line passage the child has not seen; not the curriculum example sentences.', 'fresh review'),
    ],
    minutes=15,
    evidence=['Reads each sentence of a connected decodable passage cold, judged word by word (decodable-reader).',
              'Reading time / rate is not measured anywhere; the old WPM stat was removed as fake (ReadAloudStudio.tsx:12-18).'],
    limits=['Every judged read is capped at 8 words per utterance (benched ASR limit).',
            'decodable-reader draw: story did not hold together, one sentence missing its period, phonics tags wrong.',
            'read-aloud-studio draw: copied the curriculum example sentences verbatim, not one passage.',
            'di-sentence-reading draw ignored grade 2 and gave kindergarten CVC sentences.'],
    decision='repair', decisionText='Reuse decodable-reader as the honest binding; repair passage coherence and the copy-the-examples habit (DR-G2-1, RAS-2). The time constraint stays unmet on purpose: the project removed fake WPM, and a real rate needs measured audio timing.'),
  dict(id='LA001-05-b', title='Read It Like You Mean It', verb='apply',
    action='Reread a short expressive text (dialogue, exclamations, a question) with pacing and expression after hearing a model.',
    sequence=[
      binding('read-aloud-studio', 'dialogue', 'Read Like the Characters',
              'Grade 2 dialogue between two characters with real end punctuation: at least one ?, one ! and one statement; feelings stated in the story.', 'modeled practice'),
      binding('read-aloud-studio', 'expression', 'Mark the Pauses, Then Read',
              'Grade 2 short connected passage about something exciting (not about reading or recording). Lines carry commas, ! and ? the child can use for phrasing.', 'main practice'),
    ],
    minutes=14,
    evidence=['Word accuracy on the reread after the model (scored).',
              'Expression, pacing and intonation are coached only. "There is no prosody response class, so nothing grades how it sounded" (ReadAloudStudio.tsx:29-38). Mastery of expression needs an adult listening: external review protocol.'],
    limits=['expression draw: lines were about the objective\'s own words ("Clear intonation sounds so good.").',
            'dialogue draw: no line had end punctuation.',
            'No comparison to the model reading exists; reads are judged against the print.'],
    decision='repair', decisionText='Repair content (RAS-1 meta-topic, RAS-3 missing punctuation). Do not build prosody scoring: the project rules out judging live audio quality, so expression remains coached practice with an external check.'),
  dict(id='LA003-01-b', title='What Is the Big Message?', verb='identify',
    action='Listen to a read-aloud story and choose the one sentence that sums up the whole story, not a single detail.',
    sequence=[
      binding('story-talk', 'why_because', 'Why Did It Happen?',
              'Grade 2 read-aloud stories where a character makes a choice; the child says why.', 'listening warm-up'),
      binding('passage-studio', 'recall', 'Read and Listen: The Garden',
              'Grade 2 story of 80-120 words with one clear central message; tutor reads it aloud. Include one question asking which sentence best tells what the whole story is about, with detail-only distractors.', 'main practice (partial fit)'),
    ],
    minutes=15,
    evidence=['Chooses the whole-story summary over true-but-narrow details. No listening primitive asks this today: passage-studio is text-first and its recall mode has no main-idea item; decodable-reader main_idea needs the child to read.'],
    limits=['media-player story_analysis is not usable as drawn: segment 4 narrates the answer, and the script stays printed during questions at grade 1+.',
            'story-talk stories are 3-5 sentences and its answers are single words, so it cannot carry a summary sentence choice.'],
    decision='new-mode', decisionText='New listening mode: hear an 80-120 word story audio-only, choose or say the best whole-story sentence against detail distractors. See brief 2. Separately fix the media-player leak (MP-SA1).'),
  dict(id='LA003-01-a', title='Which Facts Matter Most?', verb='identify',
    action='Listen to a ~100-word passage and pick the three most important facts, leaving out true but minor ones.',
    sequence=[
      binding('media-player', 'listen_for_details', 'Listen for Details',
              'Grade 2 narrated passage in 3 segments about one event (goal, problem, outcome); one detail question per segment.', 'supported practice'),
      binding('story-talk', 'who_what_where', 'Tell Me Who, What, Where',
              'Grade 2 read-aloud stories; the child says the stated detail.', 'independent check (single detail)'),
    ],
    minutes=13,
    evidence=['Recalls single stated details (both bindings).',
              'Choosing the three MOST important facts is not elicited anywhere: no multi-select importance task exists; passage-studio evidence-highlight asks "supports a claim", not "matters most".'],
    limits=['media-player shows the script text during questions at grade 1+, so a listening detail can be looked up.',
            'story-talk passages are about a quarter of the objective\'s 100 words.'],
    decision='new-mode', decisionText='Same new listening mode family as LA003-01-b: a "key details" task where the child keeps 3 important facts and leaves out 2-3 minor true ones. See brief 2.'),
  dict(id='LA001-02-b', title='Blend It: bl, st, mp, nd', verb='apply',
    action='Read words with initial and final consonant blends, hearing each consonant in the cluster.',
    sequence=[
      binding('phonics-blender', 'cvc', 'Warm Up With Short Words',
              'Grade 2 CVC review words that become blend words when one consonant is added (lap > clap, sad > sand).', 'warm-up'),
      binding('phonics-blender', 'cvce_blend', 'Blend the Clusters',
              'Grade 2 words with initial blends (bl, st, cl, fr) and final blends (mp, nd, st): blue, stop, lamp, sand, jump, fast. No silent-e words.', 'main practice'),
    ],
    minutes=12,
    evidence=['Says each blend word aloud from its tiles, judged against the target.'],
    limits=['As built, cvce_blend can never serve a blend: the generator pins the pattern to allowedTypes[0] = cvce (gemini-phonics-blender.ts:318). The probe got cake, bike, bone, cute, nine.',
            'There are no final-blend examples in the prompt, and the UI never groups the blend apart from the vowel-consonant core.'],
    decision='repair', decisionText='Fork the mode: split cvce_blend into cvce and blend (initial + final), the contract-first route for a mode that cannot serve half its name. Route to /eval-fix (PHB-1).'),
  dict(id='LA001-02-a', title='Two Letters, One Sound', verb='apply',
    action='Blend words with sh, ch, th, wh, ph at the start, then at the end.',
    sequence=[
      binding('phonics-blender', 'digraph', 'Digraphs at the Start',
              'Grade 2 words with sh, ch, th, wh, ph at the START (ship, chop, thin, whip, phone).', 'introduction + practice'),
      binding('phonics-blender', 'digraph', 'Digraphs at the End',
              'Grade 2 words with sh, ch, th, ph at the END (dash, rich, path, moth, graph).', 'practice + fresh review'),
    ],
    minutes=12,
    evidence=['Says each digraph word aloud from tiles that show the digraph as one tile.'],
    limits=['The prompt names sh, ch, th, wh only; ph is never mentioned and wh did not appear in the probe.',
            'Position order (initial first) is set by the two intents above, not by the mode.'],
    decision='reuse', decisionText='Reuse. Adding ph to the digraph prompt is a one-line generator change worth doing alongside PHB-1.'),
]

ISSUES = [
  ('PHB-1', 'phonics-blender', 'cvce_blend', 'HIGH', 'Mode never serves blends',
   'Generator pins Pattern Type to evalConstraint.allowedTypes[0] (= cvce) at gemini-phonics-blender.ts:318/396-398, so cvce_blend returns silent-e words only (G2 probe 2026-10-07: cake, bike, bone, cute, nine). Blend objectives (LA001-02-b) get no blend items. Fork into cvce + blend (initial and final). Also: digraph prompt omits ph.', 'GENERATOR + MODE SPLIT'),
  ('SYC-1', 'syllable-clapper', 'count_parts', 'HIGH', 'Constant answer',
   'G2 probe 2026-10-07 copied the curriculum examples: 8/8 words have 2 syllables, so "two" is always right. No code rule spreads counts across a session. Require at least two distinct counts per session.', 'GENERATOR'),
  ('MP-SA1', 'media-player', 'story_analysis', 'HIGH', 'Answer leak',
   'G2 probe 2026-10-07: segment 4 narration states the summary sentence that its question then asks for; segments 1 and 3 quiz the script\'s own definitions of "text evidence". Separately, at grade 1+ the script stays printed during the knowledge check (MediaPlayer.tsx:875-879), so listening questions can be answered by reading back.', 'GENERATOR + COMPONENT'),
  ('RAS-1', 'read-aloud-studio', 'expression', 'MEDIUM', 'Topic is the objective wording',
   'G2 probe 2026-10-07: lines are about reading itself ("Clear intonation sounds so good.", "Great expression wins the prize."), with nothing to express. Intent words (pacing, intonation, model reading) are being used as content.', 'GENERATOR'),
  ('RAS-3', 'read-aloud-studio', 'dialogue', 'MEDIUM', 'No end punctuation',
   'G2 probe 2026-10-07: 5/5 dialogue lines have no . ! or ?, removing the main cue for expression.', 'GENERATOR'),
  ('RAS-2', 'read-aloud-studio', 'accuracy', 'LOW', 'Copies curriculum examples',
   'G2 probe 2026-10-07: 4/5 lines are the objective\'s example sentences verbatim, not one connected passage although the prompt asks for one.', 'GENERATOR'),
  ('DR-G2-1', 'decodable-reader', 'literal', 'LOW', 'Incoherent passage + wrong tags',
   'G2 probe 2026-10-07: six sentences with no single event, one missing its period; phonicsPattern tags wrong (green/sweet = digraph, song = cvc, rain = diphthong). Whether tags render is unconfirmed.', 'GENERATOR'),
  ('WW-T1', 'word-workout', 'read_inflected', 'LOW', 'Objective printed as title',
   'G2 probe 2026-10-07: title is "Word Workout: " + the full curriculum objective text.', 'GENERATOR'),
]

BRIEFS = {
 '1-paragraph-judged-sentences.md': ('Judged topic and closing sentences in paragraph-architect', ['LA002-02-a', 'LA002-02-c'], """
## Learning goal and gap

Grade 2 writers (LANGUAGE_ARTS, unit LA002 Writing, skill LA002-02 Informative Writing) learn to open an informative paragraph with a sentence that defines the topic, and to close it with a sentence that restates the topic without adding a new fact.

- **LA002-02-a:** "Introduce a specific topic using a clear introductory sentence paired with a simple definition... Examples: A mammal is an animal with fur, Sharks are fish that live in the ocean... Constraints: Use fill-in-the-blanks to complete topic introduction sentences."
- **LA002-02-c:** "Draft a concluding statement that effectively brings the informative paragraph to a close... reinforces the topic without introducing new facts."

paragraph-architect already gives the child the writing surface: frames, a model paragraph, and typed topic, detail and closing sentences. It never checks what the child wrote. Practice passes when the fields are non-empty, and picking a frame while leaving the blank empty already counts (ParagraphArchitect.tsx:540-545). The score adds points for parts being present (:693-697). Its three modes change only the prompt. So a child can earn credit with "Sharks are ___." or a closing sentence that adds a new fact. knowledge-check can test recognition (choose the best ending), but nothing tests production.

**Recommendation:** extend paragraph-architect with judged sentence modes rather than build a new primitive. The implementing session should confirm this after reading the component.

## Essential behavior

- **Define the topic.** The child completes or writes one opening sentence that names the topic, gives a category it belongs to, and gives one true feature.
- **Close the paragraph.** Given a body paragraph, the child writes (or, at a simpler level, chooses) a closing sentence that refers back to the topic and adds no new fact.
- **Feedback names what is missing:** the category, the feature, or "that is a new fact".

## Worked examples

- **Define:** topic *insect*.
  - Success: "An insect is a small animal with six legs."
  - Misconception: "Insects are cool." This is an opinion with no category or feature.
  - Misconception: "A bee is an insect." This gives an example instead of a definition.
- **Close:** a body paragraph about how bees collect nectar.
  - Success: "Now you know how bees make food for their hive."
  - Misconception: "Bees also have stingers." This is a new fact, not a close.

## Evidence of success

- **Independent evidence:** across 3 fresh topics, the opening sentence has a category and a true feature, and the closing sentence restates the topic with no new fact.
- **Should not earn credit:** an empty frame, an unchanged frame, a sentence about a different topic, or a close that adds a fact.
- **Uncertain cases:** loose categories ("a thing that..."). Decide whether a category that is true but very broad counts.

## Constraints and open questions

- Grade 2 spelling is unreliable. Judge the meaning, not the spelling.
- A spoken version (oral-sentence-studio already judges a spoken sentence by meaning) may suit weaker writers.
- Do not show the model paragraph's own opening or closing sentence while the child writes theirs.

## Handoff

Read the repository's current guidance (/add-eval-modes, the paragraph-architect contract if one exists) and related capabilities, then design, build and verify the mode with your own process. Schema, naming, judging approach and build order are yours to choose.
"""),
 '2-listening-main-message-key-details.md': ('Listening for the big message and the key details', ['LA003-01-b', 'LA003-01-a'], """
## Learning goal and gap

Grade 2 listeners (LANGUAGE_ARTS, unit LA003 Listening Comprehension and Oral Language, skill LA003-01 Recounting Key Details) learn to tell the whole-story message apart from single details, and to pick the details that matter most.

- **LA003-01-b:** "Students analyze a read-aloud passage to extract the main idea or central message... the student chooses the one best sentence that summarizes the entire passage from a list of distractors."
- **LA003-01-a:** "Students listen to short audio passages and select the most important facts to summarize the core events... a 100-word audio track followed by multiple-choice options to identify the top three key facts."

What exists now:
- **story-talk:** listening-only, but its stories are 3-5 sentences, the answers are single words, and it has no main-idea mode.
- **media-player `story_analysis`:** has no main-idea question type. In the grade 2 probe it narrated the summary sentence before asking for it, and it keeps the script printed during questions at grade 1+.
- **passage-studio:** text-first.
- **decodable-reader `main_idea`:** requires the child to read the passage.
- **Importance:** nothing asks the child to choose which facts matter most.

**Recommendation:** add two listening modes to one owner. story-talk is the likely owner because it is already audio-only and tutor-read. The implementing session may choose a different owner.

## Essential behavior

- The passage is heard, not shown, while the child answers. A re-listen control is fine.
- Passages are 80-120 words, one coherent story or short report.
- **Main message:** the child chooses (or says) the sentence that fits the WHOLE passage. The distractors are true but narrow details plus one off-topic sentence.
- **Key details:** the child keeps the 3 facts needed to retell the core events and leaves out 2-3 facts that are true but minor.

## Worked example

Passage: Pip the squirrel shares acorns with a hurt neighbor, and both end up happy.
- **Main message:**
  - Success: "Being kind to a friend in need makes everyone happier."
  - Misconception: "Ollie hurt his paw." This is true but only one detail.
- **Key details:**
  - Keep: Ollie was hurt and hungry; Pip shared his acorns; both were happy.
  - Leave out: the acorn pile was giant; the tree was hollow.

## Evidence of success

- **Independent evidence:** over several fresh passages, the child picks the whole-story sentence and an important-facts set without the text visible.
- **Should not earn credit:** an answer visible in the narration or on screen, or a set that includes a minor fact. Decide whether 2 of 3 earns partial credit.
- **Uncertainty:** "important" is a judgment. The generator must make the minor facts clearly minor (decorative, not causal) so the key is defensible.

## Constraints and open questions

- No narration may state the answer or the summary.
- Tap or spoken response? Choosing three items by voice is harder; tapping cards with picture support may suit grade 2.
- Fix the media-player leak separately (tracker MP-SA1); do not route around it.

## Handoff

Read the repository's current guidance (/add-eval-modes, /add-live-tutor-tools, story-talk and media-player contracts) and decide the owner, response form and scoring yourself. Build and verify with your own process.
"""),
 '3-word-builder-grade2-build.md': ('Grade 2 affix building in word-builder', ['LA001-03-c'], """
## Learning goal and gap

Grade 2 readers (LANGUAGE_ARTS, unit LA001 Reading Foundations, skill LA001-03 Multi-Syllable Words) learn that a prefix or suffix changes a base word in a predictable way.

- **LA001-03-c:** "Students analyze words with affixes by identifying and attaching common prefixes and suffixes to base words. Focus: Decoding words using knowledge of prefixes (un-, re-, pre-) and suffixes (-ed, -ing, -ly). Examples: unhappy, rewrite, preview, jumped, playing, quickly, redo... Constraints: Highlight the base word and affix in different colors."

word-builder `simple_affix` already shows color-coded prefix, root and suffix cards with meanings, and the grade 2 probe drew exactly the curriculum's words (jumped, rewrite, quickly, preview). Two things stop it from serving this objective:
- **Grade floor:** the generator raises simple_affix to grade 3 (gemini-word-builder.ts:197-199), and the hints used grade 3 vocabulary.
- **No building:** the child only SAYS the finished word. The objective asks them to attach the parts.

word-workout `read_inflected` covers -ing and -ed only, from a fixed list of 12 CVC words.

**Recommendation:** extend word-builder rather than build a new primitive.
- Allow a grade 2 band for simple_affix (un, re, pre, ed, ing, ly on familiar bases with no spelling change).
- Add a build response: the child taps or drags parts to make the word for a meaning, and code checks the parts. This matches the open-build roadmap (qa/open-build/ROADMAP.md, OB-3 lists word-builder).

## Essential behavior

- **Build:** the child sees a meaning ("to do it again") and a board of parts, and makes the word (re + do).
- **Many correct builds where honest:** for "something you can do again", redo, replay and rewrite all count.
- **Read back:** after building, the child reads the word and the tutor names what the affix changed.

## Worked example

- **Target:** "not happy".
  - Success: un + happy.
  - Misconception: happy + ly. A real affix, but the wrong meaning.
- **Target:** "jumped in the past".
  - Success: jump + ed.
  - Misconception: jump + ing. Wrong time.

## Evidence of success

- **Independent evidence:** builds the right parts for fresh meanings without the finished word shown, across both prefixes and suffixes.
- **Should not earn credit:** a word built by trying every part (watch the attempt count), or a nonsense combination.
- **Uncertain cases:** decide whether attaching parts that change the spelling (hop + ing) belongs in grade 2.

## Constraints and open questions

- The current grade 3 floor exists for a reason (the parts board is printed text). Check the reader-fit record before lowering it, and keep grade 3+ behavior unchanged (contract-first: fork by band).
- Base words must be decodable at grade 2.

## Handoff

Read the current guidance (/add-eval-modes build-mode reference, the word-builder contract, reader-fit notes) and choose the band mechanism, response form and scoring. Build and verify with your own process.
"""),
}

def esc(s):
    return html.escape(str(s), quote=True)

def manifest_for(lesson):
    g, sub = published[lesson['id']]
    comps = []
    for i, b in enumerate(lesson['sequence'], 1):
        assert b['componentId'] in catalog, b['componentId']
        assert b['mode'] in {m['id'] for m in catalog[b['componentId']]['modes']}, (b['componentId'], b['mode'])
        comps.append({'componentId': b['componentId'], 'instanceId': f"{lesson['id'].lower()}-{i}-{b['componentId']}",
                      'title': b['title'], 'intent': b['intent'],
                      'config': {'targetEvalMode': b['mode'], 'subject': 'Language Arts', 'unitTitle': g['unitTitle']}})
    block = {'objectiveId': 'obj1', 'objectiveText': sub['description'], 'objectiveVerb': lesson['verb'], 'components': comps}
    layout = [{**c, 'objectiveIds': ['obj1']} for c in comps]
    return {'topic': lesson['title'], 'gradeLevel': 'Grade 2', 'themeColor': '#2f6f5e', 'subject': 'LANGUAGE_ARTS',
            'objectiveBlocks': [block], 'layout': layout}

def wrapper(lesson, n):
    g, sub = published[lesson['id']]
    return {'lessonId': f'lesson-{n:02d}',
            'curriculum': {'subject': 'LANGUAGE_ARTS', 'grade': '2', 'unitId': g['unitId'], 'skillId': g['skill']['id'],
                           'subskillId': sub['id'], 'description': sub['description'],
                           'targetPrimitive': sub.get('target_primitive'), 'targetEvalModes': sub.get('target_eval_modes')},
            'status': 'authored; catalog-checked; each binding generator-probed once; not hydrated as a lesson; not runtime-tested',
            'learnerAction': lesson['action'], 'estimatedMinutes': lesson['minutes'],
            'manifest': manifest_for(lesson),
            'sequence': [{'step': i, 'componentId': b['componentId'], 'evalMode': b['mode'], 'role': b['role']} for i, b in enumerate(lesson['sequence'], 1)],
            'evidenceCriteria': lesson['evidence'], 'coverageLimits': lesson['limits'],
            'recommendation': {'kind': lesson['decision'], 'rationale': lesson['decisionText']}}

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

# ---- write JSON + briefs -------------------------------------------------
(HERE / 'manifests').mkdir(exist_ok=True)
(HERE / 'briefs').mkdir(exist_ok=True)
wrappers = []
for n, lesson in enumerate(LESSONS, 1):
    w = wrapper(lesson, n)
    wrappers.append(w)
    (HERE / 'manifests' / f"{w['lessonId']}-{lesson['id']}.json").write_text(json.dumps(w, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(HERE / 'manifest-bundle.json').write_text(json.dumps(wrappers, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
for fname, (title, ids, body) in BRIEFS.items():
    (HERE / 'briefs' / fname).write_text(f'# {title}\n\nCurriculum IDs: {", ".join(ids)} (LANGUAGE_ARTS, grade 2). Source: design review la-g2-2026-10-07.\n' + body, encoding='utf-8')

# ---- validation ------------------------------------------------------------
ids = [l['id'] for l in LESSONS]
assert len(set(ids)) == 10 and set(ids) == set(published)
assert len({g['skill']['id'] for g in sample['selected']}) == 5
for l in LESSONS:
    g, sub = published[l['id']]
    assert sub['id'].startswith(g['skill']['id'])
inst = [c['instanceId'] for w in wrappers for c in w['manifest']['objectiveBlocks'][0]['components']]
assert len(inst) == len(set(inst))
for k in PROBES:
    assert k[0] in published and k[1] in catalog and k[2] in {m['id'] for m in catalog[k[1]]['modes']}
    assert (HERE / 'evidence' / f'{k[0]}-{k[1]}-{k[2]}.json').exists(), k

# ---- HTML --------------------------------------------------------------------
commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=HERE).stdout.strip()
DEC = {'reuse': ('Reuse', 'ok'), 'repair': ('Repair existing', 'warn'), 'new-mode': ('New mode', 'new'), 'new-primitive': ('New primitive', 'new')}
VER = {'usable': ('usable', 'ok'), 'partial': ('partial', 'warn'), 'defect': ('defect', 'bad')}

def lesson_html(n, l, w):
    g, sub = published[l['id']]
    label, cls = DEC[l['decision']]
    seq = ''.join(f"<li><span class='mono'>{esc(b['componentId'])}</span> · <span class='mono'>{esc(b['mode'])}</span> <span class='role'>{esc(b['role'])}</span><div class='bt'>{esc(b['title'])}</div></li>" for b in l['sequence'])
    probes = ''.join(
        f"<tr><td class='mono'>{esc(p)}<br>{esc(m)}</td><td><span class='chip {VER[v][1]}'>{VER[v][0]}</span></td><td>{esc(t)}</td></tr>"
        for (i, p, m), (v, t) in PROBES.items() if i == l['id'])
    ev = ''.join(f'<li>{esc(x)}</li>' for x in l['evidence'])
    lim = ''.join(f'<li>{esc(x)}</li>' for x in l['limits'])
    fname = f"manifests/{w['lessonId']}-{l['id']}.json"
    return f"""
<section class="lesson" id="{esc(l['id'])}">
  <header class="lh">
    <div><div class="eyebrow">Lesson {n} · {esc(g['unitTitle'])} · {esc(g['skill']['description'])}</div>
    <h3>{esc(l['title'])}</h3></div>
    <span class="chip {cls}">{label}</span>
  </header>
  <p class="cur"><span class="mono">{esc(sub['id'])}</span> {esc(sub['description'])}</p>
  <p class="meta">Published target: <span class="mono">{esc(sub.get('target_primitive') or 'none')}</span> (provenance only) · Planned length {l['minutes']} min</p>
  <div class="grid2">
    <div><h4>Learner action</h4><p>{esc(l['action'])}</p>
      <h4>Sequence</h4><ol class="seq">{seq}</ol></div>
    <div><h4>Evidence of mastery</h4><ul>{ev}</ul>
      <h4>Limits found</h4><ul>{lim}</ul></div>
  </div>
  <div class="decision"><strong>{label}.</strong> {esc(l['decisionText'])}</div>
  <h4>Generator probes (one draw per binding, exact curriculum text, grade 2)</h4>
  <div class="tw"><table class="probes"><tbody>{probes or '<tr><td colspan=3>Bindings in this lesson reuse probed modes from other lessons or were not probed (see table).</td></tr>'}</tbody></table></div>
  <details><summary>Manifest JSON · <a href="{esc(fname)}">{esc(fname)}</a></summary><pre>{esc(json.dumps(w['manifest'], indent=2, ensure_ascii=False))}</pre></details>
</section>"""

counts = {k: sum(1 for l in LESSONS if l['decision'] == k) for k in DEC}
vcounts = {k: sum(1 for v, _ in PROBES.values() if v == k) for k in VER}
rows = ''.join(f"<tr><td class='mono'><a href='#{esc(l['id'])}'>{esc(l['id'])}</a></td><td>{esc(published[l['id']][0]['skill']['description'])}</td><td>{esc(l['title'])}</td><td><span class='chip {DEC[l['decision']][1]}'>{DEC[l['decision']][0]}</span></td></tr>" for l in LESSONS)
issues = ''.join(f"<tr><td class='mono'>{esc(i)}</td><td class='mono'>{esc(p)}<br>{esc(m)}</td><td><span class='chip {'bad' if s=='HIGH' else 'warn'}'>{s}</span></td><td><strong>{esc(c)}.</strong> {esc(d)}</td></tr>" for i, p, m, s, c, d, _ in ISSUES)
briefs = ''.join(f"<details class='brief'><summary><strong>{esc(t)}</strong> · {esc(', '.join(ids))} · <a href='briefs/{esc(f)}'>briefs/{esc(f)}</a></summary><pre class='md'>{esc((HERE/'briefs'/f).read_text(encoding='utf-8'))}</pre></details>" for f, (t, ids, _) in BRIEFS.items())
sel = ''.join(f"<li><span class='mono'>{esc(g['skill']['id'])}</span> {esc(g['skill']['description'])}: {', '.join('<span class=mono>'+esc(s['id'])+'</span>' for s in g['selectedSubskills'])} <span class='muted'>(of {len(g['skill']['subskills'])})</span></li>" for g in sample['selected'])
lessons_html = ''.join(lesson_html(n, l, w) for n, (l, w) in enumerate(zip(LESSONS, wrappers), 1))

page = f"""<title>LA Grade 2 Design Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,650&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column with a sticky section nav; lesson cards carry the detail. */
:root {{
  --bg:#f5f6f3; --surface:#ffffff; --fg:#1e2522; --muted:#5d6762; --line:#d9ddd8;
  --accent:#2f6f5e; --accent-soft:#e2eee9;
  --ok:#2c6e3f; --ok-bg:#e1f0e4; --warn:#8a5a00; --warn-bg:#f7ebcf; --bad:#a3322a; --bad-bg:#f6dfdc; --new:#2f4f9a; --new-bg:#e1e7f6;
  --display:"Source Serif 4", Georgia, serif; --body:"IBM Plex Sans", system-ui, sans-serif; --mono:"IBM Plex Mono", ui-monospace, Consolas, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#141917; --surface:#1c2320; --fg:#e4e9e6; --muted:#9aa5a0; --line:#2f3935;
  --accent:#7cc4ad; --accent-soft:#1f3a32;
  --ok:#8fd3a0; --ok-bg:#1d3324; --warn:#e9c071; --warn-bg:#3a2f14; --bad:#f0a199; --bad-bg:#3d2220; --new:#a9bdf0; --new-bg:#22294a; color-scheme:dark; }} }}
:root[data-theme="dark"] {{
  --bg:#141917; --surface:#1c2320; --fg:#e4e9e6; --muted:#9aa5a0; --line:#2f3935;
  --accent:#7cc4ad; --accent-soft:#1f3a32;
  --ok:#8fd3a0; --ok-bg:#1d3324; --warn:#e9c071; --warn-bg:#3a2f14; --bad:#f0a199; --bad-bg:#3d2220; --new:#a9bdf0; --new-bg:#22294a; color-scheme:dark; }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.6 var(--body); }}
.wrap {{ max-width:980px; margin:0 auto; padding-inline:16px; padding-block:28px 64px; }}
h1,h2,h3 {{ font-family:var(--display); text-wrap:balance; line-height:1.2; margin:0 }}
h1 {{ font-size:2.1rem; font-weight:650 }}
h2 {{ font-size:1.45rem; font-weight:650; margin-top:2.6rem; margin-bottom:.8rem }}
h3 {{ font-size:1.2rem; font-weight:650 }}
h4 {{ font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:1rem 0 .35rem }}
p, li {{ max-width:70ch }}
a {{ color:var(--accent) }}
a:focus-visible, summary:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px }}
.mono {{ font-family:var(--mono); font-size:.86em }}
.muted, .meta {{ color:var(--muted) }}
.meta {{ font-size:.85rem }}
.eyebrow {{ font-size:.74rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:.25rem }}
nav {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding-block:.5rem; display:flex; flex-wrap:wrap; gap:.4rem 1rem; font-size:.88rem }}
.lede {{ font-size:1.05rem; margin-top:.8rem }}
.stats {{ display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1rem }}
.chip {{ display:inline-block; padding:.08rem .55rem; border-radius:999px; font-size:.76rem; font-weight:600; white-space:nowrap }}
.chip.ok {{ background:var(--ok-bg); color:var(--ok) }} .chip.warn {{ background:var(--warn-bg); color:var(--warn) }}
.chip.bad {{ background:var(--bad-bg); color:var(--bad) }} .chip.new {{ background:var(--new-bg); color:var(--new) }}
.tw {{ overflow-x:auto }}
table {{ border-collapse:collapse; width:100%; font-size:.9rem }}
th, td {{ text-align:left; vertical-align:top; padding:.5rem .6rem; border-bottom:1px solid var(--line) }}
th {{ font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:600 }}
.lesson {{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:1.1rem 1.2rem; margin-top:1.2rem; scroll-margin-top:3.5rem }}
.lh {{ display:flex; justify-content:space-between; align-items:flex-start; gap:1rem }}
.cur {{ font-size:.9rem; background:var(--accent-soft); padding:.6rem .75rem; border-radius:6px; margin:.8rem 0 .4rem; max-width:none }}
.grid2 {{ display:grid; grid-template-columns:1fr 1fr; gap:0 1.6rem }}
.grid2 > div {{ min-width:0 }}
@media (max-width:720px) {{ .grid2 {{ grid-template-columns:1fr }} }}
ul, ol {{ padding-left:1.2rem; margin:.2rem 0 }}
.seq li {{ margin-bottom:.45rem }}
.role {{ color:var(--muted); font-size:.8rem }}
.bt {{ font-size:.86rem }}
.decision {{ border-left:3px solid var(--accent); padding:.4rem .8rem; margin:1rem 0 .2rem; background:var(--accent-soft); border-radius:0 6px 6px 0 }}
details {{ margin-top:.8rem }}
summary {{ cursor:pointer; color:var(--muted); font-size:.88rem }}
pre {{ background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:.7rem; overflow-x:auto; font:12.5px/1.5 var(--mono); max-height:420px }}
pre.md {{ white-space:pre-wrap; font-family:var(--body); font-size:.88rem; max-height:none }}
.brief {{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:.7rem 1rem }}
.brief summary {{ color:var(--fg) }}
dl {{ display:grid; grid-template-columns:max-content 1fr; gap:.3rem 1rem; font-size:.88rem }}
dt {{ color:var(--muted) }} dd {{ margin:0; min-width:0; overflow-wrap:anywhere }}
@media (max-width:520px) {{ dl {{ grid-template-columns:1fr }} .lh {{ flex-direction:column }} }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior:auto }} }}
</style>
<div class="wrap">
<div class="eyebrow">Curriculum design review · LANGUAGE_ARTS · Grade 2 · 2026-10-07</div>
<h1>LA Grade 2 Design Review</h1>
<p class="lede">A seeded random draw of 5 published skills and 10 subskills, each planned as a 12-15 minute Lumina lesson from the live catalog. Every binding was drawn once through the production generator with the exact curriculum text. Two lessons can run on existing modes today, four need a repair to an existing mode, and four need a new mode in a primitive that already exists. No new primitive is warranted: every gap is a missing check or a missing task inside a primitive that already has the right surface.</p>
<div class="stats"><span class="chip ok">{counts['reuse']} reuse</span><span class="chip warn">{counts['repair']} repair</span><span class="chip new">{counts['new-mode']} new mode</span><span class="chip ok">{vcounts['usable']} probes usable</span><span class="chip warn">{vcounts['partial']} partial</span><span class="chip bad">{vcounts['defect']} defects</span></div>
<nav><a href="#findings">Findings</a><a href="#sample">Sample</a><a href="#lessons">Lessons</a><a href="#issues">Defects</a><a href="#briefs">Build briefs</a><a href="#provenance">Provenance</a></nav>

<h2 id="findings">What the sweep found</h2>
<ul>
<li><strong>Writing is scored as present or absent, not judged.</strong> paragraph-architect checks only that each field is non-empty, and its three modes change only the prompt. Neither writing objective can be shown as mastered by writing. knowledge-check covers the choose-the-conclusion form honestly. Brief 1.</li>
<li><strong>Listening comprehension stops at single details.</strong> No primitive asks a grade 2 listener for the whole-story message or the facts that matter most. The nearest mode (media-player story_analysis) narrated its own answer in the probe. Brief 2 + MP-SA1.</li>
<li><strong>Two modes cannot do what their names say.</strong> phonics-blender cvce_blend never produces a blend (pinned in code), and syllable-clapper count_parts drew a session where every answer was 2.</li>
<li><strong>Several generators copied the curriculum examples word for word</strong> (syllable-clapper, read-aloud-studio accuracy), and read-aloud-studio expression took the objective's own words as its topic. The examples and constraints in the published text reach the generator as content.</li>
<li><strong>Grade 2 falls between bands.</strong> word-builder floors to grade 3; di-sentence-reading and story-talk serve kindergarten-sized content. Affixes at grade 2 fit the open-build modality. Brief 3.</li>
<li><strong>Fluency and expression stay partly unmeasured on purpose.</strong> Reading rate and prosody are not judged anywhere, and that matches the project's rules on live audio. Those parts of LA001-05 are marked for adult review rather than proposed as builds.</li>
</ul>

<h2 id="sample">Sample</h2>
<p>Seed <span class="mono">{sample['seed']}</span>, {sample['scopedSkillCount']} eligible skills, sampled without replacement at both levels.</p>
<ul>{sel}</ul>
<div class="tw"><table><thead><tr><th>Subskill</th><th>Skill</th><th>Lesson</th><th>Decision</th></tr></thead><tbody>{rows}</tbody></table></div>

<h2 id="lessons">Lessons</h2>
{lessons_html}

<h2 id="issues">Defects found (filed to EVAL_TRACKER.md)</h2>
<div class="tw"><table><thead><tr><th>ID</th><th>Primitive · mode</th><th>Severity</th><th>Finding</th></tr></thead><tbody>{issues}</tbody></table></div>
<p class="meta">Each is from a single draw plus a source read. Rates are unmeasured except where the code makes the outcome certain (PHB-1).</p>

<h2 id="briefs">Build briefs</h2>
<p>Each brief stands alone for a new session and leaves schema, naming and build order to that session.</p>
{briefs}

<h2 id="provenance">Provenance and validation</h2>
<dl>
<dt>Curriculum</dt><dd>GET http://127.0.0.1:8000/api/curriculum/curriculum/LANGUAGE_ARTS?grade=2, saved as snapshot.json, sha256 <span class="mono">{sha(HERE/'snapshot.json')}</span>, 7 units</dd>
<dt>Sampler</dt><dd>.agents/skills/curriculum-design-review/scripts/sample_curriculum.py, {esc(sample['algorithm'])}, Python {esc(sample['pythonVersion'])}, sampled {esc(sample['sampledAt'])}</dd>
<dt>Catalog</dt><dd>Live export through the Vite module runner (export-catalog.mjs) at commit <span class="mono">{commit}</span> plus the uncommitted working tree; {len(catalog)} primitives; catalog.json sha256 <span class="mono">{sha(HERE/'catalog.json')}</span></dd>
<dt>Probes</dt><dd>{len(PROBES)} draws via /api/lumina/eval-test (topic = intent = exact subskill text, grade=2, difficulty=medium), saved under evidence/. The endpoint's "fail" status on 9 draws is its challenge-array shape check; those primitives have no challenge array. Content was judged by reading each payload.</dd>
<dt>Source checks</dt><dd>Read-only code reads of paragraph-architect, knowledge-check, revision-workshop, sentence-builder, oral-sentence-studio, phonics-blender, syllable-clapper, word-builder, word-workout, decodable-reader, read-aloud-studio, di-sentence-reading, reading-repair-studio, media-player, passage-studio and story-talk. File:line citations are in the lesson limits and the defects table.</dd>
<dt>Validated</dt><dd>10 distinct subskills under 5 distinct skills with parent membership; every binding's component and eval mode exists in the live catalog; instance IDs unique; every probe file present; manifests are valid JSON.</dd>
<dt>Not done</dt><dd>No lesson was hydrated or run end to end, no Live/microphone session was driven, and each binding has one draw only. The authored intents were not re-probed. Teaching effectiveness is not claimed.</dd>
</dl>
<p class="meta">Files: <a href="manifest-bundle.json">manifest-bundle.json</a> · <a href="sample.json">sample.json</a> · manifests/ · briefs/ · in the repo only: snapshot.json, catalog.json, evidence/ (qa/curriculum-design-review/la-g2-2026-10-07/)</p>
</div>
"""
(HERE / 'index.html').write_text(page, encoding='utf-8')
print('ok', len(LESSONS), 'lessons,', len(PROBES), 'probes,', len(BRIEFS), 'briefs')
