# PRD: Eval Modes Rollout — Literacy Primitives

**Status:** Draft
**Last Updated:** 2026-03-11
**Skill:** `/add-eval-modes`
**Reference:** `PRD_EVAL_MODES_ROLLOUT.md` (math primitives), `lumina_difficulty_calibration_prd.md` (IRT β priors)

---

## Overview

This PRD extends the eval mode system to **all 26 literacy primitives**, enabling the IRT engine to estimate per-mode ability parameters (β) for reading, writing, and language skills. The `/add-eval-modes` skill handles the mechanical work, but literacy requires two adaptations:

1. **Literacy-specific scaffolding taxonomy** — math uses Concrete-Pictorial-Abstract (CPA); literacy follows a Recognition → Production → Analysis progression
2. **Schema utility extension** — `constrainChallengeTypeEnum()` currently hardcodes `challenges.items.properties.type`; literacy generators use varied field names (`mode`, `operation`, `clueType`, `patternType`) and array names (`challenges`, `words`, `instances`, `questions`)

### Literacy Scaffolding Mode → β Reference

| Scaffold | Description | Prior β | Literacy Equivalent |
|----------|-------------|---------|---------------------|
| 1 | Recognition with full support (matching, MC, guided) | 1.5 | Identify/recognize with scaffolds |
| 2 | Guided identification (word banks, templates, prompts) | 2.5 | Scaffolded practice |
| 3 | Supported application (reduced scaffolding) | 3.5 | Independent application |
| 4 | Independent production (minimal support) | 5.0 | Generate/compose/produce |
| 5 | Analysis/evaluation (higher-order thinking) | 6.5 | Analyze, evaluate, compare |
| 6 | Transfer/creation (cross-skill, generative, multi-step) | 8.0 | Synthesize across contexts |

Within-mode adjustments of ±0.5–1.0 are allowed for: text complexity, vocabulary tier, genre, response format, and time constraints.

---

## Status Legend

- **DONE** — Eval modes defined in catalog + wired in generator + registry spread confirmed
- **READY** — Has challenge type enum in schema; can run `/add-eval-modes` after Wave 0
- **NEEDS FIELD RENAME** — Has challenge types but uses non-standard field name (e.g., `mode` instead of `type`)
- **NEEDS TYPES** — No challenge type enum; must add types before eval modes
- **REVIEW** — Special case; may need architectural discussion

---

## Wave 0: Schema Utility Extension (PREREQUISITE)

### Problem

`constrainChallengeTypeEnum()` in `service/evalMode/index.ts` hardcodes the path `schema.properties.challenges.items.properties.type`. Literacy generators use:

| Field Name | Array Name | Primitives Using This Pattern |
|-----------|------------|-------------------------------|
| `mode` | `challenges` | RhymeStudio, LetterSpotter, LetterSoundLink, WordWorkout |
| `operation` | `challenges` | SoundSwap |
| `clueType` | `challenges` | ContextCluesDetective |
| `patternType` | root level | PhonicsBlender, SpellingPatternExplorer |
| `sentenceType` | root level | SentenceBuilder |
| `type` | `instances` | FigurativeLanguageFinder |
| `type` | `questions` | ListenAndRespond |
| `structureType` | root level | StoryMap, TextStructureAnalyzer |
| `revisionSkill` | root level | RevisionWorkshop |
| `paragraphType` | root level | ParagraphArchitect |
| `framework` | root level | OpinionBuilder |

### Solution

Extend `constrainChallengeTypeEnum()` to accept an optional config for the field path:

```typescript
interface SchemaConstraintConfig {
  /** Array name containing challenges (default: 'challenges') */
  arrayName?: string;
  /** Field name for challenge type within each item (default: 'type') */
  fieldName?: string;
  /** If true, the type field is at root level, not inside an array */
  rootLevel?: boolean;
}

export function constrainChallengeTypeEnum(
  baseSchema: Schema,
  allowedTypes: string[],
  challengeTypeDocs: Record<string, ChallengeTypeDoc>,
  config?: SchemaConstraintConfig,
): Schema {
  const schema: Schema = JSON.parse(JSON.stringify(baseSchema));
  const props = (schema as Record<string, unknown>).properties as Record<string, unknown>;

  let typeField: Record<string, unknown> | undefined;

  if (config?.rootLevel) {
    // Field is at schema root (e.g., patternType, sentenceType)
    typeField = props?.[config.fieldName ?? 'type'] as Record<string, unknown> | undefined;
  } else {
    // Field is inside an array of items
    const arrayName = config?.arrayName ?? 'challenges';
    const fieldName = config?.fieldName ?? 'type';
    const array = props?.[arrayName] as Record<string, unknown> | undefined;
    const items = array?.items as Record<string, unknown> | undefined;
    const itemProps = items?.properties as Record<string, unknown> | undefined;
    typeField = itemProps?.[fieldName] as Record<string, unknown> | undefined;
  }

  if (typeField) {
    typeField.enum = allowedTypes;
    const descriptions = allowedTypes
      .map(t => challengeTypeDocs[t]?.schemaDescription ?? t)
      .join(', ');
    typeField.description = `Challenge type: ${descriptions}`;
  }

  return schema;
}
```

**This is backward-compatible** — existing math generators pass no config and get the current behavior.

**Estimated effort:** ~30 min (utility change + verify math generators still work)

---

## Primitives by ELA Strand

### Reading Foundations (RF) — 10 primitives

#### 1. LetterSpotter
- **File:** `gemini-letter-spotter.ts`
- **Schema field:** `challenges.items.properties.mode` → `["name-it", "find-it", "match-it"]`
- **Status:** NEEDS FIELD RENAME
- **Backend:** Not registered (has no per-mode priors)

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `name_it` | 1.5 | 1 | `['name-it']` | Name the letter shown |
| `find_it` | 2.5 | 2 | `['find-it']` | Find target letter among distractors |
| `match_it` | 3.5 | 3 | `['match-it']` | Match upper/lowercase pairs |

#### 2. LetterSoundLink
- **File:** `gemini-letter-sound-link.ts`
- **Schema field:** `challenges.items.properties.mode` → `["see-hear", "hear-see", "keyword-match"]`
- **Status:** NEEDS FIELD RENAME
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `see_hear` | 1.5 | 1 | `['see-hear']` | See letter, identify its sound |
| `hear_see` | 2.5 | 2 | `['hear-see']` | Hear sound, identify the letter |
| `keyword_match` | 3.5 | 3 | `['keyword-match']` | Match letter-sound to keyword image |

#### 3. PhonemeExplorer
- **File:** `gemini-phoneme-explorer.ts`
- **Schema field:** Needs challenge type enum added
- **Status:** NEEDS TYPES
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `isolate` | 1.5 | 1 | `['isolate']` | Identify initial/final phoneme |
| `segment` | 2.5 | 2 | `['segment']` | Break word into all phonemes |
| `blend` | 3.5 | 3 | `['blend']` | Combine phonemes into word |
| `manipulate` | 5.0 | 4 | `['manipulate']` | Add/delete/substitute phoneme |

#### 4. PhonicsBlender
- **File:** `gemini-phonics-blender.ts`
- **Schema field:** root `patternType` → `["cvc", "cvce", "blend", "digraph", "r-controlled", "diphthong"]`
- **Status:** NEEDS FIELD RENAME (root-level field)
- **Backend:** `"phonics-blender": {"default": PriorConfig(2.5)}`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `cvc` | 1.5 | 1 | `['cvc']` | Simple CVC blending (cat, dog) |
| `cvce_blend` | 2.5 | 2 | `['cvce', 'blend']` | Silent-e and consonant blends |
| `digraph` | 3.5 | 3 | `['digraph']` | Two letters, one sound (sh, ch, th) |
| `advanced` | 5.0 | 4 | `['r-controlled', 'diphthong']` | R-controlled vowels and diphthongs |

#### 5. RhymeStudio
- **File:** `gemini-rhyme-studio.ts`
- **Schema field:** `challenges.items.properties.mode` → `["recognition", "identification", "production"]`
- **Status:** NEEDS FIELD RENAME
- **Backend:** `"rhyme-studio": {"default": PriorConfig(2.0)}`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `recognition` | 1.5 | 1 | `['recognition']` | Do these words rhyme? (yes/no) |
| `identification` | 2.5 | 2 | `['identification']` | Pick the rhyming word from options |
| `production` | 5.0 | 4 | `['production']` | Generate a word that rhymes |

#### 6. SoundSwap
- **File:** `gemini-sound-swap.ts`
- **Schema field:** `challenges.items.properties.operation` → `["addition", "deletion", "substitution"]`
- **Status:** NEEDS FIELD RENAME
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `addition` | 2.0 | 1 | `['addition']` | Add a phoneme to make a new word |
| `deletion` | 3.0 | 2 | `['deletion']` | Remove a phoneme — what word remains? |
| `substitution` | 4.0 | 3 | `['substitution']` | Swap a phoneme to change the word |

#### 7. SyllableClapper
- **File:** `gemini-syllable-clapper.ts`
- **Schema field:** Needs challenge type enum added (currently difficulty-based)
- **Status:** NEEDS TYPES
- **Backend:** `"syllable-clapper": {"default": PriorConfig(2.0)}`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `count` | 1.5 | 1 | `['count']` | Clap and count syllables (1-2 syllable words) |
| `segment` | 2.5 | 2 | `['segment']` | Break word into syllable parts |
| `compound` | 3.5 | 3 | `['compound']` | Multi-syllable words (3-4 syllables) |

#### 8. CvcSpeller
- **File:** `gemini-cvc-speller.ts`
- **Schema field:** root `vowelFocus` → `["short-a", "short-e", "short-i", "short-o", "short-u"]`
- **Status:** REVIEW
- **Backend:** Not registered
- **Notes:** Vowel focus is content axis, not difficulty axis. May need a separate `taskType` enum (e.g., `spell_from_audio`, `fill_missing_vowel`, `word_sort`) to create meaningful eval modes.

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `fill_vowel` | 1.5 | 1 | `['fill_vowel']` | Select missing vowel in C_C frame |
| `spell_word` | 2.5 | 2 | `['spell_word']` | Spell full CVC word from audio |
| `word_sort` | 3.5 | 3 | `['word_sort']` | Sort words by vowel pattern |

#### 9. DecodableReader
- **File:** `gemini-decodable-reader.ts`
- **Schema field:** per-word `phonicsPattern` (not a challenge type)
- **Status:** REVIEW
- **Backend:** Not registered
- **Notes:** Challenge types should be reading task types, not phonics patterns. Phonics patterns are a content axis.

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `decode` | 1.5 | 1 | `['decode']` | Read highlighted decodable words |
| `comprehend` | 3.0 | 2 | `['comprehend']` | Answer MC comprehension questions |
| `fluency` | 5.0 | 4 | `['fluency']` | Read passage with accuracy tracking |

#### 10. WordWorkout
- **File:** `gemini-word-workout.ts`
- **Schema field:** `challenges.items.properties.mode` → `["real-vs-nonsense", "picture-match", "word-chains", "sentence-reading"]`
- **Status:** NEEDS FIELD RENAME
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `real_vs_nonsense` | 1.5 | 1 | `['real-vs-nonsense']` | Is this a real word? (recognition) |
| `picture_match` | 2.5 | 2 | `['picture-match']` | Match decoded word to picture |
| `word_chains` | 3.5 | 3 | `['word-chains']` | Change one letter to make new word |
| `sentence_reading` | 5.0 | 4 | `['sentence-reading']` | Read word in sentence context |

---

### Reading Literature (RL) — 4 primitives

#### 11. StoryMap
- **File:** `gemini-story-map.ts`
- **Schema field:** root `structureType` → `["bme", "story-mountain", "plot-diagram", "heros-journey"]`
- **Status:** NEEDS FIELD RENAME (root-level)
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `bme` | 1.5 | 1 | `['bme']` | Beginning-Middle-End (K-1) |
| `story_mountain` | 3.0 | 2 | `['story-mountain']` | 5-part narrative arc (2-3) |
| `plot_diagram` | 5.0 | 4 | `['plot-diagram']` | Freytag's pyramid (4-6) |
| `heros_journey` | 6.5 | 5 | `['heros-journey']` | Complex narrative structure (5-6) |

#### 12. CharacterWeb
- **File:** `gemini-character-web.ts`
- **Schema field:** Needs challenge type enum (currently relationship mapping only)
- **Status:** NEEDS TYPES
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify_traits` | 1.5 | 1 | `['identify_traits']` | Select character traits from options |
| `find_evidence` | 3.0 | 2 | `['find_evidence']` | Cite text evidence for traits |
| `map_relationships` | 4.0 | 3 | `['map_relationships']` | Build character relationship web |
| `analyze_change` | 6.0 | 5 | `['analyze_change']` | Track character development over story |

#### 13. PoetryLab
- **File:** `gemini-poetry-lab.ts`
- **Schema field:** `challenges.items.properties.mode` → `["analysis", "composition"]`
- **Status:** NEEDS FIELD RENAME
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `analysis` | 3.5 | 3 | `['analysis']` | Identify poetic elements in given poem |
| `composition` | 6.0 | 5 | `['composition']` | Compose poem using template structure |

#### 14. GenreExplorer
- **File:** `gemini-genre-explorer.ts`
- **Schema field:** Needs challenge type enum (currently genre identification only)
- **Status:** NEEDS TYPES
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Name the genre of a passage |
| `match_features` | 2.5 | 2 | `['match_features']` | Check genre features against passage |
| `compare` | 5.0 | 4 | `['compare']` | Compare two passages across genres |

---

### Reading Informational (RI) — 2 primitives

#### 15. EvidenceFinder
- **File:** `gemini-evidence-finder.ts`
- **Schema field:** Needs challenge type enum (currently sentence-level evidence tagging)
- **Status:** NEEDS TYPES
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `highlight` | 2.0 | 1 | `['highlight']` | Highlight sentences that support claim |
| `rank` | 3.5 | 3 | `['rank']` | Rank evidence by strength |
| `cer` | 5.5 | 4 | `['cer']` | Construct Claim-Evidence-Reasoning response |

#### 16. TextStructureAnalyzer
- **File:** `gemini-text-structure-analyzer.ts`
- **Schema field:** root `structureType` → `["cause-effect", "compare-contrast", "problem-solution", "chronological", "description"]`
- **Status:** NEEDS FIELD RENAME (root-level)
- **Backend:** Not registered
- **Notes:** Structure types are content categories, not difficulty levels. Need a separate task type for eval modes.

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify` | 2.0 | 1 | `['identify']` | Name the text structure used |
| `signal_words` | 3.0 | 2 | `['signal_words']` | Find signal words/phrases |
| `diagram` | 4.5 | 3 | `['diagram']` | Complete graphic organizer for structure |
| `compare_structures` | 6.0 | 5 | `['compare_structures']` | Compare structures across passages |

---

### Language (L) — 4 primitives

#### 17. SentenceBuilder
- **File:** `gemini-sentence-builder.ts`
- **Schema field:** root `sentenceType` → `["simple", "compound", "complex", "compound-complex"]`
- **Status:** NEEDS FIELD RENAME (root-level)
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `simple` | 1.5 | 1 | `['simple']` | Build simple sentence from tiles |
| `compound` | 3.0 | 2 | `['compound']` | Join clauses with conjunction |
| `complex` | 5.0 | 4 | `['complex']` | Subordinate clause construction |
| `compound_complex` | 7.0 | 5 | `['compound-complex']` | Multi-clause sentence building |

#### 18. ContextCluesDetective
- **File:** `gemini-context-clues-detective.ts`
- **Schema field:** `challenges.items.properties.clueType` → `["definition", "synonym", "antonym", "example", "inference"]`
- **Status:** NEEDS FIELD RENAME
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `definition` | 1.5 | 1 | `['definition']` | Meaning stated directly in text |
| `synonym_antonym` | 2.5 | 2 | `['synonym', 'antonym']` | Meaning from similar/opposite words |
| `example` | 3.5 | 3 | `['example']` | Meaning from given examples |
| `inference` | 5.5 | 4 | `['inference']` | Meaning from broader context |

#### 19. FigurativeLanguageFinder
- **File:** `gemini-figurative-language-finder.ts`
- **Schema field:** `instances.items.properties.type` → `["simile", "metaphor", "personification", "hyperbole", "idiom", "alliteration", "onomatopoeia", "imagery"]`
- **Status:** NEEDS FIELD RENAME (array name `instances` instead of `challenges`)
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `sound_devices` | 2.0 | 1 | `['alliteration', 'onomatopoeia']` | Identify sound-based devices |
| `comparison` | 3.0 | 2 | `['simile', 'metaphor']` | Identify explicit/implicit comparisons |
| `advanced` | 4.5 | 3 | `['personification', 'hyperbole', 'imagery']` | Non-literal expression identification |
| `idiom` | 6.0 | 5 | `['idiom']` | Interpret culturally specific expressions |

#### 20. SpellingPatternExplorer
- **File:** `gemini-spelling-pattern-explorer.ts`
- **Schema field:** root `patternType` → `["short-vowel", "long-vowel", "r-controlled", "suffix-change", "latin-root", "silent-letter"]`
- **Status:** NEEDS FIELD RENAME (root-level)
- **Backend:** `"spelling-pattern-explorer": {"default": PriorConfig(3.5)}`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `short_vowel` | 1.5 | 1 | `['short-vowel']` | CVC and short vowel patterns |
| `long_vowel` | 2.5 | 2 | `['long-vowel']` | CVCe, vowel teams |
| `r_controlled` | 3.5 | 3 | `['r-controlled']` | ar, er, ir, or, ur patterns |
| `morphological` | 5.0 | 4 | `['suffix-change', 'latin-root']` | Morpheme-based spelling |
| `silent_letter` | 4.0 | 3 | `['silent-letter']` | Silent letter conventions |

---

### Writing (W) — 4 primitives

#### 21. ParagraphArchitect
- **File:** `gemini-paragraph-architect.ts`
- **Schema field:** root `paragraphType` → `["informational", "narrative", "opinion"]`
- **Status:** NEEDS FIELD RENAME (root-level)
- **Backend:** Not registered
- **Notes:** Paragraph types are content categories. Eval modes should map to task complexity.

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `informational` | 2.5 | 2 | `['informational']` | Structured informational paragraph |
| `narrative` | 3.5 | 3 | `['narrative']` | Narrative paragraph with elements |
| `opinion` | 5.0 | 4 | `['opinion']` | Opinion with claim + support |

#### 22. StoryPlanner
- **File:** `gemini-story-planner.ts`
- **Schema field:** Needs challenge type enum (currently planning template only)
- **Status:** NEEDS TYPES
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `guided_plan` | 2.0 | 1 | `['guided_plan']` | Fill in pre-structured story outline |
| `independent_plan` | 4.0 | 3 | `['independent_plan']` | Create story plan from prompt |
| `arc_design` | 6.0 | 5 | `['arc_design']` | Design story arc with rising action |

#### 23. OpinionBuilder
- **File:** `gemini-opinion-builder.ts`
- **Schema field:** root `framework` → `["oreo", "cer"]`
- **Status:** NEEDS FIELD RENAME (root-level)
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `oreo` | 3.0 | 2 | `['oreo']` | Opinion-Reason-Example-Opinion (grades 2-4) |
| `cer` | 5.5 | 4 | `['cer']` | Claim-Evidence-Reasoning (grades 5-6) |

#### 24. RevisionWorkshop
- **File:** `gemini-revision-workshop.ts`
- **Schema field:** root `revisionSkill` → `["add-details", "word-choice", "combine-sentences", "transitions", "reorganize", "concision"]`
- **Status:** NEEDS FIELD RENAME (root-level)
- **Backend:** Not registered

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `add_details` | 2.0 | 1 | `['add-details']` | Expand with sensory/specific details |
| `word_choice` | 3.0 | 2 | `['word-choice']` | Replace weak/vague words |
| `combine_sentences` | 3.5 | 3 | `['combine-sentences']` | Combine choppy sentences |
| `transitions` | 4.5 | 3 | `['transitions']` | Add/improve transition words |
| `reorganize` | 5.5 | 4 | `['reorganize']` | Reorder for logical flow |
| `concision` | 6.5 | 5 | `['concision']` | Eliminate wordiness |

---

### Speaking & Listening (SL) — 2 primitives

#### 25. ListenAndRespond
- **File:** `gemini-listen-and-respond.ts`
- **Schema field:** root `passageType` → `["narrative", "informational", "persuasive", "dialogue"]` + `questions.items.properties.type` → `["multiple-choice", "short-answer", "sequencing"]`
- **Status:** REVIEW
- **Backend:** Not registered
- **Notes:** Two independent axes — passage type (content) and question type (task). Eval modes should target question difficulty, not passage type.

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `literal` | 1.5 | 1 | `['multiple-choice']` | MC questions about explicit details |
| `inferential` | 3.5 | 3 | `['short-answer']` | Short-answer inferential questions |
| `evaluative` | 5.5 | 4 | `['sequencing']` | Sequence events + evaluate content |

#### 26. ReadAloudStudio
- **File:** `gemini-read-aloud-studio.ts`
- **Schema field:** Needs challenge type enum (currently fluency-focused, single mode)
- **Status:** NEEDS TYPES
- **Backend:** `"read-aloud-studio": {"default": PriorConfig(3.0)}`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `echo_read` | 1.5 | 1 | `['echo_read']` | Listen then repeat (model provided) |
| `guided_read` | 3.0 | 2 | `['guided_read']` | Read with expression markers shown |
| `independent_read` | 5.0 | 4 | `['independent_read']` | Read independently, accuracy tracked |

---

## Readiness Summary

| Status | Count | Primitives |
|--------|-------|------------|
| NEEDS FIELD RENAME | 14 | LetterSpotter, LetterSoundLink, PhonicsBlender, RhymeStudio, SoundSwap, WordWorkout, StoryMap, PoetryLab, SentenceBuilder, ContextCluesDetective, FigurativeLanguageFinder, SpellingPatternExplorer, OpinionBuilder, RevisionWorkshop |
| NEEDS TYPES | 7 | PhonemeExplorer, SyllableClapper, CharacterWeb, GenreExplorer, EvidenceFinder, StoryPlanner, ReadAloudStudio |
| REVIEW | 3 | CvcSpeller, DecodableReader, ListenAndRespond |
| NEEDS FIELD RENAME (root) | 2 | TextStructureAnalyzer, ParagraphArchitect |

**Note:** All 14 "NEEDS FIELD RENAME" primitives become READY after Wave 0 (schema utility extension). The field names stay as-is in the generators — only the utility needs to accept a config parameter.

---

## Rollout Plan

### Wave 0 — Schema Utility Extension (PREREQUISITE, est. 30 min)

Extend `constrainChallengeTypeEnum()` to accept `SchemaConstraintConfig`. Backward-compatible — math generators unchanged.

| Task | Est. | Files |
|------|------|-------|
| Add `SchemaConstraintConfig` interface | 5 min | `service/evalMode/index.ts` |
| Update `constrainChallengeTypeEnum()` | 15 min | `service/evalMode/index.ts` |
| Verify existing math generators compile | 10 min | `npx tsc --noEmit` |

### Wave 1 — Reading Foundations K-2 (est. 15 min each after Wave 0)

Highest impact: phonics and phonemic awareness are foundational for all reading. These primitives have existing challenge type enums.

| Order | Primitive | Modes | Field Config | Why First |
|-------|-----------|-------|--------------|-----------|
| 1 | LetterSpotter | 3 | `{fieldName: 'mode'}` | Pre-reading foundation |
| 2 | LetterSoundLink | 3 | `{fieldName: 'mode'}` | Letter-sound correspondence |
| 3 | RhymeStudio | 3 | `{fieldName: 'mode'}` | Phonological awareness |
| 4 | SoundSwap | 3 | `{fieldName: 'operation'}` | Phoneme manipulation |
| 5 | PhonicsBlender | 4 | `{fieldName: 'patternType', rootLevel: true}` | Decoding foundation |
| 6 | WordWorkout | 4 | `{fieldName: 'mode'}` | Word-level application |

### Wave 2 — Language & Vocabulary (est. 15 min each)

Critical for cross-curricular comprehension. All have challenge type enums.

| Order | Primitive | Modes | Field Config | Why |
|-------|-----------|-------|--------------|-----|
| 7 | ContextCluesDetective | 4 | `{fieldName: 'clueType'}` | Core vocabulary strategy |
| 8 | SentenceBuilder | 4 | `{fieldName: 'sentenceType', rootLevel: true}` | Grammar progression |
| 9 | SpellingPatternExplorer | 5 | `{fieldName: 'patternType', rootLevel: true}` | Encoding progression |
| 10 | FigurativeLanguageFinder | 4 | `{arrayName: 'instances', fieldName: 'type'}` | Literary language |

### Wave 3 — Reading Comprehension & Writing (est. 15 min each)

These have existing type fields but some are content categories requiring mode redesign.

| Order | Primitive | Modes | Field Config | Why |
|-------|-----------|-------|--------------|-----|
| 11 | StoryMap | 4 | `{fieldName: 'structureType', rootLevel: true}` | Narrative comprehension |
| 12 | PoetryLab | 2 | `{fieldName: 'mode'}` | Literary analysis |
| 13 | RevisionWorkshop | 6 | `{fieldName: 'revisionSkill', rootLevel: true}` | Writing process |
| 14 | ParagraphArchitect | 3 | `{fieldName: 'paragraphType', rootLevel: true}` | Writing types |
| 15 | OpinionBuilder | 2 | `{fieldName: 'framework', rootLevel: true}` | Argumentative writing |
| 16 | TextStructureAnalyzer | 4 | Needs task type, not structure type | Informational reading |

### Wave 4 — Schema Work Required (est. 30-45 min each)

These primitives need new challenge type enums added before eval modes.

| Priority | Primitive | Est. | Why |
|----------|-----------|------|-----|
| High | PhonemeExplorer | 30 min | Core K-1 phonemic awareness |
| High | SyllableClapper | 30 min | Decoding prerequisite |
| High | CharacterWeb | 30 min | Core RL standard |
| Medium | EvidenceFinder | 30 min | Core RI standard |
| Medium | GenreExplorer | 30 min | Literary knowledge |
| Medium | StoryPlanner | 30 min | Writing process |
| Medium | ReadAloudStudio | 30 min | Fluency assessment |
| Lower | CvcSpeller | 45 min | Needs task type axis added |
| Lower | DecodableReader | 45 min | Needs task type axis added |
| Lower | ListenAndRespond | 45 min | Dual-axis (passage × question) |

---

## Progress Tracker

| # | Primitive | Strand | Status | Modes | Wave | Completed |
|---|-----------|--------|--------|-------|------|-----------|
| — | **Schema Utility** | infra | PENDING | — | 0 | |
| 1 | LetterSpotter | RF | DONE | 3 | 1 | Yes |
| 2 | LetterSoundLink | RF | NEEDS FIELD RENAME | 3 | 1 | |
| 3 | RhymeStudio | RF | NEEDS FIELD RENAME | 3 | 1 | |
| 4 | SoundSwap | RF | NEEDS FIELD RENAME | 3 | 1 | |
| 5 | PhonicsBlender | RF | NEEDS FIELD RENAME | 4 | 1 | |
| 6 | WordWorkout | RF | NEEDS FIELD RENAME | 4 | 1 | |
| 7 | ContextCluesDetective | L | NEEDS FIELD RENAME | 4 | 2 | |
| 8 | SentenceBuilder | L | NEEDS FIELD RENAME | 4 | 2 | |
| 9 | SpellingPatternExplorer | L | NEEDS FIELD RENAME | 5 | 2 | |
| 10 | FigurativeLanguageFinder | L | NEEDS FIELD RENAME | 4 | 2 | |
| 11 | StoryMap | RL | NEEDS FIELD RENAME | 4 | 3 | |
| 12 | PoetryLab | RL | NEEDS FIELD RENAME | 2 | 3 | |
| 13 | RevisionWorkshop | W | NEEDS FIELD RENAME | 6 | 3 | |
| 14 | ParagraphArchitect | W | NEEDS FIELD RENAME | 3 | 3 | |
| 15 | OpinionBuilder | W | NEEDS FIELD RENAME | 2 | 3 | |
| 16 | TextStructureAnalyzer | RI | NEEDS FIELD RENAME | 4 | 3 | |
| 17 | PhonemeExplorer | RF | NEEDS TYPES | 4 | 4 | |
| 18 | SyllableClapper | RF | NEEDS TYPES | 3 | 4 | |
| 19 | CharacterWeb | RL | NEEDS TYPES | 4 | 4 | |
| 20 | EvidenceFinder | RI | NEEDS TYPES | 3 | 4 | |
| 21 | GenreExplorer | RL | NEEDS TYPES | 3 | 4 | |
| 22 | StoryPlanner | W | NEEDS TYPES | 3 | 4 | |
| 23 | ReadAloudStudio | SL | NEEDS TYPES | 3 | 4 | |
| 24 | CvcSpeller | RF | REVIEW | 3 | 4 | |
| 25 | DecodableReader | RF | REVIEW | 3 | 4 | |
| 26 | ListenAndRespond | SL | REVIEW | 3 | 4 | |

---

## Totals

| Category | Count | Eval Modes | Est. Time |
|----------|-------|------------|-----------|
| Wave 0 (utility) | 1 | — | ~30 min |
| Wave 1 (RF K-2) | 6 | 20 | ~90 min |
| Wave 2 (Language) | 4 | 17 | ~60 min |
| Wave 3 (Comprehension/Writing) | 6 | 21 | ~90 min |
| Wave 4 (Schema work) | 10 | 32 | ~6-7 hrs |
| **Total** | **26** | **90** | — |

---

## Usage

After Wave 0 is complete, the `/add-eval-modes` skill works the same as for math. The generator must pass the `SchemaConstraintConfig` when calling `constrainChallengeTypeEnum()`:

```typescript
const activeSchema = evalConstraint
  ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
      fieldName: 'mode',        // or 'operation', 'clueType', etc.
      // arrayName: 'instances', // if not 'challenges'
      // rootLevel: true,        // if type field is at schema root
    })
  : baseSchema;
```

For NEEDS TYPES primitives, first add the challenge type enum to the schema manually, then run the skill.

---

## Backend Registry Updates

All 26 literacy primitives need per-mode entries in `problem_type_registry.py`. Currently only 5 exist with `"default"` priors. Each wave should include backend updates alongside frontend work.

Example for LetterSpotter (Wave 1):
```python
"letter-spotter": {
    "name_it":    PriorConfig(1.5, "Recognition: name the letter shown"),
    "find_it":    PriorConfig(2.5, "Guided: find target among distractors"),
    "match_it":   PriorConfig(3.5, "Application: match upper/lowercase"),
},
```
