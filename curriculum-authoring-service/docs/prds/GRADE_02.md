# Grade 2 Curriculum PRD

Parent: [K-12 Curriculum Expansion](K12_CURRICULUM_EXPANSION.md)
Status: Not Started

---

## Current State

No content has been authored for Grade 2. No CSV files, no subskills, no prerequisite graph.

## Subjects and Units

### Mathematics

Aligned to Common Core Standards: 2.OA, 2.NBT, 2.MD, 2.G

| Unit ID | Unit Name                            | Description                                                                                          |
|---------|--------------------------------------|------------------------------------------------------------------------------------------------------|
| OPS002  | Operations and Algebraic Thinking    | Addition and subtraction within 100 with fluency, intro to multiplication concept via equal groups, odd/even numbers, arrays |
| NBT002  | Number and Operations in Base Ten    | Place value understanding to 1000, read/write numbers to 1000, add/subtract within 1000 using strategies based on place value |
| MEAS002 | Measurement and Data                 | Measure lengths in standard units (inches, feet, centimeters, meters), tell time to nearest 5 minutes, solve problems involving money (dollars, cents), picture graphs and bar graphs |
| GEOM002 | Geometry                             | Recognize and draw shapes with specified attributes, partition rectangles into rows and columns of same-size squares, partition circles and rectangles into halves, thirds, and fourths |

### Language Arts / ELA

Aligned to Common Core Standards: RF.2, W.2, SL.2, L.2, RL.2, RI.2

| Unit ID | Unit Name                   | Description                                                                                    |
|---------|-----------------------------|------------------------------------------------------------------------------------------------|
| LA001   | Reading Foundations          | Phonics patterns including vowel teams and digraphs, decoding multi-syllable words, reading with fluency and expression |
| LA002   | Writing                      | Opinion writing with reasons, informative writing with facts and definitions, narrative writing with sequenced events and temporal words |
| LA003   | Speaking and Listening       | Recounting stories and key details, asking and answering questions about a speaker's message, producing complete sentences appropriate to task |
| LA004   | Grammar and Conventions      | Collective nouns, irregular plural nouns, reflexive pronouns, irregular past tense verbs, adjectives and adverbs, commas in greetings and closings, apostrophes for contractions and possessives |
| LA005   | Vocabulary                   | Using context clues to determine word meaning, compound words, prefixes and suffixes (un-, re-, -ful, -less), glossary and dictionary use |
| LA006   | Reading Literature           | Recount stories including fables and folktales, determine central message/lesson/moral, describe how characters respond to challenges, acknowledge differences in character points of view |
| LA007   | Reading Informational Text   | Identify main topic of multi-paragraph text, use text features (captions, glossaries, headings), describe connections between events/concepts, compare and contrast two texts on same topic |

### Science

Aligned to NGSS: 2-PS1, 2-LS2, 2-LS4, 2-ESS1, 2-ESS2, K-2-ETS1

| Unit ID | Unit Name                   | Description                                                                                    |
|---------|-----------------------------|------------------------------------------------------------------------------------------------|
| SCI001  | Properties of Matter         | Classify materials by observable properties, test whether heating or cooling causes changes, determine if changes are reversible or irreversible, describe materials suited for intended purposes |
| SCI002  | Life Sciences                | Plant and animal needs for survival, seed dispersal mechanisms, habitats and biodiversity, interdependence of organisms |
| SCI003  | Earth Sciences               | How wind and water shape land, mapping landforms and bodies of water, Earth events that happen quickly vs. slowly |
| SCI004  | Engineering and Technology    | Ask questions about problems, design and build solutions, compare multiple solutions to a problem |

### Social Studies

Aligned to C3 Framework

| Unit ID | Unit Name                  | Description                                                                                    |
|---------|----------------------------|------------------------------------------------------------------------------------------------|
| SS001   | Civics                      | Community roles and responsibilities, rights and responsibilities of citizens, government services that help communities |
| SS002   | Economics                   | Producers and consumers, goods and services, making economic choices, saving and spending        |
| SS003   | Geography                   | Reading and creating maps and globes, physical features (mountains, rivers, plains), human-environment interaction |
| SS004   | History                     | Constructing timelines, using primary sources (photographs, artifacts), community history and change over time |
| SS005   | Culture                     | Traditions and celebrations, cultural contributions to community, similarities and differences among cultural groups |

## Estimated Scope

| Subject        | Units | Skills (est.) | Subskills (est.) |
|----------------|-------|----------------|-------------------|
| Mathematics    | 4     | 20-28          | 140-175           |
| Language Arts  | 7     | 35-45          | 160-200           |
| Science        | 4     | 20-25          | 120-150           |
| Social Studies | 5     | 25-30          | 130-175           |
| **Total**      | **20**| **100-128**    | **550-700**       |

## ID Conventions

All Grade 2 unit IDs use the following prefixes:

- Mathematics: `OPS002`, `NBT002`, `MEAS002`, `GEOM002`
- Language Arts: `LA001` through `LA007`
- Science: `SCI001` through `SCI004`
- Social Studies: `SS001` through `SS005`

Subskill IDs follow the pattern: `G2-{UNIT_ID}-{SKILL_ID}-{SUBSKILL_NUM}` (e.g., `G2-OPS002-add-within-100-01`).

## Difficulty Calibration

| Parameter         | Value   |
|-------------------|---------|
| Starting range    | 1-3     |
| Ending range      | 3-7     |
| Target range      | 2-5     |

Grade 2 builds on concrete representations and increasingly expects students to work with symbolic notation and multi-step reasoning.

## Cross-Grade Prerequisites

### From Grade 1

- **OPS001** (addition/subtraction within 20) feeds into **OPS002** (addition/subtraction within 100) -- fluency within 20 is a prerequisite for extending to two-digit operations
- **NBT001** (place value for tens and ones) feeds into **NBT002** (place value to 1000) -- understanding of tens/ones is required before hundreds
- **LA001** (Grade 1 Reading Foundations: decoding, early fluency) feeds into **LA001** (Grade 2 Reading Foundations: phonics patterns, multi-syllable words, fluency)
- **LA006** (Grade 1 Reading Comprehension) feeds into **LA006** (Reading Literature) and **LA007** (Reading Informational Text) -- basic comprehension strategies extend to genre-specific analysis
- **MEAS001** (Grade 1 Measurement and Data) feeds into **MEAS002** -- non-standard measurement transitions to standard units
- **GEOM001** (Grade 1 Geometry) feeds into **GEOM002** -- shape recognition extends to attributes and partitioning

### To Grade 3

- **OPS002** (addition/subtraction within 100, intro to equal groups) feeds into **OPS003** (multiplication/division within 100) -- equal groups concept is the bridge to multiplication
- **NBT002** (place value to 1000, add/subtract within 1000) feeds into **NBT003** (rounding, fluent add/subtract within 1000, multiply by multiples of 10)
- **LA006** and **LA007** (reading comprehension across literature and informational text) feed into Grade 3 **LA001** and **LA002** -- the shift from "learning to read" to "reading to learn"
- **GEOM002** (partitioning into halves, thirds, fourths) feeds into **NF001** (unit fractions and fraction concepts)

## Graph Requirements

- **Minimum edge density target:** 2.5 edges per subskill
- **Cross-unit connectivity target:** Every unit must have at least one outgoing edge to another unit within the same grade
- **Key prerequisite chains within the grade:**
  - OPS002 (Operations) should feed into MEAS002 (measurement problems require addition/subtraction fluency)
  - NBT002 (Base Ten) should feed into OPS002 (place value strategies underpin multi-digit addition/subtraction)
  - LA001 (Reading Foundations) should feed into LA006 (Reading Literature) and LA007 (Reading Informational Text)
  - LA004 (Grammar and Conventions) should feed into LA002 (Writing)
  - LA005 (Vocabulary) should feed into LA006 and LA007 (vocabulary supports comprehension)

## Authoring Notes

1. **Lumina-first design (CRITICAL).** Every subskill must target a named Lumina primitive, problem type, or AI tutor session. See parent PRD §5 (Lumina-First Design Principle). Apply the renderability test before authoring any subskill. Grade 1 LA is the cautionary example: 150 subskills were authored standards-first and many describe classroom activities (peer conversations, dramatic play, physical book navigation) that cannot be rendered in Lumina. Grade 2 must avoid this pattern.

   **Key LA primitive targets for Grade 2:**
   - LA001 (Reading Foundations): `phonics-blender`, `decodable-reader`, `spelling-pattern-explorer`, `read-aloud-studio`
   - LA002 (Writing): `sentence-builder`, `paragraph-architect`, `opinion-builder`, `revision-workshop`
   - LA003 (Speaking and Listening): **Restructure as "Listening Comprehension and Oral Language"** — use `listen-and-respond` and AI tutor sessions (Gemini Live). Remove peer-dependent subskills.
   - LA004 (Grammar): `sentence-builder`, `sentence-analyzer`, `categorization-activity`, `fill-in-blanks`
   - LA005 (Vocabulary): `context-clues-detective`, `word-builder`, `vocabulary-explorer`, `matching-activity`
   - LA006/LA007 (Reading Comprehension): `story-map`, `character-web`, `evidence-finder`, `text-structure-analyzer`, `sequencing-activity`

2. **Bridge to multiplication:** Grade 2 introduces the concept of equal groups through OPS002, which is the critical conceptual bridge to Grade 3 multiplication. Ensure subskills cover arrays, repeated addition, and grouping -- not just as isolated topics but as a coherent pathway toward multiplicative thinking.

2. **Place value expansion:** The jump from two-digit to three-digit numbers is significant. NBT002 should include extensive scaffolding with base-ten blocks, expanded form, and comparison of three-digit numbers before moving to addition/subtraction within 1000.

3. **Measurement with standard units:** This is the first grade where students use rulers, inch measurements, and centimeters. Subskills should address the mechanics of measuring (starting at 0, aligning endpoints) as well as estimation and comparison.

4. **Reading independence:** Grade 2 is where fluent reading is expected by year's end. LA001 should progress from guided decoding to independent reading with self-correction strategies.

5. **Money and time:** MEAS002 includes both money and time, which are high-value life skills. Ensure coverage of both coin identification/counting and clock reading to 5-minute intervals.

6. **Standards alignment:** All mathematics units map to Common Core Grade 2 domains. Science aligns to NGSS Grade 2 Performance Expectations plus K-2 Engineering. Social Studies follows C3 Framework inquiry patterns.

## Quality Gates

From parent PRD:

- [ ] All subskills have unique, descriptive IDs following the naming convention
- [ ] **Every subskill targets a named primitive, problem type, or AI tutor session (Lumina renderability gate)**
- [ ] Every subskill has at least one prerequisite edge (except entry-level skills)
- [ ] No orphan nodes in the prerequisite graph
- [ ] Difficulty values assigned and calibrated within the grade-appropriate range
- [ ] Common Core / NGSS alignment codes attached to every applicable subskill

Grade-specific additions:

- [ ] CSV files authored for all 4 subjects in `backend/data/second-grade/`
- [ ] Prerequisite graph edges built connecting all subskills
- [ ] Cross-grade edges defined from Grade 1 terminal skills (OPS001, NBT001, LA001, LA006, MEAS001, GEOM001)
- [ ] Cross-grade edges defined to Grade 3 entry skills (OPS003, NBT003, NF001, LA001, LA002)
- [ ] Equal groups / arrays pathway verified as coherent bridge to multiplication
- [ ] Partitioning subskills in GEOM002 verified as coherent bridge to Grade 3 fractions (NF001)
