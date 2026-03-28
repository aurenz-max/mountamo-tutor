# Grade 1 Curriculum PRD

Parent: [K-12 Curriculum Expansion](K12_CURRICULUM_EXPANSION.md)
Status: In Progress (CSVs authored, LA reauthoring required, graph not built)

---

## Current State

Grade 1 has ~496 subskills authored across 4 subjects:

| Subject        | Subskills | Lumina Renderability |
|----------------|-----------|----------------------|
| Language Arts  | 150       | **FAILING** — requires Lumina-first reauthoring (see below) |
| Mathematics    | 115       | Good — strong primitive coverage (ten-frame, base-ten-blocks, number-line, etc.) |
| Science        | 119       | Moderate — needs renderability review |
| Social Studies | 112       | Moderate — needs renderability review |

CSV files exist in `backend/data/first-grade/`. No Arts subject has been authored. No prerequisite graph edges have been defined.

### Language Arts Reauthoring Required

The current LA CSV was authored **standards-first** from Common Core RF.1/W.1/SL.1/L.1/RL.1/RI.1. Many subskills describe classroom activities that cannot be rendered in Lumina:

**Examples of un-renderable subskills in the current CSV:**
- `LA001-01-C` "Track print accurately during independent reading, using finger" — physical book skill
- `LA001-01-G` "Identify the role of the author and illustrator" — trivia, not interactive practice
- `LA003-01-B` "Participate in collaborative conversations with diverse partners" — requires peers
- `LA003-02-D` "Give simple oral presentations, using appropriate eye contact" — physical performance
- `LA007-02-E` "Use props, costumes, and scenery to enhance dramatic play" — physically impossible

The reauthored structure below replaces the current 7-unit / 150-subskill LA layout with a Lumina-first design that maps every subskill to a specific primitive, problem type, or AI tutor session.

---

## Subjects and Units

### Mathematics

Aligned to Common Core Standards: 1.OA, 1.NBT, 1.MD, 1.G

| Unit ID | Unit Name                            | Description                                                                                          |
|---------|--------------------------------------|------------------------------------------------------------------------------------------------------|
| OPS001  | Operations and Algebraic Thinking    | Addition and subtraction within 20, word problems with add-to/take-from/compare, properties of operations, relationship between addition and subtraction |
| NBT001  | Number and Operations in Base Ten    | Counting to 120, place value for tens and ones, add within 100 using place value strategies            |
| MEAS001 | Measurement and Data                 | Ordering objects by length, measuring with non-standard units, telling time to the hour and half-hour, organizing and interpreting data |
| GEOM001 | Geometry                             | Defining attributes of shapes, composing and decomposing two- and three-dimensional shapes, partitioning circles and rectangles into halves and quarters |
| PTRN001 | Patterns                             | Identifying, extending, and creating repeating and growing patterns, patterns in addition tables        |

**Key primitives:** `addition-subtraction-scene`, `number-bond`, `base-ten-blocks`, `place-value-chart`, `number-line`, `ten-frame`, `measurement-tools`, `shape-builder`, `shape-sorter`, `pattern-builder`, `balance-scale`, `math-fact-fluency`

### Language Arts / ELA (Lumina-First Reauthoring)

Aligned to Common Core Standards: RF.1, W.1, L.1, RL.1, RI.1. Delivery channels: interactive primitives, problem types, and AI tutor sessions.

**Previous structure (7 units, 150 subskills) → New structure (7 units, ~105 subskills)**

| Unit ID | Unit Name | Description | Primary Primitives / Channels |
|---------|-----------|-------------|-------------------------------|
| LA001 | Phonics and Decoding | Consonant blends, digraphs, vowel patterns, r-controlled vowels, inflectional endings, multi-syllable decoding | `phonics-blender`, `cvc-speller`, `decodable-reader`, `letter-sound-link`, `spelling-pattern-explorer` |
| LA002 | Phonological Awareness | Long/short vowel discrimination, blending, segmenting, phoneme substitution in spoken words | `phoneme-explorer`, `sound-swap`, `rhyme-studio`, `syllable-clapper` |
| LA003 | Reading Fluency and Comprehension | Decode connected text with accuracy, sequence story events, identify characters/settings/problems, find main idea, use text evidence | `decodable-reader`, `read-aloud-studio`, `story-map`, `character-web`, `evidence-finder`, `sequencing-activity` |
| LA004 | Grammar and Sentence Building | Nouns, verbs, adjectives, pronouns, prepositions, sentence types, expand and combine sentences, subject-verb agreement | `sentence-builder`, `sentence-analyzer`, `categorization-activity`, `matching-activity` |
| LA005 | Vocabulary and Word Study | Context clues, synonyms/antonyms, word categories, prefixes/suffixes, shades of meaning, sight words | `context-clues-detective`, `vocabulary-explorer`, `word-builder`, `word-workout`, `matching-activity`, `categorization-activity` |
| LA006 | Writing and Composition | Sentence formation, paragraph structure with beginning/middle/end, opinion and informative writing, punctuation and capitalization, spelling | `paragraph-architect`, `sentence-builder`, `revision-workshop`, `opinion-builder`, AI tutor sessions |
| LA007 | Listening Comprehension and Oral Language | Listen to passages and answer questions, retell stories orally, describe scenes using complete sentences, oral vocabulary use | `listen-and-respond`, `story-map`, AI tutor sessions (Gemini Live) |

#### Unit-by-Unit Primitive Mapping

**LA001 — Phonics and Decoding** (~20 subskills)

| Skill Area | Example Subskills | Target Primitive |
|-----------|------------------|-----------------|
| Short/long vowel decoding | Decode CVC words with short vowels; decode CVCe words with long vowels | `cvc-speller`, `phonics-blender` |
| Consonant blends | Blend onset+rime for bl-, st-, tr- words | `phonics-blender` |
| Digraphs | Read words with sh, ch, th, wh | `phonics-blender`, `letter-sound-link` |
| Inflectional endings | Add -s, -ed, -ing to base words and read the result | `word-builder` |
| R-controlled vowels | Decode ar, or, er, ir, ur words | `phonics-blender`, `spelling-pattern-explorer` |
| Vowel teams | Decode words with ai, ea, oa, ee, igh | `phonics-blender`, `spelling-pattern-explorer` |
| Sight words | Recognize and read grade-level high-frequency words | `fast-fact` (sight word mode), `decodable-reader` |
| Multi-syllable decoding | Break two-syllable words into parts and decode | `syllable-clapper` → `phonics-blender` |
| Contractions | Read and expand common contractions (can't, won't, it's) | `word-builder`, `matching-activity` |

**LA002 — Phonological Awareness** (~10 subskills)

| Skill Area | Example Subskills | Target Primitive |
|-----------|------------------|-----------------|
| Vowel discrimination | Distinguish long vs. short vowel in spoken words | `phoneme-explorer` (isolate mode) |
| Blending | Blend individual phonemes into spoken words including blends | `phoneme-explorer` (blend mode) |
| Segmenting | Segment spoken words into individual phonemes | `phoneme-explorer` (segment mode) |
| Phoneme isolation | Identify initial, medial, and final sounds | `phoneme-explorer` (isolate mode) |
| Phoneme substitution | Change one sound to make a new word (cat → bat) | `sound-swap` |
| Syllable awareness | Count syllables in multi-syllable words | `syllable-clapper` |
| Rhyme production | Generate words that rhyme with a target | `rhyme-studio` |

**LA003 — Reading Fluency and Comprehension** (~20 subskills)

| Skill Area | Example Subskills | Target Primitive |
|-----------|------------------|-----------------|
| Oral reading accuracy | Read grade-level decodable passages aloud with <5% error rate | `read-aloud-studio`, AI tutor session |
| Reading rate | Read grade-level text at 40-60 WPM by end of year | `read-aloud-studio`, `decodable-reader` |
| Expression | Read dialogue and exclamations with appropriate intonation | AI tutor session (Gemini Live models expression) |
| Story elements | Identify characters, setting, and major events from a passage | `story-map`, `character-web` |
| Sequence events | Arrange story events in chronological order | `sequencing-activity` |
| Central message | Select the main idea or lesson of a story | `multiple-choice`, `evidence-finder` |
| Key details | Identify details that support the main idea | `evidence-finder` |
| Character traits | Infer how a character feels based on their words and actions | `character-web`, `multiple-choice` |
| Predictions | Predict what happens next based on text clues | `multiple-choice`, AI tutor session |
| Text features | Match text features (heading, caption, bold word) to their purpose | `matching-activity` |
| Compare texts | Identify similarities and differences between two short passages | `categorization-activity`, `multiple-choice` |

**LA004 — Grammar and Sentence Building** (~18 subskills)

| Skill Area | Example Subskills | Target Primitive |
|-----------|------------------|-----------------|
| Nouns | Sort words into common vs. proper nouns | `categorization-activity` |
| Verbs | Identify the action word in a sentence | `sentence-analyzer` |
| Adjectives | Choose adjectives to complete descriptive sentences | `fill-in-blanks` |
| Pronouns | Replace a noun with the correct pronoun | `fill-in-blanks`, `matching-activity` |
| Verb tense | Select past/present/future verb form for a sentence | `multiple-choice`, `sentence-builder` |
| Prepositions | Complete sentences with location/direction prepositions | `fill-in-blanks` |
| Subject-verb agreement | Build sentences with matching singular/plural noun-verb pairs | `sentence-builder` |
| Sentence types | Classify sentences as statement, question, exclamation, or command | `categorization-activity` |
| Expand sentences | Add adjectives and prepositional phrases to a simple sentence | `sentence-builder` |
| Combine sentences | Join two simple sentences with and, but, or | `sentence-builder` |
| Punctuation | Place the correct end mark on a sentence | `multiple-choice`, `fill-in-blanks` |
| Capitalization | Identify which words need capital letters | `fill-in-blanks`, `sentence-analyzer` |

**LA005 — Vocabulary and Word Study** (~15 subskills)

| Skill Area | Example Subskills | Target Primitive |
|-----------|------------------|-----------------|
| Context clues | Read a sentence and choose the word that best fits a blank | `context-clues-detective` |
| Synonyms | Match words with similar meanings | `matching-activity` |
| Antonyms | Match words with opposite meanings | `matching-activity` |
| Word categories | Sort words into categories (animals, foods, colors, etc.) | `categorization-activity` |
| Shades of meaning | Order verbs or adjectives by intensity (walk → march → stomp) | `sequencing-activity` |
| Prefixes/suffixes | Build new words by adding un-, re-, -ful, -less to base words | `word-builder` |
| Word attributes | Match a word to its category + defining attribute | `matching-activity`, `vocabulary-explorer` |
| Sight word fluency | Rapidly recognize high-frequency words in timed drill | `fast-fact` |
| Real-life connections | Match vocabulary words to pictures or scenarios showing their meaning | `matching-activity`, `vocabulary-explorer` |

**LA006 — Writing and Composition** (~15 subskills)

| Skill Area | Example Subskills | Target Primitive |
|-----------|------------------|-----------------|
| Complete sentences | Arrange word tiles into a grammatically correct sentence | `sentence-builder` |
| Sentence variety | Write sentences of different types (statement, question) for a prompt | `sentence-builder`, AI tutor session |
| Paragraph structure | Order sentences into a paragraph with beginning, middle, end | `paragraph-architect`, `sequencing-activity` |
| Opinion writing | State an opinion and select supporting reasons from a list | `opinion-builder` |
| Informative writing | Complete an informative paragraph by filling in topic sentence, details, closing | `paragraph-architect` |
| Narrative writing | Sequence narrative events and add descriptive details | `story-planner`, `paragraph-architect` |
| Spelling patterns | Spell words using common patterns (CVC, CVCe, vowel teams) | `cvc-speller`, `spelling-pattern-explorer` |
| Punctuation in writing | Add correct punctuation to unpunctuated sentences | `revision-workshop` |
| Capitalization in writing | Fix capitalization errors in a paragraph | `revision-workshop` |
| Editing | Identify and correct errors in a sample paragraph | `revision-workshop` |

**LA007 — Listening Comprehension and Oral Language** (~7 subskills)

| Skill Area | Example Subskills | Target Primitive |
|-----------|------------------|-----------------|
| Listen and answer | Answer questions about a passage read aloud by the AI tutor | `listen-and-respond`, `multiple-choice` |
| Retelling | Retell a story orally after hearing it, hitting key events | AI tutor session (Gemini Live evaluates retelling) |
| Oral description | Describe a picture or scene using complete sentences with details | AI tutor session |
| Following directions | Listen to 2-3 step instructions from the AI tutor and demonstrate understanding | AI tutor session, `sequencing-activity` |
| Oral vocabulary | Use new vocabulary words in spoken sentences during AI tutor conversation | AI tutor session |
| Listening for details | Identify specific details (who, what, where, when) from an audio passage | `listen-and-respond`, `multiple-choice` |
| Ask and answer | Ask the AI tutor clarifying questions about a topic | AI tutor session |

### Science

Aligned to NGSS: 1-PS4, 1-LS1, 1-LS3, 1-ESS1, K-2-ETS1

| Unit ID | Unit Name                  | Description                                                                                  |
|---------|----------------------------|----------------------------------------------------------------------------------------------|
| SCI001  | Physical Sciences          | Sound and light, vibrations and sound waves, light and shadow, communication with light/sound |
| SCI002  | Life Sciences              | Animal and plant structures, how parents and offspring are alike and different, survival needs |
| SCI003  | Earth and Space Sciences   | Patterns of the sun, moon, and stars, daylight changes across seasons                         |
| SCI004  | Engineering and Technology  | Asking questions, designing solutions, testing and comparing designs for simple problems       |

**Key primitives:** `matter-explorer`, `states-of-matter`, `organism-card`, `life-cycle-sequencer`, `classification-sorter`, `habitat-diorama`, `day-night-seasons`, `moon-phases-lab`, `bridge-builder`, `tower-stacker`

### Social Studies

| Unit ID | Unit Name              | Description                                                                               |
|---------|------------------------|-------------------------------------------------------------------------------------------|
| SS001   | Civics and Government   | Rules and laws, authority figures, symbols and traditions of the United States              |
| SS002   | Economics               | Wants vs. needs, making choices, jobs in the community, trading and bartering               |
| SS003   | Geography               | Maps and directions, physical and human features of the local environment, weather patterns  |
| SS004   | History                 | Understanding past and present, historical figures, personal and family timelines            |
| SS005   | Culture and Diversity   | Families and traditions, similarities and differences among people, celebrations and customs  |

**Key primitives:** `timeline-explorer`, `categorization-activity`, `matching-activity`, `multiple-choice`, `fact-file`, AI tutor sessions

### Arts

Not yet authored. Consider adding to match Kindergarten scope and provide cross-subject connections (e.g., music patterns linking to PTRN001, visual arts linking to GEOM001).

---

## Estimated Scope

| Subject        | Units | Skills (est.) | Subskills (est.) | Renderability |
|----------------|-------|----------------|-------------------|--------------|
| Mathematics    | 5     | 25-30          | 115               | Pass |
| Language Arts  | 7     | 25-30          | ~105 (down from 150) | **Reauthor required** |
| Science        | 4     | 20-25          | 119               | Review needed |
| Social Studies | 5     | 25-30          | 112               | Review needed |
| **Total**      | **21**| **95-115**     | **~451**          | |

Note: LA subskill count decreased from 150 to ~105 because un-renderable classroom activities were removed and overly broad process skills were consolidated into discrete primitive-backed steps.

## ID Conventions

All Grade 1 unit IDs use the following prefixes:

- Mathematics: `OPS001`, `NBT001`, `MEAS001`, `GEOM001`, `PTRN001`
- Language Arts: `LA001` through `LA007`
- Science: `SCI001` through `SCI004`
- Social Studies: `SS001` through `SS005`

Subskill IDs follow the pattern: `G1-{UNIT_ID}-{SKILL_ID}-{SUBSKILL_NUM}` (e.g., `G1-OPS001-add-within-20-01`).

## Difficulty Calibration

| Parameter         | Value   |
|-------------------|---------|
| Starting range    | 1-2     |
| Ending range      | 2-5     |
| Target range      | 1-3     |

Grade 1 difficulty remains at the concrete-to-pictorial level, with early introduction of symbolic representation.

## Cross-Grade Prerequisites

### From Kindergarten (Grade 0)

- **K Counting and Cardinality** feeds into **OPS001** (Operations and Algebraic Thinking) -- students must count to 100 and understand one-to-one correspondence before beginning addition/subtraction
- **K Phonemic Awareness** (phoneme-explorer, sound-swap, rhyme-studio) feeds into **LA001** (Phonics and Decoding) -- students must recognize letter-sound relationships before progressing to blending and decoding
- **K Alphabet Recognition** (letter-tracing, alphabet-sequence, letter-picture) feeds into **LA001** -- letter knowledge is prerequisite for phonics
- **K Sight Words** (sight-word-card) feeds into **LA005** (Vocabulary) and **LA003** (Reading Fluency)

### To Grade 2

- **OPS001** addition/subtraction within 20 feeds into **OPS002** (addition/subtraction within 100)
- **NBT001** place value for tens and ones feeds into **NBT002** (place value to 1000)
- **LA001** phonics and decoding feeds into Grade 2 **LA001** (advanced phonics patterns, multi-syllable words)
- **LA003** reading fluency and comprehension basics feed into Grade 2 reading literature and informational text
- **LA004** grammar foundations feed into Grade 2 grammar (complex sentences, irregular verbs)

## Graph Requirements

- **Minimum edge density target:** 2.5 edges per subskill (currently 0 -- graph not yet built)
- **Cross-unit connectivity target:** Every unit must have at least one outgoing edge to another unit within the same grade
- **Key prerequisite chains within the grade:**
  - PTRN001 (Patterns) should feed into OPS001 (supports understanding of addition properties)
  - NBT001 (Base Ten) should feed into MEAS001 (measurement relies on place value understanding)
  - LA001 (Phonics and Decoding) → LA003 (Reading Fluency) → LA006 (Writing and Composition)
  - LA002 (Phonological Awareness) → LA001 (Phonics and Decoding)
  - LA004 (Grammar and Sentence Building) → LA006 (Writing and Composition)
  - LA005 (Vocabulary) → LA003 (Reading Fluency and Comprehension)

## Authoring Notes

1. **Lumina-first design (CRITICAL).** Every subskill must target a named Lumina primitive, problem type, or AI tutor session. See parent PRD §5 (Lumina-First Design Principle). The existing LA CSV fails this test and must be reauthored using the unit-by-unit primitive mapping above before graph building begins.

2. **Concrete-to-symbolic transition:** Grade 1 is the bridge year between purely manipulative/concrete learning (Kindergarten) and symbolic/abstract representation. All math primitives should support both concrete visuals (ten frames, base-ten blocks) and symbolic notation.

3. **Addition and subtraction centerpiece:** The math curriculum centers on addition and subtraction within 20. Ensure deep coverage of all problem types: add-to, take-from, put-together/take-apart, and compare. Word problems should reflect diverse real-world contexts.

4. **Reading transition:** Students move from decoding individual words to reading connected text. LA001 (Phonics and Decoding) is the highest-priority unit. The K→1 transition builds on existing K primitives (`phonics-blender`, `cvc-speller`, `phoneme-explorer`) and adds more complex patterns (blends, digraphs, vowel teams).

5. **AI tutor as first-class channel:** LA007 (Listening Comprehension and Oral Language) relies heavily on Gemini Live AI tutor sessions. Subskills like retelling, oral description, and conversational vocabulary practice are inherently oral — the AI tutor IS the primitive for these skills. This is not a fallback; it's the designed delivery channel.

6. **Arts gap:** The absence of an Arts subject is a known gap. When authored, consider 2-3 units covering visual arts, music, and dramatic play, targeting approximately 50-70 subskills. Apply the same renderability test.

7. **Standards alignment:** All mathematics units are mapped to Common Core Grade 1 domains. Science units align to NGSS Performance Expectations for Grade 1 and K-2 Engineering. Social Studies follows state standards patterns common across C3-aligned curricula. Note that Lumina-first design may mean some standards are covered differently than traditional classroom instruction — the learning outcome is preserved even if the activity changes.

## Quality Gates

From parent PRD:

- [ ] All subskills have unique, descriptive IDs following the naming convention
- [ ] **Every subskill targets a named primitive, problem type, or AI tutor session (Lumina renderability gate)**
- [ ] Every subskill has at least one prerequisite edge (except entry-level skills)
- [ ] No orphan nodes in the prerequisite graph
- [ ] Difficulty values assigned and calibrated within the grade-appropriate range
- [ ] Common Core / NGSS alignment codes attached to every applicable subskill

Grade-specific additions:

- [ ] **Language Arts CSV reauthored** using Lumina-first unit mapping (replaces current 150-subskill standards-first version)
- [ ] Science and Social Studies CSVs reviewed for renderability
- [ ] Arts subject authored and integrated into the graph
- [ ] Prerequisite graph edges built for all subskills
- [ ] Cross-grade edges defined from Kindergarten terminal skills
- [ ] Cross-grade edges defined to Grade 2 entry skills
- [ ] Concrete/symbolic scaffolding verified for all math subskills
