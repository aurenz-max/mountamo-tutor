# Grade 1 Curriculum PRD

Parent: [K-12 Curriculum Expansion](K12_CURRICULUM_EXPANSION.md)
Status: In Progress (CSVs authored, graph not built)

---

## Current State

Grade 1 has 496 subskills authored across 4 subjects:

| Subject        | Subskills |
|----------------|-----------|
| Language Arts  | 150       |
| Mathematics    | 115       |
| Science        | 119       |
| Social Studies | 112       |

CSV files exist in `backend/data/first-grade/`. No Arts subject has been authored. No prerequisite graph edges have been defined.

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

### Language Arts / ELA

Aligned to Common Core Standards: RF.1, W.1, SL.1, L.1, RL.1, RI.1

| Unit ID | Unit Name              | Description                                                                                    |
|---------|------------------------|------------------------------------------------------------------------------------------------|
| LA001   | Reading Foundations     | Phonics and word recognition, print concepts, decoding one-syllable words, long/short vowels   |
| LA002   | Writing                | Opinion, informative, and narrative writing with basic structure and supporting details          |
| LA003   | Speaking and Listening  | Participating in collaborative conversations, following agreed-upon rules for discussions, describing people/places/things with relevant details |
| LA004   | Grammar Basics          | Nouns, verbs, adjectives, singular/plural, basic sentence structure, capitalization, end punctuation |
| LA005   | Vocabulary Development  | Sorting words into categories, defining words by key attributes, real-life connections to word meaning |
| LA006   | Reading Comprehension   | Retelling key details, identifying central message, describing characters/settings/events, using text features |
| LA007   | Creative Expression     | Responding to literature through writing and art, shared research projects, creative writing with imagination |

### Science

Aligned to NGSS: 1-PS4, 1-LS1, 1-LS3, 1-ESS1, K-2-ETS1

| Unit ID | Unit Name                  | Description                                                                                  |
|---------|----------------------------|----------------------------------------------------------------------------------------------|
| SCI001  | Physical Sciences          | Sound and light, vibrations and sound waves, light and shadow, communication with light/sound |
| SCI002  | Life Sciences              | Animal and plant structures, how parents and offspring are alike and different, survival needs |
| SCI003  | Earth and Space Sciences   | Patterns of the sun, moon, and stars, daylight changes across seasons                         |
| SCI004  | Engineering and Technology  | Asking questions, designing solutions, testing and comparing designs for simple problems       |

### Social Studies

| Unit ID | Unit Name              | Description                                                                               |
|---------|------------------------|-------------------------------------------------------------------------------------------|
| SS001   | Civics and Government   | Rules and laws, authority figures, symbols and traditions of the United States              |
| SS002   | Economics               | Wants vs. needs, making choices, jobs in the community, trading and bartering               |
| SS003   | Geography               | Maps and directions, physical and human features of the local environment, weather patterns  |
| SS004   | History                 | Understanding past and present, historical figures, personal and family timelines            |
| SS005   | Culture and Diversity   | Families and traditions, similarities and differences among people, celebrations and customs  |

### Arts

Not yet authored. Consider adding to match Kindergarten scope and provide cross-subject connections (e.g., music patterns linking to PTRN001, visual arts linking to GEOM001).

## Estimated Scope

| Subject        | Units | Skills (est.) | Subskills (est.) |
|----------------|-------|----------------|-------------------|
| Mathematics    | 5     | 25-30          | 115               |
| Language Arts  | 7     | 35-40          | 150               |
| Science        | 4     | 20-25          | 119               |
| Social Studies | 5     | 25-30          | 112               |
| **Total**      | **21**| **105-125**    | **496**           |

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
- **K Phonemic Awareness** feeds into **LA001** (Reading Foundations) -- students must recognize letter-sound relationships before progressing to blending and decoding

### To Grade 2

- **OPS001** addition/subtraction within 20 feeds into **OPS002** (addition/subtraction within 100)
- **NBT001** place value for tens and ones feeds into **NBT002** (place value to 1000)
- **LA001** decoding and early fluency feeds into Grade 2 **LA001** (phonics patterns, multi-syllable words, fluency)
- **LA006** reading comprehension basics feed into Grade 2 **LA006** (Reading Literature) and **LA007** (Reading Informational Text)

## Graph Requirements

- **Minimum edge density target:** 2.5 edges per subskill (currently 0 -- graph not yet built)
- **Cross-unit connectivity target:** Every unit must have at least one outgoing edge to another unit within the same grade
- **Key prerequisite chains within the grade:**
  - PTRN001 (Patterns) should feed into OPS001 (supports understanding of addition properties)
  - NBT001 (Base Ten) should feed into MEAS001 (measurement relies on place value understanding)
  - LA001 (Reading Foundations) should feed into LA006 (Reading Comprehension) and LA007 (Creative Expression)
  - LA004 (Grammar Basics) should feed into LA002 (Writing)

## Authoring Notes

1. **Concrete-to-symbolic transition:** Grade 1 is the bridge year between purely manipulative/concrete learning (Kindergarten) and symbolic/abstract representation. All math primitives should support both concrete visuals (ten frames, base-ten blocks) and symbolic notation.

2. **Addition and subtraction centerpiece:** The math curriculum centers on addition and subtraction within 20. Ensure deep coverage of all problem types: add-to, take-from, put-together/take-apart, and compare. Word problems should reflect diverse real-world contexts.

3. **Reading transition:** Students move from decoding individual words to reading connected text. Reading Foundations (LA001) is the highest-priority unit and should have the most granular subskill breakdown.

4. **Arts gap:** The absence of an Arts subject is a known gap. When authored, consider 2-3 units covering visual arts, music, and dramatic play, targeting approximately 50-70 subskills.

5. **Standards alignment:** All mathematics units are mapped to Common Core Grade 1 domains. Science units align to NGSS Performance Expectations for Grade 1 and K-2 Engineering. Social Studies follows state standards patterns common across C3-aligned curricula.

## Quality Gates

From parent PRD:

- [ ] All subskills have unique, descriptive IDs following the naming convention
- [ ] Every subskill has at least one prerequisite edge (except entry-level skills)
- [ ] No orphan nodes in the prerequisite graph
- [ ] Difficulty values assigned and calibrated within the grade-appropriate range
- [ ] Common Core / NGSS alignment codes attached to every applicable subskill

Grade-specific additions:

- [ ] Arts subject authored and integrated into the graph
- [ ] Prerequisite graph edges built for all 496 existing subskills
- [ ] Cross-grade edges defined from Kindergarten terminal skills
- [ ] Cross-grade edges defined to Grade 2 entry skills
- [ ] Concrete/symbolic scaffolding verified for all math subskills
