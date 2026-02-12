# PRD: K-6 Language Arts Primitives Suite

## Executive Summary

Language arts is the single largest instructional block in elementary education (~2.5 hours/day K-3, ~1.5 hours/day 4-6) yet Lumina's current coverage is skeletal: a sentence analyzer, a word builder, an interactive passage, and a handful of early-literacy visuals. Meanwhile, the platform has mature multimodal infrastructure — Gemini TTS, microphone capture via Web Audio API, AI image generation, drag-and-drop interaction, and rich evaluation — that is almost entirely untapped for ELA.

This PRD proposes **18 new primitives** organized across the 6 Common Core ELA strands, designed to leverage full multimodality and deliver the same depth the platform already achieves in math and science.

---

## Current State Audit

### What Exists

| Primitive | Strand | Status | Gaps |
|-----------|--------|--------|------|
| `interactive-passage` | Reading | Implemented | No TTS read-aloud, no fluency tracking |
| `sentence-analyzer` | Language | Implemented | Display-only, no interactive practice |
| `word-builder` | Language/Vocabulary | Implemented | Morphology only, no context clues or figurative language |
| `letter-tracing` | Foundational Skills | Implemented | Letter formation only |
| `alphabet-sequence` | Foundational Skills | Implemented | Missing letter identification |
| `sight-word-card` | Foundational Skills | Implemented | Display only, no spaced repetition |
| `rhyming-pairs` | Foundational Skills | Implemented | Matching only, no production |
| `sound-sort` | Foundational Skills | Implemented | Sorting only, no blending/segmenting |

### Available Multimodal Infrastructure

| Capability | Service | Current LA Usage |
|-----------|---------|-----------------|
| **Text-to-Speech** | Gemini TTS -> base64 PCM -> Web Audio API | Used in `media-player` only |
| **Speech Capture** | `AudioCaptureService` -> 16kHz PCM -> WebSocket | Tutoring sessions only |
| **Image Generation** | Gemini image generation | `image-panel`, `media-player` only |
| **Drag-and-Drop** | React DnD patterns (used in engineering, word-builder) | `word-builder` only |
| **Rich Evaluation** | `usePrimitiveEvaluation` + metrics system | Not used in any LA primitive |
| **Flashcard/Recall** | `flashcard-deck` with spaced repetition UI | Not connected to vocabulary system |

### Reusable Assessment Primitives

These existing problem types work for LA without new code:

| Problem Type | LA Applications |
|---|---|
| `fill-in-blanks` | Cloze passages, grammar rules, spelling patterns |
| `matching-activity` | Vocabulary <-> definitions, synonyms <-> antonyms |
| `sequencing-activity` | Sentence ordering, story events, writing process steps |
| `categorization-activity` | Parts of speech, text features, literary elements |
| `short-answer` | Comprehension responses, written explanations |
| `scenario-question` | Inference, author's purpose, point of view |

---

## ELA Standards Framework (Common Core Alignment)

The 6 strands of K-6 ELA, with current coverage:

| Strand | Code | Current Coverage | This PRD |
|--------|------|-----------------|----------|
| Reading: Foundational Skills | RF | Partial (K-1 only) | 2 new primitives |
| Reading: Literature | RL | Partial (`interactive-passage`) | 4 new primitives |
| Reading: Informational Text | RI | Partial (`interactive-passage`) | 2 new primitives |
| Writing | W | None | 4 new primitives |
| Speaking & Listening | SL | None (infra exists) | 2 new primitives |
| Language | L | Partial (analyzer, builder) | 4 new primitives |

---

## Proposed Primitives (18)

---

## STRAND 1: Reading — Foundational Skills (RF)

### 1. `phonics-blender` — Sound-by-Sound Word Building

**What it does:** Students blend individual phonemes (sounds) into words. The primitive displays sound tiles (onset, rime, or individual phonemes) that students tap in sequence to hear each sound, then blend together. Supports CVC (cat), CVCE (cake), blends (stamp), digraphs (ship), diphthongs (coin), and r-controlled vowels (bird). Audio playback for each phoneme and the blended word via Gemini TTS.

**Multimodal features:**
- **Audio (TTS):** Each phoneme tile plays its sound on tap. Blended word plays after successful assembly. Slow-blend mode stretches the word ("/k/...../a/...../t/" -> "cat").
- **Visual:** AI-generated image of the target word appears on success as reward/confirmation.
- **Interactive:** Tap-to-hear individual sounds, drag to reorder for word-building challenges.

**Learning goals by grade:**
- K: CVC words (3 sounds), onset-rime blending, initial/final sound isolation
- Grade 1: CVCE, blends (bl, cr, st), digraphs (sh, ch, th, wh), short vs long vowels
- Grade 2: R-controlled vowels (ar, er, ir, or, ur), diphthongs (oi, ou, ow), multisyllabic blending

**Interaction model:** Phase 1 (Listen) — hear the word segmented into sounds. Phase 2 (Build) — arrange sound tiles in correct order. Phase 3 (Blend) — tap "Blend" to hear the word and see the image. For advanced: given an image, produce the sound sequence.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'phonics-blender'`
- `wordsBlended` / `wordsTotal`
- `phonemeAccuracy` (0-100, per-phoneme correctness)
- `blendingSpeed` (time from first tap to successful blend)
- `patternType` ('cvc' | 'cvce' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong')
- `soundsCorrectOnFirstTry` / `soundsTotal`
- `attemptsCount`

---

### 2. `decodable-reader` — Controlled-Vocabulary Reading with Audio Support

**What it does:** Short passages (3-8 sentences) written with controlled phonics patterns that match the student's current decoding level. Each word is tappable — tapping plays TTS pronunciation and optionally shows the word segmented into sounds. Tracks which words the student taps (struggled with) vs reads independently. Embedded comprehension question after reading.

**Multimodal features:**
- **Audio (TTS):** Every word is individually pronounceable on tap. Full-sentence read-aloud available. Adjustable speed (0.75x, 1.0x, 1.25x).
- **Visual:** AI-generated illustration for the passage context. Words color-coded by phonics pattern (e.g., CVC = blue, sight words = gold).
- **Speech (optional):** Student can read aloud into microphone for self-assessment playback (no AI grading — student compares their reading to TTS model).

**Learning goals by grade:**
- K: Passages using CVC words + 5-10 sight words, 2-3 sentences
- Grade 1: Passages with blends, digraphs, long vowels, 4-6 sentences
- Grade 2: Multisyllabic words, varied patterns, 6-8 sentences, fluency emphasis

**Interaction model:** Read the passage independently. Tap any word for audio support. After reading, answer one comprehension question. Teacher/system sees which words were tapped (proxy for decoding difficulty).

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'decodable-reader'`
- `wordsTapped` / `wordsTotal` (lower = more independent reading)
- `comprehensionCorrect` (boolean)
- `phonicsPatternsInPassage` (array of patterns represented)
- `sightWordsIdentified` (count of sight words read without tapping)
- `readingTimeSeconds`
- `attemptsOnComprehension`

---

## STRAND 2: Reading — Literature (RL)

### 3. `story-map` — Interactive Plot Structure Diagram

**What it does:** A visual plot diagram (story mountain or arc) where students identify and place key story elements: characters, setting, problem/conflict, rising action events, climax, falling action, resolution. Students drag event cards onto the correct position on the arc, or fill in text fields for each element. Supports multiple story structures: linear (beginning-middle-end for K-1), story mountain (2-3), full plot diagram (4-6), and hero's journey (5-6 extension).

**Multimodal features:**
- **Visual:** Animated story arc/mountain SVG with labeled regions. AI-generated character portraits and setting illustrations appear as students fill in elements.
- **Interactive:** Drag event cards to arc positions, or type summaries in structured fields.

**Learning goals by grade:**
- K-1: Beginning, middle, end. Characters and setting.
- Grade 2: Problem and solution. Key events in order.
- Grade 3: Full story mountain (introduction, rising action, climax, falling action, resolution)
- Grade 4-5: Conflict types (person vs person, self, nature, society). Subplot identification.
- Grade 6: Hero's journey stages. Parallel plot lines. Narrative arc across chapters.

**Interaction model:** Phase 1 (Identify) — read/listen to a passage, then identify characters and setting. Phase 2 (Sequence) — place 4-6 events on the arc in order. Phase 3 (Analyze) — identify the conflict type and explain the resolution.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'story-map'`
- `elementsIdentified` / `elementsTotal`
- `eventOrderCorrect` (boolean)
- `conflictTypeCorrect` (boolean, grades 4+)
- `structureType` ('bme' | 'story-mountain' | 'plot-diagram' | 'heros-journey')
- `evidenceProvided` (boolean — did they cite text evidence)
- `attemptsCount`

---

### 4. `character-web` — Character Analysis & Relationship Mapping

**What it does:** An interactive node-and-edge graph where students build character profiles (traits, motivations, changes) and map relationships between characters. Each character is a node with expandable trait cards; edges between characters are labeled with relationship types (friend, rival, family, mentor). Students add traits and must cite text evidence for each one. Tracks character change over time (beginning vs end of story).

**Multimodal features:**
- **Visual:** AI-generated character portrait for each node. Relationship lines color-coded by type. Animated node expansion.
- **Interactive:** Click to add characters, drag to connect, type traits with evidence citations.

**Learning goals by grade:**
- Grade 2: Identify main character. Name 2-3 traits with examples.
- Grade 3: Compare two characters. Identify how a character changes.
- Grade 4: Character motivations. Internal vs external traits. Relationships.
- Grade 5: Character development arc. Foil characters. Unreliable narrator.
- Grade 6: Complex motivation analysis. Character as symbol. Multi-text character comparison.

**Interaction model:** Phase 1 (Profile) — build a profile for one character (3 traits + evidence). Phase 2 (Connect) — add a second character and define their relationship. Phase 3 (Analyze) — describe how the character changed and why.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'character-web'`
- `charactersProfiled` / `charactersRequired`
- `traitsWithEvidence` / `traitsTotal` (did they cite text?)
- `relationshipsIdentified` / `relationshipsTotal`
- `characterChangeIdentified` (boolean)
- `analysisDepth` ('surface' | 'moderate' | 'deep') — based on evidence quality
- `attemptsCount`

---

### 5. `poetry-lab` — Explore and Compose Poetry

**What it does:** A dual-mode poetry primitive. **Analysis mode:** students examine a poem with interactive annotations for rhyme scheme (color-coded line endings), meter/rhythm (stressed/unstressed syllable markers), figurative language highlights (simile, metaphor, personification, alliteration, onomatopoeia), and structural elements (stanza, line break, enjambment). **Composition mode:** students write poetry within structured templates (haiku counter, limerick rhyme checker, acrostic grid, free verse with line-break guidance).

**Multimodal features:**
- **Audio (TTS):** Poem read aloud with expressive prosody. Students hear how rhythm and line breaks affect delivery. Slow-read mode emphasizes stressed syllables.
- **Visual:** Rhyme scheme color-coding. Figurative language type icons. Syllable count display for haiku/meter. AI-generated mood illustration based on poem theme.
- **Interactive:** Click words to hear pronunciation, highlight figurative language, toggle annotations, compose within templates.

**Learning goals by grade:**
- Grade 1-2: Rhyming words in poems. Repetition. Sensory words.
- Grade 3: Simile vs metaphor. Alliteration. Stanza structure. Haiku (5-7-5).
- Grade 4: Rhyme scheme notation (ABAB, AABB). Personification. Limerick structure.
- Grade 5: Meter basics (stressed/unstressed). Imagery and mood. Free verse. Hyperbole.
- Grade 6: Extended metaphor. Symbolism. Enjambment vs end-stop. Sonnet structure intro.

**Interaction model (Analysis):** Phase 1 — listen to the poem and identify the mood. Phase 2 — highlight instances of a specific figurative language type. Phase 3 — map the rhyme scheme.

**Interaction model (Composition):** Select template -> write within constraints -> hear TTS read-back of their poem -> revise.

**Evaluable:** Yes (analysis mode); partial (composition — can evaluate syllable counts, rhyme scheme compliance, but not creative quality).

**Evaluation metrics:**
- `type: 'poetry-lab'`
- `mode` ('analysis' | 'composition')
- `figurativeLanguageIdentified` / `figurativeLanguageTotal`
- `rhymeSchemeCorrect` (boolean)
- `syllableCountAccurate` (boolean, for haiku/meter)
- `elementsExplored` (count of annotation layers toggled)
- `poemCompleted` (boolean, composition mode)
- `templateType` ('haiku' | 'limerick' | 'acrostic' | 'free-verse' | 'sonnet-intro')

---

### 6. `genre-explorer` — Compare and Classify Text Types

**What it does:** Students examine short text excerpts and classify them by genre (fiction, nonfiction, poetry, drama, folktale, myth, fable, biography, informational, persuasive). Each genre has a feature checklist — students check which features are present in the excerpt, then use those features to determine the genre. Supports side-by-side comparison of two excerpts from different genres on the same topic (e.g., a nonfiction article about wolves vs a folktale about wolves).

**Multimodal features:**
- **Audio (TTS):** Each excerpt can be read aloud.
- **Visual:** Genre-specific visual styling (parchment for folktale, newspaper layout for informational, spotlight for drama). AI-generated illustration matching the excerpt.
- **Interactive:** Feature checklist (has characters? has a moral? has facts? has dialogue? has stanzas?), genre selection, side-by-side comparison drag.

**Learning goals by grade:**
- Grade 1-2: Fiction vs nonfiction. Stories vs poems.
- Grade 3: Folktales, fables, myths. Key features of each.
- Grade 4: Biography vs autobiography. Historical fiction vs nonfiction.
- Grade 5: Persuasive vs informational. Drama as a genre.
- Grade 6: Satire, allegory, memoir. Genre blending (historical fiction with real events).

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'genre-explorer'`
- `genresIdentifiedCorrectly` / `genresTotal`
- `featuresCheckedCorrectly` / `featuresTotal`
- `comparisonMade` (boolean — did they complete side-by-side analysis)
- `attemptsCount`

---

## STRAND 3: Reading — Informational Text (RI)

### 7. `text-structure-analyzer` — Identify Organizational Patterns

**What it does:** Students read an informational passage and identify its organizational structure: cause-and-effect, compare-and-contrast, problem-and-solution, chronological/sequence, description, or question-and-answer. The primitive provides a visual template for each structure (e.g., Venn diagram for compare-contrast, flow chart for cause-effect, timeline for chronological) and students map passage content onto the template. Signal words are highlightable (because, however, first, as a result, similarly, in contrast).

**Multimodal features:**
- **Visual:** Structure-specific templates (Venn, T-chart, flowchart, timeline, web). Signal words highlighted in color. AI-generated diagram of the passage's structure.
- **Audio (TTS):** Passage read-aloud with signal words emphasized.
- **Interactive:** Highlight signal words, select structure type, drag text excerpts onto template regions.

**Learning goals by grade:**
- Grade 2: Sequence (first, then, finally). Description.
- Grade 3: Cause-and-effect. Signal word recognition.
- Grade 4: Compare-and-contrast. Problem-and-solution.
- Grade 5: All 5 structures. Mixed structures within one text. Author's purpose for choosing a structure.
- Grade 6: Complex multi-paragraph structures. Evaluating whether the structure serves the author's purpose.

**Interaction model:** Phase 1 (Signal Words) — highlight signal words in the passage. Phase 2 (Identify) — select the organizational structure from options. Phase 3 (Map) — drag key ideas onto the structure template.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'text-structure-analyzer'`
- `structureIdentifiedCorrectly` (boolean)
- `signalWordsFound` / `signalWordsTotal`
- `templateMappingAccuracy` (0-100, how well they placed content on the template)
- `structureType` ('cause-effect' | 'compare-contrast' | 'problem-solution' | 'chronological' | 'description')
- `attemptsCount`

---

### 8. `evidence-finder` — Cite Text Evidence for Claims

**What it does:** Students are given a claim or question about an informational passage and must find and highlight the specific text evidence that supports it. Goes beyond `interactive-passage`'s highlight task by supporting multiple claims, evidence strength ranking (strong/moderate/weak), and distinguishing evidence from opinion. Students practice the "Claim -> Evidence -> Reasoning" (CER) framework.

**Multimodal features:**
- **Visual:** Color-coded highlighting (different color per claim). Evidence strength meter. CER framework scaffold (three labeled boxes).
- **Audio (TTS):** Passage read-aloud. Claim read aloud for auditory learners.
- **Interactive:** Multi-color highlighting, evidence ranking slider, CER text entry.

**Learning goals by grade:**
- Grade 2: "Find the sentence that tells you..."
- Grade 3: Distinguish a fact from an opinion. Find one piece of evidence.
- Grade 4: Find evidence for a specific claim. Explain why it's evidence (reasoning).
- Grade 5: Multiple pieces of evidence for one claim. Rank evidence by strength.
- Grade 6: Competing claims with evidence for each. Evaluating source reliability.

**Interaction model:** Phase 1 (Find) — highlight text that answers the question. Phase 2 (Evaluate) — rate the evidence strength. Phase 3 (Reason) — write 1-2 sentences explaining how the evidence supports the claim.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'evidence-finder'`
- `correctEvidenceFound` / `evidenceTotal`
- `falseEvidenceSelected` (count of non-evidence highlighted)
- `evidenceStrengthRatingAccuracy` (0-100)
- `reasoningProvided` (boolean)
- `cerFrameworkComplete` (boolean — all three parts filled)
- `attemptsCount`

---

## STRAND 4: Writing (W)

### 9. `paragraph-architect` — Build Structured Paragraphs

**What it does:** A scaffolded paragraph construction tool using the "hamburger" model (topic sentence -> detail sentences -> concluding sentence). Students build paragraphs component by component. The primitive provides sentence-starter frames for each part, validates structure (does the detail support the topic?), and shows the assembled paragraph with color-coded parts. Supports three paragraph types: informational (main idea + facts), narrative (event + details + feeling), and opinion (claim + reasons + conclusion).

**Multimodal features:**
- **Visual:** Hamburger/sandwich diagram with color-coded layers (topic = top bun, details = fillings, conclusion = bottom bun). Real-time paragraph preview as students build.
- **Audio (TTS):** Read-back of completed paragraph so students hear their writing.
- **Interactive:** Sentence-starter selection, free-text entry for each layer, drag to reorder details, paragraph type selector.

**Learning goals by grade:**
- Grade 1: Topic sentence + 2 details (with heavy scaffolding and sentence frames)
- Grade 2: Topic + 3 details + concluding sentence. Temporal words (first, next, then).
- Grade 3: Full hamburger paragraph. Linking words (because, also, for example). All three types.
- Grade 4: Multi-paragraph preview. Transition sentences between paragraphs.
- Grade 5: Elaboration strategies (examples, explanations, definitions). Varying sentence structure.
- Grade 6: Paragraph as unit of argument. Topic sentence vs thesis. Counter-argument paragraphs.

**Interaction model:** Phase 1 (Frame) — select paragraph type and write topic sentence (with frames available). Phase 2 (Support) — add 2-4 detail sentences with linking words. Phase 3 (Close) — write concluding sentence. Phase 4 (Review) — hear TTS read-back, revise if needed.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'paragraph-architect'`
- `paragraphType` ('informational' | 'narrative' | 'opinion')
- `structureComplete` (boolean — all required parts present)
- `topicSentencePresent` (boolean)
- `detailSentencesCount`
- `concludingSentencePresent` (boolean)
- `linkingWordsUsed` (count)
- `sentenceFramesUsed` / `sentenceFramesAvailable` (less = more independent)
- `revisionsAfterReadBack` (count — did they revise after hearing it?)

---

### 10. `story-planner` — Narrative Writing Organizer

**What it does:** A pre-writing planning tool for narrative/fiction writing. Students plan stories by filling in structured cards: character(s), setting, problem/conflict, key events (3-5), solution/resolution, and theme/lesson. Each card has guiding prompts and sentence starters. The planner generates a visual story arc from the student's inputs and produces a printable/exportable story outline. Connects directly to `story-map` (strand 2) — students who analyzed a story's structure can now use the same framework to plan their own.

**Multimodal features:**
- **Visual:** Story arc visualization built from student inputs. AI-generated illustrations for the student's characters and setting (reward and motivation). Card-based planning interface.
- **Audio (TTS):** Read-back of the complete story outline.
- **Interactive:** Card-based input with expandable prompts, drag cards to reorder events, story arc auto-populates.

**Learning goals by grade:**
- K-1: Draw and dictate a story. Character + what happened.
- Grade 2: Character + setting + problem + solution. Use temporal words.
- Grade 3: Full 5-card plan. Dialogue prompts. Descriptive setting.
- Grade 4: Internal character motivation. Rising action with 3+ events. Sensory details.
- Grade 5: Multiple characters with relationships. Subplot awareness. Theme identification.
- Grade 6: Complex conflict types. Foreshadowing. Narrative perspective choice (1st/3rd).

**Evaluable:** Yes (structural completeness, not creative quality).

**Evaluation metrics:**
- `type: 'story-planner'`
- `elementsPlanned` / `elementsRequired`
- `characterDepth` (traits + motivation present = deep, name only = surface)
- `eventCount` (number of plot events planned)
- `conflictIdentified` (boolean)
- `resolutionConnectsToConflict` (boolean — does resolution address the problem?)
- `descriptiveLanguageUsed` (count of sensory/descriptive words in setting)

---

### 11. `opinion-builder` — Argument & Persuasive Writing Scaffold

**What it does:** A structured scaffold for opinion/argumentative writing using the OREO model (Opinion -> Reasons -> Examples/Evidence -> Opinion restated) for grades 2-4, transitioning to full CER (Claim -> Evidence -> Reasoning) for grades 5-6. Students construct arguments piece by piece, with the primitive validating logical connections between claim, reasons, and evidence. Supports counter-argument introduction at grades 5-6.

**Multimodal features:**
- **Visual:** OREO stack visualization (grades 2-4) or CER framework diagram (grades 5-6). Color-coded argument parts. Strength meter showing argument completeness.
- **Audio (TTS):** Read-back of complete argument so students hear the rhetorical flow.
- **Interactive:** Structured text entry per component, drag to reorder reasons by strength, counter-argument toggle (grades 5-6).

**Learning goals by grade:**
- Grade 2: State an opinion + 1 reason. "I think ___ because ___."
- Grade 3: Opinion + 2 reasons + examples. Linking words (because, therefore, for instance).
- Grade 4: Full OREO. 3 reasons ranked by strength. Concluding statement.
- Grade 5: Transition to CER. Evidence from texts. Acknowledge opposing view.
- Grade 6: Full argumentative structure. Counter-argument + rebuttal. Source citation.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'opinion-builder'`
- `framework` ('oreo' | 'cer')
- `claimPresent` (boolean)
- `reasonsProvided` (count)
- `evidenceForEachReason` (boolean — every reason backed by evidence)
- `counterArgumentPresent` (boolean, grades 5-6)
- `linkingWordsUsed` (count)
- `structureComplete` (boolean)
- `revisionsAfterReadBack` (count)

---

### 12. `revision-workshop` — Edit & Revise with Targeted Feedback

**What it does:** Students receive a draft passage (either AI-generated with intentional weaknesses, or their own writing from another primitive) and apply specific revision strategies. The primitive focuses on one revision skill at a time: adding descriptive details, strengthening word choice (replacing "said" with vivid verbs), combining short choppy sentences, fixing run-ons, improving transitions, or reorganizing for clarity. Provides before/after comparison to show impact of revisions.

**Multimodal features:**
- **Visual:** Side-by-side before/after view. Revision targets highlighted in the draft. Word-choice alternatives displayed as selectable chips. Sentence-combining visual connectors.
- **Audio (TTS):** Hear the draft read aloud before and after revision — students hear the improvement.
- **Interactive:** Inline editing, word replacement selection, sentence combining via drag-merge, transition word insertion.

**Learning goals by grade:**
- Grade 2: Add details to a bare sentence. Replace overused words (big -> enormous).
- Grade 3: Combine two short sentences with conjunctions. Add dialogue.
- Grade 4: Vary sentence beginnings. Strengthen weak verbs. Add transitions between paragraphs.
- Grade 5: Eliminate redundancy. Improve word precision. Reorganize paragraphs for flow.
- Grade 6: Tone/voice adjustment. Formal vs informal register. Concision (cut unnecessary words).

**Interaction model:** Phase 1 (Read) — read/listen to the draft, identify the weakness category. Phase 2 (Revise) — apply 3-5 targeted revisions. Phase 3 (Compare) — hear before/after read-aloud, reflect on improvement.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'revision-workshop'`
- `revisionSkill` ('add-details' | 'word-choice' | 'combine-sentences' | 'transitions' | 'reorganize' | 'concision')
- `revisionsApplied` / `revisionTargets`
- `improvementScore` (0-100, AI-assessed quality delta)
- `beforeAfterCompared` (boolean — did they use the comparison view)
- `readAloudUsed` (boolean — did they listen to both versions)
- `attemptsCount`

---

## STRAND 5: Speaking & Listening (SL)

### 13. `listen-and-respond` — Audio Comprehension with Multi-Format Questions

**What it does:** A listening comprehension primitive where students hear a passage, story, speech, or conversation read aloud via TTS (not read it) and then answer comprehension questions. The passage text is hidden during listening — students must rely on auditory processing. Questions range from literal recall to inference to identifying speaker's purpose. Supports replaying specific segments. Optionally shows the text after answering for self-checking.

**Multimodal features:**
- **Audio (TTS, primary modality):** Full passage delivered via high-quality Gemini TTS. Segment-by-segment playback with replay controls. Adjustable speed (0.75x-1.5x). Speaker voice variation for dialogue passages.
- **Visual:** Audio waveform/progress bar during playback. AI-generated scene illustration (provides visual context without giving away text content). Question cards appear after listening.
- **Interactive:** Play/pause/replay/speed controls. Segment navigation. Question response (multiple choice, short answer, sequencing).

**Learning goals by grade:**
- K: Listen to a short story (30-60 sec). Answer "Who?" and "What happened?" questions.
- Grade 1: Listen to 1-2 minute passage. Retell key details. Identify characters.
- Grade 2: Listen to informational text. Answer questions about main topic and details.
- Grade 3: Determine main idea from listening. Distinguish important vs unimportant details.
- Grade 4: Identify speaker's purpose (inform, persuade, entertain). Summarize key points.
- Grade 5: Analyze how speaker uses evidence. Identify claims and supporting details.
- Grade 6: Evaluate argument strength from audio. Identify rhetorical techniques. Note-taking during listening.

**Interaction model:** Phase 1 (Listen) — hear the full passage (text hidden). Phase 2 (Respond) — answer 3-5 questions without replaying. Phase 3 (Review) — optionally replay specific segments and revise answers. Text reveal after submission.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'listen-and-respond'`
- `questionsCorrect` / `questionsTotal`
- `replaysUsed` (count — fewer = stronger listening comprehension)
- `segmentsReplayed` (which segments needed re-listening)
- `answeredBeforeReplay` / `questionsTotal` (first-listen comprehension rate)
- `passageType` ('narrative' | 'informational' | 'persuasive' | 'dialogue')
- `listeningDurationSeconds`
- `speedUsed` (playback speed selected)

---

### 14. `read-aloud-studio` — Fluency Practice with Model Reading

**What it does:** A fluency practice primitive with three modes. **Model mode:** TTS reads the passage with proper pacing, expression, and prosody — students follow along as words highlight in sync (karaoke-style). **Practice mode:** Student reads aloud into microphone and hears their own playback for self-assessment. **Compare mode:** Student recording plays side-by-side with TTS model so they can hear differences in pacing and expression. The primitive does NOT do AI speech grading — it relies on student self-reflection and the teacher's ear. Tracks reading rate (words per minute via passage length / recording duration).

**Multimodal features:**
- **Audio (TTS):** High-quality model reading with word-level timing for synchronized highlighting. Expression markers (pause, emphasis, question intonation) shown in the text.
- **Audio (Microphone):** Student recording via `AudioCaptureService`. Playback of student recording. Side-by-side comparison playback.
- **Visual:** Karaoke-style word highlighting during model playback. Expression/prosody markers in text (| pause, **bold** emphasis, rising intonation). WPM calculator display.
- **Interactive:** Mode switching, recording controls (start/stop/playback), speed adjustment for model reading.

**Learning goals by grade:**
- Grade 1: Follow along with model reading. Recognize that reading sounds like talking.
- Grade 2: Practice reading at conversational pace. Notice punctuation affects voice.
- Grade 3: Read with expression (questions sound different from statements). Target 80-100 WPM.
- Grade 4: Adjust reading rate for different text types. Self-assess pacing. Target 100-120 WPM.
- Grade 5: Read dialogue with character voices. Emphasize key words. Target 120-140 WPM.
- Grade 6: Adjust tone for genre (formal informational vs casual narrative). Target 140-160 WPM.

**Evaluable:** Partial — structural metrics (WPM, recording completed) are evaluable; fluency quality requires human assessment.

**Evaluation metrics:**
- `type: 'read-aloud-studio'`
- `modelListened` (boolean)
- `studentRecordingMade` (boolean)
- `recordingDurationSeconds`
- `estimatedWPM` (passage word count / recording duration)
- `comparisonUsed` (boolean — did they use compare mode)
- `selfAssessmentRating` (1-5 student self-score, optional)
- `passageLexileLevel`

---

## STRAND 6: Language (L)

### 15. `sentence-builder` — Construct Grammatical Sentences from Parts

**What it does:** Students construct grammatically correct sentences by selecting and arranging word/phrase tiles. Unlike `sentence-analyzer` (which breaks DOWN existing sentences), this primitive builds UP from parts. Tiles are color-coded by grammatical role (subject = blue, predicate = red, object = green, modifier = yellow). Supports progressive complexity from simple (S-V) to compound-complex sentences with subordinate clauses.

**Multimodal features:**
- **Visual:** Color-coded tiles by grammatical role. Sentence structure diagram updates in real-time as tiles are placed. Visual "slot" scaffolding for younger grades (Subject slot -> Verb slot -> Object slot).
- **Audio (TTS):** Read-back of constructed sentence to check if it "sounds right."
- **Interactive:** Drag tiles from word bank into sentence frame. Tiles snap to valid positions. Invalid placements get subtle shake feedback.

**Learning goals by grade:**
- Grade 1: Subject + verb ("The dog runs"). Noun + verb agreement.
- Grade 2: Subject + verb + object ("The dog chases the cat"). Adjective placement.
- Grade 3: Compound sentences with conjunctions (and, but, or). Adverb placement.
- Grade 4: Complex sentences with subordinate clauses (because, when, if, although).
- Grade 5: Compound-complex sentences. Prepositional phrases. Appositive phrases.
- Grade 6: Participial phrases. Relative clauses. Sentence variety for style.

**Interaction model:** Phase 1 (Guided) — fill in one missing part of a mostly-complete sentence. Phase 2 (Build) — construct a sentence from a full tile bank to match a target meaning. Phase 3 (Create) — build an original sentence using provided tiles with multiple valid arrangements.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'sentence-builder'`
- `sentencesBuilt` / `sentencesRequired`
- `grammaticallyCorrect` (boolean per sentence)
- `sentenceType` ('simple' | 'compound' | 'complex' | 'compound-complex')
- `partsOfSpeechCorrect` / `partsTotal` (did they use the right grammatical roles)
- `ttsUsedForChecking` (boolean)
- `attemptsCount`

---

### 16. `context-clues-detective` — Determine Word Meaning from Surrounding Text

**What it does:** Students encounter an unfamiliar (or intentionally challenging) word highlighted in a passage and must determine its meaning using context clues. The primitive teaches and identifies clue types: definition clue (the word is defined in the text), synonym/antonym clue, example clue, inference clue. Students highlight the clue in the passage, identify the clue type, then select or write the word's meaning. Includes a "reveal" showing the dictionary definition for comparison.

**Multimodal features:**
- **Visual:** Target word highlighted prominently. Context clue type icons (magnifying glass = inference, equals sign = definition, arrows = synonym/antonym). Passage with highlightable regions.
- **Audio (TTS):** Passage read aloud with the target word emphasized. Pronunciation of the target word.
- **Interactive:** Highlight context clues, select clue type, enter/select meaning, compare with dictionary.

**Learning goals by grade:**
- Grade 2: Use picture and sentence context. "The word ___ means ___ because the sentence says ___."
- Grade 3: Definition and example clues. Identify the clue sentence.
- Grade 4: Synonym and antonym clues. Multiple clues for one word.
- Grade 5: Inference from broader passage context. Greek/Latin root connections.
- Grade 6: Connotation vs denotation. Technical vocabulary in context. Multiple-meaning resolution.

**Interaction model:** Phase 1 (Find) — locate and highlight the context clue(s) near the target word. Phase 2 (Classify) — identify the clue type. Phase 3 (Define) — provide the word's meaning based on context.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'context-clues-detective'`
- `clueHighlightedCorrectly` (boolean)
- `clueTypeIdentified` (boolean)
- `meaningCorrect` (boolean or 0-100 similarity score)
- `clueType` ('definition' | 'synonym' | 'antonym' | 'example' | 'inference')
- `dictionaryComparisonViewed` (boolean)
- `attemptsCount`

---

### 17. `figurative-language-finder` — Identify and Interpret Non-Literal Language

**What it does:** Students read passages rich in figurative language and identify instances of simile, metaphor, personification, hyperbole, idiom, alliteration, onomatopoeia, and imagery. For each instance, they classify the type and interpret the literal meaning. Features a "translator" mode where students rewrite figurative sentences in literal language and compare the effect. Connects to `poetry-lab` for poetry-specific figurative language analysis.

**Multimodal features:**
- **Visual:** Color-coded highlighting by figurative language type (simile = blue, metaphor = purple, personification = green, etc.). Type-specific icons. "Figurative -> Literal" translation panel.
- **Audio (TTS):** Passage read with emphasis on figurative phrases. Compare figurative vs literal read-aloud to hear the difference in vividness.
- **Interactive:** Highlight and classify instances, write literal translations, toggle between figurative/literal versions.

**Learning goals by grade:**
- Grade 3: Simile (like/as) and alliteration. "What does it REALLY mean?"
- Grade 4: Metaphor, personification, hyperbole. Simile vs metaphor distinction.
- Grade 5: Idioms in context. Imagery (sensory language). Onomatopoeia.
- Grade 6: Extended metaphor. Symbolism. How figurative language creates tone/mood.

**Interaction model:** Phase 1 (Find) — highlight all figurative language instances in the passage. Phase 2 (Classify) — label each highlight with its type. Phase 3 (Interpret) — write the literal meaning of 2-3 key instances.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'figurative-language-finder'`
- `instancesFound` / `instancesTotal`
- `classificationsCorrect` / `classificationsTotal`
- `literalTranslationAccuracy` (0-100, AI-assessed)
- `typesEncountered` (array of figurative language types in the passage)
- `falsePositives` (count of non-figurative text incorrectly highlighted)
- `attemptsCount`

---

### 18. `spelling-pattern-explorer` — Discover and Practice Spelling Rules

**What it does:** Students investigate groups of words that share a spelling pattern (e.g., -ight words, silent-e rule, doubling rule, -tion/-sion endings, i-before-e) and discover the underlying rule. The primitive presents sorted word lists, asks students to identify what the words have in common, formulate the rule, then apply it to new words. Includes a practice mode with audio dictation — students hear a word via TTS and must spell it correctly applying the discovered rule.

**Multimodal features:**
- **Audio (TTS):** Word pronunciation for each pattern word. Dictation mode — hear a word, type the spelling. Slow pronunciation option to hear individual syllables.
- **Visual:** Word lists with pattern highlighted (color/bold). Rule formulation template. Pattern visualization (e.g., showing the silent-e making the vowel "say its name").
- **Interactive:** Sort words by pattern, formulate rules in structured template, dictation spelling practice, self-check with reveal.

**Learning goals by grade:**
- Grade 1: Short vowel CVC patterns. Common word families (-at, -an, -ig, -op, -ug).
- Grade 2: Long vowel patterns (CVCe, vowel teams: ai, ea, oa, ee). Consonant digraphs in spelling.
- Grade 3: R-controlled vowels. Doubling rule (hopping vs hoping). Plural rules (-s, -es, -ies).
- Grade 4: Suffixes that change spelling (-ing, -ed, -ly, -ful, -ness). Homophones.
- Grade 5: Greek/Latin roots affecting spelling. -tion/-sion/-cian endings. Silent letters.
- Grade 6: Advanced patterns (ei/ie rule + exceptions). Absorbed prefixes (in- -> im-, il-, ir-). Etymology-based spelling.

**Interaction model:** Phase 1 (Observe) — examine a sorted word list and identify the pattern. Phase 2 (Rule) — fill in a rule template ("When a word ends in silent-e, adding -ing means you ___"). Phase 3 (Apply) — spell 4-6 new words using the rule (audio dictation).

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'spelling-pattern-explorer'`
- `patternIdentified` (boolean)
- `ruleFormulatedCorrectly` (boolean or 0-100)
- `wordsSpelledCorrectly` / `wordsTotal` (dictation practice)
- `patternType` ('short-vowel' | 'long-vowel' | 'r-controlled' | 'suffix-change' | 'latin-root' | 'silent-letter')
- `dictationAccuracy` (0-100)
- `attemptsCount`

---

## Catalog & Domain Structure

### Expanded Literacy Catalog

All 18 new primitives plus the existing ones join a significantly expanded `LITERACY_CATALOG` in `catalog/literacy.ts`. No new catalog domain needed — these are all ELA.

**Subcategories within the catalog** (for AI context organization):

| Subcategory | Primitives |
|---|---|
| Foundational Skills (RF) | `phonics-blender`, `decodable-reader`, `letter-tracing`*, `alphabet-sequence`*, `sight-word-card`*, `rhyming-pairs`*, `sound-sort`* |
| Literature (RL) | `story-map`, `character-web`, `poetry-lab`, `genre-explorer`, `interactive-passage`* |
| Informational Text (RI) | `text-structure-analyzer`, `evidence-finder`, `interactive-passage`* |
| Writing (W) | `paragraph-architect`, `story-planner`, `opinion-builder`, `revision-workshop` |
| Speaking & Listening (SL) | `listen-and-respond`, `read-aloud-studio` |
| Language (L) | `sentence-builder`, `context-clues-detective`, `figurative-language-finder`, `spelling-pattern-explorer`, `sentence-analyzer`*, `word-builder`* |

*\* = already exists*

### Generator Domain

New directory: `service/literacy/` with individual generator files. New `literacyGenerators.ts` in the generators registry.

---

## Multimodal Integration Summary

| Modality | Primitives Using It | Infrastructure |
|---|---|---|
| **TTS Read-Aloud** | `decodable-reader`, `phonics-blender`, `poetry-lab`, `listen-and-respond`, `read-aloud-studio`, `paragraph-architect`, `opinion-builder`, `revision-workshop`, `context-clues-detective`, `figurative-language-finder`, `spelling-pattern-explorer`, `genre-explorer`, `text-structure-analyzer`, `evidence-finder` | Gemini TTS -> base64 PCM -> Web Audio API (exists) |
| **Microphone Capture** | `read-aloud-studio` | `AudioCaptureService` at 16kHz (exists) |
| **AI Image Generation** | `story-map`, `character-web`, `story-planner`, `genre-explorer`, `decodable-reader`, `listen-and-respond` | Gemini image generation (exists) |
| **Drag-and-Drop** | `phonics-blender`, `sentence-builder`, `story-map`, `text-structure-analyzer` | React DnD patterns (exists in `word-builder`) |
| **Text Highlighting** | `evidence-finder`, `figurative-language-finder`, `context-clues-detective`, `text-structure-analyzer` | Highlighting system (exists in `interactive-passage`) |
| **Synchronized Highlighting** | `read-aloud-studio`, `decodable-reader` | **New** — word-level TTS timing needed |
| **Side-by-Side Comparison** | `revision-workshop`, `genre-explorer` | Layout pattern (exists in `image-comparison`) |

### New Infrastructure Required

| Capability | Used By | Complexity |
|---|---|---|
| **Word-level TTS timing** (karaoke sync) | `read-aloud-studio`, `decodable-reader` | Medium — requires Gemini TTS word timestamps or client-side approximation |
| **Audio recording + playback** (student voice) | `read-aloud-studio` | Low — `AudioCaptureService` exists, need playback UI |
| **WPM calculation** | `read-aloud-studio` | Low — word count / recording duration |
| **AI writing quality assessment** | `revision-workshop` | Medium — Gemini evaluation of before/after quality delta |

---

## File Inventory

### New Files (per primitive: component + generator = 2 files)

| # | Primitive | Component File | Generator File |
|---|-----------|---------------|---------------|
| 1 | `phonics-blender` | `primitives/visual-primitives/literacy/PhonicsBlender.tsx` | `service/literacy/gemini-phonics-blender.ts` |
| 2 | `decodable-reader` | `primitives/visual-primitives/literacy/DecodableReader.tsx` | `service/literacy/gemini-decodable-reader.ts` |
| 3 | `story-map` | `primitives/visual-primitives/literacy/StoryMap.tsx` | `service/literacy/gemini-story-map.ts` |
| 4 | `character-web` | `primitives/visual-primitives/literacy/CharacterWeb.tsx` | `service/literacy/gemini-character-web.ts` |
| 5 | `poetry-lab` | `primitives/visual-primitives/literacy/PoetryLab.tsx` | `service/literacy/gemini-poetry-lab.ts` |
| 6 | `genre-explorer` | `primitives/visual-primitives/literacy/GenreExplorer.tsx` | `service/literacy/gemini-genre-explorer.ts` |
| 7 | `text-structure-analyzer` | `primitives/visual-primitives/literacy/TextStructureAnalyzer.tsx` | `service/literacy/gemini-text-structure-analyzer.ts` |
| 8 | `evidence-finder` | `primitives/visual-primitives/literacy/EvidenceFinder.tsx` | `service/literacy/gemini-evidence-finder.ts` |
| 9 | `paragraph-architect` | `primitives/visual-primitives/literacy/ParagraphArchitect.tsx` | `service/literacy/gemini-paragraph-architect.ts` |
| 10 | `story-planner` | `primitives/visual-primitives/literacy/StoryPlanner.tsx` | `service/literacy/gemini-story-planner.ts` |
| 11 | `opinion-builder` | `primitives/visual-primitives/literacy/OpinionBuilder.tsx` | `service/literacy/gemini-opinion-builder.ts` |
| 12 | `revision-workshop` | `primitives/visual-primitives/literacy/RevisionWorkshop.tsx` | `service/literacy/gemini-revision-workshop.ts` |
| 13 | `listen-and-respond` | `primitives/visual-primitives/literacy/ListenAndRespond.tsx` | `service/literacy/gemini-listen-and-respond.ts` |
| 14 | `read-aloud-studio` | `primitives/visual-primitives/literacy/ReadAloudStudio.tsx` | `service/literacy/gemini-read-aloud-studio.ts` |
| 15 | `sentence-builder` | `primitives/visual-primitives/literacy/SentenceBuilder.tsx` | `service/literacy/gemini-sentence-builder.ts` |
| 16 | `context-clues-detective` | `primitives/visual-primitives/literacy/ContextCluesDetective.tsx` | `service/literacy/gemini-context-clues-detective.ts` |
| 17 | `figurative-language-finder` | `primitives/visual-primitives/literacy/FigurativeLanguageFinder.tsx` | `service/literacy/gemini-figurative-language-finder.ts` |
| 18 | `spelling-pattern-explorer` | `primitives/visual-primitives/literacy/SpellingPatternExplorer.tsx` | `service/literacy/gemini-spelling-pattern-explorer.ts` |

### Shared Files (created once)

| File | Purpose |
|---|---|
| `service/registry/generators/literacyGenerators.ts` | Register all 18 generators |

### Existing Files Modified

| File | Changes |
|---|---|
| `types.ts` | Add 18 new ComponentIds to union |
| `config/primitiveRegistry.tsx` | Add 18 registry entries |
| `evaluation/types.ts` | Add 18 metrics interfaces + union members |
| `evaluation/index.ts` | Export new metrics types |
| `service/manifest/catalog/literacy.ts` | Add 18 catalog entries with descriptions |
| `service/registry/generators/index.ts` | Import `literacyGenerators.ts` |

**Total: 37 new files + 6 existing file modifications.**

---

## Implementation Priority

### Wave 1 — Foundation (highest impact, most reusable)

| Primitive | Rationale |
|-----------|-----------|
| `paragraph-architect` | Writing is the #1 gap. Every subject needs paragraph writing. |
| `sentence-builder` | Foundation for grammar understanding. Enables all writing primitives. |
| `story-map` | Most-taught reading comprehension strategy K-5. |
| `listen-and-respond` | Unlocks audio modality for all of ELA. Proves TTS pipeline for LA. |

### Wave 2 — Core Literacy

| Primitive | Rationale |
|-----------|-----------|
| `phonics-blender` | Critical K-2 foundational skill. TTS makes it uniquely powerful. |
| `decodable-reader` | Natural companion to phonics-blender. Per-word TTS is innovative. |
| `evidence-finder` | Required skill grades 3-6. Builds on existing `interactive-passage` highlighting. |
| `context-clues-detective` | Vocabulary strategy taught daily in most classrooms. |

### Wave 3 — Depth

| Primitive | Rationale |
|-----------|-----------|
| `opinion-builder` | High-stakes writing type (state assessments). |
| `text-structure-analyzer` | Key informational reading skill grades 3-6. |
| `character-web` | Deep literary analysis, connects to story-map. |
| `figurative-language-finder` | Directly supports poetry and literary reading. |

### Wave 4 — Advanced & Multimodal

| Primitive | Rationale |
|-----------|-----------|
| `poetry-lab` | Rich but complex. Dual-mode (analysis + composition). |
| `read-aloud-studio` | Highest multimodal complexity (TTS + mic + sync). |
| `story-planner` | Writing organizer, pairs with story-map. |
| `revision-workshop` | Requires AI quality assessment. Most complex generator. |
| `genre-explorer` | Broad but less interactive than others. |
| `spelling-pattern-explorer` | Standalone skill, lower cross-curricular impact. |

---

## Cross-Primitive Learning Paths

### The Reading Comprehension Path
```
decodable-reader -> interactive-passage -> evidence-finder -> text-structure-analyzer
     (decode)          (comprehend)           (analyze)            (evaluate)
```

### The Writing Development Path
```
sentence-builder -> paragraph-architect -> opinion-builder / story-planner -> revision-workshop
   (sentences)        (paragraphs)            (full pieces)                     (revision)
```

### The Literary Analysis Path
```
story-map -> character-web -> figurative-language-finder -> poetry-lab
  (plot)      (character)        (language craft)            (poetry)
```

### The Foundational Skills Path (K-2)
```
letter-tracing -> alphabet-sequence -> sound-sort -> phonics-blender -> decodable-reader -> sight-word-card
  (formation)       (sequence)         (phonemes)     (blending)         (connected text)     (automaticity)
```

### The Vocabulary Path
```
word-builder -> context-clues-detective -> figurative-language-finder -> spelling-pattern-explorer
 (morphology)     (context strategies)        (non-literal meaning)        (orthographic patterns)
```

---

## Cross-Domain Connections

| LA Primitive | Connects To | How |
|---|---|---|
| `listen-and-respond` | `media-player` | Same TTS + audio playback infrastructure |
| `story-map` | `sequencing-activity` (assessment) | Same sequencing interaction pattern |
| `evidence-finder` | `interactive-passage` | Extends existing highlighting system |
| `text-structure-analyzer` | `comparison-panel`, `generative-table` (core) | Uses same visual templates |
| `character-web` | `nested-hierarchy` (core) | Similar node-and-edge graph pattern |
| `sentence-builder` | `word-builder` (literacy) | Same drag-tile-to-slot interaction |
| `spelling-pattern-explorer` | `categorization-activity` (assessment) | Same sort-by-category pattern |
| `paragraph-architect` | `opinion-builder` | Shared paragraph structure framework |
| `read-aloud-studio` | `decodable-reader` | Shared TTS sync + audio playback |
| `genre-explorer` | `image-comparison` (media) | Same side-by-side comparison pattern |

---

## Open Questions

1. **TTS voice selection** — Should different primitives use different TTS voices? (e.g., child-friendly voice for K-2, neutral voice for 3-6, character voices for dialogue). Gemini TTS voice options need investigation.

2. **Word-level TTS timing** — Karaoke-style highlighting in `read-aloud-studio` and `decodable-reader` requires word-level timestamps from TTS. Options: (a) Gemini TTS with timestamp output, (b) client-side approximation using word count / duration, (c) pre-computed timing in the generator. Needs spike.

3. **AI writing assessment** — `revision-workshop` and potentially `paragraph-architect` benefit from AI quality assessment. Should this be a shared service? What rubric? How to avoid the AI "grading" creative writing (focus on structural/mechanical feedback only)?

4. **Passage sourcing** — Should `interactive-passage`, `evidence-finder`, `listen-and-respond`, etc. share a passage generation pipeline? Currently each would have its own generator, but a shared "generate grade-appropriate passage on topic X with features Y" service could reduce duplication.

5. **Read-aloud recording privacy** — `read-aloud-studio` captures student voice. Recordings should be ephemeral (browser-only, never sent to server) unless explicit opt-in. Need clear privacy UX.

6. **Handwriting/drawing** — K-1 writing standards include drawing and dictation. The `letter-tracing` primitive exists but the platform has no general handwriting/drawing canvas. Should `story-planner` K-1 mode support drawing? Defer to v2.

7. **Lexile/reading level integration** — Several primitives generate passages at grade level. Should we integrate Lexile scoring into the generator pipeline to validate readability? Or trust Gemini's grade-level generation?

8. **ESL/ELL support** — Many of these primitives (especially `phonics-blender`, `decodable-reader`, `listen-and-respond`) are valuable for English Language Learners. Should bilingual support (L1 translations, cognate highlighting) be a v1 consideration or v2?
