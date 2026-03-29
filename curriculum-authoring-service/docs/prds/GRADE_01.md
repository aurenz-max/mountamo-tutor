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

**Key primitives:** `addition-subtraction-scene`, `number-bond`, `base-ten-blocks`, `place-value-chart`, `number-line`, `ten-frame`, `measurement-tools`, `shape-builder`, `shape-sorter`, `pattern-builder`, `balance-scale`, `math-fact-fluency`, `clock-face`, `bar-graph-builder`, `hundreds-chart`, `fraction-bar`, `pattern-blocks`, `coin-counter`

#### Unit-by-Unit Primitive Mapping

**OPS001 — Operations and Algebraic Thinking** (~32 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Addition within 10 | Add two single-digit numbers with sum ≤ 10 using concrete objects; Add two single-digit numbers with sum ≤ 10 using ten-frame visualization; Recall addition facts within 10 from memory (fluency) | `ten-frame`, `math-fact-fluency` |
| Subtraction within 10 | Subtract single-digit numbers within 10 using concrete objects; Subtract single-digit numbers within 10 using ten-frame; Recall subtraction facts within 10 from memory (fluency) | `ten-frame`, `math-fact-fluency` |
| Addition within 20 — strategies | Add within 20 by counting on from the larger addend; Add within 20 by making ten (e.g., 8+5 = 8+2+3 = 13); Add within 20 by decomposing an addend into tens and ones | `ten-frame`, `number-bond`, `number-line` |
| Subtraction within 20 — strategies | Subtract within 20 by counting back on a number line; Subtract within 20 by decomposing to ten (e.g., 14−6 = 14−4−2); Subtract within 20 using the relationship to addition (think-addition) | `number-line`, `number-bond`, `ten-frame` |
| Word problems — add-to / take-from | Solve add-to word problems with result unknown (Jan had 5 apples, got 3 more, how many now?); Solve add-to word problems with change unknown (Jan had 5 apples, got some more, now has 8); Solve take-from word problems with result unknown; Solve take-from word problems with change unknown | `addition-subtraction-scene`, `number-bond` |
| Word problems — put-together / take-apart | Solve put-together word problems with total unknown (3 red and 4 blue, how many altogether?); Solve put-together word problems with addend unknown (7 total, 3 are red, how many are blue?); Solve take-apart word problems with both addends unknown (7 animals — how many could be cats and dogs?) | `addition-subtraction-scene`, `number-bond` |
| Word problems — compare | Solve compare word problems with difference unknown (Jan has 8, Kim has 5, how many more does Jan have?); Solve compare word problems with bigger unknown (Kim has 5, Jan has 3 more than Kim, how many does Jan have?); Solve compare word problems with smaller unknown | `addition-subtraction-scene`, `number-bond`, `balance-scale` |
| Three addends | Add three whole numbers whose sum is ≤ 20 (e.g., 4+3+6); Add three numbers by first making a ten from two addends (e.g., 7+3+5 → 10+5) | `number-bond`, `ten-frame` |
| Properties of operations | Demonstrate the commutative property (3+5 = 5+3) by rearranging groups; Demonstrate the associative property by grouping three addends differently and showing the same sum | `balance-scale`, `number-bond` |
| Relationship between addition and subtraction | Find the unknown number in a subtraction equation by thinking of it as addition (? − 3 = 5 → ?= 3+5); Write a related addition fact for a given subtraction fact and vice versa | `number-bond`, `balance-scale` |
| Meaning of the equal sign | Determine whether an equation is true or false (e.g., 6 = 6, 5+2 = 8, 4+1 = 3+2); Find the unknown number that makes an equation true (e.g., 3 + ? = 7, ? = 4 + 4) | `balance-scale`, `math-fact-fluency` |

**NBT001 — Number and Operations in Base Ten** (~24 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Counting to 120 | Count forward from any number within 120 (e.g., start at 67, count to 85); Count backward from any number within 120; Read and write numerals to 120; Represent a quantity of objects by writing the numeral (up to 120) | `number-line`, `hundreds-chart` |
| Tens and ones — understanding | Show a two-digit number as tens and ones using base-ten blocks (e.g., 34 = 3 tens 4 ones); Identify the tens digit and ones digit in a two-digit number; Represent a number on a place-value chart with tens and ones columns | `base-ten-blocks`, `place-value-chart` |
| Tens as a unit | Understand that the numbers 10, 20, 30, … 90 refer to one, two, three, … nine tens (and 0 ones); Compose a two-digit number from tens and ones (3 tens and 7 ones = 37); Decompose a two-digit number into tens and ones (52 = 5 tens and 2 ones) | `base-ten-blocks`, `place-value-chart` |
| Compare two-digit numbers | Compare two two-digit numbers using >, =, < based on tens and ones; Order three or more two-digit numbers from least to greatest; Justify comparison by explaining which place-value position determined the result | `place-value-chart`, `number-line`, `balance-scale` |
| Add within 100 | Add a two-digit number and a one-digit number without regrouping (43 + 5); Add a two-digit number and a one-digit number with regrouping (47 + 6); Add a two-digit number and a multiple of 10 (34 + 20); Add two two-digit numbers without regrouping (32 + 15) | `base-ten-blocks`, `place-value-chart`, `number-line` |
| Ten more / ten less | Mentally find 10 more than a two-digit number; Mentally find 10 less than a two-digit number; Explain why the tens digit changes by 1 and the ones digit stays the same | `hundreds-chart`, `base-ten-blocks`, `place-value-chart` |
| Subtract multiples of 10 | Subtract a multiple of 10 from a multiple of 10 in the range 10–90 (e.g., 70 − 30); Model subtraction of multiples of 10 on a number line; Relate subtracting multiples of 10 to a place-value strategy (7 tens − 3 tens = 4 tens) | `base-ten-blocks`, `number-line`, `place-value-chart` |

**MEAS001 — Measurement and Data** (~22 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Ordering by length | Compare two objects by length, identifying which is longer/shorter; Order three objects from shortest to longest; Compare the length of two objects indirectly using a third object (if A > B and B > C, then A > C) | `measurement-tools` |
| Non-standard measurement | Measure the length of an object using same-size non-standard units (paper clips, cubes) laid end to end; Express the length as a whole number of units; Understand that the measurement unit must be consistent (same size, no gaps, no overlaps) | `measurement-tools` |
| Telling time — hour | Read and tell time to the hour on an analog clock; Read and tell time to the hour on a digital clock; Write the time to the hour using both formats (3:00, 3 o'clock); Match analog clock showing an hour to the correct digital display | `clock-face`, `matching-activity` |
| Telling time — half hour | Read and tell time to the half hour on an analog clock; Read and tell time to the half hour on a digital clock; Write the time to the half hour (7:30); Distinguish between the hour hand and minute hand positions at half past | `clock-face`, `matching-activity` |
| Organizing data | Sort objects or data into up to three categories; Count the number of objects in each category (up to 20) | `categorization-activity`, `bar-graph-builder` |
| Interpreting data | Answer "how many" questions about a data display; Answer "how many more" and "how many fewer" comparison questions about a data display; Interpret a simple bar graph or picture graph with up to three categories | `bar-graph-builder`, `multiple-choice` |
| Coin identification | Identify pennies, nickels, dimes, and quarters by appearance; State the value of each coin (penny = 1¢, nickel = 5¢, dime = 10¢, quarter = 25¢); Count a collection of same-denomination coins to find the total value | `coin-counter`, `matching-activity` |

**GEOM001 — Geometry** (~18 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Defining attributes of 2D shapes | Identify whether a shape is open or closed; Identify the number of sides and vertices of common 2D shapes (triangle, rectangle, square, trapezoid, hexagon, circle); Distinguish defining attributes (number of sides, number of angles) from non-defining attributes (color, size, orientation) | `shape-sorter`, `categorization-activity` |
| Defining attributes of 3D shapes | Identify common 3D shapes (cube, rectangular prism, cone, cylinder, sphere); Describe 3D shapes by their faces, edges, and vertices; Match 3D shapes to real-world objects (ball → sphere, can → cylinder) | `shape-sorter`, `matching-activity` |
| Composing 2D shapes | Combine two or more 2D shapes to make a larger shape (two triangles → rectangle); Identify which smaller shapes compose a given composite shape; Create a target shape by selecting and positioning pattern blocks | `shape-builder`, `pattern-blocks` |
| Composing 3D shapes | Combine 3D shapes to build a structure (stack cubes, combine cone and cylinder); Identify which 3D shapes were used to compose a real-world object | `shape-builder` |
| Partitioning into halves | Partition a circle into two equal shares (halves); Partition a rectangle into two equal shares (halves); Describe each share as a "half of" the whole; Understand that two halves make a whole | `fraction-bar`, `shape-builder` |
| Partitioning into fourths | Partition a circle into four equal shares (fourths/quarters); Partition a rectangle into four equal shares (fourths/quarters); Describe each share as a "fourth of" or "quarter of" the whole; Compare the size of a half and a fourth of the same shape | `fraction-bar`, `shape-builder` |

**PTRN001 — Patterns** (~12 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Repeating patterns — identify and extend | Identify the core unit of a repeating pattern (AB, ABB, ABC, AABB); Extend a repeating pattern by at least three elements; Determine what comes next in a repeating pattern with one missing element | `pattern-builder` |
| Repeating patterns — create and translate | Create a repeating pattern using shapes, colors, or numbers given a core unit; Translate a pattern from one medium to another (shape pattern → color pattern → number pattern) | `pattern-builder` |
| Growing patterns | Identify a growing pattern (1, 2, 4, 7, … or staircase shape sequences); Extend a growing pattern by determining the next two terms; Describe the rule of a simple growing pattern in words ("add one more each time") | `pattern-builder`, `number-line` |
| Number patterns on the hundreds chart | Identify skip-counting patterns on a hundreds chart (count by 2s, 5s, 10s); Shade or circle numbers that follow a given counting rule; Describe what column or row patterns emerge when counting by 2, 5, or 10 | `hundreds-chart` |
| Patterns in addition and subtraction | Identify the pattern when adding 1 to consecutive numbers (result increases by 1); Discover the pattern of doubles (1+1, 2+2, 3+3, …) and doubles-plus-one; Recognize that adding 0 to any number gives that number (identity property) | `math-fact-fluency`, `number-line` |

#### Math Intra-Subject Prerequisite Chains

```
PTRN001 (Patterns) → OPS001 (Operations)
   Pattern recognition supports understanding addition strategies (doubles, making ten),
   skip counting feeds into addition fluency.

OPS001 (Operations) → NBT001 (Base Ten)
   Addition/subtraction within 20 is prerequisite to extending strategies to addition within 100.
   Understanding number bonds and decomposition underpins place-value addition.

NBT001 (Base Ten) → MEAS001 (Measurement and Data)
   Place value understanding (tens, ones) supports measurement with units and counting coins.
   Addition within 100 needed for data comparison questions ("how many more").

GEOM001 (Geometry) → MEAS001 (Measurement and Data)
   Shape attributes (sides, edges) support spatial reasoning for measurement.
   Partitioning shapes into halves/fourths connects to equal-share measurement concepts.

OPS001 (Operations) → MEAS001 (Measurement and Data)
   Addition/subtraction supports interpreting data displays (how many more/fewer).
   Word problem comprehension transfers to measurement word problems.

PTRN001 (Patterns) → GEOM001 (Geometry)
   Pattern recognition (repeating units, symmetry) supports composing shapes
   and recognizing geometric attributes.

OPS001 (Operations) → GEOM001 (Geometry)
   Counting sides/vertices and comparing shares (half vs. fourth) require
   addition and comparison skills from OPS001.
```

#### Math Estimated Scope

| Unit | Skill Areas | Est. Subskills | Difficulty Range |
|------|------------|----------------|------------------|
| OPS001 | 11 | 32 | 1.0–3.5 |
| NBT001 | 7 | 24 | 1.5–3.5 |
| MEAS001 | 7 | 22 | 1.0–3.0 |
| GEOM001 | 6 | 18 | 1.0–2.5 |
| PTRN001 | 5 | 12 | 1.0–2.5 |
| **Total** | **36** | **108** | 1.0–3.5 |

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

**Key primitives:** `sound-wave-explorer`, `light-shadow-lab`, `organism-card`, `trait-matcher`, `classification-sorter`, `habitat-diorama`, `life-cycle-sequencer`, `day-night-seasons`, `moon-phases-lab`, `star-pattern-viewer`, `bridge-builder`, `tower-stacker`, `design-challenge`, `matching-activity`, `categorization-activity`, `sequencing-activity`, `multiple-choice`

#### Unit-by-Unit Primitive Mapping

**SCI001 — Physical Sciences: Sound and Light** (~28 subskills)

| Skill Area | Subskills | Target Primitive | NGSS |
|-----------|-----------|-----------------|------|
| Vibrations and sound | Observe that plucking, striking, or blowing objects makes them vibrate; Identify that vibrating objects produce sound; Predict whether an action will produce a loud or quiet sound based on the strength of the vibration; Observe that sound stops when vibrations stop | `sound-wave-explorer`, `multiple-choice` | 1-PS4-1 |
| Properties of sound | Compare sounds by pitch (high vs. low) and relate pitch to vibration speed; Compare sounds by volume (loud vs. soft) and relate volume to vibration strength; Sort everyday sounds into categories (high/low pitch, loud/soft volume); Identify which material produces the highest/lowest pitch when struck | `sound-wave-explorer`, `categorization-activity` | 1-PS4-1 |
| Sound travels | Demonstrate that sound can travel through solids, liquids, and air; Predict whether sound will be louder or softer when traveling through different materials; Observe that sound gets quieter as you move farther from the source | `sound-wave-explorer`, `multiple-choice` | 1-PS4-1 |
| Light and illumination | Observe that objects in a dark room can only be seen when a light source is present; Identify common light sources (sun, lamp, flashlight, fire); Sort objects into those that produce their own light vs. those that reflect light; Predict whether an object will be visible in a dark room with or without a light source | `light-shadow-lab`, `categorization-activity` | 1-PS4-2 |
| Light and materials | Observe that some materials let light pass through (transparent), some let some light through (translucent), and some block light (opaque); Sort materials into transparent, translucent, and opaque categories; Predict the shadow effect of placing different materials in a light beam | `light-shadow-lab`, `categorization-activity` | 1-PS4-3 |
| Shadows | Observe that opaque objects block light and create shadows; Predict the shape of a shadow based on the shape of the object; Observe that shadow size changes when the object or light source moves closer or farther away; Predict how moving a light source changes the shadow direction | `light-shadow-lab` | 1-PS4-3 |
| Communication with light and sound | Identify ways people use light to communicate (traffic lights, flashlight signals, lighthouse); Identify ways people use sound to communicate (sirens, bells, voice, music); Design a simple method to send a signal using light or sound over a distance; Compare the effectiveness of two different light or sound communication devices | `design-challenge`, `matching-activity` | 1-PS4-4 |

**SCI002 — Life Sciences: Structure, Function, and Heredity** (~30 subskills)

| Skill Area | Subskills | Target Primitive | NGSS |
|-----------|-----------|-----------------|------|
| External parts of animals | Identify external structures of common animals (legs, wings, eyes, ears, claws, shell, fins); Match an animal's external structure to the function it serves (wings → flying, fins → swimming); Compare external structures across different animals that serve the same function (bird wing vs. bat wing) | `organism-card`, `matching-activity` | 1-LS1-1 |
| External parts of plants | Identify external structures of plants (roots, stem, leaves, flowers, thorns, bark); Match a plant structure to its function (roots → absorb water, leaves → make food, thorns → protection); Compare structures across different plants that serve the same function (cactus spines vs. rose thorns) | `organism-card`, `matching-activity` | 1-LS1-1 |
| How structures help survival | Explain how an animal uses its external parts to survive in its environment (thick fur for cold, webbed feet for swimming); Explain how a plant uses its structures to survive (deep roots in dry soil, broad leaves in shade); Match animals to the habitat where their structures give them an advantage | `organism-card`, `habitat-diorama`, `matching-activity` | 1-LS1-1 |
| Biomimicry — design from nature | Identify a human problem that could be solved by mimicking an animal or plant structure; Match human inventions to the natural structures that inspired them (Velcro → burrs, airplane wings → bird wings); Design a simple tool or object that mimics a plant or animal structure to solve a problem | `design-challenge`, `matching-activity` | 1-LS1-1 |
| Animal behaviors for survival | Identify behaviors parents use to help offspring survive (feeding, protecting, teaching to hunt); Sort animal behaviors into categories (finding food, protecting from predators, caring for young, building shelter); Describe how a specific animal parent cares for its young using evidence from text or media | `categorization-activity`, `organism-card`, `multiple-choice` | 1-LS1-2 |
| Parent and offspring similarities | Observe that young animals resemble their parents but are not identical; Identify traits that offspring inherit from parents (body shape, color patterns, number of legs); Compare a young animal to its parent and list similarities and differences | `trait-matcher`, `organism-card` | 1-LS3-1 |
| Plant parent and offspring | Observe that young plants resemble the parent plant; Identify inherited traits in plants (leaf shape, flower color, seed type); Compare seedlings to their parent plant and identify similarities | `trait-matcher`, `organism-card` | 1-LS3-1 |
| Variation among offspring | Observe that offspring of the same parents can look different from each other (kittens in a litter, seeds from one plant); Identify which traits vary among siblings (color, size, pattern) and which are consistent (number of legs, basic body plan); Sort a group of offspring by a trait that varies | `trait-matcher`, `categorization-activity` | 1-LS3-1 |
| Animal and plant needs | Identify what animals need to survive (food, water, air, shelter); Identify what plants need to survive (water, light, air, nutrients from soil); Predict what happens when a need is not met (plant without light wilts, animal without water gets sick); Match organisms to the resources available in their habitat | `habitat-diorama`, `matching-activity`, `multiple-choice` | 1-LS1-1 |
| Classification of living things | Sort organisms into groups (mammals, birds, fish, reptiles, insects, plants); Identify the key feature that defines each group (mammals have fur and feed milk, birds have feathers); Classify an unfamiliar organism into a group based on its observable features | `classification-sorter`, `categorization-activity` | 1-LS1-1 |

**SCI003 — Earth and Space Sciences: Patterns in the Sky** (~20 subskills)

| Skill Area | Subskills | Target Primitive | NGSS |
|-----------|-----------|-----------------|------|
| Sun patterns | Observe that the sun appears to move across the sky during the day (rises in east, sets in west); Describe the pattern of the sun's apparent motion as predictable and repeating; Predict where the sun will be at different times of day (morning = low in east, noon = high, evening = low in west); Relate the sun's position to shadow direction and length at different times | `day-night-seasons`, `light-shadow-lab` | 1-ESS1-1 |
| Day and night | Explain that daytime happens when our part of Earth faces the sun and nighttime when it faces away; Identify what is visible in the sky during the day (sun, sometimes moon, clouds) vs. night (moon, stars, planets); Sequence the cycle of day → night → day as a repeating pattern | `day-night-seasons`, `sequencing-activity` | 1-ESS1-1 |
| Moon patterns | Observe that the moon appears to change shape over time (phases); Identify and name basic moon phases (new moon, crescent, quarter, full moon); Sequence the moon phases in correct order as a repeating cycle; Predict what the moon will look like in a few days given its current phase | `moon-phases-lab`, `sequencing-activity` | 1-ESS1-1 |
| Star patterns | Observe that stars are visible at night but not during the day; Identify that stars appear to move across the night sky in a predictable pattern; Recognize that some groups of stars (constellations) form patterns that can be identified; Observe that the same constellations appear in the same season each year | `star-pattern-viewer`, `matching-activity` | 1-ESS1-1 |
| Daylight across seasons | Observe that the number of daylight hours changes across seasons; Identify that summer has the most daylight hours and winter has the fewest; Compare daylight hours across seasons using a simple data display; Predict whether there will be more or less daylight as seasons change from fall to winter or winter to spring | `day-night-seasons`, `bar-graph-builder`, `multiple-choice` | 1-ESS1-2 |

**SCI004 — Engineering and Technology: Design Process** (~16 subskills)

| Skill Area | Subskills | Target Primitive | NGSS |
|-----------|-----------|-----------------|------|
| Asking questions and defining problems | Identify a situation that people want to change or improve; Ask questions about what, why, and how to gather information about the problem; Define a simple problem in terms of what needs to happen for it to be solved; Describe the criteria for a successful solution (what it needs to do) and constraints (limits on materials, size, time) | `design-challenge`, AI tutor session | K-2-ETS1-1 |
| Designing solutions | Generate multiple possible solutions to a defined problem; Create a simple sketch or drawing to show how a design would work; Describe the materials needed and the steps to build the design; Explain how the shape and structure of the design helps it solve the problem | `design-challenge`, `bridge-builder`, `tower-stacker` | K-2-ETS1-2 |
| Building and testing | Build a model or prototype using available materials following the design plan; Test the design to see if it solves the problem as intended; Record observations about how the design performed during testing; Identify what worked and what did not work in the design | `bridge-builder`, `tower-stacker`, `design-challenge` | K-2-ETS1-2 |
| Comparing and improving | Compare two different designs that attempt to solve the same problem; Identify the strengths and weaknesses of each design based on test data; Use test results to suggest improvements to a design; Explain why one design performed better than another using evidence from testing | `bridge-builder`, `tower-stacker`, `multiple-choice` | K-2-ETS1-3 |

#### Science Intra-Subject Prerequisite Chains

```
SCI001 (Physical Sciences) → SCI004 (Engineering and Technology)
   Understanding sound and light properties is prerequisite to designing
   communication devices that use light or sound (1-PS4-4 bridges both units).

SCI002 (Life Sciences) → SCI004 (Engineering and Technology)
   Understanding animal/plant structures and their functions is prerequisite
   to the biomimicry design challenge (1-LS1-1 connects to K-2-ETS1).

SCI001 Light and Shadows → SCI003 Sun Patterns
   Understanding how light creates shadows supports observing the sun's
   apparent motion via shadow direction and length changes.

SCI003 Day and Night → SCI003 Daylight Across Seasons
   Understanding the day/night cycle is prerequisite to understanding
   how daylight duration changes across seasons.

SCI003 Moon Patterns → SCI003 Star Patterns
   Observing predictable moon cycles builds the skill of recognizing
   repeating celestial patterns, which transfers to star/constellation patterns.
```

#### Science Cross-Subject Connections

```
MATH: MEAS001 (Measurement and Data) ↔ SCI003 (Daylight Across Seasons)
   Reading bar graphs of daylight hours requires data interpretation skills from MEAS001.

MATH: PTRN001 (Patterns) ↔ SCI003 (Earth and Space)
   Identifying repeating and growing patterns transfers directly to
   recognizing celestial cycles (sun, moon phases, seasons).

MATH: GEOM001 (Geometry) ↔ SCI001 (Light and Shadows)
   Predicting shadow shapes from object shapes uses geometry knowledge.

LA: LA003 (Reading Comprehension) ↔ SCI002 (Life Sciences)
   Reading texts to determine parent/offspring behavior patterns (1-LS1-2)
   requires comprehension skills from LA003.
```

#### Science Estimated Scope

| Unit | Skill Areas | Est. Subskills | Difficulty Range |
|------|------------|----------------|------------------|
| SCI001 | 7 | 28 | 1.0–3.0 |
| SCI002 | 10 | 30 | 1.0–3.0 |
| SCI003 | 5 | 20 | 1.0–2.5 |
| SCI004 | 4 | 16 | 1.5–3.5 |
| **Total** | **26** | **94** | 1.0–3.5 |

#### Science Renderability Notes

**High confidence:** SCI002 (Life Sciences) and SCI003 (Earth and Space) map cleanly to visual/interactive primitives — organism cards, trait comparison, classification sorting, moon phase sequencing, and day/night simulation are all strong Lumina fits.

**Moderate confidence:** SCI001 (Physical Sciences) requires two simulation primitives that may not exist yet:
- `sound-wave-explorer` — interactive visualization of vibrations, pitch (wave frequency), and volume (wave amplitude). Student manipulates objects and observes wave behavior.
- `light-shadow-lab` — position a light source and objects to observe illumination, transparency, and shadow effects. Student drags objects and light source, shadow renders in real time.

**Design-dependent:** SCI004 (Engineering) relies on `bridge-builder` and `tower-stacker` (already listed as key primitives) plus a general `design-challenge` primitive for the sketch/build/test cycle. The "asking questions" and "defining problems" skill areas lean on AI tutor sessions — this is intentional, not a renderability gap, as the cognitive task is inherently conversational.

**New primitives flagged:** `sound-wave-explorer`, `light-shadow-lab`, `trait-matcher`, `star-pattern-viewer`, `design-challenge`

### Social Studies

Aligned to C3 Framework (D1–D4) and common state standards for Grade 1 civics, economics, geography, and history.

| Unit ID | Unit Name              | Description                                                                               |
|---------|------------------------|-------------------------------------------------------------------------------------------|
| SS001   | Civics and Government   | Rules and laws, authority figures, symbols and traditions of the United States              |
| SS002   | Economics               | Wants vs. needs, making choices, jobs in the community, trading and bartering               |
| SS003   | Geography               | Maps and directions, physical and human features of the local environment, weather patterns  |
| SS004   | History                 | Understanding past and present, historical figures, personal and family timelines            |
| SS005   | Culture and Diversity   | Families and traditions, similarities and differences among people, celebrations and customs  |

**Key primitives:** `timeline-explorer`, `categorization-activity`, `matching-activity`, `multiple-choice`, `fact-file`, `map-explorer`, `decision-tree`, `sequencing-activity`, `scenario-card`, AI tutor sessions

#### Unit-by-Unit Primitive Mapping

**SS001 — Civics and Government** (~20 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Rules and laws | Explain why communities need rules (safety, fairness, order); Distinguish between rules (classroom, home) and laws (community, country); Sort examples into rules vs. laws; Identify the consequence of breaking a rule or law in a given scenario | `categorization-activity`, `scenario-card`, `multiple-choice` |
| Authority figures | Identify authority figures in the home, school, and community (parent, teacher, principal, police officer, mayor); Match authority figures to their roles and responsibilities; Explain why communities have leaders and what leaders do; Compare the responsibilities of two different authority figures | `matching-activity`, `fact-file`, `multiple-choice` |
| Rights and responsibilities | Identify basic rights of citizens (vote, speak freely, go to school); Identify responsibilities that come with being a community member (follow rules, be respectful, take turns); Match a right to its corresponding responsibility; Determine whether a scenario shows a right or a responsibility | `matching-activity`, `categorization-activity`, `scenario-card` |
| American symbols | Identify the American flag, Statue of Liberty, bald eagle, and Liberty Bell; Match each symbol to what it represents (flag → nation/unity, eagle → freedom); Identify the Pledge of Allegiance and its purpose; Recognize the national anthem and when it is typically played | `matching-activity`, `fact-file`, `multiple-choice` |
| American traditions and holidays | Identify national holidays (Independence Day, Thanksgiving, Presidents' Day, Martin Luther King Jr. Day); Explain why each holiday is celebrated and what it honors; Sequence holidays across the calendar year; Match a holiday to the historical event or person it commemorates | `timeline-explorer`, `matching-activity`, `sequencing-activity` |

**SS002 — Economics** (~18 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Wants vs. needs | Define needs as things required for survival (food, water, shelter, clothing); Define wants as things that are nice to have but not necessary; Sort items into wants vs. needs; Explain why the same item can be a need in one situation and a want in another (water to drink = need, water park = want) | `categorization-activity`, `scenario-card` |
| Making choices — scarcity | Explain that people cannot have everything they want (scarcity); Identify what is given up when a choice is made (opportunity cost in age-appropriate terms); Choose between two options and explain the trade-off; Determine the best choice in a scenario given limited resources | `decision-tree`, `scenario-card`, `multiple-choice` |
| Goods and services | Define goods as physical things people buy (food, toys, books); Define services as work people do for others (haircut, doctor visit, teaching); Sort examples into goods vs. services; Identify whether a scenario describes buying a good or paying for a service | `categorization-activity`, `matching-activity` |
| Jobs in the community | Identify common jobs in the community (teacher, firefighter, doctor, farmer, mail carrier, chef); Match each job to the goods or services it provides; Explain how different jobs help meet people's needs; Compare two jobs by what they produce and the tools they use | `matching-activity`, `fact-file`, `multiple-choice` |
| Trading and bartering | Explain that people trade goods and services to get things they need; Describe what bartering means (exchanging without money); Determine a fair trade in a scenario (I'll give you my apple if you give me your sandwich); Explain why money was invented as a replacement for bartering (not everyone wants what you have) | `scenario-card`, `multiple-choice`, AI tutor session |
| Producers and consumers | Define a producer as someone who makes goods or provides services; Define a consumer as someone who buys or uses goods and services; Identify whether a person in a scenario is acting as a producer or consumer; Explain that the same person can be both a producer and a consumer in different situations | `categorization-activity`, `scenario-card` |

**SS003 — Geography** (~22 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Maps and globes | Identify what a map is and what it represents (a flat picture of a place from above); Identify what a globe is and how it differs from a map (3D model of Earth); Locate land and water on a map or globe; Identify the compass rose and use cardinal directions (north, south, east, west) | `map-explorer`, `matching-activity`, `multiple-choice` |
| Types of maps | Identify a neighborhood or community map and find key locations (school, park, store); Read a simple map key/legend to identify symbols; Trace a route on a map from one location to another; Compare a map to an aerial photo of the same area | `map-explorer`, `matching-activity` |
| Physical features | Identify common landforms (mountain, hill, valley, river, lake, ocean, island, plain); Match landforms to their descriptions or images; Identify physical features in the local environment; Explain how physical features affect where people live (live near rivers for water, flat land for farming) | `matching-activity`, `fact-file`, `map-explorer` |
| Human features | Identify human-made features of the environment (buildings, roads, bridges, farms, parks); Distinguish between physical (natural) and human-made features; Sort features into natural vs. human-made categories; Explain why people build or change features in their environment (roads for transportation, dams for water) | `categorization-activity`, `matching-activity` |
| Weather and climate | Identify types of weather (sunny, rainy, cloudy, snowy, windy, stormy); Record and describe daily weather observations; Identify patterns in weather across seasons (cold and snowy in winter, hot and sunny in summer); Match appropriate clothing and activities to weather conditions | `categorization-activity`, `matching-activity`, `sequencing-activity` |
| Location and spatial thinking | Describe the location of objects using positional words (above, below, next to, between, near, far); Give simple directions from one place to another using cardinal directions; Identify relative locations on a simple grid or coordinate map; Describe where you live in relation to landmarks (my house is near the park, south of the school) | `map-explorer`, `multiple-choice`, AI tutor session |

**SS004 — History** (~20 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Past, present, and future | Distinguish between past, present, and future; Sort events or objects into past vs. present (horse and buggy vs. car, candle vs. light bulb); Use time-related vocabulary correctly (yesterday, today, tomorrow, long ago, now); Identify clues that tell whether a photograph shows the past or present | `categorization-activity`, `timeline-explorer`, `multiple-choice` |
| Personal timelines | Sequence events in your own life in chronological order (born, first steps, started school); Create a simple timeline with at least 4 personal events; Explain why the order of events matters (cause and effect — you learned to walk before you could run) | `timeline-explorer`, `sequencing-activity` |
| Family history | Describe how family life has changed over time (transportation, communication, daily routines); Compare how a family member's childhood was different from yours; Identify objects or photos from the past and explain how they differ from modern equivalents; Sequence family events across generations on a timeline | `timeline-explorer`, `matching-activity`, `multiple-choice` |
| Historical figures | Identify key historical figures and why they are remembered (George Washington, Abraham Lincoln, Martin Luther King Jr., Ruby Bridges, Sacagawea); Match each historical figure to their major contribution; Explain how a historical figure's actions made life better or different for others; Sequence the lives of 2-3 historical figures on a timeline | `fact-file`, `matching-activity`, `timeline-explorer` |
| Change over time | Compare how daily life has changed over time (school, transportation, communication, technology); Identify an invention and explain how it changed people's lives; Sort inventions or technologies into older vs. newer; Predict how something might change in the future based on patterns of change | `timeline-explorer`, `categorization-activity`, `sequencing-activity`, `multiple-choice` |

**SS005 — Culture and Diversity** (~16 subskills)

| Skill Area | Subskills | Target Primitive |
|-----------|-----------|-----------------|
| Families and family structures | Identify that families come in many different forms (single parent, two parents, grandparents, foster, blended); Describe roles within a family (who takes care of children, who works, who cooks); Compare your family structure or routine to another family's; Explain what makes a family (people who care for each other) | `matching-activity`, `multiple-choice`, AI tutor session |
| Traditions and customs | Define a tradition as something a family or community does regularly; Identify traditions in your own family (holiday meals, birthday celebrations, bedtime routines); Compare a tradition from your family with a tradition from another family or culture; Explain why traditions are important to families and communities (connection, identity, memory) | `matching-activity`, `fact-file`, AI tutor session |
| Similarities and differences among people | Identify ways people are similar (everyone needs food, shelter, love; everyone has feelings); Identify ways people are different (language, food, clothing, customs, appearance); Explain that differences among people make communities richer and more interesting; Describe a time when you learned something from someone who is different from you | `categorization-activity`, `multiple-choice`, AI tutor session |
| Celebrations around the world | Identify celebrations and holidays from different cultures (Chinese New Year, Diwali, Eid, Hanukkah, Kwanzaa, Christmas, Día de los Muertos); Match a celebration to the culture or region it comes from; Compare two celebrations from different cultures that serve a similar purpose (harvest festivals, new year celebrations); Describe how a celebration reflects the values of a culture | `matching-activity`, `fact-file`, `map-explorer` |

#### Social Studies Intra-Subject Prerequisite Chains

```
SS001 (Civics) → SS002 (Economics)
   Understanding rules, roles, and community structure provides the foundation
   for understanding economic roles (jobs, producers/consumers) within a community.

SS002 (Economics) → SS003 (Geography)
   Understanding needs, goods, and jobs motivates why people settle in certain
   locations (near water, farmland, trade routes) — geography as resource access.

SS003 (Geography) → SS004 (History)
   Understanding physical and human features of places provides context for
   understanding why historical events happened where they did.

SS001 (Civics — American Symbols/Holidays) → SS004 (History — Historical Figures)
   Knowledge of national holidays and what they commemorate provides the entry
   point for studying the historical figures those holidays honor.

SS004 (History) → SS005 (Culture and Diversity)
   Understanding change over time and how different people contributed to history
   provides context for appreciating cultural diversity today.

SS005 (Culture) → SS001 (Civics — Rights and Responsibilities)
   Understanding that people come from different backgrounds motivates why
   rights, fairness, and shared responsibilities matter in a diverse community.
```

#### Social Studies Cross-Subject Connections

```
LA: LA003 (Reading Comprehension) ↔ SS004 (History)
   Reading informational text about historical figures and events
   requires comprehension strategies from LA003.

LA: LA005 (Vocabulary) ↔ SS002 (Economics)
   Economics vocabulary (goods, services, scarcity, trade) builds on
   word-learning strategies from LA005.

MATH: MEAS001 (Measurement and Data) ↔ SS003 (Geography — Weather)
   Recording and interpreting weather data uses data organization
   and graphing skills from MEAS001.

MATH: PTRN001 (Patterns) ↔ SS003 (Geography — Weather)
   Identifying seasonal weather patterns connects to pattern
   recognition skills from PTRN001.

SCI: SCI003 (Earth and Space — Seasons) ↔ SS003 (Geography — Weather)
   Understanding seasonal daylight changes from SCI003 connects to
   weather and climate patterns in geography.
```

#### Social Studies Estimated Scope

| Unit | Skill Areas | Est. Subskills | Difficulty Range |
|------|------------|----------------|------------------|
| SS001 | 5 | 20 | 1.0–2.5 |
| SS002 | 6 | 18 | 1.0–3.0 |
| SS003 | 6 | 22 | 1.0–3.0 |
| SS004 | 5 | 20 | 1.0–2.5 |
| SS005 | 4 | 16 | 1.0–2.0 |
| **Total** | **26** | **96** | 1.0–3.0 |

#### Social Studies Renderability Notes

**High confidence:** The majority of Social Studies content maps to existing general-purpose primitives (`categorization-activity`, `matching-activity`, `sequencing-activity`, `timeline-explorer`, `fact-file`, `multiple-choice`). These are content-agnostic primitives that work well with factual/conceptual knowledge.

**Moderate confidence:** SS003 (Geography) benefits from a `map-explorer` primitive for spatial reasoning tasks (cardinal directions, locating features, tracing routes). This is a new primitive but conceptually straightforward — an interactive map with clickable regions, compass rose, and legend.

**AI tutor reliance:** SS005 (Culture and Diversity) has the highest AI tutor session ratio. Tasks like "describe a time you learned from someone different" and "explain why traditions matter" are inherently reflective and conversational — the AI tutor IS the right delivery channel, similar to LA007's oral language approach. This is by design, not a renderability gap.

**New primitives flagged:** `map-explorer`, `decision-tree`, `scenario-card`

### Arts

Not yet authored. Consider adding to match Kindergarten scope and provide cross-subject connections (e.g., music patterns linking to PTRN001, visual arts linking to GEOM001).

---

## Estimated Scope

| Subject        | Units | Skills (est.) | Subskills (est.) | Renderability |
|----------------|-------|----------------|-------------------|--------------|
| Mathematics    | 5     | 36             | 108               | Pass |
| Language Arts  | 7     | 25-30          | ~105 (down from 150) | **Reauthor required** |
| Science        | 4     | 26             | 94                | Pass (5 new primitives flagged) |
| Social Studies | 5     | 26             | 96                | Pass (3 new primitives flagged) |
| **Total**      | **21**| **~114**       | **~403**          | |

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
